import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { createTtsProvider } from "../../tts/provider";
import type { TtsProvider } from "../../tts/provider";
import { selectConcepts, CONCEPT_SETS } from "../conceptSets";
import type { EvalSetName } from "../conceptSets";
import type { ProviderName } from "../providers";
import type { EvalRunResult } from "../evalReport";
import { renderEvalReport } from "../evalReport";
import { createLlmClient } from "../llm";
import { persistedResult, runPipeline } from "../pipeline";
import type { PipelineResult } from "../pipeline";
import {
  resolveCritiqueModel,
  resolveCritiqueProvider,
  resolveModel,
  resolveProvider,
} from "../providers";
import {
  assertConfigMatches,
  assertDirectoryEmpty,
  readEvalState,
  writeEvalState,
} from "../state";
import type { EvalConceptState, EvalState, PipelineConfig } from "../state";
import { OptionError, integerOption } from "./optionValues";

const USAGE = `usage: pnpm motife eval [options]
       pnpm motife eval --resume <eval-dir> [--retry-failed] [--only <slug>...]

options:
  --set baseline|stress|all           concept set (default baseline;
                                       ${CONCEPT_SETS.baseline.length} / ${CONCEPT_SETS.stress.length} / ${CONCEPT_SETS.all.length})
  --label <name>                      output label for a new eval
  --resume <dir>                      resume persisted eval-state.json
  --retry-failed                      retry failed concepts from their safe checkpoints
  --only <slug>                       resume/run a subset (repeatable)
  --provider / --model                generation LLM
  --lang <bcp47>                      narration language (default zh-TW)
  --tts <name> / --voice <id>         TTS provider and voice
  --tts-model <id> / --tts-instructions <text>
  --no-audio                          skip TTS
  --critique-provider / --critique-model
  --max-revisions <n>                 default 2`;

export async function run(argv: string[]): Promise<number> {
  let args;
  try {
    args = parseArgs({
      args: argv,
      options: {
        set: { type: "string" }, label: { type: "string" }, resume: { type: "string" },
        "retry-failed": { type: "boolean" }, provider: { type: "string" }, model: { type: "string" },
        lang: { type: "string" }, tts: { type: "string" }, "tts-model": { type: "string" },
        voice: { type: "string" }, "tts-instructions": { type: "string" }, "no-audio": { type: "boolean" },
        "critique-provider": { type: "string" }, "critique-model": { type: "string" },
        "max-revisions": { type: "string" }, only: { type: "string", multiple: true },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (error) {
    console.error(`motife eval: ${(error as Error).message}\n\n${USAGE}`);
    return 2;
  }
  if (args.values.help) { console.log(USAGE); return 0; }

  let maxRevisions: number | undefined;
  try {
    maxRevisions = integerOption("--max-revisions", args.values["max-revisions"], { min: 0 });
  } catch (error) {
    if (error instanceof OptionError) { console.error(`motife eval: ${error.message}\n\n${USAGE}`); return 2; }
    throw error;
  }

  let state: EvalState;
  let evalRoot: string;
  if (args.values.resume) {
    evalRoot = args.values.resume;
    try {
      state = await readEvalState(evalRoot);
      validateResumeSelection(state, args.values.only);
    } catch (error) {
      console.error(`motife eval: ${(error as Error).message}`);
      return 2;
    }
    const requested = requestedConfig(args.values, maxRevisions);
    try { assertConfigMatches(state.config, requested); }
    catch (error) { console.error(`motife eval: ${(error as Error).message}`); return 2; }
    if (args.values.set !== undefined && args.values.set !== state.set) {
      console.error(`motife eval: --set does not match persisted set ${state.set}`); return 2;
    }
    if (args.values.label !== undefined && args.values.label !== state.label) {
      console.error("motife eval: --label does not match persisted label"); return 2;
    }
  } else {
    const selection = selectConcepts(args.values.set, args.values.only);
    if (!selection.ok) { console.error(`motife eval: ${selection.message}\n\n${USAGE}`); return 2; }
    let label: string | null = null;
    if (args.values.label !== undefined) {
      if (!/^[a-z0-9-]+$/.test(args.values.label)) {
        console.error(`motife eval: --label must match [a-z0-9-]+, got "${args.values.label}"`); return 2;
      }
      label = args.values.label;
    }
    const date = new Date().toISOString().slice(0, 10);
    evalRoot = path.join("out", "eval", date, label ? `${selection.set}-${label}` : selection.set);
    try { await assertDirectoryEmpty(evalRoot); }
    catch (error) { console.error(`motife eval: ${(error as Error).message}`); return 2; }
    const config = resolveNewConfig(args.values, maxRevisions);
    state = {
      kind: "motife-eval-state", schemaVersion: 1, contractVersion: 1, status: "pending",
      set: selection.set, label, date, config,
      concepts: selection.concepts.map((concept) => ({ ...concept, status: "pending", stage: "generate", elapsedMs: 0, lastError: null })),
      elapsedMs: 0, lastError: null, updatedAt: new Date().toISOString(),
    };
    await writeEvalState(evalRoot, state);
  }

  const config = state.config;
  const ttsProvider = createTtsFromConfig(config);
  await mkdir(evalRoot, { recursive: true });
  const reportPath = path.join(evalRoot, "report.md");
  const invocationStarted = Date.now();
  const elapsedAtStart = state.elapsedMs;
  const save = async (): Promise<void> => {
    state.elapsedMs = elapsedAtStart + (Date.now() - invocationStarted);
    await writeEvalState(evalRoot, state);
    await writeFile(reportPath, renderStateReport(state, ttsProvider, evalRoot), "utf8");
  };
  let interrupted = false;
  let activeConcept: EvalConceptState | null = null;
  const onInterrupt = (): void => {
    interrupted = true;
    state.status = "paused";
    state.lastError = "Interrupted by SIGINT";
    if (activeConcept?.status === "running") {
      activeConcept.status = "paused";
      activeConcept.lastError = "Interrupted by SIGINT";
    }
    void save();
  };
  process.once("SIGINT", onInterrupt);

  try {
    await save();
    if (interrupted) return 130;

    const only = new Set(args.values.only ?? state.concepts.map((concept) => concept.slug));
    const eligible = state.concepts.filter((concept) => {
      if (!only.has(concept.slug)) return false;
      if (concept.status === "pending" || concept.status === "paused") return true;
      return concept.status === "failed" && Boolean(args.values["retry-failed"]);
    });
    if (eligible.length === 0) {
      console.log(`eval: no eligible concepts; report -> ${reportPath}`);
      return state.status === "paused" ? 75 : state.concepts.some((c) => c.status === "failed") ? 1 : 0;
    }

    state.status = "running";
    await save();
    if (interrupted) return 130;
    for (const concept of eligible) {
    if (interrupted) return 130;
    activeConcept = concept;
    console.log(`\n=== eval: ${concept.slug} — ${concept.title} ===`);
    const started = Date.now();
    const hasRunState = await stateFileExists(path.join(evalRoot, concept.slug, "run-state.json"));
    concept.status = "running";
    concept.lastError = null;
    await save();
    const runRoot = path.join(evalRoot, concept.slug);
    let result: PipelineResult | null = null;
    try {
      result = await runPipeline({
        prompt: concept.prompt, runRoot,
        generationClient: createLlmClient({ provider: config.provider as Parameters<typeof createLlmClient>[0]["provider"], model: config.model }),
        critiqueClient: createLlmClient({ provider: config.critiqueProvider as Parameters<typeof createLlmClient>[0]["provider"], model: config.critiqueModel }),
        ttsProvider, config,
        resume: hasRunState,
        language: config.language, maxRevisions: config.maxRevisions,
        log: (line) => console.log(line),
      });
      concept.result = result;
      concept.status = result.status;
      concept.lastError = result.failureText ?? null;
    } catch (error) {
      concept.status = "failed";
      concept.lastError = (error as Error).message;
      console.error(`eval: ${concept.slug} crashed — ${concept.lastError}`);
    }
    concept.elapsedMs += Date.now() - started;
    try {
      const runState = await import("../state").then((module) => module.readRunState(runRoot));
      concept.stage = runState.stage;
    } catch { /* run state may not exist if setup failed */ }
    await save();

    if (concept.status === "paused") {
      state.status = "paused";
      state.lastError = concept.lastError;
      await save();
      console.error(`eval: PAUSED — resume with pnpm motife eval --resume ${evalRoot}`);
      return interrupted ? 130 : 75;
    }
    if (result?.status === "failed" && result.outcome === "aborted") {
      state.status = "failed";
      state.lastError = result.failureText ?? "fatal provider request";
      await save();
      return 1;
    }
    activeConcept = null;
  }

    state.status = state.concepts.some((concept) => concept.status === "failed") ? "failed" :
      state.concepts.every((concept) => concept.status === "completed") ? "completed" : "pending";
    await save();
    console.log(`\neval: report -> ${reportPath}`);
    return state.status === "failed" ? 1 : 0;
  } finally {
    process.removeListener("SIGINT", onInterrupt);
  }
}

function resolveNewConfig(values: Record<string, unknown>, maxRevisions: number | undefined): PipelineConfig {
  const provider = resolveProvider(values.provider as string | undefined);
  const critiqueProvider = resolveCritiqueProvider(values["critique-provider"] as string | undefined);
  const tts = values["no-audio"] ? null : createTtsProvider({
    flag: values.tts as string | undefined, voice: values.voice as string | undefined,
    model: values["tts-model"] as string | undefined, instructions: values["tts-instructions"] as string | undefined,
  });
  return {
    provider, model: resolveModel(provider, values.model as string | undefined),
    critiqueProvider, critiqueModel: resolveCritiqueModel(critiqueProvider, values["critique-model"] as string | undefined),
    language: (values.lang as string | undefined) ?? "zh-TW", maxRevisions: maxRevisions ?? 2,
    tts: tts ? { name: tts.name, voice: tts.voice, model: tts.model, ...(tts.instructions ? { instructions: tts.instructions } : {}) } : null,
  };
}

function requestedConfig(values: Record<string, unknown>, maxRevisions: number | undefined): Partial<PipelineConfig> {
  const requested: Partial<PipelineConfig> = {};
  if (values.provider !== undefined || envSet("MOTIFE_PROVIDER")) requested.provider = resolveProvider(values.provider as string | undefined);
  const provider = (requested.provider ?? resolveProvider(undefined)) as ProviderName;
  if (values.model !== undefined || envSet("MOTIFE_MODEL")) requested.model = resolveModel(provider, values.model as string | undefined);
  if (values["critique-provider"] !== undefined || envSet("MOTIFE_CRITIQUE_PROVIDER")) requested.critiqueProvider = resolveCritiqueProvider(values["critique-provider"] as string | undefined);
  const critiqueProvider = (requested.critiqueProvider ?? resolveCritiqueProvider(undefined)) as ProviderName;
  if (values["critique-model"] !== undefined || envSet("MOTIFE_CRITIQUE_MODEL")) requested.critiqueModel = resolveCritiqueModel(critiqueProvider, values["critique-model"] as string | undefined);
  if (values.lang !== undefined) requested.language = values.lang as string;
  if (values["max-revisions"] !== undefined) requested.maxRevisions = maxRevisions;
  if (values["no-audio"] || values.tts !== undefined || values.voice !== undefined || values["tts-model"] !== undefined || values["tts-instructions"] !== undefined || ["MOTIFE_TTS", "MOTIFE_TTS_MODEL", "MOTIFE_TTS_VOICE", "MOTIFE_TTS_INSTRUCTIONS"].some(envSet)) {
    const tts = values["no-audio"] ? null : createTtsProvider({ flag: values.tts as string | undefined, voice: values.voice as string | undefined, model: values["tts-model"] as string | undefined, instructions: values["tts-instructions"] as string | undefined });
    requested.tts = tts ? { name: tts.name, voice: tts.voice, model: tts.model, ...(tts.instructions ? { instructions: tts.instructions } : {}) } : null;
  }
  return requested;
}

function createTtsFromConfig(config: PipelineConfig): TtsProvider | null {
  return config.tts ? createTtsProvider({ flag: config.tts.name, voice: config.tts.voice, model: config.tts.model, instructions: config.tts.instructions }) : null;
}

function validateResumeSelection(state: EvalState, only: string[] | undefined): void {
  if (!only) return;
  const legal = new Set(state.concepts.map((concept) => concept.slug));
  const invalid = only.filter((slug) => !legal.has(slug));
  if (invalid.length) throw new Error(`--only contains concept(s) outside persisted set: ${invalid.join(", ")}`);
}

function renderStateReport(state: EvalState, ttsProvider: TtsProvider | null, evalRoot: string): string {
  const results: EvalRunResult[] = state.concepts.map((concept) => ({
    slug: concept.slug, title: concept.title,
    result: concept.result ? persistedResult(concept.result) : null,
    error: concept.lastError,
    elapsedSeconds: Math.round(concept.elapsedMs / 1000),
    status: concept.status,
    stage: concept.stage,
    resumeCommand: `pnpm motife eval --resume ${evalRoot} --only ${concept.slug}${concept.status === "failed" ? " --retry-failed" : ""}`,
  }));
  return renderEvalReport({ date: state.date, set: state.set as EvalSetName, label: state.label, provider: state.config.provider, model: state.config.model, maxRevisions: state.config.maxRevisions, ttsProvider, results });
}

async function stateFileExists(file: string): Promise<boolean> {
  try { await import("node:fs/promises").then((module) => module.stat(file)); return true; }
  catch { return false; }
}

function envSet(name: string): boolean { return (process.env[name]?.trim().length ?? 0) > 0; }
