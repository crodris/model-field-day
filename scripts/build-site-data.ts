import { z } from "zod";
import { ROUNDS, shots } from "../benches/archery/index.ts";
import { toPixel } from "../benches/archery/physics.ts";
import { viewSvg } from "../benches/archery/render.ts";
import type { OkResult, ResultFile } from "../src/results.ts";
import type { BenchRunner } from "../src/bench.ts";
import type {
  ArcheryRow,
  DashRow,
  Featured,
  LogRow,
  SiteData,
  SightView,
  StripArrow,
} from "../site/src/site-data.ts";

// The hand-written part of the page: site/content/notes.json.
// Strict, so a misspelled key fails the build instead of being ignored.
export const notesSchema = z.strictObject({
  featured: z.string().default("openai/gpt-6.2-astra"),
  figureArrow: z.strictObject({ round: z.int(), arrow: z.int() }).default({ round: 2, arrow: 4 }),
  headline: z.string().min(1),
  take: z.string().min(1).nullable(),
  quotes: z.array(z.strictObject({ text: z.string().min(1), who: z.string().min(1) })),
});

export type Notes = z.infer<typeof notesSchema>;

// Re-scores each result with its benchmark's current code and keeps only results with answers,
// so a stale summary or a run where every case failed never reaches the page.
export function prepareResults(results: readonly ResultFile[], runners: Record<string, BenchRunner>): OkResult[] {
  return results.flatMap((file) => {
    const runner = runners[file.bench];
    if (file.status !== "ok" || !runner || !runner.hasAnswers(file)) return [];
    return [runner.rescore(file)];
  });
}

// A model tested later than this after OpenRouter listed it was a backfill, not a release-day run.
const BACKFILL_HOURS = 48;

// "anthropic/claude-fable-5.2" becomes "Claude Fable 5.2". "gpt" joins the part after it: "GPT-6.2".
export function displayName(id: string): string {
  const slug = id.split("/").at(-1) ?? id;
  const queue = slug.split("-");
  const words: string[] = [];
  for (let part = queue.shift(); part !== undefined; part = queue.shift()) {
    if (part === "gpt") {
      const version = queue.shift();
      words.push(version === undefined ? "GPT" : `GPT-${version}`);
    } else {
      words.push(part.charAt(0).toUpperCase() + part.slice(1));
    }
  }
  return words.join(" ");
}

// Scores that look equal on the page share a rank. Rows must already be sorted, so equal scores sit together.
// Ties are "T1", "T1", then "3".
export function tieRanks(sortedValues: readonly number[]): string[] {
  const shown = sortedValues.map((v) => v.toFixed(1));
  return shown.map((value) => {
    const tied = shown.filter((v) => v === value).length > 1;
    return `${tied ? "T" : ""}${shown.indexOf(value) + 1}`;
  });
}

// A model that refuses more than half its arrows is not ranked.
export function isDisqualified(noAimArrows: number, totalArrows: number): boolean {
  return noAimArrows * 2 > totalArrows;
}

// The strip colors arrows by tier. Lightness tells the tiers apart on the page.
export function stripTier(score: number, noAim: boolean): StripArrow["tier"] {
  if (noAim) return "refused";
  if (score >= 9) return "high";
  if (score >= 5) return "mid";
  if (score >= 1) return "low";
  return "zero";
}

export function hoursBetween(from: string, to: string): number {
  return Math.round(((Date.parse(to) - Date.parse(from)) / 3_600_000) * 10) / 10;
}

const day = (iso: string) => iso.slice(0, 10);

function okResults(results: readonly ResultFile[], bench: string): OkResult[] {
  return results.filter((r): r is OkResult => r.status === "ok" && r.bench === bench);
}

// Replays the saved answers of every scored round, in round order.
function archeryShots(file: OkResult) {
  return ROUNDS.flatMap((round, index) => {
    const result = file.cases.find((c) => c.id === round.id);
    if (!result || result.error !== undefined) return [];
    return shots(round, result.turns.map((t) => t.output)).map((shot) => ({ round: index + 1, shot }));
  });
}

const byScore = (a: { scorePct: number; name: string }, b: { scorePct: number; name: string }) =>
  b.scorePct - a.scorePct || a.name.localeCompare(b.name);

function archeryRows(results: readonly ResultFile[]): ArcheryRow[] {
  const rows = okResults(results, "archery").flatMap((file): Omit<ArcheryRow, "rank">[] => {
    const scorePct = file.summary.scorePct;
    if (scorePct === undefined) return [];
    const all = archeryShots(file);
    const noAimArrows = all.filter((s) => !s.shot.aim).length;
    return [
      {
        model: file.model,
        name: displayName(file.model),
        scorePct,
        noAimArrows,
        totalArrows: all.length,
        dq: isDisqualified(noAimArrows, all.length),
      },
    ];
  });
  const ranked = rows.filter((r) => !r.dq).toSorted(byScore);
  const ranks = tieRanks(ranked.map((r) => r.scorePct));
  return [
    ...ranked.map((r, i) => ({ ...r, rank: ranks[i] ?? null })),
    ...rows.filter((r) => r.dq).toSorted(byScore).map((r) => ({ ...r, rank: null })),
  ];
}

// A model needs both numbers to appear. A result with no answered case has neither.
function dashRows(results: readonly ResultFile[]): DashRow[] {
  const rows = okResults(results, "dash").flatMap((file) => {
    const { habitPer1k, obeyedPct } = file.summary;
    if (habitPer1k === undefined || obeyedPct === undefined) return [];
    return [{ model: file.model, name: displayName(file.model), habitPer1k, obeyedPct }];
  });
  const sorted = rows.toSorted((a, b) => a.habitPer1k - b.habitPer1k || a.name.localeCompare(b.name));
  const ranks = tieRanks(sorted.map((r) => r.habitPer1k));
  return sorted.map((r, i) => ({ ...r, rank: ranks[i] ?? "" }));
}

// Only models that appear in a results table are logged, so a run with no answers is left out.
function logRows(results: readonly ResultFile[], tested: ReadonlySet<string>): LogRow[] {
  const okOnly = results.filter((r): r is OkResult => r.status === "ok" && tested.has(r.model));
  const models = [...new Set(okOnly.map((r) => r.model))];
  return models
    .map((model) => {
      const own = okOnly.filter((r) => r.model === model);
      const listedAt = own.map((r) => r.listedAt).toSorted()[0] ?? "";
      const testedAt = own.map((r) => r.ranAt).toSorted()[0] ?? "";
      const hours = hoursBetween(listedAt, testedAt);
      return {
        listed: listedAt,
        row: {
          model,
          name: displayName(model),
          listedAt: day(listedAt),
          testedAt: day(testedAt),
          hoursAfterListing: hours > BACKFILL_HOURS ? null : hours,
        },
      };
    })
    .toSorted((a, b) => b.listed.localeCompare(a.listed))
    .map((r) => r.row);
}

function windPhrase(wind: number): string {
  if (wind === 0) return "no wind";
  return `wind ${Math.abs(wind)} m/s blowing ${wind < 0 ? "left" : "right"}`;
}

function featuredFigure(file: OkResult, figureArrow: Notes["figureArrow"]): Featured["figure"] {
  const all = archeryShots(file);
  const strip = all.map(({ round, shot }): StripArrow => ({
    round,
    arrow: shot.n,
    distance: shot.conditions.distance,
    wind: shot.conditions.wind,
    score: shot.score,
    noAim: !shot.aim,
    tier: stripTier(shot.score, !shot.aim),
  }));
  const target = all.find((s) => s.round === figureArrow.round && s.shot.n === figureArrow.arrow);
  const where = `Round ${figureArrow.round}, arrow ${figureArrow.arrow} (figureArrow in site/content/notes.json)`;
  if (!target) throw new Error(`${where} is not one of ${file.model}'s ${all.length} scored arrows.`);
  const { aim, hit, conditions, score } = target.shot;
  if (!aim || !hit) throw new Error(`${where} has no readable aim to draw for ${file.model}. Pick another arrow.`);
  const view: SightView = {
    round: figureArrow.round,
    arrow: figureArrow.arrow,
    svg: viewSvg(conditions),
    aim,
    landing: toPixel(hit, conditions.distance),
    caption:
      `Round ${figureArrow.round}, arrow ${figureArrow.arrow}: ${conditions.distance} m, ${windPhrase(conditions.wind)}. ` +
      `Aimed at (${Math.round(aim.x)}, ${Math.round(aim.y)}), scored ${score}.`,
  };
  return { strip, view };
}

function featuredModel(results: readonly ResultFile[], notes: Notes): Featured {
  const own = results.filter((r): r is OkResult => r.status === "ok" && r.model === notes.featured);
  const archery = own.find((r) => r.bench === "archery");
  const listedAt = own.map((r) => r.listedAt).toSorted()[0];
  const testedAt = own.map((r) => r.ranAt).toSorted()[0];
  if (!archery || listedAt === undefined || testedAt === undefined) {
    throw new Error(`The featured model ${notes.featured} (featured in site/content/notes.json) has no archery result with answers.`);
  }
  return {
    model: notes.featured,
    name: displayName(notes.featured),
    listedAt,
    testedAt,
    hoursAfterListing: hoursBetween(listedAt, testedAt),
    headline: notes.headline,
    take: notes.take,
    quotes: notes.quotes,
    figure: featuredFigure(archery, notes.figureArrow),
  };
}

export function buildSiteData(results: readonly ResultFile[], notes: Notes, generatedAt: string): SiteData {
  const archery = archeryRows(results);
  const dash = dashRows(results);
  const tested = new Set([...archery, ...dash].map((r) => r.model));
  return { generatedAt, featured: featuredModel(results, notes), archery, dash, log: logRows(results, tested) };
}
