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
import { OptionError, integerOption } from "./optionValues";
import { createTtsProvider } from "../../tts/provider";
import type { TtsProvider } from "../../tts/provider";

const USAGE = `usage: pnpm motife run --prompt "<concept>" [options]

options:
  --prompt <text>             the concept to explain (required)
  --run <dir>                 run directory (default: out/runs/<date>-<slug>)
  --provider <name>           generation LLM (anthropic | openai | google | xai | groq)
  --model <id>                generation model id
  --lang <bcp47>              narration language (default zh-TW)
  --tts <name>                openai | elevenlabs (default openai)
  --tts-model <id>            TTS model (openai default gpt-4o-mini-tts;
                              elevenlabs default eleven_multilingual_v2)
  --voice <id>                TTS voice
  --tts-instructions <text>   OpenAI gpt-4o-mini-tts style/accent steering
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
        "tts-model": { type: "string" },
        voice: { type: "string" },
        "tts-instructions": { type: "string" },
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

  let maxRevisions: number | undefined;
  try {
    maxRevisions = integerOption("--max-revisions", args.values["max-revisions"], { min: 0 });
  } catch (err) {
    if (err instanceof OptionError) {
      console.error(`motife run: ${err.message}\n\n${USAGE}`);
      return 2;
    }
    throw err;
  }

  const provider = resolveProvider(args.values.provider);
  const model = resolveModel(provider, args.values.model);
  const critiqueProvider = resolveCritiqueProvider(args.values["critique-provider"]);
  const critiqueModel = resolveCritiqueModel(critiqueProvider, args.values["critique-model"]);

  const ttsProvider: TtsProvider | null = args.values["no-audio"]
    ? null
    : createTtsProvider({
        flag: args.values.tts,
        voice: args.values.voice,
        model: args.values["tts-model"],
        instructions: args.values["tts-instructions"],
      });

  const runRoot = args.values.run ?? defaultRunRoot(prompt);
  console.log(`run directory: ${runRoot}`);
  console.log(`generation: ${provider} (${model}); critique: ${critiqueProvider} (${critiqueModel})`);
  console.log(
    ttsProvider
      ? `tts: ${ttsProvider.name} (voice ${ttsProvider.voice}, model ${ttsProvider.model})` +
          (ttsProvider.instructions ? " +instructions" : "")
      : "tts: disabled",
  );

  const result = await runPipeline({
    prompt,
    runRoot,
    generationClient: createLlmClient({ provider, model }),
    critiqueClient: createLlmClient({ provider: critiqueProvider, model: critiqueModel }),
    ttsProvider,
    language: args.values.lang,
    maxRevisions,
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
