// TTS provider contract. Two implementations (openai.ts, elevenlabs.ts),
// each a single REST call over fetch — deliberately no vendor SDKs.
// (openai.ts/elevenlabs.ts import only types from here, so the value
// imports below don't create a runtime cycle.)
import { createOpenAiTts } from "./openai";
import { createElevenLabsTts } from "./elevenlabs";
import { DEFAULT_TTS_MODELS } from "./defaults";

export type TtsProviderName = "openai" | "elevenlabs";

export const TTS_PROVIDER_NAMES = ["openai", "elevenlabs"] as const;

export interface TtsProvider {
  readonly name: TtsProviderName;
  /** The voice actually used — part of the narration hash, so switching
   * voices invalidates cached audio. */
  readonly voice: string;
  /** The model actually used — part of the narration hash, so switching
   * models invalidates cached audio (it did not, before Phase 4 PR 4). */
  readonly model: string;
  /** OpenAI gpt-4o-mini-tts only: style/accent steering text. Also part of
   * the narration hash — changing it must re-synthesize, same as model.
   * `undefined` for ElevenLabs (createTtsProvider rejects a non-empty
   * value there rather than silently dropping it). */
  readonly instructions?: string;
  synthesize(text: string): Promise<{ audio: Uint8Array; format: "mp3" }>;
}

export function isTtsProviderName(value: string): value is TtsProviderName {
  return (TTS_PROVIDER_NAMES as readonly string[]).includes(value);
}

/** An env var that is unset OR empty counts as "not configured" —
 * .env.example ships `MOTIFE_TTS_MODEL=`-style blank lines, and `??` alone
 * would let those empty strings through as real values. Mirrors (but does
 * not import) src/agent/providers.ts's envValue() — sharing it would make
 * src/tts/** depend on src/agent/**, inverting today's dependency
 * direction (agent/* imports tts/*, never the reverse), which is too big
 * a trade for three lines of duplication. */
function envValue(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? undefined : value;
}

export function resolveTtsProviderName(flag: string | undefined): TtsProviderName {
  const raw = flag ?? envValue("MOTIFE_TTS") ?? "openai";
  if (!isTtsProviderName(raw)) {
    throw new Error(`Unknown TTS provider "${raw}" — expected one of: ${TTS_PROVIDER_NAMES.join(", ")}.`);
  }
  return raw;
}

/** Free-form, like src/agent/providers.ts's resolveModel() — TTS model ids
 * drift exactly like LLM model ids, and an unknown one surfaces as the
 * vendor API's own error rather than a client-side validity check. */
export function resolveTtsModel(name: TtsProviderName, flag: string | undefined): string {
  return flag ?? envValue("MOTIFE_TTS_MODEL") ?? DEFAULT_TTS_MODELS[name];
}

/** No default here — the factory owns what "unset" means (OpenAI falls
 * back to a universal default voice; ElevenLabs falls back to
 * ELEVENLABS_VOICE_ID and throws if that's unset too, since a voice id is
 * account-specific and there is no safe universal one). */
export function resolveTtsVoice(flag: string | undefined): string | undefined {
  return flag ?? envValue("MOTIFE_TTS_VOICE");
}

/** An explicitly-passed flag always wins, blank or not — `--tts-instructions
 * ""` is the documented way to clear a globally-set MOTIFE_TTS_INSTRUCTIONS
 * for one run. Only an OMITTED flag (undefined) falls through to the env
 * var; a blank flag stops there rather than reading env, which is what
 * makes it a "clear," not a no-op. */
export function resolveTtsInstructions(flag: string | undefined): string | undefined {
  if (flag !== undefined) {
    return flag.trim() !== "" ? flag : undefined;
  }
  return envValue("MOTIFE_TTS_INSTRUCTIONS");
}

/** Resolve + instantiate in one step — the shared branch the run/tts/eval
 * commands all need. Reads API keys lazily (only when actually called),
 * never at module scope. */
export function createTtsProvider(options: {
  flag?: string;
  voice?: string;
  model?: string;
  instructions?: string;
}): TtsProvider {
  const name = resolveTtsProviderName(options.flag);
  const model = resolveTtsModel(name, options.model);
  const voice = resolveTtsVoice(options.voice);
  const instructions = resolveTtsInstructions(options.instructions);
  if (name === "elevenlabs") {
    if (instructions) {
      throw new Error(
        "--tts-instructions / MOTIFE_TTS_INSTRUCTIONS is only supported by the OpenAI TTS " +
          'provider (gpt-4o-mini-tts). Use --tts openai, or pass --tts-instructions "" to clear it.',
      );
    }
    return createElevenLabsTts({ voice, model });
  }
  return createOpenAiTts({ voice, model, instructions });
}
