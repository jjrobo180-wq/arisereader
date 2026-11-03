// The designs behind Settings > Appearance: each look's own Home, recording display and note heading.
// Everything still does the same work as the Classic screens; only the arrangement changes.
import { type CSSProperties, useEffect, useState, type ReactNode } from "react";
import { fmtClock, nightLook, templateOf, themeOf, type NotesTheme, type NotesSettings } from "@shared/ariseNotes";
import type { ListNote } from "./api";

/** The look to draw, or null for Classic. High contrast always uses the Classic layout. */
export function activeLook(settings?: NotesSettings | null): NotesTheme | null {
  if (!settings || settings.contrast || settings.theme === "classic") return null;
  return settings.night ? nightLook(themeOf(settings.theme)) : themeOf(settings.theme);
}

const Svg = ({ children, size = 22 }: { children: ReactNode; size?: number }) => <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
const MicIcon = ({ size }: { size?: number }) => <Svg size={size}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></Svg>;
const WAVE = [8, 18, 12, 28, 40, 22, 14, 32, 44, 26, 10, 20, 36, 16, 30, 42, 24, 12, 34, 18, 8, 26, 38, 20, 14, 30, 22, 10, 16, 6];
const Wave = () => <span aria-hidden className="an-l-wave">{WAVE.map((h, i) => <i key={i} style={{ height: h }} />)}</span>;

export type HomeActions = { first: string; minutes: ReactNode; record: () => void; upload: () => void; memo: () => void; ask: () => void; memoLocked?: boolean };

function Secondary({ a, labels = ["Upload", "Voice memo", "Ask"], ask = true }: { a: HomeActions; labels?: string[]; ask?: boolean }) {
  return <div className={`an-l-secondary${ask ? "" : " an-l-two"}`}>
    <button type="button" onClick={a.upload} data-testid="notes-upload">{labels[0]}</button>
    <button type="button" onClick={a.memo} data-testid="notes-memo">{labels[1]}{a.memoLocked ? " · Basic" : ""}</button>
    {ask && <button type="button" onClick={a.ask} data-testid="notes-ask-bar">{labels[2]}</button>}
  </div>;
}
const AskBar = ({ a, text = "Ask or search your notes" }: { a: HomeActions; text?: string }) => <button type="button" className="an-l-askbar" onClick={a.ask} data-testid="notes-ask-bar">{text}</button>;

/** The top of Home: the title, Record, Upload, Voice memo and Ask, arranged for the look. */
export function LookHomeHero({ look, a }: { look: NotesTheme; a: HomeActions }) {
  const rec = (children: ReactNode, cls = "") => <button type="button" className={`an-l-record ${cls}`} onClick={a.record} data-testid="notes-record">{children}</button>;
  const body = (() => {
    switch (look.id) {
      case "studio": return <>{rec(<><span className="an-l-rectop"><b>Record</b><span className="an-l-recdot"><MicIcon /></span></span><Wave /><small>A meeting, class or visit, live.</small></>)}<Secondary a={a} ask={false} /><AskBar a={a} /></>;
      case "margin": return <><h1>What are we capturing?</h1><AskBar a={a} text="What did I promise Maya’s mom?" />{rec(<><MicIcon size={20} />Record</>)}<Secondary a={a} ask={false} /></>;
      case "bloom": return <><h1>{a.first ? `Hi, ${a.first}. ` : ""}What are we capturing?</h1><div className="an-l-tiles">{rec(<><span className="an-l-recdot"><MicIcon /></span><b>Record</b></>)}<button type="button" onClick={a.upload} data-testid="notes-upload">Upload</button><button type="button" className="an-l-memo" onClick={a.memo} data-testid="notes-memo">Voice memo{a.memoLocked ? " · Basic" : ""}</button></div><AskBar a={a} /></>;
      case "timeline": return <><h1>Your day, in notes</h1>{rec(<><span className="an-l-tdot" /><span><b>Record now</b><small>A meeting, class or visit</small></span></>)}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "console": return <><h1>&gt; what are we capturing?</h1>{rec("[ R ] record")}<Secondary a={a} labels={["[ U ] upload", "[ M ] memo", "[ ? ] ask"]} /></>;
      case "swiss": return <>{rec(<b>Record</b>)}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "cassette": return <><div aria-hidden className="an-l-tape"><span>Side A: new recording</span><div><i /><i /></div></div>{rec("Record")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "frost": return <><h1>Say it once. Keep it all.</h1>{rec("Record")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "grove": return <><h1>Listen now.<br />Think later.</h1><div className="an-l-pills">{rec("Record")}<button type="button" onClick={a.upload} data-testid="notes-upload">Upload</button><button type="button" onClick={a.memo} data-testid="notes-memo">Memo</button></div><AskBar a={a} text="Ask your notes anything" /></>;
      case "gazette": return <><header className="an-l-masthead"><h1>The Arise Notes</h1><p>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p></header>{rec("Start a new story: Record")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "punch": return <><h1>ARISE NOTES</h1>{rec("RECORD")}<Secondary a={a} labels={["UPLOAD", "MEMO", "ASK"]} /></>;
      case "chatline": return <><h1>Ask your notes</h1><button type="button" className="an-l-bubble-me" onClick={a.ask} data-testid="notes-ask-bar">What did I promise Maya’s mom?</button><div className="an-l-chatbar"><button type="button" onClick={a.ask}>Ask anything</button>{rec("Record")}</div><Secondary a={a} ask={false} /></>;
      case "vinyl": return <><div aria-hidden className="an-l-turntable"><div className="an-l-record-disc"><span>A</span></div><i /></div><h1>Drop the needle.</h1>{rec("Record")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "hush": return <><h1>Listen.</h1>{rec("Record")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "aurora": return <><div aria-hidden className="an-l-sky"><i /><i /></div><h1>Say it under the lights.</h1>{rec("Record")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "atelier": return <><small className="an-l-eyebrow">The notebook</small><h1>Every word, tailored.</h1>{rec("Begin recording")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "blueprint": return <><small className="an-l-eyebrow">Sheet A-01 / New capture</small><h1>Draft the meeting.</h1>{rec("[ Record ]")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "arcade": return <><h1>PRESS START</h1>{rec("REC ●")}<Secondary a={a} labels={["UPLOAD", "MEMO", "ASK"]} /></>;
      case "typewriter": return <><h1>Type it up for me.</h1>{rec("Record")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "darkroom": return <><div aria-hidden className="an-l-safelight" /><h1>Let it develop.</h1>{rec("Expose: Record")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "zen": return <><div aria-hidden className="an-l-ripples"><i /><i /><i /></div><h1>Only listen.</h1>{rec("Record")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "cockpit": return <><small className="an-l-eyebrow">Voice recorder armed</small><h1>Ready when you are.</h1>{rec("Record")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "tide": return <><div className="an-l-tidedate"><b>{new Date().getDate()}</b><span>{new Date().toLocaleDateString(undefined, { weekday: "long" })}<br />{new Date().toLocaleDateString(undefined, { month: "long" })}</span></div>{rec("Record")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "deck": return <><h1>Your deck</h1>{rec("Record")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      default: return null;
    }
  })();
  return <section className={`an-l-hero an-l-hero-${look.id}`}>{a.minutes && <div className="an-l-minutes">{a.minutes}</div>}{body}</section>;
}

const STATUS: Record<string, string> = { recording: "Recording", processing: "Writing down…", no_minutes: "Out of minutes", failed: "Needs a retry" };
const day = (iso: string) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); };
const DECK_COLORS = ["#9de3d3", "#ffd95c", "#d6c7ff"];

function Row({ n, onOpen, color, lead }: { n: ListNote; onOpen: () => void; color?: string; lead?: boolean }) {
  const kind = n.source === "memo" ? "Voice memo" : templateOf(n.template).label;
  const parts = [kind, n.actions > 0 ? `${n.actions} to-do${n.actions === 1 ? "" : "s"}` : "", n.folder].filter(Boolean).join(" · ");
  return <button type="button" className="an-l-note" onClick={onOpen} data-lead={lead || undefined} style={color ? { background: color, color: "#14161c" } : undefined} data-testid="notes-card">
    <span className="an-l-day">{day(n.createdAt)}</span>
    <span className="an-l-main">
      <span className="an-l-title">{n.title || "Untitled note"}{STATUS[n.status] ? <em> · {STATUS[n.status]}</em> : null}</span>
      {n.gist && <span className="an-l-gist an-extra">{n.gist}</span>}
      <span className="an-l-meta">{parts}</span>
    </span>
    {n.durationSecs > 0 && <span className="an-l-len">{fmtClock(n.durationSecs)}</span>}
  </button>;
}

/** The list of notes, arranged for the look. Deck shows one big card at a time. */
export function LookNoteList({ look, notes, onOpen }: { look: NotesTheme; notes: ListNote[]; onOpen: (n: ListNote) => void }) {
  const [i, setI] = useState(0);
  useEffect(() => { setI(0); }, [notes]);
  if (look.id === "deck") {
    const n = notes[Math.min(i, notes.length - 1)];
    const at = Math.min(i, notes.length - 1);
    return <div className="an-l-deck">
      {notes.length > 2 && <i aria-hidden style={{ background: DECK_COLORS[(at + 2) % 3] }} />}
      {notes.length > 1 && <i aria-hidden style={{ background: DECK_COLORS[(at + 1) % 3] }} />}
      <Row n={n} color={DECK_COLORS[at % 3]} onOpen={() => onOpen(n)} />
      {notes.length > 1 && <div className="an-l-decknav"><span>{at + 1} of {notes.length}</span><button type="button" onClick={() => setI((at + 1) % notes.length)}>Next note</button></div>}
    </div>;
  }
  return <ul className={`an-l-list an-l-list-${look.id}`}>{notes.map((n, idx) => <li key={n.id}><Row n={n} lead={idx === 0} onOpen={() => onOpen(n)} /></li>)}</ul>;
}

/** The timer while recording, drawn for the look. */
export function LookRecordArt({ look, secs, paused, finishing, level }: { look: NotesTheme; secs: number; paused: boolean; finishing: boolean; level: number }) {
  const live = !paused && !finishing;
  const status = finishing ? "Finishing" : paused ? "Paused" : look.id === "grove" ? "Listening" : "Recording";
  const clock = <div className="an-l-clock" aria-label={`${fmtClock(secs)} recorded`}>{fmtClock(secs)}</div>;
  const bars = <div aria-hidden className="an-l-recbars">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ height: live ? Math.max(6, Math.max(level, .35) * 86 * (.4 + .6 * Math.abs(Math.sin(i * 1.7 + secs)))) : 6 }} />)}</div>;
  const inner = (() => {
    switch (look.id) {
      // The reels turn and the tape winds across from one to the other as the recording runs.
      case "cassette": { const wound = Math.min(secs / 2700, 1); return <>{clock}<div aria-hidden className="an-l-tape" data-live={live ? "1" : undefined}><span>Side A</span><div><i style={{ "--spool": `${3.6 - wound * 1.4}rem` } as CSSProperties} /><b /><i style={{ "--spool": `${2.2 + wound * 1.4}rem` } as CSSProperties} /></div></div></>; }
      case "vinyl": return <>{clock}<div aria-hidden className="an-l-turntable" data-live={live ? "1" : undefined}><div className="an-l-record-disc"><span>A</span></div><i /></div></>;
      case "aurora": return <><div aria-hidden className="an-l-sky" data-live={live ? "1" : undefined} style={{ "--lvl": level } as CSSProperties}><i /><i /></div>{clock}</>;
      case "hush": return <>{clock}<div aria-hidden className="an-l-hushline" style={{ transform: `scaleX(${live ? Math.max(level, .06) : .02})` }} /></>;
      case "arcade": return <>{clock}<div aria-hidden className="an-l-eq">{Array.from({ length: 12 }, (_, i) => { const n = live ? Math.round(Math.max(level, .25) * 8 * (.4 + .6 * Math.abs(Math.sin(i * 1.3 + secs)))) : 0; return <span key={i}>{Array.from({ length: 8 }, (_, j) => <i key={j} data-on={j < n || undefined} />)}</span>; })}</div></>;
      case "typewriter": return <>{clock}<p aria-hidden className="an-l-carriage" data-live={live ? "1" : undefined}><span style={{ width: `${(secs % 30) * 3.2}%` }} /><i /></p></>;
      case "darkroom": return <>{clock}<div aria-hidden className="an-l-reel" data-live={live ? "1" : undefined} /></>;
      case "zen": return <div className="an-l-ripples an-l-rippleclock" data-live={live ? "1" : undefined}><i /><i /><i />{clock}</div>;
      case "cockpit": return <><div aria-hidden className="an-l-needle" style={{ "--a": `${-115 + (live ? Math.max(level, .08) : 0) * 230}deg` } as CSSProperties}><i /></div>{clock}</>;
      case "gazette": return <>{clock}<h2><span className="an-l-livedot" />Live from the meeting</h2></>;
      case "swiss": case "punch": case "deck": case "timeline": return <>{clock}{bars}</>;
      case "bloom": case "grove": return <div className="an-l-ring"><div style={{ transform: `scale(${live ? 1 + (secs % 2) * .08 : .92})` }}>{clock}</div></div>;
      case "console": return <>{clock}<p aria-hidden className="an-l-ascii">{live ? Array.from({ length: 24 }, (_, i) => "▁▂▃▅▇▆▄▂"[(i * 3 + secs) % 8]).join("") : "▁".repeat(24)}</p></>;
      default: return <>{clock}{bars}</>;
    }
  })();
  return <div className={`an-l-rec an-l-rec-${look.id}`}><p className="an-l-status">{status}</p>{inner}</div>;
}

/** The big title at the top of a note. */
export function LookNoteTitle({ look, title, meta }: { look: NotesTheme; title: string; meta: string }) {
  return <header className={`an-l-notetitle an-l-notetitle-${look.id}`}><h1>{look.id === "console" ? title.toLowerCase().replace(/\s+/g, "_") : title}</h1><p>{meta}</p></header>;
}

/** The floating icon bar at the bottom: Home, Notes, Record and your settings. */
export function LookTabBar({ on, initial, home, notes, record, settings }: { on: "ai" | "pages"; initial: string; home: () => void; notes: () => void; record: () => void; settings: () => void }) {
  return <nav aria-label="Arise Notes" className="an-noprint an-l-bar" data-testid="notes-tabs">
    <button type="button" aria-label="Home" aria-current={on === "ai" ? "page" : undefined} onClick={home} data-testid="notes-tab-ai"><Svg size={25}><path d="M4 11.5 12 4l8 7.5V19a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z" /></Svg></button>
    <button type="button" aria-label="Notes" aria-current={on === "pages" ? "page" : undefined} onClick={notes} data-testid="notes-tab-pages"><Svg size={25}><path d="M12 3c.7 4.6 2.4 6.3 7 7-4.6.7-6.3 2.4-7 7-.7-4.6-2.4-6.3-7-7 4.6-.7 6.3-2.4 7-7zM19 3v4M17 5h4" /></Svg></button>
    <button type="button" aria-label="Record" onClick={record} data-testid="notes-tab-record"><Svg size={27}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></Svg></button>
    <button type="button" aria-label="Settings" onClick={settings} data-testid="notes-tab-settings"><span className="an-l-avatar">{initial}</span></button>
  </nav>;
}
