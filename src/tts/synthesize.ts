// Per-scene synthesis loop with content-hash caching. The narrationHash
// (provider + voice + narration text) is what makes the critique-revision
// loop cheap: a revision that only moves boxes re-synthesizes nothing; a
// revision that rewrites one scene's narration re-synthesizes one file.
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DslDocument } from "../dsl";
import type { AudioManifest, AudioManifestEntry } from "./manifest";
import { narrationHash, parseAudioManifest } from "./manifest";
import type { TtsProvider } from "./provider";
import { DEFAULT_LEAD_SECONDS } from "./backfill";

export interface SynthesizeDocOptions {
  /** Validated document — scene ids and narration come from here. */
  doc: DslDocument;
  provider: TtsProvider;
  /** Directory the mp3 files land in (<run>/public/audio). */
  audioDir: string;
  /** Manifest file to read (for cache hits) and rewrite (<run>/audio-manifest.json). */
  manifestPath: string;
  leadSeconds?: number;
  /** Re-synthesize everything, ignoring cache hits. */
  force?: boolean;
  /** Injectable for tests; defaults to music-metadata's parseFile. */
  measureDurationSeconds?: (filePath: string) => Promise<number>;
  log?: (line: string) => void;
}

export interface SynthesizeDocResult {
  manifest: AudioManifest;
  synthesized: string[];
  reused: string[];
}

async function measureWithMusicMetadata(filePath: string): Promise<number> {
  const { parseFile } = await import("music-metadata");
  const metadata = await parseFile(filePath);
  const duration = metadata.format.duration;
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not measure audio duration of ${filePath}.`);
  }
  return duration;
}

export async function synthesizeDoc(options: SynthesizeDocOptions): Promise<SynthesizeDocResult> {
  const {
    doc,
    provider,
    audioDir,
    manifestPath,
    force = false,
    leadSeconds = DEFAULT_LEAD_SECONDS,
    measureDurationSeconds = measureWithMusicMetadata,
    log = () => {},
  } = options;

  await mkdir(audioDir, { recursive: true });

  const previous = force ? null : await readManifest(manifestPath);
  const scenes: Record<string, AudioManifestEntry> = {};
  const synthesized: string[] = [];
  const reused: string[] = [];

  for (const scene of doc.scenes) {
    const hash = narrationHash(provider.name, provider.voice, scene.narration);
    const src = `audio/${scene.id}.mp3`;
    const filePath = path.join(audioDir, `${scene.id}.mp3`);

    const prior = previous?.scenes[scene.id];
    if (prior && prior.narrationHash === hash && (await fileExists(filePath))) {
      scenes[scene.id] = { ...prior, src, delaySeconds: leadSeconds };
      reused.push(scene.id);
      log(`tts: ${scene.id} unchanged (cached)`);
      continue;
    }

    log(`tts: ${scene.id} → ${provider.name}/${provider.voice}`);
    const { audio } = await provider.synthesize(scene.narration);
    await writeFile(filePath, audio);
    const durationInSeconds = await measureDurationSeconds(filePath);
    scenes[scene.id] = { src, durationInSeconds, narrationHash: hash, delaySeconds: leadSeconds };
    synthesized.push(scene.id);
  }

  const manifest: AudioManifest = { scenes };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { manifest, synthesized, reused };
}

async function readManifest(manifestPath: string): Promise<AudioManifest | null> {
  try {
    const raw = await readFile(manifestPath, "utf8");
    return parseAudioManifest(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}
