# Motife Phase 4 規劃 + 首兩個修復 PR

## Context

Phase 3 已於 2026-08-15 驗收(3/3 eval 概念全自動出片、人工評分過及格線),驗收記錄留下三個失敗模式作為 Phase 4 確定性修復佇列(motife-plan.md:104-107):

1. **Diagram 節點卡片過大遭畫面裁切**(critique 抓得到但 LLM 改 DSL 救不了 — critique 建議依設計禁止像素座標)— 影響 2/3 概念
2. **Camera 運鏡超出畫面範圍** — 影響 db-index(唯一用 Camera 敘事的概念)
3. **TTS 中文旁白口音重**(OpenAI gpt-4o-mini-tts, voice=alloy)— 影響 3/3 概念,旁白項全部只拿 3 分

motife-plan.md §3 Phase 4 目前**沒有驗收條件**(Phase 0–3 都有),§6 已排好優先序:確定性修復 → 10+ 概念壓測 → @remotion/player 預覽頁 → 發布形式決策。

已抽查程式碼確認三件關鍵事實:
- [Camera.tsx:223-234](src/components/Camera/Camera.tsx) transform 無任何 clamp;`ZOOM_SCALE` 是絕對值(wide:1),超寬圖在 `focus:"all", zoom:"wide"` 必然溢出
- [pipeline.ts:247-248](src/agent/pipeline.ts) `finally` 裡把**最後一輪**(非最佳一輪)copy 成 `final.mp4` — db-index 修訂迴圈曾 1→2→1 errors 倒退,出片的是不比第一輪好的第三輪
- [provider.ts:27-35](src/tts/provider.ts) `createTtsProvider` 沒有 `model` 參數;且 `narrationHash(provider, voice, text)` 不含 model,換 model 會靜默重用快取音檔

**使用者決策(已確認):**本 session 執行規劃 + PR 1 + PR 2;TTS A/B 屆時 OpenAI 與 ElevenLabs 都測(PR 4,本 session 不做);發布形式壓測後再定。

## Phase 4 整體 PR 拆解(寫入規劃文件,本 session 只執行 PR 0–2)

| # | PR | 內容 | 基準重跑 |
|---|---|---|---|
| 0 | progress item + 規劃文件 | Phase 4 progress item;motife-plan.md 補驗收條件與 PR 拆解 | 否 |
| 1 | keep-best + critique 歸檔 | pipeline 出最佳輪;eval report 內嵌 critique issues(自包含、可歸檔) | 否 |
| 2 | Camera clamp | zoom 上限依 fit 收斂 + translation 逐幀 clamp(修失敗模式 2 與 Camera 內的模式 1) | **是** |
| 3 | Diagram 溢出防護 | SafeAreaContext 實際像素上限 + validate.ts 估算 footprint lint(把訊號提前到 generate retry 迴圈) | 是 |
| 4 | TTS model 穿線 + A/B | `--tts-model`/`MOTIFE_TTS_MODEL`/hash 納入 model;OpenAI voices+instructions 與 ElevenLabs 中文 voice 都測 | 僅重合成音檔 |
| 5 | 10+ 概念壓測 | `stressConcepts.ts` + `eval --set stress`;screening pass(--no-audio --max-revisions 1)先篩 | 否 |
| 6 | 壓測後第二輪修復 | 依失敗模式統計,元件/compiler 優先、prompt 其次 | 視內容 |
| 7 | @remotion/player 預覽頁 | `npx remotion add @remotion/player`;node:http server 以 run-dir 為狀態;web/ workspace(Vite);audio-ready 即可預覽 | 否 |
| 8 | 發布形式決策 + docs 收尾 | 決策記錄(使用者定)+ 文件 sweep | 否 |

**提議的 Phase 4 驗收條件**(寫入 motife-plan.md,依 M4「對外可展示」):
1. baseline 3 概念重跑 eval,每項 ≥3 且版面品質 ≥4,備註不再出現三個已知失敗模式
2. ≥10 個非 eval set 概念壓測,≥8 支全自動及格,其餘失敗模式歸檔入修復佇列
3. 預覽頁本機端到端可用(prompt → 預覽 → 下載 MP4)
4. 發布形式決策記錄於 motife-plan.md

## 本 session 執行內容

**第一步(獨立先行):建立完整 progress 追蹤,單獨開分支開 PR,先入庫再動程式碼。**之後 PR 1 與 PR 2 各自獨立分支與 PR。

### Step 1 / PR 0 — 完整 Phase 4 progress 追蹤(獨立 PR,先行)

- 用 progress-tracker skill 建 `progress/2026-08-17-phase-4-polish-and-publish/`,PROGRESS.md 完整記錄:
  - Phase 4 全部 8 個 PR 的工作拆解(上表)與各自的基準重跑要求
  - 提議的 Phase 4 驗收條件(四項)
  - 三個失敗模式佇列(含 eval 報告的逐概念歸因:口音 3/3、裁切 2/3、運鏡 1/3)
  - 已知延期項備忘:word-level 字幕(@remotion/captions)、TreeDiagram 元件(等壓測 heap/trie 概念的證據)、pipeline log 落地
  - 使用者已決策事項:TTS A/B 兩家都測(PR 4)、發布形式壓測後再定(PR 8)
- 本規劃快照入 `progress/_plans/`(progress-tracker 慣例),`INDEX.md` 加一列(status: in-progress)
- `motife-plan.md` §3 Phase 4:補驗收條件;§6 不動(已是正確優先序)
- 補 Phase 3 progress item 的 Outcome 段(目前仍是 "Fill in after development finishes." 佔位)— tracker 一致性修正
- 此 PR 只含 progress/ 與 motife-plan.md,不動 src/;合併(或至少開出 PR)後才開始 PR 1

### PR 1 — keep-best-iteration + critique 歸檔([src/agent/pipeline.ts](src/agent/pipeline.ts))

**keep-best:**
- 每輪 render 時把當下 `doc.json` snapshot 成 `iterations/iter-N/doc.json`([rundir.ts](src/agent/rundir.ts) `iterationPaths()` 加路徑)
- 追蹤 `best = {iteration, videoPath, errors, warnings}`:errors 少者勝 → warnings 少者勝 → 平手取**較早**輪(修訂沒帶來改善時,取偏離生成較少的版本)
- `finally`:copy `best.video → final.mp4`,copy 最佳輪 doc → run root `doc.final.json`(不覆蓋 `doc.json`)
- `PipelineResult` 加 `shippedIteration`;report 寫明 "final.mp4 is iteration N (best of M)"
- 測試:[pipeline.test.ts](src/agent/pipeline.test.ts) 已全 stage fake — 加 1→2→1(出第 1 輪)、2→1(出第 2 輪)、首輪 clean(不變)三個 case

**critique 歸檔:**
- `IterationSummary` 加 `issues: CritiqueIssue[]`(pipeline 寫 critique.json 時已持有 parsed report,無新 I/O)
- [eval.ts](src/agent/commands/eval.ts) `renderEvalReport()` 內嵌各輪 issues(sceneId/severity/kind/description/suggestion),`out/eval/<date>/report.md` 自包含、值得歸檔
- `docs/agent-pipeline.md` 更新 run-dir contract(`doc.final.json`、iter doc snapshot)+ Last-updated

無元件/prompt 變動 → 不需重跑基準;`pnpm verify` 即可。

### PR 2 — Camera clamp([src/components/Camera/Camera.tsx](src/components/Camera/Camera.tsx))

把 `focusRectFor`/`currentTransform`/style 計算抽到純函式模組 `src/components/Camera/cameraMath.ts`(node 可測,比照 `nodeSizing.ts`),Camera.tsx 留 React 接線。

內容邊界 `B` = `targets[DIAGRAM_BOUNDS_ID]`,否則所有 registered rects 的 union,否則整個 container(沿用現有 fallback)。兩個不變量:

1. **Zoom clamp(每 shot,lerp 前):**`effectiveZoom = min(ZOOM_SCALE[zoom], (W−2·MARGIN)/rect.width, (H−2·MARGIN)/rect.height)`,MARGIN ≈ tokens.spacing.lg。超寬圖在 `focus:"all", zoom:"wide"` 會縮到 <1 完整入鏡;一般 560 寬節點的 close(2×)不受影響(1920/560≈3.4>2)→ jwt-auth 這類 shot 像素應近乎不變
2. **Translation clamp(每 frame,lerp 後):**給定最終 z,逐軸:`z·B.width ≥ W` 時 clamp tx 到 `[W − z·(B.x+B.width), −z·B.x]`(視窗不出內容);否則置中。lerp 後才 clamp(連續函數的 clamp 仍連續,運鏡平滑)

- `zoom` 語意從「絕對倍率」變成「以 fit 為上限的倍率」— 不動 DSL schema(硬性規則:schema 無幾何概念)
- `docs/component-library.md` Camera 段更新 + Last-updated
- 單元測試:cameraMath 的 zoom clamp / translation clamp / 置中 / lerp 連續性

## Verification

- 每個 PR:`pnpm verify`(keyless 必須過:typecheck + lint + tests + smoke)
- PR 2 額外(「越改越爛」風險的全量回歸):
  - `manifest.test.ts` frame pins 應綠(pin 的是 timing,本 PR 不動 timing)
  - 重 render 3 支基準 DSL 影片,人工目視:db-index 的 `focus:"all"` wide shot 應可見改善(完整入鏡),jwt-auth Camera shots 應近乎不變;檢查記錄附進 progress item
  - 若本機有 API key,可重跑 `pnpm motife eval` 確認 db-index critique 的 offscreen error 消失(可選,無 key 則以 stills 目視代替)
- 交付:PR 0(progress 追蹤)先行,PR 1、PR 2 各開分支 → PR into main(硬性規則:不直接 commit main)
- PR 1/PR 2 進行中隨時把 work log 寫回 Phase 4 progress item(progress-tracker update),完成後更新狀態
