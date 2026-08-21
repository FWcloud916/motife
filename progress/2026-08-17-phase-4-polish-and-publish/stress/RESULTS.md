# 壓測結果評分表

跑完 [README.md](README.md) 的三輪之後,在這裡記錄結果與人工評分。每個 report 的 `## 人工評分` 表格是主要填寫位置(1–5 分,仿 `motife eval` 格式);這份檔案彙整結論與下一步。

## 壓測(`--set stress`)

- **Report 路徑:** `out/eval/2026-08-21/stress/report.md`
- **12/12 支全自動出片:** 全部 outcome=`clean`;人工評分待填,尚不能宣告「每項 ≥3、無 1 分」
- **失敗模式彙整摘要:** 無未解 critique error 或 layout lint warning
- **是否達成 ≥8/12 的驗收條件第 2 項:** 自動產出門檻已達成;待人工評分後定案

## 基準重跑(`--set baseline`)

- **Report 路徑:** `out/eval/2026-08-21/baseline/report.md`(已歸檔為 `../eval-baseline-2026-08-21.md`)
- **三概念版面品質是否都 ≥4:** 待人工評分
- **備註欄是否仍出現三個已修的症狀(裁切/運鏡超出範圍/口音重):** 自動 critique 未重報三症狀;`db-index` 另有一條 caption/B-tree 擁擠的 warning,待人工確認
- **是否達成驗收條件第 1 項:** 3/3 outcome=`clean`;待人工版面與旁白評分後定案

## 下一步(PR 6 輸入)

從壓測 report 的「失敗模式彙整」表格,按優先序列出要排進 PR 6 確定性修復佇列的項目(元件/compiler 優先、prompt 其次):

1. 自動失敗模式彙整為「無」;沒有可直接排入 PR 6 的未解 error。
2. 人工評分時確認多支影片的 early-frame empty/pacing warning 是否形成高頻體感問題。
3. 人工檢查 `db-index` breakdown 的 caption/B-tree 擁擠 warning;若版面分數受影響再排 deterministic fix。

## TreeDiagram 決策證據

`binary-heap`/`trie-autocomplete` 兩個概念是否讓 Diagram 元件(目前用兩個疊起來的卡片表示樹狀結構)撐得住?是否有具體證據支持/反對建 TreeDiagram 元件:

- `binary-heap`:iteration 1 的 overflow/overlap 經一次語意 revision 後全部清除,shipped iteration 2 為 clean;剩餘 warning 僅為 early-frame pacing/empty。
- `trie-autocomplete`:iteration 1 直接 clean;唯一 warning 是重複說明文字間距,不是樹結構表達失敗。
- **暫定:**自動證據不支持現在新增 `TreeDiagram`;保留既有 Diagram,待人工看片若認為樹層級可讀性不足再翻案。
