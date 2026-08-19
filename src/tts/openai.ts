// OpenAI TTS — POST /v1/audio/speech, one call per scene narration.
import { DEFAULT_OPENAI_TTS_VOICE, DEFAULT_TTS_MODELS } from "./defaults";
import type { TtsProvider } from "./provider";

export function createOpenAiTts(
  options: { voice?: string; model?: string; instructions?: string } = {},
): TtsProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI TTS needs OPENAI_API_KEY set (via .env or the environment).");
  }
  const voice = options.voice ?? DEFAULT_OPENAI_TTS_VOICE;
  const model = options.model ?? DEFAULT_TTS_MODELS.openai;
  const instructions = options.instructions;
  return {
    name: "openai",
    voice,
    model,
    instructions,
    async synthesize(text: string) {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        // instructions is only included when set — some models (tts-1,
        // tts-1-hd) reject the field outright with a 400, so an unset/blank
        // instructions must produce a request byte-identical to before this
        // option existed.
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
        throw new Error(`OpenAI TTS failed (${response.status}): ${detail.slice(0, 500)}`);
      }
      return { audio: new Uint8Array(await response.arrayBuffer()), format: "mp3" as const };
    },
  };
}
