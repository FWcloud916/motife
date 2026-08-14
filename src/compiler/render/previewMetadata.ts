// DslPreview's calculateMetadata, extracted from Root.tsx so it is plain
// TypeScript (unit-testable under vitest's node environment, no React).
//
// Two contracts live here:
// 1. The doc is re-validated through parseDocumentOrThrow — inputProps
//    cross a JSON boundary and must never bypass the parse gate.
// 2. Extra inputProps are SPREAD THROUGH, not dropped. The audio sidecar
//    (and anything a future stage rides along) survives only because of
//    `...props` — returning `props: { doc }` here once silently discarded
//    every other key.
import type { CalculateMetadataFunction } from "remotion";
import { parseDocumentOrThrow } from "../parse";
import { dslTotalFrames } from "../timeline";
import { dslAudioManifestSchema } from "./audioManifest";
import type { DslVideoProps } from "./DslVideo";

export const dslPreviewCalculateMetadata: CalculateMetadataFunction<DslVideoProps> = ({
  props,
}) => {
  const doc = parseDocumentOrThrow(props.doc as unknown, "DslPreview");
  // Junk audio inputProps should fail the render loudly here, not surface
  // as a missing <Audio> src deep inside a scene.
  const audio =
    props.audio === undefined ? undefined : dslAudioManifestSchema.parse(props.audio);
  return {
    durationInFrames: dslTotalFrames(doc),
    fps: doc.fps,
    width: doc.width,
    height: doc.height,
    props: { ...props, doc, ...(audio === undefined ? {} : { audio }) },
  };
};
