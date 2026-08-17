# Agent Pipeline — Reference

> **Type:** Reference
> **Audience:** Anyone driving `pnpm motife`; coding agents in skill mode
> **Last updated:** 2026-08-17
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
| `tts [doc.json] --run DIR` | TTS | per-scene narration audio + `audio-manifest.json` + `doc.tts.json` |
| `render [doc.json] --run DIR` | none | MP4 via the `DslPreview` composition (+ narration when the manifest exists) |
| `stills [doc.json] --run DIR` | none | 3 critique key frames per scene (early/mid/late, 960×540 jpeg) |
| `critique --run DIR --iter N` | LLM (vision) | stills → `critique.json` / `critique.md` |
| `revise --run DIR --iter N` | LLM | critique + current doc → corrected `doc.json` |
| `run --prompt "…"` | LLM (+TTS) | full pipeline, bounded critique loop (default ≤2 revisions) |
| `eval` | LLM (+TTS) | all 3 eval concepts end-to-end → `out/eval/<date>/report.md` with a human-scoring table |

Provider selection (generation): `--provider` / `--model` >
`MOTIFE_PROVIDER` / `MOTIFE_MODEL` > defaults in `src/agent/providers.ts`.
Critique has independent `--critique-provider` / `--critique-model`
(default anthropic — must be vision-capable; Groq/xAI vision support is
model-dependent). TTS: `--tts openai|elevenlabs` (default openai);
ElevenLabs additionally needs a voice id (`--voice` or
`ELEVENLABS_VOICE_ID`).

## 3. Run-directory contract

```text
out/runs/<name>/
├── prompt.txt                  # the input concept
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

Rules the layout encodes:

- **Checked-in eval documents are never rewritten.** `src/dsl/docs/*.json`
  are few-shot examples and the frame-pinned regression baseline
  (`manifest.test.ts`); TTS output (`doc.tts.json`) exists only inside run
  directories.
- **`doc.json` is the only editable artifact.** `doc.tts.json` is derived —
  edit `doc.json` and re-run `motife tts`. The narration hash
  (provider+voice+text) means only scenes whose narration changed are
  re-synthesized.
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

OpenAI TTS reuses `OPENAI_API_KEY`. Default model ids live in one table
(`src/agent/providers.ts`) and will drift as vendors ship — override with
flags/env rather than treating the table as authoritative.

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
| Eval concepts + runner | `src/agent/evalConcepts.ts`, `src/agent/commands/eval.ts` |
| TTS providers / synthesis cache / duration backfill | `src/tts/` |
| Frame selection / vision critique / report rendering | `src/critique/` |
| Renderer-side audio sidecar + metadata passthrough | `src/compiler/render/audioManifest.ts`, `previewMetadata.ts`, `DslVideo.tsx` |
