// The shape of site/src/generated/site-data.json. The generator in scripts/ writes it
// and the site reads it, so both import these types. This file holds types only.

export type Point = { x: number; y: number };

export type StripArrow = {
  round: number;
  arrow: number;
  distance: number;
  // Meters per second. Positive blows to the right.
  wind: number;
  score: number;
  // True when the answer had no readable aim, such as a refusal.
  noAim: boolean;
  tier: "refused" | "high" | "mid" | "low" | "zero";
};

export type SightView = {
  round: number;
  arrow: number;
  // The archer's view from benches/archery/render.ts, in a 1024 by 768 frame.
  svg: string;
  aim: Point;
  landing: Point;
  caption: string;
};

export type Quote = { text: string; who: string };

export type Featured = {
  model: string;
  name: string;
  listedAt: string;
  testedAt: string;
  hoursAfterListing: number;
  headline: string;
  take: string | null;
  quotes: Quote[];
  figure: { strip: StripArrow[]; view: SightView };
};

// "T1" for a tie, "3" otherwise. Null for a disqualified model.
export type ArcheryRow = {
  model: string;
  name: string;
  scorePct: number;
  rank: string | null;
  noAimArrows: number;
  totalArrows: number;
  dq: boolean;
};

export type DashRow = {
  model: string;
  name: string;
  rank: string;
  habitPer1k: number;
  obeyedPct: number;
};

export type LogRow = {
  model: string;
  name: string;
  // YYYY-MM-DD, in UTC.
  listedAt: string;
  testedAt: string;
  // Null when the model was tested more than 48 hours after listing. The site shows "backfill".
  hoursAfterListing: number | null;
};

export type SiteData = {
  generatedAt: string;
  featured: Featured;
  archery: ArcheryRow[];
  dash: DashRow[];
  log: LogRow[];
};
