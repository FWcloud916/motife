// Pure data — no React import in this file, deliberately. This is the
// hand-written prototype of the Phase 2 DSL step list (motife-plan.md §3
// Phase 2: "每個 step 含元件引用、參數、旁白文字"). Keeping it free of
// React/JSX means it stays serializable in spirit, which is the point:
// Phase 2's compiler will consume something shaped exactly like SCENES.

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** The fixed narrative skeleton from motife-plan.md: 引入 → 拆解 → 逐步演示 → 總結. */
export type Beat = "intro" | "breakdown" | "walkthrough" | "summary";

interface SceneSpec {
  id: string;
  beat: Beat;
  /**
   * Provisional. Phase 3 replaces this with the TTS narration audio's
   * measured duration (motife-plan.md §2 決策4: the timeline is
   * TTS-driven, never the reverse) — narration is written first, then
   * frame counts derive from it. Until TTS exists, this hand-picked
   * value stands in.
   */
  durationInSeconds: number;
  /** Provisional. Not read by any component yet — recorded now so the
   * per-scene narration text exists in one place before TTS lands. */
  narration: string;
}

export const SCENES = [
  {
    id: "intro",
    beat: "intro",
    durationInSeconds: 6,
    narration: "TODO",
  },
  {
    id: "breakdown",
    beat: "breakdown",
    durationInSeconds: 10,
    narration: "TODO",
  },
  {
    id: "walkthrough",
    beat: "walkthrough",
    durationInSeconds: 18,
    narration: "TODO",
  },
  {
    id: "summary",
    beat: "summary",
    durationInSeconds: 6,
    narration: "TODO",
  },
] as const satisfies readonly SceneSpec[];

/** Literal union derived from SCENES — adding a scene here and forgetting
 * its entry in sceneRegistry.tsx is a compile error, not a blank screen. */
export type SceneId = (typeof SCENES)[number]["id"];

interface TimelineEntry {
  id: SceneId;
  from: number;
  durationInFrames: number;
}

function buildTimeline(): TimelineEntry[] {
  let cursor = 0;
  return SCENES.map((scene) => {
    const durationInFrames = Math.round(scene.durationInSeconds * FPS);
    const entry: TimelineEntry = { id: scene.id, from: cursor, durationInFrames };
    cursor += durationInFrames;
    return entry;
  });
}

export const TIMELINE: TimelineEntry[] = buildTimeline();

// Math.max(1, ...) so an empty SCENES list still yields a legal
// composition ("empty but runs") instead of a zero-duration error.
export const TOTAL_FRAMES = Math.max(
  1,
  TIMELINE.reduce((sum, entry) => sum + entry.durationInFrames, 0),
);
