// Bridges a validated DslDocument to the existing timeline math — reuses
// buildTimeline()/totalFrames() (src/remotion/compositions/timeline.ts)
// rather than reimplementing transition-overlap accounting a second time.
// That module is pure (no React, no Remotion, no component-library
// import) despite its path, which is what makes importing it from
// src/compiler/ safe: no cycle, no pull-in of the barrel.
import { buildTimeline, totalFrames } from "../remotion/compositions/timeline";
import type { TimelineEntry } from "../remotion/compositions/timeline";
import type { DslDocument } from "../dsl";

/** A DslScene already has exactly the shape buildTimeline() needs
 * ({id, durationInSeconds, transitionToNext?}) plus more fields it simply
 * ignores — no adapting required. */
export function dslTimeline(doc: DslDocument): TimelineEntry<string>[] {
  return buildTimeline(doc.scenes, doc.fps);
}

export function dslTotalFrames(doc: DslDocument): number {
  return totalFrames(dslTimeline(doc));
}

export type { TimelineEntry };
