// Fungsi ini dijalankan di context tab (lewat executeScript), harus berdiri sendiri
function scrapeSinglePage() {
  const hrefSet = new Set();
  const domainSet = new Set();
  const exclude = ["google.com", "google.co.id", "youtube.com", "sr.toolsminati.com", "facebook.com", "instagram.com", "x.com", "wikipedia.org", "netflix.com", "spotify.com", "chatgpt.com", "openai.com", "claude.ai", "anthropic.com", "copilot.microsoft.com", "perplexity.ai", "character.ai", "poe.com", "deepseek.com", "grok.com", "huggingface.co"];

  document.querySelectorAll("a").forEach(a => {
    const href = a.getAttribute("href");
    if (!href || hrefSet.has(href)) return;
    hrefSet.add(href);
    try {
      const domain = new URL(href, window.location.href).hostname.replace(/^www\./, "");
      const isExcluded = exclude.some(ex => domain === ex || domain.endsWith("." + ex));
      if (!isExcluded) domainSet.add(domain);
    } catch { }
  });

  return Array.from(domainSet);
}

// Kirim domain ke tabel "domains" Supabase; dipanggil otomatis tiap habis scrape (butuh supabase-config.js)
async function saveDomainsToSupabase(domains) {
  if (!domains.length) return "";
  if (typeof SUPABASE_URL === "undefined" || typeof SUPABASE_ANON_KEY === "undefined" ||
    SUPABASE_URL.includes("YOUR_PROJECT") || SUPABASE_ANON_KEY.includes("YOUR_ANON")) {
    return "";
  }

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

  return `Tersimpan ke Supabase (${domains.length}).`;
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

      saveDomainsToSupabase(Array.from(combined))
        .then(msg => { if (msg) document.getElementById("status").textContent += ` ${msg}`; })
        .catch(err => { document.getElementById("status").textContent += ` (Gagal simpan ke Supabase: ${err.message})`; });
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
        const exclude = ["google.com", "google.co.id", "youtube.com", "sr.toolsminati.com", "facebook.com", "instagram.com", "x.com", "wikipedia.org", "netflix.com", "spotify.com", "chatgpt.com", "openai.com", "claude.ai", "anthropic.com", "copilot.microsoft.com", "perplexity.ai", "character.ai", "poe.com", "deepseek.com", "grok.com", "huggingface.co"];

        const anchors = Array.from(document.querySelectorAll("a"));
        anchors.forEach(a => {
          const href = a.getAttribute("href");
          if (!href || hrefSet.has(href)) return;
          hrefSet.add(href);
          try {
            const url = new URL(href, window.location.href);
            const domain = url.hostname.replace(/^www\./, "");
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

      saveDomainsToSupabase(Array.from(combined))
        .then(msg => { if (msg) document.getElementById("status").textContent += ` ${msg}`; })
        .catch(err => { document.getElementById("status").textContent += ` (Gagal simpan ke Supabase: ${err.message})`; });
    });
  });
});

// Buka halaman dashboard (tab baru) untuk melihat domain yang tersimpan di Supabase
document.getElementById("openDashboard").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

// Auto-scrape berturut-turut: inject content.js berulang (tiap navigasi mematikan context-nya,
// jadi loop lintas-halaman dijalankan di sini, bukan di dalam content.js sendiri)
document.getElementById("autoScrape").addEventListener("click", async () => {
  const statusEl = document.getElementById("status");
  const outputArea = document.getElementById("output");
  const maxPages = 50;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const combined = new Set(outputArea.value.split("\n").map(x => x.trim()).filter(Boolean));

  for (let page = 1; page <= maxPages; page++) {
    statusEl.textContent = `Auto-scrape halaman ${page}...`;

    let result;
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      result = results[0]?.result;
    } catch (err) {
      statusEl.textContent = `Auto-scrape berhenti di halaman ${page}: ${err.message}`;
      break;
    }

    (result?.domains || []).forEach(d => combined.add(d));
    outputArea.value = Array.from(combined).join("\n");
    statusEl.textContent = `Halaman ${page}: total ${combined.size} domain.`;

    saveDomainsToSupabase(Array.from(combined)).catch(() => { });

    if (!result?.hasNext) {
      statusEl.textContent = `Auto-scrape selesai. Total ${combined.size} domain dari ${page} halaman.`;
      break;
    }

    await new Promise(r => setTimeout(r, 2500));
  }
});
