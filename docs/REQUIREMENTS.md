# Requirements: Rem

Terakhir diperbarui: 5 Oktober 2026

## Problem Statement

AI agent yang trading atau membayar API butuh daya belanja. Kalau agent dibobol, salah konfigurasi, atau looping, daya belanja itu bisa habis dalam beberapa detik. Kill switch yang sudah ada (Phalnx, WAIaaS, Delego, delegasi agent Metaplex) semuanya menunggu manusia menekan tombol, sehingga kerugian ditentukan oleh seberapa cepat owner membaca notifikasi.

Rem menghapus manusia dari jalur kritis. Agent bekerja lewat delegate SPL, owner menandatangani satu transaksi `revoke` berbasis durable nonce di awal, dan Rem menyiarkannya otomatis lewat Solami Beam saat policy dilanggar. Rem tidak pernah memegang private key owner maupun agent.

## Goals (In Scope)

- G-01: Demo mainnet sebelum 13 Oktober 2026 13:59 WIB: rogue agent dihentikan dengan maksimal 2 transaksi bocor sebelum revoke landing.
- G-02: Latency deteksi dan latency landing Beam diukur per insiden, dengan p50 dan p95 dari minimal 20 uji landing.
- G-03: Minimal 4 produk Solami dipakai dengan fungsi nyata (gRPC, Beam, RPC, plus minimal satu dari Mirage, Webhooks, Data API, Blur).
- G-04: Developer bisa setup satu agent dalam kurang dari 10 menit.
- G-05: Juri bisa menjalankan ulang demo dengan key Solami milik juri.

## Non-Goals (Out of Scope)

- Program on-chain custom. Rem hanya memakai System Program (nonce) dan SPL Token.
- Melindungi dana yang dipegang langsung oleh key agent (bukan lewat delegate).
- Custody key owner dalam bentuk apa pun.
- Multi-chain.
- Mengembalikan dana yang sudah bocor.

## Functional Requirements

### FR-01: Setup agent
- Deskripsi: `rem setup` harus membuat nonce account (owner sebagai nonce authority), menjalankan `approve(agent, allowance)`, lalu membangun dan meminta owner menandatangani panic tx.
- Input: keypair owner (lokal), public key agent, mint, allowance, public key fee payer Rem.
- Output: file JSON berisi panic tx yang ditandatangani sebagian, alamat nonce account, nilai nonce, daftar token account.
- Priority: High
- Selesai kalau: file bisa di-decode dan isinya persis advance nonce + revoke + compute budget.

### FR-02: Validasi panic tx
- Deskripsi: sistem harus menolak panic tx yang berisi instruksi selain `AdvanceNonceAccount` (wajib pertama), SPL `Revoke`, dan ComputeBudget.
- Input: file panic tx.
- Output: diterima atau ditolak dengan alasan.
- Priority: High
- Selesai kalau: unit test mencakup tx valid, tx tanpa advance nonce, tx dengan transfer tambahan, tx dengan advance nonce bukan di urutan pertama.

### FR-03: Watcher gRPC
- Deskripsi: sistem harus men-stream transaksi yang menyentuh wallet agent dan token account owner lewat Yellowstone gRPC Solami.
- Input: daftar akun dari `rem.yaml`.
- Output: event transaksi yang sudah di-parse (signature, slot, instruksi, jumlah, tujuan, waktu terima).
- Priority: High
- Selesai kalau: transaksi uji muncul di watcher; setelah koneksi diputus, watcher reconnect dalam 5 detik dan mengulang dari slot terakhir tanpa event ganda.

### FR-04: Policy engine
- Deskripsi: sistem harus mengevaluasi setiap event terhadap aturan per agent.
- Aturan P0: allowlist tujuan, laju pengeluaran per menit, burst per 10 detik, allowlist program.
- Output: verdict `ok` atau `violation` dengan nama aturan.
- Priority: High
- Selesai kalau: setiap aturan punya unit test untuk kasus lolos dan melanggar.

### FR-05: Broadcaster
- Deskripsi: saat `violation` dan mode agent `brake`, sistem harus menambah tanda tangan fee payer dan menyiarkan panic tx lewat Beam, paralel dengan RPC cadangan.
- Output: signature, waktu kirim, slot landing, jalur yang landing duluan.
- Priority: High

### FR-06: Konfirmasi revoke
- Deskripsi: sistem harus memastikan delegate di setiap token account sudah kosong setelah broadcast.
- Output: status insiden `contained` atau `failed`.
- Priority: High

### FR-07: Cek kesehatan nonce
- Deskripsi: setiap 60 detik sistem harus membaca nilai nonce. Kalau berubah, agent ditandai `stale` dan owner diberi alert untuk tanda tangan ulang.
- Priority: High

### FR-08: Alert Telegram
- Deskripsi: setiap insiden dan status `stale` dikirim ke Telegram dengan link explorer dan angka latency.
- Priority: High

### FR-09: API dan dashboard
- Deskripsi: dashboard menampilkan daftar agent, status nonce, mode, allowance tersisa, timeline insiden, payload panic tx yang di-decode, dan grafik landing health.
- Priority: High

### FR-10: Rogue agent script
- Deskripsi: skrip yang memakai key agent untuk mengirim transfer berulang ke alamat asing lewat hak delegate.
- Priority: High

### FR-11 sampai FR-15 (P1)
- FR-11 Canary: transfer kecil ke diri sendiri lewat Beam setiap 10 menit untuk grafik landing health.
- FR-12 Webhooks Solami: push insiden ke endpoint operator.
- FR-13 Data API: baseline pengeluaran normal per agent untuk ambang otomatis.
- FR-14 Blur: aturan slippage dari swap yang di-decode.
- FR-15 Mirage: stream cadangan kalau gRPC putus.

## Non-Functional Requirements

- Performance: evaluasi policy di bawah 5 ms per event (in-memory).
- Performance: waktu dari event diterima sampai panic tx dikirim di bawah 50 ms, diukur dan dilaporkan.
- Security: tidak ada key owner atau agent di server, database, atau log. Fee payer Rem hanya menyimpan SOL, maksimal 0,05 SOL.
- Reliability: reconnect gRPC dalam 5 detik dengan replay slot, deduplikasi berdasarkan signature.
- Honesty: angka latency dilaporkan sebagai p50 dan p95 dengan jumlah sampel, bukan run terbaik.

## Constraints

- Solo builder, paralel dengan Kuota dan Sorot.
- Deadline Solami sidetrack: 13 Oktober 2026 13:59 WIB.
- Streaming gRPC butuh plan berbayar; trial Pro 7 hari dimulai 8 Oktober.
- Submission wajib live di mainnet, repo publik, demo 2 sampai 3 menit.

## Assumptions

- Agent beroperasi lewat delegate SPL, bukan memegang dana langsung.
- Panic tx yang ditandatangani sebagian bisa dilengkapi tanda tangan fee payer saat broadcast.
- Beam menerima transaksi durable nonce seperti transaksi biasa.
- Solami tidak mensyaratkan submission Colosseum (dikonfirmasi ke Solami).
