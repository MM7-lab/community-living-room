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

## 平面圖同樓梯

兩層平面圖按**竣工平面圖（As-fitted Layout Plan，Yuen Fat，2024-06-27，1:100）**描繪：`data/plan.json`（地下）、`data/plan-1f.json`（一樓）。坐標單位 cm，x = 0 係 E 軸線，y = 0 係後牆內面，向大門口方向增加；描圖誤差大約 ±10 cm。

地下廚房外面（遊戲區、用餐區、休閒區、接待處、咖啡角、按摩及健身區、健康站、大門口入地下嗰道門）就按 **2026 年 8 月嘅新設計圖（1:100）**描繪；大廳（大電視、休閒區、用餐區、綠色拱門屏風、吸音板、黑色格柵天花同圓形吊燈）再按 2026 年 11 月嘅現場相片調整。新設計圖同竣工圖嘅比例對唔齊（大約差 5%），所以呢部分誤差大約 ±20 cm。

> 暫時唔好喺網頁或者資料檔寫中心所在地區名，亦唔好加任何標誌；`npm run check` 同 `npm run e2e` 會檢查。

- 所有牆、門、窗、柱同固定傢俬都寫喺 `tools/trace-floor-plan.py`。要改平面圖，改呢個檔再跑 `python3 tools/trace-floor-plan.py`，唔好直接改兩個 JSON。
- 每個設施用 `"floor": "G"` 或者 `"1F"` 講明喺邊層；`"floor": "all"` 即係兩層都見到（樓梯）。
- 樓梯係直樓梯，喺 `center.json` 嘅樓梯設施設定：

```json
"stairs": {"w": 125, "run": 490, "risers": 20, "r": 0, "well": 415, "topExit": "left", "bottomExit": "left"}
```

`w` 闊、`run` 長（cm），`risers` 級數，`r` 方向（0 = 樓梯底向大門口），`well` 一樓樓梯井長度，`topExit`／`bottomExit` 係上落之後面向邊面。漫遊時行入樓梯口會自動上落樓。
- 層高未知，暫時當 350 cm（20 級 × 17.5 cm）。
- 圖則上嘅地台高低（斜台、DN 2R 級）冇做出嚟，3D 入面當平地。

## 設施傢俬

每個設施可以有自己嘅傢俬（`furniture`），會喺 3D、2D 平面圖同小地圖出現，漫遊時亦會擋路。位置用**相對設施位置（`at`）**嘅距離表示，所以改設施 `at`，傢俬會成組跟住搬。

```json
"furniture": [
  {"type": "laundry_tower", "dx": -137, "dy": 89, "r": 180},
  {"type": "folding_table", "dx": 143, "dy": -44, "r": 90}
]
```

| 欄位 | 意思 |
|---|---|
| `type` | 傢俬類型（見下表） |
| `dx` / `dy` | 離設施位置幾遠（cm）：`dx` 正數向右，`dy` 正數向下（同平面圖一樣） |
| `r` | 轉幾多度（順時針）。0 = 正面向下，90 = 向左，180 = 向上，270 = 向右 |
| `w` / `d` / `ht` | （可選）闊、深、高（cm），唔填就用預設尺寸 |

| 類型 | 傢俬 | 預設尺寸（闊×深×高 cm） |
|---|---|---|
| `coffee_bar` | 咖啡吧枱（連咖啡機） | 160×60×95 |
| `bar_stool` | 高腳凳 | 40×40×75 |
| `kitchen_counter` | 廚房工作枱（連盆同電磁爐） | 150×60×90 |
| `fridge` | 雪櫃 | 60×65×175 |
| `sofa` | 梳化 | 200×85×85 |
| `coffee_table` | 茶几 | 100×50×42 |
| `tv_cabinet` | 電視櫃 | 160×40×50 |
| `massage_chair` | 按摩椅 | 80×130×115 |
| `treadmill` | 跑步機 | 80×180×140 |
| `exercise_bike` | 健身單車 | 55×100×120 |
| `gym_mat` | 運動墊 | 180×60×2 |
| `bookshelf` | 書櫃 | 90×35×180 |
| `reading_table` | 圓形閱讀枱 | 90×90×75 |
| `play_mat` | 兒童遊戲地墊（連玩具） | 220×170×3 |
| `toy_shelf` | 玩具櫃 | 120×35×75 |
| `kids_table` / `kids_stool` | 兒童枱／兒童凳 | 80×60×50 ／ 30×30×30 |
| `laundry_tower` | 洗衣機＋乾衣機（上下疊） | 60×65×172 |
| `folding_table` | 摺衫枱 | 120×60×80 |
| `armchair` | 單人梳化 | 75×75×80 |
| `rug` | 地氈 | 290×200×1 |
| `play_tunnel` | 遊戲隧道 | 60×185×60 |
| `health_kiosk` | 健康站（量度機） | 100×60×130 |
| `dining_table` | 木餐枱 | 165×85×75 |
| `arch_partition` | 綠色拱門屏風（有圓窿） | 200×12×255 |
| `handrail` / `platform` | 不鏽鋼扶手／兩級台階（3D 當平地行） | 110×6×95 ／ 120×150×29 |

以下係**裝飾**，唔會擋路、唔檢查撞位：`upper_cabinet`（吊櫃，離地 150 cm）、`ring_light`（圓形吊燈）、`baffle_ceiling`（黑色格柵天花）、`acoustic_green` / `acoustic_blue`（吸音板）、`kiosk_wall`（木牆身自助服務機）。吊燈同天花淨係「完整牆身」或者漫遊先見到。
| `chair` | 椅（同辦公室工具一樣） | 50×50×90 |

尺寸係常見款式嘅大約數，唔係實物量度；有實物尺寸就填 `w`／`d`／`ht`。`npm run check`（同 GitHub 自動檢查）會提示傢俬撞牆、出咗平面圖、疊埋或者擋住門口（擺喺地墊、地氈上面唔當疊埋）。

## 更新平面圖

平面圖而家按竣工圖則描繪（見上面「平面圖同樓梯」）。現場有改動（例如搬咗傢俬、加咗間隔）：

1. 改 `tools/trace-floor-plan.py` 入面對應嗰行（每行一幅牆、一道門或者一件傢俬，坐標單位 cm）。
2. 跑 `python3 tools/trace-floor-plan.py`，會重新生成兩層嘅 JSON。
3. 跑 `npm run check` 同 `npm test`，確認冇撞牆、冇擋門、每個設施都行得到。

> 舊版用過「新辦公室平面圖」工具匯出嘅平面圖；`tools/import-office-plan.mjs` 保留，但而家已經唔用。

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
data/plan.json        地下平面圖（按竣工圖則描繪）
data/plan-1f.json     一樓平面圖（按竣工圖則描繪）
tools/trace-floor-plan.py  描圖坐標（改平面圖改呢度）
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
