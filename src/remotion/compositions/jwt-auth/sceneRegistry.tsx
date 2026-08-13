import type { FC } from "react";
import type { SceneComponentProps } from "../SceneSeries";
import type { SceneId } from "./storyboard";
import { Intro } from "./scenes/Intro";
import { Breakdown } from "./scenes/Breakdown";
import { Walkthrough } from "./scenes/Walkthrough";
import { Summary } from "./scenes/Summary";

/**
 * Record<SceneId, FC<SceneComponentProps>> is the wiring guarantee: a
 * scene added to (or removed from) storyboard.ts without a matching
 * update here is a TypeScript error, not a blank screen at render time.
 * Every scene takes `durationInFrames` (from TIMELINE) and passes it
 * straight to its own <Scene>, which is what makes Window-fraction timing
 * (motife-plan.md §2 決策4 groundwork) possible throughout src/components.
 */
export const SCENE_COMPONENTS: Record<SceneId, FC<SceneComponentProps>> = {
  intro: Intro,
  breakdown: Breakdown,
  walkthrough: Walkthrough,
  summary: Summary,
};
