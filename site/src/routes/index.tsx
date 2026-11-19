import { createFileRoute } from "@tanstack/react-router";
import { Figure } from "../components/Figure.tsx";
import { Lead } from "../components/Lead.tsx";
import { ArcheryTable, DashTable, LogTable, SectionHead } from "../components/Tables.tsx";
import { siteData } from "../generated/site-data.ts";

const GITHUB = "https://github.com/crodris/model-field-day";

const NAV = [
  { label: "Archery", href: "#archery" },
  { label: "Dash Bench", href: "#dash" },
  { label: "Release log", href: "#log" },
  { label: "GitHub", href: GITHUB },
];

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { featured, archery, dash, log } = siteData;
  const arrows = Math.max(0, ...archery.map((row) => row.totalArrows));
  const obeyed = dash.filter((row) => row.obeyedPct === 100).length;
  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-10 px-4 pt-8 pb-16 sm:px-6">
      <header className="flex flex-col gap-3 border-b border-ink pb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <a href="/" className="text-xl font-bold text-ink no-underline">
            model-field-day
          </a>
          <nav aria-label="Sections">
            <ul className="m-0 flex list-none flex-wrap gap-x-5 p-0 text-[15px] font-medium">
              {NAV.map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="inline-block py-2">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="m-0 max-w-[42rem] font-mono text-[13px] leading-relaxed text-muted">
          I test new AI models as soon as OpenRouter lists them, and write down what changed. By Chris Rodrigues.
        </p>
      </header>

      <main className="flex flex-col gap-10">
        <Lead featured={featured} />
        <Figure featured={featured} />

        <section aria-labelledby="archery" className="flex flex-col gap-3">
          <SectionHead
            id="archery"
            title="Archery"
            note={`Points as % of max. ${arrows} arrows, and the distance and wind change on every shot.`}
          />
          <ArcheryTable rows={archery} />
        </section>

        <section aria-labelledby="dash" className="flex flex-col gap-3">
          <SectionHead
            id="dash"
            title="Dash Bench"
            note="Em and en dashes per 1,000 words, with no rule given. Lower is better."
          />
          <DashTable rows={dash} />
          {dash.length === 0 ? null : (
            <p className="m-0 text-sm text-muted">
              {obeyed === dash.length
                ? `Told not to use them, all ${dash.length} models obeyed on every task.`
                : `Told not to use them, ${obeyed} of ${dash.length} models obeyed on every task.`}
            </p>
          )}
        </section>

        <section aria-labelledby="log" className="flex flex-col gap-3">
          <SectionHead id="log" title="Release log" note="Newest listing first. Tests more than 48 hours after listing are backfills." />
          <LogTable rows={log} />
        </section>
      </main>

      <footer className="flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-ink pt-4 text-sm text-muted">
        <p className="m-0">Scored by code, not by a model. Every raw answer is public.</p>
        <a href={GITHUB}>github.com/crodris/model-field-day</a>
      </footer>
    </div>
  );
}
