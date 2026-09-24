const statusEl = document.getElementById("status");
const tbody = document.getElementById("domainsBody");
const searchInput = document.getElementById("search");
const pageInfoEl = document.getElementById("pageInfo");
const prevBtn = document.getElementById("prevPage");
const nextBtn = document.getElementById("nextPage");

const PAGE_SIZE = 50;
let currentPage = 0;
let totalCount = 0;
let allRows = [];
let searchTimer = null;

// textContent dipakai (bukan innerHTML) supaya nilai domain dari DB tidak bisa jadi stored XSS
function renderRows(rows) {
    tbody.innerHTML = "";
    const frag = document.createDocumentFragment();

    rows.forEach(row => {
        const tr = document.createElement("tr");

        const tdDomain = document.createElement("td");
        tdDomain.textContent = row.domain;

        const tdDate = document.createElement("td");
        tdDate.textContent = row.created_at ? new Date(row.created_at).toLocaleString() : "";

        tr.append(tdDomain, tdDate);
        frag.appendChild(tr);
    });

    tbody.appendChild(frag);
}

function isConfigured() {
    return typeof SUPABASE_URL !== "undefined" && typeof SUPABASE_ANON_KEY !== "undefined" &&
        !SUPABASE_URL.includes("YOUR_PROJECT") && !SUPABASE_ANON_KEY.includes("YOUR_ANON");
}

// select + filter pencarian dipakai bareng oleh load halaman & export (tanpa Range = ambil semua)
function buildFilterQuery() {
    const q = searchInput.value.trim();
    let query = "select=domain,created_at&order=created_at.desc";
    if (q) query += `&domain=ilike.*${encodeURIComponent(q)}*`;
    return query;
}

function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    pageInfoEl.textContent = `Halaman ${currentPage + 1} dari ${totalPages} (${totalCount} domain)`;
    prevBtn.disabled = currentPage <= 0;
    nextBtn.disabled = currentPage >= totalPages - 1;
}

async function loadDomains() {
    if (!isConfigured()) {
        statusEl.textContent = "Isi dulu SUPABASE_URL & SUPABASE_ANON_KEY di supabase-config.js.";
        return;
    }

    statusEl.textContent = "Memuat domain...";

    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/domains?${buildFilterQuery()}`, {
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                "Range-Unit": "items",
                "Range": `${from}-${to}`,
                "Prefer": "count=exact"
            }
        });

        if (!res.ok) throw new Error(await res.text() || res.statusText);

        allRows = await res.json();
        totalCount = parseInt(res.headers.get("content-range")?.split("/")[1], 10) || allRows.length;

        renderRows(allRows);
        updatePagination();
        statusEl.textContent = `${totalCount} domain ditemukan.`;
    } catch (err) {
        statusEl.textContent = `Gagal memuat domain: ${err.message}`;
    }
}

searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        currentPage = 0;
        loadDomains();
    }, 300);
});

prevBtn.addEventListener("click", () => {
    if (currentPage <= 0) return;
    currentPage--;
    loadDomains();
});

nextBtn.addEventListener("click", () => {
    currentPage++;
    loadDomains();
});

document.getElementById("refresh").addEventListener("click", () => {
    currentPage = 0;
    loadDomains();
});

// Dedupe baris pada halaman yang sedang ditampilkan saja (tabel domains sudah punya constraint unique)
document.getElementById("removeDuplicate").addEventListener("click", () => {
    const seen = new Set();
    const before = allRows.length;

    allRows = allRows.filter(row => {
        const key = row.domain.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    renderRows(allRows);
    statusEl.textContent = `${before - allRows.length} duplikat dihapus pada halaman ini.`;
});

// Export ambil SEMUA baris yang cocok filter pencarian (bukan cuma halaman aktif), diambil per-batch
document.getElementById("exportTxt").addEventListener("click", async () => {
    if (!isConfigured()) {
        statusEl.textContent = "Isi dulu SUPABASE_URL & SUPABASE_ANON_KEY di supabase-config.js.";
        return;
    }

    statusEl.textContent = "Menyiapkan file export...";

    try {
        const batchSize = 1000;
        const domains = [];
        let offset = 0;

        while (true) {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/domains?${buildFilterQuery()}`, {
                headers: {
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                    "Range-Unit": "items",
                    "Range": `${offset}-${offset + batchSize - 1}`
                }
            });

            if (!res.ok) throw new Error(await res.text() || res.statusText);

            const batch = await res.json();
            domains.push(...batch.map(r => r.domain));
            if (batch.length < batchSize) break;
            offset += batchSize;
        }

        const blob = new Blob([domains.join("\n")], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "domains.txt";
        a.click();
        URL.revokeObjectURL(url);

        statusEl.textContent = `Export selesai: ${domains.length} domain.`;
    } catch (err) {
        statusEl.textContent = `Gagal export: ${err.message}`;
    }
});

loadDomains();

