import { AbsoluteFill, Sequence } from "remotion";
import { theme } from "../../theme";
import { TIMELINE } from "./storyboard";
import { SCENE_COMPONENTS } from "./sceneRegistry";

/**
 * The only wiring file for this composition — it should not need editing
 * again. Add scenes by editing storyboard.ts (data) and sceneRegistry.tsx
 * (component mapping); this file just zips the two together.
 */
export const JwtAuthFlow: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: theme.color.bg }}>
    {TIMELINE.map(({ id, from, durationInFrames }) => {
      const Scene = SCENE_COMPONENTS[id];
      return (
        <Sequence key={id} name={id} from={from} durationInFrames={durationInFrames}>
          <Scene />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
