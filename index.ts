import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import chalk from 'chalk';
import cors from 'cors';
const rateLimit = require('express-rate-limit');

let cachedData: { zaman: number; veri: any[] } = { zaman: 0, veri: [] };

const formatDate = (date: Date) => {
    return date.toISOString().slice(0, 19).replace('T', ' ');
};

const depremleriCek = async () => {
    const minBoylam = 25.0;
    const maxBoylam = 45.0;
    const minEnlem = 35.0;
    const maxEnlem = 43.0;

    const now = new Date();
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    
    const endDate = formatDate(now);
    const startDate = formatDate(fourDaysAgo);
    const url = `https://deprem.afad.gov.tr/apiv2/event/filter?start=${startDate}&end=${endDate}`;

    try {
        console.log(chalk.blue(`[${new Date().toISOString()}] Deprem verileri çekiliyor...`));
        console.log(chalk.cyan(`[${new Date().toISOString()}] URL: ${url}`));
        const yanit = await axios.get(url);
        const depremler = yanit.data;
        const zaman = Math.floor(Date.now() / 1000);

        // Map the new data structure
        const veri = depremler.map((deprem: any) => ({
            rms: deprem.rms,
            kimlik: deprem.eventID,
            lokasyon: deprem.location,
            enlem: deprem.latitude,
            boylam: deprem.longitude,
            derinlik: deprem.depth,
            tip: deprem.type,
            buyukluk: deprem.magnitude,
            ulke: deprem.country,
            il: deprem.province,
            ilce: deprem.district,
            mahalle: deprem.neighborhood,
            tarih: deprem.date,
            guncelleme: deprem.isEventUpdate,
        }));

        const son = {
            zaman: zaman,
            veri
        }

        // RAM'de veriyi sakla
        cachedData = son;
        console.log(chalk.green(`[${new Date().toISOString()}] Deprem verileri başarıyla çekildi.`));
    } catch (hata) {
        console.error(chalk.red(`[${new Date().toISOString()}] Deprem verileri çekilirken hata oluştu:`), hata);
    }
};

// Fetch data every 5 minutes
setInterval(depremleriCek, 5 * 60 * 1000);

const app = express();
const PORT = 2929;

app.get('/veri/json', (_req, res) => {
    res.json(cachedData);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/veri', (req, res) => {
    res.redirect('/veri/json');
});

app.use(cors());
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 150, // limit each IP to 100 requests per windowMs
    message: '15 dakikada 100 istekten fazla istek gönderdiniz.'
});

app.use(limiter);
app.set('trust proxy', 1 /* number of proxies between user and server */)

app.listen(PORT, () => {
    console.log(chalk.green(`[${new Date().toISOString()}] Sunucu ${PORT} portunda başlatıldı.`));
    depremleriCek();
});
