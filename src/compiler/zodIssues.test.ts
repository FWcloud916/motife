import { describe, expect, it } from "vitest";
import { dslDocumentSchema, dslNodeSchema } from "../dsl/schema";
import { zodErrorToDslIssues } from "./zodIssues";

function issuesFor(input: unknown, schema: { safeParse: (input: unknown) => { success: boolean; error?: unknown } } = dslNodeSchema) {
  const result = schema.safeParse(input);
  if (result.success) throw new Error("expected parse failure");
  return zodErrorToDslIssues(result.error as Parameters<typeof zodErrorToDslIssues>[0], input);
}

describe("zodErrorToDslIssues", () => {
  it("lists legal node types when `type` doesn't match any known discriminator", () => {
    const [issue] = issuesFor({ type: "not-a-real-node" });
    expect(issue.path).toBe("type");
    expect(issue.message).toContain("not-a-real-node");
    expect(issue.fix).toContain("stack");
    expect(issue.fix).toContain("switch");
  });

  it("pinpoints the exact bad field when `type` matches but a required field is missing", () => {
    // "pill" matched, but `text` (required) is missing.
    const [issue] = issuesFor({ type: "pill" });
    expect(issue.path).toBe("text");
    expect(issue.message.toLowerCase()).toContain("string");
  });

  it("flags unrecognized fields on a known node (.strict())", () => {
    const [issue] = issuesFor({ type: "pill", text: "x", bogusField: 1 });
    expect(issue.message).toContain("bogusField");
    expect(issue.fix.toLowerCase()).toContain("typo");
  });

  it("summarizes a genuinely ambiguous union (WindowRef) without dumping every branch", () => {
    const [issue] = issuesFor({ type: "pill", text: "x", window: { nonsense: true } });
    expect(issue.path).toBe("window");
    expect(issue.message).toContain("window");
  });

  it("produces a real path for a deeply nested field", () => {
    const doc = {
      version: 1,
      id: "Doc",
      title: "t",
      scenes: [
        {
          id: "s",
          beat: "intro",
          durationInSeconds: 1,
          narration: "n",
          content: {
            type: "stack",
            children: [{ type: "pill", text: "ok" }, { type: "pill" }],
          },
        },
      ],
    };
    const [issue] = issuesFor(doc, dslDocumentSchema);
    expect(issue.path).toBe("scenes[0].content.children[1].text");
  });

  it("every issue is severity error and code schema", () => {
    for (const issue of issuesFor({ type: "pill" })) {
      expect(issue.severity).toBe("error");
      expect(issue.code).toBe("schema");
    }
  });
});
