// Loads a run directory's render inputs: the document (doc.tts.json when
// the TTS stage has run, else doc.json) and the audio manifest when
// present. Shared by `motife render`, `motife stills`, and the pipeline.
import { readFile, stat } from "node:fs/promises";
import { parseAudioManifest } from "../tts/manifest";
import type { AudioManifest } from "../tts/manifest";
import { runPaths } from "./rundir";

export interface RunInputs {
  docPath: string;
  rawDoc: unknown;
  audio: AudioManifest | undefined;
}

export async function loadRunInputs(runRoot: string, docOverride?: string): Promise<RunInputs> {
  const paths = runPaths(runRoot);
  const docPath =
    docOverride ?? ((await fileExists(paths.docTtsJson)) ? paths.docTtsJson : paths.docJson);
  const rawDoc: unknown = JSON.parse(await readFile(docPath, "utf8"));

  let audio: AudioManifest | undefined;
  try {
    const manifest = parseAudioManifest(
      JSON.parse(await readFile(paths.audioManifest, "utf8")),
    );
    audio = manifest ?? undefined;
  } catch {
    audio = undefined;
  }
  return { docPath, rawDoc, audio };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}
