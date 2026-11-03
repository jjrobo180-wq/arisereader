// The ten system looks for Arise Duo: Pocket (a phone home screen), Glass, Desktop (menu bar, windows
// and a dock), Millennium (an early-2000s desktop), Workstation (a modern PC), Retro 98, Monolith,
// E-Ink, Neon and Orbit (a watch face). Each is a whole system: its own Home, calendar, way of getting
// around (dock, taskbar with a start menu, tab bar, rings), windows and buttons, on the same real data.
// Original designs: no company's logos, icons or wallpapers.
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { NotesTheme } from "@shared/notesThemes";
import type { AgendaDay, LookTask } from "@/components/HubLook";
import "./systems.css";

export const SYSTEM_LOOKS = new Set<string>(["pocket", "glass", "desktop", "millennium", "workstation", "retro", "monolith", "ink", "neon", "orbit"]);
/** Looks that work like a computer: screens open in windows and the dock is a taskbar. */
export const DESKTOP_LOOKS = new Set<string>(["desktop", "millennium", "workstation", "retro"]);

type Screen = "home" | "tasks" | "calendar" | "notes";
export type SysProps = {
  look: NotesTheme; name: string; dateLabel: string; hi: string; days: AgendaDay[]; tasks: LookTask[]; open: LookTask[];
  notes: { id: string; title: string; body: string; locked?: boolean }[];
  toggle: (id: string) => void; openTask: (id: string) => void; go: (s: Screen) => void; openApps: () => void; add: (title?: string) => void; onYou: () => void;
  list: ReactNode; cal: ReactNode;
};

// ─── Icons: simple line drawings, the same set in every look ───
const P: Record<string, string> = {
  home: "M4 11.5 12 4l8 7.5V19a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z", tasks: "M4 5h16v14H4zM8 12l3 3 5-6", calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  notes: "M6 3h9l4 4v14H6zM9 12h6M9 16h6M9 8h3", apps: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z", add: "M12 5v14M5 12h14",
  you: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6", search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4", spark: "M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z",
};
const Ico = ({ n, size = 22, w = 2 }: { n: keyof typeof P | string; size?: number; w?: number }) => <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><path d={P[n] ?? P.spark} /></svg>;
const NAV: { id: "home" | "tasks" | "add" | "calendar" | "notes" | "apps" | "you"; label: string }[] = [
  { id: "home", label: "Home" }, { id: "tasks", label: "Tasks" }, { id: "add", label: "Add" }, { id: "calendar", label: "Calendar" }, { id: "notes", label: "Notes" }, { id: "apps", label: "Apps" }, { id: "you", label: "You" },
];
/** An app icon tile: each app has its own colors, so a grid of them reads like a home screen. */
const TILE: Record<string, [string, string]> = { tasks: ["#4f8cff", "#1f5fe0"], calendar: ["#ffffff", "#e9e9ef"], notes: ["#ffd84d", "#f5b800"], apps: ["#9b8cff", "#6a55dc"], add: ["#4cd97b", "#1fa851"], you: ["#ff8a6b", "#e85b3a"], home: ["#5ad1ff", "#1599d6"] };
function AppIcon({ id, day, size = 60 }: { id: string; day?: string; size?: number }) {
  const [a, b] = TILE[id] ?? TILE.apps;
  return <span aria-hidden className="sys-appicon" style={{ width: size, height: size, borderRadius: size * 0.24, background: `linear-gradient(160deg, ${a}, ${b})`, color: id === "calendar" ? "#111" : "#fff" }}>
    {id === "calendar" ? <span className="sys-calicon"><small>{new Date().toLocaleDateString(undefined, { weekday: "short" })}</small><b>{day ?? new Date().getDate()}</b></span> : <Ico n={id} size={size * 0.5} w={2.2} />}
  </span>;
}
const clockNow = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
function useClock() { const [t, setT] = useState(clockNow()); useEffect(() => { const i = window.setInterval(() => setT(clockNow()), 15000); return () => window.clearInterval(i); }, []); return t; }

// ─── Calendars ───
const busy = (days: AgendaDay[]) => days.filter((d) => d.items.length);
function Month({ days, cls }: { days: AgendaDay[]; cls: string }) {
  const today = days[0]; if (!today) return null;
  const first = new Date(`${today.date}T12:00:00`), start = new Date(first.getFullYear(), first.getMonth(), 1), total = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const has = new Set(days.filter((d) => d.items.length).map((d) => Number(d.day)));
  return <div className={`sys-month ${cls}`}><p>{today.month} {first.getFullYear()}</p>
    <div className="sys-dow">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
    <div className="sys-grid">{Array.from({ length: start.getDay() }, (_, i) => <span key={`b${i}`} />)}{Array.from({ length: total }, (_, i) => <span key={i} data-on={i + 1 === Number(today.day) || undefined} data-busy={has.has(i + 1) || undefined}>{i + 1}</span>)}</div></div>;
}
const Agenda = ({ days, limit, cls = "" }: { days: AgendaDay[]; limit: number; cls?: string }) => {
  const list = busy(days).flatMap((d) => d.items.map((x) => ({ d, x }))).slice(0, limit);
  return <ul className={`sys-agenda ${cls}`}>{list.map(({ d, x }) => <li key={d.date + x.id}><small>{d.weekday} {d.day}{x.time ? ` · ${x.time}` : ""}</small><b>{x.title}</b></li>)}{!list.length && <li className="sys-none">Nothing coming up.</li>}</ul>;
};

export function SystemCal({ look, days, big }: { look: NotesTheme; days: AgendaDay[]; big?: boolean }) {
  const today = days[0], week = days.slice(0, 7), limit = big ? 10 : 3;
  if (!today) return <p className="los-none">Nothing coming up.</p>;
  switch (look.id) {
    case "pocket": return <div className="sys-cal-pocket"><div><small>{today.weekday.toUpperCase()}</small><b>{today.day}</b></div><Agenda days={days} limit={limit} /></div>;
    case "glass": return <div className="sys-cal-glass">{week.map((d, i) => <span key={d.date} data-on={i === 0 || undefined}><small>{d.weekday}</small><b>{d.day}</b><i>{d.items.slice(0, 3).map((x) => <em key={x.id} />)}</i></span>)}</div>;
    case "desktop": case "workstation": case "millennium": case "retro": return <div className={`sys-cal-split sys-cal-${look.id}`}><Month days={days} cls="" /><Agenda days={days} limit={limit} /></div>;
    case "monolith": return <div className="sys-cal-mono"><b>{today.day}</b><div><small>{today.weekday} · {today.month}</small><Agenda days={days} limit={limit} /></div></div>;
    case "ink": return <div className="sys-cal-ink"><p>{today.weekday}, {today.month} {today.day}</p><ol>{busy(days).slice(0, big ? 10 : 4).map((d) => <li key={d.date}><span>{d.items[0].title}{d.items.length > 1 ? ` and ${d.items.length - 1} more` : ""}</span><i /><small>{d.weekday} {d.day}</small></li>)}{!busy(days).length && <li><span>Nothing written in yet.</span></li>}</ol></div>;
    case "neon": return <div className="sys-cal-neon">{week.map((d, i) => <span key={d.date} data-on={i === 0 || undefined}><small>T+{i}D</small><b>{d.day}</b><i style={{ "--w": `${Math.min(d.items.length, 4) * 25}%` } as CSSProperties} /><em>{d.items[0]?.title ?? "—"}</em></span>)}</div>;
    case "orbit": return <div className="sys-cal-orbit"><div className="sys-dial">{week.map((d, i) => <span key={d.date} style={{ "--r": `${(i / 7) * 360}deg` } as CSSProperties} data-on={i === 0 || undefined} data-busy={d.items.length > 0 || undefined}><b>{d.day}</b></span>)}<div><small>{today.weekday}</small><b>{today.items.length}</b><small>today</small></div></div><Agenda days={days} limit={limit} /></div>;
    default: return null;
  }
}

/** A window, for the computer looks: title bar with its buttons, and the screen inside. */
export function SystemWindow({ look, title, children, onClose }: { look: NotesTheme; title: string; children: ReactNode; onClose?: () => void }) {
  const ctl = (label: string, cls: string, click?: () => void) => <button type="button" aria-label={label} className={cls} onClick={click} tabIndex={click ? 0 : -1} />;
  return <section className={`sys-win sys-win-${look.id}`} aria-label={title}>
    <header className="sys-titlebar">
      {look.id === "desktop" && <span className="sys-lights">{ctl("Close", "sys-l-close", onClose)}{ctl("Minimize", "sys-l-min")}{ctl("Zoom", "sys-l-zoom")}</span>}
      <b>{title}</b>
      {look.id !== "desktop" && <span className="sys-ctls">{ctl("Minimize", "sys-c-min")}{ctl("Maximize", "sys-c-max")}{ctl("Close", "sys-c-close", onClose)}</span>}
    </header>
    <div className="sys-winbody">{children}</div>
  </section>;
}

// ─── Each system's Home ───
export function SystemHome(p: SysProps) {
  const next = p.open[0], done = p.tasks.length - p.open.length, pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0;
  const today = p.days[0], todayCount = today?.items.length ?? 0, nextEvent = busy(p.days)[0];
  const clock = useClock();
  const first = p.name ? `, ${p.name}` : "";
  const notesCard = (cls = "") => <button type="button" className={`sys-notes ${cls}`} onClick={() => p.go("notes")}>{p.notes.length ? p.notes.slice(0, 3).map((n) => <span key={n.id}><b>{n.title || "Untitled"}</b><small>{n.locked ? "Locked" : n.body.split("\n")[0]}</small></span>) : <span><b>No notes yet</b><small>Tap to write one</small></span>}</button>;
  const doNext = (label: string, cls = "sys-btn") => next ? <button type="button" className={cls} onClick={() => p.toggle(next.id)}>{label}</button> : <button type="button" className={cls} onClick={() => p.add()}>New task</button>;
  const icons = (ids: string[], size = 60, labels = true) => ids.map((id) => {
    const act = id === "tasks" || id === "calendar" || id === "notes" ? () => p.go(id as Screen) : id === "apps" ? p.openApps : id === "add" ? () => p.add() : p.onYou;
    return <button key={id} type="button" className="sys-icon" onClick={act} aria-label={NAV.find((n) => n.id === id)?.label}><AppIcon id={id} size={size} day={today?.day} />{labels && <span>{NAV.find((n) => n.id === id)?.label}</span>}</button>;
  });
  switch (p.look.id) {
    // A phone home screen: two widgets, a grid of app icons, page dots.
    case "pocket": return <div className="sys-pocket">
      <div className="sys-widgets">
        <button type="button" className="sys-widget sys-w-cal" onClick={() => p.go("calendar")}><small>{today?.weekday.toUpperCase()}</small><b>{today?.day}</b><span>{nextEvent ? nextEvent.items[0].title : "No events"}</span><em>{nextEvent ? `${nextEvent.weekday} ${nextEvent.day}${nextEvent.items[0].time ? ` · ${nextEvent.items[0].time}` : ""}` : "Enjoy the day"}</em></button>
        <button type="button" className="sys-widget sys-w-tasks" onClick={() => p.go("tasks")}><small>Tasks</small><b>{p.open.length}</b><span>{p.open.slice(0, 3).map((t) => <i key={t.id}>{t.title}</i>)}{!p.open.length && <i>All done</i>}</span></button>
      </div>
      <div className="sys-icongrid">{icons(["tasks", "calendar", "notes", "apps", "add", "you"])}</div>
      <div aria-hidden className="sys-dots"><i data-on="1" /><i /></div>
      <div className="sys-pocket-list">{p.list}</div>
    </div>;
    // Clear panes over slow color.
    case "glass": return <div className="sys-glass">
      <div aria-hidden className="sys-blobs"><i /><i /><i /></div>
      <section className="sys-pane sys-glass-hero"><small>{p.dateLabel}</small><h1>{p.hi}{first}</h1><p>{next ? <>Next: <b>{next.title}</b></> : "Nothing waiting. Breathe."}</p>{doNext("Done")}</section>
      <div className="sys-glass-grid">
        <button type="button" className="sys-pane" onClick={() => p.go("tasks")}><small>Open tasks</small><b>{p.open.length}</b><i className="sys-bar"><i style={{ width: `${pct}%` }} /></i></button>
        <button type="button" className="sys-pane" onClick={() => p.go("calendar")}><small>Today</small><b>{todayCount}</b><span>{todayCount === 1 ? "event" : "events"}</span></button>
      </div>
      <div className="sys-pane sys-pad">{p.cal}</div>
      <div className="sys-pane sys-pad">{p.list}</div>
      <div className="sys-pane sys-pad">{notesCard()}</div>
    </div>;
    // A desktop: windows on a wallpaper, and a sticky note.
    case "desktop": return <div className="sys-desk sys-desk-desktop">
      <SystemWindow look={p.look} title={`Today — ${p.dateLabel}`}><div className="sys-pad"><h1 className="sys-desk-hi">{p.hi}{first}</h1><p className="sys-sub">{p.open.length ? `${p.open.length} open · ${pct}% done` : "All caught up"}</p>{doNext(next ? "Mark next done" : "New task")}</div></SystemWindow>
      <div className="sys-desk-row"><SystemWindow look={p.look} title="Calendar"><div className="sys-pad">{p.cal}</div></SystemWindow>
        <button type="button" className="sys-sticky" onClick={() => p.go("notes")}><b>{p.notes[0]?.title || "Sticky note"}</b><span>{p.notes[0] ? (p.notes[0].locked ? "Locked" : p.notes[0].body.slice(0, 120)) : "Tap to write a note."}</span></button></div>
      <SystemWindow look={p.look} title="Tasks"><div className="sys-pad">{p.list}</div></SystemWindow>
    </div>;
    // The early-2000s desktop: icons down the side and a welcome window.
    case "millennium": return <div className="sys-desk sys-desk-millennium">
      <div className="sys-desk-icons">{icons(["tasks", "calendar", "notes", "apps"], 44)}</div>
      <SystemWindow look={p.look} title={`Welcome${first}`}><div className="sys-xp-welcome"><div className="sys-xp-side"><b>Today</b><span>{p.dateLabel}</span><span>{p.open.length} tasks open</span><span>{todayCount} events today</span></div>
        <div className="sys-pad"><h1>{p.hi}{first}!</h1><p className="sys-sub">{next ? <>Next up: <b>{next.title}</b></> : "There's nothing on your list."}</p><div className="sys-btnrow">{doNext(next ? "Done" : "New task")}<button type="button" className="sys-btn" onClick={() => p.go("tasks")}>Open Tasks</button></div></div></div></SystemWindow>
      <SystemWindow look={p.look} title="Calendar"><div className="sys-pad">{p.cal}</div></SystemWindow>
    </div>;
    // A modern PC: a start screen with pinned apps and recommendations.
    case "workstation": return <div className="sys-desk sys-desk-workstation">
      <section className="sys-start"><button type="button" className="sys-search" onClick={() => p.go("tasks")}><Ico n="search" size={18} />Search</button>
        <header><b>Pinned</b></header><div className="sys-pinned">{icons(["tasks", "calendar", "notes", "apps", "add", "you"], 40)}</div>
        <header><b>Recommended</b></header>
        <div className="sys-recs">{p.open.slice(0, 2).map((t) => <button key={t.id} type="button" onClick={() => p.openTask(t.id)}><Ico n="tasks" size={20} /><span><b>{t.title}</b><small>{t.dueLabel || "Task"}</small></span></button>)}
          {busy(p.days).slice(0, 2).map((d) => <button key={d.date} type="button" onClick={() => p.go("calendar")}><Ico n="calendar" size={20} /><span><b>{d.items[0].title}</b><small>{d.weekday} {d.day}</small></span></button>)}
          {p.notes.slice(0, 2).map((n) => <button key={n.id} type="button" onClick={() => p.go("notes")}><Ico n="notes" size={20} /><span><b>{n.title || "Untitled"}</b><small>Note</small></span></button>)}</div>
        <footer><span className="sys-avatar">{(p.name || "Y").charAt(0).toUpperCase()}</span><b>{p.name || "You"}</b><small>{clock}</small></footer>
      </section>
      <SystemWindow look={p.look} title="Widgets"><div className="sys-pad sys-ws-widgets"><div><small>Tasks</small><b>{p.open.length}</b><i className="sys-bar"><i style={{ width: `${pct}%` }} /></i></div>{p.cal}</div></SystemWindow>
    </div>;
    // Retro 98: a teal desktop, beveled windows.
    case "retro": return <div className="sys-desk sys-desk-retro">
      <div className="sys-desk-icons">{icons(["tasks", "calendar", "notes", "apps"], 36)}</div>
      <SystemWindow look={p.look} title="Today.exe"><div className="sys-pad"><h1>{p.hi}{first}.</h1><fieldset className="sys-fieldset"><legend>Status</legend><p>{p.open.length} task(s) open, {todayCount} event(s) today.</p><div className="sys-progress"><i style={{ width: `${pct}%` }} /></div></fieldset><div className="sys-btnrow">{doNext(next ? "Done" : "New task")}<button type="button" className="sys-btn" onClick={() => p.go("tasks")}>Tasks...</button></div></div></SystemWindow>
      <SystemWindow look={p.look} title="Calendar"><div className="sys-pad">{p.cal}</div></SystemWindow>
    </div>;
    // Monolith: a giant date and three lines, set like a magazine.
    case "monolith": return <div className="sys-mono">
      <header><small>{today?.weekday}</small><b>{today?.day}</b><small>{today?.month} · {clock}</small></header><hr />
      <h1>{next ? next.title : "Nothing remains."}</h1>{doNext("Complete", "sys-mono-btn")}
      <ol className="sys-mono-list">{p.open.slice(1, 4).map((t, i) => <li key={t.id}><span>{["II", "III", "IV"][i]}</span><button type="button" onClick={() => p.openTask(t.id)}>{t.title}</button></li>)}</ol>
      <hr />{p.cal}<hr />{notesCard("sys-mono-notes")}
    </div>;
    // E-Ink: a page, set in a book face, with nothing moving.
    case "ink": return <div className="sys-ink">
      <header><small>{p.dateLabel}</small><h1>{p.hi}{first}.</h1><p>{p.open.length ? `${p.open.length} item${p.open.length === 1 ? "" : "s"} on today's page.` : "A blank page today."}</p></header>
      <h2>Chapter 1 · To do</h2>{p.list}<h2>Chapter 2 · Ahead</h2>{p.cal}<h2>Chapter 3 · Notes</h2>{notesCard()}
      <footer aria-hidden><span>{pct}% read</span><span>Page 1 of 3</span></footer>
    </div>;
    // Neon: a heads-up display.
    case "neon": return <div className="sys-neon">
      <div aria-hidden className="sys-scan" />
      <header className="sys-hud"><span>SYS.ONLINE</span><span>{clock}</span></header>
      <section className="sys-neon-hero"><small>// {p.dateLabel.toUpperCase()}</small><h1 data-text={(next?.title ?? "ALL CLEAR").toUpperCase()}>{(next?.title ?? "ALL CLEAR").toUpperCase()}</h1>{doNext("EXECUTE", "sys-neon-btn")}</section>
      <div className="sys-neon-stats"><button type="button" onClick={() => p.go("tasks")}><small>OPEN</small><b>{String(p.open.length).padStart(2, "0")}</b></button><button type="button" onClick={() => p.go("calendar")}><small>TODAY</small><b>{String(todayCount).padStart(2, "0")}</b></button><div><small>DONE</small><b>{pct}%</b><i className="sys-bar"><i style={{ width: `${pct}%` }} /></i></div></div>
      <div className="sys-neon-panel">{p.cal}</div><div className="sys-neon-panel">{p.list}</div>
    </div>;
    // Orbit: a watch face with rings for tasks, events and notes.
    case "orbit": { const ring = (r: number, frac: number, color: string) => { const c = 2 * Math.PI * r; return <circle cx="100" cy="100" r={r} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0.02, Math.min(1, frac)))} transform="rotate(-90 100 100)" style={{ transition: "stroke-dashoffset 1.2s ease" }} />; };
      return <div className="sys-orbit">
        <div className="sys-face"><svg viewBox="0 0 200 200" aria-hidden>{[88, 70, 52].map((r, i) => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke={["#3a0d17", "#0c2a14", "#0a2233"][i]} strokeWidth="14" />)}{ring(88, pct / 100, "#ff375f")}{ring(70, Math.min(1, todayCount / 4), "#32d74b")}{ring(52, Math.min(1, p.notes.length / 5), "#64d2ff")}</svg>
          <div><b>{clock}</b><small>{today?.weekday} {today?.day}</small></div></div>
        <div className="sys-complications"><button type="button" onClick={() => p.go("tasks")}><i style={{ background: "#ff375f" }} /><b>{pct}%</b><small>tasks done</small></button><button type="button" onClick={() => p.go("calendar")}><i style={{ background: "#32d74b" }} /><b>{todayCount}</b><small>events</small></button><button type="button" onClick={() => p.go("notes")}><i style={{ background: "#64d2ff" }} /><b>{p.notes.length}</b><small>notes</small></button></div>
        <section className="sys-orbit-next"><small>Up next</small><h1>{next?.title ?? "Nothing due"}</h1>{doNext("Done", "sys-orbit-btn")}</section>
        {p.cal}{p.list}
      </div>; }
    default: return null;
  }
}

/** Getting around: a tab bar, a dock, a taskbar with a start menu, or a crown of buttons. */
export function SystemDock({ look, screen, go, openApps, add, you, initial, off = [], inApp = false }: { look: NotesTheme; screen: Screen | null; go: (s: Screen) => void; openApps: () => void; add: () => void; you: () => void; initial: string; off?: string[]; inApp?: boolean }) {
  const [menu, setMenu] = useState(false);
  const clock = useClock();
  const items = NAV.filter((n) => !off.includes(n.id));
  const act = (id: string) => () => { setMenu(false); if (id === "add") add(); else if (id === "apps") openApps(); else if (id === "you") you(); else go(id as Screen); };
  const btn = (n: (typeof NAV)[number], body: ReactNode, cls = "") => <button key={n.id} type="button" data-nav={n.id} data-add-toggle={n.id === "add" || undefined} aria-label={n.label} aria-current={screen === n.id ? "page" : undefined} onClick={act(n.id)} className={cls}>{body}</button>;
  const cls = `los-dock sys-dock sys-dock-${look.id}${look.dark ? " los-dock-dark" : ""}${inApp ? " los-dock-inapp" : ""}`;
  const taskbar = look.id === "millennium" || look.id === "workstation" || look.id === "retro";
  if (taskbar) {
    const shown = items.filter((n) => n.id !== "add" && n.id !== "you" && n.id !== "apps");
    const startMenu = menu && <div className={`sys-startmenu sys-startmenu-${look.id}`} role="menu" aria-label="Start">
      <header><span className="sys-avatar">{initial}</span><b>{look.id === "workstation" ? "Pinned" : "Arise Duo"}</b></header>
      <div>{items.map((n) => <button key={n.id} type="button" role="menuitem" data-nav={n.id} onClick={act(n.id)}><AppIcon id={n.id} size={look.id === "retro" ? 26 : 30} /><span>{n.id === "add" ? "New task" : n.id === "you" ? "You and settings" : n.label}</span></button>)}</div>
    </div>;
    return <>{menu && <button type="button" aria-label="Close the start menu" className="sys-menuback" onClick={() => setMenu(false)} />}{startMenu}
      <nav className={cls} aria-label="Arise Duo" data-testid="look-dock">
        <button type="button" className="sys-startbtn" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu(!menu)} data-testid="sys-start">{look.id === "workstation" ? <Ico n="spark" size={20} /> : <><Ico n="spark" size={16} /><span>{look.id === "retro" ? "Start" : "start"}</span></>}</button>
        <span className="sys-taskbtns">{shown.map((n) => btn(n, look.id === "workstation" ? <Ico n={n.id} size={21} /> : <><Ico n={n.id} size={16} /><span>{n.label}</span></>))}
          {items.some((n) => n.id === "add") && btn(NAV[2], look.id === "workstation" ? <Ico n="add" size={21} /> : <><Ico n="add" size={16} /><span>Add</span></>, "sys-addbtn")}</span>
        <span className="sys-tray">{items.some((n) => n.id === "apps") && btn(NAV[5], <Ico n="apps" size={16} />)}{items.some((n) => n.id === "you") && btn(NAV[6], <span className="sys-avatar sys-avatar-sm">{initial}</span>)}<time>{clock}</time></span>
      </nav></>;
  }
  if (look.id === "desktop") return <nav className={cls} aria-label="Arise Duo" data-testid="look-dock">{items.map((n) => btn(n, <><AppIcon id={n.id} size={46} /><i aria-hidden className="sys-dot" /></>))}</nav>;
  if (look.id === "pocket") return <nav className={cls} aria-label="Arise Duo" data-testid="look-dock">{items.map((n) => btn(n, n.id === "add" ? <span className="sys-plus"><Ico n="add" size={22} w={2.6} /></span> : <><Ico n={n.id} size={23} /><small>{n.label}</small></>))}</nav>;
  if (look.id === "monolith" || look.id === "ink") return <nav className={cls} aria-label="Arise Duo" data-testid="look-dock">{items.map((n) => btn(n, <span>{n.id === "add" ? "+" : n.label}</span>))}</nav>;
  if (look.id === "neon") return <nav className={cls} aria-label="Arise Duo" data-testid="look-dock">{items.map((n) => btn(n, <><Ico n={n.id} size={20} /><small>{n.label.toUpperCase()}</small></>))}</nav>;
  if (look.id === "orbit") return <nav className={cls} aria-label="Arise Duo" data-testid="look-dock">{items.map((n) => btn(n, n.id === "you" ? <span className="sys-avatar">{initial}</span> : <Ico n={n.id} size={22} />))}</nav>;
  // Glass
  return <nav className={cls} aria-label="Arise Duo" data-testid="look-dock">{items.map((n) => btn(n, n.id === "you" ? <span className="sys-avatar">{initial}</span> : <Ico n={n.id} size={22} />))}</nav>;
}
