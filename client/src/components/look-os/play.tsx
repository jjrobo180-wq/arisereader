// The ten interactive Arise Duo looks: Spinner, Bubbles, Lava, Marbles, Synth, Jelly, Orrery, Dial,
// Ferro and Slots. Each Home is built around a toy you can play with (toys.tsx) that is also a way in:
// flick the spinner and tap an arm, pop a bubble to finish a task, turn the dial to an app, pull the
// lever to pick what's next. Sounds and taps can be switched off from the speaker on Home (feel.ts).
import { useState, type CSSProperties, type ReactNode } from "react";
import { themeVars, type NotesTheme } from "@shared/notesThemes";
import type { AgendaDay, LookTask } from "@/components/HubLook";
import { Agenda, Ico, Month } from "./systems";
import { BubbleWrap, Ferro, Jelly, LavaLamp, MarbleJar, Orrery, RadioDial, Slots, Spinner, SynthKeys } from "./toys";
import { buzz, play, setFeel, useFeel } from "./feel";
import "./play.css";

export const PLAY_LOOKS = new Set<string>(["spinner", "bubbles", "lava", "marbles", "synth", "jelly", "orrery", "dial", "ferro", "slots"]);
type Screen = "home" | "tasks" | "calendar" | "notes";
export type PlayProps = {
  look: NotesTheme; name: string; dateLabel: string; hi: string; days: AgendaDay[]; tasks: LookTask[]; open: LookTask[];
  notes: { id: string; title: string; body: string; locked?: boolean }[];
  toggle: (id: string) => void; openTask: (id: string) => void; go: (s: Screen) => void; openApps: () => void; add: (title?: string) => void; onYou: () => void;
  list: ReactNode; cal: ReactNode;
};

/** Sound and vibration on or off, on this device. */
export function FeelToggle() {
  const f = useFeel();
  return <div className="pl-feel" role="group" aria-label="Sound and vibration">
    <button type="button" aria-pressed={f.sound} aria-label={f.sound ? "Sound on" : "Sound off"} onClick={() => { setFeel("sound", !f.sound); if (!f.sound) window.setTimeout(() => play.click(), 30); }}>
      <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9v6h4l5 4V5L8 9z" />{f.sound ? <path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}</svg></button>
    <button type="button" aria-pressed={f.haptics} aria-label={f.haptics ? "Vibration on" : "Vibration off"} onClick={() => { setFeel("haptics", !f.haptics); if (!f.haptics) window.setTimeout(() => buzz("medium"), 30); }}>
      <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="3" width="8" height="18" rx="2" />{f.haptics ? <path d="M4 8v8M20 8v8M1 10v4M23 10v4" /> : <path d="M3 3l18 18" />}</svg></button>
  </div>;
}

export function PlayCal({ look, days, big }: { look: NotesTheme; days: AgendaDay[]; big?: boolean }) {
  const today = days[0]; if (!today) return <p className="los-none">Nothing coming up.</p>;
  const limit = big ? 10 : 3;
  if (look.id === "orrery" || look.id === "lava" || look.id === "ferro") return <div className={`pl-cal pl-cal-${look.id}`}><Agenda days={days} limit={limit} /></div>;
  if (look.id === "synth" || look.id === "slots" || look.id === "spinner") return <div className={`pl-cal pl-cal-${look.id}`}><div className="pl-week">{days.slice(0, 7).map((d, i) => <span key={d.date} data-on={i === 0 || undefined} data-busy={d.items.length > 0 || undefined}><small>{d.weekday}</small><b>{d.day}</b></span>)}</div><Agenda days={days} limit={limit} /></div>;
  return <div className={`pl-cal pl-cal-${look.id}`}><Month days={days} cls="" /><Agenda days={days} limit={limit} /></div>;
}

export function PlayHome(p: PlayProps) {
  const next = p.open[0], done = p.tasks.length - p.open.length, pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0;
  const today = p.days[0], todayCount = today?.items.length ?? 0;
  const [kick, setKick] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const first = p.name ? `, ${p.name}` : "";
  const head = (title: ReactNode = <>{p.hi}{first}</>, sub: ReactNode = p.dateLabel) => <header className="pl-head"><div><small>{sub}</small><h1>{title}</h1></div><FeelToggle /></header>;
  const finish = (id: string) => { p.toggle(id); play.chime(); buzz("success"); };
  const nextCard = (label = "Done", t: LookTask | undefined = next) => <section className="pl-next">{t ? <><small>Up next</small><button type="button" className="pl-nexttitle" onClick={() => p.openTask(t.id)}>{t.title}</button>{t.dueLabel && <em>{t.dueLabel}</em>}<button type="button" className="pl-btn" onClick={() => { finish(t.id); setKick((k) => k + 1); }}>{label}</button></>
    : <><small>All clear</small><b className="pl-nexttitle">Nothing waiting</b><button type="button" className="pl-btn" onClick={() => p.add()}>New task</button></>}</section>;
  const pad = (...nodes: ReactNode[]) => <div className="pl-pad">{nodes}</div>;
  const notesMini = <button type="button" className="pl-notes" onClick={() => p.go("notes")}>{p.notes.length ? p.notes.slice(0, 2).map((n) => <span key={n.id}><b>{n.title || "Untitled"}</b><small>{n.locked ? "Locked" : n.body.split("\n")[0]}</small></span>) : <span><b>No notes yet</b><small>Tap to write one</small></span>}</button>;
  switch (p.look.id) {
    case "spinner": return <div className="pl pl-spinner">{head()}
      <div className="pl-stage"><Spinner kick={kick} center={<b>{p.open.length}</b>} arms={[{ label: "tasks", value: p.open.length, onOpen: () => p.go("tasks") }, { label: "today", value: todayCount, onOpen: () => p.go("calendar") }, { label: "notes", value: p.notes.length, onOpen: () => p.go("notes") }]} /></div>
      <p className="pl-hint">Flick to spin. Tap an arm to open it.</p>{pad(nextCard("Done · spin it"), p.cal, p.list)}</div>;
    case "bubbles": return <div className="pl pl-bubbles">{head()}
      <p className="pl-hint">Pop a bubble to finish its task. The empty ones are just for fun.</p>
      <div className="pl-stage"><BubbleWrap items={p.open.slice(0, 16)} onPop={(id) => finish(id)} /></div>{pad(p.cal, notesMini)}</div>;
    case "lava": return <div className="pl pl-lava">{head()}
      <div className="pl-lavarow"><LavaLamp count={p.open.length} /><div className="pl-stats"><button type="button" onClick={() => p.go("tasks")}><b>{p.open.length}</b><small>open</small></button><button type="button" onClick={() => p.go("calendar")}><b>{todayCount}</b><small>today</small></button><div><b>{pct}%</b><small>done</small></div></div></div>
      <p className="pl-hint">Touch the lamp to warm it up.</p>{pad(nextCard(), p.list, p.cal)}</div>;
    case "marbles": return <div className="pl pl-marbles">{head()}
      <div className="pl-stage pl-jarstage"><MarbleJar items={p.open.slice(0, 18).map((t) => ({ id: t.id, title: t.title, color: t.color }))} onTap={p.openTask} /></div>
      <p className="pl-hint">One marble for each open task. Shake the jar, or tilt your phone.</p>{pad(nextCard(), p.list, p.cal)}</div>;
    case "synth": return <div className="pl pl-synth">{head(<>{p.hi}{first}</>, "▶ Now playing: your day")}
      <SynthKeys />
      <div className="pl-row"><button type="button" className="pl-btn" onClick={() => { play.chord(); buzz("success"); }}>Play my day</button><span className="pl-bpm">{p.open.length} tracks · {pct}% mixed</span></div>
      {pad(nextCard("Drop it"), p.list, p.cal)}</div>;
    case "jelly": return <div className="pl pl-jelly">{head()}
      <div className="pl-jellies"><Jelly label="tasks" value={p.open.length} color="#ff6fa5" pitch={1} onOpen={() => p.go("tasks")} /><Jelly label="today" value={todayCount} color="#8b7bff" pitch={1.25} onOpen={() => p.go("calendar")} /><Jelly label="notes" value={p.notes.length} color="#38d6a8" pitch={1.5} onOpen={() => p.go("notes")} /><Jelly label="add" value="+" color="#ffb347" pitch={0.8} onOpen={() => p.add()} /></div>
      <p className="pl-hint">Squish one.</p>{pad(nextCard(), p.list, p.cal)}</div>;
    case "orrery": return <div className="pl pl-orrery">{head()}
      <div className="pl-stage"><Orrery days={p.days.slice(0, 7).map((d) => ({ label: `${d.weekday} ${d.day}`, count: d.items.length, title: d.items.map((x) => x.title).join(", ") }))} /></div>
      <p className="pl-hint">Today is the sun; each planet is a day this week. Spin the system.</p>{pad(nextCard(), p.list, p.cal)}</div>;
    case "dial": { const items: [string, () => void][] = [["Tasks", () => p.go("tasks")], ["Days", () => p.go("calendar")], ["Notes", () => p.go("notes")], ["Apps", p.openApps], ["Add", () => p.add()], ["You", p.onYou]];
      return <div className="pl pl-dial">{head()}<RadioDial items={items.map((x) => x[0])} onSelect={(i) => items[i][1]()} /><p className="pl-hint">Turn the knob to a station, then press the middle.</p>{pad(nextCard(), p.cal, p.list)}</div>; }
    case "ferro": return <div className="pl pl-ferro">{head()}
      <div className="pl-stage"><Ferro onTap={() => p.go("tasks")}><b>{p.open.length}</b><small>open</small></Ferro></div>
      <p className="pl-hint">Move your finger near it.</p>{pad(nextCard(), p.list, p.cal)}</div>;
    case "slots": { const chosen = p.open.find((t) => t.id === pick);
      return <div className="pl pl-slots">{head()}
        <Slots items={p.open.map((t) => ({ id: t.id, title: t.title }))} onPick={(id) => setPick(id)} />
        <p className="pl-hint">Can't decide? Pull the lever and the machine picks your next task.</p>
        {pad(chosen ? nextCard("Done", chosen) : nextCard(), p.list, p.cal)}</div>; }
    default: return null;
  }
}

/** Getting around, with a click and a tap you can feel. */
export function PlayDock({ look, screen, go, openApps, add, you, initial, off = [], inApp = false }: { look: NotesTheme; screen: Screen | null; go: (s: Screen) => void; openApps: () => void; add: () => void; you: () => void; initial: string; off?: string[]; inApp?: boolean }) {
  const nav: [string, string][] = [["home", "Home"], ["tasks", "Tasks"], ["add", "Add"], ["calendar", "Calendar"], ["notes", "Notes"], ["apps", "Apps"], ["you", "You"]];
  return <nav className={`los-dock pl-dock pl-dock-${look.id}${inApp ? " los-dock-inapp" : ""}`} aria-label="Arise Duo" data-testid="look-dock" style={{ ...themeVars(look), "--n": nav.length } as CSSProperties}>
    {nav.filter(([id]) => !off.includes(id)).map(([id, label]) => <button key={id} type="button" data-nav={id} data-add-toggle={id === "add" || undefined} aria-label={label} aria-current={screen === id ? "page" : undefined}
      onPointerDown={() => { buzz("tick"); play.click(); }} onClick={() => (id === "add" ? add() : id === "apps" ? openApps() : id === "you" ? you() : go(id as Screen))}>
      {id === "you" ? <span className="pl-avatar">{initial}</span> : <Ico n={id} size={22} />}</button>)}
  </nav>;
}
