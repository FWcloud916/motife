import type { FC } from "react";
import { useCurrentFrame } from "remotion";
import { resolveWindow } from "../motion/timing";
import { useSceneTiming } from "../Scene/SceneContext";
import type { Measure, Size, Tone, Window } from "../tokens";
import { MEASURE_WIDTH, tokens } from "../tokens";

export interface TerminalStep {
  command: string;
  output?: string[];
  outputTone?: Tone;
  window: Window;
}

export interface TerminalProps {
  title?: string;
  steps: TerminalStep[];
  size?: Size;
  /** Semantic width, for a Terminal sitting beside a sibling inside a
   * Stack row. Omit for a Terminal that should size to its own content. */
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

const DOT_COLORS = [tokens.color.danger, tokens.color.warning, tokens.color.mint];

export const Terminal: FC<TerminalProps> = ({
  title = "Terminal",
  steps,
  size = "md",
  width,
  grow,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useSceneTiming();

  return (
    <div
      style={{
        background: `linear-gradient(145deg, ${tokens.color.surfaceRaised}f2, ${tokens.color.surface}f2)`,
        border: `1px solid ${tokens.color.line}88`,
        borderRadius: tokens.radius.md,
        boxShadow: "0 25px 70px #0007",
        overflow: "hidden",
        width: width ? MEASURE_WIDTH[width] : undefined,
        flex: grow ? "1 1 0" : undefined,
        // Without this, a Terminal stacked below taller siblings in a
        // height-constrained flex column (e.g. a Callout card sized to
        // match a neighbouring card via Stack's align="stretch") gets
        // silently flex-shrunk below its own content height — the DOM
        // still has the correct, fully-computed step text, but `overflow:
        // hidden` above clips it away entirely, leaving only the header
        // bar visibly rendered. flexShrink:0 is what CodeBlock/Diagram get
        // for free by NOT setting `overflow:hidden` on their own root;
        // Terminal needs it declared explicitly to keep that clip for its
        // rounded header corners without it silently eating real content.
        flexShrink: grow ? undefined : 0,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
          borderBottom: `1px solid ${tokens.color.line}55`,
          fontFamily: tokens.fontFamily.sans,
          fontSize: tokens.fontSize.xs,
          color: tokens.color.textMuted,
        }}
      >
        {DOT_COLORS.map((color) => (
          <span
            key={color}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: color,
              display: "inline-block",
            }}
          />
        ))}
        <span style={{ marginLeft: 8 }}>{title}</span>
      </div>
      <div
        style={{
          padding: tokens.spacing.md,
          fontFamily: tokens.fontFamily.mono,
          fontSize: FONT_SIZE[size],
        }}
      >
        {steps.map((step, index) => (
          <TerminalStepRow
            key={index}
            step={step}
            frame={frame}
            durationInFrames={durationInFrames}
          />
        ))}
      </div>
    </div>
  );
};

const TerminalStepRow: FC<{ step: TerminalStep; frame: number; durationInFrames: number }> = ({
  step,
  frame,
  durationInFrames,
}) => {
  const { startFrame, endFrame } = resolveWindow(step.window, durationInFrames);
  if (frame < startFrame) return null;

  // First 40% of the step's window types the command; the rest holds the
  // output. No randomness anywhere (deterministic-randomness lint rule) —
  // the cursor blink is a pure function of `frame`, not a timer.
  const commandWindowFrames = Math.max(1, (endFrame - startFrame) * 0.4);
  const typedProgress = Math.min(1, (frame - startFrame) / commandWindowFrames);
  const typedChars = Math.floor(typedProgress * step.command.length);
  const typedCommand = step.command.slice(0, typedChars);
  const commandDone = typedChars >= step.command.length;
  const showCursor = !commandDone || Math.floor(frame / 15) % 2 === 0;
  const outputTone = step.outputTone ?? "success";

  return (
    <div style={{ marginBottom: tokens.spacing.sm }}>
      <div style={{ color: tokens.color.tone.info.fg }}>
        <span style={{ color: tokens.color.textMuted }}>{"$ "}</span>
        {typedCommand}
        {showCursor ? <span style={{ color: tokens.color.text }}>{"▌"}</span> : null}
      </div>
      {commandDone && step.output ? (
        <div style={{ color: tokens.color.tone[outputTone].fg, marginTop: 4 }}>
          {step.output.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
