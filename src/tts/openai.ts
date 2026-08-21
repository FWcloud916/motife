// OpenAI TTS — POST /v1/audio/speech, one call per scene narration.
import { DEFAULT_OPENAI_TTS_VOICE, DEFAULT_TTS_MODELS } from "./defaults";
import type { TtsProvider } from "./provider";
import { normalizeProviderError, providerErrorFromHttp } from "../agent/providerError";

export function createOpenAiTts(
  options: { voice?: string; model?: string; instructions?: string } = {},
): TtsProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  const voice = options.voice ?? DEFAULT_OPENAI_TTS_VOICE;
  const model = options.model ?? DEFAULT_TTS_MODELS.openai;
  const instructions = options.instructions;
  return {
    name: "openai",
    voice,
    model,
    instructions,
    async synthesize(text: string) {
      try {
        if (!apiKey) {
          throw providerErrorFromHttp("OpenAI TTS", 401, "OPENAI_API_KEY is not set");
        }
        const response = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            voice,
            input: text,
            response_format: "mp3",
            ...(instructions ? { instructions } : {}),
          }),
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw providerErrorFromHttp("OpenAI TTS", response.status, detail);
        }
        return { audio: new Uint8Array(await response.arrayBuffer()), format: "mp3" as const };
      } catch (error) {
        throw normalizeProviderError("OpenAI TTS", error);
      }
    },
  };
}
