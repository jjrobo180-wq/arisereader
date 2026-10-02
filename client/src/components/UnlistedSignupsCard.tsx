import { useEffect, useState } from "react";
import { UserPlus, Check, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type UnlistedSignup = {
  userId: number; username: string; displayName: string; gradeLevel: string | null;
  schoolId: number | null; schoolName: string | null; teacherName: string | null; createdAt: string;
};

function cookieToken(): string | null {
  try {
    const c = document.cookie.split(";").map(v => v.trim()).find(v => v.startsWith("arise_session="));
    return c ? JSON.parse(atob(c.substring("arise_session=".length))).token || null : null;
  } catch { return null; }
}

// Admin card: students who chose "school/teacher not listed" at signup.
// They already have full student access; this is where the admin connects them.
export default function UnlistedSignupsCard() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<UnlistedSignup[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [picks, setPicks] = useState<Record<number, { schoolId: string; teacherId: string }>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");

  const authHeaders = () => ({ Authorization: `Bearer ${token || cookieToken()}`, "Content-Type": "application/json" });

  const load = async () => {
    try {
      const [r, s, t] = await Promise.all([
        fetch(`${API_BASE}/api/admin/unlisted-signups`, { headers: authHeaders(), cache: "no-store" }),
        fetch(`${API_BASE}/api/schools`),
        fetch(`${API_BASE}/api/teacher-admin/teachers`, { headers: authHeaders() }),
      ]);
      if (r.ok) setRequests(await r.json());
      if (s.ok) setSchools(await s.json());
      if (t.ok) setTeachers(await t.json());
    } catch {}
  };

  useEffect(() => { void load(); }, [token]);

  const resolve = async (req: UnlistedSignup, pick: { schoolId: string; teacherId: string }, dismiss = false) => {
    if (!dismiss && !pick.schoolId && !pick.teacherId) { setError("Pick a school or teacher first, or tap Dismiss."); return; }
    setBusy(req.userId); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/unlisted-signups/${req.userId}/resolve`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(dismiss ? {} : { schoolId: pick.schoolId || null, teacherId: pick.teacherId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not save.");
      setRequests(prev => prev.filter(r => r.userId !== req.userId));
    } catch (e: any) { setError(e.message || "Could not save."); }
    finally { setBusy(null); }
  };

  if (!requests.length) return null;

  const setPick = (userId: number, patch: Partial<{ schoolId: string; teacherId: string }>) =>
    setPicks(prev => ({ ...prev, [userId]: { schoolId: "", teacherId: "", ...prev[userId], ...patch } }));

  return (
    <Card data-section="unlisted-signups" className="shadow-md border-fuchsia-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-fuchsia-400">
          <UserPlus className="w-5 h-5" />
          School / Teacher Not Listed ({requests.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-4">These students couldn't find their school or teacher at signup. They already have full student access. Connect them to the right school and teacher here (add the teacher or school first if needed).</p>
        {error && <p className="mb-3 text-xs font-semibold text-red-400">{error}</p>}
        <div className="space-y-3">
          {requests.map(req => {
            const pick = picks[req.userId] || { schoolId: req.schoolId ? String(req.schoolId) : "", teacherId: "" };
            return (
              <div key={req.userId} className="p-3 rounded-xl bg-fuchsia-500/5 border border-fuchsia-500/20 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-fuchsia-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {req.displayName?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0 text-sm">
                    <p className="font-medium">{req.displayName} <span className="text-xs text-muted-foreground">@{req.username}{req.gradeLevel ? ` · Grade ${req.gradeLevel}` : ""}</span></p>
                    {req.schoolName && <p className="text-xs text-fuchsia-300">School they typed: <strong>{req.schoolName}</strong></p>}
                    {!req.schoolName && req.schoolId && <p className="text-xs text-muted-foreground">School: {schools.find(s => s.id === req.schoolId)?.name || "Selected at signup"}</p>}
                    {req.teacherName && <p className="text-xs text-fuchsia-300">Teacher they typed: <strong>{req.teacherName}</strong></p>}
                    <p className="text-[11px] text-muted-foreground">Signed up {new Date(req.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                  <select value={pick.schoolId} onChange={e => setPick(req.userId, { ...pick, schoolId: e.target.value })} className="px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm">
                    <option value="">School…</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <select value={pick.teacherId} onChange={e => setPick(req.userId, { ...pick, teacherId: e.target.value })} className="px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm">
                    <option value="">Teacher…</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.displayName} (@{t.username})</option>)}
                  </select>
                  <Button size="sm" disabled={busy === req.userId} onClick={() => void resolve(req, pick)} className="bg-green-600 hover:bg-green-700 text-white">
                    <Check className="w-3.5 h-3.5" /><span className="ml-1">Connect</span>
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy === req.userId} onClick={() => void resolve(req, pick, true)}>
                    <X className="w-3.5 h-3.5" /><span className="ml-1">Dismiss</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
