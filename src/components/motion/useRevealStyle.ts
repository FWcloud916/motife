import { interpolate, useCurrentFrame } from "remotion";
import { useSceneTiming } from "../Scene/SceneContext";
import type { Window } from "../tokens";
import { clampExtrapolate, reveal } from "./progress";
import { resolveWindow } from "./timing";

/**
 * The one reveal motion every windowed component shares: fade in + rise
 * 14px, starting at `window`'s resolved start frame. Originally local to
 * Callout.tsx; hoisted here once Stack and Text needed the identical
 * animation, so the motion stays defined in exactly one place rather than
 * drifting across components.
 *
 * Returns `{}` — no `opacity`/`transform` at all — when `window` is
 * omitted, rather than a settled-but-present `opacity: 1, transform:
 * translateY(0px)`. Every scene composes many Stack/Text/Callout instances
 * that never animate; giving each one a no-op `transform` would needlessly
 * promote it to its own compositing layer. With the semantic primitives'
 * far higher instance count per scene than Phase 1's handful of Callouts,
 * that stopped being free — it produced a visible double-paint artifact on
 * a large `<Text role="hero">` in Remotion's headless-Chrome renderer (see
 * the Stage 1 progress note). Omitting the properties outright, not just
 * neutralizing their values, is what avoids the layer promotion.
 */
export function useRevealStyle(window: Window | undefined): { opacity?: number; transform?: string } {
  const frame = useCurrentFrame();
  const { durationInFrames } = useSceneTiming();
  if (!window) return {};
  const delay = resolveWindow(window, durationInFrames).startFrame;
  const progress = reveal(frame, delay);
  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [14, 0], clampExtrapolate)}px)`,
  };
}
