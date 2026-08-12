# Motife — Agent Guide

An AI agent system that turns a technical concept description into a motion-graphic explainer MP4, rendered with Remotion.

## Hard constraints

- MUST use a feature branch and open a PR into `main`; MUST NOT commit directly to `main` (source: user-stated delivery policy)
- DSL schema MUST NOT include CSS-like concepts (`className`, `boxShadow`, raw coordinates) — only semantic fields (source: motife-plan.md §2 決策2)
- Layout MUST be computed by ELK/dagre; the LLM MUST NOT emit coordinates (source: motife-plan.md §2 決策3)
- The narration timeline MUST be TTS-driven: audio is generated first, frame counts derived from it — never the reverse (source: motife-plan.md §2 決策4)
- The LLM (semantic layer) MUST NOT decide coordinates, easing, animation parameters, or layout — that belongs to the compiler and component library (source: motife-plan.md §2 分層原則)
- MUST NOT introduce a second render target before Phase 4 product validation is complete — a Rust engine is a conditional Phase 5 option only (source: motife-plan.md §3 Phase 5, §4 風險與對策); if built, it MUST be a clean-room implementation against the DSL spec, never a port of Remotion's source (source: Remotion LICENSE.md — porting/modifying Remotion to build a derivative renderer is prohibited even under a paid license)
- Run `pnpm verify` before declaring work done (source: package.json scripts — see Commands)
- `<Audio>`/`<Video>` MUST be imported from `@remotion/media`, not `remotion` — props are `from`/`durationInFrames`, not the legacy `startFrom`/`endAt`; no lint rule catches the wrong import (source: Remotion 4.x docs)
- All `remotion` and `@remotion/*` packages MUST stay pinned to the identical exact version; add new ones with `npx remotion add <pkg>`, never `pnpm add` (source: package.json — exact-pinned by design)
- `interpolate()` MUST pass `extrapolateLeft`/`extrapolateRight: 'clamp'` unless extending past the range is intended — the default (`'extend'`) is a common bug source (source: Remotion docs)
- The Remotion entry point is `src/remotion/index.ts` (set in `remotion.config.ts`); MUST NOT create `src/index.ts` — it is checked first by the CLI and would silently shadow the real entry (source: remotion.config.ts)
- `remotion.config.ts` has no effect on `@remotion/renderer`'s SSR APIs (`bundle()`/`renderMedia()`/`renderStill()`); programmatic renders MUST set equivalent options as call arguments, and MUST pass the identical `inputProps` object to `selectComposition()` and `renderMedia()`/`renderStill()` (source: scripts/smoke.mjs, Remotion docs)

## Read before you work

Read the matching doc **before non-trivial work**. Small fixes (typos, single-line edits, running tests) can skip; do not pre-load all docs.

| Task | Read first |
|---|---|
| Architecture, request flow, directory layout, integrations | [docs/project-overview.md](docs/project-overview.md) |
| Visual primitives, Phase 1 component requirements | [docs/primitive-inventory.md](docs/primitive-inventory.md) |
| Current development status, active work item | [progress/INDEX.md](progress/INDEX.md) |
| Full phased roadmap, design decisions, risks | [motife-plan.md](motife-plan.md) |

## Commands

```bash
pnpm install    # install dependencies
pnpm dev        # start Remotion Studio locally
pnpm verify     # typecheck + lint + render smoke test — the verification gate for "done"
pnpm lint       # lint only
```

## Conventions

- Work is tracked per-task under [progress/](progress/) (progress-tracker skill), not a root `PROGRESS.md` — open or update the relevant item there before starting non-trivial work.
- `useCurrentFrame()` is relative to the nearest enclosing `<Sequence>`, not the composition's absolute frame — a scene mounted via `<Sequence from={n}>` always sees frame 0 at its own start.
- New scenes go in `storyboard.ts` + `sceneRegistry.tsx` (see `src/remotion/compositions/jwt-auth/`); `JwtAuthFlow.tsx` and `Root.tsx` wire things automatically and normally don't need edits.

## Docs maintenance

When modifying any file under `docs/`, update its `> **Last updated:** YYYY-MM-DD` frontmatter to today's date. Requirement keywords (MUST, SHOULD, MAY) follow RFC 2119.
