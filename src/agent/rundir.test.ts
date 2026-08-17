import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultRunRoot, ensureRunDir, iterationPaths, runPaths, slugify } from "./rundir";

describe("slugify", () => {
  it("lowercases and hyphenates ASCII", () => {
    expect(slugify("Explain JWT auth!")).toBe("explain-jwt-auth");
    expect(slugify("  spaces   and---dashes  ")).toBe("spaces-and-dashes");
  });

  it("truncates without a trailing hyphen", () => {
    const slug = slugify("a".repeat(30) + " tail-that-gets-cut", 32);
    expect(slug.length).toBeLessThanOrEqual(32);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("returns empty for pure-CJK input (callers fall back)", () => {
    expect(slugify("解釋資料庫索引原理")).toBe("");
  });
});

describe("defaultRunRoot", () => {
  const now = new Date(2026, 7, 15, 9, 5, 7); // 2026-08-15 09:05:07 local

  function basename(root: string): string {
    return root.split(path.sep).pop() ?? "";
  }

  it("stamps date+time, a collision nonce, and the slug", () => {
    expect(basename(defaultRunRoot("Explain JWT", now))).toMatch(
      /^20260815-090507-[0-9a-f]{4}-explain-jwt$/,
    );
  });

  it("stays nonce-only when the slug is empty (CJK prompts)", () => {
    expect(basename(defaultRunRoot("解釋 JWT", now))).toMatch(/^20260815-090507-[0-9a-f]{4}-jwt$/);
    expect(basename(defaultRunRoot("解釋索引", now))).toMatch(/^20260815-090507-[0-9a-f]{4}$/);
  });

  it("gives two same-second runs with the same prompt distinct roots", () => {
    expect(defaultRunRoot("Explain JWT", now)).not.toBe(defaultRunRoot("Explain JWT", now));
  });
});

describe("run/iteration path layout", () => {
  it("is the documented contract (docs/agent-pipeline.md §3)", () => {
    const paths = runPaths("out/runs/x");
    expect(paths.docJson).toBe(path.join("out/runs/x", "doc.json"));
    expect(paths.docFinalJson).toBe(path.join("out/runs/x", "doc.final.json"));
    expect(paths.docTtsJson).toBe(path.join("out/runs/x", "doc.tts.json"));
    expect(paths.audioDir).toBe(path.join("out/runs/x", "public", "audio"));
    expect(paths.audioManifest).toBe(path.join("out/runs/x", "audio-manifest.json"));
    expect(paths.finalMp4).toBe(path.join("out/runs/x", "final.mp4"));

    const iter = iterationPaths("out/runs/x", 2);
    expect(iter.root).toBe(path.join("out/runs/x", "iterations", "iter-2"));
    expect(iter.stillsDir).toBe(path.join(iter.root, "stills"));
    expect(iter.critiqueMd).toBe(path.join(iter.root, "critique.md"));
    expect(iter.docJson).toBe(path.join(iter.root, "doc.json"));
  });
});

describe("ensureRunDir", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "motife-rundir-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("creates the directory skeleton and records the prompt", async () => {
    const root = path.join(dir, "run-a");
    const paths = await ensureRunDir(root, "the concept");

    for (const created of [paths.attemptsDir, paths.audioDir, paths.iterationsDir]) {
      expect((await stat(created)).isDirectory()).toBe(true);
    }
    expect(await readFile(paths.promptTxt, "utf8")).toBe("the concept\n");
  });

  it("leaves prompt.txt alone when no prompt is given (resuming a run)", async () => {
    const root = path.join(dir, "run-b");
    await ensureRunDir(root, "original");
    await ensureRunDir(root);
    expect(await readFile(path.join(root, "prompt.txt"), "utf8")).toBe("original\n");
  });
});
