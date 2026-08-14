# Phase 2 — DSL + Compiler

## Context

Motife turns a technical concept description into a motion-graphic explainer MP4. The architecture (`motife-plan.md` §2) is: an LLM emits a schema-constrained **semantic DSL**, a **compiler** translates it into a Remotion composition, and a hand-built **component library** sets the ceiling and floor of animation quality. Phases 0 and 1 built the bottom of that stack — a 40s hand-made JWT baseline, then an 8-component library that rebuilt it from parameterised props. Both are closed, all four Phase 1 carry-overs cleared.

Phase 2 builds the two missing middle layers:

- a **JSON Schema** for the DSL, narrative skeleton fixed at 引入 → 拆解 → 逐步演示 → 總結;
- a **compiler** turning a validated document into a rendered composition, with human-readable validation errors — the plan is explicit that error-message quality *is* the agent's self-repair capability, so these strings are a Phase 3 dependency, not polish;
- **three hand-written DSL documents** covering the eval set (JWT auth, MQ backpressure, DB index internals), each running end to end DSL → MP4.

**Exit criterion:** 不碰 TypeScript、只改 JSON 就能產出一支完整影片.

Two outputs feed Phase 3 directly: the hand-written DSLs become the few-shot corpus for prompt → DSL, and the compiler's error strings become the retry feedback loop. A third arrives free: once three videos are registered, `scripts/smoke.mjs` *is* the full eval-set regression `motife-plan.md` §4 demands and which has been unenforceable with only one video in existence.

### The blocking finding

Every existing scene is roughly half raw JSX + inline CSS by line count. Counted across the four JWT scenes and `ComponentGallery`:

| Construct with no expression in any current component's props | Occurrences |
|---|---|
| flex row/column with token gap | 14 |
| fixed px width/height box (`width: 760`, `width: 430`, `height: 190`) | 9 |
| hand-styled text block (`fontFamily`+`fontSize`+`fontWeight`+`letterSpacing`+`color`) | 12 |
| `flex: 1` equal-column row · `justify-content: space-between` row | 2 · 2 |
| conditional render keyed on active step (`activeIndex === n ? … : null`) | 4 branches |
| frame-derived window (`ranges[i].startFrame / durationInFrames`) | 3 |
| frame-conditional `activeNodes` (`frame > 108 ? … : []`) | 1 |
| hand-rolled `interpolate()` progress bar **with `boxShadow`** | 1 |
| absolutely-positioned footer band · inline `<strong>` run · `<pre>` block | 1 each |

The DSL is forbidden all of it (`motife-plan.md` §2 決策2, CLAUDE.md). So Phase 2 is **not** "write a schema over the existing library" — it is "extend the library with semantic layout/text primitives, *then* schema over that." Stage 1 below is the critical path and is deliberately proved in TypeScript before any JSON exists.

### Decisions taken

| Question | Decision |
|---|---|
| Emit strategy | **Runtime interpretation.** A generic `<DslVideo doc>` walks the validated document. No `.tsx` codegen. |
| Existing hand-written JWT scenes | **Port to DSL, keep the TSX registered side by side** through the work for frame-by-frame A/B; delete it in the final commit. |
| New primitive scope | **Enough to reproduce current quality 1:1**, including the step-synced switch and the progress meter. |
| Delivery | **One PR**, staged as ordered commits each of which leaves `pnpm verify` green. |

---

## Stage 1 — Semantic primitives (`src/components/`)

Four new components, two prop extensions, one pure helper. All exported through `src/components/index.ts` (the ESLint-enforced barrel).

### `Stack` — the only layout primitive

```ts
export type StackGap = "none" | "sm" | "md" | "lg" | "xl";     // → tokens.spacing
export type Measure  = "narrow" | "half" | "wide" | "full";     // → 40% / 55% / 78% / 100%

export interface StackProps {
  direction?: "row" | "column";                 // default "column"
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between";
  gap?: StackGap;                               // default "md"
  weights?: number[];                           // main-axis proportions, one per child
  width?: Measure;                              // semantic, never px
  grow?: boolean;                               // fill the cross axis
  window?: Window;
  children?: ReactNode;
}
```

Replaces all 14 flex containers, both `flex: 1` rows (`weights` omitted ⇒ equal), both `space-between` rows, `height: "100%"`, Summary's absolute footer (root stack `justify="between"`, footer last child), and every raw px width. `weights: [1, 1.6]` reproduces Walkthrough's 430-vs-`flex:1` split.

### `Text` — semantic typography

```ts
export type TextRole = "hero" | "title" | "subtitle" | "label" | "body" | "detail";
export type TextRun  = string | { text: string; tone?: Tone; strong?: boolean };

export interface TextProps {
  role?: TextRole;                              // default "body"
  content: string | TextRun[];
  tone?: Tone; align?: "start" | "center" | "end"; window?: Window;
}
```

The role table is the one place font size/weight/letter-spacing live:

| role | fontSize | weight | letterSpacing | default color |
|---|---|---|---|---|
| `hero` | `xl` (104) | 820 | −5 | `text` |
| `title` | `lg` (72) | 750 | −2.5 | `text` |
| `subtitle` | 28 | 600 | 1 | `textMuted` |
| `label` | `xs` (20) | 800 | 3, uppercase | tone `fg`, else `textMuted` |
| `body` | `md` (42) | 700 | 0 | `text` |
| `detail` | `sm` (26) | 400 | 0 | `textMuted` |

`hero` carries Intro's exact `820/−5` and `title` matches `Scene`'s existing header — so these are byte-identical replacements, not approximations. `TextRun[]` reuses `CodeSegment`'s proven shape and preserves Summary's inline `<strong>` run.

### `Meter` — progress / level bar

```ts
export interface MeterProps {
  window?: Window;        // animate 0→1 across this span
  value?: number;         // or hold a fixed level 0..1 (mutually exclusive)
  tone?: Tone; label?: string; size?: Size;
  threshold?: number;     // marker on the track — the backpressure high-water line
}
```

Replaces Walkthrough's hand-rolled bar (including the `boxShadow` that CLAUDE.md literally forbids in the DSL), and earns its keep again in MQ backpressure.

### `StepSwitch` — step-synced content

```ts
export interface StepSwitchProps {
  stepWindows: Window[];                       // normally from stepWindows()
  cases: Array<{ steps: [number, number]; content: ReactNode }>;   // inclusive index range
  mode?: "latch" | "switch";                   // "latch" (default) matches today's activeIndex fallback
}
```

Range-based cases collapse Walkthrough's 4-branch status pill to 2.

### `stepWindows()` — the helper that removes frame math from scenes

Add next to `resolveSteps` in `src/components/motion/timing.ts`:

```ts
/** Each step's span as a Window (fractions of the enclosing Scene) — the
 *  duration-independent counterpart of resolveSteps(). Exact, because
 *  resolveSteps is linear in durationInFrames. */
export function stepWindows(steps: readonly WeightedStep[], window: Window): Window[];
```

This is what makes symbolic step windows (Stage 2) a **pure compile-time** resolution rather than a render-time React context — the interpreter never needs step state, and validation can range-check indices statically. Unit-test it for agreement with `resolveSteps` at several durations.

### Two prop extensions + one export

- **`CodeBlock`** gains `chrome?: "panel" | "bare"` (default `"panel"`). `"bare"` drops the gradient/border/shadow/padding so a CodeBlock can sit inside a `Callout variant="card"` without double chrome — this replaces Breakdown's `<pre>` and Walkthrough's inline mono formula, and they gain staggered reveal for free.
- **`Diagram`** widens `activeNodes` to `Array<string | { node: string; window: Window }>`, replacing Intro's `frame > 108 ? … : []` and removing the last `useCurrentFrame()` from scene code.
- **`src/components/icons/registry.tsx`** exports `ICON_NAMES` as a `const` array with `IconName` derived from it, mirroring how `TONE_NAMES` already works, so the schema can build a zod enum from it.

### Two sharp edges to settle here

1. `Callout variant="card"` hardcodes `alignItems: "center"`, which is why scenes fight it with `alignSelf` overrides in 7 places. Once a `Stack` is the card interior, change the card to `alignItems: "stretch"` and let the Stack decide. This touches every card in the video — A/B it.
2. Diagrams sit in fixed-height boxes today (`height: 260`, `height: 190`). Under `Stack`, use `fit: "width"` and let the SVG aspect ratio set the height. This shifts each scene's vertical rhythm slightly — verify against `docs/assets/*-v2.png` before moving on.

### Prove the primitives in TypeScript first

Rewrite the four existing JWT TSX scenes using only these primitives until `src/remotion/compositions/jwt-auth/scenes/**` contains **zero `<div style>` and zero `useCurrentFrame()`**. If the primitives can't reproduce the scenes in TypeScript, they certainly can't in JSON — and failing here costs one stage, not the phase.

**Gate:** `pnpm verify` green; `TOTAL_FRAMES` still 1200; unit tests for `stepWindows` and `Stack` weight math; human A/B of three canonical frames against `docs/assets/*-v2.png`.

---

## Stage 2 — Schema and validator (`src/dsl/`, `src/compiler/`) — no rendering

`pnpm add -E zod@4.4.3` — the exact version `remotion@4.0.508` and `@remotion/cli@4.0.508` already declare, and `@remotion/zod-types@4.0.508` is pre-listed in `pnpm-workspace.yaml`. zod is not a `@remotion/*` package, so plain `pnpm add` is correct; do **not** use `npx remotion add`. zod v4 buys `z.infer` for the TS types, `z.toJSONSchema()` for Phase 3's structured-output contract, and possibly the Studio props editor.

```
src/dsl/
  schema.ts  types.ts  index.ts
  docs/{jwt-auth,mq-backpressure,db-index}.json
  docs/manifest.ts        # the ONLY module importing *.json
  docs/manifest.test.ts
src/compiler/
  errors.ts  zodIssues.ts  parse.ts  validate.ts  windows.ts  timeline.ts
  render/{DslVideo,DslSceneView,nodes}.tsx      # Stage 3
```

This matches the `src/dsl/` (schema) / `src/compiler/` (compile) split already reserved in `docs/project-overview.md` §4.

### Envelope and scene

```jsonc
{ "version": 1, "id": "JwtAuthFlow", "title": "JWT 驗證流程",
  "fps": 30, "width": 1920, "height": 1080, "scenes": [ … ] }
```

```jsonc
{ "id": "walkthrough", "beat": "walkthrough", "durationInSeconds": 18,
  "narration": "…",              // Phase 3 replaces the duration with measured TTS length
  "caption": "…",                // omit → narration is used; null → no caption
  "transitionToNext": "cut",
  "background": { "variant": "grid", "glow": "info" },
  "header": { "eyebrow": "02 · Verification", "title": "API 如何驗證 JWT？" },
  "tracks": [ … ], "content": { /* exactly one root node */ } }
```

`fps`/`width`/`height` default via `.default()`. `caption` defaulting to `narration` removes a duplication an LLM would get wrong and pre-wires Phase 3's caption track; explicit `null` reproduces Summary's deliberate omission.

**Beat rule** — relaxed slightly from "exactly four": `intro` once and first, `summary` once and last, at least one `breakdown` and one `walkthrough` between, beats non-decreasing in the fixed order. Preserves the mandated skeleton while letting MQ/DB split a long walkthrough across two scenes at zero cost.

### Step tracks and the `WindowRef` union — the key design decision

A scene declares named step tracks; nodes reference them symbolically. This is the only way an LLM can say "while the signature is being verified" without doing arithmetic, and it is what deletes Walkthrough's three `ranges[i].startFrame / durationInFrames` round-trips.

```jsonc
"tracks": [
  { "id": "checks", "window": { "from": 0.05, "to": 0.98 },
    "items": [ { "title": "Extract token",    "detail": "讀取 Authorization header" },
               { "title": "Verify signature", "detail": "用可信任的 key 驗章" },
               { "title": "Validate claims",  "detail": "檢查 exp · iss · aud" },
               { "title": "Authorize",        "detail": "套用角色與權限", "weight": 0.6 } ] },
  { "id": "claims", "window": { "track": "checks", "step": 2 },      // nested, symbolic
    "items": [ { "title": "exp", "detail": "尚未過期" }, … ] }
]
```

```ts
type WindowRef =
  | { from: number; to: number }                  // absolute fractions of the scene
  | { track: string; step: number }               // one step's span
  | { track: string; steps: [number, number] };   // inclusive step-index range
```

Resolution is pure and duration-independent via `stepWindows()`, so every `WindowRef` collapses to a concrete `{from,to}` before any component mounts. Tracks must be declared before use (forward references rejected), making resolution a single forward pass.

### Content nodes

One flat discriminated union on `"type"`. Note `Callout`'s three variants are **flattened into three node types** — zod's `discriminatedUnion` needs unique discriminator values, and one tag ⇒ one shape is strictly better for LLM structured output.

```ts
type DslNode =
  // layout / text (Stage 1 primitives)
  | { type: "stack"; direction?; align?; justify?; gap?; weights?: number[];
      width?: Measure; grow?: boolean; window?: WindowRef; children: DslNode[] }
  | { type: "text"; role?: TextRole; content: string | TextRun[]; tone?: Tone; align?; window?: WindowRef }
  | { type: "meter"; tone?: Tone; label?: string; size?: Size; window?: WindowRef; value?: number; threshold?: number }
  | { type: "icon"; name: IconName; tone?: Tone; size?: Size }
  // Callout, flattened
  | { type: "pill";   text: string; icon?: IconName; tone?: Tone; window?: WindowRef }
  | { type: "banner"; text: string; detail?: string; icon?: IconName; tone?: Tone; window?: WindowRef }
  | { type: "card";   emphasis?: Emphasis; size?: Size; tone?: Tone; window?: WindowRef;
      width?: Measure; grow?: boolean; children: DslNode[] }
  // library components
  | { type: "diagram"; graph: GraphSpec; fit?: "width"|"contain"; width?: Measure;
      activeNodes?: Array<string | { node: string; window: WindowRef }>;
      reveal?: { order?: "rank"|"all"; window?: WindowRef };
      flows?: Array<{ edge: string; window: WindowRef; tone?: Tone; label?: string; direction?: "forward"|"reverse" }> }
  | { type: "code"; title?: string; chrome?: "panel"|"bare"; size?: Size; width?: Measure;
      lines: CodeLine[]; reveal?: {…}; highlights?: Array<{ lines: [number,number]; window: WindowRef }> }
  | { type: "terminal"; title?: string; size?: Size; width?: Measure;
      steps: Array<{ command: string; output?: string[]; outputTone?: Tone; window: WindowRef }> }
  | { type: "camera"; shots: Array<{ window: WindowRef; focus: "all" | {node:string} | {target:string};
      zoom?: "wide"|"medium"|"close" }>; children: DslNode[] }
  | { type: "cameraTarget"; id: string; child: DslNode }
  // step-track consumers
  | { type: "steps";  track: string; layout?: "list"|"row"; label?: string; window?: WindowRef }
  | { type: "switch"; track: string; mode?: "latch"|"switch"; grow?: boolean;
      cases: Array<{ steps: [number, number]; content: DslNode }> };
```

`Tone`/`IconName`/`Size`/`Emphasis` are `z.enum(TONE_NAMES)` etc., so a bad tone or icon is a zod error listing the legal values for free. `width?: Measure` appears only on box-like nodes — exactly those carrying a raw px width today. No `className`, no `style`, no hex, no px, no coordinates anywhere.

Because a `switch` case's content is any node, Walkthrough's dynamic card tone (`info` → `success` on the last step) stays expressible: wrap the whole `card` in a `switch` with cases `[0,2]` and `[3,3]`. Nothing about the existing video is lost.

Note: no loops or templating by design. Breakdown's three parts and Summary's three rules are written out three times with explicit staggered windows rather than the `PARTS.map((part, index) => … 0.18 + index * 0.1 …)` the TSX uses. Verbose, but an LLM emits explicit repetition far more reliably than a correct index formula.

**zod recursion:** use v4's getter form (`get children() { return z.array(dslNodeSchema); }`) to preserve inference; fall back to a hand-declared `interface DslNode` with `const dslNodeSchema: z.ZodType<DslNode> = z.lazy(…)` if inference degrades (risk R4).

### Errors — the Phase 3 contract

```ts
export type DslIssueCode =
  | "schema" | "duplicate_scene_id" | "beat_order" | "window_order"
  | "unknown_track" | "track_forward_reference" | "step_index_out_of_range"
  | "case_range_overlap" | "case_range_gap"
  | "duplicate_graph_node_id" | "unknown_graph_node" | "duplicate_edge_id" | "unknown_edge"
  | "unknown_camera_focus" | "duplicate_camera_target_id" | "camera_target_shadows_node"
  | "transition_too_long" | "unused_track" | "narration_pacing";

export interface DslIssue {
  path: string;                       // scenes[2].content.children[1].flows[0].edge
  code: DslIssueCode;
  severity: "error" | "warning";
  message: string;                    // one sentence, names the offending value verbatim
  fix: string;                        // repair instruction naming concrete legal alternatives
}
export class DslValidationError extends Error { readonly issues: readonly DslIssue[] }
export function formatIssues(docId: string, issues: readonly DslIssue[]): string;
```

```
motife DSL: 2 errors, 1 warning in "MqBackpressure".

ERROR  scenes[2].content.children[1].flows[0].edge
  Unknown edge "producer->consumer".
  fix: use an edge id declared in this diagram's graph.edges —
       "producer->queue", "queue->consumer". An edge's id defaults to
       "<from>-><to>" unless the edge sets an explicit "id".

WARN   scenes[1].narration
  Narration is 128 characters but the scene is 6s — roughly 21 chars/sec,
  about 2.5x a comfortable Mandarin narration pace (~8 chars/sec).
  fix: shorten the narration to ~50 characters, or raise
       scenes[1].durationInSeconds to about 16.
```

Three properties the tests enforce: the path is always a real copy-pasteable location (never `"root"`); the offending value appears verbatim in `message`; `fix` names concrete legal alternatives rather than restating the rule.

`zodIssues.ts` maps `ZodError` → `DslIssue[]`, with a special case for union failures (zod's raw union errors are unreadable): if the input's `type` isn't a known tag, emit one issue naming the legal tags; if it is known, recurse into that member's error only.

The `narration_pacing` warning is worth building now precisely because `durationInSeconds` is provisional — it's the only automatic check that the hand-picked durations are plausible, and Phase 3 replaces it with real TTS measurement.

Everything enumerable goes in zod (free enumerated errors); `validate.ts` handles only genuine cross-references — edge endpoints, `flows[].edge`, camera focus resolution and the shared node/target id namespace, window ordering, step-index ranges, case overlap, transition-shorter-than-both-neighbours (today a mid-render throw from `buildTimeline`).

**Gate — tests only, nothing wired to a render, so this stage cannot break the video:**
- table-driven `validate.test.ts` mutating one valid fixture: exactly one issue, correct code, exact path, `message` contains the offending value, `fix` contains every expected substring;
- **code exhaustiveness**: build `Record<DslIssueCode, true>` from the case table so a new code without a test case is a *compile* error;
- `formatIssues()` snapshot on a mixed-severity document — this string is Phase 3's contract;
- `z.toJSONSchema(dslDocumentSchema)` must not throw and must contain the four beat literals.

Also in this stage: `tsconfig.json` gains `"resolveJsonModule": true` (importing `*.json` currently fails `tsc`), and `eslint.config.mjs`'s barrel-rule `files` glob extends to `src/compiler/**/*.{ts,tsx}` since the renderer imports the component library.

---

## Stage 3 — Interpreter and registration

- `src/compiler/render/nodes.tsx` — `Record<DslNode["type"], FC<NodeProps>>`, keyed on the discriminated union's literal tags. **This is where the compile-time exhaustiveness the TSX `sceneRegistry.tsx` provided is preserved**: adding a schema variant without a renderer stays a compile error. It moves from scene ids to node kinds, and survives.
- `src/compiler/render/DslSceneView.tsx` — one scene: `<Scene>` + track resolution + root node.
- `src/compiler/render/DslVideo.tsx` — takes `{ doc }`, calls the **existing** `buildTimeline` and renders the **existing** `<SceneSeries>` with a components record built from the document. All transition wiring reused untouched.
- `src/dsl/docs/manifest.ts` — the only module importing the JSON files; exports `RAW_DOCS` unvalidated.
- `src/remotion/Root.tsx` — `const DOCS = RAW_DOCS.map(parseDocumentOrThrow)` at module scope, so a malformed baseline fails the bundle loudly instead of rendering garbage. Maps `DOCS` to `<Composition>` entries with a **literal** `durationInFrames` computed at module scope — deliberately not `calculateMetadata`, so the smoke gate's correctness never depends on whether `getCompositions()` evaluates it in 4.0.508.
- Plus one `DslPreview` composition with a small valid `BLANK_DOC` default and `calculateMetadata` deriving duration/fps/size from whatever doc it's handed. This is the zero-TypeScript path: `pnpm render:dsl` → `remotion render … DslPreview`. `scripts/render-dsl.mjs` (a ~15-line wrapper reading a bare doc file, wrapping it as `{ doc }`, and calling `renderMedia` with one shared `inputProps` object per the CLAUDE.md rule) lets it take a bare doc path — and is the direct ancestor of Phase 3's render driver.

One public constructor discipline: `DslDocument` is only ever produced by `parseDocument()`, never constructed literally or cast. Add it to CLAUDE.md's hard constraints.

`scripts/smoke.mjs` needs **zero changes** — it already iterates every registered composition, so `DslPreview` and all three videos are covered automatically.

**Gate:** `pnpm verify`; `pnpm render:dsl` renders a hand-written 1-scene doc end to end. Verify `<Composition schema={…}>` typing here and drop the prop if zod v4 fights Remotion 4.0.508's typings (risk R1) — it's Studio ergonomics, not load-bearing.

---

## Stage 4 — Port JWT to DSL, A/B against the baseline

Author `src/dsl/videos/jwt-auth.json`, registered under the **temporary** id `JwtAuthFlowDsl` alongside the TSX `JwtAuthFlow`, so smoke renders both and stills sit side by side.

Because the doc keeps `durationInSeconds` at 6/10/18/6 with all cuts, the pin holds **unchanged at 1200 frames with offsets `[0, 180, 480, 1020]`**. `storyboard.test.ts`'s pin moves to `manifest.test.ts`, generalised to every document:

```ts
const FRAME_PINS: Record<string, { total: number; from: number[] }> = {
  JwtAuthFlow:      { total: 1200, from: [0, 180, 480, 1020] },
  MqBackpressure:   { total: /* pinned when authored */, from: [...] },
  DbIndexInternals: { total: /* pinned when authored */, from: [...] },
};
```

Also assert doc-id uniqueness across the manifest and beat ordering per doc.

**Stills:** capture a `-v3` set at the same three canonical frames into `docs/assets/`. Keep v1 (Phase 0 hand-built) and v2 (Phase 1 library rebuild) — they are the quality ladder, they cost ~11 MB, and comparing v2 → v3 is the entire point of this gate. Add a short table naming which generation each file belongs to.

**Gate:** `pnpm verify`; frame pin holds; human A/B v2 vs v3. Demonstrate the exit criterion explicitly — change a narration line, a tone, and a step in the JSON, re-render, no TypeScript touched. **This is the point at which the written exit criterion is satisfied.**

---

## Stage 5 — Message Queue backpressure (`MqBackpressure`, ~40s)

First real user of `Terminal` and the `queue` icon — `docs/primitive-inventory.md` records 0 uses at Phase 0 exit.

| Beat | ~s | Content |
|---|---|---|
| intro | 7 | Hero 「當生產者比消費者快」. `diagram` producer → queue → consumer, healthy-rate `flows` on both edges. Pill "BACKPRESSURE, EXPLAINED" |
| breakdown | 11 | 3-card row (same shape as JWT Breakdown): 生產速率 / 消費速率 / 佇列深度, each `text role=label` + `meter`. Producer at 1.0, consumer at 0.6, depth animating past a `threshold` marker. Warning pill 「⚠ 無界佇列 = 延遲無上限 + OOM」 |
| walkthrough | 16 | Track `strategies`, 4 steps: 有界佇列(阻塞) / 丟棄策略 / 消費端回壓訊號 / 自動擴縮. Left `steps` list, right `switch` — case 0 diagram + meter pinned at threshold; case 1 diagram with a `danger` reverse flow ("dropped"); case 2 **`terminal`** running `kafka-consumer-groups --describe` with LAG falling; case 3 diagram with a second consumer activated |
| summary | 6 | 3 rules: 永遠設上界 / 明確選擇丟棄或阻塞 / 用 lag 而不是佇列長度告警 |

**Predicted gap:** case 3 wants to *add* a consumer node, but adding a node re-runs dagre and shifts everything — a visible jump. Mitigate without new code by declaring both consumers up front and using `activeNodes` windows to dim/undim. If that reads badly, the small fix is `GraphNodeSpec.window?: WindowRef` so a node can fade in without changing layout. Budget it; don't pre-build it.

---

## Stage 6 — DB index internals (`DbIndexInternals`, ~42s)

Ordered after MQ deliberately: the B+Tree is the higher-risk content and benefits from a battle-tested interpreter. First real `Camera` use in a narrative video — exactly what it was built for — and the first `direction: "down"` graph.

| Beat | ~s | Content |
|---|---|---|
| intro | 7 | Hero 「索引到底做了什麼」. `diagram` branching from one query node: `query → tableScan` and `query → index → row` (`document`/`database` icons). `code` with `SELECT * FROM users WHERE email = ?` |
| breakdown | 12 | B+Tree anatomy: **two stacked diagrams** — `direction: "down"` root→internal→leaf with key ranges in `detail`, and below it a `direction: "right"` leaf-sibling chain. Card explaining 排序副本 + 指標 |
| walkthrough | 16 | Track `lookup`, 4 steps: 從 root 比較 key / 下降到 internal / 命中 leaf / 取 row pointer 回表. `camera` wrapping the tree, one shot per step focusing `{ node: … }` at `close` zoom. Right panel `switch` with the comparison at each level |
| summary | 7 | 3 rules: 索引是排序好的副本 / 左前綴才吃得到複合索引 / 寫入要付維護成本. `terminal` with `EXPLAIN ANALYZE` output |

**Biggest content risk in the phase:** a B+Tree's leaf-level sibling chain is a same-rank edge, which dagre routes awkwardly. Options cheapest-first: (i) accept dagre's routing; (ii) **two stacked diagrams as above** — reads as a real B+Tree picture with zero new code; (iii) build a `TreeDiagram`. **Take (ii). Explicitly do not build a tree component in Phase 2** — if the visual doesn't hold up, that's a Phase 4 finding, not a Phase 2 blocker.

---

## Stage 7 — Cutover and docs (final commits)

Delete `scenes/*.tsx`, `sceneRegistry.tsx`, `JwtAuthFlow.tsx`, `storyboard.ts`, `storyboard.test.ts`; rename the doc id to `JwtAuthFlow`.

**Deletion hazard:** `ComponentGallery.tsx` imports `FPS` from `jwt-auth/storyboard`. Move `FPS`/`WIDTH`/`HEIGHT` to `src/remotion/compositions/videoDefaults.ts` as part of this stage. `ComponentGallery` itself stays TSX permanently — it is a component showcase, not an eval-set video, and the only place a component with no DSL node yet can still be render-exercised (and the only place a fade transition and `CameraTarget` are smoked).

Docs, all with `> **Last updated:**` frontmatter bumped:

- **New `docs/dsl-schema.md`** — envelope, scene, beat rule, track model and `WindowRef`, every node type, every `DslIssueCode` with a real example message, one complete worked document. **This doc's content is literally what goes into Phase 3's system prompt** — write it for that audience from day one.
- `docs/component-library.md` — add `Stack`/`Text`/`Meter`/`StepSwitch`/`stepWindows()`; update `CodeBlock` (`chrome`), `Diagram` (windowed `activeNodes`), `Callout` (card alignment); replace "Open items for Phase 2" with Phase 3 items; add the v1/v2/v3 stills table.
- `docs/project-overview.md` — §1.3 rewrite; §4 tree gains `src/dsl/` and `src/compiler/`, loses `compositions/jwt-auth/`; **§5 Domain Models is currently "TBD — the closest thing, the DSL JSON Schema, is a Phase 2 deliverable" → fill it in**, pointing at `docs/dsl-schema.md`; §6 composition-registry bullets.
- `docs/primitive-inventory.md` — append a Phase 2 outcome section listing the four primitives the port actually required beyond Phase 1's eight. That is exactly the "gap the plan didn't anticipate" finding the doc's own instructions call most valuable.
- `README.md` — the structure block is stale (omits `src/components/` entirely, labels `src/remotion/` as "Phase 0"). Rewrite; add `pnpm render:dsl`; add `docs/dsl-schema.md` to the table.
- `CLAUDE.md` — the convention *"New scenes go in `storyboard.ts` + `sceneRegistry.tsx`"* becomes false; replace with the JSON-document workflow. Add the `parseDocument()`-only hard constraint. Add `docs/dsl-schema.md` to "Read before you work".
- `motife-plan.md` — tick the Phase 0/1/2 checkboxes and rewrite §6 「立即下一步」, which still lists Phase 0 steps.

Open a progress item under `progress/` via the progress-tracker skill **before Stage 1**, update the work log per stage, close at the end.

---

## Verification

```bash
pnpm verify
```

`tsc --noEmit` + `eslint .` + `vitest run` + `node scripts/smoke.mjs`. Green at the end of every stage, not just at the end. Once the three videos are registered, the smoke step *is* `motife-plan.md` §4's full eval-set regression.

Beyond the gate:

1. **Full MP4 renders** watched end to end for all three videos (`pnpm render` is currently hardcoded to `JwtAuthFlow` — parameterise it). Stills prove pixels; only playback catches pacing and desync.
2. **A/B the JWT port** — DSL stills vs `docs/assets/jwt-auth-*-v2.png` at matching frames, before deleting the TSX. Quality must not regress; that was Phase 1's acceptance bar.
3. **Exit-criterion proof** — on a clean tree, hand-write a fourth JSON document and render it with `pnpm render:dsl scratch/adhoc.json out/adhoc.mp4`, touching no TypeScript. Record the result in the progress item.
4. **Error-message review** — read `formatIssues` output for the whole malformed corpus as if you were the Phase 3 LLM receiving it. Every message must name a path and a concrete fix.
5. **Studio spot-check** — `pnpm dev`, confirm each composition mounts.

## Risks

| # | Risk | Detect | Fallback |
|---|---|---|---|
| R1 | `<Composition schema>` may not accept a zod **v4** schema in 4.0.508 (typings may expect v3) | Stage 3 typecheck | Drop the prop — Studio ergonomics only; `calculateMetadata` + `parseDocumentOrThrow` carry the load |
| R2 | `getCompositions()` may not evaluate `calculateMetadata`, giving smoke wrong durations | Avoided by design — baselines use module-scope literal durations | n/a |
| R3 | `tsconfig` has `"lib": ["es2015"]`; zod v4's `.d.ts` inference may need newer lib types | Stage 2 typecheck | Bump to `"lib": ["ES2020"]` — safe, the render target is modern headless Chrome |
| R4 | Recursive `discriminatedUnion` with ~16 members may blow up TS inference or slow `tsc` | Stage 2 | Hand-declare `interface DslNode`, annotate `z.ZodType<DslNode> = z.lazy(…)` |
| R5 | `z.toJSONSchema()` emits `$ref`/`$defs`; LLM structured-output `$ref` support is limited | Stage 2 test asserts it's produced | Note in `docs/dsl-schema.md` as a Phase 3 item — depth-limited flattening may be needed |
| R6 | `Callout` card `center → stretch` visually touches every card | Stage 1 A/B | Per-Stack `align` overrides |
| R7 | Diagram `fit: "width"` instead of a fixed-height box shifts vertical rhythm | Stage 1 A/B | Add `height?: Measure` to Stack |
| R8 | zod lands in the browser render bundle (Root parses at module scope) | Accepted | ~60 KB is irrelevant headless, mildly relevant for `@remotion/player` in Phase 4. Keep the parse — a malformed baseline should fail loudly. The interpreter imports schema **types only**, so zod isn't pulled in twice |
| R9 | B+Tree leaf-sibling chain routes badly under dagre | Stage 6 | Two stacked diagrams; do not build a tree component |
| R10 | **Scope.** `motife-plan.md` estimates 2 weeks (16–24 h at 8–12 h/wk). Realistic: Stage 1 ~5 h, Stage 2 ~6 h, Stage 3 ~5 h, Stage 4 ~4 h, Stages 5–6 ~7 h each, Stage 7 ~3 h ⇒ **33–40 h, roughly 3 weeks** at this cadence — and that excludes writing Chinese narration for two un-storyboarded topics, which is content work, not engineering | Ongoing | The written exit criterion is satisfied at Stage 4. Stage 6 (DB index) is the clean deferral point if two weeks is a hard constraint |

## Delivery

One feature branch `phase-2/dsl-compiler`, one PR into `main` (never commit to `main`). Commits ordered as the stages above, each leaving `pnpm verify` green so a reviewer can check out any intermediate commit. The TSX deletion is last, so the diff tells the migration story and the side-by-side rendering is inspectable at Stage 4–6 commits.

Staging Stages 5 and 6 *before* the cutover is deliberate: if the DSL turns out inadequate for a topic it hasn't seen, the TSX JWT is still there as the escape hatch.
