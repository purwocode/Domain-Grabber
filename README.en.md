# Domain Scraper

> [Bahasa Indonesia](README.md) | English

Chrome extension (Manifest V3) that collects all unique domains from links (`<a href>`) on the active tab, including pagination support for Google search results.

## Features

- **Scrape Current Page** — collect all unique domains from the currently active page.
- **Next Page** — collect domains from the active page, then automatically click the "Next" button on Google search results (`#pnnext`) to move to the next page.
- **Auto-save to Supabase** — optional, every time you scrape (Scrape Current Page / Next Page) domains are automatically sent to the Supabase table, no separate button needed (see [Supabase Integration](#supabase-integration)).
- **View Dashboard** — open a separate tab ([dashboard.html](dashboard.html)) to display domains stored in Supabase with pagination (50 rows/page), search, a **Root Domain/Subdomain** filter, and export to `.txt`.
- Scraped results are automatically merged (deduplicated) into a single textarea in the popup.
- The `www.` prefix is automatically stripped during scraping (e.g. `www.example.com` → `example.com`) so domains & subdomains are stored cleanly without duplicating the non-www version.
- Certain domains (e.g. `google.com`, `youtube.com`, `facebook.com`, `instagram.com`, `x.com`, `wikipedia.org`, `netflix.com`, `spotify.com`) are excluded by default — this can be changed via the `exclude`/`excluded` array in [popup.js](popup.js) and [content.js](content.js).

## Installation (Load Unpacked)

1. Open `chrome://extensions` in Chrome/Edge.
2. Enable **Developer mode** (top-right corner).
3. Click **Load unpacked**, then select this project folder.
4. The "Domain Scraper" icon will appear in the browser toolbar.

## Usage

1. Open the page you want to scrape (e.g. Google search results).
2. Click the extension icon to open the popup.
3. Click **Scrape Current Page** to collect domains from the current page only.
4. Click **Next Page** to collect domains from the current page and move to the next results page (can be clicked repeatedly for multiple pages).
5. Copy the results from the output textarea.

## File Structure

| File | Purpose |
|---|---|
| [manifest.json](manifest.json) | Extension configuration (Manifest V3), `scripting` & `activeTab` permissions, `<all_urls>` host permission. |
| [popup.html](popup.html) | Popup UI: action buttons + result textarea. |
| [popup.js](popup.js) | Popup button logic; injects the scrape function into the active tab via `chrome.scripting.executeScript`. |
| [content.js](content.js) | Standalone script (automatic multi-page loop + CAPTCHA detection). **Not wired up** to the manifest/popup yet — currently not executed automatically. |
| [icon.png](icon.png) | Extension toolbar icon. |
| `supabase-config.js` | Supabase credentials (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). **Gitignored**, not committed. |
| [supabase-config.example.js](supabase-config.example.js) | Template for Supabase credentials, to be copied to `supabase-config.js`. |
| [dashboard.html](dashboard.html) | Dashboard page (separate tab) to view, search, filter by root/subdomain, and export domains stored in Supabase, with pagination. |
| [dashboard.js](dashboard.js) | Fetch logic (server-side pagination via PostgREST `Range` header) + render + search + filter + export for the dashboard. |
| [psl.js](psl.js) | [Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat) parser + `classifyDomain()` function to determine root domain vs subdomain. |
| [public_suffix_list.dat](public_suffix_list.dat) | Raw Public Suffix List data (bundled locally, read by [psl.js](psl.js) via `chrome.runtime.getURL`, no internet connection needed). |

## Supabase Integration

The **Save to Supabase** button no longer exists — domains from the output textarea are automatically sent to the `domains` table via Supabase's built-in PostgREST API every time you scrape (no extra library, still compliant with Manifest V3 CSP). If `supabase-config.js` hasn't been filled in yet, sending is silently skipped without affecting the scrape result.

1. Create a project at [supabase.com](https://supabase.com), open the **SQL Editor**, and run:

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

   The `unique` constraint on `domain` makes duplicate inserts automatically skipped (`on_conflict=domain` + `Prefer: resolution=ignore-duplicates` header). The two RLS policies above only allow `insert` and `select` (no `update`/`delete`) — `select` is required so [dashboard.html](dashboard.html) can display the domain list. As a consequence, anyone who extracts the anon key from the extension code can also read the entire `domains` table — don't store sensitive data in this table.

2. Copy [supabase-config.example.js](supabase-config.example.js) to `supabase-config.js`, then fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` from **Project Settings → API**.
3. Reload the extension in `chrome://extensions`.
4. Click **Scrape Current Page** or **Next Page** as usual — domains are sent to Supabase automatically, and the send result shows up in the popup's status text.
5. Click **View Dashboard** to open a new tab with stored domains, loaded page by page (50 rows) so it stays lightweight even with a lot of data — searchable (server-side) and re-exportable to `.txt` (export fetches all matching rows, not just the currently displayed page).

`supabase-config.js` is already in [.gitignore](.gitignore) so the anon key doesn't get pushed to a public repo.

## Notes

- Google's "Next" button selector (`#pnnext`) can change at any time since Google frequently changes its search results HTML/class structure — if the "Next Page" button stops working, re-check this selector.
- `content.js` contains an alternative version (automatic loop + CAPTCHA detection) that hasn't been wired into `content_scripts` in the manifest or called from the popup.
- Supabase anon keys are designed to be public, but must still be protected with Row Level Security (RLS) like the policies above — never use the `service_role` key in extension/client code.
- The **Root Domain** filter shows domains that are already registrable domains (e.g. `example.co.id`), while **Subdomain** shows ones with an extra label in front (e.g. `www.example.co.id`). Classification uses [public_suffix_list.dat](public_suffix_list.dat) for accuracy on multi-label suffixes (`co.id`, `co.uk`, etc.), instead of just guessing "last 2 labels". Periodically refresh this file from [publicsuffix.org](https://publicsuffix.org/list/public_suffix_list.dat) when new TLDs/rules are added.
