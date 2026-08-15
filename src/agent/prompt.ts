// System-prompt assembly for `motife generate`. Assembled at runtime from
// the living sources — docs/dsl-schema.md (whose own header declares it
// "doubles as Phase 3's system-prompt source material"), the zod schema's
// JSON Schema projection, and the checked-in eval documents as few-shot
// examples — so schema/doc changes flow into the prompt with no second
// copy to keep in sync (motife-plan.md §4: few-shot 用真實好範例).
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { dslDocumentSchema } from "../dsl";
import { RAW_DOCS } from "../dsl/docs/manifest";

const DSL_SCHEMA_DOC_URL = new URL("../../docs/dsl-schema.md", import.meta.url);

export interface PromptOptions {
  /** BCP 47 narration language. Default zh-TW — matches the eval set and
   * the pacing validator's ~8 chars/sec Mandarin heuristic. */
  language?: string;
  /** How many eval documents to inline as few-shot examples (0–3).
   * Default: all of them. */
  fewShot?: number;
}

export async function buildSystemPrompt(options: PromptOptions = {}): Promise<string> {
  const language = options.language ?? "zh-TW";
  const requestedFewShot = options.fewShot ?? RAW_DOCS.length;
  if (!Number.isInteger(requestedFewShot)) {
    // NaN would silently clamp to zero examples — fail loudly instead.
    throw new Error(`fewShot must be an integer (got ${String(requestedFewShot)}).`);
  }
  const fewShotCount = Math.max(0, Math.min(requestedFewShot, RAW_DOCS.length));

  const specMarkdown = await readFile(fileURLToPath(DSL_SCHEMA_DOC_URL), "utf8");
  const jsonSchema = JSON.stringify(z.toJSONSchema(dslDocumentSchema));

  const examples = RAW_DOCS.slice(0, fewShotCount)
    .map(
      (doc, index) =>
        `### Example ${index + 1}\n\`\`\`json\n${JSON.stringify(doc, null, 1)}\n\`\`\``,
    )
    .join("\n\n");

  return [
    "You are motife's semantic layer: you turn a technical concept into a",
    "motion-graphic explainer by writing ONE motife DSL document (JSON).",
    "You decide narrative structure, component choice, and narration — the",
    "compiler and component library own coordinates, easing, animation",
    "parameters, and layout. Never try to express those.",
    "",
    "Requirements:",
    "- Output ONLY the JSON document. No markdown fences, no commentary,",
    "  no trailing text. The output is machine-parsed.",
    "- Follow the four-beat skeleton: exactly one intro scene first, one",
    "  summary scene last, with breakdown and walkthrough scenes between.",
    `- Write narration and all on-screen text in ${language}.`,
    "- Set each scene's durationInSeconds to fit its narration at a",
    "  comfortable ~8 characters/second — it is provisional (TTS replaces",
    "  it later), but a validator warns when it is far off.",
    "- Prefer the vocabulary the reference below defines (tones, icons,",
    "  emphasis, semantic sizes). There are no free-form styles.",
    "",
    "If a validation report is returned to you, fix every listed issue and",
    "output the COMPLETE corrected document — never a fragment or a diff.",
    "",
    "## DSL reference",
    "",
    specMarkdown,
    "",
    "## JSON Schema (machine-readable, for structure only — the reference",
    "## above is authoritative for meaning)",
    "",
    "```json",
    jsonSchema,
    "```",
    ...(examples.length > 0
      ? ["", "## Complete example documents (real, shipped videos)", "", examples]
      : []),
  ].join("\n");
}
