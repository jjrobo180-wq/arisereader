// Arise Fit apps (shared/fitApps.ts): the Apps tab (the apps you've added, and the tab bar), the Arise
// Fit app library, and the apps that are new screens: Yoga, Breathe, Mobility, Intervals (with your own
// interval timers), Couch to 5K, Water, Steps, Recovery and Friends. Strength, Food, Fasting, Run,
// Sleep and the rest are the screens they always were (FitApp.tsx opens them).
import { useMemo, useState } from "react";
import {
  Apple, BarChart3, Check, ChefHat, ChevronDown, ChevronLeft, ChevronRight, Droplets, Dumbbell, Flower2, Footprints, HeartPulse, LayoutGrid, MapPin, Medal, Minus, Moon, Pencil,
  PersonStanding, Pin, PinOff, Plane, Play, Plus, Route, ScanFace, ScanLine, Search, Sparkles, Timer, Trash2, Undo2, UserCheck, Users, Utensils, Wind, X, Zap, type LucideIcon,
} from "lucide-react";
import { dayKey, uid, type FitData } from "@shared/fit";
import { FIT_APPS, FIT_APP_BY_ID, FIT_APP_CATEGORIES, TAB_MAX, addApp, appsOf, moveTab, removeApp, toggleTab, type FitApp, type FitAppId } from "@shared/fitApps";
import { SESSION_BY_ID, nextC25K, sessionMins, sessionsIn, type Session, type SessionCategory } from "@shared/fitSessions";
import { TIMER_PRESETS, timerSecs, timerSession, type IntervalTimer } from "@shared/fitTimers";
import { readiness } from "@shared/fitReadiness";
import { BODY_PARTS, PART_NAME, recovery } from "@shared/fitRecovery";
import { Btn, C, Card, Field, Ring, Sheet, Title, display, fmtDur, fmtNum, haptic, inputCls, inputStyle, stagger } from "./fitUi";
import { CoverCard } from "./FitVideo";
import { SessionPlayer } from "./FitSession";
import { logSession } from "./FitTrain";
import { MiniBody, recColor } from "./FitBody";
import { useHealth } from "./FitHealth";
import { connectHealth, healthConnected, readHealth, type HealthSnapshot } from "./fitNative";
import { CircleCard } from "./FitCircle";
import { BuddyCard } from "./FitBuddy";
import { PlusTag } from "./FitPlus";
import type { ArtKind } from "./fitArt";
import type { Update } from "./fitStore";
import { isNativeApp } from "@/lib/nativeApp";

export const APP_ICONS: Record<string, LucideIcon> = { Apple, BarChart3, ChefHat, Droplets, Dumbbell, Flower2, Footprints, HeartPulse, MapPin, Medal, Moon, PersonStanding, Plane, Route, ScanFace, ScanLine, Timer, UserCheck, Users, Utensils, Wind, Zap };

/** An app's icon: a rounded square in its own colors, like the Home Screen. */
export function AppTile({ app, size = 56 }: { app: FitApp; size?: number }) {
  const Icon = APP_ICONS[app.icon] ?? LayoutGrid;
  return <span aria-hidden className="relative grid shrink-0 place-items-center overflow-hidden" style={{ width: size, height: size, borderRadius: size * 0.28, background: `linear-gradient(145deg, ${app.tile[0]}, ${app.tile[1]})`, boxShadow: "inset 0 1px 0 rgba(255,255,255,.35), 0 6px 14px -6px rgba(0,0,0,.45)" }}>
    <span className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 20% 0%, rgba(255,255,255,.35), transparent 55%)" }} />
    <Icon className="relative" style={{ width: size * 0.48, height: size * 0.48, color: "#fff" }} strokeWidth={2.2} />
  </span>;
}

/** Today's row of your apps, ending in "All apps". */
export function YourAppsRow({ data, onOpen, onAll }: { data: FitData; onOpen: (id: FitAppId) => void; onAll: () => void }) {
  const a = appsOf(data.apps);
  const list = a.added.filter((id) => !a.tabs.includes(id)).map((id) => FIT_APP_BY_ID.get(id)!).filter(Boolean);
  return <><Title right={<button type="button" onClick={onAll} className="text-[14px] font-semibold" style={{ color: C.lime }}>All apps</button>}>Your apps</Title>
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" data-testid="fit-your-apps">
      {list.map((app, i) => <button key={app.id} type="button" onClick={() => { haptic("light"); onOpen(app.id); }} className="fit-in flex w-[68px] shrink-0 flex-col items-center gap-1.5 active:scale-95" style={stagger(i, 0.03)} data-testid={`fit-app-${app.id}`}>
        <AppTile app={app} size={58} /><span className="w-full truncate text-center text-[12px] font-semibold">{app.name}</span></button>)}
      <button type="button" onClick={onAll} className="flex w-[68px] shrink-0 flex-col items-center gap-1.5 active:scale-95" data-testid="fit-app-more">
        <span className="grid h-[58px] w-[58px] place-items-center rounded-[16px]" style={{ background: C.card, boxShadow: `inset 0 0 0 1.5px ${C.line}` }}><Plus className="h-6 w-6" style={{ color: C.dim }} /></span>
        <span className="text-[12px] font-semibold" style={{ color: C.dim }}>Add</span></button>
    </div></>;
}

/** The Apps tab: what you've added, what's on the tab bar, and the way into the library. */
export function AppsTab({ data, update, say, onOpen }: { data: FitData; update: Update; say: (m: string) => void; onOpen: (id: FitAppId) => void }) {
  const a = appsOf(data.apps);
  const [edit, setEdit] = useState(false);
  const [store, setStore] = useState(false);
  const added = a.added.map((id) => FIT_APP_BY_ID.get(id)!).filter(Boolean);
  const set = (fn: (x: typeof a) => typeof a) => update((d) => ({ ...d, apps: fn(appsOf(d.apps)) }));
  const notYet = FIT_APPS.filter((x) => !a.added.includes(x.id)).slice(0, 6);
  return <Sheet inline title="Apps" onClose={() => {}} testId="fit-apps"
    right={<button type="button" onClick={() => { haptic("light"); setEdit(!edit); }} aria-pressed={edit} className="flex h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold" style={edit ? { background: C.lime, color: C.ink } : { background: C.card, color: C.text }} data-testid="fit-apps-edit">{edit ? <><Check className="h-4 w-4" />Done</> : <><Pencil className="h-4 w-4" />Edit</>}</button>}>
    <p className="-mt-1 mb-3 px-1 text-[14px]" style={{ color: C.dim }}>Make Arise Fit yours. Add the apps you use, and pin up to {TAB_MAX} to the tab bar.</p>

    {/* The tab bar, as it will look. */}
    <Card className="!p-3" testId="fit-apps-tabbar">
      <p className="mb-2 px-1 text-[12px] tracking-[.14em]" style={{ ...display, color: C.dim }}>Your tab bar</p>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${TAB_MAX + 2}, minmax(0,1fr))` }}>
        <Slot label="Today" fixed />
        {Array.from({ length: TAB_MAX }, (_, i) => { const id = a.tabs[i]; const app = id ? FIT_APP_BY_ID.get(id) : undefined;
          return app ? <div key={i} className="relative flex flex-col items-center gap-1 rounded-[12px] py-2" style={{ background: C.card2 }}>
            <AppTile app={app} size={34} /><span className="w-full truncate px-1 text-center text-[11px] font-semibold">{app.name}</span>
            {edit && <button type="button" aria-label={`Take ${app.name} off the tab bar`} onClick={() => set((x) => toggleTab(x, app.id))} className="absolute -right-1 -top-1.5 grid h-6 w-6 place-items-center rounded-full shadow" style={{ background: C.card, color: C.red, boxShadow: `0 0 0 1px ${C.line}` }} data-testid={`fit-tabbar-off-${app.id}`}><X className="h-3.5 w-3.5" /></button>}
          </div> : <div key={i} className="grid place-items-center rounded-[12px] px-1 py-2 text-center text-[11px] font-semibold" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}`, color: C.dim, borderStyle: "dashed" }}>Empty<br />slot</div>; })}
        <Slot label="Apps" fixed />
      </div>
      {edit && a.tabs.length > 1 && <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1" aria-label="Order of the tab bar">{a.tabs.map((id, i) => { const app = FIT_APP_BY_ID.get(id)!; return <span key={id} className="flex items-center gap-0.5 rounded-full py-0.5 pl-1 pr-2 text-[12px] font-semibold" style={{ background: C.card2 }}>
        <button type="button" aria-label={`Move ${app.name} left`} disabled={i === 0} onClick={() => set((x) => moveTab(x, id, -1))} className="grid h-7 w-7 place-items-center rounded-full disabled:opacity-25"><ChevronLeft className="h-4 w-4" /></button>
        {app.name}
        <button type="button" aria-label={`Move ${app.name} right`} disabled={i >= a.tabs.length - 1} onClick={() => set((x) => moveTab(x, id, 1))} className="grid h-7 w-7 place-items-center rounded-full disabled:opacity-25"><ChevronRight className="h-4 w-4" /></button></span>; })}</div>}
      <p className="mt-2 px-1 text-[12px]" style={{ color: C.dim }}>{edit ? "Tap an app below to pin it to the tab bar or take it off. Use the arrows to change the order." : "Tap Edit to change it."}</p>
    </Card>

    <Title>Added</Title>
    {added.length ? <div className="grid grid-cols-4 gap-x-2 gap-y-4" data-testid="fit-apps-added">{added.map((app, i) => { const pinned = a.tabs.includes(app.id);
      return <div key={app.id} className="fit-in relative flex flex-col items-center gap-1.5" style={stagger(i, 0.025)}>
        <button type="button" onClick={() => (edit ? app.tab && set((x) => toggleTab(x, app.id)) : onOpen(app.id))} className={`flex flex-col items-center gap-1.5 active:scale-95 ${edit ? "fit-wiggle" : ""}`} aria-label={edit ? (app.tab ? `${pinned ? "Unpin" : "Pin"} ${app.name}` : app.name) : `Open ${app.name}`} data-testid={`fit-apps-open-${app.id}`}>
          <AppTile app={app} size={60} /><span className="w-[72px] truncate text-center text-[12px] font-semibold">{app.name}</span></button>
        {edit && <button type="button" onClick={() => set((x) => removeApp(x, app.id))} aria-label={`Remove ${app.name}`} className="absolute -left-0.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full shadow" style={{ background: C.card, color: C.text, boxShadow: `0 0 0 1px ${C.line}` }} data-testid={`fit-apps-remove-${app.id}`}><Minus className="h-3.5 w-3.5" /></button>}
        {edit && app.tab && <span aria-hidden className="absolute -right-0.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full shadow" style={pinned ? { background: C.lime, color: C.ink } : { background: C.card, color: C.dim, boxShadow: `0 0 0 1px ${C.line}` }}>{pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}</span>}
        {!edit && pinned && <span aria-hidden className="absolute right-1.5 top-0 h-2.5 w-2.5 rounded-full" style={{ background: C.lime, boxShadow: `0 0 0 2px ${C.bg}` }} />}
      </div>; })}</div>
      : <p className="px-1 text-[14px]" style={{ color: C.dim }}>No apps yet. Add some from the library.</p>}

    <button type="button" onClick={() => setStore(true)} className="fit-in fit-shine mt-6 flex w-full items-center gap-4 rounded-[16px] p-4 text-left active:scale-[.98]" style={{ background: `linear-gradient(150deg, ${C.lime}, ${C.deep})`, color: C.ink }} data-testid="fit-apps-store">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px]" style={{ background: "rgba(255,255,255,.22)" }}><LayoutGrid className="h-6 w-6" /></span>
      <span className="min-w-0 flex-1"><span className="block text-[24px] leading-none" style={display}>Get more apps</span><span className="mt-1 block text-[13px] font-semibold opacity-80">{FIT_APPS.length} apps for training, mind, food and health</span></span>
      <ChevronRight className="h-6 w-6 shrink-0" /></button>

    {notYet.length > 0 && <><Title>You might like</Title>
      <div className="space-y-2">{notYet.slice(0, 3).map((app) => <StoreRow key={app.id} app={app} added={false} pinned={false} onAdd={() => { set((x) => addApp(x, app.id)); haptic("success"); say(`${app.name} added.`); }} onOpen={() => onOpen(app.id)} />)}</div></>}
    {store && <AppStore data={data} update={update} say={say} onClose={() => setStore(false)} onOpen={(id) => { setStore(false); onOpen(id); }} />}
  </Sheet>;
}

const Slot = ({ label }: { label: string; fixed?: boolean }) => <div className="grid place-items-center rounded-[12px] py-2 text-[11px] font-bold uppercase tracking-[.06em]" style={{ background: C.tint, color: C.lime }}>{label}</div>;

function StoreRow({ app, added, pinned, onAdd, onOpen, onPin }: { app: FitApp; added: boolean; pinned: boolean; onAdd: () => void; onOpen: () => void; onPin?: () => void }) {
  return <Card className="!p-3.5" testId={`fit-store-${app.id}`}><div className="flex items-center gap-3">
    <button type="button" onClick={onOpen} aria-label={`Open ${app.name}`} className="shrink-0 active:scale-95"><AppTile app={app} size={52} /></button>
    <div className="min-w-0 flex-1"><p className="flex items-center text-[17px] font-bold leading-tight">{app.name}{app.plus && <PlusTag />}</p><p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug" style={{ color: C.dim }}>{app.blurb}</p></div>
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <button type="button" onClick={added ? onOpen : onAdd} className="h-8 w-[70px] rounded-full text-[13px] font-bold" style={added ? { background: C.card2, color: C.lime } : { background: C.lime, color: C.ink }} data-testid={`fit-store-add-${app.id}`}>{added ? "Open" : "Add"}</button>
      {added && app.tab && onPin && <button type="button" onClick={onPin} aria-pressed={pinned} className="flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-semibold" style={{ color: pinned ? C.lime : C.dim }}>{pinned ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}{pinned ? "On tab bar" : "Tab bar"}</button>}
    </div></div></Card>;
}

/** The Arise Fit app library. */
export function AppStore({ data, update, say, onClose, onOpen }: { data: FitData; update: Update; say: (m: string) => void; onClose: () => void; onOpen: (id: FitAppId) => void }) {
  const a = appsOf(data.apps);
  const [q, setQ] = useState("");
  const set = (fn: (x: typeof a) => typeof a) => update((d) => ({ ...d, apps: fn(appsOf(d.apps)) }));
  const hit = (x: FitApp) => !q.trim() || `${x.name} ${x.blurb}`.toLowerCase().includes(q.trim().toLowerCase());
  const featured: FitAppId[] = ["yoga", "mind", "sleep", "hiit"];
  return <Sheet title="Arise Fit apps" onClose={onClose} testId="fit-store">
    <div className="relative mt-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: C.dim }} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search apps" className={`${inputCls} pl-10`} style={inputStyle} aria-label="Search apps" data-testid="fit-store-search" /></div>
    {!q && <div className="-mx-4 mt-3 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">{featured.map((id) => { const app = FIT_APP_BY_ID.get(id)!; const has = a.added.includes(id);
      return <button key={id} type="button" onClick={() => (has ? onOpen(id) : (set((x) => addApp(x, id)), haptic("success"), say(`${app.name} added.`)))} className="fit-in relative flex h-[150px] w-[230px] shrink-0 snap-start flex-col justify-end overflow-hidden rounded-[18px] p-4 text-left text-white active:scale-[.98]" style={{ background: `linear-gradient(150deg, ${app.tile[0]}, ${app.tile[1]})` }}>
        <span className="absolute right-3 top-3 opacity-90"><AppTile app={app} size={44} /></span>
        <span className="absolute inset-0" style={{ background: "radial-gradient(90% 70% at 100% 0%, rgba(255,255,255,.3), transparent 60%)" }} />
        <span className="relative text-[11px] font-bold uppercase tracking-[.14em] opacity-85">Featured</span>
        <span className="relative text-[26px] leading-none" style={display}>{app.name}</span>
        <span className="relative mt-1 line-clamp-2 text-[12px] leading-snug opacity-90">{app.blurb}</span>
        <span className="relative mt-2 inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: "rgba(255,255,255,.25)" }}>{has ? <><Check className="h-3.5 w-3.5" />Added</> : <><Plus className="h-3.5 w-3.5" />Add</>}</span>
      </button>; })}</div>}
    {FIT_APP_CATEGORIES.map((cat) => { const list = FIT_APPS.filter((x) => x.category === cat.id && hit(x)); if (!list.length) return null;
      return <div key={cat.id}><Title>{cat.name}</Title><div className="space-y-2">{list.map((app) => <StoreRow key={app.id} app={app} added={a.added.includes(app.id)} pinned={a.tabs.includes(app.id)}
        onAdd={() => { set((x) => addApp(x, app.id)); haptic("success"); say(`${app.name} added to your apps.`); }}
        onOpen={() => onOpen(app.id)}
        onPin={() => { const was = a.tabs.includes(app.id); const full = !was && a.tabs.length >= TAB_MAX; set((x) => toggleTab(x, app.id)); say(was ? `${app.name} is off the tab bar.` : full ? `${app.name} is on the tab bar, in place of ${FIT_APP_BY_ID.get(a.tabs[TAB_MAX - 1])?.name}.` : `${app.name} is on the tab bar.`); }} />)}</div></div>; })}
    {FIT_APPS.every((x) => !hit(x)) && <p className="mt-6 text-center text-[14px]" style={{ color: C.dim }}>No apps match "{q}".</p>}
  </Sheet>;
}

// ——— Guided apps: Yoga, Breathe, Mobility, Intervals, Couch to 5K ——————————————————————————————————
type GuidedKind = "yoga" | "mind" | "mobility" | "hiit" | "c25k";
const KIND: Record<GuidedKind, { title: string; cat: SessionCategory; art: ArtKind; color: string; noun: string; intro: string }> = {
  yoga: { title: "Yoga", cat: "yoga", art: "yoga", color: "#c084fc", noun: "flows", intro: "Guided flows, a pose for every step and a calm voice that talks you through." },
  mind: { title: "Breathe", cat: "meditation", art: "meditation", color: "#2dd4bf", noun: "sessions", intro: "Slow down your breathing, settle your mind, sleep better. Saved as mindful minutes in Apple Health." },
  mobility: { title: "Mobility", cat: "mobility", art: "mobility", color: "#4ade80", noun: "routines", intro: "Timed stretches for stiff hips, backs, shoulders and long days at a desk." },
  hiit: { title: "Intervals", cat: "hiit", art: "hiit", color: "#fb7185", noun: "workouts", intro: "Treadmill HIIT with every speed and incline called out, and interval timers for any workout." },
  c25k: { title: "Couch to 5K", cat: "c25k", art: "c25k", color: "#fbbf24", noun: "runs", intro: "Three short runs a week for nine weeks, from zero to 30 minutes nonstop." },
};
/** The session that suits now: time of day and what you did today. */
function pick(kind: GuidedKind, data: FitData, list: Session[], done: Set<string>): Session | undefined {
  const h = new Date().getHours();
  const trainedToday = data.workouts.some((w) => w.date.slice(0, 10) === new Date().toISOString().slice(0, 10) && w.exercises.length > 0);
  const id = kind === "yoga" ? (h < 11 ? "yoga-morning" : h >= 20 ? "yoga-bedtime" : trainedToday ? "yoga-lifter" : "yoga-flex")
    : kind === "mind" ? (h >= 20 || h < 4 ? "med-478" : h < 11 ? "med-focus" : "med-sigh")
    : kind === "mobility" ? (trainedToday ? "mob-postlift" : h >= 9 && h < 18 ? "mob-desk" : "mob-full")
    : kind === "hiit" ? "hiit-30-30" : nextC25K(done)?.id;
  return list.find((x) => x.id === id) ?? list[0];
}

export function GuidedApp({ kind, data, update, say, inline, onClose }: { kind: GuidedKind; data: FitData; update: Update; say: (m: string) => void; inline?: boolean; onClose: () => void }) {
  const k = KIND[kind];
  const list = sessionsIn(k.cat);
  const [len, setLen] = useState<"all" | "short" | "mid" | "long">("all");
  const [playing, setPlaying] = useState<Session | null>(null);
  const [poses, setPoses] = useState(false);
  const [timer, setTimer] = useState<IntervalTimer | null>(null);
  const prog = kind === "c25k" ? "c25k" : `session-${k.cat}`;
  const mine = data.workouts.filter((w) => w.programId === prog || (kind === "hiit" && w.programId === "session-timer"));
  const done = new Set(mine.map((w) => w.dayId!).filter(Boolean));
  const weekAgo = Date.now() - 7 * 864e5, monthAgo = Date.now() - 30 * 864e5;
  const week = mine.filter((w) => Date.parse(w.date) >= weekAgo).length;
  const minutes = Math.round(mine.filter((w) => Date.parse(w.date) >= monthAgo).reduce((a, w) => a + w.secs, 0) / 60);
  const days = new Set(mine.map((w) => dayKey(new Date(w.date))));
  // Days in a row with a session, counting back from today (or yesterday, if today isn't done yet).
  let streak = 0; { const d = new Date(); if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1); while (days.has(dayKey(d)) && streak < 366) { streak++; d.setDate(d.getDate() - 1); } }
  const today = pick(kind, data, list, done);
  const filtered = list.filter((x) => { const m = sessionMins(x); return len === "all" || (len === "short" ? m < 10 : len === "mid" ? m >= 10 && m <= 20 : m > 20); });
  const finish = (x: Session, secs: number) => {
    if (x.id.startsWith("timer-")) update((d) => ({ ...d, workouts: [...d.workouts, { id: uid(), date: new Date().toISOString(), name: x.name, programId: "session-timer", dayId: x.id, secs, exercises: [] }] }));
    else logSession(update, x, secs);
    setPlaying(null); haptic("success"); say("Saved to your history.");
  };
  const c25kDone = kind === "c25k" ? list.filter((x) => done.has(x.id)).length : 0;
  return <Sheet title={k.title} onClose={onClose} inline={inline} testId={`fit-guided-${kind}`}>
    <p className="-mt-1 mb-3 px-1 text-[14px]" style={{ color: C.dim }}>{k.intro}</p>
    {today && <CoverCard art={k.art} tall className="fit-in !p-5" testId={`fit-guided-${kind}-today`}>
      <span className="text-[12px] tracking-[.16em]" style={{ ...display, fontWeight: 700, color: k.color }}>{kind === "c25k" ? `${c25kDone} of ${list.length} runs done` : "Right now"}</span>
      <span className="mt-1 block text-[30px] leading-none" style={display}>{today.name}</span>
      <span className="mt-1 block text-[14px]" style={{ color: C.steel }}>{today.blurb} {sessionMins(today)} min.</span>
      <Btn className="relative z-[1] mt-4 w-full" onClick={() => { haptic("medium"); setPlaying(today); }} testId={`fit-guided-${kind}-start`}><Play className="h-5 w-5" fill="currentColor" />Start</Btn>
    </CoverCard>}
    {kind === "c25k" && !today && <Card className="!p-5 text-center"><Medal className="mx-auto h-10 w-10" style={{ color: k.color }} /><p className="mt-2 text-[28px] leading-none" style={display}>You ran a 5K.</p><p className="mt-1 text-[14px]" style={{ color: C.dim }}>Keep going: three 30-minute runs a week.</p></Card>}

    <div className="mt-3 grid grid-cols-3 gap-2">
      {([[String(week), "this week"], [fmtNum(minutes), "minutes, 30 days"], [String(streak), streak === 1 ? "day streak" : "day streak"]] as const).map(([v, l], i) => <Card key={l} className="!px-2 !py-3 text-center" style={stagger(i, 0.05)}><p className="text-[26px] leading-none tabular-nums" style={display}>{v}</p><p className="mt-1 text-[11px]" style={{ color: C.dim }}>{l}</p></Card>)}
    </div>

    {kind === "mind" && <><Title>Breathe now</Title><div className="grid grid-cols-3 gap-2">{([["med-sigh", "Calm", "3 min"], ["med-box", "Box", "5 min"], ["med-478", "Sleep", "3 min"]] as const).map(([id, l, t]) => { const x = SESSION_BY_ID.get(id); return x ? <button key={id} type="button" onClick={() => setPlaying(x)} className="flex flex-col items-center gap-1 rounded-[14px] py-4 active:scale-95" style={{ background: "linear-gradient(160deg, rgba(45,212,191,.22), rgba(45,212,191,.06))", boxShadow: "inset 0 0 0 1px rgba(45,212,191,.35)" }}>
      <Wind className="h-6 w-6" style={{ color: "#2dd4bf" }} /><span className="text-[18px] leading-none" style={display}>{l}</span><span className="text-[11px]" style={{ color: C.dim }}>{t}</span></button> : null; })}</div></>}

    {kind === "hiit" && <IntervalTimers data={data} update={update} onPlay={(t) => setPlaying(timerSession(t))} onEdit={setTimer} />}

    <Title right={kind !== "c25k" && <div className="flex gap-1 rounded-full p-0.5" style={{ background: C.card2 }}>{([["all", "All"], ["short", "<10"], ["mid", "10–20"], ["long", "20+"]] as const).map(([id, l]) => <button key={id} type="button" onClick={() => setLen(id)} aria-pressed={len === id} className="h-7 rounded-full px-2.5 text-[12px] font-semibold" style={len === id ? { background: C.card, color: C.text } : { color: C.dim }}>{l}</button>)}</div>}>{kind === "hiit" ? "Treadmill HIIT" : `All ${k.noun}`}</Title>
    <div className="space-y-2">{filtered.map((x, i) => <Card key={x.id} onClick={() => setPlaying(x)} className="!p-3.5" style={stagger(i, 0.03)} testId={`fit-session-${x.id}`}>
      <div className="flex items-center gap-3">
        {kind === "c25k" ? <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] text-[18px]" style={{ ...display, ...(done.has(x.id) ? { background: C.lime, color: C.ink } : { background: C.card2 }) }}>{done.has(x.id) ? <Check className="h-5 w-5" strokeWidth={3} /> : `${x.week}.${x.day}`}</span>
          : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] text-center" style={{ background: `linear-gradient(150deg, ${k.color}33, ${k.color}11)` }}><span className="text-[18px] leading-none tabular-nums" style={{ ...display, color: k.color }}>{sessionMins(x)}<span className="block text-[9px] tracking-[.1em]">MIN</span></span></span>}
        <div className="min-w-0 flex-1"><p className="truncate text-[18px] leading-tight" style={display}>{x.name}</p><p className="line-clamp-2 text-[12.5px] leading-snug" style={{ color: C.dim }}>{x.blurb}</p></div>
        <span className="flex shrink-0 flex-col items-end gap-1"><span className="text-[10px] uppercase tracking-[.08em]" style={{ color: C.dim }}>{kind === "c25k" ? `${sessionMins(x)} min` : x.level}</span>{done.has(x.id) && kind !== "c25k" && <Check className="h-4 w-4" style={{ color: C.green }} />}</span>
      </div></Card>)}</div>
    {!filtered.length && <p className="px-1 text-[14px]" style={{ color: C.dim }}>Nothing that long. Try another length.</p>}

    {kind === "yoga" && <><button type="button" onClick={() => setPoses(!poses)} className="mt-5 flex w-full items-center justify-between rounded-[12px] px-4 py-3.5 text-left" style={{ background: C.card }} aria-expanded={poses}><span className="text-[17px]" style={display}>Pose guide</span><ChevronDown className="h-5 w-5 transition-transform" style={{ transform: poses ? "rotate(180deg)" : "none", color: C.dim }} /></button>
      {poses && <PoseGuide list={list} />}</>}

    {mine.length > 0 && <><Title>Recent</Title><Card className="!p-2"><ul>{[...mine].reverse().slice(0, 6).map((w, i) => <li key={w.id} className="flex items-center gap-3 px-2 py-2.5 text-[14px]" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}>
      <Check className="h-4 w-4 shrink-0" style={{ color: k.color }} /><span className="min-w-0 flex-1 truncate font-semibold">{w.name}</span>
      <span style={{ color: C.dim }}>{new Date(w.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {Math.max(1, Math.round(w.secs / 60))} min</span></li>)}</ul></Card></>}
    {playing && <SessionPlayer session={playing} onClose={() => setPlaying(null)} onDone={(secs) => finish(playing, secs)} />}
    {timer && <TimerEditor timer={timer} update={update} onClose={() => setTimer(null)} onPlay={(t) => { setTimer(null); setPlaying(timerSession(t)); }} />}
  </Sheet>;
}

/** Every pose in the yoga flows, with how to do it. */
function PoseGuide({ list }: { list: Session[] }) {
  const poses = useMemo(() => { const m = new Map<string, string>(); for (const s of list) for (const p of s.phases) { const name = p.name.replace(/, (left|right)$/i, ""); if (p.cue && !m.has(name)) m.set(name, p.cue); } return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])); }, [list]);
  return <Card className="mt-2 !p-2" testId="fit-pose-guide"><ul>{poses.map(([n, cue], i) => <li key={n} className="px-2 py-2.5" style={{ borderTop: i ? `1px solid ${C.line}` : undefined }}><p className="text-[15px] font-semibold">{n}</p><p className="text-[13px]" style={{ color: C.dim }}>{cue}</p></li>)}</ul></Card>;
}

function IntervalTimers({ data, update, onPlay, onEdit }: { data: FitData; update: Update; onPlay: (t: IntervalTimer) => void; onEdit: (t: IntervalTimer) => void }) {
  const mine = data.timers ?? [];
  const row = (t: IntervalTimer, own: boolean) => <Card key={t.id} className="!p-3" testId={`fit-timer-${t.id}`}><div className="flex items-center gap-3">
    <button type="button" onClick={() => onPlay(t)} aria-label={`Start ${t.name}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: C.lime, color: C.ink }}><Play className="h-5 w-5" fill="currentColor" /></button>
    <div className="min-w-0 flex-1"><p className="truncate text-[16px] font-bold">{t.name}</p><p className="text-[12px]" style={{ color: C.dim }}>{t.sets > 1 ? `${t.sets} × ` : ""}{t.rounds} × {t.work}s on{t.rest ? ` / ${t.rest}s off` : ""} · {Math.round(timerSecs(t) / 60)} min</p></div>
    <button type="button" onClick={() => onEdit(own ? t : { ...t, id: uid(), name: `${t.name} (mine)` })} aria-label={own ? `Edit ${t.name}` : `Change ${t.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: C.card2 }}><Pencil className="h-4 w-4" /></button>
  </div></Card>;
  return <><Title right={<button type="button" onClick={() => onEdit({ id: uid(), name: "My timer", warm: 120, work: 30, rest: 15, rounds: 8, sets: 1, setRest: 60, cool: 60 })} className="flex items-center gap-1 text-[14px] font-semibold" style={{ color: C.lime }} data-testid="fit-timer-new"><Plus className="h-4 w-4" />New</button>}>Interval timers</Title>
    <div className="space-y-2">{mine.map((t) => row(t, true))}{TIMER_PRESETS.map((t) => row(t, false))}</div></>;
}

function TimerEditor({ timer, update, onClose, onPlay }: { timer: IntervalTimer; update: Update; onClose: () => void; onPlay: (t: IntervalTimer) => void }) {
  const [t, setT] = useState(timer);
  const exists = !!timer.id && !timer.id.startsWith("preset-");
  const num = (k: keyof IntervalTimer, label: string, step: number, min: number, max: number, unit = "s") => <div className="flex items-center justify-between gap-2 py-2">
    <span className="text-[15px] font-semibold">{label}</span>
    <div className="flex items-center gap-2"><button type="button" aria-label={`Less ${label}`} onClick={() => setT({ ...t, [k]: Math.max(min, (t[k] as number) - step) })} className="grid h-9 w-9 place-items-center rounded-full" style={{ background: C.card2 }}><Minus className="h-4 w-4" /></button>
      <span className="w-16 text-center text-[18px] tabular-nums" style={display}>{unit === "s" ? fmtDur(t[k] as number) : t[k]}</span>
      <button type="button" aria-label={`More ${label}`} onClick={() => setT({ ...t, [k]: Math.min(max, (t[k] as number) + step) })} className="grid h-9 w-9 place-items-center rounded-full" style={{ background: C.card2 }}><Plus className="h-4 w-4" /></button></div></div>;
  const save = () => update((d) => ({ ...d, timers: [...(d.timers ?? []).filter((x) => x.id !== t.id), t].slice(-30) }));
  return <Sheet title="Interval timer" onClose={onClose} testId="fit-timer-editor">
    <Field label="Name"><input value={t.name} onChange={(e) => setT({ ...t, name: e.target.value.slice(0, 40) })} className={inputCls} style={inputStyle} /></Field>
    <Card className="mt-3 !px-4 !py-1">{num("warm", "Warm up", 30, 0, 1800)}{num("work", "Work", 5, 5, 3600)}{num("rest", "Rest", 5, 0, 1800)}{num("rounds", "Rounds", 1, 1, 100, "x")}{num("sets", "Sets", 1, 1, 10, "x")}{t.sets > 1 && num("setRest", "Rest between sets", 15, 0, 900)}{num("cool", "Cool down", 30, 0, 1800)}</Card>
    <p className="mt-2 px-1 text-[14px] font-semibold">Total {fmtDur(timerSecs(t))}</p>
    <div className="mt-4 grid grid-cols-2 gap-2"><Btn kind="soft" onClick={() => { save(); onClose(); }}>Save</Btn><Btn onClick={() => { save(); onPlay(t); }}><Play className="h-5 w-5" fill="currentColor" />Start</Btn></div>
    {exists && <button type="button" onClick={() => { update((d) => ({ ...d, timers: (d.timers ?? []).filter((x) => x.id !== t.id) })); onClose(); }} className="mt-3 flex h-11 w-full items-center justify-center gap-2 text-[14px] font-semibold" style={{ color: C.red }}><Trash2 className="h-4 w-4" />Delete timer</button>}
  </Sheet>;
}

// ——— Water ————————————————————————————————————————————————————————————————————————————————————
export function WaterApp({ data, update, say, inline, onClose }: { data: FitData; update: Update; say: (m: string) => void; inline?: boolean; onClose: () => void }) {
  const kg = data.profile.units === "kg";
  const today = dayKey();
  const ml = data.water[today] ?? 0, goal = data.profile.waterGoalMl;
  const show = (x: number) => (kg ? `${fmtNum(Math.round(x))} ml` : `${fmtNum(Math.round(x / 29.5735))} oz`);
  const sizes: [string, number][] = kg ? [["Glass", 250], ["Mug", 350], ["Bottle", 500], ["Big bottle", 1000]] : [["Glass", 237], ["Can", 355], ["Bottle", 500], ["Big bottle", 946]];
  const [last, setLast] = useState<number[]>([]);
  const add = (x: number) => { haptic("light"); setLast((l) => [...l, x].slice(-10)); update((d) => ({ ...d, water: { ...d.water, [today]: Math.max(0, Math.round((d.water[today] || 0) + x)) } })); if (ml < goal && ml + x >= goal) { haptic("success"); say("Water goal reached. Nice."); } };
  const undo = () => { const x = last[last.length - 1]; if (!x) return; setLast((l) => l.slice(0, -1)); update((d) => ({ ...d, water: { ...d.water, [today]: Math.max(0, Math.round((d.water[today] || 0) - x)) } })); };
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const k2 = dayKey(d); return { k: k2, v: data.water[k2] ?? 0, l: d.toLocaleDateString(undefined, { weekday: "narrow" }) }; });
  const pct = Math.min(1, ml / goal);
  const setGoal = (g: number) => update((d) => ({ ...d, profile: { ...d.profile, waterGoalMl: Math.min(8000, Math.max(500, Math.round(g))) } }));
  return <Sheet title="Water" onClose={onClose} inline={inline} testId="fit-water">
    <Card className="!p-5"><div className="flex items-center gap-5">
      <div className="relative h-[150px] w-[96px] shrink-0 overflow-hidden rounded-b-[28px] rounded-t-[12px]" style={{ background: C.card2, boxShadow: `inset 0 0 0 2px ${C.line}` }} role="img" aria-label={`${Math.round(pct * 100)}% of today's water goal`}>
        <div className="absolute inset-x-0 bottom-0 transition-all duration-700" style={{ height: `${pct * 100}%`, background: "linear-gradient(180deg,#60a5fa,#1d4ed8)" }}><div className="absolute inset-x-0 top-0 h-2 opacity-60" style={{ background: "radial-gradient(60% 100% at 50% 0%, #bfdbfe, transparent)" }} /></div>
        <Droplets className="absolute left-1/2 top-3 h-6 w-6 -translate-x-1/2" style={{ color: pct > 0.85 ? "#fff" : "#60a5fa" }} /></div>
      <div className="min-w-0 flex-1"><p className="text-[12px] tracking-[.14em]" style={{ ...display, color: C.dim }}>Today</p>
        <p className="text-[40px] leading-none tabular-nums" style={display}>{show(ml)}</p>
        <p className="mt-1 text-[14px]" style={{ color: C.steel }}>of {show(goal)} · {ml >= goal ? "goal reached" : `${show(goal - ml)} to go`}</p>
        <button type="button" onClick={undo} disabled={!last.length} className="mt-3 flex items-center gap-1 text-[13px] font-semibold disabled:opacity-40" style={{ color: C.dim }}><Undo2 className="h-4 w-4" />Undo</button></div>
    </div></Card>
    <div className="mt-3 grid grid-cols-4 gap-2">{sizes.map(([n, x]) => <button key={n} type="button" onClick={() => add(x)} className="flex flex-col items-center gap-1 rounded-[14px] py-3 active:scale-95" style={{ background: C.card, boxShadow: `inset 0 0 0 1px ${C.line}` }} data-testid={`fit-water-${n.toLowerCase().replace(/ /g, "-")}`}>
      <Plus className="h-5 w-5" style={{ color: "#3b82f6" }} /><span className="text-[13px] font-bold">{n}</span><span className="text-[11px]" style={{ color: C.dim }}>{show(x)}</span></button>)}</div>
    <Title>This week</Title>
    <Card className="!p-4"><div className="flex h-24 items-end gap-2">{week.map((d) => <div key={d.k} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
      <div className="fit-bar w-full rounded-t-[5px]" style={{ height: `${Math.max(4, Math.min(100, (d.v / goal) * 100))}%`, background: d.v >= goal ? "linear-gradient(180deg,#60a5fa,#1d4ed8)" : "#93c5fd", opacity: d.v ? 1 : 0.35, transformOrigin: "bottom" }} />
      <span className="text-[10px]" style={{ color: d.k === today ? C.text : C.dim }}>{d.l}</span></div>)}</div>
      <p className="mt-2 text-[12px]" style={{ color: C.dim }}>{week.filter((d) => d.v >= goal).length} of 7 days at goal</p></Card>
    <Title>Daily goal</Title>
    <Card className="!p-4"><div className="flex items-center justify-between">
      <Btn kind="soft" className="!min-h-10 !px-4" onClick={() => setGoal(goal - (kg ? 250 : 237))}>−</Btn>
      <p className="text-[26px] tabular-nums" style={display}>{show(goal)}</p>
      <Btn kind="soft" className="!min-h-10 !px-4" onClick={() => setGoal(goal + (kg ? 250 : 237))}>+</Btn></div>
      <p className="mt-2 text-[12px]" style={{ color: C.dim }}>A good start is about {kg ? "35 ml per kg" : "half an ounce per pound"} of body weight, more on training days and in the heat.</p></Card>
  </Sheet>;
}

// ——— Steps ————————————————————————————————————————————————————————————————————————————————————
export function StepsApp({ data, update, say, inline, onClose }: { data: FitData; update: Update; say: (m: string) => void; inline?: boolean; onClose: () => void }) {
  const cached = useHealth(update);
  const [fresh, setFresh] = useState<HealthSnapshot | null>(null);
  const snap = fresh ?? cached;
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState(healthConnected());
  const goal = data.profile.stepsGoal;
  const native = isNativeApp();
  const today = dayKey();
  const steps = snap?.steps[today] ?? 0;
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); const k2 = dayKey(d); return { k: k2, v: snap?.steps[k2] ?? 0, l: d.toLocaleDateString(undefined, { weekday: "narrow" }) }; });
  const week = days.slice(-7);
  const avg = Math.round(week.reduce((a, d) => a + d.v, 0) / 7);
  let streak = 0; for (let i = days.length - 1; i >= 0; i--) { if (days[i].v >= goal) streak++; else if (i === days.length - 1) continue; else break; }
  const km = steps * (data.profile.heightCm ? data.profile.heightCm * 0.00415 : 0.75) / 1000;
  const connect = async () => { setBusy(true); try { await connectHealth(); setLinked(true); setFresh(await readHealth()); say("Connected. Your steps come from Apple Health."); } catch (e: any) { say(e.message); } finally { setBusy(false); } };
  return <Sheet title="Steps" onClose={onClose} inline={inline} testId="fit-steps-app">
    {!linked || !native ? <Card className="!p-5 text-center"><Footprints className="mx-auto h-10 w-10" style={{ color: "#22c55e" }} />
      <p className="mt-2 text-[26px] leading-none" style={display}>Steps from Apple Health</p>
      <p className="mt-2 text-[14px]" style={{ color: C.steel }}>{native ? "Your iPhone and Apple Watch count your steps. Connect Apple Health to see them here." : "Steps come from Apple Health in the Arise Fit iPhone app."}</p>
      {native && <Btn className="mt-4 w-full" onClick={() => void connect()} disabled={busy}>{busy ? "Connecting…" : "Connect Apple Health"}</Btn>}</Card>
      : <Card className="!p-5"><div className="flex items-center gap-5">
          <Ring value={steps} goal={goal} size={130} stroke={12} color="#22c55e"><div><p className="text-[30px] leading-none tabular-nums" style={display}>{fmtNum(steps)}</p><p className="mt-0.5 text-[10px] uppercase tracking-[.08em]" style={{ color: C.dim }}>steps</p></div></Ring>
          <div className="min-w-0 flex-1 space-y-2">
            <div><p className="text-[20px] leading-none tabular-nums" style={display}>{steps >= goal ? "Goal hit" : fmtNum(goal - steps)}</p><p className="text-[12px]" style={{ color: C.dim }}>{steps >= goal ? `of ${fmtNum(goal)}` : "to your goal"}</p></div>
            <div><p className="text-[20px] leading-none tabular-nums" style={display}>{data.profile.units === "kg" ? `${km.toFixed(1)} km` : `${(km * 0.621).toFixed(1)} mi`}</p><p className="text-[12px]" style={{ color: C.dim }}>about</p></div>
            {snap?.active[today] ? <div><p className="text-[20px] leading-none tabular-nums" style={display}>{fmtNum(snap.active[today])}</p><p className="text-[12px]" style={{ color: C.dim }}>active calories</p></div> : null}
          </div></div></Card>}
    <div className="mt-3 grid grid-cols-2 gap-2"><Card className="!p-3 text-center"><p className="text-[24px] leading-none tabular-nums" style={display}>{fmtNum(avg)}</p><p className="mt-1 text-[11px]" style={{ color: C.dim }}>daily average, 7 days</p></Card>
      <Card className="!p-3 text-center"><p className="text-[24px] leading-none tabular-nums" style={display}>{streak}</p><p className="mt-1 text-[11px]" style={{ color: C.dim }}>days in a row at goal</p></Card></div>
    <Title>Two weeks</Title>
    <Card className="!p-4"><div className="flex h-28 items-end gap-1">{days.map((d) => <div key={d.k} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
      <div className="fit-bar w-full rounded-t-[4px]" style={{ height: `${Math.max(3, Math.min(100, (d.v / Math.max(goal * 1.4, ...days.map((x) => x.v))) * 100))}%`, background: d.v >= goal ? "#22c55e" : C.card2, transformOrigin: "bottom" }} />
      <span className="text-[9px]" style={{ color: d.k === today ? C.text : C.dim }}>{d.l}</span></div>)}</div></Card>
    <Title>Daily goal</Title>
    <div className="grid grid-cols-4 gap-2">{[6000, 8000, 10000, 12000].map((g) => <Btn key={g} kind={goal === g ? "primary" : "soft"} className="!px-1 text-[14px]" onClick={() => update((d) => ({ ...d, profile: { ...d.profile, stepsGoal: g } }))}>{g / 1000}k</Btn>)}</div>
  </Sheet>;
}

// ——— Recovery ——————————————————————————————————————————————————————————————————————————————————
export function ReadinessRing({ data, size = 110 }: { data: FitData; size?: number }) {
  const r = readiness(data);
  const color = r.score >= 80 ? "#22c55e" : r.score >= 60 ? "#84cc16" : r.score >= 40 ? "#f59e0b" : "#ef4444";
  return <Ring value={r.score} goal={100} size={size} stroke={Math.round(size / 10)} color={color}><div><p className="leading-none tabular-nums" style={{ ...display, fontSize: size * 0.3 }}>{r.score}</p><p className="mt-0.5 text-[10px] uppercase tracking-[.08em]" style={{ color: C.dim }}>ready</p></div></Ring>;
}
export function RecoveryApp({ data, inline, onClose, onBodyMap, onSleep, onYoga }: { data: FitData; inline?: boolean; onClose: () => void; onBodyMap: () => void; onSleep: () => void; onYoga: () => void }) {
  const r = readiness(data);
  const rec = useMemo(() => recovery(data.workouts), [data.workouts]);
  return <Sheet title="Recovery" onClose={onClose} inline={inline} testId="fit-recovery">
    <Card className="!p-5" testId="fit-readiness"><div className="flex items-center gap-4"><ReadinessRing data={data} size={120} />
      <div className="min-w-0 flex-1"><p className="text-[12px] tracking-[.14em]" style={{ ...display, color: C.dim }}>Readiness today</p><p className="mt-0.5 text-[28px] leading-none" style={display}>{r.word}</p><p className="mt-1.5 text-[13px] leading-snug" style={{ color: C.steel }}>{r.advice}</p></div></div>
      <div className="mt-4 space-y-2">{r.parts.map((p) => <div key={p.label}><div className="flex items-center gap-2 text-[13px]"><span className="w-[120px] shrink-0 font-semibold">{p.label}</span>
        <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: C.track }}><span className="fit-bar block h-full rounded-full" style={{ width: `${(p.got / p.of) * 100}%`, background: C.lime }} /></span>
        <span className="w-10 text-right tabular-nums" style={{ color: C.dim }}>{p.got}/{p.of}</span></div><p className="ml-[128px] text-[11px]" style={{ color: C.dim }}>{p.note}</p></div>)}</div></Card>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <Card onClick={onSleep} className="!p-3.5"><Moon className="h-5 w-5" style={{ color: "#818cf8" }} /><p className="mt-2 text-[17px] leading-tight" style={display}>Sleep</p><p className="text-[12px]" style={{ color: C.dim }}>The biggest part of recovery</p></Card>
      <Card onClick={onYoga} className="!p-3.5"><Flower2 className="h-5 w-5" style={{ color: "#c084fc" }} /><p className="mt-2 text-[17px] leading-tight" style={display}>Recovery yoga</p><p className="text-[12px]" style={{ color: C.dim }}>Easy flows for sore days</p></Card>
    </div>
    <Card className="mt-3 flex items-center gap-4 !py-3" onClick={onBodyMap} testId="fit-recovery-body">
      <MiniBody rec={rec} height={150} />
      <div className="min-w-0 flex-1"><p className="text-[12px] tracking-[.14em]" style={{ ...display, color: C.dim }}>Muscles</p>
        <p className="text-[24px] leading-none" style={display}>{BODY_PARTS.filter((p) => rec[p].pct >= 85).length} of {BODY_PARTS.length} fresh</p>
        <div className="mt-2 space-y-1.5">{[...BODY_PARTS].sort((a, b) => rec[a].pct - rec[b].pct).slice(0, 4).map((p) => <div key={p} className="flex items-center gap-2 text-[12px]">
          <span className="w-[68px] shrink-0 truncate font-semibold">{PART_NAME[p]}</span>
          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: C.track }}><span className="block h-full rounded-full" style={{ width: `${rec[p].pct}%`, background: recColor(rec[p].pct) }} /></span>
          <span className="w-8 text-right tabular-nums" style={{ color: C.dim }}>{rec[p].pct}%</span></div>)}</div>
        <p className="mt-2 flex items-center gap-1 text-[13px] font-semibold" style={{ color: C.lime }}>Open body map <ChevronRight className="h-4 w-4" /></p></div></Card>
    <p className="mt-4 px-1 text-[12px]" style={{ color: C.dim }}>Readiness weighs last night's sleep, this week's sleep debt, how recovered your muscles are and how much you trained in the last three days. A guide, not a medical measure.</p>
  </Sheet>;
}

// ——— Friends ———————————————————————————————————————————————————————————————————————————————————
export function FriendsApp({ token, inline, onClose, onCircle, onBuddy }: { token: string | null; inline?: boolean; onClose: () => void; onCircle: () => void; onBuddy: () => void }) {
  return <Sheet title="Friends" onClose={onClose} inline={inline} testId="fit-friends">
    <p className="-mt-1 mb-1 px-1 text-[14px]" style={{ color: C.dim }}>Training is easier together. Share your week with a circle of friends, or get matched with a buddy at your level.</p>
    <CircleCard token={token} onOpen={onCircle} />
    <BuddyCard token={token} onOpen={onBuddy} />
    <Card className="mt-3 flex items-start gap-3 !p-4"><Sparkles className="mt-0.5 h-5 w-5 shrink-0" style={{ color: C.lime }} /><p className="text-[13px] leading-snug" style={{ color: C.steel }}>Invite friends with a link from your circle. You can leave a circle or end a buddy match at any time.</p></Card>
  </Sheet>;
}
