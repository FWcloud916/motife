// The DSL interpreter's node layer — one renderer per DslNode variant,
// each translating that node's fields (semantic, WindowRef-based) into the
// matching library component's props (Window-based, resolved). Imports
// exclusively from the components barrel, same as any hand-written scene.
//
// NODE_RENDERERS is a Record<DslNodeType, FC>, not a switch statement —
// that's deliberate. It's where the compile-time exhaustiveness the old
// TSX `sceneRegistry.tsx` gave scene ids is preserved for node kinds: add a
// variant to dslNodeSchema's union without a matching entry here, and this
// file fails to typecheck, not silently renders nothing at runtime.
import type { FC } from "react";
import {
  Callout,
  Camera,
  CameraTarget,
  CodeBlock,
  Diagram,
  Icon,
  Meter,
  Stack,
  StepReveal,
  StepSwitch,
  Terminal,
  Text,
} from "../../components";
import type { Window } from "../../components";
import type { DslNode, DslNodeOf, DslNodeType, Track, WindowRef } from "../../dsl";
import { resolveWindowRef } from "../windows";
import { stepWindows } from "../../components";

export interface NodeProps<T extends DslNode = DslNode> {
  node: T;
  trackMap: ReadonlyMap<string, Track>;
}

function resolveOptionalWindow(
  ref: WindowRef | undefined,
  trackMap: ReadonlyMap<string, Track>,
): Window | undefined {
  return ref ? resolveWindowRef(ref, trackMap) : undefined;
}

/** The recursion entry point every composite node (stack/card/camera/
 * cameraTarget/switch) uses for its own children — looks up the child's
 * own type in NODE_RENDERERS and renders it. */
export const DslNodeRenderer: FC<NodeProps> = ({ node, trackMap }) => {
  const Renderer = NODE_RENDERERS[node.type] as FC<NodeProps>;
  return <Renderer node={node} trackMap={trackMap} />;
};

const StackNodeRenderer: FC<NodeProps<DslNodeOf<"stack">>> = ({ node, trackMap }) => (
  <Stack
    direction={node.direction}
    align={node.align}
    justify={node.justify}
    gap={node.gap}
    width={node.width}
    grow={node.grow}
    window={resolveOptionalWindow(node.window, trackMap)}
  >
    {(node.children ?? []).map((child, index) => (
      <DslNodeRenderer key={index} node={child} trackMap={trackMap} />
    ))}
  </Stack>
);

const TextNodeRenderer: FC<NodeProps<DslNodeOf<"text">>> = ({ node, trackMap }) => (
  <Text
    role={node.role}
    content={node.content}
    tone={node.tone}
    align={node.align}
    window={resolveOptionalWindow(node.window, trackMap)}
  />
);

const MeterNodeRenderer: FC<NodeProps<DslNodeOf<"meter">>> = ({ node, trackMap }) => (
  <Meter
    tone={node.tone}
    label={node.label}
    size={node.size}
    window={resolveOptionalWindow(node.window, trackMap)}
    value={node.value}
    threshold={node.threshold}
  />
);

const IconNodeRenderer: FC<NodeProps<DslNodeOf<"icon">>> = ({ node }) => (
  <Icon name={node.name} tone={node.tone} size={node.size} />
);

const PillNodeRenderer: FC<NodeProps<DslNodeOf<"pill">>> = ({ node, trackMap }) => (
  <Callout
    variant="pill"
    text={node.text}
    icon={node.icon}
    tone={node.tone}
    window={resolveOptionalWindow(node.window, trackMap)}
  />
);

const BannerNodeRenderer: FC<NodeProps<DslNodeOf<"banner">>> = ({ node, trackMap }) => (
  <Callout
    variant="banner"
    text={node.text}
    detail={node.detail}
    icon={node.icon}
    tone={node.tone}
    window={resolveOptionalWindow(node.window, trackMap)}
  />
);

const CardNodeRenderer: FC<NodeProps<DslNodeOf<"card">>> = ({ node, trackMap }) => (
  <Callout
    variant="card"
    emphasis={node.emphasis}
    size={node.size}
    tone={node.tone}
    width={node.width}
    grow={node.grow}
    window={resolveOptionalWindow(node.window, trackMap)}
  >
    {node.children.map((child, index) => (
      <DslNodeRenderer key={index} node={child} trackMap={trackMap} />
    ))}
  </Callout>
);

const DiagramNodeRenderer: FC<NodeProps<DslNodeOf<"diagram">>> = ({ node, trackMap }) => (
  <Diagram
    graph={node.graph}
    fit={node.fit}
    width={node.width}
    grow={node.grow}
    activeNodes={node.activeNodes?.map((entry) =>
      typeof entry === "string"
        ? entry
        : { node: entry.node, window: resolveWindowRef(entry.window, trackMap) },
    )}
    reveal={
      node.reveal
        ? { order: node.reveal.order, window: resolveOptionalWindow(node.reveal.window, trackMap) }
        : undefined
    }
    flows={node.flows?.map((flow) => ({
      edge: flow.edge,
      window: resolveWindowRef(flow.window, trackMap),
      tone: flow.tone,
      label: flow.label,
      direction: flow.direction,
    }))}
  />
);

const CodeNodeRenderer: FC<NodeProps<DslNodeOf<"code">>> = ({ node, trackMap }) => (
  <CodeBlock
    title={node.title}
    chrome={node.chrome}
    size={node.size}
    width={node.width}
    grow={node.grow}
    lines={node.lines}
    reveal={
      node.reveal
        ? { mode: node.reveal.mode, window: resolveOptionalWindow(node.reveal.window, trackMap) }
        : undefined
    }
    highlights={node.highlights?.map((highlight) => ({
      lines: highlight.lines,
      window: resolveWindowRef(highlight.window, trackMap),
    }))}
  />
);

const TerminalNodeRenderer: FC<NodeProps<DslNodeOf<"terminal">>> = ({ node, trackMap }) => (
  <Terminal
    title={node.title}
    size={node.size}
    width={node.width}
    grow={node.grow}
    steps={node.steps.map((step) => ({
      command: step.command,
      output: step.output,
      outputTone: step.outputTone,
      window: resolveWindowRef(step.window, trackMap),
    }))}
  />
);

const CameraNodeRenderer: FC<NodeProps<DslNodeOf<"camera">>> = ({ node, trackMap }) => (
  <Camera
    shots={node.shots.map((shot) => ({
      window: resolveWindowRef(shot.window, trackMap),
      focus: shot.focus,
      zoom: shot.zoom,
    }))}
  >
    {node.children.map((child, index) => (
      <DslNodeRenderer key={index} node={child} trackMap={trackMap} />
    ))}
  </Camera>
);

const CameraTargetNodeRenderer: FC<NodeProps<DslNodeOf<"cameraTarget">>> = ({ node, trackMap }) => (
  <CameraTarget id={node.id}>
    <DslNodeRenderer node={node.child} trackMap={trackMap} />
  </CameraTarget>
);

/** A "steps"/"switch" node referencing an unknown track renders nothing —
 * unreachable once validate.ts has run (Root.tsx/render-dsl.mjs never
 * mount an unvalidated document), but the renderer stays total rather than
 * throwing, so a doc that somehow bypassed validation degrades to a blank
 * region instead of taking the whole frame down. */
const StepsNodeRenderer: FC<NodeProps<DslNodeOf<"steps">>> = ({ node, trackMap }) => {
  const track = trackMap.get(node.track);
  if (!track) return null;
  const window = node.window
    ? resolveWindowRef(node.window, trackMap)
    : resolveWindowRef(track.window, trackMap);
  return <StepReveal steps={track.items} window={window} layout={node.layout} label={node.label} />;
};

const SwitchNodeRenderer: FC<NodeProps<DslNodeOf<"switch">>> = ({ node, trackMap }) => {
  const track = trackMap.get(node.track);
  if (!track) return null;
  const trackWindow = resolveWindowRef(track.window, trackMap);
  const windows = stepWindows(track.items, trackWindow);
  return (
    <StepSwitch
      stepWindows={windows}
      mode={node.mode}
      cases={node.cases.map((caseEntry) => ({
        steps: caseEntry.steps,
        content: <DslNodeRenderer node={caseEntry.content} trackMap={trackMap} />,
      }))}
    />
  );
};

export const NODE_RENDERERS: { [K in DslNodeType]: FC<NodeProps<DslNodeOf<K>>> } = {
  stack: StackNodeRenderer,
  text: TextNodeRenderer,
  meter: MeterNodeRenderer,
  icon: IconNodeRenderer,
  pill: PillNodeRenderer,
  banner: BannerNodeRenderer,
  card: CardNodeRenderer,
  diagram: DiagramNodeRenderer,
  code: CodeNodeRenderer,
  terminal: TerminalNodeRenderer,
  camera: CameraNodeRenderer,
  cameraTarget: CameraTargetNodeRenderer,
  steps: StepsNodeRenderer,
  switch: SwitchNodeRenderer,
};
