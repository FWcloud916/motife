// The pipeline's render module — TypeScript sibling of scripts/render-dsl.mjs
// and scripts/smoke.mjs (which stay untouched as the zero-TS verify gate).
// Same discipline as both: one bundle() per run, and ONE shared inputProps
// object handed to selectComposition() and renderMedia()/renderStill() —
// CLAUDE.md requires the identical object, not a structural twin, or
// metadata calculation silently desyncs from the render. Validation is
// not duplicated here either: DslPreview's calculateMetadata runs
// parseDocumentOrThrow inside the bundle; a bad doc rejects the promise.
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import type { CritiqueFrame } from "../critique/frames";

export interface RenderInputProps {
  doc: unknown;
  audio?: unknown;
  [key: string]: unknown;
}

export interface RenderContext {
  serveUrl: string;
  inputProps: RenderInputProps;
  composition: Awaited<ReturnType<typeof selectComposition>>;
}

const ENTRY_POINT = path.join(process.cwd(), "src/remotion/index.ts");

/**
 * Bundles once (with the run's public/ dir so staticFile() resolves the
 * narration audio) and selects DslPreview. The returned context is reused
 * by renderVideo() and renderCritiqueStills() so a full iteration pays for
 * exactly one bundle.
 */
export async function prepareRender(options: {
  rawDoc: unknown;
  audio?: unknown;
  publicDir?: string;
  /** Reuse a previous bundle — the bundle depends only on code and
   * publicDir, not on the document, so a multi-iteration pipeline bundles
   * once and re-selects per iteration. */
  serveUrl?: string;
}): Promise<RenderContext> {
  await ensureBrowser();
  const serveUrl =
    options.serveUrl ??
    (await bundle({
      entryPoint: ENTRY_POINT,
      rspack: true,
      // remotion.config.ts has no effect on SSR APIs — every equivalent
      // option must be stated here as a call argument.
      ...(options.publicDir ? { publicDir: options.publicDir } : {}),
    }));

  const inputProps: RenderInputProps = {
    doc: options.rawDoc,
    ...(options.audio === undefined ? {} : { audio: options.audio }),
  };

  const composition = await selectComposition({ serveUrl, id: "DslPreview", inputProps });
  return { serveUrl, inputProps, composition };
}

export async function renderVideo(context: RenderContext, outputLocation: string): Promise<void> {
  await mkdir(path.dirname(outputLocation), { recursive: true });
  await renderMedia({
    composition: context.composition,
    serveUrl: context.serveUrl,
    codec: "h264",
    imageFormat: "jpeg",
    outputLocation,
    inputProps: context.inputProps,
    overwrite: true,
  });
}

export interface RenderedStill extends CritiqueFrame {
  filePath: string;
}

// 960×540 jpegs: plenty for overlap/overflow detection at roughly a
// quarter of the vision-token cost of full 1080p frames.
const STILL_SCALE = 0.5;

/** Deterministic still filename — `motife critique` re-derives the same
 * names from critiqueFrames() instead of parsing the directory listing. */
export function stillFileName(frame: CritiqueFrame): string {
  return `${frame.sceneId}-${frame.label}-f${String(frame.frame).padStart(4, "0")}.jpeg`;
}

export async function renderCritiqueStills(
  context: RenderContext,
  frames: readonly CritiqueFrame[],
  stillsDir: string,
): Promise<RenderedStill[]> {
  await mkdir(stillsDir, { recursive: true });
  const rendered: RenderedStill[] = [];
  for (const frame of frames) {
    const filePath = path.join(stillsDir, stillFileName(frame));
    await renderStill({
      composition: context.composition,
      serveUrl: context.serveUrl,
      frame: frame.frame,
      inputProps: context.inputProps,
      output: filePath,
      imageFormat: "jpeg",
      scale: STILL_SCALE,
    });
    rendered.push({ ...frame, filePath });
  }
  return rendered;
}
