import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertConfigMatches,
  atomicWriteJson,
  readEvalState,
  readRunState,
  runStateSchema,
  writeEvalState,
  writeRunState,
} from "./state";
import type { EvalState, PipelineConfig, RunState } from "./state";

const CONFIG: PipelineConfig = {
  provider: "anthropic", model: "model-a", critiqueProvider: "openai",
  critiqueModel: "model-b", language: "zh-TW", maxRevisions: 2, tts: null,
};

function validState(): RunState {
  return {
    kind: "motife-run-state", schemaVersion: 1, contractVersion: 1,
    status: "pending", prompt: "test", config: CONFIG, stage: "generate",
    iteration: 1, generateAttempts: 0, llmAttempts: [], iterations: [],
    bestIteration: null, lastError: null, elapsedMs: 0,
    updatedAt: new Date().toISOString(),
  };
}

describe("pipeline state", () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), "motife-state-")); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it("atomically replaces JSON without leaving a temp file visible", async () => {
    const file = path.join(dir, "value.json");
    await atomicWriteJson(file, { value: 1 });
    await atomicWriteJson(file, { value: 2 });
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ value: 2 });
    expect((await import("node:fs/promises").then((fs) => fs.readdir(dir))).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });

  it("round-trips a valid versioned state", async () => {
    await writeRunState(dir, validState());
    expect(await readRunState(dir)).toMatchObject({ schemaVersion: 1, contractVersion: 1, prompt: "test" });
  });

  it("rejects corrupt and unknown-version state", async () => {
    await writeFile(path.join(dir, "run-state.json"), "not json");
    await expect(readRunState(dir)).rejects.toThrow(/missing or corrupt/);
    await writeFile(path.join(dir, "run-state.json"), JSON.stringify({ ...validState(), schemaVersion: 999 }));
    await expect(readRunState(dir)).rejects.toThrow(/incompatible or corrupt/);
  });

  it("rejects persisted secrets and configuration mismatches", () => {
    expect(runStateSchema.safeParse({ ...validState(), apiKey: "secret" }).success).toBe(false);
    expect(() => assertConfigMatches(CONFIG, { model: "different" })).toThrow(/configuration mismatch.*model/);
    expect(() => assertConfigMatches(CONFIG, {})).not.toThrow();
  });

  it("recovers stale running checkpoints as paused on the next invocation", async () => {
    const run = validState();
    run.status = "running";
    run.stage = "render";
    await writeRunState(dir, run);
    expect((await readRunState(dir)).status).toBe("paused");
    expect((await readRunState(dir)).lastError).toContain("interrupted during render");

    const evalState: EvalState = {
      kind: "motife-eval-state", schemaVersion: 1, contractVersion: 1,
      status: "running", set: "stress", label: "screen-resume", date: "2026-08-19",
      config: CONFIG,
      concepts: [{ slug: "x", title: "X", prompt: "x", status: "running", stage: "critique", elapsedMs: 1, lastError: null }],
      elapsedMs: 1, lastError: null, updatedAt: new Date().toISOString(),
    };
    const evalDir = path.join(dir, "eval");
    await writeEvalState(evalDir, evalState);
    const recovered = await readEvalState(evalDir);
    expect(recovered.status).toBe("paused");
    expect(recovered.concepts[0].status).toBe("paused");
    expect(recovered.concepts[0].lastError).toContain("interrupted during critique");
  });
});
