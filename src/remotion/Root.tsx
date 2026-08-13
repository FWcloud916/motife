import { Composition } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { loadFonts } from "../components";
import { parseDocumentOrThrow } from "../compiler";
import { dslTotalFrames } from "../compiler/timeline";
import { DslVideo } from "../compiler/render";
import type { DslVideoProps } from "../compiler/render";
import { RAW_DOCS } from "../dsl/docs/manifest";
import { ComponentGallery, GALLERY_TOTAL_FRAMES } from "./compositions/gallery/ComponentGallery";
import { FPS, WIDTH, HEIGHT } from "./compositions/videoDefaults";

// Every eval-set baseline (JwtAuthFlow, MqBackpressure, DbIndexInternals) is
// a DSL document now — the hand-written jwt-auth/ TSX scenes this used to
// A/B against were deleted once the port was verified byte-identical
// (Stage 4's exit gate). ComponentGallery is the one composition that stays
// TSX permanently (component showcase, not an eval-set video — see
// CLAUDE.md). Parsed at module scope, like BLANK_DOC below: a malformed
// baseline fails the bundle loudly rather than rendering garbage.
//
// Deliberately a LITERAL durationInFrames per doc (via dslTimeline, not
// calculateMetadata): scripts/smoke.mjs's correctness must not depend on
// whether getCompositions() evaluates calculateMetadata in this Remotion
// version — DslPreview above is the one composition that needs dynamic
// sizing (an ad-hoc doc has no baseline to pin), every registered baseline
// here does not.
const DSL_DOCS = RAW_DOCS.map((raw) => parseDocumentOrThrow(raw));

// A tiny, permanently-valid document — the default DslPreview shows on
// first Studio load, and what scripts/render-dsl.mjs's --props override
// replaces via calculateMetadata below. Parsed (not just typed) at module
// scope so a regression here fails the bundle immediately, the same
// loud-failure discipline Stage 4's real baselines will follow.
const BLANK_DOC = parseDocumentOrThrow(
  {
    version: 1,
    id: "DslPreview",
    title: "DSL Preview",
    scenes: [
      {
        id: "intro",
        beat: "intro",
        durationInSeconds: 2,
        narration: "A blank DSL preview.",
        content: { type: "text", role: "hero", content: "DSL Preview", align: "center" },
      },
      {
        id: "breakdown",
        beat: "breakdown",
        durationInSeconds: 2,
        narration: "Nothing to see yet.",
        content: { type: "pill", text: "breakdown" },
      },
      {
        id: "walkthrough",
        beat: "walkthrough",
        durationInSeconds: 2,
        narration: "Nothing to see yet.",
        content: { type: "pill", text: "walkthrough" },
      },
      {
        id: "summary",
        beat: "summary",
        durationInSeconds: 2,
        narration: "Pass --props to render a real document.",
        content: { type: "pill", text: "summary" },
      },
    ],
  },
  "DslPreview",
);

// A separately-typed const, not an inline arrow function passed directly
// to the prop: Composition's generic Props parameter is inferred from
// calculateMetadata's own declared type (CalculateMetadataFunction<T>),
// and TS can't work that inference backward through an untyped inline
// callback — matching Remotion's own calculate-metadata.mdx example.
const dslPreviewCalculateMetadata: CalculateMetadataFunction<DslVideoProps> = ({ props }) => {
  const doc = parseDocumentOrThrow(props.doc as unknown, "DslPreview");
  return {
    durationInFrames: dslTotalFrames(doc),
    fps: doc.fps,
    width: doc.width,
    height: doc.height,
    props: { doc },
  };
};

// Registers every font the component library depends on (Inter, Noto Sans
// TC, JetBrains Mono) before any composition below can mount. Called once
// at module scope — @remotion/google-fonts handles delayRender() /
// continueRender() internally, so every render pipeline (Studio,
// renderStill, renderMedia) waits for real glyphs instead of falling back
// to whatever font the host machine happens to have installed.
loadFonts();

// The fragment is intentional, not a leftover — @remotion/eslint-config-flat
// disables react/jsx-no-useless-fragment specifically because more
// <Composition /> entries (the eval-set siblings) are expected here later.
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="ComponentGallery"
      component={ComponentGallery}
      durationInFrames={GALLERY_TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{}}
    />
    {DSL_DOCS.map((doc) => (
      <Composition
        key={doc.id}
        id={doc.id}
        component={DslVideo}
        durationInFrames={dslTotalFrames(doc)}
        fps={doc.fps}
        width={doc.width}
        height={doc.height}
        defaultProps={{ doc }}
      />
    ))}
    {/* The zero-TypeScript render path (motife-plan.md §3 Phase 2
        acceptance): `pnpm render:dsl <doc>.json out.mp4` renders ANY valid
        DSL document through this one composition — nothing here is
        specific to a particular video. calculateMetadata re-validates
        whatever `--props` supplies (BLANK_DOC's shape only fixes the
        Studio's own default preview) and derives duration/fps/size from
        it, rather than trusting the literal defaultProps below past first
        load. Stage 4 registers the real eval-set baselines as their own
        named compositions, each with a module-scope literal
        durationInFrames — this one stays dynamic on purpose, since ad-hoc
        docs don't have a baseline to pin. */}
    <Composition
      id="DslPreview"
      component={DslVideo}
      defaultProps={{ doc: BLANK_DOC }}
      calculateMetadata={dslPreviewCalculateMetadata}
      durationInFrames={1}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);
