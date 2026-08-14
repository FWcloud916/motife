// Vision critique — the "renderStill 抽關鍵影格 → vision model 檢查" step of
// motife-plan.md §3 Phase 3. The message-building and report-parsing halves
// are pure (unit-tested); only runCritique touches an LlmClient.
//
// The model returns text JSON validated by a zod schema (same strategy as
// the generate loop: local validation beats provider schema modes, and it
// is the only shape all five providers support), with one repair retry.
import { z } from "zod";
import type { DslDocument, DslScene } from "../dsl";
import { coerceJsonText } from "../agent/docJson";
import type { LlmClient, LlmContentPart, LlmMessage } from "../agent/llm";
import type { CritiqueFrameLabel } from "./frames";

export const critiqueIssueSchema = z
  .object({
    sceneId: z.string().min(1),
    severity: z.enum(["error", "warning"]),
    kind: z.enum([
      "overlap",
      "overflow",
      "offscreen",
      "contrast",
      "empty",
      "caption",
      "pacing",
      "other",
    ]),
    description: z.string().min(1),
    suggestion: z.string().min(1),
  })
  .strict();

export const critiqueReportSchema = z
  .object({
    issues: z.array(critiqueIssueSchema),
  })
  .strict();

export type CritiqueIssue = z.infer<typeof critiqueIssueSchema>;
export type CritiqueReport = z.infer<typeof critiqueReportSchema>;

export interface CritiqueStillImage {
  sceneId: string;
  label: CritiqueFrameLabel;
  image: Uint8Array;
  mediaType: "image/jpeg" | "image/png";
}

const CRITIQUE_INSTRUCTIONS = `You are reviewing rendered key frames of a motion-graphic explainer.
Three frames per scene (early / mid / late). For each problem you can SEE,
report an issue. Check for:
- overlap: elements colliding or overlapping that should not
- overflow: text clipped or spilling out of its container
- offscreen: content partially outside the frame
- contrast: text hard to read against its background
- empty: large dead regions while content crowds elsewhere
- caption: caption band truncated or covering content
- pacing: a frame far too dense or too bare for its narration

severity "error" = a viewer would notice something is broken;
"warning" = polish. Do NOT invent issues — an empty list is a valid,
welcome answer. Suggestions must be expressible in the motife DSL
(reorder/remove/reword content, change emphasis/size/layout choices,
split a scene) — never pixel coordinates or CSS.

Answer with ONLY this JSON shape, no fences, no commentary:
{"issues":[{"sceneId":"...","severity":"error|warning","kind":"overlap|overflow|offscreen|contrast|empty|caption|pacing|other","description":"...","suggestion":"..."}]}`;

export function buildCritiqueMessages(
  doc: DslDocument,
  stills: readonly CritiqueStillImage[],
): LlmMessage[] {
  const sceneById = new Map<string, DslScene>(doc.scenes.map((scene) => [scene.id, scene]));
  const parts: LlmContentPart[] = [];

  for (const still of stills) {
    const scene = sceneById.get(still.sceneId);
    parts.push({
      type: "text",
      text:
        `Scene "${still.sceneId}" (${scene?.beat ?? "?"}) — ${still.label} frame.\n` +
        `Narration: ${scene?.narration ?? "(unknown scene)"}` +
        (scene?.caption === null ? "\nCaption band: disabled for this scene." : ""),
    });
    parts.push({ type: "image", image: still.image, mediaType: still.mediaType });
  }

  parts.push({ type: "text", text: "Review the frames above and answer with the JSON report." });

  return [
    { role: "system", content: CRITIQUE_INSTRUCTIONS },
    { role: "user", content: parts },
  ];
}

export type ParseCritiqueResult =
  | { ok: true; report: CritiqueReport }
  | { ok: false; error: string };

export function parseCritiqueReport(text: string): ParseCritiqueResult {
  let input: unknown;
  try {
    input = JSON.parse(coerceJsonText(text));
  } catch (err) {
    return { ok: false, error: `Not valid JSON: ${(err as Error).message}` };
  }
  const result = critiqueReportSchema.safeParse(input);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return { ok: false, error: `Report does not match the required shape — ${detail}` };
  }
  return { ok: true, report: result.data };
}

export async function runCritique(options: {
  client: LlmClient;
  doc: DslDocument;
  stills: readonly CritiqueStillImage[];
}): Promise<CritiqueReport> {
  const messages = buildCritiqueMessages(options.doc, options.stills);
  const first = await options.client.complete({ messages });
  const parsed = parseCritiqueReport(first.text);
  if (parsed.ok) return parsed.report;

  // One repair retry: the model sees its own output and the parse error.
  const retry = await options.client.complete({
    messages: [
      ...messages,
      { role: "assistant", content: first.text },
      {
        role: "user",
        content: `${parsed.error}\nAnswer again with ONLY the JSON report in the required shape.`,
      },
    ],
  });
  const reparsed = parseCritiqueReport(retry.text);
  if (!reparsed.ok) {
    throw new Error(`critique: model never produced a parseable report — ${reparsed.error}`);
  }
  return reparsed.report;
}
