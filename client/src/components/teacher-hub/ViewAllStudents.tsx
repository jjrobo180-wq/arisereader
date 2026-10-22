// The Reader page's "View all students" tab (replaces "Advisory & Lit"): every student at the
// teacher's school, in one place, with full control — not just the teacher's own class. Any
// teacher can view scores and reading history, change a password, approve a waiting student,
// move a student to another advisory/teacher, or manage rewards, for any student at their
// school. Filter by Advisory or by Lit (ELA) teacher. Scoping rule: server/routes.ts
// canReachStudent — every teacher now reaches every student at their own school.
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Gift, KeyRound, Search, UserRound, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { Pill, type SchoolStudent, type Teacher, type Action } from "./HubReaderTools";
import { Card, Empty, Field, Select } from "./ui";

type LitEntry = { studentId: number; lit: { name: string } | null; advisory: { name: string } | null };
type ClassTeachersData = { entries?: LitEntry[] };

/** A school student joined with their Lit (ELA) teacher's name, from /api/teacher/class-teachers. */
type Row = SchoolStudent & { litTeacher: string | null };

const iconBtn = "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950";

export default function ViewAllStudents({ school, schoolBusy, onReloadSchool, onView, onAction, request }: {
  school: { students: SchoolStudent[]; teachers: Teacher[] } | null;
  schoolBusy: boolean;
  onReloadSchool: () => void;
  onView: (id: number) => void;
  onAction: (s: Action["student"], kind: Action["kind"]) => void;
  request: (path: string, options?: RequestInit) => Promise<any>;
}) {
  const { token } = useAuth();
  const [litByStudent, setLitByStudent] = useState<Map<number, string>>(new Map());
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [advisory, setAdvisory] = useState("");
  const [litFilter, setLitFilter] = useState("");

  // The Lit (ELA) teacher a student typed isn't on the school roster (/all-students only has
  // Advisory), so it's fetched here and joined in by student id.
  const loadLit = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/teacher/class-teachers`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const d: ClassTeachersData = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any)?.message || "The Lit teacher list could not be loaded.");
      const m = new Map<number, string>();
      for (const e of d.entries || []) if (e.lit?.name) m.set(e.studentId, e.lit.name);
      setLitByStudent(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The Lit teacher list could not be loaded.");
    }
  }, [token]);
  useEffect(() => { void loadLit(); }, [loadLit]);

  const rows: Row[] = useMemo(
    () => (school?.students || []).map((s) => ({ ...s, litTeacher: litByStudent.get(Number(s.id)) || null })),
    [school, litByStudent],
  );
  const advisories = useMemo(() => [...new Set(rows.map((s) => s.advisory).filter((a): a is string => !!a))].sort((a, b) => a.localeCompare(b)), [rows]);
  const litTeachers = useMemo(() => [...new Set(rows.map((s) => s.litTeacher).filter((a): a is string => !!a))].sort((a, b) => a.localeCompare(b)), [rows]);

  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => rows.filter((s) =>
    (!needle || (s.displayName || "").toLowerCase().includes(needle) || s.username.toLowerCase().includes(needle) || (s.advisory || "").toLowerCase().includes(needle) || (s.litTeacher || "").toLowerCase().includes(needle))
    && (!advisory || (advisory === "none" ? !s.advisory : s.advisory === advisory))
    && (!litFilter || (litFilter === "none" ? !s.litTeacher : s.litTeacher === litFilter)),
  ), [rows, needle, advisory, litFilter]);

  return (
    <div className="space-y-4" data-testid="view-all-students">
      {error && <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      <Card title={`All students (${rows.length})`}>
        <p className="pt-3 text-sm text-slate-600">
          Every student at your school, with full control: view scores and what they've read, change a password, approve a waiting student, move their advisory, or manage rewards.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Field value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or username" className="pl-9" aria-label="Search students" data-testid="view-all-search" />
          </label>
          <Select value={advisory} onChange={(e) => setAdvisory(e.target.value)} aria-label="Filter by advisory" data-testid="view-all-advisory-filter">
            <option value="">Every advisory</option>
            {advisories.map((a) => <option key={a} value={a}>{a}</option>)}
            <option value="none">No advisory yet</option>
          </Select>
          <Select value={litFilter} onChange={(e) => setLitFilter(e.target.value)} aria-label="Filter by Lit teacher" data-testid="view-all-lit-filter">
            <option value="">Every Lit teacher</option>
            {litTeachers.map((t) => <option key={t} value={t}>{t}</option>)}
            <option value="none">No Lit teacher yet</option>
          </Select>
        </div>
      </Card>

      {schoolBusy && !school ? (
        <Card><Empty>Loading the whole school…</Empty></Card>
      ) : shown.length ? (
        <Card title={`${shown.length} student${shown.length === 1 ? "" : "s"}`}>
          <ul className="space-y-2 pt-2" data-testid="view-all-list">
            {shown.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:p-4" data-testid={`card-all-student-${s.id}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                    {s.displayName || s.username}
                    {!s.approvedByTeacher && <Pill tone="amber">Waiting</Pill>}
                  </div>
                  <div className="text-sm text-slate-500">
                    @{s.username} · {s.advisory ? `Advisory: ${s.advisory}` : "No advisory yet"} · {s.litTeacher ? `Lit: ${s.litTeacher}` : "No Lit teacher yet"} · {s.totalPoints || 0} points · {s.quizzesTaken || 0} quizzes · {s.quizzesMastered || 0} mastered
                  </div>
                </div>
                <div className="-m-1 flex flex-wrap items-center">
                  <button type="button" className={iconBtn} onClick={() => onView(s.id)} data-testid={`button-view-${s.id}`}><UserRound className="h-4 w-4" /> Profile</button>
                  {!s.approvedByTeacher && (
                    <button type="button" className={iconBtn} onClick={() => {
                      setError("");
                      request(`/api/teacher-admin/students/${s.id}/approve`, { method: "POST" }).then(onReloadSchool)
                        .catch((e) => setError(e instanceof Error ? e.message : "That student could not be approved."));
                    }} data-testid={`button-approve-${s.id}`}>
                      <Users className="h-4 w-4" /> Approve
                    </button>
                  )}
                  <button type="button" className={iconBtn} onClick={() => onAction({ id: s.id, name: s.displayName || s.username, username: s.username, teacherId: s.teacherId, teacherName: s.teacherName }, "password")} data-testid={`button-password-${s.id}`}>
                    <KeyRound className="h-4 w-4" /> Password
                  </button>
                  <button type="button" className={iconBtn} onClick={() => onAction({ id: s.id, name: s.displayName || s.username, username: s.username, teacherId: s.teacherId, teacherName: s.teacherName }, "reward")} data-testid={`button-reward-${s.id}`}>
                    <Gift className="h-4 w-4" /> Rewards
                  </button>
                  <button type="button" className={iconBtn} onClick={() => onAction({ id: s.id, name: s.displayName || s.username, username: s.username, teacherId: s.teacherId, teacherName: s.teacherName, advisory: s.advisory, schoolId: s.schoolId }, "reassign")} data-testid={`button-advisory-${s.id}`}>
                    <Users className="h-4 w-4" /> Advisory
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card><Empty>{needle || advisory || litFilter ? "No one matches that search." : "No students at your school yet."}</Empty></Card>
      )}
    </div>
  );
}
