import { Composition } from "remotion";
import { JwtAuthFlow } from "./compositions/jwt-auth/JwtAuthFlow";
import { FPS, WIDTH, HEIGHT, TOTAL_FRAMES } from "./compositions/jwt-auth/storyboard";

// The fragment is intentional, not a leftover — @remotion/eslint-config-flat
// disables react/jsx-no-useless-fragment specifically because more
// <Composition /> entries (the eval-set siblings) are expected here later.
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="JwtAuthFlow"
      component={JwtAuthFlow}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{}}
    />
  </>
);
