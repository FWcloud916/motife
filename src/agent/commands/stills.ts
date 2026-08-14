// `motife stills [doc.json] --run <dir>` — critique key frames as images.
// In skill mode the invoking agent reads these files itself and plays the
// vision critic; in API mode `motife critique` sends them to a model.
import { parseArgs } from "node:util";
import path from "node:path";
import { formatIssues, parseDocument } from "../../compiler";
import { critiqueFrames } from "../../critique/frames";
import { prepareRender, renderCritiqueStills } from "../render";
import { loadRunInputs } from "../runInputs";
import { iterationPaths, runPaths } from "../rundir";

const USAGE = `usage: pnpm motife stills [doc.json] --run <dir> [options]

Renders three key frames per scene (early / mid / late) into the
iteration's stills directory and prints their paths.

options:
  --run <dir>    run directory (required)
  --iter <n>     iteration number (default 1) — stills land in
                 <run>/iterations/iter-<n>/stills/`;

export async function run(argv: string[]): Promise<number> {
  let args;
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        run: { type: "string" },
        iter: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (err) {
    console.error(`motife stills: ${(err as Error).message}\n\n${USAGE}`);
    return 2;
  }
  if (args.values.help) {
    console.log(USAGE);
    return 0;
  }
  const runRoot = args.values.run;
  if (!runRoot) {
    console.error(`motife stills: --run <dir> is required\n\n${USAGE}`);
    return 2;
  }
  const iteration = args.values.iter === undefined ? 1 : Number(args.values.iter);

  const paths = runPaths(runRoot);
  const inputs = await loadRunInputs(runRoot, args.positionals[0]);

  const parsed = parseDocument(inputs.rawDoc);
  if (!parsed.ok) {
    console.error(formatIssues(inputs.docPath, parsed.issues));
    return 1;
  }

  const frames = critiqueFrames(parsed.doc);
  const context = await prepareRender({
    rawDoc: inputs.rawDoc,
    audio: inputs.audio,
    publicDir: paths.publicDir,
  });
  const stills = await renderCritiqueStills(
    context,
    frames,
    iterationPaths(runRoot, iteration).stillsDir,
  );

  for (const still of stills) {
    console.log(path.relative(process.cwd(), still.filePath));
  }
  console.log(`stills: ${stills.length} frame(s) across ${parsed.doc.scenes.length} scene(s)`);
  return 0;
}
