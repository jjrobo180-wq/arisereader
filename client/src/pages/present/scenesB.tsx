// Scenes 4 and 5 of the student welcome show: reading short reads on Arise, and taking a quiz.
// The reading page uses the site's own reading styles and catalogs; the quiz is the quiz page's own markup with a sample book.
import { useRef } from "react";
import { ArrowLeft, Award, BookOpen, CheckCircle2, FileSearch, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { READABLE_BOOKS, type ReadableBook } from "@shared/readsCatalog";
import { FEATURES, NEWS_ARTICLES, NEWS_POINTS, WORLD_NEWS, newsReadMinutes } from "@shared/ariseNews";
import { POEMS, poemLineCount } from "@shared/poems";
import { NewsArt, sectionStyle } from "../news/useNews";
import { timeLabel } from "../reads/useReads";
import "../news/news.css";
import "../reads/reads.css";
import { Scroll, Spot, coverOf, useScrollY, useSince, type SceneProps } from "./kit";

// ── 4. Short reads ──────────────────────────────────────────────────────────────────────────────────────

type Filter = "All" | "Short reads" | "Chapter books" | "Long novels";
const FILTERS: Filter[] = ["All", "Short reads", "Chapter books", "Long novels"];
const sizeOf = (words: number): Filter => (words < 30000 ? "Short reads" : words < 70000 ? "Chapter books" : "Long novels");
const byKey = (key: string) => READABLE_BOOKS.find((b) => b.key === key)!;
// Real books of the Read on Arise shelf, picked so that every size shows up.
const SHELF = ["velveteen-rabbit", "hound-baskervilles", "canterville-ghost", "swallows-and-amazons", "sleepy-hollow", "tower-treasure", "old-indian-legends", "kidnapped"].map(byKey);

function BookTile({ b, spot }: { b: ReadableBook; spot?: boolean }) {
  return (
    <a className="rd-book" onClick={(e) => e.preventDefault()} href="#/reads">
      <Spot on={!!spot} radius={10}><div className="rd-cover"><img src={coverOf(b.key!)} alt={`Cover of ${b.title}`} /></div></Spot>
      <h3>{b.title}</h3>
      <p>{b.author}</p>
      <div className="nw-meta"><span>{timeLabel(b.words)}</span>{b.pictures > 0 && <span>Pictures</span>}</div>
    </a>
  );
}

export function ReadsScene({ beat }: SceneProps) {
  const booksRef = useRef<HTMLElement>(null);
  const poetryRef = useRef<HTMLElement>(null);
  const articlesRef = useRef<HTMLElement>(null);
  // beat 1: the Short reads chip is tapped and the shelf narrows
  const pressed = useSince(beat, 2600, beat === 1);
  const tapped = beat > 1 || pressed;
  const filter: Filter = tapped && beat >= 1 ? "Short reads" : "All";
  const y = useScrollY(() => (beat === 1 ? booksRef.current : beat === 2 ? poetryRef.current : beat === 3 ? articlesRef.current : null), [beat, filter]);
  const shown = SHELF.filter((b) => filter === "All" || sizeOf(b.words) === filter);
  const poems = POEMS.filter((p) => p.band === "K-2").slice(0, 6);
  const news = [...WORLD_NEWS, ...FEATURES].slice(0, 3);

  return (
    <div className="sw-reads relative h-full w-full overflow-hidden bg-[#f4f3fa]">
      <Scroll y={y}>
        <main className="nw">
          <header className="nw-mast rd-mast">
            <div className="nw-wrap">
              <div className="nw-topline"><a className="nw-back" href="#/library" onClick={(e) => e.preventDefault()}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg><span>Library</span></a></div>
              <Spot on={beat === 0} radius={18}><h1 className="nw-wordmark">Read <span>on Arise</span></h1></Spot>
              <p className="nw-tagline">{READABLE_BOOKS.length} books, {POEMS.length} poems, iARISE lessons and {NEWS_ARTICLES.length} articles you can read right here. Finish a book or article, pass the quiz, earn points.</p>
              <nav className="rd-jump" aria-label="Jump to">
                {["Books", "Poetry", "iARISE", "Articles"].map((l) => <button key={l} type="button">{l}</button>)}
              </nav>
            </div>
          </header>

          <div className="nw-wrap">
            <section className="nw-block" ref={booksRef}>
              <div className="nw-block-head"><h2>Books</h2><p>Classic books, free to read here from the first page to the last.</p></div>
              <nav className="nw-filter" aria-label="Book length">
                {FILTERS.map((f) => (
                  <Spot key={f} on={f === "Short reads" && beat === 1 && !tapped} radius={99} className="inline-block"><button type="button" className={`nw-chip ${f === "Short reads" && tapped ? "sw-press" : ""}`} aria-pressed={filter === f}>{f}</button></Spot>
                ))}
              </nav>
              <div className="rd-books">{shown.map((b) => <BookTile key={b.key} b={b} spot={beat === 1 && tapped && b.key === "velveteen-rabbit"} />)}</div>
            </section>

            <section className="nw-block" ref={poetryRef}>
              <div className="nw-block-head"><h2>Poetry</h2><p>{POEMS.length} classic poems, each short enough to read twice. Words to know and questions come with every one.</p></div>
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

            <section className="nw-block" ref={articlesRef}>
              <div className="nw-block-head"><h2>Articles</h2><p>World news and features from Arise News. {NEWS_POINTS} points each.</p></div>
              <div className="nw-grid">
                {news.map((a) => (
                  <a key={a.slug} className="nw-card" style={sectionStyle(a)} href="#/news" onClick={(e) => e.preventDefault()}>
                    <NewsArt article={a} />
                    <div className="nw-card-text">
                      <span className="nw-kicker">{a.kind === "news" && <span className="nw-section">World News</span>}<span className="nw-section">{a.section}</span></span>
                      <h3>{a.title}</h3>
                      <div className="nw-meta"><span>{newsReadMinutes(a)} min read</span></div>
                    </div>
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

function Results({ beat }: { beat: number }) {
  const tapCert = useSince(beat, 9000, beat === 3);
  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <div className="absolute left-1/2 top-2 -translate-x-1/2 origin-top scale-[.6]">
        <Card className="w-[448px] shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary shadow-lg"><CheckCircle2 className="h-10 w-10 text-white" /></div>
            <h2 className="mb-2 text-2xl font-bold">Passed!</h2>
            <p className="mb-6 text-muted-foreground">{QUIZ_BOOK.title}</p>
            <Spot on={beat === 3} radius={20}>
              <div className="mb-6 rounded-2xl bg-primary p-6 text-white">
                <div className="text-5xl font-bold">3</div>
                <div className="mt-1 text-sm opacity-80">out of 4 correct</div>
                <div className="mt-2 text-3xl font-bold">75%</div>
              </div>
            </Spot>
            <div className="mb-6">
              <p className="text-lg font-bold text-primary">You earned 5 points!</p>
              <p className="mt-1 text-sm text-muted-foreground">out of 5 possible</p>
              <Button className={`mt-4 w-full ${tapCert ? "sw-press" : ""}`} variant="default"><Award className="mr-2 h-4 w-4" />Get Certificate</Button>
            </div>
            <Button className="w-full" variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Library</Button>
            <Spot on={beat === 4} radius={10} className="mt-2"><Button className="w-full" variant="ghost"><FileSearch className="mr-2 h-4 w-4" />Request Manual Review</Button></Spot>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function QuizScene({ beat }: SceneProps) {
  const refs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const s1 = useSince(beat, 2200, beat === 1), s2 = useSince(beat, 4800, beat === 1), s3 = useSince(beat, 7400, beat === 1);
  const s4 = useSince(beat, 3600, beat === 2);
  const tapSubmit = useSince(beat, 12200, beat === 2);
  const answered = beat >= 3 ? 4 : beat === 2 ? (s4 ? 4 : 3) : beat === 1 ? (s3 ? 3 : s2 ? 2 : s1 ? 1 : 0) : 0;
  const target = beat === 1 ? (s3 ? 2 : s2 ? 1 : 0) : beat === 2 ? 4 : -1;
  // on the last question the page rests with the Submit button near the bottom of the screen, as it would after scrolling down
  const y = useScrollY(() => (target >= 0 ? refs[target].current : null), [target], target === 4 ? 236 : 12);
  const allAnswered = answered === 4;
  // the Listen button is pointed at while the first question is read
  const listenSpot = beat === 1 && !s1;

  if (beat >= 3) return <Results beat={beat} />;
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
            <Spot on={beat === 0} radius={16} className="mb-6">
              <div className="flex items-start gap-4">
                <div className="w-24 flex-shrink-0"><img src={coverOf("velveteen-rabbit")} alt={`Cover of ${QUIZ_BOOK.title}`} className="w-full rounded-lg shadow-lg" /></div>
                <div className="flex-1">
                  <h2 className="mb-1 text-xl font-bold">{QUIZ_BOOK.title}</h2>
                  <p className="mb-2 text-sm text-muted-foreground">by {QUIZ_BOOK.author}</p>
                  <p className="text-sm text-muted-foreground">{QUIZ_BOOK.description}</p>
                  <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary"><BookOpen className="h-3 w-3" />{QUESTIONS.length} questions</div>
                </div>
              </div>
            </Spot>

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
                          <Spot on={listenSpot && idx === 0} radius={10}>
                            <button type="button" className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-primary"><Volume2 className="h-4 w-4" />Listen</button>
                          </Spot>
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

            <div className="mt-6 pb-12" ref={refs[4]}>
              <Spot on={beat === 2 && allAnswered} radius={12}>
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
