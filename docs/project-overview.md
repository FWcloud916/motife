# Motife — Project Overview

> **Type:** Explanation
> **Audience:** Developers, AI assistants, and any tooling that needs project context
> **Last updated:** 2026-08-14
>
> How a technical concept description becomes an explainer MP4. Related docs: [motife-plan.md](../motife-plan.md).

---

## 1. Purpose

### 1.1 Core Responsibilities

Given a text description of a technical concept, produce a motion-graphic explainer video. The project owns: the DSL JSON Schema, the DSL→Remotion compiler, the hand-built explainer component library, TTS integration, and the render → critique → revise loop.

### 1.2 Relationship with Other Systems

Depends on an LLM provider for DSL generation and vision-based critique (five interchangeable vendors via the Vercel AI SDK: Anthropic, OpenAI, Google, xAI, Groq — see [agent-pipeline.md](agent-pipeline.md)), a TTS provider for narration audio (OpenAI TTS or ElevenLabs), and Remotion (`@remotion/renderer`, `@remotion/player`) as the sole render target. A coding agent can also replace the LLM entirely ("skill mode" — `.claude/skills/motife-generate/`).

### 1.3 Deprecated / Retired or Not-Yet-Enabled Features

Phase 0 hand-built a 40-second baseline composition (`JwtAuthFlow`) directly with ad-hoc primitives (`visuals.tsx`) to establish a quality bar and a primitive inventory. Phase 1 replaced those primitives with the explainer component library under `src/components/` (`Scene`, `Diagram`, `FlowPulse`, `CodeBlock`, `Terminal`, `Camera`, `StepReveal`, `Callout`, plus a design-token system) and rebuilt `JwtAuthFlow` entirely from it with hand-written props — `visuals.tsx` and the Phase 0 scenes were deleted at that point. Phase 2 added a JSON DSL and a compiler (`src/dsl/`, `src/compiler/`) that interprets a validated document at render time (no codegen step), four more semantic primitives the port required (`Stack`, `Text`, `Meter`, `StepSwitch` — see `docs/primitive-inventory.md`'s "Phase 2 outcome"), and ported all three eval-set videos (`JwtAuthFlow`, `MqBackpressure`, `DbIndexInternals`) to DSL documents under `src/dsl/docs/`. The hand-written TSX scenes (`storyboard.ts`, `sceneRegistry.tsx`, `JwtAuthFlow.tsx`, `scenes/`) were kept side by side with the DSL port only long enough to A/B them pixel-for-pixel, then deleted once the port was confirmed byte-identical — `JwtAuthFlow` (the `<Composition id>`) now means the DSL-backed version, unchanged from the reader's perspective. `ComponentGallery` stays hand-written TSX permanently: it's a component showcase, not an eval-set video, and the only place a fade transition and `CameraTarget` are render-exercised. Phase 3 added the agent pipeline (`src/agent/`, `src/tts/`, `src/critique/`, the `pnpm motife` CLI): prompt→DSL generation with validation-error retry, TTS-measured scene durations (backfilled into a derived `doc.tts.json` inside a run directory — the checked-in documents keep their provisional `durationInSeconds` as few-shot/regression sources), narration audio as a render-time sidecar, and a bounded render→critique→revise loop. Word-level subtitles (`@remotion/captions`) are deferred to Phase 4 polish — the existing per-scene caption band carries narration text for now. A second render target (a custom Rust engine using `vello`/`skia-safe`) is explicitly deferred to Phase 5, conditional on product validation and render cost/speed becoming a bottleneck — and, per Remotion's license, would have to be a clean-room implementation against the DSL spec rather than a port of Remotion's own source (source: [motife-plan.md](../motife-plan.md) §3 Phase 5; Remotion LICENSE.md).

## 2. Tech Stack

- **Language:** TypeScript 5.9.3 (source: [motife-plan.md](../motife-plan.md) §2)
- **Render engine:** Remotion, pinned exact at `4.0.508` — the single render target; also provides `@remotion/player` for web embedding (source: motife-plan.md §1). All `remotion`/`@remotion/*` packages are kept at the identical exact version (no caret ranges); add new ones with `npx remotion add <pkg>`.
- **Runtime:** Node ≥22 (source: `.nvmrc`, `package.json` engines)
- **Package manager:** pnpm 11.8.0
- **Linter:** ESLint 9.19.0 + `@remotion/eslint-config-flat` (Remotion-specific correctness rules, e.g. `deterministic-randomness`, not just style)
- **UI framework:** React 19.2.3
- **Schema validation:** zod, pinned exact at `4.4.3` — the exact version `remotion`/`@remotion/cli` 4.0.508 already resolve as a peer. Defines the DSL schema (`src/dsl/schema.ts`) and its `z.infer`'d TypeScript types; `z.toJSONSchema()` is the machine-readable schema for a future structured-output LLM call.
- **LLM access:** Vercel AI SDK (`ai` + `@ai-sdk/anthropic|openai|google|xai|groq`) — confined to the single file `src/agent/llm.ts` behind a local `LlmClient` interface; text-JSON output validated locally by `parseDocument()` (no provider structured-output modes — the recursive `$ref` schema isn't portable across all five vendors)
- **TTS:** OpenAI TTS (`gpt-4o-mini-tts`) or ElevenLabs (`eleven_multilingual_v2`), each a single `fetch` call (`src/tts/`); durations measured with `music-metadata`
- **Pipeline runtime:** `tsx` runs `src/agent/cli.ts` under Node (the `pnpm motife` script); secrets via Node's `--env-file-if-exists=.env`, no dotenv

**Rationale:** TypeScript + Remotion was chosen so the browser's layout engine absorbs CJK text-layout risk during the current phase, rather than building that from scratch — this is the explicit reason a custom renderer is *not* built now (source: motife-plan.md §4 風險與對策). Rejected alternative: a custom Rust render engine from day one — deferred to Phase 5 until product-market validation holds and render cost or speed becomes the actual bottleneck. Package manager/linter/version choices match the official `template-helloworld` pairing (verified against its `package.json`/`tsconfig.json` at scaffold time) rather than being picked independently.

**Licensing:** Remotion's free tier covers individuals and non-profits (any size) and for-profit organizations with up to 3 people, and explicitly permits commercial video output under those limits. A paid Company License (from ~$100/month) is required if the project is ever operated by a for-profit organization of 4+ people — this includes contractors and partner agencies working on the project, not just direct hires. Motife is currently a personal side project, so the free tier applies with no cost; re-evaluate if headcount grows past 3 or the project moves under a company (source: [Remotion LICENSE.md](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md), [remotion.dev/docs/license/faq](https://www.remotion.dev/docs/license/faq)).

## 3. Architecture Overview

```
Prompt (concept description)
  → LLM produces DSL (JSON, structured output, constrained by JSON Schema)
  → Compiler: DSL → Remotion composition (TypeScript)
  → Explainer component library (hand-built; LLM may only compose, never draw freely)
  → TTS produces narration audio → audio length sets each step's frame count + captions
  → @remotion/renderer headless render
  → renderStill() extracts key frames → vision model critiques → DSL revised → re-render
  → MP4 output
```

### Key Principles

- **LLM (semantic layer)** understands the concept, breaks down the narrative, selects components, and writes narration — it MUST NOT decide coordinates, easing, animation parameters, or layout (source: motife-plan.md §2 分層原則)
- **Compiler (compilation layer)** turns semantics into concrete keyframes and owns the design system — it MUST NOT make content judgments (source: motife-plan.md §2)
- **Component library (presentation layer)** is both the ceiling and the floor of animation quality (source: motife-plan.md §2)
- The **DSL MUST stay renderer-agnostic**: no CSS concepts (no `className`, no `boxShadow`), only semantic fields (e.g. `emphasis: "high"`) — this keeps a future renderer swap open (source: motife-plan.md §2 決策2)
- **Layout MUST be auto-computed** by ELK/dagre from LLM-described topology; the LLM MUST NOT emit coordinates (source: motife-plan.md §2 決策3)
- **Timeline MUST be TTS-driven**: narration audio is generated first, then each step's frame count is derived from it — never the reverse (source: motife-plan.md §2 決策4)

## 4. Directory Structure

```text
motife/
├── src/
│   ├── components/                    # explainer component library — the only import surface
│   │   │                              #   for compositions/** and compiler/render/** (see index.ts barrel)
│   │   ├── index.ts                   # public barrel: tokens, Scene, Stack, Text, Meter, Diagram,
│   │   │                              #   FlowPulse, CodeBlock, Terminal, Camera, StepReveal,
│   │   │                              #   StepSwitch, Callout, ...
│   │   ├── tokens/                    # color/Tone recipes, fontFamily, easing, spacing, fonts.ts,
│   │   │                              #   Measure/Gap tokens
│   │   ├── motion/                    # pure timing/reveal helpers (Window -> frames, step state,
│   │   │                              #   stepWindows())
│   │   ├── icons/                     # semantic IconName registry
│   │   ├── layout/                    # computeLayout() — GraphSpec -> LayoutResult via dagre;
│   │   │                              #   nodeSizing/measureNodes size cards from real text
│   │   └── Scene/ Stack/ Text/ Meter/ Diagram/ FlowPulse/ CodeBlock/ Terminal/ Camera/
│   │       StepReveal/ Callout/
│   ├── dsl/                           # Phase 2: the JSON DSL — schema + hand-authored documents
│   │   ├── schema.ts                  # zod v4 schema; z.toJSONSchema() is the machine-readable form
│   │   ├── types.ts                   # hand-declared DslNode union (TS can't infer the recursive
│   │   │                              #   discriminated union through schema.ts alone)
│   │   └── docs/                      # jwt-auth.json, mq-backpressure.json, db-index.json —
│   │                                   #   the eval set, plus manifest.ts (the only module that
│   │                                   #   imports the raw JSON) and its frame-pin test
│   ├── compiler/                      # Phase 2: DSL -> Remotion, by render-time interpretation
│   │   │                              #   (no codegen step)
│   │   ├── parse.ts                   # parseDocument()/parseDocumentOrThrow() — the ONLY
│   │   │                              #   sanctioned way to produce a DslDocument
│   │   ├── validate.ts                # cross-reference checks zod alone can't express (track
│   │   │                              #   refs, diagram edge refs, camera focus refs, ...)
│   │   ├── errors.ts / zodIssues.ts   # DslIssue/DslIssueCode — the Phase 3 retry-feedback contract
│   │   │                              #   (see docs/dsl-schema.md)
│   │   ├── windows.ts                 # resolveWindowRef() — WindowRef -> Window, the DSL's only
│   │   │                              #   timing resolution step
│   │   ├── timeline.ts                # thin wrapper reusing compositions/timeline.ts unchanged
│   │   └── render/                    # DslVideo/DslSceneView + nodes.tsx's
│   │                                   #   Record<DslNodeType, NodeRenderer> — one renderer per
│   │                                   #   node kind, exhaustiveness-checked at compile time
│   └── remotion/                      # Remotion entry point (CLI entry-point search hits this
│       │                              #   path with zero config; MUST NOT add src/index.ts, see AGENTS.md)
│       ├── index.ts                   # registerRoot(RemotionRoot)
│       ├── Root.tsx                   # <Composition/> registrations; parses every DSL doc at
│       │                              #   module scope (a malformed baseline fails the bundle
│       │                              #   loudly); calls loadFonts() once
│       └── compositions/
│           ├── timeline.ts            # pure scene/transition timing shared by all compositions
│           ├── SceneSeries.tsx        # renders a timeline as a TransitionSeries (cut / fade)
│           ├── videoDefaults.ts       # FPS/WIDTH/HEIGHT shared by the hand-written TSX side
│           │                          #   (ComponentGallery) — DSL documents carry their own
│           └── gallery/               # ComponentGallery — demo composition exercising every
│                                       #   library component; also the only place a fade
│                                       #   transition, a CJK-measured node, and CameraTarget
│                                       #   are rendered, so pnpm smoke covers all three. Stays
│                                       #   hand-written TSX permanently (not an eval-set video)
├── scripts/
│   ├── smoke.mjs                      # render smoke test — layer 3 of `pnpm verify`;
│   │                                   #   smokes every registered composition
│   └── render-dsl.mjs                 # pnpm render:dsl <doc.json> <out.mp4> — the zero-TypeScript
│                                       #   render path: any valid DSL document, no baseline needed
├── public/                            # staticFile() assets (fonts, narration audio when added)
├── out/                                # render output (gitignored)
├── docs/
│   ├── project-overview.md            # this file
│   ├── primitive-inventory.md         # Phase 0 deliverable — Phase 1 component-library spec,
│   │                                   #   Phase 2 outcome (primitives the DSL port required)
│   ├── component-library.md           # Phase 1+2 deliverable — public component API reference
│   └── dsl-schema.md                  # Phase 2 deliverable — the DSL document reference;
│                                       #   doubles as Phase 3's system-prompt source material
└── progress/                          # development progress tracker
```

Phase 3 added three pipeline packages (all plain-Node TypeScript run via `tsx`, covered by `tsc`/eslint/vitest like the rest of `src/`):

```text
├── src/agent/                         # Phase 3: the `pnpm motife` CLI + LLM-facing pipeline
│   ├── cli.ts                         # entry point; lazy per-subcommand imports (validate works keyless)
│   ├── commands/                      # one module per subcommand (generate, validate, tts, render,
│   │                                   #   stills, critique, revise, run, eval)
│   ├── llm.ts                         # the ONLY file touching the Vercel AI SDK (LlmClient interface)
│   ├── prompt.ts / generate.ts        # system-prompt assembly; parseDocument retry loop
│   ├── revise.ts / pipeline.ts        # critique-driven revision; the bounded full loop
│   └── render.ts / rundir.ts          # bundle/select/render with one shared inputProps; run-dir layout
├── src/tts/                           # Phase 3: TTS providers (fetch-only), narration-hash cache,
│                                       #   measured-duration backfill into a DERIVED doc.tts.json
├── src/critique/                      # Phase 3: frame selection (early/mid/late per scene),
│                                       #   vision critique + JSON report, markdown rendering
├── .claude/skills/motife-generate/    # skill mode: a coding agent as semantic layer + critic
```

Full CLI and run-directory contract: [agent-pipeline.md](agent-pipeline.md).

## 5. Domain Models (High-Level)

The DSL document (`src/dsl/schema.ts`'s `dslDocumentSchema`, `z.infer`'d as
`DslDocument`) is the project's one real domain model — everything else
(components, the compiler's render layer, the timeline) is a pure function
over it. Full field-by-field reference: **[docs/dsl-schema.md](dsl-schema.md)**.

### Core Entity Relationships

```
DslDocument
 └─ Scene[]                          (beat: intro | breakdown | walkthrough | summary, fixed order)
     ├─ Track[]                      (optional; named step lists local to one scene)
     │   └─ StepItem[]               (title, detail, weight, outcome)
     └─ content: DslNode             (exactly one root; a tree — most node kinds carry `children`)
         └─ WindowRef                (embedded in most nodes: absolute fraction, or a
                                        {track, step}/{track, steps} reference resolved against
                                        this scene's own Track[])
```

A `DslNode` is one of 14 discriminated variants (`stack`, `text`, `meter`,
`icon`, `pill`, `banner`, `card`, `diagram`, `code`, `terminal`, `camera`,
`cameraTarget`, `steps`, `switch`) — see docs/dsl-schema.md for every
shape. A `diagram` node's own `graph: GraphSpec` (nodes + edges, topology
only, never coordinates) is the one place a second nested "entity graph"
exists inside a `DslNode`.

### Model Details

- **`DslDocument`** is producible only via `parseDocument()`/
  `parseDocumentOrThrow()` (`src/compiler/parse.ts`) — never constructed or
  cast directly, so every instance has passed both zod's structural checks
  and `validate.ts`'s semantic cross-reference checks (track refs, diagram
  edge refs, camera focus refs, beat ordering, step-index ranges, ...).
- **`WindowRef`** is the only timing type in the DSL — no frame numbers
  ever appear in a document. `src/compiler/windows.ts`'s
  `resolveWindowRef()` is the sole place a `WindowRef` becomes a concrete
  `Window` (`{from, to}` fractions), which is the only timing type the
  component library itself understands.
- **`DslIssue`/`DslIssueCode`** (`src/compiler/errors.ts`) is the
  validation error model — 20 codes, each carrying a copy-pasteable
  document `path`, a `message` naming the offending value verbatim, and a
  `fix` naming concrete legal alternatives. This is Phase 3's retry-loop
  contract, not incidental error formatting.

## 6. API / Interface Structure

No network-facing interface exists yet. The current interface surface is local tooling:

- **Remotion CLI** (`pnpm dev` / `pnpm render` / `pnpm still`) — see CLAUDE.md Commands. `pnpm render`/`pnpm still` are hardcoded to the composition id `JwtAuthFlow`, which now resolves to the DSL-backed video (unchanged since Phase 2's cutover — the id survived the TSX-to-DSL swap).
- **`pnpm render:dsl <doc.json> <out.mp4>`** (`scripts/render-dsl.mjs`) — the zero-TypeScript render path: renders any valid DSL document through the one generic `DslPreview` composition, no baseline registration needed. This is the literal proof of motife-plan.md §3 Phase 2's exit criterion (不碰 TypeScript、只改 JSON 就能產出一支完整影片).
- **Composition registry** — each `<Composition id="..." />` in `Root.tsx` is the stable public handle for a video. Currently five: `JwtAuthFlow`, `MqBackpressure`, `DbIndexInternals` (the eval set, all DSL-backed, registered from `src/dsl/docs/manifest.ts` with a literal `durationInFrames` computed at module scope), `ComponentGallery` (hand-written TSX, permanent), and `DslPreview` (the generic ad-hoc-document composition `render:dsl` targets, the only one using `calculateMetadata` for dynamic sizing). This `id` is what `remotion render` and `selectComposition()` address by name.

- **`pnpm motife <subcommand>`** (`src/agent/cli.ts`) — the Phase 3 agent pipeline: `generate` / `validate` / `tts` / `render` / `stills` / `critique` / `revise` / `run` / `eval`. Stages communicate through a run directory under `out/runs/` — see [agent-pipeline.md](agent-pipeline.md) for the full contract.

Phase 4 plans a `@remotion/player`-based web preview page (prompt in → live preview → MP4 download) (source: motife-plan.md §3 Phase 4), but that interface doesn't exist yet.

## 7. Background Jobs & Scheduled Tasks

No job infrastructure — the render → critique → revise loop runs in-process inside `motife run` with a bounded iteration cap (default 2 revisions after the first render, ≤3 renders total; `--max-revisions` overrides). A clean critique (zero error-severity issues) stops the loop early; an exhausted budget still ships the last render with unresolved issues recorded in `report.md`.

## 8. External Service Integrations

- **LLM providers** (generation + vision critique): Anthropic, OpenAI, Google, xAI, Groq — one `LlmClient` interface over the Vercel AI SDK, confined to `src/agent/llm.ts`. Critique defaults to Anthropic (must be vision-capable; Groq/xAI vision support is model-dependent).
- **TTS providers**: OpenAI TTS and ElevenLabs — plain `fetch` calls in `src/tts/`, no vendor SDKs.
- API keys and default-model selection: see [agent-pipeline.md](agent-pipeline.md) §5 and `.env.example`. `pnpm verify` requires no keys — provider construction is lazy, inside CLI handlers only.

## 9. Database / Data Stores

N/A — the project's current design has no server-side datastore; the pipeline is a stateless prompt-to-MP4 transform.

## 10. Environments & Deployment

### Environments

Local development only — macOS, Node ≥22, no CI yet.

### Deployment Pipeline

TBD — not yet designed. Phase 4 lists deployment-shape options (open-source tool / demo site / self-use) as an explicit open decision (source: motife-plan.md §3 Phase 4). `scripts/smoke.mjs` implements the `bundle()` → `selectComposition()` → `renderStill()` pipeline (`renderMedia()` is not used there — the smoke test renders sampled stills, not video); the critique loop's TypeScript sibling of that pipeline is `src/agent/render.ts`.

### Configuration Hierarchy

- `remotion.config.ts` governs the Remotion CLI and Studio only (`pnpm dev`, `pnpm render`). It has **no effect** on `@remotion/renderer`'s SSR APIs.
- Programmatic renders (`scripts/smoke.mjs`, `scripts/render-dsl.mjs`, `src/agent/render.ts`) set equivalent options directly as call arguments to `bundle()`/`renderMedia()`/`renderStill()`.
- Pipeline secrets/config live in `.env` (gitignored; template `.env.example`), loaded only by the `pnpm motife` script via `--env-file-if-exists` — no module reads `process.env` at import time, so everything but the LLM/TTS-calling subcommands works keyless.
- These two MUST be kept in sync by hand — e.g. `remotion.config.ts` sets `Config.setRspack(true)`, and `scripts/smoke.mjs` separately passes `rspack: true` to `bundle()` to match; letting them drift means the CLI and programmatic renders silently use different bundlers.
