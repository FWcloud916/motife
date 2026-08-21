# motife eval — 2026-08-21

Set: baseline (3 concept(s))
Generation: anthropic (claude-sonnet-5). Max revisions: 2. Full pipeline, no manual intervention.
TTS: elevenlabs (voice A3T1GnLHdn0WL5w4TMtq, model eleven_multilingual_v2)

## jwt-auth — JWT 驗證流程

- video: `jwt-auth/final.mp4` (iteration 1 of 1)
- generate attempts: 1
- iteration 1: 0 error(s), 3 warning(s) (shipped) (`jwt-auth/iterations/iter-1/critique.md`)
  - **WARNING / empty** [intro] 早期畫面下半部大片空白，僅有標題與一個空的字幕條，內容密度偏低。 — fix: 可將圖卡或字幕內容提前顯示，減少大面積留白時間。
  - **WARNING / empty** [breakdown] early frame僅顯示標題與空白字幕條，下方區域長時間空白。 — fix: 考慮讓卡片元素更早淡入，避免畫面過於空曠。
  - **WARNING / pacing** [breakdown] mid與late frame內容幾乎相同，只多了一個警示標籤，late frame相對mid frame的資訊增量較小。 — fix: 可合併警示標籤到mid frame或增加更多變化以提升late frame的資訊價值。
- outcome: critique clean
- elapsed: 216s

## mq-backpressure — Message Queue 背壓

- video: `mq-backpressure/final.mp4` (iteration 1 of 1)
- generate attempts: 1
- iteration 1: 0 error(s), 3 warning(s) (shipped) (`mq-backpressure/iterations/iter-1/critique.md`)
  - **WARNING / pacing** [breakdown] Early frame shows only the title with a large empty area beneath it, while the narration for this scene is fairly dense and information-heavy. — fix: Consider bringing in a piece of the metric cards or a supporting line earlier so the early frame isn't so bare relative to the narration length.
  - **WARNING / pacing** [summary] Early frame contains only the takeaway title with a very large empty region, while the scene's narration already introduces multiple strategy trade-offs. — fix: Introduce a brief lead-in line or fade in one strategy card earlier to reduce the empty dead space in the early frame.
  - **WARNING / other** [intro] In the mid frame a connector line and animated dot appear only between Producer and Queue, while Queue and Consumer have no connector, creating a visually inconsistent/incomplete diagram compared to the late frame where all three nodes are connected. — fix: Keep the Queue-to-Consumer connector visible (even if dimmed) in the mid frame so the diagram reads as consistently connected throughout.
- outcome: critique clean
- elapsed: 222s

## db-index — 資料庫索引原理

- video: `db-index/final.mp4` (iteration 1 of 1)
- generate attempts: 1
- iteration 1: 0 error(s), 1 warning(s) (shipped) (`db-index/iterations/iter-1/critique.md`)
  - **WARNING / overlap** [breakdown] 在 mid 與 late 影格中，底部的旁白字幕與右側 B-tree 圖表的『Leaf』節點標籤及『比較次數』文字視覺上重疊/擠在一起，造成閱讀混亂。 — fix: 將旁白字幕區塊上移或縮短，或把右側圖表的『比較次數』標籤上移，避免與字幕文字重疊。
- outcome: critique clean
- elapsed: 256s

## 失敗模式彙整（自動彙總，供下一輪確定性修復佇列使用）

無。

## 人工評分（1–5，看完影片後填寫）

| 概念 | 內容正確性 | 版面品質 | 節奏 | 旁白 | 備註 |
|---|---|---|---|---|---|
| jwt-auth |  |  |  |  |  |
| mq-backpressure |  |  |  |  |  |
| db-index |  |  |  |  |  |

及格線：每項 ≥3 且無 1 分項，版面品質 ≥4，備註欄不再出現三個已知失敗模式（裁切/運鏡超出範圍/口音重）（motife-plan.md §3 Phase 4 驗收 1）。
