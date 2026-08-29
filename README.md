# BOLA UTAMA — RapidAPI Live + ScoreBat Highlight

Project produksi Node.js/Express untuk Railway. Sumber **live streaming utama adalah 1xAPI Football Live Streaming API di RapidAPI**. ScoreBat digunakan **khusus highlight**. API-Football digunakan untuk fixture/livescore/skor.

## Live streaming

Backend mengambil katalog stream melalui `STREAM_API_BASE + STREAM_MATCHES_PATH` dengan header `x-rapidapi-key` dan `x-rapidapi-host`. Data dinormalisasi, lalu filter server-side membuang MMA/UFC, boxing, wrestling/gulat, basket, tennis, hockey, rugby, NFL/AFL, cricket, baseball, esports, motorsport, dan kategori non-sepak-bola lainnya.

Hanya dua status yang dikirim ke member:
- `live` — pertandingan sedang berlangsung.
- `upcoming` — pertandingan akan datang dalam jangka `STREAM_UPCOMING_HOURS` (default 24 jam).

Pertandingan selesai/cancel/postponed/abandoned tidak dimasukkan ke katalog live. LIVE selalu disusun di atas upcoming.

`/api/stream/resolve/:slug` mengambil server untuk pertandingan. HLS/direct video diputar melalui signed proxy internal `/api/stream/proxy`; provider yang secara eksplisit mengirim tipe embed/iframe ditampilkan melalui iframe player di domain BOLA UTAMA. Beberapa server provider akan muncul sebagai Server 1, Server 2, dan seterusnya.

Admin HLS masih tersedia sebagai fallback manual, tetapi jika `RAPIDAPI_KEY` aktif maka RapidAPI adalah provider otomatis utama.

## Halaman member

`/livescore?tab=live` mempunyai filter **Live**, **Akan Datang**, dan **Semua**. Hanya sepak bola yang masuk. Halaman `/match/:id` berisi player, pilihan server, skor, dan komentar. Tab Ringkasan, Statistik, Susunan Pemain, Riwayat, dan Klasemen tidak ditampilkan di halaman live. Skor direfresh setiap 15 detik ketika fixture ID berhasil dicocokkan ke API-Football.

## Highlight

ScoreBat Video API v3 mengisi `/api/highlights`. Highlight dibuka melalui modal/player di website BOLA UTAMA dan halaman `/highlight/:id`, tanpa menjadikan ScoreBat sebagai provider live streaming.

## Railway

Salin variabel dari `RAILWAY-VARIABLES.txt`. Railway memberikan `PORT` otomatis; aplikasi menggunakan `process.env.PORT || 3000` untuk local fallback.

Variabel penting live:

```env
RAPIDAPI_KEY=ISI_X_RAPIDAPI_KEY
STREAM_API_HOST=football-live-streaming-api.p.rapidapi.com
STREAM_API_BASE=https://football-live-streaming-api.p.rapidapi.com
STREAM_MATCHES_PATH=/matches
STREAM_CACHE_SECONDS=120
STREAM_UPCOMING_HOURS=24
```

Provider RapidAPI dapat mengubah host/path. Jika halaman 1xAPI pada akunmu menunjukkan host atau endpoint berbeda, gunakan nilai yang ditampilkan oleh RapidAPI tanpa mengubah source code.

## Pemeriksaan setelah deploy

- `GET /health` → `streamProvider` harus `rapidapi-1xapi` ketika `RAPIDAPI_KEY` terpasang.
- `GET /api/diagnostics` → lihat `stream.keyReady`, `stream.ok`, `stream.items`, `stream.live`, `stream.upcoming`.
- `GET /api/streams` → hanya football/soccer, status live/upcoming.
- Klik satu match → `/api/stream/resolve/:id` harus mengembalikan minimal satu server yang punya `playUrl` atau `embedUrl`.

Gunakan live feed hanya sesuai lisensi/hak distribusi provider dan kompetisi terkait.


## Sarang-style UI final
- Halaman match live hanya player, pilihan server, skor, komentar, dan daftar Live Streaming Bola Lainnya. Tidak ada Ringkasan, Statistik, Susunan Pemain, Riwayat, atau Klasemen pada halaman live.
- Beranda memakai layout clean untuk Pertandingan Besar Minggu Ini, Prediksi, dan Klasemen.
- Semua Banner Beranda yang aktif di Admin diputar otomatis. Interval dapat diatur melalui Pengaturan > Rotasi Banner Beranda (detik).
- Banner/gambar tetap berasal dari Admin, bukan hardcode.

## LIVE MATCH CLEAN FIX (2026-08-29)
- Renderer `/match/:id` kini hanya satu sumber di `public/app.js`.
- Override match lama di `public/enhancements.js` telah dihapus agar tab Ringkasan/Statistik/Susunan Pemain/Riwayat/Klasemen tidak kembali muncul.
- Layout live: banner admin (opsional), tombol kembali, player + server di kiri, skor + komentar di kanan, lalu Live Stream Bola lainnya di bawah.
- Skor refresh otomatis 15 detik saat fixture API-Football tersedia.
- Asset JS diberi cache-busting query agar deployment Railway tidak memakai frontend versi lama dari cache browser.
