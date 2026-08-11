# Motife — Project Overview

> **Type:** Explanation
> **Audience:** Developers, AI assistants, and any tooling that needs project context
> **Last updated:** 2026-08-12
>
> How a technical concept description becomes an explainer MP4. Related docs: [motife-plan.md](../motife-plan.md).

---

## 1. Purpose

### 1.1 Core Responsibilities

Given a text description of a technical concept, produce a motion-graphic explainer video. The project owns: the DSL JSON Schema, the DSL→Remotion compiler, the hand-built explainer component library, TTS integration, and the render → critique → revise loop.

### 1.2 Relationship with Other Systems

Depends on an LLM provider for structured-output DSL generation and vision-based critique (vendor: TBD), a TTS provider for narration audio (vendor: TBD), and Remotion (`@remotion/renderer`, `@remotion/player`) as the sole render target.

### 1.3 Deprecated / Retired or Not-Yet-Enabled Features

Everything is not-yet-enabled — no code exists yet (pre-Phase-0). A second render target (a custom Rust engine using `vello`/`skia-safe`) is explicitly deferred to Phase 5, conditional on product validation and render cost/speed becoming a bottleneck (source: [motife-plan.md](../motife-plan.md) §3 Phase 5).

## 2. Tech Stack

- **Language:** TypeScript (source: [motife-plan.md](../motife-plan.md) §2)
- **Render engine:** Remotion — the single render target; also provides `@remotion/player` for web embedding (source: motife-plan.md §1)
- **Package manager, linter, LLM vendor, TTS vendor:** TBD — not yet designed

**Rationale:** TypeScript + Remotion was chosen so the browser's layout engine absorbs CJK text-layout risk during the current phase, rather than building that from scratch — this is the explicit reason a custom renderer is *not* built now (source: motife-plan.md §4 風險與對策). Rejected alternative: a custom Rust render engine from day one — deferred to Phase 5 until product-market validation holds and render cost or speed becomes the actual bottleneck.

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

(planned — not yet created). Nothing exists yet beyond `motife-plan.md`, `progress/`, and this documentation set.

## 5. Domain Models (High-Level)

TBD — not yet designed. The closest thing to a domain model, the DSL JSON Schema, is a Phase 2 deliverable (source: motife-plan.md §3 Phase 2).

### Core Entity Relationships

TBD — not yet designed.

### Model Details

TBD — not yet designed.

## 6. API / Interface Structure

TBD — not yet designed. Phase 4 plans a `@remotion/player`-based web preview page (prompt in → live preview → MP4 download) (source: motife-plan.md §3 Phase 4), but no interface exists yet.

## 7. Background Jobs & Scheduled Tasks

N/A — not yet designed. The render → critique → revise loop (Phase 3) will need a bounded iteration cap, but no job infrastructure has been chosen.

## 8. External Service Integrations

TBD — not yet designed. Planned integration points: an LLM provider for structured-output DSL generation and vision-based critique, and a TTS provider for narration audio. Neither vendor is chosen yet.

## 9. Database / Data Stores

N/A — the project's current design has no server-side datastore; the pipeline is a stateless prompt-to-MP4 transform.

## 10. Environments & Deployment

### Environments

TBD — not yet designed.

### Deployment Pipeline

TBD — not yet designed. Phase 4 lists deployment-shape options (open-source tool / demo site / self-use) as an explicit open decision (source: motife-plan.md §3 Phase 4).

### Configuration Hierarchy

TBD — not yet designed.
