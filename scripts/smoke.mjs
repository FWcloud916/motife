// Render smoke test — the third layer of `pnpm verify`. Layers 1 (tsc) and
// 2 (eslint) are static; only an actual render proves the composition tree
// mounts and produces real pixels (catches a non-monotonic interpolate()
// input range, a missing staticFile() asset, a crash in a scene component).
//
// This is deliberately the same bundle() -> selectComposition() ->
// renderStill() pipeline that Phase 3's render -> critique -> revise loop
// will use — writing it now means Phase 3 extends an already-working path
// instead of standing one up under pressure.

import path from "node:path";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderStill, selectComposition } from "@remotion/renderer";

const COMPOSITION_ID = "JwtAuthFlow";
const SAMPLE_COUNT = 8;
const OUT_DIR = path.join(process.cwd(), "out", "smoke");

async function main() {
  await ensureBrowser();

  // Must match Config.setRspack(true) in remotion.config.ts — that file has
  // no effect here, so the bundler choice has to be repeated explicitly.
  const serveUrl = await bundle({
    entryPoint: path.join(process.cwd(), "src/remotion/index.ts"),
    rspack: true,
  });

  // Deliberately ONE object: selectComposition() and renderStill() below
  // both receive it. Passing two different (even structurally-equal-looking)
  // objects here is a classic Remotion footgun that silently desyncs
  // duration/metadata calculation from the actual render.
  const inputProps = {};

  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps,
  });

  // Sample frames spread evenly across the whole timeline. Because this is
  // derived from composition.durationInFrames, adding a scene to
  // storyboard.ts automatically spreads the 8 samples over the new
  // material — no wiring to touch here.
  const lastFrame = composition.durationInFrames - 1;
  const frames = Array.from({ length: SAMPLE_COUNT }, (_, i) =>
    Math.round((i / (SAMPLE_COUNT - 1)) * lastFrame),
  );
  const uniqueFrames = [...new Set(frames)];

  for (const frame of uniqueFrames) {
    const output = path.join(OUT_DIR, `frame-${String(frame).padStart(4, "0")}.png`);
    await renderStill({
      composition,
      serveUrl,
      frame,
      inputProps,
      output,
    });
    console.log(`smoke: rendered frame ${frame} -> ${path.relative(process.cwd(), output)}`);
  }

  console.log(`smoke: OK — ${uniqueFrames.length} frames rendered from a ${composition.durationInFrames}-frame composition`);
}

main().catch((error) => {
  console.error("smoke: FAILED");
  console.error(error);
  process.exit(1);
});
