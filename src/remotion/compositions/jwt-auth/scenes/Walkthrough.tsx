import { AbsoluteFill, useCurrentFrame } from "remotion";
import { theme } from "../../../theme";

// Beat: 逐步演示 (walkthrough). useCurrentFrame() here is RELATIVE to this
// scene's enclosing <Sequence> in JwtAuthFlow.tsx — starts at frame 0.
// Placeholder only: replace with the real step-by-step walkthrough.
export const Walkthrough: React.FC = () => {
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
      walkthrough — frame {frame}
    </AbsoluteFill>
  );
};
