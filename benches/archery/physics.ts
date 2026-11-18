// The archer looks through a sight with a narrow field of view. The eye and the
// target center are at the same height, so the target center is the image center.
// An arrow leaves along the aim line, gravity pulls it down, and the wind pushes it
// sideways. Nothing is random, so the same aim always lands in the same place.

export const IMAGE = { width: 1024, height: 768 } as const;
const CENTER = { x: IMAGE.width / 2, y: IMAGE.height / 2 };
const FIELD_OF_VIEW_DEG = 10;
export const FOCAL_PX = IMAGE.width / 2 / Math.tan(((FIELD_OF_VIEW_DEG / 2) * Math.PI) / 180);

const ARROW_SPEED = 90; // m/s
const GRAVITY = 9.81; // m/s^2
const WIND_PUSH = 0.8; // sideways acceleration in m/s^2 per m/s of wind
export const TARGET_RADIUS = 0.61; // m, a standard 122 cm face
export const EYE_HEIGHT = 1.6; // m above the ground

// wind is in m/s. Positive blows to the right.
export type End = { id: string; distance: number; wind: number };

// A point on the image, in pixels from the top left.
export type Pixel = { x: number; y: number };

// Where an arrow crosses the target plane, in meters from the target center, y up.
export type Hit = { x: number; y: number };

export function shoot(end: End, aim: Pixel): Hit {
  const yaw = Math.atan((aim.x - CENTER.x) / FOCAL_PX);
  const pitch = Math.atan((CENTER.y - aim.y) / FOCAL_PX);
  const time = end.distance / (ARROW_SPEED * Math.cos(pitch) * Math.cos(yaw));
  return {
    x: end.distance * Math.tan(yaw) + (WIND_PUSH * end.wind * time * time) / 2,
    y: end.distance * Math.tan(pitch) - (GRAVITY * time * time) / 2,
  };
}

export function toPixel(point: Hit, distance: number): Pixel {
  return { x: CENTER.x + (FOCAL_PX * point.x) / distance, y: CENTER.y - (FOCAL_PX * point.y) / distance };
}

// 10 for the center ring down to 1 for the outer ring, 0 for a miss.
export function ring(hit: Hit): number {
  const r = Math.hypot(hit.x, hit.y);
  if (r > TARGET_RADIUS) return 0;
  return 10 - Math.min(9, Math.floor(r / (TARGET_RADIUS / 10)));
}
