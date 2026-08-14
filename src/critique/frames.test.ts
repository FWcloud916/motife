import { describe, expect, it } from "vitest";
import { dslTimeline, parseDocumentOrThrow } from "../compiler";
import { RAW_DOCS } from "../dsl/docs/manifest";
import { critiqueFrames } from "./frames";

const JWT_DOC = parseDocumentOrThrow(RAW_DOCS[0]);

describe("critiqueFrames", () => {
  it("samples three distinct, in-bounds frames per scene of a real doc", () => {
    const frames = critiqueFrames(JWT_DOC);
    const timeline = dslTimeline(JWT_DOC);

    expect(frames).toHaveLength(timeline.length * 3);

    for (const entry of timeline) {
      const sceneFrames = frames.filter((frame) => frame.sceneId === entry.id);
      expect(sceneFrames.map((frame) => frame.label)).toEqual(["early", "mid", "late"]);

      const [early, mid, late] = sceneFrames.map((frame) => frame.frame);
      expect(early).toBeGreaterThanOrEqual(entry.from);
      expect(late).toBeLessThanOrEqual(entry.from + entry.durationInFrames - 1);
      expect(early).toBeLessThan(mid);
      expect(mid).toBeLessThan(late);
    }
  });

  it("is deterministic", () => {
    expect(critiqueFrames(JWT_DOC)).toEqual(critiqueFrames(JWT_DOC));
  });

  it("collapses duplicate frames on very short scenes instead of repeating them", () => {
    const doc = parseDocumentOrThrow({
      version: 1,
      id: "ShortScenes",
      title: "Short",
      scenes: [
        {
          id: "intro",
          beat: "intro",
          durationInSeconds: 0.1, // 3 frames at 30fps
          narration: "x",
          content: { type: "pill", text: "a" },
        },
        {
          id: "breakdown",
          beat: "breakdown",
          durationInSeconds: 2,
          narration: "Nothing to see yet.",
          content: { type: "pill", text: "b" },
        },
        {
          id: "walkthrough",
          beat: "walkthrough",
          durationInSeconds: 2,
          narration: "Nothing to see yet.",
          content: { type: "pill", text: "c" },
        },
        {
          id: "summary",
          beat: "summary",
          durationInSeconds: 2,
          narration: "A short summary.",
          content: { type: "pill", text: "d" },
        },
      ],
    });

    const frames = critiqueFrames(doc);
    const introFrames = frames.filter((frame) => frame.sceneId === "intro");
    const unique = new Set(introFrames.map((frame) => frame.frame));
    expect(unique.size).toBe(introFrames.length);
  });
});
