import { describe, expect, it } from "vitest";
import { dslPreviewCalculateMetadata } from "./previewMetadata";

const RAW_DOC = {
  version: 1,
  id: "PreviewDoc",
  title: "Preview",
  fps: 30,
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

type Params = Parameters<typeof dslPreviewCalculateMetadata>[0];

function callWith(props: Record<string, unknown>) {
  return dslPreviewCalculateMetadata({
    props,
    defaultProps: props,
    abortSignal: new AbortController().signal,
    compositionId: "DslPreview",
  } as Params);
}

describe("dslPreviewCalculateMetadata", () => {
  it("derives duration/fps/size from the validated doc", async () => {
    const result = await callWith({ doc: RAW_DOC });
    expect(result.durationInFrames).toBe(8 * 30);
    expect(result.fps).toBe(30);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
  });

  it("passes extra inputProps through instead of dropping them", async () => {
    const audio = {
      scenes: {
        intro: { src: "audio/intro.mp3", delaySeconds: 0.3, durationInSeconds: 4.2 },
      },
    };
    const result = await callWith({ doc: RAW_DOC, audio, someFutureKey: "survives" });
    const props = result.props as Record<string, unknown>;
    // The audio sidecar is the whole reason for the spread — a regression
    // here silently renders every video mute.
    expect(props.audio).toEqual(audio);
    expect(props.someFutureKey).toBe("survives");
  });

  it("rejects a malformed audio sidecar loudly", async () => {
    await expect(async () =>
      callWith({ doc: RAW_DOC, audio: { scenes: { intro: { src: 42 } } } }),
    ).rejects.toThrow();
  });

  it("re-validates the doc through the parse gate", async () => {
    await expect(async () => callWith({ doc: { version: 1 } })).rejects.toThrow();
  });
});
