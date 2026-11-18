import { Resvg } from "@resvg/resvg-js";
import { EYE_HEIGHT, IMAGE, TARGET_RADIUS, toPixel, type Conditions, type Hit } from "./physics.ts";

const RING_COLORS = ["#f5f5f0", "#f5f5f0", "#1a1a1a", "#1a1a1a", "#2f7fd6", "#2f7fd6", "#e0342b", "#e0342b", "#f6c813", "#f6c813"];
const FLAG_POLE_X = 2; // m right of the target center
const FLAG_POLE_TOP = 1.2; // m above the target center, low enough to stay in view at 30 m
const FLAG_LENGTH = 1.2; // m

export type Mark = { n: number; hit: Hit };

// Draws the archer's view: sky, grass, the target on its stand, a distance sign,
// a flag whose angle shows the wind, and numbered dots where earlier arrows landed.
export function renderView(end: Conditions, marks: readonly Mark[]): Uint8Array {
  return new Resvg(viewSvg(end, marks), { font: { loadSystemFonts: true, defaultFontFamily: "Helvetica" } })
    .render()
    .asPng();
}

export function viewSvg(end: Conditions, marks: readonly Mark[]): string {
  const { width, height } = IMAGE;
  const px = (x: number, y: number) => toPixel({ x, y }, end.distance);
  const scale = px(1, 0).x - px(0, 0).x; // pixels per meter at the target
  const center = px(0, 0);
  const ground = px(0, -EYE_HEIGHT).y;

  const rings = RING_COLORS.map((color, i) => {
    const r = TARGET_RADIUS * (1 - i / 10) * scale;
    const stroke = i === 2 ? "#f5f5f0" : "#1a1a1a";
    return `<circle cx="${center.x}" cy="${center.y}" r="${r}" fill="${color}" stroke="${stroke}" stroke-width="${Math.max(0.5, scale * 0.004)}"/>`;
  }).join("");

  const frame = TARGET_RADIUS * 1.15 * scale;
  const legTop = center.y + frame;
  const stand = [
    `<line x1="${center.x - frame * 0.6}" y1="${legTop}" x2="${center.x - frame * 0.8}" y2="${ground}" stroke="#7a5230" stroke-width="${scale * 0.08}"/>`,
    `<line x1="${center.x + frame * 0.6}" y1="${legTop}" x2="${center.x + frame * 0.8}" y2="${ground}" stroke="#7a5230" stroke-width="${scale * 0.08}"/>`,
    `<rect x="${center.x - frame}" y="${center.y - frame}" width="${frame * 2}" height="${frame * 2}" fill="#c9a66b" stroke="#7a5230" stroke-width="${scale * 0.04}"/>`,
  ].join("");

  const signTop = px(-0.7, -EYE_HEIGHT + 0.55);
  const sign = [
    `<rect x="${signTop.x}" y="${signTop.y}" width="${1.4 * scale}" height="${0.5 * scale}" fill="#ffffff" stroke="#333" stroke-width="${scale * 0.02}"/>`,
    `<text x="${center.x}" y="${signTop.y + 0.38 * scale}" font-size="${0.34 * scale}" font-weight="bold" text-anchor="middle" fill="#111">${end.distance} m</text>`,
  ].join("");

  // The flag hangs almost straight down in calm air and lifts toward the downwind side as the wind grows.
  const angle = (Math.min(80, Math.max(6, Math.abs(end.wind) * 14)) * Math.PI) / 180;
  const side = end.wind < 0 ? -1 : 1;
  const top = px(FLAG_POLE_X, FLAG_POLE_TOP);
  const hoist = px(FLAG_POLE_X, FLAG_POLE_TOP - 0.4);
  const mid = FLAG_POLE_TOP - 0.2;
  const tip = px(FLAG_POLE_X + side * Math.sin(angle) * FLAG_LENGTH, mid - Math.cos(angle) * FLAG_LENGTH);
  const flag = [
    `<line x1="${top.x}" y1="${top.y}" x2="${top.x}" y2="${ground}" stroke="#555" stroke-width="${scale * 0.05}"/>`,
    `<polygon points="${top.x},${top.y} ${hoist.x},${hoist.y} ${tip.x},${tip.y}" fill="#ff6a00" stroke="#a33f00" stroke-width="${scale * 0.015}"/>`,
  ].join("");

  const dots = marks
    .map(({ n, hit }) => {
      const p = toPixel(hit, end.distance);
      const x = Math.min(width - 12, Math.max(12, p.x));
      const y = Math.min(height - 12, Math.max(12, p.y));
      return `<circle cx="${x}" cy="${y}" r="6" fill="#111" stroke="#fff" stroke-width="2"/><text x="${x + 9}" y="${y - 7}" font-size="16" font-weight="bold" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${n}</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fa8dc"/><stop offset="1" stop-color="#d6e9f8"/></linearGradient></defs>
<rect width="${width}" height="${height}" fill="url(#sky)"/>
<rect y="${center.y}" width="${width}" height="${height - center.y}" fill="#5b8f3a"/>
${stand}${rings}${sign}${flag}${dots}
</svg>`;
}
