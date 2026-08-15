import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseDocumentOrThrow } from "../compiler";
import type { TtsProvider } from "./provider";
import { parseAudioManifest } from "./manifest";
import { synthesizeDoc } from "./synthesize";

const DOC = parseDocumentOrThrow({
  version: 1,
  id: "TtsDoc",
  title: "TTS",
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
});

class CountingTts implements TtsProvider {
  readonly name = "openai" as const;
  readonly voice: string = "test-voice";
  calls: string[] = [];

  async synthesize(text: string): Promise<{ audio: Uint8Array; format: "mp3" }> {
    this.calls.push(text);
    return { audio: new TextEncoder().encode(`fake-audio:${text}`), format: "mp3" };
  }
}

const fakeMeasure = async () => 4.2;

describe("synthesizeDoc", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "motife-tts-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function options(provider: TtsProvider) {
    return {
      doc: DOC,
      provider,
      audioDir: path.join(dir, "public", "audio"),
      manifestPath: path.join(dir, "audio-manifest.json"),
      measureDurationSeconds: fakeMeasure,
    };
  }

  it("synthesizes every scene and writes a valid manifest", async () => {
    const provider = new CountingTts();
    const result = await synthesizeDoc(options(provider));

    expect(result.synthesized).toEqual(["intro", "breakdown", "walkthrough", "summary"]);
    expect(result.reused).toEqual([]);
    expect(provider.calls).toHaveLength(4);

    const written = parseAudioManifest(
      JSON.parse(await readFile(path.join(dir, "audio-manifest.json"), "utf8")),
    );
    expect(written).not.toBeNull();
    expect(written?.scenes.intro).toMatchObject({
      src: "audio/intro.mp3",
      durationInSeconds: 4.2,
      delaySeconds: 0.3,
    });

    const audio = await readFile(path.join(dir, "public", "audio", "intro.mp3"), "utf8");
    expect(audio).toBe("fake-audio:A short introduction.");
  });

  it("skips unchanged scenes on a second run (narration-hash cache)", async () => {
    const first = new CountingTts();
    await synthesizeDoc(options(first));

    const second = new CountingTts();
    const result = await synthesizeDoc(options(second));

    expect(second.calls).toHaveLength(0);
    expect(result.reused).toEqual(["intro", "breakdown", "walkthrough", "summary"]);
    expect(result.synthesized).toEqual([]);
  });

  it("re-synthesizes only scenes whose narration changed", async () => {
    await synthesizeDoc(options(new CountingTts()));

    const revised = parseDocumentOrThrow({
      ...JSON.parse(JSON.stringify(rawOf(DOC))),
      scenes: rawOf(DOC).scenes.map((scene) =>
        scene.id === "breakdown" ? { ...scene, narration: "Rewritten narration here." } : scene,
      ),
    });
    const provider = new CountingTts();
    const result = await synthesizeDoc({ ...options(provider), doc: revised });

    expect(provider.calls).toEqual(["Rewritten narration here."]);
    expect(result.synthesized).toEqual(["breakdown"]);
    expect(result.reused).toEqual(["intro", "walkthrough", "summary"]);
  });

  it("re-synthesizes everything when the voice changes", async () => {
    await synthesizeDoc(options(new CountingTts()));

    class OtherVoice extends CountingTts {
      override readonly voice = "other-voice";
    }
    const provider = new OtherVoice();
    const result = await synthesizeDoc(options(provider));
    expect(provider.calls).toHaveLength(4);
    expect(result.reused).toEqual([]);
  });

  it("honors force", async () => {
    await synthesizeDoc(options(new CountingTts()));
    const provider = new CountingTts();
    const result = await synthesizeDoc({ ...options(provider), force: true });
    expect(provider.calls).toHaveLength(4);
    expect(result.synthesized).toHaveLength(4);
  });
});

// The parsed document is structurally the raw JSON (zod passthrough of
// plain data) — this helper just re-labels it for cloning in tests.
function rawOf(doc: typeof DOC): { scenes: Array<{ id: string; narration: string }> } & Record<
  string,
  unknown
> {
  return JSON.parse(JSON.stringify(doc));
}
