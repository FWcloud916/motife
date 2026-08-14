// Run-directory layout — the contract between pipeline stages (and between
// API mode and skill mode, which share it byte-for-byte). Everything a run
// produces lives under out/runs/<name>/; checked-in sources are never
// touched (the eval docs stay pristine — manifest.test.ts pins depend on it).
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface RunPaths {
  root: string;
  promptTxt: string;
  attemptsDir: string;
  /** The accepted, pre-TTS document. */
  docJson: string;
  /** Served as the bundle's publicDir so <Audio src={staticFile(...)}> resolves. */
  publicDir: string;
  audioDir: string;
  audioManifest: string;
  /** The duration-backfilled derived document (never written to src/). */
  docTtsJson: string;
  iterationsDir: string;
  finalMp4: string;
  reportMd: string;
}

export function runPaths(root: string): RunPaths {
  return {
    root,
    promptTxt: path.join(root, "prompt.txt"),
    attemptsDir: path.join(root, "attempts"),
    docJson: path.join(root, "doc.json"),
    publicDir: path.join(root, "public"),
    audioDir: path.join(root, "public", "audio"),
    audioManifest: path.join(root, "audio-manifest.json"),
    docTtsJson: path.join(root, "doc.tts.json"),
    iterationsDir: path.join(root, "iterations"),
    finalMp4: path.join(root, "final.mp4"),
    reportMd: path.join(root, "report.md"),
  };
}

export interface IterationPaths {
  root: string;
  videoMp4: string;
  stillsDir: string;
  critiqueJson: string;
  critiqueMd: string;
}

export function iterationPaths(runRoot: string, iteration: number): IterationPaths {
  const root = path.join(runRoot, "iterations", `iter-${iteration}`);
  return {
    root,
    videoMp4: path.join(root, "video.mp4"),
    stillsDir: path.join(root, "stills"),
    critiqueJson: path.join(root, "critique.json"),
    critiqueMd: path.join(root, "critique.md"),
  };
}

/** ASCII-safe slug of a prompt; CJK prompts typically produce nothing, so
 * callers fall back to the date-stamped default. */
export function slugify(text: string, maxLength = 40): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/, "");
}

export function defaultRunRoot(prompt: string, now = new Date()): string {
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const time = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  const slug = slugify(prompt);
  const name = slug.length > 0 ? `${stamp}-${time}-${slug}` : `${stamp}-${time}-run`;
  return path.join("out", "runs", name);
}

export async function ensureRunDir(root: string, prompt?: string): Promise<RunPaths> {
  const paths = runPaths(root);
  await mkdir(paths.attemptsDir, { recursive: true });
  await mkdir(paths.audioDir, { recursive: true });
  await mkdir(paths.iterationsDir, { recursive: true });
  if (prompt !== undefined) {
    await writeFile(paths.promptTxt, `${prompt}\n`, "utf8");
  }
  return paths;
}
