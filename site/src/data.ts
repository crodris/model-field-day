import raw from "./generated/site-data.json";
import type { SiteData } from "./site-data.ts";

// The generator writes this file. Assigning it here checks its shape against SiteData.
export const siteData: SiteData = raw;
