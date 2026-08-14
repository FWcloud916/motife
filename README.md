# Motife

An AI agent system that turns a written description of a technical concept into a professional motion-graphic explainer video (MP4), rendered with Remotion.

## What it does

- Takes a natural-language description of a technical concept (architecture, data flow, code walkthrough) as input
- An LLM produces a schema-constrained JSON DSL describing the narrative — it does not write animation code directly
- A compiler translates the DSL into a Remotion composition (TypeScript), built entirely from a hand-crafted explainer component library
- TTS narration audio drives per-step timing and captions
- A render → critique (vision model) → revise loop catches layout and pacing problems before final output
- Outputs an MP4; the same composition can be embedded live via `@remotion/player`

## Quickstart

### Prerequisites

- Node ≥22, pnpm 11.x
- First render/Studio run auto-downloads Chrome Headless Shell (~90 MB) via Remotion — no manual browser install needed

### Setup

```bash
pnpm install
```

### Run

```bash
pnpm dev          # open Remotion Studio
pnpm render       # render out/jwt-auth-flow.mp4 (composition id "JwtAuthFlow", DSL-backed)
pnpm render:dsl <doc.json> <out.mp4>   # render ANY valid DSL document — no TypeScript, no
                                        # baseline registration needed
```

### Test

```bash
pnpm verify    # typecheck + lint + render smoke test — the verification gate for "done"
```

## Project structure

```text
motife/
├── motife-plan.md        # source project plan (Chinese)
├── src/
│   ├── components/       # the explainer component library (Stack, Text, Diagram, Camera, ...)
│   ├── dsl/               # the JSON DSL — schema + hand-authored eval-set documents
│   ├── compiler/          # DSL -> Remotion, by render-time interpretation (no codegen)
│   └── remotion/          # Remotion entry point + composition registrations
├── scripts/
│   ├── smoke.mjs          # render smoke test
│   └── render-dsl.mjs     # pnpm render:dsl driver
├── docs/                  # generated documentation
└── progress/              # development progress tracker
```

See [docs/project-overview.md §4](docs/project-overview.md#4-directory-structure) for the full annotated tree.

## Documentation

| Doc | What it covers |
|---|---|
| [docs/project-overview.md](docs/project-overview.md) | Architecture, tech stack decisions, directory map, phased roadmap references |
| [docs/dsl-schema.md](docs/dsl-schema.md) | The DSL document reference — envelope, scenes, tracks, node types, validation errors |
| [docs/component-library.md](docs/component-library.md) | Public component API reference — the DSL's own vocabulary source |
| [docs/primitive-inventory.md](docs/primitive-inventory.md) | Visual primitives recorded while hand-building the Phase 0 baseline video — the Phase 1 component-library spec, plus Phase 2's outcome |
| [motife-plan.md](motife-plan.md) | Full project plan: phased roadmap, design decisions, risks, milestones (source of truth, Chinese) |

## License

This repository has no license file yet (`private`/`UNLICENSED` in `package.json`). It depends on [Remotion](https://github.com/remotion-dev/remotion), which is source-available under a proprietary license, not OSI-approved open source: free for individuals, non-profits, and for-profit organizations with up to 3 people (commercial video output included); a paid Company License is required above that. See [docs/project-overview.md §2](docs/project-overview.md#2-tech-stack) for details.
