// Durable generate → TTS → render → stills → critique → revise pipeline.
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatIssues, parseDocument } from "../compiler";
import type { DslIssue } from "../compiler";
import type { DslDocument } from "../dsl";
import { critiqueReportSchema, runCritique } from "../critique/critique";
import type { CritiqueIssue, CritiqueStillImage } from "../critique/critique";
import { critiqueFrames } from "../critique/frames";
import { countBySeverity, renderCritiqueMarkdown } from "../critique/report";
import { backfillDurations } from "../tts/backfill";
import { parseAudioManifest } from "../tts/manifest";
import type { AudioManifest } from "../tts/manifest";
import { synthesizeDoc } from "../tts/synthesize";
import type { TtsProvider } from "../tts/provider";
import { generateDsl } from "./generate";
import type { LlmClient } from "./llm";
import { buildSystemPrompt } from "./prompt";
import { isProviderError } from "./providerError";
import { prepareRender, renderCritiqueStills, renderVideo, stillFileName } from "./render";
import { reviseDsl } from "./revise";
import { ensureRunDir, iterationPaths } from "./rundir";
import { assertConfigMatches, assertDirectoryEmpty, hashValue, persistedPipelineResultSchema, readRunState, writeRunState } from "./state";
import type { PipelineConfig, PipelineStage, RunState } from "./state";

export interface PipelineOptions {
  prompt: string;
  runRoot: string;
  generationClient: LlmClient;
  critiqueClient: LlmClient;
  ttsProvider: TtsProvider | null;
  config?: PipelineConfig;
  resume?: boolean;
  language?: string;
  fewShot?: number;
  maxGenerateAttempts?: number;
  maxRevisions?: number;
  ttsLeadSeconds?: number;
  ttsTailSeconds?: number;
  log?: (line: string) => void;
}

export interface PipelineStages {
  buildSystemPrompt: typeof buildSystemPrompt;
  prepareRender: typeof prepareRender;
  renderVideo: typeof renderVideo;
  renderCritiqueStills: typeof renderCritiqueStills;
  runCritique: typeof runCritique;
  synthesizeDoc: typeof synthesizeDoc;
}

const DEFAULT_STAGES: PipelineStages = {
  buildSystemPrompt,
  prepareRender,
  renderVideo,
  renderCritiqueStills,
  runCritique,
  synthesizeDoc,
};

export interface IterationSummary {
  iteration: number;
  errors: number;
  warnings: number;
  issues: CritiqueIssue[];
  docWarnings: DslIssue[];
}

export type PipelineStatus = "completed" | "paused" | "failed";

export interface PipelineResult {
  status: PipelineStatus;
  ok: boolean;
  finalMp4: string | null;
  generateAttempts: number;
  iterations: IterationSummary[];
  clean: boolean;
  outcome: RunOutcome;
  shippedIteration: number | null;
  failureText?: string;
}

interface BestIteration {
  iteration: number;
  video: string;
  docSnapshot: string;
  errors: number;
  warnings: number;
}

class PipelineInterrupted extends Error {
  constructor() {
    super("Interrupted by SIGINT");
    this.name = "PipelineInterrupted";
  }
}

const FALLBACK_CONFIG: PipelineConfig = {
  provider: "injected",
  model: "injected",
  critiqueProvider: "injected",
  critiqueModel: "injected",
  language: "zh-TW",
  maxRevisions: 2,
  tts: null,
};

export async function runPipeline(
  options: PipelineOptions,
  stageOverrides: Partial<PipelineStages> = {},
): Promise<PipelineResult> {
  const stages = { ...DEFAULT_STAGES, ...stageOverrides };
  const log = options.log ?? (() => {});
  const maxRevisions = options.maxRevisions ?? options.config?.maxRevisions ?? 2;
  const config: PipelineConfig = options.config ?? {
    ...FALLBACK_CONFIG,
    language: options.language ?? FALLBACK_CONFIG.language,
    maxRevisions,
    tts: options.ttsProvider
      ? {
          name: options.ttsProvider.name,
          voice: options.ttsProvider.voice,
          model: options.ttsProvider.model,
          ...(options.ttsProvider.instructions ? { instructions: options.ttsProvider.instructions } : {}),
        }
      : null,
  };
  let state = await initializeState(options, config);
  if (state.status === "completed" && state.result) return persistedResult(state.result);

  const invocationStarted = Date.now();
  const elapsedAtStart = state.elapsedMs;
  const paths = await ensureRunDir(options.runRoot, options.prompt);
  let currentStage: PipelineStage = state.stage;
  const save = async (patch: Partial<RunState> = {}): Promise<void> => {
    state = {
      ...state,
      ...patch,
      elapsedMs: elapsedAtStart + (Date.now() - invocationStarted),
      updatedAt: new Date().toISOString(),
    };
    await writeRunState(options.runRoot, state);
  };

  let best = await restoreBest(options.runRoot, state);
  const summaries = restoreSummaries(state);
  let lastVideo: string | null = best?.video ?? null;
  let interrupted = false;
  let interruptedWrite: Promise<void> | null = null;
  const onInterrupt = (): void => {
    if (interrupted) return;
    interrupted = true;
    interruptedWrite = save({ status: "paused", stage: currentStage, lastError: "Interrupted by SIGINT" }).catch(() => undefined);
  };
  const checkInterrupted = (): void => {
    if (interrupted) throw new PipelineInterrupted();
  };
  process.once("SIGINT", onInterrupt);

  const shipAndReport = async (
    outcome: RunOutcome,
    status: PipelineStatus,
    failureText?: string,
  ): Promise<PipelineResult> => {
    if (best) {
      await copyFile(best.video, paths.finalMp4);
      await copyFile(best.docSnapshot, paths.docFinalJson);
    }
    const result: PipelineResult = {
      status,
      ok: status === "completed" && lastVideo !== null,
      finalMp4: lastVideo ? paths.finalMp4 : null,
      generateAttempts: state.generateAttempts,
      iterations: summaries,
      clean: outcome === "clean",
      outcome,
      shippedIteration: best?.iteration ?? null,
      ...(failureText ? { failureText } : {}),
    };
    await writeReport(paths.reportMd, options.prompt, state.generateAttempts, summaries, outcome, lastVideo !== null, best?.iteration ?? null);
    await save({
      status: status === "completed" ? "completed" : status,
      stage: status === "completed" ? "finalize" : currentStage,
      bestIteration: best?.iteration ?? null,
      result,
      lastError: failureText ?? null,
    });
    return result;
  };

  try {
    await save({ status: "running", lastError: null });
    const systemPrompt = await stages.buildSystemPrompt({ language: config.language, fewShot: options.fewShot });
    checkInterrupted();

    if (!state.acceptedDocJson) {
      currentStage = "generate";
      await save({ stage: currentStage });
      log("pipeline: generating DSL document");
      const generated = await generateDsl({
        client: options.generationClient,
        systemPrompt,
        userPrompt: options.prompt,
        maxAttempts: options.maxGenerateAttempts,
        onAttempt: async (record) => {
          state.llmAttempts.push({ kind: "generate", iteration: null, ...record });
          state.generateAttempts = record.attempt;
          await save();
          const stem = path.join(paths.attemptsDir, String(record.attempt).padStart(2, "0"));
          await writeFile(`${stem}.dsl.json`, record.raw, "utf8");
          if (record.issuesText !== null) await writeFile(`${stem}.issues.txt`, `${record.issuesText}\n`, "utf8");
        },
      });
      checkInterrupted();
      if (!generated.ok) return shipAndReport("generation-failed", "failed", generated.failureText);
      // The paid accepted response is durable before doc.json.
      await save({ acceptedDocJson: generated.json, generateAttempts: generated.attempts.length });
    }
    await writeFile(paths.docJson, `${state.acceptedDocJson}\n`, "utf8");

    let serveUrl: string | undefined;
    for (let iteration = state.iteration; iteration <= maxRevisions + 1; iteration++) {
      state.iteration = iteration;
      const iterPaths = iterationPaths(options.runRoot, iteration);
      await mkdir(iterPaths.root, { recursive: true });
      let persisted = state.iterations.find((entry) => entry.iteration === iteration);
      if (!persisted) {
        const docJson = state.acceptedDocJson ?? (await readFile(paths.docJson, "utf8"));
        persisted = { iteration, docJson, docHash: hashValue(docJson) };
        state.iterations.push(persisted);
        await save();
      }
      const rawText = persisted.docJson;
      const rawDoc: unknown = JSON.parse(rawText);
      const { doc, warnings: docWarnings } = mustParse(rawDoc, paths.docJson);
      await writeFile(paths.docJson, `${rawText.trim()}\n`, "utf8");

      let renderDoc: unknown = rawDoc;
      let renderedDoc = doc;
      let audio: AudioManifest | undefined;
      if (options.ttsProvider) {
        currentStage = "tts";
        await save({ stage: currentStage });
        const ttsInputHash = hashValue({ doc: persisted.docHash, tts: config.tts, lead: options.ttsLeadSeconds, tail: options.ttsTailSeconds });
        const cached = persisted.ttsInputHash === ttsInputHash
          ? await readCompleteTts(paths.audioManifest, paths.docTtsJson, paths.audioDir, doc)
          : null;
        if (cached) {
          ({ audio, renderDoc, renderedDoc } = cached);
          log(`pipeline: iteration ${iteration} — tts checkpoint reused`);
        } else {
          log(`pipeline: iteration ${iteration} — tts`);
          const tts = await stages.synthesizeDoc({
            doc,
            provider: options.ttsProvider,
            audioDir: paths.audioDir,
            manifestPath: paths.audioManifest,
            leadSeconds: options.ttsLeadSeconds,
            log,
            onSceneComplete: async () => save(),
          });
          checkInterrupted();
          audio = tts.manifest;
          renderDoc = backfillDurations(rawDoc, tts.manifest, { leadSeconds: options.ttsLeadSeconds, tailSeconds: options.ttsTailSeconds });
          renderedDoc = mustParse(renderDoc, "doc.tts.json (derived)").doc;
          await writeFile(paths.docTtsJson, `${JSON.stringify(renderDoc, null, 2)}\n`, "utf8");
          persisted.ttsInputHash = ttsInputHash;
          await save();
        }
      }

      const renderInputHash = hashValue({ doc: renderDoc, audio });
      currentStage = "render";
      await save({ stage: currentStage });
      const context = await stages.prepareRender({ rawDoc: renderDoc, audio, publicDir: paths.publicDir, serveUrl });
      checkInterrupted();
      serveUrl = context.serveUrl;
      if (persisted.renderInputHash !== renderInputHash || !(await nonEmptyFile(iterPaths.videoMp4))) {
        log(`pipeline: iteration ${iteration} — render`);
        await stages.renderVideo(context, iterPaths.videoMp4);
        checkInterrupted();
        await writeFile(iterPaths.docJson, `${rawText.trim()}\n`, "utf8");
        persisted.renderInputHash = renderInputHash;
        delete persisted.stillsInputHash;
        delete persisted.critiqueInputHash;
        delete persisted.critiqueReport;
        delete persisted.summary;
        await save();
      } else log(`pipeline: iteration ${iteration} — render checkpoint reused`);
      lastVideo = iterPaths.videoMp4;

      const frames = critiqueFrames(renderedDoc);
      const stillsInputHash = hashValue({ renderInputHash, frames });
      currentStage = "stills";
      await save({ stage: currentStage });
      let stills = frames.map((frame) => ({ ...frame, filePath: path.join(iterPaths.stillsDir, stillFileName(frame)) }));
      if (persisted.stillsInputHash !== stillsInputHash || !(await allFilesExist(stills.map((entry) => entry.filePath)))) {
        stills = await stages.renderCritiqueStills(context, frames, iterPaths.stillsDir);
        checkInterrupted();
        persisted.stillsInputHash = stillsInputHash;
        delete persisted.critiqueInputHash;
        delete persisted.critiqueReport;
        delete persisted.summary;
        await save();
      } else log(`pipeline: iteration ${iteration} — stills checkpoint reused`);

      const critiqueInputHash = hashValue({ stillsInputHash, doc: renderDoc, provider: config.critiqueProvider, model: config.critiqueModel });
      currentStage = "critique";
      await save({ stage: currentStage });
      let report;
      const savedCritique = persisted.critiqueInputHash === critiqueInputHash
        ? critiqueReportSchema.safeParse(persisted.critiqueReport)
        : null;
      if (savedCritique?.success) {
        report = savedCritique.data;
        log(`pipeline: iteration ${iteration} — critique checkpoint reused`);
      } else {
        const stillImages: CritiqueStillImage[] = [];
        for (const still of stills) {
          stillImages.push({ sceneId: still.sceneId, label: still.label, image: new Uint8Array(await readFile(still.filePath)), mediaType: "image/jpeg" });
        }
        report = await stages.runCritique({ client: options.critiqueClient, doc: renderedDoc, stills: stillImages });
        checkInterrupted();
        persisted.critiqueInputHash = critiqueInputHash;
        persisted.critiqueReport = report;
        await save();
      }
      await writeFile(iterPaths.critiqueJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      const markdown = renderCritiqueMarkdown(report, iteration);
      await writeFile(iterPaths.critiqueMd, markdown, "utf8");
      const { errors, warnings } = countBySeverity(report);
      const summary: IterationSummary = { iteration, errors, warnings, issues: report.issues, docWarnings: [...docWarnings] };
      persisted.summary = summary;
      replaceSummary(summaries, summary);
      await save();

      const isBetter = !best || errors < best.errors || (errors === best.errors && warnings < best.warnings);
      if (isBetter) {
        best = { iteration, video: iterPaths.videoMp4, docSnapshot: iterPaths.docJson, errors, warnings };
        state.bestIteration = iteration;
        await copyFile(best.video, paths.finalMp4);
        await copyFile(best.docSnapshot, paths.docFinalJson);
        await save();
      }
      if (errors === 0) return shipAndReport("clean", "completed");
      if (iteration > maxRevisions) return shipAndReport("exhausted", "completed");

      currentStage = "revise";
      await save({ stage: currentStage });
      if (!persisted.revisedDocJson) {
        const revised = await reviseDsl({
          client: options.generationClient,
          systemPrompt,
          rawDocJson: rawText,
          critiqueMarkdown: markdown,
          onAttempt: async (record) => {
            state.llmAttempts.push({ kind: "revise", iteration, ...record });
            await save();
            const stem = path.join(iterPaths.root, `revise-${String(record.attempt).padStart(2, "0")}`);
            await writeFile(`${stem}.dsl.json`, record.raw, "utf8");
            if (record.issuesText !== null) await writeFile(`${stem}.issues.txt`, `${record.issuesText}\n`, "utf8");
          },
        });
        checkInterrupted();
        if (!revised.ok) return shipAndReport("revision-failed", "completed", revised.failureText);
        persisted.revisedDocJson = revised.json;
        await save();
      }
      await copyFile(paths.docJson, path.join(iterPaths.root, "doc.before.json"));
      await writeFile(paths.docJson, `${persisted.revisedDocJson.trim()}\n`, "utf8");
      state.acceptedDocJson = persisted.revisedDocJson;
      state.iteration = iteration + 1;
      await save({ stage: "tts" });
    }
    return shipAndReport("exhausted", "completed");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof PipelineInterrupted) {
      if (interruptedWrite) await interruptedWrite;
      return shipAndReport("paused", "paused", error.message);
    }
    if (isProviderError(error)) {
      if (error.recoverable) return shipAndReport("paused", "paused", message);
      return shipAndReport("aborted", "failed", message);
    }
    await save({ status: "failed", stage: currentStage, lastError: message });
    if (best) {
      await copyFile(best.video, paths.finalMp4);
      await copyFile(best.docSnapshot, paths.docFinalJson);
    }
    await writeReport(paths.reportMd, options.prompt, state.generateAttempts, summaries, "aborted", Boolean(best), best?.iteration ?? null);
    throw error;
  } finally {
    process.removeListener("SIGINT", onInterrupt);
  }
}

async function initializeState(options: PipelineOptions, config: PipelineConfig): Promise<RunState> {
  if (options.resume) {
    const state = await readRunState(options.runRoot);
    if (state.prompt !== options.prompt) throw new Error("resume prompt does not match run-state.json");
    assertConfigMatches(state.config, config);
    return state;
  }
  await assertDirectoryEmpty(options.runRoot);
  const state: RunState = {
    kind: "motife-run-state",
    schemaVersion: 1,
    contractVersion: 1,
    status: "pending",
    prompt: options.prompt,
    config,
    stage: "generate",
    iteration: 1,
    generateAttempts: 0,
    llmAttempts: [],
    iterations: [],
    bestIteration: null,
    lastError: null,
    elapsedMs: 0,
    updatedAt: new Date().toISOString(),
  };
  await writeRunState(options.runRoot, state);
  return state;
}

export function persistedResult(value: unknown): PipelineResult {
  const parsed = persistedPipelineResultSchema.safeParse(value);
  if (!parsed.success) throw new Error("run state contains an invalid persisted result");
  return parsed.data as PipelineResult;
}

function restoreSummaries(state: RunState): IterationSummary[] {
  return state.iterations.flatMap((entry) => entry.summary ? [entry.summary as IterationSummary] : []);
}

async function restoreBest(runRoot: string, state: RunState): Promise<BestIteration | null> {
  if (!state.bestIteration) return null;
  const entry = state.iterations.find((candidate) => candidate.iteration === state.bestIteration);
  const summary = entry?.summary as IterationSummary | undefined;
  if (!entry || !summary) return null;
  const paths = iterationPaths(runRoot, entry.iteration);
  if (!(await nonEmptyFile(paths.videoMp4)) || !(await nonEmptyFile(paths.docJson))) return null;
  return { iteration: entry.iteration, video: paths.videoMp4, docSnapshot: paths.docJson, errors: summary.errors, warnings: summary.warnings };
}

async function readCompleteTts(
  manifestPath: string,
  docTtsPath: string,
  audioDir: string,
  doc: DslDocument,
): Promise<{ audio: AudioManifest; renderDoc: unknown; renderedDoc: DslDocument } | null> {
  try {
    const audio = parseAudioManifest(JSON.parse(await readFile(manifestPath, "utf8")));
    if (!audio) return null;
    for (const scene of doc.scenes) {
      if (!audio.scenes[scene.id] || !(await nonEmptyFile(path.join(audioDir, `${scene.id}.mp3`)))) return null;
    }
    const renderDoc: unknown = JSON.parse(await readFile(docTtsPath, "utf8"));
    return { audio, renderDoc, renderedDoc: mustParse(renderDoc, docTtsPath).doc };
  } catch {
    return null;
  }
}

async function nonEmptyFile(filePath: string): Promise<boolean> {
  try {
    const info = await stat(filePath);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

async function allFilesExist(files: string[]): Promise<boolean> {
  return (await Promise.all(files.map(nonEmptyFile))).every(Boolean);
}

function replaceSummary(summaries: IterationSummary[], next: IterationSummary): void {
  const index = summaries.findIndex((entry) => entry.iteration === next.iteration);
  if (index === -1) summaries.push(next);
  else summaries[index] = next;
}

function mustParse(input: unknown, label: string): { doc: DslDocument; warnings: readonly DslIssue[] } {
  const result = parseDocument(input);
  if (!result.ok) throw new Error(`pipeline: ${label} failed validation:\n${formatIssues(label, result.issues)}`);
  return { doc: result.doc, warnings: result.warnings };
}

export type RunOutcome = "clean" | "exhausted" | "revision-failed" | "aborted" | "generation-failed" | "paused";

export const OUTCOME_LABELS: Record<RunOutcome, string> = {
  clean: "critique clean",
  exhausted: "revision budget exhausted",
  "revision-failed": "revision never validated",
  aborted: "aborted mid-run",
  "generation-failed": "generation never validated",
  paused: "paused by provider interruption",
};

const OUTCOME_NOTES: Record<RunOutcome, string> = {
  clean: "Final render passed critique with zero errors.",
  exhausted: "Revision budget exhausted — final.mp4 is the best-scoring render; unresolved issues are in its iteration's critique.md.",
  "revision-failed": "Revision never passed validation — final.mp4 is the best-scoring render so far.",
  aborted: "Run aborted by an error mid-iteration — resume with `pnpm motife run --resume <run-dir> --retry-failed`.",
  "generation-failed": "Run failed before rendering.",
  paused: "Provider interrupted the run. The last safe checkpoint is durable; resume with `pnpm motife run --resume <run-dir>`.",
};

async function writeReport(
  reportPath: string,
  prompt: string,
  generateAttempts: number,
  iterations: IterationSummary[],
  outcome: RunOutcome,
  rendered: boolean,
  shippedIteration: number | null,
): Promise<void> {
  const lines = ["# motife run report", "", `**Prompt:** ${prompt}`, "", `- generate attempts: ${generateAttempts}${rendered ? "" : " (never produced a valid document)"}`];
  for (const summary of iterations) {
    const marker = summary.iteration === shippedIteration ? " (shipped as final.mp4)" : "";
    lines.push(`- iteration ${summary.iteration}: ${summary.errors} error(s), ${summary.warnings} warning(s)${marker} — see iterations/iter-${summary.iteration}/critique.md`);
  }
  lines.push("", OUTCOME_NOTES[outcome]);
  await writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
}
