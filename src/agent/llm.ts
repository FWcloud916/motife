// The ONLY file that touches the Vercel AI SDK. Everything else in the
// pipeline speaks LlmClient/LlmMessage — plain local types — so a vendor
// API change (or swapping the SDK out entirely) has a one-file blast
// radius, tests run against FakeLlmClient (fakeLlm.ts) with no network,
// and skill mode never loads this module at all.
import { generateText } from "ai";
import type { ModelMessage, UserContent } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { xai } from "@ai-sdk/xai";
import { groq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";
import type { ProviderName } from "./providers";
import { PROVIDER_ENV_KEYS } from "./providers";

export type LlmContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image: Uint8Array; mediaType: "image/png" | "image/jpeg" };

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string | LlmContentPart[];
}

export interface LlmRequest {
  messages: LlmMessage[];
  maxOutputTokens?: number;
}

export interface LlmClient {
  complete(req: LlmRequest): Promise<{ text: string }>;
}

// A full DSL document is ~25 KB of JSON (roughly 8–10k output tokens), and
// the retry loop asks for the COMPLETE corrected document each attempt —
// so the ceiling must comfortably exceed one whole document, not one edit.
const DEFAULT_MAX_OUTPUT_TOKENS = 32_000;

export function createLlmClient(spec: { provider: ProviderName; model: string }): LlmClient {
  const envKey = PROVIDER_ENV_KEYS[spec.provider];
  if (!process.env[envKey]) {
    throw new Error(
      `Provider "${spec.provider}" needs ${envKey} set (via .env or the environment). ` +
        `See .env.example.`,
    );
  }
  const model = modelFor(spec.provider, spec.model);
  return {
    async complete(req: LlmRequest): Promise<{ text: string }> {
      const { instructions, rest } = splitInstructions(req.messages);
      const result = await generateText({
        model,
        // AI SDK v7 rejects system-role entries inside `messages`
        // (allowSystemInMessages defaults to false) — system content must
        // ride the `instructions` option instead.
        ...(instructions === null ? {} : { instructions }),
        messages: rest.map(toModelMessage),
        maxOutputTokens: req.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      });
      return { text: result.text };
    },
  };
}

/** Exported for tests — lifts system messages out of the conversation into
 * a single instructions string (AI SDK v7's required shape). */
export function splitInstructions(messages: LlmMessage[]): {
  instructions: string | null;
  rest: LlmMessage[];
} {
  const systemTexts: string[] = [];
  const rest: LlmMessage[] = [];
  for (const message of messages) {
    if (message.role === "system") {
      if (typeof message.content !== "string") {
        throw new Error("System messages must have plain-string content.");
      }
      systemTexts.push(message.content);
    } else {
      rest.push(message);
    }
  }
  return { instructions: systemTexts.length > 0 ? systemTexts.join("\n\n") : null, rest };
}

function modelFor(provider: ProviderName, modelId: string): LanguageModel {
  switch (provider) {
    case "anthropic":
      return anthropic(modelId);
    case "openai":
      return openai(modelId);
    case "google":
      return google(modelId);
    case "xai":
      return xai(modelId);
    case "groq":
      return groq(modelId);
  }
}

/** Exported for tests only — the pure LlmMessage → AI SDK conversion. */
export function toModelMessage(message: LlmMessage): ModelMessage {
  if (typeof message.content === "string") {
    // The three roles all accept plain-string content; the cast is only to
    // convince TS the role/content pairing is one of the union's members.
    return { role: message.role, content: message.content } as ModelMessage;
  }
  if (message.role !== "user") {
    throw new Error(`Only user messages may carry image parts (got role "${message.role}").`);
  }
  const content: UserContent = message.content.map((part) =>
    part.type === "text"
      ? { type: "text" as const, text: part.text }
      : { type: "image" as const, image: part.image, mediaType: part.mediaType },
  );
  return { role: "user", content };
}
