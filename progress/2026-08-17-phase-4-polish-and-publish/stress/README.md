# 壓測跑法(Phase 4 PR 5)

Phase 4 驗收條件第 2 項:≥10 個非 eval-set 概念壓測,≥8 支全自動出片且人工評分每項 ≥3、無 1 分。第 1 項:基準 3 概念重跑,版面品質 ≥4,備註不再出現三個已知失敗模式。

12 個壓測概念定義在 `src/agent/stressConcepts.ts`,涵蓋三支基準沒測到的四個象限(樹/圖深度、code/terminal、meter/pacing、多步驟 Diagram+Camera),含必要的 heap/trie 概念(為延後的 TreeDiagram 元件決策收集證據)。

## 三輪跑法

```bash
# 1. 篩選 pass — 便宜、不含旁白,找出會 crash / 完全不收斂的概念
pnpm motife eval --set stress --label screen --no-audio --max-revisions 1

# 2. 完整 pass — 開始前先確認 report 的 TTS 那行寫 elevenlabs
#    (程式碼預設值是 OpenAI alloy;PR 4 A/B 贏家只存在主 checkout 的 .env)
pnpm motife eval --set stress

# 3. 驗收條件第 1 項:基準重跑
pnpm motife eval --set baseline
```

成本估計(依 Phase 3 實測 248s/313s/1102s 外推,序列執行):

| Pass | 估計時間 |
|---|---|
| 壓測篩選 | 1.5–2.5 小時 |
| 壓測完整 | 2.5–4.5 小時 |
| 基準重跑 | <15 分鐘 |

## 產出

`out/eval/<date>/<set>-<label>/report.md`(或無 label 時 `out/eval/<date>/<set>/report.md`)——每完成一個概念就重寫一次,不會因為中途中斷弄丟已完成的結果。Report 內建:
- 每個概念的 outcome 標籤、每輪的驗證 warning(PR 3 的 4 條 lint,含 3 條先前完全看不到的 warning)、critique 未解決的 error
- 「失敗模式彙整」表格,按 critique kind / lint code 分組計數,直接餵給 PR 6 的確定性修復佇列
- 依 set 不同的及格線註腳(baseline 引用驗收 1、stress 引用驗收 2)

## 聽完/看完之後

跑完的 report 連結會交付給你,`## 人工評分` 表格留白等你填(內容正確性/版面品質/節奏/旁白,1–5 分)。填完後:
- 確認 ≥8/12 支壓測概念每項 ≥3、無 1 分
- 確認基準 3 概念版面品質 ≥4、備註不再出現裁切/運鏡超出範圍/口音重
- 「失敗模式彙整」表格中列出的項目,排進 PR 6 的確定性修復佇列(元件/compiler 優先、prompt 其次)
- 基準 report 存檔到 `progress/2026-08-17-phase-4-polish-and-publish/eval-baseline-<date>.md`,比照 Phase 3 的 `progress/2026-08-14-phase-3-agent-pipeline/eval-report-2026-08-15.md`
