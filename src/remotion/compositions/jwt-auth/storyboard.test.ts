import { describe, expect, it } from "vitest";
import { SCENES, TIMELINE, TOTAL_FRAMES } from "./storyboard";

// The eval-set regression pin (motife-plan.md §4). This composition is the
// quality baseline every later phase is compared against, so its length
// must not move silently — a transition accidentally switched on here
// would shorten it, and this test is what says so out loud.
describe("JWT storyboard", () => {
  it("is 1200 frames (40s at 30fps)", () => {
    expect(TOTAL_FRAMES).toBe(1200);
  });

  it("uses hard cuts at every boundary", () => {
    expect(TIMELINE.every((entry) => entry.transitionToNext === "cut")).toBe(true);
    expect(TIMELINE.every((entry) => entry.overlapWithNext === 0)).toBe(true);
  });

  it("lays scenes end to end", () => {
    expect(TIMELINE.map((entry) => entry.from)).toEqual([0, 180, 480, 1020]);
  });

  it("has a component registered for every scene", () => {
    expect(TIMELINE.map((entry) => entry.id)).toEqual(SCENES.map((scene) => scene.id));
  });
});
