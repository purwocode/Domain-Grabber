(async () => {
  if (window.__alreadyRunning) return;
  window.__alreadyRunning = true;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const collected = new Set();
  const excluded = ["google.com", "google.co.id", "youtube.com", "x.com", "wikipedia.org", "netflix.com", "spotify.com"];
  let page = 1;

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

  while (true) {
    logStatus(`Scraping page ${page}...`);
    getLinks();

    if (isCaptcha()) {
      logStatus("CAPTCHA detected. Pausing 10s...");
      await sleep(10000);
    }

    const btn = document.querySelector("#pnnext");
    if (!btn) break;

    btn.click();
    page++;
    await sleep(2000);
  }

  logStatus(`Scraping complete. Found ${collected.size} domain(s).`);

  // Simpan hasil ke window agar bisa diambil dari popup.js
  window.__scrapedDomains = Array.from(collected);
})();
