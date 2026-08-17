# Progress Item Index

Items are created by `new_progress.py`, then maintained with
`update_progress.py` by developers or agents. See [`README.md`](README.md)
for usage and invoke the installed `progress-tracker` skill for the full
workflow.

## Items

| Status | Item | Folder | Scope | Ticket | Plan | Created | Notes |
|---|---|---|---|---|---|---|---|
| `done` | Phase 0 — Anchoring: Manual Baseline Video and Primitive Inventory | `progress/2026-08-12-phase-0-anchor/` | `motife` | N/A | [phase-0-anchor-motife-plan.md](_plans/phase-0-anchor-motife-plan.md) | 2026-08-12 |  |
| `done` | Phase 1 — 解說元件庫 (Explainer Component Library) | `progress/2026-08-13-phase-1-component-library/` | `motife` | N/A | [phase-1-component-library-plan-next-phase-generic-penguin.md](_plans/phase-1-component-library-plan-next-phase-generic-penguin.md) | 2026-08-13 |  |
| `done` | Phase 2 pre-work — Phase 1 hardening carry-overs | `progress/2026-08-13-phase-2-hardening-carryover/` | `motife` | N/A | [phase-2-hardening-carryover-plan-next-phase-generic-penguin.md](_plans/phase-2-hardening-carryover-plan-next-phase-generic-penguin.md) | 2026-08-13 |  |
| `done` | Phase 2 — DSL + Compiler | `progress/2026-08-13-phase-2-dsl-compiler/` | `motife` | N/A | [phase-2-dsl-compiler-phase-2-playful-platypus.md](_plans/phase-2-dsl-compiler-phase-2-playful-platypus.md) | 2026-08-13 |  |
| `done` | Phase 3 — Agent Pipeline | `progress/2026-08-14-phase-3-agent-pipeline/` | `motife` | N/A | [phase-3-agent-pipeline-silly-soaring-cherny.md](_plans/phase-3-agent-pipeline-silly-soaring-cherny.md) | 2026-08-14 |  |
| `in-progress` | Phase 4 — 打磨與發布 (Polish and Publish) | `progress/2026-08-17-phase-4-polish-and-publish/` | `motife` | N/A | [phase-4-polish-and-publish-jaunty-knitting-locket.md](_plans/phase-4-polish-and-publish-jaunty-knitting-locket.md) | 2026-08-17 |  |

## Status legend

Keep each item's status here identical to the Status field in its
`PROGRESS.md`.

<!-- STATUS_LIFECYCLE_START -->
Status enum: `planning`, `in-progress`, `review`, `blocked`, `done`, `abandoned`

```
planning → in-progress ⇄ review → done
                ↕
             blocked

Any non-terminal status → abandoned
```
<!-- STATUS_LIFECYCLE_END -->

| Status | Meaning |
|---|---|
| `planning` | Item created, implementation not started (scaffold-script default) |
| `in-progress` | Under active development |
| `review` | PR/MR opened, in code review / QA — **not** `done`; that comes after merge |
| `blocked` | Paused on an external dependency |
| `done` | Development complete (PR/MR merged) |
| `abandoned` | Stopped without completing |
