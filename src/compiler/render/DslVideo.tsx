// The DSL interpreter's composition root. Takes a validated document and
// renders it through the SAME <SceneSeries>/buildTimeline() pipeline every
// hand-written composition (JwtAuthFlow, ComponentGallery) already uses —
// no new transition wiring, no new timeline math. A DslDocument only ever
// reaches this component after src/compiler/parse.ts's parseDocument(),
// never constructed or cast directly (see parse.ts's file header).
import type { FC } from "react";
import { AbsoluteFill } from "remotion";
import { SceneSeries } from "../../remotion/compositions/SceneSeries";
import type { SceneComponentProps } from "../../remotion/compositions/SceneSeries";
import type { DslDocument } from "../../dsl";
import { dslTimeline } from "../timeline";
import { DslSceneView } from "./DslSceneView";

export interface DslVideoProps {
  doc: DslDocument;
  // Remotion's <Composition> generics constrain Props to
  // Record<string, unknown> (Composition.d.ts) — an index signature here
  // is what lets DslVideoProps satisfy that constraint when used as
  // calculateMetadata's type parameter in Root.tsx.
  [key: string]: unknown;
}

export const DslVideo: FC<DslVideoProps> = ({ doc }) => {
  const timeline = dslTimeline(doc);

  // One small wrapper component per scene, closing over that scene's own
  // data — SceneSeries only ever calls it with {durationInFrames}, the
  // same SceneComponentProps contract every hand-written scene component
  // satisfies.
  const components: Record<string, FC<SceneComponentProps>> = {};
  for (const scene of doc.scenes) {
    const ScenePlayer: FC<SceneComponentProps> = ({ durationInFrames }) => (
      <DslSceneView scene={scene} durationInFrames={durationInFrames} />
    );
    ScenePlayer.displayName = `DslScene(${scene.id})`;
    components[scene.id] = ScenePlayer;
  }

  return (
    <AbsoluteFill>
      <SceneSeries timeline={timeline} components={components} />
    </AbsoluteFill>
  );
};
