import { Composition } from "remotion";
import { loadFonts } from "../components/tokens";
import { ComponentGallery, GALLERY_TOTAL_FRAMES } from "./compositions/gallery/ComponentGallery";
import { JwtAuthFlow } from "./compositions/jwt-auth/JwtAuthFlow";
import { JwtAuthFlowV2 } from "./compositions/jwt-auth/JwtAuthFlowV2";
import { FPS, WIDTH, HEIGHT, TOTAL_FRAMES } from "./compositions/jwt-auth/storyboard";

// Registers every font the component library depends on (Inter, Noto Sans
// TC, JetBrains Mono) before any composition below can mount. Called once
// at module scope — @remotion/google-fonts handles delayRender() /
// continueRender() internally, so every render pipeline (Studio,
// renderStill, renderMedia) waits for real glyphs instead of falling back
// to whatever font the host machine happens to have installed.
loadFonts();

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
    <Composition
      id="JwtAuthFlowV2"
      component={JwtAuthFlowV2}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{}}
    />
    <Composition
      id="ComponentGallery"
      component={ComponentGallery}
      durationInFrames={GALLERY_TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{}}
    />
  </>
);
