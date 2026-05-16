const maxClickCountSelect = document.getElementById("maxClickCountSelect");
const filterModeSelect = document.getElementById("filterModeSelect");
const viewModeSelect = document.getElementById("viewModeSelect");
const previewEl = document.getElementById("preview");
const statusEl = document.getElementById("status");
const scanBtn = document.getElementById("scanBtn");
const startBtn = document.getElementById("startBtn");
const startCautionBtn = document.getElementById("startCautionBtn");
const stopBtn = document.getElementById("stopBtn");
const autoHideDuringScanCheckbox = document.getElementById("autoHideDuringScanCheckbox");

let lastAnalysisResult = null;

async function sendMessageToCurrentTab(message) {
    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    if (!tab || !tab.id) {
        statusEl.textContent = "현재 탭을 찾을 수 없습니다.";
        return null;
    }

    const currentUrl = tab.url || "";
    const isRecruitPage =
        currentUrl.includes("r-agent.com") ||
        currentUrl.includes("recruit.co.jp");

    if (!isRecruitPage) {
        statusEl.textContent =
            "현재 탭이 리쿠르트 페이지가 아닙니다.\n\n" +
            `현재 URL:\n${currentUrl}`;
        return null;
    }

    async function trySend() {
        return await chrome.tabs.sendMessage(tab.id, message);
    }

    try {
        const response = await trySend();
        statusEl.textContent = response?.message || "처리 완료";
        return response;
    } catch (firstError) {
        console.warn("First send failed. Injecting content.js...", firstError);

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["content.js"]
            });

            await new Promise(resolve => setTimeout(resolve, 800));

            const response = await trySend();
            statusEl.textContent = response?.message || "처리 완료";
            return response;
        } catch (secondError) {
            console.error("content.js 연결 실패:", secondError);

            statusEl.textContent =
                "content.js 연결 실패\n\n" +
                "가능성이 높은 원인:\n" +
                "1. 확장 프로그램 새로고침 안 함\n" +
                "2. 리쿠르트 페이지 새로고침 안 함\n" +
                "3. content.js 문법 에러\n" +
                "4. manifest matches 불일치\n\n" +
                `현재 URL:\n${currentUrl}\n\n` +
                `에러:\n${secondError.message}`;

            return null;
        }
    }
}

function decisionClass(decision) {
    return String(decision || "").toLowerCase();
}

function yesNo(value) {
    return value ? "있음" : "없음";
}

function valueOrUnknown(value, suffix = "") {
    if (value === null || value === undefined || value === "") return "不明";
    return `${value}${suffix}`;
}

function createCard(item, index) {
    const card = document.createElement("div");
    card.className = "preview-card";

    const title = document.createElement("div");
    title.className = "preview-title";
    title.textContent = `${index + 1}. ${item.title || "会社名・求人名 不明"}`;

    const decision = document.createElement("div");
    decision.className = `preview-decision ${decisionClass(item.decision)}`;
    decision.textContent = `判定: ${item.decision}`;

    const confidence = document.createElement("div");
    confidence.className = "preview-confidence";
    confidence.textContent =
        `信頼度: ${item.confidence || "UNKNOWN"} / Risk: ${item.riskLevel || "UNKNOWN"}`;

    const score = document.createElement("div");
    score.className = "preview-score";
    score.textContent = `スコア: ${item.score} / 100`;

    const risk = document.createElement("div");
    risk.className = "preview-risk";
    risk.innerHTML =
        `会社名: <strong>${item.companyName || "不明"}</strong><br>` +
        `Java判定: <strong>${item.javaCareerLevel || "UNKNOWN"}</strong><br>` +
        `en-hyouban取得: <strong>${yesNo(item.enHyoubanFetchOk)}</strong><br>` +
        `en-hyouban評価: <strong>${valueOrUnknown(item.enHyoubanRating)}</strong><br>` +
        `en-hyouban口コミ数: <strong>${valueOrUnknown(item.enHyoubanReviewCount, "件")}</strong><br>` +
        `en-hyouban社員数: <strong>${valueOrUnknown(item.enHyoubanEmployeeCount, "名")}</strong><br>` +
        `口コミ35件以下: <strong>${yesNo(item.hasLowEnHyoubanReviewCount)}</strong><br>` +
        `評価3.0以下: <strong>${yesNo(item.hasLowEnHyoubanRating)}</strong><br>` +
        `社員数80以下: <strong>${yesNo(item.hasVeryLowEmployeeCount)}</strong><br>` +
        `社員数100未満: <strong>${yesNo(item.hasLowEmployeeCount)}</strong><br>` +
        `社員数300以上: <strong>${yesNo(item.hasLargeEmployeeCount)}</strong><br>` +
        `小規模企業: <strong>${yesNo(item.hasSmallCompanyRisk)}</strong><br>` +
        `会社情報不足: <strong>${yesNo(item.hasCompanyInfoRisk)}</strong><br>` +
        `契約リスク: <strong>${yesNo(item.hasContractRisk)}</strong><br>` +
        `派遣リスク: <strong>${yesNo(item.hasHakenRisk)}</strong><br>` +
        `非Javaリスク: <strong>${yesNo(item.hasNonJavaCareerRisk)}</strong><br>` +
        `インフラ/非開発リスク: <strong>${yesNo(item.hasInfraRisk)}</strong><br>` +
        `経験ミスマッチ: <strong>${item.experienceMismatchLevel || "NONE"}</strong><br>` +
        `レビュー臭: <strong>${item.reviewSmellRiskLevel || "NONE"}</strong><br>` +
        `調査中自動処理: <strong>${yesNo(item.autoHiddenDuringScan)}</strong><br>` +
        `取得理由: <strong>${item.enHyoubanFetchReason || "なし"}</strong>`;

    const reasons = document.createElement("div");
    reasons.className = "preview-reason";
    reasons.style.marginTop = "6px";
    reasons.innerHTML = item.reasons && item.reasons.length > 0
        ? item.reasons.map(reason => `・${reason}`).join("<br>")
        : "・明確な理由なし";

    card.appendChild(title);
    card.appendChild(decision);
    card.appendChild(confidence);
    card.appendChild(score);
    card.appendChild(risk);
    card.appendChild(reasons);

    return card;
}

function appendSection(titleText, className, items) {
    const sectionTitle = document.createElement("div");
    sectionTitle.className = `preview-section-title ${className || ""}`;
    sectionTitle.textContent = titleText;
    previewEl.appendChild(sectionTitle);

    if (!items || items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "small-note";
        empty.textContent = "該当なし";
        previewEl.appendChild(empty);
        return;
    }

    items.forEach((item, index) => {
        previewEl.appendChild(createCard(item, index));
    });
}

function renderAnalysis(result) {
    previewEl.innerHTML = "";

    if (!result) {
        previewEl.innerHTML = `<div class="preview-section-title">분석 결과 없음</div>`;
        return;
    }

    const hideSafeItems = result.hideSafeItems || [];
    const hideCautionItems = result.hideCautionItems || [];
    const reviewItems = result.reviewItems || [];
    const keepItems = result.keepItems || [];
    const autoHiddenDuringScanItems = result.autoHiddenDuringScanItems || [];

    const allItems = [
        ...hideSafeItems,
        ...hideCautionItems,
        ...reviewItems,
        ...keepItems
    ];

    const enFetchedCount = allItems.filter(item => item.enHyoubanFetchOk).length;
    const lowReviewCount = allItems.filter(item => item.hasLowEnHyoubanReviewCount).length;
    const lowRatingCount = allItems.filter(item => item.hasLowEnHyoubanRating).length;
    const employeeFetchedCount = allItems.filter(item => typeof item.enHyoubanEmployeeCount === "number").length;
    const verySmallEmployeeCount = allItems.filter(item => item.hasVeryLowEmployeeCount).length;
    const smallEmployeeCount = allItems.filter(item => item.hasLowEmployeeCount).length;
    const largeEmployeeCount = allItems.filter(item => item.hasLargeEmployeeCount).length;

    const summary = document.createElement("div");
    summary.className = "preview-section-title";
    summary.innerHTML =
        `분석 결과<br>` +
        `HIDE_SAFE: ${hideSafeItems.length}건 / ` +
        `HIDE_CAUTION: ${hideCautionItems.length}건 / ` +
        `REVIEW: ${reviewItems.length}건 / ` +
        `KEEP: ${keepItems.length}건<br>` +
        `조사 중 자동 興味なし: ${autoHiddenDuringScanItems.length}건<br>` +
        `en-hyouban取得成功: ${enFetchedCount}건 / ` +
        `口コミ35件以下: ${lowReviewCount}건 / ` +
        `評価3.0以下: ${lowRatingCount}건<br>` +
        `社員数取得: ${employeeFetchedCount}건 / ` +
        `社員数80以下: ${verySmallEmployeeCount}건 / ` +
        `社員数100未満: ${smallEmployeeCount}건 / ` +
        `社員数300以上: ${largeEmployeeCount}건`;

    previewEl.appendChild(summary);

    const viewMode = viewModeSelect.value;

    if (viewMode === "all") {
        appendSection(`조사 중 자동 興味なし 처리: ${autoHiddenDuringScanItems.length}건`, "hide_safe", autoHiddenDuringScanItems);
        appendSection(`HIDE_SAFE: ${hideSafeItems.length}건`, "hide_safe", hideSafeItems);
        appendSection(`HIDE_CAUTION: ${hideCautionItems.length}건`, "hide_caution", hideCautionItems);
        appendSection(`REVIEW: ${reviewItems.length}건`, "review", reviewItems);
        appendSection(`KEEP: ${keepItems.length}건`, "keep", keepItems);
        return;
    }

    if (viewMode === "hide_safe") {
        appendSection(`HIDE_SAFE: ${hideSafeItems.length}건`, "hide_safe", hideSafeItems);
        return;
    }

    if (viewMode === "hide_caution") {
        appendSection(`HIDE_CAUTION: ${hideCautionItems.length}건`, "hide_caution", hideCautionItems);
        return;
    }

    if (viewMode === "review") {
        appendSection(`REVIEW: ${reviewItems.length}건`, "review", reviewItems);
        return;
    }

    if (viewMode === "keep") {
        appendSection(`KEEP: ${keepItems.length}건`, "keep", keepItems);
    }
}

function renderClickedItems(items) {
    previewEl.innerHTML = "";

    if (!items || items.length === 0) {
        previewEl.innerHTML = `
            <div class="preview-section-title">
                이번 실행에서 처리된 공고가 없습니다.
            </div>
        `;
        return;
    }

    appendSection(`이번에 興味なし 처리한 공고: ${items.length}건`, "hide_safe", items);
}

scanBtn.addEventListener("click", async () => {
    const autoHideDuringScan = !!autoHideDuringScanCheckbox?.checked;

    if (autoHideDuringScan) {
        const ok = confirm(
            "조사 중 자동 興味なし 처리를 실행합니다.\n\n" +
            "자동 처리 조건:\n" +
            "・en-hyouban 評価 3.0 이하\n" +
            "・en-hyouban 社員数 80명 이하\n" +
            "・개발과 관련 없는 구인\n\n" +
            "이 조건에 걸린 공고는 분석 중 바로 興味なし 처리됩니다.\n" +
            "계속할까요?"
        );

        if (!ok) {
            statusEl.textContent = "취소했습니다.";
            return;
        }
    }

    statusEl.textContent =
        "분석 중...\n" +
        "en-hyouban 자동 조회 때문에 시간이 걸릴 수 있습니다.\n" +
        (autoHideDuringScan ? "위험 공고는 조사 중 바로 興味なし 처리합니다." : "");

    previewEl.innerHTML = "";

    const response = await sendMessageToCurrentTab({
        type: "SCAN_INTEREST_NONE",
        filterMode: filterModeSelect.value,
        autoHideDuringScan
    });

    if (!response) return;

    lastAnalysisResult = response;
    renderAnalysis(response);
});

startBtn.addEventListener("click", async () => {
    const maxClickCount = Number(maxClickCountSelect.value);
    const filterMode = filterModeSelect.value;

    const ok = confirm(
        `HIDE_SAFE만 최대 ${maxClickCount === 9999 ? "전체" : maxClickCount + "개"} 처리합니다.\n계속할까요?`
    );

    if (!ok) return;

    const response = await sendMessageToCurrentTab({
        type: "START_INTEREST_NONE",
        maxClickCount,
        filterMode,
        targetDecision: "HIDE_SAFE"
    });

    renderClickedItems(response?.clickedItems || []);
});

startCautionBtn.addEventListener("click", async () => {
    const maxClickCount = Number(maxClickCountSelect.value);
    const filterMode = filterModeSelect.value;

    const ok = confirm(
        `주의: HIDE_CAUTION도 최대 ${maxClickCount === 9999 ? "전체" : maxClickCount + "개"} 처리합니다.\n정말 실행할까요?`
    );

    if (!ok) return;

    const response = await sendMessageToCurrentTab({
        type: "START_INTEREST_NONE",
        maxClickCount,
        filterMode,
        targetDecision: "HIDE_CAUTION"
    });

    renderClickedItems(response?.clickedItems || []);
});

stopBtn.addEventListener("click", async () => {
    await sendMessageToCurrentTab({
        type: "STOP_INTEREST_NONE"
    });
});

viewModeSelect.addEventListener("change", () => {
    if (lastAnalysisResult) {
        renderAnalysis(lastAnalysisResult);
    }
});