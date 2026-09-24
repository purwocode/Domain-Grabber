const statusEl = document.getElementById("status");
const tbody = document.getElementById("domainsBody");
const searchInput = document.getElementById("search");
const typeFilterEl = document.getElementById("typeFilter");
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

// Ambil SEMUA baris yang cocok filter pencarian, diambil per-batch (dipakai untuk filter root/sub & export)
async function fetchAllMatching() {
    const batchSize = 1000;
    const rows = [];
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
        rows.push(...batch);
        if (batch.length < batchSize) break;
        offset += batchSize;
    }

    return rows;
}

// "all" -> tidak difilter; "root"/"sub" -> diklasifikasi lewat Public Suffix List
function matchesTypeFilter(row) {
    const type = typeFilterEl.value;
    if (type === "all") return true;
    return classifyDomain(row.domain).isRoot === (type === "root");
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

    try {
        await loadPublicSuffixList();

        if (typeFilterEl.value === "all") {
            // Filter "Semua" cukup pagination server-side, lebih ringan untuk data banyak
            const from = currentPage * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

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
        } else {
            // Filter root/subdomain butuh klasifikasi PSL per baris, jadi ambil semua yang cocok pencarian dulu
            const matched = (await fetchAllMatching()).filter(matchesTypeFilter);
            totalCount = matched.length;
            allRows = matched.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);
        }

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

typeFilterEl.addEventListener("change", () => {
    currentPage = 0;
    loadDomains();
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

// Export ambil SEMUA baris yang cocok pencarian + filter root/subdomain yang lagi aktif di dropdown
document.getElementById("exportTxt").addEventListener("click", async () => {
    if (!isConfigured()) {
        statusEl.textContent = "Isi dulu SUPABASE_URL & SUPABASE_ANON_KEY di supabase-config.js.";
        return;
    }

    statusEl.textContent = "Menyiapkan file export...";

    try {
        await loadPublicSuffixList();
        const domains = (await fetchAllMatching()).filter(matchesTypeFilter).map(r => r.domain);

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


