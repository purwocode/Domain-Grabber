// Fungsi ini dijalankan di context tab (lewat executeScript), harus berdiri sendiri
function scrapeSinglePage() {
  const hrefSet = new Set();
  const domainSet = new Set();
  const exclude = ["google.com", "google.co.id", "youtube.com", "sr.toolsminati.com", "facebook.com", "instagram.com", "x.com", "wikipedia.org"];

  document.querySelectorAll("a").forEach(a => {
    const href = a.getAttribute("href");
    if (!href || hrefSet.has(href)) return;
    hrefSet.add(href);
    try {
      const domain = new URL(href, window.location.href).hostname;
      const isExcluded = exclude.some(ex => domain === ex || domain.endsWith("." + ex));
      if (!isExcluded) domainSet.add(domain);
    } catch { }
  });

  return Array.from(domainSet);
}

// Tombol Scrape Current Page (tidak berubah)
document.getElementById("run").addEventListener("click", () => {
  document.getElementById("status").textContent = "Scraping current page...";

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: scrapeSinglePage
    }, (results) => {
      const domains = results[0]?.result || [];
      const outputArea = document.getElementById("output");
      const existing = outputArea.value.split("\n").filter(x => x.trim());
      const combined = new Set([...existing, ...domains]);
      outputArea.value = Array.from(combined).join("\n");

      document.getElementById("status").textContent = `Selesai. ${domains.length} domain ditemukan.`;
    });
  });
});
document.getElementById("nextPage").addEventListener("click", () => {
  document.getElementById("status").textContent = "Scraping & navigating to next page...";

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: async () => {
        const hrefSet = new Set();
        const domainSet = new Set();
        const exclude = ["google.com", "google.co.id", "youtube.com", "sr.toolsminati.com", "facebook.com", "instagram.com", "x.com", "wikipedia.org"];

        const anchors = Array.from(document.querySelectorAll("a"));
        anchors.forEach(a => {
          const href = a.getAttribute("href");
          if (!href || hrefSet.has(href)) return;
          hrefSet.add(href);
          try {
            const url = new URL(href, window.location.href);
            const domain = url.hostname;
            const isExcluded = exclude.some(ex => domain === ex || domain.endsWith("." + ex));
            if (!isExcluded) domainSet.add(domain);
          } catch { }
        });

        const nextBtn = document.querySelector("#pnnext");
        if (nextBtn) {
          nextBtn.click();
          return { success: true, domains: Array.from(domainSet) };
        } else {
          return { success: false, domains: Array.from(domainSet) };
        }
      }
    }, (results) => {
      const result = results[0]?.result;
      const domains = result?.domains || [];

      const outputArea = document.getElementById("output");
      const existing = outputArea.value.split("\n").filter(x => x.trim());
      const combined = new Set([...existing, ...domains]);
      outputArea.value = Array.from(combined).join("\n");

      if (result?.success) {
        document.getElementById("status").textContent = `Halaman berikutnya dimuat. Total ${combined.size} domain.`;
      } else {
        document.getElementById("status").textContent = `Tidak ada halaman berikutnya. Total ${combined.size} domain.`;
      }
    });
  });
});

// Kirim domain dari textarea output ke tabel "domains" di Supabase (butuh supabase-config.js)
document.getElementById("saveSupabase").addEventListener("click", async () => {
  const statusEl = document.getElementById("status");
  const domains = document.getElementById("output").value.split("\n").map(d => d.trim()).filter(Boolean);

  if (!domains.length) {
    statusEl.textContent = "Tidak ada domain untuk disimpan.";
    return;
  }
  if (typeof SUPABASE_URL === "undefined" || typeof SUPABASE_ANON_KEY === "undefined" ||
    SUPABASE_URL.includes("YOUR_PROJECT") || SUPABASE_ANON_KEY.includes("YOUR_ANON")) {
    statusEl.textContent = "Isi dulu SUPABASE_URL & SUPABASE_ANON_KEY di supabase-config.js.";
    return;
  }

  statusEl.textContent = `Menyimpan ${domains.length} domain ke Supabase...`;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/domains?on_conflict=domain`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=ignore-duplicates"
      },
      body: JSON.stringify(domains.map(domain => ({ domain })))
    });

    if (!res.ok) throw new Error(await res.text() || res.statusText);

    statusEl.textContent = `Tersimpan ke Supabase: ${domains.length} domain.`;
  } catch (err) {
    statusEl.textContent = `Gagal simpan ke Supabase: ${err.message}`;
  }
});

// Buka halaman dashboard (tab baru) untuk melihat domain yang tersimpan di Supabase
document.getElementById("openDashboard").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

// Hapus baris kosong & duplikat pada textarea output
document.getElementById("removeDuplicate").addEventListener("click", () => {
  const outputArea = document.getElementById("output");
  const lines = outputArea.value.split("\n").map(x => x.trim()).filter(Boolean);
  const unique = Array.from(new Set(lines));
  outputArea.value = unique.join("\n");

  document.getElementById("status").textContent = `${lines.length - unique.length} duplikat dihapus. Total ${unique.length} domain.`;
});
