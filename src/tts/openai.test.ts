import { afterEach, describe, expect, it, vi } from "vitest";
import { createOpenAiTts } from "./openai";

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

describe("createOpenAiTts", () => {
  it("throws without OPENAI_API_KEY", () => {
    expect(() => createOpenAiTts()).toThrow(/OPENAI_API_KEY/);
  });

  it("defaults to alloy / gpt-4o-mini-tts and omits instructions entirely when unset", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = fakeFetch();
    const provider = createOpenAiTts();
    expect(provider).toMatchObject({ name: "openai", voice: "alloy", model: "gpt-4o-mini-tts" });
    expect(provider.instructions).toBeUndefined();

    await provider.synthesize("hello");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/speech");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: "hello",
      response_format: "mp3",
    });
    expect(body).not.toHaveProperty("instructions");
  });

  it("threads a custom voice/model/instructions into the request body", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = fakeFetch();
    const provider = createOpenAiTts({ voice: "coral", model: "tts-1-hd", instructions: "speak slowly" });

    await provider.synthesize("hi");

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      model: "tts-1-hd",
      voice: "coral",
      input: "hi",
      response_format: "mp3",
      instructions: "speak slowly",
    });
  });

  it("sends the API key as a bearer token", async () => {
    vi.stubEnv("OPENAI_API_KEY", "secret-key");
    const fetchMock = fakeFetch();
    await createOpenAiTts().synthesize("hi");
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-key");
  });

  it("throws with the status and truncated body on a non-2xx response", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad request detail", { status: 400 })),
    );
    await expect(createOpenAiTts().synthesize("hi")).rejects.toThrow(
      /OpenAI TTS failed \(400\): bad request detail/,
    );
  });
});
