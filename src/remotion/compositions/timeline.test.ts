import { describe, expect, it } from "vitest";
import { buildTimeline, totalFrames, TRANSITION_FRAMES } from "./timeline";

const FPS = 30;

const THREE_SCENES = [
  { id: "a", durationInSeconds: 2 }, // 60 frames
  { id: "b", durationInSeconds: 3 }, // 90
  { id: "c", durationInSeconds: 1 }, // 30
] as const;

describe("buildTimeline — cut-only (Phase 1 behaviour, must not drift)", () => {
  it("lays scenes end to end with no overlap", () => {
    const timeline = buildTimeline(THREE_SCENES, FPS);
    expect(timeline.map((e) => e.from)).toEqual([0, 60, 150]);
    expect(timeline.map((e) => e.durationInFrames)).toEqual([60, 90, 30]);
    expect(timeline.every((e) => e.overlapWithNext === 0)).toBe(true);
  });

  it("totals the plain sum", () => {
    expect(totalFrames(buildTimeline(THREE_SCENES, FPS))).toBe(180);
  });
});

describe("buildTimeline — fade overlap", () => {
  it("pulls the next scene forward by the transition length", () => {
    const timeline = buildTimeline(
      [
        { id: "a", durationInSeconds: 2, transitionToNext: "fade" as const },
        { id: "b", durationInSeconds: 3 },
      ],
      FPS,
    );
    expect(timeline[0].overlapWithNext).toBe(TRANSITION_FRAMES);
    // b starts before a ends — that shared stretch IS the crossfade.
    expect(timeline[1].from).toBe(timeline[0].from + timeline[0].durationInFrames - TRANSITION_FRAMES);
    expect(timeline[1].from).toBe(45);
  });

  it("shortens the total by exactly one overlap", () => {
    const timeline = buildTimeline(
      [
        { id: "a", durationInSeconds: 2, transitionToNext: "fade" as const },
        { id: "b", durationInSeconds: 3 },
      ],
      FPS,
    );
    expect(totalFrames(timeline)).toBe(150 - TRANSITION_FRAMES);
  });

  it("subtracts every overlap when several boundaries fade", () => {
    const timeline = buildTimeline(
      [
        { id: "a", durationInSeconds: 2, transitionToNext: "fade" as const },
        { id: "b", durationInSeconds: 3, transitionToNext: "fade" as const },
        { id: "c", durationInSeconds: 1 },
      ],
      FPS,
    );
    expect(totalFrames(timeline)).toBe(180 - 2 * TRANSITION_FRAMES);
  });

  it("honours a custom transition length", () => {
    const timeline = buildTimeline(
      [
        { id: "a", durationInSeconds: 2, transitionToNext: "fade" as const },
        { id: "b", durationInSeconds: 3 },
      ],
      FPS,
      30,
    );
    expect(totalFrames(timeline)).toBe(120);
  });
});

describe("buildTimeline — edge cases", () => {
  it("forces the last scene to 'cut' — there is nothing to transition into", () => {
    const timeline = buildTimeline(
      [
        { id: "a", durationInSeconds: 2 },
        { id: "b", durationInSeconds: 3, transitionToNext: "fade" as const },
      ],
      FPS,
    );
    expect(timeline[1].transitionToNext).toBe("cut");
    expect(timeline[1].overlapWithNext).toBe(0);
    expect(totalFrames(timeline)).toBe(150);
  });

  it("handles a single scene", () => {
    const timeline = buildTimeline([{ id: "solo", durationInSeconds: 4 }], FPS);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].from).toBe(0);
    expect(totalFrames(timeline)).toBe(120);
  });

  it("keeps an empty scene list a legal composition", () => {
    expect(buildTimeline([], FPS)).toEqual([]);
    expect(totalFrames([])).toBe(1);
  });

  it("throws when a fade is not shorter than the scene it leaves", () => {
    expect(() =>
      buildTimeline(
        [
          { id: "tiny", durationInSeconds: 0.5, transitionToNext: "fade" as const }, // 15 frames
          { id: "next", durationInSeconds: 3 },
        ],
        FPS,
      ),
    ).toThrow(/"tiny" → "next"/);
  });

  it("throws when a fade is not shorter than the scene it enters", () => {
    expect(() =>
      buildTimeline(
        [
          { id: "prev", durationInSeconds: 3, transitionToNext: "fade" as const },
          { id: "tiny", durationInSeconds: 0.5 },
        ],
        FPS,
      ),
    ).toThrow(/must be shorter than both scenes/);
  });

  it("is deterministic", () => {
    expect(buildTimeline(THREE_SCENES, FPS)).toEqual(buildTimeline(THREE_SCENES, FPS));
  });
});
