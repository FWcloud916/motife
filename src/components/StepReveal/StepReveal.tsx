import type { FC } from "react";
import { useCurrentFrame } from "remotion";
import { useSceneTiming } from "../Scene/SceneContext";
import { Icon } from "../icons/Icon";
import { resolveSteps, stepStateAtFrame } from "../motion/timing";
import type { StepOutcome, StepState } from "../motion/timing";
import type { Tone, Window } from "../tokens";
import { tokens } from "../tokens";

export interface Step {
  title: string;
  detail?: string;
  /** Share of the window this step occupies, relative to the other steps.
   * Defaults to 1 (equal split). */
  weight?: number;
  outcome?: StepOutcome;
}

export interface StepRevealProps {
  steps: Step[];
  /** Portion of the enclosing Scene the whole sequence occupies. */
  window?: Window;
  layout?: "list" | "row";
  label?: string;
}

const DEFAULT_WINDOW: Window = { from: 0.1, to: 0.95 };

export interface ResolvedStep {
  step: Step;
  state: StepState;
}

/**
 * Resolves each step's FrameRange + live StepState at the current frame.
 * Exported so a sibling component (e.g. a detail panel next to the
 * checklist) can drive its own content off the exact same boundaries
 * without duplicating the timing math or rendering <StepReveal> itself.
 */
export function useSteps(steps: readonly Step[], window: Window = DEFAULT_WINDOW): ResolvedStep[] {
  const frame = useCurrentFrame();
  const { durationInFrames } = useSceneTiming();
  const ranges = resolveSteps(steps, window, durationInFrames);
  return ranges.map((range, index) => ({
    step: steps[index],
    state: stepStateAtFrame(frame, range),
  }));
}

const STATE_TONE: Record<StepState, Tone> = {
  pending: "neutral",
  active: "primary",
  passed: "success",
  failed: "danger",
};

export const StepReveal: FC<StepRevealProps> = ({
  steps,
  window = DEFAULT_WINDOW,
  layout = "list",
  label,
}) => {
  const resolved = useSteps(steps, window);
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
          display: "flex",
          flexDirection: layout === "row" ? "row" : "column",
          gap: tokens.spacing.md,
        }}
      >
        {resolved.map(({ step, state }, index) => (
          <StepRow key={index} step={step} state={state} />
        ))}
      </div>
    </div>
  );
};

const StepRow: FC<{ step: Step; state: StepState }> = ({ step, state }) => {
  const tone = STATE_TONE[state];
  const accent = tokens.color.tone[tone].fg;
  const opacity = state === "pending" ? 0.45 : 1;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: tokens.spacing.md,
        opacity,
        color: tokens.color.text,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: tokens.radius.pill,
          display: "grid",
          placeItems: "center",
          background: tokens.color.tone[tone].bg,
          border: `1px solid ${tokens.color.tone[tone].border}`,
          flexShrink: 0,
        }}
      >
        {state === "passed" ? (
          <Icon name="check" tone={tone} size="sm" />
        ) : state === "failed" ? (
          <Icon name="cross" tone={tone} size="sm" />
        ) : (
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: accent }} />
        )}
      </div>
      <div>
        <div
          style={{
            fontFamily: tokens.fontFamily.sans,
            fontSize: tokens.fontSize.sm,
            fontWeight: 700,
          }}
        >
          {step.title}
        </div>
        {step.detail ? (
          <div
            style={{
              fontFamily: tokens.fontFamily.sans,
              fontSize: tokens.fontSize.xs,
              color: tokens.color.textMuted,
              marginTop: 2,
            }}
          >
            {step.detail}
          </div>
        ) : null}
      </div>
    </div>
  );
};
