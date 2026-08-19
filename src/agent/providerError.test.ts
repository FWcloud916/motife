import { describe, expect, it } from "vitest";
import { normalizeProviderError, providerErrorFromHttp } from "./providerError";

describe("ProviderError", () => {
  it.each([401, 403, 429, 500, 503])("classifies HTTP %i as recoverable", (status) => {
    expect(providerErrorFromHttp("x", status, "error").recoverable).toBe(true);
  });

  it("treats billing text as recoverable even on 400", () => {
    expect(providerErrorFromHttp("x", 400, "insufficient credits").recoverable).toBe(true);
  });

  it("treats other provider 4xx as fatal and network errors as recoverable", () => {
    expect(providerErrorFromHttp("x", 422, "bad request").recoverable).toBe(false);
    expect(normalizeProviderError("x", new TypeError("fetch failed")).recoverable).toBe(true);
  });
});
