import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./prompt";

describe("buildSystemPrompt", () => {
  it("contains the spec, the JSON schema, and all few-shot documents", async () => {
    const prompt = await buildSystemPrompt();

    // docs/dsl-schema.md rides along wholesale.
    expect(prompt).toContain("## DSL reference");
    expect(prompt).toContain("WindowRef");

    // Machine-readable schema appendix (recursive union via $defs/$ref).
    expect(prompt).toContain("$defs");

    // All three shipped eval docs as few-shot examples.
    expect(prompt).toContain('"JwtAuthFlow"');
    expect(prompt).toContain('"MqBackpressure"');
    expect(prompt).toContain('"DbIndexInternals"');

    // Default narration language.
    expect(prompt).toContain("zh-TW");
  });

  it("rejects a non-integer fewShot instead of silently dropping all examples", async () => {
    await expect(buildSystemPrompt({ fewShot: Number.NaN })).rejects.toThrow(
      /fewShot must be an integer/,
    );
  });

  it("honors language and few-shot overrides", async () => {
    const prompt = await buildSystemPrompt({ language: "en-US", fewShot: 0 });
    expect(prompt).toContain("en-US");
    expect(prompt).not.toContain("### Example 1");
    expect(prompt).not.toContain('"JwtAuthFlow"');
  });
});
