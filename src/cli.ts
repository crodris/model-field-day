import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { ModelUnavailableError, type BenchRunner } from "./bench.ts";
import { getModelInfo } from "./openrouter.ts";
import { hasResult, readAllResults, readResult, resultPath, writeResult, type ResultFile } from "./results.ts";
import { runners } from "./runners.ts";

if (existsSync(".env")) process.loadEnvFile();

const MODELS_FILE = "models.json";
const USAGE = `Usage:
  pnpm bench <${Object.keys(runners).join("|")}> [openrouter-model-id]
  pnpm score
  pnpm report`;

async function readModels() {
  return z.array(z.string()).parse(JSON.parse(await readFile(MODELS_FILE, "utf8")));
}

async function bench(benchId: string | undefined, modelId: string | undefined) {
  const runner = benchId ? runners[benchId] : undefined;
  if (!runner) throw new Error(USAGE);

  const models = await readModels();
  if (modelId && !models.includes(modelId)) {
    // Check the catalog first, so a typo never lands in models.json.
    if (!(await getModelInfo(modelId))) {
      throw new Error(`${modelId} is not listed on OpenRouter. Check the id, or run this again once OpenRouter lists it.`);
    }
    await writeFile(MODELS_FILE, `${JSON.stringify([...models, modelId], null, 2)}\n`);
    console.log(`Added ${modelId} to ${MODELS_FILE}.`);
  }

  for (const id of modelId ? [modelId] : models) {
    const existing = hasResult(runner.id, id) ? await readResult(runner.id, id) : null;
    if (existing && runner.hasAnswers(existing)) {
      console.log(`${id}: tested at ${existing.ranAt}. Delete ${resultPath(runner.id, id)} to run it again.`);
      continue;
    }
    console.log(`${id}: running ${runner.id}`);
    const file = await runModel(runner, id);
    console.log(`${id}: ${describe(file)}. Wrote ${await writeResult(file)}.`);
  }
}

async function runModel(runner: BenchRunner, id: string): Promise<ResultFile> {
  const unavailable = (reason: string): ResultFile => ({
    status: "unavailable",
    bench: runner.id,
    model: id,
    ranAt: new Date().toISOString(),
    reason,
  });
  const info = await getModelInfo(id);
  if (!info) return unavailable("Not listed on OpenRouter.");
  try {
    return await runner.run(info);
  } catch (error) {
    if (error instanceof ModelUnavailableError) return unavailable(error.message);
    throw error;
  }
}

async function score() {
  for (const file of await readAllResults()) {
    const runner = runners[file.bench];
    if (file.status !== "ok" || !runner) continue;
    await writeResult(runner.rescore(file));
  }
  console.log("Re-scored every result from its saved outputs.");
}

async function report() {
  const results = await readAllResults();
  for (const benchId of new Set(results.map((r) => r.bench))) {
    const rows = results.filter((r) => r.bench === benchId).toSorted((a, b) => a.model.localeCompare(b.model));
    const metrics = [...new Set(rows.flatMap((r) => (r.status === "ok" ? Object.keys(r.summary) : [])))];
    const table = rows.map((r) =>
      r.status === "ok"
        ? [
            r.model,
            ...metrics.map((m) => format(r.summary[m])),
            `$${r.costUsd.toFixed(3)}`,
            elapsed(r.listedAt, r.ranAt),
          ]
        : [r.model, ...metrics.map(() => "-"), "-", `unavailable: ${r.reason}`],
    );
    console.log(`\n${benchId}`);
    printTable(["model", ...metrics, "cost", "listed to tested"], table);
  }
}

function describe(file: ResultFile) {
  if (file.status === "unavailable") return `unavailable (${file.reason})`;
  const metrics = Object.entries(file.summary).map(([k, v]) => `${k} ${format(v)}`);
  return `${metrics.join(", ")}, cost $${file.costUsd.toFixed(3)}`;
}

function format(value: number | undefined) {
  if (value === undefined) return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function elapsed(from: string, to: string) {
  const hours = (Date.parse(to) - Date.parse(from)) / 3_600_000;
  return hours < 48 ? `${hours.toFixed(1)}h` : `${(hours / 24).toFixed(0)}d`;
}

function printTable(header: string[], rows: string[][]) {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]?.length ?? 0)));
  const line = (cells: string[]) => cells.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join("  ");
  console.log(line(header));
  for (const row of rows) console.log(line(row));
}

const [command, ...args] = process.argv.slice(2);
const commands: Record<string, () => Promise<void>> = {
  bench: () => bench(args[0], args[1]),
  score,
  report,
};
const run = command ? commands[command] : undefined;
if (!run) {
  console.error(USAGE);
  process.exit(1);
}
try {
  await run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
