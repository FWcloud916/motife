# Phase 2 — DSL + Compiler

**Slug:** phase-2-dsl-compiler
**Status:** in-progress
**Ticket:** N/A
**Related plan:** [phase-2-dsl-compiler-phase-2-playful-platypus.md](../_plans/phase-2-dsl-compiler-phase-2-playful-platypus.md)
**Created:** 2026-08-13
**Updated:** 2026-08-13

---

## Scope

| Scope | Branch | Ticket | Notes |
|---|---|---|---|
| `motife` | `phase-2/dsl-compiler` | TBD |  |

## Background & goals

Phase 2 of motife-plan.md §3: build the DSL + compiler layer between the
Phase 1 component library and the future Phase 3 agent pipeline. Deliverables:
a JSON Schema for the narrative DSL (fixed beat skeleton
intro→breakdown→walkthrough→summary), a runtime-interpreting compiler with
human-readable validation errors, and three hand-written DSL documents
(JWT auth, MQ backpressure, DB index internals) each rendering end to end.
Exit criterion: 不碰 TypeScript、只改 JSON 就能產出一支完整影片.

Every existing scene composes the component library with raw JSX + inline
CSS, which the DSL forbids — so this phase first extends the library with
semantic layout/text primitives (Stack, Text, Meter, StepSwitch,
stepWindows()), proven by rewriting the four JWT TSX scenes with them, before
any schema work starts. Full design in the linked plan.

## Task list

- [x] Stage 1 — Semantic primitives (Stack, Text, Meter, StepSwitch, stepWindows(), CodeBlock.chrome, Diagram windowed activeNodes, ICON_NAMES); rewrite JWT TSX scenes to prove them
- [ ] Stage 2 — DSL schema (zod) + validator + semantic cross-reference checks + error formatting, tests only
- [ ] Stage 3 — Runtime interpreter (DslVideo/DslSceneView/nodes) + composition registration (DslPreview) + render:dsl script
- [ ] Stage 4 — Port JWT to DSL (JwtAuthFlowDsl), A/B against TSX baseline stills
- [ ] Stage 5 — Author MqBackpressure DSL video
- [ ] Stage 6 — Author DbIndexInternals DSL video
- [ ] Stage 7 — Cutover (delete JWT TSX, rename doc id) + docs updates (dsl-schema.md, component-library.md, project-overview.md, primitive-inventory.md, README.md, CLAUDE.md, motife-plan.md)

## Work log

### 2026-08-13

-
- Plan approved; branch phase-2/dsl-compiler created; starting Stage 1 (semantic primitives).
- Stage 1 done: added Stack/Text/Meter/StepSwitch/stepWindows() primitives, CodeBlock.chrome, Diagram windowed activeNodes + width/grow, Callout/CodeBlock/Terminal width/grow, ICON_NAMES export. Rewrote all 4 JWT TSX scenes to use only these primitives (zero raw div style, zero useCurrentFrame in scene code). Found and fixed a real rendering bug during A/B: Summary's cards row pinned flush to the hero-scale header via justify="between" visually crowded/overlapped the title's line box, misread initially as a duplicate-text artifact — fixed by centering the [cards, footer] group instead, and decoupled Callout's grow from forcing height:100% (main-axis flex-grow only). pnpm verify green (61 tests), 1200-frame pin holds, smoke renders both compositions clean, A/B verified against docs/assets/*-v2.png at 3 canonical frames (anatomy/validation/summary) with only expected minor deltas.

## Outcome

> Fill in after development finishes.

**Final status:**
**PR / Commit:**
**Follow-ups:**
