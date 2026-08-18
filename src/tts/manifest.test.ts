import { describe, expect, it } from "vitest";
import { narrationHash, parseAudioManifest } from "./manifest";

const BASE = {
  provider: "openai",
  voice: "alloy",
  model: "gpt-4o-mini-tts",
  instructions: undefined,
  narration: "hello",
};

describe("narrationHash", () => {
  it("is deterministic for the same input", () => {
    expect(narrationHash(BASE)).toBe(narrationHash({ ...BASE }));
  });

  it("changes when the provider changes", () => {
    expect(narrationHash({ ...BASE, provider: "elevenlabs" })).not.toBe(narrationHash(BASE));
  });

  it("changes when the voice changes", () => {
    expect(narrationHash({ ...BASE, voice: "coral" })).not.toBe(narrationHash(BASE));
  });

  it("changes when the model changes — the bug this hash exists to prevent", () => {
    expect(narrationHash({ ...BASE, model: "tts-1-hd" })).not.toBe(narrationHash(BASE));
  });

  it("changes when instructions changes", () => {
    expect(narrationHash({ ...BASE, instructions: "speak slowly" })).not.toBe(narrationHash(BASE));
  });

  it("changes when the narration text changes", () => {
    expect(narrationHash({ ...BASE, narration: "goodbye" })).not.toBe(narrationHash(BASE));
  });

  it("normalizes an absent instructions the same as an empty string", () => {
    expect(narrationHash({ ...BASE, instructions: undefined })).toBe(
      narrationHash({ ...BASE, instructions: "" }),
    );
  });

  it("does not collide across a field boundary even though instructions/narration can contain newlines", () => {
    // With naive newline-joining, {instructions:"a\nb", narration:"c"} and
    // {instructions:"a", narration:"b\nc"} would hash identically.
    const a = narrationHash({ ...BASE, instructions: "a\nb", narration: "c" });
    const b = narrationHash({ ...BASE, instructions: "a", narration: "b\nc" });
    expect(a).not.toBe(b);
  });

  it("matches a pinned hex vector — changing the hash's encoding is a breaking change", () => {
    // If this test starts failing after an intentional encoding change,
    // every cached mp3 in every run directory on every machine just got
    // invalidated. Update the vector deliberately, not by accident.
    expect(narrationHash(BASE)).toBe(
      "24b024d91ceadafde07ca96e144775014aaa225ddddc17d9c9d642fec44fc14f",
    );
  });
});

describe("parseAudioManifest", () => {
  it("round-trips a valid manifest", () => {
    const raw = {
      scenes: {
        intro: { src: "audio/intro.mp3", durationInSeconds: 4.2, narrationHash: "h", delaySeconds: 0.3 },
      },
    };
    expect(parseAudioManifest(raw)).toEqual(raw);
  });

  it("returns null for garbage input", () => {
    expect(parseAudioManifest("not an object")).toBeNull();
    expect(parseAudioManifest(null)).toBeNull();
    expect(parseAudioManifest({})).toBeNull();
  });

  it("returns null when a required field is missing", () => {
    expect(
      parseAudioManifest({
        scenes: { intro: { src: "audio/intro.mp3", durationInSeconds: 4.2, delaySeconds: 0.3 } },
      }),
    ).toBeNull();
  });
});
