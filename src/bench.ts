import { chat, OpenRouterError, type ChatMessage, type ModelInfo } from "./openrouter.ts";
import type { CaseResult, OkResult, TurnResult } from "./results.ts";

export type Values = Record<string, number>;

export type Turn = { text: string; image?: Uint8Array };

// A benchmark is data plus pure functions. The runner owns every API call.
// A case is one conversation: `turn` builds the next user message from the model's
// answers so far, and returns null when the case is over. The model sees every
// earlier message and its own answers. Because `turn` and
// `score` only read saved answers, a scoring change re-scores old results
// without calling a model again.
export type Bench<C extends { id: string }> = {
  id: string;
  input: "text" | "image";
  cases: readonly C[];
  turn: (c: C, outputs: readonly string[]) => Turn | null;
  score: (c: C, outputs: readonly string[]) => Values;
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
      const values = result.error === undefined ? bench.score(c, result.turns.map((t) => t.output)) : {};
      scored.push({ ...result, values });
      if (result.error === undefined) answered.push({ case: c, values });
    }
    return { cases: scored, summary: { ...bench.summarize(answered), errors: scored.length - answered.length } };
  }

  async function runCase(model: ModelInfo, c: C, temperature: number | null): Promise<CaseResult> {
    const turns: TurnResult[] = [];
    const messages: ChatMessage[] = [];
    try {
      for (let next = bench.turn(c, []); next; next = bench.turn(c, turns.map((t) => t.output))) {
        messages.push({ role: "user", ...next });
        const started = performance.now();
        const { content, costUsd, finishReason } = await chat({ model, messages, temperature, maxTokens: MAX_TOKENS });
        messages.push({ role: "assistant", text: content });
        turns.push({ output: content, finishReason, latencyMs: Math.round(performance.now() - started), costUsd });
      }
      return { id: c.id, turns, values: {} };
    } catch (error) {
      if (error instanceof OpenRouterError && error.isFatal) throw error;
      if (error instanceof OpenRouterError && error.isUnavailable) throw new ModelUnavailableError(error.message);
      const message = error instanceof Error ? error.message : String(error);
      return { id: c.id, turns, error: message, values: {} };
    }
  }

  return {
    id: bench.id,

    async run(model) {
      if (bench.input === "image" && !model.acceptsImages) throw new ModelUnavailableError("Model does not accept images.");
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
        costUsd: raw.reduce((sum, r) => sum + r.turns.reduce((s, t) => s + t.costUsd, 0), 0),
        ...withScores(raw),
      };
    },

    rescore(file) {
      return { ...file, ...withScores(file.cases) };
    },
  };
}
