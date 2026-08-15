// Revision pass: current document + critique markdown → corrected
// document, through the SAME parseDocument retry loop as generation
// (generateDsl) — a revision that breaks validation gets the formatIssues
// text fed back exactly like a fresh generation would.
import type { GenerateDslResult, AttemptRecord } from "./generate";
import { generateDsl } from "./generate";
import type { LlmClient } from "./llm";

export function buildRevisionPrompt(rawDocJson: string, critiqueMarkdown: string): string {
  return [
    "Here is the current DSL document:",
    "",
    rawDocJson,
    "",
    "A visual review of the rendered video found these issues:",
    "",
    critiqueMarkdown,
    "",
    "Revise the document to fix every ERROR (warnings where reasonable).",
    "Keep everything that was not flagged. Do not change scene ids unless",
    "an issue requires it. Output the COMPLETE corrected JSON document —",
    "ONLY the JSON object.",
  ].join("\n");
}

export async function reviseDsl(options: {
  client: LlmClient;
  systemPrompt: string;
  rawDocJson: string;
  critiqueMarkdown: string;
  maxAttempts?: number;
  onAttempt?: (record: AttemptRecord) => void | Promise<void>;
}): Promise<GenerateDslResult> {
  return generateDsl({
    client: options.client,
    systemPrompt: options.systemPrompt,
    userPrompt: buildRevisionPrompt(options.rawDocJson, options.critiqueMarkdown),
    maxAttempts: options.maxAttempts,
    onAttempt: options.onAttempt,
  });
}
