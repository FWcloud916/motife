import { describe, expect, it } from "vitest";
import { resolveSteps, resolveWindow, stepStateAtFrame, stepWindows } from "./timing";
import type { StepFrameRange, WeightedStep } from "./timing";
import type { Window } from "../tokens";

describe("resolveWindow", () => {
  it("maps fractional bounds onto absolute frames", () => {
    expect(resolveWindow({ from: 0.25, to: 0.75 }, 100)).toEqual({
      startFrame: 25,
      endFrame: 75,
    });
  });

  it("is deterministic across repeated calls", () => {
    const a = resolveWindow({ from: 0.1, to: 0.9 }, 240);
    const b = resolveWindow({ from: 0.1, to: 0.9 }, 240);
    expect(a).toEqual(b);
  });
});

describe("resolveSteps", () => {
  it("splits a window evenly when steps carry no explicit weight", () => {
    const ranges = resolveSteps([{}, {}, {}], { from: 0, to: 1 }, 90);
    expect(ranges).toEqual([
      { startFrame: 0, endFrame: 30, outcome: undefined },
      { startFrame: 30, endFrame: 60, outcome: undefined },
      { startFrame: 60, endFrame: 90, outcome: undefined },
    ]);
  });

  it("splits proportionally to weight", () => {
    const ranges = resolveSteps(
      [{ weight: 1 }, { weight: 2 }, { weight: 1 }],
      { from: 0, to: 1 },
      80,
    );
    expect(ranges).toEqual([
      { startFrame: 0, endFrame: 20, outcome: undefined },
      { startFrame: 20, endFrame: 60, outcome: undefined },
      { startFrame: 60, endFrame: 80, outcome: undefined },
    ]);
  });

  it("re-times automatically when durationInFrames changes — no per-step edits", () => {
    const steps = [{ weight: 1 }, { weight: 1 }];
    const short = resolveSteps(steps, { from: 0, to: 1 }, 60);
    const long = resolveSteps(steps, { from: 0, to: 1 }, 600);
    expect(short).toEqual([
      { startFrame: 0, endFrame: 30, outcome: undefined },
      { startFrame: 30, endFrame: 60, outcome: undefined },
    ]);
    expect(long).toEqual([
      { startFrame: 0, endFrame: 300, outcome: undefined },
      { startFrame: 300, endFrame: 600, outcome: undefined },
    ]);
  });

  it("returns an empty array for an empty step list", () => {
    expect(resolveSteps([], { from: 0, to: 1 }, 100)).toEqual([]);
  });

  it("does not divide by zero when every weight is zero", () => {
    const ranges = resolveSteps([{ weight: 0 }, { weight: 0 }], { from: 0, to: 1 }, 100);
    expect(ranges.every((r) => Number.isFinite(r.startFrame) && Number.isFinite(r.endFrame))).toBe(
      true,
    );
  });

  it("carries each step's outcome onto its range", () => {
    const ranges = resolveSteps(
      [{ outcome: "pass" }, { outcome: "fail" }],
      { from: 0, to: 1 },
      100,
    );
    expect(ranges.map((r) => r.outcome)).toEqual(["pass", "fail"]);
  });
});

describe("stepWindows", () => {
  it("agrees with resolveSteps at several durations — the duration-independent counterpart", () => {
    const steps: WeightedStep[] = [{ weight: 1 }, { weight: 2 }, { weight: 1 }];
    const window: Window = { from: 0.1, to: 0.9 };

    for (const durationInFrames of [30, 90, 600, 1200]) {
      const fromResolveSteps = resolveSteps(steps, window, durationInFrames).map((range) => ({
        from: range.startFrame / durationInFrames,
        to: range.endFrame / durationInFrames,
      }));
      const fromStepWindows = stepWindows(steps, window);
      fromStepWindows.forEach((w, index) => {
        expect(w.from).toBeCloseTo(fromResolveSteps[index].from, 10);
        expect(w.to).toBeCloseTo(fromResolveSteps[index].to, 10);
      });
    }
  });

  it("splits a window evenly when steps carry no explicit weight", () => {
    const windows = stepWindows([{}, {}, {}], { from: 0, to: 1 });
    expect(windows).toEqual([
      { from: 0, to: 1 / 3 },
      { from: 1 / 3, to: 2 / 3 },
      { from: 2 / 3, to: 1 },
    ]);
  });

  it("splits proportionally to weight, within the given window", () => {
    const windows = stepWindows([{ weight: 1 }, { weight: 3 }], { from: 0.2, to: 0.6 });
    expect(windows).toEqual([
      { from: 0.2, to: 0.3 },
      { from: 0.3, to: 0.6 },
    ]);
  });

  it("returns an empty array for an empty step list", () => {
    expect(stepWindows([], { from: 0, to: 1 })).toEqual([]);
  });

  it("does not divide by zero when every weight is zero", () => {
    const windows = stepWindows([{ weight: 0 }, { weight: 0 }], { from: 0, to: 1 });
    expect(windows.every((w) => Number.isFinite(w.from) && Number.isFinite(w.to))).toBe(true);
  });
});

describe("stepStateAtFrame", () => {
  const range: StepFrameRange = { startFrame: 10, endFrame: 20 };

  it("is pending before the range starts", () => {
    expect(stepStateAtFrame(0, range)).toBe("pending");
    expect(stepStateAtFrame(9, range)).toBe("pending");
  });

  it("is active for the half-open interval [start, end)", () => {
    expect(stepStateAtFrame(10, range)).toBe("active");
    expect(stepStateAtFrame(19, range)).toBe("active");
  });

  it("settles to passed once the range ends, defaulting outcome to pass", () => {
    expect(stepStateAtFrame(20, range)).toBe("passed");
    expect(stepStateAtFrame(999, range)).toBe("passed");
  });

  it("settles to failed when outcome is 'fail'", () => {
    const failing: StepFrameRange = { ...range, outcome: "fail" };
    expect(stepStateAtFrame(20, failing)).toBe("failed");
  });
});
