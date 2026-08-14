// `motife critique --run <dir> --iter <n>` — vision-model review of an
// iteration's stills (produced by `motife stills`). Writes critique.json
// and critique.md into the iteration directory.
import { parseArgs } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatIssues, parseDocument } from "../../compiler";
import { critiqueFrames } from "../../critique/frames";
import type { CritiqueStillImage } from "../../critique/critique";
import { runCritique } from "../../critique/critique";
import { countBySeverity, renderCritiqueMarkdown } from "../../critique/report";
import { createLlmClient } from "../llm";
import { resolveCritiqueModel, resolveCritiqueProvider } from "../providers";
import { stillFileName } from "../render";
import { loadRunInputs } from "../runInputs";
import { iterationPaths } from "../rundir";

const USAGE = `usage: pnpm motife critique --run <dir> [options]

Sends the iteration's stills to a vision model and writes critique.json
plus critique.md into <run>/iterations/iter-<n>/.

options:
  --run <dir>                 run directory (required)
  --iter <n>                  iteration number (default 1)
  --critique-provider <name>  vision-capable provider (default anthropic)
  --critique-model <id>       model id (default per provider)`;

export async function run(argv: string[]): Promise<number> {
  let args;
  try {
    args = parseArgs({
      args: argv,
      options: {
        run: { type: "string" },
        iter: { type: "string" },
        "critique-provider": { type: "string" },
        "critique-model": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (err) {
    console.error(`motife critique: ${(err as Error).message}\n\n${USAGE}`);
    return 2;
  }
  if (args.values.help) {
    console.log(USAGE);
    return 0;
  }
  const runRoot = args.values.run;
  if (!runRoot) {
    console.error(`motife critique: --run <dir> is required\n\n${USAGE}`);
    return 2;
  }
  const iteration = args.values.iter === undefined ? 1 : Number(args.values.iter);
  const iterPaths = iterationPaths(runRoot, iteration);

  const inputs = await loadRunInputs(runRoot);
  const parsed = parseDocument(inputs.rawDoc);
  if (!parsed.ok) {
    console.error(formatIssues(inputs.docPath, parsed.issues));
    return 1;
  }

  // Re-derive the still set from the doc — the same math `motife stills`
  // used to write them — instead of trusting a directory listing.
  const stills: CritiqueStillImage[] = [];
  for (const frame of critiqueFrames(parsed.doc)) {
    const filePath = path.join(iterPaths.stillsDir, stillFileName(frame));
    try {
      stills.push({
        sceneId: frame.sceneId,
        label: frame.label,
        image: new Uint8Array(await readFile(filePath)),
        mediaType: "image/jpeg",
      });
    } catch {
      console.error(
        `motife critique: missing still ${filePath} — run ` +
          `\`pnpm motife stills --run ${runRoot} --iter ${iteration}\` first.`,
      );
      return 2;
    }
  }

  const provider = resolveCritiqueProvider(args.values["critique-provider"]);
  const model = resolveCritiqueModel(provider, args.values["critique-model"]);
  const client = createLlmClient({ provider, model });
  console.log(`critique: ${stills.length} still(s) → ${provider} (${model})`);

  const report = await runCritique({ client, doc: parsed.doc, stills });
  const markdown = renderCritiqueMarkdown(report, iteration);

  await writeFile(iterPaths.critiqueJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(iterPaths.critiqueMd, markdown, "utf8");

  const { errors, warnings } = countBySeverity(report);
  console.log(`critique: ${errors} error(s), ${warnings} warning(s)`);
  console.log(`wrote ${iterPaths.critiqueJson} and ${iterPaths.critiqueMd}`);
  return 0;
}
