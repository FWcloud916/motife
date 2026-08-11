# Motife — Agent Guide

An AI agent system that turns a technical concept description into a motion-graphic explainer MP4, rendered with Remotion.

## Hard constraints

- MUST use a feature branch and open a PR into `main`; MUST NOT commit directly to `main` (source: user-stated delivery policy)
- DSL schema MUST NOT include CSS-like concepts (`className`, `boxShadow`, raw coordinates) — only semantic fields (source: motife-plan.md §2 決策2)
- Layout MUST be computed by ELK/dagre; the LLM MUST NOT emit coordinates (source: motife-plan.md §2 決策3)
- The narration timeline MUST be TTS-driven: audio is generated first, frame counts derived from it — never the reverse (source: motife-plan.md §2 決策4)
- The LLM (semantic layer) MUST NOT decide coordinates, easing, animation parameters, or layout — that belongs to the compiler and component library (source: motife-plan.md §2 分層原則)
- MUST NOT introduce a second render target before Phase 4 product validation is complete — a Rust engine is a conditional Phase 5 option only (source: motife-plan.md §3 Phase 5, §4 風險與對策)
- Run the test command before declaring work done — TBD, no test framework exists yet (see Commands)

## Read before you work

Read the matching doc **before non-trivial work**. Small fixes (typos, single-line edits, running tests) can skip; do not pre-load all docs.

| Task | Read first |
|---|---|
| Architecture, request flow, directory layout, integrations | [docs/project-overview.md](docs/project-overview.md) |
| Current development status, active work item | [progress/INDEX.md](progress/INDEX.md) |
| Full phased roadmap, design decisions, risks | [motife-plan.md](motife-plan.md) |

## Commands

```bash
<setup command>     # TBD — tooling not set up yet
<run command>       # TBD — tooling not set up yet
<test command>      # TBD — tooling not set up yet — the verification gate for "done"
<lint command>       # TBD — tooling not set up yet
```

## Conventions

- Work is tracked per-task under [progress/](progress/) (progress-tracker skill), not a root `PROGRESS.md` — open or update the relevant item there before starting non-trivial work.

## Docs maintenance

When modifying any file under `docs/`, update its `> **Last updated:** YYYY-MM-DD` frontmatter to today's date. Requirement keywords (MUST, SHOULD, MAY) follow RFC 2119.
