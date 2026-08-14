// `motife validate <doc.json>` — the standalone validation gate.
// scripts/render-dsl.mjs can only surface validation errors by paying for
// a full bundle (it delegates to DslPreview's calculateMetadata); this
// command runs parseDocument() directly in Node so skill mode (and the
// generate retry loop's human debugging) gets the formatIssues() text in
// milliseconds. Exit 0 = valid (warnings allowed), 1 = errors, 2 = usage.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { formatIssues, parseDocument } from "../../compiler";

export async function run(argv: string[]): Promise<number> {
  const [file] = argv;
  if (!file || file === "--help" || file === "-h") {
    console.error("usage: pnpm motife validate <doc.json>");
    return 2;
  }

  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (err) {
    console.error(`motife validate: cannot read ${file}: ${(err as Error).message}`);
    return 2;
  }

  // A JSON syntax error gets the same "here is what to fix" treatment as a
  // schema issue — in skill mode this text is all the feedback there is.
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch (err) {
    console.error(
      `motife DSL: 1 error in "${path.basename(file)}".\n\n` +
        `ERROR  (whole file)\n  Not valid JSON: ${(err as Error).message}\n` +
        `  fix: output a single JSON object — no markdown fences, no trailing commas, no comments.`,
    );
    return 1;
  }

  const result = parseDocument(input);
  if (result.ok) {
    console.log(formatIssues(result.doc.id, result.warnings));
    return 0;
  }

  const id = extractId(input) ?? path.basename(file);
  console.error(formatIssues(id, result.issues));
  return 1;
}

function extractId(input: unknown): string | null {
  if (typeof input === "object" && input !== null && "id" in input) {
    const id = (input as { id: unknown }).id;
    if (typeof id === "string" && id.length > 0) return id;
  }
  return null;
}
