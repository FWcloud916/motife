# Motife — 專案規劃

> AI Agent 自動產 Motion Graphic 系統
>
> - **專案名稱**:Motife(motion + motif)
> - **Repo**:https://github.com/FWcloud916/motife

## 1. 專案定位

一句話:**輸入一段技術概念的描述,自動產出一支專業水準的解說影片(MP4)。**

- 首要場景:技術概念解說(架構圖、資料流、程式碼逐步演示)
- 單一渲染目標:Remotion(附帶取得 `@remotion/player` 的網頁內嵌播放能力)
- 核心命題:LLM 不直接生渲染程式碼,而是生成受 schema 約束的語意 DSL,由 compiler 譯成 Remotion composition
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
5. **Rust 自製渲染引擎不是現在的事** — 屬 Phase 5 優化選項,前提是產品驗證成立且渲染成本/速度成為瓶頸

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

### Phase 5(選配)— Rust 渲染引擎

**觸發條件(至少滿足一項才啟動):**產品驗證成立且渲染成本成為營運瓶頸;或渲染速度成為使用者體驗瓶頸;或決定將引擎本身作為開源產品。

- 技術路線:`vello` 或 `skia-safe` 渲染、`resvg` 處理 SVG、`taffy` 排版、`cosmic-text`/`parley` 文字、pipe raw frames 給 FFmpeg
- 範圍:只實作 DSL 的封閉原語集合,不做通用渲染
- 遷移方式:與 Remotion 輸出做 golden test 逐原語比對,Remotion 版保留為參考實作
- 先研究 Software Mansion 的 Smelter 作為先行案例

## 4. 風險與對策

| 風險 | 對策 |
|---|---|
| LLM 產的 DSL 品質不穩 | schema 收緊參數空間;compiler 錯誤訊息餵回 retry;few-shot 用真實好範例 |
| 動畫「能動但很醜」 | 品質責任放在元件庫與設計 token,不放在 LLM;critique loop 抓排版問題 |
| 文字/CJK 排版問題 | Remotion 階段由瀏覽器排版引擎吃掉此風險(這正是不先做 Rust 的主因) |
| 範圍蔓延回多 target | DSL renderer-agnostic 已留路;在驗證成立前明確不做第二個 target |
| Remotion 授權 | Phase 0 就確認條款;若商用受限,Phase 5 的自製引擎是備案 |
| 越改越爛 | eval set 全量回歸:每次改 schema / 元件 / prompt 都重跑 3 支基準影片 |

## 5. 里程碑總覽

| 里程碑 | 產出 | 累計時間(粗估) |
|---|---|---|
| M0 | 1 支手工基準影片 + 原語清單 | 1 週 |
| M1 | 元件庫重建基準影片 | 3–4 週 |
| M2 | JSON DSL → MP4 全流程 | 5–6 週 |
| M3 | Prompt → MP4 全自動 | 7–9 週 |
| M4 | 對外可展示(預覽頁 + 10 概念壓測) | 9–11 週 |

> 時程以 side project 節奏(每週 8–12 小時)粗估,重點是階段順序與出場條件,不是死線。

## 6. 立即下一步

Phase 0/1/2/3 皆已完成並驗收(見上方各 Phase 勾選項與驗收說明)。下一步是
Phase 4 — 打磨與發布,優先順序依驗收記錄的失敗模式:

1. **確定性修復三個已知失敗模式**(改元件/compiler,不改 prompt):
   Diagram 節點卡片溢出畫面(db-index critique 循環無法收斂的主因)、
   Camera 運鏡超出範圍、TTS 中文旁白口音(評估 OpenAI 其他 voice/model
   與 ElevenLabs)
2. 用 10+ 個新概念(不在 eval set 內)壓力測試,收集更多失敗模式
3. `@remotion/player` 網頁預覽頁(prompt → 線上預覽 → 下載 MP4)
4. 決定發布形式(開源工具 / demo 網站 / 內容創作自用)
