const EN_HYOUBAN_CACHE = new Map();

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeText(text) {
    return (text || "")
        .replace(/\s+/g, "")
        .replace(/\u3000/g, "")
        .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
        .trim();
}

function cleanCompanyName(companyName) {
    return normalizeText(companyName)
        .replace(/^株式会社/, "")
        .replace(/株式会社$/, "")
        .replace(/^有限会社/, "")
        .replace(/有限会社$/, "")
        .replace(/^合同会社/, "")
        .replace(/合同会社$/, "");
}

async function waitForTabComplete(tabId, timeoutMs = 20000) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        try {
            const tab = await chrome.tabs.get(tabId);
            if (tab.status === "complete") return true;
        } catch (e) {
            return false;
        }

        await sleep(500);
    }

    return false;
}

async function runScript(tabId, func, args = []) {
    const result = await chrome.scripting.executeScript({
        target: { tabId },
        func,
        args
    });

    return result && result[0] ? result[0].result : null;
}

async function findEnHyoubanUrl(companyName) {
    const cleanName = cleanCompanyName(companyName);

    if (!cleanName) return null;

    const query = encodeURIComponent(`${cleanName} en-hyouban`);
    const googleUrl = `https://www.google.com/search?q=${query}`;

    const tab = await chrome.tabs.create({
        url: googleUrl,
        active: false
    });

    try {
        await waitForTabComplete(tab.id);
        await sleep(1200);

        const url = await runScript(tab.id, () => {
            function unwrapGoogleUrl(href) {
                try {
                    const u = new URL(href);

                    if (u.hostname.includes("google.") && u.pathname === "/url") {
                        return u.searchParams.get("q") || href;
                    }

                    return href;
                } catch (e) {
                    return href;
                }
            }

            const links = Array.from(document.querySelectorAll("a"))
                .map(a => unwrapGoogleUrl(a.href))
                .filter(Boolean);

            const companyPage = links.find(href =>
                href.includes("en-hyouban.com/company/")
            );

            if (companyPage) return companyPage;

            const anyEnHyouban = links.find(href =>
                href.includes("en-hyouban.com")
            );

            return anyEnHyouban || null;
        });

        return url;
    } finally {
        try {
            await chrome.tabs.remove(tab.id);
        } catch (e) {
            console.warn("Google tab remove failed", e);
        }
    }
}

async function scrapeEnHyouban(url, companyName) {
    if (!url) {
        return {
            ok: false,
            companyName,
            url: null,
            rating: null,
            reviewCount: null,
            employeeCount: null,
            reason: "en-hyouban URL not found"
        };
    }

    const tab = await chrome.tabs.create({
        url,
        active: false
    });

    try {
        await waitForTabComplete(tab.id);
        await sleep(2500);

        const data = await runScript(tab.id, () => {
            const body = document.body ? document.body.innerText : "";
            const title = document.title || "";

            function toHalfWidth(text) {
                return (text || "").replace(/[０-９．，,]/g, s => {
                    if (s === "．") return ".";
                    if (s === "，" || s === ",") return "";
                    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
                });
            }

            const text = toHalfWidth(body)
                .replace(/,/g, "")
                .replace(/\s+/g, " ")
                .trim();

            let rating = null;
            let reviewCount = null;
            let employeeCount = null;

            const ratingPatterns = [
                /総合評価\s*([0-5]\.\d)/,
                /会社の総合評価\s*([0-5]\.\d)/,
                /評点\s*([0-5]\.\d)/,
                /評価\s*([0-5]\.\d)/,
                /([0-5]\.\d)\s*\/\s*5/,
                /([0-5]\.\d)\s*点/
            ];

            for (const pattern of ratingPatterns) {
                const match = text.match(pattern);
                if (match) {
                    rating = Number(match[1]);
                    break;
                }
            }

            const reviewPatterns = [
                /社員・元社員の口コミ\s*(\d+)\s*件/,
                /口コミ数\s*(\d+)\s*件/,
                /口コミ\s*(\d+)\s*件/,
                /クチコミ\s*(\d+)\s*件/,
                /(\d+)\s*件の口コミ/
            ];

            for (const pattern of reviewPatterns) {
                const match = text.match(pattern);
                if (match) {
                    reviewCount = Number(match[1]);
                    break;
                }
            }

            const employeePatterns = [
                /従業員数\s*(\d+)\s*名/,
                /社員数\s*(\d+)\s*名/,
                /従業員\s*(\d+)\s*名/,
                /社員\s*(\d+)\s*名/,
                /正社員\s*(\d+)\s*名/,
                /単体\s*(\d+)\s*名/,
                /連結\s*(\d+)\s*名/,
                /(\d+)\s*名\s*（\s*従業員/,
                /(\d+)\s*名\s*（\s*社員/
            ];

            for (const pattern of employeePatterns) {
                const match = text.match(pattern);
                if (match) {
                    employeeCount = Number(match[1]);
                    break;
                }
            }

            return {
                title,
                rating,
                reviewCount,
                employeeCount
            };
        });

        return {
            ok: true,
            companyName,
            url,
            title: data?.title || "",
            rating: data?.rating ?? null,
            reviewCount: data?.reviewCount ?? null,
            employeeCount: data?.employeeCount ?? null,
            reason: null
        };
    } finally {
        try {
            await chrome.tabs.remove(tab.id);
        } catch (e) {
            console.warn("en-hyouban tab remove failed", e);
        }
    }
}

async function fetchEnHyoubanInfo(companyName) {
    const key = cleanCompanyName(companyName);

    if (!key) {
        return {
            ok: false,
            companyName,
            url: null,
            rating: null,
            reviewCount: null,
            employeeCount: null,
            reason: "empty company name"
        };
    }

    if (EN_HYOUBAN_CACHE.has(key)) {
        return {
            ...EN_HYOUBAN_CACHE.get(key),
            cached: true
        };
    }

    const url = await findEnHyoubanUrl(companyName);
    const result = await scrapeEnHyouban(url, companyName);

    EN_HYOUBAN_CACHE.set(key, result);

    return {
        ...result,
        cached: false
    };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "FETCH_EN_HYOUBAN_INFO") {
        fetchEnHyoubanInfo(request.companyName)
            .then(result => sendResponse(result))
            .catch(error => {
                sendResponse({
                    ok: false,
                    companyName: request.companyName,
                    url: null,
                    rating: null,
                    reviewCount: null,
                    employeeCount: null,
                    reason: error.message
                });
            });

        return true;
    }
});