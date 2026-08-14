import { describe, expect, it } from "vitest";
import type { CritiqueReport } from "./critique";
import { countBySeverity, renderCritiqueMarkdown } from "./report";

const REPORT: CritiqueReport = {
  issues: [
    {
      sceneId: "intro",
      severity: "error",
      kind: "overflow",
      description: "Title clipped.",
      suggestion: "Shorten the title.",
    },
    {
      sceneId: "intro",
      severity: "warning",
      kind: "contrast",
      description: "Subtitle slightly dim.",
      suggestion: "Raise its emphasis.",
    },
    {
      sceneId: "summary",
      severity: "error",
      kind: "overlap",
      description: "Pills overlap the caption band.",
      suggestion: "Drop one pill.",
    },
  ],
};

describe("countBySeverity", () => {
  it("counts errors and warnings", () => {
    expect(countBySeverity(REPORT)).toEqual({ errors: 2, warnings: 1 });
    expect(countBySeverity({ issues: [] })).toEqual({ errors: 0, warnings: 0 });
  });
});

describe("renderCritiqueMarkdown", () => {
  it("groups issues by scene with severity markers", () => {
    const markdown = renderCritiqueMarkdown(REPORT, 2);
    expect(markdown).toContain("# Critique — iteration 2");
    expect(markdown).toContain("2 error(s), 1 warning(s).");
    expect(markdown).toContain("## Scene intro");
    expect(markdown).toContain("## Scene summary");
    expect(markdown).toContain("**ERROR / overflow** — Title clipped.");
    expect(markdown).toContain("fix: Shorten the title.");
    // Scene grouping: intro's two issues before summary's one.
    expect(markdown.indexOf("## Scene intro")).toBeLessThan(markdown.indexOf("## Scene summary"));
  });

  it("says so when there is nothing to fix", () => {
    const markdown = renderCritiqueMarkdown({ issues: [] }, 1);
    expect(markdown).toContain("No visual issues found.");
  });
});
