import type { Size } from "../tokens";

export interface NodeSize {
  width: number;
  height: number;
}

// Node footprint per Size token — the `md` entry matches the Phase 0
// NodeCard's proven 268x228 card exactly. With measurement in play these
// are the MINIMUM footprints: a node never shrinks below its Size token,
// it only grows to fit text that wouldn't have fitted.
export const NODE_SIZE: Record<Size, NodeSize> = {
  sm: { width: 200, height: 160 },
  md: { width: 268, height: 228 },
  lg: { width: 340, height: 280 },
};

// tokens.spacing.md per side — kept literal for the same reason NODE_SEP is
// in computeLayout.ts (this module stays importable from node tests without
// dragging in the component barrel).
export const NODE_TEXT_PAD_X = 32;

// Beyond this a node stops widening and the label wraps instead (the CSS
// guardrails in DiagramNode handle the wrap). Three capped nodes plus two
// NODE_SEP gaps still fit a 1920-wide frame with margin to spare.
export const MAX_NODE_WIDTH = 560;

/**
 * Pure sizing rule: a node is as wide as its widest line of text needs,
 * clamped between its Size token's width and MAX_NODE_WIDTH.
 *
 * Height deliberately stays token-driven. Even the worst case inside an
 * `md` card — icon (82) + gap (16) + two wrapped label lines (~2x33) + gap
 * (16) + a detail line (25) — comes to ~205 against a 228 budget, so
 * wrap-aware height would add determinism surface for no visual gain.
 */
export function nodeSizeFor(contentWidth: number, size: Size): NodeSize {
  const base = NODE_SIZE[size];
  const desired = Math.ceil(contentWidth) + 2 * NODE_TEXT_PAD_X;
  return {
    width: Math.min(MAX_NODE_WIDTH, Math.max(base.width, desired)),
    height: base.height,
  };
}
