import type { CSSProperties } from "react";
import type { Featured, StripArrow } from "../site-data.ts";

// Lightness, not hue alone, tells the tiers apart: R is darkest, then 9 to 10, 5 to 8, 1 to 4, and 0 is white.
const TIERS: Record<StripArrow["tier"], string> = {
  refused: "bg-ink text-white",
  high: "bg-accent text-white",
  mid: "bg-[#9fb0f0] text-ink",
  low: "bg-[#dbe2fb] text-ink",
  zero: "border border-muted bg-white text-ink",
};

const LEGEND: { tier: StripArrow["tier"]; mark: string; label: string }[] = [
  { tier: "high", mark: "9", label: "9 to 10" },
  { tier: "mid", mark: "7", label: "5 to 8" },
  { tier: "low", mark: "3", label: "1 to 4" },
  { tier: "zero", mark: "0", label: "Missed" },
  { tier: "refused", mark: "R", label: "No readable aim" },
];

const cell = "flex min-h-11 items-center justify-center rounded-[3px] font-mono text-[13px] font-medium";

function Crosshair({ x, y }: { x: number; y: number }) {
  const arm = 38;
  const lines = (
    <>
      <line x1={x - arm} y1={y} x2={x + arm} y2={y} />
      <line x1={x} y1={y - arm} x2={x} y2={y + arm} />
    </>
  );
  return (
    <>
      <g stroke="#ffffff" strokeWidth={11} strokeLinecap="round">
        {lines}
      </g>
      <g stroke="#14161a" strokeWidth={5} strokeLinecap="round">
        {lines}
      </g>
    </>
  );
}

export function Figure({ featured }: { featured: Featured }) {
  const { strip, view } = featured.figure;
  return (
    <div className="flex flex-col gap-5">
      <figure
        aria-label={`${featured.name}'s view through the bow sight for one arrow, with a crosshair where it aimed and a ring where the arrow landed.`}
        className="m-0 flex flex-col gap-2"
      >
        <div className="relative overflow-hidden bg-track">
          {/* The SVG string is our own build output from benches/archery/render.ts. */}
          <div
            aria-hidden="true"
            className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: view.svg }}
          />
          <svg viewBox="0 0 1024 768" aria-hidden="true" className="absolute inset-0 h-full w-full">
            <Crosshair x={view.aim.x} y={view.aim.y} />
            <circle cx={view.landing.x} cy={view.landing.y} r={22} fill="none" stroke="#ffffff" strokeWidth={9} />
            <circle cx={view.landing.x} cy={view.landing.y} r={22} fill="none" stroke="#1f3fd6" strokeWidth={5} />
          </svg>
        </div>
        <figcaption className="font-mono text-[13px] leading-relaxed text-muted">
          {view.caption} Crosshair: where it aimed. Ring: where the arrow landed.
        </figcaption>
      </figure>

      <div className="flex flex-col gap-3">
        {/* The cast is needed because React's CSSProperties has no key for custom properties such as --arrows. */}
        <ol
          aria-label={`All ${strip.length} arrows of ${featured.name}, from rounds ${[...new Set(strip.map((a) => a.round))].join(", ")}, left to right`}
          style={{ "--arrows": strip.length } as CSSProperties}
          className="m-0 grid list-none grid-cols-12 gap-1 p-0 md:grid-cols-[repeat(var(--arrows),minmax(0,1fr))]"
        >
          {strip.map((arrow) => {
            const shown = arrow.round === view.round && arrow.arrow === view.arrow;
            return (
              <li
                key={`${arrow.round}-${arrow.arrow}`}
                className={`${cell} ${TIERS[arrow.tier]} ${shown ? "outline-2 outline-offset-1 outline-ink" : ""}`}
              >
                <span aria-hidden="true">{arrow.noAim ? "R" : arrow.score}</span>
                <span className="sr-only">
                  Round {arrow.round}, arrow {arrow.arrow}: {arrow.noAim ? "no readable aim" : `scored ${arrow.score}`}
                  {shown ? ", the arrow shown above" : ""}
                </span>
              </li>
            );
          })}
        </ol>
        <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0 text-[13px] text-muted">
          {LEGEND.map((item) => (
            <li key={item.tier} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`${cell} h-6 min-h-6 w-6 text-xs ${TIERS[item.tier]}`}>
                {item.mark}
              </span>
              {item.label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-6 w-6 rounded-[3px] outline-2 outline-offset-[-2px] outline-ink" />
            Arrow shown above
          </li>
        </ul>
      </div>
    </div>
  );
}
