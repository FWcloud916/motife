# Component Library — Public API Reference

> **Type:** Reference
> **Audience:** Anyone extending `src/components/`; whoever maintains `src/compiler/render/nodes.tsx`
> **Last updated:** 2026-08-17
>
> The Phase 1 deliverable (motife-plan.md §3 Phase 1), extended in Phase 2
> (motife-plan.md §3 Phase 2) with four more semantic primitives
> (`Stack`/`Text`/`Meter`/`StepSwitch`) that turned out to be necessary to
> express Phase 1's own hand-written scenes as data, not just to build the
> DSL over them — see `docs/primitive-inventory.md`'s "Phase 2 outcome"
> section for why. Every prop shape below doubles as the DSL schema's
> vocabulary: `src/dsl/schema.ts` emits these props verbatim from JSON, so
> every field here is JSON-serializable except the ReactNode slots —
> `children`, and `StepSwitch`'s `cases[].content` (composition slots
> only, never data) — see **[docs/dsl-schema.md](dsl-schema.md)** for
> the DSL's own document-level reference (envelope, scenes, tracks,
> `WindowRef`, validation). Verify field names/shapes against
> `src/components/index.ts` (the actual barrel) before treating this as
> authoritative — this doc can drift; the barrel can't.

## Import surface

Scenes (`src/remotion/compositions/**`) and the DSL interpreter
(`src/compiler/render/**`) import exclusively from the barrel:

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
/** Semantic width for a box-like component sitting beside a sibling —
 * never a raw pixel or percentage. */
type Measure = "narrow" | "half" | "wide" | "full";  // -> 40% / 55% / 78% / 100%
/** A layout gap — the only unit Stack's `gap` accepts. */
type Gap = "none" | "sm" | "md" | "lg" | "xl";

/** A time span as a fraction (0..1) of the enclosing Scene's duration.
 * Every timed component resolves its own animation against a Window
 * instead of a hardcoded frame number — when Phase 3 derives a scene's
 * duration from measured TTS audio, everything inside re-times itself
 * automatically. The DSL's own WindowRef (docs/dsl-schema.md) resolves to
 * exactly this shape via src/compiler/windows.ts before any component sees
 * it — no component in this library is aware WindowRef exists. */
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

Also provides `SafeAreaContext = { width, height } | null` (`Scene/safeArea.ts`,
`computeSafeArea()`) — the real pixel box `content` has after the
header/caption clearances above are subtracted. Phase 4 introduced this so
a component that needs a hard cap (standalone `Diagram`'s `fit`, see below)
can get one without DOM measurement: it's pure arithmetic from
`useVideoConfig()`'s width/height plus whether `header`/`caption` are set,
computed once by `Scene` and read via `useContext`. Exported from the
barrel (`HEADER_CLEARANCE`, `CAPTION_CLEARANCE`, `CONTENT_EDGE_PAD`,
`computeSafeArea`, `SafeAreaContext`) specifically so
`src/compiler/validate.ts` computes the identical box for its
`camera_content_too_tall` lint (see `Camera` below) — one set of numbers,
not two copies that can drift.

## `Stack` — the only layout primitive

```ts
interface StackProps {
  direction?: "row" | "column";     // default "column"
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between";
  gap?: Gap;                        // default "md"
  width?: Measure;
  /** Take a proportional share of the remaining space in the enclosing
   * Stack's main axis, and — since a top-level Stack is usually handed
   * directly to a Scene's content slot rather than another Stack — also
   * fill 100% of that parent's height. */
  grow?: boolean;
  window?: Window;
  children?: ReactNode;
}
```

Plain `display: flex`; never wraps or measures its children. A child's
main-axis size is either "size to content" (omit `grow`) or an equal
`flex: 1 1 0` share (`grow: true`) — there is no `weights` array; give two
Stacks different `width` tokens for an unequal split instead.

**`min-{height,width}: 0` is scoped to the main axis, and only when `grow`
is set.** A `grow` Stack needs it to correctly shrink to (and give its own
children a definite size from) whatever share its flex parent actually
allocates — this is what lets a `<Camera>` inside a `grow` Stack resolve
`height: 100%` correctly. A **non-`grow`** Stack deliberately keeps the
browser's default `min-height: auto` on its main axis, so it never shrinks
below its own content's natural size when a sibling overflows the
container — see the real bug this fixed: a header Stack (no `grow`) sitting
next to a tall multi-rank `Diagram` collapsed to ~2px of layout height
while its hero-scale text kept painting at full size past the collapsed
box, reading as if the text overlapped the diagram. The cross axis keeps
`min: 0` unconditionally regardless of `grow` — that's the standard fix for
long unbreakable content overflowing sideways, and carries no such risk.

## `Text` — semantic typography

```ts
type TextRole = "hero" | "title" | "subtitle" | "label" | "body" | "detail";
type TextRun = string | { text: string; tone?: Tone; strong?: boolean };

interface TextProps {
  role?: TextRole;         // default "body"
  content: string | TextRun[];
  tone?: Tone;
  align?: "start" | "center" | "end";
  window?: Window;
}
```

The one place font size/weight/letter-spacing live for scene text:

| role | fontSize | weight | letterSpacing | default color |
|---|---|---|---|---|
| `hero` | `xl` (104) | 820 | −5 | text |
| `title` | `lg` (72) | 750 | −2.5 | text |
| `subtitle` | 28 | 600 | 1 | textMuted |
| `label` | `xs` (20) | 800 | 3, uppercase | tone `fg`, else textMuted |
| `body` | `md` (42) | 700 | 0 | text |
| `detail` | `sm` (26) | 400 | 0 | textMuted |

`hero`/`title` carry `Scene`'s own header sizing verbatim — swapping a
hand-styled header block for `<Text role="hero">` is a byte-identical
replacement, not an approximation (verified via pixel-diff A/B against the
Phase 1 stills during the port). `TextRun[]` reuses `CodeSegment`'s shape
and is how an inline `<strong>` run (e.g. "Sign · Verify · Authorize"
standing out of an otherwise-muted sentence) is expressed.

## `Meter` — progress / level bar

```ts
interface MeterProps {
  window?: Window;    // animate 0->1 across this window...
  value?: number;      // ...XOR hold a fixed 0..1 level (window wins if both given)
  tone?: Tone;
  label?: string;
  size?: Size;
  threshold?: number;  // marker line on the track — e.g. a backpressure high-water mark
}
```

The semantic replacement for a hand-rolled `interpolate()`-driven width%
bar with a literal `boxShadow` — exactly the CSS-like construct
motife-plan.md §2 決策2 forbids in the DSL.

## `StepSwitch` — step-synced content

```ts
interface StepSwitchCase { steps: [number, number]; content: ReactNode }  // inclusive step-index range
interface StepSwitchProps {
  /** One Window per step — normally stepWindows()'s output for the same
   * steps/window a sibling <StepReveal> (or useSteps()) uses, which is
   * what keeps a checklist and its detail panel in sync. */
  stepWindows: Window[];
  cases: StepSwitchCase[];
  /** "latch" (default): once a step starts, its matching case stays shown
   * until the next case's steps begin — generalises Phase 0's activeIndex
   * fallback. "switch": a case shows only while its own step range is
   * strictly active. */
  mode?: "latch" | "switch";
}
```

Renders whichever `cases` entry covers the step current at the frame — the
semantic replacement for a `activeIndex === n ? <X/> : null` conditional
chain. A range-based case (`[0, 2]`) collapses what would otherwise be
three duplicated single-step branches.

## `stepWindows()` — the helper that removes frame math from scenes

```ts
/** Each step's span as a Window (fractions of the enclosing Scene) — the
 * duration-independent counterpart of resolveSteps(). Exact, because
 * resolveSteps is linear in durationInFrames. */
function stepWindows(steps: readonly WeightedStep[], window: Window): Window[];
```

This is what makes the DSL's symbolic `{track, step}`/`{track, steps}`
window references (docs/dsl-schema.md) a **pure compile-time** resolution
rather than a render-time React context: the interpreter never needs step
state, and `src/compiler/validate.ts` can range-check a step index
statically before anything renders.

## `Callout`

Absorbs Phase 0's Pill/Card/status-banner primitives into one
tone/emphasis/size-driven component. In the DSL, its three variants become
three separate node types (`pill`/`card`/`banner`) — see docs/dsl-schema.md
— since zod's discriminated union needs one tag per shape; the underlying
React component still takes a `variant` field.

```ts
type CalloutProps =
  | { variant: "pill"; text: string; icon?: IconName; tone?: Tone; window?: Window }
  | { variant: "card"; emphasis?: Emphasis; size?: Size; tone?: Tone; window?: Window;
      /** Semantic width, for a card sitting beside a sibling inside a Stack row. */
      width?: Measure;
      /** Take a proportional share of the enclosing Stack's main axis. */
      grow?: boolean;
      children: ReactNode }
  | { variant: "banner"; text: string; detail?: string; icon?: IconName; tone?: Tone; window?: Window };
```

**Card interior alignment:** `alignItems: "stretch"` (not Phase 1's
`"center"`) — once a `Stack` is the card's interior, the Stack's own
`align` decides cross-axis alignment; `"center"` fought every scene into
re-declaring `alignSelf` overrides. A/B'd against the Phase 1 stills
(`docs/assets/*-v2.png`) with zero visual regression before landing.

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
pure function underneath. In the DSL, a `steps` node (docs/dsl-schema.md)
renders `<StepReveal>` directly off a scene-level `track`; a `switch` node
renders `<StepSwitch>` the same way — see
`src/compiler/render/nodes.tsx`'s `StepsNodeRenderer`/`SwitchNodeRenderer`.

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

/** A node id active from frame 0, or one that only becomes active once
 * `window` begins — and then stays active (a one-way threshold; `window.to`
 * is ignored). Widened in Phase 2 from a plain `string[]` so a Diagram no
 * longer needs its caller to compute `frame > n ? [...] : []` by hand. */
type DiagramActiveNode = string | { node: string; window: Window };

interface DiagramProps {
  graph: GraphSpec;
  /** "contain" (default): fit within the given box, preserving aspect
   * ratio (SVG viewBox — no JS measurement). "width": grow the element's
   * own height to match its aspect ratio at 100% width. */
  fit?: "width" | "contain";
  activeNodes?: DiagramActiveNode[];
  reveal?: { order?: "rank" | "all"; window?: Window };
  /** Convenience: render these FlowPulses inside this Diagram's own
   * layout context instead of nesting <FlowPulse> by hand. */
  flows?: FlowSpec[];
  /** Semantic width, for a Diagram sitting beside a sibling inside a Stack
   * row. No effect when nested inside a <Camera> (native scale always). */
  width?: Measure;
  /** Take a proportional share of the enclosing Stack's main axis. Pair
   * with `fit: "contain"` when the allocated box's aspect ratio isn't
   * known ahead of time — "width" ties height to the graph's own aspect
   * ratio and can overflow a `grow`d box instead of fitting it. */
  grow?: boolean;
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

**Standalone real-pixel cap (Phase 4):** `fit`'s SVG sizing is otherwise
unbounded — a `fit:"width"` diagram's `aspect-ratio`-derived height (or a
`fit:"contain"` diagram inside a flex box that's overflowed its own
ancestor) can grow past the enclosing `<Scene>`'s actual content area,
which is exactly Phase 3's "Diagram 節點卡片過大遭畫面裁切" failure mode.
Standalone `Diagram` (this section only — nested-in-Camera below is
unaffected) reads `SafeAreaContext` (see `Scene` above) and applies
`maxHeight: safeArea?.height` (plus `maxWidth: "100%"`) to the SVG. Since
`aspect-ratio`/`height:100%` are only *preferred* sizes, `max-height` wins
once it would be exceeded, and the existing `viewBox` +
`preserveAspectRatio="xMidYMid meet"` then letterboxes (shrinks and
centers) instead of clipping. `null` outside a `<Scene>` — the cap simply
doesn't apply, same as before this existed. On all three checked-in
baseline documents this never binds (their rendered heights sit well
inside the safe area) — verified pixel-identical smoke renders.

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
instead of being syntax-parsed at render time, since the DSL/compiler
emits pre-tokenized segments directly.

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
  /** "panel" (default): the gradient/border/shadow/padding chrome.
   * "bare": drops all of it, for a CodeBlock nested inside a Card — avoids
   * double chrome, and gains the card's own staggered reveal for free. */
  chrome?: "panel" | "bare";
  lines: CodeLine[];
  reveal?: { mode?: "all" | "staggered"; window?: Window };
  highlights?: CodeHighlight[];
  size?: Size;
  width?: Measure;
  grow?: boolean;
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
  width?: Measure;
  /** Take a proportional share of the enclosing Stack's main axis. When
   * `grow` isn't set, Terminal sets `flexShrink: 0` on itself — without
   * it, a Terminal stacked below taller siblings in a height-constrained
   * flex column (e.g. a Card sized to match a neighbouring Card via
   * Stack's `align="stretch"`) gets silently flex-shrunk below its own
   * content height, and `overflow: hidden` clips the shrunk-away content
   * with no visible error — a real bug found while authoring the MQ
   * backpressure video's Terminal-showing walkthrough case. */
  grow?: boolean;
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

Frames against its own **measured** box — the wrapper's real
`offsetWidth`/`offsetHeight`, not `useVideoConfig()`'s composition size.
This matters because a Camera almost never actually gets the full frame:
`Scene` reserves header/caption clearance, and any sibling sharing its
Stack (a steps card above it, say) shrinks the box further. An earlier
version assumed the full composition frame to avoid DOM measurement, and
that assumption — not the zoom/pan math — was the real mechanism behind
the Phase 3 db-index eval's "Camera 運鏡超出畫面範圍" failure mode: math
computed for 1920×1080 was silently clipped by the wrapper's own
`overflow: hidden` on a ~1728×541 box. The measurement is safe for the
same reasons `CameraTarget`'s is (below): gated on `fontsReady()`, held by
an eagerly-taken `delayRender` handle until the first post-fonts
measurement lands, re-measured every commit with a dedupe.
`useVideoConfig()` survives only as the never-screenshotted
pre-measurement fallback and the `focus: "all"` rect default.

The zoom/translation math (`src/components/Camera/cameraMath.ts`, split out
of `Camera.tsx` in Phase 4 for node-level testability) applies two clamps on
top of the naive "center the focus rect and scale" behavior, both bounded
against that measured viewport:

- **Zoom clamp** (per shot, before interpolation): a shot's nominal zoom
  (`wide`/`medium`/`close` → `1`/`1.4`/`2`) is capped so its OWN focus rect,
  plus a `tokens.spacing.lg` margin, never exceeds the viewport — `zoom:
  "wide"` on a diagram wider than the box now shrinks below `1` instead of
  overflowing at it.
- **Translation clamp** (per frame, after interpolation): the resulting pan
  is bounded so the OVERALL content bounds (the registered
  `DIAGRAM_BOUNDS_ID` rect, or the union of registered `CameraTarget`s) never
  scroll their own edges into dead background — a close-up near a diagram's
  edge no longer reveals empty space past it. Content smaller than the
  viewport at the current zoom is centered instead (nothing to clamp
  against).

One composition caveat survives the measured viewport: a Camera squeezed
into a very small box now shows everything, *scaled to fit* — a `wide`
shot of a tall diagram inside a cramped Stack renders complete but tiny.
Legibility of that layout choice is the DSL author's problem, not
Camera's — its contract is only that framing never clips or pans off the
content. `src/compiler/validate.ts`'s `camera_content_too_tall` warning
(docs/dsl-schema.md) is the density-lint half: it estimates a nested
diagram's own layout height against the enclosing scene's real content
area (`computeSafeArea`, same numbers this section's measured viewport
converges toward) and flags it before render, independent of whatever
else happens to share the Stack.

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

## Quality ladder: JWT anatomy / claims validation / summary stills

Three canonical frames, captured at each generation this library passed
through — the durable evidence that no generation regressed the one before
it:

| Generation | Anatomy | Claims validation | Summary |
|---|---|---|---|
| v1 — Phase 0 hand-built | [png](assets/jwt-auth-anatomy.png) | [png](assets/jwt-auth-validation.png) | [png](assets/jwt-auth-summary.png) |
| v2 — Phase 1 component-library rebuild (hand-written props) | [png](assets/jwt-auth-anatomy-v2.png) | [png](assets/jwt-auth-validation-v2.png) | [png](assets/jwt-auth-summary-v2.png) |
| v3 — Phase 2 DSL port (same props, now JSON) | [png](assets/jwt-auth-anatomy-v3.png) | [png](assets/jwt-auth-validation-v3.png) | [png](assets/jwt-auth-summary-v3.png) |

What the pixel-diff gate actually proved: the DSL port is byte-identical
to the *Stage 1 primitive rewrite* of the TSX scenes (`magick compare
-metric AE` returns `0` between the two at all three frames), and the
Stage 7 cutover changed zero pixels versus that. v2 → v3 is **not**
pixel-identical — the Stage 1 rewrite carries small deliberate deltas
against v2 (the card captions' divider line has no DSL semantic and was
dropped; card interiors center rather than pin the caption to the bottom).
One genuine regression also slipped through that gate — the anatomy
frame's JWT token bar was wrapped in a `width: "wide"` Stack too narrow
for its unbreakable 132-char line, overflowing the frame edge — because
both sides of the A/B shared the bug; it was caught by eye against v2
post-cutover and fixed in the DSL document (the v3 still above is the
fixed version). Lesson recorded for Phase 3's critique loop: an A/B
against the *previous* generation, not just the current baseline, is what
catches a defect both current candidates share.

## Open items for Phase 3

- **`z.toJSONSchema()` output uses `$ref`/`$defs`** for the DSL's recursive
  node union — structured-output APIs vary in `$ref` support. May need
  depth-limited flattening before it can be handed to an LLM call directly;
  not yet attempted (see docs/dsl-schema.md).
- **`Camera`'s full-composition-frame assumption — RESOLVED in Phase 4.**
  The Phase 3 concern ("nesting a `camera` node inside a narrower Stack
  reads as legal DSL and fails only visually") recurred as the db-index
  eval's "Camera 運鏡超出畫面範圍" failure mode: the `walkthrough` scene's
  `camera` shares its Stack with a "steps" card, shrinking Camera's actual
  box to ~1728×541 against the assumed 1920×1080. Fixed at the component
  layer — Camera now measures its real box (see `Camera` above) — so a
  cramped Camera renders complete-but-small instead of clipped. The
  remaining *legibility* question (not correctness) is covered by the
  `camera_content_too_tall` validate.ts lint below — it fires on the
  db-index baseline by design (the diagram it warns about is exactly the
  one that produced this failure mode); see
  `progress/2026-08-17-phase-4-polish-and-publish/`.
- **Diagram overflow (Phase 3's "節點卡片過大遭畫面裁切") — RESOLVED in
  Phase 4.** Two layers: standalone `Diagram` now caps its rendered height
  to `SafeAreaContext` (see `Diagram` above — a component-layer guarantee,
  never clips regardless of what the DSL asks for), and `validate.ts` adds
  three estimated-text lints (`diagram_label_too_long` warning,
  `diagram_label_clipped` error, `diagram_too_many_nodes` warning) plus the
  camera one above — pushing the signal into the channel an LLM can act on
  (the clip lint is error-severity specifically so it re-enters the
  generate retry loop; the rest ride the dsl-schema.md thresholds embedded
  in the system prompt, same posture as `narration_pacing`). See
  docs/dsl-schema.md's "Validation issue codes" table and "Layout budgets"
  note under `Diagram`.
- No open items carried over from Phase 1 — those (Diagram node measuring,
  CameraTarget measurement, transition overlap math, barrel-import
  enforcement) were all closed before Phase 2 began. The barrel rule is
  enforced by ESLint, not convention; see "Import surface" above.
