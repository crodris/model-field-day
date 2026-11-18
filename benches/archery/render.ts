import { Resvg } from "@resvg/resvg-js";
import { EYE_HEIGHT, IMAGE, TARGET_RADIUS, toPixel, type Conditions } from "./physics.ts";

const RING_COLORS = ["#f5f5f0", "#f5f5f0", "#1a1a1a", "#1a1a1a", "#2f7fd6", "#2f7fd6", "#e0342b", "#e0342b", "#f6c813", "#f6c813"];
// The flag is drawn at a fixed spot and size on screen, like a game's wind indicator,
// so it reads the same at every distance and never covers the target.
const FLAG = { x: 900, top: 140, bottom: 620, hoist: 44, length: 110 };

// Draws the archer's view: sky, grass, the target on its stand, a distance sign,
// and a flag whose angle shows the wind.
export function renderView(conditions: Conditions): Uint8Array {
  return new Resvg(viewSvg(conditions), { font: { loadSystemFonts: true, defaultFontFamily: "Helvetica" } })
    .render()
    .asPng();
}

export function viewSvg(conditions: Conditions): string {
  const { width, height } = IMAGE;
  const px = (x: number, y: number) => toPixel({ x, y }, conditions.distance);
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

  // The sign hangs just under the target face, so it stays in view at 20 m.
  const signTop = px(-0.7, -frame / scale - 0.04);
  const sign = [
    `<rect x="${signTop.x}" y="${signTop.y}" width="${1.4 * scale}" height="${0.36 * scale}" fill="#ffffff" stroke="#333" stroke-width="${scale * 0.02}"/>`,
    `<text x="${center.x}" y="${signTop.y + 0.28 * scale}" font-size="${0.26 * scale}" font-weight="bold" text-anchor="middle" fill="#111">${conditions.distance} m</text>`,
  ].join("");

  // The flag hangs almost straight down in calm air and lifts toward the downwind side as the wind grows.
  const angle = (Math.min(80, Math.max(6, Math.abs(conditions.wind) * 14)) * Math.PI) / 180;
  const side = conditions.wind < 0 ? -1 : 1;
  const midY = FLAG.top + FLAG.hoist / 2;
  const tip = { x: FLAG.x + side * Math.sin(angle) * FLAG.length, y: midY + Math.cos(angle) * FLAG.length };
  const flag = [
    `<line x1="${FLAG.x}" y1="${FLAG.top}" x2="${FLAG.x}" y2="${FLAG.bottom}" stroke="#555" stroke-width="5"/>`,
    `<polygon points="${FLAG.x},${FLAG.top} ${FLAG.x},${FLAG.top + FLAG.hoist} ${tip.x},${tip.y}" fill="#ff6a00" stroke="#a33f00" stroke-width="2"/>`,
  ].join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fa8dc"/><stop offset="1" stop-color="#d6e9f8"/></linearGradient></defs>
<rect width="${width}" height="${height}" fill="url(#sky)"/>
<rect y="${center.y}" width="${width}" height="${height - center.y}" fill="#5b8f3a"/>
${stand}${rings}${sign}${flag}
</svg>`;
}
