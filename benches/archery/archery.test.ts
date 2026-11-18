import { describe, expect, it } from "vitest";
import { archery, parseAim, ROUNDS, shots, spot, type Round } from "./index.ts";
import { FOCAL_PX, IMAGE, ring, shoot, type Conditions, type Pixel } from "./physics.ts";

const CENTER: Pixel = { x: IMAGE.width / 2, y: IMAGE.height / 2 };

// Corrects the aim by where the last arrow landed, the way a good archer would.
function perfectAim(conditions: Conditions): Pixel {
  let aim = CENTER;
  for (let i = 0; i < 30; i++) {
    const hit = shoot(conditions, aim);
    aim = {
      x: aim.x - (FOCAL_PX * hit.x) / conditions.distance,
      y: aim.y + (FOCAL_PX * hit.y) / conditions.distance,
    };
  }
  return aim;
}

const dropPx = (distance: number) => (FOCAL_PX * -shoot({ distance, wind: 0 }, CENTER).y) / distance;

const perfectAnswers = (round: Round) => round.arrows.map((c) => JSON.stringify(perfectAim(c)));

function firstRound(): Round {
  const round = ROUNDS[0];
  if (!round) throw new Error("no rounds");
  return round;
}

describe("archery physics", () => {
  it("scores rings from 10 at the center to 1 at the edge, and 0 just outside", () => {
    expect(ring({ x: 0, y: 0 })).toBe(10);
    expect(ring({ x: 0.6, y: 0 })).toBe(1);
    expect(ring({ x: 0.65, y: 0 })).toBe(0);
  });

  it("lets a perfect aim score 10 on every arrow, inside the image", () => {
    for (const round of ROUNDS) {
      for (const conditions of round.arrows) {
        const aim = perfectAim(conditions);
        expect(ring(shoot(conditions, aim))).toBe(10);
        expect(aim.x).toBeGreaterThan(0);
        expect(aim.x).toBeLessThan(IMAGE.width);
        expect(aim.y).toBeGreaterThan(0);
      }
    }
  });

  it("drops an arrow aimed at the center below the gold, and wind pushes it downwind", () => {
    const calm = shoot({ distance: 30, wind: 0 }, CENTER);
    expect(calm.y).toBeLessThan(0);
    expect(ring(calm)).toBeLessThan(9);
    expect(shoot({ distance: 30, wind: 5 }, CENTER).x).toBeGreaterThan(0);
    expect(shoot({ distance: 30, wind: -5 }, CENTER).x).toBeLessThan(0);
  });

  it("makes the drop in pixels grow faster than the distance, because of drag", () => {
    expect(dropPx(80) / dropPx(20)).toBeGreaterThan(4.3);
  });
});

describe("archery bench", () => {
  it("reads aim JSON from prose and code fences, and rejects junk", () => {
    expect(parseAim('I will aim high. ```json\n{"x": 500, "y": 250}\n```')).toEqual({ x: 500, y: 250 });
    expect(parseAim('{not json} then {"x": 1, "y": 2}')).toEqual({ x: 1, y: 2 });
    expect(parseAim('{"x": "left", "y": 2}')).toBeNull();
    expect(parseAim('The center is {"x": 512, "y": 384}; I aim at {"x": 512, "y": 300}')).toEqual({ x: 512, y: 300 });
  });

  it("calls out where an arrow landed in centimeters", () => {
    expect(spot({ x: -0.123, y: 0.4 })).toBe("It landed 40 cm high and 12 cm left of the center.");
  });

  it("asks for one arrow per condition with an image each, then stops", () => {
    const round = firstRound();
    const answers = perfectAnswers(round);
    expect(archery.turn(round, [])?.image?.length).toBeGreaterThan(1000);
    expect(archery.turn(round, answers.slice(0, 1))?.text).toContain("Arrow 1 at 20 m scored 10. It landed 0 cm");
    expect(archery.turn(round, answers)).toBeNull();
  });

  it("uses each arrow's own distance and wind, so repeating the last good aim misses", () => {
    const round = firstRound();
    const [first = ""] = perfectAnswers(round);
    const scores = shots(round, Array(round.arrows.length).fill(first)).map((s) => s.score);
    expect(scores).toEqual([10, 0, 0, 7, 0, 0]);
  });

  it("scores each arrow, and counts an unreadable answer as a miss with no aim", () => {
    const round = firstRound();
    const outputs = ["no idea", ...perfectAnswers(round).slice(1)];
    expect(shots(round, outputs).map((s) => s.score)).toEqual([0, 10, 10, 10, 10, 10]);
    expect(archery.score(round, outputs)).toMatchObject({ total: 50, noAim: 1 });
  });
});
