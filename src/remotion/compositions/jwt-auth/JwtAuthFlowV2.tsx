import { AbsoluteFill } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import { tokens } from "../../../components";
import { TIMELINE } from "./storyboard";
import { SCENE_COMPONENTS_V2 } from "./sceneRegistryV2";

/**
 * The component-library rebuild of JwtAuthFlow.tsx — same TIMELINE (same
 * durations, same narration), only the scene registry differs. Uses
 * TransitionSeries with no <TransitionSeries.Transition> between scenes,
 * which is timing-equivalent to the plain <Sequence> zip in JwtAuthFlow.tsx
 * (hard cuts, no frames borrowed from either neighbor) — this is what
 * keeps the parity comparison against the Phase 0 baseline honest. A
 * per-boundary `transition: "fade"` option can be added to storyboard.ts
 * later; motife-plan.md's regression policy is why it isn't turned on by
 * default here — introducing a fade shortens TOTAL_FRAMES (adjacent
 * scenes overlap), and that math isn't threaded through buildTimeline()
 * yet.
 */
export const JwtAuthFlowV2: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: tokens.color.bg }}>
    <TransitionSeries>
      {TIMELINE.map(({ id, durationInFrames }) => {
        const SceneComponent = SCENE_COMPONENTS_V2[id];
        return (
          <TransitionSeries.Sequence key={id} name={id} durationInFrames={durationInFrames}>
            <SceneComponent durationInFrames={durationInFrames} />
          </TransitionSeries.Sequence>
        );
      })}
    </TransitionSeries>
  </AbsoluteFill>
);
