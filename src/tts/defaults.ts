// The one place a default TTS model id lives — same discipline as
// src/agent/providers.ts's DEFAULT_MODELS: when a default goes stale, fix
// it here and nowhere else. A leaf module (only a type-only import out of
// provider.ts) so both provider.ts (to resolve flag > env > default) and
// the vendor factories (so a direct createOpenAiTts()/createElevenLabsTts()
// call gets the same default) can depend on it without either becoming a
// value-import of the other — provider.ts's header comment explains why
// that matters (it's what keeps the two factory modules from forming a
// runtime cycle back through provider.ts).
import type { TtsProviderName } from "./provider";

export const DEFAULT_TTS_MODELS: Record<TtsProviderName, string> = {
  openai: "gpt-4o-mini-tts",
  elevenlabs: "eleven_multilingual_v2",
};

// OpenAI has a safe universal default voice. ElevenLabs voice ids are
// account-specific, so it deliberately has none — see elevenlabs.ts.
export const DEFAULT_OPENAI_TTS_VOICE = "alloy";
