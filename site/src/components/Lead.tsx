import type { Featured } from "../site-data.ts";

export function Lead({ featured }: { featured: Featured }) {
  const tested = featured.testedAt.slice(0, 10);
  return (
    <section className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <div className="flex flex-col gap-4 lg:col-span-8">
        <p className="font-mono text-[15px] font-medium text-muted">
          <time dateTime={tested}>{tested}</time> &middot; {featured.name} &middot;{" "}
          <span className="text-accent">Tested {featured.hoursAfterListing} h after OpenRouter listed it</span>
        </p>
        <h1 className="text-balance text-[clamp(2rem,6vw,3.5rem)] leading-[1.05] font-bold tracking-tight">
          {featured.headline}
        </h1>
        {featured.take === null ? null : <p className="max-w-[40rem] text-[19px] leading-relaxed">{featured.take}</p>}
      </div>
      <aside aria-label="Quotes from the models" className="flex flex-col gap-5 lg:col-span-4 lg:pt-9">
        {featured.quotes.map((quote) => (
          <figure key={quote.who} className="m-0 border-t border-rule pt-3">
            <blockquote className="m-0 font-mono text-sm leading-relaxed">&ldquo;{quote.text}&rdquo;</blockquote>
            <figcaption className="mt-1.5 text-[13px] text-muted">{quote.who}</figcaption>
          </figure>
        ))}
      </aside>
    </section>
  );
}
