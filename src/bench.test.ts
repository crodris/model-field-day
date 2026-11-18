import { describe, expect, it } from "vitest";
import { defineBench } from "./bench.ts";
import type { OkResult } from "./results.ts";

const runner = defineBench({
  id: "len",
  input: "text",
  cases: [{ id: "a" }, { id: "b" }],
  turn: (_c, outputs) => (outputs.length < 2 ? { text: "say something" } : null),
  score: (_c, outputs) => ({ length: outputs.join("").length }),
  summarize: (scored) => ({ total: scored.reduce((sum, s) => sum + (s.values.length ?? 0), 0) }),
});

const turn = (output: string) => ({ output, latencyMs: 1, costUsd: 0.25 });

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
    { id: "a", turns: [turn("ab"), turn("c")], values: { length: 999 } },
    { id: "b", turns: [turn("x")], error: "timeout", values: {} },
    { id: "gone", turns: [turn("removed case")], values: {} },
  ],
};

describe("rescore", () => {
  it("recomputes scores from every saved turn and counts failed cases as errors", () => {
    const rescored = runner.rescore(file);
    expect(rescored.cases.map((c) => [c.id, c.values])).toEqual([
      ["a", { length: 3 }],
      ["b", {}],
    ]);
    expect(rescored.summary).toEqual({ total: 3, errors: 1 });
    expect(rescored.costUsd).toBe(0.75); // The removed case's cost no longer counts.
  });
});
