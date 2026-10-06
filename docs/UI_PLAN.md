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

- [ ] Putuskan arah desain, tulis `DESIGN.md` (identitas, palet, tipografi, mood, dial ENERGY/RHYTHM/MOTION)
- [ ] Jalankan `ui-ux-pro-max --design-system --persist` ke `design-system/rem/MASTER.md`
- [ ] Scaffold `web/`: Next.js, Tailwind, Recharts, pnpm, TypeScript strict
- [ ] Token desain (warna, spasi, radius, tipografi) sebagai CSS variables, tema terang dan gelap sama-sama jalan (R-34)

### UI-1: Kontrak dan data

- [ ] Tipe TypeScript dari `SCHEMA.md` (agent, panic decoded, incident, landing, error envelope)
- [ ] Klien API + fixture yang cocok dengan kontrak, pindah sumber lewat env
- [ ] Banner "Sample data" saat memakai fixture

### UI-2: Layar

- [ ] Agents (`/`)
- [ ] Agent detail dengan panic tx ter-decode
- [ ] Incidents timeline
- [ ] Landing health (Recharts, histogram p50 dan p95, n terlihat)

### UI-3: Kualitas

- [ ] Empty, loading, error untuk tiap layar
- [ ] Responsif 360px sampai desktop, tanpa overflow, tap target 44px (R-03)
- [ ] Keyboard penuh, focus ring terlihat, kontras AA (R-25, R-32)
- [ ] `prefers-reduced-motion`, gerak hanya dengan tujuan jelas (R-19)
- [ ] Jalankan dev server, uji semua elemen interaktif, cek console (R-35)
- [ ] Delivery Gate antislop sebagai laporan PASS/FAIL dengan bukti

### UI-4: Sambung ke Go (setelah `internal/api` ada)

- [ ] Ganti sumber ke API asli, hapus fixture dari jalur produksi
- [ ] Isi proof links dan angka latency nyata untuk video demo

## Urutan terhadap roadmap

Roadmap menjadwalkan dashboard di Sab 10 Okt dan menetapkan kill criteria Rab 7 Okt untuk panic tx durable nonce di devnet. Memulai dari UI memajukan pekerjaan Fase 3, jadi UI-0 sampai UI-2 dibatasi waktu (target selesai Rab 7 pagi) supaya spike nonce Fase 0 tetap sempat dikerjakan sebelum kill criteria. Risiko terbesar proyek ada di nonce dan Beam, bukan di dashboard.

## Git

- Pekerjaan dashboard di branch `feat/dashboard` (fitur besar).
- Commit kecil dan sering, conventional commits, push tiap perubahan.
- Kontributor hanya Im-A-Nuel, tanpa trailer Co-Authored-By.
