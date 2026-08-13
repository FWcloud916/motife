import type { FC } from "react";
import { useId } from "react";
import { AbsoluteFill } from "remotion";
import type { Tone } from "../tokens";
import { tokens } from "../tokens";

export interface BackgroundProps {
  variant?: "grid" | "plain";
  glow?: Tone;
}

// useId() keeps the <pattern>/<filter> ids unique per mounted instance —
// several Scenes can be on screen at once during a transition, and
// duplicate SVG ids across siblings is a real Remotion footgun.
export const Background: FC<BackgroundProps> = ({ variant = "grid", glow = "primary" }) => {
  const gridId = useId();
  const noiseId = useId();
  const glowColor = tokens.color.tone[glow].fg;

  return (
    <AbsoluteFill style={{ backgroundColor: tokens.color.bg, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: "27%",
          top: "8%",
          width: "50%",
          height: "72%",
          borderRadius: "50%",
          background: glowColor,
          opacity: 0.12,
          filter: "blur(170px)",
        }}
      />
      {variant === "grid" ? (
        <svg width="100%" height="100%" style={{ opacity: 0.22 }}>
          <defs>
            <pattern id={gridId} width="72" height="72" patternUnits="userSpaceOnUse">
              <path d="M72 0H0V72" fill="none" stroke={tokens.color.line} strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${gridId})`} />
        </svg>
      ) : null}
      <AbsoluteFill style={{ opacity: 0.05, mixBlendMode: "soft-light" }}>
        <svg width="100%" height="100%">
          <filter id={noiseId}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves={3}
              seed={7}
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter={`url(#${noiseId})`} />
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
