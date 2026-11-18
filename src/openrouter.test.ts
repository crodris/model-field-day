import { describe, expect, it } from "vitest";
import { OpenRouterError } from "./openrouter.ts";

describe("OpenRouterError", () => {
  it("waits out an in-flight budget 402 but stops on a real out-of-credits 402", () => {
    const inFlight = new OpenRouterError(402, '{"error":{"metadata":{"reason":"in_flight_budget_exhausted"}}}');
    expect(inFlight.isRetryable).toBe(true);
    expect(inFlight.isFatal).toBe(false);
    const broke = new OpenRouterError(402, '{"error":{"message":"Insufficient credits"}}');
    expect(broke.isRetryable).toBe(false);
    expect(broke.isFatal).toBe(true);
  });

  it("treats a moderation 403 as one flagged input, and any other 403 as an unavailable model", () => {
    expect(new OpenRouterError(403, '{"error":{"message":"Your input was flagged by moderation"}}').isFlagged).toBe(true);
    expect(new OpenRouterError(403, '{"error":{"message":"Requires your own provider key"}}').isFlagged).toBe(false);
  });
});
