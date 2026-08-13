import { describe, expect, it } from "vitest";
import {
  MAX_NODE_WIDTH,
  NODE_SIZE,
  NODE_TEXT_PAD_X,
  nodeSizeFor,
} from "./nodeSizing";

describe("nodeSizeFor", () => {
  it("keeps the Size token's width when text fits inside it", () => {
    expect(nodeSizeFor(100, "md").width).toBe(NODE_SIZE.md.width);
    expect(nodeSizeFor(0, "sm").width).toBe(NODE_SIZE.sm.width);
  });

  it("grows to the text width plus symmetric padding", () => {
    expect(nodeSizeFor(300, "md").width).toBe(300 + 2 * NODE_TEXT_PAD_X);
  });

  it("caps at MAX_NODE_WIDTH so a long label wraps instead of widening forever", () => {
    expect(nodeSizeFor(900, "md").width).toBe(MAX_NODE_WIDTH);
    expect(nodeSizeFor(100_000, "lg").width).toBe(MAX_NODE_WIDTH);
  });

  it("rounds fractional measurements up, so widths stay integral and stable", () => {
    expect(nodeSizeFor(300.2, "md").width).toBe(301 + 2 * NODE_TEXT_PAD_X);
  });

  it("passes height through from the Size token untouched", () => {
    for (const size of ["sm", "md", "lg"] as const) {
      expect(nodeSizeFor(9999, size).height).toBe(NODE_SIZE[size].height);
    }
  });

  it("is deterministic", () => {
    expect(nodeSizeFor(412.7, "md")).toEqual(nodeSizeFor(412.7, "md"));
  });
});
