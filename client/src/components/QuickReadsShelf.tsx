import { useMemo, useState } from "react";
import { NEWS_ARTICLES, NEWS_POINTS, QUICK_CATEGORIES, SECTION_COLORS, newsReadMinutes, quickCategoryOf, type NewsArticle } from "@shared/ariseNews";

type Result = { bookId: number; score: number; total: number };

/** Quick reads whose title, summary or kind matches a library search. */
export function matchQuickReads(query: string): NewsArticle[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return NEWS_ARTICLES.filter((a) =>
    a.title.toLowerCase().includes(q) || a.dek.toLowerCase().includes(q) || quickCategoryOf(a).label.toLowerCase().includes(q) || a.section.toLowerCase().includes(q),
  ).sort((a, b) => Number(b.title.toLowerCase().includes(q)) - Number(a.title.toLowerCase().includes(q)) || b.publishedOn.localeCompare(a.publishedOn));
}

/** One quick read as a slim row: picture, title, kind and minutes. */
export function QuickReadRow({ a, result, onOpen }: { a: NewsArticle; result?: Result; onOpen: (slug: string) => void }) {
  const col = SECTION_COLORS[a.section];
  const c = quickCategoryOf(a);
  return (
    <button type="button" onClick={() => onOpen(a.slug)} aria-label={`${a.title}. ${newsReadMinutes(a)} minute read.${result ? ` Done, ${result.score} of ${result.total}.` : ""}`}
      className="group flex w-full min-w-0 items-center gap-3 rounded-xl bg-white p-2 pr-3 text-left ring-1 ring-black/5 transition-colors hover:bg-[#f6f4ff] hover:ring-[#7048e8]/30">
      <img src={`/covers/news/${a.slug}.svg`} alt="" loading="lazy" className="h-14 w-14 flex-shrink-0 rounded-lg object-cover" style={{ objectPosition: "50% 42%" }} />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-bold leading-snug text-[#17143b]">{a.title}</span>
        <span className="mt-1 flex items-center gap-1.5 text-[11px] font-bold">
          <span className="truncate rounded-full px-1.5 py-px" style={{ background: col.tint, color: col.deep }}><span aria-hidden="true">{c.emoji} </span>{c.label}</span>
          <span className="flex-shrink-0 text-[#5d5a7a]">{newsReadMinutes(a)} min</span>
          {result && <span className="flex-shrink-0 text-emerald-700">✓ {result.score}/{result.total}</span>}
        </span>
      </span>
    </button>
  );
}

/**
 * 5-Minute Reads: the library's shelf of short pieces (sports, biographies, famous speeches,
 * fun facts and more). Each is a 5-question quiz. Kept slim: two scrolling rows of small cards.
 */
export default function QuickReadsShelf({ newsBookIds, results, onOpen, onSeeAll }: {
  newsBookIds: Record<string, number>;
  results: Result[];
  onOpen: (slug: string) => void;
  onSeeAll: () => void;
}) {
  const [cat, setCat] = useState<string>("All");
  // newest first, so new pieces show up at the front of the shelf
  const all = useMemo(() => [...NEWS_ARTICLES].sort((a, b) => b.publishedOn.localeCompare(a.publishedOn)), []);
  const shown = cat === "All" ? all : all.filter((a) => quickCategoryOf(a).label === cat);
  const cats = QUICK_CATEGORIES.filter((c) => all.some((a) => c.sections.includes(a.section)));
  const resultFor = (slug: string) => {
    const id = newsBookIds[slug];
    return id ? results.find((r) => r.bookId === id) : undefined;
  };
  const done = all.filter((a) => resultFor(a.slug)).length;

  return (
    <section className="mb-8 rounded-2xl bg-[#fff8e6] p-3 text-[#17143b] ring-1 ring-amber-200/70 sm:p-4" aria-labelledby="quick-reads-h">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="quick-reads-h" className="text-lg font-black leading-tight sm:text-xl"><span aria-hidden="true">⚡ </span>5-Minute Reads</h2>
        <p className="order-last w-full min-w-0 text-xs font-semibold text-[#5d5a7a] sm:order-none sm:w-auto sm:flex-1 sm:text-sm">
          Short stories you can finish fast. 5-question quiz, {NEWS_POINTS} points each{done > 0 ? `. You've done ${done}.` : "."}
        </p>
        <button type="button" onClick={onSeeAll} className="ml-auto min-h-9 rounded-lg px-2 text-sm font-black text-[#7048e8] hover:bg-white">
          See all {all.length}
        </button>
      </div>

      <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin" role="group" aria-label="Pick a kind of read">
        {["All", ...cats.map((c) => c.label)].map((label) => {
          const c = cats.find((x) => x.label === label);
          const on = cat === label;
          return (
            <button key={label} type="button" aria-pressed={on} onClick={() => setCat(label)}
              className={`min-h-9 flex-shrink-0 rounded-full px-3 text-xs font-black transition-colors sm:text-sm ${on ? "bg-[#17143b] text-white" : "bg-white text-[#17143b] ring-1 ring-black/10 hover:bg-[#f1efff]"}`}>
              {c ? <span aria-hidden="true" className="mr-1">{c.emoji}</span> : null}{label}
            </button>
          );
        })}
      </div>

      <div className="mt-2 grid auto-cols-[15.5rem] grid-flow-col grid-rows-2 gap-2 overflow-x-auto pb-1 scrollbar-thin sm:auto-cols-[17rem]" style={{ scrollSnapType: "x proximity" }}>
        {shown.map((a) => (
          <div key={a.slug} style={{ scrollSnapAlign: "start" }} className="flex min-w-0">
            <QuickReadRow a={a} result={resultFor(a.slug)} onOpen={onOpen} />
          </div>
        ))}
      </div>
    </section>
  );
}
