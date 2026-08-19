// `motife tts [doc.json] --run <dir>` — narration audio + measured-duration
// backfill. Reads the accepted doc, synthesizes per-scene audio into the
// run's public/audio/, writes audio-manifest.json, and emits doc.tts.json
// (the derived, TTS-timed document — checked-in sources are never touched).
import { parseArgs } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { formatIssues, parseDocument } from "../../compiler";
import { backfillDurations } from "../../tts/backfill";
import { synthesizeDoc } from "../../tts/synthesize";
import { createTtsProvider } from "../../tts/provider";
import { runPaths } from "../rundir";
import { OptionError, numberOption } from "./optionValues";

const USAGE = `usage: pnpm motife tts [doc.json] --run <dir> [options]

Synthesizes narration audio per scene and writes <run>/doc.tts.json with
scene durations backfilled from the measured audio.

options:
  --run <dir>       run directory (required)
  --tts <name>      openai | elevenlabs (default: $MOTIFE_TTS or openai)
  --tts-model <id>  TTS model (default: $MOTIFE_TTS_MODEL, or openai
                    gpt-4o-mini-tts / elevenlabs eleven_multilingual_v2)
  --voice <id>      voice (default: $MOTIFE_TTS_VOICE, then openai alloy;
                    elevenlabs: required unless ELEVENLABS_VOICE_ID is set)
  --tts-instructions <text>
                    OpenAI gpt-4o-mini-tts style/accent steering (default:
                    $MOTIFE_TTS_INSTRUCTIONS; openai only)
  --lead <sec>      silence before narration per scene (default 0.3)
  --tail <sec>      padding after narration per scene (default 0.7)
  --force           ignore the narration-hash cache and re-synthesize`;

export async function run(argv: string[]): Promise<number> {
  let args;
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        run: { type: "string" },
        tts: { type: "string" },
        "tts-model": { type: "string" },
        voice: { type: "string" },
        "tts-instructions": { type: "string" },
        lead: { type: "string" },
        tail: { type: "string" },
        force: { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (err) {
    console.error(`motife tts: ${(err as Error).message}\n\n${USAGE}`);
    return 2;
  }
  if (args.values.help) {
    console.log(USAGE);
    return 0;
  }
  const runRoot = args.values.run;
  if (!runRoot) {
    console.error(`motife tts: --run <dir> is required\n\n${USAGE}`);
    return 2;
  }
  const paths = runPaths(runRoot);
  const docPath = args.positionals[0] ?? paths.docJson;

  let rawText: string;
  try {
    rawText = await readFile(docPath, "utf8");
  } catch (err) {
    console.error(`motife tts: cannot read ${docPath}: ${(err as Error).message}`);
    return 2;
  }
  let rawInput: unknown;
  try {
    rawInput = JSON.parse(rawText);
  } catch (err) {
    console.error(
      `motife DSL: 1 error in "${docPath}".\n\n` +
        `ERROR  (whole file)\n  Not valid JSON: ${(err as Error).message}\n` +
        `  fix: point at a file produced by \`motife generate\` or hand-written valid JSON.`,
    );
    return 1;
  }
  const parsed = parseDocument(rawInput);
  if (!parsed.ok) {
    console.error(formatIssues(docPath, parsed.issues));
    return 1;
  }

  let leadSeconds: number | undefined;
  let tailSeconds: number | undefined;
  try {
    leadSeconds = numberOption("--lead", args.values.lead, { min: 0 });
    tailSeconds = numberOption("--tail", args.values.tail, { min: 0 });
  } catch (err) {
    if (err instanceof OptionError) {
      console.error(`motife tts: ${err.message}\n\n${USAGE}`);
      return 2;
    }
    throw err;
  }

  const provider = createTtsProvider({
    flag: args.values.tts,
    voice: args.values.voice,
    model: args.values["tts-model"],
    instructions: args.values["tts-instructions"],
  });
  console.log(
    `tts: ${provider.name} (voice ${provider.voice}, model ${provider.model})` +
      (provider.instructions ? " +instructions" : ""),
  );

  const { manifest, synthesized, reused } = await synthesizeDoc({
    doc: parsed.doc,
    provider,
    audioDir: paths.audioDir,
    manifestPath: paths.audioManifest,
    leadSeconds,
    force: args.values.force ?? false,
    log: (line) => console.log(line),
  });
  console.log(
    `tts: ${synthesized.length} scene(s) synthesized, ${reused.length} reused from cache`,
  );

  const backfilled = backfillDurations(rawInput, manifest, { leadSeconds, tailSeconds });
  const reparsed = parseDocument(backfilled);
  if (!reparsed.ok) {
    // Should be impossible (only durations changed), but the gate stays.
    console.error(formatIssues(parsed.doc.id, reparsed.issues));
    return 1;
  }
  if (reparsed.warnings.length > 0) {
    console.warn(formatIssues(reparsed.doc.id, reparsed.warnings));
  }

  await writeFile(paths.docTtsJson, `${JSON.stringify(backfilled, null, 2)}\n`, "utf8");
  console.log(`wrote ${paths.docTtsJson} and ${paths.audioManifest}`);
  console.log(`next: pnpm motife render ${paths.docTtsJson} --run ${paths.root}`);
  return 0;
}
