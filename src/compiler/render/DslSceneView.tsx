// One DslScene, rendered: the Scene wrapper (background/header/caption)
// plus its root content node. Mirrors exactly what every hand-written
// scenes/*.tsx file used to do by hand.
import type { FC } from "react";
import { Scene } from "../../components";
import type { DslScene } from "../../dsl";
import { trackMapFrom } from "../windows";
import { DslNodeRenderer } from "./nodes";

export interface DslSceneViewProps {
  scene: DslScene;
  durationInFrames: number;
}

export const DslSceneView: FC<DslSceneViewProps> = ({ scene, durationInFrames }) => {
  const trackMap = trackMapFrom(scene.tracks);
  // Omit -> fall back to narration; explicit null -> no caption at all
  // (schema.ts's sceneSchema doc comment; Summary's original scene never
  // rendered one).
  const caption = scene.caption === null ? undefined : (scene.caption ?? scene.narration);

  return (
    <Scene
      durationInFrames={durationInFrames}
      background={scene.background}
      header={scene.header}
      caption={caption}
    >
      <DslNodeRenderer node={scene.content} trackMap={trackMap} />
    </Scene>
  );
};
