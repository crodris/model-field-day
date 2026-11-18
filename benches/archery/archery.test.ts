import { describe, expect, it } from "vitest";
import { archery, ENDS, parseAim, shots } from "./index.ts";
import { FOCAL_PX, IMAGE, ring, shoot, type End, type Pixel } from "./physics.ts";

const CENTER: Pixel = { x: IMAGE.width / 2, y: IMAGE.height / 2 };

// Corrects the aim by where the last arrow landed, the way a good archer would.
function perfectAim(end: End): Pixel {
  let aim = CENTER;
  for (let i = 0; i < 30; i++) {
    const hit = shoot(end, aim);
    aim = { x: aim.x - (FOCAL_PX * hit.x) / end.distance, y: aim.y + (FOCAL_PX * hit.y) / end.distance };
  }
  return aim;
}

const answer = (aim: Pixel) => JSON.stringify(aim);

describe("archery physics", () => {
  it("scores rings from 10 at the center to 1 at the edge, and 0 just outside", () => {
    expect(ring({ x: 0, y: 0 })).toBe(10);
    expect(ring({ x: 0.6, y: 0 })).toBe(1);
    expect(ring({ x: 0.65, y: 0 })).toBe(0);
  });

  it("lets a perfect aim score 10 on every end, inside the image", () => {
    for (const end of ENDS) {
      const aim = perfectAim(end);
      expect(ring(shoot(end, aim))).toBe(10);
      expect(aim.x).toBeGreaterThan(0);
      expect(aim.x).toBeLessThan(IMAGE.width);
      expect(aim.y).toBeGreaterThan(0);
    }
  });

  it("drops an arrow aimed at the center below the gold, and wind pushes it downwind", () => {
    const calm = shoot({ id: "c", distance: 30, wind: 0 }, CENTER);
    expect(calm.y).toBeLessThan(0);
    expect(ring(calm)).toBeLessThan(9);
    expect(shoot({ id: "r", distance: 30, wind: 5 }, CENTER).x).toBeGreaterThan(0);
    expect(shoot({ id: "l", distance: 30, wind: -5 }, CENTER).x).toBeLessThan(0);
    expect(ring(shoot({ id: "far", distance: 70, wind: 5 }, CENTER))).toBe(0);
  });
});

describe("archery bench", () => {
  it("reads aim JSON from prose and code fences, and rejects junk", () => {
    expect(parseAim('I will aim high. ```json\n{"x": 500, "y": 250}\n```')).toEqual({ x: 500, y: 250 });
    expect(parseAim("{not json} then {\"x\": 1, \"y\": 2}")).toEqual({ x: 1, y: 2 });
    expect(parseAim('{"x": "left", "y": 2}')).toBeNull();
  });

  it("asks for 6 arrows with an image each, then stops", () => {
    const end = ENDS[0];
    if (!end) throw new Error("no ends");
    const first = archery.turn(end, []);
    expect(first?.image?.length).toBeGreaterThan(1000);
    const afterOne = archery.turn(end, [answer(CENTER)]);
    expect(afterOne?.text).toContain("Arrow 1: you aimed at (512, 384).");
    expect(archery.turn(end, Array(6).fill(answer(CENTER)))).toBeNull();
  });

  it("scores each arrow and counts an unreadable answer as a miss", () => {
    const end = ENDS[3];
    if (!end) throw new Error("no ends");
    const outputs = [answer(CENTER), "no idea", ...Array(4).fill(answer(perfectAim(end)))];
    expect(shots(end, outputs).map((s) => s.score)).toEqual([0, 0, 10, 10, 10, 10]);
    expect(archery.score(end, outputs).total).toBe(40);
  });
});
