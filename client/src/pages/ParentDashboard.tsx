import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Trophy, BookOpen, Award, LogOut, Brain, Users, Gamepad2, Settings2,
  UserPlus, ChevronDown, Eye, ShieldCheck, Clock3, Sparkles, MessageSquareText, Home, KeyRound, Copy
} from "lucide-react";
import { generateCertificate } from "@/lib/certificate";
import { fetchFamilySettings, saveFamilySettings, type ParentControls } from "@/lib/parentControls";

const SESSION_COOKIE = "arise_session";
function getTokenFromCookie(): string | null {
  try {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const c = cookies[i].trim();
      if (c.startsWith(SESSION_COOKIE + "=")) {
        const raw = c.substring(SESSION_COOKIE.length + 1);
        const data = JSON.parse(atob(raw));
        return data.token || null;
      }
    }
  } catch {}
  return null;
}

interface LinkedStudent {
  id: number;
  displayName: string;
  username: string;
  isEyeGazeUser: boolean;
  teacherId: number | null;
}

interface QuizResult {
  bookId: number;
  title: string;
  author: string;
  coverUrl: string | null;
  readUrl: string | null;
  pointsValue: number;
  score: number;
  total: number;
  pointsEarned: number;
  passed: boolean;
  passingScore: number;
  completedAt: string;
}

interface ProfileData {
  student: LinkedStudent;
  totalPoints: number;
  quizzesTaken: number;
  totalBooks: number;
  quizResults: QuizResult[];
}

type RegularControls = {
  locked: boolean;
  dailyGameLimit: number | null;
  gamesPerPassedQuiz: number;
  weeklyUnlimitedOnPass: boolean;
};

const DEFAULT_REGULAR_CONTROLS: RegularControls = {
  locked: false,
  dailyGameLimit: null,
  gamesPerPassedQuiz: 0,
  weeklyUnlimitedOnPass: true,
};

export default function ParentDashboard() {
  const { token, user, logout } = useAuth();
  const [linkedStudents, setLinkedStudents] = useState<LinkedStudent[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(() => {
    const saved = Number(sessionStorage.getItem("arise_parent_child_id"));
    return Number.isSafeInteger(saved) && saved > 0 ? saved : null;
  });
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");
  const [parentCode, setParentCode] = useState("");
  const [linking, setLinking] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [growthCheck, setGrowthCheck] = useState<any>(null);
  const [regularControls, setRegularControls] = useState<RegularControls>(DEFAULT_REGULAR_CONTROLS);
  const [eyeControls, setEyeControls] = useState<ParentControls | null>(null);
  const [controlSaving, setControlSaving] = useState(false);
  const [controlMessage, setControlMessage] = useState("");
  const profileRequest = useRef(0);
  const [controlsError, setControlsError] = useState("");
  const [proctorPassword, setProctorPassword] = useState("");
  const [proctorCopied, setProctorCopied] = useState(false);

  const authToken = token || getTokenFromCookie();

  const loadProfile = useCallback(async (studentId: number) => {
    if (!authToken) return;
    const requestId = ++profileRequest.current;
    setSwitching(true);
    setError("");
    setControlsError("");
    setData(null);
    setEyeControls(null);
    setRegularControls(DEFAULT_REGULAR_CONTROLS);
    setGrowthCheck(null);
    setControlMessage("");
    try {
      sessionStorage.setItem("arise_parent_child_id", String(studentId));
      setSelectedChildId(studentId);

      const res = await fetch(`${API_BASE}/api/parent/student-profile?studentId=${studentId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: "no-store",
      });
      const profile = await res.json();
      if (!res.ok) throw new Error(profile.message || "Failed to load student profile");
      if (requestId !== profileRequest.current) return;

      void fetch(`${API_BASE}/api/family/growth-check/student/${studentId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: "no-store",
      })
        .then(r => r.ok ? r.json() : null)
        .then(gc => { if (requestId === profileRequest.current) setGrowthCheck(gc?.available ? gc : null); })
        .catch(() => { if (requestId === profileRequest.current) setGrowthCheck(null); });

      try {
        if (profile.student.isEyeGazeUser) {
          const result = await fetchFamilySettings(authToken, studentId);
          if (requestId !== profileRequest.current) return;
          setEyeControls(result.settings);
        } else {
          const controlsRes = await fetch(`${API_BASE}/api/parent/student-controls/${studentId}`, {
            headers: { Authorization: `Bearer ${authToken}` },
            cache: "no-store",
          });
          const body = await controlsRes.json();
          if (!controlsRes.ok) throw new Error(body.message || "Could not load controls.");
          if (requestId !== profileRequest.current) return;
          const c = body.control || {};
          setRegularControls({
            locked: !!c.locked,
            dailyGameLimit: c.daily_game_limit === null || c.daily_game_limit === undefined ? null : Number(c.daily_game_limit),
            gamesPerPassedQuiz: Number(c.games_per_passed_quiz || 0),
            weeklyUnlimitedOnPass: c.weekly_unlimited_on_pass !== false,
          });
        }
      } catch (err: any) {
        if (requestId !== profileRequest.current) return;
        setControlsError(err?.message || "Could not load controls. Select this child again to retry.");
      }
      if (requestId === profileRequest.current) setData(profile);
    } catch (err: any) {
      if (requestId !== profileRequest.current) return;
      setError(err?.message || "Could not load this child.");
      setData(null);
    } finally {
      if (requestId === profileRequest.current) setSwitching(false);
    }
  }, [authToken]);

  const loadFamily = useCallback(async () => {
    if (!authToken) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/parent/students`, {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Could not load linked students.");
      const students: LinkedStudent[] = Array.isArray(body.students) ? body.students : [];
      setLinkedStudents(students);
      if (!students.length) {
        setData(null);
        setShowLink(true);
        return;
      }
      const preferred = students.some(s => s.id === selectedChildId) ? selectedChildId! : students[0].id;
      await loadProfile(preferred);
    } catch (err: any) {
      setError(err?.message || "Could not load your family dashboard.");
    } finally {
      setLoading(false);
    }
  }, [authToken, loadProfile, selectedChildId]);

  useEffect(() => { void loadFamily(); }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    fetch(`${API_BASE}/api/parent/proctor-password`, {
      headers: { Authorization: `Bearer ${authToken}` },
      cache: "no-store",
    })
      .then(async (res) => res.ok ? res.json() : null)
      .then((body) => { if (body?.password) setProctorPassword(String(body.password)); })
      .catch(() => {});
  }, [authToken, linkedStudents.length]);

  const copyProctorPassword = async () => {
    if (!proctorPassword) return;
    try {
      await navigator.clipboard.writeText(proctorPassword);
      setProctorCopied(true);
      window.setTimeout(() => setProctorCopied(false), 1600);
    } catch {}
  };

  const handleLogout = () => {
    sessionStorage.removeItem("arise_parent_child_id");
    logout();
    window.location.hash = "/";
  };

  const linkStudent = async () => {
    if (!authToken) return;
    setLinking(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/parent/link-code`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ parentCode }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Could not connect your child.");
      setParentCode("");
      setShowLink(false);
      await loadFamily();
    } catch (err: any) {
      setError(err?.message || "Could not connect your child.");
    } finally {
      setLinking(false);
    }
  };

  const saveRegularControls = async () => {
    if (!authToken || !data) return;
    setControlSaving(true);
    setControlMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/parent/student-controls/${data.student.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(regularControls),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || "Could not save controls.");
      setControlMessage("✓ Controls saved for " + data.student.displayName + ".");
    } catch (err: any) {
      setControlMessage(err?.message || "Could not save controls.");
    } finally {
      setControlSaving(false);
    }
  };

  const saveEyeControls = async (next: ParentControls) => {
    if (!authToken || !data) return;
    setControlSaving(true);
    setControlMessage("");
    try {
      const result = await saveFamilySettings(authToken, next, undefined, data.student.id);
      setEyeControls(result.settings);
      setControlMessage("✓ Controls saved for " + data.student.displayName + ".");
    } catch (err: any) {
      setControlMessage(err?.message || "Could not save controls.");
    } finally {
      setControlSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center arise-page-bg"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen arise-page-bg">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0d0b1a]/92 backdrop-blur-xl shadow-sm">
        <div className="max-w-6xl mx-auto px-4 min-h-16 py-2 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.2em] arise-gradient-text">A.R.I.S.E. Family</p>
            <h1 className="text-lg font-black text-foreground">Parent Portal</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowLink(v => !v)}>
            <UserPlus className="w-4 h-4 mr-1" /> Add child
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4" /><span className="hidden sm:inline ml-1">Logout</span>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {proctorPassword && (
          <section className="overflow-hidden rounded-[1.75rem] border border-violet-400/25 bg-gradient-to-r from-violet-500/14 via-fuchsia-500/[.08] to-cyan-400/10 p-4 shadow-[0_18px_55px_rgba(0,0,0,.20)] sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl arise-icon-tile">
                <KeyRound className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-200">Parent Proctor Code</p>
                <h2 className="mt-1 text-lg font-black text-white">Use this code when your child starts a quiz or reading test.</h2>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">This is your private family proctor code. It works for every child linked to this Parent account and records the test as parent-administered.</p>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0f0d1d] px-4 py-3">
                <span className="font-mono text-2xl font-black tracking-[.22em] text-cyan-200">{proctorPassword}</span>
                <button type="button" onClick={() => void copyProctorPassword()} className="rounded-xl p-2 text-violet-200 hover:bg-white/[.07]" aria-label="Copy Parent Proctor Code">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
            {proctorCopied && <p className="mt-2 text-right text-xs font-black text-cyan-200">Copied</p>}
          </section>
        )}

        <section className="rounded-[1.75rem] arise-surface border border-white/10 p-4 sm:p-5 shadow-[0_18px_55px_rgba(0,0,0,.20)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex-1">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Viewing child</p>
              <h2 className="mt-1 text-xl font-black text-foreground">
                {data?.student.displayName || linkedStudents.find(child => child.id === selectedChildId)?.displayName || "Connect a child"}
              </h2>
              <p className="text-sm text-muted-foreground">Switch kids anytime. Progress and controls follow the child you select.</p>
            </div>
            {linkedStudents.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {linkedStudents.map(child => (
                  <button
                    key={child.id}
                    type="button"
                    disabled={switching || controlSaving}
                    onClick={() => void loadProfile(child.id)}
                    className={`min-w-[145px] rounded-2xl border-2 px-4 py-3 text-left transition ${selectedChildId === child.id ? "border-violet-400/40 bg-gradient-to-r from-violet-500/12 via-fuchsia-500/[.08] to-cyan-400/[.08] shadow-md" : "border-white/10 bg-white/[.04] hover:border-violet-400/40"}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`grid h-9 w-9 place-items-center rounded-xl ${child.isEyeGazeUser ? "bg-cyan-500/15 text-cyan-300" : "bg-gradient-to-br from-violet-500/20 via-fuchsia-500/15 to-cyan-400/15 text-violet-200"}`}>
                        {child.isEyeGazeUser ? <Eye className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <strong className="block truncate text-sm">{child.displayName}</strong>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{child.isEyeGazeUser ? "Eye Gazer" : "Reader"}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {showLink && (
            <div className="mt-5 border-t border-white/10 pt-5">
              <p className="font-bold text-foreground">Connect another child</p>
              <p className="mt-1 text-sm text-muted-foreground">Enter the parent code from that child’s account or school handout. One parent account can now hold multiple children.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  aria-label="Parent code"
                  className="min-h-11 flex-1 rounded-xl border border-white/10 bg-[#0f0d1d] px-3 text-white"
                  placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
                  value={parentCode}
                  onChange={e => setParentCode(e.target.value.toUpperCase())}
                />
                <Button disabled={linking || !parentCode.trim()} onClick={() => void linkStudent()}>
                  {linking ? "Connecting…" : "Connect child"}
                </Button>
              </div>
            </div>
          )}
        </section>

        {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-300">{error}</div>}

        {switching ? (
          <section role="status" className="rounded-[2rem] arise-surface border border-white/10 p-10 text-center">
            <p className="text-lg font-bold">Loading your child's progress and controls…</p>
          </section>
        ) : !data ? (
          <section className="rounded-[2rem] border border-dashed border-violet-400/30 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/[.05] to-cyan-400/10 p-10 text-center">
            <Users className="mx-auto h-12 w-12 text-violet-300" />
            <h2 className="mt-4 text-2xl font-black">Connect your first child</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Once connected, you’ll be able to switch between children, see each child’s progress, and manage the controls that match their account type.</p>
            <Button className="mt-5" onClick={() => setShowLink(true)}>Add child</Button>
          </section>
        ) : (
          <>
            <section className="overflow-hidden rounded-[2rem] arise-surface border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,.24)]">
              <div className={`p-5 sm:p-6 ${data.student.isEyeGazeUser ? "bg-gradient-to-r from-cyan-500/15 via-violet-500/10 to-[#151326]" : "bg-gradient-to-r from-violet-500/18 via-fuchsia-500/10 to-cyan-400/[.08]"}`}>
                <div className="flex flex-wrap items-center gap-4">
                  <div className={`grid h-16 w-16 place-items-center rounded-2xl text-2xl font-black ${data.student.isEyeGazeUser ? "bg-cyan-400 text-slate-950" : "bg-gradient-to-br from-violet-600 via-fuchsia-500 to-cyan-400 text-white shadow-lg shadow-violet-500/20"}`}>
                    {data.student.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-black">{data.student.displayName}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${data.student.isEyeGazeUser ? "bg-cyan-500/15 text-cyan-300" : "bg-gradient-to-r from-violet-500/15 via-fuchsia-500/10 to-cyan-400/10 text-violet-200 ring-1 ring-violet-400/20"}`}>
                        {data.student.isEyeGazeUser ? "Eye Gazer" : "Non-Eye Gazer"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">@{data.student.username}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 sm:p-5">
                <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><Trophy className="h-5 w-5 text-violet-300" /><div className="mt-2 text-2xl font-black">{data.totalPoints}</div><div className="text-xs text-muted-foreground">Total Points</div></div>
                <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><BookOpen className="h-5 w-5 text-blue-400" /><div className="mt-2 text-2xl font-black">{data.quizzesTaken}</div><div className="text-xs text-muted-foreground">Quizzes Taken</div></div>
                <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><Sparkles className="h-5 w-5 text-green-400" /><div className="mt-2 text-2xl font-black">{Math.max(0, data.totalBooks - data.quizzesTaken)}</div><div className="text-xs text-muted-foreground">Books Left</div></div>
              </div>
            </section>

            <Card className="overflow-hidden border-violet-400/20 shadow-md">
              <CardHeader className="bg-violet-500/[.07]">
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-violet-300" /> Parent Controls · {data.student.displayName}</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                {controlsError ? (
                  <div role="alert" className="space-y-3">
                    <p className="text-sm text-destructive">{controlsError}</p>
                    <Button onClick={() => void loadProfile(data.student.id)}>Reload controls</Button>
                  </div>
                ) : data.student.isEyeGazeUser ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <button onClick={() => window.location.hash = "#/eye-gaze-parent-controls"} className="rounded-2xl border-2 border-cyan-400/30 bg-cyan-500/10 p-4 text-left hover:border-cyan-400">
                        <Settings2 className="h-6 w-6 text-cyan-300" /><h3 className="mt-3 font-black">Access & Game Controls</h3><p className="mt-1 text-xs text-muted-foreground">Choose which learning areas, games, Life Skills, progress, and media your child can open.</p>
                      </button>
                      <button onClick={() => window.location.hash = "#/eye-gaze-parent"} className="rounded-2xl border-2 border-teal-400/30 bg-teal-500/10 p-4 text-left hover:border-teal-400">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 ring-1 ring-fuchsia-400/20"><MessageSquareText className="h-5 w-5 text-fuchsia-200" /></span><h3 className="mt-3 font-black">My Talker</h3><p className="mt-1 text-xs text-muted-foreground">Personal words, pictures, voice, categories, phrases, and communication setup.</p>
                      </button>
                      <button onClick={() => window.location.hash = "#/my-world"} className="rounded-2xl border-2 border-violet-400/30 bg-violet-500/10 p-4 text-left hover:border-violet-400">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-400/20 ring-1 ring-violet-400/20"><Home className="h-5 w-5 text-cyan-200" /></span><h3 className="mt-3 font-black">My World</h3><p className="mt-1 text-xs text-muted-foreground">Build familiar rooms, labels, I-Spy prompts, and real-life learning spaces.</p>
                      </button>
                    </div>

                    {eyeControls && (
                      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-4 sm:grid-cols-3">
                        <label className="flex items-center justify-between gap-4">
                          <div><strong className="block text-sm">Eye Gazer games</strong><span className="text-xs text-muted-foreground">Quickly allow or block the Games area.</span></div>
                          <input
                            type="checkbox"
                            checked={eyeControls.allowedPaths.includes("/eye-gaze-games")}
                            disabled={controlSaving}
                            onChange={e => {
                              const allowedPaths = e.target.checked
                                ? Array.from(new Set([...eyeControls.allowedPaths, "/eye-gaze-games"]))
                                : eyeControls.allowedPaths.filter(p => p !== "/eye-gaze-games");
                              void saveEyeControls({ ...eyeControls, enabled: true, allowedPaths });
                            }}
                            className="h-6 w-6"
                          />
                        </label>
                        <label className="flex items-center gap-3">
                          <Gamepad2 className="h-5 w-5 text-cyan-400" />
                          <div className="flex-1"><strong className="block text-sm">Daily game minutes</strong><span className="text-xs text-muted-foreground">0 means unlimited.</span></div>
                          <input
                            type="number"
                            min={0}
                            max={240}
                            value={eyeControls.gameDailyMinutes}
                            onChange={e => setEyeControls({ ...eyeControls, gameDailyMinutes: Math.max(0, Math.min(240, Number(e.target.value) || 0)) })}
                            onBlur={() => eyeControls && void saveEyeControls(eyeControls)}
                            className="w-20 rounded-xl border border-white/10 bg-[#0f0d1d] p-2 text-right"
                          />
                        </label>
                        <label className="flex items-center gap-3">
                          <Clock3 className="h-5 w-5 text-violet-300" />
                          <div className="flex-1"><strong className="block text-sm">A.R.I.S.E. Shorts daily limit</strong><span className="text-xs text-muted-foreground">0 means unlimited.</span></div>
                          <input
                            type="number"
                            min={0}
                            max={240}
                            value={eyeControls.tvDailyMinutes}
                            onChange={e => setEyeControls({ ...eyeControls, tvDailyMinutes: Math.max(0, Math.min(240, Number(e.target.value) || 0)) })}
                            onBlur={() => eyeControls && void saveEyeControls(eyeControls)}
                            className="w-20 rounded-xl border border-white/10 bg-[#0f0d1d] p-2 text-right"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setRegularControls(c => ({ ...c, locked: !c.locked }))}
                        className={`rounded-2xl border-2 p-4 text-left transition ${regularControls.locked ? "border-red-400/40 bg-red-500/10" : "border-emerald-400/40 bg-emerald-500/10"}`}
                      >
                        <Gamepad2 className={`h-6 w-6 ${regularControls.locked ? "text-red-300" : "text-emerald-300"}`} />
                        <h3 className="mt-3 font-black">{regularControls.locked ? "Games are locked" : "Games are available"}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Tap to {regularControls.locked ? "allow" : "lock"} Club A.R.I.S.E. and arcade play.</p>
                      </button>
                      <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
                        <label className="text-sm font-black">Daily game limit</label>
                        <p className="mt-1 text-xs text-muted-foreground">Leave blank for no daily game-count limit.</p>
                        <input
                          type="number"
                          min={0}
                          max={180}
                          value={regularControls.dailyGameLimit ?? ""}
                          onChange={e => setRegularControls(c => ({ ...c, dailyGameLimit: e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0) }))}
                          className="mt-3 w-full rounded-xl border border-white/10 bg-background p-3"
                          placeholder="Unlimited"
                        />
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
                        <label className="text-sm font-black">Games earned per passed quiz</label>
                        <p className="mt-1 text-xs text-muted-foreground">0 means this rule is off.</p>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={regularControls.gamesPerPassedQuiz}
                          onChange={e => setRegularControls(c => ({ ...c, gamesPerPassedQuiz: Math.max(0, Math.min(20, Number(e.target.value) || 0)) }))}
                          className="mt-3 w-full rounded-xl border border-white/10 bg-background p-3"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setRegularControls(c => ({ ...c, weeklyUnlimitedOnPass: !c.weeklyUnlimitedOnPass }))}
                        className={`rounded-2xl border-2 p-4 text-left ${regularControls.weeklyUnlimitedOnPass ? "border-primary/40 bg-primary/10" : "border-white/10 bg-white/[.04]"}`}
                      >
                        <Trophy className="h-6 w-6 text-violet-300" />
                        <h3 className="mt-3 font-black">Unlimited week after passing a quiz</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{regularControls.weeklyUnlimitedOnPass ? "ON — a passed quiz unlocks unlimited play for the week." : "OFF — normal game limits continue after a passed quiz."}</p>
                      </button>
                    </div>
                    <Button onClick={() => void saveRegularControls()} disabled={controlSaving} className="w-full sm:w-auto">
                      {controlSaving ? "Saving…" : "Save controls"}
                    </Button>
                  </div>
                )}
                {controlMessage && <p className="mt-4 rounded-xl bg-muted/30 p-3 text-sm font-bold">{controlMessage}</p>}
              </CardContent>
            </Card>

            <Card className="shadow-md border-primary/30">
              <CardContent className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0"><Users className="w-6 h-6 text-amber-500" /></div>
                <div className="flex-1"><h3 className="font-semibold text-sm">A.R.I.S.E Reading Club</h3><p className="text-xs text-muted-foreground">Sign up the child you are currently viewing.</p></div>
                <Button size="sm" onClick={() => window.location.hash = "#/reading-club"}>Sign Up</Button>
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5" /> Quiz History</CardTitle></CardHeader>
              <CardContent>
                {data.quizResults.length === 0 ? (
                  <div className="text-center py-8"><BookOpen className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" /><p className="text-sm text-muted-foreground">{data.student.displayName} hasn't taken any quizzes yet.</p></div>
                ) : (
                  <div className="space-y-3">
                    {data.quizResults.map((r, index) => (
                      <div key={`${r.bookId}-${r.completedAt}-${index}`} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                        <div className="w-10 h-14 flex-shrink-0">
                          {r.coverUrl ? <img src={`${API_BASE}/api/book-cover/${r.bookId}`} alt={r.title} className="w-full h-full object-cover rounded" /> : <div className="w-full h-full rounded bg-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{r.title}</p>
                          <p className="text-xs text-muted-foreground">{r.author}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{new Date(r.completedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-sm">{r.score}/{r.total}</div>
                          <div className="text-xs text-violet-300 font-semibold">{r.pointsEarned || 0} pts</div>
                          <div className={`text-xs font-semibold ${r.passed ? "text-green-400" : "text-red-400"}`}>{r.passed ? "Passed" : "Not Passed"}</div>
                          {r.passed && (
                            <button
                              onClick={() => generateCertificate(data.student.displayName, r.title, r.pointsEarned ?? 0, new Date(r.completedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }))}
                              className="text-xs text-violet-300 hover:underline mt-1 flex items-center gap-0.5"
                            >
                              <Award className="w-3 h-3" /> Certificate
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {growthCheck && (
              <Card className="shadow-md">
                <CardHeader><CardTitle className="flex items-center gap-2"><Brain className="w-5 h-5" /> Arise Reading Growth Check</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 mb-4">
                    <div className="text-center"><div className="text-4xl font-bold text-violet-300">{growthCheck.latest?.arise_reading_score}</div><div className="text-xs text-muted-foreground">Arise Reading Score</div></div>
                    {growthCheck.scoreChange !== 0 && <div className="text-center"><div className={`text-2xl font-bold ${growthCheck.scoreChange > 0 ? "text-green-400" : "text-violet-300"}`}>{growthCheck.scoreChange > 0 ? "+" : ""}{growthCheck.scoreChange}</div><div className="text-xs text-muted-foreground">Change</div></div>}
                  </div>
                  {growthCheck.latest?.student_summary && <p className="text-sm text-muted-foreground mb-3">{growthCheck.latest.student_summary}</p>}
                  {Array.isArray(growthCheck.skillSummary) && growthCheck.skillSummary.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {growthCheck.skillSummary.map((skill: any, i: number) => <span key={i} className="rounded bg-muted px-2 py-1 text-xs font-medium">{skill.skillName}: {skill.correct}/{skill.total}</span>)}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-3 italic">The Arise Reading Score is a snapshot of reading skills, not a grade. It helps teachers and families support growth.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
