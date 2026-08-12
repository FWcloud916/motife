import type { FC } from "react";
import { evolvePath, getLength, getPointAtLength } from "@remotion/paths";
import { interpolate, useCurrentFrame } from "remotion";
import { useDiagramLayout } from "../Diagram/DiagramContext";
import { useSceneTiming } from "../Scene/SceneContext";
import { clampExtrapolate } from "../motion/progress";
import { resolveWindow } from "../motion/timing";
import type { Tone, Window } from "../tokens";
import { tokens } from "../tokens";

export interface FlowSpec {
  /** An edge id from the enclosing Diagram's graph — its own `id`, or the
   * `"from->to"` default when the edge didn't set one. */
  edge: string;
  /** When the pulse travels, as a fraction of the enclosing Scene's
   * duration. */
  window: Window;
  tone?: Tone;
  label?: string;
  direction?: "forward" | "reverse";
}

export interface FlowPulseProps {
  flow: FlowSpec;
}

// Replaces the Phase 0 FlowLine, which only drew a straight horizontal
// line — this follows whatever route the layout engine actually computed
// (a bent, rounded edge is exactly as easy as a straight one).
export const FlowPulse: FC<FlowPulseProps> = ({ flow }) => {
  const layout = useDiagramLayout();
  const { durationInFrames } = useSceneTiming();
  const frame = useCurrentFrame();

  const edge = layout.edges[flow.edge];
  // Fails quiet rather than crashing the render — a dangling edge id is a
  // data problem (most likely from Phase 2+ generated DSL), not a reason
  // to take the whole frame down.
  if (!edge) return null;

  const { startFrame, endFrame } = resolveWindow(flow.window, durationInFrames);
  const rawProgress = interpolate(frame, [startFrame, endFrame], [0, 1], clampExtrapolate);
  if (frame < startFrame || frame > endFrame) return null;

  const progress = flow.direction === "reverse" ? 1 - rawProgress : rawProgress;
  const accent = tokens.color.tone[flow.tone ?? "info"].fg;
  const totalLength = getLength(edge.path);
  const dot = getPointAtLength(edge.path, progress * totalLength);
  const { strokeDasharray, strokeDashoffset } = evolvePath(rawProgress, edge.path);

  if (!dot) return null;

  return (
    <svg
      width={layout.width}
      height={layout.height}
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}
    >
      <path
        d={edge.path}
        fill="none"
        stroke={accent}
        strokeWidth={4}
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        style={{ filter: `drop-shadow(0 0 8px ${accent})` }}
      />
      <circle
        cx={dot.x}
        cy={dot.y}
        r={9}
        fill={accent}
        style={{ filter: `drop-shadow(0 0 12px ${accent})` }}
      />
      {flow.label ? (
        <text
          x={dot.x}
          y={dot.y - 22}
          textAnchor="middle"
          fill={accent}
          // A short edge's midpoint can sit right on top of a node's icon
          // (dagre routes to the node's boundary at its vertical center) —
          // a background-colored stroke drawn behind the fill (paintOrder
          // "stroke") gives the label a halo so it stays legible over
          // whatever's underneath, without needing to measure text to
          // place a real background rect.
          stroke={tokens.color.bg}
          strokeWidth={6}
          paintOrder="stroke"
          fontFamily={tokens.fontFamily.sans}
          fontSize={tokens.fontSize.xs}
          fontWeight={700}
        >
          {flow.label}
        </text>
      ) : null}
    </svg>
  );
};
