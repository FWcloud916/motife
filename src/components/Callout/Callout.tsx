import type { FC, ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { useSceneTiming } from "../Scene/SceneContext";
import { Icon } from "../icons/Icon";
import type { IconName } from "../icons/registry";
import { clampExtrapolate, reveal } from "../motion/progress";
import { resolveWindow } from "../motion/timing";
import type { Emphasis, Size, Tone, Window } from "../tokens";
import { tokens } from "../tokens";

interface CalloutBase {
  tone?: Tone;
  /** When to reveal, as a fraction of the enclosing Scene's duration.
   * Omit to reveal immediately at the scene's start. */
  window?: Window;
}

export type CalloutProps =
  | (CalloutBase & { variant: "pill"; text: string; icon?: IconName })
  | (CalloutBase & { variant: "card"; emphasis?: Emphasis; size?: Size; children: ReactNode })
  | (CalloutBase & { variant: "banner"; text: string; detail?: string; icon?: IconName });

const SIZE_PADDING: Record<Size, number> = {
  sm: tokens.spacing.sm,
  md: tokens.spacing.md,
  lg: tokens.spacing.lg,
};

function shadowFor(emphasis: Emphasis, accent: string): string {
  if (emphasis === "high") return `0 0 0 1px ${accent}55, 0 25px 80px ${accent}22`;
  if (emphasis === "medium") return "0 25px 70px #0007";
  return "0 20px 60px #0006";
}

function useRevealStyle(window: Window | undefined): { opacity: number; transform: string } {
  const frame = useCurrentFrame();
  const { durationInFrames } = useSceneTiming();
  const delay = window ? resolveWindow(window, durationInFrames).startFrame : 0;
  const progress = reveal(frame, delay);
  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [14, 0], clampExtrapolate)}px)`,
  };
}

// Absorbs Phase 0's Pill/Card/status-banner primitives into one
// tone/emphasis/size-driven component — no `style` escape hatch, so every
// visual choice here is expressible as a DSL field (motife-plan.md §2
// 決策2: no CSS-like concepts in the schema).
export const Callout: FC<CalloutProps> = (props) => {
  const { tone = "primary", window } = props;
  const accent = tokens.color.tone[tone].fg;
  const style = useRevealStyle(window);

  if (props.variant === "pill") {
    return (
      <div
        style={{
          ...style,
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          color: accent,
          background: tokens.color.tone[tone].bg,
          border: `1px solid ${tokens.color.tone[tone].border}`,
          borderRadius: tokens.radius.pill,
          padding: "10px 18px",
          fontFamily: tokens.fontFamily.sans,
          fontSize: tokens.fontSize.xs,
          fontWeight: 700,
          letterSpacing: 0.5,
        }}
      >
        {props.icon ? <Icon name={props.icon} tone={tone} size="sm" /> : null}
        {props.text}
      </div>
    );
  }

  if (props.variant === "banner") {
    return (
      <div
        style={{
          ...style,
          display: "flex",
          alignItems: "center",
          gap: tokens.spacing.sm,
          background: `linear-gradient(145deg, ${tokens.color.surfaceRaised}f2, ${tokens.color.surface}f2)`,
          border: `1px solid ${accent}88`,
          borderRadius: tokens.radius.md,
          boxShadow: shadowFor("medium", accent),
          padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px`,
        }}
      >
        {props.icon ? <Icon name={props.icon} tone={tone} size="md" /> : null}
        <div>
          <div
            style={{
              fontFamily: tokens.fontFamily.sans,
              fontSize: tokens.fontSize.sm,
              fontWeight: 750,
              color: tokens.color.text,
            }}
          >
            {props.text}
          </div>
          {props.detail ? (
            <div
              style={{
                fontFamily: tokens.fontFamily.sans,
                fontSize: tokens.fontSize.xs,
                color: tokens.color.textMuted,
                marginTop: 4,
              }}
            >
              {props.detail}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const emphasis = props.emphasis ?? "medium";
  const size = props.size ?? "md";
  return (
    <div
      style={{
        ...style,
        background: `linear-gradient(145deg, ${tokens.color.surfaceRaised}f2, ${tokens.color.surface}f2)`,
        border: `1px solid ${accent}88`,
        borderRadius: tokens.radius.md,
        boxShadow: shadowFor(emphasis, accent),
        padding: SIZE_PADDING[size],
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.spacing.sm,
      }}
    >
      {props.children}
    </div>
  );
};
