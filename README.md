# Domain Scraper

> Bahasa Indonesia | [English](README.en.md)

Ekstensi Chrome (Manifest V3) untuk mengambil semua domain unik dari link (`<a href>`) yang ada di tab aktif, termasuk dukungan paginasi hasil pencarian Google.

## Fitur

- **Scrape Current Page** — mengumpulkan semua domain unik dari halaman yang sedang aktif.
- **Next Page** — mengumpulkan domain di halaman aktif, lalu otomatis mengklik tombol "Berikutnya" pada hasil pencarian Google (`#pnnext`) untuk lanjut ke halaman berikutnya.
- **Auto-simpan ke Supabase** — opsional, setiap kali scrape (Scrape Current Page / Next Page) domain otomatis dikirim ke tabel Supabase, tanpa tombol terpisah (lihat [Integrasi Supabase](#integrasi-supabase)).
- **Lihat Dashboard** — buka tab terpisah ([dashboard.html](dashboard.html)) untuk menampilkan domain yang tersimpan di Supabase dengan pagination (50 baris/halaman), pencarian, filter **Root Domain/Subdomain**, dan export ke `.txt`.
- Hasil scrape digabung otomatis (deduplikasi) ke dalam satu textarea di popup.
- Domain tertentu (mis. `google.com`, `youtube.com`, `facebook.com`, `instagram.com`, `x.com`, `wikipedia.org`, `netflix.com`, `spotify.com`) dikecualikan secara default — bisa diubah lewat array `exclude`/`excluded` di [popup.js](popup.js) dan [content.js](content.js).

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
| `supabase-config.js` | Kredensial Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). **Di-gitignore**, tidak ikut ter-commit. |
| [supabase-config.example.js](supabase-config.example.js) | Template kredensial Supabase untuk disalin jadi `supabase-config.js`. |
| [dashboard.html](dashboard.html) | Halaman dashboard (tab terpisah) untuk melihat, mencari, filter root/subdomain, dan export domain yang tersimpan di Supabase, dengan pagination. |
| [dashboard.js](dashboard.js) | Logika fetch (pagination server-side via `Range` header PostgREST) + render + search + filter + export untuk dashboard. |
| [psl.js](psl.js) | Parser [Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat) + fungsi `classifyDomain()` untuk menentukan root domain vs subdomain. |
| [public_suffix_list.dat](public_suffix_list.dat) | Data mentah Public Suffix List (di-bundle lokal, dibaca oleh [psl.js](psl.js) lewat `chrome.runtime.getURL`, tidak perlu koneksi internet). |

## Integrasi Supabase

Tombol **Simpan ke Supabase** tidak ada lagi — domain dari textarea output otomatis terkirim ke tabel `domains` lewat REST API PostgREST bawaan Supabase setiap kali kamu scrape (tanpa library tambahan, tetap patuh CSP Manifest V3). Kalau `supabase-config.js` belum diisi, pengiriman ini otomatis dilewati (silent skip) tanpa mengganggu hasil scrape.

1. Buat project di [supabase.com](https://supabase.com), buka **SQL Editor**, lalu jalankan:

   ```sql
   create table if not exists public.domains (
     id bigint generated always as identity primary key,
     domain text not null unique,
     created_at timestamptz not null default now()
   );

   alter table public.domains enable row level security;

   create policy "anon can insert domains"
     on public.domains
     for insert
     to anon
     with check (true);

   create policy "anon can read domains"
     on public.domains
     for select
     to anon
     using (true);
   ```

   Constraint `unique` pada `domain` membuat insert duplikat otomatis di-skip (`on_conflict=domain` + header `Prefer: resolution=ignore-duplicates`). Dua policy RLS di atas hanya mengizinkan `insert` dan `select` (tanpa `update`/`delete`) — `select` dibutuhkan supaya [dashboard.html](dashboard.html) bisa menampilkan daftar domain. Konsekuensinya, siapa pun yang mengekstrak anon key dari kode extension juga bisa membaca seluruh isi tabel `domains` — jangan simpan data sensitif di tabel ini.

2. Salin [supabase-config.example.js](supabase-config.example.js) menjadi `supabase-config.js`, isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` dari **Project Settings → API**.
3. Reload extension di `chrome://extensions`.
4. Klik **Scrape Current Page** atau **Next Page** seperti biasa — domain otomatis terkirim ke Supabase, status pengiriman muncul di teks status popup.
5. Klik **Lihat Dashboard** untuk membuka tab baru berisi domain yang tersimpan, dimuat per halaman (50 baris) supaya tetap ringan meski datanya banyak — bisa dicari (server-side) dan di-export ulang ke `.txt` (export mengambil semua baris yang cocok, bukan cuma halaman yang sedang tampil).

`supabase-config.js` sudah masuk [.gitignore](.gitignore) supaya anon key tidak ikut ter-push ke repo publik.

## Catatan

- Selector tombol "Berikutnya" Google (`#pnnext`) bisa berubah sewaktu-waktu karena Google sering mengganti struktur HTML/class hasil pencariannya — jika tombol "Next Page" berhenti bekerja, cek ulang selector ini.
- `content.js` berisi versi alternatif (loop otomatis + deteksi CAPTCHA) yang belum di-wire ke `content_scripts` di manifest maupun dipanggil dari popup.
- Anon key Supabase memang didesain untuk publik, tapi tetap harus dilindungi lewat Row Level Security (RLS) seperti policy di atas — jangan pernah pakai `service_role` key di kode extension/client.
- Filter **Root Domain** menampilkan domain yang sudah berupa domain terdaftar (mis. `example.co.id`), sedangkan **Subdomain** menampilkan yang punya label tambahan di depannya (mis. `www.example.co.id`). Klasifikasinya pakai [public_suffix_list.dat](public_suffix_list.dat) supaya akurat untuk suffix multi-label (`co.id`, `co.uk`, dll), bukan sekadar tebak "2 label terakhir". Update berkala file ini dari [publicsuffix.org](https://publicsuffix.org/list/public_suffix_list.dat) kalau ada TLD/aturan baru.
