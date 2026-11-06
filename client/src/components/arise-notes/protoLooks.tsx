// The Studio series (shared/protoLooks.ts): each look is a whole arrangement of Home, the list,
// recording, the note heading, the bottom bar and (in the hubs) the top of Home, tasks and agenda.
// A look names its arrangement in `look.arch`; the pieces for each arrangement are below, and
// protoLooks.css dresses them with the look's colors and type.
import { type CSSProperties, type ReactNode } from "react";
import { fmtClock, templateOf, type NotesTheme } from "@shared/ariseNotes";
import type { ListNote } from "./api";
import type { HomeActions } from "./looks";
import { bespokeHero, BespokeList, bespokeBar } from "./protoLooks2";
import "./protoLooks.css";
import "./protoLooks2.css";
import "./protoPages.css";

export const hasArch = (look: NotesTheme | null | undefined): look is NotesTheme & { arch: string } => !!look?.arch;

export const Svg = ({ children, size = 22, w = 2.4 }: { children: ReactNode; size?: number; w?: number }) => <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
export const IcMic = ({ size = 22 }: { size?: number }) => <Svg size={size}><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></Svg>;
export const IcSearch = ({ size = 20 }: { size?: number }) => <Svg size={size}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
export const IcGear = ({ size = 20 }: { size?: number }) => <Svg size={size}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></Svg>;
export const IcFlag = ({ size = 22 }: { size?: number }) => <Svg size={size}><path d="M5 3v18M5 4h12l-2 4 2 4H5" /></Svg>;
const Stop = ({ size = 22 }: { size?: number }) => <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>;

export const STATUS: Record<string, string> = { recording: "Recording", processing: "Writing down…", no_minutes: "Out of minutes", failed: "Needs a retry" };
export const dayWord = (iso: string) => {
  const d = new Date(iso); if (Number.isNaN(+d)) return "";
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const diff = Math.round((+t0 - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 864e5);
  return diff <= 0 ? "Today" : diff === 1 ? "Yesterday" : diff < 7 ? d.toLocaleDateString(undefined, { weekday: "short" }) : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
export const mins = (n: ListNote) => (n.durationSecs > 0 ? `${Math.max(1, Math.round(n.durationSecs / 60))} min` : "");
export const kindOf = (n: ListNote) => (n.source === "memo" ? "Voice memo" : templateOf(n.template).label);
export const metaOf = (n: ListNote) => [dayWord(n.createdAt), mins(n)].filter(Boolean).join(" · ");
export const two = (i: number) => String(i + 1).padStart(2, "0");

// ───────────────────────── Billboard ─────────────────────────
function BillboardHero({ a }: { a: HomeActions }) {
  return <>
    <header className="stx-bb-top"><b>NOTES / {a.count ?? 0}</b><span>
      <button type="button" aria-label="Ask or search your notes" onClick={a.ask} data-testid="notes-ask-bar"><IcSearch /></button>
      {a.settings && <button type="button" aria-label="Settings" onClick={a.settings}><IcGear /></button>}
    </span></header>
    <div className="stx-bb-sub"><button type="button" onClick={a.upload} data-testid="notes-upload">Upload</button><button type="button" onClick={a.memo} data-testid="notes-memo">Memo{a.memoLocked ? " · Basic" : ""}</button><button type="button" onClick={a.ask}>Ask</button></div>
  </>;
}
function BillboardList({ notes, onOpen }: { notes: ListNote[]; onOpen: (n: ListNote) => void }) {
  return <ol className="stx-bb-list">{notes.map((n, i) => <li key={n.id}><button type="button" className="stx-bb-row" onClick={() => onOpen(n)} data-testid="notes-card">
    <span className="stx-bb-n">{two(i)}</span>
    <span className="stx-bb-t"><b>{n.title || "Untitled note"}{STATUS[n.status] ? <em> · {STATUS[n.status]}</em> : null}</b><small>{metaOf(n)}{n.folder ? ` · ${n.folder}` : ""}</small></span>
  </button></li>)}</ol>;
}
function BillboardBar({ on, record, notes, home }: { on: "ai" | "pages"; record: () => void; notes: () => void; home: () => void }) {
  return <nav aria-label="Arise Notes" className="an-noprint stx-bb-bar" data-testid="notes-tabs">
    <button type="button" className="stx-bb-rec" onClick={record} data-testid="notes-tab-record"><IcMic size={26} />Record</button>
    {on === "ai" ? <button type="button" className="stx-bb-alt" onClick={notes} data-testid="notes-tab-pages">Write</button> : <button type="button" className="stx-bb-alt" onClick={home} data-testid="notes-tab-ai">Notes</button>}
  </nav>;
}
function BillboardRecord({ secs, live, level, clock }: { secs: number; live: boolean; level: number; clock: string }) {
  const parts = clock.split(":"), [a, b] = parts.length === 2 ? [parts[0].padStart(2, "0"), `:${parts[1]}`] : [clock, ""];
  return <>
    <div className="stx-bb-clock" aria-label={`${clock} recorded`}>{a}{b && <><br />{b}</>}</div>
    <div aria-hidden className="stx-bb-bars">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ height: live ? Math.max(8, Math.max(level, .3) * 110 * (.35 + .65 * Math.abs(Math.sin(i * 1.7 + secs)))) : 8 }} />)}</div>
  </>;
}
function BillboardNoteTitle({ title, meta }: { title: string; meta: string }) {
  return <header className="stx-bb-note"><p>{meta}</p><h1>{title}</h1></header>;
}

// ───────────────────────── Shared pieces for the Studio arrangements ─────────────────────────
export const IconBtns = ({ a, plus }: { a: HomeActions; plus?: boolean }) => <span className="stx-icons">
  <button type="button" aria-label="Ask or search your notes" onClick={a.ask} data-testid="notes-ask-bar"><IcSearch /></button>
  {a.settings && <button type="button" aria-label="Settings" onClick={a.settings}><IcGear /></button>}
  {plus && null}
</span>;
export const Chips = ({ a, ask = true }: { a: HomeActions; ask?: boolean }) => <div className="stx-chips">
  <button type="button" onClick={a.upload} data-testid="notes-upload">Upload</button>
  <button type="button" onClick={a.memo} data-testid="notes-memo">Voice memo{a.memoLocked ? " · Basic" : ""}</button>
  {ask && <button type="button" onClick={a.ask}>Ask</button>}
</div>;
export const Head = ({ a, crumb, title, sub }: { a: HomeActions; crumb: string; title: string; sub?: string }) => <header className="stx-head">
  <div><span className="stx-kk">A.R.I.S.E. NOTES / {crumb}</span><h1>{title}</h1>{sub && <p>{sub}</p>}</div><IconBtns a={a} />
</header>;
export const gist = (n: ListNote) => n.gist || [kindOf(n), n.actions > 0 ? `${n.actions} to-do${n.actions === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ");
export const label = (n: ListNote) => (n.folder || kindOf(n));
export const Title = ({ n }: { n: ListNote }) => <>{n.title || "Untitled note"}{STATUS[n.status] ? <em> · {STATUS[n.status]}</em> : null}</>;
/** Two buttons along the bottom: Record, and the second action. */
export function Bar2({ record, second, secondLabel, on }: { record: () => void; second: () => void; secondLabel: string; on?: string }) {
  return <nav aria-label="Arise Notes" className="an-noprint stx-bar2" data-testid="notes-tabs" data-on={on}>
    <button type="button" className="stx-b-out" onClick={record} data-testid="notes-tab-record"><IcMic size={18} />Record</button>
    <button type="button" className="stx-b-pri" onClick={second} data-testid="notes-tab-pages"><svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>{secondLabel}</button>
  </nav>;
}
const sameDay = (iso: string, d: Date) => { const x = new Date(iso); return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate(); };
const hsOf = (look: NotesTheme): CSSProperties | undefined => (look.hs ? ({ ["--pl-hs" as string]: `${look.hs}px` } as CSSProperties) : undefined);

// Index: a precise list, each note a ruled row with its group, title and first lines.
function IndexHero({ a }: { a: HomeActions }) { return <><Head a={a} crumb="INDEX" title="Index" sub="A precise workspace for every note" /><Chips a={a} /><div className="stx-kk stx-label">Document index</div></>; }
function IndexList({ notes, onOpen }: { notes: ListNote[]; onOpen: (n: ListNote) => void }) {
  return <ul className="stx-ix">{notes.map((n) => <li key={n.id}><button type="button" className="stx-ix-row" onClick={() => onOpen(n)} data-testid="notes-card">
    <span className="stx-kk">{label(n)}</span><b><Title n={n} /></b><span className="stx-ix-g">{gist(n)}</span><small>{metaOf(n)}</small>
  </button></li>)}</ul>;
}
// Chronicle: a week strip, then your notes down a timeline.
function ChronHero({ a }: { a: HomeActions }) { return <><Head a={a} crumb="CHRONICLE" title="Chronicle" sub="Your ideas, over time" /><Chips a={a} /></>; }
function ChronList({ notes, onOpen }: { notes: ListNote[]; onOpen: (n: ListNote) => void }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() - 2 + i); return d; });
  return <>
    <div className="stx-kk stx-label">{today.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
    <ol className="stx-week" aria-label="This week">{days.map((d, i) => <li key={i} data-on={i === 2 || undefined} data-has={notes.some((n) => sameDay(n.createdAt, d)) || undefined}><small>{d.toLocaleDateString(undefined, { weekday: "narrow" })}</small><b>{d.getDate()}</b></li>)}</ol>
    <div className="stx-kk stx-label">Your timeline</div>
    <ul className="stx-tl">{notes.map((n) => <li key={n.id}><button type="button" onClick={() => onOpen(n)} data-testid="notes-card"><span className="stx-kk">{label(n)}</span><b><Title n={n} /></b><span className="stx-ix-g">{gist(n)}</span><small>{metaOf(n)}</small></button></li>)}</ul>
  </>;
}
// Editorial: one headline, then your writing as a plain list of titles.
function EditHero({ look, a }: { look: NotesTheme; a: HomeActions }) {
  return <><div className="stx-top"><span className="stx-kk">A.R.I.S.E. NOTES</span><IconBtns a={a} /></div>
    <h1 className="stx-hl" style={hsOf(look)}>{look.hl}</h1>
    <div className="stx-btns"><button type="button" className="stx-b-pri" onClick={a.pages ?? a.record}>Start writing <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M8 7h9v9" /></svg></button><button type="button" className="stx-b-out" onClick={a.upload} data-testid="notes-upload">Upload</button><button type="button" className="stx-b-out" onClick={a.memo} data-testid="notes-memo">Memo{a.memoLocked ? " · Basic" : ""}</button></div>
    <div className="stx-kk stx-label">Your writing</div></>;
}
function EditList({ notes, onOpen }: { notes: ListNote[]; onOpen: (n: ListNote) => void }) {
  return <ul className="stx-ed">{notes.map((n) => <li key={n.id}><button type="button" onClick={() => onOpen(n)} data-testid="notes-card"><b><Title n={n} /></b><small>{dayWord(n.createdAt)}</small></button></li>)}</ul>;
}
// Field Notes: a status console with a grid of records.
function ConsHero({ look, a }: { look: NotesTheme; a: HomeActions }) {
  return <><Head a={a} crumb="FIELD NOTES" title="FIELD / NOTES" sub="CAPTURE SYSTEM — ACTIVE" />
    <div className="stx-kk stx-label">System status / online</div><h1 className="stx-hl" style={hsOf(look)}>{look.hl}</h1>
    <div className="stx-btns"><button type="button" className="stx-b-pri" onClick={a.record} data-testid="notes-record"><IcMic size={16} />CAPTURE</button><button type="button" className="stx-b-out" onClick={a.memo} data-testid="notes-memo">VOICE{a.memoLocked ? " · BASIC" : ""}</button><button type="button" className="stx-b-out" onClick={a.pages ?? a.ask}>INDEX</button></div>
    <div className="stx-kk stx-label">Latest records / {String(a.count ?? 0).padStart(3, "0")}</div></>;
}
function ConsList({ notes, onOpen, onUpload }: { notes: ListNote[]; onOpen: (n: ListNote) => void; onUpload?: () => void }) {
  return <ul className="stx-grid">{notes.map((n) => <li key={n.id}><button type="button" onClick={() => onOpen(n)} data-testid="notes-card"><span className="stx-kk">{label(n)}</span><b><Title n={n} /></b><span className="stx-ix-g">{gist(n)}</span><small>{metaOf(n)}</small></button></li>)}
    {onUpload && <li className="stx-new"><button type="button" onClick={onUpload}>+ New record</button></li>}</ul>;
}
// Atlas: an overview card, collections as tiles, then what's recent.
function AtlasHero({ look, a }: { look: NotesTheme; a: HomeActions }) {
  return <><Head a={a} crumb="ATLAS" title="Atlas" sub="Your ideas, organized" />
    <div className="stx-card"><span className="stx-kk">Workspace overview</span><h2 className="stx-hl" style={hsOf(look)}>{look.hl?.replace(/^\d+ notes\./, `${a.count ?? 0} notes.`)}</h2><div className="stx-btns"><button type="button" className="stx-b-pri" onClick={a.record} data-testid="notes-record">Record</button><button type="button" className="stx-b-out" onClick={a.upload} data-testid="notes-upload">Upload</button><button type="button" className="stx-b-out" onClick={a.memo} data-testid="notes-memo">Memo{a.memoLocked ? " · Basic" : ""}</button></div></div></>;
}
function AtlasList({ notes, onOpen }: { notes: ListNote[]; onOpen: (n: ListNote) => void }) {
  const groups = new Map<string, ListNote[]>();
  for (const n of notes) { const k = n.folder || kindOf(n); groups.set(k, [...(groups.get(k) ?? []), n]); }
  const tiles = [...groups].slice(0, 4);
  return <>
    <h2 className="stx-h2">Collections</h2>
    <ul className="stx-tiles">{tiles.map(([k, list]) => <li key={k}><button type="button" onClick={() => onOpen(list[0])}><span aria-hidden className="stx-tile-i"><IcMic size={22} /></span><b>{k}</b><small>{list.length} note{list.length === 1 ? "" : "s"}</small></button></li>)}</ul>
    <div className="stx-kk stx-label">Recent</div>
    <ul className="stx-ix">{notes.slice(0, 6).map((n) => <li key={n.id}><button type="button" className="stx-ix-row" onClick={() => onOpen(n)} data-testid="notes-card"><b><Title n={n} /></b><small>{metaOf(n)}</small></button></li>)}</ul>
  </>;
}
// Stream: one big line, then a stream of notes down a dotted rule.
function StreamHero({ look, a }: { look: NotesTheme; a: HomeActions }) {
  return <><div className="stx-top"><span className="stx-kk stx-ink">A.R.I.S.E. / NOTES</span><IconBtns a={a} /></div><h1 className="stx-hl" style={hsOf(look)}>{look.hl}</h1><Chips a={a} /></>;
}
function StreamList({ notes, onOpen }: { notes: ListNote[]; onOpen: (n: ListNote) => void }) {
  return <ul className="stx-st">{notes.map((n) => <li key={n.id}><button type="button" onClick={() => onOpen(n)} data-testid="notes-card"><b><Title n={n} /></b><span className="stx-ix-g">{gist(n)}</span><span className="stx-kk">{label(n)} · {dayWord(n.createdAt)}</span></button></li>)}</ul>;
}
function StreamBar({ on, home, notes, record, settings }: { on: "ai" | "pages"; home: () => void; notes: () => void; record: () => void; settings: () => void }) {
  const Tab = ({ cur, onClick, icon, text, tid }: { cur?: boolean; onClick: () => void; icon: ReactNode; text: string; tid: string }) => <button type="button" aria-current={cur ? "page" : undefined} onClick={onClick} data-testid={tid}>{icon}<span>{text}</span></button>;
  return <>
    <button type="button" className="stx-fab" aria-label="New recording" onClick={record} data-testid="notes-tab-record"><svg aria-hidden width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
    <nav aria-label="Arise Notes" className="an-noprint stx-tabs" data-testid="notes-tabs">
      <Tab cur={on === "ai"} onClick={home} tid="notes-tab-ai" text="Home" icon={<Svg size={20} w={2}><path d="M4 11.5 12 4l8 7.5V19a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z" /></Svg>} />
      <Tab cur={on === "pages"} onClick={notes} tid="notes-tab-pages" text="Notes" icon={<Svg size={20} w={2}><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></Svg>} />
      <Tab onClick={record} tid="notes-tab-rec" text="Record" icon={<IcMic size={20} />} />
      <Tab onClick={settings} tid="notes-tab-settings" text="Settings" icon={<IcGear size={20} />} />
    </nav>
  </>;
}
/** The recording display shared by the Studio arrangements: a wave, rings, or a live-transcript header. */
export function StudioRecord({ style, secs, live, level, clock }: { style: string; secs: number; live: boolean; level: number; clock: string }) {
  const bars = Array.from({ length: 25 }, (_, i) => live ? Math.max(8, Math.max(level, .3) * 72 * (.3 + .7 * Math.abs(Math.sin(i * 1.7 + secs)))) : 8);
  if (style === "ring") return <><div className="stx-rings" aria-hidden><i /><i /><i /><span /></div><div className="stx-clock stx-clock-ring" aria-label={`${clock} recorded`}>{clock}</div></>;
  if (style === "tx") return <div className="stx-txhead"><span className="stx-clock-sm" aria-label={`${clock} recorded`}>● {clock}</span><span aria-hidden className="stx-minibars">{bars.slice(0, 12).map((h, i) => <i key={i} style={{ height: Math.max(4, h / 3) }} />)}</span></div>;
  return <><div className="stx-clock" aria-label={`${clock} recorded`}>{clock}</div><div aria-hidden className="stx-wavebars">{bars.map((h, i) => <i key={i} data-hot={i > 14 || undefined} style={{ height: h }} />)}</div></>;
}

// ───────────────────────── The pieces the app calls ─────────────────────────
/** The top of Home. */
export function protoHero(look: NotesTheme, a: HomeActions): ReactNode {
  switch (look.arch) {
    case "billboard": return <BillboardHero a={a} />;
    case "index": return <IndexHero a={a} />;
    case "chron": return <ChronHero a={a} />;
    case "edit": return <EditHero look={look} a={a} />;
    case "cons": return <ConsHero look={look} a={a} />;
    case "atlas": return <AtlasHero look={look} a={a} />;
    case "stream": return <StreamHero look={look} a={a} />;
    default: return bespokeHero(look, a);
  }
}
/** The notes list. */
export function ProtoList({ look, notes, onOpen }: { look: NotesTheme; notes: ListNote[]; onOpen: (n: ListNote) => void }) {
  switch (look.arch) {
    case "billboard": return <BillboardList notes={notes} onOpen={onOpen} />;
    case "index": return <IndexList notes={notes} onOpen={onOpen} />;
    case "chron": return <ChronList notes={notes} onOpen={onOpen} />;
    case "edit": return <EditList notes={notes} onOpen={onOpen} />;
    case "cons": return <ConsList notes={notes} onOpen={onOpen} />;
    case "atlas": return <AtlasList notes={notes} onOpen={onOpen} />;
    case "stream": return <StreamList notes={notes} onOpen={onOpen} />;
    default: return <BespokeList look={look} notes={notes} onOpen={onOpen} />;
  }
}
/** The bottom bar. */
export function ProtoTabBar({ look, on, record, notes, home, settings }: { look: NotesTheme; on: "ai" | "pages"; initial: string; home: () => void; notes: () => void; record: () => void; settings: () => void }) {
  switch (look.arch) {
    case "billboard": return <BillboardBar on={on} record={record} notes={notes} home={home} />;
    case "stream": return <StreamBar on={on} home={home} notes={notes} record={record} settings={settings} />;
    case "index": case "chron": case "edit": case "cons": case "atlas":
      return on === "ai" ? <Bar2 record={record} second={notes} secondLabel="New note" on={on} /> : <Bar2 record={record} second={home} secondLabel="Home" on={on} />;
    default: return bespokeBar(look, on, record, notes, home);
  }
}
/** The timer and meter while recording. */
export function protoRecordArt(look: NotesTheme, p: { secs: number; paused: boolean; finishing: boolean; level: number }): ReactNode {
  const live = !p.paused && !p.finishing;
  const clock = fmtClock(p.secs);
  switch (look.arch) {
    case "billboard": return <BillboardRecord secs={p.secs} live={live} level={p.level} clock={clock} />;
    default:
      return <StudioRecord style={look.rec ?? "wave"} secs={p.secs} live={live} level={p.level} clock={clock} />;
  }
}
/** The big title at the top of a note. */
export function ProtoNoteTitle({ look, title, meta }: { look: NotesTheme; title: string; meta: string }) {
  switch (look.arch) {
    case "billboard": return <BillboardNoteTitle title={title} meta={meta} />;
    default:
      return <header className="stx-note" style={look.ns ? { ["--pl-ns" as string]: `${look.ns}px` } : undefined}><p className="stx-kk">{meta}</p><h1>{title}</h1></header>;
  }
}

// ───────────────────────── To Duo and WorkHub ─────────────────────────
export type ProtoHubLink = { label: string; onClick: () => void };
export function ProtoHubHero({ look, date, greeting, primary, links }: { look: NotesTheme; date: string; greeting: string; primary: ProtoHubLink; links: ProtoHubLink[] }): ReactNode {
  switch (look.arch) {
    case "billboard": return <>
      <p className="stx-bb-eyebrow">{date}</p>
      <h1 className="stx-bb-hubtitle">{greeting}</h1>
      <button type="button" className="stx-bb-hubmain" onClick={primary.onClick} data-testid="hub-look-primary"><IcMic size={24} />{primary.label}</button>
      <div className="stx-bb-sub">{links.slice(0, 3).map((l) => <button key={l.label} type="button" onClick={l.onClick}>{l.label}</button>)}</div>
    </>;
    default: return <>
      <p className="stx-kk">{date}</p>
      <h1 className="stx-hubtitle">{greeting}</h1>
      <button type="button" className="stx-b-pri stx-hubmain" onClick={primary.onClick} data-testid="hub-look-primary"><IcMic size={20} />{primary.label}</button>
      <div className="stx-chips">{links.slice(0, 3).map((l) => <button key={l.label} type="button" onClick={l.onClick}>{l.label}</button>)}</div>
    </>;
  }
}
export type ProtoTask = { id: string; title: string; done: boolean; due: string; late: boolean; dueLabel: string; listName: string; color: string; assignee: string; notes: string };
export function ProtoTasks({ look, tasks, onToggle, onOpen }: { look: NotesTheme; tasks: ProtoTask[]; onToggle: (id: string) => void; onOpen: (id: string) => void }): ReactNode {
  switch (look.arch) {
    case "billboard": return <ol className="stx-bb-list stx-bb-tasks">{tasks.map((t, i) => <li key={t.id} data-done={t.done || undefined} data-late={t.late || undefined}>
      <button type="button" className="stx-bb-check" aria-pressed={t.done} aria-label={t.done ? `Reopen ${t.title}` : `Complete ${t.title}`} onClick={() => onToggle(t.id)}>{t.done ? "✓" : ""}</button>
      <button type="button" className="stx-bb-row" onClick={() => onOpen(t.id)}><span className="stx-bb-n">{two(i)}</span><span className="stx-bb-t"><b>{t.title}</b><small>{[t.late ? "Overdue" : "", t.dueLabel, t.listName, t.assignee].filter(Boolean).join(" · ")}</small></span></button>
    </li>)}</ol>;
    default: return <ul className="stx-tasks">{tasks.map((t) => <li key={t.id} data-done={t.done || undefined} data-late={t.late || undefined}>
      <button type="button" className="stx-check" aria-pressed={t.done} aria-label={t.done ? `Reopen ${t.title}` : `Complete ${t.title}`} onClick={() => onToggle(t.id)}>{t.done ? "✓" : ""}</button>
      <button type="button" className="stx-trow" onClick={() => onOpen(t.id)}><b>{t.title}</b><small>{[t.late ? "Overdue" : "", t.dueLabel, t.listName, t.assignee].filter(Boolean).join(" · ")}</small></button>
    </li>)}</ul>;
  }
}
export type ProtoAgendaDay = { date: string; weekday: string; day: string; month: string; items: { id: string; time: string; title: string }[] };
export function ProtoAgenda({ look, days, onPick }: { look: NotesTheme; days: ProtoAgendaDay[]; onPick: (date: string) => void }): ReactNode {
  switch (look.arch) {
    case "billboard": return <div className="stx-bb-agenda">{days.map((d) => <button type="button" key={d.date} className="stx-bb-day" onClick={() => onPick(d.date)}>
      <span className="stx-bb-date"><small>{d.weekday}</small><b>{d.day}</b><small>{d.month}</small></span>
      <span className="stx-bb-items">{d.items.slice(0, 3).map((x) => <span key={x.id}><em>{x.time}</em>{x.title}</span>)}{d.items.length > 3 && <span><em /> +{d.items.length - 3} more</span>}</span>
    </button>)}</div>;
    default: return <ul className="stx-agenda">{days.map((d) => <li key={d.date}><button type="button" onClick={() => onPick(d.date)}>
      <span className="stx-date"><small>{d.weekday}</small><b>{d.day}</b></span>
      <span className="stx-items">{d.items.slice(0, 3).map((x) => <span key={x.id}><em>{x.time}</em>{x.title}</span>)}{d.items.length > 3 && <span>+{d.items.length - 3} more</span>}</span>
    </button></li>)}</ul>;
  }
}
export const archClass = (look: NotesTheme | null | undefined) => (look?.arch ? ` stx stx-${look.arch}${look.arch === "billboard" ? "" : " stx-s"}${look.v ? ` stx-v-${look.v}` : ""}` : "");
export type { CSSProperties };
