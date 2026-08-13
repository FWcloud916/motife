// The only public import surface for scenes (and, from Phase 2, the DSL
// compiler). Files under src/remotion/compositions/** should import
// exclusively from here, never reach into a component's own module path.
export * from "./tokens";

export { Icon } from "./icons/Icon";
export type { IconProps } from "./icons/Icon";
export type { IconName } from "./icons/registry";

export { Scene } from "./Scene/Scene";
export type { SceneHeaderSpec, SceneProps } from "./Scene/Scene";
export { useSceneTiming } from "./Scene/SceneContext";

export { Callout } from "./Callout/Callout";
export type { CalloutProps } from "./Callout/Callout";

export { StepReveal, useSteps } from "./StepReveal/StepReveal";
export type { ResolvedStep, Step, StepRevealProps } from "./StepReveal/StepReveal";

export { computeLayout } from "./layout/computeLayout";
export { buildRoundedPath } from "./layout/edgePath";
export type {
  GraphEdgeSpec,
  GraphNodeSpec,
  GraphSpec,
  LayoutEdgePath,
  LayoutRect,
  LayoutResult,
} from "./layout/types";

export { Diagram } from "./Diagram/Diagram";
export type { DiagramProps } from "./Diagram/Diagram";
export { useDiagramLayout } from "./Diagram/DiagramContext";

export { FlowPulse } from "./FlowPulse/FlowPulse";
export type { FlowPulseProps, FlowSpec } from "./FlowPulse/FlowPulse";

export { CodeBlock } from "./CodeBlock/CodeBlock";
export type {
  CodeBlockProps,
  CodeHighlight,
  CodeLine,
  CodeSegment,
} from "./CodeBlock/CodeBlock";

export { Terminal } from "./Terminal/Terminal";
export type { TerminalProps, TerminalStep } from "./Terminal/Terminal";

export { Camera, CameraTarget } from "./Camera/Camera";
export type { CameraProps, CameraShot } from "./Camera/Camera";

export { clampExtrapolate, reveal, stagger } from "./motion/progress";
export {
  resolveSteps,
  resolveWindow,
  stepStateAtFrame,
} from "./motion/timing";
export type {
  FrameRange,
  StepFrameRange,
  StepOutcome,
  StepState,
  WeightedStep,
} from "./motion/timing";
