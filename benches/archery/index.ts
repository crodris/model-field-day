import { z } from "zod";
import { defineBench, type Bench } from "../../src/bench.ts";
import { IMAGE, ring, shoot, type Conditions, type Hit, type Pixel } from "./physics.ts";
import { renderView } from "./render.ts";

// One round is 6 arrows, each at its own distance and wind. The distance shows on a
// sign and the wind only on the flag. After each arrow a spotter says where it landed.
// Drag makes the drop grow faster than the distance, so the model has to learn the
// bow's behavior across distances instead of copying its last correction.
export type Round = { id: string; arrows: readonly Conditions[] };

const arrows = (pairs: readonly [distance: number, wind: number][]) =>
  pairs.map(([distance, wind]) => ({ distance, wind }));

export const ROUNDS: readonly Round[] = [
  { id: "round-1", arrows: arrows([[20, 0], [45, 2], [70, -3], [30, 4], [80, 1], [55, -5]]) },
  { id: "round-2", arrows: arrows([[60, -2], [25, 5], [75, 3], [40, -4], [50, 0], [35, 2]]) },
  { id: "round-3", arrows: arrows([[80, 4], [30, -1], [55, 3], [70, -5], [20, 2], [65, 0]]) },
  { id: "round-4", arrows: arrows([[45, -3], [75, 5], [35, 0], [60, 1], [80, -4], [25, -2]]) },
];

type Shot = { n: number; conditions: Conditions; aim: Pixel | null; hit: Hit | null; score: number };

const aimSchema = z.object({ x: z.number(), y: z.number() });

// Models often wrap JSON in prose or code fences, or name a point before their final aim,
// so take the last {...} that parses.
export function parseAim(output: string): Pixel | null {
  for (const match of [...output.matchAll(/\{[^{}]*\}/g)].toReversed()) {
    try {
      const parsed = aimSchema.safeParse(JSON.parse(match[0]));
      if (parsed.success) return parsed.data;
    } catch {
      // Not JSON. Try the next match.
    }
  }
  return null;
}

// Replays every arrow from the saved answers. Both the next prompt and the score use it.
export function shots(round: Round, outputs: readonly string[]): Shot[] {
  return outputs.flatMap((output, i) => {
    const conditions = round.arrows[i];
    if (!conditions) return [];
    const aim = parseAim(output);
    const hit = aim ? shoot(conditions, aim) : null;
    return [{ n: i + 1, conditions, aim, hit, score: hit ? ring(hit) : 0 }];
  });
}

const cm = (meters: number) => Math.round(Math.abs(meters) * 100);

// What a spotter would call out, in whole centimeters from the target center.
export function spot(hit: Hit): string {
  const up = hit.y >= 0 ? "high" : "low";
  const side = hit.x >= 0 ? "right" : "left";
  return `It landed ${cm(hit.y)} cm ${up} and ${cm(hit.x)} cm ${side} of the center.`;
}

const ASK = `Reply with only JSON: {"x": <pixels from the left>, "y": <pixels from the top>}`;

function prompt(round: Round, done: readonly Shot[]): string {
  const n = done.length + 1;
  const last = done.at(-1);
  if (!last) {
    return [
      `You are competing in target archery. The image is your view through the bow sight, ${IMAGE.width} by ${IMAGE.height} pixels.`,
      "The sign under the target shows the distance. The orange flag next to the target shows the wind.",
      "An arrow leaves along your aim point and slows down in flight. Gravity pulls it down and the wind pushes it sideways.",
      `You shoot ${round.arrows.length} arrows. The distance and the wind change before every arrow.`,
      "After each arrow, a spotter tells you where it landed.",
      "An arrow scores 10 in the center gold ring, down to 1 in the outer white ring, and 0 for a miss.",
      `Where on the image do you aim arrow 1? ${ASK}`,
    ].join("\n");
  }
  const result = last.hit
    ? `Arrow ${last.n} at ${last.conditions.distance} m scored ${last.score}. ${spot(last.hit)}`
    : `Your answer could not be read, so arrow ${last.n} counted as a miss.`;
  return `${result}\nThe distance and the wind have changed. Where on the image do you aim arrow ${n}? ${ASK}`;
}

export const archery: Bench<Round> = {
  id: "archery",
  input: "image",
  cases: ROUNDS,
  turn: (round, outputs) => {
    const conditions = round.arrows[outputs.length];
    if (!conditions) return null;
    return { text: prompt(round, shots(round, outputs)), image: renderView(conditions) };
  },
  score: (round, outputs) => {
    const done = shots(round, outputs);
    const scores = done.map((s) => s.score);
    return {
      total: scores.reduce((a, b) => a + b, 0),
      noAim: done.filter((s) => !s.aim).length,
      ...Object.fromEntries(scores.map((s, i) => [`arrow${i + 1}`, s])),
    };
  },
  summarize: (scored): Record<string, number> => {
    if (scored.length === 0) return {};
    const mean = (key: string) => scored.reduce((sum, s) => sum + (s.values[key] ?? 0), 0) / scored.length;
    const perRound = scored[0]?.case.arrows.length ?? 0;
    return {
      scorePct: (mean("total") / (perRound * 10)) * 100,
      firstArrow: mean("arrow1"),
      lastThree: (mean("arrow4") + mean("arrow5") + mean("arrow6")) / 3,
      // Arrows with no readable aim, such as a refusal. They score 0, and this shows why.
      noAimPct: (mean("noAim") / perRound) * 100,
    };
  },
};

export const archeryRunner = defineBench(archery);
