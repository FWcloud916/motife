import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Icon } from "../icons/Icon";
import type { IconName } from "../icons/registry";
import { clampExtrapolate, reveal } from "../motion/progress";
import type { LayoutRect } from "../layout/types";
import type { Tone } from "../tokens";
import { tokens } from "../tokens";

export interface DiagramNodeProps {
  rect: LayoutRect;
  icon?: IconName;
  label: string;
  detail?: string;
  tone?: Tone;
  active?: boolean;
  /** Absolute frame offset for this node's own entrance — set by Diagram
   * from its `reveal` prop (stagger or all-at-once). */
  delay?: number;
}

export const DiagramNode: FC<DiagramNodeProps> = ({
  rect,
  icon,
  label,
  detail,
  tone = "info",
  active = false,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const progress = reveal(frame, delay);
  const accent = tokens.color.tone[tone].fg;

  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        opacity: progress,
        transform: `translateY(${interpolate(progress, [0, 1], [14, 0], clampExtrapolate)}px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.spacing.sm,
        background: `linear-gradient(145deg, ${tokens.color.surfaceRaised}f2, ${tokens.color.surface}f2)`,
        border: `1px solid ${active ? accent : tokens.color.line}88`,
        borderRadius: tokens.radius.md,
        boxShadow: active
          ? `0 0 0 1px ${accent}55, 0 25px 80px ${accent}22`
          : "0 25px 70px #0007",
        // Guardrail behind the measured sizing: a label past MAX_NODE_WIDTH
        // stops widening its card and has to wrap instead. The padding
        // keeps wrapped text off the border, and `overflow: hidden` is the
        // last resort for text that still can't fit (clipping is ugly, but
        // it is contained — spilling across a neighbouring node is worse).
        padding: `0 ${tokens.spacing.sm}px`,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {icon ? (
        <div
          style={{
            width: 82,
            height: 82,
            borderRadius: 25,
            display: "grid",
            placeItems: "center",
            background: tokens.color.tone[tone].bg,
            border: `1px solid ${tokens.color.tone[tone].border}`,
          }}
        >
          <Icon name={icon} tone={tone} />
        </div>
      ) : null}
      <div
        style={{
          fontFamily: tokens.fontFamily.sans,
          color: tokens.color.text,
          fontSize: tokens.fontSize.sm,
          fontWeight: 750,
          maxWidth: "100%",
          textAlign: "center",
          // "anywhere" rather than break-word: CJK wraps natively either
          // way, but this also breaks an unbroken Latin run (a URL, a long
          // identifier), which is the residual overflow case once width is
          // measured and capped.
          overflowWrap: "anywhere",
          lineHeight: 1.25,
        }}
      >
        {label}
      </div>
      {detail ? (
        <div
          style={{
            fontFamily: tokens.fontFamily.sans,
            color: tokens.color.textMuted,
            fontSize: tokens.fontSize.xs,
            maxWidth: "100%",
            textAlign: "center",
            overflowWrap: "anywhere",
            lineHeight: 1.25,
          }}
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
};
