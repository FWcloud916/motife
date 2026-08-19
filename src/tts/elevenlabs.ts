// ElevenLabs TTS — POST /v1/text-to-speech/{voiceId}, one call per scene.
import { DEFAULT_TTS_MODELS } from "./defaults";
import type { TtsProvider } from "./provider";

export function createElevenLabsTts(options: { voice?: string; model?: string } = {}): TtsProvider {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ElevenLabs TTS needs ELEVENLABS_API_KEY set (via .env or the environment).");
  }
  // A voice id is account-specific; there is no safe universal default.
  const voice = options.voice ?? process.env.ELEVENLABS_VOICE_ID;
  if (!voice) {
    throw new Error(
      "ElevenLabs TTS needs a voice id — pass --voice <id> or set ELEVENLABS_VOICE_ID.",
    );
  }
  const model = options.model ?? DEFAULT_TTS_MODELS.elevenlabs;
  return {
    name: "elevenlabs",
    voice,
    model,
    async synthesize(text: string) {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text, model_id: model }),
        },
      );
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`ElevenLabs TTS failed (${response.status}): ${detail.slice(0, 500)}`);
      }
      return { audio: new Uint8Array(await response.arrayBuffer()), format: "mp3" as const };
    },
  };
}
