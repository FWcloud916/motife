// `motife render [doc.json] --run <dir>` — DSL (+ run-dir audio sidecar)
// to MP4 through the DslPreview composition.
import { parseArgs } from "node:util";
import path from "node:path";
import { prepareRender, renderVideo } from "../render";
import { loadRunInputs } from "../runInputs";
import { runPaths } from "../rundir";

const USAGE = `usage: pnpm motife render [doc.json] --run <dir> [options]

Renders the run's document (doc.tts.json when present, else doc.json, or
an explicit positional path) to MP4, mixing in narration audio from the
run's audio-manifest.json when it exists.

options:
  --run <dir>    run directory (required)
  --out <file>   output path (default: <run>/final.mp4)`;

export async function run(argv: string[]): Promise<number> {
  let args;
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        run: { type: "string" },
        out: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (err) {
    console.error(`motife render: ${(err as Error).message}\n\n${USAGE}`);
    return 2;
  }
  if (args.values.help) {
    console.log(USAGE);
    return 0;
  }
  const runRoot = args.values.run;
  if (!runRoot) {
    console.error(`motife render: --run <dir> is required\n\n${USAGE}`);
    return 2;
  }

  const paths = runPaths(runRoot);
  let inputs;
  try {
    inputs = await loadRunInputs(runRoot, args.positionals[0]);
  } catch (err) {
    console.error(`motife render: cannot load run inputs from ${runRoot}: ${(err as Error).message}`);
    return 2;
  }
  const outPath = args.values.out ?? paths.finalMp4;

  console.log(`render: ${inputs.docPath}${inputs.audio ? " + narration audio" : " (no audio)"}`);
  const context = await prepareRender({
    rawDoc: inputs.rawDoc,
    audio: inputs.audio,
    publicDir: paths.publicDir,
  });
  await renderVideo(context, outPath);
  console.log(`render: OK -> ${path.relative(process.cwd(), outPath)}`);
  return 0;
}
