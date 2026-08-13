// Pure timeline math shared by every composition — no React, no Remotion,
// no component-library import, so it stays unit-testable in the node env
// and serializable in spirit (the same discipline storyboard.ts keeps).
//
// This is where a scene transition's cost is accounted for. A transition
// OVERLAPS its two neighbours: TransitionSeries plays the outgoing scene's
// tail and the incoming scene's head simultaneously, so the composition's
// real duration is Σ durations − Σ overlaps, not Σ durations. Phase 1
// shipped hard cuts only and left this unmodelled; modelling it here is
// what makes a non-cut boundary safe to turn on.

export type SceneTransition = "cut" | "fade";

// tokens.duration.fast — kept as a literal rather than importing the
// component library, for the same reason computeLayout.ts keeps NODE_SEP
// literal: this module must stay free of the barrel (which pulls in React
// component modules) to remain node-testable and dependency-light.
export const TRANSITION_FRAMES = 15;

export interface TimelineSceneInput<Id extends string = string> {
  id: Id;
  durationInSeconds: number;
  /** Transition into the NEXT scene. Defaults to "cut". Ignored (forced to
   * "cut") on the last scene, which has no next. */
  transitionToNext?: SceneTransition;
}

export interface TimelineEntry<Id extends string = string> {
  id: Id;
  /**
   * First frame at which this scene is visible. Under a fade the scene
   * becomes visible `overlapWithNext` frames BEFORE its predecessor ends,
   * which is exactly the offset TransitionSeries derives internally — so
   * `from` stays a truthful absolute position for tooling that samples
   * frames (smoke, and Phase 3's critique loop) rather than a naive
   * running sum.
   */
  from: number;
  durationInFrames: number;
  transitionToNext: SceneTransition;
  /** Frames this scene's tail shares with the next one: TRANSITION_FRAMES
   * for a fade, 0 for a cut. */
  overlapWithNext: number;
}

/**
 * Resolves scene specs into absolute frame positions, accounting for
 * transition overlap. Parameterized (rather than closing over a module
 * constant, as Phase 1's version did) so it can be tested with synthetic
 * input and reused by every composition.
 */
export function buildTimeline<Id extends string>(
  scenes: readonly TimelineSceneInput<Id>[],
  fps: number,
  transitionFrames: number = TRANSITION_FRAMES,
): TimelineEntry<Id>[] {
  let cursor = 0;
  return scenes.map((scene, index) => {
    const durationInFrames = Math.round(scene.durationInSeconds * fps);
    const isLast = index === scenes.length - 1;
    const transitionToNext: SceneTransition = isLast
      ? "cut"
      : (scene.transitionToNext ?? "cut");
    const overlapWithNext = transitionToNext === "fade" ? transitionFrames : 0;

    if (overlapWithNext > 0) {
      // TransitionSeries throws at render time if a transition is not
      // shorter than both scenes it joins. Failing here instead turns a
      // mid-render crash into a data-level error naming both scenes.
      const nextFrames = Math.round(scenes[index + 1].durationInSeconds * fps);
      if (overlapWithNext >= durationInFrames || overlapWithNext >= nextFrames) {
        throw new Error(
          `timeline: the "${scene.id}" → "${scenes[index + 1].id}" transition ` +
            `(${overlapWithNext} frames) must be shorter than both scenes ` +
            `(${durationInFrames} and ${nextFrames} frames).`,
        );
      }
    }

    const entry: TimelineEntry<Id> = {
      id: scene.id,
      from: cursor,
      durationInFrames,
      transitionToNext,
      overlapWithNext,
    };
    cursor += durationInFrames - overlapWithNext;
    return entry;
  });
}

/**
 * The composition's real duration: Σ durations − Σ overlaps, expressed as
 * the last scene's end so it can't drift from `from`. Math.max(1, …) keeps
 * an empty scene list a legal composition ("empty but runs") rather than a
 * zero-duration error.
 */
export function totalFrames(timeline: readonly TimelineEntry[]): number {
  const last = timeline[timeline.length - 1];
  return Math.max(1, last ? last.from + last.durationInFrames : 0);
}
