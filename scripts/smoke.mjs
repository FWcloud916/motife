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
import { ensureBrowser, getCompositions, renderStill } from "@remotion/renderer";

// Long compositions (the eval-set narrative videos) get 8 samples spread
// across the timeline; short ones (the component gallery demo reel) get 4
// — proportionally denser sampling doesn't add much signal on a shorter
// timeline and just slows the gate down.
const LONG_SAMPLE_COUNT = 8;
const SHORT_SAMPLE_COUNT = 4;
const LONG_THRESHOLD_FRAMES = 600; // 20s at 30fps
const OUT_DIR = path.join(process.cwd(), "out", "smoke");

async function main() {
  await ensureBrowser();

  // Must match Config.setRspack(true) in remotion.config.ts — that file has
  // no effect here, so the bundler choice has to be repeated explicitly.
  const serveUrl = await bundle({
    entryPoint: path.join(process.cwd(), "src/remotion/index.ts"),
    rspack: true,
  });

  // Deliberately ONE object, reused for every composition below and for
  // both getCompositions() and renderStill(). Passing two different (even
  // structurally-equal-looking) objects here is a classic Remotion footgun
  // that silently desyncs duration/metadata calculation from the actual
  // render.
  const inputProps = {};

  // Every registered <Composition> gets smoked — adding one to Root.tsx
  // (an eval-set sibling, or a new demo scene) is automatically covered,
  // no wiring to touch here.
  const compositions = await getCompositions(serveUrl, { inputProps });

  let totalFrames = 0;
  for (const composition of compositions) {
    const sampleCount =
      composition.durationInFrames >= LONG_THRESHOLD_FRAMES
        ? LONG_SAMPLE_COUNT
        : SHORT_SAMPLE_COUNT;
    const lastFrame = composition.durationInFrames - 1;
    const frames = Array.from({ length: sampleCount }, (_, i) =>
      Math.round((i / (sampleCount - 1)) * lastFrame),
    );
    const uniqueFrames = [...new Set(frames)];

    for (const frame of uniqueFrames) {
      const output = path.join(
        OUT_DIR,
        composition.id,
        `frame-${String(frame).padStart(4, "0")}.png`,
      );
      await renderStill({
        composition,
        serveUrl,
        frame,
        inputProps,
        output,
      });
      console.log(
        `smoke: rendered ${composition.id} frame ${frame} -> ${path.relative(process.cwd(), output)}`,
      );
    }

    totalFrames += uniqueFrames.length;
    console.log(
      `smoke: ${composition.id} OK — ${uniqueFrames.length} frames rendered from a ${composition.durationInFrames}-frame composition`,
    );
  }

  console.log(
    `smoke: OK — ${compositions.length} composition(s), ${totalFrames} frames total`,
  );
}

main().catch((error) => {
  console.error("smoke: FAILED");
  console.error(error);
  process.exit(1);
});
