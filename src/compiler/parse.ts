// The DSL's one public constructor. A DslDocument MUST only be produced
// here — never built as a literal or cast (CLAUDE.md hard constraint) —
// because that's the only way to guarantee every DslDocument in memory
// passed both zod's structural checks and validate.ts's semantic
// cross-reference checks.
import { dslDocumentSchema } from "../dsl";
import type { DslDocument } from "../dsl";
import { DslValidationError } from "./errors";
import type { DslIssue } from "./errors";
import { zodErrorToDslIssues } from "./zodIssues";
import { validateDocument } from "./validate";

export type ParseResult =
  | { ok: true; doc: DslDocument; warnings: readonly DslIssue[] }
  | { ok: false; issues: readonly DslIssue[] };

/**
 * Structural (zod) validation, then — only if that passes — semantic
 * (validate.ts) validation. Semantic checks assume a structurally-valid
 * document (e.g. they index into `track.items` without re-checking it's an
 * array), so running them against a structurally invalid one would risk a
 * confusing secondary crash instead of a clean error report; zod issues
 * always take priority and are returned alone when present.
 */
export function parseDocument(input: unknown): ParseResult {
  const structural = dslDocumentSchema.safeParse(input);
  if (!structural.success) {
    return { ok: false, issues: zodErrorToDslIssues(structural.error, input) };
  }

  const semanticIssues = validateDocument(structural.data);
  const errors = semanticIssues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    return { ok: false, issues: semanticIssues };
  }

  return { ok: true, doc: structural.data, warnings: semanticIssues };
}

function guessDocId(input: unknown): string {
  if (input && typeof input === "object" && "id" in input && typeof (input as { id: unknown }).id === "string") {
    return (input as { id: string }).id;
  }
  return "(unknown)";
}

/** Throwing counterpart, for call sites that want a document or a thrown
 * DslValidationError (e.g. Root.tsx's module-scope baseline loading —
 * Stage 3 — where a malformed baseline should fail the bundle loudly). */
export function parseDocumentOrThrow(input: unknown, docId?: string): DslDocument {
  const result = parseDocument(input);
  if (!result.ok) throw new DslValidationError(docId ?? guessDocId(input), result.issues);
  return result.doc;
}
