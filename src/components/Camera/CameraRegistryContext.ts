import { createContext } from "react";

export interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CameraRegistry {
  register: (id: string, rect: TargetRect) => void;
}

/**
 * Shared between Camera.tsx and Diagram.tsx. A <Camera> provides this;
 * anything mounted inside it — <CameraTarget>, or a <Diagram> registering
 * its own nodes automatically — writes named rects into it so Camera's
 * `shots` can focus by id. This exists specifically because a <Diagram>
 * nested inside <Camera> is a DESCENDANT in the JSX tree, so Camera can't
 * read a context Diagram provides — Diagram has to register itself into a
 * context Camera provides instead.
 */
export const CameraRegistryContext = createContext<CameraRegistry | null>(null);

/** The id a nested <Diagram> auto-registers its overall bounding box
 * under, so `focus: "all"` works without the caller naming anything. */
export const DIAGRAM_BOUNDS_ID = "__diagram__";
