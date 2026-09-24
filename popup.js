// Fungsi ini dijalankan di context tab (lewat executeScript), harus berdiri sendiri
function scrapeSinglePage() {
  const hrefSet = new Set();
  const domainSet = new Set();
  const exclude = ["google.com", "google.co.id", "youtube.com", "sr.toolsminati.com", "facebook.com", "instagram.com"];

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
        const exclude = ["google.com", "google.co.id", "youtube.com", "sr.toolsminati.com", "facebook.com", "instagram.com"];

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
