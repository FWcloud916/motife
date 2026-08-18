import { describe, expect, it } from "vitest";
import { CAPTION_CLEARANCE, CONTENT_EDGE_PAD, HEADER_CLEARANCE, computeSafeArea } from "./safeArea";

const DOC = { width: 1920, height: 1080 };

describe("computeSafeArea", () => {
  it("header + caption (breakdown/walkthrough scenes)", () => {
    expect(computeSafeArea({ ...DOC, hasHeader: true, hasCaption: true })).toEqual({
      width: 1728,
      height: 720,
    });
  });

  it("caption only, no header (intro scenes)", () => {
    expect(computeSafeArea({ ...DOC, hasHeader: false, hasCaption: true })).toEqual({
      width: 1728,
      height: 834,
    });
  });

  it("header only, no caption (summary scenes with caption: null)", () => {
    expect(computeSafeArea({ ...DOC, hasHeader: true, hasCaption: false })).toEqual({
      width: 1728,
      height: 774,
    });
  });

  it("neither header nor caption — every edge gets the plain content pad", () => {
    expect(computeSafeArea({ ...DOC, hasHeader: false, hasCaption: false })).toEqual({
      width: 1728,
      height: 888,
    });
  });

  it("scales with the document's own width/height, not a hardcoded 1920x1080", () => {
    expect(computeSafeArea({ width: 1280, height: 720, hasHeader: true, hasCaption: true })).toEqual({
      width: 1280 - 2 * CONTENT_EDGE_PAD,
      height: 720 - HEADER_CLEARANCE - CAPTION_CLEARANCE,
    });
  });
});
