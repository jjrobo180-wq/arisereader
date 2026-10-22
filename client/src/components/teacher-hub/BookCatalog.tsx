// The book catalog for teachers: every book in the library a student can take a quiz on
// (GET /api/teacher/book-catalog), searchable, with its grade band and points.
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, Empty } from "./ui";

import { filterCatalog, type CatalogBook } from "@shared/bookCatalog";

const BANDS = ["K-2", "3-5", "6-8", "9-12"];
const PAGE = 60;

export default function BookCatalog({ request, openPage }: { request: (path: string) => Promise<any>; openPage: (path: string) => void }) {
  const [books, setBooks] = useState<CatalogBook[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [band, setBand] = useState("all");
  const [points, setPoints] = useState("all");
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    let live = true;
    request("/api/teacher/book-catalog")
      .then((d) => { if (live) setBooks(Array.isArray(d?.books) ? d.books : []); })
      .catch((e) => { if (live) { setBooks([]); setError(e?.message || "The catalog could not be loaded."); } });
    return () => { live = false; };
  }, [request]);

  const pointOptions = useMemo(() => [...new Set((books || []).map((b) => b.points))].sort((a, b) => a - b), [books]);
  const list = useMemo(() => filterCatalog(books || [], q, band, points), [books, q, band, points]);
  useEffect(() => { setShown(PAGE); }, [q, band, points]);

  const field = "min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900";
  return <Card title={`Book catalog${books ? ` (${books.length.toLocaleString()} books)` : ""}`}>
    <p className="mt-3 text-sm text-slate-600">Every book in A.R.I.S.E. Reader that students can take a quiz on. Search by title or author, or narrow it by grade band and points. Students see the books for their own grade band.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <label className="relative min-w-[220px] flex-1">
        <span className="sr-only">Search books</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input id="catalog-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or author" className={`${field} w-full pl-9`} data-testid="catalog-search" />
      </label>
      <label><span className="sr-only">Grade band</span>
        <select id="catalog-band" value={band} onChange={(e) => setBand(e.target.value)} className={field}>
          <option value="all">All grade bands</option>{BANDS.map((b) => <option key={b} value={b}>Grades {b}</option>)}
        </select></label>
      <label><span className="sr-only">Points</span>
        <select id="catalog-points" value={points} onChange={(e) => setPoints(e.target.value)} className={field}>
          <option value="all">Any points</option>{pointOptions.map((p) => <option key={p} value={String(p)}>{p} points</option>)}
        </select></label>
    </div>
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {books === null ? <Empty>Loading the catalog…</Empty> : !list.length ? <Empty>No books match. Try a shorter search or “All grade bands”.</Empty> : <>
      <p className="mt-3 text-xs font-semibold text-slate-500">{list.length.toLocaleString()} {list.length === 1 ? "book" : "books"}</p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3" data-testid="catalog-list">
        {list.slice(0, shown).map((b) => <li key={b.id} className="flex min-w-0 gap-3 rounded-2xl border border-slate-200 p-3">
          {b.coverUrl ? <img src={b.coverUrl} alt="" loading="lazy" className="h-20 w-14 shrink-0 rounded-lg bg-slate-100 object-cover" /> : <div className="h-20 w-14 shrink-0 rounded-lg bg-slate-100" aria-hidden="true" />}
          <div className="min-w-0 flex-1">
            <div className="break-words font-semibold leading-snug text-slate-900">{b.title}</div>
            {b.author && <div className="break-words text-sm text-slate-500">{b.author}</div>}
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-semibold">
              {b.band && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">Grades {b.band}</span>}
              {b.alsoBands.filter((x) => x !== b.band).map((x) => <span key={x} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">also {x}</span>)}
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-teal-800">{b.points} pts</span>
              {b.readOnArise && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">Read on Arise</span>}
            </div>
            <button type="button" onClick={() => openPage(`/quiz/${b.id}`)} className="mt-2 text-sm font-semibold text-teal-700 hover:underline">Preview quiz →</button>
          </div>
        </li>)}
      </ul>
      {shown < list.length && <div className="mt-3 flex justify-center">
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Show more ({(list.length - shown).toLocaleString()} left)</button>
      </div>}
    </>}
  </Card>;
}
