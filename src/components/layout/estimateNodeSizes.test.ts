import { describe, expect, it } from "vitest";
import {
  DETAIL_FONT_SIZE,
  LABEL_FONT_SIZE,
  MAX_NODE_CONTENT_WIDTH,
  estimateGraphNodeSizes,
  estimateTextWidth,
} from "./estimateNodeSizes";
import { MAX_NODE_WIDTH, NODE_SIZE } from "./nodeSizing";

describe("estimateTextWidth", () => {
  it("estimates ASCII at the deliberately-generous half-width fraction", () => {
    expect(estimateTextWidth("Root", 26)).toBeCloseTo(4 * 0.62 * 26);
  });

  it("estimates CJK at a full em per character", () => {
    expect(estimateTextWidth("索引到底做了什麼", 26)).toBeCloseTo(8 * 26);
  });

  it("sums mixed CJK and ASCII per character, not per string", () => {
    // "JWT 驗證流程" = J,W,T,space (4 halfwidth) + 驗證流程 (4 fullwidth)
    expect(estimateTextWidth("JWT 驗證流程", 26)).toBeCloseTo(4 * 0.62 * 26 + 4 * 26);
  });

  it("classifies a supplementary-plane (astral) CJK ideograph as fullwidth", () => {
    // U+20000 — CJK Unified Ideographs Extension B, a surrogate pair in JS.
    const astral = String.fromCodePoint(0x20000);
    expect(astral.length).toBe(2); // confirms it's actually a surrogate pair
    expect(estimateTextWidth(astral, 26)).toBeCloseTo(1 * 26);
  });

  it("scales linearly with font size", () => {
    expect(estimateTextWidth("abc", 20)).toBeCloseTo((estimateTextWidth("abc", 26) / 26) * 20);
  });

  it("is zero for an empty string", () => {
    expect(estimateTextWidth("", 26)).toBe(0);
  });
});

describe("estimateGraphNodeSizes", () => {
  it("floors a short label at the md token size", () => {
    const sizes = estimateGraphNodeSizes({ nodes: [{ id: "a", label: "Root" }], edges: [] });
    expect(sizes.a).toEqual(NODE_SIZE.md);
  });

  it("widens a node whose label exceeds the content-width threshold", () => {
    const sizes = estimateGraphNodeSizes({
      nodes: [{ id: "a", label: "a longer label than the default card" }],
      edges: [],
    });
    expect(sizes.a.width).toBeGreaterThan(NODE_SIZE.md.width);
    expect(sizes.a.height).toBe(NODE_SIZE.md.height); // height stays token-driven
  });

  it("caps width at MAX_NODE_WIDTH for a very long CJK label", () => {
    const sizes = estimateGraphNodeSizes({
      nodes: [{ id: "a", label: "全".repeat(40) }],
      edges: [],
    });
    expect(sizes.a.width).toBe(MAX_NODE_WIDTH);
  });

  it("takes the wider of label and detail", () => {
    const sizes = estimateGraphNodeSizes({
      nodes: [{ id: "a", label: "短", detail: "一段比較長的說明文字內容" }],
      edges: [],
    });
    const labelOnly = estimateGraphNodeSizes({ nodes: [{ id: "a", label: "短" }], edges: [] });
    expect(sizes.a.width).toBeGreaterThan(labelOnly.a.width);
  });

  it("respects a node's declared size token as the floor", () => {
    const sizes = estimateGraphNodeSizes({ nodes: [{ id: "a", label: "X", size: "lg" }], edges: [] });
    expect(sizes.a).toEqual(NODE_SIZE.lg);
  });
});

describe("MAX_NODE_CONTENT_WIDTH", () => {
  it("is MAX_NODE_WIDTH minus padding on both sides", () => {
    expect(MAX_NODE_CONTENT_WIDTH).toBe(496);
  });
});

describe("font size constants", () => {
  it("mirror DiagramNode.tsx's actual label/detail sizes", () => {
    expect(LABEL_FONT_SIZE).toBe(26);
    expect(DETAIL_FONT_SIZE).toBe(20);
  });
});
