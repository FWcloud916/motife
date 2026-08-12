import { AbsoluteFill, useCurrentFrame } from "remotion";
import { theme } from "../../../theme";

// Beat: 引入 (intro). useCurrentFrame() here is RELATIVE to this scene's
// enclosing <Sequence> in JwtAuthFlow.tsx — this component always starts
// at frame 0, regardless of where the scene sits on the master timeline.
// Placeholder only: replace with the real intro animation.
export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        color: theme.color.text,
        fontSize: theme.fontSize.md,
        fontFamily: "sans-serif",
      }}
    >
      intro — frame {frame}
    </AbsoluteFill>
  );
};
