// `motife generate` — prompt → validated doc.json in a run directory.
// The LLM-facing loop lives in ../generate.ts; this file is arg parsing
// and attempt persistence only.
import { parseArgs } from "node:util";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createLlmClient } from "../llm";
import { resolveModel, resolveProvider } from "../providers";
import { buildSystemPrompt } from "../prompt";
import { generateDsl } from "../generate";
import { defaultRunRoot, ensureRunDir } from "../rundir";
import { OptionError, integerOption } from "./optionValues";

const USAGE = `usage: pnpm motife generate --prompt "<concept>" [options]

options:
  --prompt <text>        the concept to explain (required)
  --run <dir>            run directory (default: out/runs/<date>-<slug>)
  --provider <name>      anthropic | openai | google | xai | groq
  --model <id>           model id (default per provider)
  --lang <bcp47>         narration language (default zh-TW)
  --few-shot <n>         number of example docs in the system prompt (0-3, default 3)
  --max-attempts <n>     validation retry budget (default 4)`;

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
        "few-shot": { type: "string" },
        "max-attempts": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (err) {
    console.error(`motife generate: ${(err as Error).message}\n\n${USAGE}`);
    return 2;
  }
  if (args.values.help) {
    console.log(USAGE);
    return 0;
  }
  const prompt = args.values.prompt;
  if (!prompt) {
    console.error(`motife generate: --prompt is required\n\n${USAGE}`);
    return 2;
  }

  let fewShot: number | undefined;
  let maxAttempts: number | undefined;
  try {
    fewShot = integerOption("--few-shot", args.values["few-shot"], { min: 0, max: 3 });
    maxAttempts = integerOption("--max-attempts", args.values["max-attempts"], { min: 1 });
  } catch (err) {
    if (err instanceof OptionError) {
      console.error(`motife generate: ${err.message}\n\n${USAGE}`);
      return 2;
    }
    throw err;
  }

  const provider = resolveProvider(args.values.provider);
  const model = resolveModel(provider, args.values.model);
  const client = createLlmClient({ provider, model });

  const systemPrompt = await buildSystemPrompt({
    language: args.values.lang,
    fewShot,
  });

  const runRoot = args.values.run ?? defaultRunRoot(prompt);
  const paths = await ensureRunDir(runRoot, prompt);
  console.log(`run directory: ${paths.root}`);
  console.log(`provider: ${provider} (${model})`);

  const result = await generateDsl({
    client,
    systemPrompt,
    userPrompt: prompt,
    maxAttempts,
    onAttempt: async (record) => {
      const stem = path.join(paths.attemptsDir, String(record.attempt).padStart(2, "0"));
      await writeFile(`${stem}.dsl.json`, record.raw, "utf8");
      if (record.issuesText !== null) {
        await writeFile(`${stem}.issues.txt`, `${record.issuesText}\n`, "utf8");
        console.error(`attempt ${record.attempt}: rejected —\n${record.issuesText}\n`);
      } else {
        console.log(`attempt ${record.attempt}: accepted`);
      }
    },
  });

  if (!result.ok) {
    console.error(
      `motife generate: gave up after ${result.attempts.length} attempts — ` +
        `see ${paths.attemptsDir}/ for the full history.`,
    );
    return 1;
  }

  await writeFile(paths.docJson, `${result.json}\n`, "utf8");
  if (result.warningsText) {
    console.warn(`${result.warningsText}\n`);
  }
  console.log(`wrote ${paths.docJson} (doc id: ${result.doc.id})`);
  console.log(`next: pnpm motife tts ${paths.docJson} --run ${paths.root}`);
  return 0;
}
