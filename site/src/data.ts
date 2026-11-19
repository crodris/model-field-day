import raw from "./generated/site-data.json";
import type { SiteData } from "./site-data.ts";

// scripts/build-site-data.ts builds this file as a SiteData value, but a JSON import widens string unions
// such as a strip arrow's tier to plain strings, so the cast restores the type the generator wrote.
export const siteData = raw as SiteData;
