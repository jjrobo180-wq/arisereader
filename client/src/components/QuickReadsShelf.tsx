import { useMemo, useState } from "react";
import { BookOpen, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NEWS_ARTICLES, NEWS_POINTS, QUICK_CATEGORIES, SECTION_COLORS, newsCoverSrc, newsReadMinutes, quickCategoryOf, type NewsArticle } from "@shared/ariseNews";

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
      <img src={newsCoverSrc(a)} alt="" loading="lazy" className="h-14 w-14 flex-shrink-0 rounded-lg object-cover" style={{ objectPosition: a.photo?.focus ?? "50% 42%" }} />
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
 * fun facts and more), in the same card format as the other quiz shelves.
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

  return (
    <section className="mb-10" aria-labelledby="quick-reads-h">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Zap className="h-5 w-5 text-primary" />
        <h2 id="quick-reads-h" className="text-lg font-bold text-foreground">5-Minute Reads</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{all.length} quizzes</span>
        <span className="text-xs font-medium text-primary">{NEWS_POINTS} points each</span>
        <button type="button" onClick={onSeeAll} className="ml-auto text-sm font-semibold text-primary hover:underline">See all</button>
      </div>
      <p className="mb-3 ml-7 text-sm text-muted-foreground">Short stories you can finish in 5 minutes, then a 5-question quiz.</p>

      <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin" role="group" aria-label="Pick a kind of read">
        {["All", ...cats.map((c) => c.label)].map((label) => {
          const on = cat === label;
          return (
            <button key={label} type="button" aria-pressed={on} onClick={() => setCat(label)}
              className={`min-h-8 flex-shrink-0 rounded-full px-3 text-xs font-semibold transition-colors ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin" style={{ scrollSnapType: "x mandatory" }}>
        {shown.map((a) => {
          const r = resultFor(a.slug);
          return (
            <Card key={a.slug} className="group w-[160px] flex-shrink-0 cursor-pointer overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl sm:w-[180px]"
              style={{ scrollSnapAlign: "start" }} onClick={() => onOpen(a.slug)}>
              <div className="relative aspect-[2/3] overflow-hidden bg-muted">
                <img src={newsCoverSrc(a)} alt={a.photo ? a.photo.alt : `Cover of ${a.title}`} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" style={a.photo?.focus ? { objectPosition: a.photo.focus } : undefined} loading="lazy" />
                {r && <div className="absolute right-2 top-2 rounded-full bg-green-500 px-2 py-1 text-xs font-bold text-white shadow-md">✓ Done</div>}
              </div>
              <div className="p-3">
                <h3 className="line-clamp-2 text-sm font-semibold leading-tight">{a.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{quickCategoryOf(a).label} · {newsReadMinutes(a)} min</p>
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary"><Trophy className="h-3 w-3" />{NEWS_POINTS} pts</span>
                </div>
                {r && <p className="mt-1 text-xs font-semibold text-primary">{r.score}/{r.total} correct</p>}
                <div className="mt-2">
                  <Button size="sm" variant="default" className="h-7 w-full text-xs"><BookOpen className="mr-1 h-3 w-3" />Read &amp; Quiz</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
