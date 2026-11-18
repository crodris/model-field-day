import { describe, expect, it } from "vitest";
import { dash, RULE } from "./index.ts";

const EM = "\u2014";
const EN = "\u2013";

describe("dash bench", () => {
  it("counts em and en dashes but not hyphens", () => {
    const c = { id: "x.norule", task: "t", rule: false };
    expect(dash.score(c, [`well${EM}maybe 1${EN}2 a well-known co-op`])).toEqual({ dashes: 2, words: 5 });
  });

  it("asks once, adding the rule only to rule cases", () => {
    const [norule, rule] = dash.cases;
    expect(norule && dash.turn(norule, [])?.text).not.toContain(RULE);
    expect(rule && dash.turn(rule, [])?.text).toContain(RULE);
    expect(rule && dash.turn(rule, ["an answer"])).toBeNull();
  });

  it("measures habit on no-rule cases and obedience on rule cases", () => {
    const summary = dash.summarize([
      { case: { id: "a.norule", task: "t", rule: false }, values: { dashes: 3, words: 1000 } },
      { case: { id: "b.norule", task: "t", rule: false }, values: { dashes: 1, words: 1000 } },
      { case: { id: "a.rule", task: "t", rule: true }, values: { dashes: 0, words: 900 } },
      { case: { id: "b.rule", task: "t", rule: true }, values: { dashes: 2, words: 900 } },
    ]);
    expect(summary).toEqual({ habitPer1k: 2, obeyedPct: 50 });
  });

  it("leaves a blank answer out of obedience, since it did not write anything", () => {
    const summary = dash.summarize([
      { case: { id: "a.rule", task: "t", rule: true }, values: dash.score({ id: "a.rule", task: "t", rule: true }, [""]) },
      { case: { id: "b.rule", task: "t", rule: true }, values: { dashes: 1, words: 100 } },
    ]);
    expect(summary.obeyedPct).toBe(0);
  });
});
