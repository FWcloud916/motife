import { createContext, useContext } from "react";
import type { LayoutResult } from "../layout/types";

export const DiagramContext = createContext<LayoutResult | null>(null);

/** Reads the enclosing <Diagram>'s computed layout — FlowPulse resolves an
 * edge id against it, and Camera's node-focus mode resolves a node id. */
export function useDiagramLayout(): LayoutResult {
  const ctx = useContext(DiagramContext);
  if (!ctx) {
    throw new Error(
      "useDiagramLayout() was called outside a <Diagram> — FlowPulse and " +
        "Camera's node-focus mode both need the enclosing Diagram's computed layout.",
    );
  }
  return ctx;
}
