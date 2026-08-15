// Tests the pure conversion half of llm.ts only — createLlmClient's
// network half is a thin AI SDK pass-through, deliberately untested.
import { describe, expect, it } from "vitest";
import { toModelMessage } from "./llm";

describe("toModelMessage", () => {
  it("passes plain-string content through for every role", () => {
    for (const role of ["system", "user", "assistant"] as const) {
      expect(toModelMessage({ role, content: "hello" })).toEqual({ role, content: "hello" });
    }
  });

  it("maps user text and image parts to AI SDK content parts", () => {
    const image = new Uint8Array([1, 2, 3]);
    const message = toModelMessage({
      role: "user",
      content: [
        { type: "text", text: "look at this frame" },
        { type: "image", image, mediaType: "image/jpeg" },
      ],
    });
    expect(message.role).toBe("user");
    expect(message.content).toEqual([
      { type: "text", text: "look at this frame" },
      { type: "image", image, mediaType: "image/jpeg" },
    ]);
  });

  it("rejects image parts on non-user roles", () => {
    expect(() =>
      toModelMessage({
        role: "assistant",
        content: [{ type: "image", image: new Uint8Array([1]), mediaType: "image/png" }],
      }),
    ).toThrow(/Only user messages may carry image parts/);
  });
});
