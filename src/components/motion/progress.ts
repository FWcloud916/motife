import { interpolate } from "remotion";
import { tokens } from "../tokens";

export const clampExtrapolate = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

/**
 * 0..1 progress of a reveal starting `delayInFrames` after the enclosing
 * sequence begins, using the shared `duration.reveal` token. Same numbers
 * as the Phase 0 `enter()` helper, now token-driven instead of a magic 22.
 */
export function reveal(frame: number, delayInFrames = 0): number {
  return interpolate(
    frame,
    [delayInFrames, delayInFrames + tokens.duration.reveal],
    [0, 1],
    clampExtrapolate,
  );
}

/** Per-index delay for staggered reveals: `index * gapInFrames`. */
export function stagger(index: number, gapInFrames: number = tokens.duration.fast / 2): number {
  return index * gapInFrames;
}
