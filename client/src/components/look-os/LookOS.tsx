// Arise Duo's looks as their own operating systems: each has its own navigation, Home, calendar and
// tasks screens, all on the same real data. Other apps open inside it with its dock (LookDock).
import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { themeVars, type NotesTheme } from "@shared/notesThemes";
import { LookTaskList, type AgendaDay, type LookTask } from "@/components/HubLook";
import { LockedApp, useLock } from "@/components/lock/PrivacyLock";
import "./lookOS.css";

export type OsScreen = "home" | "tasks" | "calendar" | "notes";
export type OsMenuItem = { id: string; label: string; detail?: string; icon?: ReactNode; danger?: boolean; onClick: () => void };
export type OsProps = {
  look: NotesTheme; name: string; dateLabel: string; screen: OsScreen; go: (s: OsScreen) => void; openApps: () => void; add: (title?: string) => void;
  tasks: LookTask[]; toggle: (id: string) => void; openTask: (id: string) => void; days: AgendaDay[];
  notes: { id: string; title: string; body: string; locked?: boolean }[]; shortcuts: { id: string; label: string; onClick: () => void }[];
  /** The full Calendar or Notes app, for adding and editing. */
  content?: ReactNode; onYou: () => void;
  /** The hub's name and its Work/Life switch, always at the top. */ hubName: string; hubSwitch: ReactNode;
  /** Shown at the bottom of Home: invitations and the hub's standing banner. */ banner?: ReactNode;
  /** Main apps turned off in the App Gallery, which leave the dock. */ off?: OsScreen[];
  /** Apps behind the passcode, whose details stay off Home until it is entered. */ lockedApps?: string[];
  /** Problems to show on any screen, such as a save that failed. */
};

const I = ({ d, size = 22 }: { d: string; size?: number }) => <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const ICON = { home: "M4 11.5 12 4l8 7.5V19a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z", tasks: "M4 5h16v14H4zM8 12l3 3 5-6", calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4", notes: "M6 3h9l4 4v14H6zM9 12h7M9 16h7", apps: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z", you: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6", add: "M12 5v14M5 12h14" };
type NavId = keyof typeof ICON;
const NAV: NavId[] = ["home", "tasks", "add", "calendar", "notes", "apps", "you"];
const WORDS: Partial<Record<string, Partial<Record<NavId, string>>>> = {
  console: { home: "~", tasks: "tasks", add: "add", calendar: "cal", notes: "notes", apps: "apps", you: "me" },
  gazette: { home: "Front", tasks: "To-do", add: "New", calendar: "Events", notes: "Notes", apps: "Sections", you: "You" },
  swiss: { home: "01", tasks: "02", add: "+", calendar: "03", notes: "04", apps: "05", you: "06" },
  cassette: { home: "PLAY", tasks: "TRK", add: "REC", calendar: "A/B", notes: "NOTE", apps: "MODE", you: "EJECT" },
  punch: { home: "HOME", tasks: "TASKS", add: "ADD!", calendar: "DATES", notes: "NOTES", apps: "APPS", you: "ME" },
  grove: { home: "Today", tasks: "Tasks", add: "Add", calendar: "Days", notes: "Notes", apps: "More", you: "You" },
};
const LABEL: Record<NavId, string> = { home: "Home", tasks: "Tasks", add: "Add", calendar: "Calendar", notes: "Notes", apps: "Apps", you: "You" };

/** Each system's way of getting around. Also used when another app is open. */
export function LookDock({ look, screen, go, openApps, add, you, initial, off = [], inApp = false }: { look: NotesTheme; screen: OsScreen | null; go: (s: OsScreen) => void; openApps: () => void; add: (title?: string) => void; you: () => void; initial: string; off?: OsScreen[]; inApp?: boolean }) {
  const words = WORDS[look.id];
  const textNav = !!words;
  return <nav style={themeVars(look) as CSSProperties} className={`los-dock los-dock-${look.id}${look.dark ? " los-dock-dark" : ""}${inApp ? " los-dock-inapp" : ""}`} aria-label="Arise Duo" data-testid="los-dock">
    {NAV.filter((n) => !off.includes(n as OsScreen)).map((n) => {
      const act = n === "add" ? () => add() : n === "apps" ? openApps : n === "you" ? you : () => go(n as OsScreen);
      return <button key={n} type="button" data-nav={n} data-add-toggle={n === "add" || undefined} aria-label={LABEL[n]} aria-current={screen === n ? "page" : undefined} onClick={act}>
        {n === "you" && !textNav ? <span className="los-avatar">{initial}</span> : textNav ? <span>{words![n]}</span> : <I d={ICON[n]} />}
      </button>;
    })}
  </nav>;
}

// ─── Calendar widgets: a different one for each system ───
const items = (d: AgendaDay) => d.items;
const Item = ({ x }: { x: AgendaDay["items"][number] }) => <span className="los-item"><em>{x.time}</em>{x.title}</span>;
function CalendarWidget({ look, days, go, big }: { look: NotesTheme; days: AgendaDay[]; go: () => void; big?: boolean }) {
  const today = days[0];
  const busy = days.filter((d) => items(d).length);
  const week = days.slice(0, 7);
  const none = <p className="los-none">Nothing coming up.</p>;
  const limit = big ? 8 : 3;
  const body = (() => {
    if (!today) return none;
    switch (look.id) {
      case "studio": return <div className="los-strip">{week.map((d, i) => <span key={d.date} data-on={i === 0 || undefined} data-busy={items(d).length > 0 || undefined}><small>{d.weekday}</small><b>{d.day}</b></span>)}</div>;
      case "margin": return <table className="los-ledger"><tbody>{week.map((d) => <tr key={d.date}><th>{d.weekday} {d.day}</th><td>{items(d)[0]?.title ?? ""}{items(d).length > 1 ? ` +${items(d).length - 1}` : ""}</td></tr>)}</tbody></table>;
      case "bloom": case "punch": { const first = new Date(`${today.date}T12:00:00`); const start = new Date(first.getFullYear(), first.getMonth(), 1); const blanks = start.getDay(); const total = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(); const busyDays = new Set(days.filter((d) => items(d).length && d.month === today.month).map((d) => Number(d.day))); return <div className="los-month"><b>{first.toLocaleDateString(undefined, { month: "long" })}</b><div>{["S", "M", "T", "W", "T", "F", "S"].map((w, i) => <small key={i}>{w}</small>)}{Array.from({ length: blanks }, (_, i) => <i key={`b${i}`} />)}{Array.from({ length: total }, (_, i) => <span key={i} data-on={i + 1 === Number(today.day) || undefined} data-busy={busyDays.has(i + 1) || undefined}>{i + 1}</span>)}</div></div>; }
      case "timeline": return busy.length ? <ol className="los-stream">{busy.slice(0, limit).flatMap((d) => items(d).map((x) => <li key={d.date + x.id}><small>{d.weekday} {d.day}{x.time ? ` · ${x.time}` : ""}</small>{x.title}</li>))}</ol> : none;
      case "console": return <pre className="los-ascii">{`      ${today.month}\nSu Mo Tu We Th Fr Sa\n${asciiWeek(week)}\n\n${busy.slice(0, limit).map((d) => `${d.weekday} ${d.day.padStart(2)}  ${items(d)[0].title}`).join("\n") || "(no events)"}`}</pre>;
      case "swiss": return <div className="los-giant"><b>{today.day}</b><span><small>{today.weekday} {today.month}</small>{items(today).slice(0, limit).map((x) => <Item key={x.id} x={x} />)}{!items(today).length && <span className="los-item">Clear.</span>}</span></div>;
      case "cassette": return <div className="los-sides"><div><h4>Side A: Today</h4>{items(today).slice(0, limit).map((x) => <Item key={x.id} x={x} />)}{!items(today).length && <span className="los-item">Blank tape</span>}</div><div><h4>Side B: Next</h4>{busy.filter((d) => d !== today).slice(0, limit).map((d) => <span key={d.date} className="los-item"><em>{d.weekday}</em>{items(d)[0].title}</span>)}</div></div>;
      case "frost": return <div className="los-orbs">{week.map((d, i) => <span key={d.date} data-on={i === 0 || undefined} data-busy={items(d).length > 0 || undefined}><small>{d.weekday[0]}</small><b>{d.day}</b></span>)}</div>;
      case "grove": return <p className="los-prose">{items(today).length ? <>Today you have <b>{items(today).map((x) => x.title).slice(0, 3).join(", ")}</b>.</> : "Nothing is planned today."} {busy[1] && <>Then, on {busy[1].weekday}, <b>{items(busy[1])[0].title}</b>.</>}</p>;
      case "gazette": return busy.length ? <div className="los-listings">{busy.slice(0, big ? 8 : 4).map((d) => <p key={d.date}><b>{d.weekday}, {d.month} {d.day}.</b> {items(d).map((x) => x.title).join("; ")}.</p>)}</div> : none;
      case "chatline": return <div className="los-bubbles"><p>{busy.length ? `Next up: ${items(busy[0])[0].title}, ${busy[0].weekday} ${busy[0].day}.` : "Your calendar is clear."}</p>{busy[1] && <p>After that: {items(busy[1])[0].title}.</p>}</div>;
      case "deck": return <div className="los-datecard"><b>{today.day}</b><small>{today.weekday}, {today.month}</small>{items(today).slice(0, limit).map((x) => <Item key={x.id} x={x} />)}</div>;
      default: return none;
    }
  })();
  return <button type="button" className={`los-cal los-cal-${look.id}`} onClick={go} data-testid="los-calendar">{body}</button>;
}
function asciiWeek(week: AgendaDay[]) { const pad = new Date(`${week[0].date}T12:00:00`).getDay(); return ("   ".repeat(pad) + week.slice(0, 7 - pad).map((d, i) => (i === 0 ? `[${d.day}]` : d.day.padStart(2))).join(" ")); }

function NotesWidget({ notes, go, count = 3 }: { notes: OsProps["notes"]; go: () => void; count?: number }) {
  return <button type="button" className="los-noteswidget" onClick={go}>{notes.length ? notes.slice(0, count).map((n) => <span key={n.id}><b>{n.title || "Untitled"}</b><small>{n.locked ? "Locked" : n.body.split("\n")[0]}</small></span>) : <span><b>No notes yet</b><small>Tap to write one</small></span>}</button>;
}
const Shortcuts = ({ list }: { list: OsProps["shortcuts"] }) => <div className="los-shortcuts">{list.slice(0, 4).map((s) => <button key={s.id} type="button" onClick={s.onClick}>{s.label}</button>)}</div>;

// ─── Each system's Home ───
function Home(p: OsProps) {
  const open = p.tasks.filter((t) => !t.done), first = p.name ? `, ${p.name}` : "";
  const hour = new Date().getHours(), hi = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const next = open[0];
  const cal = <CalendarWidget look={p.look} days={p.days} go={() => p.go("calendar")} />;
  const notes = <NotesWidget notes={p.notes} go={() => p.go("notes")} />;
  const list = <LookTaskList look={p.look} tasks={open.slice(0, 5)} onToggle={p.toggle} onOpen={p.openTask} />;
  const count = `${open.length} open`;
  switch (p.look.id) {
    case "studio": return <><header className="los-hero"><small>{p.dateLabel}</small><h1>{next ? next.title : "All clear"}</h1><p>{next ? "Next up" : hi + first}</p>{next && <button type="button" onClick={() => p.toggle(next.id)}>Mark done</button>}</header><div className="los-pad">{cal}<h2>Queue · {open.length}</h2><LookTaskList look={{ ...p.look, id: "margin" }} tasks={open.slice(1, 5)} onToggle={p.toggle} onOpen={p.openTask} />{notes}</div></>;
    case "margin": return <div className="los-page"><small className="los-date">{p.dateLabel}</small><h1>{hi}{first}.</h1><h2>This week</h2>{cal}<h2>To do</h2>{list}<h2>Notes</h2>{notes}</div>;
    case "bloom": return <><header className="los-hero"><h1>{hi}{first}!</h1></header><div className="los-bento"><button type="button" className="los-b1" onClick={() => p.go("tasks")}><b>{open.length}</b>tasks to do</button>{cal}<div className="los-b3">{notes}</div><Shortcuts list={p.shortcuts} /></div></>;
    case "timeline": return <><header className="los-hero"><small>{p.dateLabel}</small><h1>Your day, in order</h1></header><div className="los-pad">{cal}<h2>Still to do</h2><LookTaskList look={p.look} tasks={open.slice(0, 5)} onToggle={p.toggle} onOpen={p.openTask} /></div></>;
    case "console": return <div className="los-term"><p className="los-cmd">$ whoami</p><p>{p.name || "you"} · {p.dateLabel}</p><p className="los-cmd">$ cal</p>{cal}{list}<p className="los-cmd">$ ls notes/</p>{notes}<Terminal {...p} /></div>;
    case "swiss": return <><header className="los-hero"><h1>{new Date().getDate()}</h1><small>{p.dateLabel}</small></header><div className="los-pad"><h2>{open.length} tasks</h2>{list}<h2>Calendar</h2>{cal}<h2>Notes</h2>{notes}</div></>;
    case "cassette": return <><header className="los-tape"><div className="los-window"><span>{hi}{first}</span><strong>{String(open.length).padStart(2, "0")} TRACKS</strong></div><div aria-hidden className="los-reels"><i /><i /></div></header><div className="los-pad">{list}{cal}{notes}</div></>;
    case "frost": { const done = p.tasks.length - open.length, pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0; return <><header className="los-hero"><div className="los-ring" style={{ background: `conic-gradient(var(--an-violet) ${pct}%, var(--an-glass) 0)` }}><span><b>{open.length}</b><small>left today</small></span></div><p>{p.dateLabel}</p></header><div className="los-pad">{cal}<div className="los-glass">{notes}</div></div></>; }
    case "grove": return <div className="los-journal"><small>{p.dateLabel}</small><h1>{hi}{first}.</h1>{cal}<p className="los-prose">{open.length ? `There ${open.length === 1 ? "is one thing" : `are ${open.length} things`} waiting for you. Start with one.` : "Nothing is waiting for you."}</p>{list}<h2>From your notes</h2>{notes}</div>;
    case "gazette": return <div className="los-paper"><header><h1>The Daily Duo</h1><small>{p.dateLabel} · {count}</small></header>{next && <article className="los-lead"><h2>{next.title}</h2><p>{next.notes.split("\n")[0] || "Today’s top item needs your attention."}</p></article>}<div className="los-cols"><section><h3>Events</h3>{cal}</section><section><h3>Also today</h3><LookTaskList look={{ ...p.look, id: "margin" }} tasks={open.slice(1, 5)} onToggle={p.toggle} onOpen={p.openTask} /><h3>Notes</h3>{notes}</section></div></div>;
    case "punch": return <div className="los-stickers"><h1>{hi.toUpperCase()}{first.toUpperCase()}!</h1><div className="los-bigbtns"><button type="button" onClick={() => p.go("tasks")}><b>{open.length}</b>TASKS</button><button type="button" onClick={() => p.go("calendar")}><b>{p.days[0]?.items.length ?? 0}</b>TODAY</button><button type="button" onClick={() => p.go("notes")}><b>{p.notes.length}</b>NOTES</button><button type="button" onClick={p.openApps}><b>+</b>APPS</button></div>{cal}{list}</div>;
    case "chatline": return <Chat {...p} greeting={`${hi}${first}. You have ${open.length} task${open.length === 1 ? "" : "s"} open.`} />;
    case "deck": return <Cards {...p} />;
    default: return null;
  }
}

function Terminal(p: OsProps) {
  const [v, setV] = useState(""); const [out, setOut] = useState("");
  const run = (e: FormEvent) => { e.preventDefault(); const c = v.trim(); setV(""); const low = c.toLowerCase();
    if (low === "tasks" || low === "cal" || low === "notes") p.go(low === "cal" ? "calendar" : low as OsScreen);
    else if (low === "apps") p.openApps();
    else if (low.startsWith("add ")) p.add(c.slice(4));
    else if (c) setOut(`command not found: ${c}. Try tasks, cal, notes, apps or add <task>`); };
  return <form className="los-prompt" onSubmit={run}>{out && <p>{out}</p>}<label><span>$</span><input value={v} onChange={(e) => setV(e.target.value)} aria-label="Type a command" placeholder="add buy milk" autoCapitalize="none" /></label></form>;
}
function Chat(p: OsProps & { greeting: string }) {
  const [v, setV] = useState("");
  const send = (e: FormEvent) => { e.preventDefault(); if (v.trim()) { p.add(v.trim()); setV(""); } };
  return <div className="los-chat"><p className="los-them">{p.greeting}</p><CalendarWidget look={p.look} days={p.days} go={() => p.go("calendar")} /><div className="los-replies"><button type="button" onClick={() => p.go("tasks")}>Show my tasks</button><button type="button" onClick={() => p.go("calendar")}>What’s coming up?</button><button type="button" onClick={() => p.go("notes")}>Open notes</button></div>{p.notes[0] && <button type="button" className="los-them" onClick={() => p.go("notes")}>Latest note: {p.notes[0].title || "Untitled"}</button>}<form className="los-composer" onSubmit={send}><input value={v} onChange={(e) => setV(e.target.value)} aria-label="Add a task" placeholder="Type a task to add" /><button type="submit" aria-label="Add task"><I d="M5 12h14M13 6l6 6-6 6" /></button></form></div>;
}
function Cards(p: OsProps) {
  const open = p.tasks.filter((t) => !t.done); const [at, setAt] = useState(0);
  const cards: { key: string; bg: string; node: ReactNode }[] = [
    { key: "tasks", bg: "#9de3d3", node: <button type="button" className="los-cardbtn" onClick={() => p.go("tasks")}><small>Tasks</small><b>{open[0]?.title ?? "All done"}</b><small>{open.length} open</small></button> },
    { key: "calendar", bg: "#ffd95c", node: <CalendarWidget look={p.look} days={p.days} go={() => p.go("calendar")} /> },
    { key: "notes", bg: "#d6c7ff", node: <button type="button" className="los-cardbtn" onClick={() => p.go("notes")}><small>Notes</small><b>{p.notes[0]?.title || "Write something"}</b><small>{p.notes.length} notes</small></button> },
  ];
  const c = cards[at % 3];
  return <div className="los-stack"><small>{p.dateLabel}</small><div className="los-cards"><i style={{ background: cards[(at + 2) % 3].bg }} /><i style={{ background: cards[(at + 1) % 3].bg }} /><div style={{ background: c.bg }}>{c.node}</div></div><button type="button" className="los-nextcard" onClick={() => setAt(at + 1)}>Next card</button></div>;
}

// ─── The whole system ───
export function LookOS(p0: OsProps) {
  const lock = useLock();
  const locked = (id: string) => !!p0.lockedApps?.includes(id) && !!lock && !lock.unlocked;
  // Nothing from a locked app shows on Home or in a widget.
  const p: OsProps = { ...p0, tasks: locked("tasks") ? [] : p0.tasks, days: locked("calendar") ? [] : p0.days, notes: locked("notes") ? [] : p0.notes.map((n) => (n.locked && lock && !lock.unlocked ? { ...n, body: "" } : n)) };
  const [filter, setFilter] = useState("Open");
  const lists = Array.from(new Set(p.tasks.map((t) => t.listName).filter(Boolean)));
  const chips = ["Open", "Today", "Done", ...(lists.length > 1 ? lists : [])];
  const shown = p.tasks.filter((t) => filter === "Done" ? t.done : !t.done && (filter === "Open" || (filter === "Today" ? t.late || t.due === p.days[0]?.date : t.listName === filter)));
  const taskScreen = <div className="los-pad"><header className="los-title"><h1>Tasks</h1></header><div className="los-filter" role="group" aria-label="Show">{chips.map((f) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>)}</div>{shown.length ? <LookTaskList look={p.look} tasks={shown} onToggle={p.toggle} onOpen={p.openTask} /> : <p className="los-none">Nothing here.</p>}</div>;
  return <div style={themeVars(p.look) as CSSProperties} className={`los los-${p.look.id}`} data-screen={p.screen} data-testid="look-os">
    <header className="los-topbar"><b>{p.look.id === "console" ? `~/${p.hubName.toLowerCase()}` : p.hubName}</b>{p.hubSwitch}</header>
    <div className="los-body">
      {p.look.id === "gazette" && p.screen !== "home" && <div className="los-paper"><header><h1>The Daily Duo</h1><small>{p.dateLabel}</small></header></div>}
      {p.screen === "home" && <><Home {...p} />{p.banner && <div className="los-banner">{p.banner}</div>}</>}
      {p.screen === "tasks" && <LockedApp locked={locked("tasks")} name="Tasks">{taskScreen}</LockedApp>}
      {p.screen === "calendar" && <div className="los-pad"><header className="los-title"><h1>Calendar</h1></header><CalendarWidget look={p.look} days={p.days} go={() => {}} big /><div className="los-app">{p.content}</div></div>}
      {p.screen === "notes" && <div className="los-pad"><div className="los-app">{p.content}</div></div>}
    </div>
    <LookDock look={p.look} screen={p.screen} go={p.go} openApps={p.openApps} add={p.add} you={p.onYou} off={p.off} initial={(p.name || "Y").charAt(0).toUpperCase()} />
  </div>;
}
export function LookYou({ look, items: list, top, onClose }: { look: NotesTheme; items: OsMenuItem[]; top?: ReactNode; onClose: () => void }) {
  return <div style={themeVars(look) as CSSProperties} className="los-sheetback" onClick={onClose}><div role="dialog" aria-modal="true" aria-label="You" className="los-sheet" onClick={(e) => e.stopPropagation()}><button type="button" className="los-close" onClick={onClose}>Close</button>{top && <div className="los-sheettop">{top}</div>}{list.map((m) => <button key={m.id} type="button" data-danger={m.danger || undefined} onClick={() => { onClose(); m.onClick(); }}><b>{m.label}</b>{m.detail && <small>{m.detail}</small>}</button>)}</div></div>;
}
