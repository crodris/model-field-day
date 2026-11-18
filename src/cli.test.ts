import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Runs the real CLI in a temporary folder against a fake OpenRouter, so release-day
// behavior is checked end to end without spending credits.

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const TSX = path.join(ROOT, "node_modules", ".bin", "tsx");
const CLI = path.join(ROOT, "src", "cli.ts");

const listed = (id: string) => ({
  id,
  created: 1_800_000_000,
  architecture: { input_modalities: ["text"] },
  pricing: { prompt: "0", completion: "0" },
  supported_parameters: [],
});

let server: Server;
let baseUrl = "";
let flakyDown = true;
let dir = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/models") {
        res.end(JSON.stringify({ data: ["fake/ok", "fake/gated", "fake/flaky"].map(listed) }));
        return;
      }
      const fail = (status: number, message: string) => {
        res.statusCode = status;
        res.end(JSON.stringify({ error: { message } }));
      };
      if (body.includes('"fake/gated"')) return fail(403, "requires your own provider key");
      if (body.includes('"fake/flaky"') && flakyDown) return fail(400, "provider is down");
      if (body.includes("adobo")) return fail(403, "Your input was flagged by moderation");
      res.end(JSON.stringify({ choices: [{ message: { content: "A plain answer." }, finish_reason: "stop" }] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo; // listen(0) on TCP always returns an AddressInfo.
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(() => {
  server.close();
});

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "model-field-day-"));
  await writeFile(path.join(dir, "models.json"), "[]\n");
  // Settings come from .env, which the CLI loads after its imports, as on a real machine.
  await writeFile(path.join(dir, ".env"), `OPENROUTER_BASE_URL=${baseUrl}\nOPENROUTER_API_KEY=test\n`);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function cli(...args: string[]) {
  const { OPENROUTER_BASE_URL: _url, OPENROUTER_API_KEY: _key, ...env } = process.env;
  try {
    const { stdout } = await run(TSX, [CLI, ...args], { cwd: dir, env });
    return { code: 0, out: stdout };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string }; // execFile rejects with the exit code and output attached.
    return { code: failed.code ?? 1, out: `${failed.stdout ?? ""}${failed.stderr ?? ""}` };
  }
}

const readJson = async (file: string): Promise<unknown> => JSON.parse(await readFile(path.join(dir, file), "utf8"));

describe("pnpm bench", () => {
  it("rejects an id OpenRouter does not list, without touching models.json", async () => {
    const { code, out } = await cli("bench", "dash", "fake/typo");
    expect(code).toBe(1);
    expect(out).toContain("is not listed on OpenRouter");
    expect(await readJson("models.json")).toEqual([]);
  });

  it("records a gated model as unavailable and tries it again on the next run", async () => {
    expect((await cli("bench", "dash", "fake/gated")).out).toContain("unavailable");
    const again = await cli("bench", "dash", "fake/gated");
    expect(again.out).toContain("running dash");
  });

  it("fails only the flagged case on a moderation 403, then skips the model once it has answers", async () => {
    await cli("bench", "dash", "fake/ok");
    const result = await readJson("results/dash/fake--ok.json");
    expect(result).toMatchObject({ status: "ok", summary: { errors: 2 } });
    expect((await cli("bench", "dash", "fake/ok")).out).toContain("tested at");
  });

  it("runs a model again when every case of its last run failed", async () => {
    flakyDown = true;
    await cli("bench", "dash", "fake/flaky");
    expect(await readJson("results/dash/fake--flaky.json")).toMatchObject({ status: "ok", summary: { errors: 20 } });
    flakyDown = false;
    await cli("bench", "dash", "fake/flaky");
    // Only the 2 cases the fake flags for moderation fail on the second run.
    expect(await readJson("results/dash/fake--flaky.json")).toMatchObject({ status: "ok", summary: { errors: 2 } });
  });
});
