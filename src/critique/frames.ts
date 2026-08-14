// Critique frame selection — pure math over dslTimeline(), no rendering.
// Three samples per scene (early / mid / late): scene-entry animations
// have settled by `early`, `mid` catches the fully-populated layout, and
// `late` catches step-track end states — the moments where overlap and
// overflow actually show up. Uniform whole-video sampling (smoke.mjs's
// approach) is deliberately not reused: critique must attribute an issue
// to a scene to make it fixable.
import type { DslDocument } from "../dsl";
import { dslTimeline } from "../compiler";

export type CritiqueFrameLabel = "early" | "mid" | "late";

export interface CritiqueFrame {
  sceneId: string;
  label: CritiqueFrameLabel;
  /** Absolute composition frame (dslTimeline's truthful `from` accounts
   * for transition overlap). */
  frame: number;
}

// ~1/3s into the scene: past the first entrance motion's start, well
// before anything exits.
const EARLY_OFFSET_FRAMES = 10;
// Half a second before the end: outside the tail transition window.
const LATE_BACKOFF_FRAMES = 15;

export function critiqueFrames(doc: DslDocument): CritiqueFrame[] {
  const frames: CritiqueFrame[] = [];
  for (const entry of dslTimeline(doc)) {
    const last = entry.from + entry.durationInFrames - 1;
    const candidates: Record<CritiqueFrameLabel, number> = {
      early: entry.from + Math.min(EARLY_OFFSET_FRAMES, Math.floor(entry.durationInFrames / 4)),
      mid: entry.from + Math.floor(entry.durationInFrames / 2),
      late: Math.max(entry.from, last - LATE_BACKOFF_FRAMES),
    };
    const seen = new Set<number>();
    for (const label of ["early", "mid", "late"] as const) {
      const frame = Math.min(Math.max(candidates[label], entry.from), last);
      // Very short scenes can collapse two labels onto one frame — render
      // each frame once, keep the earliest label.
      if (seen.has(frame)) continue;
      seen.add(frame);
      frames.push({ sceneId: entry.id, label, frame });
    }
  }
  return frames;
}
