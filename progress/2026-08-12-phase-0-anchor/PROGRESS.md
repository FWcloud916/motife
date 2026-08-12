# Phase 0 — Anchoring: Manual Baseline Video and Primitive Inventory

**Slug:** phase-0-anchor
**Status:** in-progress
**Ticket:** N/A
**Related plan:** [phase-0-anchor-motife-plan.md](../_plans/phase-0-anchor-motife-plan.md)
**Created:** 2026-08-12
**Updated:** 2026-08-12

---

## Scope

| Scope | Branch | Ticket | Notes |
|---|---|---|---|
| `motife` | `phase-0/remotion-scaffold` | TBD |  |

## Background & goals

Motife is an AI-agent system that generates motion-graphic explainer videos (Remotion-rendered MP4) from a technical concept description. Before writing any system code, Phase 0 establishes what "good" looks like: a hand-built reference video and the inventory of visual primitives it actually used. This inventory becomes the requirements spec for the Phase 1 component library. See [motife-plan.md](../_plans/phase-0-anchor-motife-plan.md) §3 "Phase 0 — 定錨".

Exit criteria: one hand-built video the author is satisfied with, plus a primitive inventory list.

## Task list

- [ ] Pick 3 concepts for the eval set (suggested: JWT auth flow, message queue backpressure, DB index internals) — concepts the author can personally judge for quality
- [x] Hand-build one target video in Remotion (no AI) for one of the 3 concepts — this becomes the quality baseline
- [x] From the hand-build process, record which visual primitives were actually used and which motions repeated — this list becomes the component library spec
- [x] Confirm Remotion's license terms against future commercial plans
- [x] Establish a locally runnable verification gate (test/lint command) once tooling is chosen — no test framework exists yet (doc-architect Fresh Session Test Q4 verification-gate warning, 2026-08-12)

## Work log

### 2026-08-12

- Progress tracker scaffolded via progress-tracker skill; task list seeded from motife-plan.md Phase 0.
- doc-architect Mode G bootstrap complete: README.md, AGENTS.md (+CLAUDE.md symlink), docs/project-overview.md created. Independent Fresh Session Test (5/5 questions answered from repo alone; Q3/Q4 honest TBD, valid for greenfield). No test gate exists yet — seeded as a task above.
- Scaffolded Remotion 4.0.508 + pnpm + TypeScript + ESLint toolchain via the brownfield install path (npx create-video fails inside an existing git repo). Layout: src/remotion/ with storyboard-as-data (storyboard.ts) + typed scene registry, chosen so Phase 2's DSL formalizes the same shape and Phase 2/3 dirs (src/dsl, src/compiler, src/agent) don't collide. Verification gate is pnpm verify (typecheck + eslint + a render smoke test via bundle/selectComposition/renderStill) -- also seeds Phase 3's critique-loop plumbing. License check: free tier covers individuals and for-profit orgs up to 3 people incl. commercial output; re-evaluate if headcount grows or the project moves under a company. Rust Phase 5 option must be clean-room against the DSL spec, never a port of Remotion source, per its license.
- Completed the 40-second `JwtAuthFlow` manual baseline: four finished scenes explain token issuance, Header/Payload/Signature anatomy, server-side signature and claims verification, and operational takeaways. Added narration copy (audio remains deferred to Phase 3's TTS-first timeline), a Phase 0 visual-primitives module, ten observed primitive entries, design-token coverage, and three committed baseline stills. Static checks and the eight-frame render smoke test pass.

## Outcome

> Fill in after development finishes.

**Final status:**
**PR / Commit:**
**Follow-ups:**
