# Motife — Project Overview

> **Type:** Explanation
> **Audience:** Developers, AI assistants, and any tooling that needs project context
> **Last updated:** 2026-08-13
>
> How a technical concept description becomes an explainer MP4. Related docs: [motife-plan.md](../motife-plan.md).

---

## 1. Purpose

### 1.1 Core Responsibilities

Given a text description of a technical concept, produce a motion-graphic explainer video. The project owns: the DSL JSON Schema, the DSL→Remotion compiler, the hand-built explainer component library, TTS integration, and the render → critique → revise loop.

### 1.2 Relationship with Other Systems

Depends on an LLM provider for structured-output DSL generation and vision-based critique (vendor: TBD), a TTS provider for narration audio (vendor: TBD), and Remotion (`@remotion/renderer`, `@remotion/player`) as the sole render target.

### 1.3 Deprecated / Retired or Not-Yet-Enabled Features

Phase 0 hand-built a 40-second baseline composition (`JwtAuthFlow`) directly with ad-hoc primitives (`visuals.tsx`) to establish a quality bar and a primitive inventory. Phase 1 replaced those primitives with the explainer component library under `src/components/` (`Scene`, `Diagram`, `FlowPulse`, `CodeBlock`, `Terminal`, `Camera`, `StepReveal`, `Callout`, plus a design-token system) and rebuilt `JwtAuthFlow` entirely from it — `visuals.tsx` and the Phase 0 scenes are deleted; `JwtAuthFlow` now means the component-library version. Its narration copy and provisional scene durations live in `storyboard.ts`, but narration audio is intentionally deferred until Phase 3's TTS-first timeline is implemented. No DSL, compiler, TTS integration, or agent pipeline exists yet. A second render target (a custom Rust engine using `vello`/`skia-safe`) is explicitly deferred to Phase 5, conditional on product validation and render cost/speed becoming a bottleneck — and, per Remotion's license, would have to be a clean-room implementation against the DSL spec rather than a port of Remotion's own source (source: [motife-plan.md](../motife-plan.md) §3 Phase 5; Remotion LICENSE.md).

## 2. Tech Stack

- **Language:** TypeScript 5.9.3 (source: [motife-plan.md](../motife-plan.md) §2)
- **Render engine:** Remotion, pinned exact at `4.0.508` — the single render target; also provides `@remotion/player` for web embedding (source: motife-plan.md §1). All `remotion`/`@remotion/*` packages are kept at the identical exact version (no caret ranges); add new ones with `npx remotion add <pkg>`.
- **Runtime:** Node ≥22 (source: `.nvmrc`, `package.json` engines)
- **Package manager:** pnpm 11.8.0
- **Linter:** ESLint 9.19.0 + `@remotion/eslint-config-flat` (Remotion-specific correctness rules, e.g. `deterministic-randomness`, not just style)
- **UI framework:** React 19.2.3
- **LLM vendor, TTS vendor:** TBD — not yet designed

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
│   ├── components/                    # Phase 1 explainer component library — the only import
│   │   │                              #   surface for compositions/** (see index.ts barrel)
│   │   ├── index.ts                   # public barrel: tokens, Scene, Diagram, FlowPulse,
│   │   │                              #   CodeBlock, Terminal, Camera, StepReveal, Callout, ...
│   │   ├── tokens/                    # color/Tone recipes, fontFamily, easing, spacing, fonts.ts
│   │   ├── motion/                    # pure timing/reveal helpers (Window -> frames, step state)
│   │   ├── icons/                     # semantic IconName registry
│   │   ├── layout/                    # computeLayout() — GraphSpec -> LayoutResult via dagre
│   │   └── Scene/ Diagram/ FlowPulse/ CodeBlock/ Terminal/ Camera/ StepReveal/ Callout/
│   └── remotion/                      # Remotion entry point (CLI entry-point search hits this
│       │                              #   path with zero config; MUST NOT add src/index.ts, see AGENTS.md)
│       ├── index.ts                   # registerRoot(RemotionRoot)
│       ├── Root.tsx                   # <Composition/> registrations; calls loadFonts() once
│       └── compositions/
│           ├── jwt-auth/              # first eval-set video — rebuilt in Phase 1 from
│           │                          #   src/components/ (see progress/2026-08-13-phase-1-...)
│           │   ├── storyboard.ts      # pure data — prototype of the Phase 2 DSL step list
│           │   ├── sceneRegistry.tsx  # SceneId -> component; missing entries are compile errors
│           │   ├── JwtAuthFlow.tsx    # wiring only; zips storyboard x registry into a
│           │   │                      #   TransitionSeries (hard cuts — no transitions configured)
│           │   └── scenes/            # Intro/Breakdown/Walkthrough/Summary, component-library only
│           └── gallery/               # ComponentGallery — demo composition exercising all 8
│                                       #   components, ensures pnpm smoke covers Terminal/Camera
├── scripts/
│   └── smoke.mjs                      # render smoke test — layer 3 of `pnpm verify`;
│                                       #   smokes every registered composition
├── public/                            # staticFile() assets (fonts, narration audio when added)
├── out/                                # render output (gitignored)
├── docs/
│   ├── project-overview.md            # this file
│   ├── primitive-inventory.md         # Phase 0 deliverable — Phase 1 component-library spec
│   └── component-library.md           # Phase 1 deliverable — public component API reference
└── progress/                          # development progress tracker
```

Reserved for later phases, not yet created: `src/dsl/` (Phase 2 JSON Schema), `src/compiler/` (Phase 2 DSL→Remotion compiler), `src/agent/` and `src/tts/` and `src/critique/` (Phase 3).

## 5. Domain Models (High-Level)

TBD — not yet designed. The closest thing to a domain model, the DSL JSON Schema, is a Phase 2 deliverable (source: motife-plan.md §3 Phase 2).

### Core Entity Relationships

TBD — not yet designed.

### Model Details

TBD — not yet designed.

## 6. API / Interface Structure

No network-facing interface exists yet. The current interface surface is local tooling:

- **Remotion CLI** (`pnpm dev` / `pnpm render` / `pnpm still`) — see AGENTS.md Commands.
- **Composition registry** — each `<Composition id="..." />` in `Root.tsx` is the stable public handle for a video (currently one: `JwtAuthFlow`). This `id` is what `remotion render`, `selectComposition()`, and — later — the Phase 2 compiler's emit target all address by name.

Phase 4 plans a `@remotion/player`-based web preview page (prompt in → live preview → MP4 download) (source: motife-plan.md §3 Phase 4), but that interface doesn't exist yet.

## 7. Background Jobs & Scheduled Tasks

N/A — not yet designed. The render → critique → revise loop (Phase 3) will need a bounded iteration cap, but no job infrastructure has been chosen.

## 8. External Service Integrations

TBD — not yet designed. Planned integration points: an LLM provider for structured-output DSL generation and vision-based critique, and a TTS provider for narration audio. Neither vendor is chosen yet.

## 9. Database / Data Stores

N/A — the project's current design has no server-side datastore; the pipeline is a stateless prompt-to-MP4 transform.

## 10. Environments & Deployment

### Environments

Local development only — macOS, Node ≥22, no CI yet.

### Deployment Pipeline

TBD — not yet designed. Phase 4 lists deployment-shape options (open-source tool / demo site / self-use) as an explicit open decision (source: motife-plan.md §3 Phase 4). `scripts/smoke.mjs` implements the `bundle()` → `selectComposition()` → `renderStill()` pipeline (`renderMedia()` is not used there — the smoke test renders sampled stills, not video) and will be reused by Phase 3's critique loop.

### Configuration Hierarchy

- `remotion.config.ts` governs the Remotion CLI and Studio only (`pnpm dev`, `pnpm render`). It has **no effect** on `@remotion/renderer`'s SSR APIs.
- Programmatic renders (`scripts/smoke.mjs`, and later the critique loop) set equivalent options directly as call arguments to `bundle()`/`renderMedia()`/`renderStill()`.
- These two MUST be kept in sync by hand — e.g. `remotion.config.ts` sets `Config.setRspack(true)`, and `scripts/smoke.mjs` separately passes `rspack: true` to `bundle()` to match; letting them drift means the CLI and programmatic renders silently use different bundlers.
