const statusEl = document.getElementById("status");
const tbody = document.getElementById("domainsBody");
const searchInput = document.getElementById("search");

let allRows = [];

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

async function loadDomains() {
    if (typeof SUPABASE_URL === "undefined" || typeof SUPABASE_ANON_KEY === "undefined" ||
        SUPABASE_URL.includes("YOUR_PROJECT") || SUPABASE_ANON_KEY.includes("YOUR_ANON")) {
        statusEl.textContent = "Isi dulu SUPABASE_URL & SUPABASE_ANON_KEY di supabase-config.js.";
        return;
    }

    statusEl.textContent = "Memuat domain...";

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/domains?select=domain,created_at&order=created_at.desc&limit=1000`, {
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!res.ok) throw new Error(await res.text() || res.statusText);

        allRows = await res.json();
        renderRows(allRows);
        statusEl.textContent = `${allRows.length} domain dimuat.`;
    } catch (err) {
        statusEl.textContent = `Gagal memuat domain: ${err.message}`;
    }
}

searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    renderRows(q ? allRows.filter(r => r.domain.toLowerCase().includes(q)) : allRows);
});

document.getElementById("refresh").addEventListener("click", loadDomains);

// Dedupe baris yang sedang ditampilkan (client-side saja, tabel domains punya constraint unique)
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
    statusEl.textContent = `${before - allRows.length} duplikat dihapus. Total ${allRows.length} domain.`;
});

document.getElementById("exportTxt").addEventListener("click", () => {
    const text = allRows.map(r => r.domain).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "domains.txt";
    a.click();
    URL.revokeObjectURL(url);
});

loadDomains();
