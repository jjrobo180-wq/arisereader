import { useEffect, useState } from "react";
import { UserPlus, Check, X, School } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type UnlistedSignup = {
  userId: number; username: string; displayName: string; gradeLevel: string | null;
  schoolId: number | null; schoolName: string | null; teacherName: string | null; createdAt: string;
  pendingTeacherName?: string | null;
  /** The advisory and ELA teacher already on file for this school year (students are placed by advisory). */
  advisory?: string | null; elaTeacher?: string | null;
};

type AdvisoryOption = { id: string; name: string; label: string };

/** The school's advisories, for placing the student in one. Picks the one already on file. */
function useAdvisories(schoolId: string, token: string | null) {
  const [list, setList] = useState<AdvisoryOption[] | null>(null);
  useEffect(() => {
    if (!schoolId) { setList([]); return; }
    let alive = true;
    setList(null);
    fetch(`${API_BASE}/api/schools/${encodeURIComponent(schoolId)}/advisories`, { headers: { Authorization: `Bearer ${token || cookieToken()}` }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (alive) setList(Array.isArray(d) ? d : []); })
      .catch(() => { if (alive) setList([]); });
    return () => { alive = false; };
  }, [schoolId, token]);
  return list;
}

/** Advisory dropdown for schools that have advisories; the old teacher dropdown for any that don't. */
function PlacementSelect({ schoolId, grade, value, current, suggestedName, onChange }: {
  schoolId: string; grade: string | null; value: string; current: string | null; suggestedName: string | null; onChange: (value: string) => void;
}) {
  const { token } = useAuth();
  const advisories = useAdvisories(schoolId, token);
  useEffect(() => {
    if (!advisories?.length || value) return;
    const mine = advisories.find((a) => a.name === current);
    if (mine) onChange(`advisory:${mine.id}`);
  }, [advisories, current]); // eslint-disable-line react-hooks/exhaustive-deps
  if (schoolId && advisories === null) return <select disabled aria-label="Advisory" className="w-full min-w-0 px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm opacity-60"><option>Loading advisories…</option></select>;
  if (advisories && advisories.length) {
    return <select value={value.startsWith("advisory:") ? value : ""} onChange={(e) => onChange(e.target.value)} aria-label="Advisory"
      className="w-full min-w-0 max-w-full truncate px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm">
      <option value="">Advisory…</option>
      {advisories.map((a) => <option key={a.id} value={`advisory:${a.id}`}>{a.label}</option>)}
    </select>;
  }
  return <SchoolTeacherSelect schoolId={schoolId} grade={grade} value={value} suggestedName={suggestedName} onChange={onChange} />;
}

type SchoolTeacher = { id: number | string; display_name?: string; displayName?: string; directory?: boolean };

/** Use the same school-and-grade directory as student sign-up, including pending teachers. */
function SchoolTeacherSelect({ schoolId, grade, value, suggestedName, onChange }: {
  schoolId: string; grade: string | null; value: string; suggestedName: string | null;
  onChange: (value: string) => void;
}) {
  const [teachers, setTeachers] = useState<SchoolTeacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!schoolId) { setTeachers([]); setError(""); return; }
    const controller = new AbortController();
    setLoading(true); setError(""); setTeachers([]);
    const params = new URLSearchParams({ schoolId, ...(grade ? { grade } : {}) });
    fetch(`${API_BASE}/api/teachers/by-school-grade?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Teachers could not be loaded");
        return r.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const list: SchoolTeacher[] = Array.isArray(data) ? data : [];
        setTeachers(list);
        // Match the teacher the family typed during signup (Ms.Waldek = Ms. Waldek).
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (suggestedName && !value) {
          const match = list.find((t) => norm(t.display_name || t.displayName || "") === norm(suggestedName));
          if (match) onChange(String(match.id));
        }
      })
      .catch((e) => { if (!controller.signal.aborted) setError(e.message || "Teachers could not be loaded"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [schoolId, grade]);
  return <div className="min-w-0">
    <select value={teachers.some((t) => String(t.id) === value) ? value : ""} onChange={(e) => onChange(e.target.value)}
      disabled={!schoolId || loading}
      aria-label="Assign teacher"
      className="w-full min-w-0 max-w-full truncate px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm disabled:opacity-60">
      <option value="">{!schoolId ? "Choose school first…" : loading ? "Loading teachers…" : "Teacher…"}</option>
      {teachers.map((t) => <option key={String(t.id)} value={String(t.id)}>
        {t.display_name || t.displayName}{t.directory ? " (not signed up yet)" : ""}
      </option>)}
    </select>
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>;
}

function cookieToken(): string | null {
  try {
    const c = document.cookie.split(";").map(v => v.trim()).find(v => v.startsWith("arise_session="));
    return c ? JSON.parse(atob(c.substring("arise_session=".length))).token || null : null;
  } catch { return null; }
}

// Admin cards: students who chose "teacher not listed" (kept at their school)
// or "school not listed" at signup. Separate from independent (homeschool) readers.
// They already have full student access; this is where the admin connects them.
export default function UnlistedSignupsCard() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<UnlistedSignup[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [notice, setNotice] = useState<Record<number, string>>({});
  const [picks, setPicks] = useState<Record<number, { schoolId: string; teacherId: string }>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");

  const authHeaders = () => ({ Authorization: `Bearer ${token || cookieToken()}`, "Content-Type": "application/json" });

  const load = async () => {
    try {
      const [r, s] = await Promise.all([
        fetch(`${API_BASE}/api/admin/unlisted-signups`, { headers: authHeaders(), cache: "no-store" }),
        fetch(`${API_BASE}/api/schools`),
      ]);
      if (r.ok) setRequests(await r.json());
      if (s.ok) setSchools(await s.json());
    } catch {}
  };

  useEffect(() => { void load(); }, [token]);

  const resolve = async (req: UnlistedSignup, pick: { schoolId: string; teacherId: string }, dismiss = false) => {
    if (!dismiss && !pick.schoolId && !pick.teacherId) { setError("Pick a school or teacher first, or tap Dismiss."); return; }
    if (!dismiss && !req.schoolName && !pick.teacherId) { setError("Choose an advisory before connecting this student."); return; }
    setBusy(req.userId); setError("");
    setNotice((prev) => ({ ...prev, [req.userId]: "" }));
    try {
      const res = await fetch(`${API_BASE}/api/admin/unlisted-signups/${req.userId}/resolve`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(dismiss ? {} : {
          schoolId: pick.schoolId || null,
          ...(pick.teacherId.startsWith("advisory:") ? { advisoryId: pick.teacherId.slice("advisory:".length) }
            : pick.teacherId.startsWith("directory:") ? { directoryTeacherId: pick.teacherId } : { teacherId: pick.teacherId || null }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not save.");
      if (data.pending) {
        setRequests(prev => prev.map(r => r.userId === req.userId ? {
          ...r, teacherName: data.teacherName, pendingTeacherName: data.teacherName,
        } : r));
        setNotice(prev => ({ ...prev, [req.userId]: data.message || "Pending teacher saved." }));
      } else {
        setRequests(prev => prev.filter(r => r.userId !== req.userId));
      }
    } catch (e: any) { setError(e.message || "Could not save."); }
    finally { setBusy(null); }
  };

  if (!requests.length) return null;

  const setPick = (userId: number, patch: Partial<{ schoolId: string; teacherId: string }>) =>
    setPicks(prev => ({ ...prev, [userId]: { schoolId: "", teacherId: "", ...prev[userId], ...patch } }));

  const teacherOnly = requests.filter(r => !r.schoolName);
  const schoolMissing = requests.filter(r => !!r.schoolName);

  const renderRow = (req: UnlistedSignup) => {
    const pick = picks[req.userId] || { schoolId: req.schoolId ? String(req.schoolId) : "", teacherId: "" };
    const schoolLabel = req.schoolId ? (schools.find(s => s.id === req.schoolId)?.name || "Their school") : null;
    return (
      <div key={req.userId} className="p-3 rounded-xl bg-fuchsia-500/5 border border-fuchsia-500/20 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-fuchsia-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
            {req.displayName?.charAt(0).toUpperCase() || "?"}
          </div>
          <div className="flex-1 min-w-0 text-sm">
            <p className="font-medium">{req.displayName} <span className="text-xs text-muted-foreground">@{req.username}{req.gradeLevel ? ` · Grade ${req.gradeLevel}` : ""}</span></p>
            {schoolLabel && <p className="text-xs text-muted-foreground">School: <strong className="text-foreground">{schoolLabel}</strong></p>}
            {req.schoolName && <p className="text-xs text-fuchsia-300">School they typed: <strong>{req.schoolName}</strong></p>}
            <p className="text-xs text-fuchsia-300">Advisory: <strong>{req.advisory || "Not placed yet"}</strong>{req.elaTeacher ? <> · ELA: <strong>{req.elaTeacher}</strong></> : null}</p>
            <p className="text-[11px] text-muted-foreground">Signed up {new Date(req.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
          <select value={pick.schoolId} onChange={e => setPick(req.userId, { schoolId: e.target.value, teacherId: "" })} className="w-full min-w-0 max-w-full truncate px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm">
            <option value="">School…</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <PlacementSelect key={`${pick.schoolId}:${req.gradeLevel || "all"}`} schoolId={pick.schoolId} grade={req.gradeLevel}
            value={pick.teacherId} current={req.advisory || null} suggestedName={req.pendingTeacherName || req.teacherName}
            onChange={teacherId => setPick(req.userId, { teacherId })} />
          <Button size="sm" disabled={busy === req.userId} onClick={() => void resolve(req, pick)} className="bg-green-600 hover:bg-green-700 text-white">
            <Check className="w-3.5 h-3.5" /><span className="ml-1">{pick.teacherId.startsWith("directory:") ? "Save pending" : "Connect"}</span>
          </Button>
          <Button size="sm" variant="ghost" disabled={busy === req.userId} onClick={() => void resolve(req, pick, true)}>
            <X className="w-3.5 h-3.5" /><span className="ml-1">Dismiss</span>
          </Button>
        </div>
        {notice[req.userId] && <p role="status" className="text-sm font-medium text-amber-700">{notice[req.userId]}</p>}
      </div>
    );
  };

  return (
    <>
      {teacherOnly.length > 0 && (
        <Card data-section="teacher-not-listed" className="shadow-md border-fuchsia-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-fuchsia-400">
              <UserPlus className="w-5 h-5" />
              Not placed yet ({teacherOnly.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4">These students are already connected to their school. Check their advisory, change it if needed, and click Connect.</p>
            {error && <p className="mb-3 text-xs font-semibold text-red-400">{error}</p>}
            <div className="space-y-3">{teacherOnly.map(renderRow)}</div>
          </CardContent>
        </Card>
      )}
      {schoolMissing.length > 0 && (
        <Card data-section="school-not-listed" className="shadow-md border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-400">
              <School className="w-5 h-5" />
              School Not Listed ({schoolMissing.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4">These students go to a school that isn't on A.R.I.S.E. yet. They are not independent readers. They have full student access. Add their school, then connect them to it and their advisory.</p>
            {error && teacherOnly.length === 0 && <p className="mb-3 text-xs font-semibold text-red-400">{error}</p>}
            <div className="space-y-3">{schoolMissing.map(renderRow)}</div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
