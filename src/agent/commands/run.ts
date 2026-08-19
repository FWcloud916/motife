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
import { assertConfigMatches, readRunState } from "../state";
import type { PipelineConfig } from "../state";
import { persistedResult } from "../pipeline";

const USAGE = `usage: pnpm motife run --prompt "<concept>" [options]
       pnpm motife run --resume <run-dir> [--retry-failed]

options:
  --prompt <text>             the concept to explain (required)
  --run <dir>                 run directory (default: out/runs/<date>-<slug>)
  --resume <dir>              resume a versioned run-state.json checkpoint
  --retry-failed              allow a failed run to continue from its last safe stage
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
        resume: { type: "string" },
        "retry-failed": { type: "boolean" },
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
  if (args.values.run && args.values.resume) {
    console.error(`motife run: --run and --resume are mutually exclusive\n\n${USAGE}`);
    return 2;
  }

  let savedState = null;
  if (args.values.resume) {
    try {
      savedState = await readRunState(args.values.resume);
    } catch (error) {
      console.error(`motife run: ${(error as Error).message}`);
      return 2;
    }
    if (savedState.status === "failed" && !args.values["retry-failed"]) {
      console.error("motife run: failed checkpoints require --retry-failed");
      return 2;
    }
    if (args.values.prompt && args.values.prompt !== savedState.prompt) {
      console.error("motife run: --prompt does not match the persisted prompt; create a new run instead.");
      return 2;
    }
    if (savedState.status === "completed" && savedState.result) {
      const result = persistedResult(savedState.result);
      console.log(`motife run: already completed -> ${result.finalMp4}`);
      return 0;
    }
  }
  const prompt = savedState?.prompt ?? args.values.prompt;
  if (!prompt) {
    console.error(`motife run: --prompt is required for a new run\n\n${USAGE}`);
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

  let provider = resolveProvider(args.values.provider);
  let model = resolveModel(provider, args.values.model);
  let critiqueProvider = resolveCritiqueProvider(args.values["critique-provider"]);
  let critiqueModel = resolveCritiqueModel(critiqueProvider, args.values["critique-model"]);

  let ttsProvider: TtsProvider | null = args.values["no-audio"]
    ? null
    : createTtsProvider({
        flag: args.values.tts,
        voice: args.values.voice,
        model: args.values["tts-model"],
        instructions: args.values["tts-instructions"],
      });

  let config: PipelineConfig = {
    provider,
    model,
    critiqueProvider,
    critiqueModel,
    language: args.values.lang ?? "zh-TW",
    maxRevisions: maxRevisions ?? 2,
    tts: ttsProvider
      ? { name: ttsProvider.name, voice: ttsProvider.voice, model: ttsProvider.model, ...(ttsProvider.instructions ? { instructions: ttsProvider.instructions } : {}) }
      : null,
  };
  if (savedState) {
    const requested: Partial<PipelineConfig> = {};
    if (args.values.provider !== undefined || envSet("MOTIFE_PROVIDER")) requested.provider = provider;
    if (args.values.model !== undefined || envSet("MOTIFE_MODEL")) requested.model = model;
    if (args.values["critique-provider"] !== undefined || envSet("MOTIFE_CRITIQUE_PROVIDER")) requested.critiqueProvider = critiqueProvider;
    if (args.values["critique-model"] !== undefined || envSet("MOTIFE_CRITIQUE_MODEL")) requested.critiqueModel = critiqueModel;
    if (args.values.lang !== undefined) requested.language = args.values.lang;
    if (args.values["max-revisions"] !== undefined) requested.maxRevisions = maxRevisions;
    if (args.values["no-audio"] || args.values.tts !== undefined || args.values.voice !== undefined || args.values["tts-model"] !== undefined || args.values["tts-instructions"] !== undefined || envSet("MOTIFE_TTS") || envSet("MOTIFE_TTS_MODEL") || envSet("MOTIFE_TTS_VOICE") || envSet("MOTIFE_TTS_INSTRUCTIONS")) {
      requested.tts = config.tts;
    }
    try {
      assertConfigMatches(savedState.config, requested);
    } catch (error) {
      console.error(`motife run: ${(error as Error).message}`);
      return 2;
    }
    config = savedState.config;
    provider = config.provider as typeof provider;
    model = config.model;
    critiqueProvider = config.critiqueProvider as typeof critiqueProvider;
    critiqueModel = config.critiqueModel;
    maxRevisions = config.maxRevisions;
    ttsProvider = config.tts
      ? createTtsProvider({ flag: config.tts.name, voice: config.tts.voice, model: config.tts.model, instructions: config.tts.instructions })
      : null;
  }

  const runRoot = args.values.resume ?? args.values.run ?? defaultRunRoot(prompt);
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
    config,
    resume: Boolean(savedState),
    language: config.language,
    maxRevisions,
    log: (line) => console.log(line),
  });

  if (result.status === "paused") {
    console.error(`motife run: PAUSED — ${result.failureText ?? "provider interrupted"}`);
    return result.failureText === "Interrupted by SIGINT" ? 130 : 75;
  }
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

function envSet(name: string): boolean {
  return (process.env[name]?.trim().length ?? 0) > 0;
}
