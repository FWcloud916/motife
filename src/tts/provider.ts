// TTS provider contract. Two implementations (openai.ts, elevenlabs.ts),
// each a single REST call over fetch — deliberately no vendor SDKs.
export type TtsProviderName = "openai" | "elevenlabs";

export const TTS_PROVIDER_NAMES = ["openai", "elevenlabs"] as const;

export interface TtsProvider {
  readonly name: TtsProviderName;
  /** The voice actually used — part of the narration hash, so switching
   * voices invalidates cached audio. */
  readonly voice: string;
  synthesize(text: string): Promise<{ audio: Uint8Array; format: "mp3" }>;
}

export function isTtsProviderName(value: string): value is TtsProviderName {
  return (TTS_PROVIDER_NAMES as readonly string[]).includes(value);
}

export function resolveTtsProviderName(flag: string | undefined): TtsProviderName {
  // Empty-string env (the `.env.example` blank-value pattern) counts as
  // unset, mirroring src/agent/providers.ts's envValue().
  const envRaw = process.env.MOTIFE_TTS;
  const raw = flag ?? (envRaw && envRaw.trim() !== "" ? envRaw : undefined) ?? "openai";
  if (!isTtsProviderName(raw)) {
    throw new Error(`Unknown TTS provider "${raw}" — expected one of: openai, elevenlabs.`);
  }
  return raw;
}
