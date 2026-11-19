import { archeryRunner } from "../benches/archery/index.ts";
import { dashRunner } from "../benches/dash/index.ts";
import type { BenchRunner } from "./bench.ts";

// Every benchmark, by the id its results carry. The CLI and the site generator both read this list.
export const runners: Record<string, BenchRunner> = { dash: dashRunner, archery: archeryRunner };
