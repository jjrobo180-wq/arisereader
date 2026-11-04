// Arise To Duo and WorkHub with an Arise Notes look: the hub root's colors and fonts, the areas around
// the page on the iPhone, and each look's own top of Home. Classic, Tile and Old Computer add nothing.
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { rememberHubBackdrop } from "@/lib/hubBackdrop";
import { hubThemeOf } from "@shared/appThemes";
import { nightLook, themeVars, type NotesTheme } from "@shared/notesThemes";
import { isNativeApp, nativeCall } from "@/lib/nativeApp";
import "@/components/arise-notes/notes-themes.css";
import "@/pages/hubLooks.css";

const fonts = new Set<string>();
const loadFont = (href?: string) => {
  if (!href || fonts.has(href)) return;
  fonts.add(href);
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = href;
  document.head.appendChild(l);
};

/** What the hub root needs for its theme. A look replaces night mode, since it has its own colors. */
export function useHubLook(themeId: unknown, night: boolean): { look: NotesTheme | null; className: string; style?: CSSProperties } {
  const base = hubThemeOf(themeId).look ?? null;
  const look = base && night ? nightLook(base) : base;
  const sent = useRef(false);
  useEffect(() => { publishLook(look); return () => publishLook(null); }, [look]);
  useEffect(() => { if (look) loadFont(look.fontUrl); }, [look]);
  // Remembered so a hub that is still arriving shows this background, not a white flash (lib/hubBackdrop).
  useEffect(() => {
    const plain = hubThemeOf(themeId).vars["--hub-bg"];
    rememberHubBackdrop(look ? look.bg : plain ?? (night ? "#14121f" : "#f6f7fc"), look ? !!look.dark : !!plain || night);
  }, [look, themeId, night]);
  useEffect(() => {
    const html = document.documentElement, body = document.body;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (look) {
      const before = [html.style.background, body.style.background, meta?.content];
      html.style.background = look.bg;
      body.style.background = look.bg;
      if (meta) meta.content = look.bg;
      // Pop-ups that open outside the hub (Notifications) take the look's colors from here.
      const vars = Object.entries(themeVars(look) as Record<string, string>);
      for (const [k, v] of vars) html.style.setProperty(k, String(v));
      html.dataset.hubLook = look.id;
      // Pop-ups open on the page body, outside the hub, so the body carries the look's classes too.
      const bodyClasses = ["hub-look", `hub-theme-${look.id}`, ...(look.dark ? ["hub-look-dark"] : [])];
      body.classList.add(...bodyClasses);
      if (isNativeApp()) {
        sent.current = true;
        void nativeCall(/arisewidgets/i, "AriseWidgets", "setBackdrop", { color: look.bg }).catch(() => {});
        void nativeCall(/statusbar/i, "StatusBar", "setStyle", { style: look.dark ? "DARK" : "LIGHT" }).catch(() => {});
      }
      return () => { body.classList.remove(...bodyClasses); for (const [k] of vars) html.style.removeProperty(k); delete html.dataset.hubLook; html.style.background = before[0] ?? ""; body.style.background = before[1] ?? ""; if (meta && before[2]) meta.content = before[2]; };
    }
    if (sent.current && isNativeApp()) {
      sent.current = false;
      void nativeCall(/arisewidgets/i, "AriseWidgets", "setBackdrop", { color: night ? "#14121f" : "#ffffff" }).catch(() => {});
      void nativeCall(/statusbar/i, "StatusBar", "setStyle", { style: night ? "DARK" : "LIGHT" }).catch(() => {});
    }
    return undefined;
  }, [look, night]);
  return look ? { look, className: `hub-look hub-theme-${look.id}${look.dark ? " hub-look-dark" : ""}`, style: themeVars(look) as CSSProperties } : { look: null, className: "" };
}

export type HubHeroLink = { label: string; onClick: () => void };

/** The top of Home for a look: its title, the main action and up to three shortcuts. */
export function HubLookHero({ look, date, greeting, primary, links }: { look: NotesTheme; date: string; greeting: string; primary: HubHeroLink; links: HubHeroLink[] }) {
  const main = (children: ReactNode, cls = "") => <button type="button" className={`an-l-record ${cls}`} onClick={primary.onClick} data-testid="hub-look-primary">{children}</button>;
  const rest = <div className="an-l-secondary">{links.slice(0, 3).map((l) => <button key={l.label} type="button" onClick={l.onClick}>{look.id === "console" ? `[ ${l.label.toLowerCase()} ]` : look.id === "punch" ? l.label.toUpperCase() : l.label}</button>)}</div>;
  const title = <h1>{greeting}</h1>;
  const body = (() => {
    switch (look.id) {
      case "studio": return <>{main(<><span className="an-l-rectop"><b>Today</b></span><small>{primary.label}</small></>)}{title}{rest}</>;
      case "bloom": return <>{title}<div className="an-l-tiles">{main(<b>{primary.label}</b>)}{links.slice(0, 2).map((l, i) => <button key={l.label} type="button" className={i ? "an-l-memo" : ""} onClick={l.onClick}>{l.label}</button>)}</div></>;
      case "timeline": return <>{title}{main(<><span className="an-l-tdot" /><span><b>{primary.label}</b><small>{date}</small></span></>)}{rest}</>;
      case "console": return <><h1>&gt; {greeting.toLowerCase()}</h1>{main(`[ ${primary.label.toLowerCase()} ]`)}{rest}</>;
      case "swiss": return <>{main(<b>Today</b>)}{rest}<h1 className="an-l-pad">{greeting}</h1></>;
      case "cassette": return <><div aria-hidden className="an-l-tape"><span>Side A: {date}</span><div><i /><i /></div></div>{title}{main(primary.label)}{rest}</>;
      case "grove": return <>{title}<div className="an-l-pills">{main(primary.label)}{links.slice(0, 2).map((l) => <button key={l.label} type="button" onClick={l.onClick}>{l.label}</button>)}</div></>;
      case "gazette": return <><header className="an-l-masthead"><h1>The Daily Duo</h1><p>{date}</p></header><h2 className="an-l-headline">{greeting}</h2>{main(primary.label)}{rest}</>;
      case "punch": return <><h1>{greeting.toUpperCase()}</h1>{main(primary.label.toUpperCase())}{rest}</>;
      case "chatline": return <><h1>{date}</h1><p className="an-l-bubble-them">{greeting}</p><button type="button" className="an-l-bubble-me" onClick={primary.onClick}>{primary.label}</button>{rest}</>;
      default: return <>{title}{main(primary.label)}{rest}</>;
    }
  })();
  return <section className={`an-l-hero an-l-hero-${look.id}`}>{body}</section>;
}

// ─── Who else needs the look: Home, Calendar and Notes read it without being passed it ───
let activeLook: NotesTheme | null = null;
const lookListeners = new Set<() => void>();
const publishLook = (look: NotesTheme | null) => { if (look !== activeLook) { activeLook = look; lookListeners.forEach((f) => f()); } };
export const useActiveLook = () => useSyncExternalStore((f) => { lookListeners.add(f); return () => { lookListeners.delete(f); }; }, () => activeLook);

// ─── Tasks: each look arranges the list its own way ───
export type LookTask = { id: string; title: string; done: boolean; due: string; late: boolean; dueLabel: string; listName: string; color: string; assignee: string; notes: string };

const Check = ({ t, onToggle }: { t: LookTask; onToggle: (id: string) => void }) => <button type="button" className="lk-check" aria-pressed={t.done} aria-label={t.done ? `Reopen ${t.title}` : `Complete ${t.title}`} onClick={() => onToggle(t.id)}><i /></button>;
const Open = ({ t, onOpen, children }: { t: LookTask; onOpen: (id: string) => void; children?: ReactNode }) => <button type="button" className="lk-open" onClick={() => onOpen(t.id)}>{children ?? <>
  <b>{t.title}</b>{(t.dueLabel || t.assignee) && <small>{[t.late ? "Overdue" : "", t.dueLabel, t.assignee].filter(Boolean).join(" · ")}</small>}</>}</button>;
const Row = ({ t, onToggle, onOpen, children }: { t: LookTask; onToggle: (id: string) => void; onOpen: (id: string) => void; children?: ReactNode }) =>
  <li className="lk-row" data-done={t.done || undefined} data-late={t.late || undefined}><Check t={t} onToggle={onToggle} /><Open t={t} onOpen={onOpen}>{children}</Open></li>;

const TILE_COLORS = ["#9de3d3", "#ffd95c", "#d6c7ff", "#ffb8a8"];

export function LookTaskList({ look, tasks, onToggle, onOpen }: { look: NotesTheme; tasks: LookTask[]; onToggle: (id: string) => void; onOpen: (id: string) => void }) {
  const [at, setAt] = useState(0);
  const props = { onToggle, onOpen };
  const open = tasks.filter((t) => !t.done);
  const wrap = (children: ReactNode) => <div className={`lk-tasks lk-tasks-${look.id}`} data-testid="look-task-list">{children}</div>;
  if (!tasks.length) return null;
  const plain = (rows: LookTask[]) => <ul>{rows.map((t) => <Row key={t.id} t={t} {...props} />)}</ul>;
  const groups = (key: (t: LookTask) => string) => { const m = new Map<string, LookTask[]>(); for (const t of tasks) { const k = key(t); m.set(k, [...(m.get(k) ?? []), t]); } return [...m]; };
  switch (look.id) {
    case "studio": { const [next, ...rest] = [...open, ...tasks.filter((t) => t.done)]; return wrap(<><section className="lk-next"><span>Next up</span><button type="button" onClick={() => onOpen(next.id)}>{next.title}</button><small>{next.dueLabel}</small><button type="button" className="lk-nextdone" onClick={() => onToggle(next.id)}>{next.done ? "Reopen" : "Mark done"}</button></section>{plain(rest)}</>); }
    case "margin": return wrap(<ul>{tasks.map((t) => <li key={t.id} className="lk-row" data-done={t.done || undefined} data-late={t.late || undefined}><span className="lk-margin">{t.dueLabel || "—"}</span><Check t={t} onToggle={onToggle} /><Open t={t} onOpen={onOpen}><b>{t.title}</b>{t.assignee && <small>{t.assignee}</small>}</Open></li>)}</ul>);
    case "bloom": return wrap(<ul>{tasks.map((t, i) => <li key={t.id} className="lk-row" data-done={t.done || undefined} style={{ background: TILE_COLORS[i % 4], color: "#17132e" }}><Check t={t} onToggle={onToggle} /><Open t={t} onOpen={onOpen} /></li>)}</ul>);
    case "timeline": case "grove": return wrap(groups((t) => t.done ? "Done" : t.late ? "Overdue" : t.dueLabel || "Anytime").map(([k, rows]) => <section key={k}><h3>{k}</h3>{plain(rows)}</section>));
    case "console": return wrap(<><p className="lk-prompt">$ tasks --open {open.length}</p><ul>{tasks.map((t) => <li key={t.id} className="lk-row" data-done={t.done || undefined}><button type="button" className="lk-ascii" aria-pressed={t.done} aria-label={t.done ? `Reopen ${t.title}` : `Complete ${t.title}`} onClick={() => onToggle(t.id)}>[{t.done ? "x" : " "}]</button><Open t={t} onOpen={onOpen} /></li>)}</ul></>);
    case "swiss": return wrap(<ol>{tasks.map((t, i) => <li key={t.id} className="lk-row" data-done={t.done || undefined}><span className="lk-num">{String(i + 1).padStart(2, "0")}</span><Open t={t} onOpen={onOpen} /><Check t={t} onToggle={onToggle} /></li>)}</ol>);
    case "cassette": return wrap(<><header className="lk-label"><b>Today’s mixtape</b><span>{open.length} tracks left</span></header><ol>{tasks.map((t, i) => <li key={t.id} className="lk-row" data-done={t.done || undefined}><span className="lk-num">{i < 5 ? "A" : "B"}{(i % 5) + 1}</span><Open t={t} onOpen={onOpen} /><Check t={t} onToggle={onToggle} /></li>)}</ol></>);
    case "frost": { const pct = Math.round(((tasks.length - open.length) / tasks.length) * 100); return wrap(<><div className="lk-ring" style={{ background: `conic-gradient(var(--an-violet) ${pct}%, var(--an-line) 0)` }}><span>{pct}%<small>done</small></span></div>{plain(tasks)}</>); }
    case "gazette": { const [lead, ...rest] = tasks; return wrap(<><article className="lk-lead"><Check t={lead} onToggle={onToggle} /><Open t={lead} onOpen={onOpen}><b>{lead.title}</b>{lead.notes && <small>{lead.notes.split("\n")[0]}</small>}<small>{lead.dueLabel}</small></Open></article>{plain(rest)}</>); }
    case "punch": return wrap(plain(tasks));
    case "chatline": return wrap(<ul>{tasks.map((t) => <li key={t.id} className="lk-row" data-done={t.done || undefined}><Open t={t} onOpen={onOpen} /><Check t={t} onToggle={onToggle} /></li>)}</ul>);
    case "deck": { const list = open.length ? open : tasks; const i = at % list.length, t = list[i]; return wrap(<><div className="lk-card" style={{ background: TILE_COLORS[i % 4] }}><small>{i + 1} of {list.length}</small><button type="button" className="lk-cardtitle" onClick={() => onOpen(t.id)}>{t.title}</button><small>{[t.dueLabel, t.assignee].filter(Boolean).join(" · ")}</small></div><div className="lk-cardnav"><button type="button" onClick={() => setAt(i + 1)}>Next</button><button type="button" onClick={() => onToggle(t.id)}>{t.done ? "Reopen" : "Done"}</button></div></>); }
    default: return wrap(plain(tasks));
  }
}

// ─── Calendar: what's coming up, drawn for the look above the month ───
export type AgendaDay = { date: string; weekday: string; day: string; month: string; items: { id: string; time: string; title: string }[] };
export function LookAgenda({ look, days, onPick }: { look: NotesTheme; days: AgendaDay[]; onPick: (date: string) => void }) {
  const shown = days.filter((d) => d.items.length).slice(0, 6);
  return <section className={`lk-agenda lk-agenda-${look.id}`} data-testid="look-agenda">
    <h2>{look.id === "console" ? "$ upcoming" : look.id === "gazette" ? "The week ahead" : look.id === "cassette" ? "Up next on the tape" : "Coming up"}</h2>
    {shown.length ? <div className="lk-days">{shown.map((d) => <button type="button" key={d.date} className="lk-day" onClick={() => onPick(d.date)}>
      <span className="lk-date"><small>{d.weekday}</small><b>{d.day}</b><small>{d.month}</small></span>
      <span className="lk-items">{d.items.slice(0, 3).map((x) => <span key={x.id}><em>{x.time}</em>{x.title}</span>)}{d.items.length > 3 && <span><em /> +{d.items.length - 3} more</span>}</span>
    </button>)}</div> : <p className="lk-none">Nothing in the next two weeks.</p>}
  </section>;
}
