import { ForwardingCard, useHubInbox } from "@/components/teacher-hub/HubInbox";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  BookHeart,
  BookOpen,
  Calendar,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  Home,
  ImagePlus,
  Link2,
  ListChecks,
  LogOut,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  Save,
  Settings2,
  Sparkles,
  StickyNote,
  Trash2,
  Upload,
  Flag,
  Target,
  Timer,
  Moon,
  Sun,
  Repeat,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PLANS, usd } from "@shared/plans";
import { addDays, dueState, friendlyDate, relativeDays, type DueState } from "@shared/hubDates";
import { TASK_SORTS, arrangeTasks, clearDone, restoreTasks, saveTask, taskCounts, undoTask, type TaskFilter, type TaskSort } from "@shared/hubTasks";
import { cleanSenderName } from "@shared/hubMeetings";
import { deadlineLabel, meetingDeadline } from "@shared/meetingDeadline";
import { HUB_GROUPS, SUB_LABELS, groupLabel, groupOf, groupTabs, openGroup, visibleGroups, type HubGroupId } from "@shared/hubTabGroups";
import "@/components/teacher-hub/hubNight.css";
import { GoalsTab, MinutesTab } from "@/components/teacher-hub/HubProgress";
import { HubModal } from "@/components/teacher-hub/HubModal";
import {
  HUB_IMPORT, HUB_IMPORT_KINDS, clock12, cleanHubImport, describeHubAdded, mergeHubImport, updateStudent,
  type AttendanceEntry, type HubImportItems, type HubTab, type Student, type Task, type Workspace,
} from "@shared/teacherHub";
import { addStudentWithTeam, draftHasAnyone, emptyTeamDraft, teamDraft, teamMembers, updateStudentWithTeam, type StudentDetails, type TeamDraft } from "@shared/hubStudentTeam";
import { StudentTeamFields, StudentTeamSummary } from "@/components/teacher-hub/HubStudentTeam";
import { deleteRow, deleteStudentRecords, studentRecordCount, undoDelete, type Deleted } from "@shared/hubDelete";
import { BottomStack, useToasts, type ToastAction } from "@/components/teacher-hub/HubToast";
import { ConflictDialog, HubDataPanel, SaveBadge, SaveNotice, SizeNotice, downloadHubCopy } from "@/components/teacher-hub/HubSaveUI";
import { useHubWorkspace } from "@/components/teacher-hub/useHubWorkspace";
import HubSetupBanner from "@/components/teacher-hub/HubSetupBanner";
import { Card, Empty, Field, GhostButton, Labeled, PrimaryButton, Select, TextArea } from "@/components/teacher-hub/ui";
import HubMeetingPolls, { type PollStart } from "@/components/teacher-hub/HubMeetingPoll";
import type { WizardState } from "@/components/teacher-hub/HubMeetingSteps";
import { STEP_COUNT, firstOpen, stepsDone } from "@shared/meetingSteps";
import HubNotifications from "@/components/teacher-hub/HubNotifications";
import HubImport, { localDay } from "@/components/teacher-hub/HubImport";
import { RecentlyDone, TaskModal, taskChecker } from "@/components/teacher-hub/HubTaskEdit";
import HubNotes from "@/components/teacher-hub/HubNotes";
import StudentProfileView from "@/components/teacher-hub/HubStudentProfile";
import HubCalendarTab, { AddEventModal, CalendarPanel, useCalendarRefresh } from "@/components/teacher-hub/HubCalendar";
import { addQuickItems, quickAddedMessage, type QuickItems } from "@shared/hubQuickAdd";
import { addEmailToTasks, arrangeEmails, emailCounts, emailTask, toggleEmailFlag, type EmailFilter } from "@shared/hubEmails";
import HubGuideTab from "@/components/teacher-hub/HubGuide";
import PinBanners, { PinButton } from "@/components/teacher-hub/HubPins";

// Today where the teacher is (not in London: an evening in Denver is already tomorrow there).
const TODAY = () => localDay();
const id = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const TAB_META: Array<{ id: HubTab; label: string; icon: ReactNode }> = [
  { id: "overview", label: "Home", icon: <Home className="h-4 w-4" /> },
  { id: "calendar", label: "Calendar", icon: <Calendar className="h-4 w-4" /> },
  { id: "caseload", label: "Caseload", icon: <Users className="h-4 w-4" /> },
  { id: "goals", label: "Goals", icon: <Target className="h-4 w-4" /> },
  { id: "minutes", label: "Minutes", icon: <Timer className="h-4 w-4" /> },
  { id: "iep", label: "IEP & Meetings", icon: <CalendarDays className="h-4 w-4" /> },
  { id: "guide", label: "IEP Guide", icon: <ListChecks className="h-4 w-4" /> },
  { id: "lessons", label: "Lessons", icon: <BookOpen className="h-4 w-4" /> },
  { id: "tasks", label: "Tasks", icon: <CheckSquare className="h-4 w-4" /> },
  { id: "notes", label: "Notes", icon: <StickyNote className="h-4 w-4" /> },
  { id: "arise", label: "A.R.I.S.E.", icon: <BookHeart className="h-4 w-4" /> },
  { id: "behavior", label: "Behavior", icon: <Sparkles className="h-4 w-4" /> },
  { id: "attendance", label: "Attendance", icon: <ClipboardCheck className="h-4 w-4" /> },
  { id: "gradebook", label: "Gradebook", icon: <GraduationCap className="h-4 w-4" /> },
  { id: "parents", label: "Parents", icon: <MessageSquare className="h-4 w-4" /> },
  { id: "schedules", label: "Schedules", icon: <Clock3 className="h-4 w-4" /> },
  { id: "email", label: "Email", icon: <Mail className="h-4 w-4" /> },
];

/** The icon for each place in the menu (see shared/hubTabGroups.ts for which tabs share a place). */
const GROUP_ICON: Record<HubGroupId, ReactNode> = {
  home: <Home className="h-4 w-4" />, calendar: <Calendar className="h-4 w-4" />, caseload: <Users className="h-4 w-4" />,
  iep: <CalendarDays className="h-4 w-4" />, progress: <Target className="h-4 w-4" />, tasks: <CheckSquare className="h-4 w-4" />,
  classroom: <BookOpen className="h-4 w-4" />, behavior: <Sparkles className="h-4 w-4" />, family: <MessageSquare className="h-4 w-4" />,
  arise: <BookHeart className="h-4 w-4" />,
};
const tabIcon = (tab: HubTab) => TAB_META.find((t) => t.id === tab)?.icon;

function dateValue(date: string) {
  const t = Date.parse(date);
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

function TeacherHubLogin() {
  const { login, user } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err?.message || "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  if (user) return null;

  return (
    <div className="min-h-screen bg-slate-100 px-3 py-6 sm:px-5 sm:py-12">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl sm:rounded-[2rem] md:grid-cols-[1.05fr_.95fr]">
        <div className="bg-slate-950 p-6 text-white sm:p-8 md:p-12">
          <div className="mb-6 text-xs font-semibold md:mb-16 uppercase tracking-[.28em] text-slate-400">A.R.I.S.E.</div>
          <h1 className="max-w-lg text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Teacher Hub</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
            Your private teacher workspace for caseloads, IEP timelines, lessons, tasks, student notes,
            attendance, grades, family communication, A.R.I.S.E. records, schedules, and more.
          </p>
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            Your Hub is saved to your teacher account, so it is waiting for you on any device after you sign in.
          </div>
        </div>
        <form onSubmit={submit} className="p-6 sm:p-8 md:p-12">
          <p className="text-sm font-semibold text-slate-500">Teacher account</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Sign in</h2>
          <div className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Username</label>
              <Field value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
              <Field
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <PrimaryButton type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Open Teacher Hub"}
            </PrimaryButton>
          </div>
          <div className="mt-8 border-t border-slate-100 pt-6">
            <p className="text-sm text-slate-600">New teacher?</p>
            <a
              href="#/teacher-signup"
              className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-950 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
            >
              <Plus className="h-4 w-4" />
              Create a teacher account
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Shown to a teacher without a Teacher Hub plan. */
function HubPaywall({ isAdmin }: { isAdmin: boolean }) {
  const H = PLANS.hub;
  const features = [
    "Caseloads with accommodations, IEP and reevaluation dates",
    "IEP and meeting timelines",
    "Lesson plans, reminders and to-dos",
    "Check-ins, concerns and meeting notes",
    "Attendance with CSV export, a gradebook and behavior points",
    "Parent contact logs, weekly schedules and an email organizer",
    "Add with AI: paste a list, snap a screenshot, or upload Excel, Word or PDF",
    "Connect your Google, Outlook or Apple calendar",
  ];
  return (
    <div className="min-h-screen bg-slate-100 px-3 py-6 sm:px-5 sm:py-12">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl sm:rounded-[2rem] md:grid-cols-[1.05fr_.95fr]">
        <div className="bg-slate-950 p-6 text-white sm:p-8 md:p-12">
          <div className="mb-6 flex flex-wrap items-center gap-3 md:mb-12">
            <span className="text-xs font-semibold uppercase tracking-[.28em] text-slate-400">A.R.I.S.E.</span>
            <span className="rounded-full border border-teal-300/50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-teal-200">Add-on</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Teacher Hub</h1>
          <p className="mt-4 text-base leading-7 text-slate-300">Your private teacher workspace, saved to your account and waiting on any device.</p>
          <ul className="mt-6 space-y-3 text-sm leading-6 text-slate-200">
            {features.map((f) => (
              <li key={f} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" />{f}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-5 p-6 sm:p-8 md:p-12">
          <div>
            <p className="text-sm font-semibold text-slate-500">Teacher Hub is a paid add-on</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Get Teacher Hub</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 p-4">
              <div><div className="font-semibold text-slate-950">One teacher</div><div className="mt-1 text-sm text-slate-600">Up to {H.studentsPerBlock} students. Add {usd(H.monthlyCents)} a month for each extra {H.studentsPerBlock}.</div></div>
              <div className="shrink-0 text-right"><div className="text-xl font-bold text-slate-950">{usd(H.monthlyCents)}</div><div className="text-xs text-slate-500">a month</div></div>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 p-4">
              <div><div className="font-semibold text-slate-950">Whole school</div><div className="mt-1 text-sm text-slate-600">Every teacher gets their own Hub, up to {H.schoolStudentCap.toLocaleString("en-US")} students.</div></div>
              <div className="shrink-0 text-right"><div className="text-xl font-bold text-slate-950">{usd(H.schoolYearlyCents)}</div><div className="text-xs text-slate-500">a year</div></div>
            </div>
          </div>
          <p className="text-sm text-slate-600">Teacher Hub is sold on its own. It isn't included with A.R.I.S.E. Premium or a free school account.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {!isAdmin && <a href="#/billing" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-slate-950 px-5 text-base font-semibold text-white hover:bg-slate-800" data-testid="hub-get">Get Teacher Hub</a>}
            <a href="#/teacher-dashboard" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-200 px-5 text-base font-semibold text-slate-700 hover:bg-slate-50">Back to dashboard</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TeacherHub() {
  const { user } = useAuth();
  // Signing in as someone else starts with a clean page, so one teacher's Hub is never shown to the next.
  return <TeacherHubPage key={user?.id ?? "signed-out"} />;
}

function TeacherHubPage() {
  const { user, token, logout } = useAuth();
  // Coming back from connecting a mailbox lands on the meetings tab, where the polls are.
  const [tab, setTab] = useState<HubTab>(() => (/[?&]mailbox=/.test(window.location.search) ? "iep" : "overview"));
  const [customize, setCustomize] = useState(false);
  // Night mode: the choice is remembered on this phone or computer.
  const [night, setNight] = useState(() => { try { return localStorage.getItem("arise-hub-night") === "1"; } catch { return false; } });
  function toggleNight() {
    setNight((v) => { try { localStorage.setItem("arise-hub-night", v ? "0" : "1"); } catch { /* the choice just isn't remembered */ } return !v; });
  }
  // "Add with AI": the panel that reads pasted text, photos and files into the Hub.
  const [adding, setAdding] = useState<{ start?: "photo" | "file" } | null>(null);
  const [added, setAdded] = useState<{ words: string; tab: HubTab | null } | null>(null);
  // The tab used last in each group, so tapping the group opens it again.
  const [lastInGroup, setLastInGroup] = useState<Partial<Record<HubGroupId, HubTab>>>({});
  useEffect(() => { setLastInGroup((prev) => (prev[groupOf(tab).id] === tab ? prev : { ...prev, [groupOf(tab).id]: tab })); }, [tab]);
  // The IEP guide that is open. It is kept here so it is still open after a look at another tab.
  const [guideId, setGuideId] = useState<string | null>(null);

  const canUseHub = !!user && (user.role === "teacher" || user.isAdmin);
  // Opening the Hub and keeping it saved (see useHubWorkspace).
  const sync = useHubWorkspace({ enabled: canUseHub, token, userId: user?.id });
  const { workspace, setWorkspace, loaded, loadError, needsPlan, seats, view, bytes } = sync;
  const toasts = useToasts();
  const latest = useRef(workspace);
  latest.current = workspace;

  // The "added" message belongs to the screen it appeared on.
  useEffect(() => { setAdded(null); }, [tab]);

  // Connected calendars are read again when the Hub opens.
  useCalendarRefresh(loaded && !loadError && !needsPlan && canUseHub, token, workspace.calendars, setWorkspace, id);
  // Work emails forwarded to the teacher's Hub address land in Emails, flagged, and on the to-do list.
  useHubInbox(loaded && !loadError && !needsPlan && canUseHub, token, workspace, setWorkspace, id, TODAY, (n) => toasts.show(n === 1 ? "A forwarded email was added to your to-do list." : `${n} forwarded emails were added to your to-do list.`, [{ label: "View", run: () => setTab("tasks") }]));

  const [quickEvent, setQuickEvent] = useState(false);
  /** The student whose profile is open on the Caseload tab. It stays open while the teacher looks at another tab and comes back. */
  const [profileStudent, setProfileStudent] = useState<string | null>(null);
  /** Checks a to-do off (or back on) and offers Undo for a few seconds. It can also be undone from "Done in the last day". */
  const checkTask = taskChecker(() => workspace.tasks, setWorkspace, (text, actions) => { toasts.show(text, actions); });
  const undoCheck = (taskId: string) => setWorkspace((p) => ({ ...p, tasks: undoTask(p.tasks, taskId, Date.now()) }));
  /** The to-do being changed from the To do card on Home. */
  const [homeTask, setHomeTask] = useState<string | null>(null);
  const [homeQuick, setHomeQuick] = useState("");
  const openTasks = workspace.tasks.filter((t) => !t.done).length;
  /** A reminder added from the pop-up lands on another screen, so say where it went. */
  const reminderAdded = (items: QuickItems) => { toasts.show(quickAddedMessage(items), tab === "tasks" ? [] : [{ label: "View", run: () => setTab("tasks") }]); };

  /** Adds what the teacher checked in "Add with AI", and says what happened. */
  function addFound(items: HubImportItems) {
    const safe = cleanHubImport(items, TODAY());
    const result = mergeHubImport(workspace, safe, id, seats);
    setWorkspace((prev) => mergeHubImport(prev, safe, id, seats).workspace);
    const most = HUB_IMPORT_KINDS.filter((kind) => result.added[kind]).sort((a, b) => (result.added[b] || 0) - (result.added[a] || 0))[0];
    setAdded({ words: describeHubAdded(result), tab: most ? HUB_IMPORT[most].tab : null });
    setAdding(null);
  }

  const upcomingMeetings = useMemo(
    () => workspace.meetings.filter((m) => !m.done).sort((a, b) => dateValue(a.date) - dateValue(b.date)).slice(0, 5),
    [workspace.meetings],
  );

  const dueTasks = useMemo(
    () => workspace.tasks.filter((t) => !t.done).sort((a, b) => dateValue(a.dueDate) - dateValue(b.dueDate)).slice(0, 6),
    [workspace.tasks],
  );

  const behaviorTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const entry of workspace.behavior) totals[entry.student] = (totals[entry.student] || 0) + Number(entry.points || 0);
    return totals;
  }, [workspace.behavior]);

  const scheduleWarnings = useMemo(() => {
    const warnings: string[] = [];
    const entries = [...workspace.schedules];
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        if (a.student !== b.student || a.day !== b.day) continue;
        if (a.start < b.end && b.start < a.end) warnings.push(`${a.student}: ${a.day} ${a.label} overlaps ${b.label}`);
      }
    }
    return [...new Set(warnings)];
  }, [workspace.schedules]);

  function update<K extends keyof Workspace>(key: K, value: Workspace[K]) {
    setWorkspace((prev) => ({ ...prev, [key]: value }));
  }

  /** Deletes a row and says so with an Undo button, so one wrong tap costs nothing. */
  function remove<K extends keyof Workspace>(key: K, rowId: string) {
    const result = deleteRow(workspace, key, rowId);
    if (!result) return;
    setWorkspace((prev) => deleteRow(prev, key, rowId)?.workspace ?? prev);
    const actions: ToastAction[] = [{ label: "Undo", run: () => setWorkspace((prev) => undoDelete(prev, result.deleted)) }];
    let text = result.deleted.label;
    let records = 0;
    if (key === "students") {
      const name = String((result.deleted.parts[0].rows[0].row as Student).name);
      records = studentRecordCount(result.workspace, name);
      // Their notes, grades and the rest stay until the teacher says to clear them.
      if (records) {
        text += ` · ${records} ${records === 1 ? "record" : "records"} in your other tabs kept`;
        actions.push({ label: records === 1 ? "Delete it too" : "Delete them too", run: () => clearStudentRecords(name, result.deleted) });
      }
    }
    toasts.show(text, actions, records ? 15_000 : 10_000);
  }

  /** Clears what the other tabs kept under a deleted student's name. One Undo brings back the student and all of it. */
  function clearStudentRecords(name: string, studentDeleted: Deleted) {
    const result = deleteStudentRecords(latest.current, name);
    if (!result) return;
    setWorkspace((prev) => deleteStudentRecords(prev, name)?.workspace ?? prev);
    const count = result.deleted.parts.reduce((total, part) => total + part.rows.length, 0);
    const both: Deleted = { label: `Deleted ${name} and ${count} ${count === 1 ? "record" : "records"}`, parts: [...studentDeleted.parts, ...result.deleted.parts] };
    toasts.show(both.label, [{ label: "Undo", run: () => setWorkspace((prev) => undoDelete(prev, both)) }]);
  }

  function studentOptions(includeAll = false) {
    return (
      <>
        <option value="">Choose student</option>
        {includeAll && <option value="Whole group">Whole group</option>}
        {workspace.students.map((student) => (
          <option key={student.id} value={student.name}>{student.name}</option>
        ))}
      </>
    );
  }

  function exportAttendance() {
    const rows = [["Date", "Student", "Class", "Status"], ...workspace.attendance.map((a) => [a.date, a.student, a.className, a.status])];
    const csv = rows.map((row) => row.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "teacher-hub-attendance.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  /** Anything still waiting is saved before the sign-out. */
  async function signOut() {
    await sync.flush();
    logout();
  }

  if (!user) return <TeacherHubLogin />;

  if (!canUseHub) {
    return (
      <div className="min-h-screen bg-slate-100 px-5 py-16">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-4 text-2xl font-bold text-slate-950">Teacher accounts only</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Sign in with an approved teacher account to open the Teacher Hub.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <GhostButton onClick={logout}><LogOut className="h-4 w-4" /> Sign out</GhostButton>
            <a href="#/teacher-signup" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Create teacher account</a>
          </div>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-slate-100 px-5 py-16">
        <div className="mx-auto flex max-w-xl items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          <span className="text-sm font-medium text-slate-700">Opening your Teacher Hub…</span>
        </div>
      </div>
    );
  }

  if (needsPlan) return <HubPaywall isAdmin={!!user.isAdmin} />;

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-100 px-5 py-16">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
          <h1 className="mt-4 text-2xl font-bold text-slate-950">Teacher Hub could not open</h1>
          <p className="mt-2 text-sm text-slate-600">{loadError}</p>
          <button className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white" onClick={sync.reload}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const menu = visibleGroups(workspace.visibleTabs);
  const group = groupOf(tab);
  const subTabs = groupTabs(group.id, workspace.visibleTabs);

  return (
    <div className={`min-h-screen w-full max-w-[100vw] overflow-x-clip bg-slate-100 text-slate-950 ${night ? "hub-night" : ""}`}>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 md:px-6">
          <a href={user.isAdmin ? "#/admin" : "#/teacher-dashboard"} className="min-w-0 rounded-xl" aria-label={user.isAdmin ? "Back to admin" : "Back to your dashboard"} title={user.isAdmin ? "Back to admin" : "Back to your dashboard"}>
            <div className="text-xs font-bold uppercase tracking-[.22em] text-slate-400">A.R.I.S.E.</div>
            <div className="truncate text-xl font-bold tracking-tight">Teacher Hub</div>
          </a>
          <div className="flex items-center gap-2">
            <SaveBadge view={view} />
            <button type="button" onClick={toggleNight} aria-pressed={night} aria-label={night ? "Switch to day mode" : "Switch to night mode"} title={night ? "Day mode" : "Night mode"} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-700 transition hover:bg-slate-50" data-testid="hub-night-toggle">{night ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
            <button type="button" onClick={() => setAdding({})} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 sm:px-4" data-testid="hub-add-with-ai">
              <WandSparkles className="h-4 w-4" /> <span>Add<span className="hidden sm:inline"> with AI</span></span>
            </button>
            <button type="button" onClick={() => setCustomize((v) => !v)} aria-label="Customize tabs and your data" aria-expanded={customize} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"><Settings2 className="h-4 w-4" /> <span className="hidden sm:inline">Customize tabs</span></button>
            <button type="button" onClick={signOut} aria-label="Sign out" title="Sign out" className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] grid-cols-[minmax(0,1fr)] gap-4 px-4 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:px-6">
        <aside className="min-w-0 sticky top-[69px] z-30 -mx-4 bg-slate-100/95 px-4 py-1 backdrop-blur md:mx-0 md:bg-transparent md:p-0 md:top-[73px] md:h-[calc(100vh-90px)] md:self-start">
          <div className="flex snap-x gap-2 overflow-x-auto rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border border-slate-200 bg-white p-2 shadow-sm md:h-full md:flex-col md:overflow-y-auto">
            <div className="hidden px-3 py-3 md:block">
              <p className="truncate text-sm font-semibold text-slate-900">{user.displayName}</p>
              <p className="truncate text-xs text-slate-500">@{user.username}</p>
            </div>
            {menu.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(openGroup(item.id, workspace.visibleTabs, lastInGroup))}
                aria-current={group.id === item.id ? "page" : undefined}
                data-testid={`hub-menu-${item.id}`}
                className={`flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition md:w-full ${group.id === item.id ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
              >
                {GROUP_ICON[item.id]}
                <span className="whitespace-nowrap md:whitespace-normal">{groupLabel(item.id, workspace.visibleTabs)}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0 space-y-4 pb-[max(5rem,env(safe-area-inset-bottom))]">
          <HubSetupBanner token={token} isAdmin={!!user.isAdmin} />
          <PinBanners workspace={workspace} setWorkspace={setWorkspace} />
          <SizeNotice bytes={bytes} onDownload={() => downloadHubCopy(workspace)} />
          {added && (
            <div className="flex flex-col gap-2 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950 sm:flex-row sm:items-center sm:justify-between" role="status" data-testid="hub-added">
              <span>{added.words}</span>
              <span className="flex shrink-0 items-center gap-2">
                {added.tab && added.tab !== tab && (
                  <button type="button" onClick={() => { setTab(added.tab!); setAdded(null); }} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">
                    Open {TAB_META.find((t) => t.id === added.tab)?.label}
                  </button>
                )}
                <button type="button" onClick={() => setAdded(null)} aria-label="Dismiss" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-teal-900 hover:bg-teal-100"><X className="h-4 w-4" /></button>
              </span>
            </div>
          )}
          {customize && (
            <Card title="Customize tabs" right={<button onClick={() => setCustomize(false)} className="text-sm font-medium text-slate-500">Close</button>}>
              <p className="mb-4 text-sm text-slate-600">Hide anything you do not use. Hiding a tab does not delete its records. Tabs that go together share one place in the menu.</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {HUB_GROUPS.filter((g) => g.id !== "home").map((g) => (
                  <div key={g.id} className="rounded-xl border border-slate-200 p-2" data-testid={`customize-${g.id}`}>
                    {g.tabs.length > 1 && <div className="flex items-center gap-2 px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{GROUP_ICON[g.id]}{g.label}</div>}
                    {g.tabs.map((t) => (
                      <label key={t} className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg px-1 text-sm">
                        <span className="flex items-center gap-2">{g.tabs.length > 1 ? tabIcon(t) : GROUP_ICON[g.id]}{g.tabs.length > 1 ? SUB_LABELS[t] : g.label}</span>
                        <input
                          type="checkbox" className="h-5 w-5 shrink-0"
                          checked={workspace.visibleTabs[t] !== false}
                          onChange={(e) => setWorkspace((prev) => ({
                            ...prev,
                            visibleTabs: { ...prev.visibleTabs, [t]: e.target.checked },
                          }))}
                        />
                      </label>
                    ))}
                  </div>
                ))}
              </div>
              <HubDataPanel workspace={workspace} bytes={bytes} token={token} onAdopt={sync.adopt} />
            </Card>
          )}

          {subTabs.length > 1 && (
            <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label={group.label} data-testid="hub-subtabs">
              {subTabs.map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} data-testid={`hub-subtab-${t}`}
                  className={`flex min-h-11 flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition ${tab === t ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>
                  {tabIcon(t)} {SUB_LABELS[t] ?? t}
                </button>
              ))}
            </div>
          )}

          {tab === "overview" && (
            <>
              <div className="rounded-3xl bg-slate-950 p-5 text-white sm:p-6 md:rounded-[2rem] md:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-400">Welcome back, {user.displayName.split(" ")[0]}</p>
                    <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">Your teacher workspace</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Everything here saves to your account automatically.</p>
                  </div>
                  <div className="grid w-full grid-cols-3 gap-2 text-center lg:w-auto">
                    <div className="rounded-2xl bg-white/10 px-2 py-3 sm:px-4"><div className="text-2xl font-bold">{workspace.students.length}</div><div className="text-[11px] text-slate-300">Students</div></div>
                    <div className="rounded-2xl bg-white/10 px-2 py-3 sm:px-4"><div className="text-2xl font-bold">{workspace.tasks.filter((t) => !t.done).length}</div><div className="text-[11px] text-slate-300">Open tasks</div></div>
                    <div className="rounded-2xl bg-white/10 px-2 py-3 sm:px-4"><div className="text-2xl font-bold">{workspace.meetings.filter((m) => !m.done).length}</div><div className="text-[11px] text-slate-300">Meetings</div></div>
                  </div>
                </div>
              </div>

              <Card title="Add things fast">
                <p className="mb-4 text-sm text-slate-600">Skip the typing. AI reads what you give it and sorts it into your Hub, and you check it before anything is saved.</p>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <QuickAdd icon={<WandSparkles className="h-5 w-5" />} title="Paste or ask" detail="A list, notes, an email, or “plan my week”" onClick={() => setAdding({})} />
                  <QuickAdd icon={<ImagePlus className="h-5 w-5" />} title="Photo or screenshot" detail="Reminders, notes or a calendar" onClick={() => setAdding({ start: "photo" })} />
                  <QuickAdd icon={<Upload className="h-5 w-5" />} title="Upload a file" detail="Excel, Word, PDF or CSV" onClick={() => setAdding({ start: "file" })} />
                  <QuickAdd icon={<Link2 className="h-5 w-5" />} title="Connect a calendar" detail="Google, Outlook or Apple" onClick={() => setTab("calendar")} />
                </div>
              </Card>

              <CalendarPanel workspace={workspace} setWorkspace={setWorkspace} token={token} makeId={id} title="Your calendar" onReminderAdded={reminderAdded} agendaToday />

              <div className="grid gap-4 xl:grid-cols-3">
                <Card title="Upcoming IEP / reevaluation meetings">
                  {upcomingMeetings.length ? (
                    <div className="space-y-2">
                      {upcomingMeetings.map((m) => (
                        <button key={m.id} onClick={() => setTab("iep")} className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-left hover:bg-slate-100">
                          <div><div className="font-medium">{m.student || "Student"}</div><div className="text-xs text-slate-500">{m.type}</div></div>
                          <div className="text-sm font-semibold text-slate-700">{m.date ? friendlyDate(m.date, TODAY()) : "No date"}{m.time ? ` · ${clock12(m.time)}` : ""}</div>
                        </button>
                      ))}
                    </div>
                  ) : <Empty>No upcoming meetings yet.</Empty>}
                </Card>

                <Card title="To do" right={<button type="button" onClick={() => setTab("tasks")} className="min-h-11 shrink-0 text-sm font-medium text-teal-800 underline decoration-teal-200 underline-offset-4" data-testid="home-tasks-all">See all{openTasks > dueTasks.length ? ` ${openTasks}` : ""}</button>}>
                  <form onSubmit={(e) => { e.preventDefault(); const title = homeQuick.trim(); if (!title) return; setWorkspace((p) => ({ ...p, tasks: saveTask(p.tasks, null, { title, dueDate: "", recurring: "", priority: false }, id) })); setHomeQuick(""); }} className="mb-3 flex gap-2" data-testid="home-task-add">
                    <Field placeholder="Add a to-do and press Enter" aria-label="Quick add a to-do" value={homeQuick} onChange={(e) => setHomeQuick(e.target.value)} maxLength={200} />
                    <PrimaryButton type="submit" disabled={!homeQuick.trim()}>Add</PrimaryButton>
                  </form>
                  {dueTasks.length ? (
                    <ul className="space-y-2">
                      {dueTasks.map((task) => <TaskRow key={task.id} task={task} today={TODAY()} workspace={workspace} setWorkspace={setWorkspace} makeId={id} onToggle={checkTask} onEdit={(t) => setHomeTask(t.id)} onDelete={(t) => remove("tasks", t.id)} />)}
                    </ul>
                  ) : <Empty>Nothing due right now.</Empty>}
                  <RecentlyDone tasks={workspace.tasks} onUndo={undoCheck} limit={4} />
                </Card>
              </div>

              <HubNotifications token={token} />

              <Card title="Workspace profile">
                <div className="grid gap-3 md:grid-cols-3">
                  <Field placeholder="School" value={workspace.profile.school} onChange={(e) => setWorkspace((p) => ({ ...p, profile: { ...p.profile, school: e.target.value } }))} />
                  <Field placeholder="Grade / band" value={workspace.profile.gradeBand} onChange={(e) => setWorkspace((p) => ({ ...p, profile: { ...p.profile, gradeBand: e.target.value } }))} />
                  <Field placeholder="Subject / role" value={workspace.profile.subject} onChange={(e) => setWorkspace((p) => ({ ...p, profile: { ...p.profile, subject: e.target.value } }))} />
                </div>
              </Card>
            </>
          )}

          {tab === "calendar" && <HubCalendarTab workspace={workspace} setWorkspace={setWorkspace} token={token} makeId={id} onReminderAdded={reminderAdded} />}
          {tab === "caseload" && <Caseload workspace={workspace} setWorkspace={setWorkspace} remove={remove} seats={seats} profileId={profileStudent} setProfileId={setProfileStudent} openTab={setTab} />}
          {tab === "goals" && <GoalsTab workspace={workspace} setWorkspace={setWorkspace} remove={remove} makeId={id} today={TODAY()} />}
          {tab === "minutes" && <MinutesTab workspace={workspace} setWorkspace={setWorkspace} remove={remove} makeId={id} today={TODAY()} token={token} />}
          {tab === "iep" && <Meetings workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} token={token} makeId={id} openGuide={(guideId) => { setGuideId(guideId); setTab("guide"); }} account={{ name: cleanSenderName(String((user as any)?.displayName || (user as any)?.username || "")), email: String((user as any)?.email || "") }} />}
          {tab === "guide" && <HubGuideTab workspace={workspace} setWorkspace={setWorkspace} makeId={id} sender={{ name: user.displayName, school: workspace.profile.school }} openId={guideId} setOpenId={setGuideId} />}
          {tab === "lessons" && <Lessons workspace={workspace} setWorkspace={setWorkspace} remove={remove} />}
          {tab === "tasks" && <Tasks workspace={workspace} setWorkspace={setWorkspace} remove={remove} makeId={id} toast={(text, actions) => { toasts.show(text, actions); }} />}
          {tab === "notes" && <HubNotes workspace={workspace} setWorkspace={setWorkspace} remove={remove} makeId={id} />}
          {tab === "arise" && <Arise workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} />}
          {tab === "behavior" && <Behavior workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} totals={behaviorTotals} />}
          {tab === "attendance" && <Attendance workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} exportAttendance={exportAttendance} />}
          {tab === "gradebook" && <Gradebook workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} />}
          {tab === "parents" && <Parents workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} />}
          {tab === "schedules" && <Schedules workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} warnings={scheduleWarnings} />}
          {tab === "email" && <ForwardingCard token={token} isAdmin={!!user?.isAdmin} />}
          {tab === "email" && <Emails workspace={workspace} setWorkspace={setWorkspace} remove={remove} toast={(text, actions) => { toasts.show(text, actions); }} onViewTasks={() => setTab("tasks")} />}
        </main>
      </div>
      {canUseHub && loaded && !loadError && !needsPlan && (
        <button type="button" onClick={() => setQuickEvent(true)} aria-label="Add an event or a reminder" data-testid="quick-add-event"
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-teal-600 px-5 text-base font-semibold text-white shadow-lg hover:bg-teal-700">
          <Plus className="h-5 w-5" /> Event
        </button>
      )}
      {quickEvent && <AddEventModal onClose={() => setQuickEvent(false)} onAdd={(items) => { setWorkspace((p) => addQuickItems(p, items, id)); if (items.task) reminderAdded(items); }} />}
      {homeTask && workspace.tasks.some((t) => t.id === homeTask) && <TaskModal task={workspace.tasks.find((t) => t.id === homeTask) || null} today={TODAY()}
        onSave={(fields) => setWorkspace((p) => ({ ...p, tasks: saveTask(p.tasks, homeTask, fields, id) }))} onClose={() => setHomeTask(null)} onDelete={() => remove("tasks", homeTask)} />}
      {adding && <HubImport token={token} students={workspace.students.map((s) => s.name)} start={adding.start} onAdd={addFound} onClose={() => setAdding(null)} />}
      {view.kind === "blocked" && view.block === "conflict" && <ConflictDialog onUseNewest={sync.useNewest} onKeepMine={sync.keepMine} onDownload={() => downloadHubCopy(workspace)} />}
      <BottomStack toasts={toasts}><SaveNotice view={view} onRetry={sync.retryNow} onDownload={() => downloadHubCopy(workspace)} /></BottomStack>
    </div>
  );
}

/** One to-do, the same on every screen: check it off, tap it to change it, pin it, delete it. */
function TaskRow({ task, today, workspace, setWorkspace, makeId, onToggle, onEdit, onDelete }: { task: Task; today: string; workspace: Workspace; setWorkspace: SectionProps["setWorkspace"]; makeId: () => string; onToggle: (task: Task) => void; onEdit: (task: Task) => void; onDelete: (task: Task) => void }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-200 p-3" data-testid="task-row">
      <input type="checkbox" className="h-6 w-6 shrink-0" aria-label={`Done: ${task.title}`} checked={task.done} onChange={() => onToggle(task)} />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onEdit(task)} aria-label={`Edit ${task.title}`} data-testid="task-edit">
        <div className={task.done ? "break-words text-slate-400 line-through" : "break-words font-medium"}>{task.priority === "high" && <Flag className="mr-1 inline h-4 w-4 text-red-500" aria-label="Important" />}{task.title}</div>
        {task.notes && <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words text-xs text-slate-500" data-testid="task-notes">{task.notes}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          {!task.done && <DueChip date={task.dueDate} today={today} />}
          {task.done && task.dueDate && <span>Was due {friendlyDate(task.dueDate, today)}</span>}
          {!task.dueDate && !task.done && <span>No due date</span>}
          {task.recurring && <span className="inline-flex items-center gap-1"><Repeat className="h-3.5 w-3.5" />{task.recurring}</span>}
          {task.emailId && <span className="inline-flex items-center gap-1" data-testid="task-from-email"><Mail className="h-3.5 w-3.5" />From an email</span>}
          {task.lastDone && <span>Last done {friendlyDate(task.lastDone, today)}</span>}
          <span className="inline-flex items-center gap-1 font-medium text-teal-700"><Pencil className="h-3.5 w-3.5" />Edit</span>
        </div>
      </button>
      <PinButton workspace={workspace} setWorkspace={setWorkspace} kind="task" refId={task.id} title={task.title} makeId={makeId} />
      <button type="button" aria-label={`Delete ${task.title}`} className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => onDelete(task)}><Trash2 className="h-4 w-4" /></button>
    </li>
  );
}

function QuickAdd({ icon, title, detail, onClick }: { icon: ReactNode; title: string; detail: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-teal-300 hover:bg-teal-50">
      <span className="shrink-0 text-teal-700">{icon}</span>
      <span className="min-w-0"><span className="block text-sm font-semibold text-slate-900">{title}</span><span className="block text-xs text-slate-500">{detail}</span></span>
    </button>
  );
}

type SectionProps = {
  workspace: Workspace;
  setWorkspace: React.Dispatch<React.SetStateAction<Workspace>>;
  remove: <K extends keyof Workspace>(key: K, rowId: string) => void;
};

const NO_DETAILS: StudentDetails = { name: "", grade: "", accommodations: "", iepDate: "", reevalDate: "", readingLevel: "", mathLevel: "", notes: "", disability1: "", disability2: "" };

function Caseload({ workspace, setWorkspace, remove, seats, profileId, setProfileId, openTab }: SectionProps & { seats: number | null; profileId: string | null; setProfileId: (studentId: string | null) => void; openTab: (tab: HubTab) => void }) {
  const [form, setForm] = useState<StudentDetails>({ ...NO_DETAILS });
  // The new student's IEP team. It is typed in the same form and saved with the student, by the one "Add student" button.
  const [formTeam, setFormTeam] = useState<TeamDraft>(emptyTeamDraft);
  // The disabilities and team part of the add form stays folded away until it is asked for, or has something in it.
  const [more, setMore] = useState(false);
  const moreFilled = !!form.disability1 || !!form.disability2 || draftHasAnyone(formTeam);
  const moreOpen = more || moreFilled;
  // The plan covers this many students; the caseload can't grow past it.
  const full = seats !== null && workspace.students.length >= seats;
  // The reason a student could not be added (a name already on the caseload, say).
  const [addError, setAddError] = useState("");
  function add(e: FormEvent) {
    e.preventDefault();
    if (full) return;
    const result = addStudentWithTeam(workspace, form, formTeam, id, seats);
    if (!result.ok) { setAddError(result.message); return; }
    setWorkspace((p) => { const next = addStudentWithTeam(p, form, formTeam, id, seats); return next.ok ? next.workspace : p; });
    setForm({ ...NO_DETAILS });
    setFormTeam(emptyTeamDraft());
    setMore(false);
    setAddError("");
  }

  // The student being changed and what has been typed so far. One at a time.
  const [editing, setEditing] = useState<{ id: string; form: StudentDetails; team: TeamDraft; error: string; /** Where typing starts: the name, or the disabilities and team. */ start: "name" | "team" } | null>(null);
  function startEdit(student: Student, start: "name" | "team" = "name") {
    const { id: studentId, team: _team, ...saved } = student;
    // A student saved long ago, or read in from a file, may be missing a field.
    setEditing({ id: studentId, form: { ...NO_DETAILS, ...saved }, team: teamDraft(workspace, student.name), error: "", start });
  }
  function typed(change: Partial<StudentDetails>) {
    setEditing((now) => (now ? { ...now, form: { ...now.form, ...change }, error: "" } : now));
  }
  function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const result = updateStudentWithTeam(workspace, editing.id, editing.form, editing.team, id);
    if (!result.ok) { setEditing({ ...editing, error: result.message }); return; }
    setWorkspace((p) => { const saved = updateStudentWithTeam(p, editing.id, editing.form, editing.team, id); return saved.ok ? saved.workspace : p; });
    setEditing(null);
  }
  // A new name is carried to the student's meetings, notes, grades and the rest; say so before it is saved.
  const preview = editing ? updateStudent(workspace, editing.id, editing.form) : null;
  const following = preview && preview.ok ? preview.moved : 0;

  // One student's whole picture takes the place of the list until the teacher goes back.
  if (profileId && workspace.students.some((s) => s.id === profileId)) {
    return <StudentProfileView workspace={workspace} setWorkspace={setWorkspace} studentId={profileId} today={TODAY()} makeId={id} onBack={() => setProfileId(null)} onPick={setProfileId} onOpenTab={openTab}
      onEdit={(studentId) => { const student = workspace.students.find((s) => s.id === studentId); setProfileId(null); if (student) startEdit(student); }} />;
  }

  return (
    <>
      <Card title="Caseload" right={seats !== null ? <span className="shrink-0 text-xs font-medium text-slate-500">{workspace.students.length} of {seats.toLocaleString("en-US")}</span> : undefined}>
        {full && (
          <div className="mb-4 flex flex-col gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <span>Your plan covers {seats!.toLocaleString("en-US")} students, and your caseload is full.</span>
            <a href="#/billing" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">Add {PLANS.hub.studentsPerBlock} more</a>
          </div>
        )}
        <form onSubmit={add} className="grid gap-3 md:grid-cols-4">
          <Field placeholder="Student name" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setAddError(""); }} required aria-label="Student name" aria-invalid={!!addError} />
          <Field placeholder="Grade" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
          <Field placeholder="Reading level" value={form.readingLevel} onChange={(e) => setForm({ ...form, readingLevel: e.target.value })} />
          <Field placeholder="Math level" value={form.mathLevel} onChange={(e) => setForm({ ...form, mathLevel: e.target.value })} />
          <Labeled label="IEP deadline"><Field type="date" value={form.iepDate} onChange={(e) => setForm({ ...form, iepDate: e.target.value })} /></Labeled>
          <Labeled label="Reevaluation deadline"><Field type="date" value={form.reevalDate} onChange={(e) => setForm({ ...form, reevalDate: e.target.value })} /></Labeled>
          <Field placeholder="Accommodations" value={form.accommodations} onChange={(e) => setForm({ ...form, accommodations: e.target.value })} className="md:col-span-2" />
          <TextArea placeholder="Quick notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="md:col-span-4" />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 md:col-span-4" data-testid="hub-student-more">
            {/* Once something is typed in it, it stays open, so nothing is saved that can't be seen. */}
            <button type="button" aria-expanded={moreOpen} disabled={moreFilled} onClick={() => setMore(!more)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left text-sm font-semibold text-slate-800 sm:px-4" data-testid="hub-student-more-toggle">
              <span>Disabilities and IEP team <span className="font-normal text-slate-500">(optional)</span></span>
              {!moreFilled && <span className="shrink-0 font-medium text-teal-800 underline decoration-teal-200 underline-offset-4">{moreOpen ? "Hide" : "Add"}</span>}
            </button>
            {moreOpen && <div className="border-t border-slate-200 p-3 sm:p-4"><StudentTeamFields details={form} onDetails={(change) => { setForm((p) => ({ ...p, ...change })); setAddError(""); }} draft={formTeam} onDraft={(draft) => { setFormTeam(draft); setAddError(""); }} contacts={workspace.spedContacts} /></div>}
          </div>
          {addError && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-4" role="alert">{addError}</div>}
          <div className="md:col-span-4"><PrimaryButton type="submit"><Plus className="h-4 w-4" /> Add student</PrimaryButton></div>
        </form>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        {workspace.students.length ? workspace.students.map((s) => editing?.id === s.id ? (
          <Card key={s.id} title={`Edit ${s.name}`}>
            <form onSubmit={saveEdit} onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); }} className="grid gap-3 sm:grid-cols-2" data-testid="hub-student-edit-form">
              <Labeled label="Student name"><Field value={editing.form.name} onChange={(e) => typed({ name: e.target.value })} required autoFocus={editing.start === "name"} /></Labeled>
              <Labeled label="Grade"><Field value={editing.form.grade} onChange={(e) => typed({ grade: e.target.value })} /></Labeled>
              <Labeled label="Reading level"><Field value={editing.form.readingLevel} onChange={(e) => typed({ readingLevel: e.target.value })} /></Labeled>
              <Labeled label="Math level"><Field value={editing.form.mathLevel} onChange={(e) => typed({ mathLevel: e.target.value })} /></Labeled>
              <Labeled label="IEP deadline"><Field type="date" value={editing.form.iepDate} onChange={(e) => typed({ iepDate: e.target.value })} /></Labeled>
              <Labeled label="Reevaluation deadline"><Field type="date" value={editing.form.reevalDate} onChange={(e) => typed({ reevalDate: e.target.value })} /></Labeled>
              <Labeled label="Accommodations" className="sm:col-span-2"><Field value={editing.form.accommodations} onChange={(e) => typed({ accommodations: e.target.value })} /></Labeled>
              <Labeled label="Quick notes" className="sm:col-span-2"><TextArea value={editing.form.notes} onChange={(e) => typed({ notes: e.target.value })} /></Labeled>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2 sm:p-4">
                <div className="mb-3 text-sm font-semibold text-slate-800">Disabilities and IEP team <span className="font-normal text-slate-500">(optional)</span></div>
                <StudentTeamFields details={editing.form} onDetails={typed} draft={editing.team} onDraft={(team) => setEditing((now) => (now ? { ...now, team, error: "" } : now))} contacts={workspace.spedContacts} autoFocus={editing.start === "team"} />
              </div>
              {following > 0 && (
                <p className="text-sm text-slate-600 sm:col-span-2">
                  {following === 1 ? "1 record" : `${following} records`} for {s.name} in your other tabs will show the new name too.
                </p>
              )}
              {editing.error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2" role="alert">{editing.error}</div>}
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <PrimaryButton type="submit"><Save className="h-4 w-4" /> Save changes</PrimaryButton>
                <GhostButton onClick={() => setEditing(null)}>Cancel</GhostButton>
              </div>
            </form>
          </Card>
        ) : (
          <Card key={s.id} title={s.name} right={
            <div className="-m-2 flex shrink-0 items-center">
              <button type="button" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950" onClick={() => startEdit(s)} data-testid="hub-student-edit"><Pencil className="h-4 w-4" /> Edit</button>
              <button type="button" aria-label="Delete" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("students", s.id)}><Trash2 className="h-4 w-4" /></button>
            </div>
          }>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <Info label="Grade" value={s.grade || "—"} />
              <Info label="Reading" value={s.readingLevel || "—"} />
              <Info label="Math" value={s.mathLevel || "—"} />
              <Info label="IEP deadline" value={s.iepDate || "—"} />
              <Info label="Reeval deadline" value={s.reevalDate || "—"} />
              <Info label="Accommodations" value={s.accommodations || "—"} />
              {s.disability1 && <Info label="Disability 1" value={s.disability1} />}
              {s.disability2 && <Info label="Disability 2" value={s.disability2} />}
            </div>
            <StudentTeamSummary workspace={workspace} student={s.name} />
            {!s.disability1 && !s.disability2 && teamMembers(workspace, s.name).length === 0 && (
              <button type="button" onClick={() => startEdit(s, "team")} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50" data-testid="hub-student-add-team"><Plus className="h-4 w-4" /> Add disabilities and IEP team</button>
            )}
            {s.notes && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{s.notes}</div>}
            <button type="button" onClick={() => setProfileId(s.id)} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-teal-900 hover:bg-teal-100" data-testid="hub-student-profile"><Users className="h-4 w-4" /> See everything for {s.name.split(/\s+/)[0]}</button>
          </Card>
        )) : <div className="xl:col-span-2"><Empty>Add students to start your caseload.</Empty></div>}
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 text-slate-700">{value}</div></div>;
}

function Meetings({ workspace, setWorkspace, remove, studentOptions, token, makeId, account, openGuide }: SectionProps & { studentOptions: () => ReactNode; token: string | null; makeId: () => string; account: { name: string; email: string }; openGuide: (guideId: string) => void }) {
  const [pollStart, setPollStart] = useState<PollStart>(null);
  const [wizard, setWizard] = useState<WizardState | null>(null);
  return (
    <>
      <Card title="IEP, reevaluation & meeting timeline" right={<PrimaryButton onClick={() => setWizard({ step: 1, meetingId: null })}><Plus className="h-4 w-4" /> Add meeting</PrimaryButton>}>
        <p className="text-sm text-slate-600">Tap “Add meeting”. A short guide walks you through the steps, from picking a time with everyone to sending the final copy. You can skip any step and come back to it.</p>
      </Card>
      <Card title="Timeline">
        {workspace.meetings.length ? <div className="space-y-2">{[...workspace.meetings].sort((a,b)=>Number(a.done)-Number(b.done)||dateValue(a.date)-dateValue(b.date)).map((m) => (
          <div key={m.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 sm:items-center">
            <input type="checkbox" className="h-5 w-5 shrink-0" checked={m.done} onChange={() => setWorkspace((p) => ({ ...p, meetings: p.meetings.map((x) => x.id === m.id ? { ...x, done: !x.done } : x) }))} />
            <div className="min-w-0 flex-1">
              <div className={`font-semibold ${m.done ? "text-slate-400 line-through" : ""}`}>{m.student} · {m.type}</div>
              <div className="mt-1 text-sm text-slate-500">{m.date ? `${friendlyDate(m.date, TODAY())}${m.date >= TODAY() ? ` (${relativeDays(m.date, TODAY())})` : ""}` : "No meeting date yet"}{m.time ? ` · ${clock12(m.time)}` : ""}{m.room ? ` · ${m.room}` : ""}{m.notes ? ` · ${m.notes}` : ""}</div>
              {meetingDeadline(workspace, m) && <div className="mt-0.5 text-xs font-medium text-slate-600" data-testid="meeting-deadline">{deadlineLabel(m.type).replace(/ date$/, "")}: {friendlyDate(meetingDeadline(workspace, m), TODAY())}{!m.done && meetingDeadline(workspace, m) >= TODAY() ? ` (${relativeDays(meetingDeadline(workspace, m), TODAY())})` : ""}</div>}
              <button type="button" onClick={() => setWizard({ step: firstOpen(m.plan), meetingId: m.id })} className="mt-1 mr-4 min-h-11 text-sm font-medium text-teal-800 underline decoration-teal-200 underline-offset-4" data-testid="open-steps">{stepsDone(m.plan) ? `Steps: ${stepsDone(m.plan)} of ${STEP_COUNT} done` : "Start the steps"}</button>
              {!m.done && <button type="button" onClick={() => setPollStart({ meetingId: m.id, title: `${m.type}${m.student ? ` for ${m.student.split(" ")[0]}` : ""}` })} className="mt-1 min-h-11 text-sm font-medium text-teal-800 underline decoration-teal-200 underline-offset-4">Find a time with everyone</button>}
            </div>
            <PinButton workspace={workspace} setWorkspace={setWorkspace} kind="meeting" refId={m.id} title={`${m.student} ${m.type}`} makeId={makeId} />
            <button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("meetings", m.id)}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}</div> : <Empty>No meetings added.</Empty>}
      </Card>
      <HubMeetingPolls token={token} workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} start={pollStart} onStarted={() => setPollStart(null)} account={account} wizard={wizard} setWizard={setWizard} studentOptions={studentOptions} openGuide={openGuide} />
    </>
  );
}

function Lessons({ workspace, setWorkspace, remove }: SectionProps) {
  const [form, setForm] = useState({ title: "", subject: "Math", group: "", date: TODAY(), objective: "", materials: "" });
  function add(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setWorkspace((p) => ({ ...p, lessons: [{ id: id(), ...form }, ...p.lessons] }));
    setForm({ title: "", subject: "Math", group: "", date: TODAY(), objective: "", materials: "" });
  }
  return (
    <>
      <Card title="Lesson planning">
        <form onSubmit={add} className="grid gap-3 md:grid-cols-4">
          <Field placeholder="Lesson title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}><option>Math</option><option>Reading</option><option>Writing</option><option>Push-in</option><option>Pull-out</option><option>Other</option></Select>
          <Field placeholder="Group / class" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} />
          <Field type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <TextArea placeholder="Objective / skill" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} className="md:col-span-2" />
          <TextArea placeholder="Materials / worksheet notes" value={form.materials} onChange={(e) => setForm({ ...form, materials: e.target.value })} className="md:col-span-2" />
          <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Save lesson</PrimaryButton>
        </form>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {workspace.lessons.length ? workspace.lessons.map((lesson) => (
          <Card key={lesson.id} title={lesson.title} right={<button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("lessons", lesson.id)}><Trash2 className="h-4 w-4" /></button>}>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{lesson.subject} · {lesson.group || "No group"} · {lesson.date || "No date"}</div>
            {lesson.objective && <p className="mt-3 text-sm text-slate-700">{lesson.objective}</p>}
            {lesson.materials && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{lesson.materials}</div>}
          </Card>
        )) : <div className="lg:col-span-2"><Empty>No lessons saved yet.</Empty></div>}
      </div>
    </>
  );
}

const DUE_STYLE: Record<DueState, string> = { none: "bg-slate-100 text-slate-500", overdue: "bg-red-100 text-red-700", today: "bg-amber-100 text-amber-800", soon: "bg-sky-100 text-sky-800", later: "bg-slate-100 text-slate-600" };

function DueChip({ date, today }: { date: string; today: string }) {
  if (!date) return null;
  const state = dueState(date, today);
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${DUE_STYLE[state]}`}>{state === "overdue" ? "Overdue · " : ""}{friendlyDate(date, today)}</span>;
}

function Tasks({ workspace, setWorkspace, remove, makeId, toast }: SectionProps & { makeId: () => string; toast: (text: string, actions?: ToastAction[]) => void }) {
  const today = TODAY();
  const [filter, setFilter] = useState<TaskFilter>("open");
  const [sort, setSort] = useState<TaskSort>("due");
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState("");
  /** The to-do open in the pop-up: `id: null` is a new one. */
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const counts = taskCounts(workspace.tasks, today);
  const shown = useMemo(() => arrangeTasks(workspace.tasks, filter, sort, search), [workspace.tasks, filter, sort, search]);

  function quickAdd(e: FormEvent) {
    e.preventDefault();
    const title = quick.trim();
    if (!title) return;
    setWorkspace((p) => ({ ...p, tasks: [...p.tasks, { id: id(), title, dueDate: "", recurring: "", done: false }] }));
    setQuick("");
  }
  const toggle = taskChecker(() => workspace.tasks, setWorkspace, toast);
  /** Takes every finished to-do off the list, with Undo. */
  function clearFinished() {
    const { cleared } = clearDone(workspace.tasks);
    if (!cleared.length) return;
    setWorkspace((p) => ({ ...p, tasks: clearDone(p.tasks).tasks }));
    toast(`Cleared ${cleared.length} finished ${cleared.length === 1 ? "to-do" : "to-dos"}.`, [{ label: "Undo", run: () => setWorkspace((p) => ({ ...p, tasks: restoreTasks(p.tasks, cleared) })) }]);
  }
  const chip = (active: boolean) => `inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;

  return (
    <>
      <Card title="Reminders & to-dos" right={<PrimaryButton onClick={() => setEditing({ id: null })}><Plus className="h-4 w-4" /> New task</PrimaryButton>}>
        <form onSubmit={quickAdd} className="flex gap-2">
          <Field placeholder="Add a to-do and press Enter" aria-label="Quick add a to-do" value={quick} onChange={(e) => setQuick(e.target.value)} />
          <PrimaryButton type="submit" disabled={!quick.trim()}>Add</PrimaryButton>
        </form>
        {(counts.overdue > 0 || counts.today > 0) && (
          <div className="mt-3 flex flex-wrap gap-2 text-sm" data-testid="task-alerts">
            {counts.overdue > 0 && <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700">{counts.overdue} overdue</span>}
            {counts.today > 0 && <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">{counts.today} due today</span>}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Show">
          <button type="button" className={chip(filter === "open")} aria-pressed={filter === "open"} onClick={() => setFilter("open")}>To do <span className="opacity-70">{counts.open}</span></button>
          <button type="button" className={chip(filter === "done")} aria-pressed={filter === "done"} onClick={() => setFilter("done")}>Done <span className="opacity-70">{counts.done}</span></button>
          <button type="button" className={chip(filter === "all")} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <Field type="search" placeholder="Search to-dos" aria-label="Search to-dos" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select aria-label="Sort to-dos" value={sort} onChange={(e) => setSort(e.target.value as TaskSort)}>{TASK_SORTS.map((o) => <option key={o.id} value={o.id}>Sort: {o.label}</option>)}</Select>
        </div>
      </Card>
      <Card>
        {shown.length ? <ul className="space-y-2">{shown.map((task) => (
          <TaskRow key={task.id} task={task} today={today} workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} onToggle={toggle} onEdit={(t) => setEditing({ id: t.id })} onDelete={(t) => remove("tasks", t.id)} />
        ))}</ul> : <Empty>{workspace.tasks.length ? (filter === "open" ? "Nothing left to do. Nice work." : "No to-dos match.") : "No tasks yet. Type one above and press Enter."}</Empty>}
        {filter === "done" && counts.done > 0 && !search.trim() && (
          <div className="mt-3 text-center"><button type="button" onClick={clearFinished} className="min-h-11 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4" data-testid="clear-done">Clear all {counts.done} finished</button></div>
        )}
        {filter === "open" && !search.trim() && <RecentlyDone tasks={workspace.tasks} onUndo={(taskId) => setWorkspace((p) => ({ ...p, tasks: undoTask(p.tasks, taskId, Date.now()) }))} />}
      </Card>
      {editing && <TaskModal task={editing.id ? workspace.tasks.find((t) => t.id === editing.id) || null : null} startTitle={quick} today={today}
        onSave={(fields) => setWorkspace((p) => ({ ...p, tasks: saveTask(p.tasks, editing.id, fields, id) }))} onClose={() => setEditing(null)} onDelete={editing.id ? () => remove("tasks", editing.id!) : undefined} />}
    </>
  );
}

function Arise({ workspace, setWorkspace, remove, studentOptions }: SectionProps & { studentOptions: () => ReactNode }) {
  const [form, setForm] = useState({ student: "", book: "", score: "", points: "", date: TODAY() });
  function add(e: FormEvent) {
    e.preventDefault();
    setWorkspace((p) => ({ ...p, ariseRecords: [{ id: id(), ...form }, ...p.ariseRecords] }));
    setForm({ student: "", book: "", score: "", points: "", date: TODAY() });
  }
  return (
    <>
      <Card title="A.R.I.S.E. reading records">
        <form onSubmit={add} className="grid gap-3 md:grid-cols-6">
          <Select value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} required>{studentOptions()}</Select>
          <Field placeholder="Book / text" value={form.book} onChange={(e) => setForm({ ...form, book: e.target.value })} className="md:col-span-2" required />
          <Field placeholder="Score" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
          <Field placeholder="Points" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />
          <Field type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Add record</PrimaryButton>
        </form>
      </Card>
      <Card title="Reading history">
        {workspace.ariseRecords.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="text-xs uppercase text-slate-400"><tr><th className="pb-2">Student</th><th>Book</th><th>Score</th><th>Points</th><th>Date</th><th /></tr></thead><tbody>{workspace.ariseRecords.map((r) => <tr key={r.id} className="border-t border-slate-100"><td className="py-3 font-medium">{r.student}</td><td>{r.book}</td><td>{r.score}</td><td>{r.points}</td><td>{r.date}</td><td><button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("ariseRecords", r.id)}><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div> : <Empty>No A.R.I.S.E. records yet.</Empty>}
      </Card>
    </>
  );
}

function Behavior({ workspace, setWorkspace, remove, studentOptions, totals }: SectionProps & { studentOptions: (all?: boolean) => ReactNode; totals: Record<string, number> }) {
  const [form, setForm] = useState({ student: "", points: 1, reason: "", date: TODAY() });
  function add(e: FormEvent) {
    e.preventDefault();
    setWorkspace((p) => ({ ...p, behavior: [{ id: id(), ...form, points: Number(form.points) || 0 }, ...p.behavior] }));
    setForm({ student: "", points: 1, reason: "", date: TODAY() });
  }
  return (
    <>
      <Card title="Behavior points">
        <form onSubmit={add} className="grid gap-3 md:grid-cols-5">
          <Select value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} required>{studentOptions(true)}</Select>
          <Field type="number" value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} />
          <Field placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="md:col-span-2" />
          <Field type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Record points</PrimaryButton>
        </form>
      </Card>
      <div className="grid gap-4 lg:grid-cols-[.7fr_1.3fr]">
        <Card title="Totals">
          {Object.keys(totals).length ? <div className="space-y-2">{Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(([name,total]) => <div key={name} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2"><span>{name}</span><strong>{total > 0 ? "+" : ""}{total}</strong></div>)}</div> : <Empty>No points yet.</Empty>}
        </Card>
        <Card title="Point history">
          {workspace.behavior.length ? <div className="space-y-2">{workspace.behavior.map((b) => <div key={b.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><div className={`w-12 text-center text-lg font-bold ${b.points >= 0 ? "text-emerald-600" : "text-red-600"}`}>{b.points >= 0 ? "+" : ""}{b.points}</div><div className="min-w-0 flex-1"><div className="font-medium">{b.student}</div><div className="text-xs text-slate-500">{b.reason || "No reason"} · {b.date}</div></div><button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("behavior", b.id)}><Trash2 className="h-4 w-4" /></button></div>)}</div> : <Empty>No behavior points yet.</Empty>}
        </Card>
      </div>
    </>
  );
}

function Attendance({ workspace, setWorkspace, remove, studentOptions, exportAttendance }: SectionProps & { studentOptions: () => ReactNode; exportAttendance: () => void }) {
  const [form, setForm] = useState<{ student: string; date: string; status: AttendanceEntry["status"]; className: string }>({ student: "", date: TODAY(), status: "Present", className: "" });
  function add(e: FormEvent) {
    e.preventDefault();
    setWorkspace((p) => ({ ...p, attendance: [{ id: id(), ...form }, ...p.attendance] }));
  }
  return (
    <>
      <Card title="Attendance" right={<GhostButton onClick={exportAttendance}>Export CSV</GhostButton>}>
        <form onSubmit={add} className="grid gap-3 md:grid-cols-5">
          <Select value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} required>{studentOptions()}</Select>
          <Field type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Field placeholder="Class / block" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} />
          <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AttendanceEntry["status"] })}><option>Present</option><option>Absent</option><option>Tardy</option><option>Excused</option></Select>
          <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Mark</PrimaryButton>
        </form>
      </Card>
      <Card title="Attendance log">
        {workspace.attendance.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="text-xs uppercase text-slate-400"><tr><th className="pb-2">Date</th><th>Student</th><th>Class</th><th>Status</th><th /></tr></thead><tbody>{workspace.attendance.map((a) => <tr key={a.id} className="border-t border-slate-100"><td className="py-3">{a.date}</td><td className="font-medium">{a.student}</td><td>{a.className}</td><td>{a.status}</td><td><button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("attendance", a.id)}><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div> : <Empty>No attendance entries yet.</Empty>}
      </Card>
    </>
  );
}

function Gradebook({ workspace, setWorkspace, remove, studentOptions }: SectionProps & { studentOptions: () => ReactNode }) {
  const [assignment, setAssignment] = useState({ title: "", category: "Classwork", points: 10, date: TODAY() });
  const [score, setScore] = useState({ assignmentId: "", student: "", score: "", missing: false, excused: false });
  function addAssignment(e: FormEvent) {
    e.preventDefault();
    if (!assignment.title.trim()) return;
    setWorkspace((p) => ({ ...p, assignments: [...p.assignments, { id: id(), ...assignment, points: Number(assignment.points) || 0 }] }));
    setAssignment({ title: "", category: "Classwork", points: 10, date: TODAY() });
  }
  function addScore(e: FormEvent) {
    e.preventDefault();
    if (!score.assignmentId || !score.student) return;
    setWorkspace((p) => ({ ...p, gradeScores: [...p.gradeScores, { id: id(), assignmentId: score.assignmentId, student: score.student, score: score.score === "" ? null : Number(score.score), missing: score.missing, excused: score.excused }] }));
    setScore({ assignmentId: "", student: "", score: "", missing: false, excused: false });
  }
  const averages = workspace.students.map((student) => {
    const rows = workspace.gradeScores.filter((g) => g.student === student.name && !g.excused && !g.missing && g.score != null);
    let earned = 0, possible = 0;
    for (const row of rows) {
      const a = workspace.assignments.find((x) => x.id === row.assignmentId);
      if (!a) continue;
      earned += Number(row.score || 0); possible += Number(a.points || 0);
    }
    return { student: student.name, average: possible ? Math.round((earned / possible) * 100) : null };
  });
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Assignments">
          <form onSubmit={addAssignment} className="grid gap-3 sm:grid-cols-2">
            <Field placeholder="Assignment" value={assignment.title} onChange={(e) => setAssignment({ ...assignment, title: e.target.value })} required />
            <Select value={assignment.category} onChange={(e) => setAssignment({ ...assignment, category: e.target.value })}><option>Classwork</option><option>Quiz</option><option>Test</option><option>Homework</option><option>Project</option></Select>
            <Field type="number" min="0" value={assignment.points} onChange={(e) => setAssignment({ ...assignment, points: Number(e.target.value) })} />
            <Field type="date" value={assignment.date} onChange={(e) => setAssignment({ ...assignment, date: e.target.value })} />
            <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Add assignment</PrimaryButton>
          </form>
          <div className="mt-4 space-y-2">{workspace.assignments.map((a) => <div key={a.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"><div><div className="font-medium">{a.title}</div><div className="text-xs text-slate-500">{a.category} · {a.points} pts · {a.date}</div></div><button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("assignments", a.id)}><Trash2 className="h-4 w-4" /></button></div>)}</div>
        </Card>
        <Card title="Enter score">
          <form onSubmit={addScore} className="grid gap-3 sm:grid-cols-2">
            <Select value={score.assignmentId} onChange={(e) => setScore({ ...score, assignmentId: e.target.value })} required><option value="">Choose assignment</option>{workspace.assignments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</Select>
            <Select value={score.student} onChange={(e) => setScore({ ...score, student: e.target.value })} required>{studentOptions()}</Select>
            <Field type="number" placeholder="Points earned" value={score.score} onChange={(e) => setScore({ ...score, score: e.target.value })} />
            <div className="flex min-h-11 flex-wrap items-center gap-4 rounded-xl border border-slate-200 px-3 py-2 text-sm"><label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 shrink-0" checked={score.missing} onChange={(e) => setScore({ ...score, missing: e.target.checked })} /> Missing</label><label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 shrink-0" checked={score.excused} onChange={(e) => setScore({ ...score, excused: e.target.checked })} /> Excused</label></div>
            <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Save score</PrimaryButton>
          </form>
        </Card>
      </div>
      <Card title="Student averages">
        {averages.length ? <div className="grid gap-2 md:grid-cols-3">{averages.map((a) => <div key={a.student} className="rounded-xl bg-slate-50 p-4"><div className="font-medium">{a.student}</div><div className="mt-1 text-2xl font-bold">{a.average == null ? "—" : `${a.average}%`}</div></div>)}</div> : <Empty>Add students to see grade averages.</Empty>}
      </Card>
    </>
  );
}

function Parents({ workspace, setWorkspace, remove, studentOptions }: SectionProps & { studentOptions: () => ReactNode }) {
  const [form, setForm] = useState({ student: "", guardian: "", message: "", status: "Sent", date: TODAY() });
  function add(e: FormEvent) {
    e.preventDefault();
    if (!form.message.trim()) return;
    setWorkspace((p) => ({ ...p, parentLogs: [{ id: id(), ...form }, ...p.parentLogs] }));
    setForm({ student: "", guardian: "", message: "", status: "Sent", date: TODAY() });
  }
  return (
    <>
      <Card title="Parent communication">
        <form onSubmit={add} className="grid gap-3 md:grid-cols-4">
          <Select value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })}>{studentOptions()}</Select>
          <Field placeholder="Parent / guardian" value={form.guardian} onChange={(e) => setForm({ ...form, guardian: e.target.value })} />
          <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>Sent</option><option>Called</option><option>Left voicemail</option><option>Replied</option><option>Acknowledged</option><option>Needs follow-up</option></Select>
          <Field type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <TextArea placeholder="Message / class feed post / contact note" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="md:col-span-4" />
          <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Save contact log</PrimaryButton>
        </form>
      </Card>
      <Card title="Contact log">
        {workspace.parentLogs.length ? <div className="space-y-3">{workspace.parentLogs.map((p) => <div key={p.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><div className="font-semibold">{p.student || "General"} · {p.guardian || "Guardian"}</div><div className="text-xs text-slate-500">{p.status} · {p.date}</div></div><button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("parentLogs", p.id)}><Trash2 className="h-4 w-4" /></button></div><p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{p.message}</p></div>)}</div> : <Empty>No parent communication saved yet.</Empty>}
      </Card>
    </>
  );
}

function Schedules({ workspace, setWorkspace, remove, studentOptions, warnings }: SectionProps & { studentOptions: () => ReactNode; warnings: string[] }) {
  const [form, setForm] = useState({ student: "", day: "Monday", start: "08:00", end: "08:30", label: "" });
  function add(e: FormEvent) {
    e.preventDefault();
    setWorkspace((p) => ({ ...p, schedules: [...p.schedules, { id: id(), ...form }] }));
    setForm({ student: "", day: "Monday", start: "08:00", end: "08:30", label: "" });
  }
  return (
    <>
      <Card title="Weekly student schedules">
        <form onSubmit={add} className="grid gap-3 md:grid-cols-6">
          <Select value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} required>{studentOptions()}</Select>
          <Select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option></Select>
          <Field type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          <Field type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          <Field placeholder="Class / service" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Add block</PrimaryButton>
        </form>
      </Card>
      {warnings.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex gap-2 font-semibold text-amber-900"><AlertTriangle className="h-5 w-5" /> Schedule overlap</div><div className="mt-2 space-y-1 text-sm text-amber-800">{warnings.map((w) => <div key={w}>{w}</div>)}</div></div>}
      <Card title="Schedule blocks">
        {workspace.schedules.length ? <div className="grid gap-3 lg:grid-cols-2">{workspace.schedules.map((s) => <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><div className="font-medium">{s.student} · {s.label || "Schedule block"}</div><div className="text-xs text-slate-500">{s.day} · {s.start}–{s.end}</div></div><button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("schedules", s.id)}><Trash2 className="h-4 w-4" /></button></div>)}</div> : <Empty>No schedule blocks yet.</Empty>}
      </Card>
    </>
  );
}

function Emails({ workspace, setWorkspace, remove, toast, onViewTasks }: SectionProps & { toast: (text: string, actions?: ToastAction[]) => void; onViewTasks: () => void }) {
  const [form, setForm] = useState({ from: "", subject: "", body: "", action: "", draft: "", date: TODAY() });
  // What to do with a new email as it is saved.
  const [also, setAlso] = useState({ todo: false, flag: false });
  const [filter, setFilter] = useState<EmailFilter>("all");
  const counts = emailCounts(workspace);
  const shown = arrangeEmails(workspace, filter);
  const added = (text: string) => toast(text, [{ label: "View", run: onViewTasks }]);
  function add(e: FormEvent) {
    e.preventDefault();
    if (!form.body.trim() && !form.subject.trim()) return;
    const emailId = id(), taskId = id();
    const email = { id: emailId, ...form, ...(also.flag ? { flagged: true } : {}) };
    setWorkspace((p) => {
      const saved = { ...p, emails: [email, ...p.emails] };
      return also.todo ? addEmailToTasks(saved, emailId, () => taskId).workspace : saved;
    });
    if (also.todo) added("Saved, and added to Reminders & to-dos.");
    setForm({ from: "", subject: "", body: "", action: "", draft: "", date: TODAY() });
    setAlso({ todo: false, flag: false });
  }
  /** Puts a saved email on the to-do list (once: an email already waiting there is not added again). */
  function toTodo(emailId: string) {
    const result = addEmailToTasks(workspace, emailId, id);
    if (!result.added) return;
    setWorkspace((p) => addEmailToTasks(p, emailId, () => result.taskId!).workspace);
    added("Added to Reminders & to-dos.");
  }
  const chip = (active: boolean) => `inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;
  const act = "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50";
  return (
    <>
      <Card title="Email organizer">
        <p className="mb-4 text-sm text-slate-600">Paste important school emails here, pull out the action you need to take, and keep a reply draft beside it. Flag the ones that matter, or put them on your to-do list.</p>
        <form onSubmit={add} className="grid gap-3 md:grid-cols-4">
          <Field placeholder="From" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
          <Field placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="md:col-span-2" />
          <Field type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <TextArea placeholder="Paste email here" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="md:col-span-2" />
          <TextArea placeholder="Action item / what I need to do" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} />
          <TextArea placeholder="Reply draft" value={form.draft} onChange={(e) => setForm({ ...form, draft: e.target.value })} />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 md:col-span-4">
            <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700"><input type="checkbox" className="h-5 w-5 shrink-0" checked={also.todo} onChange={(e) => setAlso({ ...also, todo: e.target.checked })} data-testid="email-also-todo" /> Add it to my to-dos</label>
            <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700"><input type="checkbox" className="h-5 w-5 shrink-0" checked={also.flag} onChange={(e) => setAlso({ ...also, flag: e.target.checked })} data-testid="email-also-flag" /> Flag it</label>
          </div>
          <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Save email</PrimaryButton>
        </form>
      </Card>
      <Card title="Saved emails">
        {workspace.emails.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Show">
            <button type="button" className={chip(filter === "all")} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All <span className="opacity-70">{counts.all}</span></button>
            <button type="button" className={chip(filter === "flagged")} aria-pressed={filter === "flagged"} onClick={() => setFilter("flagged")}><Flag className="h-3.5 w-3.5" />Flagged <span className="opacity-70">{counts.flagged}</span></button>
            <button type="button" className={chip(filter === "todo")} aria-pressed={filter === "todo"} onClick={() => setFilter("todo")}><CheckSquare className="h-3.5 w-3.5" />On my to-do list <span className="opacity-70">{counts.todo}</span></button>
          </div>
        )}
        {shown.length ? (
          <div className="space-y-3">
            {shown.map((e) => {
              const task = emailTask(workspace, e.id);
              return (
                <div key={e.id} className={`rounded-2xl border p-4 ${e.flagged ? "border-amber-300 bg-amber-50/60" : "border-slate-200"}`} data-testid="email-row">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><div className="break-words font-semibold">{e.flagged && <Flag className="mr-1 inline h-4 w-4 text-amber-600" aria-label="Flagged" />}{e.subject || "Untitled email"}</div><div className="text-xs text-slate-500">{e.from || "Unknown sender"} · {e.date}</div></div>
                    <button type="button" aria-label={`Delete ${e.subject || "email"}`} className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("emails", e.id)}><Trash2 className="h-4 w-4" /></button>
                  </div>
                  {e.action && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><strong>Action:</strong> {e.action}</div>}
                  {e.body && <details className="mt-3 text-sm text-slate-600"><summary className="cursor-pointer font-medium text-slate-700">Original email</summary><p className="mt-2 whitespace-pre-wrap leading-6">{e.body}</p></details>}
                  {e.draft && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><strong>Reply draft</strong><p className="mt-1 whitespace-pre-wrap">{e.draft}</p></div>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button type="button" aria-pressed={!!e.flagged} aria-label={`${e.flagged ? "Take the flag off" : "Flag"} ${e.subject || "this email"}`} onClick={() => setWorkspace((p) => toggleEmailFlag(p, e.id))} className={act} data-testid="email-flag"><Flag className={`h-4 w-4 ${e.flagged ? "text-amber-600" : ""}`} />{e.flagged ? "Flagged" : "Flag"}</button>
                    {task && !task.done
                      ? <span className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-teal-50 px-3 text-sm font-semibold text-teal-800" data-testid="email-on-list"><CheckSquare className="h-4 w-4" />On your to-do list</span>
                      : <button type="button" aria-label={`Add ${e.subject || "this email"} to my to-dos`} onClick={() => toTodo(e.id)} className={act} data-testid="email-to-todo"><Plus className="h-4 w-4" />{task ? "Add to my to-dos again" : "Add to my to-dos"}</button>}
                    {task?.done && <span className="text-xs font-medium text-slate-500" data-testid="email-done">Done on your to-do list</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <Empty>{workspace.emails.length ? (filter === "flagged" ? "No flagged emails." : "No emails are waiting on your to-do list.") : "No emails saved yet."}</Empty>}
      </Card>
    </>
  );
}
