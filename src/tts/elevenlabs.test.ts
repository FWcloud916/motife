import { afterEach, describe, expect, it, vi } from "vitest";
import { createElevenLabsTts } from "./elevenlabs";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function fakeFetch(body: BodyInit = new Uint8Array([1, 2, 3])) {
  const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
  fetchMock.mockResolvedValue(new Response(body, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("createElevenLabsTts", () => {
  it("throws without ELEVENLABS_API_KEY", () => {
    expect(() => createElevenLabsTts()).toThrow(/ELEVENLABS_API_KEY/);
  });

  it("throws without a voice id from any source", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
    expect(() => createElevenLabsTts()).toThrow(/needs a voice id/);
  });

  it("falls back to ELEVENLABS_VOICE_ID and the default model", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
    vi.stubEnv("ELEVENLABS_VOICE_ID", "env-voice");
    const fetchMock = fakeFetch();
    const provider = createElevenLabsTts();
    expect(provider).toMatchObject({
      name: "elevenlabs",
      voice: "env-voice",
      model: "eleven_multilingual_v2",
    });

    await provider.synthesize("hello");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.elevenlabs.io/v1/text-to-speech/env-voice?output_format=mp3_44100_128",
    );
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ text: "hello", model_id: "eleven_multilingual_v2" });
  });

  it("threads an explicit voice/model into the request", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
    const fetchMock = fakeFetch();
    const provider = createElevenLabsTts({ voice: "flag-voice", model: "eleven_v3" });

    await provider.synthesize("hi");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("flag-voice");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ text: "hi", model_id: "eleven_v3" });
  });

  it("sends the API key as the xi-api-key header", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "secret-key");
    const fetchMock = fakeFetch();
    await createElevenLabsTts({ voice: "v" }).synthesize("hi");
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("secret-key");
  });

  it("throws with the status and truncated body on a non-2xx response", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad voice id", { status: 400 })),
    );
    await expect(createElevenLabsTts({ voice: "v" }).synthesize("hi")).rejects.toThrow(
      /ElevenLabs TTS failed \(400\): bad voice id/,
    );
  });
});
