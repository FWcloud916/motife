// Duration backfill — the "audio first, frames derived" mandate
// (motife-plan.md §2 決策4) made concrete. Operates on the RAW document
// JSON, never on a parsed DslDocument: a DslDocument only ever comes from
// parseDocument(), and mutating one here would launder an unvalidated
// object past that gate. Callers re-parse the returned JSON.
//
// Only durationInSeconds changes. That is sufficient by design: every
// step window inside a scene is a symbolic WindowRef (fractions or track
// steps), so rescaling the scene's duration rescales everything in it
// coherently (docs/dsl-schema.md "WindowRef — symbolic timing").
import type { AudioManifest } from "./manifest";

export interface BackfillOptions {
  /** Silence before narration starts. Default 0.3s. */
  leadSeconds?: number;
  /** Breathing room after narration ends. Default 0.7s. */
  tailSeconds?: number;
}

export const DEFAULT_LEAD_SECONDS = 0.3;
export const DEFAULT_TAIL_SECONDS = 0.7;

/**
 * Returns a deep copy of `rawDoc` with every scene's durationInSeconds
 * replaced by lead + measured audio + tail (rounded to 2 decimals).
 * Throws if the manifest is missing a scene the document has — a partial
 * backfill would silently keep a guessed duration.
 */
export function backfillDurations(
  rawDoc: unknown,
  manifest: AudioManifest,
  options: BackfillOptions = {},
): unknown {
  const lead = options.leadSeconds ?? DEFAULT_LEAD_SECONDS;
  const tail = options.tailSeconds ?? DEFAULT_TAIL_SECONDS;

  const doc = structuredClone(rawDoc);
  if (typeof doc !== "object" || doc === null || !Array.isArray((doc as { scenes?: unknown }).scenes)) {
    throw new Error("backfillDurations: raw document has no scenes array.");
  }

  for (const scene of (doc as { scenes: unknown[] }).scenes) {
    if (typeof scene !== "object" || scene === null) {
      throw new Error("backfillDurations: scene is not an object.");
    }
    const id = (scene as { id?: unknown }).id;
    if (typeof id !== "string") {
      throw new Error("backfillDurations: scene has no string id.");
    }
    const entry = manifest.scenes[id];
    if (!entry) {
      throw new Error(
        `backfillDurations: audio manifest has no entry for scene "${id}" — ` +
          `re-run \`motife tts\` so every scene has measured audio.`,
      );
    }
    (scene as { durationInSeconds: number }).durationInSeconds =
      Math.round((lead + entry.durationInSeconds + tail) * 100) / 100;
  }

  return doc;
}
