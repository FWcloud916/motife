import type { FC, ReactNode } from "react";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { resolveWindow } from "../motion/timing";
import { useSceneTiming } from "../Scene/SceneContext";
import { fontsReady } from "../tokens";
import { CameraRegistryContext } from "./CameraRegistryContext";
import type { TargetRect } from "./CameraRegistryContext";
import { focusRectFor, resolveCameraTransform } from "./cameraMath";
import type { CameraShot } from "./cameraMath";

export type { CameraShot } from "./cameraMath";

export interface CameraProps {
  shots: CameraShot[];
  children: ReactNode;
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
 * Note that CameraTarget ids share one namespace with the Diagram node ids
 * registered by any Diagram nested in the same Camera — don't reuse a node
 * id for a target.
 *
 * ## Why the measurement looks like this
 *
 * Reading `offsetWidth` on mount is exactly the shape of bug that made
 * Diagram's original `fit` scaling non-deterministic: in the real
 * renderStill pipeline the first measurement can land before layout has
 * settled, and nothing ever corrects it. Two things fix it here.
 *
 * `fontsReady()` gates the measurement, because fonts are the only async
 * resource in this library that moves layout, and a font swap can shift a
 * target's POSITION without changing its size (which is also why a
 * ResizeObserver would be the wrong tool — it would never fire).
 *
 * A `delayRender` handle, taken eagerly at mount, holds the render until
 * that first post-fonts measurement lands, so no frame can be captured
 * against an unregistered or stale rect. After that the effect re-measures
 * on every commit — the registry dedupes identical rects, so the steady
 * state is a no-op, and anything that moves the target later is picked up.
 */
export const CameraTarget: FC<{ id: string; children: ReactNode }> = ({ id, children }) => {
  const registry = useContext(CameraRegistryContext);
  const ref = useRef<HTMLDivElement>(null);
  // Labelled with the id so a hung target names itself in the timeout error.
  const [handle] = useState(() => delayRender(`<CameraTarget id="${id}"> initial measurement`));
  const settled = useRef(false);
  const settle = useCallback(() => {
    if (!settled.current) {
      settled.current = true;
      continueRender(handle);
    }
  }, [handle]);

  // Deliberately no dependency array: re-measure after every commit.
  useEffect(() => {
    let cancelled = false;
    fontsReady()
      .then(() => {
        if (cancelled) return;
        const node = ref.current;
        if (node && registry) {
          registry.register(id, {
            x: node.offsetLeft,
            y: node.offsetTop,
            width: node.offsetWidth,
            height: node.offsetHeight,
          });
        }
        settle();
      })
      .catch((error) => cancelRender(error));
    return () => {
      cancelled = true;
    };
  });

  // Release the handle on unmount so a target that disappears before it
  // ever measured can't hang the render until the 30s timeout.
  useEffect(() => settle, [settle]);

  // inline-block so the wrapper shrink-wraps its content. A plain block div
  // would measure the full width of Camera's content area no matter how
  // small the thing inside is, and "focus on this" would then resolve to a
  // box far wider than the subject — the camera centres correctly but
  // frames the whole row, which reads as a broken shot.
  return (
    <div ref={ref} style={{ display: "inline-block" }}>
      {children}
    </div>
  );
};

// A camera "zoom/pan/focus" primitive isn't a Remotion built-in — this is
// the idiomatic approach: a wrapper div whose transform is driven off
// resolved target rects, applied to everything passed as `children`. The
// zoom/translation math (including the clamps that keep a shot's target,
// and the overall content, from panning off frame) lives in cameraMath.ts.
//
// The viewport the math frames against is Camera's own MEASURED box, not
// useVideoConfig()'s composition size. An earlier version assumed the
// full composition frame to avoid DOM measurement (a naive one-shot
// clientWidth read can observe a stale pre-layout size — the bug that
// made Diagram's original `fit` non-deterministic), but in practice a
// Camera almost never gets the full frame: Scene reserves header/caption
// clearance, and a sibling in the same Stack (db-index's steps card, in
// the eval run that surfaced this) shrinks the box further, so
// 1080-based framing was silently clipped by the wrapper's own
// `overflow: hidden`. The measurement here is safe for the same reasons
// CameraTarget's is (see its doc comment): it's gated on fontsReady()
// (the only async resource that moves layout), a delayRender handle
// taken eagerly at mount holds the render until the first post-fonts
// measurement lands, and the effect re-measures on every commit with a
// dedupe so the steady state is a no-op. useVideoConfig() remains only
// as the pre-measurement fallback (never screenshotted) and the
// `focus: "all"` rect default.
export const Camera: FC<CameraProps> = ({ shots, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useSceneTiming();
  const { width: compositionWidth, height: compositionHeight } = useVideoConfig();

  const viewportRef = useRef<HTMLDivElement>(null);
  const [measuredViewport, setMeasuredViewport] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [viewportHandle] = useState(() => delayRender("<Camera> viewport measurement"));
  const viewportSettled = useRef(false);
  const settleViewport = useCallback(() => {
    if (!viewportSettled.current) {
      viewportSettled.current = true;
      continueRender(viewportHandle);
    }
  }, [viewportHandle]);

  // Deliberately no dependency array: re-measure after every commit (the
  // dedupe below makes the steady state a no-op), so anything that
  // resizes the wrapper later is picked up.
  useEffect(() => {
    let cancelled = false;
    fontsReady()
      .then(() => {
        if (cancelled) return;
        const node = viewportRef.current;
        if (node && node.offsetWidth > 0 && node.offsetHeight > 0) {
          const width = node.offsetWidth;
          const height = node.offsetHeight;
          setMeasuredViewport((prev) =>
            prev && prev.width === width && prev.height === height ? prev : { width, height },
          );
        }
        settleViewport();
      })
      .catch((error) => cancelRender(error));
    return () => {
      cancelled = true;
    };
  });

  // Release the handle on unmount so a Camera that unmounts before fonts
  // settle can't hang the render until the 30s timeout.
  useEffect(() => settleViewport, [settleViewport]);

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

  const viewport = measuredViewport ?? { width: compositionWidth, height: compositionHeight };
  const resolvedShots = shots.map((shot) => ({
    shot,
    range: resolveWindow(shot.window, durationInFrames),
    rect: focusRectFor(shot.focus, targets, viewport),
  }));
  const transform = resolveCameraTransform(frame, resolvedShots, targets, viewport);
  const style = transform
    ? {
        transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.zoom})`,
        transformOrigin: "0 0",
      }
    : {};

  return (
    <div
      ref={viewportRef}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}
    >
      <CameraRegistryContext.Provider value={registry}>
        <div style={{ position: "absolute", inset: 0, ...style }}>{children}</div>
      </CameraRegistryContext.Provider>
    </div>
  );
};
