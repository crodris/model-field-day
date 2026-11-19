// Writes site/src/generated/site-data.ts from every saved result and site/content/notes.json.
// Run from the repository root with `pnpm site:data`. The site only renders this file.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readAllResults } from "../src/results.ts";
import { runners } from "../src/runners.ts";
import { buildSiteData, notesSchema, prepareResults } from "./build-site-data.ts";

const OUT_DIR = "site/src/generated";

const notes = notesSchema.parse(JSON.parse(await readFile("site/content/notes.json", "utf8")));
const data = buildSiteData(prepareResults(await readAllResults(), runners), notes, new Date().toISOString());

// A TypeScript module, so `satisfies` type-checks the whole shape when the site compiles.
await mkdir(OUT_DIR, { recursive: true });
await writeFile(
  `${OUT_DIR}/site-data.ts`,
  `import type { SiteData } from "../site-data.ts";\n\nexport const siteData = ${JSON.stringify(data, null, 2)} satisfies SiteData;\n`,
);
console.log(`Wrote ${OUT_DIR}/site-data.ts`);
