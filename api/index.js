import express from 'express';
import fetch from 'node-fetch';

const app = express();

const ambilDataPostinganYouTube = (html, respons) => {
    const dataAwal = html.match(/ytInitialData = (.+?);</)?.[1];
    if (!dataAwal) {
        throw new Error("Tidak dapat menemukan data pada postingan. Pastikan tautan yang dimasukkan benar.");
    }
    const json = JSON.parse(dataAwal);
    let tipePostingan = null;
    let daftarGambar = null;
    let urlVideoDibagikan = null;
    const rendererPostingan = json?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.backstagePostThreadRenderer?.post?.backstagePostRenderer;
    if (!rendererPostingan) {
        throw new Error("Tautan yang diberikan tampaknya bukan postingan YouTube yang valid atau terjadi kesalahan.");
    }
    const postinganVoting = rendererPostingan?.backstageAttachment?.pollRenderer?.choices;
    const postinganMultiGambar = rendererPostingan?.backstageAttachment?.postMultiImageRenderer?.images;
    const postinganGambarTunggal = rendererPostingan?.backstageAttachment?.backstageImageRenderer?.image?.thumbnails;
    const postinganBerbagiVideo = rendererPostingan?.backstageAttachment?.videoRenderer?.videoId;
    if (postinganVoting) {
        let adalahVotingGambar = false;
        daftarGambar = postinganVoting.map(pilihan => {
            const teks = pilihan.text.runs[0].text;
            let urlGambar = pilihan.image?.thumbnails || null;
            if (urlGambar) {
                urlGambar = urlGambar.map(thumbnail => thumbnail.url).pop();
                adalahVotingGambar = true;
            }
            return { teks, url: urlGambar };
        });
        tipePostingan = adalahVotingGambar ? "voteImage" : "voteText";
    } else if (postinganMultiGambar) {
        tipePostingan = "multipleImages";
        const kumpulanGambar = postinganMultiGambar.map(item => item.backstageImageRenderer.image.thumbnails);
        daftarGambar = kumpulanGambar.map(kumpulanThumbnail => {
            const url = kumpulanThumbnail.map(thumbnail => thumbnail.url).pop();
            return { url, teks: null };
        });
    } else if (postinganGambarTunggal) {
        tipePostingan = "singleImage";
        daftarGambar = [{
            url: postinganGambarTunggal.map(thumbnail => thumbnail.url).pop(),
            teks: null
        }];
    } else if (postinganBerbagiVideo) {
        tipePostingan = "videoShare";
        urlVideoDibagikan = new URL(respons.url).origin + '/watch?v=' + postinganBerbagiVideo;
    } else {
        tipePostingan = "text";
    }
    let tag = json?.microformat?.microformatDataRenderer?.tags || null;
    if (tag) {
        tag = tag.join(", ");
    }
    const hasil = {
        penulis: rendererPostingan.authorText.runs[0].text,
        urlPenulis: new URL(respons.url).origin + rendererPostingan.authorEndpoint.commandMetadata.webCommandMetadata.url,
        waktuPublikasi: rendererPostingan.publishedTimeText.runs[0].text,
        tanggalPublikasi: json.microformat.microformatDataRenderer.publishDate,
        tag,
        teks: rendererPostingan.contentText.runs.map(bagian => bagian.text).join(""),
        jumlahSuka: rendererPostingan?.voteCount?.accessibility?.accessibilityData?.label || null,
        gambar: daftarGambar,
        urlVideoDibagikan,
        urlPostingan: json.microformat.microformatDataRenderer.urlCanonical,
        tipePostingan
    };
    return hasil;
};

app.get('/ambil-data', async (req, res) => {
    const urlYoutube = req.query.url;
    if (!urlYoutube) {
        return res.status(400).json({ error: 'Parameter URL tidak ditemukan' });
    }
    try {
        const respons = await fetch(urlYoutube, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        if (!respons.ok) throw new Error(`Gagal mengambil data dari YouTube: ${respons.statusText}`);
        const html = await respons.text();
        const dataHasil = ambilDataPostinganYouTube(html, respons);
        res.json(dataHasil);
    } catch (error) {
        res.status(500).json({ error: 'Gagal memproses data di server', detail: error.message });
    }
});

export default app;
