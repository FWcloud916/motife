import { describe, expect, it } from "vitest";
import { TONE_NAMES, tokens } from "./index";

describe("tokens.color.tone", () => {
  it("has a recipe for every Tone", () => {
    for (const name of TONE_NAMES) {
      const entry = tokens.color.tone[name];
      expect(entry, `missing tone recipe for "${name}"`).toBeDefined();
      expect(entry.fg).toMatch(/^#/);
      expect(entry.bg).toContain(entry.fg);
      expect(entry.border).toContain(entry.fg);
    }
  });

  it("exposes exactly the declared Tone set — no stray or missing keys", () => {
    expect(Object.keys(tokens.color.tone).sort()).toEqual([...TONE_NAMES].sort());
  });
});
