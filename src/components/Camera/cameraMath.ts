// Pure Camera transform math — kept out of Camera.tsx so the two
// invariants below are node-testable without React or Remotion's render
// pipeline (Easing/interpolate are pure functions themselves; the only
// thing NOT testable here is the actual DOM measurement, which stays in
// Camera.tsx/CameraTarget).
//
// 1. ZOOM CLAMP (per shot, before interpolation): a shot's nominal zoom
//    ("wide"/"medium"/"close") is an absolute multiplier with no idea how
//    big its own focus rect is — `focus: "all", zoom: "wide"` over a
//    diagram wider than the frame overflows at zoom 1 (the "Camera 運鏡
//    超出畫面範圍" Phase 3 failure mode). Cap the zoom so the focus rect,
//    plus a margin, never exceeds the viewport.
// 2. TRANSLATION CLAMP (per frame, after interpolation): centering on a
//    small focus rect inside a larger diagram can still drag the
//    diagram's own edges past the frame into dead background. Clamp the
//    pan so the viewport stays inside the OVERALL content bounds whenever
//    that content is bigger than the viewport at the current zoom;
//    otherwise center the content (there's nowhere for it to "leave"
//    toward).
import { interpolate } from "remotion";
import { clampExtrapolate } from "../motion/progress";
import type { FrameRange } from "../motion/timing";
import { easing, tokens } from "../tokens";
import type { Window } from "../tokens";
import { DIAGRAM_BOUNDS_ID } from "./CameraRegistryContext";
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

export const ZOOM_SCALE: Record<NonNullable<CameraShot["zoom"]>, number> = {
  wide: 1,
  medium: 1.4,
  close: 2,
};

// Breathing room around a clamped shot's focus rect / the overall content
// bounds, so a clamp never frames content flush against the frame edge.
const MARGIN = tokens.spacing.lg;

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpRect(a: TargetRect, b: TargetRect, t: number): TargetRect {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    width: lerp(a.width, b.width, t),
    height: lerp(a.height, b.height, t),
  };
}

export function unionRects(rects: readonly TargetRect[]): TargetRect {
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** The camera's notion of "everything" — the registered diagram bounds if
 * a <Diagram> is nested inside this Camera, else the union of whatever
 * CameraTargets registered, else the full viewport (nothing to bound
 * against). This is deliberately distinct from a single shot's focus
 * rect: a close-up on one node still needs to know the WHOLE diagram's
 * edges to avoid panning past them. */
export function contentBoundsFor(
  targets: Record<string, TargetRect>,
  viewport: { width: number; height: number },
): TargetRect {
  if (targets[DIAGRAM_BOUNDS_ID]) return targets[DIAGRAM_BOUNDS_ID];
  const rects = Object.values(targets);
  if (rects.length === 0) return { x: 0, y: 0, width: viewport.width, height: viewport.height };
  return unionRects(rects);
}

export function focusRectFor(
  focus: Focus,
  targets: Record<string, TargetRect>,
  containerSize: { width: number; height: number },
): TargetRect | null {
  if (focus === "all") {
    return (
      targets[DIAGRAM_BOUNDS_ID] ?? { x: 0, y: 0, width: containerSize.width, height: containerSize.height }
    );
  }
  if ("node" in focus) return targets[focus.node] ?? null;
  return targets[focus.target] ?? null;
}

/** Caps a shot's nominal zoom so its OWN focus rect (plus margin) never
 * exceeds the viewport — the fix for `focus: "all", zoom: "wide"` (or any
 * shot) overflowing when its target is bigger than the frame at the
 * nominal zoom. */
export function clampZoom(
  nominalZoom: number,
  rect: TargetRect,
  viewport: { width: number; height: number },
): number {
  const fitWidth = (viewport.width - 2 * MARGIN) / rect.width;
  const fitHeight = (viewport.height - 2 * MARGIN) / rect.height;
  return Math.min(nominalZoom, fitWidth, fitHeight);
}

/** Clamps one axis of a translation so scaled content bounds never leave
 * the viewport showing dead space past their own edge; centers instead
 * when the content is smaller than the viewport at this zoom (there's no
 * "past the edge" to guard against). */
export function clampAxis(
  naiveTranslate: number,
  contentMin: number,
  contentSize: number,
  zoom: number,
  viewportSize: number,
): number {
  const scaledContent = contentSize * zoom;
  if (scaledContent >= viewportSize) {
    const min = viewportSize - zoom * (contentMin + contentSize);
    const max = -zoom * contentMin;
    return Math.min(max, Math.max(min, naiveTranslate));
  }
  return viewportSize / 2 - zoom * (contentMin + contentSize / 2);
}

export interface ResolvedTransform {
  rect: TargetRect;
  zoom: number;
}

export function currentTransform(
  frame: number,
  shots: { shot: CameraShot; range: FrameRange; rect: TargetRect | null }[],
  viewport: { width: number; height: number },
): ResolvedTransform | null {
  let prev: ResolvedTransform | null = null;
  for (const { shot, range, rect } of shots) {
    if (!rect) continue;
    const zoom = clampZoom(ZOOM_SCALE[shot.zoom ?? "medium"], rect, viewport);
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

export interface CameraTranslation {
  tx: number;
  ty: number;
  zoom: number;
}

/** The full per-frame resolve: interpolate the shot list to this frame's
 * {rect, zoom} (already zoom-clamped per shot), center on it, then clamp
 * the resulting translation against the overall content bounds. Returns
 * numbers, not a CSS string, so every step stays independently assertable
 * in tests; Camera.tsx formats the `transform` string from this. Returns
 * null exactly when currentTransform does (no shot has a registered
 * target yet) — callers render unstyled in that case. */
export function resolveCameraTransform(
  frame: number,
  shots: { shot: CameraShot; range: FrameRange; rect: TargetRect | null }[],
  targets: Record<string, TargetRect>,
  viewport: { width: number; height: number },
): CameraTranslation | null {
  const transform = currentTransform(frame, shots, viewport);
  if (!transform) return null;

  const cx = transform.rect.x + transform.rect.width / 2;
  const cy = transform.rect.y + transform.rect.height / 2;
  const naiveTx = viewport.width / 2 - cx * transform.zoom;
  const naiveTy = viewport.height / 2 - cy * transform.zoom;

  const bounds = contentBoundsFor(targets, viewport);
  const tx = clampAxis(naiveTx, bounds.x, bounds.width, transform.zoom, viewport.width);
  const ty = clampAxis(naiveTy, bounds.y, bounds.height, transform.zoom, viewport.height);

  return { tx, ty, zoom: transform.zoom };
}
