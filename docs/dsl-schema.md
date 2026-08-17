# DSL Schema — Reference

> **Type:** Reference
> **Audience:** Whoever writes Phase 3's system prompt; anyone hand-authoring a DSL document
> **Last updated:** 2026-08-17
>
> The Phase 2 deliverable (motife-plan.md §3 Phase 2). This doc's content is
> literally what goes into Phase 3's system prompt — it is written for that
> audience from day one, not as internal implementation notes. Verify field
> names/shapes against `src/dsl/schema.ts` (the actual zod schema) before
> treating this as authoritative — this doc can drift; the schema can't.
> `z.toJSONSchema(dslDocumentSchema)` (`src/dsl/schema.ts`) is the
> machine-readable form of everything below, for a structured-output API
> call.

## What a DSL document is

A JSON document describing one explainer video: a fixed four-beat narrative
skeleton (引入 → 拆解 → 逐步演示 → 總結), each beat one scene, each scene one
tree of semantic content nodes. No coordinates, no CSS, no frame numbers —
every visual choice is a token (`Tone`, `Size`, `Measure`, `Gap`) and every
timing choice is a `WindowRef` (a fraction of the scene, or a reference to a
named step). `src/compiler/` turns a validated document into a rendered
Remotion composition by walking it at render time — there is no codegen
step, so the exact same document renders identically whether it's a
hand-written fixture or LLM output.

**Only sanctioned way to get a `DslDocument`:** `parseDocument()` /
`parseDocumentOrThrow()` in `src/compiler/parse.ts`. Never construct or cast
one directly — that bypasses both the zod structural checks and
`validate.ts`'s semantic cross-reference checks (schema-vs-runtime invariant
this whole doc depends on).

## Envelope

```jsonc
{
  "version": 1,
  "id": "MqBackpressure",       // Composition id — /^[A-Za-z][A-Za-z0-9]*$/, unique across the manifest
  "title": "訊息佇列背壓",
  "fps": 30,                    // default 30
  "width": 1920,                // default 1920
  "height": 1080,                // default 1080
  "scenes": [ /* Scene[], see below — at least 1 */ ]
}
```

## Scene

```jsonc
{
  "id": "walkthrough",
  "beat": "walkthrough",                // "intro" | "breakdown" | "walkthrough" | "summary"
  "durationInSeconds": 16,               // provisional — Phase 3 replaces with measured TTS length
  "narration": "…",                      // the spoken line for this scene
  "caption": "…",                        // omit -> falls back to narration; explicit null -> no caption at all
  "transitionToNext": "cut",             // "cut" (default) | "fade"
  "background": { "variant": "grid", "glow": "info" },   // variant: "grid" | "plain"; glow: a Tone
  "header": { "eyebrow": "02 · Verification", "title": "API 如何驗證 JWT？", "tone": "info", "scale": "normal" },
  "tracks": [ /* Track[], optional — named step lists this scene's content can reference */ ],
  "content": { /* exactly one root DslNode */ }
}
```

**Beat rule:** `intro` exactly once, first. `summary` exactly once, last. At
least one `breakdown` and one `walkthrough` scene between them (a long
walkthrough may legally be split across two `walkthrough` scenes). Beats
must appear in non-decreasing order of the fixed sequence
`intro < breakdown < walkthrough < summary` — e.g.
`intro, breakdown, walkthrough, walkthrough, summary` is legal;
`intro, walkthrough, breakdown, summary` is not.

**`caption`:** omitting it reuses `narration` verbatim (removes a
duplication an LLM would otherwise get wrong); an explicit `null` renders no
caption band at all (the summary scene in every eval-set video does this —
its takeaway cards are the caption).

## Tone / Icon / Size / Emphasis / Measure / Gap vocabulary

Every one of these is a zod enum built from the same runtime constant the
component library uses — a bad value is a schema error listing every legal
option, not a silent fallback.

```ts
type Tone = "neutral" | "primary" | "info" | "success" | "warning" | "danger"
          | "syntaxA" | "syntaxB" | "syntaxC";
type IconName = "browser" | "server" | "key" | "shield" | "check" | "cross"
              | "user" | "database" | "queue" | "lock" | "document";
type Size = "sm" | "md" | "lg";
type Emphasis = "low" | "medium" | "high";
type Measure = "narrow" | "half" | "wide" | "full";   // 40% / 55% / 78% / 100% — never a raw px/%
type Gap = "none" | "sm" | "md" | "lg" | "xl";
```

## `WindowRef` — symbolic timing

Every timed field in the DSL is a `WindowRef`, not a `{from, to}` pair of
frame numbers or even always a pair of fractions — this is what lets an LLM
say "while the signature is being verified" without doing arithmetic, and
it's what makes a scene's `durationInSeconds` freely revisable (Phase 3's
TTS integration will do exactly that) without touching any other field in
the scene.

```ts
type WindowRef =
  | { from: number; to: number }              // absolute fractions [0,1] of the enclosing scene
  | { track: string; step: number }            // one named track's step span
  | { track: string; steps: [number, number] }; // an inclusive step-index range on a track
```

All three shapes are structurally distinguishable — no discriminator field
needed. `src/compiler/windows.ts`'s `resolveWindowRef()` collapses any of
them to a concrete `{from, to}` (in scene-fraction space) before any
component ever sees it; tracks may nest (a track's own `window` may itself
be `{track, step}` into another track), resolved recursively.

## Tracks — named step lists

A scene may declare `tracks`: named lists of steps that content nodes
reference symbolically instead of writing frame math.

```jsonc
"tracks": [
  {
    "id": "checks",
    "window": { "from": 0.05, "to": 0.98 },     // the track's own span — absolute, or {track,step} into an earlier track
    "items": [
      { "title": "Extract token",    "detail": "讀取 Authorization header" },
      { "title": "Verify signature", "detail": "用可信任的 key 驗章" },
      { "title": "Validate claims",  "detail": "檢查 exp · iss · aud" },
      { "title": "Authorize",        "detail": "套用角色與權限", "weight": 0.6 }
    ]
  }
]
```

`weight` (optional, default 1) sizes a step's share of the track's window
relative to its siblings — a `0.6` step gets 0.6× the time of a `1`-weight
step, not 60% of the total. A track must be declared before anything
references it (forward references are a validation error, not a silent
no-op) — this keeps resolution a single forward pass.

## Content nodes

One flat discriminated union on `type`, 14 variants. Callout's three visual
variants (pill/card/banner) are three separate node types here, not one
node with a `variant` field — zod's discriminated union needs one tag per
shape, and it's also strictly better for LLM structured output (one
consistent field set per type, no "field X only applies when variant=Y").

### Layout / text

```ts
type StackNode = {
  type: "stack";
  direction?: "row" | "column";               // default "column"
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between";
  gap?: Gap;                                    // default "md"
  width?: Measure;
  grow?: boolean;                               // fill the enclosing Stack's main axis
  window?: WindowRef;
  children?: DslNode[];
};

type TextNode = {
  type: "text";
  role?: "hero" | "title" | "subtitle" | "label" | "body" | "detail";  // default "body"
  content: string | Array<string | { text: string; tone?: Tone; strong?: boolean }>;
  tone?: Tone;
  align?: "start" | "center" | "end";
  window?: WindowRef;
};

type MeterNode = {
  type: "meter";
  tone?: Tone;
  label?: string;
  size?: Size;
  window?: WindowRef;      // animate 0->1 across this window...
  value?: number;          // ...XOR hold a fixed 0..1 level (window wins if both given)
  threshold?: number;      // marker line on the track, e.g. a backpressure high-water mark
};

type IconNode = { type: "icon"; name: IconName; tone?: Tone; size?: Size };
```

`Stack` is the **only** layout primitive the DSL can express — no
`className`, no raw px/%. A child's size along the main axis is either
"size to content" (omit `grow`) or `grow: true` (an equal `flex: 1 1 0`
share; there is no `weights` array — give two Stacks different `width`
tokens instead when an unequal split is needed).

### Callout family (pill / banner / card)

```ts
type PillNode   = { type: "pill";   text: string; icon?: IconName; tone?: Tone; window?: WindowRef };
type BannerNode = { type: "banner"; text: string; detail?: string; icon?: IconName; tone?: Tone; window?: WindowRef };
type CardNode   = {
  type: "card";
  emphasis?: Emphasis; size?: Size; tone?: Tone; window?: WindowRef;
  width?: Measure; grow?: boolean;
  children: DslNode[];   // at least 1
};
```

### Diagram

The only node that turns topology into coordinates — layout is always
computed by dagre server/render-side; the DSL never states an x/y.

```ts
type GraphNodeSpec = { id: string; icon?: IconName; label: string; detail?: string; tone?: Tone; size?: Size };
type GraphEdgeSpec = { id?: string; from: string; to: string; label?: string };  // id defaults to "${from}->${to}"
type GraphSpec = { direction?: "right" | "down"; nodes: GraphNodeSpec[]; edges: GraphEdgeSpec[] };

type DiagramNode = {
  type: "diagram";
  graph: GraphSpec;
  fit?: "width" | "contain";     // "contain" (default): letterbox to fit a fixed box, e.g. when `grow`d.
                                   // "width": grow height to match the graph's own aspect ratio at 100% width.
  width?: Measure;
  grow?: boolean;
  activeNodes?: Array<string | { node: string; window: WindowRef }>;  // string = active from frame 0
  reveal?: { order?: "rank" | "all"; window?: WindowRef };
  flows?: Array<{ edge: string; window: WindowRef; tone?: Tone; label?: string; direction?: "forward" | "reverse" }>;
};
```

A same-rank pair of nodes (two children of one parent) stacks along the
cross axis of `direction` — for `"right"`, that's vertical; for `"down"`,
horizontal. A diagram with a wide same-rank fan-out reads much taller under
`"right"` than under `"down"`, and vice versa — pick `direction` by which
axis the canvas has room in, not by "logical" top-down vs. left-right.
**Two separate `diagram` nodes placed side by side beats one diagram trying
to show two different topological relationships at once** (e.g. a tree's
parent/child edges and its leaf-level sibling chain) — dagre routes a
same-rank sibling edge awkwardly, and forcing it rarely reads as intended.

**Layout budgets** (validated, not just advisory — see the issue codes
below): keep a diagram to **8 nodes or fewer**; keep each `label`/`detail`
to roughly **18 full-width (CJK) or 30 half-width characters** — past that
it wraps onto multiple lines, and well past that (~2× again) the card stops
growing and the extra lines are cut off, since a node's height stays fixed
regardless of how much text it holds. Move anything longer into the
scene's `narration` instead of a node's `detail`. Inside a `camera`, a
`direction: "down"` graph with 4+ ranks of default-size nodes is already
taller than a typical header+caption scene's content area — prefer
`direction: "right"` for chains with more than 2-3 steps, or split a deep
chain across multiple scenes.

### Code / Terminal

```ts
type CodeSegment = string | { text: string; tone: Tone };
type CodeLine = { segments: CodeSegment[]; indent?: number; diff?: "added" | "removed" };
type CodeNode = {
  type: "code";
  title?: string;
  chrome?: "panel" | "bare";     // "bare" drops the panel gradient/border/shadow — for nesting inside a card
  size?: Size; width?: Measure; grow?: boolean;
  lines: CodeLine[];              // at least 1
  reveal?: { mode?: "all" | "staggered"; window?: WindowRef };
  highlights?: Array<{ lines: [number, number]; window: WindowRef }>;
};

type TerminalNode = {
  type: "terminal";
  title?: string; size?: Size; width?: Measure; grow?: boolean;
  steps: Array<{ command: string; output?: string[]; outputTone?: Tone; window: WindowRef }>;  // at least 1
};
```

### Camera / CameraTarget

```ts
type CameraFocus = "all" | { node: string } | { target: string };
type CameraShot = { window: WindowRef; focus: CameraFocus; zoom?: "wide" | "medium" | "close" };
type CameraNode = { type: "camera"; shots: CameraShot[]; children: DslNode[] };  // at least 1 shot, at least 1 child
type CameraTargetNode = { type: "cameraTarget"; id: string; child: DslNode };
```

`Camera` frames against the ACTUAL box it renders into (measured, not the
composition's raw width/height), so it never overflows or clips — but a
`camera` squeezed into a small box still renders complete-but-*small*,
which is a legibility problem the LLM can fix and the renderer can't: give
a `camera` node the full scene content width, and put any accompanying
step list *above or below* it (a slim strip), never *beside* it — a
`camera_content_too_tall` warning (see below) fires when a nested diagram's
own layout is taller than the scene's content area even before anything
else shares that space. `CameraTarget` ids and a nested `Diagram`'s own
node ids share one namespace within the same `camera` — don't reuse an id.

### Step-track consumers

```ts
type StepsNode  = { type: "steps"; track: string; layout?: "list" | "row"; label?: string; window?: WindowRef };
type SwitchNode = {
  type: "switch";
  track: string;
  mode?: "latch" | "switch";     // "latch" (default): a case stays shown until the next case's steps begin.
                                    // "switch": a case shows only while its own step range is strictly active.
  cases: Array<{ steps: [number, number]; content: DslNode }>;  // inclusive step-index ranges; at least 1
};
```

`switch` has no `grow` field — it renders its matched case through a
transparent fragment, so there's no element of its own to attach `flex-grow`
to. Put `grow: true` on the case's own `content` node instead when a case
needs to fill remaining space.

## Validation issue codes

Everything expressible as an enum/shape constraint is a zod structural
error (code `"schema"`) — a bad `tone`, an unknown node `type`, a missing
required field. Everything else is a genuine cross-reference check in
`src/compiler/validate.ts`. Every issue names a real, copy-pasteable `path`
into the document (never `"root"`), states the offending value verbatim in
`message`, and names concrete legal alternatives in `fix` — this is
deliberate: these strings are Phase 3's retry feedback loop
(`formatIssues()` renders the whole list as one plain-text block meant to be
pasted straight into an LLM retry prompt).

| Code | Fires when | Example |
|---|---|---|
| `schema` | Any zod structural failure — bad enum value, wrong type, missing/extra field, unmatched discriminator | `Unknown node type "graph" — legal types are: stack, text, meter, icon, pill, banner, card, diagram, code, terminal, camera, cameraTarget, steps, switch.` |
| `duplicate_scene_id` | Two scenes share an `id` | `Scene id "walkthrough" is used by scenes[2] and scenes[3].` |
| `beat_order` | Beats violate the intro-once-first / summary-once-last / non-decreasing rule | `scenes[1] has beat "walkthrough" but no "breakdown" scene precedes it.` |
| `window_order` | A `WindowRef`'s resolved `from >= to` | `scenes[0].content.window: from (0.6) must be less than to (0.4).` |
| `duplicate_track_id` | Two tracks in one scene share an `id` | `Track id "checks" is declared twice in scenes[2].tracks.` |
| `unknown_track` | A `WindowRef`/`steps`/`switch` references a track id not declared in this scene | `scenes[2].content.track "lookup" is not declared — declared tracks: "checks".` |
| `track_forward_reference` | A track's `window` references a track declared later in the array | `scenes[1].tracks[0] ("claims") references track "checks", which is declared after it — reorder tracks so each only references an earlier one.` |
| `step_index_out_of_range` | A `{track, step}` or `{track, steps}` index is outside the track's `items` | `scenes[2].content.shots[1].window.step (4) is out of range for track "lookup" (0..3).` |
| `case_range_overlap` | Two `switch` cases cover an overlapping step index | `scenes[2].content.cases[1].steps ([1,2]) overlaps cases[0].steps ([0,1]) on track "checks".` |
| `case_range_gap` | A `switch`'s cases don't cover every step index on the track (0-indexed, contiguous, no gaps) | `scenes[2].content.cases leaves step 3 of track "checks" uncovered — add a case or extend an adjacent range.` |
| `unused_track` | A declared track is never referenced by any node in the scene | `scenes[2].tracks[1] ("claims") is never referenced — remove it or reference it via a WindowRef/steps/switch node.` |
| `duplicate_graph_node_id` | Two nodes in one `graph` share an `id` | `Diagram node id "consumer" is used twice in scenes[1].content.children[0].graph.nodes.` |
| `unknown_graph_node` | An edge's `from`/`to`, or an `activeNodes` entry, references a node id not in `graph.nodes` | `scenes[1].content.graph.edges[2].to references unknown node "consumer2" — declared nodes: producer, queue, consumer.` |
| `duplicate_edge_id` | Two edges (explicit or defaulted) share an id | `Edge id "producer->queue" is used twice in scenes[0].content.graph.edges.` |
| `unknown_edge` | A `flows[].edge` references an edge id not present (explicit or defaulted) in the diagram | `scenes[0].content.flows[0].edge "producer->consumer" is not a declared edge — declared edges: "producer->queue", "queue->consumer".` |
| `unknown_camera_focus` | A `camera` shot's `{node}`/`{target}` isn't registered by a nested `Diagram` or `CameraTarget` | `scenes[2].content.shots[1].focus.node "internalB" is not registered by any Diagram or CameraTarget inside this camera.` |
| `duplicate_camera_target_id` | A `CameraTarget` id collides with another target or a nested Diagram's node id | `cameraTarget id "root" collides with a node id already registered by the nested Diagram.` |
| `camera_target_shadows_node` | Same as above, phrased for the node-id-first case | `Diagram node id "root" is shadowed by a CameraTarget with the same id — camera focus ids must be unique within one Camera.` |
| `transition_too_long` | A scene's `transitionToNext` isn't strictly shorter than both neighbouring scenes | `scenes[1].transitionToNext ("fade", 15 frames) is not shorter than scenes[2] (12 frames) — shorten the transition or lengthen scenes[2].durationInSeconds.` |
| `narration_pacing` (warning) | Narration length implies a pace outside ~0.3×–1.5× a comfortable ~8 chars/sec (Mandarin) | `scenes[1].narration is 128 characters but the scene is 6s — roughly 21 chars/sec, about 2.5x a comfortable pace. fix: shorten to ~50 characters, or raise durationInSeconds to about 16.` |
| `diagram_label_too_long` (warning) | A node's estimated `label`/`detail` width exceeds ~496px (~18 CJK / ~30 half-width chars) — it will wrap onto multiple lines | `Node "authServer"'s label is estimated at ~520px wide — it will wrap onto multiple lines when rendered.` |
| `diagram_label_clipped` | Estimated width exceeds ~992px — past 2 wrapped lines, the card doesn't grow taller and the rest is cut off | `Node "authServer"'s detail is estimated at ~1040px wide — past the point where the card's text wraps to 3+ lines and the extra lines get cut off.` |
| `diagram_too_many_nodes` (warning) | A `graph` has more than 8 nodes | `This diagram has 9 nodes — more than any diagram in the reference examples (max 8) comfortably fits a scene.` |
| `camera_content_too_tall` (warning) | A diagram nested in a `camera` is estimated taller than the scene's content area, even with nothing else sharing it | `This diagram is estimated at ~1200px tall, taller than the ~720px this scene's content area has even with nothing else in it.` |

All 24 codes above have a table-driven test in `src/compiler/parse.test.ts`
asserting the exact code, path shape, and that `message`/`fix` contain the
expected substrings — a new code without a matching test case is a compile
error there (`Record<DslIssueCode, true>` exhaustiveness), not a silent gap.

## Worked example

A minimal but complete two-node diagram scene with a step-driven flow,
narrated at a comfortable pace:

```jsonc
{
  "version": 1,
  "id": "TinyExample",
  "title": "最小可行範例",
  "scenes": [
    {
      "id": "intro",
      "beat": "intro",
      "durationInSeconds": 4,
      "narration": "客戶端向伺服器發出一個請求。",
      "content": {
        "type": "stack", "grow": true, "align": "center", "justify": "center", "gap": "lg",
        "children": [
          { "type": "text", "role": "hero", "content": "最小範例", "align": "center" },
          {
            "type": "diagram", "width": "wide", "fit": "width",
            "graph": {
              "direction": "right",
              "nodes": [
                { "id": "client", "icon": "browser", "label": "Client", "tone": "info" },
                { "id": "server", "icon": "server",  "label": "Server", "tone": "primary" }
              ],
              "edges": [{ "from": "client", "to": "server", "label": "request" }]
            },
            "flows": [{ "edge": "client->server", "window": { "from": 0.3, "to": 0.6 }, "tone": "info" }]
          }
        ]
      }
    },
    {
      "id": "breakdown", "beat": "breakdown", "durationInSeconds": 4,
      "narration": "伺服器收到請求後回傳回應。",
      "content": { "type": "text", "role": "body", "content": "（省略，結構同 intro）" }
    },
    {
      "id": "walkthrough", "beat": "walkthrough", "durationInSeconds": 6,
      "narration": "先驗證，再回應。",
      "tracks": [{ "id": "steps", "window": { "from": 0.1, "to": 0.95 }, "items": [
        { "title": "驗證請求" }, { "title": "回傳回應" }
      ]}],
      "content": { "type": "steps", "track": "steps", "label": "REQUEST LIFECYCLE" }
    },
    {
      "id": "summary", "beat": "summary", "durationInSeconds": 4,
      "narration": "記住：先驗證，才回應。",
      "caption": null,
      "content": { "type": "pill", "tone": "success", "text": "先驗證，才回應" }
    }
  ]
}
```

`parseDocumentOrThrow(doc)` on this document returns a validated
`DslDocument` with zero issues; feeding it to `<DslVideo doc={doc} />` (or
`pnpm render:dsl <file> <out.mp4>`) renders it end to end with no
TypeScript involved.
