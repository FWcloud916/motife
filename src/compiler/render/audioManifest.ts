// The renderer-side view of a run's audio manifest, passed through
// inputProps as a SIDECAR — audio deliberately has no representation in
// the DSL schema itself (an mp3 path is an asset binding, not semantics;
// motife-plan.md §2 決策2 keeps the DSL renderer-agnostic). The TTS stage
// writes a superset of this shape (src/tts/manifest.ts adds measurement
// and cache fields); `.loose()` here is what lets that superset pass
// through unchanged. Browser-safe on purpose: no node imports, so the
// Remotion bundle can validate inputProps in calculateMetadata.
import { z } from "zod";

export const dslAudioManifestEntrySchema = z
  .object({
    /** staticFile() path relative to the bundle's publicDir (e.g.
     * "audio/intro.mp3"), or an absolute http(s)/data URL. */
    src: z.string().min(1),
    /** Seconds of silence before the narration starts inside its scene. */
    delaySeconds: z.number().min(0).optional(),
  })
  .loose();

export const dslAudioManifestSchema = z
  .object({
    scenes: z.record(z.string(), dslAudioManifestEntrySchema),
  })
  .loose();

export type DslAudioManifestEntry = z.infer<typeof dslAudioManifestEntrySchema>;
export type DslAudioManifest = z.infer<typeof dslAudioManifestSchema>;
