// Provider/model selection — the one place a default model id lives.
// Deliberately free of AI SDK imports so any command (including keyless
// `motife validate`) can import it; the SDK itself is confined to llm.ts.
//
// Resolution order everywhere: CLI flag > MOTIFE_* env var > this table.
// Model ids drift as vendors ship — when a default goes stale, fix it
// here and nowhere else (callers can always pass --model explicitly).

export type ProviderName = "anthropic" | "openai" | "google" | "xai" | "groq";

export const PROVIDER_NAMES = ["anthropic", "openai", "google", "xai", "groq"] as const;

export const DEFAULT_MODELS: Record<ProviderName, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-5.1",
  google: "gemini-2.5-flash",
  xai: "grok-4",
  groq: "llama-3.3-70b-versatile",
};

/** Env var each provider's AI SDK package reads its API key from. */
export const PROVIDER_ENV_KEYS: Record<ProviderName, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  xai: "XAI_API_KEY",
  groq: "GROQ_API_KEY",
};

// Critique needs a vision-capable model; Groq/xAI vision support varies by
// model, so the critique default is pinned to a provider where it doesn't.
export const DEFAULT_CRITIQUE_PROVIDER: ProviderName = "anthropic";

export function isProviderName(value: string): value is ProviderName {
  return (PROVIDER_NAMES as readonly string[]).includes(value);
}

export function resolveProvider(flag: string | undefined, envVar = "MOTIFE_PROVIDER"): ProviderName {
  const raw = flag ?? process.env[envVar] ?? process.env.MOTIFE_PROVIDER ?? "anthropic";
  if (!isProviderName(raw)) {
    throw new Error(
      `Unknown provider "${raw}" — expected one of: ${PROVIDER_NAMES.join(", ")}.`,
    );
  }
  return raw;
}

export function resolveModel(provider: ProviderName, flag: string | undefined): string {
  return flag ?? process.env.MOTIFE_MODEL ?? DEFAULT_MODELS[provider];
}

export function resolveCritiqueProvider(flag: string | undefined): ProviderName {
  const raw = flag ?? process.env.MOTIFE_CRITIQUE_PROVIDER ?? DEFAULT_CRITIQUE_PROVIDER;
  if (!isProviderName(raw)) {
    throw new Error(
      `Unknown critique provider "${raw}" — expected one of: ${PROVIDER_NAMES.join(", ")}.`,
    );
  }
  return raw;
}

export function resolveCritiqueModel(provider: ProviderName, flag: string | undefined): string {
  return flag ?? process.env.MOTIFE_CRITIQUE_MODEL ?? DEFAULT_MODELS[provider];
}
