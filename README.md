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

TBD — tooling not set up yet.

### Setup

TBD — tooling not set up yet.

### Run

TBD — tooling not set up yet.

### Test

TBD — tooling not set up yet.

## Project structure

Nothing beyond planning and tracking artifacts exists yet:

```
motife/
├── motife-plan.md   # source project plan (Chinese)
├── docs/            # generated documentation
└── progress/        # development progress tracker
```

## Documentation

| Doc | What it covers |
|---|---|
| [docs/project-overview.md](docs/project-overview.md) | Architecture, tech stack decisions, directory map, phased roadmap references |
| [motife-plan.md](motife-plan.md) | Full project plan: phased roadmap, design decisions, risks, milestones (source of truth, Chinese) |
