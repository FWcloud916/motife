import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TTS_MODELS } from "./defaults";
import {
  TTS_PROVIDER_NAMES,
  createTtsProvider,
  isTtsProviderName,
  resolveTtsInstructions,
  resolveTtsModel,
  resolveTtsProviderName,
  resolveTtsVoice,
} from "./provider";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveTtsProviderName", () => {
  it("resolves flag > env > default", () => {
    vi.stubEnv("MOTIFE_TTS", "elevenlabs");
    expect(resolveTtsProviderName("openai")).toBe("openai");
    expect(resolveTtsProviderName(undefined)).toBe("elevenlabs");

    vi.unstubAllEnvs();
    vi.stubEnv("MOTIFE_TTS", "");
    expect(resolveTtsProviderName(undefined)).toBe("openai");
  });

  it("throws on an unknown provider, naming the legal set", () => {
    expect(() => resolveTtsProviderName("polly")).toThrow(/openai, elevenlabs/);
  });
});

describe("resolveTtsModel", () => {
  it("resolves flag > env > per-provider default", () => {
    vi.stubEnv("MOTIFE_TTS_MODEL", "env-model");
    expect(resolveTtsModel("openai", "flag-model")).toBe("flag-model");
    expect(resolveTtsModel("openai", undefined)).toBe("env-model");

    vi.unstubAllEnvs();
    vi.stubEnv("MOTIFE_TTS_MODEL", "");
    expect(resolveTtsModel("openai", undefined)).toBe(DEFAULT_TTS_MODELS.openai);
    expect(resolveTtsModel("elevenlabs", undefined)).toBe(DEFAULT_TTS_MODELS.elevenlabs);
  });
});

describe("resolveTtsVoice", () => {
  it("resolves flag > env > undefined (no default — the factory owns that)", () => {
    vi.stubEnv("MOTIFE_TTS_VOICE", "coral");
    expect(resolveTtsVoice("sage")).toBe("sage");
    expect(resolveTtsVoice(undefined)).toBe("coral");

    vi.unstubAllEnvs();
    expect(resolveTtsVoice(undefined)).toBeUndefined();
  });
});

describe("resolveTtsInstructions", () => {
  it("resolves flag > env", () => {
    vi.stubEnv("MOTIFE_TTS_INSTRUCTIONS", "env instructions");
    expect(resolveTtsInstructions("flag instructions")).toBe("flag instructions");
    expect(resolveTtsInstructions(undefined)).toBe("env instructions");
  });

  it("treats a blank flag as an explicit clear, not a pass-through to env", () => {
    vi.stubEnv("MOTIFE_TTS_INSTRUCTIONS", "env instructions");
    expect(resolveTtsInstructions("")).toBeUndefined();
  });
});

describe("createTtsProvider", () => {
  it("threads model/voice/instructions into an OpenAI provider", () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const provider = createTtsProvider({
      flag: "openai",
      voice: "coral",
      model: "gpt-4o-mini-tts",
      instructions: "speak slowly",
    });
    expect(provider).toMatchObject({
      name: "openai",
      voice: "coral",
      model: "gpt-4o-mini-tts",
      instructions: "speak slowly",
    });
  });

  it("resolves ElevenLabs voice precedence: --voice > MOTIFE_TTS_VOICE > ELEVENLABS_VOICE_ID", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
    vi.stubEnv("ELEVENLABS_VOICE_ID", "fallback-voice");
    vi.stubEnv("MOTIFE_TTS_VOICE", "env-voice");

    expect(createTtsProvider({ flag: "elevenlabs" }).voice).toBe("env-voice");
    expect(createTtsProvider({ flag: "elevenlabs", voice: "flag-voice" }).voice).toBe("flag-voice");

    vi.unstubAllEnvs();
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
    vi.stubEnv("ELEVENLABS_VOICE_ID", "fallback-voice");
    expect(createTtsProvider({ flag: "elevenlabs" }).voice).toBe("fallback-voice");
  });

  it("throws when ElevenLabs has no voice id from any source", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
    expect(() => createTtsProvider({ flag: "elevenlabs" })).toThrow(/needs a voice id/);
  });

  it("throws when instructions is set for ElevenLabs, naming the fix", () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
    vi.stubEnv("ELEVENLABS_VOICE_ID", "some-voice");
    expect(() =>
      createTtsProvider({ flag: "elevenlabs", instructions: "speak slowly" }),
    ).toThrow(/--tts-instructions.*only supported by the OpenAI/);
  });

  it("clears a globally-set MOTIFE_TTS_INSTRUCTIONS with an explicit blank flag", () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("MOTIFE_TTS_INSTRUCTIONS", "global steering");
    expect(createTtsProvider({ flag: "openai", instructions: "" }).instructions).toBeUndefined();
  });
});

describe("TTS provider tables", () => {
  it("every provider name has a default model", () => {
    for (const name of TTS_PROVIDER_NAMES) {
      expect(isTtsProviderName(name)).toBe(true);
      expect(DEFAULT_TTS_MODELS[name]).toBeTruthy();
    }
    expect(isTtsProviderName("polly")).toBe(false);
  });
});
