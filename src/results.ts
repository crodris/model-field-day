import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { resultFileSchema, type ResultFile } from "./schema.ts";

export type { CaseResult, OkResult, ResultFile, TurnResult } from "./schema.ts";

const RESULTS_DIR = "results";

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
