import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { useSceneTiming } from "../Scene/SceneContext";
import { clampExtrapolate } from "../motion/progress";
import { resolveWindow } from "../motion/timing";
import type { Size, Tone, Window } from "../tokens";
import { tokens } from "../tokens";

// The semantic replacement for Walkthrough.tsx's hand-rolled progress bar
// (a raw <div> with an interpolate()-driven width% and a literal
// boxShadow — exactly the CSS-like construct motife-plan.md §2 決策2
// forbids in the DSL). Reused by the MQ backpressure video for queue depth
// vs. a high-water `threshold`.
export interface MeterProps {
  /** Animate 0 -> 1 across this window. Mutually exclusive with `value` —
   * when both are given, `window` wins. */
  window?: Window;
  /** A fixed level, 0..1, when the meter isn't animating (e.g. a
   * before/after comparison rather than a live fill). */
  value?: number;
  tone?: Tone;
  label?: string;
  size?: Size;
  /** Draws a marker on the track at this 0..1 position — e.g. the
   * backpressure high-water line. */
  threshold?: number;
}

const TRACK_HEIGHT: Record<Size, number> = { sm: 6, md: 9, lg: 14 };

export const Meter: FC<MeterProps> = ({
  window,
  value,
  tone = "primary",
  label,
  size = "md",
  threshold,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useSceneTiming();
  const accent = tokens.color.tone[tone].fg;

  const level = window
    ? interpolate(
        frame,
        [resolveWindow(window, durationInFrames).startFrame, resolveWindow(window, durationInFrames).endFrame],
        [0, 1],
        clampExtrapolate,
      )
    : Math.min(1, Math.max(0, value ?? 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.sm }}>
      {label ? (
        <div
          style={{
            fontFamily: tokens.fontFamily.sans,
            fontSize: tokens.fontSize.xs,
            fontWeight: 800,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: tokens.color.textMuted,
          }}
        >
          {label}
        </div>
      ) : null}
      <div
        style={{
          position: "relative",
          height: TRACK_HEIGHT[size],
          borderRadius: tokens.radius.pill,
          background: tokens.color.line,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${level * 100}%`,
            background: accent,
            boxShadow: `0 0 16px ${accent}`,
            borderRadius: tokens.radius.pill,
          }}
        />
        {threshold !== undefined ? (
          <div
            style={{
              position: "absolute",
              top: -3,
              bottom: -3,
              left: `${Math.min(1, Math.max(0, threshold)) * 100}%`,
              width: 2,
              background: tokens.color.tone.warning.fg,
            }}
          />
        ) : null}
      </div>
    </div>
  );
};
