import { AbsoluteFill } from "remotion";
import { tokens } from "../../../components";
import { SceneSeries } from "../SceneSeries";
import { TIMELINE } from "./storyboard";
import { SCENE_COMPONENTS } from "./sceneRegistry";

/**
 * The only wiring file for this composition — it should not need editing
 * again. Add scenes by editing storyboard.ts (data) and sceneRegistry.tsx
 * (component mapping); this file just zips the two together.
 *
 * Built entirely from src/components/ (Phase 1's component library) —
 * this is what replaced the Phase 0 hand-built scenes once the library
 * proved it could reproduce the baseline at equal or better quality
 * (motife-plan.md milestone M1).
 *
 * Every boundary in storyboard.ts is a hard cut, so <SceneSeries> emits no
 * transitions here and the timing is identical to a plain <Sequence> zip.
 * That is a content decision, not a missing capability: the eval-set
 * regression policy compares this video against the Phase 0 baseline, and
 * a fade would shift every subsequent frame. Setting `transitionToNext:
 * "fade"` on a scene is all it takes — buildTimeline() already accounts
 * for the overlap in TOTAL_FRAMES.
 */
export const JwtAuthFlow: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: tokens.color.bg }}>
    <SceneSeries timeline={TIMELINE} components={SCENE_COMPONENTS} />
  </AbsoluteFill>
);
