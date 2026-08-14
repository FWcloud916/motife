import { describe, expect, it } from "vitest";
import { formatIssues, parseDocument } from "../compiler";
import { FakeLlmClient } from "./fakeLlm";
import { generateDsl } from "./generate";

// Small but fully valid: four beats, pacing inside the validator's
// comfortable band (so warningsText stays null unless a test wants it).
const VALID_DOC = {
  version: 1,
  id: "GeneratedDoc",
  title: "Generated",
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
};

// Same shape with a duplicate scene id and two beats missing — guaranteed
// semantic (not zod) errors, so the test exercises the validate.ts path.
const BROKEN_DOC = {
  ...VALID_DOC,
  id: "BrokenDoc",
  scenes: [VALID_DOC.scenes[0], { ...VALID_DOC.scenes[0] }, VALID_DOC.scenes[3]],
};

const SYSTEM = "system prompt";
const PROMPT = "explain the thing";

describe("generateDsl", () => {
  it("accepts a valid first attempt", async () => {
    const client = new FakeLlmClient([JSON.stringify(VALID_DOC)]);
    const result = await generateDsl({ client, systemPrompt: SYSTEM, userPrompt: PROMPT });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.id).toBe("GeneratedDoc");
    expect(result.warningsText).toBeNull();
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].issuesText).toBeNull();
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].messages.map((m) => m.role)).toEqual(["system", "user"]);
  });

  it("strips markdown fences before parsing", async () => {
    const client = new FakeLlmClient(["```json\n" + JSON.stringify(VALID_DOC) + "\n```"]);
    const result = await generateDsl({ client, systemPrompt: SYSTEM, userPrompt: PROMPT });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The persisted JSON must round-trip parseDocument on its own.
    expect(parseDocument(JSON.parse(result.json)).ok).toBe(true);
  });

  it("feeds a JSON syntax failure back as a retry message", async () => {
    const client = new FakeLlmClient(["this is not json at all", JSON.stringify(VALID_DOC)]);
    const result = await generateDsl({ client, systemPrompt: SYSTEM, userPrompt: PROMPT });

    expect(result.ok).toBe(true);
    expect(client.calls).toHaveLength(2);
    const retry = client.calls[1].messages;
    // system, user, assistant (raw attempt), user (issue report)
    expect(retry.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(retry[2].content).toBe("this is not json at all");
    expect(retry[3].content).toContain("Not valid JSON");
    expect(retry[3].content).toContain("COMPLETE corrected JSON document");
  });

  it("feeds formatIssues() output back verbatim on validation failure", async () => {
    const client = new FakeLlmClient([JSON.stringify(BROKEN_DOC), JSON.stringify(VALID_DOC)]);
    const result = await generateDsl({ client, systemPrompt: SYSTEM, userPrompt: PROMPT });

    expect(result.ok).toBe(true);
    expect(client.calls).toHaveLength(2);

    const parsed = parseDocument(BROKEN_DOC);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    const expected = formatIssues("BrokenDoc", parsed.issues);

    const retryMessages = client.calls[1].messages;
    const lastMessage = retryMessages[retryMessages.length - 1];
    expect(lastMessage.content).toContain(expected);
  });

  it("gives up after maxAttempts and preserves the attempt history", async () => {
    const client = new FakeLlmClient(["nope", "still nope"]);
    const seen: number[] = [];
    const result = await generateDsl({
      client,
      systemPrompt: SYSTEM,
      userPrompt: PROMPT,
      maxAttempts: 2,
      onAttempt: (record) => {
        seen.push(record.attempt);
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.attempts).toHaveLength(2);
    expect(result.failureText).toContain("Not valid JSON");
    expect(seen).toEqual([1, 2]);
  });

  it("surfaces warnings on the accepted doc without retrying", async () => {
    const warned = {
      ...VALID_DOC,
      id: "WarnDoc",
      scenes: VALID_DOC.scenes.map((scene, index) =>
        // 40s for ~20 chars of narration → far below comfortable pace.
        index === 1 ? { ...scene, durationInSeconds: 40 } : scene,
      ),
    };
    const client = new FakeLlmClient([JSON.stringify(warned)]);
    const result = await generateDsl({ client, systemPrompt: SYSTEM, userPrompt: PROMPT });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(client.calls).toHaveLength(1);
    expect(result.warningsText).toContain("WARN");
  });
});
