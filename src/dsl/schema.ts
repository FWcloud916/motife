// The Phase 2 DSL — a JSON Schema (via zod v4's z.toJSONSchema()) that
// constrains what an LLM (or a human) can write, and the single source of
// truth `src/compiler/` compiles against. Every field here is semantic and
// JSON-serializable: no className, no boxShadow, no raw coordinates
// (motife-plan.md §2 決策2). Cross-reference against
// `src/components/index.ts` — every node type below maps onto exactly one
// library component or Stage 1 primitive; see docs/dsl-schema.md for the
// human-readable reference this schema is built to match.
//
// zod v4, pinned to 4.4.3 — the exact version `remotion`/`@remotion/cli`
// 4.0.508 already resolve as a peer (see package.json). Recursive node
// references use `z.lazy(() => dslNodeSchema)`, not v4's newer getter
// pattern: a getter looks like it should be lazy enough (the zod docs'
// mutually-recursive User/Post example uses one), but `.strict()` reads
// `.shape` eagerly while a schema is still being built, which resolves the
// getter — and therefore `dslNodeSchema` — before its own `const` has
// finished initializing (a real `ReferenceError` here, not just a type
// error). `z.lazy()`'s callback is the one thing genuinely deferred to
// parse time, which is what a 14-member recursive discriminated union
// needs.
import { z } from "zod";
import { ICON_NAMES, TONE_NAMES } from "../components";
import type { DslNode } from "./types";

// A zod schema known (via explicit annotation, not inference) to produce a
// DslNode. Every z.lazy(() => dslNodeSchema) reference below is typed with
// this explicitly —
// see types.ts's file-header comment for why inference alone can't close
// the loop across a 14-member recursive discriminated union.
type NodeSchema = z.ZodType<DslNode>;

// ---------------------------------------------------------------------------
// Shared vocabulary
// ---------------------------------------------------------------------------

export const toneSchema = z.enum(TONE_NAMES);
export const iconNameSchema = z.enum(ICON_NAMES);
export const sizeSchema = z.enum(["sm", "md", "lg"]);
export const emphasisSchema = z.enum(["low", "medium", "high"]);
export const measureSchema = z.enum(["narrow", "half", "wide", "full"]);
export const gapSchema = z.enum(["none", "sm", "md", "lg", "xl"]);
export const beatSchema = z.enum(["intro", "breakdown", "walkthrough", "summary"]);
export const sceneTransitionSchema = z.enum(["cut", "fade"]);

// ---------------------------------------------------------------------------
// WindowRef — the symbolic timing union. An absolute {from,to} fraction of
// the enclosing scene, or a reference into a scene-level step `track`
// (motife-plan.md §2 決策4: timeline is narration-driven, so nothing here
// is a frame number). Resolved to a concrete Window by
// `src/compiler/windows.ts`'s resolveWindowRef(), never inline in a
// component.
// ---------------------------------------------------------------------------

export const absoluteWindowRefSchema = z
  .object({
    from: z.number().min(0).max(1),
    to: z.number().min(0).max(1),
  })
  .strict();

export const stepWindowRefSchema = z
  .object({
    track: z.string().min(1),
    step: z.number().int().min(0),
  })
  .strict();

export const stepRangeWindowRefSchema = z
  .object({
    track: z.string().min(1),
    steps: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  })
  .strict();

// A plain (non-discriminated) union, deliberately: the three shapes don't
// share one literal tag, and the schema-shape difference (from/to vs.
// track/step vs. track/steps) is unambiguous on its own. zod's default
// union error is famously unhelpful when every branch fails — that's
// handled with a targeted message in src/compiler/zodIssues.ts, not by
// forcing an artificial discriminator field into every document.
export const windowRefSchema = z.union([
  absoluteWindowRefSchema,
  stepWindowRefSchema,
  stepRangeWindowRefSchema,
]);

// ---------------------------------------------------------------------------
// Step tracks — a scene-level named list of steps (motife-plan.md §3 Phase
// 2: "每個 step 含元件引用、參數、旁白文字"), referenced symbolically by
// `steps`/`switch` nodes and by WindowRef's step/steps forms. Mirrors
// src/components/StepReveal's `Step` shape.
// ---------------------------------------------------------------------------

export const stepItemSchema = z
  .object({
    title: z.string().min(1),
    detail: z.string().optional(),
    /** Share of the track's window this step occupies, relative to the
     * other steps'. Defaults to 1 (equal split). */
    weight: z.number().positive().optional(),
    outcome: z.enum(["pass", "fail"]).optional(),
  })
  .strict();

export const trackSchema = z
  .object({
    id: z.string().min(1),
    /** A track's own window is always absolute or another track's
     * step/steps — never itself, which would be a cycle. Cycle and
     * forward-reference checks live in src/compiler/validate.ts, not here:
     * zod can express "a WindowRef" but not "acyclic among sibling
     * tracks declared earlier in this array". */
    window: windowRefSchema,
    items: z.array(stepItemSchema).min(1),
  })
  .strict();

// ---------------------------------------------------------------------------
// Content nodes — one flat discriminated union on `type`. Callout's three
// variants are flattened into three node types (pill/banner/card): zod's
// discriminatedUnion needs unique discriminator values per member, and one
// tag -> one shape is also strictly better for LLM structured output than
// a nested variant field.
// ---------------------------------------------------------------------------

const textRunSchema = z.union([
  z.string(),
  z
    .object({
      text: z.string(),
      tone: toneSchema.optional(),
      strong: z.boolean().optional(),
    })
    .strict(),
]);

const stackSchema = z
  .object({
    type: z.literal("stack"),
    direction: z.enum(["row", "column"]).optional(),
    align: z.enum(["start", "center", "end", "stretch"]).optional(),
    justify: z.enum(["start", "center", "end", "between"]).optional(),
    gap: gapSchema.optional(),
    width: measureSchema.optional(),
    grow: z.boolean().optional(),
    window: windowRefSchema.optional(),
    children: z.array(z.lazy((): NodeSchema => dslNodeSchema)).optional(),
  })
  .strict();

const textSchema = z
  .object({
    type: z.literal("text"),
    role: z.enum(["hero", "title", "subtitle", "label", "body", "detail"]).optional(),
    content: z.union([z.string(), z.array(textRunSchema).min(1)]),
    tone: toneSchema.optional(),
    align: z.enum(["start", "center", "end"]).optional(),
    window: windowRefSchema.optional(),
  })
  .strict();

const meterSchema = z
  .object({
    type: z.literal("meter"),
    tone: toneSchema.optional(),
    label: z.string().optional(),
    size: sizeSchema.optional(),
    window: windowRefSchema.optional(),
    value: z.number().min(0).max(1).optional(),
    threshold: z.number().min(0).max(1).optional(),
  })
  .strict();

const iconNodeSchema = z
  .object({
    type: z.literal("icon"),
    name: iconNameSchema,
    tone: toneSchema.optional(),
    size: sizeSchema.optional(),
  })
  .strict();

const pillSchema = z
  .object({
    type: z.literal("pill"),
    text: z.string().min(1),
    icon: iconNameSchema.optional(),
    tone: toneSchema.optional(),
    window: windowRefSchema.optional(),
  })
  .strict();

const bannerSchema = z
  .object({
    type: z.literal("banner"),
    text: z.string().min(1),
    detail: z.string().optional(),
    icon: iconNameSchema.optional(),
    tone: toneSchema.optional(),
    window: windowRefSchema.optional(),
  })
  .strict();

const cardSchema = z
  .object({
    type: z.literal("card"),
    emphasis: emphasisSchema.optional(),
    size: sizeSchema.optional(),
    tone: toneSchema.optional(),
    window: windowRefSchema.optional(),
    width: measureSchema.optional(),
    grow: z.boolean().optional(),
    children: z.array(z.lazy((): NodeSchema => dslNodeSchema)).min(1),
  })
  .strict();

const graphNodeSpecSchema = z
  .object({
    id: z.string().min(1),
    icon: iconNameSchema.optional(),
    label: z.string().min(1),
    detail: z.string().optional(),
    tone: toneSchema.optional(),
    size: sizeSchema.optional(),
  })
  .strict();

const graphEdgeSpecSchema = z
  .object({
    /** Defaults to `"${from}->${to}"` — mirrors GraphEdgeSpec.id. */
    id: z.string().min(1).optional(),
    from: z.string().min(1),
    to: z.string().min(1),
    label: z.string().optional(),
  })
  .strict();

const graphSpecSchema = z
  .object({
    direction: z.enum(["right", "down"]).optional(),
    nodes: z.array(graphNodeSpecSchema).min(1),
    edges: z.array(graphEdgeSpecSchema),
  })
  .strict();

const diagramActiveNodeSchema = z.union([
  z.string(),
  z.object({ node: z.string().min(1), window: windowRefSchema }).strict(),
]);

const flowSpecSchema = z
  .object({
    edge: z.string().min(1),
    window: windowRefSchema,
    tone: toneSchema.optional(),
    label: z.string().optional(),
    direction: z.enum(["forward", "reverse"]).optional(),
  })
  .strict();

const diagramSchema = z
  .object({
    type: z.literal("diagram"),
    graph: graphSpecSchema,
    fit: z.enum(["width", "contain"]).optional(),
    width: measureSchema.optional(),
    grow: z.boolean().optional(),
    activeNodes: z.array(diagramActiveNodeSchema).optional(),
    reveal: z
      .object({
        order: z.enum(["rank", "all"]).optional(),
        window: windowRefSchema.optional(),
      })
      .strict()
      .optional(),
    flows: z.array(flowSpecSchema).optional(),
  })
  .strict();

const codeSegmentSchema = z.union([
  z.string(),
  z.object({ text: z.string(), tone: toneSchema }).strict(),
]);

const codeLineSchema = z
  .object({
    segments: z.array(codeSegmentSchema).min(1),
    indent: z.number().int().min(0).optional(),
    diff: z.enum(["added", "removed"]).optional(),
  })
  .strict();

const codeHighlightSchema = z
  .object({
    lines: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
    window: windowRefSchema,
  })
  .strict();

const codeSchema = z
  .object({
    type: z.literal("code"),
    title: z.string().optional(),
    chrome: z.enum(["panel", "bare"]).optional(),
    size: sizeSchema.optional(),
    width: measureSchema.optional(),
    grow: z.boolean().optional(),
    lines: z.array(codeLineSchema).min(1),
    reveal: z
      .object({
        mode: z.enum(["all", "staggered"]).optional(),
        window: windowRefSchema.optional(),
      })
      .strict()
      .optional(),
    highlights: z.array(codeHighlightSchema).optional(),
  })
  .strict();

const terminalStepSchema = z
  .object({
    command: z.string().min(1),
    output: z.array(z.string()).optional(),
    outputTone: toneSchema.optional(),
    window: windowRefSchema,
  })
  .strict();

const terminalSchema = z
  .object({
    type: z.literal("terminal"),
    title: z.string().optional(),
    size: sizeSchema.optional(),
    width: measureSchema.optional(),
    grow: z.boolean().optional(),
    steps: z.array(terminalStepSchema).min(1),
  })
  .strict();

const cameraFocusSchema = z.union([
  z.literal("all"),
  z.object({ node: z.string().min(1) }).strict(),
  z.object({ target: z.string().min(1) }).strict(),
]);

const cameraShotSchema = z
  .object({
    window: windowRefSchema,
    focus: cameraFocusSchema,
    zoom: z.enum(["wide", "medium", "close"]).optional(),
  })
  .strict();

const cameraSchema = z
  .object({
    type: z.literal("camera"),
    shots: z.array(cameraShotSchema).min(1),
    children: z.array(z.lazy((): NodeSchema => dslNodeSchema)).min(1),
  })
  .strict();

const cameraTargetSchema = z
  .object({
    type: z.literal("cameraTarget"),
    id: z.string().min(1),
    child: z.lazy((): NodeSchema => dslNodeSchema),
  })
  .strict();

const stepsSchema = z
  .object({
    type: z.literal("steps"),
    track: z.string().min(1),
    layout: z.enum(["list", "row"]).optional(),
    label: z.string().optional(),
    window: windowRefSchema.optional(),
  })
  .strict();

const switchCaseSchema = z
  .object({
    /** Inclusive step-index range this case covers, within `track`. */
    steps: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
    content: z.lazy((): NodeSchema => dslNodeSchema),
  })
  .strict();

const switchSchema = z
  .object({
    type: z.literal("switch"),
    track: z.string().min(1),
    mode: z.enum(["latch", "switch"]).optional(),
    // No `grow` here, deliberately: StepSwitch (src/components/StepReveal/
    // StepSwitch.tsx) renders its matched case through a transparent
    // Fragment — there's no element of its own for a grow flag to attach
    // to. A case that needs to fill remaining space sets `grow` on its own
    // `content` node instead (see docs/dsl-schema.md's Walkthrough example,
    // case [3,3]'s Stack).
    cases: z.array(switchCaseSchema).min(1),
  })
  .strict();

/**
 * The full content-node union. Adding a variant here without a matching
 * entry in `src/compiler/render/nodes.tsx`'s `Record<DslNode["type"],
 * NodeRenderer>` is a TypeScript compile error, not a silent no-op at
 * render time — that Record is where the compile-time exhaustiveness the
 * old TSX `sceneRegistry.tsx` gave scene ids is preserved for node kinds.
 */
export const dslNodeSchema: NodeSchema = z.discriminatedUnion("type", [
  stackSchema,
  textSchema,
  meterSchema,
  iconNodeSchema,
  pillSchema,
  bannerSchema,
  cardSchema,
  diagramSchema,
  codeSchema,
  terminalSchema,
  cameraSchema,
  cameraTargetSchema,
  stepsSchema,
  switchSchema,
]);

// ---------------------------------------------------------------------------
// Scene and document envelope
// ---------------------------------------------------------------------------

export const sceneSchema = z
  .object({
    id: z.string().min(1),
    beat: beatSchema,
    /** Provisional (motife-plan.md §2 決策4): Phase 3 replaces this with
     * the TTS narration audio's measured duration. Until then this
     * hand-picked value stands in. */
    durationInSeconds: z.number().positive(),
    narration: z.string().min(1),
    /** Omit to fall back to `narration`; explicit `null` renders no
     * caption at all (Summary's original scene never had one). min(1)
     * keeps `""` out of the ambiguous middle — an empty string would
     * silently behave like `null`, and "no caption" should be said as
     * `null`, not smuggled in as empty text. */
    caption: z.string().min(1).nullable().optional(),
    transitionToNext: sceneTransitionSchema.optional(),
    background: z
      .object({
        variant: z.enum(["grid", "plain"]).optional(),
        glow: toneSchema.optional(),
      })
      .strict()
      .optional(),
    header: z
      .object({
        eyebrow: z.string(),
        title: z.string(),
        tone: toneSchema.optional(),
        scale: z.enum(["normal", "hero"]).optional(),
      })
      .strict()
      .optional(),
    tracks: z.array(trackSchema).optional(),
    content: dslNodeSchema,
  })
  .strict();

export const dslDocumentSchema = z
  .object({
    version: z.literal(1),
    /** Becomes the <Composition id>; must be a valid Remotion composition
     * id and unique within the manifest (checked in
     * src/dsl/docs/manifest.test.ts, not here — uniqueness is a
     * cross-document property this single-document schema can't see). */
    id: z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/, "must start with a letter and contain only letters/digits"),
    title: z.string().min(1),
    fps: z.number().int().positive().default(30),
    width: z.number().int().positive().default(1920),
    height: z.number().int().positive().default(1080),
    scenes: z.array(sceneSchema).min(1),
  })
  .strict();
