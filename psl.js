// Parser + classifier root domain/subdomain berbasis Public Suffix List (public_suffix_list.dat, publicsuffix.org)
let pslData = null;

async function loadPublicSuffixList() {
    if (pslData) return pslData;

    const res = await fetch(chrome.runtime.getURL("public_suffix_list.dat"));
    const text = await res.text();

    const rules = new Set();
    const exceptions = new Set();

    text.split("\n").forEach(line => {
        line = line.trim();
        if (!line || line.startsWith("//")) return;
        if (line.startsWith("!")) {
            exceptions.add(line.slice(1));
        } else {
            rules.add(line);
        }
    });

    pslData = { rules, exceptions };
    return pslData;
}

// Algoritma publicsuffix.org: rule yang cocok dengan label terbanyak (dicek dari kiri ke kanan) yang menang
function classifyDomain(hostname) {
    if (!pslData) throw new Error("Public Suffix List belum dimuat, panggil loadPublicSuffixList() dulu.");

    const domain = hostname.toLowerCase().replace(/\.$/, "");
    const parts = domain.split(".");

    let suffixLabelCount = 1; // default rule "*": TLD yang tidak dikenal dianggap 1 label suffix

    for (let i = 0; i < parts.length; i++) {
        const candidate = parts.slice(i).join(".");

        if (pslData.exceptions.has(candidate)) {
            suffixLabelCount = parts.length - i - 1;
            break;
        }
        if (pslData.rules.has(candidate)) {
            suffixLabelCount = parts.length - i;
            break;
        }
        if (pslData.rules.has("*." + parts.slice(i + 1).join("."))) {
            suffixLabelCount = parts.length - i;
            break;
        }
    }

    const registrableLabelCount = suffixLabelCount + 1;

    if (parts.length <= registrableLabelCount) {
        return { rootDomain: domain, isRoot: true };
    }

    return { rootDomain: parts.slice(parts.length - registrableLabelCount).join("."), isRoot: false };
}
