// The eval report renderer — split out of commands/eval.ts (PR 5) so it's
// unit-testable without pulling in that file's AI-SDK-touching imports
// (only `import type` here, same discipline as src/critique/report.ts).
import type { PipelineResult, RunOutcome } from "./pipeline";
import { OUTCOME_LABELS } from "./pipeline";
import type { TtsProvider } from "../tts/provider";
import type { EvalSetName } from "./conceptSets";

/** One concept's eval outcome. Was duplicated verbatim in commands/eval.ts
 * before PR 5 (once for the accumulator, once for renderEvalReport's own
 * parameter type) — now a single named type both share. */
export interface EvalRunResult {
  slug: string;
  title: string;
  result: PipelineResult | null;
  error: string | null;
  elapsedSeconds: number;
  status?: "pending" | "running" | "paused" | "completed" | "failed";
  stage?: "generate" | "tts" | "render" | "stills" | "critique" | "revise" | "finalize";
  resumeCommand?: string;
}

export interface EvalReportOptions {
  date: string;
  set: EvalSetName;
  /** --label, if given — distinguishes same-day/same-set runs (a
   * screening pass vs. a full pass). */
  label: string | null;
  provider: string;
  model: string;
  maxRevisions: number;
  ttsProvider: TtsProvider | null;
  results: readonly EvalRunResult[];
}

const SET_FOOTER: Record<EvalSetName, string> = {
  baseline:
    "及格線：每項 ≥3 且無 1 分項，版面品質 ≥4，備註欄不再出現三個已知失敗模式" +
    "（裁切/運鏡超出範圍/口音重）（motife-plan.md §3 Phase 4 驗收 1）。",
  stress:
    "及格線：每項 ≥3 且無 1 分項；整體需 ≥8/12 支通過（motife-plan.md §3 Phase 4 驗收 2）。",
  all: "見上——本次涵蓋 baseline（驗收 1）與 stress（驗收 2）兩組概念，各自的及格線分開適用。",
};

export function renderEvalReport(options: EvalReportOptions): string {
  const { date, set, label, provider, model, maxRevisions, ttsProvider, results } = options;

  const ttsLine = ttsProvider
    ? `TTS: ${ttsProvider.name} (voice ${ttsProvider.voice}, model ${ttsProvider.model})` +
      (ttsProvider.instructions ? `; instructions: "${ttsProvider.instructions}"` : "")
    : "TTS: disabled (--no-audio)";

  const lines = [
    `# motife eval — ${date}${label ? ` (${label})` : ""}`,
    "",
    `Set: ${set} (${results.length} concept(s))`,
    `Generation: ${provider} (${model}). Max revisions: ${maxRevisions}. Full pipeline, no manual intervention.`,
    ttsLine,
    "",
  ];

  for (const entry of results) {
    lines.push(`## ${entry.slug} — ${entry.title}`, "");
    if (entry.result === null) {
      if (entry.status === "pending" || entry.status === "running" || entry.status === "paused") {
        lines.push(
          `**${entry.status.toUpperCase()}** — last safe stage: ${entry.stage ?? "generate"}.`,
          ...(entry.error ? [`Last error: ${entry.error}`] : []),
          ...(entry.resumeCommand ? [`Resume: \`${entry.resumeCommand}\``] : []),
          "",
        );
      } else {
        lines.push(`**CRASHED** mid-run after ${entry.elapsedSeconds}s: ${entry.error}`, ...(entry.resumeCommand ? [`Resume: \`${entry.resumeCommand}\``] : []), "");
      }
      continue;
    }
    const r = entry.result;
    if (r.status === "paused") {
      lines.push(
        `**PAUSED** after ${entry.elapsedSeconds}s — last safe stage: ${entry.stage ?? "generate"}.`,
        `Last error: ${entry.error ?? r.failureText ?? "provider interrupted"}`,
        ...(entry.resumeCommand ? [`Resume: \`${entry.resumeCommand}\``] : []),
        "",
      );
      continue;
    }
    if (!r.ok) {
      lines.push(
        `**FAILED** (${OUTCOME_LABELS[r.outcome]}) after ${entry.elapsedSeconds}s: ${entry.error}`,
        "",
      );
      continue;
    }
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
        ...iter.docWarnings.map(
          (w) =>
            `  - **WARN / ${w.code}** \`${w.path}\` ${w.message} — fix: ${w.fix}`,
        ),
      ]),
      `- outcome: ${OUTCOME_LABELS[r.outcome]}`,
      `- elapsed: ${entry.elapsedSeconds}s`,
      "",
    );
  }

  lines.push(...renderFailureModeSummary(results));

  const scoringHeader = ttsProvider
    ? "| 概念 | 內容正確性 | 版面品質 | 節奏 | 旁白 | 備註 |"
    : "| 概念 | 內容正確性 | 版面品質 | 節奏 | 旁白（n/a — --no-audio）| 備註 |";
  lines.push(
    "## 人工評分（1–5，看完影片後填寫）",
    "",
    scoringHeader,
    "|---|---|---|---|---|---|",
    ...results.map((entry) =>
      ttsProvider
        ? `| ${entry.slug} |  |  |  |  |  |`
        : `| ${entry.slug} |  |  | n/a |  |`,
    ),
    "",
  );
  if (!ttsProvider) {
    lines.push("本次為 --no-audio 篩選，旁白無法評分。", "");
  }
  lines.push(SET_FOOTER[set]);

  return `${lines.join("\n")}\n`;
}

/** Groups every concept's unresolved-at-ship critique issues (by `kind`)
 * and every iteration's validation warnings (by lint `code`, deduped per
 * concept so 3 iterations repeating the same warning count once) — the
 * input PR 6's fix queue consumes directly. */
function renderFailureModeSummary(results: readonly EvalRunResult[]): string[] {
  const critiqueByKind = new Map<string, Set<string>>();
  const lintByCode = new Map<string, Set<string>>();

  for (const entry of results) {
    if (entry.result === null || !entry.result.ok) continue;
    const r = entry.result;
    const shipped = r.iterations.find((iter) => iter.iteration === r.shippedIteration);
    for (const issue of shipped?.issues ?? []) {
      addTo(critiqueByKind, issue.kind, entry.slug);
    }
    for (const iter of r.iterations) {
      for (const w of iter.docWarnings) {
        addTo(lintByCode, w.code, entry.slug);
      }
    }
  }

  if (critiqueByKind.size === 0 && lintByCode.size === 0) {
    return ["## 失敗模式彙整（自動彙總，供下一輪確定性修復佇列使用）", "", "無。", ""];
  }

  const rows: string[] = [];
  for (const [kind, slugs] of critiqueByKind) {
    rows.push(`| critique (未解決 error) | ${kind} | ${slugs.size} | ${[...slugs].join(", ")} |`);
  }
  for (const [code, slugs] of lintByCode) {
    rows.push(`| 版面 lint (warning) | ${code} | ${slugs.size} | ${[...slugs].join(", ")} |`);
  }

  return [
    "## 失敗模式彙整（自動彙總，供下一輪確定性修復佇列使用）",
    "",
    "| 類型 | 代碼/kind | 概念數 | 概念 |",
    "|---|---|---|---|",
    ...rows,
    "",
  ];
}

function addTo(map: Map<string, Set<string>>, key: string, slug: string): void {
  const set = map.get(key) ?? new Set<string>();
  set.add(slug);
  map.set(key, set);
}

// Re-exported so callers that only need the outcome-label lookup don't
// have to reach into pipeline.ts directly.
export type { RunOutcome };
