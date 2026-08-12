import { AbsoluteFill } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import { tokens } from "../../../components";
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
 * (motife-plan.md milestone M1). Uses TransitionSeries with no
 * <TransitionSeries.Transition> between scenes, which is timing-
 * equivalent to a plain <Sequence> zip (hard cuts, no frames borrowed from
 * either neighbor). A per-boundary `transition: "fade"` option can be
 * added to storyboard.ts later — introducing a fade shortens TOTAL_FRAMES
 * (adjacent scenes overlap), and that math isn't threaded through
 * buildTimeline() yet.
 */
export const JwtAuthFlow: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: tokens.color.bg }}>
    <TransitionSeries>
      {TIMELINE.map(({ id, durationInFrames }) => {
        const SceneComponent = SCENE_COMPONENTS[id];
        return (
          <TransitionSeries.Sequence key={id} name={id} durationInFrames={durationInFrames}>
            <SceneComponent durationInFrames={durationInFrames} />
          </TransitionSeries.Sequence>
        );
      })}
    </TransitionSeries>
  </AbsoluteFill>
);
