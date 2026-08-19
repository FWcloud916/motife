// `motife eval` — runs a concept set (baseline/stress/all) end-to-end
// (sequentially; each run already parallelizes nothing else on this
// machine) and writes a human-scoring report. `--set baseline` (the
// default) is Phase 3's acceptance run: three prompts in, three MP4s out,
// no manual intervention. `--set stress` is Phase 4's: 12 concepts outside
// the eval set and outside the system prompt's few-shot examples, probing
// for failure modes the deterministic-fix rounds haven't hit yet.
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
import { runPipeline } from "../pipeline";
import { selectConcepts, CONCEPT_SETS } from "../conceptSets";
import type { EvalRunResult } from "../evalReport";
import { renderEvalReport } from "../evalReport";
import { OptionError, integerOption } from "./optionValues";
import { createTtsProvider } from "../../tts/provider";
import type { TtsProvider } from "../../tts/provider";

const USAGE = `usage: pnpm motife eval [options]

Runs a concept set through the full pipeline into
out/eval/<date>/<set>[-<label>]/<concept>/ and writes report.md there with
a human-scoring table.

options:
  --set baseline|stress|all           which concept set (default baseline;
                                       ${CONCEPT_SETS.baseline.length} / ${CONCEPT_SETS.stress.length} / ${CONCEPT_SETS.all.length} concepts respectively)
  --label <name>                      distinguishes same-day/same-set runs,
                                       e.g. --label screen for a screening pass
  --provider / --model                generation LLM (as in \`motife run\`)
  --lang <bcp47>                      narration language (default zh-TW)
  --tts <name> / --voice <id>         TTS provider (default openai)
  --tts-model <id> / --tts-instructions <text>
                                       TTS model + OpenAI accent steering
  --no-audio                          skip TTS (旁白 can't be scored)
  --critique-provider / --critique-model
  --max-revisions <n>                 default 2
  --only <slug>                       run a single concept from the set (repeatable)`;

export async function run(argv: string[]): Promise<number> {
  let args;
  try {
    args = parseArgs({
      args: argv,
      options: {
        set: { type: "string" },
        label: { type: "string" },
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

  const selection = selectConcepts(args.values.set, args.values.only);
  if (!selection.ok) {
    console.error(`motife eval: ${selection.message}\n\n${USAGE}`);
    return 2;
  }
  const { set, concepts } = selection;

  let label: string | null = null;
  if (args.values.label !== undefined) {
    if (!/^[a-z0-9-]+$/.test(args.values.label)) {
      console.error(
        `motife eval: --label must match [a-z0-9-]+ (it becomes a directory name), got "${args.values.label}"\n\n${USAGE}`,
      );
      return 2;
    }
    label = args.values.label;
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
  const resolvedMaxRevisions = maxRevisions ?? 2;

  const provider = resolveProvider(args.values.provider);
  const model = resolveModel(provider, args.values.model);
  const critiqueProvider = resolveCritiqueProvider(args.values["critique-provider"]);
  const critiqueModel = resolveCritiqueModel(critiqueProvider, args.values["critique-model"]);

  // Constructed once, up front — the provider is a stateless closure over
  // apiKey/voice/model, identical for every concept, so this doesn't
  // change behavior; it fails fast before any LLM spend, and it gives
  // renderEvalReport the config to record (an eval report that doesn't say
  // which voice produced it isn't archivable — the same gap PR 1 closed
  // for critique issues).
  const ttsProvider: TtsProvider | null = args.values["no-audio"]
    ? null
    : createTtsProvider({
        flag: args.values.tts,
        voice: args.values.voice,
        model: args.values["tts-model"],
        instructions: args.values["tts-instructions"],
      });

  const date = new Date().toISOString().slice(0, 10);
  const setDir = label ? `${set}-${label}` : set;
  const evalRoot = path.join("out", "eval", date, setDir);
  await mkdir(evalRoot, { recursive: true });
  console.log(`eval: set=${set}${label ? ` label=${label}` : ""} root=${evalRoot} (${concepts.length} concept(s))`);

  const results: EvalRunResult[] = [];
  const reportPath = path.join(evalRoot, "report.md");

  for (const concept of concepts) {
    console.log(`\n=== eval: ${concept.slug} — ${concept.title} ===`);

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

    // Rewritten after every concept, not just at the end — a 12-concept
    // sequential run takes hours; a crash/kill partway through shouldn't
    // lose the report for every concept that already finished.
    await writeFile(
      reportPath,
      renderEvalReport({
        date,
        set,
        label,
        provider,
        model,
        maxRevisions: resolvedMaxRevisions,
        ttsProvider,
        results,
      }),
      "utf8",
    );
  }

  console.log(`\neval: report -> ${reportPath}`);

  const failed = results.filter((entry) => entry.error !== null);
  if (failed.length > 0) {
    console.error(`eval: ${failed.length}/${results.length} concept(s) failed`);
    return 1;
  }
  console.log(`eval: OK — ${results.length}/${results.length} concept(s) rendered`);
  return 0;
}
