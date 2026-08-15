// The full bounded loop behind `motife run` (and `motife eval`):
//   generate → [tts → render → stills → critique → revise?] × ≤(1+maxRevisions)
// Stops early the moment a critique returns zero error-severity issues;
// after the revision budget is spent, the last render ships as final.mp4
// with the unresolved issues recorded in report.md — a run FAILS only when
// generation/revision can't produce a valid document at all. Every stage
// writes the same run-dir artifacts the standalone subcommands do, so a
// half-finished run can be picked up by hand.
import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatIssues, parseDocument } from "../compiler";
import type { DslDocument } from "../dsl";
import { critiqueFrames } from "../critique/frames";
import type { CritiqueStillImage } from "../critique/critique";
import { runCritique } from "../critique/critique";
import { countBySeverity, renderCritiqueMarkdown } from "../critique/report";
import { backfillDurations } from "../tts/backfill";
import type { AudioManifest } from "../tts/manifest";
import { synthesizeDoc } from "../tts/synthesize";
import type { TtsProvider } from "../tts/provider";
import { generateDsl } from "./generate";
import type { LlmClient } from "./llm";
import { buildSystemPrompt } from "./prompt";
import { prepareRender, renderCritiqueStills, renderVideo } from "./render";
import { reviseDsl } from "./revise";
import { ensureRunDir, iterationPaths } from "./rundir";

export interface PipelineOptions {
  prompt: string;
  runRoot: string;
  generationClient: LlmClient;
  critiqueClient: LlmClient;
  /** null = render without narration (durations stay the LLM's estimates). */
  ttsProvider: TtsProvider | null;
  language?: string;
  fewShot?: number;
  maxGenerateAttempts?: number;
  /** Revision iterations AFTER the first render. Default 2 (≤3 renders). */
  maxRevisions?: number;
  ttsLeadSeconds?: number;
  ttsTailSeconds?: number;
  log?: (line: string) => void;
}

/** The pipeline's side-effecting stage functions, injectable so the loop's
 * control flow is unit-testable without a browser, bundler, or network.
 * Production callers (commands/run.ts, commands/eval.ts) pass nothing and
 * get the real implementations. */
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
}

export interface PipelineResult {
  ok: boolean;
  finalMp4: string | null;
  generateAttempts: number;
  iterations: IterationSummary[];
  /** True when the loop ended because critique came back clean. */
  clean: boolean;
  failureText?: string;
}

export async function runPipeline(
  options: PipelineOptions,
  stageOverrides: Partial<PipelineStages> = {},
): Promise<PipelineResult> {
  const stages = { ...DEFAULT_STAGES, ...stageOverrides };
  const log = options.log ?? (() => {});
  const maxRevisions = options.maxRevisions ?? 2;
  const paths = await ensureRunDir(options.runRoot, options.prompt);
  const systemPrompt = await stages.buildSystemPrompt({
    language: options.language,
    fewShot: options.fewShot,
  });

  // ---- generate ----------------------------------------------------------
  log("pipeline: generating DSL document");
  const generated = await generateDsl({
    client: options.generationClient,
    systemPrompt,
    userPrompt: options.prompt,
    maxAttempts: options.maxGenerateAttempts,
    onAttempt: async (record) => {
      const stem = path.join(paths.attemptsDir, String(record.attempt).padStart(2, "0"));
      await writeFile(`${stem}.dsl.json`, record.raw, "utf8");
      if (record.issuesText !== null) {
        await writeFile(`${stem}.issues.txt`, `${record.issuesText}\n`, "utf8");
        log(`pipeline: generate attempt ${record.attempt} rejected`);
      }
    },
  });
  if (!generated.ok) {
    await writeReport(paths.reportMd, options.prompt, generated.attempts.length, [], false, false);
    return {
      ok: false,
      finalMp4: null,
      generateAttempts: generated.attempts.length,
      iterations: [],
      clean: false,
      failureText: generated.failureText,
    };
  }
  await writeFile(paths.docJson, `${generated.json}\n`, "utf8");
  log(`pipeline: doc accepted after ${generated.attempts.length} attempt(s)`);

  // ---- iterate: tts → render → critique → revise -------------------------
  let serveUrl: string | undefined;
  const summaries: IterationSummary[] = [];
  let lastVideo: string | null = null;
  let clean = false;

  for (let iteration = 1; iteration <= maxRevisions + 1; iteration++) {
    const iterPaths = iterationPaths(options.runRoot, iteration);
    const rawText = await readFile(paths.docJson, "utf8");
    const rawDoc: unknown = JSON.parse(rawText);
    const doc = mustParse(rawDoc, paths.docJson);

    // TTS (cache makes re-runs cheap; only changed narration re-synthesizes).
    let renderDoc: unknown = rawDoc;
    let audio: AudioManifest | undefined;
    if (options.ttsProvider) {
      log(`pipeline: iteration ${iteration} — tts`);
      const tts = await stages.synthesizeDoc({
        doc,
        provider: options.ttsProvider,
        audioDir: paths.audioDir,
        manifestPath: paths.audioManifest,
        leadSeconds: options.ttsLeadSeconds,
        log,
      });
      audio = tts.manifest;
      renderDoc = backfillDurations(rawDoc, tts.manifest, {
        leadSeconds: options.ttsLeadSeconds,
        tailSeconds: options.ttsTailSeconds,
      });
      mustParse(renderDoc, "doc.tts.json (derived)");
      await writeFile(paths.docTtsJson, `${JSON.stringify(renderDoc, null, 2)}\n`, "utf8");
    }

    log(`pipeline: iteration ${iteration} — render`);
    const context = await stages.prepareRender({
      rawDoc: renderDoc,
      audio,
      publicDir: paths.publicDir,
      serveUrl,
    });
    serveUrl = context.serveUrl;
    await stages.renderVideo(context, iterPaths.videoMp4);
    lastVideo = iterPaths.videoMp4;

    const renderedDoc = mustParse(renderDoc, "render input");
    const stills = await stages.renderCritiqueStills(
      context,
      critiqueFrames(renderedDoc),
      iterPaths.stillsDir,
    );

    log(`pipeline: iteration ${iteration} — critique (${stills.length} stills)`);
    const stillImages: CritiqueStillImage[] = [];
    for (const still of stills) {
      stillImages.push({
        sceneId: still.sceneId,
        label: still.label,
        image: new Uint8Array(await readFile(still.filePath)),
        mediaType: "image/jpeg",
      });
    }
    const report = await stages.runCritique({
      client: options.critiqueClient,
      doc: renderedDoc,
      stills: stillImages,
    });
    await writeFile(iterPaths.critiqueJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const markdown = renderCritiqueMarkdown(report, iteration);
    await writeFile(iterPaths.critiqueMd, markdown, "utf8");

    const { errors, warnings } = countBySeverity(report);
    summaries.push({ iteration, errors, warnings });
    log(`pipeline: iteration ${iteration} — ${errors} error(s), ${warnings} warning(s)`);

    if (errors === 0) {
      clean = true;
      break;
    }
    if (iteration > maxRevisions) break;

    log(`pipeline: iteration ${iteration} — revising`);
    const revised = await reviseDsl({
      client: options.generationClient,
      systemPrompt,
      rawDocJson: rawText,
      critiqueMarkdown: markdown,
      onAttempt: async (record) => {
        const stem = path.join(iterPaths.root, `revise-${String(record.attempt).padStart(2, "0")}`);
        await writeFile(`${stem}.dsl.json`, record.raw, "utf8");
        if (record.issuesText !== null) {
          await writeFile(`${stem}.issues.txt`, `${record.issuesText}\n`, "utf8");
        }
      },
    });
    if (!revised.ok) {
      // A failed revision is not a failed run — ship the current render.
      log("pipeline: revision failed validation repeatedly — keeping current cut");
      break;
    }
    await copyFile(paths.docJson, path.join(iterPaths.root, "doc.before.json"));
    await writeFile(paths.docJson, `${revised.json}\n`, "utf8");
  }

  if (lastVideo) await copyFile(lastVideo, paths.finalMp4);
  await writeReport(
    paths.reportMd,
    options.prompt,
    generated.attempts.length,
    summaries,
    clean,
    lastVideo !== null,
  );
  return {
    ok: lastVideo !== null,
    finalMp4: lastVideo ? paths.finalMp4 : null,
    generateAttempts: generated.attempts.length,
    iterations: summaries,
    clean,
  };
}

function mustParse(input: unknown, label: string): DslDocument {
  const result = parseDocument(input);
  if (!result.ok) {
    throw new Error(`pipeline: ${label} failed validation:\n${formatIssues(label, result.issues)}`);
  }
  return result.doc;
}

async function writeReport(
  reportPath: string,
  prompt: string,
  generateAttempts: number,
  iterations: IterationSummary[],
  clean: boolean,
  rendered: boolean,
): Promise<void> {
  const lines = [
    "# motife run report",
    "",
    `**Prompt:** ${prompt}`,
    "",
    `- generate attempts: ${generateAttempts}${rendered ? "" : " (never produced a valid document)"}`,
  ];
  for (const summary of iterations) {
    lines.push(
      `- iteration ${summary.iteration}: ${summary.errors} error(s), ` +
        `${summary.warnings} warning(s) — see iterations/iter-${summary.iteration}/critique.md`,
    );
  }
  lines.push(
    "",
    rendered
      ? clean
        ? "Final render passed critique with zero errors."
        : "Revision budget exhausted — final.mp4 is the last render; unresolved issues are in the last iteration's critique.md."
      : "Run failed before rendering.",
  );
  await writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
}
