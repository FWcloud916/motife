import type { IconName } from "../icons/registry";
import type { Size, Tone } from "../tokens";

export interface GraphNodeSpec {
  id: string;
  icon?: IconName;
  label: string;
  detail?: string;
  tone?: Tone;
  size?: Size;
}

export interface GraphEdgeSpec {
  /** Defaults to `"${from}->${to}"`. Set explicitly if a graph ever needs
   * two edges between the same pair of nodes. */
  id?: string;
  from: string;
  to: string;
  label?: string;
}

/**
 * The only input a Diagram accepts: topology, never coordinates
 * (motife-plan.md §2 決策3 — layout is computed, the caller/LLM never
 * supplies positions).
 */
export interface GraphSpec {
  direction?: "right" | "down";
  nodes: GraphNodeSpec[];
  edges: GraphEdgeSpec[];
}

export interface LayoutRect {
  /** Top-left corner (dagre reports node centers; computeLayout converts). */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutEdgePath {
  points: { x: number; y: number }[];
  /** Rounded-corner SVG path `d` string through `points`. */
  path: string;
}

/**
 * Coordinates exist ONLY here — the output of computeLayout(), never an
 * input anywhere in the component library.
 */
export interface LayoutResult {
  width: number;
  height: number;
  nodes: Record<string, LayoutRect>;
  edges: Record<string, LayoutEdgePath>;
}
