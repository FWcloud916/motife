// Pure timing math — no Remotion, no React. This is deliberate: it's the
// exact boundary the StepReveal/Scene timing model is built to protect.
// Everything here resolves fractional `Window`s against a scene's
// `durationInFrames`, so it's unit-testable in isolation and reusable by
// any component (or, later, the Phase 2 compiler) that needs the same
// answer without importing React.
import type { Window } from "../tokens";

export interface FrameRange {
  startFrame: number;
  endFrame: number;
}

/** Resolves a Window (0..1 fractions of a scene) into absolute frame
 * numbers against that scene's duration — the one place fractions become
 * frames. */
export function resolveWindow(window: Window, durationInFrames: number): FrameRange {
  return {
    startFrame: window.from * durationInFrames,
    endFrame: window.to * durationInFrames,
  };
}

export type StepOutcome = "pass" | "fail";
export type StepState = "pending" | "active" | "passed" | "failed";

export interface WeightedStep {
  /** Share of the window this step occupies, relative to the other steps'
   * weights. Defaults to 1 (equal split). */
  weight?: number;
  outcome?: StepOutcome;
}

export interface StepFrameRange extends FrameRange {
  outcome?: StepOutcome;
}

/**
 * Splits a Window into one FrameRange per step, proportional to `weight`.
 * Replaces the Phase 0 pattern of hardcoding each step's start frame
 * (Walkthrough.tsx's `STEPS = [{start: 35}, {start: 145}, ...]`, coupled to
 * one fixed scene duration) — resolveSteps re-derives every boundary from
 * whatever duration the enclosing Scene actually has.
 */
export function resolveSteps<T extends WeightedStep>(
  steps: readonly T[],
  window: Window,
  durationInFrames: number,
): StepFrameRange[] {
  const { startFrame, endFrame } = resolveWindow(window, durationInFrames);
  const availableFrames = Math.max(0, endFrame - startFrame);
  const totalWeight = steps.reduce((sum, step) => sum + (step.weight ?? 1), 0);

  let cursor = startFrame;
  return steps.map((step) => {
    const share = totalWeight > 0 ? (step.weight ?? 1) / totalWeight : 0;
    const stepFrames = availableFrames * share;
    const range: StepFrameRange = {
      startFrame: cursor,
      endFrame: cursor + stepFrames,
      outcome: step.outcome,
    };
    cursor += stepFrames;
    return range;
  });
}

/**
 * Derives a step's visual state at `frame` from its resolved FrameRange:
 * "pending" before it starts, "active" while inside it, then settles to
 * "passed" or "failed" (per `outcome`, default "pass") once it ends. This
 * is what fills the inventory's missing rejected-step variant.
 */
export function stepStateAtFrame(frame: number, range: StepFrameRange): StepState {
  if (frame < range.startFrame) return "pending";
  if (frame < range.endFrame) return "active";
  return range.outcome === "fail" ? "failed" : "passed";
}
