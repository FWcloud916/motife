// The full bounded loop behind `motife run` (and `motife eval`):
//   generate → [tts → render → stills → critique → revise?] × ≤(1+maxRevisions)
// Stops early the moment a critique returns zero error-severity issues;
// after the revision budget is spent, the BEST-SCORING render ships as
// final.mp4 (not necessarily the last — a revision can regress, not just
// fix, layout) with the unresolved issues recorded in report.md — a run
// FAILS only when generation/revision can't produce a valid document at
// all. Every stage writes the same run-dir artifacts the standalone
// subcommands do, so a half-finished run can be picked up by hand.
import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatIssues, parseDocument } from "../compiler";
import type { DslIssue } from "../compiler";
import type { DslDocument } from "../dsl";
import { critiqueFrames } from "../critique/frames";
import type { CritiqueIssue, CritiqueStillImage } from "../critique/critique";
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
  issues: CritiqueIssue[];
  /** Validation warnings on the document that produced THIS iteration's
   * render — from the pre-TTS parse (PR 3's layout-budget lints are
   * duration-independent; the post-TTS parse would add narration_pacing
   * churn from backfilled durations). Empty for a doc with no warnings.
   * Errors never appear here: an error-severity issue fails parseDocument,
   * which either blocks generation entirely (generation-failed) or is
   * impossible to reach mid-loop (every doc.json written here already
   * passed parseDocument in generateDsl/reviseDsl). */
  docWarnings: readonly DslIssue[];
}

export interface PipelineResult {
  ok: boolean;
  finalMp4: string | null;
  generateAttempts: number;
  iterations: IterationSummary[];
  /** True when the loop ended because critique came back clean. Equivalent
   * to `outcome === "clean"` — kept as its own field since existing
   * callers already read it. */
  clean: boolean;
  /** How the run ended — see RunOutcome. Surfaced here (not just written
   * to the run-dir report.md) so a caller like `motife eval` can render
   * more than "clean" vs. "revision budget exhausted": a revision that
   * never validated and a mid-run crash are different outcomes, not the
   * same failure. */
  outcome: RunOutcome;
  /** Which iteration's render was copied to final.mp4 — the best-scoring
   * one (fewest errors, then fewest warnings, then earliest on a tie), not
   * necessarily the last. Null when no iteration ever completed critique. */
  shippedIteration: number | null;
  failureText?: string;
}

/** Tracks the best-scoring iteration seen so far so a regression late in
 * the revision loop (critique can make layout worse, not just better)
 * doesn't ship a worse cut than an earlier iteration already produced. */
interface BestIteration {
  iteration: number;
  video: string;
  docSnapshot: string;
  errors: number;
  warnings: number;
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
    await writeReport(
      paths.reportMd,
      options.prompt,
      generated.attempts.length,
      [],
      "generation-failed",
      false,
      null,
    );
    return {
      ok: false,
      finalMp4: null,
      generateAttempts: generated.attempts.length,
      iterations: [],
      clean: false,
      outcome: "generation-failed",
      shippedIteration: null,
      failureText: generated.failureText,
    };
  }
  await writeFile(paths.docJson, `${generated.json}\n`, "utf8");
  log(`pipeline: doc accepted after ${generated.attempts.length} attempt(s)`);

  // ---- iterate: tts → render → critique → revise -------------------------
  let serveUrl: string | undefined;
  const summaries: IterationSummary[] = [];
  let lastVideo: string | null = null;
  let best: BestIteration | null = null;
  let clean = false;
  let outcome: RunOutcome = "aborted";

  // try/finally, not try/catch: a stage that throws still aborts the run
  // (the caller sees the rejection), but the run directory keeps its
  // promise of being resumable by hand — the last finished render is
  // copied to final.mp4 and report.md records how far the run got.
  try {
  for (let iteration = 1; iteration <= maxRevisions + 1; iteration++) {
    const iterPaths = iterationPaths(options.runRoot, iteration);
    const rawText = await readFile(paths.docJson, "utf8");
    const rawDoc: unknown = JSON.parse(rawText);
    const { doc, warnings: docWarnings } = mustParse(rawDoc, paths.docJson);

    // TTS (cache makes re-runs cheap; only changed narration re-synthesizes).
    let renderDoc: unknown = rawDoc;
    let renderedDoc = doc;
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
      // TTS-derived warnings (e.g. narration_pacing shifts) are discarded
      // here on purpose — PR 3's layout-budget lints, which docWarnings
      // exists to surface, are duration-independent, and the pre-TTS
      // warnings captured above already cover them.
      renderedDoc = mustParse(renderDoc, "doc.tts.json (derived)").doc;
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
    // Snapshot the pre-TTS doc that produced this render — doc.json itself
    // gets overwritten by the next revision, so this is the only record of
    // what generated this iteration's video.
    await writeFile(iterPaths.docJson, rawText, "utf8");

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
    summaries.push({ iteration, errors, warnings, issues: report.issues, docWarnings });
    log(`pipeline: iteration ${iteration} — ${errors} error(s), ${warnings} warning(s)`);

    // Ties keep the EARLIER iteration — a revision that doesn't improve on
    // the score is a revision that diverged from generation for nothing.
    const isBetter =
      best === null || errors < best.errors || (errors === best.errors && warnings < best.warnings);
    if (isBetter) {
      best = { iteration, video: iterPaths.videoMp4, docSnapshot: iterPaths.docJson, errors, warnings };
    }

    if (errors === 0) {
      clean = true;
      outcome = "clean";
      break;
    }
    if (iteration > maxRevisions) {
      outcome = "exhausted";
      break;
    }

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
      outcome = "revision-failed";
      break;
    }
    await copyFile(paths.docJson, path.join(iterPaths.root, "doc.before.json"));
    await writeFile(paths.docJson, `${revised.json}\n`, "utf8");
  }
  } finally {
    // Ship the best-scoring iteration, not necessarily the last — a
    // revision can make layout worse, not just fix it (observed: the
    // db-index eval run regressed 1→2 errors before recovering to 1).
    const shipVideo = best?.video ?? lastVideo;
    if (shipVideo) await copyFile(shipVideo, paths.finalMp4);
    if (best) await copyFile(best.docSnapshot, paths.docFinalJson);
    await writeReport(
      paths.reportMd,
      options.prompt,
      generated.attempts.length,
      summaries,
      outcome,
      shipVideo !== null,
      best?.iteration ?? null,
    );
  }
  return {
    ok: lastVideo !== null,
    finalMp4: lastVideo ? paths.finalMp4 : null,
    generateAttempts: generated.attempts.length,
    iterations: summaries,
    clean,
    outcome,
    shippedIteration: best?.iteration ?? null,
  };
}

function mustParse(input: unknown, label: string): { doc: DslDocument; warnings: readonly DslIssue[] } {
  const result = parseDocument(input);
  if (!result.ok) {
    throw new Error(`pipeline: ${label} failed validation:\n${formatIssues(label, result.issues)}`);
  }
  return { doc: result.doc, warnings: result.warnings };
}

export type RunOutcome = "clean" | "exhausted" | "revision-failed" | "aborted" | "generation-failed";

/** Short, caller-facing labels for PipelineResult.outcome — the long prose
 * lives in OUTCOME_NOTES below, for the run-dir's own report.md. Note
 * "aborted" never reaches a CALLER: a throwing stage rethrows past the
 * `finally` (see the try/finally comment above), so it only ever appears
 * in the run-dir report.md written on the way out, never in a returned
 * PipelineResult — a caller sees the rejection instead. Included here
 * anyway for Record completeness and because OUTCOME_NOTES needs it. */
export const OUTCOME_LABELS: Record<RunOutcome, string> = {
  clean: "critique clean",
  exhausted: "revision budget exhausted",
  "revision-failed": "revision never validated",
  aborted: "aborted mid-run",
  "generation-failed": "generation never validated",
};

const OUTCOME_NOTES: Record<RunOutcome, string> = {
  clean: "Final render passed critique with zero errors.",
  exhausted:
    "Revision budget exhausted — final.mp4 is the best-scoring render (fewest errors, then fewest warnings, then earliest on a tie), not necessarily the last; unresolved issues are in its iteration's critique.md.",
  "revision-failed":
    "Revision never passed validation — final.mp4 is the best-scoring render so far; the critique it did not absorb is in its iteration's critique.md.",
  aborted:
    "Run aborted by an error mid-iteration — final.mp4 (when present) is the best-scoring COMPLETED render; the run directory is resumable by hand.",
  "generation-failed": "Run failed before rendering.",
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
  const lines = [
    "# motife run report",
    "",
    `**Prompt:** ${prompt}`,
    "",
    `- generate attempts: ${generateAttempts}${rendered ? "" : " (never produced a valid document)"}`,
  ];
  for (const summary of iterations) {
    const marker = summary.iteration === shippedIteration ? " (shipped as final.mp4)" : "";
    lines.push(
      `- iteration ${summary.iteration}: ${summary.errors} error(s), ` +
        `${summary.warnings} warning(s)${marker} — see iterations/iter-${summary.iteration}/critique.md`,
    );
  }
  lines.push("", OUTCOME_NOTES[outcome]);
  await writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
}
