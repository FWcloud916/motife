# motife eval — 2026-08-15

Generation: anthropic (claude-sonnet-5). Full pipeline, no manual intervention.

## jwt-auth — JWT 驗證流程

- video: `jwt-auth/final.mp4`
- generate attempts: 1
- iteration 1: 0 error(s), 2 warning(s) (`jwt-auth/iterations/iter-1/critique.md`)
- outcome: critique clean
- elapsed: 248s

## mq-backpressure — Message Queue 背壓

- video: `mq-backpressure/final.mp4`
- generate attempts: 1
- iteration 1: 0 error(s), 0 warning(s) (`mq-backpressure/iterations/iter-1/critique.md`)
- outcome: critique clean
- elapsed: 313s

## db-index — 資料庫索引原理

- video: `db-index/final.mp4`
- generate attempts: 1
- iteration 1: 1 error(s), 1 warning(s) (`db-index/iterations/iter-1/critique.md`)
- iteration 2: 2 error(s), 2 warning(s) (`db-index/iterations/iter-2/critique.md`)
- iteration 3: 1 error(s), 1 warning(s) (`db-index/iterations/iter-3/critique.md`)
- outcome: revision budget exhausted
- elapsed: 1102s

## 人工評分（1–5,看完影片後填寫）

| 概念 | 內容正確性 | 版面品質 | 節奏 | 旁白 | 備註 |
|---|---|---|---|---|---|
| jwt-auth | 5 | 4 | 4 | 3 | 旁白口音重 |
| mq-backpressure | 5 | 3 | 4 | 3 | 部分區塊過大，有被裁切的樣子、旁白口音重 |
| db-index | 5 | 3 | 4 | 3 | 部分區塊過大，有被裁切的樣子、鏡頭運鏡有超出範圍 旁白口音重 |

及格線：每項 ≥3 且無 1 分項（motife-plan.md §3 Phase 3 驗收）。
