import { describe, expect, it } from "vitest";
import type { DslIssueCode } from "./errors";
import { formatIssues } from "./errors";
import { parseDocument, parseDocumentOrThrow } from "./parse";

// A structurally and semantically valid document exercising every node
// type and every cross-reference kind the validator checks: a diagram with
// two active-node forms and a flow, a two-level track chain ("claims"
// windowed to one step of "checks"), a switch with two adjacent
// non-overlapping cases, a camera with a nested diagram AND a
// cameraTarget, a code block with a highlight, a terminal step, and a fade
// transition long enough to be legal. Every mutation test below starts
// from a fresh clone of this and breaks exactly one thing.
const VALID_DOC = {
  version: 1,
  id: "TestDoc",
  title: "Test Doc",
  fps: 30,
  scenes: [
    {
      id: "intro",
      beat: "intro",
      durationInSeconds: 4,
      narration: "Welcome to this short overview of the topic.",
      content: { type: "pill", text: "hi" },
    },
    {
      id: "breakdown",
      beat: "breakdown",
      durationInSeconds: 4,
      narration: "Two nodes connect through a single edge here.",
      content: {
        type: "diagram",
        graph: {
          nodes: [
            { id: "a", label: "A" },
            { id: "b", label: "B" },
          ],
          edges: [{ from: "a", to: "b" }],
        },
        activeNodes: ["a", { node: "b", window: { from: 0, to: 0.5 } }],
        flows: [{ edge: "a->b", window: { from: 0, to: 1 } }],
      },
    },
    {
      id: "walkthrough",
      beat: "walkthrough",
      durationInSeconds: 6,
      narration: "This walkthrough covers several steps of the process.",
      transitionToNext: "fade",
      tracks: [
        { id: "checks", window: { from: 0, to: 1 }, items: [{ title: "one" }, { title: "two" }] },
        {
          id: "claims",
          window: { track: "checks", step: 1 },
          items: [{ title: "x" }, { title: "y" }],
        },
      ],
      content: {
        type: "stack",
        children: [
          { type: "steps", track: "checks" },
          { type: "steps", track: "claims" },
          {
            type: "switch",
            track: "checks",
            cases: [
              { steps: [0, 0], content: { type: "text", content: "first" } },
              { steps: [1, 1], content: { type: "text", content: "second" } },
            ],
          },
          {
            type: "camera",
            shots: [
              { window: { from: 0, to: 0.1 }, focus: "all" },
              { window: { from: 0.2, to: 0.3 }, focus: { node: "camNode" } },
              { window: { from: 0.4, to: 0.5 }, focus: { target: "camTarget" } },
            ],
            children: [
              {
                type: "diagram",
                graph: { nodes: [{ id: "camNode", label: "CamNode" }], edges: [] },
              },
              {
                type: "cameraTarget",
                id: "camTarget",
                child: { type: "text", content: "target" },
              },
            ],
          },
          {
            type: "code",
            lines: [{ segments: ["line0"] }, { segments: ["line1"] }],
            highlights: [{ lines: [0, 1], window: { from: 0, to: 1 } }],
          },
          {
            type: "terminal",
            steps: [{ command: "run", window: { from: 0, to: 1 } }],
          },
        ],
      },
    },
    {
      id: "summary",
      beat: "summary",
      durationInSeconds: 4,
      narration: "Remember these three things from the summary.",
      caption: null,
      content: { type: "text", content: "done" },
    },
  ],
};

// `any`, deliberately: each ErrorCase below reaches into a different
// arbitrary depth of this fixture (a track's window, a switch case's
// steps, a nested camera's diagram graph, ...). A precisely-typed
// alternative means either a hand-cast tuple type at every nested array in
// the fixture (scenes, content.children, graph.nodes/edges, cases — a
// dozen-plus sites) or literal types that reject the very reassignment
// each mutation exists to perform (durationInSeconds narrows to `4 | 6`,
// which then can't become `0.3`). What's actually under test is
// parseDocument()'s runtime behavior, not the shape of this fixture, so
// static typing on the mutation call sites buys little; the fixture's own
// construction above IS still checked (see parseDocument — valid baseline,
// which fails loudly if a mutate() typo'd a real field).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clone(): any {
  return structuredClone(VALID_DOC);
}

describe("parseDocument — valid baseline", () => {
  it("parses the fixture with zero issues", () => {
    const result = parseDocument(clone());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings).toEqual([]);
  });
});

interface ErrorCase {
  name: string;
  code: DslIssueCode;
  severity: "error" | "warning";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutate: (doc: any) => void;
  pathIs?: string;
  messageContains: string[];
  fixContains: string[];
}

const CASES: ErrorCase[] = [
  {
    name: "top-level field fails zod's structural schema",
    code: "schema",
    severity: "error",
    mutate: (doc) => {
      doc.version = 2;
    },
    messageContains: [],
    fixContains: [],
  },
  {
    name: "two scenes share an id",
    code: "duplicate_scene_id",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[1].id = "intro";
    },
    pathIs: "scenes[1].id",
    messageContains: ['"intro"'],
    fixContains: ["unique"],
  },
  {
    name: "first scene isn't beat intro",
    code: "beat_order",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[0].beat = "breakdown";
    },
    pathIs: "scenes",
    messageContains: ["intro"],
    fixContains: ["scenes[0].beat"],
  },
  {
    name: "window from >= to",
    code: "window_order",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[1].content.flows[0].window = { from: 0.5, to: 0.2 };
    },
    pathIs: "scenes[1].content.flows[0].window",
    messageContains: ["0.5", "0.2"],
    fixContains: ["from < to"],
  },
  {
    name: "two tracks in one scene share an id",
    code: "duplicate_track_id",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[2].tracks[1].id = "checks";
    },
    pathIs: "scenes[2].tracks[1].id",
    messageContains: ['"checks"'],
    fixContains: ["unique"],
  },
  {
    name: "a track's window references an undeclared track",
    code: "unknown_track",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[2].content.children[0].track = "doesNotExist";
    },
    pathIs: "scenes[2].content.children[0].track",
    messageContains: ["doesNotExist"],
    fixContains: ["checks", "claims"],
  },
  {
    name: "a track references a track declared later",
    code: "track_forward_reference",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[2].tracks[0].window = { track: "claims", step: 0 };
    },
    pathIs: "scenes[2].tracks[0].window.track",
    messageContains: ['"checks"', '"claims"'],
    fixContains: ["earlier"],
  },
  {
    name: "a window's step index is out of range for its track",
    code: "step_index_out_of_range",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[2].content.children[4].highlights[0].window = { track: "checks", step: 9 };
    },
    pathIs: "scenes[2].content.children[4].highlights[0].window",
    messageContains: ["9", "checks"],
    fixContains: ["0 and 1"],
  },
  {
    name: "two switch cases cover overlapping step ranges",
    code: "case_range_overlap",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[2].content.children[2].cases[1].steps = [0, 1];
    },
    pathIs: "scenes[2].content.children[2].cases[1].steps",
    messageContains: ["overlaps"],
    fixContains: ["exactly one case"],
  },
  {
    name: "a switch leaves a step index uncovered by any case",
    code: "case_range_gap",
    severity: "warning",
    mutate: (doc) => {
      doc.scenes[2].tracks[0].items.push({ title: "three" });
      doc.scenes[2].content.children[2].cases[1].steps = [2, 2];
    },
    pathIs: "scenes[2].content.children[2].cases",
    messageContains: ["Steps 1-1"],
    fixContains: ["case"],
  },
  {
    name: "a declared track is never referenced",
    code: "unused_track",
    severity: "warning",
    mutate: (doc) => {
      doc.scenes[2].tracks.push({ id: "spare", window: { from: 0, to: 1 }, items: [{ title: "x" }] });
    },
    pathIs: "scenes[2].tracks[2]",
    messageContains: ['"spare"'],
    fixContains: ["spare"],
  },
  {
    name: "two graph nodes share an id",
    code: "duplicate_graph_node_id",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[1].content.graph.nodes[1].id = "a";
    },
    pathIs: "scenes[1].content.graph.nodes[1].id",
    messageContains: ['"a"'],
    fixContains: ["unique"],
  },
  {
    name: "an edge references an undeclared node",
    code: "unknown_graph_node",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[1].content.graph.edges[0].to = "doesNotExist";
    },
    pathIs: "scenes[1].content.graph.edges[0].to",
    messageContains: ["doesNotExist"],
    fixContains: ['"a"', '"b"'],
  },
  {
    name: "two edges resolve to the same default id",
    code: "duplicate_edge_id",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[1].content.graph.edges.push({ from: "a", to: "b" });
    },
    pathIs: "scenes[1].content.graph.edges[1]",
    messageContains: ['"a->b"'],
    fixContains: ["explicit"],
  },
  {
    name: "a flow references an undeclared edge",
    code: "unknown_edge",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[1].content.flows[0].edge = "doesNotExist";
    },
    pathIs: "scenes[1].content.flows[0].edge",
    messageContains: ["doesNotExist"],
    fixContains: ['"a->b"'],
  },
  {
    name: "a camera shot focuses an undeclared node",
    code: "unknown_camera_focus",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[2].content.children[3].shots[1].focus = { node: "doesNotExist" };
    },
    pathIs: "scenes[2].content.children[3].shots[1].focus.node",
    messageContains: ["doesNotExist"],
    fixContains: ["camNode"],
  },
  {
    name: "two cameraTargets in one camera share an id",
    code: "duplicate_camera_target_id",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[2].content.children[3].children.push({
        type: "cameraTarget",
        id: "camTarget",
        child: { type: "text", content: "dup" },
      });
    },
    messageContains: ['"camTarget"'],
    fixContains: ["unique"],
  },
  {
    name: "a cameraTarget id collides with a diagram node id in the same camera",
    code: "camera_target_shadows_node",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[2].content.children[3].children[1].id = "camNode";
    },
    messageContains: ['"camNode"'],
    fixContains: ["rename"],
  },
  {
    name: "a fade transition is longer than one of its neighbouring scenes",
    code: "transition_too_long",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[2].durationInSeconds = 0.3;
    },
    pathIs: "scenes[2].transitionToNext",
    messageContains: ["walkthrough", "summary"],
    fixContains: ['"cut"'],
  },
  {
    name: "narration is far faster than a comfortable pace for its duration",
    code: "narration_pacing",
    severity: "warning",
    mutate: (doc) => {
      doc.scenes[0].narration =
        "This narration line is deliberately far too long to be spoken comfortably within just four seconds of screen time.";
    },
    pathIs: "scenes[0].narration",
    messageContains: ["chars/sec"],
    fixContains: ["durationInSeconds"],
  },
  {
    name: "narration is far slower than a comfortable pace for its duration",
    code: "narration_pacing",
    severity: "warning",
    mutate: (doc) => {
      doc.scenes[0].narration = "Hi.";
    },
    pathIs: "scenes[0].narration",
    messageContains: ["chars/sec", "slower"],
    fixContains: ["durationInSeconds"],
  },
  {
    name: "a switch case's step range starts after it ends",
    code: "step_index_out_of_range",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[2].content.children[2].cases[1].steps = [1, 0];
    },
    pathIs: "scenes[2].content.children[2].cases[1].steps",
    messageContains: ["[1, 0]"],
    fixContains: ["swap"],
  },
  {
    name: "a switch case's step range exceeds the track's item count",
    code: "step_index_out_of_range",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[2].content.children[2].cases[1].steps = [1, 5];
    },
    pathIs: "scenes[2].content.children[2].cases[1].steps",
    messageContains: ["[1, 5]", '"checks"'],
    fixContains: ["0-1"],
  },
  {
    name: "a switch's first case starts past step 0 (leading gap)",
    code: "case_range_gap",
    severity: "warning",
    mutate: (doc) => {
      doc.scenes[2].content.children[2].cases.shift();
    },
    pathIs: "scenes[2].content.children[2].cases",
    messageContains: ["Steps 0-0"],
    fixContains: ["down to 0"],
  },
  {
    name: "a track's own absolute window is inverted",
    code: "window_order",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[2].tracks[0].window = { from: 0.9, to: 0.1 };
    },
    pathIs: "scenes[2].tracks[0].window",
    messageContains: ["0.9", "0.1"],
    fixContains: ["from < to"],
  },
  {
    name: "a track's own window has a step index out of range",
    code: "step_index_out_of_range",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[2].tracks[1].window = { track: "checks", step: 7 };
    },
    pathIs: "scenes[2].tracks[1].window",
    messageContains: ["7", "checks"],
    fixContains: ["0 and 1"],
  },
  {
    name: "a diagram node's label is long enough to wrap",
    code: "diagram_label_too_long",
    severity: "warning",
    mutate: (doc) => {
      doc.scenes[1].content.graph.nodes[0].label = "測".repeat(20); // ~520px @ 26px/char
    },
    pathIs: "scenes[1].content.graph.nodes[0].label",
    messageContains: ["wide", "wrap"],
    fixContains: ["18"],
  },
  {
    name: "a diagram node's label is long enough to clip",
    code: "diagram_label_clipped",
    severity: "error",
    mutate: (doc) => {
      doc.scenes[1].content.graph.nodes[1].label = "測".repeat(40); // ~1040px @ 26px/char
    },
    pathIs: "scenes[1].content.graph.nodes[1].label",
    messageContains: ["wide", "cut off"],
    fixContains: ["18"],
  },
  {
    name: "a diagram has more nodes than comfortably fit a scene",
    code: "diagram_too_many_nodes",
    severity: "warning",
    mutate: (doc) => {
      for (const id of ["c", "d", "e", "f", "g", "h", "i"]) {
        doc.scenes[1].content.graph.nodes.push({ id, label: id.toUpperCase() });
      }
    },
    pathIs: "scenes[1].content.graph.nodes",
    messageContains: ["9 nodes"],
    fixContains: ["split"],
  },
  {
    name: "a camera's nested diagram is taller than the scene's content area",
    code: "camera_content_too_tall",
    severity: "warning",
    mutate: (doc) => {
      // direction "down", 4 ranks -> estimated height 4*228 + 3*96 = 1200,
      // taller than the walkthrough scene's ~834px content area (no
      // header, an omitted caption still reserves CAPTION_CLEARANCE).
      doc.scenes[2].content.children[3].children[0].graph = {
        direction: "down",
        nodes: [
          { id: "camNode", label: "A" },
          { id: "x1", label: "B" },
          { id: "x2", label: "C" },
          { id: "x3", label: "D" },
        ],
        edges: [
          { from: "camNode", to: "x1" },
          { from: "x1", to: "x2" },
          { from: "x2", to: "x3" },
        ],
      };
    },
    pathIs: "scenes[2].content.children[3].children[0].graph",
    messageContains: ["px tall"],
    fixContains: ["direction"],
  },
];

describe("parseDocument — error/warning contract", () => {
  it.each(CASES)("$name -> $code", (testCase) => {
    const doc = clone();
    testCase.mutate(doc);
    const result = parseDocument(doc);

    const issues = result.ok ? result.warnings : result.issues;
    const matching = issues.filter((issue) => issue.code === testCase.code);
    expect(matching.length).toBeGreaterThanOrEqual(1);
    const [found] = matching;

    expect(found.severity).toBe(testCase.severity);
    if (testCase.pathIs) expect(found.path).toBe(testCase.pathIs);
    for (const substring of testCase.messageContains) expect(found.message).toContain(substring);
    for (const substring of testCase.fixContains) expect(found.fix).toContain(substring);

    // ok:false iff at least one issue is an error.
    const hasError = issues.some((i) => i.severity === "error");
    expect(result.ok).toBe(!hasError);
  });

  it("every DslIssueCode has exactly one test case", () => {
    const ALL_CODES: Record<DslIssueCode, true> = {
      schema: true,
      duplicate_scene_id: true,
      beat_order: true,
      window_order: true,
      duplicate_track_id: true,
      unknown_track: true,
      track_forward_reference: true,
      step_index_out_of_range: true,
      case_range_overlap: true,
      case_range_gap: true,
      unused_track: true,
      duplicate_graph_node_id: true,
      unknown_graph_node: true,
      duplicate_edge_id: true,
      unknown_edge: true,
      unknown_camera_focus: true,
      duplicate_camera_target_id: true,
      camera_target_shadows_node: true,
      transition_too_long: true,
      narration_pacing: true,
      diagram_label_too_long: true,
      diagram_label_clipped: true,
      diagram_too_many_nodes: true,
      camera_content_too_tall: true,
    };
    const covered = new Set(CASES.map((c) => c.code));
    for (const code of Object.keys(ALL_CODES) as DslIssueCode[]) {
      expect(covered.has(code), `no test case covers "${code}"`).toBe(true);
    }
    expect(covered.size).toBe(Object.keys(ALL_CODES).length);
  });
});

describe("parseDocumentOrThrow", () => {
  it("returns the document when valid", () => {
    expect(parseDocumentOrThrow(clone()).id).toBe("TestDoc");
  });

  it("throws DslValidationError, named after the doc id, when invalid", () => {
    const doc = clone();
    doc.scenes[1].id = "intro";
    expect(() => parseDocumentOrThrow(doc)).toThrowError(/TestDoc/);
  });
});

describe("formatIssues", () => {
  it("snapshot: a mixed error/warning report", () => {
    const doc = clone();
    doc.scenes[1].content.flows[0].edge = "doesNotExist"; // error
    doc.scenes[2].tracks.push({ id: "spare", window: { from: 0, to: 1 }, items: [{ title: "x" }] }); // warning
    const result = parseDocument(doc);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(formatIssues("TestDoc", result.issues)).toMatchSnapshot();
  });

  it("reports a valid document with no issues", () => {
    expect(formatIssues("TestDoc", [])).toBe('motife DSL: "TestDoc" is valid — no issues.');
  });
});
