# Phase 4 — 打磨與發布 (Polish and Publish)

**Slug:** phase-4-polish-and-publish
**Status:** in-progress
**Ticket:** N/A
**Related plan:** [phase-4-polish-and-publish-jaunty-knitting-locket.md](../_plans/phase-4-polish-and-publish-jaunty-knitting-locket.md)
**Created:** 2026-08-17
**Updated:** 2026-08-17

---

## Scope

| Scope | Branch | Ticket | Notes |
|---|---|---|---|
| `motife` | `phase-4/kickoff-keep-best-camera-clamp` | N/A |  |

## Background & goals

Phase 3 was accepted on 2026-08-15 (`pnpm motife eval` — 3/3 concepts fully
automated, zero manual intervention, human scores all ≥3 with no 1s). The
acceptance record (motife-plan.md:104-107) logged three failure modes as
Phase 4's deterministic-fix queue. motife-plan.md §3 Phase 4 currently has
**no acceptance criterion** (unlike Phases 0-3, which each end with a bolded
驗收 line) — defining one is itself part of this item's scope. §6 立即下一步
already sets the priority order: deterministic fixes → 10+ concept stress
test → `@remotion/player` web preview → publish-form decision.

### Failure mode queue (from the Phase 3 eval report, per-concept attribution)

Source: `progress/2026-08-14-phase-3-agent-pipeline/eval-report-2026-08-15.md`
備註 column, distilled into motife-plan.md:105-107.

1. **TTS 中文旁白口音重**(OpenAI `gpt-4o-mini-tts`, voice=`alloy`)—
   **3/3 concepts** (jwt-auth, mq-backpressure, db-index). Every concept's
   旁白 score was capped at 3/5 by this alone — the single lowest-scoring
   dimension across the whole eval.
2. **Diagram 節點卡片過大遭畫面裁切** — **2/3 concepts** (mq-backpressure,
   db-index). Critique correctly flags it as overflow, but the critic is
   forbidden from suggesting pixel/coordinate fixes (DSL hard rule), so the
   LLM revision loop cannot resolve it — this is why it must be fixed in the
   component/compiler layer, not the prompt.
3. **Camera 運鏡超出畫面範圍** — **1/3 concepts** (db-index only — the sole
   concept using Camera narratively). Contributed to db-index exhausting its
   revision budget (1→2→1 errors across 3 iterations, never reaching clean).

Content correctness was saturated (5/5/5 across all three concepts) — the
LLM semantic layer is not the problem; every deficit is in the deterministic
rendering layer (版面/旁白), consistent with motife-plan.md §2 分層原則
("品質責任放在元件庫與設計 token,不放在 LLM").

### Known deferrals to track (not to lose track of)

- **Word-level captions** (`@remotion/captions`) — explicitly deferred from
  Phase 3 to Phase 4 (`progress/_plans/phase-3-agent-pipeline-silly-soaring-cherny.md:61`).
  Not in motife-plan.md §3 Phase 4's bullet list — a fourth deliverable to
  fold in, likely alongside PR 7 (preview page) or as its own small PR.
- **`TreeDiagram` component** — deliberately not built in Phase 2; db-index's
  B+Tree is currently two stacked Diagrams (`progress/_plans/phase-2-dsl-compiler-phase-2-playful-platypus.md:381`:
  "if the visual doesn't hold up, that's a Phase 4 finding, not a Phase 2
  blocker"). db-index is exactly the concept that failed to converge — the
  10-concept stress test deliberately includes a heap/trie-shaped concept to
  gather more evidence before deciding whether to build it.
- **Pipeline run log persistence** — `pipeline.ts`'s `log()` callback is
  ad hoc per caller; PR 7 (preview server) needs a `pipeline.log` file
  tailed over HTTP for run-status polling. Worth landing as a small
  building block rather than bespoke to the preview server.

### User decisions already made (2026-08-17 planning session)

- **TTS A/B scope (PR 4):** test both OpenAI (other voices + the
  `gpt-4o-mini-tts` `instructions` field) **and** ElevenLabs
  (`eleven_multilingual_v2` + zh voice id) — not OpenAI-only.
- **Publish-form decision (PR 8):** deferred until after the 10+ concept
  stress test and preview page exist — 開源工具/demo 網站/內容創作自用 stay
  open until then; this item should surface the decision, not make it.
- **This session's scope:** progress tracking (this PR) + PR 1 (keep-best +
  critique archival) + PR 2 (Camera clamp). PRs 3-8 are follow-on work,
  tracked below but not started.

### Proposed Phase 4 acceptance criterion

motife-plan.md §3 Phase 4 has no 驗收 line today (a gap vs. Phases 0-3).
Proposed (modeled on the roadmap's M4 milestone "對外可展示(預覽頁 + 10 概念
壓測)"), to be written into motife-plan.md as part of this PR:

1. Baseline 3 概念重跑 `pnpm motife eval`,人工評分每項 ≥3 且版面品質 ≥4,
   備註欄不再出現本文件記錄的三個已知失敗模式(裁切/運鏡超出範圍/口音重)。
2. ≥10 個非 eval set 概念壓測,≥8 支全自動產出及格 MP4(每項 ≥3、無 1
   分),其餘的失敗模式已歸檔並排入下一輪確定性修復佇列。
3. `@remotion/player` 預覽頁在本機端到端可用:prompt 輸入 → 線上預覽
   (TTS 時間軸驅動)→ 下載 MP4。
4. 發布形式決策(開源工具/demo 網站/內容創作自用)已記錄於 motife-plan.md。

## Task list

### PR breakdown (full Phase 4 scope — PR 0-2 are this session's work; PR 3-8 are follow-on, tracked here for continuity)

| # | PR | Content | Baseline re-render required? | Status |
|---|---|---|---|---|
| 0 | progress 追蹤 | This progress item; motife-plan.md Phase 4 acceptance criterion added | No | in-progress |
| 1 | keep-best + critique archival | `pipeline.ts` ships best iteration (not last); eval report inlines critique issues (self-contained, archivable) | No | not started |
| 2 | Camera clamp | Zoom upper-bound converges to fit + per-frame translation clamp (fixes failure mode 2 + the Camera-nested half of mode 1) | **Yes** | not started |
| 3 | Diagram overflow bounding | `SafeAreaContext` real-pixel cap on standalone Diagram + `validate.ts` estimated-footprint lint (moves the signal into the generate retry loop, which the LLM *can* act on) | Yes | not started |
| 4 | TTS model wiring + A/B | `--tts-model`/`MOTIFE_TTS_MODEL` + narration-hash includes model; OpenAI voices/instructions **and** ElevenLabs zh voice both evaluated | Audio re-synthesis only | not started |
| 5 | 10+ concept stress test | New `stressConcepts.ts` + `eval --set stress`; screening pass (`--no-audio --max-revisions 1`) to control the ~18min/concept worst-case cost before full passes | No | not started |
| 6 | Second fix round | Apply fixes for failure modes surfaced by the stress test — components/compiler first, prompt second (hard rule, motife-plan.md §2 分層原則) | Depends on findings | not started |
| 7 | `@remotion/player` preview page | `npx remotion add @remotion/player` (pinned, never `pnpm add`); `node:http` server using the run-dir as state; new `web/` workspace (Vite); preview available at "audio-ready" (post-TTS, pre-final-render), honoring the TTS-driven-timeline rule | No | not started |
| 8 | Publish-form decision + docs closeout | User decision recorded in motife-plan.md; docs sweep (component-library.md, dsl-schema.md, agent-pipeline.md) with Last-updated bumps | No | not started |

### This session's tasks (PR 0-2)

- [x] PR 0 — Create this progress item with full Phase 4 breakdown + acceptance criterion
- [ ] PR 0 — Update motife-plan.md §3 Phase 4 with the acceptance criterion above
- [ ] PR 0 — Fix Phase 3 progress item's placeholder Outcome section
- [ ] PR 0 — Open PR (progress/ + motife-plan.md only, no src/ changes)
- [ ] PR 1 — `pipeline.ts` keep-best-iteration (track best by errors→warnings→earlier-iteration tiebreak); per-iteration `doc.json` snapshot; `doc.final.json` in run root
- [ ] PR 1 — `IterationSummary` carries `issues: CritiqueIssue[]`; `eval.ts` inlines them into `report.md`
- [ ] PR 1 — `docs/agent-pipeline.md` run-dir contract update + Last-updated bump
- [ ] PR 1 — Tests: 1→2→1 ships iter 1, 2→1 ships iter 2, clean-first unchanged
- [ ] PR 1 — `pnpm verify` green, open PR
- [ ] PR 2 — Extract `Camera.tsx` math into pure `cameraMath.ts`; zoom clamp (fit-bounded) + translation clamp (post-lerp)
- [ ] PR 2 — `docs/component-library.md` Camera section update + Last-updated bump
- [ ] PR 2 — Unit tests: zoom clamp, translation clamp, centering, lerp continuity
- [ ] PR 2 — Full regression: `pnpm verify`, `manifest.test.ts` frame pins green, re-render 3 baseline DSL docs + visual check (db-index Camera shot fully in-frame, jwt-auth near-unchanged), record check in this item
- [ ] PR 2 — Open PR

## Work log

### 2026-08-17

-
- Created full Phase 4 breakdown (8 PRs) with baseline re-render requirements, failure-mode queue with per-concept attribution, known deferrals (word-level captions, TreeDiagram, pipeline log persistence), user decisions (TTS A/B both providers, publish-form deferred), and a proposed Phase 4 acceptance criterion. This session scoped to PR 0 (this item) + PR 1 (keep-best/critique archival) + PR 2 (Camera clamp).

## Outcome

> Fill in after development finishes.

**Final status:**
**PR / Commit:**
**Follow-ups:**
