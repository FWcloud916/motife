// A living showcase for src/components/ — not part of the eval set's
// narrative-skeleton storyboard system (Scene/Beat/TTS timing), just a
// fixed-duration demo reel so Diagram/FlowPulse/CodeBlock/Terminal/Camera
// are all exercised by an actual render, not only unit tests. This is what
// makes Terminal and Camera show up in `pnpm smoke` even though the JWT
// baseline barely uses them (docs/primitive-inventory.md: 0 uses each at
// Phase 0 exit).
import type { FC } from "react";
import { AbsoluteFill, Sequence } from "remotion";
import {
  Camera,
  CodeBlock,
  Diagram,
  Scene,
  Terminal,
} from "../../../components";
import type { GraphSpec } from "../../../components";
import { FPS } from "../jwt-auth/storyboard";

const DIAGRAM_FRAMES = 5 * FPS;
const CODE_FRAMES = 5 * FPS;
const TERMINAL_FRAMES = 5 * FPS;
const CAMERA_FRAMES = 6 * FPS;

export const GALLERY_TOTAL_FRAMES = DIAGRAM_FRAMES + CODE_FRAMES + TERMINAL_FRAMES + CAMERA_FRAMES;

const DEMO_GRAPH: GraphSpec = {
  direction: "right",
  nodes: [
    { id: "client", icon: "browser", label: "Client", tone: "info" },
    { id: "queue", icon: "queue", label: "Queue", tone: "primary" },
    { id: "worker", icon: "server", label: "Worker", tone: "success" },
  ],
  edges: [
    { from: "client", to: "queue", label: "publish" },
    { from: "queue", to: "worker", label: "consume" },
  ],
};

const DiagramDemo: FC = () => (
  <Scene
    durationInFrames={DIAGRAM_FRAMES}
    background={{ variant: "grid", glow: "primary" }}
    header={{ eyebrow: "Component Gallery", title: "Diagram + FlowPulse" }}
  >
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "80%", height: "60%" }}>
        <Diagram
          graph={DEMO_GRAPH}
          activeNodes={["queue"]}
          reveal={{ order: "rank", window: { from: 0, to: 0.3 } }}
          flows={[
            { edge: "client->queue", window: { from: 0.35, to: 0.65 }, tone: "info", label: "msg" },
            { edge: "queue->worker", window: { from: 0.65, to: 0.95 }, tone: "success", label: "ack" },
          ]}
        />
      </div>
    </AbsoluteFill>
  </Scene>
);

const CODE_LINES = [
  { segments: ["function ", { text: "handle", tone: "syntaxA" as const }, "(msg) {"] },
  { segments: ["  const ", { text: "result", tone: "syntaxB" as const }, " = process(msg);"] },
  { segments: ["  return result;"], diff: "added" as const },
  { segments: ["  return null;"], diff: "removed" as const },
  { segments: ["}"] },
];

const CodeBlockDemo: FC = () => (
  <Scene
    durationInFrames={CODE_FRAMES}
    background={{ variant: "grid", glow: "info" }}
    header={{ eyebrow: "Component Gallery", title: "CodeBlock" }}
  >
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 700 }}>
        <CodeBlock
          title="handler.ts"
          lines={CODE_LINES}
          reveal={{ mode: "staggered", window: { from: 0, to: 0.35 } }}
          highlights={[{ lines: [1, 1], window: { from: 0.4, to: 0.75 } }]}
        />
      </div>
    </AbsoluteFill>
  </Scene>
);

const TerminalDemo: FC = () => (
  <Scene
    durationInFrames={TERMINAL_FRAMES}
    background={{ variant: "grid", glow: "success" }}
    header={{ eyebrow: "Component Gallery", title: "Terminal" }}
  >
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 700 }}>
        <Terminal
          title="worker"
          steps={[
            {
              command: "queue consume --topic events",
              output: ["Connected.", "Consuming..."],
              window: { from: 0.05, to: 0.55 },
            },
            {
              command: "queue ack msg-42",
              output: ["ok"],
              window: { from: 0.6, to: 0.95 },
            },
          ]}
        />
      </div>
    </AbsoluteFill>
  </Scene>
);

const CameraDemo: FC = () => (
  <Scene
    durationInFrames={CAMERA_FRAMES}
    background={{ variant: "grid", glow: "warning" }}
    header={{ eyebrow: "Component Gallery", title: "Camera" }}
  >
    <Camera
      shots={[
        { window: { from: 0, to: 0.01 }, focus: "all", zoom: "wide" },
        { window: { from: 0.15, to: 0.4 }, focus: { node: "client" }, zoom: "close" },
        { window: { from: 0.5, to: 0.75 }, focus: { node: "worker" }, zoom: "close" },
        { window: { from: 0.85, to: 1 }, focus: "all", zoom: "wide" },
      ]}
    >
      {/* No centering/sizing wrapper here on purpose — a Diagram nested in
          a Camera renders at native scale starting at its own (0,0), and
          the node rects it registers with Camera are in that same local
          space. Any offsetting wrapper in between would desync the two;
          Camera's own shots (not CSS) are what frame the content. */}
      <Diagram graph={DEMO_GRAPH} reveal={{ window: { from: 0, to: 0.05 } }} />
    </Camera>
  </Scene>
);

export const ComponentGallery: FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={DIAGRAM_FRAMES}>
      <DiagramDemo />
    </Sequence>
    <Sequence from={DIAGRAM_FRAMES} durationInFrames={CODE_FRAMES}>
      <CodeBlockDemo />
    </Sequence>
    <Sequence from={DIAGRAM_FRAMES + CODE_FRAMES} durationInFrames={TERMINAL_FRAMES}>
      <TerminalDemo />
    </Sequence>
    <Sequence
      from={DIAGRAM_FRAMES + CODE_FRAMES + TERMINAL_FRAMES}
      durationInFrames={CAMERA_FRAMES}
    >
      <CameraDemo />
    </Sequence>
  </AbsoluteFill>
);
