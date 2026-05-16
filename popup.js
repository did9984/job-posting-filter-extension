const maxActionCountSelect = document.getElementById("maxActionCountSelect");
const filterModeSelect = document.getElementById("filterModeSelect");
const viewModeSelect = document.getElementById("viewModeSelect");
const previewEl = document.getElementById("preview");
const statusEl = document.getElementById("status");
const scanBtn = document.getElementById("scanBtn");
const startBtn = document.getElementById("startBtn");
const startCautionBtn = document.getElementById("startCautionBtn");
const stopBtn = document.getElementById("stopBtn");
const userConfirmedActionDuringAnalysisCheckbox = document.getElementById("userConfirmedActionDuringAnalysisCheckbox");

let lastAnalysisResult = null;

async function sendMessageToCurrentTab(message) {
    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    if (!tab || !tab.id) {
        statusEl.textContent = "現在のタブを取得できませんでした。";
        return null;
    }

    const currentUrl = tab.url || "";
    const isRecruitPage =
        currentUrl.includes("r-agent.com") ||
        currentUrl.includes("recruit.co.jp");

    if (!isRecruitPage) {
        statusEl.textContent =
            "現在のタブは対象ページではありません。\n\n" +
            `現在のURL:\n${currentUrl}`;
        return null;
    }

    async function trySend() {
        return await chrome.tabs.sendMessage(tab.id, message);
    }

    try {
        const response = await trySend();
        statusEl.textContent = response?.message || "処理が完了しました。";
        return response;
    } catch (firstError) {
        console.warn("初回メッセージ送信に失敗しました。content.jsを再注入します。", firstError);

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["content.js"]
            });

            await new Promise(resolve => setTimeout(resolve, 800));

            const response = await trySend();
            statusEl.textContent = response?.message || "処理が完了しました。";
            return response;
        } catch (secondError) {
            console.error("content.jsとの接続に失敗しました。", secondError);

            statusEl.textContent =
                "content.jsとの接続に失敗しました。\n\n" +
                "想定される原因:\n" +
                "1. 拡張機能を再読み込みしていない\n" +
                "2. 対象ページを再読み込みしていない\n" +
                "3. content.jsに構文エラーがある\n" +
                "4. manifestのmatches設定が一致していない\n\n" +
                `現在のURL:\n${currentUrl}\n\n` +
                `エラー:\n${secondError.message}`;

            return null;
        }
    }
}

function decisionClass(decision) {
    return String(decision || "").toLowerCase();
}

function yesNo(value) {
    return value ? "あり" : "なし";
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
        `en-hyouban公開情報参照: <strong>${yesNo(item.enHyoubanFetchOk)}</strong><br>` +
        `en-hyouban評価: <strong>${valueOrUnknown(item.enHyoubanRating)}</strong><br>` +
        `en-hyouban口コミ数: <strong>${valueOrUnknown(item.enHyoubanReviewCount, "件")}</strong><br>` +
        `en-hyouban社員数: <strong>${valueOrUnknown(item.enHyoubanEmployeeCount, "名")}</strong><br>` +
        `口コミ35件以下: <strong>${yesNo(item.hasLowEnHyoubanReviewCount)}</strong><br>` +
        `評価3.0以下: <strong>${yesNo(item.hasLowEnHyoubanRating)}</strong><br>` +
        `社員数80名以下: <strong>${yesNo(item.hasVeryLowEmployeeCount)}</strong><br>` +
        `社員数100名未満: <strong>${yesNo(item.hasLowEmployeeCount)}</strong><br>` +
        `社員数300名以上: <strong>${yesNo(item.hasLargeEmployeeCount)}</strong><br>` +
        `小規模企業: <strong>${yesNo(item.hasSmallCompanyRisk)}</strong><br>` +
        `会社情報不足: <strong>${yesNo(item.hasCompanyInfoRisk)}</strong><br>` +
        `契約リスク: <strong>${yesNo(item.hasContractRisk)}</strong><br>` +
        `派遣リスク: <strong>${yesNo(item.hasHakenRisk)}</strong><br>` +
        `非Javaリスク: <strong>${yesNo(item.hasNonJavaCareerRisk)}</strong><br>` +
        `インフラ/非開発リスク: <strong>${yesNo(item.hasInfraRisk)}</strong><br>` +
        `経験ミスマッチ: <strong>${item.experienceMismatchLevel || "NONE"}</strong><br>` +
        `レビュー臭: <strong>${item.reviewSmellRiskLevel || "NONE"}</strong><br>` +
        `分析中のユーザー確認済み処理: <strong>${yesNo(item.userConfirmedActionDuringAnalysis)}</strong><br>` +
        `参照理由: <strong>${item.enHyoubanFetchReason || "なし"}</strong>`;

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
        previewEl.innerHTML = `<div class="preview-section-title">分析結果なし</div>`;
        return;
    }

    const hideSafeItems = result.hideSafeItems || [];
    const hideCautionItems = result.hideCautionItems || [];
    const reviewItems = result.reviewItems || [];
    const keepItems = result.keepItems || [];
    const userConfirmedActionDuringAnalysisItems =
        result.userConfirmedActionDuringAnalysisItems || [];

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
        `分析結果<br>` +
        `HIDE_SAFE: ${hideSafeItems.length}件 / ` +
        `HIDE_CAUTION: ${hideCautionItems.length}件 / ` +
        `REVIEW: ${reviewItems.length}件 / ` +
        `KEEP: ${keepItems.length}件<br>` +
        `分析中のユーザー確認済み処理: ${userConfirmedActionDuringAnalysisItems.length}件<br>` +
        `en-hyouban公開情報参照成功: ${enFetchedCount}件 / ` +
        `口コミ35件以下: ${lowReviewCount}件 / ` +
        `評価3.0以下: ${lowRatingCount}件<br>` +
        `社員数参照: ${employeeFetchedCount}件 / ` +
        `社員数80名以下: ${verySmallEmployeeCount}件 / ` +
        `社員数100名未満: ${smallEmployeeCount}件 / ` +
        `社員数300名以上: ${largeEmployeeCount}件`;

    previewEl.appendChild(summary);

    const viewMode = viewModeSelect.value;

    if (viewMode === "all") {
        appendSection(
            `分析中のユーザー確認済み処理: ${userConfirmedActionDuringAnalysisItems.length}件`,
            "hide_safe",
            userConfirmedActionDuringAnalysisItems
        );
        appendSection(`HIDE_SAFE: ${hideSafeItems.length}件`, "hide_safe", hideSafeItems);
        appendSection(`HIDE_CAUTION: ${hideCautionItems.length}件`, "hide_caution", hideCautionItems);
        appendSection(`REVIEW: ${reviewItems.length}件`, "review", reviewItems);
        appendSection(`KEEP: ${keepItems.length}件`, "keep", keepItems);
        return;
    }

    if (viewMode === "hide_safe") {
        appendSection(`HIDE_SAFE: ${hideSafeItems.length}件`, "hide_safe", hideSafeItems);
        return;
    }

    if (viewMode === "hide_caution") {
        appendSection(`HIDE_CAUTION: ${hideCautionItems.length}件`, "hide_caution", hideCautionItems);
        return;
    }

    if (viewMode === "review") {
        appendSection(`REVIEW: ${reviewItems.length}件`, "review", reviewItems);
        return;
    }

    if (viewMode === "keep") {
        appendSection(`KEEP: ${keepItems.length}件`, "keep", keepItems);
    }
}

function renderProcessedItems(items) {
    previewEl.innerHTML = "";

    if (!items || items.length === 0) {
        previewEl.innerHTML = `
            <div class="preview-section-title">
                今回処理された求人はありません。
            </div>
        `;
        return;
    }

    appendSection(`今回「興味なし」処理した求人: ${items.length}件`, "hide_safe", items);
}

scanBtn.addEventListener("click", async () => {
    const userConfirmedActionDuringAnalysis =
        !!userConfirmedActionDuringAnalysisCheckbox?.checked;

    if (userConfirmedActionDuringAnalysis) {
        const ok = confirm(
            "分析中にユーザー確認基準で「興味なし」処理を実行します。\n\n" +
            "処理条件:\n" +
            "・en-hyouban 評価 3.0以下\n" +
            "・en-hyouban 社員数 80名以下\n" +
            "・開発キャリアとの関連性が低い求人\n\n" +
            "この条件に該当する求人は、分析中に「興味なし」候補として処理されます。\n" +
            "続行しますか？"
        );

        if (!ok) {
            statusEl.textContent = "キャンセルしました。";
            return;
        }
    }

    statusEl.textContent =
        "分析中...\n" +
        "en-hyoubanの公開情報参照に時間がかかる場合があります。\n" +
        (userConfirmedActionDuringAnalysis
            ? "対象求人はユーザー確認基準で「興味なし」処理します。"
            : "");

    previewEl.innerHTML = "";

    const response = await sendMessageToCurrentTab({
        type: "RUN_JOB_POSTING_ANALYSIS",
        filterMode: filterModeSelect.value,
        userConfirmedActionDuringAnalysis
    });

    if (!response) return;

    lastAnalysisResult = response;
    renderAnalysis(response);
});

startBtn.addEventListener("click", async () => {
    const maxActionCount = Number(maxActionCountSelect.value);
    const filterMode = filterModeSelect.value;

    const ok = confirm(
        `HIDE_SAFE候補を最大${maxActionCount === 9999 ? "すべて" : maxActionCount + "件"}処理します。\n続行しますか？`
    );

    if (!ok) return;

    const response = await sendMessageToCurrentTab({
        type: "EXECUTE_USER_CONFIRMED_HIDE_CANDIDATES",
        maxActionCount,
        filterMode,
        targetDecision: "HIDE_SAFE"
    });

    renderProcessedItems(response?.processedItems || []);
});

startCautionBtn.addEventListener("click", async () => {
    const maxActionCount = Number(maxActionCountSelect.value);
    const filterMode = filterModeSelect.value;

    const ok = confirm(
        `注意: HIDE_CAUTION候補も最大${maxActionCount === 9999 ? "すべて" : maxActionCount + "件"}処理します。\n本当に実行しますか？`
    );

    if (!ok) return;

    const response = await sendMessageToCurrentTab({
        type: "EXECUTE_USER_CONFIRMED_HIDE_CANDIDATES",
        maxActionCount,
        filterMode,
        targetDecision: "HIDE_CAUTION"
    });

    renderProcessedItems(response?.processedItems || []);
});

stopBtn.addEventListener("click", async () => {
    await sendMessageToCurrentTab({
        type: "STOP_JOB_POSTING_ANALYSIS"
    });
});

viewModeSelect.addEventListener("change", () => {
    if (lastAnalysisResult) {
        renderAnalysis(lastAnalysisResult);
    }
});
