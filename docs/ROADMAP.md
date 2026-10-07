# MVP Roadmap: Rem

Terakhir diperbarui: 5 Oktober 2026

## MVP Definition

MVP selesai kalau rogue agent di mainnet dihentikan otomatis oleh panic tx yang disiarkan lewat Solami Beam, dengan link explorer untuk tx bocor, tx revoke, dan tx agent yang gagal sesudahnya, plus angka latency p50 dan p95.

## Timeline Overview

| Fase | Tanggal | Tujuan |
| --- | --- | --- |
| 0. De-risk | Sen 5 Okt | Panic tx durable nonce landing di devnet setelah ditandatangani lebih dulu |
| 1. Foundation | Sel 6 sampai Rab 7 Okt | `rem setup`, validator, policy engine, rogue agent (tanpa Solami) |
| 2. Solami core | Kam 8 sampai Jum 9 Okt | gRPC watcher, Beam broadcaster, uji end-to-end mainnet |
| 3. Polish | Sab 10 sampai Min 11 Okt | Dashboard, alert, landing stats, video, README |
| 4. Submit | Sen 12 sampai Sel 13 Okt | Buffer, P1, submit |

Rem dikerjakan berselang dengan Kuota. Rabu 7 Oktober (hari launch Kuota) sengaja ringan untuk Rem.

---

## Fase 0: De-risk
**Durasi**: 1 hari (Sen 5 Okt)

### Tasks
- [ ] Buat nonce account di devnet dengan owner sebagai authority
- [ ] `approve` USDC devnet ke wallet agent uji
- [ ] Bangun tx advance nonce + revoke, owner tanda tangan, simpan
- [ ] Tunggu beberapa menit, tambahkan tanda tangan fee payer, kirim, pastikan landing
- [ ] Kirim tx yang sama lagi, pastikan gagal (nonce sudah maju)
- [ ] Tanya Solami soal syarat submission Colosseum

---

## Fase 1: Foundation
**Durasi**: 2 hari (Sel 6 sampai Rab 7 Okt)

### Tasks
- [ ] Setup `worker/` (TypeScript), struktur modul, SQLite, CI
- [ ] `rem setup` + `rem agent add`
- [ ] `worker/src/nonce` `validatePanicTx` + unit test 4 kasus (valid, tanpa advance nonce, ada transfer, urutan salah)
- [ ] `worker/src/policy`: empat aturan P0 + unit test lolos dan melanggar
- [ ] Rab 7 (ringan): `scripts/rogue-agent` di devnet

---

## Fase 2: Solami Core
**Durasi**: 2 hari (Kam 8 sampai Jum 9 Okt)

### Tasks
- [ ] Kam 8: daftar trial Solami Pro, uji gRPC `Subscribe` dengan filter akun
- [ ] Kam 8: `worker/src/watch` dengan reconnect, `from_slot` replay, dedupe signature
- [ ] Jum 9: `worker/src/broadcast` lewat Beam + RPC paralel, catat timing
- [ ] Jum 9: konfirmasi delegate kosong lewat RPC
- [ ] Jum 9: uji end-to-end di mainnet dengan allowance 5 USDC

---

## Fase 3: Polish
**Durasi**: 2 hari (Sab 10 sampai Min 11 Okt)

### Tasks
- [ ] Sab 10: dashboard (agents, incidents, decoded panic tx, landing chart)
- [ ] Sab 10: alert Telegram
- [ ] Sab 10: minimal 20 uji landing untuk p50 dan p95
- [ ] Min 11: rekam demo minimal 3 kali, pilih yang representatif
- [ ] Min 11: README lengkap + threat model + tabel produk Solami

---

## Fase 4: Submit
**Durasi**: Sen 12 sampai Sel 13 Okt

### Tasks
- [ ] Sen 12: buffer, atau P1 (Webhooks, Data API, Mirage fallback, canary)
- [ ] Sel 13 sebelum 13:59 WIB: submit Solami sidetrack

---

## Kill Criteria

- Rab 7 Okt: kalau panic tx durable nonce belum berhasil landing di devnet, sederhanakan. Rem memegang key sub-wallet khusus yang hanya berisi modal kerja agent, lalu menandatangani revoke saat insiden. Trade-off ini dicatat di README.
- Jum 9 Okt: kalau gRPC belum stabil, pindah ke Mirage dan berhenti mengejar gRPC.
- Sab 10 Okt: kalau end-to-end mainnet belum jalan, semua P1 dibatalkan.

---

## Parking Lot (Post-MVP)

- Multi-agent dan multi-owner dengan login
- Badge "dilindungi Rem" untuk protokol yang memberi allowance ke agent
- Integrasi dengan vault x402 dan delegasi ERC-7710 di EVM
- Ambang policy otomatis dari baseline Data API
- Postgres dan beberapa proses watcher

---

## Definition of Done

- Berjalan di mainnet dengan link tx
- Unit test lulus, typecheck bersih
- Tidak ada key owner atau agent di server, database, atau log
- Angka latency punya jumlah sampel
