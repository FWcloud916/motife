import { z } from "zod";
import { describe, expect, it } from "vitest";
import { beatSchema, dslDocumentSchema, dslNodeSchema } from "./schema";

// A minimal but structurally realistic document — one scene per beat,
// exercising the recursive node union (stack > card > stack > text/icon)
// so a getter-wiring mistake in schema.ts fails here, at the cheapest
// possible layer, rather than surfacing later as a cryptic Zod error deep
// in a real document.
const MINIMAL_DOC = {
  version: 1,
  id: "MinimalDoc",
  title: "Minimal",
  scenes: [
    {
      id: "intro",
      beat: "intro",
      durationInSeconds: 3,
      narration: "Hello.",
      content: { type: "text", content: "Hello" },
    },
    {
      id: "breakdown",
      beat: "breakdown",
      durationInSeconds: 3,
      narration: "Breakdown.",
      content: {
        type: "stack",
        direction: "row",
        children: [
          {
            type: "card",
            children: [
              { type: "text", role: "label", content: "01" },
              { type: "icon", name: "key" },
            ],
          },
        ],
      },
    },
    {
      id: "walkthrough",
      beat: "walkthrough",
      durationInSeconds: 3,
      narration: "Walkthrough.",
      tracks: [
        {
          id: "checks",
          window: { from: 0, to: 1 },
          items: [{ title: "step 1" }, { title: "step 2" }],
        },
      ],
      content: {
        type: "switch",
        track: "checks",
        cases: [
          { steps: [0, 0], content: { type: "text", content: "first" } },
          { steps: [1, 1], content: { type: "text", content: "second" } },
        ],
      },
    },
    {
      id: "summary",
      beat: "summary",
      durationInSeconds: 3,
      narration: "Summary.",
      caption: null,
      content: { type: "pill", text: "done" },
    },
  ],
};

describe("dslDocumentSchema", () => {
  it("parses a minimal, structurally realistic document", () => {
    const result = dslDocumentSchema.safeParse(MINIMAL_DOC);
    expect(result.success).toBe(true);
  });

  it("defaults fps/width/height when omitted", () => {
    const result = dslDocumentSchema.parse(MINIMAL_DOC);
    expect(result.fps).toBe(30);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
  });

  it("rejects an unknown top-level field (.strict())", () => {
    const result = dslDocumentSchema.safeParse({ ...MINIMAL_DOC, extra: true });
    expect(result.success).toBe(false);
  });

  it("rejects a document id with an illegal character", () => {
    const result = dslDocumentSchema.safeParse({ ...MINIMAL_DOC, id: "not valid!" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown node type", () => {
    const result = dslNodeSchema.safeParse({ type: "not-a-real-node" });
    expect(result.success).toBe(false);
  });

  it("rejects a card with zero children (min(1))", () => {
    const result = dslNodeSchema.safeParse({ type: "card", children: [] });
    expect(result.success).toBe(false);
  });

  it("recurses through stack -> card -> stack -> text without depth limit issues", () => {
    const deep = {
      type: "stack",
      children: [
        {
          type: "card",
          children: [
            {
              type: "stack",
              children: [{ type: "text", content: "deep" }],
            },
          ],
        },
      ],
    };
    expect(dslNodeSchema.safeParse(deep).success).toBe(true);
  });

  it("accepts every WindowRef shape", () => {
    const cases = [
      { from: 0, to: 1 },
      { track: "checks", step: 0 },
      { track: "checks", steps: [0, 1] },
    ];
    for (const window of cases) {
      const result = dslNodeSchema.safeParse({ type: "pill", text: "x", window });
      expect(result.success).toBe(true);
    }
  });

  it("enumerates the four fixed beats", () => {
    expect(beatSchema.options).toEqual(["intro", "breakdown", "walkthrough", "summary"]);
  });
});

describe("z.toJSONSchema(dslDocumentSchema)", () => {
  // This is Phase 3's structured-output contract — the compiler's own
  // parsing never calls it, but a recursive discriminated union is exactly
  // the shape most likely to make cycle-handling throw, so this proves the
  // schema stays representable now rather than discovering it in Phase 3.
  it("does not throw, and represents the recursive node union via $defs/$ref", () => {
    const jsonSchema = z.toJSONSchema(dslDocumentSchema);
    const serialized = JSON.stringify(jsonSchema);
    expect(serialized.length).toBeGreaterThan(0);
    expect(serialized).toMatch(/\$ref|\$defs/);
  });

  it("contains the four beat literals", () => {
    const jsonSchema = JSON.stringify(z.toJSONSchema(dslDocumentSchema));
    for (const beat of ["intro", "breakdown", "walkthrough", "summary"]) {
      expect(jsonSchema).toContain(beat);
    }
  });
});
