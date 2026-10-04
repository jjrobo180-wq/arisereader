import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Clock3, Plus, RefreshCw, Search, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type TimeRequest = {
  status?: string;
  requestedMinutes?: number;
  requestedAt?: string;
  studentName?: string;
};

type StudentRow = {
  id: number;
  displayName: string;
  username: string;
  teacherId: number | null;
  extraMinutes: number;
  totalMinutes: number;
  request: TimeRequest | null;
};

type ManageData = {
  globalMinutes: number;
  day: string;
  students: StudentRow[];
  canSetGlobal: boolean;
};

function cookieToken() {
  try {
    const cookie = document.cookie.split(";").map(v => v.trim()).find(v => v.startsWith("arise_session="));
    if (!cookie) return null;
    return JSON.parse(atob(cookie.slice("arise_session=".length))).token || null;
  } catch { return null; }
}

export default function PlayTimeManager() {
  const { user, token } = useAuth();
  const authToken = token || cookieToken();
  const [data, setData] = useState<ManageData | null>(null);
  const [open, setOpen] = useState(false);
  const [globalInput, setGlobalInput] = useState("10");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const adult = !!user && (user.isAdmin || user.role === "teacher" || user.role === "parent");
  const pendingCount = data?.students.filter(s => s.request?.status === "pending").length || 0;

  const call = async (path: string, options: RequestInit = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...options.headers,
      },
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "Something went wrong.");
    return body;
  };

  const load = async (quiet = false) => {
    if (!adult || !authToken) return;
    if (!quiet) setError("");
    try {
      const body = await call("/api/play-time/manage");
      setData(body);
      setGlobalInput(String(body.globalMinutes || 10));
      if ((body.students || []).some((s: StudentRow) => s.request?.status === "pending")) setOpen(true);
    } catch (e) {
      if (!quiet) setError(e instanceof Error ? e.message : "Could not load play-time controls.");
    }
  };

  useEffect(() => {
    if (!adult || !authToken) return;
    void load();
    const timer = window.setInterval(() => void load(true), 15000);
    return () => window.clearInterval(timer);
  }, [user?.id, authToken]);

  const saveGlobal = async () => {
    const minutes = Math.max(1, Math.min(240, Math.round(Number(globalInput) || 0)));
    setBusy("global"); setError(""); setMessage("");
    try {
      const body = await call("/api/admin/play-time/default", { method: "POST", body: JSON.stringify({ minutes }) });
      setMessage(body.message || "General play time updated.");
      await load(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save general play time."); }
    finally { setBusy(""); }
  };

  const grant = async (student: StudentRow, minutes: number) => {
    const key = `grant-${student.id}`;
    setBusy(key); setError(""); setMessage("");
    try {
      const body = await call(`/api/play-time/students/${student.id}/grant`, { method: "POST", body: JSON.stringify({ minutes }) });
      setMessage(`${student.displayName}: ${body.message || "time added"}`);
      await load(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add time."); }
    finally { setBusy(""); }
  };

  const deny = async (student: StudentRow) => {
    const key = `deny-${student.id}`;
    setBusy(key); setError(""); setMessage("");
    try {
      await call(`/api/play-time/students/${student.id}/request-action`, { method: "POST", body: JSON.stringify({ action: "deny" }) });
      setMessage(`${student.displayName}'s request was declined.`);
      await load(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update the request."); }
    finally { setBusy(""); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = data?.students || [];
    if (!q) return rows;
    return rows.filter(s => s.displayName.toLowerCase().includes(q) || s.username.toLowerCase().includes(q));
  }, [data?.students, search]);

  if (!adult) return null;

  return (
    <Card className="border-cyan-400/20 bg-gradient-to-br from-cyan-500/[.08] via-violet-500/[.05] to-fuchsia-500/[.06] shadow-md">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-300">
            <Clock3 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-300">Game time controls</p>
            <h2 className="text-lg font-black">Student Play Time</h2>
            <p className="text-xs font-semibold text-muted-foreground">
              {data ? `General limit: ${data.globalMinutes} min/day` : "Loading play-time settings…"}
              {pendingCount ? ` · ${pendingCount} request${pendingCount === 1 ? "" : "s"} waiting` : ""}
            </p>
          </div>
          {pendingCount > 0 && <span className="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-black text-slate-950">{pendingCount} REQUEST{pendingCount === 1 ? "" : "S"}</span>}
          <Button variant="outline" size="sm" onClick={() => setOpen(v => !v)}>
            {open ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
            {open ? "Hide" : "Manage"}
          </Button>
        </div>

        {open && (
          <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
            {data?.canSetGlobal && (
              <div className="rounded-2xl border border-violet-400/20 bg-violet-500/[.08] p-4">
                <p className="font-black">General play time for all students</p>
                <p className="mt-1 text-xs text-muted-foreground">This becomes every regular student's daily starting amount. Individual bonus minutes are added on top for today.</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <input type="number" min={1} max={240} value={globalInput} onChange={e => setGlobalInput(e.target.value)} className="h-11 w-24 rounded-xl border border-white/10 bg-background px-3 font-black" />
                    <span className="text-sm font-bold">minutes/day</span>
                  </div>
                  <Button disabled={busy === "global"} onClick={() => void saveGlobal()}>{busy === "global" ? "Saving…" : "Update everyone"}</Button>
                </div>
              </div>
            )}

            {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300">{error}</div>}
            {message && <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-300">{message}</div>}

            {(data?.students?.length || 0) > 5 && (
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a student…" className="h-11 w-full rounded-xl border border-white/10 bg-background pl-9 pr-3" />
              </label>
            )}

            <div className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
              {!data ? (
                <div className="py-6 text-center text-sm text-muted-foreground"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading students…</div>
              ) : filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-muted-foreground">No regular students found.</div>
              ) : filtered.map(student => {
                const pending = student.request?.status === "pending";
                const requested = Math.max(5, Math.min(60, Number(student.request?.requestedMinutes) || 10));
                return (
                  <div key={student.id} className={`rounded-2xl border p-3 ${pending ? "border-amber-400/35 bg-amber-500/[.08]" : "border-white/10 bg-white/[.025]"}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="truncate">{student.displayName}</strong>
                          {pending && <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[9px] font-black text-slate-950">REQUESTED +{requested} MIN</span>}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">@{student.username} · {student.totalMinutes} min today {student.extraMinutes > 0 ? `(${data.globalMinutes} + ${student.extraMinutes} bonus)` : ""}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {pending && (
                          <>
                            <Button size="sm" disabled={busy === `grant-${student.id}`} onClick={() => void grant(student, requested)} className="h-9 bg-emerald-600 font-black text-white hover:bg-emerald-500"><Check className="mr-1 h-4 w-4" />Approve +{requested}</Button>
                            <Button size="sm" variant="outline" disabled={busy === `deny-${student.id}`} onClick={() => void deny(student)} className="h-9"><X className="mr-1 h-4 w-4" />Deny</Button>
                          </>
                        )}
                        {[5,10,15].map(minutes => (
                          <Button key={minutes} size="sm" variant="outline" disabled={busy === `grant-${student.id}`} onClick={() => void grant(student, minutes)} className="h-9 px-2.5 font-black">
                            <Plus className="mr-0.5 h-3.5 w-3.5" />{minutes}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] leading-5 text-muted-foreground">Bonus minutes apply only for today and reset with the daily timer. Passing a book quiz can still unlock unlimited play for the week when that rule is enabled.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
