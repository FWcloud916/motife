import { AbsoluteFill, useCurrentFrame } from "remotion";
import { theme } from "../../../theme";

// Beat: 拆解 (breakdown). useCurrentFrame() here is RELATIVE to this
// scene's enclosing <Sequence> in JwtAuthFlow.tsx — starts at frame 0.
// Placeholder only: replace with the real breakdown animation.
export const Breakdown: React.FC = () => {
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
      breakdown — frame {frame}
    </AbsoluteFill>
  );
};
