# Agent Pipeline — Reference

> **Type:** Reference
> **Audience:** Anyone driving `pnpm motife`; coding agents in skill mode
> **Last updated:** 2026-08-19
>
> Phase 3's prompt→MP4 pipeline: the `motife` CLI, the run-directory
> contract, and configuration. Schema/document reference:
> [dsl-schema.md](dsl-schema.md).

---

## 1. Two modes, one artifact contract

Every pipeline stage is a `pnpm motife` subcommand that reads and writes a
**run directory** — the contract between stages. That gives two
interchangeable ways to drive it:

- **API mode** — `motife run` (or `motife eval`) orchestrates everything:
  an LLM generates the DSL, a vision model critiques rendered frames.
  Requires API keys in `.env`.
- **Skill mode** — a coding agent (e.g. Claude Code) *is* the semantic
  layer and the vision critic: it writes the DSL itself, runs `validate` /
  `tts` / `render` / `stills`, reads the stills, and edits the document.
  Only a TTS key is needed (or none, with `--no-audio`). See
  [.claude/skills/motife-generate/SKILL.md](../.claude/skills/motife-generate/SKILL.md).

Both modes produce identical run directories, so a run started in one mode
can be continued in the other.

## 2. CLI

`pnpm motife <subcommand> --help` prints per-command options.

| Subcommand | Keys needed | Purpose |
|---|---|---|
| `generate --prompt "…"` | LLM | prompt → validated `doc.json` (formatIssues retry loop, max 4 attempts) |
| `validate <doc.json>` | none | `parseDocument()` + `formatIssues()`; exit 0 valid / 1 invalid |
| `tts [doc.json] --run DIR` | TTS | per-scene narration audio (`--tts-model`/`--tts-instructions` override the voice/model/steering) + `audio-manifest.json` + `doc.tts.json` |
| `render [doc.json] --run DIR` | none | MP4 via the `DslPreview` composition (+ narration when the manifest exists) |
| `stills [doc.json] --run DIR` | none | 3 critique key frames per scene (early/mid/late, 960×540 jpeg) |
| `critique --run DIR --iter N` | LLM (vision) | stills → `critique.json` / `critique.md` |
| `revise --run DIR --iter N` | LLM | critique + current doc → corrected `doc.json` |
| `run --prompt "…"` | LLM (+TTS) | full pipeline, bounded critique loop (default ≤2 revisions) |
| `eval [--set baseline\|stress\|all]` | LLM (+TTS) | a concept set end-to-end → `out/eval/<date>/<set>[-<label>]/report.md` with a human-scoring table ("Eval sets" below) |

Long-running API-mode jobs are resumable from versioned checkpoints:

```bash
pnpm motife run --resume <run-dir> [--retry-failed]
pnpm motife eval --resume <eval-dir> [--retry-failed] [--only <slug>...]
```

Resume runs `paused` and `pending` work by default. A `failed` run/concept
requires `--retry-failed`; completed work is a no-op (no provider or renderer
call). `eval --only` may select only slugs already present in the persisted
concept list. Prompt, set, label, concept order, provider/model, TTS, language,
and revision budget come from state. An explicitly supplied flag or non-empty
`MOTIFE_*` override that disagrees with state exits 2 and asks for a new run.
API keys are deliberately not persisted or compared, so a key can be topped up
or replaced before resume.

Provider selection (generation): `--provider` / `--model` >
`MOTIFE_PROVIDER` / `MOTIFE_MODEL` > defaults in `src/agent/providers.ts`.
Critique has independent `--critique-provider` / `--critique-model`
(default anthropic — must be vision-capable; Groq/xAI vision support is
model-dependent). TTS: `--tts openai|elevenlabs` (default openai);
`--tts-model` / `--voice` / `--tts-instructions` each resolve flag >
`MOTIFE_TTS_MODEL` / `MOTIFE_TTS_VOICE` / `MOTIFE_TTS_INSTRUCTIONS` >
defaults in `src/tts/defaults.ts`. ElevenLabs additionally needs a voice id
(`--voice` > `MOTIFE_TTS_VOICE` > `ELEVENLABS_VOICE_ID`, in that order);
`--tts-instructions` is OpenAI-only (`gpt-4o-mini-tts`'s accent/style
steering) — setting it for ElevenLabs is a hard error, not a silent no-op.

## 3. Run-directory contract

```text
out/runs/<name>/
├── prompt.txt                  # the input concept
├── run-state.json              # atomic/versioned stage checkpoint; no secrets
├── attempts/                   # generate retry history: 01.dsl.json, 01.issues.txt, ...
├── doc.json                    # the LATEST accepted document (pre-TTS) — the canonical editable artifact
├── doc.final.json              # the pre-TTS document that produced the SHIPPED iteration (see below)
├── public/audio/<sceneId>.mp3  # per-scene narration (bundle publicDir → staticFile())
├── audio-manifest.json         # {scenes: {<id>: {src, durationInSeconds, narrationHash, delaySeconds}}}
├── doc.tts.json                # DERIVED: doc.json with durations = lead + measured audio + tail
├── iterations/iter-<n>/
│   ├── video.mp4
│   ├── doc.json                 # snapshot of doc.json AS IT WAS for this iteration's render
│   ├── stills/<sceneId>-<early|mid|late>-f<frame>.jpeg
│   ├── critique.json / critique.md
│   ├── revise-01.dsl.json ...  # revision retry history
│   └── doc.before.json         # doc.json as it was before this iteration's revision
├── final.mp4
└── report.md
```

An eval root similarly owns `eval-state.json`, which records the immutable
batch configuration and every concept from the start (`pending | running |
paused | completed | failed`), including elapsed time, last safe stage, result,
and last error. Both state files use a same-directory temporary file followed
by rename. Unknown schema/contract versions and corrupt state fail before any
provider call. A non-empty directory without state is a legacy run and is not
auto-imported: choose a new label/run directory.

Rules the layout encodes:

- **Checked-in eval documents are never rewritten.** `src/dsl/docs/*.json`
  are few-shot examples and the frame-pinned regression baseline
  (`manifest.test.ts`); TTS output (`doc.tts.json`) exists only inside run
  directories.
- **`doc.json` is the only editable artifact.** `doc.tts.json` is derived —
  edit `doc.json` and re-run `motife tts`. The narration hash
  (provider+voice+model+instructions+text) means only scenes whose inputs
  actually changed are re-synthesized — that includes a `--tts-model` or
  `--tts-instructions` change, not just narration text.
- **`final.mp4` ships the best-scoring iteration, not necessarily the
  last.** A revision can make critique worse, not just fix it — the
  pipeline tracks the iteration with the fewest errors (then fewest
  warnings, then the earliest on a tie) and copies ITS render to
  `final.mp4` and ITS pre-TTS doc to `doc.final.json`. `doc.json` at the
  run root always stays the latest accepted document regardless of which
  iteration shipped — use `doc.final.json` to recover what actually
  produced the delivered video. `report.md` marks the shipped iteration.
- **Timing stays per-scene.** TTS backfills `durationInSeconds =
  0.3 (lead) + measured audio + 0.7 (tail)`; every step window inside a
  scene is a symbolic `WindowRef`, so nothing else needs touching
  (dsl-schema.md "WindowRef — symbolic timing").
- **Audio is a sidecar, not DSL.** The manifest rides through render
  `inputProps` (`DslVideoProps.audio`); an mp3 path is an asset binding
  and would break the DSL's renderer-agnostic rule if it lived in the
  schema.
- **Stage artifacts are hash-bound checkpoints.** TTS, render, stills, and
  critique record their input hashes. Resume reuses an artifact only when the
  hash matches and the expected file is present/non-empty; otherwise it restarts
  at that stage. Accepted generation/revision JSON and accepted critique output
  are checkpointed before their ordinary artifact files, avoiding a repeated
  paid call after a later local write failure.
- **TTS is durable per scene.** Each completed MP3 is measured and immediately
  added to an atomically rewritten `audio-manifest.json`. If scene 3 pauses on
  quota, scenes 1–2 remain reusable; resume uses the narration hash to synthesize
  only missing or changed scenes.

## 4. The critique loop (API mode)

`motife run` renders, samples 3 frames per scene (`src/critique/frames.ts`
picks early/mid/late from `dslTimeline()`), sends them with per-scene
narration context to the vision model, and parses a JSON issue report
(overlap / overflow / offscreen / contrast / empty / caption / pacing).
Zero **error**-severity issues → done. Otherwise the critique markdown and
the current document go back to the generation LLM for a full-document
revision (same `parseDocument()` retry loop as generation), TTS refreshes
changed scenes, and it re-renders — at most `--max-revisions` times
(default 2, so ≤3 renders). A run that exhausts the budget still ships
`final.mp4`, but not necessarily the last render: the pipeline tracks
every iteration's error/warning counts and ships whichever iteration
scored best (a revision can regress layout, not just fix it), tying to the
earliest iteration when scores match — see the run-dir contract above.
Only a document that never validates fails the run.

### Eval sets — baseline vs. stress

`motife eval --set <name>` runs a named CONCEPT SET (`src/agent/conceptSets.ts`)
through the loop above, one `runPipeline()` call per concept, sequentially:

| Set | Concepts | Source | Purpose |
|---|---|---|---|
| `baseline` (default) | 3 | `src/agent/evalConcepts.ts` | Phase 3's acceptance run; also the regression check after any component/compiler fix — Phase 4's acceptance criterion 1 |
| `stress` | 12 | `src/agent/stressConcepts.ts` | Phase 4's acceptance criterion 2: ≥10 concepts outside the eval set, ≥8 producing a passing MP4. Deliberately covers 4 axes the 3 baselines under-exercise (tree/graph depth, code/terminal, meter/pacing, multi-step Diagram+Camera) — see the file's header comment |
| `all` | 15 | both, concatenated | `--only` across both sets; not an acceptance run on its own (baseline and stress are scored against different bars — keep them as separate `--set` invocations and separate archived reports) |

`--only <slug>` (repeatable) filters WITHIN the selected set, not across all
sets — `--set baseline --only binary-heap` is an error naming baseline's
own slugs, not a silent empty result. Every concept still gets the same 3
few-shot examples embedded in the system prompt (`prompt.ts` inlines all of
`src/dsl/docs/*` regardless of `--set`) — the stress set's whole premise is
measuring generalization *given* those examples, so `motife eval` never
varies `--few-shot` itself.

`--label <name>` distinguishes multiple same-day, same-set runs (a
screening pass vs. a full pass) — it becomes part of the output directory
(`out/eval/<date>/<set>-<label>/`), never a report filename collision.
`report.md` is rewritten after every concept finishes, not just at the
end, so a crash or a killed process partway through a multi-hour run
doesn't lose the concepts that already completed.

The report is derived from `eval-state.json`, so pending/paused/failed concepts
also appear from the beginning with their last safe stage and an exact resume
command. A provider interruption classified as recoverable (quota/credits,
billing, final 429, 401/403, network failure, or 5xx) checkpoints the current
run, pauses the entire batch before the next concept, and exits 75. Other
provider 4xx responses are fatal configuration/request errors and stop the
batch. Document validation, rendering, and other local failures mark only that
concept failed; the batch continues, and `--retry-failed` can later retry it
from its last checkpoint. The AI SDK retains responsibility for its own LLM
retry policy; Motife does not stack another implicit LLM retry, and TTS retries
only when the operator explicitly resumes.

`SIGINT` is handled as an operator pause: the active run and eval concept are
written as `paused` before the command exits 130, and no later stage or concept
is started. If the process is killed before that handler can finish, the next
state read treats stale `running` records as interrupted/paused and preserves
their recorded stage for resume.

**Cost/time reality** (from the actual Phase 3 baseline run —
`progress/2026-08-14-phase-3-agent-pipeline/eval-report-2026-08-15.md`:
248s / 313s / 1102s per concept, the heaviest concept ≈367s/iteration; the
pipeline is sequential and each concept re-bundles Remotion once):

| Pass | Flags | Renders/concept | Baseline (3) | Stress (12) |
|---|---|---|---|---|
| Screening | `--no-audio --max-revisions 1` | ≤2 | a few minutes | ~1.5–2.5 h |
| Full | default (≤2 revisions), audio on | ≤3 | ~15 min | ~2.5–4.5 h |

A screening pass triages crashes and non-convergent concepts cheaply
before paying for TTS + the full critique-loop vision cost on a full pass.
Recommended runbook:

```bash
# 1. screening — cheap, no audio, finds concepts that crash or never converge
pnpm motife eval --set stress --label screen --no-audio --max-revisions 1

# 2. full pass — confirm the report's TTS line says elevenlabs before
#    scoring 旁白 (the code default is OpenAI alloy; the A/B winner only
#    lives in the main checkout's .env — see Configuration below)
pnpm motife eval --set stress

# 3. Phase 4 acceptance criterion 1 — baseline re-run after the PR 2/3/4 fixes
pnpm motife eval --set baseline
```

## 5. Configuration

Copy `.env.example` → `.env` (gitignored; loaded via Node's
`--env-file-if-exists`, so a keyless machine stays fully functional for
`validate`/`render`/`stills` and `pnpm verify` never needs secrets).

| Variable | Used by |
|---|---|
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` / `XAI_API_KEY` / `GROQ_API_KEY` | generation + critique (whichever providers you select) |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | ElevenLabs TTS |
| `MOTIFE_PROVIDER`, `MOTIFE_MODEL` | default generation provider/model |
| `MOTIFE_CRITIQUE_PROVIDER`, `MOTIFE_CRITIQUE_MODEL` | default critique provider/model |
| `MOTIFE_TTS` | default TTS provider |
| `MOTIFE_TTS_MODEL` | default TTS model (either provider) |
| `MOTIFE_TTS_VOICE` | default TTS voice — outranks `ELEVENLABS_VOICE_ID` |
| `MOTIFE_TTS_INSTRUCTIONS` | OpenAI `gpt-4o-mini-tts` accent/style steering (openai only; part of the narration hash — editing it re-synthesizes every cached scene) |

OpenAI TTS reuses `OPENAI_API_KEY`. Default LLM model ids live in one
table (`src/agent/providers.ts`); default TTS model/voice ids live in a
separate one (`src/tts/defaults.ts`) — both will drift as vendors ship,
override with flags/env rather than treating either table as authoritative.

**zh-TW narration accent (Phase 3 failure mode 3, resolved via A/B):** the
code default stays OpenAI `alloy` — a safe, zero-config fallback — but the
Phase 4 A/B (`progress/2026-08-17-phase-4-polish-and-publish/tts-ab/`)
picked ElevenLabs' "Xu Ming" (`taiwan mandarin`) voice over it. That
verdict is NOT a code default, because an ElevenLabs voice id only works
once it's in *your* account's voice library — see `.env.example`'s
commented-out override block for the exact env vars.

## 6. Implementation map

| Concern | Module |
|---|---|
| CLI entry + subcommand dispatch (lazy imports) | `src/agent/cli.ts`, `src/agent/commands/` |
| LLM abstraction (the ONLY AI-SDK-touching file) | `src/agent/llm.ts` (+ `fakeLlm.ts` for tests) |
| Provider/model resolution + defaults | `src/agent/providers.ts` |
| System prompt (dsl-schema.md + JSON Schema + few-shot) | `src/agent/prompt.ts` |
| Generate/revise retry loop over `parseDocument()` | `src/agent/generate.ts`, `src/agent/revise.ts` |
| Run-dir layout | `src/agent/rundir.ts`, `src/agent/runInputs.ts` |
| Bundle/select/renderMedia/renderStill (one shared `inputProps`) | `src/agent/render.ts` |
| Full loop orchestration | `src/agent/pipeline.ts` |
| Eval concepts, sets, report rendering + runner | `src/agent/evalConcepts.ts`, `src/agent/stressConcepts.ts`, `src/agent/conceptSets.ts`, `src/agent/evalReport.ts`, `src/agent/commands/eval.ts` |
| TTS providers / model+voice resolution / defaults / synthesis cache / duration backfill | `src/tts/` |
| Frame selection / vision critique / report rendering | `src/critique/` |
| Renderer-side audio sidecar + metadata passthrough | `src/compiler/render/audioManifest.ts`, `previewMetadata.ts`, `DslVideo.tsx` |
