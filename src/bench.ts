import { chat, OpenRouterError, type ModelInfo } from "./openrouter.ts";
import type { CaseResult, OkResult } from "./results.ts";

export type Values = Record<string, number>;

// A benchmark is data plus pure functions. The runner owns every API call,
// so a scoring change re-scores old raw outputs without calling a model again.
export type Bench<C extends { id: string }> = {
  id: string;
  cases: readonly C[];
  prompt: (c: C) => string;
  score: (c: C, output: string) => Values;
  summarize: (scored: { case: C; values: Values }[]) => Values;
};

export type BenchRunner = {
  id: string;
  run: (model: ModelInfo) => Promise<OkResult>;
  rescore: (file: OkResult) => OkResult;
};

export class ModelUnavailableError extends Error {}

const MAX_TOKENS = 16_384;
const CONCURRENCY = 5;

export function defineBench<C extends { id: string }>(bench: Bench<C>): BenchRunner {
  const byId = new Map(bench.cases.map((c) => [c.id, c]));

  function withScores(cases: CaseResult[]) {
    const scored: CaseResult[] = [];
    const answered: { case: C; values: Values }[] = [];
    for (const result of cases) {
      const c = byId.get(result.id);
      if (!c) continue; // The case was removed from the bench, so it no longer counts.
      const values = result.output === null ? {} : bench.score(c, result.output);
      scored.push({ ...result, values });
      if (result.output !== null) answered.push({ case: c, values });
    }
    return { cases: scored, summary: { ...bench.summarize(answered), errors: scored.length - answered.length } };
  }

  async function runCase(model: ModelInfo, c: C, temperature: number | null): Promise<CaseResult> {
    const started = performance.now();
    try {
      const { content, costUsd } = await chat({ model, text: bench.prompt(c), temperature, maxTokens: MAX_TOKENS });
      return { id: c.id, output: content, latencyMs: Math.round(performance.now() - started), costUsd, values: {} };
    } catch (error) {
      if (error instanceof OpenRouterError && error.isFatal) throw error;
      if (error instanceof OpenRouterError && error.isUnavailable) throw new ModelUnavailableError(error.message);
      const message = error instanceof Error ? error.message : String(error);
      return { id: c.id, output: null, error: message, latencyMs: Math.round(performance.now() - started), costUsd: 0, values: {} };
    }
  }

  return {
    id: bench.id,

    async run(model) {
      const ranAt = new Date().toISOString();
      const temperature = model.supportsTemperature ? 0 : null;
      const queue = [...bench.cases];
      const raw: CaseResult[] = [];
      await Promise.all(
        Array.from({ length: CONCURRENCY }, async () => {
          for (let c = queue.shift(); c; c = queue.shift()) {
            try {
              raw.push(await runCase(model, c, temperature));
            } catch (error) {
              queue.length = 0; // Stop the other workers from sending more requests.
              throw error;
            }
            process.stdout.write(".");
          }
        }),
      );
      process.stdout.write("\n");
      raw.sort((a, b) => a.id.localeCompare(b.id));
      return {
        status: "ok",
        bench: bench.id,
        model: model.id,
        ranAt,
        listedAt: model.listedAt,
        settings: { temperature, maxTokens: MAX_TOKENS, reasoning: "provider default" },
        costUsd: raw.reduce((sum, r) => sum + r.costUsd, 0),
        ...withScores(raw),
      };
    },

    rescore(file) {
      return { ...file, ...withScores(file.cases) };
    },
  };
}
