import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CRITIQUE_PROVIDER,
  DEFAULT_MODELS,
  PROVIDER_ENV_KEYS,
  PROVIDER_NAMES,
  isProviderName,
  resolveCritiqueModel,
  resolveCritiqueProvider,
  resolveModel,
  resolveProvider,
} from "./providers";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveProvider", () => {
  it("resolves flag > env > default", () => {
    vi.stubEnv("MOTIFE_PROVIDER", "groq");
    expect(resolveProvider("openai")).toBe("openai");
    expect(resolveProvider(undefined)).toBe("groq");

    vi.unstubAllEnvs();
    vi.stubEnv("MOTIFE_PROVIDER", "");
    expect(resolveProvider(undefined)).toBe("anthropic");
  });

  it("throws on an unknown provider, naming the legal set", () => {
    expect(() => resolveProvider("mistral")).toThrow(/anthropic, openai, google, xai, groq/);
    vi.stubEnv("MOTIFE_PROVIDER", "banana");
    expect(() => resolveProvider(undefined)).toThrow(/Unknown provider "banana"/);
  });
});

describe("resolveModel", () => {
  it("resolves flag > env > per-provider default", () => {
    vi.stubEnv("MOTIFE_MODEL", "env-model");
    expect(resolveModel("openai", "flag-model")).toBe("flag-model");
    expect(resolveModel("openai", undefined)).toBe("env-model");

    vi.unstubAllEnvs();
    vi.stubEnv("MOTIFE_MODEL", "");
    expect(resolveModel("openai", undefined)).toBe(DEFAULT_MODELS.openai);
  });
});

describe("critique resolution", () => {
  it("is independent of the generation env vars", () => {
    vi.stubEnv("MOTIFE_PROVIDER", "groq");
    vi.stubEnv("MOTIFE_MODEL", "generation-model");
    // Critique ignores MOTIFE_PROVIDER/MOTIFE_MODEL entirely — it has its
    // own pair, defaulting to a vision-capable provider.
    expect(resolveCritiqueProvider(undefined)).toBe(DEFAULT_CRITIQUE_PROVIDER);
    expect(resolveCritiqueModel("anthropic", undefined)).toBe(DEFAULT_MODELS.anthropic);

    vi.stubEnv("MOTIFE_CRITIQUE_PROVIDER", "google");
    vi.stubEnv("MOTIFE_CRITIQUE_MODEL", "critique-model");
    expect(resolveCritiqueProvider(undefined)).toBe("google");
    expect(resolveCritiqueModel("google", undefined)).toBe("critique-model");
    expect(resolveCritiqueProvider("xai")).toBe("xai");
  });

  it("throws on an unknown critique provider", () => {
    expect(() => resolveCritiqueProvider("gpt")).toThrow(/Unknown critique provider "gpt"/);
  });
});

describe("provider tables", () => {
  it("every provider has a default model and an env key", () => {
    for (const name of PROVIDER_NAMES) {
      expect(isProviderName(name)).toBe(true);
      expect(DEFAULT_MODELS[name]).toBeTruthy();
      expect(PROVIDER_ENV_KEYS[name]).toMatch(/_API_KEY$/);
    }
    expect(isProviderName("not-a-provider")).toBe(false);
  });
});
