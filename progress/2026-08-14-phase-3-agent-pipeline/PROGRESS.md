# Phase 3 — Agent Pipeline

**Slug:** phase-3-agent-pipeline
**Status:** review
**Ticket:** N/A
**Related plan:** [phase-3-agent-pipeline-silly-soaring-cherny.md](../_plans/phase-3-agent-pipeline-silly-soaring-cherny.md)
**Created:** 2026-08-14
**Updated:** 2026-08-15

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

### 2026-08-15

- Coverage review follow-up (same PR): kept @vitest/coverage-v8 +
  `pnpm test:coverage`; added `scripts/audio-smoke.mjs` (keyless
  end-to-end narration-audio render proof — Node-synthesized WAVs, codec
  "wav" render, PCM RMS assertions incl. delaySeconds silence; wired into
  `pnpm verify`); pure-fn tests for providers/rundir/runInputs/llm
  conversion; pipeline DI refactor (`runPipeline(options, stages?)`) + 7
  control-flow tests (clean stop, revise-then-clean, budget exhaustion,
  failed revision keeps cut, failed generation, TTS backfill, serveUrl
  reuse).
- Found & fixed en route: empty-string env vars from .env.example's
  blank-value pattern leaked through `??` in provider/TTS resolution;
  Remotion muxes CBR AAC even for silent compositions, so the audio smoke
  asserts decoded RMS, not track presence.
- Coverage: overall lines 44% -> 52%; src/agent statements 22% -> 76%;
  pipeline.ts 0% -> 99%. Tests 157 -> 186.

- CodeRabbit review round (12 actionable + 4 nitpicks; 15 adopted, docs-date
  partially): Groq default -> openai/gpt-oss-120b (llama-3.3 shutdown
  2026-08-16); engines.node >=22.9 (--env-file-if-exists floor); shared
  integerOption/numberOption validation across all 7 numeric CLI options;
  guarded I/O in tts/revise (+render/stills, same class); coerceJsonText
  suffix-prose strip; frames late>=mid clamp; prompt fewShot NaN guard;
  fakeLlm request snapshots; defaultRunRoot collision nonce; pipeline
  try/finally (report + final.mp4 survive stage crashes) with a proper
  outcome enum (clean/exhausted/revision-failed/aborted); critique drops
  hallucinated sceneIds; createTtsProvider dedup. 192 tests, verify green.

## Outcome

> Fill in after development finishes.

**Final status:**
**PR / Commit:**
**Follow-ups:**
