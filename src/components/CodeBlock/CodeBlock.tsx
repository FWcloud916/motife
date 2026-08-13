import type { FC } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { clampExtrapolate, reveal } from "../motion/progress";
import { resolveWindow } from "../motion/timing";
import { useSceneTiming } from "../Scene/SceneContext";
import type { Measure, Size, Tone, Window } from "../tokens";
import { MEASURE_WIDTH, tokens } from "../tokens";

// Own micro-model instead of a real syntax highlighter (shiki/prism): no
// bundle weight, no async setup, and the segments are exactly the shape a
// Phase 2 DSL can emit directly (pre-tokenized by the LLM/compiler, not
// re-parsed at render time).
export type CodeSegment = string | { text: string; tone: Tone };

export interface CodeLine {
  segments: CodeSegment[];
  indent?: number;
  diff?: "added" | "removed";
}

export interface CodeHighlight {
  /** Inclusive [start, end] line index range to emphasize; other lines dim. */
  lines: [number, number];
  window: Window;
}

export interface CodeBlockProps {
  title?: string;
  lines: CodeLine[];
  reveal?: { mode?: "all" | "staggered"; window?: Window };
  highlights?: CodeHighlight[];
  size?: Size;
  /** "panel" (default): the card chrome — gradient background, border,
   * shadow, padding. "bare": none of that, so a CodeBlock can sit inside a
   * Callout card (or any other panel) without doubling up the chrome —
   * replaces Breakdown's `<pre>` and Walkthrough's inline mono formula,
   * which used to hand-roll bare monospace text for exactly this reason. */
  chrome?: "panel" | "bare";
  /** Semantic width, for a CodeBlock sitting beside a sibling inside a
   * Stack row. Omit for a CodeBlock that should size to its own content. */
  width?: Measure;
  /** Take a proportional share of the remaining space in the enclosing
   * Stack's main axis, instead of sizing to content. */
  grow?: boolean;
}

const FONT_SIZE: Record<Size, number> = {
  sm: tokens.fontSize.xs,
  md: tokens.fontSize.sm,
  lg: tokens.fontSize.md,
};
const LINE_GAP: Record<Size, number> = { sm: 8, md: 12, lg: 16 };

const DEFAULT_REVEAL_WINDOW: Window = { from: 0, to: 0.3 };

export const CodeBlock: FC<CodeBlockProps> = ({
  title,
  lines,
  reveal: revealSpec,
  highlights = [],
  size = "md",
  chrome = "panel",
  width,
  grow,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useSceneTiming();
  const mode = revealSpec?.mode ?? "all";
  const revealWindow = revealSpec?.window ?? DEFAULT_REVEAL_WINDOW;
  const { startFrame: revealStart } = resolveWindow(revealWindow, durationInFrames);

  const activeHighlight = highlights.find((h) => {
    const range = resolveWindow(h.window, durationInFrames);
    return frame >= range.startFrame && frame <= range.endFrame;
  });

  return (
    <div
      style={{
        background:
          chrome === "panel"
            ? `linear-gradient(145deg, ${tokens.color.surfaceRaised}f2, ${tokens.color.surface}f2)`
            : undefined,
        border: chrome === "panel" ? `1px solid ${tokens.color.line}88` : undefined,
        borderRadius: chrome === "panel" ? tokens.radius.md : undefined,
        boxShadow: chrome === "panel" ? "0 25px 70px #0007" : undefined,
        padding: chrome === "panel" ? tokens.spacing.md : undefined,
        fontFamily: tokens.fontFamily.mono,
        fontSize: FONT_SIZE[size],
        width: width ? MEASURE_WIDTH[width] : undefined,
        flex: grow ? "1 1 0" : undefined,
        boxSizing: "border-box",
      }}
    >
      {title ? (
        <div
          style={{
            color: tokens.color.textMuted,
            fontFamily: tokens.fontFamily.sans,
            fontSize: tokens.fontSize.xs,
            fontWeight: 700,
            letterSpacing: 1,
            marginBottom: tokens.spacing.sm,
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>
      ) : null}
      {lines.map((line, index) => {
        const dimmed = activeHighlight
          ? index < activeHighlight.lines[0] || index > activeHighlight.lines[1]
          : false;
        const lineDelay =
          mode === "staggered" ? revealStart + index * tokens.duration.fast : revealStart;
        const progress = reveal(frame, lineDelay);
        const diffColor =
          line.diff === "added"
            ? tokens.color.tone.success.fg
            : line.diff === "removed"
              ? tokens.color.tone.danger.fg
              : undefined;

        return (
          <div
            key={index}
            style={{
              display: "flex",
              gap: 4,
              paddingLeft: (line.indent ?? 0) * 20,
              marginBottom: LINE_GAP[size],
              opacity: progress * (dimmed ? 0.35 : 1),
              transform: `translateX(${interpolate(progress, [0, 1], [12, 0], clampExtrapolate)}px)`,
              background: diffColor ? `${diffColor}15` : undefined,
              borderLeft: diffColor ? `3px solid ${diffColor}` : undefined,
            }}
          >
            {line.segments.map((segment, segmentIndex) =>
              typeof segment === "string" ? (
                <span key={segmentIndex} style={{ color: tokens.color.text }}>
                  {segment}
                </span>
              ) : (
                <span key={segmentIndex} style={{ color: tokens.color.tone[segment.tone].fg }}>
                  {segment.text}
                </span>
              ),
            )}
          </div>
        );
      })}
    </div>
  );
};
