// Hand-written recursive types + z.infer types over schema.ts.
//
// DslNode and its variants are hand-declared here, NOT z.infer'd, because
// TypeScript can't infer through a recursive discriminated union where
// multiple fields reference the union via `z.lazy(() => dslNodeSchema)` —
// TS would need to know dslNodeSchema's type before dslNodeSchema finishes
// being defined, and with 5 different lazy references all pointing back at
// one 14-member union, there's no order that resolves the cycle by
// inference alone. This is the documented fallback (zod v3-era, still
// valid in v4): hand-write the type, then annotate `dslNodeSchema:
// z.ZodType<DslNode> = z.discriminatedUnion(...)` in schema.ts so every
// `z.lazy((): NodeSchema => dslNodeSchema)` has a concrete, non-inferred
// type to return. See schema.ts's file-header comment for why `z.lazy()`
// specifically (not v4's newer getter pattern) — the two files are read
// together for the recursive part of the DSL.
//
// Everything else (WindowRef, Track, Scene, Document) is NOT recursive and
// stays `z.infer`-derived below, so it can't drift from schema.ts.
import type { z } from "zod";
import type { Emphasis, Gap, IconName, Measure, Size, Tone } from "../components";
import type {
  absoluteWindowRefSchema,
  dslDocumentSchema,
  sceneSchema,
  stepItemSchema,
  stepRangeWindowRefSchema,
  stepWindowRefSchema,
  trackSchema,
  windowRefSchema,
} from "./schema";

export type AbsoluteWindowRef = z.infer<typeof absoluteWindowRefSchema>;
export type StepWindowRef = z.infer<typeof stepWindowRefSchema>;
export type StepRangeWindowRef = z.infer<typeof stepRangeWindowRefSchema>;
export type WindowRef = z.infer<typeof windowRefSchema>;

export type StepItem = z.infer<typeof stepItemSchema>;
export type Track = z.infer<typeof trackSchema>;

// ---------------------------------------------------------------------------
// DslNode — hand-declared. Keep every variant's fields in the same order
// and with the same optionality as its zod counterpart in schema.ts; the
// two are cross-checked by src/dsl/schema.test.ts, not by the compiler
// (z.ZodType<DslNode> only proves each zod schema PRODUCES a valid
// DslNode, not that the two enumerate identical optional-field sets).
// ---------------------------------------------------------------------------

export type TextRun = string | { text: string; tone?: Tone; strong?: boolean };

export interface StackNode {
  type: "stack";
  direction?: "row" | "column";
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between";
  gap?: Gap;
  width?: Measure;
  grow?: boolean;
  window?: WindowRef;
  children?: DslNode[];
}

export interface TextNode {
  type: "text";
  role?: "hero" | "title" | "subtitle" | "label" | "body" | "detail";
  content: string | TextRun[];
  tone?: Tone;
  align?: "start" | "center" | "end";
  window?: WindowRef;
}

export interface MeterNode {
  type: "meter";
  tone?: Tone;
  label?: string;
  size?: Size;
  window?: WindowRef;
  value?: number;
  threshold?: number;
}

export interface IconNode {
  type: "icon";
  name: IconName;
  tone?: Tone;
  size?: Size;
}

export interface PillNode {
  type: "pill";
  text: string;
  icon?: IconName;
  tone?: Tone;
  window?: WindowRef;
}

export interface BannerNode {
  type: "banner";
  text: string;
  detail?: string;
  icon?: IconName;
  tone?: Tone;
  window?: WindowRef;
}

export interface CardNode {
  type: "card";
  emphasis?: Emphasis;
  size?: Size;
  tone?: Tone;
  window?: WindowRef;
  width?: Measure;
  grow?: boolean;
  children: DslNode[];
}

export interface GraphNodeSpecDsl {
  id: string;
  icon?: IconName;
  label: string;
  detail?: string;
  tone?: Tone;
  size?: Size;
}

export interface GraphEdgeSpecDsl {
  id?: string;
  from: string;
  to: string;
  label?: string;
}

export interface GraphSpecDsl {
  direction?: "right" | "down";
  nodes: GraphNodeSpecDsl[];
  edges: GraphEdgeSpecDsl[];
}

export type DiagramActiveNodeDsl = string | { node: string; window: WindowRef };

export interface FlowSpecDsl {
  edge: string;
  window: WindowRef;
  tone?: Tone;
  label?: string;
  direction?: "forward" | "reverse";
}

export interface DiagramNode {
  type: "diagram";
  graph: GraphSpecDsl;
  fit?: "width" | "contain";
  width?: Measure;
  grow?: boolean;
  activeNodes?: DiagramActiveNodeDsl[];
  reveal?: { order?: "rank" | "all"; window?: WindowRef };
  flows?: FlowSpecDsl[];
}

export type CodeSegmentDsl = string | { text: string; tone: Tone };

export interface CodeLineDsl {
  segments: CodeSegmentDsl[];
  indent?: number;
  diff?: "added" | "removed";
}

export interface CodeHighlightDsl {
  lines: [number, number];
  window: WindowRef;
}

export interface CodeNode {
  type: "code";
  title?: string;
  chrome?: "panel" | "bare";
  size?: Size;
  width?: Measure;
  grow?: boolean;
  lines: CodeLineDsl[];
  reveal?: { mode?: "all" | "staggered"; window?: WindowRef };
  highlights?: CodeHighlightDsl[];
}

export interface TerminalStepDsl {
  command: string;
  output?: string[];
  outputTone?: Tone;
  window: WindowRef;
}

export interface TerminalNode {
  type: "terminal";
  title?: string;
  size?: Size;
  width?: Measure;
  grow?: boolean;
  steps: TerminalStepDsl[];
}

export type CameraFocusDsl = "all" | { node: string } | { target: string };

export interface CameraShotDsl {
  window: WindowRef;
  focus: CameraFocusDsl;
  zoom?: "wide" | "medium" | "close";
}

export interface CameraNode {
  type: "camera";
  shots: CameraShotDsl[];
  children: DslNode[];
}

export interface CameraTargetNode {
  type: "cameraTarget";
  id: string;
  child: DslNode;
}

export interface StepsNode {
  type: "steps";
  track: string;
  layout?: "list" | "row";
  label?: string;
  window?: WindowRef;
}

export interface SwitchCaseDsl {
  steps: [number, number];
  content: DslNode;
}

export interface SwitchNode {
  type: "switch";
  track: string;
  mode?: "latch" | "switch";
  grow?: boolean;
  cases: SwitchCaseDsl[];
}

export type DslNode =
  | StackNode
  | TextNode
  | MeterNode
  | IconNode
  | PillNode
  | BannerNode
  | CardNode
  | DiagramNode
  | CodeNode
  | TerminalNode
  | CameraNode
  | CameraTargetNode
  | StepsNode
  | SwitchNode;

export type DslNodeType = DslNode["type"];
/** Narrows DslNode to one variant by its discriminant — e.g.
 * `DslNodeOf<"card">` is the card node's exact shape. */
export type DslNodeOf<T extends DslNodeType> = Extract<DslNode, { type: T }>;

export type DslCard = CardNode;
export type DslScene = z.infer<typeof sceneSchema>;

/**
 * The document type as it exists AFTER validation. Deliberately not
 * exported as constructible some other way: the only public constructor is
 * `parseDocument()` in `src/compiler/parse.ts` (CLAUDE.md hard constraint)
 * — nothing should build or cast a `DslDocument` literal, since that
 * bypasses both the zod structural checks and validate.ts's semantic
 * cross-reference checks.
 */
export type DslDocument = z.infer<typeof dslDocumentSchema>;
