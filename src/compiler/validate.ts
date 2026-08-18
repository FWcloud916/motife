// Semantic cross-reference checks — everything zod's structural schema
// can't see: a WindowRef's track must exist, a diagram's edge must name a
// declared node, a camera's focus must resolve, a track must be declared
// before another track references it. Operates on an already zod-parsed
// DslDocument, so every shape here is trusted; this file only checks
// relationships BETWEEN values.
//
// One function per concern, composed by `validateDocument()`. Every
// pushed DslIssue names a real path and a concrete fix — see
// src/compiler/errors.ts's file header for why that discipline matters
// (these strings are Phase 3's retry feedback).
import type { DslDocument, DslNode, DslScene, Track, WindowRef } from "../dsl";
import {
  DETAIL_FONT_SIZE,
  LABEL_FONT_SIZE,
  MAX_NODE_CONTENT_WIDTH,
  computeLayout,
  computeSafeArea,
  estimateGraphNodeSizes,
  estimateTextWidth,
} from "../components";
import type { DslIssue, DslIssueCode } from "./errors";
import { quoteList } from "./path";
import {
  StepIndexOutOfRangeError,
  TrackCycleError,
  UnknownTrackError,
  resolveWindowRef,
} from "./windows";

// Mirrors src/remotion/compositions/timeline.ts's TRANSITION_FRAMES. Kept
// as its own literal rather than importing that module — src/compiler/**
// stays independent of src/remotion/**, the same discipline timeline.ts
// itself uses to avoid pulling in the component barrel. If the shared
// default ever changes it changes in both places; a mismatch here only
// makes this warning's arithmetic slightly conservative, it can't produce
// a false negative that lets a genuinely-too-short transition through
// (buildTimeline's own runtime check is still the final word at render time).
const TRANSITION_FRAMES = 15;

const BEAT_ORDER = ["intro", "breakdown", "walkthrough", "summary"] as const;

// A comfortable narration pace for the mostly-Mandarin content this DSL
// targets. Provisional (motife-plan.md §2 決策4: Phase 3 replaces
// durationInSeconds with a TTS-measured value) — this is the one automatic
// check that today's hand-picked durations are plausible in the meantime.
const COMFORTABLE_CHARS_PER_SEC = 8;
const TOO_FAST_MULTIPLIER = 1.5;
const TOO_SLOW_MULTIPLIER = 0.3;

// A node's estimated label/detail content width (see
// estimateNodeSizes.ts) past which the card wraps instead of widening —
// crossing it is a warning, not a hard failure, since a wrapped label can
// still render fully depending on how many lines fit.
const LABEL_WRAP_WIDTH = MAX_NODE_CONTENT_WIDTH; // 496
// Past this, nodeSizing.ts's own height-budget comment ("icon 82 + gap 16
// + two wrapped label lines ~2x33 + gap 16 + a detail line 25 ≈ 205 of a
// 228 budget") means a THIRD wrapped line has nowhere left to go —
// DiagramNode's overflow:hidden guarantees it's cut off. This is the one
// layout-budget lint that's an error: unlike the warnings below, there is
// no scenario where crossing it renders correctly.
const CLIP_CONTENT_WIDTH = 2 * MAX_NODE_CONTENT_WIDTH; // 992
// Every checked-in baseline diagram has at most 7 nodes; flagging past 8
// still leaves headroom for legitimate small graphs while catching the
// LLM's tendency to over-enumerate.
const MAX_DIAGRAM_NODES = 8;

/** The pixel box a scene's `content` actually has, per safeArea.ts —
 * threaded down from validateScene() to the two checks that need to know
 * whether something fits the ACTUAL box, not just its own topology
 * (camera_content_too_tall today). */
interface SceneLayoutBudget {
  contentWidth: number;
  contentHeight: number;
}

function issue(
  path: string,
  code: DslIssueCode,
  severity: DslIssue["severity"],
  message: string,
  fix: string,
): DslIssue {
  return { path, code, severity, message, fix };
}

export function validateDocument(doc: DslDocument): DslIssue[] {
  const issues: DslIssue[] = [];

  issues.push(...checkSceneIds(doc));
  issues.push(...checkBeatOrder(doc));
  issues.push(...checkTransitions(doc));

  doc.scenes.forEach((scene, sceneIndex) => {
    issues.push(...validateScene(scene, sceneIndex, doc));
  });

  return issues;
}

function checkSceneIds(doc: DslDocument): DslIssue[] {
  const issues: DslIssue[] = [];
  const seen = new Set<string>();
  doc.scenes.forEach((scene, index) => {
    if (seen.has(scene.id)) {
      issues.push(
        issue(
          `scenes[${index}].id`,
          "duplicate_scene_id",
          "error",
          `Scene id "${scene.id}" is used by more than one scene.`,
          `give this scene a unique id — already used: ${quoteList(seen)}.`,
        ),
      );
    }
    seen.add(scene.id);
  });
  return issues;
}

function checkBeatOrder(doc: DslDocument): DslIssue[] {
  const issues: DslIssue[] = [];
  const beats = doc.scenes.map((scene) => scene.beat);

  const introCount = beats.filter((beat) => beat === "intro").length;
  if (introCount !== 1 || beats[0] !== "intro") {
    issues.push(
      issue(
        "scenes",
        "beat_order",
        "error",
        `Expected exactly one "intro" scene, first in the document; found ${introCount}${
          beats[0] !== "intro" ? `, and scenes[0].beat is "${beats[0]}"` : ""
        }.`,
        `make scenes[0].beat "intro", and make sure no other scene uses beat "intro".`,
      ),
    );
  }

  const summaryCount = beats.filter((beat) => beat === "summary").length;
  const lastBeat = beats[beats.length - 1];
  if (summaryCount !== 1 || lastBeat !== "summary") {
    issues.push(
      issue(
        "scenes",
        "beat_order",
        "error",
        `Expected exactly one "summary" scene, last in the document; found ${summaryCount}${
          lastBeat !== "summary" ? `, and the last scene's beat is "${lastBeat}"` : ""
        }.`,
        `make the last scene's beat "summary", and make sure no other scene uses beat "summary".`,
      ),
    );
  }

  if (!beats.includes("breakdown")) {
    issues.push(
      issue(
        "scenes",
        "beat_order",
        "error",
        `No scene has beat "breakdown" — the narrative skeleton requires 引入 → 拆解 → 逐步演示 → 總結.`,
        `add at least one scene with beat "breakdown" between the intro and walkthrough scenes.`,
      ),
    );
  }
  if (!beats.includes("walkthrough")) {
    issues.push(
      issue(
        "scenes",
        "beat_order",
        "error",
        `No scene has beat "walkthrough" — the narrative skeleton requires 引入 → 拆解 → 逐步演示 → 總結.`,
        `add at least one scene with beat "walkthrough" between the breakdown and summary scenes.`,
      ),
    );
  }

  let prevRank = -1;
  beats.forEach((beat, index) => {
    const rank = BEAT_ORDER.indexOf(beat);
    if (rank < prevRank) {
      issues.push(
        issue(
          `scenes[${index}].beat`,
          "beat_order",
          "error",
          `scenes[${index}] has beat "${beat}", which comes before the preceding scene's beat "${
            beats[index - 1]
          }" in the fixed order intro → breakdown → walkthrough → summary.`,
          `reorder scenes so beats are non-decreasing in intro → breakdown → walkthrough → summary order.`,
        ),
      );
    }
    prevRank = Math.max(prevRank, rank);
  });

  return issues;
}

function checkTransitions(doc: DslDocument): DslIssue[] {
  const issues: DslIssue[] = [];
  doc.scenes.forEach((scene, index) => {
    const isLast = index === doc.scenes.length - 1;
    const transition = isLast ? "cut" : (scene.transitionToNext ?? "cut");
    if (transition !== "fade") return;

    const next = doc.scenes[index + 1];
    const durationFrames = Math.round(scene.durationInSeconds * doc.fps);
    const nextFrames = Math.round(next.durationInSeconds * doc.fps);
    if (TRANSITION_FRAMES >= durationFrames || TRANSITION_FRAMES >= nextFrames) {
      const minSeconds = (TRANSITION_FRAMES / doc.fps).toFixed(2);
      issues.push(
        issue(
          `scenes[${index}].transitionToNext`,
          "transition_too_long",
          "error",
          `The fade from "${scene.id}" to "${next.id}" needs ${TRANSITION_FRAMES} frames of overlap, but "${scene.id}" is ${durationFrames} frames and "${next.id}" is ${nextFrames} frames.`,
          `use "cut" instead, or raise durationInSeconds on "${scene.id}" and/or "${next.id}" to more than ${minSeconds}s.`,
        ),
      );
    }
  });
  return issues;
}

function checkNarrationPacing(scene: DslScene, sceneIndex: number): DslIssue[] {
  const charsPerSec = scene.narration.length / scene.durationInSeconds;
  const path = `scenes[${sceneIndex}].narration`;
  if (charsPerSec > COMFORTABLE_CHARS_PER_SEC * TOO_FAST_MULTIPLIER) {
    const suggestedSeconds = Math.ceil(scene.narration.length / COMFORTABLE_CHARS_PER_SEC);
    return [
      issue(
        path,
        "narration_pacing",
        "warning",
        `Narration is ${scene.narration.length} characters but the scene is ${scene.durationInSeconds}s — about ${charsPerSec.toFixed(1)} chars/sec, faster than a comfortable pace (~${COMFORTABLE_CHARS_PER_SEC} chars/sec).`,
        `shorten the narration, or raise scenes[${sceneIndex}].durationInSeconds to about ${suggestedSeconds}.`,
      ),
    ];
  }
  if (charsPerSec < COMFORTABLE_CHARS_PER_SEC * TOO_SLOW_MULTIPLIER) {
    const suggestedSeconds = Math.max(1, Math.round(scene.narration.length / COMFORTABLE_CHARS_PER_SEC));
    return [
      issue(
        path,
        "narration_pacing",
        "warning",
        `Narration is only ${scene.narration.length} characters for a ${scene.durationInSeconds}s scene — about ${charsPerSec.toFixed(1)} chars/sec, slower than a comfortable pace (~${COMFORTABLE_CHARS_PER_SEC} chars/sec).`,
        `add more narration, or lower scenes[${sceneIndex}].durationInSeconds to about ${suggestedSeconds}.`,
      ),
    ];
  }
  return [];
}

function validateScene(scene: DslScene, sceneIndex: number, doc: DslDocument): DslIssue[] {
  const issues: DslIssue[] = [];
  const scenePath = `scenes[${sceneIndex}]`;

  issues.push(...checkNarrationPacing(scene, sceneIndex));

  const usedTracks = new Set<string>();
  const { trackIssues, trackMap } = validateTracks(scene, sceneIndex, usedTracks);
  issues.push(...trackIssues);

  // hasCaption mirrors DslSceneView.tsx's caption-presence rule exactly: an
  // omitted caption falls back to the scene's narration (still shown, still
  // reserves CAPTION_CLEARANCE) — only an explicit `caption: null` opts out.
  const safeArea = computeSafeArea({
    width: doc.width,
    height: doc.height,
    hasHeader: !!scene.header,
    hasCaption: scene.caption !== null,
  });
  const budget: SceneLayoutBudget = { contentWidth: safeArea.width, contentHeight: safeArea.height };

  issues.push(
    ...walkNode(scene.content, `${scenePath}.content`, trackMap, usedTracks, budget),
  );

  (scene.tracks ?? []).forEach((track, trackIndex) => {
    if (!usedTracks.has(track.id)) {
      issues.push(
        issue(
          `${scenePath}.tracks[${trackIndex}]`,
          "unused_track",
          "warning",
          `Track "${track.id}" is declared but never referenced by a window, "steps" node, or "switch" node in this scene.`,
          `reference it (e.g. { "track": "${track.id}", "step": 0 }), or remove the track.`,
        ),
      );
    }
  });

  return issues;
}

function validateTracks(
  scene: DslScene,
  sceneIndex: number,
  usedTracks: Set<string>,
): { trackIssues: DslIssue[]; trackMap: Map<string, Track> } {
  const issues: DslIssue[] = [];
  const declaredSoFar = new Map<string, Track>();
  const tracks = scene.tracks ?? [];

  tracks.forEach((track, trackIndex) => {
    const path = `scenes[${sceneIndex}].tracks[${trackIndex}]`;

    if (declaredSoFar.has(track.id)) {
      issues.push(
        issue(
          `${path}.id`,
          "duplicate_track_id",
          "error",
          `Track id "${track.id}" is used by more than one track in this scene.`,
          `give this track a unique id — already used: ${quoteList(declaredSoFar.keys())}.`,
        ),
      );
    } else if (!("from" in track.window)) {
      const refId = track.window.track;
      if (refId === track.id) {
        issues.push(
          issue(
            `${path}.window.track`,
            "track_forward_reference",
            "error",
            `Track "${track.id}" references itself in its own window.`,
            `reference an earlier-declared track, or use an absolute {"from": …, "to": …} window.`,
          ),
        );
      } else if (!declaredSoFar.has(refId)) {
        issues.push(
          issue(
            `${path}.window.track`,
            "track_forward_reference",
            "error",
            `Track "${track.id}" references track "${refId}", which isn't declared yet at this point in scenes[${sceneIndex}].tracks.`,
            `move "${refId}" earlier in the tracks array (a track may only reference an earlier-declared track), or use an absolute {"from": …, "to": …} window.`,
          ),
        );
      } else {
        // The reference is well-formed (declared earlier, not itself) —
        // now check what it points AT: a bad step index in a track's own
        // window would otherwise surface only as a render-time throw from
        // resolveWindowRef. checkWindowRef against only the
        // earlier-declared tracks also records the reference in
        // usedTracks, so a track consumed solely by another track's
        // window isn't misreported as unused.
        issues.push(...checkWindowRef(track.window, `${path}.window`, declaredSoFar, usedTracks));
      }
    } else {
      // A track's absolute window gets the same from < to check every
      // node-level WindowRef gets — an inverted track window would
      // otherwise silently produce inverted step spans at render time.
      issues.push(...checkWindowRef(track.window, `${path}.window`, declaredSoFar, usedTracks));
    }

    declaredSoFar.set(track.id, track);
  });

  return { trackIssues: issues, trackMap: declaredSoFar };
}

/** Resolves a WindowRef purely to validate it (unknown track, bad step
 * index, cycle), converting windows.ts's thrown errors into a DslIssue at
 * the caller-supplied path. Swallows nothing else — a bug in
 * resolveWindowRef itself should still throw. */
function checkWindowRef(ref: WindowRef, path: string, trackMap: Map<string, Track>, usedTracks: Set<string>): DslIssue[] {
  if ("from" in ref) {
    if (ref.from >= ref.to) {
      return [
        issue(
          path,
          "window_order",
          "error",
          `Window "from" (${ref.from}) must be less than "to" (${ref.to}).`,
          `swap or adjust the values so from < to.`,
        ),
      ];
    }
    return [];
  }

  usedTracks.add(ref.track);
  try {
    resolveWindowRef(ref, trackMap);
    return [];
  } catch (error) {
    if (error instanceof UnknownTrackError) {
      return [
        issue(
          `${path}.track`,
          "unknown_track",
          "error",
          error.message,
          trackMap.size > 0
            ? `use one of the declared tracks: ${quoteList(trackMap.keys())}.`
            : `this scene declares no tracks — add one to scenes[].tracks, or use an absolute {"from": …, "to": …} window.`,
        ),
      ];
    }
    if (error instanceof StepIndexOutOfRangeError) {
      return [
        issue(
          path,
          "step_index_out_of_range",
          "error",
          error.message,
          `use an index between 0 and ${error.itemCount - 1}, or add more items to track "${error.trackId}".`,
        ),
      ];
    }
    if (error instanceof TrackCycleError) {
      return [
        issue(
          `${path}.track`,
          "track_forward_reference",
          "error",
          error.message,
          `break the cycle — a track's window must eventually resolve to an absolute {"from": …, "to": …}.`,
        ),
      ];
    }
    throw error;
  }
}

/** Recursively walks a content node, collecting every semantic issue and
 * every track referenced (for the unused_track check) along the way. One
 * function handles all 14 node types via a switch, rather than one walker
 * per type, since the recursion (finding every WindowRef and every child
 * node) is identical work for all of them. */
function walkNode(
  node: DslNode,
  path: string,
  trackMap: Map<string, Track>,
  usedTracks: Set<string>,
  budget: SceneLayoutBudget,
): DslIssue[] {
  const issues: DslIssue[] = [];
  const checkWindow = (ref: WindowRef | undefined, subPath: string) =>
    ref ? issues.push(...checkWindowRef(ref, subPath, trackMap, usedTracks)) : undefined;
  const recurse = (child: DslNode, subPath: string) =>
    issues.push(...walkNode(child, subPath, trackMap, usedTracks, budget));

  switch (node.type) {
    case "stack":
      checkWindow(node.window, `${path}.window`);
      (node.children ?? []).forEach((child, i) => recurse(child, `${path}.children[${i}]`));
      break;

    case "text":
      checkWindow(node.window, `${path}.window`);
      break;

    case "meter":
      checkWindow(node.window, `${path}.window`);
      break;

    case "icon":
      break;

    case "pill":
    case "banner":
      checkWindow(node.window, `${path}.window`);
      break;

    case "card":
      checkWindow(node.window, `${path}.window`);
      node.children.forEach((child, i) => recurse(child, `${path}.children[${i}]`));
      break;

    case "diagram":
      issues.push(...validateDiagram(node, path, trackMap, usedTracks));
      break;

    case "code":
      issues.push(...validateCode(node, path, trackMap, usedTracks));
      break;

    case "terminal":
      node.steps.forEach((step, i) => checkWindow(step.window, `${path}.steps[${i}].window`));
      break;

    case "camera":
      issues.push(...validateCamera(node, path, trackMap, usedTracks, budget));
      break;

    case "cameraTarget":
      recurse(node.child, `${path}.child`);
      break;

    case "steps":
      if (!trackMap.has(node.track)) {
        issues.push(
          issue(
            `${path}.track`,
            "unknown_track",
            "error",
            `Unknown track "${node.track}".`,
            trackMap.size > 0
              ? `use one of the declared tracks: ${quoteList(trackMap.keys())}.`
              : `this scene declares no tracks — add one to scenes[].tracks.`,
          ),
        );
      } else {
        usedTracks.add(node.track);
      }
      checkWindow(node.window, `${path}.window`);
      break;

    case "switch":
      issues.push(...validateSwitch(node, path, trackMap, usedTracks, budget));
      break;
  }

  return issues;
}

function validateDiagram(
  node: Extract<DslNode, { type: "diagram" }>,
  path: string,
  trackMap: Map<string, Track>,
  usedTracks: Set<string>,
): DslIssue[] {
  const issues: DslIssue[] = [];
  const checkWindow = (ref: WindowRef | undefined, subPath: string) =>
    ref ? issues.push(...checkWindowRef(ref, subPath, trackMap, usedTracks)) : undefined;

  const nodeIds = new Set<string>();
  node.graph.nodes.forEach((graphNode, i) => {
    if (nodeIds.has(graphNode.id)) {
      issues.push(
        issue(
          `${path}.graph.nodes[${i}].id`,
          "duplicate_graph_node_id",
          "error",
          `Node id "${graphNode.id}" is used by more than one node in this diagram.`,
          `give this node a unique id — already used: ${quoteList(nodeIds)}.`,
        ),
      );
    }
    nodeIds.add(graphNode.id);

    // Estimated (no DOM here — see estimateNodeSizes.ts), and deliberately
    // conservative-high: this can warn about a label that would actually
    // fit, never miss one that won't. Label and detail are checked
    // independently against the wider one, since either alone can overflow
    // the card regardless of the other.
    const labelWidth = estimateTextWidth(graphNode.label, LABEL_FONT_SIZE);
    const detailWidth = graphNode.detail ? estimateTextWidth(graphNode.detail, DETAIL_FONT_SIZE) : 0;
    const wider = detailWidth > labelWidth ? "detail" : "label";
    const contentWidth = Math.max(labelWidth, detailWidth);
    if (contentWidth > CLIP_CONTENT_WIDTH) {
      issues.push(
        issue(
          `${path}.graph.nodes[${i}].${wider}`,
          "diagram_label_clipped",
          "error",
          `Node "${graphNode.id}"'s ${wider} is estimated at ~${Math.round(contentWidth)}px wide — past the point where the card's text wraps to 3+ lines and the extra lines get cut off (the card doesn't grow taller to fit).`,
          `shorten this to roughly 18 full-width (CJK) or 30 half-width characters, move the explanation into the scene's narration instead, or split this node into two.`,
        ),
      );
    } else if (contentWidth > LABEL_WRAP_WIDTH) {
      issues.push(
        issue(
          `${path}.graph.nodes[${i}].${wider}`,
          "diagram_label_too_long",
          "warning",
          `Node "${graphNode.id}"'s ${wider} is estimated at ~${Math.round(contentWidth)}px wide — it will wrap onto multiple lines when rendered.`,
          `shorten this to roughly 18 full-width (CJK) or 30 half-width characters, or move detail into the scene's narration instead.`,
        ),
      );
    }
  });

  if (node.graph.nodes.length > MAX_DIAGRAM_NODES) {
    issues.push(
      issue(
        `${path}.graph.nodes`,
        "diagram_too_many_nodes",
        "warning",
        `This diagram has ${node.graph.nodes.length} nodes — more than any diagram in the reference examples (max ${MAX_DIAGRAM_NODES}) comfortably fits a scene.`,
        `split the graph across two scenes (or two side-by-side diagrams), or prune to only the nodes the narration actually references.`,
      ),
    );
  }

  const edgeIds = new Set<string>();
  node.graph.edges.forEach((edge, i) => {
    const edgeId = edge.id ?? `${edge.from}->${edge.to}`;
    if (edgeIds.has(edgeId)) {
      issues.push(
        issue(
          `${path}.graph.edges[${i}]`,
          "duplicate_edge_id",
          "error",
          `Edge id "${edgeId}" is used by more than one edge in this diagram.`,
          `set an explicit "id" on one of the two edges — already used: ${quoteList(edgeIds)}.`,
        ),
      );
    }
    edgeIds.add(edgeId);

    if (!nodeIds.has(edge.from)) {
      issues.push(
        issue(
          `${path}.graph.edges[${i}].from`,
          "unknown_graph_node",
          "error",
          `Edge references unknown node "${edge.from}".`,
          `use a node id declared in this diagram's graph.nodes: ${quoteList(nodeIds)}.`,
        ),
      );
    }
    if (!nodeIds.has(edge.to)) {
      issues.push(
        issue(
          `${path}.graph.edges[${i}].to`,
          "unknown_graph_node",
          "error",
          `Edge references unknown node "${edge.to}".`,
          `use a node id declared in this diagram's graph.nodes: ${quoteList(nodeIds)}.`,
        ),
      );
    }
  });

  (node.activeNodes ?? []).forEach((entry, i) => {
    if (typeof entry === "string") {
      if (!nodeIds.has(entry)) {
        issues.push(
          issue(
            `${path}.activeNodes[${i}]`,
            "unknown_graph_node",
            "error",
            `activeNodes references unknown node "${entry}".`,
            `use a node id declared in this diagram's graph.nodes: ${quoteList(nodeIds)}.`,
          ),
        );
      }
      return;
    }
    if (!nodeIds.has(entry.node)) {
      issues.push(
        issue(
          `${path}.activeNodes[${i}].node`,
          "unknown_graph_node",
          "error",
          `activeNodes references unknown node "${entry.node}".`,
          `use a node id declared in this diagram's graph.nodes: ${quoteList(nodeIds)}.`,
        ),
      );
    }
    checkWindow(entry.window, `${path}.activeNodes[${i}].window`);
  });

  checkWindow(node.reveal?.window, `${path}.reveal.window`);

  (node.flows ?? []).forEach((flow, i) => {
    if (!edgeIds.has(flow.edge)) {
      issues.push(
        issue(
          `${path}.flows[${i}].edge`,
          "unknown_edge",
          "error",
          `Unknown edge "${flow.edge}".`,
          `use an edge id declared in this diagram's graph.edges: ${quoteList(edgeIds)}. An edge's id defaults to "<from>-><to>" unless it sets an explicit "id".`,
        ),
      );
    }
    checkWindow(flow.window, `${path}.flows[${i}].window`);
  });

  return issues;
}

function validateCode(
  node: Extract<DslNode, { type: "code" }>,
  path: string,
  trackMap: Map<string, Track>,
  usedTracks: Set<string>,
): DslIssue[] {
  const issues: DslIssue[] = [];
  const checkWindow = (ref: WindowRef | undefined, subPath: string) =>
    ref ? issues.push(...checkWindowRef(ref, subPath, trackMap, usedTracks)) : undefined;

  checkWindow(node.reveal?.window, `${path}.reveal.window`);

  (node.highlights ?? []).forEach((highlight, i) => {
    const [start, end] = highlight.lines;
    const maxLine = node.lines.length - 1;
    if (start > maxLine || end > maxLine) {
      issues.push(
        issue(
          `${path}.highlights[${i}].lines`,
          "step_index_out_of_range",
          "error",
          `Highlight line range [${start}, ${end}] is out of bounds — this code block has ${node.lines.length} line(s) (valid indices 0-${maxLine}).`,
          `use a range within 0-${maxLine}, or add more lines.`,
        ),
      );
    }
    checkWindow(highlight.window, `${path}.highlights[${i}].window`);
  });

  return issues;
}

/** Collects every diagram-node-id and cameraTarget-id inside a camera's
 * subtree, WITHOUT crossing into a nested camera (which has its own
 * independent registry — motife-plan.md's Camera design mirrors
 * src/components/Camera/CameraRegistryContext.ts here). Also recurses for
 * the normal per-node checks (diagram edge validity, etc.) via the shared
 * walkNode, and collects WindowRef/track usage the same way. */
function validateCamera(
  node: Extract<DslNode, { type: "camera" }>,
  path: string,
  trackMap: Map<string, Track>,
  usedTracks: Set<string>,
  budget: SceneLayoutBudget,
): DslIssue[] {
  const issues: DslIssue[] = [];
  const checkWindow = (ref: WindowRef | undefined, subPath: string) =>
    ref ? issues.push(...checkWindowRef(ref, subPath, trackMap, usedTracks)) : undefined;

  const nodeIds = new Map<string, string>(); // id -> first-seen path
  const targetIds = new Map<string, string>();
  // A camera nested inside a Camera renders at native scale with no fit
  // transform of its own (Diagram.tsx) — its rendered footprint is exactly
  // computeLayout()'s bounding box, so this can be checked directly against
  // the scene's real content box, unlike the estimation-sensitive width
  // checks above.
  const nestedDiagrams: Array<{
    graph: Extract<DslNode, { type: "diagram" }>["graph"];
    childPath: string;
  }> = [];

  const collect = (child: DslNode, childPath: string) => {
    if (child.type === "camera") return; // independent registry
    if (child.type === "diagram") {
      for (const graphNode of child.graph.nodes) {
        if (!nodeIds.has(graphNode.id)) nodeIds.set(graphNode.id, childPath);
      }
      nestedDiagrams.push({ graph: child.graph, childPath });
    }
    if (child.type === "cameraTarget") {
      if (targetIds.has(child.id)) {
        issues.push(
          issue(
            `${childPath}.id`,
            "duplicate_camera_target_id",
            "error",
            `CameraTarget id "${child.id}" is used more than once inside this camera.`,
            `give this target a unique id.`,
          ),
        );
      } else if (nodeIds.has(child.id)) {
        issues.push(
          issue(
            `${childPath}.id`,
            "camera_target_shadows_node",
            "error",
            `CameraTarget id "${child.id}" collides with a diagram node id already registered in this camera (at ${nodeIds.get(child.id)}). Node ids and CameraTarget ids share one namespace.`,
            `rename this target to something that isn't also a node id in a nested diagram.`,
          ),
        );
      }
      targetIds.set(child.id, childPath);
      collect(child.child, `${childPath}.child`);
      return;
    }
    for (const [subChild, subPath] of childrenOf(child, childPath)) collect(subChild, subPath);
  };

  node.children.forEach((child, i) => collect(child, `${path}.children[${i}]`));

  node.shots.forEach((shot, i) => {
    checkWindow(shot.window, `${path}.shots[${i}].window`);
    if (shot.focus === "all") return;
    if ("node" in shot.focus) {
      if (!nodeIds.has(shot.focus.node)) {
        issues.push(
          issue(
            `${path}.shots[${i}].focus.node`,
            "unknown_camera_focus",
            "error",
            `Shot focuses node "${shot.focus.node}", which isn't a node id in any diagram nested in this camera.`,
            nodeIds.size > 0
              ? `use one of: ${quoteList(nodeIds.keys())}, or "all".`
              : `this camera has no nested diagram — use focus: "all", or a { "target": … } referencing a CameraTarget.`,
          ),
        );
      }
    } else if (!targetIds.has(shot.focus.target)) {
      issues.push(
        issue(
          `${path}.shots[${i}].focus.target`,
          "unknown_camera_focus",
          "error",
          `Shot focuses target "${shot.focus.target}", which isn't a declared CameraTarget id in this camera.`,
          targetIds.size > 0
            ? `use one of: ${quoteList(targetIds.keys())}, or "all".`
            : `this camera has no CameraTarget — add one, use focus: "all", or a { "node": … } referencing a diagram node.`,
        ),
      );
    }
  });

  for (const { graph, childPath } of nestedDiagrams) {
    const layout = computeLayout(graph, estimateGraphNodeSizes(graph));
    if (layout.height > budget.contentHeight) {
      issues.push(
        issue(
          `${childPath}.graph`,
          "camera_content_too_tall",
          "warning",
          `This diagram is estimated at ~${Math.round(layout.height)}px tall, taller than the ~${Math.round(budget.contentHeight)}px this scene's content area has even with nothing else in it — an establishing shot (focus: "all") has to shrink it well below a legible size to fit.`,
          `use graph.direction "right" instead of "down" to spread ranks horizontally, reduce the number of ranks (chain depth), split the walkthrough across more scenes, or avoid stacking other content above/below the camera in this scene.`,
        ),
      );
    }
  }

  node.children.forEach((child, i) =>
    issues.push(...walkNode(child, `${path}.children[${i}]`, trackMap, usedTracks, budget)),
  );

  return issues;
}

/** Every direct DslNode child of `node`, tagged with its own path — the
 * shared iteration validateCamera's collect() uses to recurse without
 * duplicating a type switch. Intentionally excludes cameraTarget's `child`
 * (handled directly by the caller, since its id needs to be registered
 * before recursing) and camera's own children (independent registry). */
function childrenOf(node: DslNode, path: string): Array<[DslNode, string]> {
  switch (node.type) {
    case "stack":
      return (node.children ?? []).map((child, i) => [child, `${path}.children[${i}]`]);
    case "card":
      return node.children.map((child, i) => [child, `${path}.children[${i}]`]);
    case "switch":
      return node.cases.map((c, i) => [c.content, `${path}.cases[${i}].content`]);
    default:
      return [];
  }
}

function validateSwitch(
  node: Extract<DslNode, { type: "switch" }>,
  path: string,
  trackMap: Map<string, Track>,
  usedTracks: Set<string>,
  budget: SceneLayoutBudget,
): DslIssue[] {
  const issues: DslIssue[] = [];

  const track = trackMap.get(node.track);
  if (!track) {
    issues.push(
      issue(
        `${path}.track`,
        "unknown_track",
        "error",
        `Unknown track "${node.track}".`,
        trackMap.size > 0
          ? `use one of the declared tracks: ${quoteList(trackMap.keys())}.`
          : `this scene declares no tracks — add one to scenes[].tracks.`,
      ),
    );
  } else {
    usedTracks.add(node.track);
  }

  const maxIndex = track ? track.items.length - 1 : undefined;
  const ranges: Array<{ lo: number; hi: number; caseIndex: number }> = [];

  node.cases.forEach((caseEntry, caseIndex) => {
    const [lo, hi] = caseEntry.steps;
    const casePath = `${path}.cases[${caseIndex}].steps`;
    if (lo > hi) {
      issues.push(
        issue(
          casePath,
          "step_index_out_of_range",
          "error",
          `Case step range [${lo}, ${hi}] has a start greater than its end.`,
          `swap the values so the first is <= the second.`,
        ),
      );
    } else if (maxIndex !== undefined && (lo > maxIndex || hi > maxIndex)) {
      issues.push(
        issue(
          casePath,
          "step_index_out_of_range",
          "error",
          `Case step range [${lo}, ${hi}] is out of bounds for track "${node.track}", which has ${track!.items.length} item(s) (valid indices 0-${maxIndex}).`,
          `use indices within 0-${maxIndex}, or add more items to track "${node.track}".`,
        ),
      );
    } else {
      ranges.push({ lo, hi, caseIndex });
    }

    issues.push(
      ...walkNode(caseEntry.content, `${path}.cases[${caseIndex}].content`, trackMap, usedTracks, budget),
    );
  });

  const sorted = ranges.slice().sort((a, b) => a.lo - b.lo);
  sorted.forEach((range, i) => {
    const next = sorted[i + 1];
    if (!next) return;
    if (range.hi >= next.lo) {
      issues.push(
        issue(
          `${path}.cases[${next.caseIndex}].steps`,
          "case_range_overlap",
          "error",
          `Case ${next.caseIndex}'s range [${next.lo}, ${next.hi}] overlaps case ${range.caseIndex}'s range [${range.lo}, ${range.hi}].`,
          `adjust the ranges so each step index is covered by exactly one case.`,
        ),
      );
    } else if (range.hi + 1 < next.lo) {
      issues.push(
        issue(
          `${path}.cases`,
          "case_range_gap",
          "warning",
          `Steps ${range.hi + 1}-${next.lo - 1} of track "${node.track}" aren't covered by any case (between case ${range.caseIndex} and case ${next.caseIndex}).`,
          `add a case covering those steps, or extend an adjacent case's range.`,
        ),
      );
    }
  });

  // Uncovered steps at the boundaries — checking only adjacent pairs above
  // would let a switch whose first case starts past 0, or whose last case
  // stops short of the track's final step, pass silently.
  if (sorted.length > 0) {
    const first = sorted[0];
    if (first.lo > 0) {
      issues.push(
        issue(
          `${path}.cases`,
          "case_range_gap",
          "warning",
          `Steps 0-${first.lo - 1} of track "${node.track}" aren't covered by any case (before case ${first.caseIndex}).`,
          `add a case covering those steps, or extend case ${first.caseIndex}'s range down to 0.`,
        ),
      );
    }
    const last = sorted[sorted.length - 1];
    if (maxIndex !== undefined && last.hi < maxIndex) {
      issues.push(
        issue(
          `${path}.cases`,
          "case_range_gap",
          "warning",
          `Steps ${last.hi + 1}-${maxIndex} of track "${node.track}" aren't covered by any case (after case ${last.caseIndex}).`,
          `add a case covering those steps, or extend case ${last.caseIndex}'s range up to ${maxIndex}.`,
        ),
      );
    }
  }

  return issues;
}
