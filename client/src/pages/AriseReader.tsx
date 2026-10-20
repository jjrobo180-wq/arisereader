// A.R.I.S.E. Reader, on its own page at /reader — the way Arise Math has /math/.
//
// The Reader used to live inside Arise WorkHub as one menu item holding nine tabs, and inside
// LifeHub as one section. Both hubs now hand off to this page instead, so the Reader is one place
// rather than two that drift apart. Signing in is unchanged: it still happens in the hub, and a
// signed-out visitor here is sent there and brought back.
//
// The screens themselves are the ones that already worked — ReaderTools for a teacher,
// family-hub/Reader for a parent — so nothing about grading, approvals, prizes or a parent's view
// of their child is rebuilt here. What is new is the shell around them: the header, the row of
// screens, and the paper look the hub uses (hubPaper.css), carried over so a teacher arriving from
// WorkHub lands somewhere that feels like where they came from.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, BookHeart, CheckCircle2, ClipboardCheck, Clapperboard, LogOut, MessageSquare, Moon, School, Sparkles, Sun, Timer, Trophy, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { appHref, goToSignIn } from "@/lib/hubs";
import HubMark from "@/components/HubMark";
import { SupportButton } from "@/components/SupportArise";
import ReaderTools, { READER_TABS, isReaderTab, type ReaderTab } from "@/components/teacher-hub/HubReaderTools";
import ParentReader from "@/components/family-hub/Reader";
import TeacherReader from "./TeacherReader";
import { SUB_LABELS } from "@shared/hubTabGroups";
import type { HubTab } from "@shared/teacherHub";
import { cleanAccent, deepenAccent, DEFAULT_ACCENT } from "@shared/hubAccent";
import "@/components/teacher-hub/hubNight.css";
import "@/components/teacher-hub/hubPaper.css";

const TAB_KEY = "reader_page_tab";
/** The accent the teacher picked, left here by WorkHub (shared/hubAccent.ts) for pages outside it. */
export const ACCENT_KEY = "arise-hub-accent";
/** Where to go back to, and what to call it, for whoever is reading. */
/** Where "back" goes, and what to call it. A full address, not a bare hash: this page sits outside
 *  the app's router, so "#/workhub" alone would change the address and leave the page as it was. */
const hubFor = (role: string | undefined) =>
  role === "parent" ? { href: appHref("/lifehub"), label: "To Do" } : { href: appHref("/workhub"), label: "WorkHub" };
/** The same icons WorkHub gives these screens, so the two read as one product. */
const ICONS: Partial<Record<HubTab, ReactNode>> = {
  reader: <BookHeart className="h-4 w-4" />, readerLive: <Trophy className="h-4 w-4" />, readerScenes: <Clapperboard className="h-4 w-4" />,
  readerStudents: <Users className="h-4 w-4" />, readerAdvisory: <School className="h-4 w-4" />, readerApprovals: <CheckCircle2 className="h-4 w-4" />, readerParents: <MessageSquare className="h-4 w-4" />,
  readerQuizzes: <ClipboardCheck className="h-4 w-4" />, readerGames: <Timer className="h-4 w-4" />, readerPrizes: <Sparkles className="h-4 w-4" />,
};

/** The tab this page opens on: the one asked for by whatever sent us here, else the one last used. */
function firstTab(): ReaderTab {
  try {
    const asked = sessionStorage.getItem(TAB_KEY);
    if (asked) {
      sessionStorage.removeItem(TAB_KEY);
      if (isReaderTab(asked as HubTab)) return asked as ReaderTab;
    }
    const last = localStorage.getItem("reader_page_last");
    if (last && isReaderTab(last as HubTab)) return last as ReaderTab;
  } catch { /* the usual first screen */ }
  return "reader";
}

export default function AriseReader() {
  const { user } = useAuth();
  // Signing in as someone else starts clean, so one teacher's Reader is never shown to the next.
  return <ReaderPage key={user?.id ?? "signed-out"} />;
}

function ReaderPage() {
  const { user, logout } = useAuth();
  const [tab, setTabState] = useState<ReaderTab>(firstTab);
  const [night, setNight] = useState(() => { try { return localStorage.getItem("arise-hub-night") === "1"; } catch { return false; } });
  const isParent = user?.role === "parent";
  const back = hubFor(user?.role);

  const setTab = (t: ReaderTab) => {
    setTabState(t);
    try { localStorage.setItem("reader_page_last", t); } catch { /* not remembered */ }
    window.scrollTo({ top: 0 });
  };
  const toggleNight = () => setNight((v) => {
    try { localStorage.setItem("arise-hub-night", v ? "0" : "1"); } catch { /* the choice just isn't remembered */ }
    return !v;
  });

  // The accent the teacher picked in WorkHub, so the two look like one product.
  const accent = useMemo(() => {
    try { return cleanAccent(localStorage.getItem(ACCENT_KEY)) || DEFAULT_ACCENT; } catch { return DEFAULT_ACCENT; }
  }, []);

  // Signing in stays in the hub. A signed-out visitor is sent there, and the hub brings them back
  // here once they are in, so a bookmarked /reader link still lands where it says it will.
  useEffect(() => {
    if (user) return;
    goToSignIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) {
    return <div className="grid grid-cols-1 min-h-screen place-items-center bg-slate-100 text-slate-600">
      <p className="text-sm">Taking you to sign in…</p>
    </div>;
  }

  // A.R.I.S.E. Reader is one of the paid programs, so a personal To-Do account has WorkHub but not
  // this. Said plainly, with the way to get it, rather than an empty screen or a wall of errors.
  if (!isParent && user.role !== "teacher" && !user.isAdmin) {
    return <div className="grid grid-cols-1 min-h-screen place-items-center bg-slate-100 px-5">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><BookHeart className="h-7 w-7" /></span>
        <h1 className="mt-4 text-2xl font-bold text-slate-950">A.R.I.S.E. Reader</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">The Reader's class tools come with a teacher or parent account. Your account has Arise WorkHub and A.R.I.S.E. To-Do, which stay free.</p>
        <a href={back.href} className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">
          <ArrowLeft className="h-4 w-4" /> Back to {back.label}
        </a>
      </div>
    </div>;
  }

  // Every Reader screen, Live quiz and Scenes included: the hub only links here now, so one left
  // out of this row would have no way in at all.
  const screens = READER_TABS;

  // Teachers (and the administrator) get the teacher Reader: its own dark look, menu on the left,
  // and the banner that opens WorkHub (pages/TeacherReader.tsx). Parents keep the page below.
  if (!isParent) return <TeacherReader tab={tab} setTab={setTab} workhubHref={back.href} />;

  return (
    <div className={`hub-paper min-h-screen w-full max-w-[100vw] overflow-x-clip bg-slate-100 text-slate-950 ${night ? "hub-night" : ""}`}
      style={{ "--hub-accent": accent, "--hub-accent-deep": deepenAccent(accent) } as React.CSSProperties}
      data-testid="arise-reader-page">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3 md:px-6">
          <a href={back.href} className="flex min-w-0 items-center gap-2 rounded-xl" aria-label={`Back to ${back.label}`} title={`Back to ${back.label}`}>
            <span className="flex h-7 w-7 shrink-0 overflow-hidden rounded-lg sm:h-8 sm:w-8"><HubMark tone="brand" className="h-full w-full" /></span>
            <span className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">A.R.I.S.E. Reader</span>
          </a>
          <div className="flex shrink-0 items-center gap-2">
            {(user.role === "parent" || user.isAdmin) && <SupportButton isAdmin={!!user.isAdmin} />}
            <a href={back.href} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50" data-testid="reader-back-to-hub">
              <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">{back.label}</span>
            </a>
            <button type="button" onClick={toggleNight} aria-pressed={night} aria-label={night ? "Switch to day mode" : "Switch to night mode"} title={night ? "Day mode" : "Night mode"}
              className="hidden min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-700 transition hover:bg-slate-50 sm:inline-flex" data-testid="reader-night-toggle">
              {night ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => { logout(); goToSignIn(); }} aria-label="Sign out" title="Sign out"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-700 transition hover:bg-slate-50">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-7 px-4 py-5 pb-[max(3rem,env(safe-area-inset-bottom))] sm:space-y-9 md:px-6">
        {isParent ? (
          <>
            <section className="min-w-0">
              <h1 className="hub-figure text-[40px] leading-none sm:text-[46px]">Reading</h1>
              <p className="mt-1 text-sm text-slate-500">Your children's reading, quizzes and prizes.</p>
            </section>
            <ParentReader say={() => { /* the parent view shows its own notices */ }} night={night} />
          </>
        ) : (
          <>
            <section className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="hub-figure text-[40px] leading-none sm:text-[46px]">{SUB_LABELS[tab] ?? "Reader"}</h1>
              </div>
              <p className="mt-1 text-sm text-slate-500">A.R.I.S.E. Reader, your class's reading account.</p>
            </section>

            {/* The row of screens. On a phone it scrolls sideways rather than wrapping into a
                block that pushes the work itself below the fold. */}
            <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="A.R.I.S.E. Reader">
              {screens.map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} data-hub-nav data-testid={`reader-tab-${t}`}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition ${tab === t ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>
                  {ICONS[t]} {SUB_LABELS[t] ?? t}
                </button>
              ))}
            </nav>

            <ReaderTools tab={tab} openTab={(t) => { if (isReaderTab(t)) setTab(t); }} night={night} />
          </>
        )}
      </main>
    </div>
  );
}
