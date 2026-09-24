// Satu kali "langkah": scrape halaman ini, cek captcha, lalu klik next kalau ada.
// Loop lintas-halaman dijalankan dari popup.js (inject file ini berulang), karena klik #pnnext
// menyebabkan full page navigation yang mematikan context script ini di tengah jalan.
(async () => {
  if (window.__alreadyRunning) return { domains: [], hasNext: false };
  window.__alreadyRunning = true;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  // Harus sinkron manual dengan exclude di popup.js (tidak ada build step/shared module)
  const excluded = ["google.com", "google.co.id", "google", "youtube.com", "sr.toolsminati.com", "facebook.com", "instagram.com", "x.com", "wikipedia.org", "netflix.com", "spotify.com", "chatgpt.com", "openai.com", "claude.ai", "claude.com", "anthropic.com", "copilot.microsoft.com", "perplexity.ai", "character.ai", "poe.com", "deepseek.com", "grok.com", "huggingface.co"];
  const collected = new Set();

  const logStatus = (text) => {
    console.log("[Scraper]", text);
    let el = document.getElementById("scrape-status");
    if (!el) {
      el = document.createElement("div");
      el.id = "scrape-status";
      el.style = "position:fixed;top:10px;right:10px;background:yellow;padding:5px 10px;z-index:9999;";
      document.body.appendChild(el);
    }
    el.textContent = text;
  };

  const getLinks = () => {
    const anchors = document.querySelectorAll("a");
    for (let a of anchors) {
      try {
        const href = a.href;
        const url = new URL(href);
        const domain = url.hostname.replace(/^www\./, "");
        const excludedMatch = excluded.some(ex => domain === ex || domain.endsWith("." + ex));
        if (!excludedMatch) {
          collected.add(domain);
        }
      } catch { }
    }
  };

  const isCaptcha = () => {
    const txt = document.body.innerText;
    const hasText = txt.includes("Our systems have detected unusual traffic");
    const hasRecaptcha = document.querySelector('iframe[src*="recaptcha"]') || document.querySelector(".g-recaptcha, #captcha");
    return hasText || hasRecaptcha;
  };

  logStatus("Scraping halaman ini...");
  getLinks();

  if (isCaptcha()) {
    logStatus("CAPTCHA terdeteksi. Menunggu 10 detik...");
    await sleep(10000);
    getLinks();
  }

  const domains = Array.from(collected);
  const nextBtn = document.querySelector("#pnnext");

  if (nextBtn) {
    logStatus(`${domains.length} domain ditemukan. Lanjut ke halaman berikutnya...`);
    nextBtn.click();
    return { domains, hasNext: true };
  }

  logStatus(`Selesai. ${domains.length} domain di halaman ini.`);
  return { domains, hasNext: false };
})();

