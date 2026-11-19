import { describe, expect, it } from "vitest";
import { ROUNDS } from "../benches/archery/index.ts";
import type { OkResult } from "../src/results.ts";
import { buildSiteData, displayName, isDisqualified, notesSchema, tieRanks } from "./build-site-data.ts";

const FEATURED = "openai/gpt-6.2-astra";
const AIM = '{"x":512,"y":384}';
const REFUSAL = '{"error":"I can’t provide an aim point."}';
const LISTED = "2026-11-17T18:00:00.000Z";
const notes = notesSchema.parse({ headline: "A headline.", take: null, quotes: [] });

const base = { status: "ok", settings: { temperature: 0, maxTokens: 8192, reasoning: "provider default" }, costUsd: 0 } as const;

// An archery result with 24 answers: the last `refused` are refusals, the rest aim at the center.
function archery(model: string, refused: number, scorePct: number, ranAt = "2026-11-18T20:00:00.000Z", listedAt = LISTED): OkResult {
  const cases = ROUNDS.map((round, r) => ({
    id: round.id,
    turns: round.arrows.map((_, i) => ({ output: r * 6 + i >= 24 - refused ? REFUSAL : AIM, latencyMs: 1, costUsd: 0 })),
    values: {},
  }));
  return { ...base, bench: "archery", model, ranAt, listedAt, summary: { scorePct }, cases };
}

function dash(model: string, habitPer1k: number, ranAt = "2026-11-18T20:00:00.000Z", listedAt = LISTED): OkResult {
  return { ...base, bench: "dash", model, ranAt, listedAt, summary: { habitPer1k, obeyedPct: 100 }, cases: [] };
}

describe("displayName", () => {
  it.each([
    ["anthropic/claude-fable-5.2", "Claude Fable 5.2"],
    ["google/gemini-4-hydrogen", "Gemini 4 Hydrogen"],
    ["openai/gpt-6.2-astra", "GPT-6.2 Astra"],
    ["meta/muse-wonder", "Muse Wonder"],
  ])("turns %s into %s", (id, name) => {
    expect(displayName(id)).toBe(name);
  });
});

describe("tieRanks", () => {
  it("shares a rank between equal scores and skips the places they fill", () => {
    expect(tieRanks([82.9, 82.9, 79.2, 78.8])).toEqual(["T1", "T1", "3", "4"]);
  });

  it("ties scores that show the same on the page", () => {
    expect(tieRanks([82.94, 82.91, 70])).toEqual(["T1", "T1", "3"]);
  });
});

describe("isDisqualified", () => {
  it("disqualifies a model only when more than half its arrows had no aim", () => {
    expect(isDisqualified(12, 24)).toBe(false);
    expect(isDisqualified(13, 24)).toBe(true);
  });
});

describe("buildSiteData", () => {
  it("ranks the archery table, with a disqualified model last and unranked even if it scores higher", () => {
    const data = buildSiteData(
      [archery(FEATURED, 13, 90), archery("a/one", 0, 80), archery("a/two", 0, 80), archery("a/three", 12, 70)],
      notes,
      "2026-11-18T21:00:00.000Z",
    );
    expect(data.archery.map((r) => [r.name, r.rank, r.dq, r.noAimArrows])).toEqual([
      ["One", "T1", false, 0],
      ["Two", "T1", false, 0],
      ["Three", "3", false, 12],
      ["GPT-6.2 Astra", null, true, 13],
    ]);
  });

  it("ranks the dash table from the lowest habit, with ties", () => {
    const data = buildSiteData(
      [archery(FEATURED, 0, 50), dash("a/clean", 0), dash(FEATURED, 0), dash("a/habit", 3.14)],
      notes,
      "2026-11-18T21:00:00.000Z",
    );
    expect(data.dash.map((r) => [r.name, r.rank])).toEqual([
      ["Clean", "T1"],
      ["GPT-6.2 Astra", "T1"],
      ["Habit", "3"],
    ]);
  });

  it("marks a model tested more than 48 hours after listing as a backfill", () => {
    const data = buildSiteData(
      [
        archery(FEATURED, 0, 50, "2026-11-18T20:36:00.000Z"),
        dash("a/edge", 1, "2026-11-19T18:00:00.000Z", LISTED),
        dash("a/late", 1, "2026-11-19T18:06:00.000Z", LISTED),
        dash("a/old", 1, "2026-11-18T20:00:00.000Z", "2026-11-10T08:00:00.000Z"),
      ],
      notes,
      "2026-11-18T21:00:00.000Z",
    );
    expect(Object.fromEntries(data.log.map((r) => [r.name, r.hoursAfterListing]))).toEqual({
      "GPT-6.2 Astra": 26.6,
      Edge: 48,
      Late: null,
      Old: null,
    });
    // Newest listing first.
    expect(data.log.map((r) => r.name)).toEqual(["GPT-6.2 Astra", "Edge", "Late", "Old"]);
  });

  it("dates the featured model from its earliest result and replays its figure arrow", () => {
    const data = buildSiteData(
      [archery(FEATURED, 0, 50, "2026-11-18T20:36:00.000Z"), dash(FEATURED, 0, "2026-11-18T20:00:00.000Z")],
      notes,
      "2026-11-18T21:00:00.000Z",
    );
    expect(data.featured.testedAt).toBe("2026-11-18T20:00:00.000Z");
    expect(data.featured.hoursAfterListing).toBe(26);
    expect(data.featured.figure.strip).toHaveLength(24);
    expect(data.featured.figure.view.caption).toBe(
      "Round 2, arrow 4: 40 m, wind 4 m/s blowing left. Aimed at (512, 384), scored 0.",
    );
    expect(data.featured.figure.view.aim).toEqual({ x: 512, y: 384 });
  });

  it("refuses to build when the figure arrow has no readable aim", () => {
    expect(() => buildSiteData([archery(FEATURED, 24, 0)], notes, "2026-11-18T21:00:00.000Z")).toThrow(
      /no readable aim/,
    );
  });
});
