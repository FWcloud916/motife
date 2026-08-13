# Component Library — Public API Reference

> **Type:** Reference
> **Audience:** Whoever designs the Phase 2 DSL JSON Schema; anyone writing a new scene
> **Last updated:** 2026-08-13
>
> The Phase 1 deliverable (motife-plan.md §3 Phase 1). Every prop shape
> below is written as if it *were* the DSL schema draft — that's
> deliberate: Phase 2's compiler needs to emit these props verbatim from
> JSON, so every field here is JSON-serializable except `children`
> (composition slots only, never data). Verify field names/shapes against
> `src/components/index.ts` (the actual barrel) before treating this as
> authoritative — this doc can drift; the barrel can't.

## Import surface

Scenes (`src/remotion/compositions/**`) import exclusively from the
barrel:

```ts
import { Scene, Diagram, Callout, tokens, /* ... */ } from "../../../components";
```

Never reach into a component's own module path (`../../../components/Scene/Scene`)
— the barrel is the contract; internal file layout can change freely.

This is enforced, not just documented: `eslint.config.mjs` restricts the
`**/components/**` import pattern across `src/remotion/**`, so a deep
import fails `pnpm lint`. Files inside `src/components/**` are outside that
rule and may import each other directly.

## Shared vocabulary (`tokens`)

```ts
type Tone = "neutral" | "primary" | "info" | "success" | "warning" | "danger"
          | "syntaxA" | "syntaxB" | "syntaxC";
type Emphasis = "low" | "medium" | "high";
type Size = "sm" | "md" | "lg";

/** A time span as a fraction (0..1) of the enclosing Scene's duration.
 * Every timed component resolves its own animation against a Window
 * instead of a hardcoded frame number — when Phase 3 derives a scene's
 * duration from measured TTS audio, everything inside re-times itself
 * automatically. */
interface Window { from: number; to: number }
```

`tokens.color.tone[Tone]` gives `{ fg, bg, border }` — the only sanctioned
way a component expresses color. No component accepts a raw hex, `style`,
or `className` prop.

## `Scene`

The container every scene wraps its content in: background, header slot,
caption slot, safe-area padding, and timing context.

```ts
interface SceneProps {
  /** This scene's own duration in frames — pass the same value used for
   * its enclosing <Sequence>/<TransitionSeries.Sequence>. */
  durationInFrames: number;
  background?: { variant?: "grid" | "plain"; glow?: Tone };
  header?: { eyebrow: string; title: string; tone?: Tone; scale?: "normal" | "hero" };
  /** Bottom narration slot. Omit for scenes with no caption (e.g. Summary). */
  caption?: string;
  children?: ReactNode;
}
```

Provides `SceneContext = { durationInFrames, fps }` to every descendant via
`useSceneTiming()` — this is what lets `Window`-based components resolve
their timing without their own duration prop.

## `Callout`

Absorbs Phase 0's Pill/Card/status-banner primitives into one
tone/emphasis/size-driven component.

```ts
type CalloutProps =
  | { variant: "pill"; text: string; icon?: IconName; tone?: Tone; window?: Window }
  | { variant: "card"; emphasis?: Emphasis; size?: Size; tone?: Tone; window?: Window; children: ReactNode }
  | { variant: "banner"; text: string; detail?: string; icon?: IconName; tone?: Tone; window?: Window };
```

## `StepReveal`

Progressive checklist with a `pending → active → passed/failed` state
machine, timed relative to a shared `Window`.

```ts
interface Step {
  title: string;
  detail?: string;
  /** Share of the window this step occupies, relative to the other
   * steps'. Defaults to 1 (equal split). */
  weight?: number;
  outcome?: "pass" | "fail";
}
interface StepRevealProps {
  steps: Step[];
  window?: Window; // default { from: 0.1, to: 0.95 }
  layout?: "list" | "row";
  label?: string;
}
```

`useSteps(steps, window)` — also exported — resolves the same
`{step, state}[]` a `<StepReveal>` would render, without rendering
anything. Use it when a sibling component (e.g. a detail panel) needs to
stay in sync with the checklist's timing: call it with the *exact* same
`steps`/`window` and both derive identical boundaries, since it's the same
pure function underneath (see `src/remotion/compositions/jwt-auth/scenes/Walkthrough.tsx`
for a real example).

## `Diagram` + layout (`GraphSpec` → `LayoutResult`)

The only component that turns topology into coordinates
(motife-plan.md §2 決策3) — `computeLayout()` (backed by `@dagrejs/dagre`)
is the sole call site anywhere in the library.

```ts
interface GraphNodeSpec {
  id: string;
  icon?: IconName;
  label: string;
  detail?: string;
  tone?: Tone;
  size?: Size;
}
interface GraphEdgeSpec {
  id?: string; // defaults to "${from}->${to}"
  from: string;
  to: string;
  label?: string;
}
interface GraphSpec {
  direction?: "right" | "down";
  nodes: GraphNodeSpec[];
  edges: GraphEdgeSpec[];
}

interface DiagramProps {
  graph: GraphSpec;
  /** "contain" (default): fit within the given box, preserving aspect
   * ratio (SVG viewBox — no JS measurement). "width": grow the element's
   * own height to match its aspect ratio at 100% width. */
  fit?: "width" | "contain";
  activeNodes?: string[];
  reveal?: { order?: "rank" | "all"; window?: Window };
  /** Convenience: render these FlowPulses inside this Diagram's own
   * layout context instead of nesting <FlowPulse> by hand. */
  flows?: FlowSpec[];
  /** Overlay slot — e.g. a nested <Camera>, or annotations. */
  children?: ReactNode;
}
```

**Node sizing:** a node's `Size` token is its *minimum* footprint, not a
fixed one. `Diagram` measures each node's label and detail with
`@remotion/layout-utils`' `measureText` (after `fontsReady()`, behind a
`delayRender` handle) and widens the card to fit, clamped to
`MAX_NODE_WIDTH` (560); past that the text wraps instead, and the card's
padding plus `overflowWrap: "anywhere"` keep it inside the border. This
matters most for CJK, where every glyph is full-width and a label
overruns the 268px `md` token almost immediately.

The measured sizes reach `computeLayout` as an optional `nodeSizes` record
keyed by node id — **`GraphSpec` itself still carries no dimensions**, so
the DSL a Phase 2 compiler emits keeps describing topology and never
geometry. The pure half of the calculation (`layout/nodeSizing.ts`) is
unit-tested; the DOM half (`layout/measureNodes.ts`) is browser-only.

**Nesting inside `<Camera>`:** a `Diagram` rendered as a `Camera`'s
descendant hands framing over entirely — it registers its node rects (and
overall bounds, for `focus: "all"`) into the Camera's registry and renders
at native scale starting at `(0,0)`. Don't put a centering or
percentage-sized wrapper between `<Camera>` and a `<Diagram>` it should
focus by node — that desyncs the registered coordinates from where the
diagram actually renders.

## `FlowPulse`

A pulse that travels along a `Diagram` edge's *computed* route (via
`@remotion/paths`), replacing Phase 0's straight-line-only `FlowLine`.

```ts
interface FlowSpec {
  /** An edge id from the enclosing Diagram's graph. */
  edge: string;
  window: Window;
  tone?: Tone;
  label?: string;
  direction?: "forward" | "reverse";
}
```

Must be a descendant of `<Diagram>` (reads `DiagramContext` for the edge's
routed path) — or use `Diagram`'s `flows` prop as a convenience.

## `CodeBlock`

Own tokenized micro-model — no shiki/prism. Segments carry a `Tone`
instead of being syntax-parsed at render time, since Phase 2's LLM/compiler
can emit pre-tokenized segments directly.

```ts
type CodeSegment = string | { text: string; tone: Tone };
interface CodeLine {
  segments: CodeSegment[];
  indent?: number;
  diff?: "added" | "removed";
}
interface CodeHighlight {
  lines: [number, number]; // inclusive start/end line index range
  window: Window;
}
interface CodeBlockProps {
  title?: string;
  lines: CodeLine[];
  reveal?: { mode?: "all" | "staggered"; window?: Window };
  highlights?: CodeHighlight[];
  size?: Size;
}
```

## `Terminal`

Deterministic typed-command simulation — no `Math.random`/timers (the
`deterministic-randomness` ESLint rule is active project-wide).

```ts
interface TerminalStep {
  command: string;
  output?: string[];
  outputTone?: Tone;
  window: Window;
}
interface TerminalProps {
  title?: string;
  steps: TerminalStep[];
  size?: Size;
}
```

## `Camera`

Zoom/pan/focus wrapper. Not a Remotion built-in — a transform-driven
wrapper div, since Remotion has no camera primitive of its own.

```ts
interface CameraShot {
  /** When the camera arrives at this shot's focus, as a fraction of the
   * enclosing Scene's duration. Holds the previous shot's position until
   * `window.from`, eases across [from, to], then holds. */
  window: Window;
  focus: { node: string } | { target: string } | "all";
  zoom?: "wide" | "medium" | "close";
}
interface CameraProps {
  shots: CameraShot[];
  children: ReactNode;
}
```

Assumes it fills the full composition frame — its viewport size comes from
Remotion's `useVideoConfig()`, not a DOM measurement.

`<CameraTarget id>` registers a non-Diagram child's box as a focusable
target by id (fallback path for content a nested `Diagram` doesn't already
know about — prefer `focus: { node }` when the subject is a Diagram node).
Its wrapper is `inline-block`, so it shrink-wraps its child: a block-level
wrapper would measure the full width of Camera's content area and "focus
on this" would frame the whole row instead of the subject. Keep it a
direct child of Camera's content, with no positioned wrapper in between,
since it measures `offsetLeft`/`offsetTop`.

Target ids share one namespace with the node ids a nested `Diagram`
registers — don't reuse a node id for a `CameraTarget`.

Both `CameraTarget` and `Diagram` measure only after `fontsReady()`
resolves, and hold a `delayRender` handle until that first measurement
lands. Measuring on mount would capture fallback-font metrics, because
`loadFonts()`'s internal `delayRender` blocks the screenshot but not
React's mount and effects.

## Scene transitions

A composition renders its timeline through `<SceneSeries>`
(`src/remotion/compositions/SceneSeries.tsx`), which inserts a transition
wherever a scene asks for one. The timing lives in `compositions/
timeline.ts`:

```ts
type SceneTransition = "cut" | "fade";   // default "cut"
buildTimeline(scenes, fps, transitionFrames?): TimelineEntry[]
totalFrames(timeline): number
```

A transition **overlaps** its two neighbours — TransitionSeries plays the
outgoing scene's tail and the incoming scene's head at once. So:

- `TimelineEntry.from` is a true absolute position: under a fade the next
  scene's `from` is pulled back by `overlapWithNext`, matching the offsets
  TransitionSeries derives internally.
- The composition's duration is `Σ durations − Σ overlaps`, which is what
  `totalFrames()` returns. Passing `Σ durations` to `<Composition>` would
  leave trailing blank frames.
- `TRANSITION_FRAMES` (15, mirroring `tokens.duration.fast`) is the
  default; `buildTimeline` throws if a transition is not shorter than both
  scenes it joins, rather than letting TransitionSeries fail mid-render.

The eval-set videos deliberately use hard cuts at every boundary
(motife-plan.md §4 compares them frame-for-frame against the Phase 0
baseline). `ComponentGallery` carries one fade so the path is exercised by
every `pnpm smoke` run rather than shipping untested.

## Open items for Phase 2

None outstanding — the Phase 1 carry-overs (Diagram node measuring,
CameraTarget measurement, transition overlap math, and barrel-import
enforcement) were all closed before Phase 2 began. The barrel rule is now
enforced by ESLint, not convention; see "Import surface" above.
