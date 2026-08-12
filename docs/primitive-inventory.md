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
| _(none recorded yet — fill in while building the real scenes)_ | | | | | | | | |

A row whose "Proposed Phase 1 component" doesn't map onto any of the
motife-plan.md §3 Phase 1 components (`Scene`, `Diagram`, `FlowPulse`,
`CodeBlock`, `Terminal`, `Camera`, `StepReveal`, `Callout`) is the most
valuable kind of finding — it's a gap the plan didn't anticipate.

## Design tokens observed

Mirrors `src/remotion/theme.ts`. Update both together as real values are
chosen while animating.

| Token | Value | Where used |
|---|---|---|
| `color.bg` | `#0b0f19` | placeholder scene background |
| `color.text` | `#f5f7fa` | placeholder scene text |
| `color.textMuted` | `#9aa4b2` | unused yet |
| `color.accent` | `#5b8def` | unused yet |
| `fontSize.sm/md/lg` | 28 / 44 / 72 | `fontSize.md` used in placeholders |
| `spacing.sm/md/lg` | 16 / 32 / 64 | unused yet |
| `duration.fast/normal/slow` | 15 / 30 / 45 frames | unused yet |

## Coverage check against the planned component library

Fill in at Phase 0 exit — this is what makes "a primitive inventory list"
a verifiable exit criterion instead of a judgment call.

| Planned component (motife-plan.md §3 Phase 1) | Status |
|---|---|
| `Scene` | not yet assessed |
| `Diagram` | not yet assessed |
| `FlowPulse` | not yet assessed |
| `CodeBlock` | not yet assessed |
| `Terminal` | not yet assessed |
| `Camera` | not yet assessed |
| `StepReveal` | not yet assessed |
| `Callout` | not yet assessed |

`used` / `unused` / `missing` (i.e. needed but not in the planned list).

## Baseline stills

Once the real animation (not the placeholder scenes) is done and you're
satisfied with it, render 2–3 representative frames and commit them under
`docs/assets/` as the durable visual record of the Phase 0 quality bar —
the full MP4 itself is not committed (see `.gitignore`; `out/` is ignored).
Link them here once they exist.
