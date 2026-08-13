import type { FC, ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clampExtrapolate, reveal } from "../motion/progress";
import type { Tone } from "../tokens";
import { tokens } from "../tokens";
import { Background } from "./Background";
import { SceneContext } from "./SceneContext";

export interface SceneHeaderSpec {
  eyebrow: string;
  title: string;
  tone?: Tone;
  scale?: "normal" | "hero";
}

export interface SceneProps {
  /** This scene's own duration in frames — pass the same value used for
   * its enclosing <Sequence durationInFrames>. See SceneContext.ts. */
  durationInFrames: number;
  background?: { variant?: "grid" | "plain"; glow?: Tone };
  header?: SceneHeaderSpec;
  /** Bottom narration slot. Omit for scenes with no caption. */
  caption?: string;
  children?: ReactNode;
}

// Reserved vertical space around the content area when a header/caption is
// present — mirrors the Phase 0 scenes' shared convention (header at
// y=72, content starting around y=250) without every scene re-deriving it.
const HEADER_CLEARANCE = 210;
const CAPTION_CLEARANCE = 150;
const CAPTION_SIDE_MARGIN = 210;

export const Scene: FC<SceneProps> = ({ durationInFrames, background, header, caption, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <SceneContext.Provider value={{ durationInFrames, fps }}>
      <AbsoluteFill>
        <Background variant={background?.variant} glow={background?.glow} />
        {header ? <SceneHeaderBlock frame={frame} {...header} /> : null}
        <AbsoluteFill
          style={{
            paddingLeft: tokens.spacing.xl,
            paddingRight: tokens.spacing.xl,
            paddingTop: header ? HEADER_CLEARANCE : tokens.spacing.xl,
            paddingBottom: caption ? CAPTION_CLEARANCE : tokens.spacing.xl,
          }}
        >
          {children}
        </AbsoluteFill>
        {caption ? <SceneCaption frame={frame}>{caption}</SceneCaption> : null}
      </AbsoluteFill>
    </SceneContext.Provider>
  );
};

const SceneHeaderBlock: FC<SceneHeaderSpec & { frame: number }> = ({
  eyebrow,
  title,
  tone = "info",
  scale = "normal",
  frame,
}) => {
  const progress = reveal(frame);
  const accent = tokens.color.tone[tone].fg;
  return (
    <div
      style={{
        position: "absolute",
        top: tokens.spacing.lg + 8,
        left: tokens.spacing.xl,
        opacity: progress,
        transform: `translateY(${interpolate(progress, [0, 1], [18, 0], clampExtrapolate)}px)`,
      }}
    >
      <div
        style={{
          color: accent,
          fontFamily: tokens.fontFamily.sans,
          fontSize: tokens.fontSize.xs,
          fontWeight: 800,
          letterSpacing: 4,
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          color: tokens.color.text,
          fontFamily: tokens.fontFamily.sans,
          fontSize: scale === "hero" ? tokens.fontSize.xl : tokens.fontSize.lg,
          fontWeight: 750,
          letterSpacing: -2.5,
        }}
      >
        {title}
      </div>
    </div>
  );
};

const SceneCaption: FC<{ children: ReactNode; frame: number }> = ({ children, frame }) => {
  const opacity = interpolate(frame, [10, 25], [0, 1], clampExtrapolate);
  return (
    <div
      style={{
        position: "absolute",
        left: CAPTION_SIDE_MARGIN,
        right: CAPTION_SIDE_MARGIN,
        bottom: 48,
        textAlign: "center",
        color: tokens.color.text,
        fontFamily: tokens.fontFamily.sans,
        fontSize: 28,
        fontWeight: 600,
        lineHeight: 1.5,
        opacity,
        textShadow: "0 3px 16px #000",
      }}
    >
      {children}
    </div>
  );
};
