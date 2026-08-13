import { describe, expect, it } from "vitest";
import { parseDocumentOrThrow } from "../../compiler";
import { dslTimeline, dslTotalFrames } from "../../compiler/timeline";
import { RAW_DOCS } from "./manifest";

// Pins each baseline document's frame count and scene offsets — the DSL
// generalisation of storyboard.test.ts's old single-composition pin.
// JwtAuthFlowDsl keeps the exact numbers the Phase 0/1 baseline had
// (1200 frames, offsets [0, 180, 480, 1020]): its durationInSeconds are
// unchanged (6/10/18/6) and every transition is still "cut", so the
// timeline math resolves identically — this pin is what proves the DSL
// port didn't silently drift the baseline's timing.
const FRAME_PINS: Record<string, { total: number; from: number[] }> = {
  JwtAuthFlowDsl: { total: 1200, from: [0, 180, 480, 1020] },
};

describe("RAW_DOCS", () => {
  const docs = RAW_DOCS.map((raw) => parseDocumentOrThrow(raw));

  it("every raw doc parses (structurally and semantically valid)", () => {
    expect(docs.length).toBe(RAW_DOCS.length);
  });

  it("every doc id is unique across the manifest", () => {
    const ids = docs.map((doc) => doc.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every doc's beats are in intro -> breakdown -> walkthrough -> summary order", () => {
    // validateDocument (run inside parseDocumentOrThrow above) already
    // enforces this per-document; this test asserts the manifest actually
    // contains the pin table's entries, so a doc silently dropped from
    // RAW_DOCS without updating FRAME_PINS fails loudly here instead.
    for (const doc of docs) {
      expect(FRAME_PINS[doc.id], `no FRAME_PINS entry for doc id "${doc.id}"`).toBeDefined();
    }
    expect(docs.length).toBe(Object.keys(FRAME_PINS).length);
  });

  it.each(docs.map((doc) => [doc.id, doc] as const))("%s: frame count and scene offsets are pinned", (id, doc) => {
    const pin = FRAME_PINS[id];
    const timeline = dslTimeline(doc);
    expect(dslTotalFrames(doc)).toBe(pin.total);
    expect(timeline.map((entry) => entry.from)).toEqual(pin.from);
  });
});
