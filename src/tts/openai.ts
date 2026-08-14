// OpenAI TTS — POST /v1/audio/speech, one call per scene narration.
import type { TtsProvider } from "./provider";

const DEFAULT_MODEL = "gpt-4o-mini-tts";
const DEFAULT_VOICE = "alloy";

export function createOpenAiTts(options: { voice?: string; model?: string } = {}): TtsProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI TTS needs OPENAI_API_KEY set (via .env or the environment).");
  }
  const voice = options.voice ?? DEFAULT_VOICE;
  const model = options.model ?? DEFAULT_MODEL;
  return {
    name: "openai",
    voice,
    async synthesize(text: string) {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, voice, input: text, response_format: "mp3" }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`OpenAI TTS failed (${response.status}): ${detail.slice(0, 500)}`);
      }
      return { audio: new Uint8Array(await response.arrayBuffer()), format: "mp3" as const };
    },
  };
}
