import { useMemo, useState } from "react";
import { NEWS_ARTICLES, NEWS_POINTS, QUICK_CATEGORIES, SECTION_COLORS, newsReadMinutes, quickCategoryOf } from "@shared/ariseNews";

type Result = { bookId: number; score: number; total: number };

/**
 * 5-Minute Reads: the library's front shelf of short pieces (sports, soccer,
 * biographies, famous speeches, fun facts and more). Each is a 5-question quiz.
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
    <section className="relative mb-10 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#fff4d6] via-white to-[#e7f5ff] p-4 text-[#17143b] shadow-xl ring-1 ring-black/5 sm:p-6" aria-labelledby="quick-reads-h">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-300/30 blur-3xl" />
      <div className="relative flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[.22em] text-[#e8590c]">Short on time? Start here</p>
          <h2 id="quick-reads-h" className="mt-1 flex items-center gap-2 text-3xl font-black leading-none tracking-tight sm:text-4xl">
            <span aria-hidden="true">⚡</span>5-Minute <span className="text-[#7048e8]">Reads</span>
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-[#5d5a7a] sm:text-base">
            Not a long book. A whole story you can finish in 5 minutes or less. Read it, take a 5-question quiz, earn {NEWS_POINTS} points.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#17143b] px-3 py-1.5 text-xs font-black text-white">{all.length} quick reads</span>
          {done > 0 && <span className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-black text-white">✓ You've done {done}</span>}
        </div>
      </div>

      <ol className="relative mt-4 grid grid-cols-3 gap-2 text-center text-[11px] font-black text-[#17143b] sm:max-w-md sm:text-xs" aria-label="How it works">
        <li className="rounded-xl bg-white/80 px-2 py-2 shadow-sm">📖 Read 2–3 min</li>
        <li className="rounded-xl bg-white/80 px-2 py-2 shadow-sm">✏️ 5-question quiz</li>
        <li className="rounded-xl bg-white/80 px-2 py-2 shadow-sm">🏆 Earn {NEWS_POINTS} points</li>
      </ol>

      <div className="relative -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-thin" role="group" aria-label="Pick a kind of read">
        {["All", ...cats.map((c) => c.label)].map((label) => {
          const c = cats.find((x) => x.label === label);
          const on = cat === label;
          return (
            <button key={label} type="button" aria-pressed={on} onClick={() => setCat(label)}
              className={`min-h-[40px] flex-shrink-0 rounded-full px-3.5 text-sm font-black transition-colors ${on ? "bg-[#17143b] text-white" : "bg-white text-[#17143b] ring-1 ring-black/10 hover:bg-[#f1efff]"}`}>
              {c ? <span aria-hidden="true" className="mr-1">{c.emoji}</span> : null}{label}
            </button>
          );
        })}
      </div>

      <div className="relative mt-4 flex gap-4 overflow-x-auto pb-2 scrollbar-thin" style={{ scrollSnapType: "x mandatory" }}>
        {shown.map((a) => {
          const r = resultFor(a.slug);
          const col = SECTION_COLORS[a.section];
          const c = quickCategoryOf(a);
          return (
            <button key={a.slug} type="button" onClick={() => onOpen(a.slug)}
              className="group w-[150px] flex-shrink-0 text-left sm:w-[170px]" style={{ scrollSnapAlign: "start" }}
              aria-label={`${a.title}. ${newsReadMinutes(a)} minute read. ${a.dek}`}>
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-slate-100 shadow-md transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-xl">
                <img src={`/covers/news/${a.slug}.svg`} alt="" className="h-full w-full object-cover" loading="lazy" />
                <span className="absolute left-2 top-[4.25rem] rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-black text-[#17143b] shadow">⏱ {newsReadMinutes(a)} min</span>
                {r && <span className="absolute right-2 top-[4.25rem] rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-black text-white shadow">✓ {r.score}/{r.total}</span>}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: col.tint, color: col.deep }}>
                  <span aria-hidden="true">{c.emoji} </span>{c.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="relative mt-3 flex justify-end">
        <button type="button" onClick={onSeeAll} className="inline-flex min-h-[44px] items-center rounded-xl bg-[#7048e8] px-5 text-sm font-black text-white shadow hover:bg-[#5f3dc4]">
          See all {all.length} quick reads →
        </button>
      </div>
    </section>
  );
}
