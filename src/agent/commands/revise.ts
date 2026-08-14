// `motife revise --run <dir> --iter <n>` — applies an iteration's critique
// to doc.json via an LLM revision pass (same parseDocument retry loop as
// generation). The pre-revision doc is archived into the iteration dir;
// re-run `motife tts` afterwards — its narration-hash cache re-synthesizes
// only scenes whose narration actually changed.
import { parseArgs } from "node:util";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createLlmClient } from "../llm";
import { resolveModel, resolveProvider } from "../providers";
import { buildSystemPrompt } from "../prompt";
import { reviseDsl } from "../revise";
import { iterationPaths, runPaths } from "../rundir";

const USAGE = `usage: pnpm motife revise --run <dir> [options]

Reads <run>/iterations/iter-<n>/critique.md, asks the LLM for a corrected
document, and overwrites <run>/doc.json (previous version archived as
iter-<n>/doc.before.json).

options:
  --run <dir>        run directory (required)
  --iter <n>         iteration whose critique to apply (default 1)
  --provider <name>  anthropic | openai | google | xai | groq
  --model <id>       model id (default per provider)
  --lang <bcp47>     narration language for the system prompt (default zh-TW)`;

export async function run(argv: string[]): Promise<number> {
  let args;
  try {
    args = parseArgs({
      args: argv,
      options: {
        run: { type: "string" },
        iter: { type: "string" },
        provider: { type: "string" },
        model: { type: "string" },
        lang: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (err) {
    console.error(`motife revise: ${(err as Error).message}\n\n${USAGE}`);
    return 2;
  }
  if (args.values.help) {
    console.log(USAGE);
    return 0;
  }
  const runRoot = args.values.run;
  if (!runRoot) {
    console.error(`motife revise: --run <dir> is required\n\n${USAGE}`);
    return 2;
  }
  const iteration = args.values.iter === undefined ? 1 : Number(args.values.iter);
  const paths = runPaths(runRoot);
  const iterPaths = iterationPaths(runRoot, iteration);

  let critiqueMarkdown: string;
  try {
    critiqueMarkdown = await readFile(iterPaths.critiqueMd, "utf8");
  } catch {
    console.error(
      `motife revise: no critique at ${iterPaths.critiqueMd} — run ` +
        `\`pnpm motife critique --run ${runRoot} --iter ${iteration}\` first.`,
    );
    return 2;
  }
  const rawDocJson = await readFile(paths.docJson, "utf8");

  const provider = resolveProvider(args.values.provider);
  const model = resolveModel(provider, args.values.model);
  const client = createLlmClient({ provider, model });
  const systemPrompt = await buildSystemPrompt({ language: args.values.lang });
  console.log(`revise: applying iteration ${iteration} critique via ${provider} (${model})`);

  const result = await reviseDsl({
    client,
    systemPrompt,
    rawDocJson,
    critiqueMarkdown,
    onAttempt: async (record) => {
      const stem = path.join(iterPaths.root, `revise-${String(record.attempt).padStart(2, "0")}`);
      await writeFile(`${stem}.dsl.json`, record.raw, "utf8");
      if (record.issuesText !== null) {
        await writeFile(`${stem}.issues.txt`, `${record.issuesText}\n`, "utf8");
        console.error(`revise attempt ${record.attempt}: rejected —\n${record.issuesText}\n`);
      } else {
        console.log(`revise attempt ${record.attempt}: accepted`);
      }
    },
  });

  if (!result.ok) {
    console.error(
      `motife revise: gave up after ${result.attempts.length} attempts — doc.json left unchanged.`,
    );
    return 1;
  }

  await copyFile(paths.docJson, path.join(iterPaths.root, "doc.before.json"));
  await writeFile(paths.docJson, `${result.json}\n`, "utf8");
  if (result.warningsText) console.warn(`${result.warningsText}\n`);
  console.log(`wrote ${paths.docJson} (doc id: ${result.doc.id})`);
  console.log(`next: pnpm motife tts --run ${paths.root}  (only changed narration re-synthesizes)`);
  return 0;
}
