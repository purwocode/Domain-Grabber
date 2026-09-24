# Domain Scraper

Ekstensi Chrome (Manifest V3) untuk mengambil semua domain unik dari link (`<a href>`) yang ada di tab aktif, termasuk dukungan paginasi hasil pencarian Google.

## Fitur

- **Scrape Current Page** — mengumpulkan semua domain unik dari halaman yang sedang aktif.
- **Next Page** — mengumpulkan domain di halaman aktif, lalu otomatis mengklik tombol "Berikutnya" pada hasil pencarian Google (`#pnnext`) untuk lanjut ke halaman berikutnya.
- Hasil scrape digabung otomatis (deduplikasi) ke dalam satu textarea di popup.
- Domain tertentu (mis. `google.com`, `youtube.com`, `facebook.com`, `instagram.com`) dikecualikan secara default — bisa diubah lewat array `exclude`/`excluded` di [popup.js](popup.js) dan [content.js](content.js).

## Instalasi (Load Unpacked)

1. Buka `chrome://extensions` di Chrome/Edge.
2. Aktifkan **Developer mode** (pojok kanan atas).
3. Klik **Load unpacked**, lalu pilih folder proyek ini.
4. Ikon "Domain Scraper" akan muncul di toolbar browser.

## Cara Pakai

1. Buka halaman yang ingin di-scrape (mis. hasil pencarian Google).
2. Klik ikon ekstensi untuk membuka popup.
3. Klik **Scrape Current Page** untuk mengambil domain dari halaman saat ini saja.
4. Klik **Next Page** untuk mengambil domain dari halaman saat ini sekaligus pindah ke halaman hasil berikutnya (bisa diklik berkali-kali untuk multi-halaman).
5. Salin hasil dari textarea output.

## Struktur File

| File | Fungsi |
|---|---|
| [manifest.json](manifest.json) | Konfigurasi ekstensi (Manifest V3), permission `scripting` & `activeTab`, host permission `<all_urls>`. |
| [popup.html](popup.html) | Tampilan popup: tombol aksi + textarea hasil. |
| [popup.js](popup.js) | Logika tombol popup; inject fungsi scrape ke tab aktif via `chrome.scripting.executeScript`. |
| [content.js](content.js) | Script standalone (loop otomatis multi-halaman + deteksi CAPTCHA). **Belum terhubung** ke manifest/popup — saat ini tidak dieksekusi otomatis. |
| [icon.png](icon.png) | Ikon toolbar ekstensi. |

## Catatan

- Selector tombol "Berikutnya" Google (`#pnnext`) bisa berubah sewaktu-waktu karena Google sering mengganti struktur HTML/class hasil pencariannya — jika tombol "Next Page" berhenti bekerja, cek ulang selector ini.
- `content.js` berisi versi alternatif (loop otomatis + deteksi CAPTCHA) yang belum di-wire ke `content_scripts` di manifest maupun dipanggil dari popup.
