# CutsaPlay — source code untuk GitHub

Website donghua dengan katalog Anichin, pencarian, genre, detail judul, daftar episode, pilihan server video, favorit, dan riwayat tontonan. Paket ini sudah menyertakan tampilan riwayat terbaru: poster proporsional, kartu ringkas, kelompok per hari, dan tombol **Tonton lagi**.

Paket ini memakai **Node.js** sebagai server. Frontend dan API berada pada satu aplikasi; tidak memerlukan server Python atau API key terpisah. Salin seluruh isi folder `cutsaplay` ke repo GitHub.

## Jalankan

Pasang Node.js **22.13.0 atau lebih baru**. Pengujian paket dilakukan dengan Node.js 24.19.0.

Di dalam folder yang berisi `package.json`:

```bash
npm ci
npm start
```

Buka http://localhost:3000.

Untuk mengembangkan kode dengan restart otomatis:

```bash
npm run dev
```

Untuk memeriksa kode:

```bash
npm run check
npm test
```

## Upload ke GitHub

1. Unduh dan **ekstrak ZIP** ini.
2. Buat repo GitHub bernama `cutsaplay`. Pilih visibilitas sesuai kebutuhan.
3. Upload **isi folder `cutsaplay`**, sehingga `package.json`, `server.mjs`, `public/`, dan `lib/` berada di root repo.
4. Sertakan `package-lock.json` dan `.gitignore`. Jangan upload folder `node_modules`.

Mengupload ZIP sebagai satu file hanya menyimpan arsip; GitHub tidak otomatis mengekstraknya menjadi project.

Jika memakai Git di komputer/VPS, buat repo kosong dahulu, lalu ganti `USERNAME` pada URL berikut:

```bash
git init
git add .
git commit -m "Source awal CutsaPlay"
git branch -M main
git remote add origin https://github.com/USERNAME/cutsaplay.git
git push -u origin main
```

Perintah tersebut memakai metode login GitHub yang sudah tersedia pada perangkatmu.

## Agar website online

GitHub dapat menyimpan source project ini. **GitHub Pages hanya melayani website statis**, sehingga tidak dapat menjalankan backend `/api/anichin/` dalam paket ini. Dokumentasi: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages.

Hubungkan repo ke hosting yang mendukung aplikasi Node.js, atau jalankan pada VPS. Konfigurasi aplikasi:

| Pengaturan | Nilai |
| --- | --- |
| Root directory | Folder yang berisi `package.json` |
| Install command | `npm ci --omit=dev` |
| Start command | `npm start` |
| Build | Tidak memerlukan langkah build frontend |
| Node.js | 22.13.0 atau lebih baru |
| Port | `PORT` dari hosting; default `3000` |
| Health check | `/healthz` |

VPS bersifat opsional: paket dapat berjalan pada layanan hosting Node.js. Untuk domain pada VPS, arahkan reverse proxy HTTPS ke port aplikasi. Perintah `npm start` berjalan selama prosesnya hidup; gunakan pengelola proses pada hosting/VPS untuk membuatnya terus berjalan.

## File yang bisa diedit

| File | Isi |
| --- | --- |
| `public/index.html` | Header, menu, footer, dan shell halaman |
| `public/styles.css` | Warna, ukuran, tampilan desktop/HP, dan kartu riwayat |
| `public/live-app.mjs` | Tampilan halaman, pemutar, favorit, dan riwayat |
| `public/live-core.mjs` | URL halaman, validasi link, dan data lokal |
| `public/ui.mjs` | Komponen DOM dan ikon |
| `public/assets/` | Gambar dan favicon |
| `lib/anichin.mjs` | Parser dan koneksi API Anichin |
| `server.mjs` | Server Node.js, file statis, dan route API |
| `tests/` | Pengujian parser, penyimpanan lokal, dan server |

## API yang tersedia

| Endpoint | Fungsi |
| --- | --- |
| `/api/anichin/home` | Rilisan terbaru, populer, rekomendasi, dan jadwal |
| `/api/anichin/anime?page=2` | Halaman katalog |
| `/api/anichin/anime?genre=action` | Katalog per genre |
| `/api/anichin/search?q=immortal&page=1` | Pencarian judul |
| `/api/anichin/genres` | Daftar genre |
| `/api/anichin/info/SLUG-JUDUL` | Detail dan daftar episode |
| `/api/anichin/episode/SLUG-EPISODE` | Episode dan pilihan player |
| `/api/anichin/video-source/SLUG-EPISODE` | Data sumber/player episode |
| `/api/anichin/schedule` | Jadwal mingguan |

`SLUG-JUDUL` dan `SLUG-EPISODE` diganti dengan slug dari hasil API. Player diputar dari server pihak ketiga; server CutsaPlay tidak menyimpan atau meneruskan file video. Kualitas, iklan, dan ketersediaan mengikuti server video.

API merupakan adapter komunitas yang membaca halaman publik https://anichin.moe. Bentuk respons kompatibel dengan https://github.com/asmindev/anichin-api. Domain/struktur halaman sumber dapat berubah dan memerlukan pembaruan parser.

Favorit dan riwayat disimpan pada browser. Saat pindah domain, data dari domain lama tidak otomatis berpindah. Riwayat mencatat episode terakhir dibuka; posisi pemutaran iframe pihak ketiga tidak bisa dibaca oleh aplikasi. Tampilan paket mandiri tidak memiliki gerbang masuk ChatGPT.

## Jika ada kendala

- **`npm ci` gagal karena versi Node:** pastikan versi memenuhi persyaratan di atas.
- **`EADDRINUSE`:** port sedang dipakai. Ubah `PORT` pada konfigurasi hosting atau jalankan `PORT=3001 npm start` pada Linux/macOS.
- **Halaman tampil tetapi katalog gagal:** buka `/api/anichin/home` untuk melihat pesan error sumber. Pastikan server dapat mengakses internet.
- **Satu player kosong:** coba server video lain atau tombol **Buka player**.
- **Tampilan lama masih muncul:** muat ulang halaman.

Source lengkap berada di paket ini. Instalasi dependency memerlukan internet. Detail asal versi ada di `ASAL-SOURCE.md`; hasil pemeriksaan paket ada di `VALIDASI.md`.
