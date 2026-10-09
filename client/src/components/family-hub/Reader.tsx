// Arise LifeHub's A.R.I.S.E. Reader tab for parents, built the LifeHub way (page head, child chips,
// a Progress / Controls / Prizes switch, LifeHub panels, stats, toggles and pop-ups).
// Everything the old parent portal did is here: linking children, each child's points, quizzes,
// certificates, camera quizzes and growth check, the family proctor code, game controls (regular
// and eye gaze), play time, prizes, Reading Club and add-ons.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Award, BookOpen, Brain, Clock3, Copy, Eye, Gamepad2, Gift, Home, KeyRound, Lock, MessageSquareText, Settings2, ShieldCheck, Sparkles, Trophy, Unlock, UserPlus, Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { generateCertificate } from "@/lib/certificate";
import { fetchFamilySettings, saveFamilySettings, type ParentControls } from "@/lib/parentControls";
import HubAddons from "@/components/hub-pieces/HubAddons";
import HubPlayTime from "@/components/hub-pieces/HubPlayTime";
import HubCameraQuizzes from "@/components/hub-pieces/HubCameraQuizzes";
import { HubPrizeBoard, HubPrizeManager } from "@/components/hub-pieces/HubPrizes";
import { Empty, Label, Modal, PageHead, Panel, Toggle, inputClass, plain, primary, soft } from "./ui";

type Child = { id: number; displayName: string; username: string; isEyeGazeUser: boolean; teacherId: number | null };
type QuizResult = { bookId: number; title: string; author: string; coverUrl: string | null; score: number; total: number; pointsEarned: number; passed: boolean; completedAt: string };
type Profile = { student: Child; totalPoints: number; quizzesTaken: number; totalBooks: number; quizResults: QuizResult[] };
type Controls = { locked: boolean; dailyGameLimit: number | null; gamesPerPassedQuiz: number; weeklyUnlimitedOnPass: boolean };
const NO_CONTROLS: Controls = { locked: false, dailyGameLimit: null, gamesPerPassedQuiz: 0, weeklyUnlimitedOnPass: true };
type View = "progress" | "controls" | "prizes";
const CHILD_KEY = "arise_parent_child_id";
const CHILD_COLORS = ["#7566e8", "#36b6a5", "#f59e72", "#619ee6", "#db77ac", "#e5b04f"];
const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export default function Reader({ say, night = false }: { say: (message: string) => void; night?: boolean }) {
  const { token } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<number | null>(() => { const n = Number(sessionStorage.getItem(CHILD_KEY)); return Number.isSafeInteger(n) && n > 0 ? n : null; });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("progress");
  const [adding, setAdding] = useState(false);
  const [proctor, setProctor] = useState("");
  const [growth, setGrowth] = useState<any>(null);
  const [controls, setControls] = useState<Controls>(NO_CONTROLS);
  const [eye, setEye] = useState<ParentControls | null>(null);
  const [controlsError, setControlsError] = useState("");
  const [saving, setSaving] = useState(false);
  const latest = useRef(0);

  const get = useCallback(async (path: string, init: RequestInit = {}) => {
    const r = await fetch(`${API_BASE}${path}`, { cache: "no-store", ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.message || "Something went wrong. Try again.");
    return body;
  }, [token]);

  const openChild = useCallback(async (id: number) => {
    const ask = ++latest.current;
    setSwitching(true); setError(""); setControlsError(""); setProfile(null); setEye(null); setControls(NO_CONTROLS); setGrowth(null);
    try {
      sessionStorage.setItem(CHILD_KEY, String(id)); setChildId(id);
      const p: Profile = await get(`/api/parent/student-profile?studentId=${id}`);
      if (ask !== latest.current) return;
      get(`/api/family/growth-check/student/${id}`).then((g) => ask === latest.current && setGrowth(g?.available ? g : null)).catch(() => {});
      try {
        if (p.student.isEyeGazeUser) { const r = await fetchFamilySettings(token!, id); if (ask === latest.current) setEye(r.settings); }
        else {
          const c = (await get(`/api/parent/student-controls/${id}`)).control || {};
          if (ask === latest.current) setControls({ locked: !!c.locked, dailyGameLimit: c.daily_game_limit == null ? null : Number(c.daily_game_limit), gamesPerPassedQuiz: Number(c.games_per_passed_quiz || 0), weeklyUnlimitedOnPass: c.weekly_unlimited_on_pass !== false });
        }
      } catch (e) { if (ask === latest.current) setControlsError(e instanceof Error ? e.message : "Controls could not be loaded."); }
      if (ask === latest.current) setProfile(p);
    } catch (e) { if (ask === latest.current) setError(e instanceof Error ? e.message : "This child could not be loaded."); }
    finally { if (ask === latest.current) setSwitching(false); }
  }, [get, token]);

  const loadFamily = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const body = await get("/api/parent/students");
      const list: Child[] = Array.isArray(body.students) ? body.students : [];
      setChildren(list);
      if (!list.length) { setProfile(null); return; }
      const keep = list.some((c) => c.id === childId) ? childId! : list[0].id;
      await openChild(keep);
    } catch (e) { setError(e instanceof Error ? e.message : "Your family could not be loaded."); }
    finally { setLoading(false); }
  }, [get, token, childId, openChild]);

  useEffect(() => { void loadFamily(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (token) get("/api/parent/proctor-password").then((b) => b?.password && setProctor(String(b.password))).catch(() => {}); }, [token, children.length, get]);

  const copyProctor = async () => { try { await navigator.clipboard.writeText(proctor); say("Proctor code copied"); } catch { say("Couldn't copy the code"); } };
  const saveControls = async (next: Controls) => {
    if (!profile) return;
    setControls(next); setSaving(true);
    try { await get(`/api/parent/student-controls/${profile.student.id}`, { method: "POST", body: JSON.stringify(next) }); say(`Saved for ${profile.student.displayName}`); }
    catch (e) { say(e instanceof Error ? e.message : "Couldn't save the controls"); }
    finally { setSaving(false); }
  };
  const saveEye = async (next: ParentControls) => {
    if (!profile) return;
    setSaving(true);
    try { setEye((await saveFamilySettings(token!, next, undefined, profile.student.id)).settings); say(`Saved for ${profile.student.displayName}`); }
    catch (e) { say(e instanceof Error ? e.message : "Couldn't save the controls"); }
    finally { setSaving(false); }
  };

  const child = profile?.student;

  return <div className="space-y-6" data-testid="lifehub-reader">
    <PageHead eyebrow="A.R.I.S.E. Reader" title={child ? `${child.displayName}'s reading` : "Your readers"}
      blurb="Your children's reading, quizzes and certificates, the family proctor code, game time and prizes."
      action={<div className="flex flex-wrap gap-2">
        <a href="/social/" className={plain + " min-h-11"}><Users size={16} /> Arise Social</a>
        <button type="button" onClick={() => setAdding(true)} className={primary + " min-h-11"}><UserPlus size={16} /> Add child</button>
      </div>} />

    {loading ? <Panel><p className="py-8 text-center text-sm font-semibold text-slate-500">Opening your family…</p></Panel> : <>
      {children.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Child">{children.map((c, i) => {
          const on = c.id === childId, color = CHILD_COLORS[i % CHILD_COLORS.length];
          return <button key={c.id} type="button" disabled={switching || saving} onClick={() => void openChild(c.id)} aria-pressed={on}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-2.5 pr-3 text-sm font-bold text-slate-600 ring-1 ring-slate-200 disabled:opacity-60"
            style={on ? { background: color, color: "#fff", boxShadow: `0 0 0 1px ${color}` } : undefined}>
            <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-black" style={{ background: on ? "rgba(255,255,255,.22)" : color + "22", color: on ? "#fff" : color }}>{c.isEyeGazeUser ? <Eye size={14} /> : c.displayName.slice(0, 1).toUpperCase()}</span>
            {c.displayName}
          </button>;
        })}</div>
        {child && <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm font-bold" role="tablist" aria-label="Reader view">
          {([["progress", "Progress", Trophy], ["controls", "Controls", ShieldCheck], ["prizes", "Prizes", Gift]] as const).map(([id, label, Icon]) =>
            <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 sm:px-4 ${view === id ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}><Icon size={16} />{label}</button>)}
        </div>}
      </div>}

      {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

      {!children.length ? <Panel><Empty icon={<Users size={26} />} title="Connect your first child" action={<button type="button" onClick={() => setAdding(true)} className={primary}><UserPlus size={16} /> Add child</button>}>
        Enter the parent code from your child's account or school letter. Then you'll see their reading, quizzes and certificates, and set their game time.
      </Empty></Panel>
        : switching || !profile ? <Panel><p className="py-8 text-center text-sm font-semibold text-slate-500">Loading {children.find((c) => c.id === childId)?.displayName || "your child"}…</p></Panel>
        : <>
          {view === "progress" && <>
            <section className="rounded-[1.5rem] bg-[#292446] p-5 text-white shadow-[0_12px_24px_#2924461f] sm:p-6">
              <div className="flex flex-wrap items-center gap-2 text-[#bcb2ff]"><Sparkles size={17} /><span className="text-[11px] font-extrabold uppercase tracking-[.14em]">{child!.isEyeGazeUser ? "Eye gaze reader" : "Reader"} · @{child!.username}</span></div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {([["Points", profile.totalPoints], ["Quizzes", profile.quizzesTaken], ["Books left", Math.max(0, profile.totalBooks - profile.quizzesTaken)]] as const).map(([label, value]) =>
                  <div key={label}><p className="text-3xl font-black">{Number(value).toLocaleString()}</p><p className="mt-1 text-xs text-slate-300">{label}</p></div>)}
              </div>
              {profile.totalBooks > 0 && <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#a38cfa]" style={{ width: `${Math.min(100, (profile.quizzesTaken / profile.totalBooks) * 100)}%` }} /></div>}
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <Panel eyebrow={child!.displayName} title="Quiz history" right={<span className="text-sm font-black text-slate-700">{profile.quizResults.filter((r) => r.passed).length} passed</span>}>
                {profile.quizResults.length ? <ul className="space-y-2">{profile.quizResults.map((r, i) =>
                  <li key={`${r.bookId}-${r.completedAt}-${i}`} className="flex items-center gap-3 rounded-2xl border border-[#ececf3] p-3">
                    {r.coverUrl ? <img src={`${API_BASE}/api/book-cover/${r.bookId}`} alt="" className="h-14 w-10 shrink-0 rounded-lg object-cover" /> : <span className="grid h-14 w-10 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-500"><BookOpen size={16} /></span>}
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-800">{r.title}</span><span className="block truncate text-xs text-slate-500">{r.author} · {new Date(r.completedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span></span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-black text-slate-800">{r.score}/{r.total}</span>
                      <span className={`mt-0.5 inline-block rounded-lg px-2 py-0.5 text-[11px] font-bold ${r.passed ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>{r.passed ? `Passed · ${r.pointsEarned || 0} pts` : "Not passed"}</span>
                      {r.passed && <button type="button" onClick={() => generateCertificate(child!.displayName, r.title, r.pointsEarned ?? 0, longDate(r.completedAt))} className="mt-1 flex items-center gap-1 text-xs font-bold text-violet-700 hover:underline"><Award size={12} /> Certificate</button>}
                    </span>
                  </li>)}</ul> : <Empty icon={<BookOpen size={26} />} title="No quizzes yet">{child!.displayName}'s quizzes and certificates show up here.</Empty>}
              </Panel>
              <aside className="space-y-5">
                {growth && <Panel eyebrow="Growth check" title="Reading score" right={<Brain size={18} className="text-violet-500" />}>
                  <div className="flex items-end gap-4"><p className="text-4xl font-black text-[#232139]">{growth.latest?.arise_reading_score}</p>
                    {growth.scoreChange ? <p className={`pb-1 text-sm font-black ${growth.scoreChange > 0 ? "text-emerald-600" : "text-slate-500"}`}>{growth.scoreChange > 0 ? "+" : ""}{growth.scoreChange} since last time</p> : null}</div>
                  {growth.latest?.student_summary && <p className="mt-3 text-sm leading-6 text-slate-600">{growth.latest.student_summary}</p>}
                  {Array.isArray(growth.skillSummary) && growth.skillSummary.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{growth.skillSummary.map((s: any, i: number) => <span key={i} className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600">{s.skillName}: {s.correct}/{s.total}</span>)}</div>}
                  <p className="mt-3 text-xs text-slate-500">A snapshot of reading skills, not a grade.</p>
                </Panel>}
                <Panel eyebrow="Club" title="A.R.I.S.E. Reading Club" right={<Users size={18} className="text-amber-500" />}>
                  <p className="text-sm text-slate-600">Sign up {child!.displayName} for the Reading Club.</p>
                  <button type="button" onClick={() => { window.location.hash = "#/reading-club"; }} className={soft + " mt-3"}>Sign up</button>
                </Panel>
              </aside>
            </div>
            <CameraPanel childId={child!.id} name={child!.displayName} />
          </>}

          {view === "controls" && <>
            <div className="grid gap-6 xl:grid-cols-2">
              <Panel eyebrow="Family" title="Proctor code" right={<KeyRound size={18} className="text-violet-500" />}>
                <div className="flex flex-wrap items-center gap-3">
                  <code className="rounded-2xl border border-[#e7e8f0] bg-[#f6f7fc] px-4 py-3 font-mono text-2xl font-black tracking-[.2em] text-[#232139]">{proctor || "—"}</code>
                  <button type="button" onClick={() => void copyProctor()} disabled={!proctor} className={plain}><Copy size={16} /> Copy</button>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">Type this when {child!.displayName} starts a quiz or reading test with you. It works for every child on your account and marks the test as given by a parent.</p>
              </Panel>

              <Panel eyebrow={child!.displayName} title="Games" right={<Gamepad2 size={18} className="text-violet-500" />}>
                {controlsError ? <div role="alert" className="space-y-3"><p className="text-sm font-semibold text-rose-600">{controlsError}</p><button type="button" className={plain} onClick={() => void openChild(child!.id)}>Try again</button></div>
                  : child!.isEyeGazeUser ? (eye ? <ul className="divide-y divide-slate-100">
                    <ControlRow icon={<Gamepad2 size={18} />} title="Eye gaze games" detail="Allow or block the Games area">
                      <Toggle on={eye.allowedPaths.includes("/eye-gaze-games")} label="Eye gaze games" onChange={(on) => void saveEye({ ...eye, enabled: true, allowedPaths: on ? Array.from(new Set([...eye.allowedPaths, "/eye-gaze-games"])) : eye.allowedPaths.filter((p) => p !== "/eye-gaze-games") })} />
                    </ControlRow>
                    <ControlRow icon={<Clock3 size={18} />} title="Game minutes a day" detail="0 means no limit">
                      <input type="number" min={0} max={240} value={eye.gameDailyMinutes} aria-label="Game minutes a day" className={inputClass + " !w-24 text-right"}
                        onChange={(e) => setEye({ ...eye, gameDailyMinutes: Math.max(0, Math.min(240, Number(e.target.value) || 0)) })} onBlur={() => void saveEye(eye)} />
                    </ControlRow>
                    <ControlRow icon={<Clock3 size={18} />} title="A.R.I.S.E. Shorts minutes a day" detail="0 means no limit">
                      <input type="number" min={0} max={240} value={eye.tvDailyMinutes} aria-label="Shorts minutes a day" className={inputClass + " !w-24 text-right"}
                        onChange={(e) => setEye({ ...eye, tvDailyMinutes: Math.max(0, Math.min(240, Number(e.target.value) || 0)) })} onBlur={() => void saveEye(eye)} />
                    </ControlRow>
                  </ul> : <p className="text-sm text-slate-500">Loading…</p>)
                  : <ul className="divide-y divide-slate-100">
                    <ControlRow icon={controls.locked ? <Lock size={18} /> : <Unlock size={18} />} title={controls.locked ? "Games are locked" : "Games are open"} detail="Club A.R.I.S.E. and arcade play">
                      <Toggle on={!controls.locked} label="Games open" onChange={(on) => void saveControls({ ...controls, locked: !on })} />
                    </ControlRow>
                    <ControlRow icon={<Trophy size={18} />} title="Unlimited week after a passed quiz" detail="A passed quiz unlocks games until Monday">
                      <Toggle on={controls.weeklyUnlimitedOnPass} label="Unlimited week after a passed quiz" onChange={(on) => void saveControls({ ...controls, weeklyUnlimitedOnPass: on })} />
                    </ControlRow>
                    <ControlRow icon={<Gamepad2 size={18} />} title="Games a day" detail="Leave blank for no limit">
                      <input type="number" min={0} max={180} placeholder="No limit" value={controls.dailyGameLimit ?? ""} aria-label="Games a day" className={inputClass + " !w-24 text-right"}
                        onChange={(e) => setControls({ ...controls, dailyGameLimit: e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0) })} onBlur={() => void saveControls(controls)} />
                    </ControlRow>
                    <ControlRow icon={<Sparkles size={18} />} title="Games earned per passed quiz" detail="0 turns this off">
                      <input type="number" min={0} max={20} value={controls.gamesPerPassedQuiz} aria-label="Games per passed quiz" className={inputClass + " !w-24 text-right"}
                        onChange={(e) => setControls({ ...controls, gamesPerPassedQuiz: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })} onBlur={() => void saveControls(controls)} />
                    </ControlRow>
                  </ul>}
                {saving && <p className="mt-2 text-xs font-semibold text-slate-500">Saving…</p>}
              </Panel>
            </div>

            {child!.isEyeGazeUser && <div className="grid gap-3 md:grid-cols-3">
              <LinkTile icon={<Settings2 size={20} />} title="Access & game controls" detail="Learning areas, games, Life Skills, progress and media" href="#/eye-gaze-parent-controls" />
              <LinkTile icon={<MessageSquareText size={20} />} title="My Talker" detail="Words, pictures, voice, categories and phrases" href="#/eye-gaze-parent" />
              <LinkTile icon={<Home size={20} />} title="My World" detail="Familiar rooms, labels and I-Spy prompts" href="#/my-world" />
            </div>}

            <Panel eyebrow="Every child" title="Play time"><HubPlayTime which="life" /></Panel>
          </>}

          {view === "prizes" && <div className="grid gap-6 xl:grid-cols-2">
            <Panel eyebrow="From you" title="Family prizes"><HubPrizeManager which="life" token={token} role="parent" /></Panel>
            <Panel eyebrow="From school" title={`Up for ${child!.displayName} at school`}><HubPrizeBoard which="life" token={token} studentId={child!.id} childName={child!.displayName} scopes={["class", "school"]} /></Panel>
          </div>}
        </>}

      <div id="parent-plans" className="scroll-mt-4"><Panel eyebrow="Add-ons" title="Arise Math, History and Social"><HubAddons which="life" /></Panel></div>
    </>}

    {adding && <AddChild get={get} onClose={() => setAdding(false)} onAdded={async () => { setAdding(false); say("Child connected"); await loadFamily(); }} />}
  </div>;
}

/** The child's camera quizzes, in a LifeHub panel that only shows once there are some. */
function CameraPanel({ childId, name }: { childId: number; name: string }) {
  const [count, setCount] = useState<number | null>(null);
  return <div hidden={count === 0}><Panel eyebrow={name} title="Camera quizzes"><HubCameraQuizzes which="life" studentId={childId} onCount={setCount} /></Panel></div>;
}

function ControlRow({ icon, title, detail, children }: { icon: ReactNode; title: string; detail: string; children: ReactNode }) {
  return <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
    <span className="shrink-0 rounded-xl bg-violet-50 p-2 text-violet-600">{icon}</span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-800">{title}</span><span className="block text-xs text-slate-500">{detail}</span></span>
    {children}
  </li>;
}

function LinkTile({ icon, title, detail, href }: { icon: ReactNode; title: string; detail: string; href: string }) {
  return <a href={href} className="rounded-[1.5rem] border border-[#e7e8f0] bg-white p-4 shadow-[0_8px_28px_#17152b08] transition hover:border-violet-200">
    <span className="inline-flex rounded-xl bg-violet-50 p-2 text-violet-600">{icon}</span>
    <span className="mt-3 block text-sm font-black text-slate-800">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span>
  </a>;
}

function AddChild({ get, onClose, onAdded }: { get: (path: string, init?: RequestInit) => Promise<any>; onClose: () => void; onAdded: () => Promise<void> }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <Modal eyebrow="A.R.I.S.E. Reader" title="Add a child" onClose={onClose}>
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError("");
      try { await get("/api/parent/link-code", { method: "POST", body: JSON.stringify({ parentCode: code }) }); await onAdded(); }
      catch (err) { setError(err instanceof Error ? err.message : "That code didn't work."); }
      finally { setBusy(false); }
    }}>
      <p className="text-sm leading-6 text-slate-600">Enter the parent code from your child's account or the letter from school. One parent account can hold all your children.</p>
      <Label text="Parent code"><input autoFocus required className={inputClass + " font-mono uppercase tracking-wider"} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /></Label>
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
      <div className="flex gap-2"><button type="submit" disabled={busy || !code.trim()} className={primary + " flex-1"}>{busy ? "Connecting…" : "Connect child"}</button><button type="button" onClick={onClose} className={plain}>Cancel</button></div>
    </form>
  </Modal>;
}

