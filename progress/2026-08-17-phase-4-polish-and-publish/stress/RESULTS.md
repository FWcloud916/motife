# 壓測結果評分表

跑完 [README.md](README.md) 的三輪之後,在這裡記錄結果與人工評分。每個 report 的 `## 人工評分` 表格是主要填寫位置(1–5 分,仿 `motife eval` 格式);這份檔案彙整結論與下一步。

## 壓測(`--set stress`)

- **Report 路徑:**(填入 `out/eval/<date>/stress/report.md`)
- **N/12 支全自動出片、每項 ≥3、無 1 分:**
- **失敗模式彙整摘要:**(從 report 的「失敗模式彙整」表格複製)
- **是否達成 ≥8/12 的驗收條件第 2 項:**

## 基準重跑(`--set baseline`)

- **Report 路徑:**(填入 `out/eval/<date>/baseline/report.md`)
- **三概念版面品質是否都 ≥4:**
- **備註欄是否仍出現三個已修的症狀(裁切/運鏡超出範圍/口音重):**
- **是否達成驗收條件第 1 項:**

## 下一步(PR 6 輸入)

從壓測 report 的「失敗模式彙整」表格,按優先序列出要排進 PR 6 確定性修復佇列的項目(元件/compiler 優先、prompt 其次):

1.
2.
3.

## TreeDiagram 決策證據

`binary-heap`/`trie-autocomplete` 兩個概念是否讓 Diagram 元件(目前用兩個疊起來的卡片表示樹狀結構)撐得住?是否有具體證據支持/反對建 TreeDiagram 元件:
