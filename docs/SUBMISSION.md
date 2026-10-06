# Submission Kit: Rem

Terakhir diperbarui: 5 Oktober 2026

Solami mewajibkan: Solami sebagai jalur data, repo publik dengan README yang bisa dijalankan, demo 2 sampai 3 menit di mainnet, dan produk yang benar-benar jalan live. Submission yang tidak jalan live tidak dinilai.

## Deadline

| Target | Deadline |
| --- | --- |
| Solami sidetrack | 13 Okt 2026, 13:59 WIB (06:59 UTC) |

## Proof links

| Bukti | Link |
| --- | --- |
| Wallet demo agent | TODO |
| Tx bocor (pemicu) | TODO |
| Tx revoke (panic tx) | TODO |
| Tx agent yang gagal sesudah revoke | TODO |
| Landing p50 / p95 Beam (n = TODO) | TODO |
| Landing p50 / p95 RPC (n = TODO) | TODO |

## Checklist

### README
- [ ] Satu kalimat + link video demo di paling atas
- [ ] Tabel produk Solami dan tugasnya
- [ ] Proof links terisi
- [ ] Setup: env vars, cara memakai key Solami sendiri
- [ ] Threat model + FAQ keamanan durable nonce
- [ ] Angka latency dengan jumlah sampel

### Submission Superteam
- [ ] Link repo publik
- [ ] Link video demo (Loom atau YouTube)
- [ ] Penjelasan pemakaian Solami per produk
- [ ] Link Colosseum hanya kalau Solami mensyaratkan

---

## Demo video script (English, 2 to 3 min, mainnet)

1. **0:00 Hook.** "This agent can spend 5 USDC. In a moment it gets compromised." Show dashboard: mode brake, nonce healthy.
2. **0:20 Setup.** Show `rem setup` and the decoded panic tx: only advance nonce and revoke.
3. **0:45 Attack.** Run `rogue-agent`: repeated transfers to an unknown address.
4. **1:00 Rem reacts.** Telegram alert. Dashboard shows the rule, detection latency, Beam landing latency.
5. **1:20 On-chain proof.** Explorer: first leaked tx, revoke tx, then the agent's next transfer failing.
6. **1:50 Why Solami.** "gRPC to see, Beam to act, RPC to confirm." Show the landing health chart.
7. **2:20 Close.** "Rem never holds your keys. If Rem gets hacked, the attacker can only stop your agent."

Record at least three runs. Show p50 and p95, not the best run.

## Submission description (English)

> Rem is a non-custodial emergency brake for AI agent wallets. Agents spend through an SPL delegate; the owner signs one durable-nonce panic transaction (advance nonce + revoke) in advance. Rem streams agent activity over Solami Yellowstone gRPC, evaluates policies in memory, and lands the panic transaction through Solami Beam the moment a rule breaks, then confirms via Solami RPC. Rem never holds owner or agent keys. Demo on mainnet: a rogue agent is stopped after its first transfer. Latency: TODO (p50/p95, n = TODO).

## FAQ keamanan (salin ke README)

- **Bagaimana kalau panic tx bocor?** Isinya hanya advance nonce dan revoke. Efek terburuk: agent berhenti.
- **Bagaimana kalau server Rem dibobol?** Penyerang hanya bisa menghentikan agent dan memakai SOL kecil di fee payer Rem.
- **Bagaimana membatalkan?** Owner advance nonce sendiri, semua tx yang ditandatangani dengan nonce itu langsung mati.
- **Kenapa tidak mencegah 100% kebocoran?** Transaksi pertama yang melanggar sudah terjadi saat terdeteksi. Kerugian maksimal dibatasi oleh allowance, jadi pakai allowance kecil yang diisi ulang berkala.
