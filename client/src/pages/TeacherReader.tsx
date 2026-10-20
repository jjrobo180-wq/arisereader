// A.R.I.S.E. Reader for teachers, parents and the administrator: what they see after signing in
// on arisereader.com. Parents get the same look with their children's Reader, and a banner that
// opens Arise LifeHub instead of WorkHub.
// The look (dark, with a menu down the left, a greeting, four counts, "Needs you today" and the
// Advisory Challenge) is the one approved in the Teacher Reader prototype. The screens behind
// each menu item are the Reader's real ones (HubReaderTools), shown in the same dark colors.
// Across the top, a banner invites the teacher into Arise WorkHub, which comes with the account.
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { goToSignIn } from "@/lib/hubs";
import ReaderTools, { isReaderTab, type ReaderTab } from "@/components/teacher-hub/HubReaderTools";
import ParentReader from "@/components/family-hub/Reader";
import { SupportButton } from "@/components/SupportArise";
import { AdvisoryStandings, datesText } from "@/components/AdvisoryChallenge";
import { useAdvisoryChallenge } from "@/lib/advisoryChallenge";
import { ordinal } from "@shared/advisoryChallenge";
import { nameWords } from "@shared/classTeachers";
import "@/components/teacher-hub/hubNight.css";
import "@/components/teacher-hub/hubPaper.css";
import "./teacherReader.css";

type View = ReaderTab | "leaderboard";

/** The menu, in the prototype's order, then the Reader's other screens. */
const MENU: Array<{ id: View; label: string }> = [
  { id: "reader", label: "Overview" },
  { id: "readerStudents", label: "Students" },
  { id: "readerApprovals", label: "Approvals" },
  { id: "readerQuizzes", label: "Quizzes & grading" },
  { id: "readerLive", label: "Live quiz" },
  { id: "readerParents", label: "Parents" },
  { id: "readerAdvisory", label: "Advisory & Lit" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "readerScenes", label: "Scenes" },
  { id: "readerGames", label: "Game time" },
  { id: "readerPrizes", label: "Prizes" },
];

/** "Conservatory Green Middle School (Denver, CO)" → "Conservatory Green MS". */
export const shortSchool = (name: string) => name.replace(/\s*\(.*\)\s*$/, "").replace(/\bMiddle School\b/, "MS").replace(/\bHigh School\b/, "HS").replace(/\bElementary School\b/, "ES").trim();

const greeting = (h = new Date().getHours()) => (h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");

/** The banner across the top: WorkHub for teachers and the administrator, LifeHub for parents. */
const HUB_BANNER = {
  work: {
    name: "WorkHub",
    title: "Your whole teaching day, in one place.",
    line: "Arise WorkHub keeps your lessons, IEP minutes, meetings, tasks and notes together, and your Reader class comes with you.",
    tiles: [["Lessons", "Plans for every class"], ["IEP & Meetings", "Minutes and meeting times"], ["Tasks", "Your to-do list"], ["Notes", "Everything you jot down"]] as Array<[string, string]>,
  },
  life: {
    name: "LifeHub",
    title: "Your family’s whole week, in one place.",
    line: "Arise LifeHub keeps your lists, chores, the family calendar and reminders together, and your kids’ reading comes with you.",
    tiles: [["Lists", "Groceries, errands, anything"], ["Chores", "Who does what, and when"], ["Family calendar", "Everyone’s plans together"], ["Reminders", "Nothing slips by"]] as Array<[string, string]>,
  },
};

/** A parent's menu: their children's Reader, and the Advisory Challenge standings. */
const PARENT_MENU: Array<{ id: View; label: string }> = [
  { id: "reader", label: "Overview" },
  { id: "leaderboard", label: "Leaderboard" },
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

  const go = (v: View) => {
    setView(v);
    if (v !== "leaderboard") setTab(v);
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

      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3.5" style={{ borderColor: "rgba(255,255,255,0.1)", background: "#0f0d1f" }}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px]" style={{ background: "#7c3aed" }}><BookOpen className="h-[18px] w-[18px] text-white" /></span>
          <span className="text-[19px] font-black tracking-[-0.02em]">A.R.I.S.E. <span style={{ color: "#c4b5fd" }}>Reader</span></span>
          <span className="rounded-full px-2.5 py-0.5 text-xs font-extrabold" style={{ background: "#c4b5fd", color: "#0d0b1a" }}>{user.isAdmin ? "Admin" : isParent ? "Parent" : "Teacher"}</span>
        </div>
        <div className="flex items-center gap-3">
          {(isParent || user.isAdmin) && <SupportButton isAdmin={!!user.isAdmin} />}
          <span className="hidden text-sm sm:inline" style={{ color: "#c9c5dc" }}>{user.displayName}{school ? ` · ${school}` : ""}</span>
          <button type="button" onClick={() => { logout(); goToSignIn(); }} className="min-h-10 rounded-[10px] border px-3.5 text-sm font-bold" style={{ borderColor: "rgba(255,255,255,0.14)", color: "#ece9f7" }}>Sign out</button>
        </div>
      </header>

      {/* Always shown: there is no way to hide it. */}
      {(
        <div className="px-6 pt-[18px]">
          <section aria-label={`Open your ${hub.name}`} data-testid="reader-workhub-banner"
            className="flex flex-wrap items-center gap-x-8 gap-y-5 overflow-hidden rounded-[22px] border px-[26px] py-[22px]" style={{ borderColor: "#2c6f69", background: "#0f2624" }}>
            <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2">
              <span className="self-start rounded-full px-2.5 py-0.5 text-[13px] font-extrabold" style={{ background: "#5eead4", color: "#0f2624" }}>Included with your account</span>
              <h2 className="text-[28px] font-black leading-[1.1] tracking-[-0.02em] text-white">{hub.title}</h2>
              <p className="max-w-[560px] text-base leading-[1.45]" style={{ color: "#b9e4de" }}>{hub.line}</p>
              <div className="mt-1.5 flex flex-wrap gap-2.5">
                <a href={workhubHref} className="inline-flex min-h-[46px] items-center rounded-xl px-5 text-base font-black" style={{ background: "#5eead4", color: "#062b27" }} data-testid="reader-open-workhub">Open your {hub.name}</a>
              </div>
            </div>
            <div aria-hidden="true" className="grid flex-[0_1_380px] grid-cols-2 gap-2.5">
              {hub.tiles.map(([name, line]) => (
                <div key={name} className="flex flex-col gap-1 rounded-[14px] border px-3.5 py-3" style={{ background: "#133a36", borderColor: "#22524d" }}>
                  <span className="text-[15px] font-extrabold text-white">{name}</span>
                  <span className="text-[13px]" style={{ color: "#9fd4cc" }}>{line}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-5 px-6 pb-8 pt-5">
        <nav aria-label="Reader menu" className="flex max-w-[260px] flex-[1_1_220px] flex-col gap-1 rounded-[18px] border p-2.5" style={{ background: "#151326", borderColor: dim }}>
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
        </nav>

        <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          {isParent && view === "reader" && <>
            <h1 className="text-[30px] font-black tracking-[-0.02em]">{greeting()}, {user.displayName}</h1>
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

          {view === "leaderboard" && <>
            <h1 className="text-[30px] font-black tracking-[-0.02em]">Advisory Challenge</h1>
            {challenge?.challenge ? (
              <section className="flex flex-col gap-3 rounded-[18px] border p-4" style={{ background: "#1a1020", borderColor: "#5a2a20" }}>
                <p className="text-sm font-semibold leading-relaxed text-white/75">{datesText(challenge as any)}</p>
                <AdvisoryStandings view={challenge} mineName={mine?.name} />
              </section>
            ) : <p className="text-[15px]" style={{ color: "#a29fb8" }}>{challenge === undefined ? "Loading…" : "Your school has no Advisory Challenge running."}</p>}
          </>}

          {!isParent && view !== "reader" && view !== "leaderboard" && (
            <ReaderTools tab={view} openTab={(t) => { if (isReaderTab(t)) go(t); }} night />
          )}
        </main>
      </div>
    </div>
  );
}
