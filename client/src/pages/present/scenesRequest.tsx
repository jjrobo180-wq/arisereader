// Scene 5 of the student welcome show: when a book is not on the site, and when a quiz is not in the library.
// The pages are the site's own: the book page with "Ways to read this book" (ReadBook + BookAccessLinks), the library's
// "No books found" screen, the "Create a Quiz" pop-up, and the "Sent to your teacher" screen (QuizGeneratingOverlay, used as it is).
import { useRef } from "react";
import { ArrowLeft, Bell, Book, BookOpen, Check, ExternalLink, Headphones, Search, Send, Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import QuizGeneratingOverlay from "@/components/QuizGeneratingOverlay";
import { LibraryHeader } from "./scenesA";
import { Scroll, Spot, useScrollY, useSince, useTyped, type SceneProps } from "./kit";

const BOOK = { title: "Wonder", author: "R. J. Palacio", pts: 10 };
const TEACHER = "Ms. Rivera";
const QUIZ = { title: "Wings of Fire", author: "Tui T. Sutherland" };
const SENT = `Your quiz for "${QUIZ.title}" has been sent to your teacher for review. You'll get a notification when it's ready!`;

/** The page of a book that is not read on the site (ReadBook), with "Ways to read this book" open. */
function BookPage({ beat }: { beat: number }) {
  const opens = useSince(beat, 3000, beat === 0);
  const open = beat === 1 || opens;
  const toHoopla = useSince(beat, 1500, beat === 1);
  const toRequest = useSince(beat, 5200, beat === 1);
  const sent = useSince(beat, 9000, beat === 1);
  const press = useSince(beat, 8200, beat === 1);
  const hooplaRef = useRef<HTMLDivElement>(null);
  const y = useScrollY(() => (beat === 1 ? hooplaRef.current : null), [beat], 105);
  return (
    <div className="relative h-full w-full overflow-hidden bg-background text-foreground">
      <header className="relative z-10 border-b border-border bg-card/80 shadow-sm">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>
          <div className="flex-1"><h1 className="truncate text-sm font-bold">{BOOK.title}</h1><p className="text-xs text-muted-foreground">{BOOK.author}</p></div>
        </div>
      </header>
      <div className="absolute inset-x-0 bottom-0 top-16 overflow-hidden">
        <Scroll y={y}>
          <main className="mx-auto max-w-3xl px-4 py-6">
            <Card className="overflow-hidden shadow-lg">
              <CardContent className="p-7">
                <div className="flex flex-row items-start gap-6">
                  <div className="w-36 flex-shrink-0">
                    <div className="flex aspect-[2/3] w-full items-center justify-center rounded-lg bg-primary p-4 text-center text-white shadow-lg"><span className="text-sm font-bold">{BOOK.title}</span></div>
                  </div>
                  <div className="flex-1 text-left">
                    <h2 className="mb-1 text-2xl font-bold">{BOOK.title}</h2>
                    <p className="mb-3 text-sm text-muted-foreground">by {BOOK.author}</p>
                    <div className="mb-4 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm font-bold text-white shadow-sm"><BookOpen className="h-4 w-4" />{BOOK.pts} pts</div>
                    <div className="mt-3">
                      <Spot on={beat === 0 && !open} radius={14}>
                        <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-bold text-primary"><Book className="h-4 w-4" />{open ? "Hide ways to read" : "Ways to read this book"}</div>
                      </Spot>
                      {open && (
                        <div className="sw-in mt-3 space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground"><ExternalLink className="h-4 w-4 flex-shrink-0 text-orange-500" />Find on Amazon</div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground"><Headphones className="h-4 w-4 flex-shrink-0 text-blue-500" />Learning Ally (audiobook)<ExternalLink className="h-3 w-3" /></div>
                            <p className="ml-5 text-[11px] text-muted-foreground">Free for students through Clever. Log in with your school account.</p>
                            <div className="ml-5 flex items-center gap-1 text-[11px] font-medium text-blue-400"><Bell className="h-3 w-3" />Don't have it on Clever? Request it</div>
                          </div>
                          <div ref={hooplaRef}>
                            <Spot on={toHoopla && !toRequest} radius={10} className="space-y-1">
                              <div className="flex items-center gap-2 text-sm font-medium text-foreground"><BookOpen className="h-4 w-4 flex-shrink-0 text-purple-500" />Hoopla (eBook/audiobook)<ExternalLink className="h-3 w-3" /></div>
                              <p className="ml-5 text-[11px] text-muted-foreground">Free through your public library or Libby app. You just need a library card.</p>
                            </Spot>
                          </div>
                          <div className="border-t border-border pt-2">
                            {sent ? (
                              <div className="sw-in flex items-start gap-2 rounded-lg bg-green-500/10 p-2 text-[11px] font-medium text-green-500"><Check className="mt-0.5 h-3 w-3 flex-shrink-0" />Request sent to your teacher {TEACHER} for "{BOOK.title}"! They'll help you find it.</div>
                            ) : (
                              <Spot on={toRequest} radius={14}>
                                <div className={`flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white ${press ? "sw-press" : ""}`}><Send className="h-4 w-4" />Request from Teacher</div>
                              </Spot>
                            )}
                            <p className="mt-1 text-center text-[11px] text-muted-foreground">Can't find this book? Ask your teacher for help!</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </main>
        </Scroll>
      </div>
    </div>
  );
}

/** The library after a search that finds nothing, and the "Create a Quiz" pop-up over it. */
function NoQuizFound({ beat }: { beat: number }) {
  const typed = useTyped(QUIZ.title, beat === 2 ? "run" : "done", 600, 9);
  const done = typed.length >= QUIZ.title.length;
  const ringBtn = useSince(beat, 3000, beat === 2);
  const modal = useSince(beat, 5000, beat === 2);
  const author = useTyped(QUIZ.author, modal ? "run" : "idle", 600, 10);
  const ringCreate = useSince(beat, 7600, beat === 2);
  const pressCreate = useSince(beat, 9200, beat === 2);
  return (
    <div className="relative h-full w-full overflow-hidden bg-background text-foreground">
      <LibraryHeader />
      <div className="absolute inset-x-0 bottom-0 top-14 overflow-hidden px-5 pt-3">
        <div className="mb-6 flex gap-3">
          <Spot on={!done} radius={14} className="relative flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <div className={`w-full rounded-xl border border-border bg-card py-3 pl-12 pr-4 text-sm ${typed ? "text-foreground sw-caret" : "text-muted-foreground"}`}>{typed || "Search books by title or author..."}</div>
            </div>
          </Spot>
          <div className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-card px-4 py-3 text-sm"><span className="font-medium">By Points</span><ChevronDown className="h-4 w-4 text-muted-foreground" /></div>
        </div>
        {typed.length >= 5 && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20"><BookOpen className="h-8 w-8 text-primary" /></div>
            <h3 className="mb-1 text-lg font-bold">No books found</h3>
            <p className="mb-4 text-sm text-muted-foreground">We couldn't find a quiz for "{typed}". Create one instantly with AI.</p>
            <Spot on={ringBtn && !modal} radius={12} className="inline-block">
              <div className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-xs font-black text-primary-foreground"><Sparkles className="mr-1.5 h-4 w-4" />Create AI Quiz</div>
            </Spot>
          </div>
        )}
      </div>
      {modal && (
        <div className="sw-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md shadow-xl">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5 text-purple-500" />Create a Quiz</h3></div>
              <div className="space-y-2"><Label>Book Title *</Label><Input readOnly value={QUIZ.title} /></div>
              <div className="space-y-2"><Label>Author *</Label><div className={author ? "sw-caret" : ""}><Input readOnly value={author} placeholder="e.g., E.B. White" /></div></div>
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-3 text-xs text-purple-300">A 10-question quiz will be created instantly. We use premium AI technology — not ChatGPT or Google — with guidelines set by educators. After students complete quizzes, educators review questions and adjust scoring as needed.</div>
              <div className="flex gap-2">
                <Spot on={ringCreate && !pressCreate} radius={12} className="flex-1">
                  <Button className={`w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white ${pressCreate ? "sw-press" : ""}`}><Sparkles className="mr-1 h-4 w-4" />Create Quiz</Button>
                </Spot>
                <Button variant="outline" className="flex-1">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/** Beats 2 and 3 are one piece: the request is typed and sent in beat 2, and the real "Sent to your teacher" screen carries on into beat 3. */
function QuizRequest({ beat }: { beat: number }) {
  const sending = useSince(beat, 9800, beat === 2);
  return (
    <>
      <NoQuizFound beat={beat} />
      {(beat === 3 || sending) && <QuizGeneratingOverlay bookTitle={QUIZ.title} author={QUIZ.author} ready pendingReview={SENT} onComplete={() => {}} />}
    </>
  );
}

export function RequestScene({ beat }: SceneProps) {
  return beat <= 1 ? <BookPage beat={beat} /> : <QuizRequest beat={beat} />;
}
