/** Normalized provider failures at the two paid boundaries (LLM and TTS). */
export class ProviderError extends Error {
  readonly cause?: unknown;
  readonly provider: string;
  readonly statusCode: number | null;
  readonly recoverable: boolean;

  constructor(options: {
    provider: string;
    message: string;
    statusCode?: number | null;
    recoverable: boolean;
    cause?: unknown;
  }) {
    super(options.message);
    if (options.cause !== undefined) this.cause = options.cause;
    this.name = "ProviderError";
    this.provider = options.provider;
    this.statusCode = options.statusCode ?? null;
    this.recoverable = options.recoverable;
  }
}

const RECOVERABLE_TEXT = /quota|credit|billing|insufficient|rate.?limit|too many requests|payment required/i;

export function providerErrorFromHttp(
  provider: string,
  statusCode: number,
  detail: string,
): ProviderError {
  const recoverable =
    statusCode === 401 ||
    statusCode === 403 ||
    statusCode === 429 ||
    statusCode >= 500 ||
    RECOVERABLE_TEXT.test(detail);
  return new ProviderError({
    provider,
    statusCode,
    recoverable,
    message: `${provider} failed (${statusCode}): ${detail.slice(0, 500)}`,
  });
}

/** AI SDK errors are deliberately inspected structurally: each provider
 * package exposes a slightly different concrete error class. */
export function normalizeProviderError(provider: string, error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  const record = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
  const statusCandidate = record.statusCode ?? record.status;
  const statusCode = typeof statusCandidate === "number" ? statusCandidate : null;
  const message = error instanceof Error ? error.message : String(error);
  const recoverable =
    statusCode === null ||
    statusCode === 401 ||
    statusCode === 403 ||
    statusCode === 429 ||
    statusCode >= 500 ||
    RECOVERABLE_TEXT.test(message);
  return new ProviderError({ provider, statusCode, recoverable, message, cause: error });
}

export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError;
}
