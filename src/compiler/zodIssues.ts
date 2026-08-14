// Maps zod's ZodError issues onto DslIssue[]. Most of zod v4's own issue
// codes are already well-localized to the right path with a usable
// message — e.g. a discriminatedUnion member that matches its `type` tag
// but fails on a field returns a bare `invalid_type` at that field's own
// path, not a wrapped union error (confirmed against zod v4's own test
// suite). The one case that IS genuinely bad by default is an unmatched
// discriminator ("no node type in this codebase is called that"), which
// zod reports as an `invalid_union` with an empty `errors` array — that
// gets its own message here, listing the legal type names.
import type { z } from "zod";
import type { DslIssue, DslIssueCode } from "./errors";
import { formatPath } from "./path";

/** zod v4's issue shapes carry extra fields depending on `code` that its
 * public TS types don't uniformly expose on the base `$ZodIssue`. Narrow
 * access through this helper rather than sprinkling `as` casts below. */
function extra<T>(issue: z.core.$ZodIssue, key: string): T | undefined {
  return (issue as unknown as Record<string, T>)[key];
}

/** Reads the value at `path` out of the ORIGINAL (unparsed) input — zod's
 * "no matching discriminator" issue doesn't echo back the invalid value
 * itself, only the path and the legal options, so getting the offending
 * value verbatim into the message means navigating to it ourselves. */
function valueAtPath(input: unknown, path: readonly (string | number | symbol)[]): unknown {
  let current = input;
  for (const segment of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string | number | symbol, unknown>)[segment];
  }
  return current;
}

function issueToDslIssue(issue: z.core.$ZodIssue, rawInput: unknown): DslIssue {
  const path = formatPath(issue.path);

  // Unmatched discriminator: "type": "not-a-real-node" or similar. zod
  // marks this with an empty `errors` array and a `discriminator` field —
  // every other invalid_union case (a genuinely ambiguous non-discriminated
  // union, e.g. WindowRef) has real per-branch sub-errors instead.
  if (issue.code === "invalid_union") {
    const options = extra<unknown[]>(issue, "options");
    const discriminator = extra<string>(issue, "discriminator");
    const subErrors = extra<unknown[]>(issue, "errors") ?? [];
    if (discriminator && subErrors.length === 0 && options) {
      const legal = options.map((option) => JSON.stringify(option)).join(", ");
      const actual = valueAtPath(rawInput, issue.path);
      const got = actual === undefined ? "an unrecognized value" : JSON.stringify(actual);
      return {
        path,
        code: "schema",
        severity: "error",
        message: `Unknown "${discriminator}" value ${got} — this isn't one of the node types the compiler knows how to render.`,
        fix: `use one of: ${legal}.`,
      };
    }
    // A genuine ambiguous union (e.g. WindowRef, CodeSegment, TextRun) —
    // zod's per-branch dump is real noise here, so summarize instead.
    return {
      path,
      code: "schema",
      severity: "error",
      message: `The value at "${path}" doesn't match any of the shapes allowed here.`,
      fix: "check this field's shape against docs/dsl-schema.md — every alternative for this field failed to match.",
    };
  }

  if (issue.code === "unrecognized_keys") {
    const keys = extra<string[]>(issue, "keys") ?? [];
    return {
      path,
      code: "schema",
      severity: "error",
      message: `Unrecognized field${keys.length === 1 ? "" : "s"}: ${keys.map((k) => `"${k}"`).join(", ")}.`,
      fix: "remove the extra field(s), or check for a typo against docs/dsl-schema.md's field names for this node type.",
    };
  }

  if (issue.code === "invalid_value") {
    const values = extra<unknown[]>(issue, "values");
    if (values && values.length > 0) {
      const legal = values.map((v) => JSON.stringify(v)).join(", ");
      return {
        path,
        code: "schema",
        severity: "error",
        message: issue.message,
        fix: `use one of: ${legal}.`,
      };
    }
  }

  if (issue.code === "invalid_type") {
    const expected = extra<string>(issue, "expected");
    return {
      path,
      code: "schema",
      severity: "error",
      message: issue.message,
      fix: expected ? `provide a value of type "${expected}" at this path.` : "check this field's type against docs/dsl-schema.md.",
    };
  }

  if (issue.code === "too_small" || issue.code === "too_big") {
    return {
      path,
      code: "schema",
      severity: "error",
      message: issue.message,
      fix: issue.code === "too_small" ? "provide more items/a larger value here." : "provide fewer items/a smaller value here.",
    };
  }

  // Fallback for the remaining codes (invalid_format, not_multiple_of,
  // invalid_key, invalid_element, custom): zod's own message is generally
  // fine on its own; the fix stays generic since these are rare in
  // practice for this schema (no regex formats, no key-schema maps, no
  // custom refinements yet).
  return {
    path,
    code: "schema",
    severity: "error",
    message: issue.message,
    fix: "check this field's value against docs/dsl-schema.md.",
  };
}

export const SCHEMA_ISSUE_CODE: DslIssueCode = "schema";

/** `rawInput` is the original, unparsed value passed to `.safeParse()` —
 * needed only to recover the offending value for the unmatched-
 * discriminator case above (see valueAtPath's doc comment). */
export function zodErrorToDslIssues(error: z.ZodError, rawInput?: unknown): DslIssue[] {
  return error.issues.map((issue) => issueToDslIssue(issue, rawInput));
}
