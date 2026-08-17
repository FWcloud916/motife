// `motife eval` — runs every eval concept end-to-end (sequentially; each
// run already parallelizes nothing else on this machine) and writes a
// human-scoring report. This is Phase 3's acceptance run: three prompts
// in, three MP4s out, no manual intervention.
import { parseArgs } from "node:util";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createLlmClient } from "../llm";
import {
  resolveCritiqueModel,
  resolveCritiqueProvider,
  resolveModel,
  resolveProvider,
} from "../providers";
import type { PipelineResult } from "../pipeline";
import { runPipeline } from "../pipeline";
import { EVAL_CONCEPTS } from "../evalConcepts";
import { OptionError, integerOption } from "./optionValues";
import { createTtsProvider } from "../../tts/provider";
import type { TtsProvider } from "../../tts/provider";

const USAGE = `usage: pnpm motife eval [options]

Runs all ${EVAL_CONCEPTS.length} eval concepts through the full pipeline into
out/eval/<date>/<concept>/ and writes out/eval/<date>/report.md with a
human-scoring table.

options:
  --provider / --model                generation LLM (as in \`motife run\`)
  --lang <bcp47>                      narration language (default zh-TW)
  --tts <name> / --voice <id>         TTS provider (default openai)
  --no-audio                          skip TTS
  --critique-provider / --critique-model
  --max-revisions <n>                 default 2
  --only <slug>                       run a single concept (repeatable)`;

export async function run(argv: string[]): Promise<number> {
  let args;
  try {
    args = parseArgs({
      args: argv,
      options: {
        provider: { type: "string" },
        model: { type: "string" },
        lang: { type: "string" },
        tts: { type: "string" },
        voice: { type: "string" },
        "no-audio": { type: "boolean" },
        "critique-provider": { type: "string" },
        "critique-model": { type: "string" },
        "max-revisions": { type: "string" },
        only: { type: "string", multiple: true },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (err) {
    console.error(`motife eval: ${(err as Error).message}\n\n${USAGE}`);
    return 2;
  }
  if (args.values.help) {
    console.log(USAGE);
    return 0;
  }

  const only = args.values.only;
  const concepts = only?.length
    ? EVAL_CONCEPTS.filter((concept) => only.includes(concept.slug))
    : EVAL_CONCEPTS;
  if (concepts.length === 0) {
    console.error(
      `motife eval: no concepts match --only (known: ${EVAL_CONCEPTS.map((c) => c.slug).join(", ")})`,
    );
    return 2;
  }

  let maxRevisions: number | undefined;
  try {
    maxRevisions = integerOption("--max-revisions", args.values["max-revisions"], { min: 0 });
  } catch (err) {
    if (err instanceof OptionError) {
      console.error(`motife eval: ${err.message}\n\n${USAGE}`);
      return 2;
    }
    throw err;
  }

  const provider = resolveProvider(args.values.provider);
  const model = resolveModel(provider, args.values.model);
  const critiqueProvider = resolveCritiqueProvider(args.values["critique-provider"]);
  const critiqueModel = resolveCritiqueModel(critiqueProvider, args.values["critique-model"]);

  const date = new Date().toISOString().slice(0, 10);
  const evalRoot = path.join("out", "eval", date);
  await mkdir(evalRoot, { recursive: true });

  const results: Array<{
    slug: string;
    title: string;
    result: PipelineResult | null;
    error: string | null;
    elapsedSeconds: number;
  }> = [];

  for (const concept of concepts) {
    console.log(`\n=== eval: ${concept.slug} — ${concept.title} ===`);
    // A fresh TTS provider per concept keeps voice/env resolution simple.
    const ttsProvider: TtsProvider | null = args.values["no-audio"]
      ? null
      : createTtsProvider({ flag: args.values.tts, voice: args.values.voice });

    const started = Date.now();
    try {
      const result = await runPipeline({
        prompt: concept.prompt,
        runRoot: path.join(evalRoot, concept.slug),
        generationClient: createLlmClient({ provider, model }),
        critiqueClient: createLlmClient({ provider: critiqueProvider, model: critiqueModel }),
        ttsProvider,
        language: args.values.lang,
        maxRevisions,
        log: (line) => console.log(line),
      });
      results.push({
        slug: concept.slug,
        title: concept.title,
        result,
        error: result.ok ? null : (result.failureText ?? "no video produced"),
        elapsedSeconds: Math.round((Date.now() - started) / 1000),
      });
    } catch (err) {
      // One concept failing must not sink the other runs.
      console.error(`eval: ${concept.slug} crashed — ${(err as Error).message}`);
      results.push({
        slug: concept.slug,
        title: concept.title,
        result: null,
        error: (err as Error).message,
        elapsedSeconds: Math.round((Date.now() - started) / 1000),
      });
    }
  }

  const reportPath = path.join(evalRoot, "report.md");
  await writeFile(reportPath, renderEvalReport(date, provider, model, results), "utf8");
  console.log(`\neval: report -> ${reportPath}`);

  const failed = results.filter((entry) => entry.error !== null);
  if (failed.length > 0) {
    console.error(`eval: ${failed.length}/${results.length} concept(s) failed`);
    return 1;
  }
  console.log(`eval: OK — ${results.length}/${results.length} concept(s) rendered`);
  return 0;
}

function renderEvalReport(
  date: string,
  provider: string,
  model: string,
  results: Array<{
    slug: string;
    title: string;
    result: PipelineResult | null;
    error: string | null;
    elapsedSeconds: number;
  }>,
): string {
  const lines = [
    `# motife eval — ${date}`,
    "",
    `Generation: ${provider} (${model}). Full pipeline, no manual intervention.`,
    "",
  ];

  for (const entry of results) {
    lines.push(`## ${entry.slug} — ${entry.title}`, "");
    if (entry.error !== null || entry.result === null) {
      lines.push(`**FAILED** after ${entry.elapsedSeconds}s: ${entry.error}`, "");
      continue;
    }
    const r = entry.result;
    lines.push(
      `- video: \`${entry.slug}/final.mp4\` (iteration ${r.shippedIteration ?? "?"} of ${r.iterations.length})`,
      `- generate attempts: ${r.generateAttempts}`,
      ...r.iterations.flatMap((iter) => [
        `- iteration ${iter.iteration}: ${iter.errors} error(s), ${iter.warnings} warning(s)` +
          (iter.iteration === r.shippedIteration ? " (shipped)" : "") +
          ` (\`${entry.slug}/iterations/iter-${iter.iteration}/critique.md\`)`,
        ...iter.issues.map(
          (issue) =>
            `  - **${issue.severity.toUpperCase()} / ${issue.kind}** [${issue.sceneId}] ${issue.description} — fix: ${issue.suggestion}`,
        ),
      ]),
      `- outcome: ${r.clean ? "critique clean" : "revision budget exhausted"}`,
      `- elapsed: ${entry.elapsedSeconds}s`,
      "",
    );
  }

  lines.push(
    "## 人工評分（1–5,看完影片後填寫）",
    "",
    "| 概念 | 內容正確性 | 版面品質 | 節奏 | 旁白 | 備註 |",
    "|---|---|---|---|---|---|",
    ...results.map((entry) => `| ${entry.slug} |  |  |  |  |  |`),
    "",
    "及格線：每項 ≥3 且無 1 分項（motife-plan.md §3 Phase 3 驗收）。",
  );
  return `${lines.join("\n")}\n`;
}
