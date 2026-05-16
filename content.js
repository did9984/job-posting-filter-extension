(() => {
    if (window.__RECRUIT_JOB_POSTING_ANALYSIS_CONTENT_V536_STRICT__) {
        console.log("Recruit Job Posting Analysis content.js v5.3.6 はすでに読み込み済みです");
        return;
    }

    window.__RECRUIT_JOB_POSTING_ANALYSIS_CONTENT_V536_STRICT__ = true;
    window.__jobPostingAnalysisStopRequested = false;

    const BADGE_CLASS = "recruit-job-posting-analysis-result-badge";
    const MARK_CLASS = "recruit-job-posting-analysis-card-mark";
    const MAX_EN_HYOUBAN_PUBLIC_INFO_REFERENCE = 100;
    const STORAGE_KEY = "jobPostingAnalysisCacheV536";

    const manualReviewRiskProfiles = [
        {
            companyKeyword: "株式会社東計電算",
            level: "HIGH",
            rating: 2.7,
            reviewCount: 35,
            employeeCount: null,
            reasons: [
                "手動登録: 口コミ評価2.7と低め",
                "手動登録: 平均残業40時間前後の指摘あり",
                "手動登録: 既存システム依存が強く、開発志向には不向き"
            ]
        },
        {
            companyKeyword: "東計電算",
            level: "HIGH",
            rating: 2.7,
            reviewCount: 35,
            employeeCount: null,
            reasons: [
                "手動登録: 口コミ評価2.7と低め",
                "手動登録: 平均残業40時間前後の指摘あり",
                "手動登録: 既存システム依存が強く、開発志向には不向き"
            ]
        },
        {
            companyKeyword: "株式会社feat",
            level: "HIGH",
            rating: null,
            reviewCount: null,
            employeeCount: null,
            reasons: [
                "手動登録: 成長が案件次第という指摘あり",
                "手動登録: テスト配属可能性の指摘あり",
                "手動登録: 賞与/昇給が弱い指摘あり"
            ]
        },
        {
            companyKeyword: "株式会社ｆｅａｔ",
            level: "HIGH",
            rating: null,
            reviewCount: null,
            employeeCount: null,
            reasons: [
                "手動登録: 成長が案件次第という指摘あり",
                "手動登録: テスト配属可能性の指摘あり",
                "手動登録: 賞与/昇給が弱い指摘あり"
            ]
        }
    ];

    const protectedCompanyKeywords = [
        "アクセンチュア",
        "Accenture",
        "Ａｃｃｅｎｔｕｒｅ",
        "株式会社DTS",
        "株式会社ＤＴＳ",
        "株式会社アクシス",
        "ARアドバンストテクノロジ",
        "ＡＲアドバンストテクノロジ",
        "チームラボ",
        "bitFlyer",
        "ｂｉｔＦｌｙｅｒ",
        "セイコーソリューションズ",
        "シーイーシー",
        "パスコ",
        "アバント",
        "ノースサンド",
        "テクノプロ",
        "ジャパニアス",
        "NHN",
        "ＮＨＮ",
        "GMO",
        "ＧＭＯ",
        "キューブシステム",
        "テクマトリックス"
    ];

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function normalizeFilterMode(filterMode) {
        if (filterMode === "conservative") return "conservative";
        if (filterMode === "normal") return "normal";
        if (filterMode === "aggressive") return "aggressive";
        return "normal";
    }

    function normalizeText(text) {
        return (text || "")
            .replace(/\s+/g, "")
            .replace(/\u3000/g, "")
            .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
            .trim();
    }

    function containsAny(text, keywords) {
        const normalized = normalizeText(text);
        return keywords.some(keyword => normalized.includes(normalizeText(keyword)));
    }

    function isVisible(element) {
        if (!element) return false;

        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);

        return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0"
        );
    }

    function makeJobCacheKey(companyName, title) {
        return normalizeText(`${companyName || ""}__${title || ""}`);
    }

    async function loadAnalysisCache() {
        try {
            const data = await chrome.storage.local.get(STORAGE_KEY);
            return data[STORAGE_KEY] || {};
        } catch (error) {
            console.warn("分析キャッシュの読み込みに失敗しました", error);
            return {};
        }
    }

    async function saveAnalysisCache(cache) {
        try {
            await chrome.storage.local.set({
                [STORAGE_KEY]: cache
            });
        } catch (error) {
            console.warn("分析キャッシュの保存に失敗しました", error);
        }
    }

    async function saveItemToAnalysisCache(item) {
        if (!item || !item.companyName || !item.title) return;

        const cache = await loadAnalysisCache();
        const key = makeJobCacheKey(item.companyName, item.title);

        cache[key] = {
            ...item,
            savedAt: Date.now()
        };

        await saveAnalysisCache(cache);
    }

    function countInterestNoneButtonsIn(element) {
        if (!element) return 0;

        return Array.from(element.querySelectorAll("button, a, div[role='button'], span[role='button']"))
            .filter(el => normalizeText(el.innerText || el.textContent || "").includes("興味なし"))
            .length;
    }

    function findInterestNoneButtons() {
        return Array.from(document.querySelectorAll("button, a, div[role='button'], span[role='button']"))
            .filter(element => {
                const text = normalizeText(element.innerText || element.textContent || "");
                return (
                    isVisible(element) &&
                    text.includes("興味なし") &&
                    element.dataset.jobPostingAnalysisChecked !== "true"
                );
            });
    }

    function findJobCardFromButton(button) {
        let current = button;
        let best = null;

        for (let i = 0; i < 10; i++) {
            if (!current || !current.parentElement) break;

            current = current.parentElement;

            const text = current.innerText || "";
            const normalized = normalizeText(text);

            const hasCardText =
                normalized.includes("株式会社") ||
                normalized.includes("有限会社") ||
                normalized.includes("合同会社") ||
                normalized.includes("年収") ||
                normalized.includes("勤務地") ||
                normalized.includes("休日") ||
                normalized.includes("仕事内容") ||
                normalized.includes("職務内容");

            const enough = normalized.length > 80;
            const notTooLarge = normalized.length < 7000;
            const buttonCount = countInterestNoneButtonsIn(current);

            if (hasCardText && enough && notTooLarge && buttonCount <= 1) {
                best = current;
                break;
            }
        }

        return best ||
            button.closest("article") ||
            button.closest("li") ||
            button.closest("section") ||
            button.parentElement;
    }

    function extractCompanyName(cardText) {
        const lines = (cardText || "")
            .split("\n")
            .map(line => line.trim())
            .filter(Boolean);

        return lines.find(line =>
            line.includes("株式会社") ||
            line.includes("有限会社") ||
            line.includes("合同会社")
        ) || "";
    }

    function extractJobTitle(cardText) {
        const lines = (cardText || "")
            .split("\n")
            .map(line => line.trim())
            .filter(Boolean)
            .filter(line =>
                !line.includes("応募する") &&
                !line.includes("興味なし") &&
                !line.includes("気になる") &&
                !line.includes("募集要項") &&
                !line.includes("選考・企業概要")
            );

        const company = lines.find(line =>
            line.includes("株式会社") ||
            line.includes("有限会社") ||
            line.includes("合同会社")
        );

        const title = lines.find(line =>
            line.includes("【") ||
            line.includes("SE") ||
            line.includes("エンジニア") ||
            line.includes("開発") ||
            line.includes("アプリ") ||
            line.includes("PL") ||
            line.includes("PM")
        );

        if (company && title && company !== title) return `${company} / ${title}`;
        return company || title || lines[0] || "会社名・求人名 不明";
    }

    function extractSalaryMin(text) {
        const normalized = normalizeText(text);

        const patterns = [
            /年収(\d{3,4})[~〜～\-－](\d{3,4})万/,
            /年収(\d{3,4})万円[~〜～\-－](\d{3,4})万円/,
            /(\d{3,4})[~〜～\-－](\d{3,4})万/,
            /(\d{3,4})万円[~〜～\-－](\d{3,4})万円/,
            /年収(\d{3,4})万円/,
            /(\d{3,4})万/
        ];

        for (const pattern of patterns) {
            const match = normalized.match(pattern);
            if (match) return Number(match[1]);
        }

        return null;
    }

    function extractEmployeeCount(text) {
        const normalized = normalizeText(text);

        const patterns = [
            /従業員数(\d{1,5})名/,
            /社員数(\d{1,5})名/,
            /従業員(\d{1,5})名/,
            /社員(\d{1,5})名/
        ];

        for (const pattern of patterns) {
            const match = normalized.match(pattern);
            if (match) return Number(match[1]);
        }

        return null;
    }

    function findManualReviewRisk(companyName) {
        const normalized = normalizeText(companyName);

        return manualReviewRiskProfiles.find(profile =>
            normalized.includes(normalizeText(profile.companyKeyword))
        ) || null;
    }

    function isProtectedCompany(companyName) {
        return containsAny(companyName, protectedCompanyKeywords);
    }

    function hasNoCodeRisk(text) {
        return containsAny(text, [
            "ノーコード",
            "ローコード",
            "コーディング経験不問",
            "プログラミング経験不問",
            "コーディング不要",
            "書く（実装）より",
            "書く(実装)より",
            "テスト工程（初期）",
            "テスト工程(初期)",
            "初期：テスト",
            "初期:テスト"
        ]);
    }

    function hasActualJavaDevelopment(text) {
        const hasJavaOrSpring = containsAny(text, [
            "Java",
            "JAVA",
            "java",
            "Spring",
            "SpringBoot",
            "Spring Boot"
        ]);

        const hasDevelopmentWork = containsAny(text, [
            "開発",
            "実装",
            "製造",
            "詳細設計",
            "基本設計",
            "単体テスト",
            "結合テスト",
            "Webアプリ",
            "WEBアプリ",
            "API",
            "バックエンド",
            "サーバーサイド",
            "コーディング",
            "プログラミング"
        ]);

        return hasJavaOrSpring && hasDevelopmentWork && !hasNoCodeRisk(text);
    }

    function hasRoleMismatchRisk(text) {
        return containsAny(text, [
            "インフラ",
            "ネットワーク",
            "サーバー構築",
            "運用監視",
            "監視",
            "ヘルプデスク",
            "ユーザーサポート",
            "テクニカルサポート",
            "QA",
            "品質保証",
            "テスト実行",
            "テスター",
            "評価検証",
            "データ集計",
            "データ分析",
            "レポーティング",
            "BI",
            "RPA",
            "Salesforce",
            "ServiceNow",
            "社内SE",
            "情シス",
            "PMO",
            "ITコンサル",
            "ベンダー連携",
            "WBS",
            "進捗管理",
            "課題管理",
            "1人目エンジニア",
            "一人目エンジニア",
            "0→1",
            "技術選定",
            "アーキテクチャ設計",
            "kintone",
            "キントーン",
            "ローコード",
            "ノーコード",
            "業務アプリケーションの提案",
            "業務アプリの提案",
            "業務アプリケーション導入",
            "業務アプリ導入",
            "導入業務",
            "導入支援",
            "設定作業",
            "クラウドソリューション",
            "提案支援",
            "プリセール",
            "プリセールス",
            "パートナー企業",
            "パートナー管理",
            "ベンダー管理",
            "協力会社管理"
        ]);
    }

    function hasDataAnalysisMainRisk(text) {
        return containsAny(text, [
            "データ集計",
            "データ分析",
            "レポーティング",
            "BI",
            "ダッシュボード",
            "SQL集計",
            "Pythonによる分析",
            "分析基盤"
        ]);
    }

    function hasProjectChoiceRisk(text) {
        return containsAny(text, [
            "案件選択",
            "案件選択制",
            "案件を選べる",
            "参画PJ選択可",
            "本人希望を優先",
            "希望に合わせてアサイン",
            "希望を考慮してアサイン",
            "納得しないアサインは行いません",
            "単価公開",
            "還元率"
        ]);
    }

    function hasLowCodeDxSeRisk(text) {
        return containsAny(text, [
            "kintone",
            "キントーン",
            "ローコード",
            "ノーコード",
            "業務アプリケーションの提案",
            "業務アプリの提案",
            "業務アプリケーション導入",
            "業務アプリ導入",
            "導入業務",
            "導入支援",
            "設定作業",
            "カスタマイズ開発",
            "DX導入",
            "業務改善提案"
        ]);
    }

    function hasMicrosoftCloudIntroSeRisk(text) {
        const hasMicrosoftCloud = containsAny(text, [
            "Microsoft365",
            "Microsoft 365",
            "M365",
            "Office365",
            "Office 365",
            "Azure",
            "AzureAD",
            "Azure AD",
            "EntraID",
            "Entra ID",
            "Box",
            "SharePoint",
            "Teams",
            "ExchangeOnline",
            "Exchange Online"
        ]);

        const hasIntroMigrationWork = containsAny(text, [
            "クラウドソリューション",
            "提案支援",
            "導入",
            "移行",
            "導入支援",
            "導入〜移行",
            "要件定義",
            "設計",
            "構築",
            "プリセール",
            "プリセールス",
            "顧客提案",
            "ヒアリング"
        ]);

        const hasJavaDevelopment = hasActualJavaDevelopment(text);

        return hasMicrosoftCloud && hasIntroMigrationWork && !hasJavaDevelopment;
    }

    function hasPartnerManagementRisk(text) {
        return (
            containsAny(text, ["パートナー企業", "協力会社", "ベンダー"]) &&
            containsAny(text, ["マネジメント", "管理", "協業", "連携", "要件伝達"])
        );
    }

    function hasSpringBootSignal(text) {
        return containsAny(text, [
            "Spring Boot",
            "SpringBoot",
            "Spring Framework",
            "Spring"
        ]);
    }

    function hasTeamSignal(text) {
        return containsAny(text, [
            "チーム",
            "チーム体制",
            "チーム参画",
            "複数名",
            "先輩社員",
            "メンター",
            "コードレビュー",
            "レビュー",
            "OJT"
        ]);
    }

    function hasPrimeOrDirectSignal(text) {
        return containsAny(text, [
            "プライム",
            "一次請け",
            "1次請け",
            "直取引",
            "直接取引",
            "元請け",
            "受託開発",
            "自社内開発",
            "客先常駐なし",
            "常駐なし"
        ]);
    }

    function hasCloudOrGrowthSignal(text) {
        return containsAny(text, [
            "AWS",
            "Azure",
            "GCP",
            "クラウド",
            "DX",
            "AI",
            "生成AI",
            "Docker",
            "Kubernetes",
            "GitHub Actions",
            "CI/CD"
        ]);
    }

    function hasEducationSignal(text) {
        return containsAny(text, [
            "研修",
            "教育",
            "メンター",
            "OJT",
            "資格取得支援",
            "学習支援",
            "勉強会",
            "キャリア支援",
            "育成"
        ]);
    }

    function detectJavaCareerLevel(text) {
        if (hasNoCodeRisk(text)) {
            return "NONE";
        }

        if (hasLowCodeDxSeRisk(text) && !hasActualJavaDevelopment(text)) {
            return "NONE";
        }

        if (hasMicrosoftCloudIntroSeRisk(text)) {
            return "NONE";
        }

        if (hasDataAnalysisMainRisk(text) && !hasActualJavaDevelopment(text)) {
            return "NONE";
        }

        if (
            containsAny(text, [
                "Java/Spring",
                "Java・Spring",
                "SpringBoot",
                "Spring Boot",
                "Java開発",
                "Javaエンジニア",
                "Java案件",
                "Javaを用いた",
                "Springを用いた",
                "Javaでの開発",
                "Javaによる開発"
            ]) &&
            hasActualJavaDevelopment(text)
        ) {
            return "STRONG";
        }

        if (containsAny(text, ["Java", "JAVA", "java"])) {
            return "MEDIUM";
        }

        if (containsAny(text, [
            "バックエンド",
            "サーバーサイド",
            "Webアプリ",
            "WEBアプリ",
            "API",
            "SaaS",
            "自社サービス",
            "自社プロダクト",
            "クラウド",
            "AWS",
            "DX",
            "AI",
            "IoT",
            "React",
            "Vue",
            "TypeScript"
        ])) {
            return "MODERN_WEB";
        }

        if (containsAny(text, ["Web系", "オープン系", "業務系アプリ"])) {
            return "WEAK";
        }

        return "NONE";
    }

    function detectExperienceMismatch(text) {
        const high = containsAny(text, [
            "プロジェクトマネージャー",
            "プロジェクトリーダー",
            "PMO",
            "ITコンサル",
            "コンサルタント",
            "実務経験5年以上",
            "開発経験5年以上",
            "経験5年以上",
            "要件定義経験必須",
            "基本設計経験必須",
            "リーダークラス",
            "上級SE"
        ]);

        const medium = containsAny(text, [
            "PL候補",
            "PM候補",
            "リーダー候補",
            "実務経験3年以上",
            "開発経験3年以上",
            "経験3年以上",
            "Webアプリ開発経験3年以上",
            "上流工程経験",
            "チームリーダー経験",
            "マネジメント経験"
        ]);

        if (high) return "HIGH";
        if (medium) return "MEDIUM";
        return "NONE";
    }

    function estimateReviewSmellRisk(text) {
        let score = 0;
        const reasons = [];

        if (containsAny(text, ["案件選択制", "案件選択", "還元率", "単価公開", "単価連動", "待機", "配属ガチャ"])) {
            score -= 25;
            reasons.push("レビュー臭: 案件選択/還元率/単価公開などSES色が強い");
        }

        if (containsAny(text, ["案件次第", "現場次第", "客先により", "配属先による", "プロジェクトによる"])) {
            score -= 20;
            reasons.push("レビュー臭: 案件/現場依存リスク");
        }

        if (containsAny(text, ["評価制度が不透明", "給与は単価", "賞与なし", "昇給が少ない"])) {
            score -= 25;
            reasons.push("レビュー臭: 評価/給与リスク");
        }

        if (containsAny(text, ["チーム開発", "長期案件", "メンター", "キャリア支援", "技術選定", "コードレビュー"])) {
            score += 15;
            reasons.push("レビュー臭: 成長支援/チーム開発の良い संकेत");
        }

        let level = "NONE";
        if (score <= -50) level = "HIGH";
        else if (score <= -25) level = "MEDIUM";
        else if (score > 0) level = "LOW";

        return { level, score, reasons };
    }

    function judgeJobCard(cardText, filterMode = "normal") {
        filterMode = normalizeFilterMode(filterMode);

        const text = normalizeText(cardText);
        const companyName = extractCompanyName(cardText);
        const salaryMin = extractSalaryMin(text);
        const employeeCount = extractEmployeeCount(text);
        const javaCareerLevel = detectJavaCareerLevel(text);
        const experienceMismatchLevel = detectExperienceMismatch(text);
        const reviewSmell = estimateReviewSmellRisk(text);
        const manualReview = findManualReviewRisk(companyName);

        let score = 50;
        const reasons = [];
        let strongNegativeCount = 0;
        let weakNegativeCount = 0;
        let protectiveCount = 0;

        const actualJavaDevelopment = hasActualJavaDevelopment(text);
        const noCodeRisk = hasNoCodeRisk(text);
        const roleMismatchRisk = hasRoleMismatchRisk(text);
        const projectChoiceRisk = hasProjectChoiceRisk(text);
        const lowCodeDxSeRisk = hasLowCodeDxSeRisk(text);
        const microsoftCloudIntroSeRisk = hasMicrosoftCloudIntroSeRisk(text);
        const partnerManagementRisk = hasPartnerManagementRisk(text);
        const dataAnalysisMainRisk = hasDataAnalysisMainRisk(text);
        const springBootSignal = hasSpringBootSignal(text);
        const teamSignal = hasTeamSignal(text);
        const primeOrDirectSignal = hasPrimeOrDirectSignal(text);
        const cloudOrGrowthSignal = hasCloudOrGrowthSignal(text);
        const educationSignal = hasEducationSignal(text);

        const hasProtectedCompany = isProtectedCompany(companyName);
        const hasCompanyScaleSignal =
            hasProtectedCompany ||
            (employeeCount !== null && employeeCount >= 300) ||
            containsAny(text, ["大手", "上場", "東証", "グループ", "100%出資", "安定基盤"]);

        const hasSmallCompanyRisk =
            (employeeCount !== null && employeeCount < 100) ||
            containsAny(text, ["少数精鋭", "スタートアップ", "創業メンバー", "ベンチャー企業"]);

        const hasUnknownSmallCompanyRisk =
            employeeCount === null &&
            !hasCompanyScaleSignal &&
            containsAny(text, ["ベンチャー", "スタートアップ", "裁量大", "急成長", "創業"]);

        const hasCompanyInfoRisk =
            employeeCount === null &&
            !hasCompanyScaleSignal &&
            containsAny(text, ["Java", "Spring", "AWS", "自社開発", "SaaS", "バックエンド", "プライム"]);

        const hasContractRisk = containsAny(text, [
            "期間の定め：有",
            "期間の定め有",
            "期間の定めあり",
            "契約社員",
            "有期契約",
            "契約期間6ヶ月",
            "契約期間６ヶ月"
        ]) && !containsAny(text, ["期間の定めなし", "期間の定め無し", "無期雇用"]);

        const hasHakenRisk = containsAny(text, [
            "無期雇用派遣",
            "技術者派遣",
            "派遣先",
            "常用型派遣",
            "労働者派遣"
        ]);

        const hasSesRisk = containsAny(text, [
            "SES",
            "客先常駐",
            "顧客先常駐",
            "常駐先",
            "クライアント先",
            "お客様先",
            "プロジェクト先"
        ]);

        const hasInfraRisk = containsAny(text, [
            "インフラ",
            "ネットワーク",
            "サーバー構築",
            "運用保守",
            "保守運用",
            "監視",
            "ヘルプデスク",
            "テスター",
            "品質保証",
            "QA",
            "ゼロトラスト",
            "RPA",
            "Salesforce",
            "ServiceNow",
            "社内SE"
        ]);

        const hasNonJavaCareerRisk =
            javaCareerLevel === "NONE" &&
            containsAny(text, [
                "RPA",
                "Salesforce",
                "ServiceNow",
                "社内SE",
                "ヘルプデスク",
                "インフラ",
                "ネットワーク",
                "運用保守",
                "組み込み",
                "C++",
                "C,C++",
                "データ集計",
                "データ分析",
                "kintone",
                "キントーン",
                "ローコード",
                "ノーコード",
                "導入支援",
                "設定作業",
                "Microsoft365",
                "Microsoft 365",
                "M365",
                "Office365",
                "Office 365",
                "Azure",
                "クラウドソリューション",
                "提案支援",
                "導入",
                "移行",
                "プリセール",
                "プリセールス"
            ]);

        const hasLegacyGrowthRisk = containsAny(text, [
            "既存システム",
            "保守",
            "運用",
            "改修",
            "レガシー",
            "COBOL",
            "汎用機"
        ]);

        const hasGoodSignals = containsAny(text, [
            "プライム",
            "一次請け",
            "直接取引",
            "自社内開発",
            "自社開発",
            "受託開発",
            "要件定義",
            "基本設計",
            "AWS",
            "クラウド",
            "DX",
            "AI",
            "メンター",
            "教育",
            "研修"
        ]);

        const supportSignalCount = [
            hasCompanyScaleSignal,
            primeOrDirectSignal,
            containsAny(text, ["要件定義", "基本設計", "上流工程"]),
            cloudOrGrowthSignal,
            educationSignal
        ].filter(Boolean).length;

        if (hasProtectedCompany) {
            score += 8;
            protectiveCount++;
            reasons.push("保護会社: HIDE_SAFE防止。ただしJava不明ならKEEP保証なし");
        }

        if (hasCompanyScaleSignal) {
            score += 10;
            protectiveCount++;
            reasons.push("会社規模補強あり");
        }

        if (hasSmallCompanyRisk) {
            score -= 35;
            strongNegativeCount += 2;
            reasons.push("小規模企業リスク: KEEP不可");
        }

        if (hasUnknownSmallCompanyRisk) {
            score -= 18;
            strongNegativeCount++;
            reasons.push("小規模疑い: 社員数不明 + ベンチャー/急成長系");
        }

        if (hasCompanyInfoRisk) {
            score -= 15;
            weakNegativeCount++;
            reasons.push("会社情報不足: 良い技術キーワードはあるが会社規模不明");
        }

        if (hasContractRisk) {
            score -= 40;
            strongNegativeCount += 2;
            reasons.push("契約/有期リスクあり");
        }

        if (hasHakenRisk) {
            score -= 35;
            strongNegativeCount += 2;
            reasons.push("派遣リスクあり");
        }

        if (hasSesRisk) {
            score -= 12;
            strongNegativeCount++;
            reasons.push("SES/客先常駐系の表現あり");
        }

        if (hasInfraRisk) {
            score -= 20;
            strongNegativeCount++;
            reasons.push("インフラ/運用保守/テスト/非開発寄りの可能性");
        }

        if (hasNonJavaCareerRisk) {
            score -= 25;
            strongNegativeCount++;
            reasons.push("非Javaキャリアリスク");
        }

        if (hasLegacyGrowthRisk) {
            score -= 12;
            weakNegativeCount++;
            reasons.push("レガシー/保守成長リスク");
        }

        if (noCodeRisk) {
            score -= 45;
            strongNegativeCount += 2;
            reasons.push("ノーコード/ローコード/コーディング経験不問: Java開発キャリアではない");
        }

        if (roleMismatchRisk) {
            score -= 20;
            strongNegativeCount++;
            reasons.push("職種ミスマッチ: Java開発以外の可能性");
        }

        if (lowCodeDxSeRisk) {
            score -= 35;
            strongNegativeCount++;
            reasons.push("kintone/ローコード/DX導入SE: Java/Spring開発キャリアではない");
        }

        if (microsoftCloudIntroSeRisk) {
            score -= 35;
            strongNegativeCount++;
            reasons.push("Microsoft 365/Azureクラウド導入SE: Java/Spring開発キャリアではない");
        }

        if (partnerManagementRisk) {
            score -= 20;
            strongNegativeCount++;
            reasons.push("パートナー企業管理寄り: 直接実装経験を積みにくい可能性");
        }

        if (dataAnalysisMainRisk && !actualJavaDevelopment) {
            score -= 25;
            strongNegativeCount++;
            reasons.push("データ集計/分析中心: Java/Spring開発ではない可能性");
        }

        if (projectChoiceRisk) {
            score -= 10;
            weakNegativeCount++;
            reasons.push("案件選択型SES: Java配属保証は面接確認が必要");
        }

        if (experienceMismatchLevel === "HIGH") {
            score -= 24;
            strongNegativeCount++;
            reasons.push("経験ミスマッチHIGH");
        } else if (experienceMismatchLevel === "MEDIUM") {
            score -= 14;
            weakNegativeCount++;
            reasons.push("経験ミスマッチMEDIUM: KEEP不可");
        }

        if (reviewSmell.level === "HIGH") {
            score -= 30;
            strongNegativeCount += 2;
            reasons.push("レビュー臭HIGH");
            reviewSmell.reasons.forEach(r => reasons.push(r));
        } else if (reviewSmell.level === "MEDIUM") {
            score -= 15;
            strongNegativeCount++;
            reasons.push("レビュー臭MEDIUM");
            reviewSmell.reasons.forEach(r => reasons.push(r));
        }

        if (manualReview) {
            if (manualReview.level === "HIGH") {
                score -= 35;
                strongNegativeCount += 2;
                reasons.push("手動レビューHIGH");
            } else if (manualReview.level === "MEDIUM") {
                score -= 20;
                strongNegativeCount++;
                reasons.push("手動レビューMEDIUM");
            }

            if (typeof manualReview.rating === "number" && manualReview.rating <= 3.0) {
                score -= 15;
                strongNegativeCount++;
                reasons.push(`手動登録評価リスク: ${manualReview.rating}`);
            }

            if (typeof manualReview.reviewCount === "number" && manualReview.reviewCount <= 35) {
                score -= 10;
                weakNegativeCount++;
                reasons.push(`手動登録口コミ数リスク: ${manualReview.reviewCount}件`);
            }

            if (typeof manualReview.employeeCount === "number" && manualReview.employeeCount <= 80) {
                score -= 25;
                strongNegativeCount++;
                reasons.push(`手動登録社員数リスク: ${manualReview.employeeCount}名`);
            }

            manualReview.reasons.forEach(r => reasons.push(r));
        }

        if (javaCareerLevel === "STRONG") {
            score += 32;
            protectiveCount += 2;
            reasons.push("Java STRONG: Java/Spring + 実装/開発根拠あり");
        } else if (javaCareerLevel === "MEDIUM") {
            score += 12;
            protectiveCount++;
            reasons.push("Java MEDIUM: Java単語はあるがKEEPには不足");
        } else if (javaCareerLevel === "MODERN_WEB") {
            score += 6;
            protectiveCount++;
            reasons.push("MODERN_WEB: Web/AWS/SaaS魅力あり。ただしJava実務は不明");
        } else if (javaCareerLevel === "WEAK") {
            score += 2;
            weakNegativeCount++;
            reasons.push("Java WEAK: Web/オープン系だがJava明記なし");
        } else {
            score -= 12;
            weakNegativeCount++;
            reasons.push("Java NONE: Java/Spring実装根拠なし");
        }

        if (actualJavaDevelopment) {
            score += 10;
            reasons.push("実装/開発/設計/単体テストなどJava開発根拠あり");
        }

        if (springBootSignal) {
            score += 8;
            reasons.push("Spring/Spring Bootシグナルあり");
        }

        if (teamSignal) {
            score += 5;
            reasons.push("チーム/レビュー/OJTシグナルあり");
        }

        if (hasGoodSignals) {
            score += 10;
            protectiveCount++;
            reasons.push("プライム/設計/クラウド/教育など良いシグナルあり");
        }

        if (salaryMin !== null && salaryMin < 380) {
            score -= 22;
            strongNegativeCount++;
            reasons.push(`年収下限が低い: ${salaryMin}万`);
        }

        if (salaryMin !== null && salaryMin >= 500) {
            score += 10;
            protectiveCount++;
            reasons.push(`年収下限高め: ${salaryMin}万`);
        }

        score = Math.max(0, Math.min(100, score));

        const smallCompanyKeepBlock =
            hasSmallCompanyRisk ||
            (employeeCount !== null && employeeCount < 200);

        const experienceKeepBlock =
            experienceMismatchLevel === "HIGH" ||
            experienceMismatchLevel === "MEDIUM";

        const growthSesSignalCount = [
            hasCompanyScaleSignal,
            primeOrDirectSignal,
            actualJavaDevelopment,
            educationSignal,
            cloudOrGrowthSignal,
            teamSignal
        ].filter(Boolean).length;

        const hardRiskForKeep =
            hasSmallCompanyRisk ||
            smallCompanyKeepBlock ||
            hasUnknownSmallCompanyRisk ||
            hasContractRisk ||
            hasHakenRisk ||
            hasNonJavaCareerRisk ||
            hasInfraRisk ||
            noCodeRisk ||
            roleMismatchRisk ||
            lowCodeDxSeRisk ||
            microsoftCloudIntroSeRisk ||
            partnerManagementRisk ||
            dataAnalysisMainRisk ||
            experienceKeepBlock ||
            (manualReview && manualReview.level === "HIGH");

        const softRiskForKeep =
            hasCompanyInfoRisk ||
            hasLegacyGrowthRisk ||
            hasSesRisk ||
            projectChoiceRisk ||
            reviewSmell.level === "MEDIUM";

        const canKeep =
            (
                javaCareerLevel === "STRONG" &&
                actualJavaDevelopment &&
                springBootSignal &&
                teamSignal &&
                !hasSesRisk &&
                !hardRiskForKeep &&
                score >= 70
            ) ||
            (
                javaCareerLevel === "STRONG" &&
                actualJavaDevelopment &&
                hasSesRisk &&
                growthSesSignalCount >= 3 &&
                teamSignal &&
                !hardRiskForKeep &&
                !projectChoiceRisk &&
                score >= 72
            );

        let decision = "REVIEW";
        let confidence = "MEDIUM";
        let riskLevel = "NEED_DETAIL";

        const hideSafeBase =
            !hasProtectedCompany &&
            !hasCompanyScaleSignal &&
            score <= 35 &&
            (
                hasContractRisk ||
                hasHakenRisk ||
                hasNonJavaCareerRisk ||
                hasSmallCompanyRisk ||
                hasInfraRisk ||
                noCodeRisk ||
                roleMismatchRisk ||
                lowCodeDxSeRisk ||
                microsoftCloudIntroSeRisk ||
                partnerManagementRisk ||
                experienceMismatchLevel === "HIGH"
            );

        const hideCautionBase =
            !canKeep &&
            (
                hardRiskForKeep ||
                softRiskForKeep ||
                score <= 55 ||
                javaCareerLevel === "NONE"
            );

        if (canKeep) {
            decision = "KEEP";
            confidence = "HIGH";
            riskLevel = "KEEP";
        } else if (filterMode === "conservative") {
            if (hideSafeBase && score <= 25) {
                decision = "HIDE_SAFE";
                confidence = "HIGH";
                riskLevel = "SAFE_HIDE";
            } else if (hideCautionBase) {
                decision = "HIDE_CAUTION";
                confidence = "MEDIUM";
                riskLevel = "CAUTION";
            }
        } else if (filterMode === "normal") {
            if (hideSafeBase) {
                decision = "HIDE_SAFE";
                confidence = "HIGH";
                riskLevel = "SAFE_HIDE";
            } else if (hideCautionBase) {
                decision = "HIDE_CAUTION";
                confidence = hardRiskForKeep ? "HIGH" : "MEDIUM";
                riskLevel = "CAUTION";
            }
        } else if (filterMode === "aggressive") {
            if (hideSafeBase || (!hasProtectedCompany && score <= 30 && hardRiskForKeep)) {
                decision = "HIDE_SAFE";
                confidence = "HIGH";
                riskLevel = "SAFE_HIDE";
            } else if (hideCautionBase || score <= 65) {
                decision = "HIDE_CAUTION";
                confidence = hardRiskForKeep ? "HIGH" : "MEDIUM";
                riskLevel = "CAUTION";
            }
        }

        if (hasProtectedCompany && decision === "HIDE_SAFE") {
            decision = "REVIEW";
            confidence = "MEDIUM";
            riskLevel = "NEED_DETAIL";
            reasons.push("保護会社のためHIDE_SAFE禁止 → REVIEW");
        }

        if (javaCareerLevel === "NONE" && decision === "KEEP") {
            decision = "REVIEW";
            confidence = "MEDIUM";
            riskLevel = "NEED_DETAIL";
            reasons.push("Java NONEのためKEEP禁止 → REVIEW");
        }

        if (javaCareerLevel === "MODERN_WEB" && decision === "KEEP") {
            decision = "REVIEW";
            confidence = "MEDIUM";
            riskLevel = "NEED_DETAIL";
            reasons.push("MODERN_WEBはJava実務不明のためKEEP不可 → REVIEW");
        }

        if (decision === "KEEP" && !actualJavaDevelopment) {
            decision = "REVIEW";
            confidence = "MEDIUM";
            riskLevel = "NEED_DETAIL";
            reasons.push("Java単語のみで実装・開発根拠が弱いためKEEP禁止 → REVIEW");
        }

        if (decision === "KEEP" && noCodeRisk) {
            decision = "HIDE_CAUTION";
            confidence = "HIGH";
            riskLevel = "CAUTION";
            reasons.push("ノーコード/コーディング経験不問のためKEEP禁止 → HIDE_CAUTION");
        }

        if (decision === "KEEP" && experienceKeepBlock) {
            decision = "REVIEW";
            confidence = "MEDIUM";
            riskLevel = "NEED_DETAIL";
            reasons.push("経験3年以上/PL候補/リーダー級のためKEEP禁止 → REVIEW");
        }

        if (decision === "KEEP" && projectChoiceRisk) {
            decision = "REVIEW";
            confidence = "MEDIUM";
            riskLevel = "NEED_DETAIL";
            reasons.push("案件選択型SESのためKEEP禁止 → REVIEW");
        }

        if (decision === "KEEP" && smallCompanyKeepBlock) {
            decision = "HIDE_CAUTION";
            confidence = "HIGH";
            riskLevel = "CAUTION";
            reasons.push("社員数200名未満/小規模寄りのためKEEP禁止 → HIDE_CAUTION");
        }

        if (decision === "KEEP" && roleMismatchRisk) {
            decision = "HIDE_CAUTION";
            confidence = "HIGH";
            riskLevel = "CAUTION";
            reasons.push("職種ミスマッチのためKEEP禁止 → HIDE_CAUTION");
        }

        if (decision === "KEEP" && lowCodeDxSeRisk) {
            decision = "HIDE_CAUTION";
            confidence = "HIGH";
            riskLevel = "CAUTION";
            reasons.push("kintone/ローコード/DX導入SEのためKEEP禁止 → HIDE_CAUTION");
        }

        if (decision === "KEEP" && microsoftCloudIntroSeRisk) {
            decision = "HIDE_CAUTION";
            confidence = "HIGH";
            riskLevel = "CAUTION";
            reasons.push("Microsoftクラウド導入SEのためKEEP禁止 → HIDE_CAUTION");
        }

        if (decision === "KEEP" && partnerManagementRisk) {
            decision = "HIDE_CAUTION";
            confidence = "HIGH";
            riskLevel = "CAUTION";
            reasons.push("パートナー管理寄りのためKEEP禁止 → HIDE_CAUTION");
        }

        return {
            decision,
            confidence,
            riskLevel,
            score,
            reasons,
            salaryMin,
            employeeCount,
            strongNegativeCount,
            weakNegativeCount,
            protectiveCount,
            companyName,
            hasProtectedCompany,
            hasCompanyScaleSignal,
            hasSmallCompanyRisk,
            hasUnknownSmallCompanyRisk,
            hasCompanyInfoRisk,
            hasContractRisk,
            hasHakenRisk,
            hasNonJavaCareerRisk,
            hasInfraRisk,
            hasLegacyGrowthRisk,
            experienceMismatchLevel,
            reviewSmellRiskLevel: reviewSmell.level,
            reviewSmellScore: reviewSmell.score,
            javaCareerLevel,
            hasActualJavaDevelopment: actualJavaDevelopment,
            hasNoCodeRisk: noCodeRisk,
            hasRoleMismatchRisk: roleMismatchRisk,
            hasProjectChoiceRisk: projectChoiceRisk,
            hasLowCodeDxSeRisk: lowCodeDxSeRisk,
            hasMicrosoftCloudIntroSeRisk: microsoftCloudIntroSeRisk,
            hasPartnerManagementRisk: partnerManagementRisk,
            hasDataAnalysisMainRisk: dataAnalysisMainRisk,
            hasSpringBootSignal: springBootSignal,
            hasTeamSignal: teamSignal,
            growthSesSignalCount,
            enHyoubanRating: manualReview?.rating ?? null,
            enHyoubanReviewCount: manualReview?.reviewCount ?? null,
            enHyoubanEmployeeCount: manualReview?.employeeCount ?? null,
            enHyoubanUrl: null,
            enHyoubanFetchOk: false,
            enHyoubanFetchReason: manualReview ? "manual profile" : null,
            hasLowEnHyoubanReviewCount:
                typeof manualReview?.reviewCount === "number" && manualReview.reviewCount <= 35,
            hasLowEnHyoubanRating:
                typeof manualReview?.rating === "number" && manualReview.rating <= 3.0,
            hasVeryLowEmployeeCount:
                typeof manualReview?.employeeCount === "number" && manualReview.employeeCount <= 80,
            hasLowEmployeeCount:
                typeof manualReview?.employeeCount === "number" && manualReview.employeeCount < 100,
            hasLargeEmployeeCount:
                typeof manualReview?.employeeCount === "number" && manualReview.employeeCount >= 300
        };
    }

    async function fetchEnHyoubanInfo(companyName) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: "FETCH_EN_HYOUBAN_INFO",
                companyName
            });

            return response || {
                ok: false,
                rating: null,
                reviewCount: null,
                employeeCount: null,
                url: null,
                reason: "空のレスポンスです"
            };
        } catch (error) {
            return {
                ok: false,
                rating: null,
                reviewCount: null,
                employeeCount: null,
                url: null,
                reason: error.message
            };
        }
    }

    function applyEnHyoubanPublicInfo(item, enInfo) {
        if (!enInfo) return item;

        item.enHyoubanFetchOk = !!enInfo.ok;
        item.enHyoubanFetchReason = enInfo.reason || null;
        item.enHyoubanUrl = enInfo.url || null;

        if (typeof enInfo.rating === "number") {
            item.enHyoubanRating = enInfo.rating;
        }

        if (typeof enInfo.reviewCount === "number") {
            item.enHyoubanReviewCount = enInfo.reviewCount;
        }

        if (typeof enInfo.employeeCount === "number") {
            item.enHyoubanEmployeeCount = enInfo.employeeCount;

            if (!item.employeeCount) {
                item.employeeCount = enInfo.employeeCount;
            }

            item.reasons.push(`en-hyouban公開情報参照: 社員数${enInfo.employeeCount}名`);
        }

        if (typeof item.enHyoubanReviewCount === "number" && item.enHyoubanReviewCount <= 35) {
            item.score = Math.max(0, item.score - 10);
            item.weakNegativeCount++;
            item.hasLowEnHyoubanReviewCount = true;
            item.reasons.push(`en-hyouban公開情報参照: 口コミ数${item.enHyoubanReviewCount}件のため-10`);
        }

        if (typeof item.enHyoubanRating === "number" && item.enHyoubanRating <= 3.0) {
            item.score = Math.max(0, item.score - 15);
            item.strongNegativeCount++;
            item.hasLowEnHyoubanRating = true;
            item.reasons.push(`en-hyouban公開情報参照: 評価${item.enHyoubanRating}のため-15`);
        }

        if (typeof item.enHyoubanEmployeeCount === "number") {
            if (item.enHyoubanEmployeeCount <= 80) {
                item.score = Math.max(0, item.score - 25);
                item.hasSmallCompanyRisk = true;
                item.hasVeryLowEmployeeCount = true;
                item.hasLowEmployeeCount = true;
                item.strongNegativeCount++;
                item.reasons.push(`en-hyouban社員数リスク: 社員数${item.enHyoubanEmployeeCount}名のため80名以下扱い`);

                if (item.decision === "KEEP") {
                    item.decision = "HIDE_CAUTION";
                    item.confidence = "HIGH";
                    item.riskLevel = "CAUTION";
                    item.reasons.push("en-hyouban社員数補正: 80名以下のためKEEPからHIDE_CAUTIONへ降格");
                }
            } else if (item.enHyoubanEmployeeCount < 100) {
                item.score = Math.max(0, item.score - 20);
                item.hasSmallCompanyRisk = true;
                item.hasLowEmployeeCount = true;
                item.strongNegativeCount++;
                item.reasons.push(`en-hyouban社員数リスク: 社員数${item.enHyoubanEmployeeCount}名のため小規模扱い`);

                if (item.decision === "KEEP") {
                    item.decision = "HIDE_CAUTION";
                    item.confidence = "HIGH";
                    item.riskLevel = "CAUTION";
                    item.reasons.push("en-hyouban社員数補正: 小規模企業のためKEEPからHIDE_CAUTIONへ降格");
                }
            } else if (item.enHyoubanEmployeeCount < 200) {
                item.score = Math.max(0, item.score - 12);
                item.hasSmallCompanyRisk = true;
                item.reasons.push(`en-hyouban社員数補正: 社員数${item.enHyoubanEmployeeCount}名のためKEEP不可`);

                if (item.decision === "KEEP") {
                    item.decision = "REVIEW";
                    item.confidence = "MEDIUM";
                    item.riskLevel = "NEED_DETAIL";
                    item.reasons.push("en-hyouban社員数補正: 200名未満のためKEEPからREVIEWへ降格");
                }
            }

            if (item.enHyoubanEmployeeCount >= 300) {
                item.score = Math.min(100, item.score + 8);
                item.hasCompanyScaleSignal = true;
                item.hasLargeEmployeeCount = true;
                item.protectiveCount++;
                item.reasons.push(`en-hyouban社員数補強: 社員数${item.enHyoubanEmployeeCount}名のため会社規模補強`);

                if (
                    item.decision === "HIDE_SAFE" &&
                    !item.hasContractRisk &&
                    !item.hasHakenRisk &&
                    !item.hasNonJavaCareerRisk
                ) {
                    item.decision = "REVIEW";
                    item.confidence = "MEDIUM";
                    item.riskLevel = "NEED_DETAIL";
                    item.reasons.push("en-hyouban社員数補正: 中堅以上のためHIDE_SAFEからREVIEWへ昇格");
                }
            }
        }

        if (
            item.decision === "KEEP" &&
            (
                item.hasLowEnHyoubanReviewCount ||
                item.hasLowEnHyoubanRating ||
                item.hasVeryLowEmployeeCount
            )
        ) {
            item.decision = "REVIEW";
            item.confidence = "MEDIUM";
            item.riskLevel = "NEED_DETAIL";
            item.reasons.push("en-hyouban補正: 口コミ/評価/社員数リスクのためKEEPからREVIEWへ降格");
        }

        item.score = Math.max(0, Math.min(100, item.score));

        return item;
    }

    function isNonDevelopmentJobForHideCandidate(item) {
        const javaLevel = item.javaCareerLevel || "NONE";

        if (javaLevel === "STRONG") return false;

        return (
            item.hasNonJavaCareerRisk ||
            item.hasInfraRisk ||
            item.hasNoCodeRisk ||
            item.hasRoleMismatchRisk ||
            item.hasLowCodeDxSeRisk ||
            item.hasMicrosoftCloudIntroSeRisk ||
            item.hasPartnerManagementRisk ||
            (
                javaLevel === "NONE" &&
                (
                    item.hasLegacyGrowthRisk ||
                    item.experienceMismatchLevel === "HIGH"
                )
            )
        );
    }

    function shouldPrepareHideCandidateDuringAnalysis(item) {
        const ratingRisk =
            typeof item.enHyoubanRating === "number" &&
            item.enHyoubanRating <= 3.0;

        const employeeRisk =
            typeof item.enHyoubanEmployeeCount === "number" &&
            item.enHyoubanEmployeeCount <= 80;

        const nonDevelopmentRisk = isNonDevelopmentJobForHideCandidate(item);

        if (ratingRisk) {
            item.reasons.push(`調査中のユーザー確認済み処理: en-hyouban評価${item.enHyoubanRating}が3.0以下`);
        }

        if (employeeRisk) {
            item.reasons.push(`調査中のユーザー確認済み処理: 社員数${item.enHyoubanEmployeeCount}名が80名以下`);
        }

        if (nonDevelopmentRisk) {
            item.reasons.push("調査中のユーザー確認済み処理: 開発キャリアと関係が薄い求人");
        }

        return ratingRisk || employeeRisk || nonDevelopmentRisk;
    }

    function cleanupBadges() {
        document.querySelectorAll(`.${BADGE_CLASS}`).forEach(el => el.remove());

        document.querySelectorAll(`.${MARK_CLASS}`).forEach(el => {
            el.classList.remove(MARK_CLASS);
            el.style.outline = "";
            el.style.boxShadow = "";
            el.style.borderRadius = "";
        });
    }

    function getDecisionColor(decision) {
        if (decision === "HIDE_SAFE") return "#dc2626";
        if (decision === "HIDE_CAUTION") return "#f97316";
        if (decision === "REVIEW") return "#2563eb";
        if (decision === "KEEP") return "#059669";
        return "#6b7280";
    }

    function renderBadge(card, item) {
        if (!card) return;

        const color = getDecisionColor(item.decision);

        card.classList.add(MARK_CLASS);
        card.style.outline = `2px solid ${color}`;
        card.style.boxShadow = `0 0 0 3px ${color}22`;
        card.style.borderRadius = "12px";

        const old = card.querySelector(`.${BADGE_CLASS}`);
        if (old) old.remove();

        const badge = document.createElement("div");
        badge.className = BADGE_CLASS;

        badge.style.cssText = `
            display: block;
            box-sizing: border-box;
            width: calc(100% - 24px);
            margin: 10px 12px 8px 12px;
            padding: 8px 10px;
            border: 1px solid ${color};
            border-left: 5px solid ${color};
            border-radius: 10px;
            background: #ffffff;
            color: #111827;
            font-size: 12px;
            line-height: 1.5;
            font-family: "Segoe UI", "Noto Sans JP", sans-serif;
            pointer-events: none;
            position: static;
            z-index: 1;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        `;

        const rating =
            item.enHyoubanRating === null || item.enHyoubanRating === undefined
                ? "不明"
                : item.enHyoubanRating;

        const reviewCount =
            item.enHyoubanReviewCount === null || item.enHyoubanReviewCount === undefined
                ? "不明"
                : `${item.enHyoubanReviewCount}件`;

        const employeeCount =
            item.enHyoubanEmployeeCount === null || item.enHyoubanEmployeeCount === undefined
                ? "不明"
                : `${item.enHyoubanEmployeeCount}名`;

        badge.innerHTML = `
            <div style="font-weight:900; color:${color}; margin-bottom:4px;">
                ${item.decision} / ${item.confidence} / score ${item.score}
            </div>
            <div>
                Java: <b>${item.javaCareerLevel}</b> /
                評価: <b>${rating}</b> /
                口コミ: <b>${reviewCount}</b> /
                社員数: <b>${employeeCount}</b> /
                Risk: <b>${item.riskLevel}</b>
            </div>
            <div style="font-size:11px; color:#4b5563; margin-top:4px;">
                ${(item.reasons || []).slice(0, 4).join(" / ")}
            </div>
        `;

        card.appendChild(badge);
    }

    async function restoreBadgesFromCache() {
        const cache = await loadAnalysisCache();
        const buttons = findInterestNoneButtons();

        let restoredCount = 0;

        for (const button of buttons) {
            const card = findJobCardFromButton(button);
            const cardText = card ? card.innerText : "";
            const title = extractJobTitle(cardText);
            const companyName = extractCompanyName(cardText);

            if (!companyName || !title) continue;

            const key = makeJobCacheKey(companyName, title);
            const cachedItem = cache[key];

            if (!cachedItem) continue;

            renderBadge(card, cachedItem);
            restoredCount++;
        }

        if (restoredCount > 0) {
            console.log(`Recruit Job Posting Analysis: キャッシュから${restoredCount}件のバッジを復元しました`);
        }

        return restoredCount;
    }

    function findConfirmButtons() {
        const modalCandidates = Array.from(document.querySelectorAll(
            "[role='dialog'], .modal, [class*='modal'], [class*='Modal'], [class*='dialog'], [class*='Dialog']"
        )).filter(isVisible);

        const area = modalCandidates.length > 0
            ? modalCandidates[modalCandidates.length - 1]
            : document;

        return Array.from(area.querySelectorAll("button, a, div[role='button'], span[role='button']"))
            .filter(element => {
                const text = normalizeText(element.innerText || element.textContent || "");
                return (
                    isVisible(element) &&
                    (
                        text === "はい" ||
                        text === "OK" ||
                        text === "確認" ||
                        text === "確定" ||
                        text === "保存"
                    )
                );
            });
    }

    async function executeUserConfirmedInterestNoneAction(button) {
        if (!button || !isVisible(button)) return false;

        button.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        await sleep(700);

        if (window.__jobPostingAnalysisStopRequested) return false;

        button.click();

        await sleep(1300);

        const confirmButtons = findConfirmButtons();

        if (confirmButtons.length > 0) {
            confirmButtons[0].click();
            await sleep(1300);
        }

        return true;
    }

    async function analyzeVisibleJobPostings(filterMode = "normal", userConfirmedActionDuringAnalysis = false) {
        filterMode = normalizeFilterMode(filterMode);
        cleanupBadges();

        const buttons = findInterestNoneButtons();

        const hideSafeItems = [];
        const hideCautionItems = [];
        const reviewItems = [];
        const keepItems = [];
        const userConfirmedActionDuringAnalysisItems = [];

        let enFetchCount = 0;

        for (const button of buttons) {
            if (window.__jobPostingAnalysisStopRequested) break;

            const card = findJobCardFromButton(button);
            const cardText = card ? card.innerText : "";
            const title = extractJobTitle(cardText);
            const companyName = extractCompanyName(cardText);

            let item = {
                title,
                companyName,
                ...judgeJobCard(cardText, filterMode)
            };

            const shouldFetch =
                enFetchCount < MAX_EN_HYOUBAN_PUBLIC_INFO_REFERENCE &&
                !!companyName;

            if (shouldFetch) {
                enFetchCount++;
                const enInfo = await fetchEnHyoubanInfo(companyName);
                item = applyEnHyoubanPublicInfo(item, enInfo);
            } else {
                item.enHyoubanFetchReason =
                    item.enHyoubanFetchReason ||
                    `スキップ: 上限${MAX_EN_HYOUBAN_PUBLIC_INFO_REFERENCE}件に到達、または会社名が見つかりませんでした`;
            }

            if (userConfirmedActionDuringAnalysis && shouldPrepareHideCandidateDuringAnalysis(item)) {
                item.decision = "HIDE_SAFE";
                item.confidence = "HIGH";
                item.riskLevel = "USER_CONFIRMED_ACTION_DURING_ANALYSIS";

                const actionExecuted = await executeUserConfirmedInterestNoneAction(button);

                if (actionExecuted) {
                    item.userConfirmedActionDuringAnalysis = true;
                    item.reasons.push("調査中にユーザー確認済みの興味なし処理済み");
                    userConfirmedActionDuringAnalysisItems.push(item);
                    button.dataset.jobPostingAnalysisChecked = "true";
                }
            }

            await saveItemToAnalysisCache(item);
            renderBadge(card, item);

            if (item.decision === "HIDE_SAFE") {
                hideSafeItems.push(item);
            } else if (item.decision === "HIDE_CAUTION") {
                hideCautionItems.push(item);
            } else if (item.decision === "REVIEW") {
                reviewItems.push(item);
            } else {
                keepItems.push(item);
            }
        }

        return {
            total: buttons.length,
            hideSafeCount: hideSafeItems.length,
            hideCautionCount: hideCautionItems.length,
            reviewCount: reviewItems.length,
            keepCount: keepItems.length,
            userConfirmedActionDuringAnalysisCount: userConfirmedActionDuringAnalysisItems.length,
            hideSafeItems,
            hideCautionItems,
            reviewItems,
            keepItems,
            userConfirmedActionDuringAnalysisItems
        };
    }

    async function executeUserConfirmedHideCandidateActions(maxActionCount = 10, filterMode = "normal", targetDecision = "HIDE_SAFE") {
        filterMode = normalizeFilterMode(filterMode);
        window.__jobPostingAnalysisStopRequested = false;

        const buttons = findInterestNoneButtons();

        let checkedCount = 0;
        let executedActionCount = 0;
        let skippedCautionCount = 0;
        let reviewCount = 0;
        let keepCount = 0;

        const executedActionItems = [];

        for (const button of buttons) {
            if (window.__jobPostingAnalysisStopRequested) break;

            const card = findJobCardFromButton(button);
            const cardText = card ? card.innerText : "";
            const title = extractJobTitle(cardText);
            const judge = judgeJobCard(cardText, filterMode);

            checkedCount++;

            if (judge.decision === "KEEP") {
                keepCount++;
                button.dataset.jobPostingAnalysisChecked = "true";
                continue;
            }

            if (judge.decision === "REVIEW") {
                reviewCount++;
                button.dataset.jobPostingAnalysisChecked = "true";
                continue;
            }

            if (targetDecision === "HIDE_SAFE" && judge.decision !== "HIDE_SAFE") {
                if (judge.decision === "HIDE_CAUTION") skippedCautionCount++;
                button.dataset.jobPostingAnalysisChecked = "true";
                continue;
            }

            if (targetDecision === "HIDE_CAUTION" && judge.decision !== "HIDE_CAUTION") {
                button.dataset.jobPostingAnalysisChecked = "true";
                continue;
            }

            if (executedActionCount >= maxActionCount) break;
            if (!isVisible(button)) continue;

            executedActionItems.push({
                title,
                ...judge
            });

            const actionExecuted = await executeUserConfirmedInterestNoneAction(button);

            if (actionExecuted) {
                executedActionCount++;
            }
        }

        return {
            checkedCount,
            executedActionCount,
            skippedCautionCount,
            reviewCount,
            keepCount,
            executedActionItems
        };
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === "RUN_JOB_POSTING_ANALYSIS") {
            const filterMode = normalizeFilterMode(request.filterMode || "normal");
            const userConfirmedActionDuringAnalysis = !!request.userConfirmedActionDuringAnalysis;

            analyzeVisibleJobPostings(filterMode, userConfirmedActionDuringAnalysis).then(result => {
                sendResponse({
                    message:
                        `フィルターモード: ${filterMode}\n` +
                        `現在画面の「興味なし」ボタン: ${result.total}件\n` +
                        `HIDE_SAFE処理候補: ${result.hideSafeCount}件\n` +
                        `HIDE_CAUTION事前確認候補: ${result.hideCautionCount}件\n` +
                        `REVIEW手動確認候補: ${result.reviewCount}件\n` +
                        `KEEP維持候補: ${result.keepCount}件\n` +
                        `分析中のユーザー確認済み「興味なし」処理: ${result.userConfirmedActionDuringAnalysisCount}件\n` +
                        `※ en-hyouban公開情報参照は最大${MAX_EN_HYOUBAN_PUBLIC_INFO_REFERENCE}件`,
                    hideSafeItems: result.hideSafeItems,
                    hideCautionItems: result.hideCautionItems,
                    reviewItems: result.reviewItems,
                    keepItems: result.keepItems,
                    userConfirmedActionDuringAnalysisItems: result.userConfirmedActionDuringAnalysisItems
                });
            });

            return true;
        }

        if (request.type === "EXECUTE_USER_CONFIRMED_HIDE_CANDIDATES") {
            const maxActionCount = Number(request.maxActionCount || 10);
            const filterMode = normalizeFilterMode(request.filterMode || "normal");
            const targetDecision = request.targetDecision || "HIDE_SAFE";

            executeUserConfirmedHideCandidateActions(maxActionCount, filterMode, targetDecision).then(result => {
                sendResponse({
                    message:
                        `ユーザー確認に基づく処理が完了しました\n` +
                        `フィルターモード: ${filterMode}\n` +
                        `処理対象: ${targetDecision}\n` +
                        `確認した求人: ${result.checkedCount}件\n` +
                        `「興味なし」処理: ${result.executedActionCount}件\n` +
                        `HIDE_CAUTIONスキップ: ${result.skippedCautionCount}件\n` +
                        `REVIEWスキップ: ${result.reviewCount}件\n` +
                        `KEEP維持: ${result.keepCount}件`,
                    executedActionItems: result.executedActionItems
                });
            });

            return true;
        }

        if (request.type === "STOP_JOB_POSTING_ANALYSIS") {
            window.__jobPostingAnalysisStopRequested = true;

            sendResponse({
                message: "停止リクエストを受け付けました"
            });

            return true;
        }
    });

    console.log("Recruit Job Posting Analysis content.js v5.3.6 を読み込みました");

    setTimeout(() => {
        restoreBadgesFromCache();
    }, 1200);

    window.addEventListener("pageshow", () => {
        setTimeout(() => {
            restoreBadgesFromCache();
        }, 1200);
    });

    let restoreTimer = null;

    const observer = new MutationObserver(() => {
        clearTimeout(restoreTimer);
        restoreTimer = setTimeout(() => {
            restoreBadgesFromCache();
        }, 1000);
    });

    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
})();