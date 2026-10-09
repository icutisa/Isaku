# Asal source CutsaPlay

Paket ini berasal dari source CutsaPlay yang telah diterbitkan pada 9 Oktober 2026, termasuk pembaruan riwayat tontonan.

Commit source: `1f2d99959d69db5658d941982e3abc168b791c03`.

Frontend (`live-app.mjs`, `live-core.mjs`, `ui.mjs`), stylesheet, gambar, parser API Anichin, dan pengujian parser disalin dari versi tersebut. Shell tampilan dijadikan `public/index.html`. Pembungkus React/Vinext dan hosting khusus diganti dengan `server.mjs` agar paket bisa dijalankan sebagai aplikasi Node.js mandiri. Tidak diperlukan akun ChatGPT untuk menjalankan server ini.

Parser mengakses halaman publik https://anichin.moe dan menggunakan bentuk respons yang kompatibel dengan proyek komunitas https://github.com/asmindev/anichin-api. Paket ini tidak menyertakan layanan resmi atau video tersimpan.
