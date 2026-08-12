# Primitive Inventory — JWT Auth Flow (Phase 0)

> **Type:** Reference (living document, updated while building)
> **Audience:** Whoever designs the Phase 1 component library
> **Last updated:** 2026-08-12
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

Mirrors `src/remotion/theme.ts`. Update both together as real values are
chosen while animating.

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

Fill in at Phase 0 exit — this is what makes "a primitive inventory list"
a verifiable exit criterion instead of a judgment call.

| Planned component (motife-plan.md §3 Phase 1) | Status |
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

## Baseline stills

The durable Phase 0 quality bar is captured at three representative frames;
the full MP4 is not committed (`out/` is ignored):

- [JWT anatomy](assets/jwt-auth-anatomy.png) — Header, Payload, and Signature
- [Claims validation](assets/jwt-auth-validation.png) — progressive server checklist
- [Summary](assets/jwt-auth-summary.png) — the three operational rules
