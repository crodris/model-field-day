import { z } from "zod";
import { defineBench, type Bench } from "../../src/bench.ts";
import { IMAGE, ring, shoot, type End, type Hit, type Pixel } from "./physics.ts";
import { renderView } from "./render.ts";

export const ARROWS_PER_END = 6;

export const ENDS: readonly End[] = [
  { id: "30m-calm", distance: 30, wind: 0 },
  { id: "40m-left-6", distance: 40, wind: -6 },
  { id: "50m-left-3", distance: 50, wind: -3 },
  { id: "70m-right-5", distance: 70, wind: 5 },
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
    const hit = aim ? shoot(end, aim) : null;
    return { n: i + 1, aim, hit, score: hit ? ring(hit) : 0 };
  });
}

function prompt(shotsSoFar: readonly Shot[]): string {
  const history = shotsSoFar.map((s) =>
    s.aim
      ? `Arrow ${s.n}: you aimed at (${Math.round(s.aim.x)}, ${Math.round(s.aim.y)}). It scored ${s.score}.`
      : `Arrow ${s.n}: your answer could not be read, so it counted as a miss.`,
  );
  return [
    `You are competing in target archery. The image is your view through the bow sight, ${IMAGE.width} by ${IMAGE.height} pixels.`,
    "The sign under the target shows the distance. The orange flag next to the target shows the wind.",
    "An arrow leaves along your aim point. Then gravity pulls it down and the wind pushes it sideways, and both effects grow with distance.",
    `This end has ${ARROWS_PER_END} arrows. An arrow scores 10 in the center gold ring, down to 1 in the outer white ring, and 0 for a miss.`,
    ...(history.length > 0 ? ["Numbered dots on the image show where your earlier arrows landed.", ...history] : []),
    `Where on the image do you aim arrow ${shotsSoFar.length + 1}? Reply with only JSON: {"x": <pixels from the left>, "y": <pixels from the top>}`,
  ].join("\n");
}

export const archery: Bench<End> = {
  id: "archery",
  input: "image",
  cases: ENDS,
  turn: (end, outputs) => {
    if (outputs.length >= ARROWS_PER_END) return null;
    const done = shots(end, outputs);
    const marks = done.flatMap((s) => (s.hit ? [{ n: s.n, hit: s.hit }] : []));
    return { text: prompt(done), image: renderView(end, marks) };
  },
  score: (end, outputs) => {
    const scores = shots(end, outputs).map((s) => s.score);
    return { total: scores.reduce((a, b) => a + b, 0), ...Object.fromEntries(scores.map((s, i) => [`arrow${i + 1}`, s])) };
  },
  summarize: (scored): Record<string, number> => {
    if (scored.length === 0) return {};
    const mean = (key: string) => scored.reduce((sum, s) => sum + (s.values[key] ?? 0), 0) / scored.length;
    return {
      scorePct: (mean("total") / (ARROWS_PER_END * 10)) * 100,
      firstArrow: mean("arrow1"),
      lastThree: (mean("arrow4") + mean("arrow5") + mean("arrow6")) / 3,
    };
  },
};

export const archeryRunner = defineBench(archery);
