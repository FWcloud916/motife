import type { SceneId } from "./storyboard";
import { Intro } from "./scenes/Intro";
import { Breakdown } from "./scenes/Breakdown";
import { Walkthrough } from "./scenes/Walkthrough";
import { Summary } from "./scenes/Summary";

/**
 * Record<SceneId, React.FC> is the wiring guarantee: a scene added to (or
 * removed from) storyboard.ts without a matching update here is a
 * TypeScript error, not a blank screen at render time.
 */
export const SCENE_COMPONENTS: Record<SceneId, React.FC> = {
  intro: Intro,
  breakdown: Breakdown,
  walkthrough: Walkthrough,
  summary: Summary,
};
