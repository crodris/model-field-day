import type { ArcheryRow, DashRow, LogRow } from "../site-data.ts";

const th = "py-2 pr-3 text-left text-[13px] font-medium text-muted";
const td = "py-2.5 pr-3 align-middle";
const mono = "font-mono text-[15px]";

export function SectionHead({ id, title, note }: { id: string; title: string; note: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink pb-2">
      <h2 id={id} className="m-0 scroll-mt-6 text-2xl font-bold">
        {title}
      </h2>
      <p className="m-0 text-sm text-muted">{note}</p>
    </div>
  );
}

function Bar({ percent }: { percent: number }) {
  return (
    <div aria-hidden="true" className="h-2 min-w-12 flex-1 bg-track">
      <div className="h-2 bg-accent" style={{ width: `${percent}%` }} />
    </div>
  );
}

function ScoreCell({ children, value }: { children: React.ReactNode; value: number }) {
  return (
    <td className={`${td} pr-0`}>
      <div className="flex items-center gap-3">
        {children}
        <span className={`w-12 shrink-0 text-right ${mono}`}>{value.toFixed(1)}</span>
      </div>
    </td>
  );
}

export function ArcheryTable({ rows }: { rows: ArcheryRow[] }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-rule">
          <th scope="col" className={`${th} w-12`}>
            Rank
          </th>
          <th scope="col" className={`${th} w-28 sm:w-52`}>
            Model
          </th>
          <th scope="col" className={`${th} pr-0`}>
            Score, % of maximum points
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.model} className="border-b border-rule">
            <td className={`${td} ${mono}`}>
              {row.dq ? (
                <span className="rounded-sm border border-ink px-1.5 py-0.5 text-xs font-medium">DQ</span>
              ) : (
                row.rank
              )}
            </td>
            <th scope="row" className={`${td} text-left text-base font-normal`}>
              {row.name}
            </th>
            <ScoreCell value={row.scorePct}>
              {row.dq ? (
                <span className="flex-1 text-sm text-muted">
                  refused {row.noAimArrows} of {row.totalArrows}
                </span>
              ) : (
                <Bar percent={row.scorePct} />
              )}
            </ScoreCell>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DashTable({ rows }: { rows: DashRow[] }) {
  const worst = Math.max(...rows.map((row) => row.habitPer1k));
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-rule">
          <th scope="col" className={`${th} w-12`}>
            Rank
          </th>
          <th scope="col" className={`${th} w-28 sm:w-52`}>
            Model
          </th>
          <th scope="col" className={`${th} pr-0`}>
            Dashes per 1,000 words
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.model} className="border-b border-rule">
            <td className={`${td} ${mono}`}>{row.rank}</td>
            <th scope="row" className={`${td} text-left text-base font-normal`}>
              {row.name}
            </th>
            <ScoreCell value={row.habitPer1k}>
              <Bar percent={worst > 0 ? (row.habitPer1k / worst) * 100 : 0} />
            </ScoreCell>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function LogTable({ rows }: { rows: LogRow[] }) {
  return (
    <div
      role="region"
      aria-label="Release log, scrolls sideways on small screens"
      tabIndex={0}
      className="overflow-x-auto"
    >
      <table className="w-full min-w-[34rem] border-collapse">
        <thead>
          <tr className="border-b border-rule">
            <th scope="col" className={th}>
              Model
            </th>
            <th scope="col" className={th}>
              Listed
            </th>
            <th scope="col" className={th}>
              Tested
            </th>
            <th scope="col" className={`${th} pr-0 text-right`}>
              Hours after listing
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.model} className="border-b border-rule">
              <th scope="row" className={`${td} text-left text-base font-normal`}>
                {row.name}
              </th>
              <td className={`${td} ${mono}`}>{row.listedAt}</td>
              <td className={`${td} ${mono}`}>{row.testedAt}</td>
              <td className={`${td} pr-0 text-right ${mono}`}>{row.hoursAfterListing ?? "backfill"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
