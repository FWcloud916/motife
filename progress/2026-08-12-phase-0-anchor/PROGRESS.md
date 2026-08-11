# Phase 0 — Anchoring: Manual Baseline Video and Primitive Inventory

**Slug:** phase-0-anchor
**Status:** planning
**Ticket:** N/A
**Related plan:** [phase-0-anchor-motife-plan.md](../_plans/phase-0-anchor-motife-plan.md)
**Created:** 2026-08-12
**Updated:** 2026-08-12

---

## Scope

| Scope | Branch | Ticket | Notes |
|---|---|---|---|
| `motife` | TBD | TBD |  |

## Background & goals

Motife is an AI-agent system that generates motion-graphic explainer videos (Remotion-rendered MP4) from a technical concept description. Before writing any system code, Phase 0 establishes what "good" looks like: a hand-built reference video and the inventory of visual primitives it actually used. This inventory becomes the requirements spec for the Phase 1 component library. See [motife-plan.md](../_plans/phase-0-anchor-motife-plan.md) §3 "Phase 0 — 定錨".

Exit criteria: one hand-built video the author is satisfied with, plus a primitive inventory list.

## Task list

- [ ] Pick 3 concepts for the eval set (suggested: JWT auth flow, message queue backpressure, DB index internals) — concepts the author can personally judge for quality
- [ ] Hand-build one target video in Remotion (no AI) for one of the 3 concepts — this becomes the quality baseline
- [ ] From the hand-build process, record which visual primitives were actually used and which motions repeated — this list becomes the component library spec
- [ ] Confirm Remotion's license terms against future commercial plans
- [ ] Establish a locally runnable verification gate (test/lint command) once tooling is chosen — no test framework exists yet (doc-architect Fresh Session Test Q4 verification-gate warning, 2026-08-12)

## Work log

### 2026-08-12

- Progress tracker scaffolded via progress-tracker skill; task list seeded from motife-plan.md Phase 0.
- doc-architect Mode G bootstrap complete: README.md, AGENTS.md (+CLAUDE.md symlink), docs/project-overview.md created. Independent Fresh Session Test (5/5 questions answered from repo alone; Q3/Q4 honest TBD, valid for greenfield). No test gate exists yet — seeded as a task above.

## Outcome

> Fill in after development finishes.

**Final status:**
**PR / Commit:**
**Follow-ups:**
