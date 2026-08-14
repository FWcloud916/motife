# Phase 3 — Agent Pipeline 實作計畫

## Context

Phase 0/1/2 已完成並驗收(Phase 2 PR #9 已 merge;`progress/INDEX.md` 仍標 `review`,順手改 `done`)。依 motife-plan.md §3,本階段目標:**一句 prompt 進、一支及格 MP4 出,全程無人工介入** — Prompt→DSL、TTS 時間軸、compiler 錯誤自動回饋、critique loop、eval set 全自動跑一輪。

Phase 2 已刻意留好三個接口,只需接線、不需重造:
- **錯誤回饋**:`parseDocument()` + `formatIssues()`([src/compiler/parse.ts](src/compiler/parse.ts)、[errors.ts](src/compiler/errors.ts))— 20 個 issue code,path/message/fix 純文字輸出,本來就是為 LLM retry 設計。
- **渲染**:`DslPreview` composition + `scripts/render-dsl.mjs` 的 bundle→selectComposition→renderMedia 流程。
- **抽影格**:`scripts/smoke.mjs` 的 renderStill 管線 + `dslTimeline()` 提供每 scene 真實絕對 frame 位置。

## 使用者已定決策

1. **LLM 多供應商**:Claude / OpenAI / Grok (xAI) / Gemini / Groq 全支援;另加 **skill 模式** — coding agent 自己扮演語意層(寫 DSL → validate CLI → TTS → render → 自己看 stills 修 DSL),不經 LLM API。
2. **TTS**:OpenAI TTS 與 ElevenLabs 皆支援、可切換。
3. **交付**:單一大 PR(branch `phase-3-agent-pipeline` → main)。

## 核心設計決策

### D1 — LLM 抽象:Vercel AI SDK,封在單一檔案後面
- 依賴:`ai` + `@ai-sdk/anthropic|openai|google|xai|groq`(save-exact 自動釘版;安裝時確認 zod 4.4.3 peer 相容)。
- 全部 AI SDK 用法只出現在 `src/agent/llm.ts`:`LlmClient { complete({messages}) → {text} }`,訊息支援 text + image parts(vision critique 共用)。測試用 `FakeLlmClient`;skill 模式完全不用 client。
- 供應商/模型選擇:flag > env(`MOTIFE_PROVIDER`/`MOTIFE_MODEL`)> `src/agent/providers.ts` 預設表。

### D2 — TS 執行:tsx + 單一 CLI 入口
- devDep 加 `tsx`;package.json 加 `"motife": "node --env-file-if-exists=.env --import tsx src/agent/cli.ts"`(Node 22 原生 env-file,不加 dotenv)。
- pipeline 程式碼放 `src/agent/`、`src/tts/`、`src/critique/`(docs/project-overview.md §4 已預留的名字)→ typecheck/lint/vitest 免費覆蓋。**不建 `src/index.ts`**(會遮蔽 Remotion 入口)。
- `scripts/*.mjs` 不動,仍是 verify gate;CLI 用 `node:util` parseArgs,不加 commander。

### D3 — Pipeline 架構:stage = CLI 子命令,run 目錄 = 合約
`out/runs/<slug>/`:`prompt.txt`、`attempts/`(retry 歷史)、`doc.json`(定稿 DSL)、`public/audio/<sceneId>.mp3`、`audio-manifest.json`、`doc.tts.json`(回填時長的衍生檔)、`iterations/iter-N/`(video.mp4、stills/、critique.json/md)、`final.mp4`、`report.md`。

| 子命令 | 需要 key | 功能 |
|---|---|---|
| `motife generate --prompt … [--provider --model --lang]` | LLM | prompt → 驗證通過的 doc.json(formatIssues retry loop) |
| `motife validate <doc.json>` | 無 | parseDocument + formatIssues,exit 0/1 |
| `motife tts <doc.json> --run DIR [--tts openai\|elevenlabs --voice]` | TTS | 每 scene 音檔 + manifest + doc.tts.json |
| `motife render <doc.tts.json> --run DIR` | 無 | bundle(publicDir=run/public) → 含音訊 MP4 |
| `motife stills <doc.tts.json> --run DIR` | 無 | dslTimeline 取關鍵影格,印路徑(skill 模式自己看) |
| `motife critique --run DIR --iter N [--critique-provider]` | LLM(vision) | stills → critique.json |
| `motife revise --run DIR --iter N` | LLM | critique + DSL → 修訂版 doc.json |
| `motife run --prompt …` | LLM | 全流程編排,有界迭代 |
| `motife eval` | LLM | 3 個 eval 概念全自動 + 評分報告 |

### D4 — Prompt→DSL
- System prompt 執行期組裝(`src/agent/prompt.ts`):docs/dsl-schema.md 全文 + `z.toJSONSchema(dslDocumentSchema)` + 3 份 eval doc few-shot + 任務框架(四拍敘事、語言、「只輸出 JSON」)。
- Structured output 策略:**文字 JSON + 本地 parseDocument 驗證**,不用供應商 strict schema mode(遞迴 $ref 在部分供應商受限;parseDocument 的語意檢查本來就比 schema mode 強;唯一五家通吃的做法)。
- Retry loop(`src/agent/generate.ts`):去 code fence → JSON.parse(失敗轉合成 issue)→ parseDocument → 失敗把 `formatIssues()` 全文餵回,**最多 4 次**,歷史存 `attempts/`。warning 不觸發 retry(帶進 critique context)。
- `--lang` 預設 `zh-TW`(對齊 eval set 與 8 chars/sec 中文 pacing validator)。
- **時間模型維持 per-scene**:WindowRef 分數推導本就設計成只改 `durationInSeconds` 即可整體縮放,不新增 per-step 時間表示。

### D5 — TTS
- `src/tts/provider.ts` 介面 + `openai.ts`(`gpt-4o-mini-tts`)/`elevenlabs.ts`(`eleven_multilingual_v2`)— 各一個 REST call,純 fetch 不加 SDK。
- 時長量測:`music-metadata`(純 JS;`@remotion/media-utils` 是 browser-only,ffprobe 未公開)。
- 回填(`src/tts/backfill.ts`):操作**原始 JSON**(不 mutate DslDocument,維持 parse-only 鐵律),`durationInSeconds = lead(0.3) + audio + tail(0.7)`,輸出再過一次 parseDocument。
- 快取:manifest 記 `narrationHash`(narration+voice+provider 的 sha256),hash 相同跳過合成 → revision loop 只重合成有改的 scene。
- **音訊走 sidecar manifest(inputProps),不進 DSL schema**:mp3 路徑是 asset binding 不是語意,進 schema 會破壞 renderer-agnostic 鐵律。具體改動:
  - `DslVideoProps` 加 `audio?: DslAudioManifest`;[DslVideo.tsx](src/compiler/render/DslVideo.tsx) 每 scene wrapper 內掛 `<Audio src={staticFile(…)}>`(**必須 import 自 `@remotion/media`**,以 `npx remotion add media` 安裝)。
  - [Root.tsx:84](src/remotion/Root.tsx:84) `props: { doc }` → `props: { ...props, doc }`(已驗證:現狀會把 audio manifest 丟掉)。
  - render stage 對 `bundle()` 傳 `publicDir: <runDir>/public`,repo 的 `public/` 不落地任何音檔。
- 字幕:既有 caption band 已顯示 narration,Phase 3 夠用;word-level 字幕(@remotion/captions)明文延後 Phase 4。
- **FRAME_PINS 衝突解法:checked-in eval docs 永不被 TTS 改寫**(它們是 few-shot + 回歸基準);`doc.tts.json` 只存在 run 目錄。pins 本 PR 不動。

### D6 — Critique loop
- 影格選取(`src/critique/frames.ts`,純函式):由 `dslTimeline()` 每 scene 取 early/mid/late 三張,4 scene = 12 張/迭代;`scale: 0.5`(960×540 jpeg)控 vision token 成本。
- Vision prompt:12 張圖 + 每 scene 的 narration/caption/內容摘要,檢查重疊、溢出、出界、對比、大面積空白、caption 截斷、節奏;輸出 zod 驗證的 JSON issues(同 D4 的文字 JSON + 一次修復 retry)。
- 修訂(`src/agent/revise.ts`):DSL + critique.md → 「輸出完整修正文件」→ 同 parseDocument retry loop → hash 判斷重 TTS → 重 render。
- 上限:**最多 2 輪修訂(≤3 次 render)**;critique 零 error 級 issue 即提前停。`--critique-provider` 獨立於生成供應商(預設 anthropic,vision 能力保證)。

### D7 — Eval runner
`motife eval`:3 個概念(JWT / MQ 背壓 / DB index,只放 prompt 描述、不是手寫 doc)循序全流程跑進 `out/eval/<date>/<concept>/`,產 `report.md`:每概念的 mp4、generate 嘗試次數、critique 迭代摘要、stills、耗時、空白人工評分表(內容正確性/版面/節奏/旁白,1–5)。

### D8 — Skill 模式
`.claude/skills/motife-generate/SKILL.md`:agent 即語意層 + vision critic — 讀 dsl-schema.md 與範例 → 寫 `doc.json` → `pnpm motife validate` 修到乾淨 → `tts`(仍需 TTS key;`--no-audio` 逃生口用估算時長)→ `render` → `stills` → 自己看圖套 D6 檢查表改 DSL → 最多 2 輪。鐵律:不繞過 parseDocument、不改 checked-in eval docs。

### D9 — 測試策略(無 key 時 `pnpm verify` 保持綠)
prompt 組裝、FakeLlmClient 驅動的 retry loop(斷言 formatIssues 全文進第二次呼叫)、backfill 數學、manifest hash 跳過邏輯、frames 選取(對 parsed jwt-auth doc,不 render)、critique JSON 解析/修復、calculateMetadata passthrough。任何模組 scope 不讀 `process.env`,provider 建構延遲到 CLI handler 內。

### D10 — Env
`.env.example`(.gitignore 已預留白名單):5 家 LLM key + `ELEVENLABS_API_KEY` + `MOTIFE_PROVIDER/MODEL/TTS`。

## 依賴新增

| 套件 | 類型 | 理由 |
|---|---|---|
| `@remotion/media` 4.0.508 | dep | `<Audio>`;**必須 `npx remotion add media`** |
| `ai` + 5 個 `@ai-sdk/*` | dep | 一個介面通 5 家含 vision |
| `music-metadata` | dep | Node 端量 mp3 時長 |
| `tsx` | devDep | 跑 `src/agent/cli.ts`(parameter properties 需真轉換) |

明確不加:commander(parseArgs)、dotenv(--env-file-if-exists)、OpenAI/ElevenLabs SDK(各一個 fetch)。

## 工作順序(單一 PR)

1. Housekeeping:INDEX.md Phase 2 → `done`;progress-tracker 開 Phase 3 item;修 docs/dsl-schema.md 指向 `validate.test.ts` 的舊路徑(實際在 parse.test.ts)+ Last-updated。
2. 依賴 + 骨架:remotion add media、其餘依賴、`.env.example`、`motife` script、`src/agent/cli.ts` parseArgs dispatch。
3. `motife validate` — 最薄的一刀,先證明 tsx CLI 路徑可行,立即解鎖 skill 模式。
4. `src/agent/llm.ts` + `providers.ts` + FakeLlmClient。
5. `prompt.ts` + `generate.ts` retry loop + `motife generate` + 測試。
6. TTS 五檔 + `motife tts` + 測試。
7. 音訊渲染:DslVideoProps.audio、`<Audio>` 掛載、Root.tsx passthrough 修正 + 測試;確認無音訊路徑下 verify 仍綠。
8. Render stage(`src/agent/render.ts`):bundle 一次共用 serveUrl;**同一個 inputProps 物件**餵 selectComposition 與 renderMedia/renderStill(CLAUDE.md 鐵律);`motife render`/`motife stills`。
9. Critique:frames/critique/report + revise + 測試。
10. 編排:rundir/pipeline + `motife run` 有界迴圈。
11. Eval runner + report.md。
12. Skill + 文件:SKILL.md、新 `docs/agent-pipeline.md`(CLI 參考、run-dir 合約、env)、更新 project-overview.md 與 CLAUDE.md Commands(全部 Last-updated)。
13. 驗證(下節)→ 開 PR。

## 風險

- AI SDK 對 zod 4.4.3 的 peer 相容 — 安裝時驗證;爆炸半徑限 llm.ts,fallback 為該供應商手寫 fetch。
- Groq/xAI 的 vision 支援因模型而異 — critique provider 獨立旗標 + 文件註明。
- VBR mp3 時長誤差 — music-metadata 全檔解析已準;若漂移改 OpenAI `response_format: "wav"`。
- LLM 4 次不收斂 — 大聲失敗、attempts/ 全留,正是 Phase 4 失敗模式的輸入。
- fade 轉場與音訊重疊 — eval docs 全用 cut,Phase 3 可接受,文件註明。

## 驗證

1. 無 `.env` 機器上 `pnpm verify` 綠(keyless 安全;FRAME_PINS 不變且通過)。
2. `generate.test.ts` 證明 formatIssues 文字確實進了第 2 次嘗試的訊息。
3. Keyless skill 模式演練:複製 jwt-auth.json 進 run 目錄 → validate → tts(只需 TTS key)→ render → stills → 得到有 zh-TW 旁白、時長由音檔決定的 MP4。
4. **Phase 3 驗收**:設好 key 跑 `pnpm motife eval` — 3 個 prompt 進、3 支 MP4 出、零人工介入,產出 report.md 供人工評分;另抽查 `pnpm motife run --prompt "…"` 單句 prompt 直出,字面滿足「一句 prompt 進」。
