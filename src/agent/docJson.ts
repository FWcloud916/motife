// Shared helpers for treating LLM output (and files on disk) as candidate
// DSL JSON. Pure string/JSON logic — no filesystem, no LLM — so the
// generate retry loop stays unit-testable.

/** Best-effort recovery of the JSON object from raw LLM text: strips
 * markdown code fences and any prose before/after the outermost braces.
 * Deliberately conservative — anything beyond that is parseDocument()'s
 * job to reject with a real issue report. */
export function coerceJsonText(raw: string): string {
  let text = raw.trim();
  const fenced = /^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```\s*$/.exec(text);
  if (fenced) text = fenced[1].trim();
  // Trim prose on EITHER side of the object — "Here you go: {...}" and
  // "{...}\nHope that helps!" both appear in the wild.
  if (!text.startsWith("{") || !text.endsWith("}")) {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last > first) text = text.slice(first, last + 1);
  }
  return text;
}

export function extractDocId(input: unknown): string | null {
  if (typeof input === "object" && input !== null && "id" in input) {
    const id = (input as { id: unknown }).id;
    if (typeof id === "string" && id.length > 0) return id;
  }
  return null;
}

/** A JSON syntax error rendered in formatIssues()'s visual dialect so the
 * retry prompt (and skill mode's terminal) reads uniformly whether the
 * failure was syntax or schema. */
export function jsonSyntaxIssueText(docId: string, parseErrorMessage: string): string {
  return (
    `motife DSL: 1 error in "${docId}".\n\n` +
    `ERROR  (whole document)\n  Not valid JSON: ${parseErrorMessage}\n` +
    `  fix: output a single JSON object — no markdown fences, no trailing commas, no comments.`
  );
}
