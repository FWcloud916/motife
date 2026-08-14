import { describe, expect, it } from "vitest";
import { parseDocumentOrThrow } from "../../compiler";
import { dslTimeline, dslTotalFrames } from "../../compiler/timeline";
import { RAW_DOCS } from "./manifest";

// Pins each baseline document's frame count and scene offsets — the DSL
// generalisation of the now-deleted storyboard.test.ts's old
// single-composition pin. JwtAuthFlow keeps the exact numbers the Phase 0/1
// hand-written baseline had (1200 frames, offsets [0, 180, 480, 1020]): its
// durationInSeconds are unchanged (6/10/18/6) and every transition is still
// "cut", so the timeline math resolves identically — this pin is what
// proves the DSL port never drifted the baseline's timing, from Stage 4's
// A/B all the way through the Stage 7 cutover.
const FRAME_PINS: Record<string, { total: number; from: number[] }> = {
  JwtAuthFlow: { total: 1200, from: [0, 180, 480, 1020] },
  // 7 + 11 + 16 + 6 = 40s @ 30fps, all cuts.
  MqBackpressure: { total: 1200, from: [0, 210, 540, 1020] },
  // 7 + 12 + 16 + 7 = 42s @ 30fps, all cuts.
  DbIndexInternals: { total: 1260, from: [0, 210, 570, 1050] },
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

  it("every doc has a FRAME_PINS entry, and the pin table has no orphans", () => {
    // Beat ordering itself is enforced per-document by validateDocument
    // (run inside parseDocumentOrThrow above); what THIS test pins is the
    // manifest<->pin-table correspondence, so a doc silently dropped from
    // RAW_DOCS without updating FRAME_PINS fails loudly here instead.
    for (const doc of docs) {
      expect(FRAME_PINS[doc.id], `no FRAME_PINS entry for doc id "${doc.id}"`).toBeDefined();
    }
    expect(docs.length).toBe(Object.keys(FRAME_PINS).length);
  });

  it.each(docs.map((doc) => [doc.id, doc] as const))("%s: frame count and scene offsets are pinned", (id, doc) => {
    const pin = FRAME_PINS[id];
    // Re-asserted here (not just in the coverage test above) so a missing
    // pin fails this parameterized case with a named message instead of a
    // bare TypeError on `pin.total` — test order isn't a safety guarantee.
    expect(pin, `no FRAME_PINS entry for doc id "${id}"`).toBeDefined();
    const timeline = dslTimeline(doc);
    expect(dslTotalFrames(doc)).toBe(pin.total);
    expect(timeline.map((entry) => entry.from)).toEqual(pin.from);
  });
});
