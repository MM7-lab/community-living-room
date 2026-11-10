# 社區客廳 3D 導覽地圖

街坊用手機掃 QR code，就睇到社區客廳有咩設施、喺邊度、點樣用。唔使登入，只可以睇，唔可以改。

- **3D 地圖**：撳彩色圖示睇設施資料卡（名稱、簡介、開放時間、預約方法、相片）
- **自動導覽**：由入口開始，鏡頭逐個設施飛過去，配文字介紹；可以暫停、上一個、跳過
- **漫遊**：好似自己行入去。手機用畫面上嘅掣，電腦用 W A S D 同方向鍵；撞牆會停
- **平面圖**：由上面望落嚟嘅 2D 圖，位置同 3D 一樣
- **設施**：所有設施一覽，3D 開唔到嘅舊手機都睇到

平面圖同 3D 做法都係用「新辦公室平面圖」工具嘅內容同技術（three.js r128）。

---

## 網址同 QR code

開通 GitHub Pages 之後（步驟見下面），網址係：

**https://mm7-lab.github.io/community-living-room/**

QR code 圖檔：[`assets/qr-code.png`](assets/qr-code.png)（印刷用）、[`assets/qr-code.svg`](assets/qr-code.svg)（放大唔會矇）。
> QR code 要等 GitHub Pages 開通咗先掃得到。印之前請用手機試掃一次。

## 開通 GitHub Pages（只需要做一次）

1. 將呢個分支合併入 `main`（或者喺 GitHub 開 Pull Request 再 merge）。
2. 去 repo 嘅 **Settings → Pages**。
3. **Source** 揀「Deploy from a branch」，**Branch** 揀 `main`，資料夾揀 `/ (root)`，撳 **Save**。
4. 等一兩分鐘，頁面上面會顯示網址。

> GitHub 介面間中會改版，如果搵唔到上面嘅字眼，以 GitHub 官方說明為準：
> https://docs.github.com/pages/getting-started-with-github-pages

---

## 點樣改資料（唔使掂程式）

所有設施資料都喺 **[`data/center.json`](data/center.json)**。喺 GitHub 網頁撳個檔 → 鉛筆圖示 → 改完撳 **Commit changes** 就得。

| 欄位 | 意思 | 例子 |
|---|---|---|
| `center.name` | 網頁標題（中心名稱） | `"賽馬會「聚首壹塘」社區客廳"` |
| `center.subtitle` | 標題下面細字 | `"3D 導覽地圖"` |
| `center.address` / `center.phone` | 地址、查詢電話（留空就唔顯示） | `"2xxx xxxx"` |
| `facilities` | 設施清單，**排列次序 = 自動導覽次序**（第一個應該係入口） | |
| `id` | 英文代號，唔可以重複 | `"kitchen"` |
| `name` / `icon` | 名稱、圖示（emoji） | `"社區廚房"` / `"🍳"` |
| `summary` | 一兩句簡介 | `"共享備餐及煮食空間。"` |
| `hours` / `booking` | 開放時間、預約方法（留空會顯示「資料稍後補上」） | `"星期一至五 10:00–18:00"` |
| `photo` | 相片路徑（見下面「加相片」） | `"photos/kitchen.jpg"` |
| `tour` | 導覽時讀嘅介紹（留空就用 `summary`） | |
| `staffOnly` | 職員專用就寫 `true`，會顯示標籤 | `true` |
| `tentative` | 位置未確認就寫 `true`，資料卡會顯示「位置暫定」；確認之後刪除呢行 | `true` |
| `at` | 設施位置 `[x, y]`，單位 cm | `[909, 604]` |
| `area` | （可選）設施範圍，最少 3 個角 | `[[0,1292],[900,1292],[900,1555]]` |

**位置點樣搵？** 喺「新辦公室平面圖」工具揀一件傢俬，右邊會顯示 X、Y（cm），照抄落 `at` 就得。座標同工具完全一樣。

**改完記得**：JSON 格式好嚴格，最常見錯誤係漏咗或者多咗逗號。GitHub 會自動檢查（見 Actions 頁），有錯會用中文講邊行出事；網頁亦會顯示錯誤，唔會靜靜雞壞咗。

全部設施都填齊簡介同開放時間（或者預約方法），而且冇「位置暫定」之後，頂部嘅「試行版」橫額會自動消失。

## 更新平面圖

平面圖喺 [`data/plan.json`](data/plan.json)，格式同「新辦公室平面圖」工具嘅**備份**檔一樣。辦公室佈置改咗嘅話：

1. 喺辦公室工具撳「備份」，下載 JSON 檔。
2. 喺電腦跑：`node tools/import-office-plan.mjs 備份檔.json`（會自動刪除所有標籤，因為標籤可能有同事名）。
3. 上載新嘅 `data/plan.json`。

> ⚠️ 唔好直接將備份檔改名上載：備份檔入面有同事名（例如工作位標籤），而呢個 repo 係公開嘅。GitHub 自動檢查見到標籤會報錯。

## 加相片

1. 將相放入 [`photos/`](photos/) 資料夾，例如 `photos/pantry.jpg`。
2. 喺 `center.json` 對應設施填 `"photo": "photos/pantry.jpg"`。

私隱同大細要求：

- **唔可以有認得出樣嘅人**，亦唔好影到街坊或者同事嘅名、電話、文件。
- 手機相通常有 **GPS 位置資料**，上載前請刪除（iPhone：分享時撳「選項」關閉「位置」；Android／Windows：相片內容 → 移除個人資料）。
- 建議闊 1200 像素以內、每張 300 KB 以下，手機開得快啲。

---

## 已知限制

- 3D 程式庫要上網由 jsdelivr 載入，**離線開唔到 3D**；平面圖同設施列表照用得。
- 好舊嘅手機（大約 2020 年前、iOS 14 以下）可能顯示唔到 3D，會自動提示改睇平面圖。
- 平面圖尺寸來自大廈圖則量度，約有 ±5% 誤差，只供參考。

## 檔案結構

```
index.html            網頁
css/style.css         樣式（暖色、大字、圓角）
js/app.js             功能切換、資料卡、導覽字卡
js/view3d.js          3D 模型、導覽、漫遊（three.js r128）
js/plan2d.js          2D 平面圖
js/plan-model.js      平面圖計算、碰撞、資料檢查（瀏覽器同 node 共用）
data/center.json      ★ 中心同設施資料（日常只改呢個）
data/plan.json        平面圖（由辦公室工具匯入）
photos/               設施相片
assets/qr-code.*      QR code
tools/                匯入平面圖、檢查資料、產生 QR code
tests/                自動測試
```

## 開發者：測試

```bash
npm install
```

```bash
npm run check
```

```bash
npm test
```

```bash
npm run e2e
```

`npm run e2e` 用手機尺寸開網頁，逐項檢查驗收標準（3D 載入、每個設施撳得到、導覽次序同暫停／跳過、漫遊唔穿牆、2D／3D 位置一致、字體大小、冇簡體字、冇同事名），截圖放喺 `test-output/`。
