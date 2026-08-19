// Control-flow tests for the bounded generate→tts→render→critique→revise
// loop, with every side-effecting stage faked (no browser, bundler, or
// network). The fakes still write real files where the pipeline reads
// them back (stills, videos) — the run-directory artifacts ARE the
// contract under test.
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CritiqueReport } from "../critique/critique";
import type { AudioManifest } from "../tts/manifest";
import type { TtsProvider } from "../tts/provider";
import { FakeLlmClient } from "./fakeLlm";
import type { PipelineStages } from "./pipeline";
import { runPipeline } from "./pipeline";
import { stillFileName } from "./render";
import type { RenderContext } from "./render";

const VALID_DOC = {
  version: 1,
  id: "PipelineDoc",
  title: "Pipeline",
  scenes: ["intro", "breakdown", "walkthrough", "summary"].map((id) => ({
    id,
    beat: id,
    durationInSeconds: 2,
    narration: "A short line of narration.",
    content: { type: "pill", text: id },
  })),
};
const REVISED_DOC = { ...VALID_DOC, title: "Pipeline (revised)" };
const REVISED_DOC_2 = { ...VALID_DOC, title: "Pipeline (revised twice)" };

const CLEAN: CritiqueReport = { issues: [] };
const HAS_ERROR: CritiqueReport = {
  issues: [
    {
      sceneId: "intro",
      severity: "error",
      kind: "overflow",
      description: "Title clipped.",
      suggestion: "Shorten it.",
    },
  ],
};
const HAS_TWO_ERRORS: CritiqueReport = {
  issues: [
    ...HAS_ERROR.issues,
    {
      sceneId: "breakdown",
      severity: "error",
      kind: "offscreen",
      description: "Camera drifted off frame.",
      suggestion: "Reframe the shot.",
    },
  ],
};

interface StageCalls {
  prepareServeUrls: Array<string | undefined>;
  prepareAudio: Array<unknown>;
  renderedVideos: string[];
  critiques: number;
}

/** Fake stage set: prepare/render/stills write real files, critique
 * returns the scripted reports in order (last one repeats). */
function fakeStages(reports: CritiqueReport[]): {
  stages: Partial<PipelineStages>;
  calls: StageCalls;
} {
  const calls: StageCalls = {
    prepareServeUrls: [],
    prepareAudio: [],
    renderedVideos: [],
    critiques: 0,
  };
  const stages: Partial<PipelineStages> = {
    buildSystemPrompt: async () => "system prompt",
    prepareRender: async (options) => {
      calls.prepareServeUrls.push(options.serveUrl);
      calls.prepareAudio.push(options.audio);
      return {
        serveUrl: options.serveUrl ?? "fake://bundle",
        inputProps: { doc: options.rawDoc, audio: options.audio },
        composition: {} as RenderContext["composition"],
      };
    },
    renderVideo: async (_context, outputLocation) => {
      await mkdir(path.dirname(outputLocation), { recursive: true });
      await writeFile(outputLocation, `fake-video:${calls.renderedVideos.length + 1}`);
      calls.renderedVideos.push(outputLocation);
    },
    renderCritiqueStills: async (_context, frames, stillsDir) => {
      await mkdir(stillsDir, { recursive: true });
      const rendered = [];
      for (const frame of frames) {
        const filePath = path.join(stillsDir, stillFileName(frame));
        await writeFile(filePath, "fake-jpeg-bytes");
        rendered.push({ ...frame, filePath });
      }
      return rendered;
    },
    runCritique: async () => {
      const report = reports[Math.min(calls.critiques, reports.length - 1)];
      calls.critiques++;
      return report;
    },
  };
  return { stages, calls };
}

describe("runPipeline", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "motife-pipeline-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function baseOptions(client: FakeLlmClient) {
    return {
      prompt: "explain the thing",
      runRoot: path.join(dir, "run"),
      generationClient: client,
      critiqueClient: new FakeLlmClient([]), // faked runCritique never calls it
      ttsProvider: null,
    };
  }

  it("stops after one iteration when the first critique is clean", async () => {
    const { stages, calls } = fakeStages([CLEAN]);
    const result = await runPipeline(
      baseOptions(new FakeLlmClient([JSON.stringify(VALID_DOC)])),
      stages,
    );

    expect(result).toMatchObject({
      ok: true,
      clean: true,
      outcome: "clean",
      generateAttempts: 1,
      shippedIteration: 1,
    });
    expect(result.iterations).toHaveLength(1);
    expect(result.iterations[0]).toMatchObject({ iteration: 1, errors: 0, warnings: 0, issues: [] });
    // VALID_DOC's narration (26 chars / 2s = 13 chars/sec) trips
    // checkNarrationPacing's 12 chars/sec threshold on every scene — a
    // zero-new-fixture proof that docWarnings is actually wired up.
    expect(result.iterations[0].docWarnings).toHaveLength(4);
    expect(result.iterations[0].docWarnings.every((w) => w.code === "narration_pacing")).toBe(true);
    expect(calls.renderedVideos).toHaveLength(1);
    expect(await readFile(path.join(dir, "run", "final.mp4"), "utf8")).toBe("fake-video:1");
    expect(await readFile(path.join(dir, "run", "report.md"), "utf8")).toContain(
      "passed critique with zero errors",
    );
    // doc.final.json and the per-iteration doc.json snapshot both exist.
    expect(await readFile(path.join(dir, "run", "doc.final.json"), "utf8")).toContain(
      '"Pipeline"',
    );
    expect(
      await readFile(path.join(dir, "run", "iterations", "iter-1", "doc.json"), "utf8"),
    ).toContain('"Pipeline"');
  });

  it("revises after an error critique, then stops clean", async () => {
    const { stages, calls } = fakeStages([HAS_ERROR, CLEAN]);
    const client = new FakeLlmClient([JSON.stringify(VALID_DOC), JSON.stringify(REVISED_DOC)]);
    const result = await runPipeline(baseOptions(client), stages);

    expect(result.clean).toBe(true);
    expect(result.outcome).toBe("clean");
    expect(result.iterations.map((summary) => summary.errors)).toEqual([1, 0]);
    expect(result.shippedIteration).toBe(2);
    expect(calls.renderedVideos).toHaveLength(2);

    // The revision replaced doc.json and archived the pre-revision state.
    const docJson = await readFile(path.join(dir, "run", "doc.json"), "utf8");
    expect(docJson).toContain("Pipeline (revised)");
    const before = await readFile(
      path.join(dir, "run", "iterations", "iter-1", "doc.before.json"),
      "utf8",
    );
    expect(before).toContain('"Pipeline"');
    expect(before).not.toContain("revised");

    // The revision prompt carried the critique markdown.
    const reviseCall = client.calls[1];
    expect(reviseCall.messages[1].content).toContain("ERROR / overflow");

    // final.mp4 is the SECOND render.
    expect(await readFile(path.join(dir, "run", "final.mp4"), "utf8")).toBe("fake-video:2");
  });

  it("ships the best-scoring iteration, tying to the earlier one, when the revision budget is exhausted", async () => {
    // Both iterations score identically (1 error, 0 warnings) — a tie keeps
    // the EARLIER iteration, since the revision bought nothing.
    const { stages, calls } = fakeStages([HAS_ERROR]);
    const client = new FakeLlmClient([
      JSON.stringify(VALID_DOC),
      JSON.stringify(REVISED_DOC),
    ]);
    const result = await runPipeline({ ...baseOptions(client), maxRevisions: 1 }, stages);

    expect(result.ok).toBe(true);
    expect(result.clean).toBe(false);
    expect(result.outcome).toBe("exhausted");
    expect(result.iterations).toHaveLength(2); // maxRevisions + 1
    expect(calls.renderedVideos).toHaveLength(2);
    expect(result.shippedIteration).toBe(1);
    expect(await readFile(path.join(dir, "run", "final.mp4"), "utf8")).toBe("fake-video:1");
    expect(await readFile(path.join(dir, "run", "report.md"), "utf8")).toContain(
      "Revision budget exhausted",
    );
    // doc.final.json is iteration 1's doc, not the (equally bad) revision.
    const docFinal = JSON.parse(
      await readFile(path.join(dir, "run", "doc.final.json"), "utf8"),
    ) as typeof VALID_DOC;
    expect(docFinal.title).toBe("Pipeline");
  });

  it("ships an earlier iteration when a later revision regresses then partially recovers (1 -> 2 -> 1 errors)", async () => {
    const { stages, calls } = fakeStages([HAS_ERROR, HAS_TWO_ERRORS, HAS_ERROR]);
    const client = new FakeLlmClient([
      JSON.stringify(VALID_DOC),
      JSON.stringify(REVISED_DOC),
      JSON.stringify(REVISED_DOC_2),
    ]);
    const result = await runPipeline({ ...baseOptions(client), maxRevisions: 2 }, stages);

    expect(result.iterations.map((summary) => summary.errors)).toEqual([1, 2, 1]);
    expect(result.outcome).toBe("exhausted");
    expect(calls.renderedVideos).toHaveLength(3);
    // Iteration 3 ties iteration 1's score (1 error, 0 warnings) — the
    // EARLIER iteration ships, not the last one that merely matched it.
    expect(result.shippedIteration).toBe(1);
    expect(await readFile(path.join(dir, "run", "final.mp4"), "utf8")).toBe("fake-video:1");
  });

  it("ships the later iteration once a revision strictly improves the score (2 -> 1 errors)", async () => {
    const { stages, calls } = fakeStages([HAS_TWO_ERRORS, HAS_ERROR]);
    const client = new FakeLlmClient([JSON.stringify(VALID_DOC), JSON.stringify(REVISED_DOC)]);
    const result = await runPipeline({ ...baseOptions(client), maxRevisions: 1 }, stages);

    expect(result.iterations.map((summary) => summary.errors)).toEqual([2, 1]);
    expect(result.outcome).toBe("exhausted");
    expect(calls.renderedVideos).toHaveLength(2);
    expect(result.shippedIteration).toBe(2);
    expect(await readFile(path.join(dir, "run", "final.mp4"), "utf8")).toBe("fake-video:2");
  });

  it("keeps the current cut when the revision never validates", async () => {
    const { stages, calls } = fakeStages([HAS_ERROR]);
    // 1 good generation, then 4 hopeless revision attempts (the default cap).
    const client = new FakeLlmClient([
      JSON.stringify(VALID_DOC),
      "nope",
      "still nope",
      "not json",
      "never",
    ]);
    const result = await runPipeline(baseOptions(client), stages);

    expect(result.ok).toBe(true);
    expect(result.clean).toBe(false);
    expect(result.outcome).toBe("revision-failed");
    expect(result.iterations).toHaveLength(1); // loop broke after failed revision
    expect(calls.renderedVideos).toHaveLength(1);
    // doc.json still the original.
    expect(await readFile(path.join(dir, "run", "doc.json"), "utf8")).not.toContain("revised");
    expect(await readFile(path.join(dir, "run", "final.mp4"), "utf8")).toBe("fake-video:1");
    // The report says what actually happened — not "budget exhausted".
    expect(await readFile(path.join(dir, "run", "report.md"), "utf8")).toContain(
      "Revision never passed validation",
    );
  });

  it("still writes the report and final.mp4 when a stage throws mid-iteration", async () => {
    const { stages } = fakeStages([HAS_ERROR]);
    const client = new FakeLlmClient([JSON.stringify(VALID_DOC), JSON.stringify(REVISED_DOC)]);
    // Iteration 1 renders fine; iteration 2's render blows up.
    let renders = 0;
    const throwingStages = {
      ...stages,
      renderVideo: async (context: Parameters<NonNullable<typeof stages.renderVideo>>[0], out: string) => {
        renders++;
        if (renders === 2) throw new Error("browser crashed");
        await stages.renderVideo!(context, out);
      },
    };

    await expect(runPipeline(baseOptions(client), throwingStages)).rejects.toThrow(
      "browser crashed",
    );

    // The run directory still keeps its resumable-by-hand promise.
    expect(await readFile(path.join(dir, "run", "final.mp4"), "utf8")).toBe("fake-video:1");
    const report = await readFile(path.join(dir, "run", "report.md"), "utf8");
    expect(report).toContain("Run aborted by an error");
    expect(report).toContain("iteration 1: 1 error(s)");
  });

  it("fails the run (no render) when generation never validates", async () => {
    const { stages, calls } = fakeStages([CLEAN]);
    const client = new FakeLlmClient(["bad", "bad", "bad", "bad"]);
    const result = await runPipeline(baseOptions(client), stages);

    expect(result).toMatchObject({
      ok: false,
      clean: false,
      outcome: "generation-failed",
      finalMp4: null,
      generateAttempts: 4,
    });
    expect(calls.renderedVideos).toHaveLength(0);
    expect(await readFile(path.join(dir, "run", "report.md"), "utf8")).toContain(
      "never produced a valid document",
    );
    await expect(stat(path.join(dir, "run", "final.mp4"))).rejects.toThrow();
  });

  it("backfills TTS durations and hands the manifest to the renderer", async () => {
    const { stages, calls } = fakeStages([CLEAN]);
    let synthesizeCalls = 0;
    const manifest: AudioManifest = {
      scenes: Object.fromEntries(
        VALID_DOC.scenes.map((scene) => [
          scene.id,
          {
            src: `audio/${scene.id}.mp3`,
            durationInSeconds: 4.2,
            narrationHash: "h",
            delaySeconds: 0.3,
          },
        ]),
      ),
    };
    const ttsProvider: TtsProvider = {
      name: "openai",
      voice: "test",
      model: "test-model",
      synthesize: async () => ({ audio: new Uint8Array([1]), format: "mp3" }),
    };
    const result = await runPipeline(
      {
        ...baseOptions(new FakeLlmClient([JSON.stringify(VALID_DOC)])),
        ttsProvider,
      },
      {
        ...stages,
        synthesizeDoc: async () => {
          synthesizeCalls++;
          return { manifest, synthesized: Object.keys(manifest.scenes), reused: [] };
        },
      },
    );

    expect(result.ok).toBe(true);
    expect(synthesizeCalls).toBe(1);
    // 0.3 lead + 4.2 audio + 0.7 tail = 5.2s per scene in the derived doc.
    const derived = JSON.parse(
      await readFile(path.join(dir, "run", "doc.tts.json"), "utf8"),
    ) as typeof VALID_DOC;
    expect(derived.scenes.map((scene) => scene.durationInSeconds)).toEqual([5.2, 5.2, 5.2, 5.2]);
    // The renderer saw the manifest, not undefined.
    expect(calls.prepareAudio[0]).toBe(manifest);
  });

  it("bundles once and reuses the serveUrl on later iterations", async () => {
    const { stages, calls } = fakeStages([HAS_ERROR, CLEAN]);
    const client = new FakeLlmClient([JSON.stringify(VALID_DOC), JSON.stringify(REVISED_DOC)]);
    await runPipeline(baseOptions(client), stages);

    expect(calls.prepareServeUrls).toEqual([undefined, "fake://bundle"]);
  });
});
