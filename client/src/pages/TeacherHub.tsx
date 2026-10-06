import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  BookHeart,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  Home,
  LogOut,
  Mail,
  MessageSquare,
  Plus,
  Save,
  Settings2,
  Sparkles,
  StickyNote,
  Trash2,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { HUB_REQUIRED, PLANS, usd } from "@shared/plans";

type Student = {
  id: string;
  name: string;
  grade: string;
  accommodations: string;
  iepDate: string;
  reevalDate: string;
  readingLevel: string;
  mathLevel: string;
  notes: string;
};

type Meeting = {
  id: string;
  student: string;
  type: string;
  date: string;
  notes: string;
  done: boolean;
};

type Lesson = {
  id: string;
  title: string;
  subject: string;
  group: string;
  date: string;
  objective: string;
  materials: string;
};

type Task = {
  id: string;
  title: string;
  dueDate: string;
  recurring: string;
  done: boolean;
};

type NoteItem = {
  id: string;
  student: string;
  type: string;
  body: string;
  date: string;
};

type AriseRecord = {
  id: string;
  student: string;
  book: string;
  score: string;
  points: string;
  date: string;
};

type BehaviorEntry = {
  id: string;
  student: string;
  points: number;
  reason: string;
  date: string;
};

type AttendanceEntry = {
  id: string;
  student: string;
  date: string;
  status: "Present" | "Absent" | "Tardy" | "Excused";
  className: string;
};

type Assignment = {
  id: string;
  title: string;
  category: string;
  points: number;
  date: string;
};

type GradeScore = {
  id: string;
  assignmentId: string;
  student: string;
  score: number | null;
  missing: boolean;
  excused: boolean;
};

type ParentLog = {
  id: string;
  student: string;
  guardian: string;
  message: string;
  status: string;
  date: string;
};

type ScheduleEntry = {
  id: string;
  student: string;
  day: string;
  start: string;
  end: string;
  label: string;
};

type EmailItem = {
  id: string;
  from: string;
  subject: string;
  body: string;
  action: string;
  draft: string;
  date: string;
};

type HubTab =
  | "overview"
  | "caseload"
  | "iep"
  | "lessons"
  | "tasks"
  | "notes"
  | "arise"
  | "behavior"
  | "attendance"
  | "gradebook"
  | "parents"
  | "schedules"
  | "email";

type Workspace = {
  version: number;
  profile: {
    school: string;
    gradeBand: string;
    subject: string;
  };
  visibleTabs: Record<HubTab, boolean>;
  students: Student[];
  meetings: Meeting[];
  lessons: Lesson[];
  tasks: Task[];
  notes: NoteItem[];
  ariseRecords: AriseRecord[];
  behavior: BehaviorEntry[];
  attendance: AttendanceEntry[];
  assignments: Assignment[];
  gradeScores: GradeScore[];
  parentLogs: ParentLog[];
  schedules: ScheduleEntry[];
  emails: EmailItem[];
};

const TODAY = () => new Date().toISOString().slice(0, 10);
const id = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const TAB_META: Array<{ id: HubTab; label: string; icon: ReactNode }> = [
  { id: "overview", label: "Home", icon: <Home className="h-4 w-4" /> },
  { id: "caseload", label: "Caseload", icon: <Users className="h-4 w-4" /> },
  { id: "iep", label: "IEP & Meetings", icon: <CalendarDays className="h-4 w-4" /> },
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

function emptyWorkspace(): Workspace {
  return {
    version: 1,
    profile: { school: "", gradeBand: "", subject: "" },
    visibleTabs: Object.fromEntries(TAB_META.map((tab) => [tab.id, true])) as Record<HubTab, boolean>,
    students: [],
    meetings: [],
    lessons: [],
    tasks: [],
    notes: [],
    ariseRecords: [],
    behavior: [],
    attendance: [],
    assignments: [],
    gradeScores: [],
    parentLogs: [],
    schedules: [],
    emails: [],
  };
}

function normalizeWorkspace(raw: any): Workspace {
  const base = emptyWorkspace();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  return {
    ...base,
    ...raw,
    profile: { ...base.profile, ...(raw.profile || {}) },
    visibleTabs: { ...base.visibleTabs, ...(raw.visibleTabs || {}), overview: true },
    students: Array.isArray(raw.students) ? raw.students : [],
    meetings: Array.isArray(raw.meetings) ? raw.meetings : [],
    lessons: Array.isArray(raw.lessons) ? raw.lessons : [],
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
    notes: Array.isArray(raw.notes) ? raw.notes : [],
    ariseRecords: Array.isArray(raw.ariseRecords) ? raw.ariseRecords : [],
    behavior: Array.isArray(raw.behavior) ? raw.behavior : [],
    attendance: Array.isArray(raw.attendance) ? raw.attendance : [],
    assignments: Array.isArray(raw.assignments) ? raw.assignments : [],
    gradeScores: Array.isArray(raw.gradeScores) ? raw.gradeScores : [],
    parentLogs: Array.isArray(raw.parentLogs) ? raw.parentLogs : [],
    schedules: Array.isArray(raw.schedules) ? raw.schedules : [],
    emails: Array.isArray(raw.emails) ? raw.emails : [],
  };
}

function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      {(title || right) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
          <h2 className="min-w-0 break-words font-semibold text-slate-900">{title}</h2>
          {right}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 sm:min-h-10 sm:text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 ${props.className || ""}`}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 sm:text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 ${props.className || ""}`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 sm:min-h-10 sm:text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 ${props.className || ""}`}
    />
  );
}

function PrimaryButton({
  children,
  type = "button",
  onClick,
  disabled,
}: {
  children: ReactNode;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">{children}</div>;
}

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
  const { user, token, logout } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [tab, setTab] = useState<HubTab>("overview");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [customize, setCustomize] = useState(false);
  // Teacher Hub is a paid add-on: without a plan the server says so, and the page shows how to get it.
  const [needsPlan, setNeedsPlan] = useState(false);
  const [seats, setSeats] = useState<number | null>(null);
  const [saveMessage, setSaveMessage] = useState("");

  const canUseHub = !!user && (user.role === "teacher" || user.isAdmin);

  useEffect(() => {
    if (!canUseHub || !token) return;
    let cancelled = false;
    setLoaded(false);
    setLoadError("");
    setNeedsPlan(false);
    fetch(`${API_BASE}/api/teacher-hub/workspace`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (r.status === 402 && data.code === HUB_REQUIRED) return { needsPlan: true };
        if (!r.ok) throw new Error(data.message || "Could not load Teacher Hub.");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        if (data.needsPlan) { setNeedsPlan(true); setLoaded(true); return; }
        setSeats(typeof data.seats === "number" ? data.seats : null);
        setWorkspace(normalizeWorkspace(data.workspace));
        setLoaded(true);
        setSaveStatus("saved");
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.message || "Could not load Teacher Hub.");
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [canUseHub, token, user?.id]);

  useEffect(() => {
    if (!canUseHub || !token || !loaded || loadError || needsPlan) return;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      fetch(`${API_BASE}/api/teacher-hub/workspace`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ workspace }),
      })
        .then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (r.status === 402 && data.code === HUB_REQUIRED) { setNeedsPlan(true); return; }
          if (!r.ok) throw new Error(data.message || "Could not save Teacher Hub.");
          setSaveStatus("saved");
          setSaveMessage("");
        })
        .catch((err) => { setSaveStatus("error"); setSaveMessage(err?.message || "Could not save Teacher Hub."); });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [workspace, canUseHub, token, loaded, loadError, needsPlan]);

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

  function remove<K extends keyof Workspace>(key: K, rowId: string) {
    const current = workspace[key];
    if (!Array.isArray(current)) return;
    update(key, current.filter((row: any) => row.id !== rowId) as Workspace[K]);
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
          <button className="mt-5 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const visibleTabs = TAB_META.filter((item) => item.id === "overview" || workspace.visibleTabs[item.id] !== false);

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-clip bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 md:px-6">
          <a href={user.isAdmin ? "#/admin" : "#/teacher-dashboard"} className="min-w-0 rounded-xl" aria-label={user.isAdmin ? "Back to admin" : "Back to your dashboard"} title={user.isAdmin ? "Back to admin" : "Back to your dashboard"}>
            <div className="text-xs font-bold uppercase tracking-[.22em] text-slate-400">A.R.I.S.E.</div>
            <div className="truncate text-xl font-bold tracking-tight">Teacher Hub</div>
          </a>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 sm:flex">
              {saveStatus === "saving" ? (
                <><Save className="h-3.5 w-3.5" /> Saving…</>
              ) : saveStatus === "error" ? (
                <><AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Save failed</>
              ) : (
                <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Saved</>
              )}
            </div>
            <GhostButton onClick={() => setCustomize((v) => !v)}><Settings2 className="h-4 w-4" /> <span className="hidden sm:inline">Customize tabs</span></GhostButton>
            <GhostButton onClick={logout}><LogOut className="h-4 w-4" /></GhostButton>
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
            {visibleTabs.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition md:w-full ${tab === item.id ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0 space-y-4 pb-[max(5rem,env(safe-area-inset-bottom))]">
          {saveStatus === "error" && saveMessage && (
            <div className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between" role="alert">
              <span>{saveMessage}</span>
              <a href="#/billing" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-red-700 px-4 text-sm font-semibold text-white">Your plan</a>
            </div>
          )}
          {customize && (
            <Card title="Customize tabs" right={<button onClick={() => setCustomize(false)} className="text-sm font-medium text-slate-500">Close</button>}>
              <p className="mb-4 text-sm text-slate-600">Hide anything you do not use. Hiding a tab does not delete its records.</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {TAB_META.filter((item) => item.id !== "overview").map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                    <span className="flex items-center gap-2">{item.icon}{item.label}</span>
                    <input
                      type="checkbox" className="h-5 w-5 shrink-0"
                      checked={workspace.visibleTabs[item.id] !== false}
                      onChange={(e) => setWorkspace((prev) => ({
                        ...prev,
                        visibleTabs: { ...prev.visibleTabs, [item.id]: e.target.checked },
                      }))}
                    />
                  </label>
                ))}
              </div>
            </Card>
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

              <div className="grid gap-4 xl:grid-cols-2">
                <Card title="Upcoming IEP / reevaluation meetings">
                  {upcomingMeetings.length ? (
                    <div className="space-y-2">
                      {upcomingMeetings.map((m) => (
                        <button key={m.id} onClick={() => setTab("iep")} className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-left hover:bg-slate-100">
                          <div><div className="font-medium">{m.student || "Student"}</div><div className="text-xs text-slate-500">{m.type}</div></div>
                          <div className="text-sm font-semibold text-slate-700">{m.date || "No date"}</div>
                        </button>
                      ))}
                    </div>
                  ) : <Empty>No upcoming meetings yet.</Empty>}
                </Card>

                <Card title="To do">
                  {dueTasks.length ? (
                    <div className="space-y-2">
                      {dueTasks.map((task) => (
                        <label key={task.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3">
                          <input type="checkbox" className="h-5 w-5 shrink-0" checked={task.done} onChange={() => update("tasks", workspace.tasks.map((t) => t.id === task.id ? { ...t, done: !t.done } : t))} />
                          <div className="min-w-0 flex-1"><div className="truncate font-medium">{task.title}</div><div className="text-xs text-slate-500">{task.recurring || "One-time"} {task.dueDate ? `· due ${task.dueDate}` : ""}</div></div>
                        </label>
                      ))}
                    </div>
                  ) : <Empty>Nothing due right now.</Empty>}
                </Card>
              </div>

              <Card title="Workspace profile">
                <div className="grid gap-3 md:grid-cols-3">
                  <Field placeholder="School" value={workspace.profile.school} onChange={(e) => setWorkspace((p) => ({ ...p, profile: { ...p.profile, school: e.target.value } }))} />
                  <Field placeholder="Grade / band" value={workspace.profile.gradeBand} onChange={(e) => setWorkspace((p) => ({ ...p, profile: { ...p.profile, gradeBand: e.target.value } }))} />
                  <Field placeholder="Subject / role" value={workspace.profile.subject} onChange={(e) => setWorkspace((p) => ({ ...p, profile: { ...p.profile, subject: e.target.value } }))} />
                </div>
              </Card>
            </>
          )}

          {tab === "caseload" && <Caseload workspace={workspace} setWorkspace={setWorkspace} remove={remove} seats={seats} />}
          {tab === "iep" && <Meetings workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} />}
          {tab === "lessons" && <Lessons workspace={workspace} setWorkspace={setWorkspace} remove={remove} />}
          {tab === "tasks" && <Tasks workspace={workspace} setWorkspace={setWorkspace} remove={remove} />}
          {tab === "notes" && <Notes workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} />}
          {tab === "arise" && <Arise workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} />}
          {tab === "behavior" && <Behavior workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} totals={behaviorTotals} />}
          {tab === "attendance" && <Attendance workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} exportAttendance={exportAttendance} />}
          {tab === "gradebook" && <Gradebook workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} />}
          {tab === "parents" && <Parents workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} />}
          {tab === "schedules" && <Schedules workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} warnings={scheduleWarnings} />}
          {tab === "email" && <Emails workspace={workspace} setWorkspace={setWorkspace} remove={remove} />}
        </main>
      </div>
    </div>
  );
}

type SectionProps = {
  workspace: Workspace;
  setWorkspace: React.Dispatch<React.SetStateAction<Workspace>>;
  remove: <K extends keyof Workspace>(key: K, rowId: string) => void;
};

function Caseload({ workspace, setWorkspace, remove, seats }: SectionProps & { seats: number | null }) {
  const [form, setForm] = useState<Omit<Student, "id">>({ name: "", grade: "", accommodations: "", iepDate: "", reevalDate: "", readingLevel: "", mathLevel: "", notes: "" });
  // The plan covers this many students; the caseload can't grow past it.
  const full = seats !== null && workspace.students.length >= seats;
  function add(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || full) return;
    setWorkspace((p) => ({ ...p, students: [...p.students, { id: id(), ...form, name: form.name.trim() }] }));
    setForm({ name: "", grade: "", accommodations: "", iepDate: "", reevalDate: "", readingLevel: "", mathLevel: "", notes: "" });
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
          <Field placeholder="Student name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Field placeholder="Grade" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
          <Field placeholder="Reading level" value={form.readingLevel} onChange={(e) => setForm({ ...form, readingLevel: e.target.value })} />
          <Field placeholder="Math level" value={form.mathLevel} onChange={(e) => setForm({ ...form, mathLevel: e.target.value })} />
          <Field type="date" title="IEP date" value={form.iepDate} onChange={(e) => setForm({ ...form, iepDate: e.target.value })} />
          <Field type="date" title="Reevaluation date" value={form.reevalDate} onChange={(e) => setForm({ ...form, reevalDate: e.target.value })} />
          <Field placeholder="Accommodations" value={form.accommodations} onChange={(e) => setForm({ ...form, accommodations: e.target.value })} className="md:col-span-2" />
          <TextArea placeholder="Quick notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="md:col-span-3" />
          <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Add student</PrimaryButton>
        </form>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        {workspace.students.length ? workspace.students.map((s) => (
          <Card key={s.id} title={s.name} right={<button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("students", s.id)}><Trash2 className="h-4 w-4" /></button>}>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <Info label="Grade" value={s.grade || "—"} />
              <Info label="Reading" value={s.readingLevel || "—"} />
              <Info label="Math" value={s.mathLevel || "—"} />
              <Info label="IEP" value={s.iepDate || "—"} />
              <Info label="Reevaluation" value={s.reevalDate || "—"} />
              <Info label="Accommodations" value={s.accommodations || "—"} />
            </div>
            {s.notes && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{s.notes}</div>}
          </Card>
        )) : <div className="xl:col-span-2"><Empty>Add students to start your caseload.</Empty></div>}
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 text-slate-700">{value}</div></div>;
}

function Meetings({ workspace, setWorkspace, remove, studentOptions }: SectionProps & { studentOptions: () => ReactNode }) {
  const [form, setForm] = useState({ student: "", type: "Annual IEP", date: "", notes: "" });
  function add(e: FormEvent) {
    e.preventDefault();
    setWorkspace((p) => ({ ...p, meetings: [...p.meetings, { id: id(), ...form, done: false }] }));
    setForm({ student: "", type: "Annual IEP", date: "", notes: "" });
  }
  return (
    <>
      <Card title="IEP, reevaluation & meeting timeline">
        <form onSubmit={add} className="grid gap-3 md:grid-cols-4">
          <Select value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} required>{studentOptions()}</Select>
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option>Annual IEP</option><option>Reevaluation</option><option>Planning meeting</option><option>Parent meeting</option><option>Progress review</option><option>Other</option>
          </Select>
          <Field type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Add meeting</PrimaryButton>
          <TextArea placeholder="Meeting notes / checklist" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="md:col-span-4" />
        </form>
      </Card>
      <Card title="Timeline">
        {workspace.meetings.length ? <div className="space-y-2">{[...workspace.meetings].sort((a,b)=>dateValue(a.date)-dateValue(b.date)).map((m) => (
          <div key={m.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 sm:items-center">
            <input type="checkbox" className="h-5 w-5 shrink-0" checked={m.done} onChange={() => setWorkspace((p) => ({ ...p, meetings: p.meetings.map((x) => x.id === m.id ? { ...x, done: !x.done } : x) }))} />
            <div className="min-w-0 flex-1">
              <div className={`font-semibold ${m.done ? "text-slate-400 line-through" : ""}`}>{m.student} · {m.type}</div>
              <div className="mt-1 text-sm text-slate-500">{m.date || "No date"}{m.notes ? ` · ${m.notes}` : ""}</div>
            </div>
            <button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("meetings", m.id)}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}</div> : <Empty>No meetings added.</Empty>}
      </Card>
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

function Tasks({ workspace, setWorkspace, remove }: SectionProps) {
  const [form, setForm] = useState({ title: "", dueDate: "", recurring: "" });
  function add(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setWorkspace((p) => ({ ...p, tasks: [...p.tasks, { id: id(), ...form, done: false }] }));
    setForm({ title: "", dueDate: "", recurring: "" });
  }
  return (
    <Card title="Reminders & to-dos">
      <form onSubmit={add} className="mb-5 grid gap-3 md:grid-cols-4">
        <Field placeholder="Task" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="md:col-span-2" required />
        <Field type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        <Select value={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.value })}><option value="">One-time</option><option>Daily</option><option>Weekly</option><option>Monthly</option><option>Quarterly</option></Select>
        <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Add task</PrimaryButton>
      </form>
      {workspace.tasks.length ? <div className="space-y-2">{workspace.tasks.map((task) => (
        <div key={task.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
          <input type="checkbox" className="h-5 w-5 shrink-0" checked={task.done} onChange={() => setWorkspace((p) => ({ ...p, tasks: p.tasks.map((t) => t.id === task.id ? { ...t, done: !t.done } : t) }))} />
          <div className="min-w-0 flex-1"><div className={task.done ? "text-slate-400 line-through" : "font-medium"}>{task.title}</div><div className="text-xs text-slate-500">{task.dueDate || "No due date"} · {task.recurring || "One-time"}</div></div>
          <button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("tasks", task.id)}><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}</div> : <Empty>No tasks yet.</Empty>}
    </Card>
  );
}

function Notes({ workspace, setWorkspace, remove, studentOptions }: SectionProps & { studentOptions: () => ReactNode }) {
  const [form, setForm] = useState({ student: "", type: "Check-in", body: "", date: TODAY() });
  function add(e: FormEvent) {
    e.preventDefault();
    if (!form.body.trim()) return;
    setWorkspace((p) => ({ ...p, notes: [{ id: id(), ...form }, ...p.notes] }));
    setForm({ student: "", type: "Check-in", body: "", date: TODAY() });
  }
  return (
    <>
      <Card title="Check-ins, concerns & meeting notes">
        <form onSubmit={add} className="grid gap-3 md:grid-cols-4">
          <Select value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })}>{studentOptions()}</Select>
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>Check-in</option><option>Concern</option><option>Meeting note</option><option>Teacher note</option><option>Progress note</option></Select>
          <Field type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Add note</PrimaryButton>
          <TextArea placeholder="Write note…" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="md:col-span-4" required />
        </form>
      </Card>
      <Card title="Notes">
        {workspace.notes.length ? <div className="space-y-3">{workspace.notes.map((n) => (
          <div key={n.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><div className="font-semibold">{n.student || "General"} · {n.type}</div><div className="text-xs text-slate-500">{n.date}</div></div>
              <button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("notes", n.id)}><Trash2 className="h-4 w-4" /></button>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{n.body}</p>
          </div>
        ))}</div> : <Empty>No notes yet.</Empty>}
      </Card>
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

function Emails({ workspace, setWorkspace, remove }: SectionProps) {
  const [form, setForm] = useState({ from: "", subject: "", body: "", action: "", draft: "", date: TODAY() });
  function add(e: FormEvent) {
    e.preventDefault();
    if (!form.body.trim() && !form.subject.trim()) return;
    setWorkspace((p) => ({ ...p, emails: [{ id: id(), ...form }, ...p.emails] }));
    setForm({ from: "", subject: "", body: "", action: "", draft: "", date: TODAY() });
  }
  return (
    <>
      <Card title="Email organizer">
        <p className="mb-4 text-sm text-slate-600">Paste important school emails here, pull out the action you need to take, and keep a reply draft beside it.</p>
        <form onSubmit={add} className="grid gap-3 md:grid-cols-4">
          <Field placeholder="From" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
          <Field placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="md:col-span-2" />
          <Field type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <TextArea placeholder="Paste email here" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="md:col-span-2" />
          <TextArea placeholder="Action item / what I need to do" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} />
          <TextArea placeholder="Reply draft" value={form.draft} onChange={(e) => setForm({ ...form, draft: e.target.value })} />
          <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Save email</PrimaryButton>
        </form>
      </Card>
      <Card title="Saved emails">
        {workspace.emails.length ? <div className="space-y-3">{workspace.emails.map((e) => <div key={e.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{e.subject || "Untitled email"}</div><div className="text-xs text-slate-500">{e.from || "Unknown sender"} · {e.date}</div></div><button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("emails", e.id)}><Trash2 className="h-4 w-4" /></button></div>{e.action && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><strong>Action:</strong> {e.action}</div>}{e.body && <details className="mt-3 text-sm text-slate-600"><summary className="cursor-pointer font-medium text-slate-700">Original email</summary><p className="mt-2 whitespace-pre-wrap leading-6">{e.body}</p></details>}{e.draft && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><strong>Reply draft</strong><p className="mt-1 whitespace-pre-wrap">{e.draft}</p></div>}</div>)}</div> : <Empty>No emails saved yet.</Empty>}
      </Card>
    </>
  );
}
