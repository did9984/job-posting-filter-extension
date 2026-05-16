# 求人票分析・分類支援 Chrome拡張機能

Project Name: Job Posting Filter Extension

## 概要

転職活動中に多数の求人を確認する負担を減らすために作成した、個人用 Chrome 拡張機能です。

求人一覧ページに表示される求人票情報をもとに、SES・派遣・契約リスク、会社規模、年収条件などを判定し、求人を KEEP / REVIEW / HIDE_CAUTION / HIDE_SAFE に分類・可視化します。

単純なキーワード検索ではなく、自分の転職活動で重視している条件をルール化し、求人確認作業を効率化することを目的としています。

## 使い方

1. このリポジトリをダウンロードします。
2. Chrome で `chrome://extensions/` を開きます。
3. 右上の「デベロッパーモード」を ON にします。
4. 「パッケージ化されていない拡張機能を読み込む」をクリックします。
5. 本プロジェクトのフォルダを選択します。
6. 対象の求人一覧ページを開き、拡張機能を実行します。

## 注意事項

本ツールは、個人の転職活動における求人確認作業を効率化する目的で作成した個人用ツールです。

特定サービスの公式ツールではありません。

外部情報については、公開ページ上の情報参照補助として利用しており、取得結果は求人判断の補助材料として扱っています。

また、ユーザー操作を伴う処理については、誤操作を防ぐためユーザー確認後に実行する設計にしています。

## 開発背景

転職活動を進める中で、毎日多くの求人を確認する必要がありました。

特に、自分は今後 Java / Spring の実務経験を積みたいと考えているため、求人ごとに Java との関連性、開発経験につながるかどうか、SES・派遣・契約リスク、会社規模、年収条件などを確認する必要がありました。

この確認作業を毎回手作業で行う負担が大きかったため、自分の判断基準をルール化し、求人一覧上で優先度を確認できる Chrome 拡張機能を開発しました。

## 主な機能

- 求人一覧ページ上の求人カード情報の取得
- 求人票テキストの分析
- Java / Spring との関連性判定
- SES・客先常駐・派遣・契約リスクの検出
- 運用保守・テスト・インフラ・ヘルプデスクなどの非開発リスク検出
- 年収条件の確認
- 会社規模に関するシグナルの確認
- 外部情報参照による評価・口コミ数・社員数の補助確認
- KEEP / REVIEW / HIDE_CAUTION / HIDE_SAFE への分類
- 求人カード上への判定バッジ表示
- chrome.storage.local による分析結果のキャッシュ
- pageshow / MutationObserver による画面復帰時のバッジ復元
- ユーザー確認後の処理実行

## 分類基準

| 分類 | 内容 |
|---|---|
| KEEP | 条件に合う可能性が高く、優先的に確認したい求人 |
| REVIEW | 判断材料が不足しており、手動確認が必要な求人 |
| HIDE_CAUTION | 条件に合わない可能性が高いが、念のため注意して確認する求人 |
| HIDE_SAFE | 条件に合わない可能性が高く、非表示候補にできる求人 |

## Java キャリア判定

| 判定 | 内容 |
|---|---|
| Java STRONG | Java / Spring / Spring Boot などが明確に記載されている |
| Java MEDIUM | Java 配属の可能性はあるが、確定ではない |
| MODERN_WEB | Web 開発要素はあるが、Java との関連は弱い |
| WEAK | 開発関連性が弱い |
| NONE | Java / Web 開発との関連性が見えない |

## 技術スタック

- JavaScript
- Chrome Extension Manifest V3
- HTML / CSS
- DOM 操作
- MutationObserver
- chrome.runtime messaging
- chrome.storage.local
- chrome.tabs
- chrome.scripting
- async / await
- 正規表現によるテキスト分析
- 外部情報参照ロジック
- キャッシュ処理
- fallback 処理

## ファイル構成

```text
job-posting-filter-extension
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
└── README.md
