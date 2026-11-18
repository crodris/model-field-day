import { defineBench, type Bench } from "../../src/bench.ts";
import tasks from "./tasks.json" with { type: "json" };

// Each writing task runs twice: once as written, and once with the no-dash rule.
// The first shows the model's habit. The second shows whether it obeys.
type DashCase = { id: string; task: string; rule: boolean };

export const RULE = "Do not use em dashes or en dashes anywhere in your response.";

const DASHES = /[\u2014\u2013]/g;

export const dash: Bench<DashCase> = {
  id: "dash",
  input: "text",
  cases: tasks.flatMap(({ id, task }) => [
    { id: `${id}.norule`, task, rule: false },
    { id: `${id}.rule`, task, rule: true },
  ]),
  turn: (c, outputs) => (outputs.length > 0 ? null : { text: c.rule ? `${c.task}\n\n${RULE}` : c.task }),
  score: (_c, [output = ""]) => ({
    dashes: output.match(DASHES)?.length ?? 0,
    words: output.split(/\s+/).filter(Boolean).length,
  }),
  summarize: (scored) => {
    const total = (rule: boolean, key: string) =>
      scored.filter((s) => s.case.rule === rule).reduce((sum, s) => sum + (s.values[key] ?? 0), 0);
    const ruleCases = scored.filter((s) => s.case.rule);
    const summary: Record<string, number> = {};
    const words = total(false, "words");
    // Skip a metric that has no answered cases, so it shows as missing instead of a fake 0.
    if (words > 0) summary.habitPer1k = (total(false, "dashes") / words) * 1000;
    if (ruleCases.length > 0) {
      summary.obeyedPct = (ruleCases.filter((s) => s.values.dashes === 0).length / ruleCases.length) * 100;
    }
    return summary;
  },
};

export const dashRunner = defineBench(dash);
