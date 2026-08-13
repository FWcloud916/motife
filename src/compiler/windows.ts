// Pure WindowRef resolution — no zod, no React, no Remotion. This is what
// collapses every symbolic `{track, step}` / `{track, steps}` reference in
// a document down to a concrete `Window` fraction, entirely at
// validate/compile time (never inside a rendered component — the
// interpreter in Stage 3 only ever sees resolved Windows). Reuses
// `stepWindows()` (src/components/motion/timing.ts), the same pure
// function that made a scene's own step-synced panels correct in Stage 1.
import type { Window } from "../components";
import { stepWindows } from "../components";
import type { Track, WindowRef } from "../dsl";

const MAX_TRACK_DEPTH = 32;

/** Builds the id -> Track lookup resolveWindowRef needs, from a scene's
 * `tracks` array (declaration order preserved — Map iterates insertion
 * order, which is what makes the forward-reference check in validate.ts
 * meaningful). */
export function trackMapFrom(tracks: readonly Track[] | undefined): Map<string, Track> {
  return new Map((tracks ?? []).map((track) => [track.id, track]));
}

export class UnknownTrackError extends Error {
  constructor(readonly trackId: string) {
    super(`unknown track "${trackId}"`);
    this.name = "UnknownTrackError";
  }
}

export class StepIndexOutOfRangeError extends Error {
  constructor(
    readonly trackId: string,
    readonly index: number,
    readonly itemCount: number,
  ) {
    super(`step index ${index} is out of range for track "${trackId}" (0-${itemCount - 1})`);
    this.name = "StepIndexOutOfRangeError";
  }
}

export class TrackCycleError extends Error {
  constructor(readonly trackId: string) {
    super(`track "${trackId}"'s own window resolution cycles back to itself`);
    this.name = "TrackCycleError";
  }
}

/**
 * Resolves a WindowRef to an absolute Window (fractions of the enclosing
 * scene). A `{track, step}`/`{track, steps}` ref resolves against that
 * track's OWN window — which may itself be a track reference (e.g.
 * Walkthrough's nested "claims" track, windowed to "checks" step 2) — so
 * resolution recurses up the track chain. `depth` guards against a cycle
 * turning into a stack overflow; validate.ts's forward-reference check is
 * what actually prevents cycles from existing in a valid document, this is
 * just the function staying safe to call directly (e.g. from a test) on an
 * unvalidated one.
 */
export function resolveWindowRef(
  ref: WindowRef,
  tracks: ReadonlyMap<string, Track>,
  depth = 0,
): Window {
  if ("from" in ref) return { from: ref.from, to: ref.to };
  if (depth > MAX_TRACK_DEPTH) throw new TrackCycleError(ref.track);

  const track = tracks.get(ref.track);
  if (!track) throw new UnknownTrackError(ref.track);

  const trackWindow = resolveWindowRef(track.window, tracks, depth + 1);
  const itemWindows = stepWindows(track.items, trackWindow);

  if ("step" in ref) {
    const window = itemWindows[ref.step];
    if (!window) throw new StepIndexOutOfRangeError(ref.track, ref.step, track.items.length);
    return window;
  }

  const [lo, hi] = ref.steps;
  const from = itemWindows[lo];
  const to = itemWindows[hi];
  if (!from) throw new StepIndexOutOfRangeError(ref.track, lo, track.items.length);
  if (!to) throw new StepIndexOutOfRangeError(ref.track, hi, track.items.length);
  return { from: from.from, to: to.to };
}
