import { describe, expect, it } from "vitest";
import { parseDocumentOrThrow } from "../compiler";
import { FakeLlmClient } from "../agent/fakeLlm";
import type { CritiqueStillImage } from "./critique";
import { buildCritiqueMessages, parseCritiqueReport, runCritique } from "./critique";

const DOC = parseDocumentOrThrow({
  version: 1,
  id: "CritiqueDoc",
  title: "Critique",
  scenes: [
    {
      id: "intro",
      beat: "intro",
      durationInSeconds: 2,
      narration: "A short introduction.",
      content: { type: "text", role: "hero", content: "Hi", align: "center" },
    },
    {
      id: "breakdown",
      beat: "breakdown",
      durationInSeconds: 2,
      narration: "Nothing to see yet.",
      caption: null,
      content: { type: "pill", text: "breakdown" },
    },
    {
      id: "walkthrough",
      beat: "walkthrough",
      durationInSeconds: 2,
      narration: "Nothing to see yet.",
      content: { type: "pill", text: "walkthrough" },
    },
    {
      id: "summary",
      beat: "summary",
      durationInSeconds: 2,
      narration: "A short summary text.",
      content: { type: "pill", text: "summary" },
    },
  ],
});

const STILLS: CritiqueStillImage[] = [
  { sceneId: "intro", label: "early", image: new Uint8Array([1]), mediaType: "image/jpeg" },
  { sceneId: "breakdown", label: "mid", image: new Uint8Array([2]), mediaType: "image/jpeg" },
];

const VALID_REPORT = JSON.stringify({
  issues: [
    {
      sceneId: "intro",
      severity: "error",
      kind: "overflow",
      description: "Title clipped on the right edge.",
      suggestion: "Shorten the hero text or lower its emphasis.",
    },
  ],
});

describe("buildCritiqueMessages", () => {
  it("interleaves per-still context text with the image parts", () => {
    const messages = buildCritiqueMessages(DOC, STILLS);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");

    const parts = messages[1].content;
    if (typeof parts === "string") throw new Error("expected content parts");
    // text+image per still, plus the closing instruction.
    expect(parts).toHaveLength(STILLS.length * 2 + 1);
    expect(parts[0]).toMatchObject({ type: "text" });
    expect(parts[0].type === "text" && parts[0].text).toContain('Scene "intro"');
    expect(parts[0].type === "text" && parts[0].text).toContain("A short introduction.");
    expect(parts[1]).toMatchObject({ type: "image", mediaType: "image/jpeg" });
    // The caption:null scene calls that out (the critic must not flag a
    // missing caption band as a bug).
    expect(parts[2].type === "text" && parts[2].text).toContain("Caption band: disabled");
  });
});

describe("parseCritiqueReport", () => {
  it("accepts a valid report (and strips fences)", () => {
    const result = parseCritiqueReport("```json\n" + VALID_REPORT + "\n```");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.issues).toHaveLength(1);
    expect(result.report.issues[0].kind).toBe("overflow");
  });

  it("accepts an empty issues list", () => {
    const result = parseCritiqueReport('{"issues":[]}');
    expect(result.ok).toBe(true);
  });

  it("rejects non-JSON", () => {
    const result = parseCritiqueReport("the video looks fine to me!");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Not valid JSON");
  });

  it("rejects a wrong shape with a pointed error", () => {
    const result = parseCritiqueReport('{"issues":[{"sceneId":"intro","severity":"fatal"}]}');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("issues.0.severity");
  });
});

describe("runCritique", () => {
  it("returns the parsed report on the first try", async () => {
    const client = new FakeLlmClient([VALID_REPORT]);
    const report = await runCritique({ client, doc: DOC, stills: STILLS });
    expect(report.issues).toHaveLength(1);
    expect(client.calls).toHaveLength(1);
  });

  it("drops issues for scenes the document does not have", async () => {
    const withGhost = JSON.stringify({
      issues: [
        ...JSON.parse(VALID_REPORT).issues,
        {
          sceneId: "hallucinated-scene",
          severity: "error",
          kind: "overlap",
          description: "Ghost issue.",
          suggestion: "Should never reach the revision prompt.",
        },
      ],
    });
    const client = new FakeLlmClient([withGhost]);
    const report = await runCritique({ client, doc: DOC, stills: STILLS });
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0].sceneId).toBe("intro");
  });

  it("retries once with the parse error, then gives up", async () => {
    const client = new FakeLlmClient(["not json", VALID_REPORT]);
    const report = await runCritique({ client, doc: DOC, stills: STILLS });
    expect(report.issues).toHaveLength(1);
    expect(client.calls).toHaveLength(2);

    const retryMessages = client.calls[1].messages;
    const last = retryMessages[retryMessages.length - 1];
    expect(last.role).toBe("user");
    expect(last.content).toContain("Not valid JSON");

    const failing = new FakeLlmClient(["not json", "still not json"]);
    await expect(runCritique({ client: failing, doc: DOC, stills: STILLS })).rejects.toThrow(
      /never produced a parseable report/,
    );
  });
});
