// The zero-TypeScript render path (motife-plan.md §3 Phase 2 acceptance:
// "不碰 TypeScript、只改 JSON 就能產出一支完整影片"). Takes a BARE DSL
// document JSON file — not wrapped in `{"doc": ...}` — and renders it
// through the DslPreview composition (src/remotion/Root.tsx), the same
// way an agent's render step will in Phase 3.
//
// Usage: node scripts/render-dsl.mjs <doc.json> <out.mp4>
//     or: pnpm render:dsl <doc.json> <out.mp4>
//
// Deliberately the same bundle() -> selectComposition() -> renderMedia()
// shape as scripts/smoke.mjs, and the same one-shared-inputProps-object
// discipline CLAUDE.md requires: selectComposition() and renderMedia()
// must see the identical object, not two structurally-equal ones, or
// duration/metadata calculation silently desyncs from the actual render.
//
// Validation is NOT duplicated here in plain Node — this script can't
// import src/compiler/*.ts directly (no TS loader is configured for
// Node's own process, and a couple of compiler classes use parameter
// properties, which need real transformation, not just type-stripping).
// The raw JSON is handed to selectComposition()/renderMedia() as-is; the
// DslPreview composition's calculateMetadata (src/remotion/Root.tsx) runs
// parseDocumentOrThrow() inside the properly-bundled composition code, and
// a validation failure surfaces as a rejected promise here — caught and
// printed below. One validation path, not two that could drift.

import fs from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";

async function main() {
  const [, , docPath, outPath] = process.argv;
  if (!docPath || !outPath) {
    console.error("usage: render-dsl.mjs <doc.json> <out.mp4>");
    process.exit(1);
  }

  let raw;
  try {
    raw = JSON.parse(await fs.readFile(docPath, "utf8"));
  } catch (cause) {
    // A raw ENOENT/SyntaxError doesn't name the input file — this is a
    // CLI whose whole job is "point at a JSON file", so the error should
    // say which one, in the same readable register as the validation
    // errors calculateMetadata produces.
    throw new Error(`cannot read DSL document "${docPath}": ${cause.message}`, { cause });
  }

  await ensureBrowser();

  const serveUrl = await bundle({
    entryPoint: path.join(process.cwd(), "src/remotion/index.ts"),
    rspack: true,
  });

  // One object, reused for both calls below — see this file's header.
  const inputProps = { doc: raw };

  const composition = await selectComposition({
    serveUrl,
    id: "DslPreview",
    inputProps,
  });

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    // Explicit, not left to renderMedia's default (which happens to also
    // be jpeg today): remotion.config.ts sets setVideoImageFormat("jpeg")
    // for the CLI, and CLAUDE.md's rule is that programmatic renders state
    // the equivalent option as a call argument rather than trusting the
    // two to coincide.
    imageFormat: "jpeg",
    outputLocation: outPath,
    inputProps,
    overwrite: true,
  });

  console.log(`render-dsl: OK -> ${path.relative(process.cwd(), outPath)}`);
}

main().catch((error) => {
  console.error("render-dsl: FAILED");
  console.error(error);
  process.exit(1);
});
