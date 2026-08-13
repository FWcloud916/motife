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
