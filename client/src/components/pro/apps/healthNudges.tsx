// Health Nudges: pick goals and a tone, and get motivation, science, tips and tiny challenges through the day.
// The messages come from shared/healthNudges.ts, the same code the server uses for phone notifications, so the
// phone and this screen always say the same thing.
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellOff, Pause, Play, Shuffle } from "lucide-react";
import { Btn, Card, Empty, Field, Tabs, fmtTime, inputCls, today, usePro } from "../kit";
import { DEFAULT_NUDGES, GOALS, KINDS, KIND_LABEL, LEVELS, MAX_GOALS, MIN_GAP_MINUTES, cleanNudgeData, composeNudge, describeSchedule, maxPerDay, nudgesOn, type Goal, type NudgeData, type NudgeKind } from "@shared/healthNudges";
import { GOAL_GROUPS } from "@shared/healthNudgesContent";

const COLOR = "#e11d48";
const KIND_STYLE: Record<NudgeKind, string> = { core: "bg-rose-50 text-rose-700", tip: "bg-emerald-50 text-emerald-700", fact: "bg-sky-50 text-sky-700", act: "bg-amber-50 text-amber-800" };
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const clockMinutes = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3));

function Message({ title, body, kind, time, faded }: { title: string; body: string; kind: NudgeKind; time?: string; faded?: boolean }) {
  return <li className={`rounded-xl bg-white p-3 ring-1 ring-slate-200 ${faded ? "opacity-60" : ""}`}>
    <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
      <span className={`rounded-full px-2 py-0.5 ${KIND_STYLE[kind]}`}>{KIND_LABEL[kind]}</span>
      <span className="text-slate-600">{title.split(" · ")[0]}</span>
      {time && <span className="ml-auto text-slate-500">{fmtTime(time)}</span>}
    </div>
    <p className="mt-1.5 text-[15px] leading-snug text-slate-900">{body}</p>
  </li>;
}

export default function HealthNudges() {
  const { data: raw, setData } = usePro<NudgeData>("health-nudges", DEFAULT_NUDGES);
  const data = useMemo(() => cleanNudgeData(raw), [raw]);
  const [tab, setTab] = useState<"today" | "goals" | "tone" | "schedule">(() => (cleanNudgeData(raw).goals.length ? "today" : "goals"));
  const [extra, setExtra] = useState<{ title: string; body: string; kind: NudgeKind }[]>([]);
  const [permission, setPermission] = useState<string>(() => { try { return typeof Notification === "undefined" ? "unsupported" : Notification.permission; } catch { return "unsupported"; } });
  const fired = useRef(new Set<string>());
  const set = (patch: Partial<NudgeData>) => setData((d) => cleanNudgeData({ ...cleanNudgeData(d), seed: cleanNudgeData(d).seed || 1 + Math.floor(Math.random() * 99998), ...patch }));

  const day = today();
  const plan = useMemo(() => nudgesOn(data, day), [data, day]);
  const [minute, setMinute] = useState(nowMinutes());
  useEffect(() => { const t = window.setInterval(() => setMinute(nowMinutes()), 30_000); return () => window.clearInterval(t); }, []);

  // While this page is open and phone notifications are off, show browser notifications at the planned times.
  useEffect(() => {
    if (data.push || permission !== "granted") return;
    for (const n of plan) {
      const at = clockMinutes(n.time);
      if (minute >= at && minute < at + 20 && !fired.current.has(n.key)) {
        fired.current.add(n.key);
        try { new Notification(n.title, { body: n.body, tag: n.key }); } catch { /* not allowed here */ }
      }
    }
  }, [plan, minute, data.push, permission]);

  const goalsPicked = data.goals.map((id) => GOALS.find((g) => g.id === id)).filter((g): g is Goal => !!g);
  const toggleGoal = (id: string) => set({ goals: data.goals.includes(id) ? data.goals.filter((g) => g !== id) : data.goals.length >= MAX_GOALS ? data.goals : [...data.goals, id] });
  const another = () => {
    if (!goalsPicked.length) return;
    const goal = goalsPicked[Math.floor(Math.random() * goalsPicked.length)];
    const n = composeNudge(goal, data.level, Math.floor(Math.random() * 100_000), data.kinds);
    setExtra((list) => [{ title: n.title, body: n.body, kind: n.kind }, ...list].slice(0, 5));
  };
  const askBrowser = async () => { try { setPermission(await Notification.requestPermission()); } catch { /* none */ } };
  const level = LEVELS.find((l) => l.id === data.level)!;
  const sample = goalsPicked[0] ? composeNudge(goalsPicked[0], data.level, 3, data.kinds) : null;
  const dayOff = !data.days.includes(new Date().getDay());

  return <div className="space-y-4">
    <Card tint="#fff1f2" className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-3xl" aria-hidden>{data.paused ? "😴" : "🔔"}</span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-black text-slate-900">{!goalsPicked.length ? "Pick your goals to begin" : data.paused ? "Nudges are paused" : `${level.name} nudges for ${goalsPicked.length} goal${goalsPicked.length === 1 ? "" : "s"}`}</p>
          <p className="text-sm text-slate-600">{goalsPicked.length ? describeSchedule(data) : "Choose what you're working on, then how pushy you want us to be."}</p>
        </div>
        {goalsPicked.length > 0 && <Btn kind={data.paused ? "primary" : "ghost"} color={COLOR} onClick={() => set({ paused: !data.paused })}>{data.paused ? <><Play className="h-4 w-4" /> Resume</> : <><Pause className="h-4 w-4" /> Pause</>}</Btn>}
      </div>
    </Card>

    <Tabs value={tab} onChange={setTab} color={COLOR} items={[{ id: "today", label: "Today" }, { id: "goals", label: `Goals${goalsPicked.length ? ` (${goalsPicked.length})` : ""}` }, { id: "tone", label: "Tone" }, { id: "schedule", label: "Schedule" }]} />

    {tab === "today" && <div className="space-y-3">
      {!goalsPicked.length ? <Empty>Pick at least one goal and your nudges will show up here.</Empty> : <>
        <div className="flex flex-wrap items-center gap-2">
          <Btn kind="primary" color={COLOR} onClick={another}><Shuffle className="h-4 w-4" /> Give me one now</Btn>
          <span className="text-xs text-slate-500">{data.paused ? "Paused: nothing is scheduled." : dayOff ? `No nudges on ${DAY_NAMES[new Date().getDay()]}s. Change this under Schedule.` : `${plan.filter((n) => clockMinutes(n.time) <= minute).length} of ${plan.length} so far today`}</span>
        </div>
        {extra.length > 0 && <ul className="space-y-2">{extra.map((n, i) => <Message key={i} {...n} />)}</ul>}
        {plan.length > 0 && <>
          <p className="pt-1 text-xs font-bold uppercase tracking-wide text-slate-500">Today's nudges</p>
          <ul className="space-y-2">{plan.map((n) => <Message key={n.key} title={n.title} body={n.body} kind={n.kind} time={n.time} faded={clockMinutes(n.time) > minute} />)}</ul>
        </>}
        {!data.push && permission === "default" && <Card className="space-y-2"><p className="text-sm font-semibold text-slate-800">Get these as notifications while this page is open?</p><Btn kind="soft" color={COLOR} onClick={askBrowser}><Bell className="h-4 w-4" /> Allow browser notifications</Btn></Card>}
        {!data.push && permission === "denied" && <p className="flex items-center gap-2 text-xs text-slate-500"><BellOff className="h-4 w-4" /> Browser notifications are blocked. Turn on phone notifications under Schedule instead.</p>}
      </>}
    </div>}

    {tab === "goals" && <div className="space-y-4">
      <p className="text-sm text-slate-600">Choose up to {MAX_GOALS}. With more than one, the nudges take turns. <b>{data.goals.length}</b> of {MAX_GOALS} picked.</p>
      {GOAL_GROUPS.map((group) => <section key={group}>
        <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">{group}</h3>
        <div className="flex flex-wrap gap-2">
          {GOALS.filter((g) => g.group === group).map((g) => {
            const on = data.goals.includes(g.id);
            const full = !on && data.goals.length >= MAX_GOALS;
            return <button key={g.id} type="button" disabled={full} aria-pressed={on} onClick={() => toggleGoal(g.id)}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold ring-1 transition active:scale-[.97] disabled:opacity-40 ${on ? "text-white ring-transparent" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`}
              style={on ? { background: COLOR } : undefined}><span aria-hidden>{g.emoji}</span>{g.label}</button>;
          })}
        </div>
      </section>)}
      {goalsPicked.length > 0 && <Btn kind="primary" color={COLOR} onClick={() => setTab("tone")}>Next: choose a tone</Btn>}
    </div>}

    {tab === "tone" && <div className="space-y-3">
      <p className="text-sm text-slate-600">How hard should we push? You can change this any time.</p>
      <div className="grid gap-2">
        {LEVELS.map((l) => {
          const on = data.level === l.id;
          const preview = goalsPicked[0] ? composeNudge(goalsPicked[0], l.id, 3, data.kinds).body : l.sample;
          return <button key={l.id} type="button" aria-pressed={on} onClick={() => set({ level: l.id })}
            className={`rounded-2xl p-3 text-left ring-2 transition active:scale-[.99] ${on ? "bg-rose-50 ring-rose-500" : "bg-white ring-slate-200 hover:bg-slate-50"}`}>
            <div className="flex items-center gap-2"><span className="flex gap-0.5" aria-hidden>{[1, 2, 3, 4, 5].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: i <= l.id ? COLOR : "#e2e8f0" }} />)}</span><span className="text-base font-black text-slate-900">{l.name}</span><span className="text-xs text-slate-500">{l.blurb}</span></div>
            <p className="mt-1.5 text-sm italic text-slate-700">“{preview}”</p>
          </button>;
        })}
      </div>
      {data.level >= 4 && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">Tough and Drill sergeant go after excuses, never you. If food or your body is a sensitive subject, Gentle or Friendly is kinder and works just as well.</p>}
    </div>}

    {tab === "schedule" && <div className="space-y-4">
      <Card title="When" className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><input type="time" className={inputCls} value={data.from} onChange={(e) => set({ from: e.target.value })} /></Field>
          <Field label="Until"><input type="time" className={inputCls} value={data.until} onChange={(e) => set({ until: e.target.value })} /></Field>
        </div>
        <Field label={`How many a day: ${data.perDay}`} hint={`Up to ${maxPerDay(data.from, data.until)} in these hours, at least ${MIN_GAP_MINUTES} minutes apart.`}>
          <input type="range" min={1} max={maxPerDay(data.from, data.until)} value={data.perDay} onChange={(e) => set({ perDay: Number(e.target.value) })} className="w-full accent-rose-600" />
        </Field>
        <div>
          <p className="mb-1 text-xs font-bold text-slate-600">Days</p>
          <div className="flex gap-1.5">{DAYS.map((d, i) => { const on = data.days.includes(i); return <button key={i} type="button" aria-pressed={on} aria-label={DAY_NAMES[i]} onClick={() => set({ days: on ? data.days.filter((x) => x !== i) : [...data.days, i] })}
            className={`h-10 w-10 rounded-full text-sm font-bold ring-1 ${on ? "text-white ring-transparent" : "bg-white text-slate-600 ring-slate-200"}`} style={on ? { background: COLOR } : undefined}>{d}</button>; })}</div>
        </div>
      </Card>
      <Card title="What kind" className="space-y-2">
        {KINDS.map((k) => <label key={k} className="flex min-h-10 items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-rose-600" checked={data.kinds[k]} onChange={(e) => set({ kinds: { ...data.kinds, [k]: e.target.checked } })} />
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${KIND_STYLE[k]}`}>{KIND_LABEL[k]}</span>
          <span className="text-slate-600">{{ core: "Pep talks and quotes", tip: "Practical ideas", fact: "What the research says", act: "Tiny things to do right now" }[k]}</span>
        </label>)}
      </Card>
      <Card title="On your phone" className="space-y-2">
        <label className="flex items-center gap-3 text-sm font-semibold text-slate-800">
          <input type="checkbox" className="h-5 w-5 accent-rose-600" checked={data.push} onChange={(e) => set({ push: e.target.checked })} />
          Send nudges to my phone, even when the app is closed
        </label>
        {data.push && <p className="text-xs text-slate-600">This uses the same phone notifications as your Arise reminders. If you haven't turned those on for this device, do it once in <a className="font-bold text-rose-700 underline" href="/#/lifehub">LifeHub → Notifications</a> (or Arise WorkHub). Messages can take up to ten minutes to start after you change settings.</p>}
      </Card>
    </div>}

    {sample && tab !== "today" && <p className="text-center text-xs text-slate-500">Example: “{sample.body}”</p>}
    <p className="text-center text-[11px] leading-snug text-slate-500">Health Nudges are encouragement, not medical advice. Talk to a doctor before big changes to eating, exercise or medicine. If you've struggled with disordered eating, choose Gentle and skip calorie and weight goals. If you're in crisis, contact your local emergency number.</p>
  </div>;
}
