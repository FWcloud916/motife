// `motife run --prompt "…"` — the whole pipeline, one command:
// generate → tts → render → critique → revise, bounded. The Phase 3
// acceptance shape: 一句 prompt 進、一支 MP4 出。
import { parseArgs } from "node:util";
import { createLlmClient } from "../llm";
import {
  resolveCritiqueModel,
  resolveCritiqueProvider,
  resolveModel,
  resolveProvider,
} from "../providers";
import { runPipeline } from "../pipeline";
import { defaultRunRoot } from "../rundir";
import { createOpenAiTts } from "../../tts/openai";
import { createElevenLabsTts } from "../../tts/elevenlabs";
import { resolveTtsProviderName } from "../../tts/provider";
import type { TtsProvider } from "../../tts/provider";

const USAGE = `usage: pnpm motife run --prompt "<concept>" [options]

options:
  --prompt <text>             the concept to explain (required)
  --run <dir>                 run directory (default: out/runs/<date>-<slug>)
  --provider <name>           generation LLM (anthropic | openai | google | xai | groq)
  --model <id>                generation model id
  --lang <bcp47>              narration language (default zh-TW)
  --tts <name>                openai | elevenlabs (default openai)
  --voice <id>                TTS voice
  --no-audio                  skip TTS; durations stay the LLM's estimates
  --critique-provider <name>  vision provider (default anthropic)
  --critique-model <id>       vision model id
  --max-revisions <n>         critique-revision iterations after the first render (default 2)`;

export async function run(argv: string[]): Promise<number> {
  let args;
  try {
    args = parseArgs({
      args: argv,
      options: {
        prompt: { type: "string" },
        run: { type: "string" },
        provider: { type: "string" },
        model: { type: "string" },
        lang: { type: "string" },
        tts: { type: "string" },
        voice: { type: "string" },
        "no-audio": { type: "boolean" },
        "critique-provider": { type: "string" },
        "critique-model": { type: "string" },
        "max-revisions": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (err) {
    console.error(`motife run: ${(err as Error).message}\n\n${USAGE}`);
    return 2;
  }
  if (args.values.help) {
    console.log(USAGE);
    return 0;
  }
  const prompt = args.values.prompt;
  if (!prompt) {
    console.error(`motife run: --prompt is required\n\n${USAGE}`);
    return 2;
  }

  const provider = resolveProvider(args.values.provider);
  const model = resolveModel(provider, args.values.model);
  const critiqueProvider = resolveCritiqueProvider(args.values["critique-provider"]);
  const critiqueModel = resolveCritiqueModel(critiqueProvider, args.values["critique-model"]);

  let ttsProvider: TtsProvider | null = null;
  if (!args.values["no-audio"]) {
    const ttsName = resolveTtsProviderName(args.values.tts);
    ttsProvider =
      ttsName === "openai"
        ? createOpenAiTts({ voice: args.values.voice })
        : createElevenLabsTts({ voice: args.values.voice });
  }

  const runRoot = args.values.run ?? defaultRunRoot(prompt);
  console.log(`run directory: ${runRoot}`);
  console.log(`generation: ${provider} (${model}); critique: ${critiqueProvider} (${critiqueModel})`);
  console.log(ttsProvider ? `tts: ${ttsProvider.name} (${ttsProvider.voice})` : "tts: disabled");

  const result = await runPipeline({
    prompt,
    runRoot,
    generationClient: createLlmClient({ provider, model }),
    critiqueClient: createLlmClient({ provider: critiqueProvider, model: critiqueModel }),
    ttsProvider,
    language: args.values.lang,
    maxRevisions:
      args.values["max-revisions"] === undefined
        ? undefined
        : Number(args.values["max-revisions"]),
    log: (line) => console.log(line),
  });

  if (!result.ok) {
    console.error(`motife run: FAILED — ${result.failureText ?? "no video produced"}`);
    return 1;
  }
  console.log(
    `motife run: OK -> ${result.finalMp4} ` +
      `(${result.iterations.length} iteration(s), ${result.clean ? "critique clean" : "revision budget exhausted"})`,
  );
  return 0;
}
