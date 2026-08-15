// Renders a critique report as markdown — written to the iteration dir
// for humans, and embedded verbatim in the revision prompt for the LLM.
import type { CritiqueReport } from "./critique";

export function countBySeverity(report: CritiqueReport): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;
  for (const issue of report.issues) {
    if (issue.severity === "error") errors++;
    else warnings++;
  }
  return { errors, warnings };
}

export function renderCritiqueMarkdown(report: CritiqueReport, iteration: number): string {
  const { errors, warnings } = countBySeverity(report);
  const lines: string[] = [
    `# Critique — iteration ${iteration}`,
    "",
    `${errors} error(s), ${warnings} warning(s).`,
  ];

  if (report.issues.length === 0) {
    lines.push("", "No visual issues found.");
    return `${lines.join("\n")}\n`;
  }

  const sceneIds = [...new Set(report.issues.map((issue) => issue.sceneId))];
  for (const sceneId of sceneIds) {
    lines.push("", `## Scene ${sceneId}`, "");
    for (const issue of report.issues.filter((item) => item.sceneId === sceneId)) {
      const marker = issue.severity === "error" ? "ERROR" : "WARN";
      lines.push(`- **${marker} / ${issue.kind}** — ${issue.description}`);
      lines.push(`  - fix: ${issue.suggestion}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
