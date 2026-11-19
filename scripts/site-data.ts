// Writes site/src/generated/site-data.json from every saved result and site/content/notes.json.
// Run from the repository root with `pnpm site:data`. The site only renders this file.
// Each result is re-scored first, so the page never shows a summary older than the scoring code.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readAllResults } from "../src/results.ts";
import { runners } from "../src/runners.ts";
import { buildSiteData, notesSchema } from "./build-site-data.ts";

const OUT_DIR = "site/src/generated";

const notes = notesSchema.parse(JSON.parse(await readFile("site/content/notes.json", "utf8")));
const results = (await readAllResults()).map((file) => {
  const runner = runners[file.bench];
  return file.status === "ok" && runner ? runner.rescore(file) : file;
});
const data = buildSiteData(results, notes, new Date().toISOString());

await mkdir(OUT_DIR, { recursive: true });
await writeFile(`${OUT_DIR}/site-data.json`, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Wrote ${OUT_DIR}/site-data.json`);
