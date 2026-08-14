import type { FC, ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import { useSceneTiming } from "../Scene/SceneContext";
import { resolveWindow } from "../motion/timing";
import type { Window } from "../tokens";

export interface StepSwitchCase {
  /** Inclusive step-index range this case covers. */
  steps: [number, number];
  content: ReactNode;
}

export interface StepSwitchProps {
  /** One Window per step, normally the output of stepWindows() for the
   * same steps/window a sibling <StepReveal> (or useSteps()) uses — that
   * shared input is what keeps a checklist and its detail panel in sync,
   * the same discipline useSteps() already establishes. */
  stepWindows: Window[];
  cases: StepSwitchCase[];
  /**
   * "latch" (default): once a step starts, its matching case stays shown
   * until the next step starts — this is Walkthrough.tsx's original
   * `activeIndex` fallback (`states.indexOf("active")`, or the last
   * non-pending step, or 0 before anything starts) generalised to ranges.
   * "switch": a case shows only while its step is strictly active; nothing
   * renders between steps or after the last one ends.
   */
  mode?: "latch" | "switch";
}

/**
 * Renders whichever `cases` entry covers the step that's current at the
 * frame — the semantic replacement for Phase 1's
 * `activeIndex === n ? <X/> : null` conditional chains. Collapses
 * Walkthrough's four single-step branches to two range-based cases
 * (`[0,2]` "VERIFYING", `[3,3]` "200 AUTHORIZED"), and lets a case cover
 * more than one step without repeating content per step.
 */
export const StepSwitch: FC<StepSwitchProps> = ({ stepWindows: windows, cases, mode = "latch" }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useSceneTiming();
  const ranges = windows.map((window) => resolveWindow(window, durationInFrames));

  let activeIndex = -1;
  if (mode === "switch") {
    activeIndex = ranges.findIndex((range) => frame >= range.startFrame && frame < range.endFrame);
  } else {
    for (let index = 0; index < ranges.length; index += 1) {
      if (frame >= ranges[index].startFrame) activeIndex = index;
    }
    if (activeIndex === -1 && ranges.length > 0) activeIndex = 0;
  }

  if (activeIndex === -1) return null;

  const match = cases.find(({ steps: [lo, hi] }) => activeIndex >= lo && activeIndex <= hi);
  if (match) return <>{match.content}</>;

  // No case covers the active step. In latch mode, hold the nearest case
  // that already started (greatest `lo` <= activeIndex) instead of
  // blanking — "stays shown until the next case's steps begin" must hold
  // across a coverage gap too, which validation only warns about (a
  // gapped switch is legal, just suspicious). Switch mode keeps its
  // strict nothing-between-cases semantics.
  if (mode === "latch") {
    const started = cases.filter(({ steps: [lo] }) => lo <= activeIndex);
    if (started.length > 0) {
      const held = started.reduce((a, b) => (b.steps[0] > a.steps[0] ? b : a));
      return <>{held.content}</>;
    }
  }
  return null;
};
