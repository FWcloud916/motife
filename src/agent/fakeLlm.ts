// Scripted LlmClient for tests (and only tests — no production fallback).
// Not named *.test.ts so vitest doesn't try to run it, but multiple test
// files (generate, revise, critique) share it.
import type { LlmClient, LlmRequest } from "./llm";

export class FakeLlmClient implements LlmClient {
  /** Every request received, in order — assert on messages/attempt counts. */
  readonly calls: LlmRequest[] = [];
  private readonly responses: readonly string[];

  constructor(responses: readonly string[]) {
    this.responses = responses;
  }

  async complete(req: LlmRequest): Promise<{ text: string }> {
    this.calls.push(req);
    const index = this.calls.length - 1;
    const text = this.responses[index];
    if (text === undefined) {
      throw new Error(
        `FakeLlmClient: no scripted response for call #${index + 1} (scripted: ${this.responses.length}).`,
      );
    }
    return { text };
  }
}
