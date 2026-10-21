// Scenes 1 and 3 of the student welcome show: the welcome and the library (scenesLogin.tsx has the sign-in).
// The library screens are the site's own markup (Library.tsx) with sample books.
import { useMemo, useRef } from "react";
import {
  Award, Bell, Book, BookOpen, CheckCircle2, ChevronDown, ClipboardList, GraduationCap, Inbox, MoreVertical,
  Search, Sparkles, Trophy,
} from "lucide-react";
import { BrandText } from "@/components/BrandText";
import ExtraCreditTag from "@/components/ExtraCreditTag";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NEWS_ARTICLES, NEWS_POINTS, QUICK_CATEGORIES, SECTION_COLORS, newsReadMinutes, quickCategoryOf } from "@shared/ariseNews";
import { Scroll, Spot, coverOf, useScrollY, useSince, useTyped, type SceneProps } from "./kit";

// ── 1. Welcome ──────────────────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { Icon: BookOpen, title: "Read", text: "Pick a book you like" },
  { Icon: ClipboardList, title: "Quiz", text: "Answer questions about it" },
  { Icon: Trophy, title: "Earn points", text: "Pass at 70% for points" },
  { Icon: Award, title: "Win", text: "Climb the leaderboard" },
];
// The five words behind the name, as on the About page.
const LETTERS = [
  { letter: "A", word: "Advocating", line: "Speak up for yourself", color: "from-violet-500 to-fuchsia-500" },
  { letter: "R", word: "Resilience", line: "Keep turning the page", color: "from-fuchsia-500 to-violet-500" },
  { letter: "I", word: "Inclusion", line: "Every reader belongs", color: "from-cyan-500 to-blue-500" },
  { letter: "S", word: "Support", line: "We've got you", color: "from-blue-500 to-violet-500" },
  { letter: "E", word: "Empowerment", line: "You can do it", color: "from-violet-500 to-fuchsia-500" },
];

export function WelcomeScene({ beat }: SceneProps) {
  return (
    <div className="relative grid h-full w-full place-items-center overflow-hidden arise-page-bg px-10 text-center">
      <div className="w-full">
        <div className="sw-in mx-auto grid h-[72px] w-[72px] place-items-center rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-cyan-400 shadow-2xl"><BookOpen className="h-9 w-9 text-white" /></div>
        <h1 className="sw-in mt-4 text-[56px] font-black leading-none tracking-[-.04em]">
          A.R.I.S.E. <span className="arise-gradient-text">Reader</span>
          <span className="ml-2 rounded-full border border-violet-400/25 bg-gradient-to-r from-violet-500/15 via-fuchsia-500/10 to-cyan-400/15 px-2.5 py-0.5 align-middle text-[15px] font-black tracking-wider text-violet-200">2.0</span>
        </h1>
        <p className="mt-2 text-[11px] font-bold uppercase tracking-[.2em] text-slate-400">Read · Learn · Earn · Play · Grow</p>
        <p className="sw-in mt-3 text-xl font-black text-violet-200">Welcome, C.G.M.S.!</p>

        <div className="mx-auto mt-7 h-[150px] max-w-[860px]">
          {beat === 1 && (
            <div className="grid grid-cols-4 gap-3">
              {STEPS.map(({ Icon, title, text }, i) => (
                <div key={title} className="sw-in rounded-2xl border border-white/10 arise-surface p-4 text-left" style={{ animationDelay: `${i * 0.35}s` }}>
                  <div className="grid h-11 w-11 place-items-center rounded-xl arise-icon-tile"><Icon className="h-5 w-5 text-white" /></div>
                  <h3 className="mt-3 text-lg font-black">{title}</h3>
                  <p className="mt-0.5 text-xs font-semibold text-slate-400">{text}</p>
                </div>
              ))}
            </div>
          )}
          {beat >= 2 && (
            <div className="grid grid-cols-5 gap-3">
              {LETTERS.map((l, i) => (
                <div key={l.letter} className="sw-in rounded-2xl border border-white/10 arise-surface p-3 text-center" style={{ animationDelay: `${i * 0.4}s` }}>
                  <div className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${l.color} text-2xl font-black shadow-lg`}>{l.letter}</div>
                  <h3 className="mt-2 text-[15px] font-black leading-tight">{l.word}</h3>
                  <p className="mt-1 text-[11px] font-semibold leading-snug text-slate-400">{l.line}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 3. Library ──────────────────────────────────────────────────────────────────────────────────────────

type LibBook = { key: string; title: string; author: string; pts: number; done?: string };
const LIB: LibBook[] = [
  { key: "velveteen-rabbit", title: "The Velveteen Rabbit", author: "Margery Williams", pts: 5 },
  { key: "aesops-fables", title: "Aesop's Fables", author: "Aesop", pts: 5, done: "4/5 correct" },
  { key: "bambi", title: "Bambi", author: "Felix Salten", pts: 5 },
  { key: "indian-fairy-tales", title: "Indian Fairy Tales", author: "Joseph Jacobs", pts: 5 },
  { key: "grimms-household-tales", title: "Grimms' Household Tales", author: "The Brothers Grimm", pts: 5 },
  { key: "green-meadow-stories", title: "Green Meadow Stories", author: "Thornton W. Burgess", pts: 5 },
  { key: "anne-of-avonlea", title: "Anne of Avonlea", author: "L. M. Montgomery", pts: 10 },
  { key: "canterville-ghost", title: "The Canterville Ghost", author: "Oscar Wilde", pts: 10 },
  { key: "sleepy-hollow", title: "The Legend of Sleepy Hollow", author: "Washington Irving", pts: 10 },
  { key: "little-lord-fauntleroy", title: "Little Lord Fauntleroy", author: "Frances H. Burnett", pts: 10 },
  { key: "kidnapped", title: "Kidnapped", author: "R. L. Stevenson", pts: 10 },
  { key: "freckles", title: "Freckles", author: "Gene Stratton-Porter", pts: 10 },
  { key: "through-the-looking-glass", title: "Through the Looking-Glass", author: "Lewis Carroll", pts: 20 },
  { key: "jekyll-and-hyde", title: "Dr. Jekyll and Mr. Hyde", author: "R. L. Stevenson", pts: 20 },
  { key: "christmas-carol", title: "A Christmas Carol", author: "Charles Dickens", pts: 20 },
  { key: "frankenstein", title: "Frankenstein", author: "Mary Shelley", pts: 20 },
  { key: "hound-baskervilles", title: "The Hound of the Baskervilles", author: "Arthur Conan Doyle", pts: 20 },
  { key: "war-of-the-worlds", title: "The War of the Worlds", author: "H. G. Wells", pts: 20 },
];

const badge = (pts: number) => pts === 10 ? "bg-green-500/20 text-green-400" : pts === 20 ? "bg-primary/20 text-primary" : pts === 30 ? "bg-red-500/20 text-red-400" : "bg-muted text-muted-foreground";

/** The "Ways to read this book" button every book card carries (BookAccessLinks), closed. */
export function WaysButton({ open = false, className = "" }: { open?: boolean; className?: string }) {
  return (
    <div className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-center text-[13px] font-bold leading-tight text-primary ${className}`}>
      <Book className="h-4 w-4 shrink-0" />
      {open ? "Hide ways to read" : "Ways to read this book"}
    </div>
  );
}

/** One book of the library grid, as the library draws it. */
export function BookCard({ book, spotPoints, spotButtons, pressQuiz }: { book: LibBook; spotPoints?: boolean; spotButtons?: boolean; pressQuiz?: boolean }) {
  const done = !!book.done;
  return (
    <Card className="group overflow-hidden">
      <div className="relative aspect-[2/3] overflow-hidden bg-muted">
        {!done && <ExtraCreditTag />}
        <img src={coverOf(book.key)} alt={`Cover of ${book.title}`} className="h-full w-full object-cover" />
        {done && <div className="absolute right-2 top-2 rounded-full bg-green-500 px-2 py-1 text-xs font-bold text-white shadow-md">✓ Done</div>}
      </div>
      <div className="p-2.5">
        <h3 className="line-clamp-2 text-[13px] font-semibold leading-tight">{book.title}</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{book.author}</p>
        <Spot on={!!spotPoints} radius={999} className="mt-2 inline-block">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${badge(book.pts)}`}><Trophy className="h-3 w-3" />{book.pts} pts</span>
        </Spot>
        {book.done && <p className="mt-1 text-xs font-semibold text-primary">{book.done}</p>}
        <Spot on={!!spotButtons} radius={10} className="mt-2">
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="h-7 flex-1 text-xs"><BookOpen className="mr-1 h-3 w-3" />Read</Button>
            <Button size="sm" variant="default" className={`h-7 flex-1 text-xs ${pressQuiz ? "sw-press" : ""}`}>Quiz</Button>
          </div>
        </Spot>
        <WaysButton />
      </div>
    </Card>
  );
}

export function LibraryHeader({ points = 45, quizzes = 6, menu = false, spotChip = false, spotProgress = false }: { points?: number; quizzes?: number; menu?: boolean; spotChip?: boolean; spotProgress?: boolean }) {
  return (
    <header className="relative z-20 border-b border-border bg-card/90 shadow-sm">
      <div className="mx-auto flex h-14 items-center gap-3 px-5">
        <BrandText />
        <Spot on={spotChip} radius={14} className="min-w-0 flex-1">
          <div className="flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/5 px-3 py-1.5 text-left">
            <div className="min-w-0 flex-1 text-sm font-black leading-tight text-foreground">Alex M.</div>
            <div className="ml-auto flex shrink-0 items-center gap-3 text-xs font-black text-primary">
              <span className="inline-flex items-center gap-1"><Trophy className="h-3.5 w-3.5" />{points}<span className="opacity-70">pts</span></span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />{quizzes}<span className="opacity-70">quizzes</span></span>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1"><GraduationCap className="h-3 w-3" />6-8</span>
            </div>
          </div>
        </Spot>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Notifications"><Bell className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Inbox"><Inbox className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="More"><MoreVertical className="h-4 w-4" /></Button>
        </div>
      </div>
      {menu && (
        <div className="sw-in absolute right-4 top-[52px] z-50 w-72 rounded-2xl border border-border bg-card p-2 shadow-xl">
          <div className="px-2 pb-2 pt-1"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quick menu</p></div>
          <div className="grid grid-cols-2 gap-1.5">
            {[["Discover", Sparkles, "text-amber-500"], ["Read on Arise", BookOpen, "text-violet-500"]].map(([label, Icon, tone]: any) => (
              <div key={label} className="rounded-xl border border-border bg-muted/25 p-3 text-left"><Icon className={`mb-1.5 h-4 w-4 ${tone}`} /><span className="block text-xs font-black">{label}</span></div>
            ))}
            <Spot on={spotProgress} radius={14} className="col-span-2">
              <div className="rounded-xl border border-border bg-muted/25 p-3 text-left"><Trophy className="mb-1.5 h-4 w-4 text-amber-500" /><span className="block text-xs font-black">Progress & Rewards</span></div>
            </Spot>
          </div>
        </div>
      )}
    </header>
  );
}

/** The 5-Minute Reads shelf at the front of the library (QuickReadsShelf), without the counts. */
export function QuickShelf({ spotHead = false }: { spotHead?: boolean }) {
  const all = useMemo(() => [...NEWS_ARTICLES].sort((a, b) => b.publishedOn.localeCompare(a.publishedOn)), []);
  const cats = QUICK_CATEGORIES.filter((c) => all.some((a) => c.sections.includes(a.section)));
  return (
    <section className="relative mb-10 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#fff4d6] via-white to-[#e7f5ff] p-5 text-[#17143b] shadow-xl ring-1 ring-black/5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-300/30 blur-3xl" />
      <div className="relative">
        <p className="text-[11px] font-black uppercase tracking-[.22em] text-[#e8590c]">Short on time? Start here</p>
        <Spot on={spotHead} radius={16} className="mt-1 inline-block">
          <h2 className="flex items-center gap-2 text-4xl font-black leading-none tracking-tight"><span aria-hidden="true">⚡</span>5-Minute <span className="text-[#7048e8]">Reads</span></h2>
        </Spot>
        <p className="mt-2 max-w-2xl text-base font-semibold text-[#5d5a7a]">Not a long book. A whole story you can finish in 5 minutes or less. Read it, take a 5-question quiz, earn {NEWS_POINTS} points.</p>
      </div>
      <ol className="relative mt-4 grid max-w-md grid-cols-3 gap-2 text-center text-xs font-black text-[#17143b]">
        <li className="rounded-xl bg-white/80 px-2 py-2 shadow-sm">📖 Read 2–3 min</li>
        <li className="rounded-xl bg-white/80 px-2 py-2 shadow-sm">✏️ 5-question quiz</li>
        <li className="rounded-xl bg-white/80 px-2 py-2 shadow-sm">🏆 Earn {NEWS_POINTS} points</li>
      </ol>
      <div className="relative mt-4 flex gap-2 overflow-hidden">
        {["All", ...cats.map((c) => c.label)].map((label) => {
          const c = cats.find((x) => x.label === label);
          const on = label === "All";
          return (
            <span key={label} className={`inline-flex min-h-[40px] flex-shrink-0 items-center rounded-full px-3.5 text-sm font-black ${on ? "bg-[#17143b] text-white" : "bg-white text-[#17143b] ring-1 ring-black/10"}`}>
              {c ? <span aria-hidden="true" className="mr-1">{c.emoji}</span> : null}{label}
            </span>
          );
        })}
      </div>
      <div className="relative mt-4 flex gap-4 overflow-hidden pb-2">
        {all.slice(0, 7).map((a) => {
          const col = SECTION_COLORS[a.section];
          const c = quickCategoryOf(a);
          return (
            <div key={a.slug} className="w-[132px] flex-shrink-0 text-left">
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-slate-100 shadow-md">
                <img src={`/covers/news/${a.slug}.svg`} alt="" className="h-full w-full object-cover" />
                <span className="absolute left-2 top-[4.25rem] rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-black text-[#17143b] shadow">⏱ {newsReadMinutes(a)} min</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: col.tint, color: col.deep }}><span aria-hidden="true">{c.emoji} </span>{c.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function LibraryScene({ beat }: SceneProps) {
  // beat 1: "velveteen" is typed into the search, and the grid narrows to match
  const typed = useTyped("velveteen", beat === 1 ? "run" : "idle", 700, 8);
  const found = typed.length >= 3;
  // beat 2: down to the 5-Minute Reads shelf. beat 3: the points on the covers, then down to the bigger books, then back up to Read and Quiz (Quiz is tapped)
  const down = useSince(beat, 4200, beat === 3);
  const up = useSince(beat, 8200, beat === 3);
  const tapQuiz = useSince(beat, 10800, beat === 3);
  const shelfRef = useRef<HTMLDivElement>(null);
  const fiveRef = useRef<HTMLDivElement>(null);
  const twentyRef = useRef<HTMLDivElement>(null);
  const y = useScrollY(() => (beat === 2 ? shelfRef.current : beat === 3 ? (down && !up ? twentyRef.current : fiveRef.current) : null), [beat, down, up], 8);
  const shown = beat === 1 && found ? LIB.filter((b) => b.title.toLowerCase().includes(typed.toLowerCase())) : LIB;

  const group = (pts: number) => LIB.filter((b) => b.pts === pts);
  const grid = (books: LibBook[], extra?: (b: LibBook) => { spotPoints?: boolean; spotButtons?: boolean; pressQuiz?: boolean }) => (
    <div className="grid grid-cols-6 gap-2.5">{books.map((b) => <BookCard key={b.key} book={b} {...(extra?.(b) ?? {})} />)}</div>
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-background text-foreground">
      <LibraryHeader spotChip={beat === 0} />
      <div className="absolute inset-x-0 bottom-0 top-14 overflow-hidden px-5 pt-3">
        <Scroll y={y}>
          <div className="mb-3 flex gap-3">
            <Spot on={beat === 1} radius={14} className="relative flex-1">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <div className={`w-full rounded-xl border border-border bg-card py-3 pl-12 pr-4 text-sm ${typed ? "text-foreground sw-caret" : "text-muted-foreground"}`}>{typed || "Search books by title or author..."}</div>
              </div>
            </Spot>
            <div className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-card px-4 py-3 text-sm"><span className="font-medium">By Points</span><ChevronDown className="h-4 w-4 text-muted-foreground" /></div>
          </div>
          {beat === 1 ? (
            <div>
              <h2 className="mb-2 text-lg font-bold text-foreground">{found ? "Search results" : "5 Point Books"}</h2>
              {found ? grid(shown) : grid(group(5))}
            </div>
          ) : (
            <>
              <div ref={shelfRef}><QuickShelf spotHead={beat === 2} /></div>
              {[5, 10, 20].map((pts) => (
                <div key={pts} ref={pts === 5 ? fiveRef : pts === 20 ? twentyRef : undefined} className="mb-10">
                  <h2 className="mb-3 text-lg font-bold text-foreground">{pts} Point Books</h2>
                  {grid(group(pts).slice(0, 6), (b) => ({
                    spotPoints: beat === 3 && !up && (pts === 5 || (pts === 20 && down)),
                    spotButtons: beat === 3 && up && pts === 5 && b.key === "velveteen-rabbit",
                    pressQuiz: beat === 3 && tapQuiz && pts === 5 && b.key === "velveteen-rabbit",
                  }))}
                </div>
              ))}
            </>
          )}
        </Scroll>
      </div>
    </div>
  );
}

/** The library with nothing pointed at, for a pop-up to sit on top of. */
export function LibraryBackdrop({ menu = false, spotProgress = false }: { menu?: boolean; spotProgress?: boolean }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-background text-foreground">
      <LibraryHeader menu={menu} spotProgress={spotProgress} />
      <div className="absolute inset-x-0 bottom-0 top-14 overflow-hidden px-5 pt-3">
        <h2 className="mb-2 text-lg font-bold text-foreground">5 Point Books</h2>
        <div className="grid grid-cols-6 gap-2.5">{LIB.filter((b) => b.pts === 5).map((b) => <BookCard key={b.key} book={b} />)}</div>
      </div>
    </div>
  );
}
