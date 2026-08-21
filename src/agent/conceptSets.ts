// The registry of concept sets `motife eval --set <name>` can run, plus
// the pure selection logic shared by the CLI and its tests. A third leaf
// module (not folded into evalConcepts.ts or stressConcepts.ts) so
// neither of those has to import the other — evalConcepts.ts stays the
// frozen regression/few-shot set, stressConcepts.ts stays the set that
// rotates/expands — and so this file (and its test) can be imported
// without pulling in commands/eval.ts's AI-SDK-touching dependencies.
import type { EvalConcept } from "./evalConcepts";
import { EVAL_CONCEPTS } from "./evalConcepts";
import { STRESS_CONCEPTS } from "./stressConcepts";

export type EvalSetName = "baseline" | "stress" | "all";

export const EVAL_SET_NAMES: readonly EvalSetName[] = ["baseline", "stress", "all"];

export const DEFAULT_EVAL_SET: EvalSetName = "baseline";

/** `all` is exactly baseline followed by stress, in that order — never
 * independently maintained, so it can't drift out of sync with the other
 * two. */
export const CONCEPT_SETS: Record<EvalSetName, readonly EvalConcept[]> = {
  baseline: EVAL_CONCEPTS,
  stress: STRESS_CONCEPTS,
  all: [...EVAL_CONCEPTS, ...STRESS_CONCEPTS],
};

export function isEvalSetName(value: string): value is EvalSetName {
  return (EVAL_SET_NAMES as readonly string[]).includes(value);
}

export type SelectConceptsResult =
  | { ok: true; set: EvalSetName; concepts: readonly EvalConcept[] }
  | { ok: false; message: string };

/**
 * Resolves `--set` (default "baseline", preserving `motife eval`'s
 * pre-PR-5 behavior exactly), then filters WITHIN that set by `--only`
 * (order preserved, not reset back to the full set). An unmatched `--only`
 * slug is an error naming the LEGAL slugs of the SELECTED set — not the
 * union of every set, which would suggest a concept exists in a set it
 * doesn't.
 */
export function selectConcepts(
  setFlag: string | undefined,
  only: readonly string[] | undefined,
): SelectConceptsResult {
  const set = (setFlag ?? DEFAULT_EVAL_SET) as string;
  if (!isEvalSetName(set)) {
    return {
      ok: false,
      message: `unknown --set "${set}" (known: ${EVAL_SET_NAMES.join(", ")})`,
    };
  }
  const all = CONCEPT_SETS[set];
  if (!only || only.length === 0) {
    return { ok: true, set, concepts: all };
  }

  const bySlug = new Map(all.map((concept) => [concept.slug, concept]));
  const unknown = only.filter((slug) => !bySlug.has(slug));
  if (unknown.length > 0) {
    return {
      ok: false,
      message:
        `no such concept in set "${set}": ${unknown.join(", ")} ` +
        `(known: ${all.map((c) => c.slug).join(", ")})`,
    };
  }
  return { ok: true, set, concepts: only.map((slug) => bySlug.get(slug)!) };
}
