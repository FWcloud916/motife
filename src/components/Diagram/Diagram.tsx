import type { FC, ReactNode } from "react";
import { useContext, useEffect, useMemo, useState } from "react";
import { cancelRender, continueRender, delayRender, useCurrentFrame } from "remotion";
import { CameraRegistryContext, DIAGRAM_BOUNDS_ID } from "../Camera/CameraRegistryContext";
import { FlowPulse } from "../FlowPulse/FlowPulse";
import type { FlowSpec } from "../FlowPulse/FlowPulse";
import { computeLayout } from "../layout/computeLayout";
import { measureGraphNodeSizes } from "../layout/measureNodes";
import type { NodeSize } from "../layout/nodeSizing";
import type { GraphSpec } from "../layout/types";
import { stagger } from "../motion/progress";
import { resolveWindow } from "../motion/timing";
import { useSceneTiming } from "../Scene/SceneContext";
import { fontsReady } from "../tokens";
import type { Measure, Window } from "../tokens";
import { MEASURE_WIDTH, tokens } from "../tokens";
import { DiagramContext } from "./DiagramContext";
import { DiagramNode } from "./DiagramNode";

/** A node id that's active from the start, or one that only becomes active
 * once `window` begins — and then stays active, mirroring how Phase 1's
 * scenes used it (Intro's `frame > 108 ? [...] : []`, Walkthrough's
 * `activeIndex > 0 ? [...] : []`): a one-way threshold, not a pulse that
 * turns back off. `window.to` is therefore ignored; only `window.from`
 * matters. */
export type DiagramActiveNode = string | { node: string; window: Window };

export interface DiagramProps {
  graph: GraphSpec;
  /** "contain" (default) scales the whole diagram to fit inside whatever
   * box it's given, preserving proportions. "width" scales to the box's
   * width only, letting height follow the diagram's own aspect ratio. */
  fit?: "width" | "contain";
  activeNodes?: DiagramActiveNode[];
  reveal?: { order?: "rank" | "all"; window?: Window };
  /** Convenience: render these FlowPulses inside this Diagram's own
   * DiagramContext, instead of nesting <FlowPulse> as a child by hand. */
  flows?: FlowSpec[];
  /** Semantic width, for a Diagram sitting beside a sibling inside a Stack
   * row. Omit for a Diagram that should size to its own content (via
   * `fit`). No effect when nested inside a <Camera> — see below. */
  width?: Measure;
  /** Take a proportional share of the remaining space in the enclosing
   * Stack's main axis. No effect when nested inside a <Camera>. */
  grow?: boolean;
  /** Overlay slot — e.g. <CameraTarget> registrations. */
  children?: ReactNode;
}

const DEFAULT_REVEAL_WINDOW: Window = { from: 0, to: 0.4 };

function revealDelays(
  nodeIds: string[],
  layout: ReturnType<typeof computeLayout>,
  direction: GraphSpec["direction"],
  order: "rank" | "all",
  baseDelay: number,
): Record<string, number> {
  const delays: Record<string, number> = {};
  if (order !== "rank") {
    for (const id of nodeIds) delays[id] = baseDelay;
    return delays;
  }
  const axis = direction === "down" ? "y" : "x";
  const sorted = [...nodeIds].sort((a, b) => layout.nodes[a][axis] - layout.nodes[b][axis]);
  sorted.forEach((id, index) => {
    delays[id] = baseDelay + stagger(index);
  });
  return delays;
}

// The only component in the library that turns topology into coordinates
// (motife-plan.md §2 決策3) — computeLayout() is the sole call site.
export const Diagram: FC<DiagramProps> = ({
  graph,
  fit = "contain",
  activeNodes = [],
  reveal: revealSpec,
  flows = [],
  width,
  grow,
  children,
}) => {
  // Node footprints measured from the real rendered text, so a long label
  // (CJK especially — every glyph is full-width) widens its card instead of
  // spilling out of it. Gated on fontsReady(): measuring before the font
  // files land would capture fallback-font metrics and cache a wrong width
  // forever. The delayRender handle guarantees no frame is screenshotted
  // while the interim token-sized layout is on screen — Studio may show a
  // single-commit flash of it, which is acceptable for a live preview.
  const [measuredSizes, setMeasuredSizes] = useState<Record<string, NodeSize> | null>(null);
  useEffect(() => {
    const handle = delayRender("Diagram: measuring node labels");
    let cancelled = false;
    fontsReady()
      .then(() => {
        if (!cancelled) setMeasuredSizes(measureGraphNodeSizes(graph));
        continueRender(handle);
      })
      .catch((error) => cancelRender(error));
    return () => {
      cancelled = true;
      continueRender(handle);
    };
  }, [graph]);

  const layout = useMemo(
    () => computeLayout(graph, measuredSizes ?? undefined),
    [graph, measuredSizes],
  );
  const { durationInFrames } = useSceneTiming();

  // A <Diagram> nested inside a <Camera> hands framing over entirely to
  // the Camera: it registers its node rects (and its own overall bounds,
  // for `focus: "all"`) into the Camera's registry and renders at native
  // scale with no self-imposed fit transform — Camera's pan/zoom needs to
  // operate on the exact same coordinate space Diagram measured, and a
  // second competing transform would desync the two. This means Diagram
  // must render starting at Camera's own (0,0): don't put a centering or
  // percentage-sized wrapper between <Camera> and a <Diagram> it should
  // focus by node — that would offset Diagram's rendered position away
  // from the local coordinates it just registered, exactly the way
  // CameraTarget's offsetLeft/offsetTop measurement requires no
  // intervening `position`-ed wrapper either.
  const cameraRegistry = useContext(CameraRegistryContext);
  useEffect(() => {
    if (!cameraRegistry) return;
    for (const id of Object.keys(layout.nodes)) {
      cameraRegistry.register(id, layout.nodes[id]);
    }
    cameraRegistry.register(DIAGRAM_BOUNDS_ID, {
      x: 0,
      y: 0,
      width: layout.width,
      height: layout.height,
    });
  }, [cameraRegistry, layout]);

  const revealWindow = revealSpec?.window ?? DEFAULT_REVEAL_WINDOW;
  const baseDelay = resolveWindow(revealWindow, durationInFrames).startFrame;
  const delays = revealDelays(
    Object.keys(layout.nodes),
    layout,
    graph.direction,
    revealSpec?.order ?? "all",
    baseDelay,
  );

  const frame = useCurrentFrame();
  const activeSet = new Set(
    activeNodes
      .filter((entry) => {
        if (typeof entry === "string") return true;
        return frame >= resolveWindow(entry.window, durationInFrames).startFrame;
      })
      .map((entry) => (typeof entry === "string" ? entry : entry.node)),
  );
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));

  const content = (
    <DiagramContext.Provider value={layout}>
      <svg
        width={layout.width}
        height={layout.height}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        {Object.keys(layout.edges).map((id) => (
          <path
            key={id}
            d={layout.edges[id].path}
            fill="none"
            stroke={tokens.color.line}
            strokeWidth={2}
          />
        ))}
      </svg>
      {Object.keys(layout.nodes).map((id) => {
        const node = nodesById.get(id);
        if (!node) return null;
        return (
          <DiagramNode
            key={id}
            rect={layout.nodes[id]}
            icon={node.icon}
            label={node.label}
            detail={node.detail}
            tone={node.tone}
            active={activeSet.has(id)}
            delay={delays[id]}
          />
        );
      })}
      {flows.map((flow, index) => (
        <FlowPulse key={index} flow={flow} />
      ))}
      {children}
    </DiagramContext.Provider>
  );

  if (cameraRegistry) {
    // Nested inside a <Camera>: render at native scale — see the effect
    // above and Camera/CameraRegistryContext.ts for why framing is fully
    // delegated to the ancestor Camera in this case.
    return (
      <div style={{ position: "relative", width: layout.width, height: layout.height }}>
        {content}
      </div>
    );
  }

  // Standalone: fit the diagram into whatever box the caller gives it,
  // with zero JavaScript measurement. SVG's native viewBox +
  // preserveAspectRatio scaling is correct on the very first render — a
  // JS ref-measurement (clientWidth/clientHeight of a wrapper div) is
  // NOT: it can observe a stale pre-layout size depending on exactly when
  // Remotion's headless Chrome settles the surrounding box, silently
  // producing a wrong (usually much-too-small) scale. That isn't
  // hypothetical — it's exactly what an earlier version of this component
  // did, reproducibly, in `pnpm smoke`'s actual renderStill output.
  //
  // "contain" letterboxes within whatever box the parent gives (CSS
  // object-fit:contain, via preserveAspectRatio). "width" instead grows
  // the SVG element's OWN box to the diagram's aspect ratio at 100% width
  // — a CSS `aspect-ratio`, not preserveAspectRatio, since the latter only
  // fits content inside a box the element already has, it can't resize
  // the element itself.
  const svgSizeStyle =
    fit === "width" ? { aspectRatio: `${layout.width} / ${layout.height}` } : { height: "100%" };

  const svg = (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      style={{ display: "block", overflow: "visible", ...svgSizeStyle }}
    >
      <foreignObject x={0} y={0} width={layout.width} height={layout.height}>
        <div style={{ position: "relative", width: layout.width, height: layout.height }}>
          {content}
        </div>
      </foreignObject>
    </svg>
  );

  // Only wrap in a sizing div when a Stack actually asked for one — an
  // unconditional wrapper would add an extra `height: 100%`-less box that
  // silently breaks `fit="contain"` callers who rely on their own
  // ancestor's fixed height reaching the svg directly.
  if (!width && !grow) return svg;
  return (
    <div style={{ width: width ? MEASURE_WIDTH[width] : undefined, flex: grow ? "1 1 0" : undefined }}>
      {svg}
    </div>
  );
};
