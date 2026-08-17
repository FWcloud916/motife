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
| `motife` | `phase-4/camera-clamp` | N/A |  |

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

### Deeper finding from PR 2 verification: Camera's viewport assumption is violated in db-index itself

PR 2 (`src/components/Camera/cameraMath.ts`) makes Camera's zoom/translation math
internally correct against ITS OWN stated contract: it clamps a shot's zoom so
its focus rect fits `useVideoConfig()`'s width/height (with margin), and clamps
translation so the overall content bounds never pan into dead space *within that
same 1920×1080 assumption*. Verified both by unit tests (`cameraMath.test.ts`,
27 cases) and, live, by inspecting the actual DOM transform in Remotion Studio
at the db-index walkthrough's wide shot (frame 594): `translate(656.153px,
64px) scale(0.793333)` — matches the hand-computed clamp exactly (the 1200px-
tall diagram × 0.7933 = 952px, fitting the 1080 − 2×64 margin box).

**But the still-rendered frame at that same point does not show the whole
diagram** — only root + 2 internal nodes; the leaf/table rows are clipped.
Root cause, confirmed by measuring the actual DOM box Camera renders into
(`offsetWidth`/`offsetHeight`, unaffected by CSS transforms): **Camera's real
box in db-index's `walkthrough` scene is ~1728×541px, not 1920×1080.** Scene.tsx
reserves `HEADER_CLEARANCE` (210px) + `CAPTION_CLEARANCE` (150px) around
`content` for this scene's header/caption (1920×720 remains), and inside that,
db-index's DSL stacks a "steps" progress card *above* the `camera` node in the
same vertical Stack — the steps card's own height (~172px) further shrinks
Camera's actual box to ~541px tall. Camera's `useVideoConfig()`-based math has
no way to know this: it computes correctly for a *1920×1080* canvas, then
`overflow: hidden` on a box that's actually only *541px tall* clips whatever
falls outside that regardless of how correct the 1080-based math was.

This is **not a regression from PR 2** — it reproduces identically on the
pre-PR-2 code path too (verified: the "root, medium" shot's zoom was never
near its clamp threshold, so PR 2 changes nothing about its position, and the
same still-render shows the Internal row's top edges clipped at the bottom of
that shot too). It is also **not undiscovered** —
`docs/component-library.md`'s `Camera` section already documents "Assumes it
fills the full composition frame... **This is load-bearing, not a soft
preference**" plus a real repro note from "authoring the DB index video's
first narrative Camera use", and lists it under "Open items for Phase 3":
*"`src/compiler/validate.ts` doesn't currently catch this — worth a
validation rule if Phase 3's critique loop finds it recurring."* It recurred
— this IS the mechanism behind Phase 3's failure mode #2, more precisely
diagnosed than the original eval report could tell from render output alone.

**Recommendation for PR 3 (or a dedicated follow-up):** a `validate.ts` rule
flagging a `camera` node whose enclosing Stack has additional siblings
sharing its cross-axis space (the exact case Scene's own docs warn against) —
pushing the signal into the generate/revise retry loop, which (like the
Diagram-footprint case) the LLM can actually act on, rather than trying to
make Camera DOM-measure its real box (explicitly avoided elsewhere in this
codebase for determinism reasons) or teaching it about arbitrary sibling
heights. A quicker partial mitigation — Camera consulting Scene's
header/caption clearances the same way `SafeAreaContext` (planned for PR 3)
will for Diagram — would still leave db-index's specific case broken (720 <
some other sibling's share), so it isn't sufficient alone; the validation
rule is the right first move. Filed here rather than fixed in PR 2 to keep
this PR's diff to the zoom/translation math it set out to fix.

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
| 0 | progress 追蹤 | This progress item; motife-plan.md Phase 4 acceptance criterion added | No | done ([#12](https://github.com/FWcloud916/motife/pull/12)) |
| 1 | keep-best + critique archival | `pipeline.ts` ships best iteration (not last); eval report inlines critique issues (self-contained, archivable) | No | done ([#13](https://github.com/FWcloud916/motife/pull/13)) |
| 2 | Camera clamp | Zoom upper-bound converges to fit + per-frame translation clamp (fixes failure mode 2 + the Camera-nested half of mode 1) | **Yes** | not started |
| 3 | Diagram overflow bounding | `SafeAreaContext` real-pixel cap on standalone Diagram + `validate.ts` estimated-footprint lint (moves the signal into the generate retry loop, which the LLM *can* act on) **+ new**: a `camera`-nested-with-siblings validation rule (see PR 2 finding below — this is the actual mechanism behind db-index's Camera clipping, not just zoom overflow) | Yes | not started |
| 4 | TTS model wiring + A/B | `--tts-model`/`MOTIFE_TTS_MODEL` + narration-hash includes model; OpenAI voices/instructions **and** ElevenLabs zh voice both evaluated | Audio re-synthesis only | not started |
| 5 | 10+ concept stress test | New `stressConcepts.ts` + `eval --set stress`; screening pass (`--no-audio --max-revisions 1`) to control the ~18min/concept worst-case cost before full passes | No | not started |
| 6 | Second fix round | Apply fixes for failure modes surfaced by the stress test — components/compiler first, prompt second (hard rule, motife-plan.md §2 分層原則) | Depends on findings | not started |
| 7 | `@remotion/player` preview page | `npx remotion add @remotion/player` (pinned, never `pnpm add`); `node:http` server using the run-dir as state; new `web/` workspace (Vite); preview available at "audio-ready" (post-TTS, pre-final-render), honoring the TTS-driven-timeline rule | No | not started |
| 8 | Publish-form decision + docs closeout | User decision recorded in motife-plan.md; docs sweep (component-library.md, dsl-schema.md, agent-pipeline.md) with Last-updated bumps | No | not started |

### This session's tasks (PR 0-2)

- [x] PR 0 — Create this progress item with full Phase 4 breakdown + acceptance criterion
- [x] PR 0 — Update motife-plan.md §3 Phase 4 with the acceptance criterion above
- [x] PR 0 — Fix Phase 3 progress item's placeholder Outcome section
- [x] PR 0 — Open PR (progress/ + motife-plan.md only, no src/ changes)
- [x] PR 1 — `pipeline.ts` keep-best-iteration (track best by errors→warnings→earlier-iteration tiebreak); per-iteration `doc.json` snapshot; `doc.final.json` in run root
- [x] PR 1 — `IterationSummary` carries `issues: CritiqueIssue[]`; `eval.ts` inlines them into `report.md`
- [x] PR 1 — `docs/agent-pipeline.md` run-dir contract update + Last-updated bump
- [x] PR 1 — Tests: 1→2→1 ships iter 1, 2→1 ships iter 2, clean-first unchanged
- [x] PR 1 — `pnpm verify` green, open PR
- [x] PR 2 — Extract `Camera.tsx` math into pure `cameraMath.ts`; zoom clamp (fit-bounded) + translation clamp (post-lerp)
- [x] PR 2 — `docs/component-library.md` Camera section update + Last-updated bump
- [x] PR 2 — Unit tests: zoom clamp, translation clamp, centering, lerp continuity (27 cases in `cameraMath.test.ts`)
- [x] PR 2 — Full regression: `pnpm verify` green (223 tests + smoke + smoke:audio), `manifest.test.ts` frame pins green, re-rendered db-index stills + live Studio DOM inspection — **zoom/translation math verified provably correct against Camera's 1920×1080 contract, but db-index's wide shot still clips** due to a deeper, separate, already-documented issue (see finding above) — recorded in this item, not silently passed
- [x] PR 2 — Open PR

## Work log

### 2026-08-17

-
- Created full Phase 4 breakdown (8 PRs) with baseline re-render requirements, failure-mode queue with per-concept attribution, known deferrals (word-level captions, TreeDiagram, pipeline log persistence), user decisions (TTS A/B both providers, publish-form deferred), and a proposed Phase 4 acceptance criterion. This session scoped to PR 0 (this item) + PR 1 (keep-best/critique archival) + PR 2 (Camera clamp).
- PR 0 opened: https://github.com/FWcloud916/motife/pull/12 (branch phase-4/progress-tracking-kickoff) -- motife-plan.md Phase 4 acceptance criterion added, Phase 3 Outcome placeholder fixed, this progress item created. progress/ tracker check passes. PR 1 and PR 2 will each get their own branch/PR once this one merges.
- PR 1 implemented: pipeline.ts tracks best-scoring iteration (fewest errors, then warnings, then earliest on a tie) and ships it as final.mp4/doc.final.json instead of always the last render; per-iteration doc.json snapshots added to rundir.ts; IterationSummary carries critique issues, inlined into eval.ts's report.md. Tests: 3 new/updated pipeline.test.ts cases covering tie-break-to-earlier, regression-then-recovery (1->2->1), and strict-improvement (2->1) scenarios, plus rundir.test.ts field coverage. docs/agent-pipeline.md run-dir contract + critique-loop section updated, Last-updated bumped. pnpm verify green (196 tests, keyless).
- PR 1 opened: https://github.com/FWcloud916/motife/pull/13 (branch phase-4/keep-best-iteration).
- PR 1 merged: https://github.com/FWcloud916/motife/pull/13. Starting PR 2 (Camera clamp) on branch phase-4/camera-clamp.
- PR 2 implemented: extracted Camera.tsx's zoom/pan math into pure src/components/Camera/cameraMath.ts (zoom clamp per shot against its focus rect + margin; translation clamp per frame against the overall content bounds, post-lerp). 27 unit tests. pnpm verify green (223 tests). IMPORTANT finding during regression verification: live-inspected the actual DOM transform in Remotion Studio at db-index's wide shot -- matches the hand-computed clamp exactly (0.7933x, correctly fitting the 1200px-tall diagram into the 1920x1080 assumption) -- but the still-rendered frame still clips the leaf/table rows, because Camera's ACTUAL rendered box in that scene is ~1728x541px (Scene header/caption clearance + a sibling steps card above it in the same Stack), not the 1920x1080 useVideoConfig() figure Camera's math assumes. This is pre-existing (identical on pre-PR-2 code), already documented in docs/component-library.md's Camera section and its Phase 3 open-items list, and IS the real mechanism behind failure mode 2 -- more precisely diagnosed now. Full writeup + recommendation (a validate.ts rule, folded into PR 3) added to this item's Background section.

## Outcome

> Fill in after development finishes.

**Final status:**
**PR / Commit:**
**Follow-ups:**
