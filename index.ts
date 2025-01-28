import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import chalk from 'chalk';
import cors from 'cors';
const rateLimit = require('express-rate-limit');

let cachedData: { zaman: number; veri: any[] } = { zaman: 0, veri: [] };

const countryMapping: { [key: string]: string } = {
    "Turkey": "Türkiye",
    "Greece": "Yunanistan",
    "Azerbaijan": "Azerbaycan",
    "Cyprus": "Kıbrıs",
    "Iraq": "Irak",
    "Iran": "İran",
    "Syria": "Suriye",
    "Armenia": "Ermenistan",
    "Georgia": "Gürcistan",
    "Kahramanmaras earthquake sequence": "Kahramanmaraş deprem dizisi",
    "Turkey-Syria border region": "Türkiye-Suriye sınır bölgesi"
};

const lokasyonCevir = (location: string) => {
    const regex = /(\d+)\s+km\s+([A-Z]{1,3})\s+of\s+([^,]+),\s+(.+)/;
    const match = location.match(regex);
    if (match) {
        let yon = match[2];
        switch (yon) {
            case 'N':
                yon = 'K'; // Kuzey
                break;
            case 'E':
                yon = 'D'; // Doğu
                break;
            case 'S':
                yon = 'G'; // Güney
                break;
            case 'W':
                yon = 'B'; // Batı
                break;
            case 'NE':
                yon = 'KD'; // Kuzeydoğu
                break;
            case 'SE':
                yon = 'GD'; // Güneydoğu
                break;
            case 'SW':
                yon = 'GB'; // Güneybatı
                break;
            case 'NW':
                yon = 'KB'; // Kuzeybatı
                break;
            case 'NNE':
                yon = 'KKD'; // Kuzey-Kuzeydoğu
                break;
            case 'ENE':
                yon = 'DKD'; // Doğu-Kuzeydoğu
                break;
            case 'ESE':
                yon = 'DGD'; // Doğu-Güneydoğu
                break;
            case 'SSE':
                yon = 'GGD'; // Güney-Güneydoğu
                break;
            case 'SSW':
                yon = 'GGB'; // Güney-Güneybatı
                break;
            case 'WSW':
                yon = 'BGB'; // Batı-Güneybatı
                break;
            case 'WNW':
                yon = 'BKB'; // Batı-Kuzeybatı
                break;
            case 'NNW':
                yon = 'KKB'; // Kuzey-Kuzeybatı
                break;
        }
        const ulke = countryMapping[match[4].trim()] || match[4].trim();
        return {
            yon: yon,
            uzaklik: parseInt(match[1], 10),
            sehir: match[3].trim(),
            ulke: ulke
        };
    } else {
        // Handle cases where the regex does not match
        const parts = location.split(',');
        if (parts.length === 2) {
            const ulke = countryMapping[parts[1].trim()] || parts[1].trim();
            return {
                yon: '',
                uzaklik: 0,
                sehir: parts[0].trim(),
                ulke: ulke
            };
        } else {
            return {
                yon: '',
                uzaklik: 0,
                sehir: location,
                ulke: ''
            };
        }
    }
};

const depremleriCek = async () => {
    const minBoylam = 25.0;
    const maxBoylam = 45.0;
    const minEnlem = 35.0;
    const maxEnlem = 43.0;

    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2023-01-01&endtime=2023-12-31&minlatitude=${minEnlem}&maxlatitude=${maxEnlem}&minlongitude=${minBoylam}&maxlongitude=${maxBoylam}`;

    try {
        console.log(chalk.blue(`[${new Date().toISOString()}] Deprem verileri çekiliyor...`));
        console.log(chalk.cyan(`[${new Date().toISOString()}] URL: ${url}`));
        const yanit = await axios.get(url);
        const depremler = yanit.data.features;
        const zaman = Math.floor(Date.now() / 1000);

        // JSON için formatlanmış veri dizisi oluştur
        const veri = depremler.map((deprem: any) => ({
            buyukluk: deprem.properties.mag,
            lokasyon: lokasyonCevir(deprem.properties.place),
            zaman: new Date(deprem.properties.time).toISOString(),
            enlem: deprem.geometry.coordinates[1],
            boylam: deprem.geometry.coordinates[0],
            derinlik: deprem.geometry.coordinates[2]
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

app.listen(PORT, () => {
    console.log(chalk.green(`[${new Date().toISOString()}] Sunucu ${PORT} portunda başlatıldı.`));
    depremleriCek();
});
