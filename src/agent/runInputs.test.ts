import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadRunInputs } from "./runInputs";

const DOC = { version: 1, id: "PlainDoc" };
const TTS_DOC = { version: 1, id: "TtsDoc" };
const MANIFEST = {
  scenes: {
    intro: { src: "audio/intro.mp3", durationInSeconds: 4.2, narrationHash: "h", delaySeconds: 0.3 },
  },
};

describe("loadRunInputs", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "motife-inputs-"));
    await mkdir(path.join(dir, "public", "audio"), { recursive: true });
    await writeFile(path.join(dir, "doc.json"), JSON.stringify(DOC), "utf8");
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("falls back to doc.json when no TTS output exists", async () => {
    const inputs = await loadRunInputs(dir);
    expect(inputs.docPath).toBe(path.join(dir, "doc.json"));
    expect(inputs.rawDoc).toEqual(DOC);
    expect(inputs.audio).toBeUndefined();
  });

  it("prefers doc.tts.json once the TTS stage has run", async () => {
    await writeFile(path.join(dir, "doc.tts.json"), JSON.stringify(TTS_DOC), "utf8");
    const inputs = await loadRunInputs(dir);
    expect(inputs.docPath).toBe(path.join(dir, "doc.tts.json"));
    expect(inputs.rawDoc).toEqual(TTS_DOC);
  });

  it("honors an explicit doc override over both defaults", async () => {
    await writeFile(path.join(dir, "doc.tts.json"), JSON.stringify(TTS_DOC), "utf8");
    const override = path.join(dir, "other.json");
    await writeFile(override, JSON.stringify({ version: 1, id: "Override" }), "utf8");
    const inputs = await loadRunInputs(dir, override);
    expect(inputs.docPath).toBe(override);
    expect(inputs.rawDoc).toEqual({ version: 1, id: "Override" });
  });

  it("parses a valid audio manifest", async () => {
    await writeFile(path.join(dir, "audio-manifest.json"), JSON.stringify(MANIFEST), "utf8");
    const inputs = await loadRunInputs(dir);
    expect(inputs.audio?.scenes.intro.src).toBe("audio/intro.mp3");
  });

  it("treats a corrupt or schema-invalid manifest as no audio", async () => {
    await writeFile(path.join(dir, "audio-manifest.json"), "{not json", "utf8");
    expect((await loadRunInputs(dir)).audio).toBeUndefined();

    await writeFile(
      path.join(dir, "audio-manifest.json"),
      JSON.stringify({ scenes: { intro: { src: 42 } } }),
      "utf8",
    );
    expect((await loadRunInputs(dir)).audio).toBeUndefined();
  });
});
