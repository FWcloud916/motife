import { describe, expect, it } from "vitest";
import { DIAGRAM_BOUNDS_ID } from "./CameraRegistryContext";
import type { TargetRect } from "./CameraRegistryContext";
import {
  clampAxis,
  clampZoom,
  contentBoundsFor,
  currentTransform,
  focusRectFor,
  lerp,
  lerpRect,
  resolveCameraTransform,
  unionRects,
  ZOOM_SCALE,
} from "./cameraMath";

const VIEWPORT = { width: 1920, height: 1080 };
// (1920 - 2*64, 1080 - 2*64) — the margin-shrunk box a clamped zoom fits into.
const MARGIN = 64;

describe("lerp / lerpRect", () => {
  it("interpolates a scalar", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it("interpolates every field of a rect independently", () => {
    const a: TargetRect = { x: 0, y: 0, width: 100, height: 100 };
    const b: TargetRect = { x: 100, y: 200, width: 300, height: 400 };
    expect(lerpRect(a, b, 0.5)).toEqual({ x: 50, y: 100, width: 200, height: 250 });
  });
});

describe("unionRects", () => {
  it("bounds a single rect exactly", () => {
    const r: TargetRect = { x: 10, y: 20, width: 30, height: 40 };
    expect(unionRects([r])).toEqual(r);
  });

  it("bounds the outer extent of several disjoint rects", () => {
    const rects: TargetRect[] = [
      { x: 0, y: 0, width: 100, height: 50 },
      { x: 500, y: 300, width: 100, height: 50 },
    ];
    expect(unionRects(rects)).toEqual({ x: 0, y: 0, width: 600, height: 350 });
  });
});

describe("contentBoundsFor", () => {
  it("prefers the registered diagram bounds when present", () => {
    const diagramBounds: TargetRect = { x: 0, y: 0, width: 3000, height: 800 };
    const targets = { [DIAGRAM_BOUNDS_ID]: diagramBounds, someNode: { x: 10, y: 10, width: 5, height: 5 } };
    expect(contentBoundsFor(targets, VIEWPORT)).toEqual(diagramBounds);
  });

  it("unions plain CameraTargets when there is no nested Diagram", () => {
    const targets = {
      a: { x: 0, y: 0, width: 100, height: 100 },
      b: { x: 400, y: 0, width: 100, height: 100 },
    };
    expect(contentBoundsFor(targets, VIEWPORT)).toEqual({ x: 0, y: 0, width: 500, height: 100 });
  });

  it("falls back to the full viewport when nothing is registered", () => {
    expect(contentBoundsFor({}, VIEWPORT)).toEqual({ x: 0, y: 0, ...VIEWPORT });
  });
});

describe("focusRectFor", () => {
  const targets = {
    [DIAGRAM_BOUNDS_ID]: { x: 0, y: 0, width: 2000, height: 900 },
    myNode: { x: 100, y: 100, width: 50, height: 50 },
  };

  it("resolves 'all' to the registered diagram bounds", () => {
    expect(focusRectFor("all", targets, VIEWPORT)).toEqual(targets[DIAGRAM_BOUNDS_ID]);
  });

  it("falls back to the full container for 'all' with no nested Diagram", () => {
    expect(focusRectFor("all", {}, VIEWPORT)).toEqual({ x: 0, y: 0, ...VIEWPORT });
  });

  it("looks up a node focus by id", () => {
    expect(focusRectFor({ node: "myNode" }, targets, VIEWPORT)).toEqual(targets.myNode);
  });

  it("looks up a target focus by id", () => {
    expect(focusRectFor({ target: "myNode" }, targets, VIEWPORT)).toEqual(targets.myNode);
  });

  it("returns null for an id that hasn't registered yet", () => {
    expect(focusRectFor({ node: "missing" }, targets, VIEWPORT)).toBeNull();
  });
});

describe("clampZoom", () => {
  it("leaves the nominal zoom untouched when the focus rect comfortably fits", () => {
    const rect: TargetRect = { x: 0, y: 0, width: 400, height: 300 };
    expect(clampZoom(ZOOM_SCALE.close, rect, VIEWPORT)).toBe(ZOOM_SCALE.close);
  });

  it("caps zoom so an oversized focus rect (plus margin) still fits the viewport", () => {
    // The db-index failure mode: focus:"all", zoom:"wide" over a diagram
    // wider than the frame — zoom 1 (wide's nominal) would overflow.
    const rect: TargetRect = { x: 0, y: 0, width: 3000, height: 800 };
    const clamped = clampZoom(ZOOM_SCALE.wide, rect, VIEWPORT);
    expect(clamped).toBeLessThan(ZOOM_SCALE.wide);
    expect(clamped).toBeCloseTo((VIEWPORT.width - 2 * MARGIN) / 3000);
    // The clamped rect, scaled, now fits inside the margin-shrunk viewport.
    expect(rect.width * clamped).toBeLessThanOrEqual(VIEWPORT.width - 2 * MARGIN + 1e-9);
  });

  it("is bound by whichever axis is tighter", () => {
    // Wide and short: width is the binding constraint.
    const wideRect: TargetRect = { x: 0, y: 0, width: 4000, height: 100 };
    expect(clampZoom(10, wideRect, VIEWPORT)).toBeCloseTo((VIEWPORT.width - 2 * MARGIN) / 4000);
    // Narrow and tall: height is the binding constraint.
    const tallRect: TargetRect = { x: 0, y: 0, width: 100, height: 3000 };
    expect(clampZoom(10, tallRect, VIEWPORT)).toBeCloseTo((VIEWPORT.height - 2 * MARGIN) / 3000);
  });
});

describe("clampAxis", () => {
  it("passes a naive translation through unchanged when it's already in range", () => {
    // content [0, 3000] at zoom 0.7 (2100px) is wider than the 1920 viewport
    // -> valid range is [1920 - 0.7*3000, 0] = [-180, 0].
    expect(clampAxis(-90, 0, 3000, 0.7, 1920)).toBe(-90);
  });

  it("clamps a translation that would push content's far edge into dead space", () => {
    expect(clampAxis(-1000, 0, 3000, 0.7, 1920)).toBe(1920 - 0.7 * 3000);
  });

  it("clamps a translation that would push content's near edge into dead space", () => {
    // The clamp bound here is -zoom*contentMin === -0.7*0, which is -0 in
    // JS float math — mathematically 0, so toBeCloseTo (not toBe) is the
    // correct comparison.
    expect(clampAxis(50, 0, 3000, 0.7, 1920)).toBeCloseTo(0);
  });

  it("centers content that's smaller than the viewport at this zoom, ignoring the naive input", () => {
    const centered = 1920 / 2 - 1 * (100 + 200 / 2);
    expect(clampAxis(999_999, 100, 200, 1, 1920)).toBe(centered);
    expect(clampAxis(-999_999, 100, 200, 1, 1920)).toBe(centered);
  });
});

describe("currentTransform", () => {
  const rectA: TargetRect = { x: 0, y: 0, width: 100, height: 100 };
  const rectB: TargetRect = { x: 800, y: 0, width: 100, height: 100 };

  it("holds the previous shot's resolved position until the next shot's window starts", () => {
    const shots = [
      {
        shot: { window: { from: 0, to: 0 }, focus: { target: "a" } as const, zoom: "medium" as const },
        range: { startFrame: 0, endFrame: 0 },
        rect: rectA,
      },
      {
        shot: { window: { from: 0, to: 1 }, focus: { target: "b" } as const, zoom: "close" as const },
        range: { startFrame: 10, endFrame: 20 },
        rect: rectB,
      },
    ];
    const result = currentTransform(5, shots, VIEWPORT);
    expect(result).toEqual({ rect: rectA, zoom: ZOOM_SCALE.medium });
  });

  it("is continuous at the interpolation window's exact endpoints (easing anchors 0 and 1)", () => {
    const shots = [
      {
        shot: { window: { from: 0, to: 0 }, focus: { target: "a" } as const, zoom: "medium" as const },
        range: { startFrame: 0, endFrame: 0 },
        rect: rectA,
      },
      {
        shot: { window: { from: 0, to: 1 }, focus: { target: "b" } as const, zoom: "close" as const },
        range: { startFrame: 10, endFrame: 20 },
        rect: rectB,
      },
    ];
    expect(currentTransform(10, shots, VIEWPORT)).toEqual({ rect: rectA, zoom: ZOOM_SCALE.medium });
    expect(currentTransform(20, shots, VIEWPORT)).toEqual({ rect: rectB, zoom: ZOOM_SCALE.close });
  });

  it("holds the last shot's resolved position after all windows have passed", () => {
    const shots = [
      {
        shot: { window: { from: 0, to: 1 }, focus: { target: "a" } as const, zoom: "medium" as const },
        range: { startFrame: 0, endFrame: 10 },
        rect: rectA,
      },
    ];
    expect(currentTransform(999, shots, VIEWPORT)).toEqual({ rect: rectA, zoom: ZOOM_SCALE.medium });
  });

  it("skips shots whose focus target hasn't registered yet", () => {
    const shots = [
      {
        shot: { window: { from: 0, to: 0 }, focus: { target: "missing" } as const, zoom: "medium" as const },
        range: { startFrame: 0, endFrame: 0 },
        rect: null,
      },
      {
        shot: { window: { from: 0, to: 0 }, focus: { target: "b" } as const, zoom: "close" as const },
        range: { startFrame: 5, endFrame: 5 },
        rect: rectB,
      },
    ];
    expect(currentTransform(0, shots, VIEWPORT)).toEqual({ rect: rectB, zoom: ZOOM_SCALE.close });
  });

  it("clamps each shot's zoom to its OWN focus rect, not the other shots'", () => {
    const oversized: TargetRect = { x: 0, y: 0, width: 3000, height: 800 };
    const shots = [
      {
        shot: { window: { from: 0, to: 1 }, focus: "all" as const, zoom: "wide" as const },
        range: { startFrame: 0, endFrame: 1 },
        rect: oversized,
      },
    ];
    const result = currentTransform(0, shots, VIEWPORT);
    expect(result?.zoom).toBeLessThan(ZOOM_SCALE.wide);
    expect(result?.zoom).toBeCloseTo(clampZoom(ZOOM_SCALE.wide, oversized, VIEWPORT));
  });
});

describe("resolveCameraTransform (integration — the two Phase 4 fixes together)", () => {
  it("never overflows a focus:'all', zoom:'wide' shot over a diagram wider than the frame", () => {
    const bounds: TargetRect = { x: 0, y: 0, width: 3000, height: 800 };
    const targets = { [DIAGRAM_BOUNDS_ID]: bounds };
    const shots = [
      {
        shot: { window: { from: 0, to: 1 }, focus: "all" as const, zoom: "wide" as const },
        range: { startFrame: 0, endFrame: 1 },
        rect: focusRectFor("all", targets, VIEWPORT),
      },
    ];

    const result = resolveCameraTransform(0, shots, targets, VIEWPORT);
    expect(result).not.toBeNull();
    const { tx, zoom } = result!;

    // Zoom shrank below the nominal "wide" 1x so the whole diagram fits.
    expect(zoom).toBeLessThan(ZOOM_SCALE.wide);
    // The diagram's rendered span is within the viewport on both edges —
    // no dead background past either side.
    expect(tx + zoom * bounds.x).toBeGreaterThanOrEqual(0);
    expect(tx + zoom * (bounds.x + bounds.width)).toBeLessThanOrEqual(VIEWPORT.width);
  });

  it("keeps a diagram's far edge in frame when a close-up shot's naive centering would pan past it", () => {
    // A diagram 2400 wide with a node hugging its right edge — centering
    // on the node at 2x would want to pan the diagram's edge to x=1060,
    // leaving ~860px of dead background on the right (the bug this fixes).
    const bounds: TargetRect = { x: 0, y: 0, width: 2400, height: 800 };
    const nodeNearEdge: TargetRect = { x: 2300, y: 350, width: 100, height: 100 };
    const targets = { [DIAGRAM_BOUNDS_ID]: bounds, edgeNode: nodeNearEdge };
    const shots = [
      {
        shot: { window: { from: 0, to: 1 }, focus: { node: "edgeNode" } as const, zoom: "close" as const },
        range: { startFrame: 0, endFrame: 1 },
        rect: nodeNearEdge,
      },
    ];

    const result = resolveCameraTransform(0, shots, targets, VIEWPORT);
    expect(result).not.toBeNull();
    const { tx, ty, zoom } = result!;

    expect(zoom).toBe(ZOOM_SCALE.close); // the node itself is small — no zoom clamp needed
    // Naive centering on the node would want tx = 960 - 2*2350 = -3740,
    // which puts the diagram's right edge at screen x = -3740 + 2*2400 =
    // 1060 — ~860px of dead background short of the 1920 frame edge. The
    // clamp holds tx back at -2880 instead, landing the edge exactly at
    // the viewport's right edge with no dead space beyond it.
    expect(tx).toBeCloseTo(-2880);
    expect(tx + zoom * (bounds.x + bounds.width)).toBeCloseTo(VIEWPORT.width);
    // y (800-tall diagram at 2x = 1600 vs. 1080 viewport) is ALSO over the
    // clamp threshold, but the naive -260 already sits inside the valid
    // [-520, 0] range, so it passes through unclamped — the node stays
    // vertically centered exactly as the naive centering intended.
    expect(ty).toBeCloseTo(-260);
  });

  it("returns null when no shot has a registered focus target", () => {
    const shots = [
      {
        shot: { window: { from: 0, to: 0 }, focus: { node: "missing" } as const, zoom: "medium" as const },
        range: { startFrame: 0, endFrame: 0 },
        rect: null,
      },
    ];
    expect(resolveCameraTransform(0, shots, {}, VIEWPORT)).toBeNull();
  });
});
