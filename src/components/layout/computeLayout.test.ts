import { describe, expect, it } from "vitest";
import { computeLayout } from "./computeLayout";
import type { GraphSpec } from "./types";

const THREE_NODE_CHAIN: GraphSpec = {
  direction: "right",
  nodes: [
    { id: "browser", label: "Browser" },
    { id: "server", label: "Server" },
    { id: "db", label: "Database" },
  ],
  edges: [
    { from: "browser", to: "server", label: "request" },
    { from: "server", to: "db", label: "query" },
  ],
};

describe("computeLayout", () => {
  it("is deterministic — identical input produces identical output", () => {
    const a = computeLayout(THREE_NODE_CHAIN);
    const b = computeLayout(THREE_NODE_CHAIN);
    expect(a).toEqual(b);
  });

  it("places every declared node", () => {
    const result = computeLayout(THREE_NODE_CHAIN);
    expect(Object.keys(result.nodes).sort()).toEqual(["browser", "db", "server"]);
  });

  it("places every declared edge, keyed by explicit id or from->to", () => {
    const result = computeLayout(THREE_NODE_CHAIN);
    expect(Object.keys(result.edges).sort()).toEqual(["browser->server", "server->db"]);
  });

  it("respects an explicit edge id", () => {
    const result = computeLayout({
      ...THREE_NODE_CHAIN,
      edges: [{ id: "req", from: "browser", to: "server" }],
    });
    expect(result.edges.req).toBeDefined();
  });

  it("lays out left-to-right when direction is 'right' — x increases along the chain", () => {
    const result = computeLayout(THREE_NODE_CHAIN);
    expect(result.nodes.browser.x).toBeLessThan(result.nodes.server.x);
    expect(result.nodes.server.x).toBeLessThan(result.nodes.db.x);
  });

  it("lays out top-to-bottom when direction is 'down' — y increases along the chain", () => {
    const result = computeLayout({ ...THREE_NODE_CHAIN, direction: "down" });
    expect(result.nodes.browser.y).toBeLessThan(result.nodes.server.y);
    expect(result.nodes.server.y).toBeLessThan(result.nodes.db.y);
  });

  it("reports finite node rects and a finite overall bounding box", () => {
    const result = computeLayout(THREE_NODE_CHAIN);
    expect(Number.isFinite(result.width)).toBe(true);
    expect(Number.isFinite(result.height)).toBe(true);
    for (const id of Object.keys(result.nodes)) {
      const rect = result.nodes[id];
      expect(Number.isFinite(rect.x)).toBe(true);
      expect(Number.isFinite(rect.y)).toBe(true);
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
    }
  });

  it("gives every edge a valid, finite SVG path", () => {
    const result = computeLayout(THREE_NODE_CHAIN);
    for (const id of Object.keys(result.edges)) {
      const edge = result.edges[id];
      expect(edge.path.startsWith("M")).toBe(true);
      const numbers = edge.path.match(/-?\d+(\.\d+)?/g) ?? [];
      expect(numbers.every((n: string) => Number.isFinite(Number(n)))).toBe(true);
    }
  });

  it("handles a graph with no edges", () => {
    const result = computeLayout({ nodes: [{ id: "solo", label: "Solo" }], edges: [] });
    expect(Object.keys(result.nodes)).toEqual(["solo"]);
    expect(Object.keys(result.edges)).toEqual([]);
  });
});
