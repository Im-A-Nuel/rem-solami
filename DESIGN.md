# DESIGN.md: Rem

Arah desain berasal dari dua referensi yang diberikan pemilik proyek: (1) satu gambar konsep gelap dengan bola node wireframe 3D dan glow teal, (2) satu video scroll berisi scene yang di-pin ke viewport. Dokumen ini hanya mentranskrip pengamatan dari keduanya.

Dial: landing ENERGY 3 / RHYTHM 3 / MOTION 3. Console ENERGY 1 / RHYTHM 1 / MOTION 1.

Design Read: landing dan konsol pemantau read-only untuk developer Solana dan juri hackathon, gaya sinematik editorial gelap dengan motif wireframe tipis. Landing bergerak, console tenang karena itu layar kerja.

## Identitas

- Motif: jaringan node dan garis tipis. Bola wireframe adalah visual tunggal landing: node = akun dan tx yang diawasi, garis = aliran, inti bercahaya = agent yang dijaga. Saat panic tx mendarat, sebagian garis putus.
- Suasana: tenang, presisi, seperti ruang kontrol di malam hari. Gelap karena produk ini alat pemantau yang dipakai saat insiden, bukan karena tren.

## Warna

| Token | Nilai | Fungsi |
| --- | --- | --- |
| `--bg` | `#05080D` | Dasar, navy hampir hitam |
| `--surface` | `#0A1018` | Panel console |
| `--line` | `rgba(170, 205, 225, 0.14)` | Garis tipis, pemisah |
| `--text` | `#E7EEF4` | Teks utama |
| `--muted` | `#93A4B3` | Teks sekunder (kontras di atas bg lebih dari 7:1) |
| `--accent` | `#4DD4EC` | Satu-satunya aksen: inti bola, fokus, status armed |

Status fungsional, hanya di console dan hanya sebagai penanda status: `stale` ambar `#E8B04A`, `tripped` merah `#EF6A5E`. Bukan bagian palet dekoratif.

Glow hanya pada satu elemen per layar: inti bola di landing. Console tidak memakai glow.

## Tipografi

| Peran | Font | Alasan |
| --- | --- | --- |
| Display | Instrument Serif | Serif tipis kondensed seperti headline di video referensi; memberi suara editorial pada produk keamanan yang biasanya monospace dan neon |
| UI dan isi | Hanken Grotesk, bobot 300 sampai 500 | Sans netral dan ringan, mirip teks tipis di gambar referensi |
| Data | IBM Plex Mono | Signature, alamat base58, dan jumlah perlu karakter yang tidak ambigu (0 vs O, l vs 1) dan angka tabular |

Label uppercase ber-tracking lebar dipakai hanya untuk nav dan penanda bab (mengikuti referensi), ukuran kecil, tidak untuk judul.

## Layout dan gerak (landing)

Diturunkan dari video referensi:

- Scene setinggi viewport yang di-pin dan digerakkan oleh scroll (scrub), bukan section statis bertumpuk.
- Headline serif besar tampil per kata dengan mask dan blur.
- Scene split: teks di satu sisi, panel menyapu masuk dari sisi lain (clip-path).
- Penanda bab `01 / 04` di sudut dan garis progress tipis di tepi bawah.
- Tombol outline dengan tanda sudut tipis, bukan pill.
- Satu scene penutup dengan headline pendek, lalu footer satu baris.
- Smooth scroll (Lenis) dan GSAP ScrollTrigger. `prefers-reduced-motion`: tanpa pin, tanpa scrub, konten statis berurutan.

Bola node bereaksi pada scroll (rotasi, jarak kamera, putusnya garis saat scene Act) dan pada gerakan kursor.

## Console

Tenang dan padat. Tidak ada animasi selain transisi fokus dan hover. Hierarki mengikuti tugas layar di `docs/UI_PLAN.md`: status agent dan payload panic tx di atas, insiden dan landing health di bawahnya.

## Aturan konten

- Tidak ada angka, testimoni, logo pelanggan, atau klaim kepatuhan buatan. Nilai yang belum diukur ditulis "belum diukur" atau ditandai `[REAL DATA]`.
- Data contoh di console selalu diberi label "Sample data" yang terlihat.
- Tanpa em dash, tanpa emoji dekoratif, tanpa CTA generik.
- Logo: teks nama produk dan satu glyph node sederhana sebagai placeholder sampai pemilik proyek memberi logo.
