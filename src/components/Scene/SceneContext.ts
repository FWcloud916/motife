import { createContext, useContext } from "react";

export interface SceneTiming {
  /**
   * This Scene's own duration — NOT the whole composition's.
   * useCurrentFrame() only exposes the frame relative to the nearest
   * enclosing <Sequence>, and useVideoConfig().durationInFrames is the
   * composition total, so a scene otherwise has no way to know how long
   * its own <Sequence> actually lasts. The composition wiring (JwtAuthFlow
   * / sceneRegistry today, the compiler's zip in Phase 2) passes it in as
   * `durationInFrames` on <Scene>, and every Window-based component below
   * resolves its timing against this value via `motion/timing.ts`.
   */
  durationInFrames: number;
  fps: number;
}

export const SceneContext = createContext<SceneTiming | null>(null);

/** Reads the enclosing <Scene>'s timing. Throws outside one — every timed
 * component in the library is meant to live inside a Scene. */
export function useSceneTiming(): SceneTiming {
  const ctx = useContext(SceneContext);
  if (!ctx) {
    throw new Error(
      "useSceneTiming() was called outside a <Scene> — every timed component " +
        "must be a descendant of <Scene>, which provides durationInFrames/fps.",
    );
  }
  return ctx;
}
