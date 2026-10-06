# UI Plan: Rem Dashboard

Terakhir diperbarui: 6 Oktober 2026

Dashboard di `web/` adalah konsumen read-only dari API Go (lihat FR-09 dan `docs/SCHEMA.md`). Plan ini memulai pekerjaan dari UI, sebelum backend Go ada. Alat desain: `ui-ux-pro-max`, `antislop`, `antislop-ui`.

## Tugas layar

Operator membuka dashboard untuk menjawab dua hal:

1. Apakah agent saya terlindungi sekarang? (mode, status nonce, allowance tersisa)
2. Kalau sudah tripped, apa yang terjadi, secepat apa, dan bisa diverifikasi di chain?

Keputusan yang diambil operator di layar: tanda tangan ulang panic tx (status `stale`), atau percaya bahwa panic tx hanya berisi advance nonce, revoke, dan compute budget. Payload yang di-decode adalah elemen paling penting untuk kepercayaan, jadi hierarkinya mengikuti itu, bukan template dashboard (sidebar + empat stat card + chart + tabel).

## Layar (hanya yang punya endpoint)

| Layar | Route | Endpoint | Isi |
| --- | --- | --- | --- |
| Agents | `/` | `GET /agents` | Daftar agent: nama, wallet, mode, status, nonce sehat atau tidak, allowance tersisa |
| Agent detail | `/agents/[name]` | `GET /agents/:name/panic`, `GET /incidents?agent=` | Payload panic tx ter-decode (program, instruksi, akun), riwayat insiden agent |
| Incidents | `/incidents` | `GET /incidents` | Timeline: rule, tx pemicu, tx revoke, tx bocor, detection ms, send ms, landing slot dan ms, jalur landing |
| Landing health | `/landing` | `GET /landing` | p50 dan p95 Beam vs RPC, selalu dengan jumlah sampel (n) |

Navigasi hanya memuat empat layar ini (R-24). Tidak ada tombol arm, disarm, atau re-sign, karena API read-only (R-26). Tombol hanya untuk aksi nyata: link explorer, salin signature, filter, ganti tema.

## Aturan data (jujur)

- API Go belum ada. UI memakai klien bertipe yang mengikuti kontrak `SCHEMA.md`, dengan dua sumber: `NEXT_PUBLIC_REM_API` (API asli) atau fixture lokal.
- Fixture selalu ditandai di UI dengan label "Sample data" yang terlihat. Tidak ada angka, nama, atau signature palsu yang tampil seolah nyata (R-17, R-38).
- Latency selalu p50 dan p95 dengan n. Kalau n = 0, tampil "belum diukur", bukan nol (CLAUDE.md: tidak melaporkan run terbaik sebagai tipikal).
- Amount dalam base units string, diformat dengan decimals mint. Tidak pernah `float`.
- Delta dan tren hanya muncul kalau periode pembanding nyata.

## State wajib (R-27)

Setiap layar punya state empty, loading, dan error yang menyebut penyebab dan langkah berikut. Status agent punya empat tampilan berbeda: `armed`, `stale` (butuh tanda tangan ulang), `tripped`, `disarmed`. Mode `alert` dan `brake` dibedakan jelas.

## Fase

### UI-0: Fondasi (branch `feat/dashboard`)

- [x] Putuskan arah desain, tulis `DESIGN.md` (identitas, palet, tipografi, mood, dial ENERGY/RHYTHM/MOTION)
- [ ] Jalankan `ui-ux-pro-max --design-system --persist` ke `design-system/rem/MASTER.md` (ditunda: arah desain sudah ditetapkan di `DESIGN.md` dari referensi pemilik proyek)
- [x] Scaffold `web/`: Next.js, Tailwind, Recharts, pnpm, TypeScript strict
- [x] Token desain (warna, tipografi) sebagai CSS variables. Hanya tema gelap, tanpa toggle: arah dari referensi pemilik proyek dan produk ini alat pemantau insiden (R-21, R-34 tidak berlaku karena tidak ada toggle)

### UI-1: Kontrak dan data

- [x] Tipe TypeScript dari `SCHEMA.md` (agent, panic decoded, incident, landing, error envelope)
- [x] Klien API + fixture yang cocok dengan kontrak, pindah sumber lewat env
- [x] Banner "Sample data" saat memakai fixture

### UI-2: Layar

- [x] Agents (`/`)
- [x] Agent detail dengan panic tx ter-decode
- [x] Incidents timeline
- [x] Landing health (Recharts, histogram p50 dan p95, n terlihat)

### UI-3: Kualitas

- [x] Empty, loading, error untuk tiap layar (uji lewat `?mock=empty|error|slow`)
- [x] Responsif 390px sampai 1440px diuji tanpa overflow horizontal (360px belum diuji), tanpa overflow, tap target 44px (R-03)
- [x] Keyboard (Tab, Enter, Escape) dan focus ring terlihat diuji (R-32)
- [ ] Kontras AA diukur dengan alat, belum (R-25)
- [x] `prefers-reduced-motion`, gerak hanya dengan tujuan jelas (R-19)
- [x] Jalankan build produksi, uji elemen interaktif, console bersih (R-35)
- [ ] Delivery Gate antislop sebagai laporan PASS/FAIL dengan bukti

### UI-4: Sambung ke Go (setelah `internal/api` ada)

- [ ] Ganti sumber ke API asli, hapus fixture dari jalur produksi
- [ ] Isi proof links dan angka latency nyata untuk video demo

## Urutan terhadap roadmap

Roadmap menjadwalkan dashboard di Sab 10 Okt dan menetapkan kill criteria Rab 7 Okt untuk panic tx durable nonce di devnet. Memulai dari UI memajukan pekerjaan Fase 3, jadi UI-0 sampai UI-2 dibatasi waktu (target selesai Rab 7 pagi) supaya spike nonce Fase 0 tetap sempat dikerjakan sebelum kill criteria. Risiko terbesar proyek ada di nonce dan Beam, bukan di dashboard.

## Landing

Landing dan console sama-sama di `web/`. Landing `/` adalah cerita scroll sinematik (Lenis + GSAP ScrollTrigger + Three.js) dengan tiga mode gerak: pinned (layar lebar dan tinggi), flowing (HP dan layar pendek), dan statis (`prefers-reduced-motion`). Arah desain ada di `DESIGN.md`.

## Git

- Pekerjaan dashboard di branch `feat/dashboard` (fitur besar).
- Commit kecil dan sering, conventional commits, push tiap perubahan.
- Kontributor hanya Im-A-Nuel, tanpa trailer Co-Authored-By.
