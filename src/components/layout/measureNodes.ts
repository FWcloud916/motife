import { measureText } from "@remotion/layout-utils";
import { tokens } from "../tokens";
import { nodeSizeFor } from "./nodeSizing";
import type { NodeSize } from "./nodeSizing";
import type { GraphSpec } from "./types";

/**
 * Measures each node's text and turns it into a node footprint.
 *
 * BROWSER ONLY — measureText renders into the DOM. Call it from an effect
 * gated on fontsReady() (see Diagram.tsx), never at module scope and never
 * from a node-env unit test. The pure half of this calculation lives in
 * nodeSizing.ts, which is what the tests cover.
 *
 * The font arguments must mirror DiagramNode's actual rendering exactly,
 * or the measurement describes text nobody draws. A note on `fontWeight:
 * 750`: it isn't one of the loaded faces (Inter ships 400/600/700/800,
 * Noto Sans TC 400/700), so the browser resolves it to a neighbouring
 * face. That's fine here precisely because measurement and rendering go
 * through identical CSS font matching and therefore agree — which is also
 * why `validateFontIsLoaded` is deliberately not set: it checks for an
 * exact-weight face and would report a false problem.
 */
export function measureGraphNodeSizes(graph: GraphSpec): Record<string, NodeSize> {
  const sizes: Record<string, NodeSize> = {};

  for (const node of graph.nodes) {
    const label = measureText({
      text: node.label,
      fontFamily: tokens.fontFamily.sans,
      fontSize: tokens.fontSize.sm,
      fontWeight: 750,
    });
    const detail = node.detail
      ? measureText({
          text: node.detail,
          fontFamily: tokens.fontFamily.sans,
          fontSize: tokens.fontSize.xs,
        })
      : { width: 0 };

    sizes[node.id] = nodeSizeFor(Math.max(label.width, detail.width), node.size ?? "md");
  }

  return sizes;
}
