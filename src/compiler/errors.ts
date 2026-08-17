// The DSL's error contract. These strings are Phase 3's retry feedback —
// motife-plan.md §3 Phase 2 is explicit that error-message quality IS the
// agent's self-repair capability, and §3 Phase 3 plans to feed a
// validation failure straight back into the LLM for another attempt. Every
// DslIssue therefore names a real, copy-pasteable path into the document
// and states a concrete repair, not just what rule was broken.

export type DslIssueCode =
  // zod structural failures (src/compiler/zodIssues.ts)
  | "schema"
  // document/scene structure
  | "duplicate_scene_id"
  | "beat_order"
  // windows and tracks
  | "window_order"
  | "duplicate_track_id"
  | "unknown_track"
  | "track_forward_reference"
  | "step_index_out_of_range"
  | "case_range_overlap"
  | "case_range_gap"
  | "unused_track"
  // diagrams
  | "duplicate_graph_node_id"
  | "unknown_graph_node"
  | "duplicate_edge_id"
  | "unknown_edge"
  // camera
  | "unknown_camera_focus"
  | "duplicate_camera_target_id"
  | "camera_target_shadows_node"
  // timeline
  | "transition_too_long"
  // content quality
  | "narration_pacing"
  // layout budgets — estimated (see src/components/layout/estimateNodeSizes.ts);
  // the critique loop can SEE these but is forbidden from suggesting a
  // pixel/coordinate fix, so this is the channel that reaches the LLM
  | "diagram_label_too_long"
  | "diagram_label_clipped"
  | "diagram_too_many_nodes"
  | "camera_content_too_tall";

export type DslIssueSeverity = "error" | "warning";

export interface DslIssue {
  /** A real, copy-pasteable location in the document, e.g.
   * `scenes[2].content.children[1].flows[0].edge`. Never "root" or "". */
  path: string;
  code: DslIssueCode;
  severity: DslIssueSeverity;
  /** One sentence. Names the offending value verbatim. */
  message: string;
  /** The repair instruction. Names concrete legal alternatives — "use one
   * of X, Y, Z" — rather than restating the rule that was broken. */
  fix: string;
}

export class DslValidationError extends Error {
  readonly issues: readonly DslIssue[];

  constructor(docId: string, issues: readonly DslIssue[]) {
    super(formatIssues(docId, issues));
    this.name = "DslValidationError";
    this.issues = issues;
  }
}

const SEVERITY_LABEL: Record<DslIssueSeverity, string> = {
  error: "ERROR",
  warning: "WARN ",
};

/**
 * Renders a list of issues as the human/LLM-facing report. Deliberately
 * plain text, not JSON — this is meant to be read directly (by a person
 * debugging a hand-written doc, or pasted into an LLM's retry prompt), not
 * re-parsed.
 */
export function formatIssues(docId: string, issues: readonly DslIssue[]): string {
  if (issues.length === 0) return `motife DSL: "${docId}" is valid — no issues.`;

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.length - errorCount;
  const summary = [
    errorCount > 0 ? `${errorCount} error${errorCount === 1 ? "" : "s"}` : null,
    warningCount > 0 ? `${warningCount} warning${warningCount === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const body = issues
    .map((issue) => {
      const label = SEVERITY_LABEL[issue.severity];
      const fixLines = issue.fix.split("\n");
      const fix = [`  fix: ${fixLines[0]}`, ...fixLines.slice(1).map((line) => `       ${line}`)].join(
        "\n",
      );
      return `${label}  ${issue.path}\n  ${issue.message}\n${fix}`;
    })
    .join("\n\n");

  return `motife DSL: ${summary} in "${docId}".\n\n${body}`;
}
