// Scenes 1 to 3 of the student welcome show: the welcome, logging in, and the library.
// The login and library screens are the site's own markup (Login.tsx and Library.tsx) with sample books.
import {
  ArrowRight, Award, Bell, BookOpen, CheckCircle2, ChevronDown, ClipboardList, GraduationCap, Heart, Inbox, Lock, LogIn, MoreVertical,
  Search, Sparkles, Trophy, UserRound, Users,
} from "lucide-react";
import { BrandText } from "@/components/BrandText";
import ExtraCreditTag from "@/components/ExtraCreditTag";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SITE } from "@shared/presentShow";
import { Scroll, Spot, coverOf, useSince, useTyped, type SceneProps } from "./kit";

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

// ── 2. Log in ───────────────────────────────────────────────────────────────────────────────────────────

const NAV = ["About", "Pricing", "WorkHub", "LifeHub", "Tutorials"];
type Tab = "signin" | "create" | "explore";
const TABS = [["signin", "Sign in", LogIn], ["create", "Create", Users], ["explore", "Explore", Sparkles]] as const;

function AccountChoice({ icon: Icon, title, text, tone }: { icon: any; title: string; text: string; tone?: "violet" | "cyan" }) {
  return (
    <div className={`flex w-full min-w-0 items-center gap-3 rounded-2xl border p-3 text-left ${tone === "cyan" ? "border-cyan-300/25 bg-cyan-500/8" : tone === "violet" ? "border-violet-300/20 bg-violet-500/8" : "border-white/10 bg-white/5"}`}>
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${tone === "cyan" ? "bg-cyan-400 text-slate-950" : tone === "violet" ? "bg-violet-500" : "bg-white/[.07] text-fuchsia-300"}`}><Icon className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1"><p className="font-black">{title}</p><p className="text-xs leading-5 text-slate-400">{text}</p></div>
      <ArrowRight className="h-4 w-4 shrink-0" />
    </div>
  );
}

const FIELD = "h-8 w-full border-white/10 bg-[#0f0d1d] text-sm text-white";

export function LoginScene({ beat }: SceneProps) {
  const tab: Tab = beat === 1 ? "create" : beat >= 2 ? "signin" : "signin";
  const address = useTyped(SITE, beat === 0 ? "run" : "done", 600, 12);
  // beat 1: the account choices, then the form School Student opens
  const form = useSince(beat, 3800, beat === 1);
  // beat 2: the username and password are typed, then Log in is tapped
  const mode = beat === 2 ? "run" : beat >= 3 ? "done" : "idle";
  const user = useTyped("alex.m", mode, 600, 7);
  const pass = useTyped("••••••••", mode, 2200, 9);
  const tapped = useSince(beat, 7600, beat === 2);
  const filled = beat >= 3 || pass.length >= 8;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_10%_0%,rgba(124,58,237,.24),transparent_28%),radial-gradient(circle_at_90%_8%,rgba(6,182,212,.16),transparent_26%),#0d0b1a] text-white">
      <div className="flex items-center gap-3 border-b border-white/10 bg-[#0d0b1a]/92 px-5 py-2">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-cyan-400"><BookOpen className="h-4 w-4" /></div>
        <p className="font-black tracking-[.07em]">A.R.I.S.E. <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">Reader</span> <span className="text-[9px] text-violet-300">2.0</span></p>
        <Spot on={beat === 0} radius={999} className="mx-auto">
          <div className="flex min-w-[250px] items-center gap-2 rounded-full border border-white/10 bg-[#1b1830] px-4 py-1.5 text-sm font-semibold text-slate-200">
            <Lock className="h-3.5 w-3.5 text-emerald-300" /><span className={beat === 0 ? "sw-caret" : ""}>{address}</span>
          </div>
        </Spot>
        <div className="flex gap-0.5">{NAV.map((n) => <span key={n} className={`whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold ${n === "LifeHub" ? "text-cyan-200" : "text-slate-400"}`}>{n}</span>)}</div>
      </div>

      <div className="grid grid-cols-[1fr_400px] gap-5 px-6 pt-4">
        <section className="relative self-start overflow-hidden rounded-[2rem] border border-white/10 bg-[#151326] p-7 shadow-2xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400" />
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-violet-200"><Sparkles className="h-3.5 w-3.5" /> A.R.I.S.E. Reader 2.0</div>
          <h1 className="mt-4 text-[38px] font-black leading-[.98] tracking-[-.05em]">Read. Learn. Earn.<span className="mt-1 block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">Then keep exploring.</span></h1>
          <p className="mt-4 text-sm font-semibold leading-6 text-slate-400">A reading platform that connects books and quizzes to live classroom games, rewards, accessible learning, avatars, pets, families, progress, and student worlds.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="h-10 rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 px-4 font-black">Create an account <ArrowRight className="ml-2 h-4 w-4" /></Button>
            <Button variant="outline" className="h-10 rounded-full border-cyan-300/20 bg-cyan-400/10 px-4 font-black text-cyan-100"><Sparkles className="mr-2 h-4 w-4" /> Explore features <ChevronDown className="ml-2 h-4 w-4" /></Button>
          </div>
        </section>

        <aside>
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#151326] shadow-2xl">
            <div className="grid grid-cols-3 gap-1 border-b border-white/10 bg-[#100e20] p-2">
              {TABS.map(([key, label, Icon]) => (
                <div key={key} className={`flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-black ${tab === key ? "bg-white/10 text-white ring-1 ring-white/10" : "text-slate-400"}`}><Icon className="h-4 w-4 shrink-0" /><span className="truncate">{label}</span></div>
              ))}
            </div>
            {tab === "signin" && (
              <div className="p-5">
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-300">Welcome back</p>
                <h2 className="mt-1 text-xl font-black">Sign in to A.R.I.S.E.</h2>
                <div className="mt-4 space-y-3">
                  <Spot on={beat === 2 && user.length > 0 && pass.length === 0} radius={12}>
                    <div className="space-y-1.5"><Label>Username</Label><Input readOnly value={user} placeholder="Your username" className="h-11 w-full border-white/10 bg-[#0f0d1d] text-white" /></div>
                  </Spot>
                  <Spot on={(beat === 2 && pass.length > 0) || beat >= 3} radius={12}>
                    <div className="space-y-1.5"><Label>Password</Label><Input readOnly type="text" value={pass} placeholder="Your password" className="h-11 w-full border-white/10 bg-[#0f0d1d] tracking-widest text-white" /></div>
                  </Spot>
                  <Button className={`h-11 w-full rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 font-black ${tapped ? "sw-press" : ""}`} style={{ opacity: filled ? 1 : .55 }}>{tapped ? "Logging in…" : "Log in"}</Button>
                </div>
                <div className="mt-3 w-full rounded-xl border border-violet-300/20 bg-violet-500/10 py-2.5 text-center text-sm font-black text-violet-200"><Sparkles className="mr-2 inline h-4 w-4" />Try sample account</div>
                <p className="mt-3 text-center text-sm font-bold text-slate-400">New here? <span className="text-violet-300">Create an account</span></p>
              </div>
            )}
            {tab === "create" && !form && (
              <div className="p-5">
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">Choose your account</p>
                <h2 className="mt-1 text-xl font-black">Get started with A.R.I.S.E.</h2>
                <div className="mt-4 space-y-2.5">
                  <Spot on radius={18}><AccountChoice icon={Users} title="School Student" text="Connect to a school and teacher." tone="violet" /></Spot>
                  <AccountChoice icon={UserRound} title="Independent Student" text="A separate signup — no school checkbox to remember." tone="cyan" />
                  <AccountChoice icon={GraduationCap} title="Teacher" text="Students, live games, rewards, controls." />
                  <AccountChoice icon={Heart} title="Parent / Guardian" text="Link children, progress, controls." />
                </div>
              </div>
            )}
            {tab === "create" && form && (
              <div className="sw-in p-4">
                <h2 className="text-xl font-black">Create your account</h2>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2" style={{ transform: "scale(.92)", transformOrigin: "top left", width: "108.7%" }}>
                  <div className="space-y-1"><Label className="text-xs">First name</Label><Input readOnly value="Alex" className={FIELD} /></div>
                  <div className="space-y-1"><Label className="text-xs">Last name</Label><Input readOnly value="Martinez" className={FIELD} /></div>
                  <div className="col-span-2 space-y-1"><Label className="text-xs">Username</Label><Input readOnly value="alex.m" className={FIELD} /></div>
                  <div className="space-y-1"><Label className="text-xs">Password</Label><Input readOnly value="••••••••" className={FIELD} /></div>
                  <div className="space-y-1"><Label className="text-xs">Confirm password</Label><Input readOnly value="••••••••" className={FIELD} /></div>
                  <Spot on radius={12} className="col-span-2"><div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1"><Label className="text-xs">School</Label><Input readOnly value="Your school" className={FIELD} /></div>
                    <div className="space-y-1"><Label className="text-xs">Grade</Label><Input readOnly value="5th" className={FIELD} /></div>
                    <div className="space-y-1"><Label className="text-xs">Teacher</Label><Input readOnly value="Your teacher" className={FIELD} /></div>
                  </div></Spot>
                </div>
              </div>
            )}
          </div>
        </aside>
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
  { key: "anne-of-avonlea", title: "Anne of Avonlea", author: "L. M. Montgomery", pts: 10 },
  { key: "canterville-ghost", title: "The Canterville Ghost", author: "Oscar Wilde", pts: 10 },
  { key: "sleepy-hollow", title: "The Legend of Sleepy Hollow", author: "Washington Irving", pts: 10 },
  { key: "little-lord-fauntleroy", title: "Little Lord Fauntleroy", author: "Frances H. Burnett", pts: 10 },
  { key: "kidnapped", title: "Kidnapped", author: "R. L. Stevenson", pts: 10 },
  { key: "through-the-looking-glass", title: "Through the Looking-Glass", author: "Lewis Carroll", pts: 20 },
  { key: "jekyll-and-hyde", title: "Dr. Jekyll and Mr. Hyde", author: "R. L. Stevenson", pts: 20 },
  { key: "christmas-carol", title: "A Christmas Carol", author: "Charles Dickens", pts: 20 },
  { key: "frankenstein", title: "Frankenstein", author: "Mary Shelley", pts: 20 },
  { key: "hound-baskervilles", title: "The Hound of the Baskervilles", author: "Arthur Conan Doyle", pts: 20 },
];

const badge = (pts: number) => pts === 10 ? "bg-green-500/20 text-green-400" : pts === 20 ? "bg-primary/20 text-primary" : pts === 30 ? "bg-red-500/20 text-red-400" : "bg-muted text-muted-foreground";

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
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1"><GraduationCap className="h-3 w-3" />3-5</span>
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

export function LibraryScene({ beat }: SceneProps) {
  // beat 1: "velveteen" is typed into the search, and the grid narrows to match
  const typed = useTyped("velveteen", beat === 1 ? "run" : "idle", 700, 8);
  const found = typed.length >= 3;
  // beat 2: the point sections go by, one at a time
  const second = useSince(beat, 3400, beat === 2);
  const third = useSince(beat, 6600, beat === 2);
  const spotPts = beat === 2;
  // beat 3: Read and Quiz on a card, and Quiz is tapped at the end
  const tapQuiz = useSince(beat, 5200, beat === 3);
  const y = beat <= 1 ? 0 : beat === 2 ? (third ? 724 : second ? 362 : 0) : 0;
  const shown = beat === 1 && found ? LIB.filter((b) => b.title.toLowerCase().includes(typed.toLowerCase())) : LIB;

  const group = (pts: number) => LIB.filter((b) => b.pts === pts);
  const grid = (books: LibBook[], extra?: (b: LibBook) => { spotPoints?: boolean; spotButtons?: boolean; pressQuiz?: boolean }) => (
    <div className="grid grid-cols-6 gap-2.5">{books.map((b) => <BookCard key={b.key} book={b} {...(extra?.(b) ?? {})} />)}</div>
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-background text-foreground">
      <LibraryHeader spotChip={beat === 0} />
      <div className="absolute inset-x-0 bottom-0 top-14 overflow-hidden px-5 pt-3">
        {beat <= 1 && (
          <div className="mb-3 flex gap-3">
            <Spot on={beat === 1} radius={14} className="relative flex-1">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <div className={`w-full rounded-xl border border-border bg-card py-3 pl-12 pr-4 text-sm ${typed ? "text-foreground sw-caret" : "text-muted-foreground"}`}>{typed || "Search books by title or author..."}</div>
              </div>
            </Spot>
            <div className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-card px-4 py-3 text-sm"><span className="font-medium">By Points</span><ChevronDown className="h-4 w-4 text-muted-foreground" /></div>
          </div>
        )}
        {beat <= 1 && (
          <div>
            <h2 className="mb-2 text-lg font-bold text-foreground">{beat === 1 && found ? "Search results" : "5 Point Books"}</h2>
            {beat === 1 && found ? grid(shown) : grid(group(5))}
          </div>
        )}
        {beat === 2 && (
          <Scroll y={y}>
            {[5, 10, 20].map((pts) => (
              <div key={pts} className="mb-3 h-[350px]">
                <h2 className="mb-2 text-lg font-bold text-foreground">{pts} Point Books</h2>
                {grid(group(pts).slice(0, 6), () => ({ spotPoints: spotPts && (pts === 5 || (pts === 10 && second) || (pts === 20 && third)) }))}
              </div>
            ))}
          </Scroll>
        )}
        {beat === 3 && (
          <div>
            <h2 className="mb-2 text-lg font-bold text-foreground">5 Point Books</h2>
            {grid(group(5), (b) => (b.key === "velveteen-rabbit" ? { spotButtons: true, pressQuiz: tapQuiz } : {}))}
          </div>
        )}
      </div>
    </div>
  );
}
