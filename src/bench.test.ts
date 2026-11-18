import { describe, expect, it } from "vitest";
import { defineBench } from "./bench.ts";
import type { OkResult } from "./results.ts";

const runner = defineBench({
  id: "len",
  cases: [{ id: "a" }, { id: "b" }],
  prompt: () => "say something",
  score: (_c, output) => ({ length: output.length }),
  summarize: (scored) => ({ total: scored.reduce((sum, s) => sum + (s.values.length ?? 0), 0) }),
});

const file: OkResult = {
  status: "ok",
  bench: "len",
  model: "m",
  ranAt: "2026-11-18T00:00:00.000Z",
  listedAt: "2026-11-17T00:00:00.000Z",
  settings: { temperature: 0, maxTokens: 100, reasoning: "provider default" },
  costUsd: 0,
  summary: {},
  cases: [
    { id: "a", output: "abc", latencyMs: 1, costUsd: 0, values: { length: 999 } },
    { id: "b", output: null, error: "timeout", latencyMs: 1, costUsd: 0, values: {} },
    { id: "gone", output: "removed case", latencyMs: 1, costUsd: 0, values: {} },
  ],
};

describe("rescore", () => {
  it("recomputes scores from saved outputs and counts failed cases as errors", () => {
    const rescored = runner.rescore(file);
    expect(rescored.cases.map((c) => [c.id, c.values])).toEqual([
      ["a", { length: 3 }],
      ["b", {}],
    ]);
    expect(rescored.summary).toEqual({ total: 3, errors: 1 });
  });
});
