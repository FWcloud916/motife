// The audio manifest — the TTS stage's durable record (one entry per
// scene) and, passed through inputProps, the renderer's asset binding.
// Audio stays OUT of the DSL schema on purpose: an mp3 path is an asset
// binding, not semantics, and the DSL must stay renderer-agnostic
// (motife-plan.md §2 決策2). The manifest is the sidecar that carries it.
import { createHash } from "node:crypto";
import { z } from "zod";

export const audioManifestEntrySchema = z
  .object({
    /** Relative to the run's public/ dir, e.g. "audio/intro.mp3" —
     * resolved by the renderer via staticFile(). */
    src: z.string().min(1),
    /** Measured from the actual audio file, never estimated. */
    durationInSeconds: z.number().positive(),
    /** sha256 over provider/voice/narration — the cache key that lets a
     * revision loop skip re-synthesis of unchanged scenes. */
    narrationHash: z.string().min(1),
    /** Silence before the narration starts inside its scene. */
    delaySeconds: z.number().min(0),
  })
  .strict();

export const audioManifestSchema = z
  .object({
    scenes: z.record(z.string(), audioManifestEntrySchema),
  })
  .strict();

export type AudioManifestEntry = z.infer<typeof audioManifestEntrySchema>;
export type AudioManifest = z.infer<typeof audioManifestSchema>;

export function narrationHash(provider: string, voice: string, narration: string): string {
  return createHash("sha256").update(`${provider}\n${voice}\n${narration}`).digest("hex");
}

/** Zod-gated parse of a manifest file's contents; returns null (never
 * throws) so a stale/corrupt manifest just means a full re-synthesis. */
export function parseAudioManifest(input: unknown): AudioManifest | null {
  const result = audioManifestSchema.safeParse(input);
  return result.success ? result.data : null;
}
