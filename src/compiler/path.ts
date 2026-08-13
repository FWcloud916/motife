// Shared by zodIssues.ts (formats zod's path arrays) and validate.ts
// (builds paths while walking an already-parsed document) — one
// implementation of "how a DslIssue path renders" so the two never drift
// into two different notations for the same kind of location.
export type PathSegment = string | number | symbol;

export function formatPath(path: readonly PathSegment[]): string {
  if (path.length === 0) return "(document root)";
  let out = "";
  for (const segment of path) {
    if (typeof segment === "number") {
      out += `[${segment}]`;
    } else {
      out += out ? `.${String(segment)}` : String(segment);
    }
  }
  return out;
}

/** Renders a list of legal option strings for a "use one of: …" fix —
 * quoted, so a multi-word or punctuation-bearing id (or an empty list)
 * never reads ambiguously against the surrounding sentence. */
export function quoteList(items: Iterable<string>): string {
  const quoted = [...items].map((item) => `"${item}"`);
  return quoted.length > 0 ? quoted.join(", ") : "(none)";
}
