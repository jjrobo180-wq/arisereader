// Scenes 4 and 5 of the student welcome show: reading short reads on Arise, and taking a quiz.
// The reading page uses the site's own reading styles and catalogs. The quiz screens are the site's own: the "How do you want to take this quiz?"
// screen, the leave-the-page warning and the turn-in notice are the real components, and the questions are the quiz page's own markup with a sample book.
import { useEffect, useMemo, useRef } from "react";
import { ArrowLeft, Award, BookOpen, CheckCircle2, FileSearch, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { READABLE_BOOKS, type ReadableBook } from "@shared/readsCatalog";
import { NEWS_ARTICLES, NEWS_POINTS, QUICK_CATEGORIES, newsReadMinutes, quickCategoryOf } from "@shared/ariseNews";
import { POEMS, POEM_BANDS, poemLineCount } from "@shared/poems";
import { NewsArt, sectionStyle } from "../news/useNews";
import { timeLabel } from "../reads/useReads";
import "../news/news.css";
import "../reads/reads.css";
import NoProctorGate from "@/components/NoProctorGate";
import { LeaveWarning, OnYourOwnStrip, TurningIn } from "@/components/NoProctorParts";
import { Scroll, Spot, coverOf, useScrollY, useSince, type SceneProps } from "./kit";

// ── 4. Read on Arise ────────────────────────────────────────────────────────────────────────────────────

type Filter = "All" | "Short reads" | "Chapter books" | "Long novels";
const FILTERS: Filter[] = ["All", "Short reads", "Chapter books", "Long novels"];
const byKey = (key: string) => READABLE_BOOKS.find((b) => b.key === key)!;
// Real books of the Read on Arise shelf, picked so that every size shows up.
const SHELF = ["velveteen-rabbit", "hound-baskervilles", "canterville-ghost", "swallows-and-amazons", "sleepy-hollow", "tower-treasure", "old-indian-legends", "kidnapped"].map(byKey);

function BookTile({ b }: { b: ReadableBook }) {
  return (
    <a className="rd-book" onClick={(e) => e.preventDefault()} href="#/reads">
      <div className="rd-cover"><img src={coverOf(b.key!)} alt={`Cover of ${b.title}`} /></div>
      <h3>{b.title}</h3>
      <p>{b.author}</p>
      <div className="nw-meta"><span>{timeLabel(b.words)}</span>{b.pictures > 0 && <span>Pictures</span>}</div>
    </a>
  );
}

/** Read on Arise (ReadHub): the 5-Minute Reads first, then the books, then the poems. Same markup and styles, with no counts. */
export function ReadsScene({ beat }: SceneProps) {
  const quickRef = useRef<HTMLElement>(null);
  const booksRef = useRef<HTMLElement>(null);
  const poetryRef = useRef<HTMLElement>(null);
  // beat 2: books first, then on to the poems
  const toPoems = useSince(beat, 4600, beat === 2);
  const y = useScrollY(() => (beat === 1 ? quickRef.current : beat === 2 ? (toPoems ? poetryRef.current : booksRef.current) : null), [beat, toPoems], 8);
  const quick = useMemo(() => [...NEWS_ARTICLES].sort((a, b) => b.publishedOn.localeCompare(a.publishedOn)), []);
  const quickCats = QUICK_CATEGORIES.filter((c) => quick.some((a) => c.sections.includes(a.section)));
  const poems = POEMS.filter((p) => p.band === "6-8").slice(0, 6);
  const band = POEM_BANDS.find((x) => x.band === "6-8");

  return (
    <div className="sw-reads relative h-full w-full overflow-hidden bg-[#f4f3fa]">
      <Scroll y={y}>
        <main className="nw">
          <header className="nw-mast rd-mast">
            <div className="nw-wrap">
              <div className="nw-topline"><a className="nw-back" href="#/library" onClick={(e) => e.preventDefault()}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg><span>Library</span></a></div>
              <Spot on={beat === 0} radius={18}><h1 className="nw-wordmark">Read <span>on Arise</span></h1></Spot>
              <p className="nw-tagline">Start with a 5-minute read: short stories about sports, soccer, famous people, speeches and wild facts. Plus hundreds of books and poems. Finish one, pass the quiz, earn points.</p>
              <nav className="rd-jump" aria-label="Jump to">
                {["⚡ 5-Minute Reads", "Poetry", "Books"].map((l) => <button key={l} type="button">{l}</button>)}
              </nav>
            </div>
          </header>

          <div className="nw-wrap">
            <section className="nw-block" ref={quickRef}>
              <div className="nw-block-head"><h2>⚡ 5-Minute Reads</h2><p>Every one is short enough to finish in 5 minutes or less. Read it, take the 5-question quiz, earn {NEWS_POINTS} points.</p></div>
              <nav className="nw-filter" aria-label="Kinds of quick reads">
                <button type="button" className="nw-chip" aria-pressed="true">All</button>
                {quickCats.map((c) => <button key={c.label} type="button" className="nw-chip" aria-pressed="false"><span aria-hidden="true">{c.emoji} </span>{c.label}</button>)}
              </nav>
              <div className="nw-grid">
                {quick.slice(0, 6).map((a) => (
                  <a key={a.slug} className="nw-card" style={sectionStyle(a)} href="#/news" onClick={(e) => e.preventDefault()}>
                    <NewsArt article={a} />
                    <div className="nw-card-text">
                      <span className="nw-kicker"><span className="nw-section">{quickCategoryOf(a).emoji} {quickCategoryOf(a).label}</span></span>
                      <h3>{a.title}</h3>
                      <div className="nw-meta"><span>⏱ {newsReadMinutes(a)} min read</span><span className="nw-pts">{NEWS_POINTS} pts</span></div>
                    </div>
                  </a>
                ))}
              </div>
            </section>

            <section className="nw-block" ref={booksRef}>
              <div className="nw-block-head"><h2>Books</h2><p>Classic books, free to read here from the first page to the last.</p></div>
              <nav className="nw-filter" aria-label="Book length">
                {FILTERS.map((f) => <button key={f} type="button" className="nw-chip" aria-pressed={f === "All"}>{f}</button>)}
              </nav>
              <div className="rd-books">{SHELF.map((b) => <BookTile key={b.key} b={b} />)}</div>
            </section>

            <section className="nw-block" ref={poetryRef}>
              <div className="nw-block-head"><h2>Poetry</h2><p>Classic poems, each short enough to read twice. Words to know and questions come with every one.</p></div>
              <nav className="nw-filter" aria-label="Poems by grade">
                <button type="button" className="nw-chip" aria-pressed="false">All poems</button>
                {POEM_BANDS.map((x) => <button key={x.band} type="button" className="nw-chip" aria-pressed={x.band === band?.band}>{x.label}</button>)}
              </nav>
              <div className="rd-poems">
                {poems.map((p) => (
                  <a key={p.slug} className="rd-poem" data-band={p.band} href="#/reads" onClick={(e) => e.preventDefault()}>
                    <h3>{p.title}</h3>
                    <p>{p.poet}</p>
                    <q>{p.hook}</q>
                    <div className="nw-meta"><span>{poemLineCount(p)} lines</span><span>Grades {p.band}</span></div>
                  </a>
                ))}
              </div>
            </section>
          </div>
        </main>
      </Scroll>
    </div>
  );
}

// ── 5. Quiz ─────────────────────────────────────────────────────────────────────────────────────────────

const QUIZ_BOOK = { title: "The Velveteen Rabbit", author: "Margery Williams", description: "A toy rabbit learns what it means to be loved, and what it means to be Real." };
const QUESTIONS = [
  { q: "Who explains to the Rabbit what it means to be Real?", options: ["The Skin Horse", "The Boy's mother", "The Gardener", "The Fairy"], right: 0, picked: 0 },
  { q: "According to the story, how does a toy become Real?", options: ["A child loves it for a long, long time", "It is bought at a store", "It is made of expensive cloth", "It never gets dirty"], right: 0, picked: 0 },
  { q: "Who makes the Velveteen Rabbit Real at the end of the story?", options: ["The Nursery Magic Fairy", "The Gardener", "Nana", "The Doctor"], right: 0, picked: 0 },
  { q: "What kind of toy is the Velveteen Rabbit at the start of the story?", options: ["A toy rabbit given to a boy at Christmas", "A real rabbit from the garden", "A toy robot", "A puppet from a theater"], right: 0, picked: 1 },
] as const;
const LETTERS = ["A", "B", "C", "D"] as const;

function Results({ stage }: { stage: 0 | 1 | 2 }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <div className="absolute left-1/2 top-3 -translate-x-1/2 origin-top scale-[.72]">
        <Card className="w-[448px] shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary shadow-lg"><CheckCircle2 className="h-10 w-10 text-white" /></div>
            <h2 className="mb-2 text-2xl font-bold">Passed!</h2>
            <p className="mb-6 text-muted-foreground">{QUIZ_BOOK.title}</p>
            <Spot on={stage === 0} radius={20}>
              <div className="mb-6 rounded-2xl bg-primary p-6 text-white">
                <div className="text-5xl font-bold">3</div>
                <div className="mt-1 text-sm opacity-80">out of 4 correct</div>
                <div className="mt-2 text-3xl font-bold">75%</div>
              </div>
            </Spot>
            <div className="mb-6">
              <p className="text-lg font-bold text-primary">You earned 5 points!</p>
              <p className="mt-1 text-sm text-muted-foreground">out of 5 possible</p>
              <Spot on={stage === 1} radius={10} className="mt-4"><Button className={`w-full ${stage === 1 ? "sw-press" : ""}`} variant="default"><Award className="mr-2 h-4 w-4" />Get Certificate</Button></Spot>
            </div>
            <Button className="w-full" variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Library</Button>
            <Spot on={stage === 2} radius={10} className="mt-2"><Button className="w-full" variant="ghost"><FileSearch className="mr-2 h-4 w-4" />Request Manual Review</Button></Spot>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Types into a field the way a person does, for fields that belong to a real component (it keeps its own state). */
function typeInto(el: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * The real "How do you want to take this quiz?" screen. `view` says which of its screens to show: the choice, or what happens
 * after tapping "With a proctor" or "On my own". The taps are made for it, a moment after it appears.
 */
function QuizChoice({ view }: { view: "choose" | "proctor" | "own" }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (view === "choose") return;
    const timers: number[] = [];
    const q = (sel: string) => root.current?.querySelector<HTMLElement>(sel) ?? null;
    timers.push(window.setTimeout(() => q(view === "proctor" ? ".np-option:not(.np-option-camera)" : ".np-option-camera")?.click(), 1000));
    if (view === "proctor") timers.push(window.setTimeout(() => { const input = q(".np-input") as HTMLInputElement | null; if (input) typeInto(input, "teacher-code"); }, 3200));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [view]);
  const ring = view === "choose" ? "sw-ring-options" : view === "proctor" ? "sw-ring-input" : "sw-ring-rules";
  return (
    <div ref={root} className={`sw-np ${ring}`}>
      <NoProctorGate
        book={{ title: QUIZ_BOOK.title, author: QUIZ_BOOK.author, coverUrl: coverOf("velveteen-rabbit") }}
        questionCount={QUESTIONS.length} quizId={1} authToken={null} resume={null} proctorError="" proctorLoading={false}
        onVerifyCode={() => {}} onCameraReady={() => {}} onBack={() => {}}
      />
    </div>
  );
}

/** Beat 3: staying on the page. The real strip, then the real warning, then the real "turning in" notice. */
function LeaveRule({ beat }: { beat: number }) {
  const warn = useSince(beat, 2200, beat === 3);
  const back = useSince(beat, 6200, beat === 3);
  const turnIn = useSince(beat, 8600, beat === 3);
  const used = back || turnIn;
  return (
    <div className="relative h-full w-full overflow-hidden bg-background text-foreground">
      <header className="relative z-20 border-b border-border bg-card/80 shadow-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /><span>Back</span></Button>
          <div className="flex-1"><h1 className="truncate text-sm font-bold">{QUIZ_BOOK.title}</h1><p className="text-xs text-muted-foreground">{QUIZ_BOOK.author}</p></div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 pt-3">
        <Spot on={!warn || (back && !turnIn)} radius={14}><OnYourOwnStrip warningUsed={used} /></Spot>
        <div className="mt-4"><QuizQuestion idx={0} picked={0} /></div>
        <div className="mt-4"><QuizQuestion idx={1} picked={0} /></div>
      </div>
      {warn && !back && <LeaveWarning awayMs={9000} onClose={() => {}} />}
      {turnIn && <TurningIn failed={false} onRetry={() => {}} />}
    </div>
  );
}

function QuizQuestion({ idx, picked }: { idx: number; picked: number }) {
  const item = QUESTIONS[idx];
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="mb-4 flex gap-3">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{idx + 1}</div>
          <p className="flex-1 text-base font-medium">{item.q}</p>
        </div>
        <RadioGroup value={picked >= 0 ? LETTERS[picked] : ""} onValueChange={() => {}} className="space-y-2">
          {LETTERS.map((letter, i) => (
            <Label key={letter} htmlFor={`sw-r${idx}-${letter}`} className={`flex items-center gap-3 rounded-lg border-2 p-3 transition-colors ${picked === i ? "border-primary bg-primary/5" : "border-border"}`}>
              <RadioGroupItem value={letter} id={`sw-r${idx}-${letter}`} />
              <span className="text-sm">{item.options[i]}</span>
            </Label>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}

export function QuizScene({ beat }: SceneProps) {
  const refs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  // beat 4: the answers go in one at a time, the page follows, and Submit is tapped
  const s1 = useSince(beat, 1000, beat === 4), s2 = useSince(beat, 2200, beat === 4), s3 = useSince(beat, 3400, beat === 4), s4 = useSince(beat, 4600, beat === 4);
  const tapSubmit = useSince(beat, 6800, beat === 4);
  const answered = beat !== 4 ? 0 : s4 ? 4 : s3 ? 3 : s2 ? 2 : s1 ? 1 : 0;
  const target = beat === 4 ? (s4 ? 4 : s3 ? 3 : s2 ? 2 : s1 ? 1 : -1) : -1;
  const y = useScrollY(() => (target >= 0 ? refs[target].current : null), [target], target === 4 ? 300 : 12);
  // beat 5: the score, then the certificate, then Request Manual Review
  const certificate = useSince(beat, 5200, beat === 5);
  const review = useSince(beat, 8600, beat === 5);
  const allAnswered = answered === 4;

  if (beat <= 2) return <QuizChoice key={beat} view={beat === 0 ? "choose" : beat === 1 ? "proctor" : "own"} />;
  if (beat === 3) return <LeaveRule beat={beat} />;
  if (beat === 5) return <Results stage={review ? 2 : certificate ? 1 : 0} />;
  return (
    <div className="relative h-full w-full overflow-hidden bg-background text-foreground">
      <header className="relative z-20 border-b border-border bg-card/80 shadow-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /><span>Back</span></Button>
          <div className="flex-1"><h1 className="truncate text-sm font-bold">{QUIZ_BOOK.title}</h1><p className="text-xs text-muted-foreground">{QUIZ_BOOK.author}</p></div>
        </div>
      </header>
      <div className="absolute inset-x-0 bottom-0 top-14 overflow-hidden">
        <Scroll y={y}>
          <main className="mx-auto max-w-3xl px-4 py-5">
            <div className="mb-6 flex items-start gap-4">
              <div className="w-24 flex-shrink-0"><img src={coverOf("velveteen-rabbit")} alt={`Cover of ${QUIZ_BOOK.title}`} className="w-full rounded-lg shadow-lg" /></div>
              <div className="flex-1">
                <h2 className="mb-1 text-xl font-bold">{QUIZ_BOOK.title}</h2>
                <p className="mb-2 text-sm text-muted-foreground">by {QUIZ_BOOK.author}</p>
                <p className="text-sm text-muted-foreground">{QUIZ_BOOK.description}</p>
                <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary"><BookOpen className="h-3 w-3" />{QUESTIONS.length} questions</div>
              </div>
            </div>

            <div className="space-y-4">
              {QUESTIONS.map((item, idx) => {
                const picked = answered > idx ? item.picked : -1;
                return (
                  <div key={item.q} ref={refs[idx]}>
                    <Card className="overflow-hidden">
                      <CardContent className="p-5">
                        <div className="mb-4 flex gap-3">
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{idx + 1}</div>
                          <p className="flex-1 text-base font-medium">{item.q}</p>
                          <button type="button" className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-primary"><Volume2 className="h-4 w-4" />Listen</button>
                        </div>
                        <RadioGroup value={picked >= 0 ? LETTERS[picked] : ""} onValueChange={() => {}} className="space-y-2">
                          {LETTERS.map((letter, i) => (
                            <Label key={letter} htmlFor={`sw-q${idx}-${letter}`} className={`flex items-center gap-3 rounded-lg border-2 p-3 transition-colors ${picked === i ? "border-primary bg-primary/5" : "border-border"}`}>
                              <RadioGroupItem value={letter} id={`sw-q${idx}-${letter}`} />
                              <span className="text-sm">{item.options[i]}</span>
                            </Label>
                          ))}
                        </RadioGroup>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pb-24" ref={refs[4]}>
              <Spot on={allAnswered && !tapSubmit} radius={12}>
                <Button size="lg" className={`w-full ${tapSubmit ? "sw-press" : ""}`} disabled={!allAnswered}>
                  {allAnswered ? "Submit Quiz" : `Answer all questions (${answered}/${QUESTIONS.length})`}
                </Button>
              </Spot>
            </div>
          </main>
        </Scroll>
      </div>
    </div>
  );
}
