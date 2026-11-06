// The Studio series (shared/protoLooks.ts): each look is a whole arrangement of Home, the list,
// recording, the note heading, the bottom bar and (in the hubs) the top of Home, tasks and agenda.
// A look names its arrangement in `look.arch`; the pieces for each arrangement are below, and
// protoLooks.css dresses them with the look's colors and type.
import { type CSSProperties, type ReactNode } from "react";
import { fmtClock, templateOf, type NotesTheme } from "@shared/ariseNotes";
import type { ListNote } from "./api";
import type { HomeActions } from "./looks";
import "./protoLooks.css";

export const hasArch = (look: NotesTheme | null | undefined): look is NotesTheme & { arch: string } => !!look?.arch;

const Svg = ({ children, size = 22, w = 2.4 }: { children: ReactNode; size?: number; w?: number }) => <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
export const IcMic = ({ size = 22 }: { size?: number }) => <Svg size={size}><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></Svg>;
export const IcSearch = ({ size = 20 }: { size?: number }) => <Svg size={size}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
export const IcGear = ({ size = 20 }: { size?: number }) => <Svg size={size}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></Svg>;
export const IcFlag = ({ size = 22 }: { size?: number }) => <Svg size={size}><path d="M5 3v18M5 4h12l-2 4 2 4H5" /></Svg>;
const Stop = ({ size = 22 }: { size?: number }) => <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>;

const STATUS: Record<string, string> = { recording: "Recording", processing: "Writing down…", no_minutes: "Out of minutes", failed: "Needs a retry" };
const dayWord = (iso: string) => {
  const d = new Date(iso); if (Number.isNaN(+d)) return "";
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const diff = Math.round((+t0 - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 864e5);
  return diff <= 0 ? "Today" : diff === 1 ? "Yesterday" : diff < 7 ? d.toLocaleDateString(undefined, { weekday: "short" }) : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const mins = (n: ListNote) => (n.durationSecs > 0 ? `${Math.max(1, Math.round(n.durationSecs / 60))} min` : "");
const kindOf = (n: ListNote) => (n.source === "memo" ? "Voice memo" : templateOf(n.template).label);
const metaOf = (n: ListNote) => [dayWord(n.createdAt), mins(n)].filter(Boolean).join(" · ");
const two = (i: number) => String(i + 1).padStart(2, "0");

// ───────────────────────── Billboard ─────────────────────────
function BillboardHero({ a }: { a: HomeActions }) {
  return <>
    <header className="pl-bb-top"><b>NOTES / {a.count ?? 0}</b><span>
      <button type="button" aria-label="Ask or search your notes" onClick={a.ask} data-testid="notes-ask-bar"><IcSearch /></button>
      {a.settings && <button type="button" aria-label="Settings" onClick={a.settings}><IcGear /></button>}
    </span></header>
    <div className="pl-bb-sub"><button type="button" onClick={a.upload} data-testid="notes-upload">Upload</button><button type="button" onClick={a.memo} data-testid="notes-memo">Memo{a.memoLocked ? " · Basic" : ""}</button><button type="button" onClick={a.ask}>Ask</button></div>
  </>;
}
function BillboardList({ notes, onOpen }: { notes: ListNote[]; onOpen: (n: ListNote) => void }) {
  return <ol className="pl-bb-list">{notes.map((n, i) => <li key={n.id}><button type="button" className="pl-bb-row" onClick={() => onOpen(n)} data-testid="notes-card">
    <span className="pl-bb-n">{two(i)}</span>
    <span className="pl-bb-t"><b>{n.title || "Untitled note"}{STATUS[n.status] ? <em> · {STATUS[n.status]}</em> : null}</b><small>{metaOf(n)}{n.folder ? ` · ${n.folder}` : ""}</small></span>
  </button></li>)}</ol>;
}
function BillboardBar({ on, record, notes, home }: { on: "ai" | "pages"; record: () => void; notes: () => void; home: () => void }) {
  return <nav aria-label="Arise Notes" className="an-noprint pl-bb-bar" data-testid="notes-tabs">
    <button type="button" className="pl-bb-rec" onClick={record} data-testid="notes-tab-record"><IcMic size={26} />Record</button>
    {on === "ai" ? <button type="button" className="pl-bb-alt" onClick={notes} data-testid="notes-tab-pages">Write</button> : <button type="button" className="pl-bb-alt" onClick={home} data-testid="notes-tab-ai">Notes</button>}
  </nav>;
}
function BillboardRecord({ secs, live, level, clock }: { secs: number; live: boolean; level: number; clock: string }) {
  const parts = clock.split(":"), [a, b] = parts.length === 2 ? [parts[0].padStart(2, "0"), `:${parts[1]}`] : [clock, ""];
  return <>
    <div className="pl-bb-clock" aria-label={`${clock} recorded`}>{a}{b && <><br />{b}</>}</div>
    <div aria-hidden className="pl-bb-bars">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ height: live ? Math.max(8, Math.max(level, .3) * 110 * (.35 + .65 * Math.abs(Math.sin(i * 1.7 + secs)))) : 8 }} />)}</div>
  </>;
}
function BillboardNoteTitle({ title, meta }: { title: string; meta: string }) {
  return <header className="pl-bb-note"><p>{meta}</p><h1>{title}</h1></header>;
}

// ───────────────────────── The pieces the app calls ─────────────────────────
/** The top of Home. */
export function protoHero(look: NotesTheme, a: HomeActions): ReactNode {
  switch (look.arch) {
    case "billboard": return <BillboardHero a={a} />;
    default: return null;
  }
}
/** The notes list. */
export function ProtoList({ look, notes, onOpen }: { look: NotesTheme; notes: ListNote[]; onOpen: (n: ListNote) => void }) {
  switch (look.arch) {
    case "billboard": return <BillboardList notes={notes} onOpen={onOpen} />;
    default: return null;
  }
}
/** The bottom bar. */
export function ProtoTabBar({ look, on, record, notes, home }: { look: NotesTheme; on: "ai" | "pages"; initial: string; home: () => void; notes: () => void; record: () => void; settings: () => void }) {
  switch (look.arch) {
    case "billboard": return <BillboardBar on={on} record={record} notes={notes} home={home} />;
    default: return null;
  }
}
/** The timer and meter while recording. */
export function protoRecordArt(look: NotesTheme, p: { secs: number; paused: boolean; finishing: boolean; level: number }): ReactNode {
  const live = !p.paused && !p.finishing;
  const clock = fmtClock(p.secs);
  switch (look.arch) {
    case "billboard": return <BillboardRecord secs={p.secs} live={live} level={p.level} clock={clock} />;
    default: return null;
  }
}
/** The big title at the top of a note. */
export function ProtoNoteTitle({ look, title, meta }: { look: NotesTheme; title: string; meta: string }) {
  switch (look.arch) {
    case "billboard": return <BillboardNoteTitle title={title} meta={meta} />;
    default: return null;
  }
}

// ───────────────────────── To Duo and WorkHub ─────────────────────────
export type ProtoHubLink = { label: string; onClick: () => void };
export function ProtoHubHero({ look, date, greeting, primary, links }: { look: NotesTheme; date: string; greeting: string; primary: ProtoHubLink; links: ProtoHubLink[] }): ReactNode {
  switch (look.arch) {
    case "billboard": return <>
      <p className="pl-bb-eyebrow">{date}</p>
      <h1 className="pl-bb-hubtitle">{greeting}</h1>
      <button type="button" className="pl-bb-hubmain" onClick={primary.onClick} data-testid="hub-look-primary"><IcMic size={24} />{primary.label}</button>
      <div className="pl-bb-sub">{links.slice(0, 3).map((l) => <button key={l.label} type="button" onClick={l.onClick}>{l.label}</button>)}</div>
    </>;
    default: return null;
  }
}
export type ProtoTask = { id: string; title: string; done: boolean; due: string; late: boolean; dueLabel: string; listName: string; color: string; assignee: string; notes: string };
export function ProtoTasks({ look, tasks, onToggle, onOpen }: { look: NotesTheme; tasks: ProtoTask[]; onToggle: (id: string) => void; onOpen: (id: string) => void }): ReactNode {
  switch (look.arch) {
    case "billboard": return <ol className="pl-bb-list pl-bb-tasks">{tasks.map((t, i) => <li key={t.id} data-done={t.done || undefined} data-late={t.late || undefined}>
      <button type="button" className="pl-bb-check" aria-pressed={t.done} aria-label={t.done ? `Reopen ${t.title}` : `Complete ${t.title}`} onClick={() => onToggle(t.id)}>{t.done ? "✓" : ""}</button>
      <button type="button" className="pl-bb-row" onClick={() => onOpen(t.id)}><span className="pl-bb-n">{two(i)}</span><span className="pl-bb-t"><b>{t.title}</b><small>{[t.late ? "Overdue" : "", t.dueLabel, t.listName, t.assignee].filter(Boolean).join(" · ")}</small></span></button>
    </li>)}</ol>;
    default: return null;
  }
}
export type ProtoAgendaDay = { date: string; weekday: string; day: string; month: string; items: { id: string; time: string; title: string }[] };
export function ProtoAgenda({ look, days, onPick }: { look: NotesTheme; days: ProtoAgendaDay[]; onPick: (date: string) => void }): ReactNode {
  switch (look.arch) {
    case "billboard": return <div className="pl-bb-agenda">{days.map((d) => <button type="button" key={d.date} className="pl-bb-day" onClick={() => onPick(d.date)}>
      <span className="pl-bb-date"><small>{d.weekday}</small><b>{d.day}</b><small>{d.month}</small></span>
      <span className="pl-bb-items">{d.items.slice(0, 3).map((x) => <span key={x.id}><em>{x.time}</em>{x.title}</span>)}{d.items.length > 3 && <span><em /> +{d.items.length - 3} more</span>}</span>
    </button>)}</div>;
    default: return null;
  }
}
export const archClass = (look: NotesTheme | null | undefined) => (look?.arch ? ` pl pl-${look.arch}` : "");
export type { CSSProperties };
