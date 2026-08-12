import type { FC, ReactNode } from "react";
import { useCallback, useContext, useMemo, useState } from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clampExtrapolate } from "../motion/progress";
import { resolveWindow } from "../motion/timing";
import type { FrameRange } from "../motion/timing";
import { useSceneTiming } from "../Scene/SceneContext";
import { easing } from "../tokens";
import type { Window } from "../tokens";
import { CameraRegistryContext, DIAGRAM_BOUNDS_ID } from "./CameraRegistryContext";
import type { TargetRect } from "./CameraRegistryContext";

type Focus = { node: string } | { target: string } | "all";

export interface CameraShot {
  /** When the camera arrives at this shot's focus, as a fraction of the
   * enclosing Scene's duration. The camera holds the previous shot's
   * position until `window.from`, eases across `[from, to]`, then holds. */
  window: Window;
  focus: Focus;
  zoom?: "wide" | "medium" | "close";
}

export interface CameraProps {
  shots: CameraShot[];
  children: ReactNode;
}

const ZOOM_SCALE: Record<NonNullable<CameraShot["zoom"]>, number> = {
  wide: 1,
  medium: 1.4,
  close: 2,
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRect(a: TargetRect, b: TargetRect, t: number): TargetRect {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    width: lerp(a.width, b.width, t),
    height: lerp(a.height, b.height, t),
  };
}

/**
 * Registers its child's box — measured via `offsetLeft`/`offsetTop`, which
 * (unlike `getBoundingClientRect()`) reflects pre-transform layout
 * position, so it's unaffected by Camera's own scale/translate — as a
 * focusable target by `id`. Must render inside the same `<Camera>` whose
 * shots reference this id. Prefer a Diagram node focus (`{node: id}`) when
 * the subject is already a Diagram node — a nested <Diagram> registers its
 * own nodes automatically; CameraTarget is the fallback for content
 * Diagram doesn't know about. Keep it as a direct child of Camera's
 * content (no extra `position`-ed wrapper in between) for the offset math
 * to line up.
 *
 * Open item: like Diagram's old `fit` implementation, this is a one-shot
 * ref measurement and could in principle observe a stale pre-layout size.
 * Diagram's node-focus path (the primary, recommended one) no longer has
 * this risk; CameraTarget remains the documented fallback until a real
 * scene exercises it enough to either prove it out or replace it with a
 * measurement-free technique.
 */
export const CameraTarget: FC<{ id: string; children: ReactNode }> = ({ id, children }) => {
  const registry = useContext(CameraRegistryContext);
  const measureRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node && registry) {
        registry.register(id, {
          x: node.offsetLeft,
          y: node.offsetTop,
          width: node.offsetWidth,
          height: node.offsetHeight,
        });
      }
    },
    [id, registry],
  );
  return <div ref={measureRef}>{children}</div>;
};

function focusRectFor(
  focus: Focus,
  targets: Record<string, TargetRect>,
  containerSize: { width: number; height: number },
): TargetRect | null {
  if (focus === "all") {
    return targets[DIAGRAM_BOUNDS_ID] ?? { x: 0, y: 0, width: containerSize.width, height: containerSize.height };
  }
  if ("node" in focus) return targets[focus.node] ?? null;
  return targets[focus.target] ?? null;
}

interface ResolvedTransform {
  rect: TargetRect;
  zoom: number;
}

function currentTransform(
  frame: number,
  shots: { shot: CameraShot; range: FrameRange; rect: TargetRect | null }[],
): ResolvedTransform | null {
  let prev: ResolvedTransform | null = null;
  for (const { shot, range, rect } of shots) {
    if (!rect) continue;
    const zoom = ZOOM_SCALE[shot.zoom ?? "medium"];
    if (frame < range.startFrame) {
      return prev ?? { rect, zoom };
    }
    if (frame <= range.endFrame) {
      const t = easing.emphasize(
        interpolate(frame, [range.startFrame, range.endFrame], [0, 1], clampExtrapolate),
      );
      const from = prev ?? { rect, zoom };
      return { rect: lerpRect(from.rect, rect, t), zoom: lerp(from.zoom, zoom, t) };
    }
    prev = { rect, zoom };
  }
  return prev;
}

// A camera "zoom/pan/focus" primitive isn't a Remotion built-in — this is
// the idiomatic approach: a wrapper div whose transform is driven off
// resolved target rects, applied to everything passed as `children`.
//
// Assumes Camera fills the full composition frame (the common case: a
// Scene's content, full-bleed). Its own viewport size comes from
// useVideoConfig() — synchronous and exact on the very first render —
// rather than ref-measuring its wrapper div's clientWidth/clientHeight,
// for the same reason Diagram's `fit` no longer does: a one-shot DOM
// measurement can observe a stale, too-small size before Remotion's
// headless Chrome finishes settling the surrounding layout.
export const Camera: FC<CameraProps> = ({ shots, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useSceneTiming();
  const { width: containerWidth, height: containerHeight } = useVideoConfig();

  const [targets, setTargets] = useState<Record<string, TargetRect>>({});
  const register = useCallback((id: string, rect: TargetRect) => {
    setTargets((prev) => {
      const existing = prev[id];
      if (
        existing &&
        existing.x === rect.x &&
        existing.y === rect.y &&
        existing.width === rect.width &&
        existing.height === rect.height
      ) {
        return prev;
      }
      return { ...prev, [id]: rect };
    });
  }, []);
  const registry = useMemo(() => ({ register }), [register]);

  const containerSize = { width: containerWidth, height: containerHeight };
  const resolvedShots = shots.map((shot) => ({
    shot,
    range: resolveWindow(shot.window, durationInFrames),
    rect: focusRectFor(shot.focus, targets, containerSize),
  }));
  const transform = currentTransform(frame, resolvedShots);

  const style = transform
    ? (() => {
        const cx = transform.rect.x + transform.rect.width / 2;
        const cy = transform.rect.y + transform.rect.height / 2;
        const tx = containerWidth / 2 - cx * transform.zoom;
        const ty = containerHeight / 2 - cy * transform.zoom;
        return {
          transform: `translate(${tx}px, ${ty}px) scale(${transform.zoom})`,
          transformOrigin: "0 0",
        };
      })()
    : {};

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <CameraRegistryContext.Provider value={registry}>
        <div style={{ position: "absolute", inset: 0, ...style }}>{children}</div>
      </CameraRegistryContext.Provider>
    </div>
  );
};
