import type { FC } from "react";
import type { SceneId } from "./storyboard";
import { Intro } from "./scenes-v2/Intro";
import { Breakdown } from "./scenes-v2/Breakdown";
import { Walkthrough } from "./scenes-v2/Walkthrough";
import { Summary } from "./scenes-v2/Summary";

export interface SceneComponentProps {
  durationInFrames: number;
}

/** Same wiring guarantee as sceneRegistry.tsx, for the component-library
 * rebuild. Every scene here takes `durationInFrames` (from TIMELINE) and
 * passes it straight to its own <Scene>. */
export const SCENE_COMPONENTS_V2: Record<SceneId, FC<SceneComponentProps>> = {
  intro: Intro,
  breakdown: Breakdown,
  walkthrough: Walkthrough,
  summary: Summary,
};
