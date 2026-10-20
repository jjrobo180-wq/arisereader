// A.R.I.S.E. Reader for teachers, parents and the administrator: what they see after signing in
// on arisereader.com. Parents get the same look with their children's Reader, and a banner that
// opens Arise LifeHub instead of WorkHub.
// The look (dark, with a menu down the left, a greeting, four counts, "Needs you today" and the
// Advisory Challenge) is the one approved in the Teacher Reader prototype. The screens behind
// each menu item are the Reader's real ones (HubReaderTools), shown in the same dark colors.
// Across the top, a banner invites the teacher into Arise WorkHub, which comes with the account.
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpen, Megaphone, Calculator, Heart, Landmark, CheckCircle2, ChevronRight, ClipboardCheck, Clapperboard, Home, MessageSquare, School, Sparkles, Timer, Trophy, Users, type LucideIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { READER_APP, TODO_APP, isReaderHost } from "@/lib/hubs";
import ReaderTools, { isReaderTab, type ReaderTab } from "@/components/teacher-hub/HubReaderTools";
import ParentReader from "@/components/family-hub/Reader";
import { SupportBanner, SupportButton, SupportMenuItem } from "@/components/SupportArise";
import { AdvisoryStandings, datesText } from "@/components/AdvisoryChallenge";
import { useAdvisoryChallenge } from "@/lib/advisoryChallenge";
import { ordinal } from "@shared/advisoryChallenge";
import { nameWords } from "@shared/classTeachers";
import "@/components/teacher-hub/hubNight.css";
import "@/components/teacher-hub/hubPaper.css";
import "./teacherReader.css";

type View = ReaderTab | "leaderboard" | "whatsnew";

/** "What's new and what's coming": the same page the home page links to, shown right here. */
const WhatsNew = lazy(() => import("./WhatsNew"));

/** The menu, in the prototype's order, then the Reader's other screens. */
const MENU: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: "reader", label: "Overview", icon: Home },
  { id: "readerStudents", label: "Students", icon: Users },
  { id: "readerApprovals", label: "Approvals", icon: CheckCircle2 },
  { id: "readerQuizzes", label: "Quizzes & grading", icon: ClipboardCheck },
  { id: "readerLive", label: "Live quiz", icon: Trophy },
  { id: "readerParents", label: "Parents", icon: MessageSquare },
  { id: "readerAdvisory", label: "Advisory & Lit", icon: School },
  { id: "leaderboard", label: "Leaderboard", icon: BarChart3 },
  { id: "readerScenes", label: "Scenes", icon: Clapperboard },
  { id: "readerGames", label: "Game time", icon: Timer },
  { id: "readerPrizes", label: "Prizes", icon: Sparkles },
  { id: "whatsnew", label: "What's new", icon: Megaphone },
];

/** Arise History, Arise Math and A.R.I.S.E. Connect, linked from the hub banner. */
const LEARNING: Array<{ href: string; label: string; Icon: LucideIcon; color: string }> = [
  { href: "/history/", label: "Arise History", Icon: Landmark, color: "#fbbf24" },
  { href: "/math/", label: "Arise Math", Icon: Calculator, color: "#22d3ee" },
  { href: "/social/", label: "A.R.I.S.E. Connect", Icon: Users, color: "#c4b5fd" },
];

/** On a phone the menu is a rail down the left with a Hide button, the same as the hubs' default;
 *  hidden, a small tab on the left brings it back. Remembered on this device. */
const RAIL_KEY = "reader_phone_rail";
/** Signing out of the Reader always lands on arisereader.com's sign-in, whichever site it was on. */
export const READER_SIGN_IN = `${READER_APP}#/signin`;

/** "Conservatory Green Middle School (Denver, CO)" → "Conservatory Green MS". */
export const shortSchool = (name: string) => name.replace(/\s*\(.*\)\s*$/, "").replace(/\bMiddle School\b/, "MS").replace(/\bHigh School\b/, "HS").replace(/\bElementary School\b/, "ES").trim();

const greeting = (h = new Date().getHours()) => (h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");

/** The banner across the top: WorkHub for teachers and the administrator, LifeHub for parents. */
const HUB_BANNER = {
  work: {
    name: "WorkHub",
    title: "Your whole teaching day, in one place.",
    line: "Arise WorkHub keeps your lessons, IEP minutes, meetings, tasks and notes together, and your Reader class comes with you.",
  },
  life: {
    name: "LifeHub",
    title: "Your family’s whole week, in one place.",
    line: "Arise LifeHub keeps your lists, chores, the family calendar and reminders together, and your kids’ reading comes with you.",
  },
};

/** A parent's menu: their children's Reader, and the Advisory Challenge standings. */
const PARENT_MENU: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: "reader", label: "Overview", icon: Home },
  { id: "leaderboard", label: "Leaderboard", icon: BarChart3 },
  { id: "whatsnew", label: "What's new", icon: Megaphone },
];

type Counts = { students: number; joining: number; gradeChanges: number; books: number; toGrade: number };

export default function TeacherReader({ tab, setTab, workhubHref }: { tab: ReaderTab; setTab: (t: ReaderTab) => void; workhubHref: string }) {
  const { user, token, logout } = useAuth();
  const isParent = user?.role === "parent";
  const hub = HUB_BANNER[isParent ? "life" : "work"];
  const [view, setView] = useState<View>(tab);
  const [school, setSchool] = useState("");
  const [counts, setCounts] = useState<Counts | null>(null);
  const challenge = useAdvisoryChallenge(token);
  const [rail, setRailState] = useState(() => { try { return localStorage.getItem(RAIL_KEY) !== "closed"; } catch { return true; } });
  const setRail = (open: boolean) => { setRailState(open); try { localStorage.setItem(RAIL_KEY, open ? "open" : "closed"); } catch { /* not remembered */ } };

  // Opening the hub: on arisereader.com the sign-in has to be carried over to arisetodo.com. Doing
  // that here, before the new tab loads anything, takes the tab straight to the hub instead of
  // loading the Reader site, then a "carrying your sign-in" screen, then the hub.
  const openHub = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isReaderHost() || !token || e.metaKey || e.ctrlKey || e.shiftKey) return; // the plain link does the rest
    e.preventDefault();
    const tab = window.open("about:blank", "_blank");
    try {
      if (tab) { tab.opener = null; tab.document.title = `Opening your ${hub.name}…`; }
      const r = await fetch(`${API_BASE}/api/auth/admin-handoff/start`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const d = await r.json().catch(() => null);
      if (!r.ok || !/^[a-f0-9]{64}$/.test(String(d?.code || ""))) throw new Error("no code");
      const url = `${TODO_APP}#/admin-handoff?code=${d.code}`;
      if (tab) tab.location.href = url; else window.location.assign(url);
    } catch {
      if (tab) tab.location.href = workhubHref; else window.location.assign(workhubHref);
    }
  };

  const go = (v: View) => {
    setView(v);
    if (v !== "leaderboard" && v !== "whatsnew") setTab(v);
    window.scrollTo({ top: 0 });
  };

  // The Figtree typeface the prototype uses, added once.
  useEffect(() => {
    if (document.getElementById("teacher-reader-font")) return;
    const link = document.createElement("link");
    link.id = "teacher-reader-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700;800;900&display=swap";
    document.head.appendChild(link);
  }, []);

  const request = useCallback(async (path: string) => {
    const r = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }, [token]);

  // The numbers on the Overview and the menu badges.
  const loadCounts = useCallback(async () => {
    const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
    const [mine, waiting, grades, books, review] = await Promise.all([
      safe(request("/api/teacher/students"), []),
      safe(request("/api/teacher/pending-students"), []),
      safe(request("/api/grade-change-requests"), { requests: [] }),
      safe(request("/api/teacher-admin/book-requests"), { requests: [] }),
      safe(request("/api/comprehension/review?limit=1"), { pending: 0 }),
    ]);
    setCounts({
      students: Array.isArray(mine) ? mine.length : 0,
      joining: Array.isArray(waiting) ? waiting.length : 0,
      gradeChanges: Array.isArray(grades?.requests) ? grades.requests.length : 0,
      books: Array.isArray(books?.requests) ? books.requests.length : 0,
      toGrade: Number(review?.pending) || 0,
    });
  }, [request]);

  useEffect(() => {
    if (!token) return;
    if (!isParent) void loadCounts();
    if (user?.schoolId) {
      request("/api/schools").then((list: any[]) => {
        const s = Array.isArray(list) ? list.find((x) => x.id === user.schoolId) : null;
        if (s?.name) setSchool(shortSchool(String(s.name)));
      }).catch(() => {});
    }
  }, [token, user?.schoolId, loadCounts, request]);

  // Counts change as the teacher approves and grades in the other screens.
  useEffect(() => { if (view === "reader" && !isParent) void loadCounts(); }, [view, loadCounts, isParent]);

  const toApprove = counts ? counts.joining + counts.gradeChanges : 0;

  // The teacher's own advisory, found by their last name ("Ms. Chase" → "Chase & Shuster").
  const mine = useMemo(() => {
    if (!challenge?.challenge || !user) return null;
    const words = nameWords(user.displayName || "");
    const last = words[words.length - 1];
    if (!last) return null;
    return challenge.standings.find((s) => s.name.toLowerCase().split(/\s*&\s*/).some((n) => n === last)) || null;
  }, [challenge, user]);

  if (!user) return null;

  const badge = (id: View) => (id === "readerApprovals" ? toApprove : id === "readerQuizzes" ? counts?.toGrade || 0 : 0);
  const dim = "rgba(255,255,255,0.08)";

  return (
    <div className="teacher-reader hub-paper hub-night min-h-screen w-full max-w-[100vw] overflow-x-clip" data-testid="arise-reader-page"
      style={{ background: "#0d0b1a", color: "#ece9f7", fontFamily: "'Figtree', system-ui, sans-serif" }}>

      <header className="sticky top-0 z-50 flex h-16 items-center justify-between gap-3 border-b px-4 sm:px-6" style={{ borderColor: "rgba(255,255,255,0.1)", background: "#0f0d1f" }}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px]" style={{ background: "#7c3aed" }}><BookOpen className="h-[18px] w-[18px] text-white" /></span>
          <span className="text-[19px] font-black tracking-[-0.02em]">A.R.I.S.E. <span style={{ color: "#c4b5fd" }}>Reader</span></span>
          <span className="rounded-full px-2.5 py-0.5 text-xs font-extrabold" style={{ background: "#c4b5fd", color: "#0d0b1a" }}>{user.isAdmin ? "Admin" : isParent ? "Parent" : "Teacher"}</span>
        </div>
        <div className="flex items-center gap-3">
          {(isParent || user.isAdmin) && <SupportButton isAdmin={!!user.isAdmin} />}
          <span className="hidden text-sm sm:inline" style={{ color: "#c9c5dc" }}>{user.displayName}{school ? ` · ${school}` : ""}</span>
          <button type="button" onClick={() => { logout(); window.location.assign(READER_SIGN_IN); }} className="min-h-10 rounded-[10px] border px-3.5 text-sm font-bold" style={{ borderColor: "rgba(255,255,255,0.14)", color: "#ece9f7" }}>Sign out</button>
        </div>
      </header>

      {/* The hub banner and the donation line. Both always show (neither can be hidden), kept slim. */}
      <div className={`flex flex-col gap-2 px-6 pt-4 ${rail ? "max-lg:pl-[92px]" : "max-lg:pl-10"}`}>
        <section aria-label={`Open your ${hub.name}`} data-testid="reader-workhub-banner"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3" style={{ borderColor: "#2c6f69", background: "#0f2624" }}>
          <div className="min-w-0 flex-[1_1_320px]">
            <h2 className="text-[17px] font-black leading-tight text-white">{hub.title}</h2>
            <p className="mt-0.5 text-[13px] leading-snug" style={{ color: "#b9e4de" }}>{hub.line}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5" data-testid="reader-learning-apps">
            <span className="sr-only">Also on your account:</span>
            {LEARNING.map(({ href, label, Icon, color }) => (
              <a key={href} href={href} target="_blank" rel="noopener" title={label} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-bold text-white hover:bg-white/5" style={{ borderColor: "#2c6f69" }}>
                <Icon className="h-3.5 w-3.5" style={{ color }} />{label}
              </a>
            ))}
            <a href={workhubHref} className="inline-flex min-h-9 items-center rounded-xl px-4 text-sm font-black" style={{ background: "#5eead4", color: "#062b27" }} target="_blank" rel="noopener" onClick={openHub} data-testid="reader-open-workhub">Open your {hub.name}</a>
          </div>
        </section>
        <SupportBanner dark />
      </div>

      {/* Phone: the menu is a rail down the left with a Hide button (computers get the sidebar below). */}
      {rail ? (
        <nav aria-label="Reader menu" className="fixed bottom-0 left-0 top-[64px] z-40 flex w-[76px] flex-col gap-1 overflow-y-auto border-r px-1.5 py-2 lg:hidden" style={{ background: "#151326", borderColor: dim }} data-testid="reader-phone-rail">
          {(isParent ? PARENT_MENU : MENU).map((m) => {
            const on = view === m.id;
            const n = badge(m.id);
            const Icon = m.icon;
            return (
              <button key={m.id} type="button" onClick={() => go(m.id)} aria-current={on ? "page" : undefined} aria-label={m.label}
                className="relative flex min-h-[56px] w-full flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[10px] leading-tight"
                style={{ fontWeight: on ? 800 : 600, background: on ? "rgba(124,58,237,0.22)" : "transparent", color: on ? "#ffffff" : "#c9c5dc" }}>
                <Icon className="h-5 w-5" />
                <span className="line-clamp-2">{m.label}</span>
                {n > 0 && <span className="absolute right-1 top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold text-white" style={{ background: "#7c3aed" }}>{n}</span>}
              </button>
            );
          })}
          <SupportMenuItem isAdmin={!!user.isAdmin} testId="reader-rail-support" className="flex min-h-[56px] w-full flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[10px] font-bold leading-tight">
            <Heart className="h-5 w-5 fill-current" style={{ color: "#fb7185" }} /><span style={{ color: "#fecdd3" }}>Support</span>
          </SupportMenuItem>
          <button type="button" onClick={() => setRail(false)} className="mt-auto min-h-11 rounded-xl border text-xs font-bold" style={{ borderColor: "rgba(255,255,255,0.14)", color: "#c9c5dc" }}>Hide</button>
        </nav>
      ) : (
        <button type="button" onClick={() => setRail(true)} aria-label="Show the menu" className="fixed left-0 top-[96px] z-40 flex h-14 w-7 items-center justify-center rounded-r-xl border border-l-0 lg:hidden" style={{ background: "#151326", borderColor: "rgba(255,255,255,0.14)", color: "#ece9f7" }} data-testid="reader-rail-show">
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      <div className={`flex flex-wrap items-start gap-5 px-6 pb-8 pt-5 ${rail ? "max-lg:pl-[92px]" : "max-lg:pl-10"}`}>
        <nav aria-label="Reader menu" className="hidden max-w-[260px] flex-[1_1_220px] flex-col gap-1 rounded-[18px] border p-2.5 lg:flex" style={{ background: "#151326", borderColor: dim }}>
          {(isParent ? PARENT_MENU : MENU).map((m) => {
            const on = view === m.id;
            const n = badge(m.id);
            return (
              <button key={m.id} type="button" onClick={() => go(m.id)} aria-current={on ? "page" : undefined} data-testid={`reader-tab-${m.id}`}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-[15px]"
                style={{ fontWeight: on ? 800 : 600, background: on ? "rgba(124,58,237,0.22)" : "transparent", color: on ? "#ffffff" : "#c9c5dc" }}>
                <span>{m.label}</span>
                {n > 0 && <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs font-extrabold text-white" style={{ background: "#7c3aed" }}>{n}</span>}
              </button>
            );
          })}
          <SupportMenuItem isAdmin={!!user.isAdmin} testId="reader-support" className="mt-2 flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-rose-400/30 px-3 text-left text-[15px] font-bold hover:bg-rose-500/10">
            <Heart className="h-4 w-4 fill-current" style={{ color: "#fb7185" }} /><span style={{ color: "#fecdd3" }}>Support A.R.I.S.E.</span>
          </SupportMenuItem>
        </nav>

        <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          {isParent && view === "reader" && <>
            <h1 className="text-[30px] font-black tracking-[-0.02em]">{greeting()}, {user.displayName}</h1>
            <PrizesCard onStandings={() => go("leaderboard")} />
            <ParentReader say={() => { /* the parent view shows its own notices */ }} night />
          </>}

          {!isParent && view === "reader" && <>
            <h1 className="text-[30px] font-black tracking-[-0.02em]">{greeting()}, {user.displayName}</h1>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              {([["Students", counts?.students, "readerStudents"], ["To approve", toApprove, "readerApprovals"], ["To grade", counts?.toGrade, "readerQuizzes"], ["Book requests", counts?.books, "readerApprovals"]] as const).map(([label, value, to]) => (
                <button key={label} type="button" onClick={() => go(to)} className="flex flex-col gap-1 rounded-2xl border p-4 text-left" style={{ background: "#151326", borderColor: dim, color: "#ece9f7" }}>
                  <span className="text-[30px] font-black">{counts ? value ?? 0 : "…"}</span>
                  <span className="text-sm font-bold" style={{ color: "#a29fb8" }}>{label}</span>
                </button>
              ))}
            </div>
            <section className="flex flex-col gap-2.5 rounded-[18px] border px-5 py-[18px]" style={{ background: "#151326", borderColor: dim }}>
              <h2 className="text-lg font-extrabold">Needs you today</h2>
              {([
                [`${toApprove + (counts?.books || 0)} students and requests waiting for a yes or no`, "readerApprovals"],
                [`${counts?.toGrade || 0} written responses to grade`, "readerQuizzes"],
                ["Run a live quiz with your class", "readerLive"],
              ] as const).map(([label, to]) => (
                <div key={to} className="flex items-center justify-between gap-3 border-t py-2.5" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <span className="text-[15px]">{label}</span>
                  <button type="button" onClick={() => go(to)} className="min-h-[38px] rounded-[10px] border px-3 text-sm font-bold" style={{ borderColor: "rgba(255,255,255,0.14)", color: "#ddd6fe" }}>Open</button>
                </div>
              ))}
            </section>
            {challenge?.challenge && (
              <section className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border px-5 py-[18px]" style={{ background: "#1f1418", borderColor: "#5a2a20" }} data-testid="reader-challenge-card">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-extrabold" style={{ color: "#ffc93c" }}>Advisory Challenge · Oct 20 – Nov 19</span>
                  <span className="text-[17px] font-extrabold">{mine
                    ? (mine.points > 0 ? `Your advisory is in ${ordinal(mine.rank)} place of ${challenge.standings.length}` : `Your advisory, ${mine.name}, starts at 0`)
                    : `${challenge.standings.length} advisories are racing for a pizza party`}</span>
                </div>
                <button type="button" onClick={() => go("leaderboard")} className="min-h-10 rounded-[10px] px-3.5 text-sm font-extrabold" style={{ background: "#ffc93c", color: "#2a1206" }}>See standings</button>
              </section>
            )}
          </>}

          {isParent && view === "leaderboard" && <ParentLeaderboards token={token} challenge={challenge} />}

          {!isParent && view === "leaderboard" && <>
            <h1 className="text-[30px] font-black tracking-[-0.02em]">Advisory Challenge</h1>
            {challenge?.challenge ? (
              <section className="flex flex-col gap-3 rounded-[18px] border p-4" style={{ background: "#1a1020", borderColor: "#5a2a20" }}>
                <p className="text-sm font-semibold leading-relaxed text-white/75">{datesText(challenge as any)}</p>
                <AdvisoryStandings view={challenge} mineName={mine?.name} />
              </section>
            ) : <p className="text-[15px]" style={{ color: "#a29fb8" }}>{challenge === undefined ? "Loading…" : "Your school has no Advisory Challenge running."}</p>}
          </>}

          {view === "whatsnew" && (
            <div className="overflow-hidden rounded-[18px]" data-testid="reader-whatsnew">
              <Suspense fallback={<p className="p-6 text-[15px]" style={{ color: "#a29fb8" }}>Loading…</p>}><WhatsNew embedded /></Suspense>
            </div>
          )}

          {!isParent && view !== "reader" && view !== "leaderboard" && view !== "whatsnew" && (
            <ReaderTools tab={view} openTab={(t) => { if (isReaderTab(t)) go(t); }} night />
          )}
        </main>
      </div>
    </div>
  );
}

/** What students can win, for parents: the same three prizes the school announced. */
const PRIZES: Array<{ title: string; when: string; detail: string }> = [
  { title: "Pizza party", when: "Fri, Nov 20", detail: "For the advisory with the most points in the Advisory Challenge (Oct 20 – Nov 19)." },
  { title: "DoorDash food", when: "Each month", detail: "For the top reader on the monthly leaderboard." },
  { title: "AirPods", when: "End of the year", detail: "For the top reader of the whole school year." },
];

function PrizesCard({ onStandings }: { onStandings?: () => void }) {
  return (
    <section className="rounded-[18px] border px-5 py-4" style={{ background: "#1f1418", borderColor: "#5a2a20" }} data-testid="parent-prizes">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-extrabold" style={{ color: "#ffc93c" }}>What your reader can win</h2>
        {onStandings && <button type="button" onClick={onStandings} className="text-sm font-bold underline underline-offset-4" style={{ color: "#ffe2a8" }}>See the leaderboards</button>}
      </div>
      <ul className="mt-3 grid gap-2.5 sm:grid-cols-3">
        {PRIZES.map((p) => (
          <li key={p.title} className="rounded-xl px-3.5 py-3" style={{ background: "rgba(255,201,60,0.08)" }}>
            <p className="text-[15px] font-extrabold text-white">{p.title} <span className="text-xs font-bold" style={{ color: "#ffc93c" }}>· {p.when}</span></p>
            <p className="mt-1 text-[13px] leading-snug" style={{ color: "#e9d9c4" }}>{p.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

type Board = Array<{ id?: number; userId?: number; displayName: string; totalPoints: number }>;

/** Every leaderboard running now, in plain words for a parent, with their own children marked. */
function ParentLeaderboards({ token, challenge }: { token: string | null; challenge: ReturnType<typeof useAdvisoryChallenge> }) {
  const [month, setMonth] = useState<Board | null>(null);
  const [year, setYear] = useState<Board | null>(null);
  const [kids, setKids] = useState<number[]>([]);
  useEffect(() => {
    if (!token) return;
    const get = (path: string) => fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const ym = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
    void get(`/api/leaderboard?month=${ym}`).then((d) => setMonth(Array.isArray(d) ? d : []));
    void get("/api/leaderboard").then((d) => setYear(Array.isArray(d) ? d : []));
    void get("/api/parent/students").then((d) => setKids(Array.isArray(d?.students) ? d.students.map((k: any) => Number(k.id)) : []));
  }, [token]);
  const monthName = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", month: "long" }).format(new Date());
  const list = (rows: Board | null, empty: string) => {
    if (!rows) return <p className="text-sm" style={{ color: "#a29fb8" }}>Loading…</p>;
    if (!rows.length) return <p className="text-sm" style={{ color: "#a29fb8" }}>{empty}</p>;
    const top = rows.slice(0, 10);
    const extra = rows.filter((r, i) => i >= 10 && kids.includes(Number(r.userId ?? r.id)));
    return (
      <ol className="space-y-1.5">
        {[...top, ...extra].map((r) => {
          const i = rows.indexOf(r);
          const mine = kids.includes(Number(r.userId ?? r.id));
          return (
            <li key={`${r.userId ?? r.id}-${i}`} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: mine ? "rgba(255,201,60,0.14)" : "rgba(255,255,255,0.04)" }}>
              <span className="w-7 text-center font-black" style={{ color: i < 3 ? "#ffc93c" : "#a29fb8" }}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{r.displayName}{mine ? " · your child" : ""}</span>
              <span className="font-black">{Number(r.totalPoints || 0).toLocaleString()} <span className="text-xs font-semibold" style={{ color: "#a29fb8" }}>pts</span></span>
            </li>
          );
        })}
      </ol>
    );
  };
  const card = "rounded-[18px] border p-4 sm:p-5";
  return <>
    <h1 className="text-[30px] font-black tracking-[-0.02em]">Leaderboards</h1>
    <p className="-mt-2 text-[15px]" style={{ color: "#c9c5dc" }}>Every race going on right now. Points come from passing reading quizzes.</p>
    <PrizesCard />
    {challenge?.challenge && (
      <section className={card} style={{ background: "#1a1020", borderColor: "#5a2a20" }}>
        <h2 className="text-lg font-extrabold">Advisory Challenge · prize: pizza party</h2>
        <p className="mb-3 mt-1 text-sm" style={{ color: "#c9c5dc" }}>{datesText(challenge as any)}{challenge.mine?.advisory ? ` Your child’s advisory is ${challenge.mine.advisory}.` : ""}</p>
        <AdvisoryStandings view={challenge} mineName={challenge.mine?.advisory} />
      </section>
    )}
    <section className={card} style={{ background: "#151326", borderColor: "rgba(255,255,255,0.08)" }}>
      <h2 className="text-lg font-extrabold">{monthName}’s top readers · prize: DoorDash food</h2>
      <p className="mb-3 mt-1 text-sm" style={{ color: "#c9c5dc" }}>Points from this month only. It starts over on the 1st.</p>
      {list(month, "No points yet this month.")}
    </section>
    <section className={card} style={{ background: "#151326", borderColor: "rgba(255,255,255,0.08)" }}>
      <h2 className="text-lg font-extrabold">School year top readers · prize: AirPods</h2>
      <p className="mb-3 mt-1 text-sm" style={{ color: "#c9c5dc" }}>All points this school year. The top reader at the end of the year wins.</p>
      {list(year, "No points yet.")}
    </section>
  </>;
}
