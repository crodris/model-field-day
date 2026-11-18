import { z } from "zod";
import { defineBench, type Bench } from "../../src/bench.ts";
import { IMAGE, ring, shoot, type Hit, type Pixel } from "./physics.ts";
import { renderView } from "./render.ts";

// One end is 6 arrows at one distance. The wind changes before every arrow and shows
// only on the flag, so copying the last correction does not work. The model has to
// learn how this bow drops and drifts, then read each new wind from the flag.
export type End = { id: string; distance: number; winds: readonly number[] };

export const ENDS: readonly End[] = [
  { id: "30m", distance: 30, winds: [0, 3, -2, 5, 1, -4] },
  { id: "40m", distance: 40, winds: [-4, -1, -5, 2, -3, 0] },
  { id: "50m", distance: 50, winds: [2, -3, 4, 0, -5, 1] },
  { id: "70m", distance: 70, winds: [5, 1, -2, 4, -4, 3] },
];

type Shot = { n: number; aim: Pixel | null; hit: Hit | null; score: number };

const aimSchema = z.object({ x: z.number(), y: z.number() });

// Models often wrap JSON in prose or code fences, so take the first {...} that parses.
export function parseAim(output: string): Pixel | null {
  for (const match of output.matchAll(/\{[^{}]*\}/g)) {
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
export function shots(end: End, outputs: readonly string[]): Shot[] {
  return outputs.map((output, i) => {
    const aim = parseAim(output);
    const wind = end.winds[i] ?? 0;
    const hit = aim ? shoot({ distance: end.distance, wind }, aim) : null;
    return { n: i + 1, aim, hit, score: hit ? ring(hit) : 0 };
  });
}

const ASK = `Reply with only JSON: {"x": <pixels from the left>, "y": <pixels from the top>}`;

function prompt(end: End, done: readonly Shot[]): string {
  const n = done.length + 1;
  const last = done.at(-1);
  if (!last) {
    return [
      `You are competing in target archery. The image is your view through the bow sight, ${IMAGE.width} by ${IMAGE.height} pixels.`,
      "The sign under the target shows the distance. The orange flag next to the target shows the wind.",
      "An arrow leaves along your aim point. Then gravity pulls it down and the wind pushes it sideways.",
      `You shoot ${end.winds.length} arrows. The wind changes before every arrow, so check the flag each time.`,
      "An arrow scores 10 in the center gold ring, down to 1 in the outer white ring, and 0 for a miss.",
      `Where on the image do you aim arrow 1? ${ASK}`,
    ].join("\n");
  }
  const result = last.aim
    ? `Arrow ${last.n} scored ${last.score}. The dot labeled ${last.n} shows where it landed.`
    : `Your answer could not be read, so arrow ${last.n} counted as a miss.`;
  return `${result}\nThe wind has changed. Where on the image do you aim arrow ${n}? ${ASK}`;
}

export const archery: Bench<End> = {
  id: "archery",
  input: "image",
  cases: ENDS,
  turn: (end, outputs) => {
    const wind = end.winds[outputs.length];
    if (wind === undefined) return null;
    const done = shots(end, outputs);
    const marks = done.flatMap((s) => (s.hit ? [{ n: s.n, hit: s.hit }] : []));
    return { text: prompt(end, done), image: renderView({ distance: end.distance, wind }, marks) };
  },
  score: (end, outputs) => {
    const scores = shots(end, outputs).map((s) => s.score);
    return { total: scores.reduce((a, b) => a + b, 0), ...Object.fromEntries(scores.map((s, i) => [`arrow${i + 1}`, s])) };
  },
  summarize: (scored): Record<string, number> => {
    if (scored.length === 0) return {};
    const mean = (key: string) => scored.reduce((sum, s) => sum + (s.values[key] ?? 0), 0) / scored.length;
    const arrows = scored[0]?.case.winds.length ?? 0;
    return {
      scorePct: (mean("total") / (arrows * 10)) * 100,
      firstArrow: mean("arrow1"),
      lastThree: (mean("arrow4") + mean("arrow5") + mean("arrow6")) / 3,
    };
  },
};

export const archeryRunner = defineBench(archery);
