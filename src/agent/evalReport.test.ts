import { describe, expect, it } from "vitest";
import type { PipelineResult } from "./pipeline";
import type { EvalRunResult } from "./evalReport";
import { renderEvalReport } from "./evalReport";
import type { TtsProvider } from "../tts/provider";

const TTS: TtsProvider = {
  name: "elevenlabs",
  voice: "A3T1GnLHdn0WL5w4TMtq",
  model: "eleven_multilingual_v2",
  synthesize: async () => ({ audio: new Uint8Array(), format: "mp3" }),
};

function cleanResult(): PipelineResult {
  return {
    status: "completed",
    ok: true,
    finalMp4: "concept/final.mp4",
    generateAttempts: 1,
    iterations: [{ iteration: 1, errors: 0, warnings: 0, issues: [], docWarnings: [] }],
    clean: true,
    outcome: "clean",
    shippedIteration: 1,
  };
}

function exhaustedResultWithWarnings(): PipelineResult {
  return {
    status: "completed",
    ok: true,
    finalMp4: "concept/final.mp4",
    generateAttempts: 1,
    iterations: [
      {
        iteration: 1,
        errors: 1,
        warnings: 0,
        issues: [
          {
            sceneId: "walkthrough",
            severity: "error",
            kind: "overflow",
            description: "Card clipped.",
            suggestion: "Shorten the label.",
          },
        ],
        docWarnings: [
          {
            path: "scenes[1].content.graph.nodes[2].label",
            code: "diagram_too_many_nodes",
            severity: "warning",
            message: "This diagram has 9 nodes.",
            fix: "split the graph across two scenes.",
          },
        ],
      },
    ],
    clean: false,
    outcome: "exhausted",
    shippedIteration: 1,
  };
}

function baseOptions(overrides: Partial<Parameters<typeof renderEvalReport>[0]> = {}) {
  return {
    date: "2026-08-20",
    set: "stress" as const,
    label: null,
    provider: "anthropic",
    model: "claude-sonnet-5",
    maxRevisions: 2,
    ttsProvider: TTS,
    results: [] as EvalRunResult[],
    ...overrides,
  };
}

describe("renderEvalReport", () => {
  it("renders the outcome label, not a raw enum value", () => {
    const results: EvalRunResult[] = [
      { slug: "binary-heap", title: "二元堆積 Heap", result: cleanResult(), error: null, elapsedSeconds: 250 },
    ];
    const out = renderEvalReport(baseOptions({ results }));
    expect(out).toContain("outcome: critique clean");
    expect(out).not.toContain('outcome: "clean"');
  });

  it("inlines a docWarnings entry with code, path, message, and fix", () => {
    const results: EvalRunResult[] = [
      {
        slug: "trie-autocomplete",
        title: "Trie 前綴樹自動完成",
        result: exhaustedResultWithWarnings(),
        error: null,
        elapsedSeconds: 400,
      },
    ];
    const out = renderEvalReport(baseOptions({ results }));
    expect(out).toContain("WARN / diagram_too_many_nodes");
    expect(out).toContain("scenes[1].content.graph.nodes[2].label");
    expect(out).toContain("This diagram has 9 nodes.");
    expect(out).toContain("split the graph across two scenes.");
    expect(out).toContain("outcome: revision budget exhausted");
  });

  it("renders a crashed concept without claiming an outcome", () => {
    const results: EvalRunResult[] = [
      { slug: "tls-handshake", title: "TLS 交握", result: null, error: "vision API timed out", elapsedSeconds: 60 },
    ];
    const out = renderEvalReport(baseOptions({ results }));
    expect(out).toContain("**CRASHED** mid-run");
    expect(out).toContain("vision API timed out");
    expect(out).not.toContain("outcome:");
  });

  it("marks the 旁白 column n/a and adds a footer note when TTS is disabled", () => {
    const results: EvalRunResult[] = [
      { slug: "cap-theorem", title: "CAP 定理", result: cleanResult(), error: null, elapsedSeconds: 200 },
    ];
    const out = renderEvalReport(baseOptions({ ttsProvider: null, results }));
    expect(out).toContain("TTS: disabled (--no-audio)");
    expect(out).toContain("n/a — --no-audio");
    expect(out).toContain("本次為 --no-audio 篩選，旁白無法評分。");
  });

  it("uses a different scoring footer per set", () => {
    const baseline = renderEvalReport(baseOptions({ set: "baseline", results: [] }));
    const stress = renderEvalReport(baseOptions({ set: "stress", results: [] }));
    expect(baseline).toContain("Phase 4 驗收 1");
    expect(stress).toContain("Phase 4 驗收 2");
    expect(stress).not.toContain("Phase 4 驗收 1");
  });

  it("includes the label in the header when given", () => {
    const out = renderEvalReport(baseOptions({ label: "screen", results: [] }));
    expect(out).toContain("2026-08-20 (screen)");
  });

  it("aggregates failure modes by kind/code across concepts, deduped per concept", () => {
    const withRepeatedWarning: PipelineResult = {
      ...exhaustedResultWithWarnings(),
      iterations: [
        exhaustedResultWithWarnings().iterations[0],
        { ...exhaustedResultWithWarnings().iterations[0], iteration: 2 }, // same code again
      ],
    };
    const results: EvalRunResult[] = [
      { slug: "a", title: "A", result: withRepeatedWarning, error: null, elapsedSeconds: 1 },
      { slug: "b", title: "B", result: withRepeatedWarning, error: null, elapsedSeconds: 1 },
    ];
    const out = renderEvalReport(baseOptions({ results }));
    // 2 concepts, not 4 (deduped per concept despite 2 iterations each).
    expect(out).toMatch(/diagram_too_many_nodes \| 2 \| a, b/);
  });

  it("reports 'no failure modes' when nothing fired", () => {
    const results: EvalRunResult[] = [
      { slug: "a", title: "A", result: cleanResult(), error: null, elapsedSeconds: 1 },
    ];
    const out = renderEvalReport(baseOptions({ results }));
    expect(out).toContain("失敗模式彙整");
    expect(out).toContain("無。");
  });

  it("contains no absolute filesystem paths — archivable as-is", () => {
    const results: EvalRunResult[] = [
      {
        slug: "event-loop",
        title: "JavaScript Event Loop",
        result: exhaustedResultWithWarnings(),
        error: null,
        elapsedSeconds: 300,
      },
    ];
    const out = renderEvalReport(baseOptions({ results }));
    expect(out).not.toMatch(/\/Users\/|\/home\/|C:\\/);
  });

  it("lists pending and paused concepts with their last safe stage and resume command", () => {
    const results: EvalRunResult[] = [
      { slug: "pending", title: "Pending", result: null, error: null, elapsedSeconds: 0, status: "pending", stage: "generate", resumeCommand: "pnpm motife eval --resume out/eval/x --only pending" },
      { slug: "paused", title: "Paused", result: { ...cleanResult(), status: "paused", ok: false, outcome: "paused", failureText: "quota" }, error: "quota", elapsedSeconds: 10, status: "paused", stage: "critique", resumeCommand: "pnpm motife eval --resume out/eval/x --only paused" },
    ];
    const out = renderEvalReport(baseOptions({ results }));
    expect(out).toContain("**PENDING** — last safe stage: generate");
    expect(out).toContain("**PAUSED** after 10s — last safe stage: critique");
    expect(out).toContain("pnpm motife eval --resume out/eval/x --only paused");
  });
});
