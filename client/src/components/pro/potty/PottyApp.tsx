// Potty Training — the premium app. This file is the shell: saved data, the child switcher and
// profile, setup for a new child, navigation, reminders (timer and today's schedule) and the
// child-facing overlays. Each screen lives in its own file.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { BookOpen, CalendarDays, Clock, HeartHandshake, Lightbulb, ListChecks, MessageCircle, PlayCircle, Route, Settings, Star, Sun, Timer, Volume2, VolumeX, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAppData } from "@/lib/cloudDocs";
import { LIVE_TAG, clearPottyNotifications, showRunningTimer, syncPottySchedule, syncPottyTimer } from "@/lib/pottyPush";
import { Modal, fmtDuration, uid, useTick } from "../kit";
import { DEFAULT_DATA, tripInterval, METHOD_LIST, NEEDS, STAGES, ageMonths, ageText, blankChild, buildSchedule, cleanData, clockOf, dayOf, earnsSticker, hm, isAccident, isSuccess, minsOf, sitMinutes, stageById, type Child, type Comms, type Entry, type Kind, type NeedId } from "@shared/pro/potty";
import { Ctx, type LogPrefill, type PottyCtx, type Tab } from "./ctx";
import { Alert, Celebrate, SitTimer } from "./KidMode";
import { LogSheet } from "./LogSheet";
import { Btn2, C, Chip, FONT_HEAD, Label, Panel, PottyStyles, field, fieldStyle, say } from "./theme";
import Today from "./Today";

const Simple = lazy(() => import("./Simple"));
const Agenda = lazy(() => import("./Agenda"));
const History = lazy(() => import("./History"));
const Program = lazy(() => import("./Program"));
const Coach = lazy(() => import("./Coach"));
const Schedule = lazy(() => import("./Schedule"));
const Videos = lazy(() => import("./Videos"));
const Learn = lazy(() => import("./Learn"));
const Needs = lazy(() => import("./Needs"));
const TryLearn = lazy(() => import("./TryLearn"));
const Rewards = lazy(() => import("./Rewards"));

const TABS: { id: Tab; label: string; icon: ComponentType<{ size?: number }> }[] = [
  { id: "simple", label: "Simple", icon: Timer }, { id: "today", label: "Today", icon: Sun }, { id: "agenda", label: "Agenda", icon: ListChecks }, { id: "log", label: "Log & charts", icon: CalendarDays }, { id: "plan", label: "Plan", icon: Route },
  { id: "coach", label: "AI coach", icon: MessageCircle }, { id: "schedule", label: "Schedule", icon: Clock }, { id: "videos", label: "Videos", icon: PlayCircle },
  { id: "learn", label: "Learn", icon: BookOpen }, { id: "needs", label: "Additional needs", icon: HeartHandshake }, { id: "try", label: "Try & learn", icon: Lightbulb }, { id: "rewards", label: "Rewards", icon: Star },
];
const AVATARS = ["🧒", "👧", "👦", "👶", "🦁", "🐻", "🐰", "🦄", "🐶", "🐱", "🦖", "🐸"];
const COMMS: { id: Comms; label: string }[] = [{ id: "words", label: "Talks in sentences" }, { id: "few-words", label: "A few words" }, { id: "signs", label: "Signs" }, { id: "pictures", label: "Pictures / PECS" }, { id: "device", label: "Speech device (AAC)" }, { id: "none", label: "Not yet" }];

export default function PottyApp() {
  const { token } = useAuth();
  const { data, setData, state } = useAppData("pro-potty", cleanData);
  const set = useCallback((fn: (d: typeof DEFAULT_DATA) => typeof DEFAULT_DATA) => setData((d) => fn(d)), [setData]);
  const [tab, setTab] = useState<Tab>("simple"); const [sub, setSub] = useState("");
  const [logPre, setLogPre] = useState<LogPrefill | null>(null);
  const [party, setParty] = useState<string | null>(null);
  const [sit, setSit] = useState(false);
  const [alertOn, setAlertOn] = useState(false);
  const [editing, setEditing] = useState<Child | null>(null);
  const [adding, setAdding] = useState(false);
  const kid = data.kids.find((k) => k.id === data.cur) || data.kids[0];
  const months = kid ? ageMonths(kid.birth) : null;
  const top = useRef<HTMLDivElement>(null);

  const putKid = useCallback((k: Child) => set((d) => ({ ...d, kids: d.kids.some((x) => x.id === k.id) ? d.kids.map((x) => (x.id === k.id ? k : x)) : [...d.kids, k], cur: k.id })), [set]);
  const startTimer = useCallback((minutes: number, kidId: string) => set((d) => ({ ...d, timer: { kid: kidId, endAt: Date.now() + minutes * 60_000, minutes } })), [set]);
  const intervalOf = (k: Child) => tripInterval(data.logs, k);

  const log = useCallback((kind: Kind, extra: Partial<Entry> = {}) => {
    if (!kid) return;
    const e: Entry = { id: uid(), kid: kid.id, at: extra.at ?? Date.now(), kind, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== "")) } as Entry;
    set((d) => ({ ...d, logs: [...d.logs, e] }));
    if (earnsSticker(kind) || (kind === "try" && kid.tryStickers)) setParty(kind === "poop" ? `${kid.words.poop[0].toUpperCase()}${kid.words.poop.slice(1)} in the ${kid.words.potty}` : kind === "both" ? `${kid.words.pee} and ${kid.words.poop} in the ${kid.words.potty}` : kind === "pee" ? `${kid.words.pee[0].toUpperCase()}${kid.words.pee.slice(1)} in the ${kid.words.potty}` : kind === "try" ? "Great sitting" : kind === "dry" ? "Dry pants" : kind === "night-dry" ? "A dry night" : "A dry nap");
    else if (isAccident(kind)) say(`That's okay. ${kid.words.pee[0].toUpperCase()}${kid.words.pee.slice(1)} goes in the ${kid.words.potty}. Next time!`, data.voice);
    // A potty trip resets the running reminder.
    if ((isSuccess(kind) || isAccident(kind) || kind === "try") && data.timer?.kid === kid.id) startTimer(intervalOf(kid), kid.id);
  }, [kid, set, data.voice, data.timer, startTimer]);

  // Reminder timer.
  useTick(!!data.timer || !!data.schedRun, 1000);
  useEffect(() => { if (data.timer && Date.now() >= data.timer.endAt && !alertOn) setAlertOn(true); });
  // Phone notification for the timer (when "Notify my phone" is on): the server is told when it ends, so a notification comes
  // even with the app closed, and a "timer running" notification shows on this phone while it counts down.
  const timerKey = data.timer ? `${data.timer.kid}:${data.timer.endAt}` : "";
  const timerKid = data.timer ? data.kids.find((k) => k.id === data.timer!.kid) : null;
  const synced = useRef(false);
  useEffect(() => {
    if (!token) return;
    if (!data.notify) { if (synced.current) { synced.current = false; void syncPottyTimer(token, null, ""); } return; }
    synced.current = true;
    let live = true, tries = 0;
    const send = async () => { const ok = await syncPottyTimer(token, data.timer, timerKid?.name || ""); if (!ok && live && ++tries <= 4) setTimeout(() => { if (live) void send(); }, 15_000 * tries); };
    void send();
    return () => { live = false; };
  }, [token, data.notify, timerKey]);
  useEffect(() => {
    if (!data.notify || !data.timer || data.timer.endAt <= Date.now()) { void clearPottyNotifications([LIVE_TAG]); return; }
    void showRunningTimer(timerKid?.name || "Your child", clockOf(data.timer.endAt));
  }, [data.notify, timerKey]);
  // Looking at the app's own alert: the phone's notifications are not needed too.
  useEffect(() => { if (alertOn) void clearPottyNotifications(); }, [alertOn]);
  // In the iPhone app, today's sit and prompt times are also scheduled on the phone, so they ring with the app closed.
  const schedKey = data.notify && data.schedRun ? `${data.schedRun.kid}:${data.schedRun.day}:${JSON.stringify(data.schedules[data.schedRun.kid]?.items ?? null)}` : "";
  useEffect(() => {
    const run = data.notify ? data.schedRun : null;
    const k = run ? data.kids.find((x) => x.id === run.kid) : null;
    if (!run || !k || run.day !== dayOf(Date.now())) { void syncPottySchedule("", null, ""); return; }
    const items = (data.schedules[k.id]?.items?.length ? data.schedules[k.id].items : buildSchedule(k)).filter((i) => i.kind === "sit" || i.kind === "prompt");
    void syncPottySchedule(k.name, items, run.day);
  }, [schedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Today's schedule as reminders: ring at each sit or prompt time.
  const rung = useRef<Set<string>>(new Set());
  useEffect(() => {
    const run = data.schedRun; if (!run || alertOn) return;
    const k = data.kids.find((x) => x.id === run.kid); if (!k) return;
    if (run.day !== dayOf(Date.now())) { set((d) => ({ ...d, schedRun: null })); return; }
    const items = data.schedules[k.id]?.items?.length ? data.schedules[k.id].items : buildSchedule(k);
    const nowM = minsOf(hm(Date.now()));
    const due = items.find((i) => (i.kind === "sit" || i.kind === "prompt") && nowM >= minsOf(i.time) && nowM - minsOf(i.time) < 2 && !rung.current.has(`${run.day}:${i.id}`));
    if (due) { rung.current.add(`${run.day}:${due.id}`); if (data.cur !== k.id) set((d) => ({ ...d, cur: k.id })); setAlertOn(true); }
  });

  // Keep the current tab visible in the scrolling menu on a phone.
  useEffect(() => { document.querySelector<HTMLElement>(`[data-potty-tab="${tab}"]`)?.scrollIntoView?.({ inline: "center", block: "nearest", behavior: "smooth" }); }, [tab]);
  const go = useCallback((t: Tab, s = "") => { setTab(t); setSub(s); top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, []);
  const ctx: PottyCtx | null = useMemo(() => kid ? ({ data, set, kid, months, log, openLog: (p = {}) => setLogPre(p), celebrate: setParty, startSit: () => setSit(true), startTimer: (m: number) => startTimer(m, kid.id), interval: intervalOf(kid), go, sub, putKid, editKid: () => setEditing(kid), token }) : null, [data, set, kid, months, log, go, sub, putKid, token, startTimer]);

  if (!kid || adding) return <div className="potty-app"><PottyStyles /><Setup first={!kid} onCancel={kid ? () => setAdding(false) : undefined} onDone={(k) => { putKid(k); setAdding(false); setTab("today"); }} n={data.kids.length} /></div>;

  const Screen = { simple: Simple, today: Today, agenda: Agenda, log: History, plan: Program, coach: Coach, schedule: Schedule, videos: Videos, learn: Learn, needs: Needs, try: TryLearn, rewards: Rewards }[tab];
  const stage = stageById(kid.stage);
  return <Ctx.Provider value={ctx}>
    <div ref={top} className="potty-app -mx-3 -mt-2 rounded-[28px] px-3 pb-10 pt-3 sm:-mx-4 sm:px-5" style={{ background: C.ground }}>
      <PottyStyles />
      {/* Child bar */}
      <div className="flex flex-wrap items-center gap-2 pb-3">
        {data.kids.map((k) => { const on = k.id === kid.id; return <button key={k.id} type="button" onClick={() => set((d) => ({ ...d, cur: k.id }))} aria-pressed={on} className="inline-flex min-h-11 items-center gap-2 rounded-full pl-1.5 pr-4 font-bold transition" style={on ? { background: C.ink, color: "#fff" } : { background: "#fff", color: C.inkSoft, boxShadow: `inset 0 0 0 1.5px ${C.line}` }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full text-xl" style={{ background: on ? "#ffffff1f" : C.ground }}>{k.avatar}</span><span className="ph">{k.name}</span>{on && <span className="hidden text-xs font-semibold opacity-70 sm:inline">{[ageText(ageMonths(k.birth)), stage.title].filter(Boolean).join(" · ")}</span>}</button>; })}
        <Btn2 kind="ghost" onClick={() => setAdding(true)}>+ Add a child</Btn2>
        <span className="flex-1" />
        <span className="text-xs" style={{ color: C.muted }}>{state === "saved" ? "Saved" : state === "saving" ? "Saving…" : state === "offline" ? "Offline — saved on this device" : state === "error" ? "Couldn't save" : ""}</span>
        <button type="button" onClick={() => set((d) => ({ ...d, voice: !d.voice }))} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}`, color: C.inkSoft }} aria-label={data.voice ? "Turn the voice off" : "Turn the voice on"} title={data.voice ? "Voice on" : "Voice off"}>{data.voice ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
        <button type="button" onClick={() => setEditing(kid)} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}`, color: C.inkSoft }} aria-label={`${kid.name}'s profile and routine`} title="Profile and routine"><Settings size={17} /></button>
      </div>
      {/* Navigation */}
      <nav aria-label="Potty Training" className="potty-noprint sticky top-0 z-20 -mx-3 mb-5 overflow-x-auto px-3 py-2 [scrollbar-width:none] sm:-mx-5 sm:px-5 [&::-webkit-scrollbar]:hidden" style={{ background: `${C.ground}F2`, backdropFilter: "blur(8px)" }}>
        <div className="flex w-max gap-1.5">{TABS.map((t) => { const on = t.id === tab; return <button key={t.id} type="button" data-potty-tab={t.id} onClick={() => go(t.id)} aria-current={on ? "page" : undefined} className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13.5px] font-bold transition" style={on ? { background: C.duck, color: C.ink } : { color: C.inkSoft }}><t.icon size={16} />{t.label}</button>; })}</div>
      </nav>
      {data.timer && timerKid && <div className="potty-noprint mb-5 flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: C.duckSoft }}>
        <span className="shrink-0 text-xl">⏰</span>
        {/* On a narrow phone the text keeps a readable width and Restart drops below it. */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2"><p className="min-w-0 flex-[1_1_10rem] text-sm font-bold leading-snug">Potty reminder for {timerKid.name} in <span className="whitespace-nowrap tabular-nums">{fmtDuration(Math.max(0, (data.timer.endAt - Date.now()) / 1000))}</span></p>
        <Btn2 kind="plain" onClick={() => startTimer(intervalOf(timerKid), timerKid.id)}>Restart</Btn2></div><button type="button" aria-label="Stop the reminder" onClick={() => set((d) => ({ ...d, timer: null }))} className="shrink-0 self-start p-1" style={{ color: C.inkSoft }}><X size={18} /></button>
      </div>}
      {data.schedRun && <div className="potty-noprint mb-5 flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "#E9F2FF" }}><span className="shrink-0 text-xl">📋</span><p className="min-w-0 flex-1 text-sm font-bold leading-snug">Today's schedule is ringing reminders for {data.kids.find((k) => k.id === data.schedRun!.kid)?.name}. Keep this page open.</p><button type="button" aria-label="Stop schedule reminders" onClick={() => set((d) => ({ ...d, schedRun: null }))} className="p-1" style={{ color: C.inkSoft }}><X size={18} /></button></div>}
      <Suspense fallback={<p className="py-16 text-center text-sm font-bold" style={{ color: C.muted }}>Opening…</p>}><Screen key={`${tab}:${kid.id}`} /></Suspense>
    </div>
    {logPre && <LogSheet pre={logPre} onClose={() => setLogPre(null)} />}
    {party && <Celebrate kid={kid} voice={data.voice} title={party} onPick={(s) => set((d) => ({ ...d, stickers: [...d.stickers, { id: uid(), kid: kid.id, s, at: Date.now() }] }))} onClose={() => setParty(null)} />}
    {sit && <SitTimer kid={kid} seconds={sitMinutes(months) * 60} voice={data.voice} videoYt={data.sitVideo} onClose={() => setSit(false)} onEnd={(r) => { setSit(false); log(r, { init: "schedule" }); }} />}
    {alertOn && (() => { const ak = (data.timer && data.kids.find((k) => k.id === data.timer!.kid)) || kid; return <Alert kid={ak} voice={data.voice} onClose={() => { setAlertOn(false); if (data.timer) startTimer(intervalOf(ak), ak.id); }} onAnswer={(a) => {
      setAlertOn(false);
      if (a === "snooze") { startTimer(5, ak.id); return; }
      if (data.timer) startTimer(intervalOf(ak), ak.id);
      if (ak.id !== kid.id) set((d) => ({ ...d, cur: ak.id }));
      if (a === "sit") setSit(true); else if (a === "went") log("pee", { init: "schedule" }); else if (a === "pooped") log("poop", { init: "schedule" }); else if (a === "tried") log("try", { init: "schedule" }); else log("acc-pee");
    }} />; })()}
    {editing && <KidEditor k={editing} units={data.units} onUnits={(u) => set((d) => ({ ...d, units: u }))} onSave={(k) => { putKid(k); setEditing(null); }} onClose={() => setEditing(null)}
      onDelete={data.kids.length ? () => { if (window.confirm(`Remove ${editing.name} and everything logged for them? This can't be undone.`)) { set((d) => ({ ...d, kids: d.kids.filter((x) => x.id !== editing.id), logs: d.logs.filter((x) => x.kid !== editing.id), stickers: d.stickers.filter((x) => x.kid !== editing.id), cur: d.kids.find((x) => x.id !== editing.id)?.id || "", timer: d.timer?.kid === editing.id ? null : d.timer })); setEditing(null); } } : undefined} />}
  </Ctx.Provider>;
}

// ─── Setting up a child ───
function Setup({ first, n, onDone, onCancel }: { first: boolean; n: number; onDone: (k: Child) => void; onCancel?: () => void }) {
  const [k, setK] = useState<Child>(() => blankChild(uid(), n));
  const [step, setStep] = useState(0);
  const steps = ["About your child", "Any additional needs?", "Where are you now?", "Their day", "Their words"];
  const months = ageMonths(k.birth);
  const ok = step !== 0 || k.name.trim().length > 0;
  return <div className="mx-auto max-w-2xl py-4">
    {first && <div className="mb-8 text-center">
      <p className="text-5xl">🚽✨</p>
      <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl" style={{ fontFamily: FONT_HEAD }}>Potty training, planned around your child</h1>
      <p className="mx-auto mt-2 max-w-lg" style={{ color: C.muted }}>A step-by-step plan for wherever you are, predictions from your child's own rhythm, an AI coach, real videos, and guides for every kind of child. Two minutes to set up.</p>
    </div>}
    <Panel>
      <div className="mb-5 flex items-center gap-1.5">{steps.map((s, i) => <span key={s} className="h-1.5 flex-1 rounded-full" style={{ background: i <= step ? C.duck : C.line }} />)}</div>
      <p className="text-[13px] font-bold" style={{ color: C.muted }}>Step {step + 1} of {steps.length}</p>
      <h2 className="mb-4 text-2xl font-extrabold">{steps[step]}</h2>
      {step === 0 && <div className="space-y-4">
        <Label text="Name or nickname"><input autoFocus value={k.name} onChange={(e) => setK({ ...k, name: e.target.value })} className={field} style={fieldStyle} maxLength={40} /></Label>
        <Label text="Picture"><div className="flex flex-wrap gap-1.5">{AVATARS.map((a) => <button key={a} type="button" onClick={() => setK({ ...k, avatar: a })} aria-pressed={k.avatar === a} className="h-12 w-12 rounded-2xl text-2xl" style={k.avatar === a ? { background: C.duck } : { background: C.ground }}>{a}</button>)}</div></Label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Label text="Birth month" hint={months !== null ? `${ageText(months)} old` : "Used for sit length, timing and age-right advice."}><input type="month" value={k.birth.slice(0, 7)} onChange={(e) => setK({ ...k, birth: e.target.value })} className={field} style={fieldStyle} /></Label>
          <Label text="For boy- or girl-specific tips (optional)"><div className="flex gap-1.5"><Chip on={k.sex === "boy"} onClick={() => setK({ ...k, sex: k.sex === "boy" ? "" : "boy" })}>Boy</Chip><Chip on={k.sex === "girl"} onClick={() => setK({ ...k, sex: k.sex === "girl" ? "" : "girl" })}>Girl</Chip><Chip on={!k.sex} onClick={() => setK({ ...k, sex: "" })}>Skip</Chip></div></Label></div>
      </div>}
      {step === 1 && <div className="space-y-4">
        <p className="text-sm" style={{ color: C.muted }}>Choose any that apply. The plan, the AI coach and the guides adapt to them. You can change this later.</p>
        <div className="flex flex-wrap gap-1.5">{NEEDS.map((x) => { const on = k.needs.includes(x.id); return <Chip key={x.id} on={on} color={C.sleep} onClick={() => setK({ ...k, needs: on ? k.needs.filter((y) => y !== x.id) : [...k.needs, x.id as NeedId] })}>{x.emoji} {x.label}</Chip>; })}</div>
        <Label text="How does your child communicate?"><div className="flex flex-wrap gap-1.5">{COMMS.map((c) => <Chip key={c.id} on={k.comms === c.id} onClick={() => setK({ ...k, comms: c.id })}>{c.label}</Chip>)}</div></Label>
      </div>}
      {step === 2 && <div className="space-y-2">
        {STAGES.map((s) => <button key={s.id} type="button" onClick={() => setK({ ...k, stage: s.id, start: s.id === "ready" || s.id === "sits" ? "" : k.start || dayOf(Date.now()) })} aria-pressed={k.stage === s.id} className="flex w-full items-start gap-3 rounded-2xl p-3 text-left transition" style={k.stage === s.id ? { background: C.ink, color: "#fff" } : { background: C.ground }}>
          <span className="text-2xl">{s.emoji}</span><span className="min-w-0"><span className="ph block font-extrabold">{s.title}</span><span className="block text-[13px] opacity-80">{s.summary}</span></span></button>)}
        <p className="pt-1 text-xs" style={{ color: C.muted }}>Not sure? Choose "Getting ready" — the plan starts with a readiness check.</p>
      </div>}
      {step === 3 && <RoutineEditor k={k} onChange={setK} />}
      {step === 4 && <div className="space-y-4">
        <p className="text-sm" style={{ color: C.muted }}>The words your family uses. The app, the sit timer and the social story use them, so everything sounds familiar.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{(["pee", "poop", "potty"] as const).map((w) => <Label key={w} text={`For "${w}"`}><input value={k.words[w]} onChange={(e) => setK({ ...k, words: { ...k.words, [w]: e.target.value.slice(0, 20) } })} className={field} style={fieldStyle} /></Label>)}</div>
        <Label text="Method (you can change it any time)"><select value={k.method} onChange={(e) => setK({ ...k, method: e.target.value as Child["method"] })} className={field} style={fieldStyle}>{METHOD_LIST.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Label>
      </div>}
      <div className="mt-6 flex flex-wrap gap-2">
        {step > 0 ? <Btn2 onClick={() => setStep(step - 1)}>Back</Btn2> : onCancel && <Btn2 onClick={onCancel}>Cancel</Btn2>}
        <span className="flex-1" />
        {step < steps.length - 1 ? <Btn2 kind="ink" big disabled={!ok} onClick={() => setStep(step + 1)}>Next</Btn2> : <Btn2 kind="duck" big onClick={() => onDone({ ...k, name: k.name.trim() })}>Start {k.name.trim() ? `${k.name.trim()}'s` : "the"} plan</Btn2>}
      </div>
    </Panel>
  </div>;
}

function RoutineEditor({ k, onChange }: { k: Child; onChange: (k: Child) => void }) {
  const r = k.routine; const set = (p: Partial<Child["routine"]>) => onChange({ ...k, routine: { ...r, ...p } });
  const t = (v: string, f: (x: string) => void, label: string) => <Label text={label}><input type="time" value={v} onChange={(e) => f(e.target.value)} className={field} style={fieldStyle} /></Label>;
  return <div className="space-y-4">
    <p className="text-sm" style={{ color: C.muted }}>Used for predictions and the daily schedule. Rough times are fine.</p>
    <div className="grid grid-cols-2 gap-3">{t(r.wake, (x) => set({ wake: x }), "Wakes up")}{t(r.bed, (x) => set({ bed: x }), "Bedtime")}</div>
    <div><p className="mb-1.5 text-[13px] font-bold" style={{ color: C.inkSoft }}>Meals and snacks</p>
      <div className="space-y-2">{r.meals.map((m) => <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_112px_36px] gap-2"><input value={m.label} onChange={(e) => set({ meals: r.meals.map((x) => (x.id === m.id ? { ...x, label: e.target.value.slice(0, 30) } : x)) })} className={field} style={fieldStyle} aria-label="Meal name" /><input type="time" value={m.time} onChange={(e) => set({ meals: r.meals.map((x) => (x.id === m.id ? { ...x, time: e.target.value } : x)) })} className={field} style={fieldStyle} aria-label="Meal time" /><button type="button" aria-label="Remove" onClick={() => set({ meals: r.meals.filter((x) => x.id !== m.id) })} style={{ color: C.muted }}>✕</button></div>)}</div>
      <Btn2 kind="ghost" onClick={() => set({ meals: [...r.meals, { id: uid(), label: "Snack", time: "16:00" }] })}>+ Meal or snack</Btn2></div>
    <div><p className="mb-1.5 text-[13px] font-bold" style={{ color: C.inkSoft }}>Naps</p>
      <div className="space-y-2">{r.naps.map((n) => <div key={n.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px] gap-2"><input type="time" value={n.from} onChange={(e) => set({ naps: r.naps.map((x) => (x.id === n.id ? { ...x, from: e.target.value } : x)) })} className={field} style={fieldStyle} aria-label="Nap starts" /><input type="time" value={n.to} onChange={(e) => set({ naps: r.naps.map((x) => (x.id === n.id ? { ...x, to: e.target.value } : x)) })} className={field} style={fieldStyle} aria-label="Nap ends" /><button type="button" aria-label="Remove nap" onClick={() => set({ naps: r.naps.filter((x) => x.id !== n.id) })} style={{ color: C.muted }}>✕</button></div>)}</div>
      <Btn2 kind="ghost" onClick={() => set({ naps: [...r.naps, { id: uid(), from: "13:00", to: "14:30" }] })}>+ Nap</Btn2></div>
    <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={r.daycare} onChange={(e) => set({ daycare: e.target.checked })} className="h-4 w-4" />Goes to daycare, preschool or school</label>
    {r.daycare && <div className="space-y-2 rounded-2xl p-3" style={{ background: C.ground }}>
      <div className="flex flex-wrap gap-1">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => <Chip key={d} on={r.daycareDays.includes(i)} onClick={() => set({ daycareDays: r.daycareDays.includes(i) ? r.daycareDays.filter((x) => x !== i) : [...r.daycareDays, i] })}>{d}</Chip>)}</div>
      <div className="grid grid-cols-2 gap-3">{t(r.daycareFrom, (x) => set({ daycareFrom: x }), "Drop-off")}{t(r.daycareTo, (x) => set({ daycareTo: x }), "Pick-up")}</div></div>}
  </div>;
}

function KidEditor({ k, units, onUnits, onSave, onClose, onDelete }: { k: Child; units: "oz" | "ml"; onUnits: (u: "oz" | "ml") => void; onSave: (k: Child) => void; onClose: () => void; onDelete?: () => void }) {
  const [v, setV] = useState(k); const [tab, setTab] = useState<"about" | "routine" | "plan">("about");
  return <Modal wide title={`${k.name}'s profile`} onClose={onClose} footer={<>{onDelete && <Btn2 kind="danger" onClick={onDelete}>Remove child</Btn2>}<Btn2 kind="ink" disabled={!v.name.trim()} onClick={() => onSave({ ...v, name: v.name.trim() })}>Save</Btn2></>}>
    <div className="potty-app space-y-4">
      <div className="flex gap-1.5">{([["about", "About"], ["routine", "Daily routine"], ["plan", "Plan & settings"]] as const).map(([id, l]) => <Chip key={id} on={tab === id} onClick={() => setTab(id)}>{l}</Chip>)}</div>
      {tab === "about" && <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Label text="Name"><input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value.slice(0, 40) })} className={field} style={fieldStyle} /></Label><Label text="Birth month"><input type="month" value={v.birth.slice(0, 7)} onChange={(e) => setV({ ...v, birth: e.target.value })} className={field} style={fieldStyle} /></Label></div>
        <div className="flex flex-wrap gap-1.5">{AVATARS.map((a) => <button key={a} type="button" onClick={() => setV({ ...v, avatar: a })} aria-pressed={v.avatar === a} className="h-11 w-11 rounded-2xl text-2xl" style={v.avatar === a ? { background: C.duck } : { background: C.ground }}>{a}</button>)}</div>
        <Label text="Boy/girl tips"><div className="flex gap-1.5"><Chip on={v.sex === "boy"} onClick={() => setV({ ...v, sex: "boy" })}>Boy</Chip><Chip on={v.sex === "girl"} onClick={() => setV({ ...v, sex: "girl" })}>Girl</Chip><Chip on={!v.sex} onClick={() => setV({ ...v, sex: "" })}>Skip</Chip></div></Label>
        <Label text="Additional needs"><div className="flex flex-wrap gap-1.5">{NEEDS.map((x) => { const on = v.needs.includes(x.id); return <Chip key={x.id} on={on} color={C.sleep} onClick={() => setV({ ...v, needs: on ? v.needs.filter((y) => y !== x.id) : [...v.needs, x.id] })}>{x.emoji} {x.label}</Chip>; })}</div></Label>
        <Label text="Communicates with"><div className="flex flex-wrap gap-1.5">{COMMS.map((c) => <Chip key={c.id} on={v.comms === c.id} onClick={() => setV({ ...v, comms: c.id })}>{c.label}</Chip>)}</div></Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{(["pee", "poop", "potty"] as const).map((w) => <Label key={w} text={`Word for "${w}"`}><input value={v.words[w]} onChange={(e) => setV({ ...v, words: { ...v.words, [w]: e.target.value.slice(0, 20) } })} className={field} style={fieldStyle} /></Label>)}</div>
      </div>}
      {tab === "routine" && <RoutineEditor k={v} onChange={setV} />}
      {tab === "plan" && <div className="space-y-4">
        <Label text="Stage"><select value={v.stage} onChange={(e) => setV({ ...v, stage: e.target.value as Child["stage"] })} className={field} style={fieldStyle}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.title}</option>)}</select></Label>
        <Label text="Method"><select value={v.method} onChange={(e) => setV({ ...v, method: e.target.value as Child["method"] })} className={field} style={fieldStyle}>{METHOD_LIST.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Label>
        <Label text="Started training on"><input type="date" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} className={field} style={fieldStyle} /></Label>
        <Label text="Reminder every (minutes)" hint="Leave at 0 to use the app's suggestion from your child's log."><input type="number" min={0} max={240} value={v.interval} onChange={(e) => setV({ ...v, interval: Math.max(0, Math.min(240, Number(e.target.value) || 0)) })} className={field} style={fieldStyle} /></Label>
        <Label text="Drink sizes in"><div className="flex gap-1.5"><Chip on={units === "oz"} onClick={() => onUnits("oz")}>Ounces</Chip><Chip on={units === "ml"} onClick={() => onUnits("ml")}>Millilitres</Chip></div></Label>
      </div>}
    </div>
  </Modal>;
}
