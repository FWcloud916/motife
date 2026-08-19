# Motife — 專案規劃

> AI Agent 自動產 Motion Graphic 系統
>
> - **專案名稱**:Motife(motion + motif)
> - **Repo**:https://github.com/FWcloud916/motife

## 1. 專案定位

一句話:**輸入一段技術概念的描述,自動產出一支專業水準的解說影片(MP4)。**

- 首要場景:技術概念解說(架構圖、資料流、程式碼逐步演示)
- 渲染目標:Phase 0–4 為 Remotion(附帶取得 `@remotion/player` 的網頁內嵌播放能力);**Phase 5 起遷移至自製 Rust 引擎**(2026-08-19 定案,見 §2 決策5 與 §3 Phase 5–7)
- 交付形態(2026-08-19 定案):**單一執行檔的原生應用 + 網頁介面,雙軌並行**,不是 Node 套件
- 核心命題:LLM 不直接生渲染程式碼,而是生成受 schema 約束的語意 DSL,由 compiler 譯成具體 keyframe
- 護城河:手工打造的解說元件庫 + render→critique→revise 的品質迭代迴圈

## 2. 系統架構

```
Prompt(概念描述)
  → LLM 產生 DSL(JSON,structured output,受 JSON Schema 約束)
  → Compiler:DSL → Remotion composition(TypeScript)
  → 解說元件庫(手寫,LLM 只能組合、不能自由繪製)
  → TTS 產旁白音檔 → 音檔長度決定各 step 的 frame 數 + 字幕
  → @remotion/renderer headless 渲染
  → renderStill() 抽關鍵影格 → vision model 檢查 → 修 DSL → re-render
  → MP4 輸出
```

> 上圖是 Phase 0–4 的形態。Phase 5–7 只抽換「Compiler 之後」的那一段(渲染後端與
> 執行環境),`Prompt → LLM → DSL` 這一段的契約完全不動——這正是 §2 決策2 把 DSL
> 保持 renderer-agnostic 換來的東西。

### 分層原則

| 層 | 負責 | 不負責 |
|---|---|---|
| LLM(語意層) | 理解概念、拆解敘事、選元件、寫旁白 | 座標、easing、動畫參數、排版 |
| Compiler(編譯層) | 語意 → 具體 keyframe,內建設計系統 | 內容判斷 |
| 元件庫(呈現層) | 動畫品質的上限與下限 | — |

### 關鍵設計決策(已定)

1. **DSL 用 JSON,不自創語法** — schema 可驗證、LLM structured output 可靠、compiler 錯誤可直接餵回 agent loop
2. **DSL 保持 renderer-agnostic** — schema 中禁止 CSS 概念(無 `className`、`boxShadow`),只用語意欄位(如 `emphasis: "high"`),為未來替換渲染引擎留路
3. **佈局由 ELK/dagre 自動排版** — LLM 只描述拓撲(A→B),不給座標
4. **時間軸由旁白驅動** — 先 TTS、後定 frame 數,不反過來
5. **Rust 化是既定路線,但排在 Phase 4 之後**(2026-08-19 定案,取代原「Phase 5 選配」的表述)— 驅動力有二:**(a) 交付形態**要單一執行檔的原生應用,現行 Node + pnpm + headless Chromium 的安裝負擔(150MB 起跳)與目標交付形態不相容;**(b) 渲染成本與速度**。原本列的第三個觸發條件(把引擎本身當開源產品)不是這次的動機。順序不可調換:Phase 4 的壓測與確定性修復必須先做完,因為那是元件庫最後一次大幅變動的機會——對著還在變動的元件庫重寫渲染器,等於同時追兩個移動目標
6. **網頁介面不因 Rust 化而放棄** — 單一執行檔與網頁介面是雙軌交付,不是二選一。但兩者在 Phase 4 與 Phase 7 是**不同的實作**:Phase 4 的預覽頁建在 `@remotion/player` 上,Phase 6 抽換渲染引擎後即失效;屆時由 Rust 引擎的 WASM build 或原生 HTTP server 重做,繼承的是互動設計而非程式碼

## 3. 分階段路線圖

### Phase 0 — 定錨(約 1 週)

先建立「好」的標準,再寫任何系統程式碼。

- [x] 挑 3 個自己能判斷好壞的概念作為 eval set,建議:JWT 驗證流程、Message Queue 背壓、DB Index 原理
- [x] 純手工用 Remotion 做出其中 1 支目標影片(不用 AI),這支就是品質基準線
- [x] 從手工過程中記錄:實際用到哪些視覺原語?哪些動作重複出現?→ 這份清單就是元件庫的需求規格
- [x] 確認 Remotion 授權條款對未來商用計畫的影響

**出場條件:有一支自己滿意的手工影片,和一份原語清單。**

### Phase 1 — 解說元件庫(約 2–3 週)

把手工影片重構成可參數化的元件。目標 8–10 個:

- [x] `Scene` — 場景容器、轉場
- [x] `Diagram` — 節點 + 連線,ELK 自動排版
- [x] `FlowPulse` — 沿路徑的資料流動畫
- [x] `CodeBlock` — 逐行 highlight / diff 動畫(參考 Motion Canvas 的 API 設計)
- [x] `Terminal` — 指令輸出模擬
- [x] `Camera` — zoom / pan / focus 包裝(參考 Motion Canvas)
- [x] `StepReveal` — 漸進揭露
- [x] `Callout` — 標註、強調
- [x] 設計 token 系統:色彩、字型、間距、easing 全部集中定義,元件不接受任意樣式

**驗收:用元件庫「以手寫 props 的方式」重建 Phase 0 那支影片,品質不輸手工版。** ✅ 已達成 —
`docs/assets/jwt-auth-*-v2.png` 與 v1 逐幀比對通過。

### Phase 2 — DSL + Compiler(約 2 週)

- [x] 定義 JSON Schema:敘事骨架採「引入 → 拆解 → 逐步演示 → 總結」,每個 step 含元件引用、參數、旁白文字
- [x] Compiler:DSL → Remotion composition,含 schema validation 與可讀的錯誤訊息(錯誤訊息品質 = agent 自我修復能力)
- [x] 手寫 3 份 DSL 對應 eval set 的 3 個概念,跑通 DSL → MP4 全流程

**驗收:不碰 TypeScript、只改 JSON 就能產出一支完整影片。** ✅ 已達成 —
`pnpm render:dsl <doc.json> <out.mp4>` 對任意合法 DSL 文件皆可用；三份 eval set
(`jwt-auth.json`、`mq-backpressure.json`、`db-index.json`)皆已跑通 DSL → MP4。
過程中額外發現並補上 4 個 Phase 1 未預期到的原語(`Stack`/`Text`/`Meter`/
`StepSwitch`,見 `docs/primitive-inventory.md`「Phase 2 outcome」)才使既有影片能以
純 JSON 表達；`docs/dsl-schema.md` 為完整規格文件,`src/dsl/`/`src/compiler/`
為實作。手工版 TSX 場景已在 v2/v3 逐幀比對確認零像素差異後刪除。

### Phase 3 — Agent Pipeline(約 2–3 週)

- [x] Prompt → DSL:system prompt + schema + few-shot(用 Phase 2 手寫的 DSL 當範例)
- [x] TTS 整合:旁白音檔 → step 時長 → 字幕軌
- [x] Critique loop:renderStill 抽每個 step 的關鍵影格 → vision model 檢查(重疊?溢出?節奏?)→ 產生 DSL 修改 → re-render,設最大迭代次數
- [x] Compiler 錯誤自動回饋:validation 失敗時把錯誤訊息餵回 LLM retry
- [x] 對 eval set 3 個概念全自動跑一輪,人工評分

**驗收:一句 prompt 進、一支及格的 MP4 出,全程無人工介入。** ✅ 已達成 —
2026-08-15 `pnpm motife eval`(generation: claude-sonnet-5、TTS: OpenAI)3/3 概念
全自動出片、零人工介入;人工評分全數通過及格線(每項 ≥3、無 1 分):
jwt-auth 5/4/4/3、mq-backpressure 5/3/4/3、db-index 5/3/4/3。三個 DSL 皆一次
生成即通過驗證(retry loop 未動用);jwt-auth 與 mq-backpressure 首輪 critique
即 clean,db-index 用盡 2 輪修訂預算仍出片。評分記錄的失敗模式(→ Phase 4
確定性修復佇列):
1. Diagram 節點卡片過大遭畫面裁切(critique 有抓到但 LLM 改 DSL 救不了)
2. Camera 運鏡超出畫面範圍
3. TTS 中文旁白口音重(OpenAI alloy — 換 voice/model 或 ElevenLabs)

### Phase 4 — 打磨與發布(約 2 週)

- [ ] 用 10+ 個新概念(不在 eval set 內)壓力測試,收集失敗模式
- [ ] 針對高頻失敗模式:優先改 compiler 與元件(確定性修復),其次改 prompt
- [ ] `@remotion/player` 網頁預覽頁面:輸入 prompt → 線上預覽 → 下載 MP4
- [ ] 決定發布形式:開源工具 / demo 網站 / 內容創作自用,三者不衝突但決定投入順序

**驗收:**
1. baseline 3 概念重跑 `pnpm motife eval`,人工評分每項 ≥3 且版面品質 ≥4,備註欄不再出現 Phase 3 記錄的三個已知失敗模式(裁切/運鏡超出範圍/口音重);
2. ≥10 個非 eval set 概念壓測,≥8 支全自動產出及格 MP4(每項 ≥3、無 1 分),其餘失敗模式已歸檔並排入下一輪確定性修復佇列;
3. `@remotion/player` 預覽頁本機端到端可用:prompt 輸入 → 線上預覽(TTS 時間軸驅動)→ 下載 MP4;
4. 發布形式決策已記錄於本文件。

執行細節與 PR 拆解見 `progress/2026-08-17-phase-4-polish-and-publish/`。

> **Rust 化定案帶來的範圍調整(2026-08-19):** PR 7 的 `@remotion/player` 預覽頁
> 有已知的退場時程——Phase 6 抽換渲染引擎後它就失效。它仍然要做(是上方驗收條件
> 第 3 項,也是唯一能在 Rust 化之前驗證「prompt → 預覽 → 下載」互動設計的方式),
> 但**刻意做薄**:不建大型前端,把結論留給 Phase 7 繼承。

### Phase 5 — Pipeline Rust 化(不碰渲染,約 3–4 週)

**前置條件:Phase 4 全部驗收通過。**

先搬不依賴瀏覽器的那一半。以 2026-08-19 的實際程式碼量估算:`src/agent`(3,044)、
`src/dsl`(1,028)、`src/tts`(586)、`src/critique`(543)、`src/compiler` 扣掉
`render/`(約 2,083),合計約 **7,280 行、佔全部 TypeScript 的 63%**,且沒有一行
需要瀏覽器。這一段是翻譯級工作,零視覺風險,先做完可以在動渲染器之前就驗證
Rust 側的可行性。

- [ ] DSL schema:zod → `serde` + `schemars`(由 `schemars` 產 JSON Schema 餵給 LLM,取代 `z.toJSONSchema()`)
- [ ] `parse.rs` / `validate.rs`(850 行跨引用檢查)/ `windows.rs` / `errors.rs`:`DslIssue` 的 24 個 code、`path`/`message`/`fix` 三欄格式**逐字保留**——那是 agent retry loop 的契約,不是內部細節
- [ ] LLM client:Vercel AI SDK → `reqwest` + `tokio`,五家 provider 的 `LlmClient` 介面對等
- [ ] TTS:兩家 provider 仍是純 HTTP 呼叫;時長量測 `music-metadata` → `symphonia`
- [ ] critique:影格挑選與報告產生搬過去,`renderStill` 這一步仍呼叫 Remotion
- [ ] 渲染仍走現有的 Remotion(`render-dsl.mjs` 路徑),以 subprocess 呼叫,輸出行為零變化

**出場條件:`motife` 是一個 Rust 執行檔,對 3 支 eval set 跑 `motife eval` 產出的
`doc.json` 與 `report.md` 與 TypeScript 版逐位元相同(影片仍由 Remotion 渲染)。**

### Phase 6 — Rust 渲染引擎(約 8–12 週,本專案最大的單一風險)

**前置條件:Phase 5 出場。**

剩下約 **4,300 行**(`src/components` 3,268、`src/compiler/render` 約 400、
`src/remotion` 628)全部綁瀏覽器。實測依賴:flexbox 46 處、SVG 19 處、CSS grid
9 處、漸層 5 處、blur/filter 4 處、`measureText` 4 處(用於依真實文字寬度決定
diagram 卡片大小)。這不是移植,是**重新設計並實作**——Remotion 授權禁止移植或
改作其原始碼來製作衍生渲染器,因此必須是對著 DSL spec 的 clean-room 實作,不得
參考 Remotion 原始碼。

- [ ] **先做 spike 再做工程**:用 `text`/`stack`/`diagram` 三個節點渲染單張靜態圖,與 `renderStill()` 輸出並排比對 CJK 排版——一週內把最大的未知量出來,再決定後續投入
- [ ] 技術路線:`vello` 或 `skia-safe` 繪製、`resvg` 處理 SVG、`taffy` 排版、`cosmic-text`/`parley` 文字與 CJK 字體 fallback、pipe raw frames 給 FFmpeg
- [ ] 範圍:只實作 DSL 的封閉原語集合(14 種節點 + 設計 token),不做通用渲染
- [ ] 遷移驗證:與 Remotion 輸出做 golden test 逐原語比對;既有的 frame pin 與 eval set 就是現成的比對基礎設施,不必另建
- [ ] Remotion 版保留為參考實作與 golden reference,直到 Phase 7 出場才退役
- [ ] 先研究 Software Mansion 的 Smelter 作為先行案例

**出場條件:3 支 eval set 影片由 Rust 引擎產出,與 Remotion 版逐原語 golden test
通過,且 CJK 排版品質經人工評分不低於 Remotion 版。**

### Phase 7 — 單一執行檔 + 網頁介面(約 3–4 週)

**前置條件:Phase 6 出場。**

- [ ] 單一執行檔打包:FFmpeg 的處理方式(靜態連結 / 內嵌 / 要求系統安裝)是本階段第一個要定的技術決策;CJK 字體必須內嵌,不能假設系統有
- [ ] 跨平台 build:macOS / Linux / Windows
- [ ] 網頁介面重做,兩案擇一:Rust 引擎的 **WASM build**(瀏覽器端即時預覽)或**原生 HTTP server**(伺服器端串影格)。決策點是 WASM 能不能帶得動 CJK 字體與 `cosmic-text` 的體積
- [ ] 沿用 Phase 4 預覽頁驗證過的互動設計(prompt → 預覽 → 下載),介面不重新設計

**出場條件:一個不需要 Node、不需要 Chromium 的執行檔,能從 prompt 產出 MP4;
同一份引擎驅動的網頁介面可線上預覽並下載。**

## 4. 風險與對策

| 風險 | 對策 |
|---|---|
| LLM 產的 DSL 品質不穩 | schema 收緊參數空間;compiler 錯誤訊息餵回 retry;few-shot 用真實好範例 |
| 動畫「能動但很醜」 | 品質責任放在元件庫與設計 token,不放在 LLM;critique loop 抓排版問題 |
| 文字/CJK 排版問題 | Phase 0–4 由瀏覽器排版引擎吃掉(這正是不先做 Rust 的主因);**Phase 6 會把這個風險拿回來,是整個 Rust 化最大的技術風險**——對策:先做一週 spike 量測,並用 Phase 0–4 的 Remotion 輸出當 golden reference 逐幀比對 |
| 範圍蔓延回多 target | Phase 4 驗收前仍明確不做第二個 target;Phase 5 起兩個 target 刻意並存,但僅限 Phase 6 遷移期,Remotion 版的角色是 golden reference,Phase 7 出場後退役 |
| Remotion 授權 | Phase 0 就確認條款;Phase 6 的自製引擎**必須是 clean-room 實作**(不得移植或參考 Remotion 原始碼),這是授權要求而非風格選擇 |
| Rust 重寫拖垮產品迭代 | 拆成 Phase 5(純邏輯 63%,零視覺風險)與 Phase 6(渲染 37%)兩段,而非一次重寫;任何時間點 Remotion 版都還能出片,重寫受挫不會讓專案沒有可用版本 |
| Phase 4 預覽頁做白工 | 已知 PR 7 的 `@remotion/player` 頁在 Phase 6 後失效——對策是刻意做薄,只用來驗證互動設計,Phase 7 繼承結論而非程式碼 |
| 越改越爛 | eval set 全量回歸:每次改 schema / 元件 / prompt 都重跑 3 支基準影片;Phase 6 起同一組 eval set 兼任跨引擎 golden test |

## 5. 里程碑總覽

| 里程碑 | 產出 | 累計時間(粗估) |
|---|---|---|
| M0 | 1 支手工基準影片 + 原語清單 | 1 週 |
| M1 | 元件庫重建基準影片 | 3–4 週 |
| M2 | JSON DSL → MP4 全流程 | 5–6 週 |
| M3 | Prompt → MP4 全自動 | 7–9 週 |
| M4 | 對外可展示(預覽頁 + 10 概念壓測) | 9–11 週 |
| M5 | Rust pipeline(渲染仍為 Remotion) | 12–15 週 |
| M6 | Rust 渲染引擎通過 golden test | 20–27 週 |
| M7 | 單一執行檔 + 網頁介面 | 23–31 週 |

> 時程以 side project 節奏(每週 8–12 小時)粗估,重點是階段順序與出場條件,不是死線。
> M5–M7 的估算比 M0–M4 更粗——M6 的實際成本高度取決於 Phase 6 那支 CJK spike 的結果。

## 6. 立即下一步

Phase 0/1/2/3 皆已完成並驗收(見上方各 Phase 勾選項與驗收說明)。
**Phase 4 進行中**:PR 0–4 已合併([#12](https://github.com/FWcloud916/motife/pull/12)–[#16](https://github.com/FWcloud916/motife/pull/16)),
Phase 3 記錄的三個失敗模式(Diagram 溢出裁切、Camera 運鏡超出範圍、TTS 中文口音)
**全部修完**。完整 8-PR 拆解與逐項狀態見
`progress/2026-08-17-phase-4-polish-and-publish/PROGRESS.md`。

剩餘工作,依序:

1. **PR 5 — 10+ 個新概念壓測**(下一個未開始的項目):`stressConcepts.ts` + `eval --set stress`
2. PR 6 — 第二輪確定性修復,依壓測發現的失敗模式(元件/compiler 優先,prompt 其次)
3. PR 7 — `@remotion/player` 預覽頁,**刻意做薄**(見 Phase 4 的範圍調整註)
4. PR 8 — 發布形式決策 + 文件收尾

Phase 4 全部驗收通過後才進 Phase 5(Rust 化),順序不可調換——理由見 §2 決策5。
