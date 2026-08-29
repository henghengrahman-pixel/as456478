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
