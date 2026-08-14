import { describe, expect, it } from "vitest";
import type { Track } from "../dsl";
import {
  StepIndexOutOfRangeError,
  UnknownTrackError,
  resolveWindowRef,
  trackMapFrom,
} from "./windows";

const CHECKS: Track = {
  id: "checks",
  window: { from: 0.05, to: 0.98 },
  items: [{ title: "a" }, { title: "b" }, { title: "c" }, { title: "d", weight: 0.6 }],
};

const CLAIMS: Track = {
  id: "claims",
  // Nested: windowed to one step of an earlier track — the Walkthrough
  // "claims" shape from the plan's worked example.
  window: { track: "checks", step: 2 },
  items: [{ title: "exp" }, { title: "iss" }, { title: "aud" }],
};

describe("resolveWindowRef", () => {
  it("resolves an absolute WindowRef as-is", () => {
    expect(resolveWindowRef({ from: 0.1, to: 0.9 }, new Map())).toEqual({ from: 0.1, to: 0.9 });
  });

  it("resolves a {track, step} ref against the track's own window", () => {
    const tracks = trackMapFrom([CHECKS]);
    const w0 = resolveWindowRef({ track: "checks", step: 0 }, tracks);
    const w3 = resolveWindowRef({ track: "checks", step: 3 }, tracks);
    expect(w0.from).toBeCloseTo(0.05, 10);
    expect(w3.to).toBeCloseTo(0.98, 10);
    // Monotonic: later steps start no earlier than prior steps end.
    expect(w3.from).toBeGreaterThan(w0.to);
  });

  it("resolves a {track, steps} range ref spanning from the first step's start to the last step's end", () => {
    const tracks = trackMapFrom([CHECKS]);
    const single = resolveWindowRef({ track: "checks", step: 1 }, tracks);
    const range = resolveWindowRef({ track: "checks", steps: [1, 2] }, tracks);
    const step2 = resolveWindowRef({ track: "checks", step: 2 }, tracks);
    expect(range.from).toBeCloseTo(single.from, 10);
    expect(range.to).toBeCloseTo(step2.to, 10);
  });

  it("resolves a nested track (window pointing at another track's step)", () => {
    const tracks = trackMapFrom([CHECKS, CLAIMS]);
    const claimsWindow = resolveWindowRef({ track: "claims", step: 0 }, tracks);
    const checksStep2 = resolveWindowRef({ track: "checks", step: 2 }, tracks);
    // "claims" is windowed to checks' step 2, so every claims step falls
    // strictly within checks step 2's span.
    expect(claimsWindow.from).toBeGreaterThanOrEqual(checksStep2.from);
    expect(claimsWindow.to).toBeLessThanOrEqual(checksStep2.to);
  });

  it("throws UnknownTrackError for an undeclared track id", () => {
    expect(() => resolveWindowRef({ track: "nope", step: 0 }, new Map())).toThrow(UnknownTrackError);
  });

  it("throws StepIndexOutOfRangeError for a step index past the track's item count", () => {
    const tracks = trackMapFrom([CHECKS]);
    expect(() => resolveWindowRef({ track: "checks", step: 4 }, tracks)).toThrow(
      StepIndexOutOfRangeError,
    );
  });

  it("throws StepIndexOutOfRangeError for an out-of-range steps() endpoint", () => {
    const tracks = trackMapFrom([CHECKS]);
    expect(() => resolveWindowRef({ track: "checks", steps: [0, 9] }, tracks)).toThrow(
      StepIndexOutOfRangeError,
    );
  });
});

describe("trackMapFrom", () => {
  it("returns an empty map for undefined tracks", () => {
    expect(trackMapFrom(undefined).size).toBe(0);
  });

  it("preserves declaration order (Map iteration order)", () => {
    const tracks = trackMapFrom([CHECKS, CLAIMS]);
    expect([...tracks.keys()]).toEqual(["checks", "claims"]);
  });
});
