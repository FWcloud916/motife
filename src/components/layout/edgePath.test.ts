import { describe, expect, it } from "vitest";
import { buildRoundedPath } from "./edgePath";

function assertFinite(d: string) {
  const numbers = d.match(/-?\d+(\.\d+)?/g) ?? [];
  expect(numbers.length).toBeGreaterThan(0);
  for (const n of numbers) {
    expect(Number.isFinite(Number(n))).toBe(true);
  }
}

describe("buildRoundedPath", () => {
  it("returns an empty string for no points", () => {
    expect(buildRoundedPath([])).toBe("");
  });

  it("returns a single move command for one point", () => {
    expect(buildRoundedPath([{ x: 5, y: 5 }])).toBe("M 5 5");
  });

  it("returns a straight line for two points", () => {
    expect(buildRoundedPath([{ x: 0, y: 0 }, { x: 10, y: 10 }])).toBe("M 0 0 L 10 10");
  });

  it("produces a finite, well-formed path through a bent route", () => {
    const d = buildRoundedPath([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
    ]);
    expect(d.startsWith("M 0 0")).toBe(true);
    expect(d).toContain("Q");
    assertFinite(d);
  });

  it("does not produce NaN when consecutive points are collinear", () => {
    const d = buildRoundedPath([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
    ]);
    assertFinite(d);
  });

  it("does not produce NaN when a point is duplicated", () => {
    const d = buildRoundedPath([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
    ]);
    assertFinite(d);
  });

  it("clamps the corner radius so it never overshoots a short segment", () => {
    const d = buildRoundedPath([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
    ], 100);
    assertFinite(d);
  });
});
