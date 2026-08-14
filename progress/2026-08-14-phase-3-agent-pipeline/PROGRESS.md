# Phase 3 — Agent Pipeline

**Slug:** phase-3-agent-pipeline
**Status:** review
**Ticket:** N/A
**Related plan:** [phase-3-agent-pipeline-silly-soaring-cherny.md](../_plans/phase-3-agent-pipeline-silly-soaring-cherny.md)
**Created:** 2026-08-14
**Updated:** 2026-08-14

---

## Scope

| Scope | Branch | Ticket | Notes |
|---|---|---|---|
| `motife` | `phase-3/agent-pipeline` | N/A |  |

## Background & goals

Phase 3 of motife-plan.md §3: one prompt in, one passing MP4 out, fully
automated — no human in the loop. Builds the agent pipeline on top of the
Phase 2 DSL/compiler interfaces (parseDocument/formatIssues error feedback,
DslPreview render path, renderStill + dslTimeline frame extraction).

Key design points (full detail in the linked plan):

- Multi-provider LLM (Claude / OpenAI / Gemini / xAI / Groq) via Vercel AI
  SDK, all usage confined behind `src/agent/llm.ts`; plus a skill mode where
  a coding agent drives per-stage CLIs itself with no LLM API.
- TTS (OpenAI + ElevenLabs, switchable) backfills per-scene
  `durationInSeconds` via a sidecar audio manifest — the DSL schema is
  untouched and checked-in eval docs are never rewritten (`doc.tts.json`
  lives only in the run directory).
- Critique loop: dslTimeline-selected renderStill frames -> vision critique
  -> revise, bounded at max 2 revision iterations (≤3 renders).
- Single CLI entry: `pnpm motife <generate|validate|tts|render|stills|critique|revise|run|eval>`
  via tsx (`src/agent/cli.ts`), run directory `out/runs/<slug>/` as the
  stage contract.
- Delivery: one big PR, branch `phase-3/agent-pipeline` -> main.

Acceptance: `pnpm motife eval` runs 3 concept prompts end to end with zero
manual intervention, producing 3 MP4s + report.md; `pnpm verify` stays green
on a keyless machine.

## Task list

- [x] Step 1 — Housekeeping: Phase 2 INDEX done, Phase 3 item, dsl-schema.md stale test path fix
- [x] Step 2 — Dependencies + skeleton: remotion add media, AI SDK/tsx/music-metadata, .env.example, motife script, cli.ts parseArgs dispatch
- [x] Step 3 — motife validate (thinnest slice; proves tsx CLI path, unlocks skill mode)
- [x] Step 4 — src/agent/llm.ts + providers.ts + FakeLlmClient
- [x] Step 5 — prompt.ts + generate.ts retry loop + motife generate + tests
- [x] Step 6 — TTS providers + backfill + motife tts + tests
- [x] Step 7 — Audio rendering: DslVideoProps.audio, <Audio> mount (@remotion/media), Root.tsx props passthrough fix
- [x] Step 8 — Render stage: shared bundle/serveUrl, identical inputProps to selectComposition and renderMedia/renderStill; motife render/stills
- [x] Step 9 — Critique: frames/critique/report + revise + tests
- [x] Step 10 — Orchestration: rundir/pipeline + motife run bounded loop
- [x] Step 11 — Eval runner + report.md
- [x] Step 12 — Skill + docs: SKILL.md, docs/agent-pipeline.md, project-overview.md and CLAUDE.md updates
- [x] Step 13 — Verification (keyless verify, generate retry test, skill-mode drill, motife eval acceptance) + open PR

## Work log

### 2026-08-14

- Plan approved (silly-soaring-cherny.md, snapshotted to _plans/); branch phase-3/agent-pipeline created; Phase 2 item closed as done (PR #9 merged). Starting Step 1 (housekeeping) and Step 2 (dependencies + skeleton).
- Steps 1-13 all landed in one pass: `pnpm motife` CLI (9 subcommands, tsx,
  lazy imports), LLM layer (Vercel AI SDK behind `src/agent/llm.ts` only),
  generate/revise retry loop over parseDocument (formatIssues fed back
  verbatim), TTS (OpenAI/ElevenLabs + narration-hash cache + duration
  backfill into derived doc.tts.json), audio sidecar rendering
  (`DslVideoProps.audio`, calculateMetadata passthrough fix), bounded
  critique loop, eval runner, skill mode, docs.
- Verification: `pnpm verify` green keyless (157 tests incl. 17 new
  groups); dry run on jwt-auth.json — validate exit 0, 12 per-scene
  stills (visually spot-checked), 40s MP4 via `motife render`.
- PR opened: https://github.com/FWcloud916/motife/pull/10 -> status review.
  Remaining Phase 3 acceptance (needs API keys, post-merge):
  `pnpm motife eval` + human scoring per out/eval/<date>/report.md.

## Outcome

> Fill in after development finishes.

**Final status:**
**PR / Commit:**
**Follow-ups:**
