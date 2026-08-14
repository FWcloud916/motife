// The prompt→DSL retry loop — the "compiler 錯誤自動回饋" workstream of
// motife-plan.md §3 Phase 3. parseDocument() is the sole gate (never a
// cast); on failure the formatIssues() text goes back to the LLM verbatim,
// which is exactly what that text was designed for (src/compiler/errors.ts).
// Pure orchestration over an injected LlmClient: no filesystem, no env —
// callers persist attempts via onAttempt.
import type { DslDocument } from "../dsl";
import { formatIssues, parseDocument } from "../compiler";
import { coerceJsonText, extractDocId, jsonSyntaxIssueText } from "./docJson";
import type { LlmClient, LlmMessage } from "./llm";

export const DEFAULT_MAX_ATTEMPTS = 4;

export interface AttemptRecord {
  /** 1-based. */
  attempt: number;
  /** The LLM's raw text for this attempt. */
  raw: string;
  /** formatIssues()-style report when the attempt failed, else null. */
  issuesText: string | null;
}

export interface GenerateDslOptions {
  client: LlmClient;
  systemPrompt: string;
  /** The user's concept description (or a revision instruction). */
  userPrompt: string;
  maxAttempts?: number;
  /** Called after every attempt — the CLI persists attempts/ here. */
  onAttempt?: (record: AttemptRecord) => void | Promise<void>;
}

export type GenerateDslResult =
  | {
      ok: true;
      doc: DslDocument;
      /** Raw JSON (coerced text) of the accepted attempt — what callers
       * should write to disk, so the file round-trips parseDocument. */
      json: string;
      /** formatIssues() text for warnings on the accepted doc, or null. */
      warningsText: string | null;
      attempts: AttemptRecord[];
    }
  | {
      ok: false;
      /** The last attempt's issue report — why the run gave up. */
      failureText: string;
      attempts: AttemptRecord[];
    };

export async function generateDsl(options: GenerateDslOptions): Promise<GenerateDslResult> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const messages: LlmMessage[] = [
    { role: "system", content: options.systemPrompt },
    { role: "user", content: options.userPrompt },
  ];
  const attempts: AttemptRecord[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { text } = await options.client.complete({ messages });
    const json = coerceJsonText(text);

    let issuesText: string | null = null;
    let accepted: { doc: DslDocument; warningsText: string | null } | null = null;

    let input: unknown;
    try {
      input = JSON.parse(json);
    } catch (err) {
      issuesText = jsonSyntaxIssueText("attempt", (err as Error).message);
      input = undefined;
    }

    if (issuesText === null) {
      const result = parseDocument(input);
      if (result.ok) {
        accepted = {
          doc: result.doc,
          warningsText:
            result.warnings.length > 0 ? formatIssues(result.doc.id, result.warnings) : null,
        };
      } else {
        issuesText = formatIssues(extractDocId(input) ?? "attempt", result.issues);
      }
    }

    const record: AttemptRecord = { attempt, raw: text, issuesText };
    attempts.push(record);
    await options.onAttempt?.(record);

    if (accepted) {
      return { ok: true, doc: accepted.doc, json, warningsText: accepted.warningsText, attempts };
    }

    // Feed the failure straight back: the model sees its own output as an
    // assistant turn, then the verbatim issue report as the next user turn.
    messages.push({ role: "assistant", content: text });
    messages.push({
      role: "user",
      content:
        `${issuesText}\n\n` +
        `Fix every issue above and output the COMPLETE corrected JSON document. ` +
        `Output ONLY the JSON object.`,
    });
  }

  return {
    ok: false,
    failureText: attempts[attempts.length - 1]?.issuesText ?? "no attempts were made",
    attempts,
  };
}
