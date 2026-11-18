import { describe, expect, it } from "vitest";
import { archery, ENDS, parseAim, shots, type End } from "./index.ts";
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

const perfectAnswers = (end: End) => end.winds.map((wind) => JSON.stringify(perfectAim({ distance: end.distance, wind })));

function longestEnd(): End {
  const end = ENDS.at(-1);
  if (!end) throw new Error("no ends");
  return end;
}

describe("archery physics", () => {
  it("scores rings from 10 at the center to 1 at the edge, and 0 just outside", () => {
    expect(ring({ x: 0, y: 0 })).toBe(10);
    expect(ring({ x: 0.6, y: 0 })).toBe(1);
    expect(ring({ x: 0.65, y: 0 })).toBe(0);
  });

  it("lets a perfect aim score 10 on every arrow, inside the image", () => {
    for (const end of ENDS) {
      for (const wind of end.winds) {
        const aim = perfectAim({ distance: end.distance, wind });
        expect(ring(shoot({ distance: end.distance, wind }, aim))).toBe(10);
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
    expect(ring(shoot({ distance: 70, wind: 5 }, CENTER))).toBe(0);
  });
});

describe("archery bench", () => {
  it("reads aim JSON from prose and code fences, and rejects junk", () => {
    expect(parseAim('I will aim high. ```json\n{"x": 500, "y": 250}\n```')).toEqual({ x: 500, y: 250 });
    expect(parseAim('{not json} then {"x": 1, "y": 2}')).toEqual({ x: 1, y: 2 });
    expect(parseAim('{"x": "left", "y": 2}')).toBeNull();
  });

  it("asks for one arrow per wind with an image each, then stops", () => {
    const end = longestEnd();
    const answers = perfectAnswers(end);
    expect(archery.turn(end, [])?.image?.length).toBeGreaterThan(1000);
    expect(archery.turn(end, answers.slice(0, 1))?.text).toContain("Arrow 1 scored 10.");
    expect(archery.turn(end, answers)).toBeNull();
  });

  it("uses each arrow's own wind, so repeating the last good aim misses when the wind changes", () => {
    const end = longestEnd();
    const [first = ""] = perfectAnswers(end);
    expect(shots(end, Array(end.winds.length).fill(first)).map((s) => s.score)).toEqual([10, 0, 0, 7, 0, 3]);
  });

  it("scores each arrow and counts an unreadable answer as a miss", () => {
    const end = longestEnd();
    const outputs = ["no idea", ...perfectAnswers(end).slice(1)];
    expect(shots(end, outputs).map((s) => s.score)).toEqual([0, 10, 10, 10, 10, 10]);
    expect(archery.score(end, outputs).total).toBe(50);
  });
});
