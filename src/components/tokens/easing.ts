import { Easing } from "remotion";

// A small Material-style trio, named by intent rather than curve shape so
// components pick an easing by what's happening ("this is an entrance") and
// never hand-tune bezier numbers inline.
export const easing = {
  standard: Easing.bezier(0.4, 0.0, 0.2, 1),
  decelerate: Easing.bezier(0.0, 0.0, 0.2, 1), // entrances — fast start, gentle stop
  accelerate: Easing.bezier(0.4, 0.0, 1, 1), // exits — gentle start, fast finish
  emphasize: Easing.bezier(0.2, 0.0, 0, 1), // camera moves, hero reveals
} as const;

export type EasingToken = keyof typeof easing;
