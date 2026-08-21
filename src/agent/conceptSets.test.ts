import { describe, expect, it } from "vitest";
import { EVAL_CONCEPTS } from "./evalConcepts";
import { STRESS_CONCEPTS } from "./stressConcepts";
import { CONCEPT_SETS, EVAL_SET_NAMES, isEvalSetName, selectConcepts } from "./conceptSets";

describe("STRESS_CONCEPTS shape", () => {
  it("has at least 10 concepts — the Phase 4 acceptance bar", () => {
    expect(STRESS_CONCEPTS.length).toBeGreaterThanOrEqual(10);
  });

  it("has unique slugs", () => {
    const slugs = STRESS_CONCEPTS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("shares no slug with EVAL_CONCEPTS — a collision would falsely count as a non-eval-set concept", () => {
    const evalSlugs = new Set(EVAL_CONCEPTS.map((c) => c.slug));
    for (const concept of STRESS_CONCEPTS) {
      expect(evalSlugs.has(concept.slug)).toBe(false);
    }
  });

  it("uses path-segment-safe slugs (each becomes an out/eval/<date>/<set>/<slug>/ directory)", () => {
    for (const concept of STRESS_CONCEPTS) {
      expect(concept.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("has a non-trivial title and prompt for every concept", () => {
    for (const concept of STRESS_CONCEPTS) {
      expect(concept.title.length).toBeGreaterThan(0);
      expect(concept.prompt.length).toBeGreaterThanOrEqual(40);
    }
  });
});

describe("CONCEPT_SETS", () => {
  it("covers every EvalSetName (table completeness)", () => {
    for (const name of EVAL_SET_NAMES) {
      expect(isEvalSetName(name)).toBe(true);
      expect(CONCEPT_SETS[name].length).toBeGreaterThan(0);
    }
    expect(isEvalSetName("bogus")).toBe(false);
  });

  it("'all' is exactly baseline followed by stress, in that order", () => {
    expect(CONCEPT_SETS.all).toEqual([...CONCEPT_SETS.baseline, ...CONCEPT_SETS.stress]);
  });
});

describe("selectConcepts", () => {
  it("defaults to baseline when --set is omitted — preserves pre-PR-5 behavior", () => {
    const result = selectConcepts(undefined, undefined);
    expect(result).toEqual({ ok: true, set: "baseline", concepts: EVAL_CONCEPTS });
  });

  it("selects the named set", () => {
    const result = selectConcepts("stress", undefined);
    expect(result).toEqual({ ok: true, set: "stress", concepts: STRESS_CONCEPTS });
  });

  it("rejects an unknown set, naming the legal set names", () => {
    const result = selectConcepts("bogus", undefined);
    expect(result).toEqual({
      ok: false,
      message: 'unknown --set "bogus" (known: baseline, stress, all)',
    });
  });

  it("filters WITHIN the selected set by --only, preserving --only's order", () => {
    const result = selectConcepts("stress", ["lru-cache", "binary-heap"]);
    expect(result).toEqual({
      ok: true,
      set: "stress",
      concepts: [
        STRESS_CONCEPTS.find((c) => c.slug === "lru-cache"),
        STRESS_CONCEPTS.find((c) => c.slug === "binary-heap"),
      ],
    });
  });

  it("errors when --only names a concept outside the selected set, naming that set's slugs", () => {
    const result = selectConcepts("baseline", ["binary-heap"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('no such concept in set "baseline": binary-heap');
      expect(result.message).toContain("jwt-auth");
      expect(result.message).not.toContain("lru-cache");
    }
  });

  it("--set all makes every concept (baseline + stress) selectable via --only", () => {
    const result = selectConcepts("all", ["jwt-auth", "binary-heap"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.concepts.map((c) => c.slug)).toEqual(["jwt-auth", "binary-heap"]);
    }
  });
});
