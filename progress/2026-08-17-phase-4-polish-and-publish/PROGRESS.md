# Phase 4 — 打磨與發布 (Polish and Publish)

**Slug:** phase-4-polish-and-publish
**Status:** in-progress
**Ticket:** N/A
**Related plan:** [phase-4-polish-and-publish-jaunty-knitting-locket.md](../_plans/phase-4-polish-and-publish-jaunty-knitting-locket.md)
**Created:** 2026-08-17
**Updated:** 2026-08-19

---

## Scope

| Scope | Branch | Ticket | Notes |
|---|---|---|---|
| `motife` | TBD | N/A |  |

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
   dimension across the whole eval. **RESOLVED (PR 4, 2026-08-18):** A/B
   winner is ElevenLabs "Xu Ming" (`A3T1GnLHdn0WL5w4TMtq`, taiwan mandarin,
   `eleven_multilingual_v2`) over OpenAI alloy — see `tts-ab/LISTEN.md`.
   Applied as a `.env`-level override (main checkout), not a code default,
   since the voice id is account-specific; `.env.example` documents the
   override.
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

**Resolution (folded into PR 2 after user review):** the initial PR 2 cut
deferred this to a PR 3 `validate.ts` rule to keep the diff scoped, but the
user correctly pushed back — PR 2's purpose is to fix the camera failure
mode, and math-layer clamps alone leave the user-visible clipping in place.
So PR 2 now also makes Camera measure its REAL box (wrapper
`offsetWidth`/`offsetHeight`) and run the clamps against that, using the
exact DOM-measurement discipline `CameraTarget` already proved safe:
`fontsReady()` gate (fonts are the only async resource that moves layout),
an eagerly-taken `delayRender` handle so no frame is captured before the
first post-fonts measurement, re-measure every commit with dedupe.
`useVideoConfig()` survives only as the never-screenshotted pre-measurement
fallback. Verified by re-rendered stills: db-index's wide shot now shows
the complete tree (root→internal×2→leaf×2→Table Row, no clipping), the
Table Row close-up — previously mostly off-frame — is perfectly framed, and
ComponentGallery's CameraDemo final frame is correctly framed in its real
1728×774 box.

**What genuinely remains for PR 3+ (legibility, not correctness):** a
cramped Camera now renders complete-but-*small* (db-index's wide shot fits
the whole 766×1200 tree into a ~541px-tall box ≈ 0.34×). Whether that
layout choice is legible is a DSL-authoring question — a `validate.ts`
density lint (warn when a `camera` shares a Stack with tall siblings)
remains worth adding alongside the planned Diagram footprint lint, now as
quality hardening rather than the primary fix.

### PR 4 finding: I cannot listen to audio, so PR 4 ships infra + a harness, not a chosen winner

Unlike PR 2/PR 3 (both of which I could fully verify myself — DOM inspection,
re-rendered stills, `motife validate` output), judging TTS accent
naturalness is an irreducibly human perceptual task with no tool available
to me in this session. So PR 4's scope is deliberately split:

- **What's fully done and verified:** `--tts-model`/`--tts-instructions`
  reach the API (proven by `openai.test.ts`/`elevenlabs.test.ts` asserting
  the actual request body via a typed `fetch` mock, not just that the code
  compiles); `narrationHash` now includes model+instructions and switching
  either correctly invalidates the cache (`synthesize.test.ts`); a second,
  previously-unreported bug fixed alongside it — the old newline-joined hash
  could collide across the instructions/narration field boundary once
  instructions became free multi-line text (`manifest.test.ts`'s injection
  test guards this permanently). `pnpm verify` green (282 tests, keyless).
- **What's deliberately NOT done:** picking a new default voice/model.
  `src/tts/defaults.ts` still ships `alloy`/`gpt-4o-mini-tts` — the exact
  Phase 3 configuration that scored 3/5 on 旁白. Changing it without
  listening would just be guessing.
- **The handoff:** `progress/2026-08-17-phase-4-polish-and-publish/tts-ab/`
  — a fixture doc (4 scenes, narration copied verbatim from the 3 baselines:
  clean-Mandarin control, loanword-dense, worst-case code-switching, closing
  cadence), a 7-candidate matrix (OpenAI × 4 voices × with/without zh-TW
  accent-steering instructions, plus 2 ElevenLabs candidates) driven through
  the real `pnpm motife tts` CLI, and a `LISTEN.md` scoring sheet. Listen,
  pick a winner, and PR 4b is a small, mechanical edit to `defaults.ts` (+ a
  policy call on whether zh-TW instructions become an opt-in `.env`
  recommendation — flagged in the harness README, since a hardcoded
  zh-TW default would be wrong for `--lang en`).

**Resolution (2026-08-18, same day, folded into this PR rather than a
separate 4b — PR #16 hadn't merged yet):** all 7 candidates were generated
(ElevenLabs' account had zero Chinese voices; two `taiwan mandarin` ones
were found in the *shared* voice library and added to the account after
explicit user confirmation, since that's a real third-party account
mutation) and delivered to the user as files. User filled `LISTEN.md`:
winner is ElevenLabs "Xu Ming" — best 口音自然度 (4 vs OpenAI's 3 across
every candidate, with or without accent-steering instructions). This
answers R8 from PR 4's original risk list ("voice, not instructions,
turned out to matter") and, less expectedly, crossed the vendor boundary
entirely — none of the OpenAI instructions variants closed the gap.
Applied as an env-level override on the main checkout's `.env` (not the
code default — an ElevenLabs voice id is account-specific, so baking it
into `src/tts/defaults.ts` would break any environment without that exact
voice added to its own library) plus a commented-out recipe in
`.env.example` and a note in `docs/agent-pipeline.md`. **Failure mode 3 is
now resolved** — all three Phase 3 failure modes are closed as of this PR.

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
| 2 | Camera clamp + measured viewport | Zoom fit-clamp + per-frame translation clamp, both against Camera's MEASURED real box (not the composition size) — full fix for failure mode 2, incl. the deeper viewport-assumption cause found mid-verification; see finding below | **Yes** | done ([#14](https://github.com/FWcloud916/motife/pull/14)) |
| 3 | Diagram overflow bounding | `SafeAreaContext` real-pixel cap on standalone Diagram (component-layer guarantee) + 4 `validate.ts` lints: `diagram_label_too_long`/`diagram_label_clipped`(error)/`diagram_too_many_nodes` (estimated text/node-count budgets) + `camera_content_too_tall` (the density-lint hardening — height-only, estimation-immune) | **Yes** | done ([#15](https://github.com/FWcloud916/motife/pull/15)) |
| 4 | TTS model wiring + A/B | `--tts-model`/`--tts-instructions`/`MOTIFE_TTS_*` wired; narration-hash includes model+instructions; A/B run complete — winner ElevenLabs "Xu Ming", applied as an `.env` override (see finding below) | Audio re-synthesis only (gitignored `out/` only; zero baseline audio exists) | done ([#16](https://github.com/FWcloud916/motife/pull/16)) |
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
- [x] PR 2 — Full regression (first cut): `pnpm verify` green, frame pins green, re-rendered db-index stills + live Studio DOM inspection — math verified correct against the assumed 1920×1080, but db-index's wide shot still clipped → deeper viewport-assumption cause diagnosed (see finding above)
- [x] PR 2 — Open PR
- [x] PR 2 (follow-up after user review) — Camera measures its real box (`fontsReady` + `delayRender` + per-commit re-measure with dedupe, the proven CameraTarget pattern) and clamps against it; re-rendered stills confirm db-index wide shot shows the complete tree, Table Row close-up fully framed, gallery CameraDemo correct; `pnpm verify` green again
- [x] PR 3 — `src/components/Scene/safeArea.ts` (`computeSafeArea`, shared HEADER_CLEARANCE/CAPTION_CLEARANCE/CONTENT_EDGE_PAD) + `SafeAreaContext`; Scene.tsx provides it (padding values unchanged, now sourced from the shared module)
- [x] PR 3 — `src/components/layout/estimateNodeSizes.ts` (pure, DOM-free mirror of measureNodes.ts: CJK/fullwidth-aware `estimateTextWidth`, `estimateGraphNodeSizes`); barrel exports for both new modules
- [x] PR 3 — Diagram.tsx standalone `fit` cap (`maxHeight: safeArea?.height`, `maxWidth: "100%"`) — camera-nested path untouched
- [x] PR 3 — `validate.ts`: `SceneLayoutBudget` threaded through `validateScene → walkNode → validateCamera/validateSwitch`; `diagram_label_too_long`/`diagram_label_clipped`/`diagram_too_many_nodes` in `validateDiagram`; `camera_content_too_tall` in `validateCamera`'s existing subtree collection (height-only, computeLayout on estimated sizes — estimation-immune since TB height doesn't depend on width estimates)
- [x] PR 3 — `errors.ts` 4 new `DslIssueCode`s; `parse.test.ts` 4 new CASES + exhaustiveness table; confirmed VALID_DOC fixture stays zero-warning (formatIssues snapshot unchanged)
- [x] PR 3 — `docs/dsl-schema.md` Diagram "Layout budgets" note + Camera note corrected (was still describing pre-PR-2 behavior) + validation table +4 rows ("All 24 codes") + Last-updated; `docs/component-library.md` Scene/Diagram/Camera sections + "Open items" entries updated to RESOLVED
- [x] PR 3 — Full verification: `pnpm verify` green (245 tests + smoke + audio smoke); re-rendered baseline stills pixel-identical to pre-PR (cap never binds, verified by eye); `pnpm motife validate` on all 3 baselines — jwt/mq clean, db-index emits exactly the intended `camera_content_too_tall` warning (~1200px vs ~720px, exit 0); synthetic oversized doc demonstrates all 4 new lints firing with actionable non-pixel fix text
- [x] PR 3 — Open PR
- [x] PR 4 — `TtsProvider` gains `model`/`instructions` (both narration-hash inputs); `createOpenAiTts`/`createElevenLabsTts` thread `model` (already accepted, never wired) + OpenAI gets a net-new conditional `instructions` field
- [x] PR 4 — New `src/tts/defaults.ts` (`DEFAULT_TTS_MODELS`, `DEFAULT_OPENAI_TTS_VOICE`) — dependency-free leaf module, same discipline as `providers.ts`'s `DEFAULT_MODELS`
- [x] PR 4 — `resolveTtsModel`/`resolveTtsVoice`/`resolveTtsInstructions` (flag > env > default, mirroring `providers.ts`); `MOTIFE_TTS_MODEL`/`MOTIFE_TTS_VOICE`/`MOTIFE_TTS_INSTRUCTIONS`; ElevenLabs + instructions throws a named error
- [x] PR 4 — `narrationHash` → object param + JSON-tuple encoding (fixes the reported model-not-hashed bug AND a newline-collision bug found while implementing)
- [x] PR 4 — `--tts-model`/`--tts-instructions` wired into `run.ts`/`tts.ts`/`eval.ts`; `eval.ts`'s TTS provider hoisted out of the per-concept loop; `renderEvalReport` gains a self-describing TTS config line
- [x] PR 4 — 5 new test files (`defaults` via table-completeness, `manifest.test.ts` incl. pinned-hash canary + injection regression, `provider.test.ts` all 4 resolvers + precedence, `openai.test.ts`/`elevenlabs.test.ts` asserting actual request bodies via typed `fetch` mocks) — all keyless
- [x] PR 4 — Docs: `docs/agent-pipeline.md` (CLI table, provider-selection paragraph, hash description, env table, TTS-defaults-location correction, implementation map), `.env.example` (3 new keys + precedence comment), `.claude/skills/motife-generate/SKILL.md`; Last-updated bumped
- [x] PR 4 — A/B harness (`tts-ab/{fixture.doc.json,README.md,LISTEN.md}`) — defaults left unchanged; see finding above
- [x] PR 4 — Full verification: `pnpm verify` green (282 tests), `motife {run,tts,eval} --help` show the new flags, fixture doc validates clean
- [x] PR 4 — Open PR
- [x] PR 4 — A/B run: all 7 candidates generated (incl. adding 2 ElevenLabs zh voices to the account after confirmation) and delivered; user scored `LISTEN.md`, winner is ElevenLabs "Xu Ming" — applied as a `.env` override (main checkout) + documented in `.env.example`/`docs/agent-pipeline.md`; failure mode 3 marked resolved — folded into PR #16 rather than a separate 4b since it hadn't merged yet

## Work log

### 2026-08-17

-
- Created full Phase 4 breakdown (8 PRs) with baseline re-render requirements, failure-mode queue with per-concept attribution, known deferrals (word-level captions, TreeDiagram, pipeline log persistence), user decisions (TTS A/B both providers, publish-form deferred), and a proposed Phase 4 acceptance criterion. This session scoped to PR 0 (this item) + PR 1 (keep-best/critique archival) + PR 2 (Camera clamp).
- PR 0 opened: https://github.com/FWcloud916/motife/pull/12 (branch phase-4/progress-tracking-kickoff) -- motife-plan.md Phase 4 acceptance criterion added, Phase 3 Outcome placeholder fixed, this progress item created. progress/ tracker check passes. PR 1 and PR 2 will each get their own branch/PR once this one merges.
- PR 1 implemented: pipeline.ts tracks best-scoring iteration (fewest errors, then warnings, then earliest on a tie) and ships it as final.mp4/doc.final.json instead of always the last render; per-iteration doc.json snapshots added to rundir.ts; IterationSummary carries critique issues, inlined into eval.ts's report.md. Tests: 3 new/updated pipeline.test.ts cases covering tie-break-to-earlier, regression-then-recovery (1->2->1), and strict-improvement (2->1) scenarios, plus rundir.test.ts field coverage. docs/agent-pipeline.md run-dir contract + critique-loop section updated, Last-updated bumped. pnpm verify green (196 tests, keyless).
- PR 1 opened: https://github.com/FWcloud916/motife/pull/13 (branch phase-4/keep-best-iteration).
- PR 1 merged: https://github.com/FWcloud916/motife/pull/13. Starting PR 2 (Camera clamp) on branch phase-4/camera-clamp.
- PR 2 implemented: extracted Camera.tsx's zoom/pan math into pure src/components/Camera/cameraMath.ts (zoom clamp per shot against its focus rect + margin; translation clamp per frame against the overall content bounds, post-lerp). 27 unit tests. pnpm verify green (223 tests). IMPORTANT finding during regression verification: live-inspected the actual DOM transform in Remotion Studio at db-index's wide shot -- matches the hand-computed clamp exactly (0.7933x, correctly fitting the 1200px-tall diagram into the 1920x1080 assumption) -- but the still-rendered frame still clips the leaf/table rows, because Camera's ACTUAL rendered box in that scene is ~1728x541px (Scene header/caption clearance + a sibling steps card above it in the same Stack), not the 1920x1080 useVideoConfig() figure Camera's math assumes. This is pre-existing (identical on pre-PR-2 code), already documented in docs/component-library.md's Camera section and its Phase 3 open-items list, and IS the real mechanism behind failure mode 2 -- more precisely diagnosed now. Full writeup + recommendation (a validate.ts rule, folded into PR 3) added to this item's Background section.
- PR 2 opened: https://github.com/FWcloud916/motife/pull/14 (branch phase-4/camera-clamp).
- PR 2 follow-up (user review: the PR should actually fix the camera problem, not just the math half): Camera now measures its real wrapper box via the proven CameraTarget pattern (fontsReady gate + eager delayRender handle + per-commit re-measure with dedupe) and runs both clamps against the measured viewport; useVideoConfig() remains only as the never-screenshotted pre-measurement fallback. Re-rendered db-index stills: wide shot now shows the complete tree (was: leaf/table rows clipped), Table Row close-up fully framed (was: mostly off-frame), gallery CameraDemo final frame correct. pnpm verify green. docs/component-library.md Camera section rewritten (measured viewport, remaining legibility caveat); the PR 3 validate.ts rule is downgraded from primary fix to optional density-lint hardening.
- PR 2 merged: https://github.com/FWcloud916/motife/pull/14 (merge commit 86b5bac). This session's scope (PR 0-2) is complete; next up is PR 3 (Diagram overflow bounding + validate.ts lints) in a future session. User policy update: pure progress-tracking closeout commits go directly to main from now on, no PR.
- PR 3 implemented: safeArea.ts + SafeAreaContext (Scene provides the real content box, no behavior change to existing padding); estimateNodeSizes.ts (pure CJK-aware text-width estimator mirroring measureNodes.ts); Diagram.tsx standalone fit now caps at the safe area (letterbox, never clip; camera-nested untouched); validate.ts gains 4 layout-budget lints threaded via a new SceneLayoutBudget param (diagram_label_too_long/clipped/too_many_nodes on validateDiagram, camera_content_too_tall on validateCamera's existing subtree collection). Calibrated thresholds against real dagre runs + hand-measurement of all 3 baseline docs before writing any code (shrink-factor thresholds were ruled out -- baseline content legitimately sits at 0.34-0.47x; text-width/node-count/camera-height were the clean separators). pnpm verify green (245 tests); baseline smoke stills re-rendered pixel-identical (cap never binds anywhere, as calibrated); pnpm motife validate confirms jwt/mq clean and db-index emits exactly the intended camera_content_too_tall warning; a synthetic oversized doc demonstrated all 4 new lints firing with actionable fix text. docs/dsl-schema.md and docs/component-library.md updated, including fixing a stale pre-PR-2 Camera description in dsl-schema.md noticed along the way.
- PR 3 opened: https://github.com/FWcloud916/motife/pull/15 (branch phase-4/diagram-overflow-bounding). Independently re-verified before merge (fresh session, no reliance on prior notes): re-ran pnpm verify (245 tests + smoke + audio smoke, all green), ran `motife validate` by hand on all 3 baselines (jwt/mq exit 0 clean, db-index exit 0 with exactly the intended camera_content_too_tall warning), and read every diff hunk end to end (errors.ts, validate.ts, Diagram.tsx, estimateNodeSizes.ts, safeArea.ts, parse.test.ts, both docs, barrel exports) -- matches the PR description precisely, no discrepancies found.
- PR 3 merged: https://github.com/FWcloud916/motife/pull/15 (merge commit 7fbf2b9). Failure modes 1 (Diagram overflow) and 2 (Camera framing) are now both fully fixed; only failure mode 3 (TTS accent, PR 4) remains from the original Phase 3 queue. Next up: PR 4 (TTS model wiring + OpenAI/ElevenLabs A/B) in a future session.

### 2026-08-18

- PR 4 implemented: TtsProvider gains model + instructions (both narration-hash inputs); createOpenAiTts/createElevenLabsTts thread model (already accepted, never wired) and OpenAI gets a net-new conditional instructions field (omitted entirely for models that reject it, e.g. tts-1). New src/tts/defaults.ts centralizes DEFAULT_TTS_MODELS/DEFAULT_OPENAI_TTS_VOICE as a dependency-free leaf module. New resolveTtsModel/resolveTtsVoice/resolveTtsInstructions mirror providers.ts's flag>env>default pattern (MOTIFE_TTS_MODEL/MOTIFE_TTS_VOICE/MOTIFE_TTS_INSTRUCTIONS); ElevenLabs + instructions throws a named error instead of silently dropping it. narrationHash changed from positional args + newline-joining to an object param + JSON-tuple encoding -- fixes both the reported bug (model wasn't hashed, so switching models silently reused cached audio) and a latent one found while implementing (newline-joined instructions/narration could collide across the field boundary). --tts-model/--tts-instructions wired into run.ts/tts.ts/eval.ts; eval.ts's TTS provider hoisted out of the per-concept loop (stateless, fails fast, lets the report record it) and renderEvalReport now has a TTS config line -- an eval report is now self-describing the same way PR 1 made critique issues self-describing. 5 new test files (defaults covered via provider.test.ts's table-completeness case; manifest.test.ts has a pinned-hash canary + injection-collision regression test; provider.test.ts covers all 4 resolvers + precedence; openai.test.ts/elevenlabs.test.ts assert actual request bodies via a typed fetch mock, proving the flags really reach the wire) -- all keyless (vi.stubEnv + stubbed fetch, no network). pnpm verify green (282 tests). Defaults left UNCHANGED (alloy/gpt-4o-mini-tts) on purpose -- I have no audio-listening capability, so I cannot judge accent naturalness myself. Shipped a ready-to-run A/B harness instead (progress/2026-08-17-phase-4-polish-and-publish/tts-ab/: fixture.doc.json with 4 scenes' narration copied verbatim from the 3 baselines -- clean-Mandarin control, loanword-dense, worst-case code-switching, closing cadence -- a 7-candidate matrix in README.md using the real motife tts CLI, and a LISTEN.md scoring sheet). User listens, picks a winner, and a small PR 4b edits src/tts/defaults.ts (and decides whether zh-TW instructions become an opt-in .env recommendation or stay purely manual -- flagged as a real policy question, not a one-line change, since a hardcoded zh instruction default would be wrong for --lang en).
- PR 4 opened: https://github.com/FWcloud916/motife/pull/16 (branch phase-4/tts-model-wiring).
- TTS A/B candidates generated and delivered: ran all 7 candidates in tts-ab/README.md's matrix through the real pnpm motife tts CLI (sourcing the main checkout's .env inline, no secrets copied into the worktree). ElevenLabs account had zero Chinese voices; found two labeled 'taiwan mandarin' in ElevenLabs' shared voice library (Xu Ming, Roy - Taiwanese Youth) via the /v1/shared-voices API, asked the user before adding them to their account (a real third-party account mutation), user approved both, added via /v1/voices/add. All 28 mp3s (7 candidates x 4 fixture scenes) generated successfully and sent to the user directly as files for listening. tts-ab/README.md and LISTEN.md updated with the actual voice ids used (replacing the <ZH_VOICE_ID> placeholder) so the harness is reproducible. Audio files themselves are gitignored (out/tts-ab/), not committed -- only the harness docs were updated. Next: user listens and fills LISTEN.md, then a small PR 4b picks the winner.

### 2026-08-19

- TTS A/B resolved same-day: user filled LISTEN.md, winner is ElevenLabs 'Xu Ming' (A3T1GnLHdn0WL5w4TMtq, taiwan mandarin, eleven_multilingual_v2) -- beat every OpenAI candidate (with and without accent-steering instructions) on accent naturalness. Applied as a .env-level override on the main checkout (MOTIFE_TTS=elevenlabs, ELEVENLABS_VOICE_ID=A3T1GnLHdn0WL5w4TMtq, MOTIFE_TTS_MODEL=eleven_multilingual_v2) -- deliberately NOT a src/tts/defaults.ts code default, since the voice id only works once added to the specific ElevenLabs account's library (verified: the account had zero Chinese voices until two taiwan-mandarin candidates were found via the shared voice library and added after explicit user confirmation). .env.example documents the override as a commented-out recipe; docs/agent-pipeline.md's Configuration section records the decision; tts-ab/LISTEN.md marks itself done. All three Phase 3 failure modes are now resolved (1: PR 3, 2: PR 2, 3: this). Folded into PR #16 (still open) rather than a separate PR 4b.
- PR 4 merged: https://github.com/FWcloud916/motife/pull/16 (merge commit c788a9d). All three Phase 3 failure modes are now resolved (1: Diagram overflow, PR 3 / #15; 2: Camera framing, PR 2 / #14; 3: TTS accent, PR 4 / #16 -- winner ElevenLabs Xu Ming, applied as an .env override). Next up: PR 5 (10+ concept stress test) in a future session.

## Outcome

> Fill in after development finishes.

**Final status:**
**PR / Commit:**
**Follow-ups:**
