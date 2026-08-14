// The DSL interpreter's composition root. Takes a validated document and
// renders it through the SAME <SceneSeries>/buildTimeline() pipeline every
// hand-written composition (JwtAuthFlow, ComponentGallery) already uses —
// no new transition wiring, no new timeline math. A DslDocument only ever
// reaches this component after src/compiler/parse.ts's parseDocument(),
// never constructed or cast directly (see parse.ts's file header).
import type { FC } from "react";
import { useMemo } from "react";
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from "remotion";
// CLAUDE.md hard constraint: <Audio> comes from @remotion/media, NOT from
// "remotion" — no lint rule catches the wrong import.
import { Audio } from "@remotion/media";
import { SceneSeries } from "../../remotion/compositions/SceneSeries";
import type { SceneComponentProps } from "../../remotion/compositions/SceneSeries";
import type { DslDocument } from "../../dsl";
import { dslTimeline } from "../timeline";
import { DslSceneView } from "./DslSceneView";
import type { DslAudioManifest, DslAudioManifestEntry } from "./audioManifest";

export interface DslVideoProps {
  doc: DslDocument;
  /** Narration audio sidecar (Phase 3's TTS stage). Optional: baselines
   * and the Studio's default preview render silently without it. Keyed by
   * scene id; scenes without an entry simply have no narration track. */
  audio?: DslAudioManifest;
  // Remotion's <Composition> generics constrain Props to
  // Record<string, unknown> (Composition.d.ts) — an index signature here
  // is what lets DslVideoProps satisfy that constraint when used as
  // calculateMetadata's type parameter in Root.tsx.
  [key: string]: unknown;
}

/** Narration for one scene, delayed by delaySeconds within the scene's own
 * Sequence (frame 0 here is the scene's start, not the composition's). */
const SceneNarration: FC<{ entry: DslAudioManifestEntry }> = ({ entry }) => {
  const { fps } = useVideoConfig();
  const from = Math.round((entry.delaySeconds ?? 0) * fps);
  const src = /^(https?:|data:)/.test(entry.src) ? entry.src : staticFile(entry.src);
  return (
    <Sequence from={from}>
      <Audio src={src} />
    </Sequence>
  );
};

export const DslVideo: FC<DslVideoProps> = ({ doc, audio }) => {
  // Memoized on inputs, and that matters beyond saving a loop: Remotion
  // re-renders this component once per frame, and the per-scene wrapper
  // components below are React component TYPES. Recreating them each
  // render gives React a different function identity per frame, which
  // unmounts and remounts the whole scene subtree every frame — replaying
  // every mount effect, including Diagram's fonts-gated node measurement
  // and its delayRender handle, once per frame instead of once per scene.
  const { timeline, components } = useMemo(() => {
    // One small wrapper component per scene, closing over that scene's own
    // data — SceneSeries only ever calls it with {durationInFrames}, the
    // same SceneComponentProps contract every hand-written scene component
    // satisfies.
    const sceneComponents: Record<string, FC<SceneComponentProps>> = {};
    for (const scene of doc.scenes) {
      const audioEntry = audio?.scenes[scene.id];
      const ScenePlayer: FC<SceneComponentProps> = ({ durationInFrames }) => (
        <>
          {audioEntry ? <SceneNarration entry={audioEntry} /> : null}
          <DslSceneView scene={scene} durationInFrames={durationInFrames} />
        </>
      );
      ScenePlayer.displayName = `DslScene(${scene.id})`;
      sceneComponents[scene.id] = ScenePlayer;
    }
    return { timeline: dslTimeline(doc), components: sceneComponents };
  }, [doc, audio]);

  return (
    <AbsoluteFill>
      <SceneSeries timeline={timeline} components={components} />
    </AbsoluteFill>
  );
};
