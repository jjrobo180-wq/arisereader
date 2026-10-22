// Para Team (#/para-team): a teacher's shared space with their paras and 1:1s, opened from Arise
// WorkHub. One team at a time, with a menu down the left (a row of tabs on a phone):
// Today, Messages, Calendar, To-do, Schedule, Students, Data, Lessons, Docs & files, Team.
// #/para-team/join/<code> is where an invite link lands. The rules are in shared/paraTeam.ts.
import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation, useRoute } from "wouter";
import {
  ArrowLeft, BarChart3, Megaphone, BookOpen, CalendarDays, CheckSquare, Clock3, FolderOpen, HeartHandshake, Home, MessageSquare, Plus, Users, UserRound, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { hubNightClass } from "@/lib/hubNight";
import { goToReader, isHubAccount, isReaderHost } from "@/lib/hubs";
import { LAST_TEAM_KEY, PENDING_JOIN_KEY, paraApi, useMyTeams, useParaTeam } from "@/lib/paraTeam";
import { bulletinsOn, canCheckOff, dayKey, isInviteCode, ofKind, type ParaTeamView } from "@shared/paraTeam";
import { Field, Labeled } from "@/components/teacher-hub/ui";
import { CARD, PRIMARY, SECOND, ParaProvider, makePara, type Section } from "@/components/para-team/kit";
import { BulletinSection } from "@/components/para-team/Bulletins";
import { CalendarSection, MessagesSection, ScheduleSection, TasksSection, TodaySection } from "@/components/para-team/DaySections";
import { DataSection, DocsSection, LessonsSection, StudentsSection, TeamSection } from "@/components/para-team/WorkSections";

const SECTIONS: Array<{ id: Section; label: string; icon: LucideIcon }> = [
  { id: "today", label: "Today", icon: Home },
  { id: "bulletin", label: "Bulletin board", icon: Megaphone },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "tasks", label: "To-do", icon: CheckSquare },
  { id: "schedule", label: "Schedule", icon: Clock3 },
  { id: "students", label: "Students", icon: UserRound },
  { id: "data", label: "Data", icon: BarChart3 },
  { id: "lessons", label: "Lessons", icon: BookOpen },
  { id: "docs", label: "Docs & files", icon: FolderOpen },
  { id: "team", label: "Team", icon: Users },
];
const isSection = (s: unknown): s is Section => SECTIONS.some((x) => x.id === s);
const hashParams = () => new URLSearchParams(window.location.hash.split("?")[1] || "");
const store = {
  get: (k: string) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } },
  set: (k: string, v: string) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* not remembered */ } },
};

function useToast() {
  const [text, setText] = useState("");
  useEffect(() => { if (!text) return; const t = window.setTimeout(() => setText(""), 4200); return () => window.clearTimeout(t); }, [text]);
  const node = (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[300] flex justify-center px-4" aria-live="polite" role="status">
      {text && <p className="pointer-events-auto max-w-md rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg">{text}</p>}
    </div>
  );
  return { say: setText, node };
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className={`min-h-screen w-full max-w-[100vw] overflow-x-clip bg-slate-50 text-slate-900 ${hubNightClass()}`} data-testid="para-team-page">{children}</div>;
}

export default function ParaTeam() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const { teams, error, reload } = useMyTeams(token);
  const [teamId, setTeamId] = useState<string | null>(() => hashParams().get("team") || store.get(LAST_TEAM_KEY) || null);
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  // The team to show: the one asked for if this person is on it, else the last one, else the first.
  useEffect(() => {
    if (!teams) return;
    if (teamId && teams.some((t) => t.id === teamId)) return;
    setTeamId(teams[0]?.id || null);
  }, [teams, teamId]);
  useEffect(() => { if (teamId) store.set(LAST_TEAM_KEY, teamId); }, [teamId]);

  if (!user || !isHubAccount(user)) return <Shell><NotStaff /></Shell>;
  // Back goes where they came from: the teacher Reader on arisereader.com, else WorkHub.
  const back = isReaderHost() && (user.isAdmin || user.role === "teacher" || user.role === "parent")
    ? { label: "Reader", go: goToReader } : { label: "WorkHub", go: () => navigate("/workhub") };
  if (error && !teams) return <Shell><Centered><p className="text-sm text-slate-700">{error}</p><button type="button" className={`${SECOND} mt-3`} onClick={() => reload()}>Try again</button></Centered></Shell>;
  if (!teams) return <Shell><Centered><p className="text-sm text-slate-500">Opening Para Team…</p></Centered></Shell>;
  if (!teams.length || creating) {
    return <Shell>{toast.node}<Welcome canCancel={teams.length > 0} onCancel={() => setCreating(false)} say={toast.say}
      onReady={(t) => { setCreating(false); setTeamId(t.id); void reload(); }} back={back} /></Shell>;
  }
  const current = teams.find((t) => t.id === teamId) || teams[0];
  return <Shell>{toast.node}
    <TeamScreen key={current.id} teamId={current.id} teams={teams} onPick={(id) => setTeamId(id)} onNew={() => setCreating(true)}
      onGone={() => { store.set(LAST_TEAM_KEY, ""); setTeamId(null); void reload(); }} say={toast.say} back={back} />
  </Shell>;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[70vh] items-center justify-center px-4"><div className={`${CARD} w-full max-w-md text-center`}>{children}</div></div>;
}

function NotStaff() {
  return <Centered>
    <HeartHandshake className="mx-auto h-10 w-10 text-teal-700" />
    <h1 className="mt-3 text-xl font-black text-slate-950">Para Team is for school staff</h1>
    <p className="mt-2 text-sm text-slate-600">Sign in with a teacher account or a free A.R.I.S.E. To-Do account to use it.</p>
  </Centered>;
}

// ─── First visit: make a team, or join one with a link ───

type Back = { label: string; go: () => void };

function Welcome({ onReady, canCancel, onCancel, say, back }: { onReady: (t: ParaTeamView) => void; canCancel: boolean; onCancel: () => void; say: (t: string) => void; back: Back }) {
  const { token } = useAuth();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("Teacher");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { onReady(await paraApi<ParaTeamView>(token, "/api/para-teams", { method: "POST", body: JSON.stringify({ name, title }) })); }
    catch (err: any) { say(err.message); }
    setBusy(false);
  };
  const join = async (e: FormEvent) => {
    e.preventDefault();
    const code = (link.trim().match(/([a-z2-9]{12})\/?$/i)?.[1] || "").toLowerCase();
    if (!isInviteCode(code)) { say("Paste the whole invite link your teacher sent."); return; }
    setBusy(true);
    try { onReady(await paraApi<ParaTeamView>(token, `/api/para-teams/join/${code}`, { method: "POST", body: "{}" })); }
    catch (err: any) { say(err.message); }
    setBusy(false);
  };
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <button type="button" onClick={canCancel ? onCancel : back.go} className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-600 hover:bg-white"><ArrowLeft className="h-4 w-4" />{canCancel ? "Back to my team" : `Back to ${back.label}`}</button>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1 text-sm font-bold text-teal-900"><HeartHandshake className="h-4 w-4" />Para Team</p>
          <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight text-slate-950 sm:text-5xl">Everyone who works with your students, on the same page.</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-600">One place for you, your paras and your 1:1s: today's schedule, a shared calendar, to-dos, messages, student pages, data, lesson plans, links and files. Paras join with a link and a free account.</p>
          <ul className="mt-6 grid gap-2 text-[15px] text-slate-700 sm:grid-cols-2">
            {["Who's where, every block of the day", "Who's out, and what needs covering", "How to help each student", "Behavior and goal data from a phone", "Lesson plans with the para's part", "Docs, photos and files in one binder"].map((t) => (
              <li key={t} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />{t}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-4">
          <form onSubmit={create} className={CARD}>
            <h2 className="text-lg font-extrabold text-slate-950">Start a team</h2>
            <p className="mt-1 text-sm text-slate-600">For the teacher. You'll get a link to send your paras.</p>
            <div className="mt-3 grid gap-3">
              <Labeled label="Team name"><Field value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Room 112 Team" required /></Labeled>
              <Labeled label="Your job"><Field value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Teacher" /></Labeled>
              <button type="submit" className={PRIMARY} disabled={busy || !name.trim()}><Plus className="h-4 w-4" />Make the team</button>
            </div>
          </form>
          <form onSubmit={join} className={CARD}>
            <h2 className="text-lg font-extrabold text-slate-950">Join your teacher's team</h2>
            <p className="mt-1 text-sm text-slate-600">For paras and 1:1s. Open the link your teacher sent, or paste it here.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <label htmlFor="join-link" className="sr-only">Invite link</label>
              <Field id="join-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://arisetodo.com/app#/para-team/join/…" />
              <button type="submit" className={SECOND} disabled={busy || !link.trim()}>Join</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── One team ───

function TeamScreen({ teamId, teams, onPick, onNew, onGone, say, back }: {
  teamId: string; teams: Array<{ id: string; name: string }>; onPick: (id: string) => void; onNew: () => void; onGone: () => void; say: (t: string) => void; back: Back;
}) {
  const { token } = useAuth();
  const api = useParaTeam(token, teamId);
  const [section, setSection] = useState<Section>(() => { const s = hashParams().get("s"); return isSection(s) ? s : "today"; });
  const [focus, setFocus] = useState<string | undefined>(undefined);
  const [today, setToday] = useState(() => dayKey(new Date()));
  // A page left open overnight moves on to the new day.
  useEffect(() => { const t = window.setInterval(() => setToday(dayKey(new Date())), 60_000); return () => window.clearInterval(t); }, []);
  useEffect(() => {
    try { window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#/para-team?team=${teamId}&s=${section}`); } catch { /* the address just doesn't update */ }
  }, [teamId, section]);

  const go = (s: Section, f?: string) => { setSection(s); setFocus(f); window.scrollTo({ top: 0 }); };
  const team = api.team;
  const para = useMemo(() => (team ? makePara(team, api, today, say, go) : null), [team, api, today, say]); // eslint-disable-line react-hooks/exhaustive-deps

  // Messages since this person last opened Messages, on this device.
  const seenKey = `para_team_seen:${teamId}`;
  const [seen, setSeen] = useState(() => store.get(seenKey));
  useEffect(() => {
    if (section !== "messages" || !team) return;
    const newest = ofKind(team.items, "message").reduce((m, i) => (i.createdAt > m ? i.createdAt : m), "");
    if (newest && newest !== seen) { store.set(seenKey, newest); setSeen(newest); }
  }, [section, team, seen, seenKey]);

  if (api.error && !team) {
    const gone = api.error.status === 403 || api.error.status === 404;
    return <Centered>
      <p className="text-sm text-slate-700">{api.error.message}</p>
      <button type="button" className={`${SECOND} mt-3`} onClick={gone ? onGone : () => api.reload()}>{gone ? "Back to my teams" : "Try again"}</button>
    </Centered>;
  }
  if (!team || !para) return <Centered><p className="text-sm text-slate-500">Opening your team…</p></Centered>;

  const unread = ofKind(team.items, "message").filter((m) => m.createdBy !== team.me && (!seen || m.createdAt > seen)).length;
  const myOpen = ofKind(team.items, "task").filter((t) => !t.data.done && canCheckOff(team.me, t.data) && t.data.due && t.data.due <= today).length;
  const boardUp = bulletinsOn(team.items, today).length;
  const badge = (s: Section) => (s === "messages" ? unread : s === "tasks" ? myOpen : s === "bulletin" ? boardUp : 0);

  return (
    <ParaProvider value={para}>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:px-6">
          <button type="button" onClick={back.go} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" aria-label={`Back to ${back.label}`}><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">{back.label}</span></button>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white"><HeartHandshake className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold leading-none text-teal-700">Para Team</p>
            {teams.length > 1 ? (
              <select value={teamId} onChange={(e) => (e.target.value === "__new" ? onNew() : onPick(e.target.value))} aria-label="Team"
                className="max-w-full truncate bg-transparent text-base font-black text-slate-950 outline-none">
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                <option value="__new">+ Start or join another team</option>
              </select>
            ) : <p className="truncate text-base font-black text-slate-950">{team.name}</p>}
          </div>
          {teams.length === 1 && <button type="button" onClick={onNew} className="hidden min-h-10 shrink-0 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 sm:inline-flex sm:items-center">Another team</button>}
          {para.lead && <button type="button" onClick={() => go("team")} className={`${PRIMARY} min-h-10 shrink-0 px-3`}><Users className="h-4 w-4" /><span className="hidden sm:inline">Invite paras</span><span className="sm:hidden">Invite</span></button>}
        </div>
        {/* Phones: the menu is a row of tabs that scrolls sideways. */}
        <nav aria-label="Para Team" className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden" data-testid="para-tabs">
          {SECTIONS.map((s) => {
            const on = section === s.id, n = badge(s.id), Icon = s.icon;
            return <button key={s.id} type="button" onClick={() => go(s.id)} aria-current={on ? "page" : undefined}
              className={`relative inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${on ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700"}`}>
              <Icon className="h-4 w-4" />{s.label}{n > 0 && <span className={`ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold ${on ? "bg-white text-teal-800" : "bg-teal-700 text-white"}`}>{n}</span>}
            </button>;
          })}
        </nav>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-3 py-5 sm:px-6">
        <nav aria-label="Para Team" className="sticky top-20 hidden h-fit w-56 shrink-0 flex-col gap-0.5 lg:flex print:hidden">
          {SECTIONS.map((s) => {
            const on = section === s.id, n = badge(s.id), Icon = s.icon;
            return <button key={s.id} type="button" onClick={() => go(s.id)} aria-current={on ? "page" : undefined} data-testid={`para-nav-${s.id}`}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-[15px] ${on ? "bg-teal-700 font-bold text-white" : "font-semibold text-slate-700 hover:bg-white"}`}>
              <Icon className="h-[18px] w-[18px] shrink-0" /><span className="flex-1">{s.label}</span>
              {n > 0 && <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${on ? "bg-white text-teal-800" : "bg-teal-700 text-white"}`}>{n}</span>}
            </button>;
          })}
          <p className="mt-4 px-3 text-xs leading-relaxed text-slate-500">{team.members.filter((m) => !m.left).length} on the team · {para.lead ? "you're a lead" : "you're a para"}</p>
        </nav>
        <main className="min-w-0 flex-1" key={`${section}:${focus || ""}`}>
          <Suspense fallback={null}>
            {section === "today" && <TodaySection />}
            {section === "bulletin" && <BulletinSection focus={focus} />}
            {section === "messages" && <MessagesSection />}
            {section === "calendar" && <CalendarSection focus={focus} />}
            {section === "tasks" && <TasksSection />}
            {section === "schedule" && <ScheduleSection />}
            {section === "students" && <StudentsSection focus={focus} />}
            {section === "data" && <DataSection focus={focus} />}
            {section === "lessons" && <LessonsSection />}
            {section === "docs" && <DocsSection focus={focus} />}
            {section === "team" && <TeamSection onLeft={onGone} />}
          </Suspense>
        </main>
      </div>
    </ParaProvider>
  );
}

// ─── #/para-team/join/<code> ───

export function JoinParaTeam() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/para-team/join/:code");
  const code = String(params?.code || "").toLowerCase();
  const [preview, setPreview] = useState<{ name: string; teacher: string } | null>(null);
  const [problem, setProblem] = useState("");
  const [title, setTitle] = useState("Para");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  // Back from signing in: the code has done its job (a failed join must not keep sending them here).
  useEffect(() => { if (user) store.set(PENDING_JOIN_KEY, ""); }, [user]);
  useEffect(() => {
    if (!isInviteCode(code)) { setProblem("This invite link isn't complete. Ask your teacher to send it again."); return; }
    paraApi<{ name: string; teacher: string }>(null, `/api/public/para-teams/join/${code}`).then(setPreview).catch((e) => setProblem(e.message));
  }, [code]);

  const signIn = () => { store.set(PENDING_JOIN_KEY, code); navigate("/signin"); };
  const join = async () => {
    setBusy(true);
    try {
      const t = await paraApi<ParaTeamView>(token, `/api/para-teams/join/${code}`, { method: "POST", body: JSON.stringify({ title }) });
      store.set(PENDING_JOIN_KEY, "");
      store.set(LAST_TEAM_KEY, t.id);
      navigate(`/para-team?team=${t.id}&s=today`);
    } catch (e: any) { toast.say(e.message); setBusy(false); }
  };

  return <Shell>{toast.node}
    <Centered>
      <HeartHandshake className="mx-auto h-11 w-11 text-teal-700" />
      {problem ? <>
        <h1 className="mt-3 text-xl font-black text-slate-950">This link isn't working</h1>
        <p className="mt-2 text-sm text-slate-600">{problem}</p>
      </> : !preview ? <p className="mt-3 text-sm text-slate-500">Checking your invite…</p> : <>
        <p className="mt-3 text-sm font-bold text-teal-700">You're invited to a Para Team</p>
        <h1 className="mt-1 text-2xl font-black leading-tight text-slate-950">{preview.name}</h1>
        <p className="mt-1 text-sm text-slate-600">with {preview.teacher}</p>
        <p className="mt-4 text-left text-sm leading-relaxed text-slate-700">The team shares the daily schedule, a calendar, to-dos, messages, student pages, data, lesson plans and files, on your phone or computer.</p>
        {!user ? <div className="mt-5 flex flex-col gap-2">
          <button type="button" className={PRIMARY} onClick={signIn}>Sign in or make a free account</button>
          <p className="text-xs text-slate-500">New here? On the next screen, tap "Create a free account". You'll come right back to join.</p>
        </div> : !isHubAccount(user) ? (
          <p className="mt-5 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">You're signed in with a student account. Sign out, then sign in with your staff account (or make a free one) to join.</p>
        ) : <div className="mt-5 flex flex-col gap-3 text-left">
          <Labeled label="Your job on the team"><Field value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Para, 1:1 for J., speech para…" /></Labeled>
          <button type="button" className={PRIMARY} disabled={busy} onClick={join}>{busy ? "Joining…" : `Join ${preview.name}`}</button>
        </div>}
      </>}
    </Centered>
  </Shell>;
}
