// Arise Fit: workout buddies (shared/fitBuddy.ts, server/fitBuddy.ts). Matched with someone you don't
// know: an emoji and a gamertag, a shared weekly goal, and ready-made messages. Nothing can be typed.
import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, Swords, UserX, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AVATARS, FOCUS, LEVEL, MODE, PRESETS, PRESET_BY_ID, REPORT_REASONS, type Focus, type Goal, type Mode, type Msg } from "@shared/fitBuddy";
import { agoWords } from "@shared/fitCircle";
import { fitApi } from "./fitStore";
import { Btn, C, Card, Sheet, Title, display, haptic } from "./fitUi";

type Who = { tag: string; avatar: string };
type Prefs = { avatar: string; focus: Focus; level: 1 | 2 | 3; perWeek: number; mode: Mode };
type View =
  | { eligible: false; why: string; status: "none" }
  | { eligible: true; status: "none" | "searching"; me: Who | null; prefs: Prefs | null }
  | { eligible: true; status: "matched"; me: Who | null; buddy: (Who & { focus: Focus; level: number }) | null; since: number; goal: Goal; proposal: (Goal & { mine: boolean }) | null;
      weeks: { me: number[]; them: number[] }; record: { streak: number; won: number; lost: number; tied: number }; inbox: Msg[] };

export function useBuddy(token: string | null, on = true) {
  const [view, setView] = useState<View | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => fitApi<View>(token, "/buddy").then((v) => { setView(v); setErr(""); }).catch((e) => setErr(e.message)), [token]);
  useEffect(() => { if (!on || !token) return; void load(); const t = window.setInterval(() => void load(), 30_000); return () => window.clearInterval(t); }, [load, on, token]);
  return { view, err, load, setView };
}

/** On Today: your buddy's week, or an invitation. */
export function BuddyCard({ token, onOpen }: { token: string | null; onOpen: () => void }) {
  const { view } = useBuddy(token);
  if (view && !view.eligible) return null;
  const m = view?.status === "matched" ? view : null;
  const last = m?.inbox[0];
  return <Card className="mt-3 flex items-center gap-3 !p-4" onClick={onOpen} testId="fit-buddy-card">
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[22px]" style={{ background: C.card2 }} aria-hidden>{m?.buddy?.avatar ?? <Swords className="h-5 w-5" style={{ color: C.lime }} />}</span>
    <div className="min-w-0 flex-1">
      <p className="text-[19px] leading-none" style={display}>{m?.buddy ? m.buddy.tag : "Workout buddy"}</p>
      <p className="mt-1 truncate text-[13px]" style={{ color: C.dim }}>
        {m ? (last && Date.now() - last.at < 864e5 ? `${PRESET_BY_ID.get(last.kind)?.e ?? ""} ${PRESET_BY_ID.get(last.kind)?.text ?? ""}` : `${m.weeks.me.at(-1)} vs ${m.weeks.them.at(-1)} workouts this week`)
          : view?.status === "searching" ? "Looking for your match" : "Get matched with someone to train alongside"}
      </p>
    </div>
  </Card>;
}

const pill = (on: boolean) => ({ background: on ? C.lime : C.card2, color: on ? "var(--fit-on-accent)" : C.text });
function Pick<T extends string | number>({ items, value, onPick, label }: { items: { v: T; text: string }[]; value: T; onPick: (v: T) => void; label: string }) {
  return <div role="group" aria-label={label} className="flex flex-wrap gap-2">{items.map((i) => <button key={String(i.v)} type="button" onClick={() => { haptic("light"); onPick(i.v); }} aria-pressed={value === i.v} className="min-h-10 rounded-full px-4 text-[14px] font-semibold" style={pill(value === i.v)}>{i.text}</button>)}</div>;
}

function Week({ me, them, goal }: { me: number[]; them: number[]; goal: number }) {
  const row = (n: number, who: string, color: string) => <div className="flex items-center gap-2"><span className="w-12 text-[12px]" style={{ color: C.dim }}>{who}</span>
    <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: C.card2 }}><div className="h-full rounded-full" style={{ width: `${Math.min(100, (n / Math.max(1, goal)) * 100)}%`, background: color }} /></div>
    <span className="w-8 text-right text-[14px]" style={display}>{n}/{goal}</span></div>;
  return <div className="space-y-2">{row(me.at(-1) ?? 0, "You", C.lime)}{row(them.at(-1) ?? 0, "Buddy", C.steel)}</div>;
}

export function BuddySheet({ onClose, say }: { onClose: () => void; say: (m: string) => void }) {
  const { token } = useAuth();
  const { view, err, load, setView } = useBuddy(token);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [prefs, setPrefs] = useState<Prefs>({ avatar: AVATARS[0], focus: "consistency", level: 1, perWeek: 3, mode: "coop" });
  const [goal, setGoal] = useState<Goal>({ perWeek: 3, mode: "coop" });
  const [editGoal, setEditGoal] = useState(false);
  const [reporting, setReporting] = useState(false);
  useEffect(() => { if (view?.eligible && view.status !== "matched" && view.prefs) setPrefs(view.prefs); }, [view?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const call = async (path: string, body?: unknown, done?: string) => {
    setBusy(path); setMsg("");
    try { const r = await fitApi<View>(token, path, { method: "POST", body: JSON.stringify(body ?? {}) }); if (r && (r as any).status) setView(r); else await load(); if (done) say(done); return r; }
    catch (e: any) { setMsg(e.message); return null; } finally { setBusy(""); }
  };
  const m = view?.eligible && view.status === "matched" ? view : null;
  useEffect(() => { if (m) setGoal({ perWeek: m.goal.perWeek, mode: m.goal.mode }); }, [m?.goal.perWeek, m?.goal.mode]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Sheet title="Workout buddy" onClose={onClose} testId="fit-buddy">
    {!view && !err && <div className="grid h-40 place-items-center"><Loader2 className="h-7 w-7 animate-spin" style={{ color: C.dim }} /></div>}
    {err && !view && <p className="px-1 text-[14px]" style={{ color: C.red }} role="alert">{err}</p>}
    {view && !view.eligible && <p className="px-1 text-[15px]" style={{ color: C.steel }}>{view.why}</p>}

    {view?.eligible && view.status === "none" && <>
      <p className="px-1 text-[15px]" style={{ color: C.steel }}>Get matched with someone you don't know, set a weekly goal together and keep each other going, or compete for fun. You'll each be an emoji and a made-up gamertag. There are no photos, names or typing: only ready-made messages like "GG!" and "Nice work!". Adults only.</p>
      <Title>Your emoji</Title>
      <div className="flex flex-wrap gap-2">{AVATARS.map((a) => <button key={a} type="button" onClick={() => setPrefs({ ...prefs, avatar: a })} aria-label={`Emoji ${a}`} aria-pressed={prefs.avatar === a} className="grid h-11 w-11 place-items-center rounded-full text-[22px]" style={pill(prefs.avatar === a)}>{a}</button>)}</div>
      <Title>What are you after?</Title>
      <Pick label="Focus" value={prefs.focus} onPick={(focus) => setPrefs({ ...prefs, focus })} items={(Object.keys(FOCUS) as Focus[]).map((v) => ({ v, text: FOCUS[v] }))} />
      <Title>Experience</Title>
      <Pick label="Experience" value={prefs.level} onPick={(level) => setPrefs({ ...prefs, level })} items={[1, 2, 3].map((v) => ({ v: v as 1 | 2 | 3, text: LEVEL[v] }))} />
      <Title>Workouts a week</Title>
      <Pick label="Workouts a week" value={prefs.perWeek} onPick={(perWeek) => setPrefs({ ...prefs, perWeek })} items={[1, 2, 3, 4, 5, 6, 7].map((v) => ({ v, text: String(v) }))} />
      <Title>Style</Title>
      <Pick label="Style" value={prefs.mode} onPick={(mode) => setPrefs({ ...prefs, mode })} items={(Object.keys(MODE) as Mode[]).map((v) => ({ v, text: `${MODE[v].name}: ${MODE[v].blurb}` }))} />
      <div className="mt-6"><Btn className="w-full" testId="fit-buddy-find" disabled={!!busy} onClick={() => void call("/buddy/join", { ...prefs, tz: -new Date().getTimezoneOffset() }, "Looking for a buddy")}><Search className="h-5 w-5" />Find me a buddy</Btn></div>
    </>}

    {view?.eligible && view.status === "searching" && <Card className="mt-2 text-center">
      <Loader2 className="mx-auto h-7 w-7 animate-spin" style={{ color: C.lime }} />
      <p className="mt-3 text-[22px]" style={display}>Looking for your match</p>
      <p className="mt-1 text-[14px]" style={{ color: C.dim }}>We'll notify you the moment someone fits. You can close this.</p>
      <div className="mt-4"><Btn kind="soft" onClick={() => void call("/buddy/cancel")}>Stop looking</Btn></div>
    </Card>}

    {m && <>
      <Card className="mt-2 text-center">
        <p className="text-[44px] leading-none" aria-hidden>{m.buddy?.avatar}</p>
        <p className="mt-2 text-[26px]" style={display} data-testid="fit-buddy-tag">{m.buddy?.tag ?? "Your buddy"}</p>
        <p className="text-[13px]" style={{ color: C.dim }}>{m.buddy ? `${FOCUS[m.buddy.focus]} · ${LEVEL[m.buddy.level]}` : ""} · matched {agoWords(m.since)}</p>
      </Card>
      <Title>This week</Title>
      <Card><Week me={m.weeks.me} them={m.weeks.them} goal={m.goal.perWeek} />
        <p className="mt-3 text-[13px]" style={{ color: C.steel }}>{MODE[m.goal.mode].name}: {m.goal.perWeek} workouts a week. {m.goal.mode === "coop"
          ? (m.record.streak ? `${m.record.streak} week${m.record.streak > 1 ? "s" : ""} in a row with both of you hitting it.` : "Both hit it this week to start a streak.")
          : `Record: ${m.record.won} won, ${m.record.lost} lost, ${m.record.tied} tied.`}</p></Card>

      <Title>Goal</Title>
      {m.proposal && !m.proposal.mine && <Card className="mb-2"><p className="text-[15px]">Your buddy proposed <b>{m.proposal.perWeek} a week</b>, {MODE[m.proposal.mode].name.toLowerCase()}.</p>
        <div className="mt-3 flex gap-2"><Btn onClick={() => void call("/buddy/accept", {}, "Goal set")}>Accept</Btn><Btn kind="soft" onClick={() => setEditGoal(true)}>Change it</Btn></div></Card>}
      {m.proposal?.mine && <p className="mb-2 px-1 text-[13px]" style={{ color: C.dim }}>Waiting for your buddy to accept {m.proposal.perWeek} a week.</p>}
      {!editGoal ? <Btn kind="soft" onClick={() => setEditGoal(true)}>Propose a new goal</Btn> : <Card>
        <Pick label="Workouts a week" value={goal.perWeek} onPick={(perWeek) => setGoal({ ...goal, perWeek })} items={[1, 2, 3, 4, 5, 6, 7].map((v) => ({ v, text: String(v) }))} />
        <div className="mt-3"><Pick label="Style" value={goal.mode} onPick={(mode) => setGoal({ ...goal, mode })} items={(Object.keys(MODE) as Mode[]).map((v) => ({ v, text: MODE[v].name }))} /></div>
        <div className="mt-4"><Btn onClick={() => { void call("/buddy/goal", goal, "Goal sent").then(() => setEditGoal(false)); }}>Send goal</Btn></div></Card>}

      <Title>Say something</Title>
      <div className="flex flex-wrap gap-2">{PRESETS.map((p) => <button key={p.id} type="button" disabled={!!busy} onClick={() => { haptic("light"); void call("/buddy/send", { kind: p.id }, "Sent"); }} className="min-h-10 rounded-full px-3 text-[14px]" style={{ background: C.card2, color: C.text }}>{p.e} {p.text}</button>)}</div>

      {m.inbox.length > 0 && <><Title>From your buddy</Title>
        <Card className="!p-3"><ul className="space-y-2">{m.inbox.slice(0, 6).map((x, i) => <li key={i} className="flex items-center gap-2 text-[14px]"><span aria-hidden>{PRESET_BY_ID.get(x.kind)?.e}</span><span className="flex-1">{PRESET_BY_ID.get(x.kind)?.text}</span><span className="text-[12px]" style={{ color: C.dim }}>{agoWords(x.at)}</span></li>)}</ul></Card></>}

      <Title>Not working out?</Title>
      {!reporting ? <div className="flex flex-wrap gap-2">
        <Btn kind="soft" onClick={() => { if (window.confirm("End this pairing? You can look for someone new after.")) void call("/buddy/leave", {}, "You can find a new buddy anytime"); }}><Users className="h-5 w-5" />End pairing</Btn>
        <Btn kind="danger" onClick={() => setReporting(true)}><UserX className="h-5 w-5" />Report</Btn></div>
        : <Card><p className="mb-3 text-[14px]" style={{ color: C.steel }}>This ends the pairing and you won't be matched again.</p>
          <div className="flex flex-wrap gap-2">{REPORT_REASONS.map((r) => <Btn key={r.id} kind="soft" onClick={() => { void call("/buddy/report", { reason: r.id }, "Reported. Thank you.").then(() => setReporting(false)); }}>{r.text}</Btn>)}</div></Card>}
    </>}
    {msg && <p className="mt-3 px-1 text-[14px]" style={{ color: C.red }} role="alert">{msg}</p>}
  </Sheet>;
}
