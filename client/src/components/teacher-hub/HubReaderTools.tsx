// Arise WorkHub's A.R.I.S.E. Reader group, built the WorkHub way: each part of the teacher's Reader
// account is its own WorkHub tab (Overview, Students, Approvals, Parents, Quizzes, Game time, Prizes),
// made of WorkHub cards, buttons, lists and pop-ups. Everything the old teacher dashboard did is here.
// The Reader pieces inside (camera-quiz review, comprehension grading, prizes, play time, email
// invites, add-ons) are the hub-built ones in components/hub-pieces.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle, Award, BookOpen, Check, CheckCircle2, ChevronRight, Clock3, Copy, ExternalLink,
  Gift, GraduationCap, KeyRound, Lock, Mail, PenLine, Printer, Search, Sparkles, Trash2, Trophy, Unlock, UserRound, Users, X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import BannerTap from "@/components/BannerTap";
import HubAddons from "@/components/hub-pieces/HubAddons";
import HubPlayTime from "@/components/hub-pieces/HubPlayTime";
import HubComprehension from "@/components/hub-pieces/HubComprehension";
import HubCameraQuizzes from "@/components/hub-pieces/HubCameraQuizzes";
import { HubPrizeManager } from "@/components/hub-pieces/HubPrizes";
import { HubFamilyInvite, HubParentInvite } from "@/components/hub-pieces/HubInvites";
import { printParentInvites } from "@/lib/parentInvites";
import type { HubTab } from "@shared/teacherHub";
import { Card, Empty, Field, GhostButton, Labeled, PrimaryButton, Select, TextArea } from "./ui";
import { HubModal } from "./HubModal";
import { ProgramLinks } from "./HubReader";

/** The WorkHub tabs that make up the teacher's A.R.I.S.E. Reader account. */
export const READER_TABS = ["reader", "readerStudents", "readerApprovals", "readerParents", "readerQuizzes", "readerGames", "readerPrizes"] as const satisfies readonly HubTab[];
export type ReaderTab = (typeof READER_TABS)[number];
export const isReaderTab = (tab: HubTab): tab is ReaderTab => (READER_TABS as readonly HubTab[]).includes(tab);

type Student = { id: number; displayName?: string; display_name?: string; username: string; totalPoints?: number; total_points?: number; quizzesTaken?: number; quizzes_taken?: number };
type SchoolStudent = { id: number; username: string; displayName: string; quizzesTaken: number; quizzesMastered: number; totalPoints: number; approvedByTeacher?: boolean; teacherId?: number; teacherName?: string | null };
type Teacher = { id: number; displayName: string; username: string };
type PendingStudent = { id: number; username: string; displayName: string; teacherName?: string | null };
type PendingQuiz = { id: number; student_name: string; book_title: string; author: string; quiz_type: string };
type BookRequest = { id: number; bookTitle: string; studentName: string; message: string; createdAt: string };
type ParentLink = { id: number; displayName: string; username: string; code: string; signupUrl: string; parents: Array<{ id: number; displayName: string; username: string; email?: string | null; accountApproved: boolean }> };
type Closing = { enabled: boolean; start: string; end: string; days: number[]; adminOverrideClosedNow?: boolean };
type Action = { student: { id: number; name: string; username: string; teacherId?: number; teacherName?: string | null }; kind: "password" | "reward" | "reassign" };

const nameOf = (s: Student) => s.displayName || s.display_name || s.username;
const pointsOf = (s: Student) => s.totalPoints ?? s.total_points ?? 0;
const quizzesOf = (s: Student) => s.quizzesTaken ?? s.quizzes_taken ?? 0;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Small inline pill, WorkHub style. */
function Pill({ tone, children }: { tone: "green" | "amber" | "red" | "slate"; children: ReactNode }) {
  const look = { green: "bg-emerald-50 text-emerald-800", amber: "bg-amber-50 text-amber-800", red: "bg-red-50 text-red-700", slate: "bg-slate-100 text-slate-600" }[tone];
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${look}`}>{children}</span>;
}

/** A row in a WorkHub list: who or what on the left, buttons on the right. */
function Row({ title, sub, right, children }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; children?: ReactNode }) {
  return <li className="rounded-2xl border border-slate-200 p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1"><div className="break-words font-semibold text-slate-900">{title}</div>{sub && <div className="mt-0.5 break-words text-sm text-slate-500">{sub}</div>}</div>
      {right && <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div>}
    </div>
    {children}
  </li>;
}

const smallBtn = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const goodBtn = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50";
const badBtn = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50";

export default function ReaderTools({ tab, openTab, night }: { tab: ReaderTab; openTab: (tab: HubTab) => void; night: boolean }) {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const approved = user?.accountApproved !== false;
  const isTeacher = user?.role === "teacher";

  const request = useCallback(async (path: string, options: RequestInit = {}) => {
    const r = await fetch(`${API_BASE}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.message || "Something went wrong. Please try again.");
    return data;
  }, [token]);

  // What the last action did, shown at the top of the tab.
  const [flash, setFlash] = useState<{ good: boolean; text: string } | null>(null);
  const done = (text: string) => { setFlash({ good: true, text }); window.setTimeout(() => setFlash((f) => (f?.text === text ? null : f)), 3200); };
  const failed = (e: unknown, text: string) => setFlash({ good: false, text: e instanceof Error ? e.message : text });

  /* ---- what every tab can count on: my class, my approvals, the proctor code and requests ---- */
  const [students, setStudents] = useState<Student[]>([]);
  const [pending, setPending] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [proctor, setProctor] = useState("");
  const [banner, setBanner] = useState<{ text: string; bgColor: string; textColor: string; active: boolean; link?: string } | null>(null);
  const [gradeChanges, setGradeChanges] = useState<any[]>([]);
  const [growth, setGrowth] = useState<any[]>([]);
  const [toGrade, setToGrade] = useState(0);
  const [bookRequests, setBookRequests] = useState<BookRequest[]>([]);

  const loadClass = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const [mine, waiting] = await Promise.all([request("/api/teacher/students"), request("/api/teacher/pending-students")]);
      setStudents(Array.isArray(mine) ? mine : []);
      setPending(Array.isArray(waiting) ? waiting : []);
    } catch (e) { setLoadError(e instanceof Error ? e.message : "Your students could not be loaded."); }
    finally { setLoading(false); }
  }, [request]);
  const loadGradeChanges = useCallback(() => request("/api/grade-change-requests").then((d) => setGradeChanges(d.requests || [])).catch(() => {}), [request]);
  const loadBookRequests = useCallback(async () => {
    try { setBookRequests((await request("/api/teacher-admin/book-requests")).requests || []); }
    catch { try { setBookRequests((await request("/api/notifications")).pendingRequestItems || []); } catch { /* none to show */ } }
  }, [request]);

  useEffect(() => {
    if (!user || !approved) { setLoading(false); return; }
    void loadClass();
    request("/api/proctor-password").then((d) => d?.password && setProctor(d.password)).catch(() => {});
    request("/api/banners").then((d) => d?.teacherBanner && setBanner(d.teacherBanner)).catch(() => {});
    request("/api/comprehension/review?limit=1").then((d) => setToGrade(Number(d?.pending) || 0)).catch(() => {});
    request("/api/teacher/growth-check/overview").then((d) => d?.attempts && setGrowth(d.attempts)).catch(() => {});
    void loadGradeChanges();
    void loadBookRequests();
  }, [user?.id, approved, loadClass, loadGradeChanges, loadBookRequests, request]);

  /* ---- the whole school (other teachers' students, AI quizzes to check) ---- */
  const [school, setSchool] = useState<{ students: SchoolStudent[]; pending: PendingStudent[]; teachers: Teacher[]; quizzes: PendingQuiz[] } | null>(null);
  const [schoolBusy, setSchoolBusy] = useState(false);
  const loadSchool = useCallback(async () => {
    setSchoolBusy(true);
    try {
      const [all, waiting, teachers, quizzes] = await Promise.all([
        request("/api/teacher-admin/all-students"), request("/api/teacher-admin/pending-students"),
        request("/api/teacher-admin/teachers"), request("/api/teacher-admin/pending-quizzes"),
      ]);
      setSchool({ students: Array.isArray(all) ? all : [], pending: Array.isArray(waiting) ? waiting : [], teachers: Array.isArray(teachers) ? teachers : [], quizzes: quizzes?.pending || [] });
    } catch (e) { failed(e, "The school list could not be loaded."); }
    finally { setSchoolBusy(false); }
  }, [request]);

  /* ---- parents and game time, loaded when their tab opens ---- */
  const [parents, setParents] = useState<ParentLink[] | null>(null);
  const [controls, setControls] = useState<any[] | null>(null);
  const [closing, setClosing] = useState<Closing | null>(null);
  const [closingBusy, setClosingBusy] = useState(false);

  useEffect(() => {
    if (!approved) return;
    if ((tab === "readerStudents" || tab === "readerApprovals") && !school && !schoolBusy) void loadSchool();
    if (tab === "readerParents" && !parents) request("/api/teacher/parent-connections").then((d) => setParents(Array.isArray(d?.students) ? d.students : [])).catch((e) => { setParents([]); failed(e, "Parent links could not be loaded."); });
    if (tab === "readerGames") {
      if (!controls) request("/api/teacher/club-arise/controls").then((d) => setControls(Array.isArray(d) ? d : [])).catch((e) => { setControls([]); failed(e, "Game controls could not be loaded."); });
      if (isTeacher && !closing) request("/api/teacher/club-closing-hours").then(setClosing).catch(() => {});
    }
  }, [tab, approved]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- actions ---- */
  const approveMine = async (id: number) => {
    try { await request(`/api/teacher/approve/${id}`, { method: "POST" }); setPending((p) => p.filter((s) => s.id !== id)); await loadClass(); done("Student approved."); }
    catch (e) { failed(e, "This student could not be approved."); }
  };
  const approveAny = async (id: number) => {
    try { await request(`/api/teacher-admin/students/${id}/approve`, { method: "POST" }); await loadSchool(); await loadClass(); done("Student approved."); }
    catch (e) { failed(e, "This student could not be approved."); }
  };
  const [quizBusy, setQuizBusy] = useState(false);
  const decideQuiz = async (id: number, ok: boolean) => {
    setQuizBusy(true);
    try {
      await request(`/api/teacher-admin/pending-quizzes/${id}/${ok ? "approve" : "reject"}`, { method: "POST", ...(ok ? {} : { body: JSON.stringify({ reason: "Please review and resubmit." }) }) });
      setSchool((s) => (s ? { ...s, quizzes: s.quizzes.filter((q) => q.id !== id) } : s));
      done(ok ? "Quiz approved." : "Quiz sent back.");
    } catch (e) { failed(e, "The quiz could not be updated."); }
    finally { setQuizBusy(false); }
  };
  const decideGrade = async (id: number, action: "approve" | "deny") => {
    try { await request(`/api/grade-change-requests/${id}`, { method: "POST", body: JSON.stringify({ action }) }); await loadGradeChanges(); await loadClass(); done(action === "approve" ? "Grade change approved." : "Grade change denied."); }
    catch (e) { failed(e, "The request could not be updated."); }
  };
  const dismissBook = async (id: number) => {
    try { await request("/api/notifications/mark-seen", { method: "POST", body: JSON.stringify({ id }) }); setBookRequests((b) => b.filter((r) => r.id !== id)); done("Request dismissed."); }
    catch (e) { failed(e, "The request could not be dismissed."); }
  };
  const copy = async (value: string, what: string) => {
    try { await navigator.clipboard.writeText(value); done(`${what} copied.`); } catch { setFlash({ good: false, text: `Could not copy the ${what.toLowerCase()}.` }); }
  };
  const printLetters = (id?: number) => printParentInvites(id).catch((e) => failed(e, "The letters could not be printed."));
  const saveControl = async (id: number, patch: Record<string, unknown>) => {
    const c = controls?.find((s: any) => s.id === id)?.control || {};
    const next = {
      locked: patch.locked ?? c.locked ?? false,
      dailyGameLimit: patch.dailyGameLimit !== undefined ? patch.dailyGameLimit : (c.daily_game_limit ?? null),
      gamesPerPassedQuiz: patch.gamesPerPassedQuiz !== undefined ? patch.gamesPerPassedQuiz : (c.games_per_passed_quiz ?? 0),
      weeklyUnlimitedOnPass: patch.weeklyUnlimitedOnPass !== undefined ? patch.weeklyUnlimitedOnPass : (c.weekly_unlimited_on_pass ?? true),
    };
    try {
      const d = await request(`/api/teacher/club-arise/controls/${id}`, { method: "POST", body: JSON.stringify(next) });
      setControls((list) => (list || []).map((s: any) => (s.id === id ? { ...s, control: d.control, access: d.access } : s)));
      done("Game controls saved.");
    } catch (e) { failed(e, "Game controls could not be saved."); }
  };
  const saveClosing = async () => {
    if (!closing) return;
    setClosingBusy(true);
    try { setClosing(await request("/api/teacher/club-closing-hours", { method: "POST", body: JSON.stringify({ enabled: closing.enabled, start: closing.start, end: closing.end, days: closing.days }) })); done("Class closing hours saved."); }
    catch (e) { failed(e, "Closing hours could not be saved."); }
    finally { setClosingBusy(false); }
  };

  /* ---- password, rewards and moving a student to another teacher (one pop-up) ---- */
  const [action, setAction] = useState<Action | null>(null);
  const openAction = (student: Action["student"], kind: Action["kind"]) => { setFlash(null); setAction({ student, kind }); };

  const approvals = pending.length + gradeChanges.length + bookRequests.length + (school ? school.quizzes.length + school.pending.length : 0);

  if (!approved) {
    return <Card title="A.R.I.S.E. Reader"><div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> Your teacher account is waiting for the administrator to approve it. Your Reader tools open here as soon as it is.</div></Card>;
  }

  const status = flash && <div role={flash.good ? "status" : "alert"} className={`flex items-start justify-between gap-3 rounded-2xl border p-3 text-sm ${flash.good ? "border-teal-200 bg-teal-50 text-teal-950" : "border-red-200 bg-red-50 text-red-800"}`}>
    <span className="flex items-start gap-2">{flash.good ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}{flash.text}</span>
    <button type="button" onClick={() => setFlash(null)} aria-label="Dismiss" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-white/60"><X className="h-4 w-4" /></button>
  </div>;

  return <div className="space-y-4" data-testid={`reader-${tab}`}>
    {status}

    {tab === "reader" && <>
      <section className="rounded-3xl bg-slate-950 p-5 text-white sm:p-6 md:p-8" data-testid="reader-overview-banner">
        <p className="text-sm font-semibold text-slate-400">A.R.I.S.E. Reader</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Your reading classroom</h1>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([["Students", students.length, "readerStudents"], ["To approve", approvals, "readerApprovals"], ["To grade", toGrade, "readerQuizzes"], ["Book requests", bookRequests.length, "readerApprovals"]] as const).map(([label, value, to]) =>
            <button key={label} type="button" onClick={() => openTab(to)} className="rounded-2xl bg-white/10 p-3 text-left transition hover:bg-white/15 sm:p-4">
              <div className="text-2xl font-bold sm:text-3xl">{loading && label === "Students" ? "…" : value}</div>
              <div className="mt-1 text-xs font-semibold text-slate-300 sm:text-sm">{label}</div>
            </button>)}
        </div>
      </section>

      {banner?.active && banner.text && <BannerTap link={banner.link} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 16px", borderRadius: 16, fontSize: 15, fontWeight: 600, background: banner.bgColor, color: banner.textColor }}><span style={{ minWidth: 0 }}>{banner.text}</span></BannerTap>}

      <Card title="Start something" collapseKey="reader-start">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <Launch icon={<Trophy className="h-5 w-5" />} title="Host a live quiz" detail="Your class plays together" onClick={() => navigate("/live-quiz")} main />
          <Launch icon={<GraduationCap className="h-5 w-5" />} title="Study Squad sets" detail="Practice sets for your class" onClick={() => navigate("/study")} />
          <Launch icon={<Trophy className="h-5 w-5" />} title="Leaderboard" detail="See who's reading the most" onClick={() => navigate("/leaderboard")} />
          <Launch icon={<BookOpen className="h-5 w-5" />} title="Scenes" detail="Live reading scenes" onClick={() => navigate("/teacher-scenes")} />
          <Launch icon={<Sparkles className="h-5 w-5" />} title="What A.R.I.S.E. 2.0 can do" detail="Live games, game time and quiz tracking" onClick={() => navigate("/teacher-arise-2")} />
          {!user?.isAdmin && <Launch icon={<Award className="h-5 w-5" />} title="Your plan" detail="Plans, add-ons and billing" onClick={() => navigate("/billing")} />}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Needs you" collapseKey="reader-needs">
          <ul className="space-y-2">
            <NeedRow icon={<UserRound className="h-4 w-4" />} label="Students waiting to join" count={pending.length} onOpen={() => openTab("readerApprovals")} />
            <NeedRow icon={<PenLine className="h-4 w-4" />} label="Reading comprehension to grade" count={toGrade} onOpen={() => openTab("readerQuizzes")} />
            <NeedRow icon={<GraduationCap className="h-4 w-4" />} label="Grade change requests" count={gradeChanges.length} onOpen={() => openTab("readerApprovals")} />
            <NeedRow icon={<BookOpen className="h-4 w-4" />} label="Book requests" count={bookRequests.length} onOpen={() => openTab("readerApprovals")} />
          </ul>
        </Card>
        <Card title="Proctor code" collapseKey="reader-proctor">
          <ProctorCode code={proctor} onCopy={() => proctor && void copy(proctor, "Proctor code")} />
        </Card>
      </div>

      <ProgramLinks />
      <Card title="Add-ons for your class" collapseKey="reader-addons"><HubAddons which="work" /></Card>
    </>}

    {tab === "readerStudents" && <StudentsTab
      students={students} loading={loading} loadError={loadError} school={school} schoolBusy={schoolBusy}
      onView={(id) => navigate(`/student-profile/${id}`)} onMessage={(id) => navigate(`/messages/${id}`)} onCertificates={(id) => navigate(`/student-certificates/${id}`)}
      onAction={openAction} />}

    {tab === "readerApprovals" && <>
      <Card title={`Students waiting to join your class${pending.length ? ` (${pending.length})` : ""}`}>
        {loading ? <Empty>Loading…</Empty> : pending.length ? <ul className="space-y-2">{pending.map((s) =>
          <Row key={s.id} title={nameOf(s)} sub={`@${s.username}`} right={<button type="button" className={goodBtn} onClick={() => void approveMine(s.id)} data-testid={`button-approve-student-${s.id}`}><Check className="h-4 w-4" /> Approve</button>} />)}</ul>
          : <Empty>No one is waiting.</Empty>}
      </Card>
      <Card title={`Grade change requests${gradeChanges.length ? ` (${gradeChanges.length})` : ""}`}>
        {gradeChanges.length ? <ul className="space-y-2">{gradeChanges.map((r) =>
          <Row key={r.id} title={r.studentName} sub={`Grade ${r.currentGrade} → grade ${r.requestedGrade}`} right={<>
            <button type="button" className={goodBtn} onClick={() => void decideGrade(r.id, "approve")}><Check className="h-4 w-4" /> Approve</button>
            <button type="button" className={badBtn} onClick={() => void decideGrade(r.id, "deny")}><X className="h-4 w-4" /> Deny</button>
          </>} />)}</ul> : <Empty>No grade change requests.</Empty>}
      </Card>
      <Card title={`Book requests${bookRequests.length ? ` (${bookRequests.length})` : ""}`}>
        {bookRequests.length ? <ul className="space-y-2">{bookRequests.map((r) =>
          <Row key={r.id} title={r.bookTitle} sub={<>Requested by {r.studentName} · {new Date(r.createdAt).toLocaleDateString()}{r.message ? <span className="mt-1 block text-slate-600">{r.message}</span> : null}</>}
            right={<button type="button" className={smallBtn} onClick={() => void dismissBook(r.id)}>Dismiss</button>} />)}</ul> : <Empty>No book requests from students yet.</Empty>}
      </Card>
      <Card title={`AI quizzes to check${school?.quizzes.length ? ` (${school.quizzes.length})` : ""}`}>
        {!school ? <Empty>Loading…</Empty> : school.quizzes.length ? <ul className="space-y-2">{school.quizzes.map((q) =>
          <Row key={q.id} title={q.book_title} sub={`by ${q.author || "Unknown"} · made by ${q.student_name} · ${q.quiz_type || "book"} quiz`} right={<>
            <button type="button" disabled={quizBusy} className={goodBtn} onClick={() => void decideQuiz(q.id, true)}><Check className="h-4 w-4" /> Approve</button>
            <button type="button" disabled={quizBusy} className={badBtn} onClick={() => void decideQuiz(q.id, false)}><X className="h-4 w-4" /> Send back</button>
          </>} />)}</ul> : <Empty>No quizzes waiting.</Empty>}
      </Card>
      <Card title={`Students waiting across the school${school?.pending.length ? ` (${school.pending.length})` : ""}`} collapseKey="reader-school-pending">
        {!school ? <Empty>Loading…</Empty> : school.pending.length ? <ul className="space-y-2">{school.pending.map((s) =>
          <Row key={s.id} title={s.displayName || s.username} sub={`@${s.username}${s.teacherName ? ` · ${s.teacherName}` : ""}`} right={<button type="button" className={goodBtn} onClick={() => void approveAny(s.id)}><Check className="h-4 w-4" /> Approve</button>} />)}</ul>
          : <Empty>No one is waiting.</Empty>}
      </Card>
    </>}

    {tab === "readerParents" && <>
      <Card title="Parent codes and letters" right={<PrimaryButton onClick={() => printLetters()}><Printer className="h-4 w-4" /> Print letters for my class</PrimaryButton>}>
        <p className="text-sm text-slate-600">Give each family their private code or sign-up link, print letters, and see which parent and guardian accounts are already connected to your students.</p>
      </Card>
      <Card title="Invite a family that isn't signed up yet" collapseKey="reader-family-email"><HubFamilyInvite which="work" /></Card>
      <Card title="Your students' families">
        {!parents ? <Empty>Loading…</Empty> : parents.length ? <ul className="space-y-3">{parents.map((s) =>
          <Row key={s.id} title={s.displayName} sub={`@${s.username}`} right={<Pill tone={s.parents.length ? "green" : "amber"}>{s.parents.length ? `${s.parents.length} linked` : "Not linked"}</Pill>}>
            <div className="mt-3 grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
              <div className="flex items-center gap-2"><code className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-base font-semibold tracking-wider text-slate-900">{s.code}</code><button type="button" className={smallBtn} onClick={() => void copy(s.code, "Parent code")}><Copy className="h-4 w-4" /> Copy</button></div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button type="button" className={smallBtn} onClick={() => printLetters(s.id)}><Printer className="h-4 w-4" /> Letter</button>
                <button type="button" className={smallBtn} onClick={() => void copy(s.signupUrl, "Sign-up link")}><Copy className="h-4 w-4" /> Link</button>
                <a className={smallBtn} href={s.signupUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Sign-up page</a>
              </div>
            </div>
            {s.parents.length > 0 && <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">{s.parents.map((p) =>
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="min-w-0"><span className="font-medium text-slate-800">{p.displayName}</span> <span className="text-slate-500">@{p.username}{p.email ? ` · ${p.email}` : ""}</span></span><Pill tone={p.accountApproved ? "green" : "slate"}>{p.accountApproved ? "Active" : "Pending"}</Pill></li>)}</ul>}
            <div className="mt-3 border-t border-slate-100 pt-3"><HubParentInvite which="work" studentId={s.id} studentName={s.displayName} /></div>
          </Row>)}</ul> : <Empty>No students are assigned to you.</Empty>}
      </Card>
    </>}

    {tab === "readerQuizzes" && <>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Proctor code"><ProctorCode code={proctor} onCopy={() => proctor && void copy(proctor, "Proctor code")} />
          <p className="mt-3 text-sm text-slate-600">After every book quiz, students can also write about the book for up to 10 extra points, with your code or on their own with the camera on. You grade those below.</p>
        </Card>
        <Card title="Growth check">
          {growth.length ? <ul className="space-y-2">{growth.map((a: any) => <Row key={a.id} title={a.studentName || "Student"} sub={`Score ${a.score}/${a.totalQuestions} · ${a.wcpm ? `${a.wcpm} words a minute` : "no reading speed"}`} />)}</ul> : <Empty>No growth checks yet.</Empty>}
        </Card>
      </div>
      <Card title={`Reading comprehension to grade${toGrade ? ` (${toGrade})` : ""}`}><HubComprehension which="work" onPendingChange={setToGrade} /></Card>
      <Card title="Camera quizzes"><HubCameraQuizzes which="work" /></Card>
    </>}

    {tab === "readerGames" && <>
      <Card title="Game time" collapseKey="reader-playtime">
        <p className="mb-3 text-sm text-slate-600">Passing a book quiz unlocks unlimited A.R.I.S.E. games for the rest of that week (Monday to Sunday). You can turn that off for any student, lock their games, or set limits. Your locks always win.</p>
        <HubPlayTime which="work" />
      </Card>
      {isTeacher && <Card title="Class closing hours" collapseKey="reader-closing">
        {!closing ? <Empty>Loading…</Empty> : <div className="space-y-4">
          {closing.adminOverrideClosedNow && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Club A.R.I.S.E. is closed by the administrator right now. Your hours can't reopen it until that ends.</div>}
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-slate-800"><input type="checkbox" className="h-5 w-5" checked={closing.enabled} onChange={(e) => setClosing({ ...closing, enabled: e.target.checked })} /> Close Club A.R.I.S.E. for my class at set times</label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Labeled label="Closes at"><Field type="time" value={closing.start} onChange={(e) => setClosing({ ...closing, start: e.target.value })} /></Labeled>
            <Labeled label="Opens again at"><Field type="time" value={closing.end} onChange={(e) => setClosing({ ...closing, end: e.target.value })} /></Labeled>
          </div>
          <div><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Days it starts</span>
            <div className="flex flex-wrap gap-1.5">{DAYS.map((d, i) => { const on = closing.days.includes(i); return <button key={d} type="button" aria-pressed={on} onClick={() => setClosing({ ...closing, days: on ? closing.days.filter((x) => x !== i) : [...closing.days, i].sort((a, b) => a - b) })}
              className={`min-h-11 min-w-12 rounded-xl px-3 text-sm font-semibold ${on ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{d}</button>; })}</div></div>
          <div className="flex flex-wrap items-center gap-3"><PrimaryButton disabled={closingBusy} onClick={() => void saveClosing()}><Clock3 className="h-4 w-4" /> {closingBusy ? "Saving…" : "Save closing hours"}</PrimaryButton><span className="text-xs text-slate-500">Mountain Time. A closing time later than the opening time runs overnight.</span></div>
        </div>}
      </Card>}
      <Card title="Each student">
        {!controls ? <Empty>Loading…</Empty> : controls.length ? <ul className="grid gap-3 xl:grid-cols-2">{controls.map((s: any) => {
          const c = s.control || {}, a = s.access || {};
          return <Row key={s.id} title={s.display_name || s.username} sub={`@${s.username} · ${a.allowed ? "Can play now" : a.locked ? "Locked by you" : a.dailyRemaining === 0 ? "Used today's games" : "Needs another passed quiz"}`}
            right={<button type="button" className={c.locked ? goodBtn : badBtn} onClick={() => void saveControl(s.id, { locked: !c.locked })}>{c.locked ? <><Unlock className="h-4 w-4" /> Unlock</> : <><Lock className="h-4 w-4" /> Lock</>}</button>}>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Labeled label="Passed quiz reward"><Select value={(c.weekly_unlimited_on_pass ?? true) ? "on" : "off"} onChange={(e) => void saveControl(s.id, { weeklyUnlimitedOnPass: e.target.value === "on" })}><option value="on">Unlimited that week</option><option value="off">Off</option></Select></Labeled>
              <Labeled label="Games a day"><Select value={c.daily_game_limit ?? ""} onChange={(e) => void saveControl(s.id, { dailyGameLimit: e.target.value === "" ? null : Number(e.target.value) })}><option value="">No limit</option>{[1, 2, 3, 5, 10, 20].map((n) => <option key={n} value={n}>{n} a day</option>)}</Select></Labeled>
              <Labeled label="Games per passed quiz"><Select value={c.games_per_passed_quiz ?? 0} onChange={(e) => void saveControl(s.id, { gamesPerPassedQuiz: Number(e.target.value) })}><option value={0}>Off</option>{[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}</Select></Labeled>
            </div>
          </Row>;
        })}</ul> : <Empty>No students are assigned to you.</Empty>}
      </Card>
    </>}

    {tab === "readerPrizes" && <Card title="Prizes"><HubPrizeManager which="work" token={token} role="teacher" /></Card>}

    {action && <StudentAction action={action} request={request} teachers={school?.teachers || []} onClose={() => setAction(null)}
      onDone={(text, reload) => { done(text); setAction(null); if (reload) { void loadSchool(); void loadClass(); } }} />}
  </div>;
}

function Launch({ icon, title, detail, onClick, main }: { icon: ReactNode; title: string; detail: string; onClick: () => void; main?: boolean }) {
  return <button type="button" onClick={onClick} className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${main ? "border-slate-950 bg-slate-950 text-white hover:bg-slate-800" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
    <span className={`rounded-xl p-2 ${main ? "bg-white/10" : "bg-teal-50 text-teal-700"}`}>{icon}</span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className={`block text-xs ${main ? "text-slate-300" : "text-slate-500"}`}>{detail}</span></span>
    <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
  </button>;
}

function NeedRow({ icon, label, count, onOpen }: { icon: ReactNode; label: string; count: number; onOpen: () => void }) {
  return <li><button type="button" onClick={onOpen} className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-slate-50 px-3 text-left text-sm hover:bg-slate-100">
    <span className="text-slate-500">{icon}</span><span className="min-w-0 flex-1 font-medium text-slate-800">{label}</span>
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${count ? "bg-amber-100 text-amber-900" : "bg-white text-slate-400"}`}>{count}</span>
  </button></li>;
}

function ProctorCode({ code, onCopy }: { code: string; onCopy: () => void }) {
  return <div className="flex flex-wrap items-center gap-3">
    <code className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-2xl font-bold tracking-[.2em] text-slate-950" data-testid="reader-proctor-code">{code || "Not set"}</code>
    <GhostButton onClick={onCopy}><Copy className="h-4 w-4" /> Copy</GhostButton>
    <p className="w-full text-sm text-slate-600">Students type this to start a proctored quiz. Share it only while you're proctoring.</p>
  </div>;
}

function StudentsTab({ students, loading, loadError, school, schoolBusy, onView, onMessage, onCertificates, onAction }: {
  students: Student[]; loading: boolean; loadError: string; school: { students: SchoolStudent[]; teachers: Teacher[] } | null; schoolBusy: boolean;
  onView: (id: number) => void; onMessage: (id: number) => void; onCertificates: (id: number) => void; onAction: (s: Action["student"], kind: Action["kind"]) => void;
}) {
  const [which, setWhich] = useState<"mine" | "school">("mine");
  const [q, setQ] = useState("");
  const [teacher, setTeacher] = useState("");
  const needle = q.trim().toLowerCase();
  const mine = useMemo(() => students.filter((s) => !needle || nameOf(s).toLowerCase().includes(needle) || s.username.toLowerCase().includes(needle)), [students, needle]);
  const all = useMemo(() => (school?.students || []).filter((s) => (!needle || (s.displayName || "").toLowerCase().includes(needle) || s.username.toLowerCase().includes(needle)) && (!teacher || String(s.teacherId) === teacher)), [school, needle, teacher]);
  const iconBtn = "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950";
  return <Card title={which === "mine" ? `My class (${students.length})` : `Whole school (${school?.students.length ?? "…"})`}
    right={<div className="flex rounded-xl border border-slate-200 p-1" role="tablist" aria-label="Which students">
      {(["mine", "school"] as const).map((w) => <button key={w} type="button" role="tab" aria-selected={which === w} onClick={() => setWhich(w)} className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${which === w ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{w === "mine" ? "My class" : "Whole school"}</button>)}
    </div>}>
    <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Field value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or username" className="pl-9" aria-label="Search students" /></label>
      {which === "school" && <Select value={teacher} onChange={(e) => setTeacher(e.target.value)} aria-label="Teacher" className="sm:w-56"><option value="">Every teacher</option>{(school?.teachers || []).map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}</Select>}
    </div>
    {which === "mine" ? (loading ? <Empty>Loading your students…</Empty> : loadError ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{loadError}</div>
      : mine.length ? <ul className="space-y-2">{mine.map((s) => <li key={s.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:p-4" data-testid={`card-student-${s.id}`}>
        <div className="min-w-0 flex-1"><div className="font-semibold text-slate-900">{nameOf(s)}</div><div className="text-sm text-slate-500">@{s.username} · {pointsOf(s).toLocaleString()} points · {quizzesOf(s)} quizzes</div></div>
        <div className="-m-1 flex flex-wrap items-center">
          <button type="button" className={iconBtn} onClick={() => onView(s.id)}><UserRound className="h-4 w-4" /> Profile</button>
          <button type="button" className={iconBtn} onClick={() => onMessage(s.id)}><Mail className="h-4 w-4" /> Message</button>
          <button type="button" className={iconBtn} onClick={() => onCertificates(s.id)}><Award className="h-4 w-4" /> Certificates</button>
          <button type="button" className={iconBtn} onClick={() => onAction({ id: s.id, name: nameOf(s), username: s.username }, "password")}><KeyRound className="h-4 w-4" /> Password</button>
        </div>
      </li>)}</ul> : <Empty>{students.length ? "No one matches that search." : "No students have joined your class yet. They join with your class code."}</Empty>)
      : schoolBusy && !school ? <Empty>Loading the school…</Empty> : all.length ? <ul className="space-y-2">{all.map((s) => <li key={s.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">{s.displayName || s.username}{!s.approvedByTeacher && <Pill tone="amber">Waiting</Pill>}</div>
          <div className="text-sm text-slate-500">@{s.username}{s.teacherName ? ` · ${s.teacherName}` : ""} · {s.totalPoints || 0} points · {s.quizzesTaken || 0} quizzes · {s.quizzesMastered || 0} mastered</div></div>
        <div className="-m-1 flex flex-wrap items-center">
          <button type="button" className={iconBtn} onClick={() => onView(s.id)}><UserRound className="h-4 w-4" /> Profile</button>
          <button type="button" className={iconBtn} onClick={() => onAction({ id: s.id, name: s.displayName || s.username, username: s.username, teacherId: s.teacherId, teacherName: s.teacherName }, "password")}><KeyRound className="h-4 w-4" /> Password</button>
          <button type="button" className={iconBtn} onClick={() => onAction({ id: s.id, name: s.displayName || s.username, username: s.username, teacherId: s.teacherId, teacherName: s.teacherName }, "reward")}><Gift className="h-4 w-4" /> Rewards</button>
          <button type="button" className={iconBtn} onClick={() => onAction({ id: s.id, name: s.displayName || s.username, username: s.username, teacherId: s.teacherId, teacherName: s.teacherName }, "reassign")}><Users className="h-4 w-4" /> Move</button>
        </div>
      </li>)}</ul> : <Empty>No students found.</Empty>}
  </Card>;
}

function StudentAction({ action, request, teachers, onClose, onDone }: {
  action: Action; request: (path: string, options?: RequestInit) => Promise<any>; teachers: Teacher[];
  onClose: () => void; onDone: (text: string, reload?: boolean) => void;
}) {
  const { student, kind } = action;
  const [password, setPassword] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [count, setCount] = useState("");
  const [to, setTo] = useState("");
  const [rewards, setRewards] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const loadRewards = useCallback(() => request(`/api/teacher-admin/students/${student.id}/rewards`).then((d) => setRewards(d.rewards || [])).catch(() => setRewards([])), [request, student.id]);
  useEffect(() => { if (kind === "reward") void loadRewards(); }, [kind, loadRewards]);

  const run = async (work: () => Promise<void>) => { setBusy(true); setError(""); try { await work(); } catch (e) { setError(e instanceof Error ? e.message : "That didn't work. Try again."); } finally { setBusy(false); } };
  const resetPassword = () => run(async () => {
    if (password.length < 4) throw new Error("Use at least 4 characters.");
    // A teacher's own student uses the class route; anyone else goes through the school route.
    await request(`/api/teacher-admin/students/${student.id}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword: password }) });
    onDone(`${student.name}'s password was changed.`);
  });
  const addReward = () => run(async () => {
    if (!title.trim() || !message.trim()) throw new Error("Give the reward a title and a message.");
    await request(`/api/teacher-admin/students/${student.id}/rewards`, { method: "POST", body: JSON.stringify({ title, message, requiredQuizCount: count || undefined }) });
    setTitle(""); setMessage(""); setCount(""); await loadRewards();
  });
  const removeReward = (id: number) => run(async () => { await request(`/api/teacher-admin/students/${student.id}/rewards/${id}`, { method: "DELETE" }); await loadRewards(); });
  const move = () => run(async () => {
    if (!to) throw new Error("Pick a teacher.");
    const d = await request(`/api/teacher-admin/students/${student.id}/reassign`, { method: "POST", body: JSON.stringify({ newTeacherId: Number(to) }) });
    onDone(d.message || `${student.name} was moved.`, true);
  });

  const heading = kind === "password" ? "Change password" : kind === "reward" ? "Rewards" : "Move to another teacher";
  return <HubModal title={heading} onClose={onClose} closeOnBackdrop>
    <div className="space-y-4">
      <p className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{student.name}</span> @{student.username}</p>
      {kind === "password" && <form onSubmit={(e) => { e.preventDefault(); void resetPassword(); }} className="space-y-3">
        <Labeled label="New password"><Field value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="off" /></Labeled>
        <PrimaryButton type="submit" disabled={busy}><KeyRound className="h-4 w-4" /> Change password</PrimaryButton>
      </form>}
      {kind === "reward" && <>
        <form onSubmit={(e) => { e.preventDefault(); void addReward(); }} className="space-y-3">
          <Labeled label="Title"><Field value={title} onChange={(e) => setTitle(e.target.value)} placeholder="10 Quiz Champion" /></Labeled>
          <Labeled label="Message"><TextArea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What the student sees" /></Labeled>
          <Labeled label="Quizzes needed (optional)"><Field type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} placeholder="5" /></Labeled>
          <PrimaryButton type="submit" disabled={busy}><Gift className="h-4 w-4" /> Add reward</PrimaryButton>
        </form>
        {rewards.length > 0 && <ul className="space-y-2 border-t border-slate-100 pt-4">{rewards.map((r) => <li key={r.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 p-3">
          <div className="min-w-0"><div className="font-semibold text-slate-900">{r.title}</div><div className="text-sm text-slate-600">{r.message}</div>
            <div className="mt-1 flex flex-wrap gap-2">{r.requiredQuizCount ? <Pill tone="slate">{r.requiredQuizCount} quizzes</Pill> : null}<Pill tone={r.active ? "green" : "slate"}>{r.active ? "Active" : "Inactive"}</Pill></div></div>
          <button type="button" aria-label={`Delete ${r.title}`} disabled={busy} onClick={() => void removeReward(r.id)} className="-m-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
        </li>)}</ul>}
      </>}
      {kind === "reassign" && <form onSubmit={(e) => { e.preventDefault(); void move(); }} className="space-y-3">
        <Labeled label="New teacher"><Select value={to} onChange={(e) => setTo(e.target.value)}><option value="">Choose a teacher</option>{teachers.filter((t) => t.id !== student.teacherId).map((t) => <option key={t.id} value={t.id}>{t.displayName} (@{t.username})</option>)}</Select></Labeled>
        {student.teacherName && <p className="text-sm text-slate-500">Now with {student.teacherName}.</p>}
        <PrimaryButton type="submit" disabled={busy}><Users className="h-4 w-4" /> Move student</PrimaryButton>
      </form>}
      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
    </div>
  </HubModal>;
}
