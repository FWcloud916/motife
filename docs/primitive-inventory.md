# Primitive Inventory — JWT Auth Flow (Phase 0)

> **Type:** Reference (living document, updated while building)
> **Audience:** Whoever designs the Phase 1 component library
> **Last updated:** 2026-08-13
>
> Records the visual primitives actually used while hand-building the JWT
> auth flow video in `src/remotion/compositions/jwt-auth/`. This is the
> requirements spec for Phase 1's component library
> (motife-plan.md §3 Phase 0 exit criteria: "一份原語清單").

## How to use this file

Append a row **the moment you copy-paste a piece of visual code**, or the
moment you catch yourself about to write something a second time. Do not
reconstruct this list at the end of Phase 0 — the value is in what you
noticed *while* the friction was happening.

**Prioritization rule:** a primitive used **≥3 times** MUST become a Phase 1
component candidate; used 1–2 times, leave it inline and just note it here.
Without this rule the list becomes a wishlist instead of a spec.

## Primitives

| # | Primitive | First used in | What it does (1 line) | Params that varied | Times used | Motion / easing | Proposed Phase 1 component | Notes / risks |
|---|---|---|---|---|---|---|---|---|
| 1 | Grid scene backdrop | `Intro` | Dark grid, noise, and a scene-colored ambient glow | glow color | 4 scenes | static | `Scene` | Centralize safe-area and background treatment with transitions in Phase 1. |
| 2 | Eyebrow + title header | `Breakdown` | Establishes the current chapter and its question | eyebrow, title, accent | 2 direct + 2 variants | 22-frame fade/slide, clamped | `Scene` | Intro and Summary use the same hierarchy with hero-scale variants. |
| 3 | Raised information card | `Intro` | Groups a node, token section, verification state, or rule | accent, size, content | 12 | parent-controlled reveal | `Callout` | Generic surface treatment is heavily repeated; arbitrary style props are Phase 0-only. |
| 4 | System node | `Intro` | Represents client, auth server, or API server | icon, label, detail, active color | 4 | active border/glow | `Diagram` | Phase 1 should place nodes from topology, never caller-supplied coordinates. |
| 5 | Data-flow line + pulse | `Intro` | Shows a request or token moving between nodes | label, direction, color, progress, width | 2 | linear frame interpolation, clamped | `FlowPulse` | Needs path support after ELK computes endpoints. |
| 6 | Token/code panel | `Breakdown` | Shows Header, Payload, Signature, and verification formulae | syntax color, text, detail | 5 | staggered 22-frame reveal | `CodeBlock` | Phase 1 should tokenize/highlight structured content without arbitrary CSS. |
| 7 | Step/checklist reveal | `Walkthrough` | Advances extract → signature → claims → authorization | label, detail, state | 7 | staggered fade; state color transition | `StepReveal` | States observed: pending, active, passed. Failure/rejected remains a needed variant. |
| 8 | Status pill | `Intro` | Compact chapter/status/token label | text, color | 5 | parent-controlled fade | `Callout` | Useful for HTTP status, phase labels, and warnings. |
| 9 | Inline technical icon | `Intro` | Gives browser/server/key/shield/user concepts a stable silhouette | semantic name, color, size | 13 | static; parent animates | `Diagram` | Current icons are inline SVG; Phase 1 needs a semantic icon registry. |
| 10 | Bottom narration caption | `Intro` | Holds one readable sentence inside a consistent safe area | copy | 3 scenes | 15-frame fade, clamped | `Scene` | Summary deliberately replaces this with a takeaway footer. Later driven by TTS captions. |

A row whose "Proposed Phase 1 component" doesn't map onto any of the
motife-plan.md §3 Phase 1 components (`Scene`, `Diagram`, `FlowPulse`,
`CodeBlock`, `Terminal`, `Camera`, `StepReveal`, `Callout`) is the most
valuable kind of finding — it's a gap the plan didn't anticipate.

## Design tokens observed

Recorded here from the Phase 0 hand-built values; formalized in Phase 1 as
`src/components/tokens/` (the `src/remotion/theme.ts` collection point this
originally mirrored is deleted — `tokens` carries the same values forward,
plus `easing`, `fontFamily`, and per-`Tone` color recipes).

| Token | Value | Where used |
|---|---|---|
| `color.bg/surface/surfaceRaised` | `#07111f` / `#0d1b2d` / `#13243a` | scene background and cards |
| `color.line` | `#29405d` | grid, borders, separators, inactive progress |
| `color.text/textMuted` | `#f7fbff` / `#8fa6bf` | primary and secondary copy |
| `color.accent/cyan/mint` | `#6c7cff` / `#37d9f2` / `#42e2a8` | ambient glow, active flow, passed state |
| `color.warning/danger` | `#ffca68` / `#ff6b7a` | public-payload warning; rejected-state reserve |
| `color.header/payload/signature` | `#ff6f91` / `#a887ff` / `#54d5ff` | JWT anatomy syntax colors |
| `fontSize.xs/sm/md/lg/xl` | 20 / 26 / 42 / 72 / 104 | labels through hero typography |
| `spacing.sm/md/lg/xl` | 16 / 32 / 64 / 96 | shared safe areas and layout rhythm |
| `duration.fast/normal/slow` | 15 / 30 / 45 frames | fades, reveals, and flow transitions |
| `radius.sm/md/lg/pill` | 14 / 24 / 36 / 999 | cards, icon wells, pills |

## Coverage check against the planned component library

Filled in at Phase 0 exit — this is what made "a primitive inventory list"
a verifiable exit criterion instead of a judgment call. Status here
reflects Phase 0 *usage*, not Phase 1 build status — see "Phase 1 outcome"
below for what actually got built.

| Planned component (motife-plan.md §3 Phase 1) | Phase 0 usage |
|---|---|
| `Scene` | used |
| `Diagram` | used |
| `FlowPulse` | used |
| `CodeBlock` | used |
| `Terminal` | unused |
| `Camera` | unused |
| `StepReveal` | used |
| `Callout` | used |

`used` / `unused` / `missing` (i.e. needed but not in the planned list).

## Phase 1 outcome

All 8 planned components were built under `src/components/`, per PR
sequence [tokens-and-foundation → diagram-flow-code → jwt-rebuild →
swap-and-cleanup]. `Terminal` and `Camera` — unused at Phase 0 exit — were
built speculatively per the plan; at Phase 1 exit they were exercised only
by the `ComponentGallery` demo composition
(`src/remotion/compositions/gallery/`), not yet by a real narrative video.
Phase 2 gave both their first real narrative use — see "Phase 2 outcome"
below.

Acceptance (motife-plan.md milestone M1) passed: `JwtAuthFlow` was rebuilt
entirely from `src/components/` with hand-written props, replacing the
Phase 0 scenes and `visuals.tsx` in place — see `docs/component-library.md`
for the resulting public API and `docs/assets/jwt-auth-*-v2.png` for the
rebuild compared against the stills below.

## Baseline stills

The durable Phase 0 quality bar, captured at three representative frames
before the Phase 1 rebuild (`out/` itself is gitignored, so these stills —
not a committed MP4 — are the historical record):

- [JWT anatomy](assets/jwt-auth-anatomy.png) — Header, Payload, and Signature
- [Claims validation](assets/jwt-auth-validation.png) — progressive server checklist
- [Summary](assets/jwt-auth-summary.png) — the three operational rules

The same three frames after the Phase 1 component-library rebuild, for
direct comparison:

- [JWT anatomy — v2](assets/jwt-auth-anatomy-v2.png)
- [Claims validation — v2](assets/jwt-auth-validation-v2.png)
- [Summary — v2](assets/jwt-auth-summary-v2.png)

The same three frames again after the Phase 2 DSL port (pixel-identical to
the Stage 1 primitive rewrite it was A/B'd against; carries small
deliberate deltas vs v2 — see `docs/component-library.md`'s quality-ladder
table for the details and one regression that gate missed):

- [JWT anatomy — v3](assets/jwt-auth-anatomy-v3.png)
- [Claims validation — v3](assets/jwt-auth-validation-v3.png)
- [Summary — v3](assets/jwt-auth-summary-v3.png)

## Phase 2 outcome

Porting the Phase 1 hand-written scenes to a JSON-serializable form (before
any DSL schema existed to validate against) surfaced a real gap the Phase 1
component list didn't anticipate — exactly the kind of finding this doc's
own instructions call most valuable. Counted across the four JWT scenes and
`ComponentGallery`, roughly half of every scene's lines were raw JSX/inline
CSS with no expression in any Phase 1 component's props: hand-rolled
flexbox rows and columns, fixed-px width/height boxes, hand-styled text
blocks (fontFamily+fontSize+fontWeight+letterSpacing+color), a hand-rolled
`interpolate()` progress bar with a literal `boxShadow` (forbidden in the
DSL outright — motife-plan.md §2 決策2), and conditional renders keyed on a
step index (`activeIndex === n ? … : null`).

Four new primitives closed that gap, added to `src/components/` *before*
any JSON existed — proved out in TypeScript first, exactly as
motife-plan.md's phasing intends:

| New primitive | Replaces | Notes |
|---|---|---|
| `Stack` | every hand-rolled `display: flex` row/column, `flex: 1` columns, `justify-content: space-between` rows, fixed px widths | Became the DSL's *only* layout primitive — no `className`/coordinates ever needed an escape hatch |
| `Text` | every hand-styled text `<div>` (6 distinct role/size/weight combinations found in practice) | Role table (`hero`/`title`/`subtitle`/`label`/`body`/`detail`) is a byte-identical replacement for the Phase 1 values, not an approximation |
| `Meter` | the hand-rolled `interpolate()` progress bar with a `boxShadow` | Directly forbidden-construct removal; reused again by the MQ backpressure video for queue depth vs. a `threshold` |
| `StepSwitch` | `activeIndex === n ? <X/> : null` conditional chains | Collapsed Walkthrough's four single-step branches to two range-based cases |

Two existing components gained props rather than needing a new primitive:
`CodeBlock` (`chrome: "bare"`, for nesting inside a `Card` without double
chrome) and `Diagram` (`activeNodes` widened from `string[]` to
`Array<string | {node, window}>`, removing the last `useCurrentFrame()`
from scene code). Full current shapes: `docs/component-library.md`.

Both `Terminal` and `Camera` — unused at Phase 0 exit, built speculatively
in Phase 1 — saw their first real narrative use in Phase 2: `Terminal` in
the MQ backpressure video's walkthrough (which also surfaced a genuine
`flexShrink` bug, since fixed — see `docs/component-library.md`), and
`Camera` in the DB index video's lookup walkthrough (which surfaced that
its "fills the full composition frame" assumption is load-bearing, not
advisory — also documented there).

No component needed a new *node type of its own* to express one of the 14
DSL node kinds it wasn't already capable of — the gap was entirely in
layout/text primitives, not in the diagram/code/terminal/camera components
Phase 1 already built. That is itself a small piece of evidence that Phase
1's component list, aimed at "reproduce the hand-built baseline," was
close to the right shape for "express arbitrary DSL content" too.
