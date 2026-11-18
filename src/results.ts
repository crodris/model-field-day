import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const RESULTS_DIR = "results";

const turnResultSchema = z.object({
  output: z.string(),
  finishReason: z.string().nullish(),
  latencyMs: z.number(),
  costUsd: z.number(),
});

// A case with an error keeps the turns it finished, but it is not scored.
const caseResultSchema = z.object({
  id: z.string(),
  turns: z.array(turnResultSchema),
  error: z.string().optional(),
  values: z.record(z.string(), z.number()),
});

const okSchema = z.object({
  status: z.literal("ok"),
  bench: z.string(),
  model: z.string(),
  ranAt: z.iso.datetime(),
  listedAt: z.iso.datetime(),
  settings: z.object({
    temperature: z.number().nullable(),
    maxTokens: z.number(),
    reasoning: z.literal("provider default"),
  }),
  costUsd: z.number(),
  summary: z.record(z.string(), z.number()),
  cases: z.array(caseResultSchema),
});

const unavailableSchema = z.object({
  status: z.literal("unavailable"),
  bench: z.string(),
  model: z.string(),
  ranAt: z.iso.datetime(),
  reason: z.string(),
});

const resultFileSchema = z.discriminatedUnion("status", [okSchema, unavailableSchema]);

export type TurnResult = z.infer<typeof turnResultSchema>;
export type CaseResult = z.infer<typeof caseResultSchema>;
export type OkResult = z.infer<typeof okSchema>;
export type ResultFile = z.infer<typeof resultFileSchema>;

export function resultPath(bench: string, model: string) {
  return path.join(RESULTS_DIR, bench, `${model.replaceAll("/", "--")}.json`);
}

export function hasResult(bench: string, model: string) {
  return existsSync(resultPath(bench, model));
}

export async function writeResult(file: ResultFile) {
  const target = resultPath(file.bench, file.model);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(file, null, 2)}\n`);
  return target;
}

export async function readResult(bench: string, model: string): Promise<ResultFile> {
  return resultFileSchema.parse(JSON.parse(await readFile(resultPath(bench, model), "utf8")));
}

export async function readAllResults(): Promise<ResultFile[]> {
  if (!existsSync(RESULTS_DIR)) return [];
  const files = await readdir(RESULTS_DIR, { recursive: true });
  return Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => resultFileSchema.parse(JSON.parse(await readFile(path.join(RESULTS_DIR, f), "utf8")))),
  );
}
