import { describe, expect, it } from "vitest";
import { parseDocument } from "../compiler";
import { backfillDurations } from "./backfill";
import type { AudioManifest } from "./manifest";

const RAW_DOC = {
  version: 1,
  id: "BackfillDoc",
  title: "Backfill",
  scenes: [
    {
      id: "intro",
      beat: "intro",
      durationInSeconds: 2,
      narration: "A short introduction.",
      content: { type: "text", role: "hero", content: "Hi", align: "center" },
    },
    {
      id: "breakdown",
      beat: "breakdown",
      durationInSeconds: 2,
      narration: "Nothing to see yet.",
      content: { type: "pill", text: "breakdown" },
    },
    {
      id: "walkthrough",
      beat: "walkthrough",
      durationInSeconds: 2,
      narration: "Nothing to see yet.",
      content: { type: "pill", text: "walkthrough" },
    },
    {
      id: "summary",
      beat: "summary",
      durationInSeconds: 2,
      narration: "A short summary text.",
      content: { type: "pill", text: "summary" },
    },
  ],
};

function manifestFor(durations: Record<string, number>): AudioManifest {
  return {
    scenes: Object.fromEntries(
      Object.entries(durations).map(([id, durationInSeconds]) => [
        id,
        {
          src: `audio/${id}.mp3`,
          durationInSeconds,
          narrationHash: `hash-${id}`,
          delaySeconds: 0.3,
        },
      ]),
    ),
  };
}

describe("backfillDurations", () => {
  it("replaces every scene duration with lead + audio + tail", () => {
    const manifest = manifestFor({ intro: 3.21, breakdown: 5, walkthrough: 8.555, summary: 2.4 });
    const result = backfillDurations(RAW_DOC, manifest) as typeof RAW_DOC;

    expect(result.scenes.map((scene) => scene.durationInSeconds)).toEqual([
      4.21, // 0.3 + 3.21 + 0.7
      6, // 0.3 + 5 + 0.7
      9.56, // 0.3 + 8.555 + 0.7 → 9.555 rounds to 9.56 (2 decimals)
      3.4, // 0.3 + 2.4 + 0.7
    ]);
    // Untouched fields survive the clone.
    expect(result.scenes[0].narration).toBe("A short introduction.");
    expect(result.id).toBe("BackfillDoc");
  });

  it("does not mutate the input document", () => {
    const manifest = manifestFor({ intro: 3, breakdown: 3, walkthrough: 3, summary: 3 });
    backfillDurations(RAW_DOC, manifest);
    expect(RAW_DOC.scenes[0].durationInSeconds).toBe(2);
  });

  it("honors custom lead/tail", () => {
    const manifest = manifestFor({ intro: 1, breakdown: 1, walkthrough: 1, summary: 1 });
    const result = backfillDurations(RAW_DOC, manifest, {
      leadSeconds: 0,
      tailSeconds: 0,
    }) as typeof RAW_DOC;
    expect(result.scenes[0].durationInSeconds).toBe(1);
  });

  it("throws when a scene has no manifest entry", () => {
    const manifest = manifestFor({ intro: 3 });
    expect(() => backfillDurations(RAW_DOC, manifest)).toThrow(/no entry for scene "breakdown"/);
  });

  it("produces output that still passes parseDocument", () => {
    const manifest = manifestFor({ intro: 4, breakdown: 4, walkthrough: 4, summary: 4 });
    const result = parseDocument(backfillDurations(RAW_DOC, manifest));
    expect(result.ok).toBe(true);
  });
});
