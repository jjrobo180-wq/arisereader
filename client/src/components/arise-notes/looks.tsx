// The designs behind Settings > Appearance: each look's own Home, recording display and note heading.
// Everything still does the same work as the Classic screens; only the arrangement changes.
import { type CSSProperties, useEffect, useState, type ReactNode } from "react";
import { SUITE_LOOKS, fmtClock, nightLook, templateOf, themeOf, themeVars, type NotesTheme, type NotesSettings } from "@shared/ariseNotes";
import type { ListNote } from "./api";
import { BubbleWrap, Ferro, Jelly, LavaLamp, MarbleJar, Orrery, RadioDial, Slots, Spinner, SynthKeys } from "@/components/look-os/toys";
import { ProtoList, ProtoNoteTitle, ProtoTabBar, archClass, hasArch, protoHero, protoRecordArt } from "./protoLooks";
import "./notes-systems.css";
import "./notes-play.css";
import "./notes-suite.css";

/** The look to draw, or null for Classic. High contrast always uses the Classic layout. */
export function activeLook(settings?: NotesSettings | null): NotesTheme | null {
  if (!settings || settings.contrast || settings.theme === "classic") return null;
  return settings.night ? nightLook(themeOf(settings.theme)) : themeOf(settings.theme);
}

const Svg = ({ children, size = 22 }: { children: ReactNode; size?: number }) => <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
const MicIcon = ({ size }: { size?: number }) => <Svg size={size}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></Svg>;
const WAVE = [8, 18, 12, 28, 40, 22, 14, 32, 44, 26, 10, 20, 36, 16, 30, 42, 24, 12, 34, 18, 8, 26, 38, 20, 14, 30, 22, 10, 16, 6];
const Wave = () => <span aria-hidden className="an-l-wave">{WAVE.map((h, i) => <i key={i} style={{ height: h }} />)}</span>;

export type HomeActions = { first: string; minutes: ReactNode; record: () => void; upload: () => void; memo: () => void; ask: () => void; memoLocked?: boolean; count?: number; settings?: () => void; pages?: () => void };

function Secondary({ a, labels = ["Upload", "Voice memo", "Ask"], ask = true }: { a: HomeActions; labels?: string[]; ask?: boolean }) {
  return <div className={`an-l-secondary${ask ? "" : " an-l-two"}`}>
    <button type="button" onClick={a.upload} data-testid="notes-upload">{labels[0]}</button>
    <button type="button" onClick={a.memo} data-testid="notes-memo">{labels[1]}{a.memoLocked ? " · Basic" : ""}</button>
    {ask && <button type="button" onClick={a.ask} data-testid="notes-ask-bar">{labels[2]}</button>}
  </div>;
}
const AskBar = ({ a, text = "Ask or search your notes" }: { a: HomeActions; text?: string }) => <button type="button" className="an-l-askbar" onClick={a.ask} data-testid="notes-ask-bar">{text}</button>;

// For the interactive looks' toys on Home.
const PROMPTS = ["Today's three wins", "A plan for tomorrow", "Everything on my mind", "What I learned this week", "Questions for my next meeting", "An idea worth keeping"].map((title, i) => ({ id: String(i), title }));
const week = () => Array.from({ length: 7 }, (_, i) => ({ label: new Date(Date.now() + i * 864e5).toLocaleDateString(undefined, { weekday: "short" }), count: 0 }));

/** The top of Home: the title, Record, Upload, Voice memo and Ask, arranged for the look. */
export function LookHomeHero({ look, a }: { look: NotesTheme; a: HomeActions }) {
  const rec = (children: ReactNode, cls = "") => <button type="button" className={`an-l-record ${cls}`} onClick={a.record} data-testid="notes-record">{children}</button>;
  if (hasArch(look)) return <section className={`an-l-hero an-l-hero-${look.id}`}>{a.minutes && <div className="an-l-minutes">{a.minutes}</div>}{protoHero(look, a)}</section>;
  const body = (() => {
    switch (look.id) {
      // The Suite: a large title, a search field, and three quiet actions. Like a well-made notes app.
      case "paper": case "midnight": case "folio": case "nordic": case "carbon": return <>
        <header className="an-x-top"><small>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</small><h1>{look.id === "folio" ? "Notebook" : "Notes"}</h1></header>
        <button type="button" className="an-l-askbar an-x-search" onClick={a.ask} data-testid="notes-ask-bar"><Svg size={17}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg><span>Search or ask your notes</span></button>
        <div className="an-x-actions">
          {rec(<><span className="an-x-recdot" aria-hidden />Record</>)}
          <button type="button" onClick={a.upload} data-testid="notes-upload"><Svg size={18}><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v4h14v-4" /></Svg>Upload</button>
          <button type="button" onClick={a.memo} data-testid="notes-memo"><MicIcon size={18} />Memo{a.memoLocked ? " · Basic" : ""}</button>
        </div>
      </>;
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
      // The ten system looks.
      case "pocket": return <><h1>Recordings</h1><AskBar a={a} text="Search or ask your notes" /><div className="an-s-pocketrec">{rec(<span className="an-s-recdot" />, "an-s-roundrec")}<small>Tap to record</small></div><Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "glass": return <><div aria-hidden className="an-s-blobs"><i /><i /><i /></div><div className="an-s-pane"><small className="an-l-eyebrow">Arise Notes</small><h1>Speak. It writes itself.</h1>{rec(<><span className="an-s-orb" />Record</>)}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></div></>;
      case "desktop": return <div className="an-s-win an-s-win-desktop"><header><span className="an-s-lights"><i /><i /><i /></span><b>New Recording</b></header><div><h1>Ready to record</h1><p className="an-s-sub">A meeting, class or visit. Notes, summary and to-dos when you stop.</p>{rec(<><span className="an-s-recdot" />Record</>)}<Secondary a={a} labels={["Upload…", "Voice Memo", "Ask"]} /></div></div>;
      case "millennium": return <div className="an-s-win an-s-win-millennium"><header><b>Sound Recorder - Arise Notes</b><span className="an-s-ctls"><i /><i /><i /></span></header><div><div className="an-s-lcd"><span>00:00</span><small>Ready</small></div>{rec(<><span className="an-s-recdot" />Record</>)}<Secondary a={a} labels={["Upload...", "Voice memo", "Ask"]} /></div></div>;
      case "workstation": return <div className="an-s-ws"><small className="an-l-eyebrow">Voice recorder</small><h1>{a.first ? `Hi ${a.first}, ` : ""}what are we capturing?</h1>{rec(<span className="an-s-mic"><MicIcon size={30} /></span>, "an-s-roundrec")}<Secondary a={a} labels={["Upload", "Voice memo", "Ask"]} /></div>;
      case "retro": return <div className="an-s-win an-s-win-retro"><header><b>Sound Recorder</b><span className="an-s-ctls"><i /><i /><i /></span></header><div><div className="an-s-lcd an-s-lcd-green"><span>0:00</span><small>Length: 0.00 sec.</small></div><div className="an-s-wavebox" aria-hidden><i /></div>{rec("● Record")}<Secondary a={a} labels={["Upload...", "Memo", "Ask"]} /></div></div>;
      case "monolith": return <><small className="an-l-eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</small><h1>Record.</h1><p className="an-s-sub">Every word kept. Nothing missed.</p>{rec("Begin")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "ink": return <><small className="an-s-folio">New page</small><h1>What shall we write down?</h1>{rec("Record")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "neon": return <><small className="an-s-hud">// VOICE.CAPTURE — STANDBY</small><h1 data-text="RECORD">RECORD</h1>{rec("● INITIATE")}<Secondary a={a} labels={["UPLOAD", "MEMO", "ASK"]} /></>;
      case "orbit": return <><h1>Notes</h1><div className="an-s-orbitrec">{rec(<><MicIcon size={34} /><small>Record</small></>, "an-s-roundrec")}</div><Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      // The ten interactive looks: a toy to play with while you think, and every way in still a button.
      case "spinner": return <><h1>{a.first ? `Spin it, ${a.first}.` : "Spin it."}</h1><div className="an-p-stage"><Spinner size={230} center={<MicIcon size={22} />} arms={[{ label: "record", value: "●", onOpen: a.record }, { label: "upload", value: "↑", onOpen: a.upload }, { label: "ask", value: "?", onOpen: a.ask }]} /></div><p className="an-p-hint">Flick to spin. Tap an arm to start.</p>{rec("Record")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "bubbles": return <><h1>Pop. Talk. Done.</h1><div className="an-p-stage"><BubbleWrap items={[]} /></div>{rec("Record")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "lava": return <><div className="an-p-lavarow"><LavaLamp count={4} /><div><h1>Let it flow.</h1><p className="an-p-hint">Touch the lamp to warm it up.</p></div></div>{rec("Record")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "marbles": return <><h1>Shake out a thought.</h1><div className="an-p-stage"><MarbleJar items={[]} height={170} /></div>{rec("Record")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "synth": return <><small className="an-l-eyebrow">▶ Ready to record</small><h1>Hit record.</h1><SynthKeys />{rec("● Rec")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "jelly": return <><h1>{a.first ? `Squish one, ${a.first}.` : "Squish one."}</h1><div className="an-p-jellies"><Jelly label="record" value="●" color="#ff4f8b" pitch={1} onOpen={a.record} /><Jelly label="upload" value="↑" color="#8b7bff" pitch={1.25} onOpen={a.upload} /><Jelly label={a.memoLocked ? "memo · basic" : "memo"} value="♪" color="#38d6a8" pitch={1.5} onOpen={a.memo} /><Jelly label="ask" value="?" color="#ffb347" pitch={.8} onOpen={a.ask} /></div>{rec("Record")}</>;
      case "orrery": return <><small className="an-l-eyebrow">The week, in orbit</small><h1>Capture the moment.</h1><div className="an-p-stage"><Orrery size={230} days={week()} /></div>{rec("Record")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "dial": { const go = [a.record, a.upload, a.memo, a.ask]; return <><h1>Tune in.</h1><RadioDial items={["Record", "Upload", "Memo", "Ask"]} onSelect={(i) => go[i]()} /><p className="an-p-hint">Turn the knob, then press the middle.</p>{rec("Record")}</>; }
      case "ferro": return <><h1>Speak to it.</h1><div className="an-p-stage"><Ferro size={220}><MicIcon size={26} /></Ferro></div><p className="an-p-hint">Move your finger near it.</p>{rec("Record")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
      case "slots": return <><h1>Feeling lucky?</h1><Slots items={PROMPTS} /><p className="an-p-hint">Pull the lever for something to record.</p>{rec("Record")}<Secondary a={a} labels={["Upload", "Memo", "Ask"]} /></>;
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
/** The Suite's list: grouped by Today, Previous 7 Days, Previous 30 Days and by month, in quiet inset groups. */
function SuiteList({ notes, onOpen }: { notes: ListNote[]; onOpen: (n: ListNote) => void }) {
  const now = new Date(), start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groupOf = (iso: string) => {
    const t = +new Date(iso);
    if (Number.isNaN(t)) return "Earlier";
    if (t >= start) return "Today";
    if (t >= start - 7 * 864e5) return "Previous 7 Days";
    if (t >= start - 30 * 864e5) return "Previous 30 Days";
    const d = new Date(t);
    return d.toLocaleDateString(undefined, d.getFullYear() === now.getFullYear() ? { month: "long" } : { month: "long", year: "numeric" });
  };
  const when = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(+d)) return "";
    if (+d >= start) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    if (+d >= start - 7 * 864e5) return d.toLocaleDateString(undefined, { weekday: "long" });
    return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "2-digit" });
  };
  const groups: { name: string; items: ListNote[] }[] = [];
  for (const n of notes) { const name = groupOf(n.createdAt); const g = groups.find((x) => x.name === name); if (g) g.items.push(n); else groups.push({ name, items: [n] }); }
  return <div className="an-x-list">{groups.map((g) => <section key={g.name}>
    <h3 className="an-x-sec">{g.name}</h3>
    <ul className="an-l-list an-x-group">{g.items.map((n) => {
      const kind = n.source === "memo" ? "Voice memo" : templateOf(n.template).label;
      const line = n.gist || [kind, n.actions > 0 ? `${n.actions} to-do${n.actions === 1 ? "" : "s"}` : "", n.folder].filter(Boolean).join(" · ");
      return <li key={n.id}><button type="button" className="an-l-note an-x-row" onClick={() => onOpen(n)} data-testid="notes-card">
        <span className="an-x-main">
          <span className="an-x-title">{n.title || "Untitled note"}{STATUS[n.status] ? <em> · {STATUS[n.status]}</em> : null}</span>
          <span className="an-x-line"><time>{when(n.createdAt)}</time><span>{line}</span></span>
        </span>
        {n.durationSecs > 0 && <span className="an-x-len">{fmtClock(n.durationSecs)}</span>}
        <svg aria-hidden className="an-x-chev" width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m1.5 1.5 6 6-6 6" /></svg>
      </button></li>;
    })}</ul>
  </section>)}</div>;
}

export function LookNoteList({ look, notes, onOpen }: { look: NotesTheme; notes: ListNote[]; onOpen: (n: ListNote) => void }) {
  const [i, setI] = useState(0);
  useEffect(() => { setI(0); }, [notes]);
  if (hasArch(look)) return <ProtoList look={look} notes={notes} onOpen={onOpen} />;
  if (SUITE_LOOKS.has(look.id)) return <SuiteList notes={notes} onOpen={onOpen} />;
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
  const live = !paused && !finishing, e = live ? Math.max(level, .08) : 0;
  const status = finishing ? "Finishing" : paused ? "Paused" : look.id === "grove" ? "Listening" : "Recording";
  const clock = <div className="an-l-clock" aria-label={`${fmtClock(secs)} recorded`}>{fmtClock(secs)}</div>;
  const bars = <div aria-hidden className="an-l-recbars">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ height: live ? Math.max(6, Math.max(level, .35) * 86 * (.4 + .6 * Math.abs(Math.sin(i * 1.7 + secs)))) : 6 }} />)}</div>;
  if (hasArch(look)) return <div className={`an-l-rec an-l-rec-${look.id}`}><p className="an-l-status">{status}</p>{protoRecordArt(look, { secs, paused, finishing, level })}</div>;
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
      case "pocket": case "desktop": return <>{clock}<div aria-hidden className="an-s-scope">{Array.from({ length: 40 }, (_, i) => <i key={i} style={{ height: live ? Math.max(3, Math.max(level, .25) * 64 * Math.abs(Math.sin(i * .9 + secs * 2))) : 3 }} />)}<b /></div></>;
      case "glass": return <div className="an-s-orbclock" data-live={live ? "1" : undefined} style={{ "--lvl": live ? Math.max(level, .1) : 0 } as CSSProperties}>{clock}</div>;
      case "millennium": case "retro": return <><div className="an-s-lcd an-s-lcd-green">{clock}<small>{live ? "Recording" : status}</small></div><div aria-hidden className="an-s-meter">{Array.from({ length: 20 }, (_, i) => <i key={i} data-on={live && i < Math.round(Math.max(level, .1) * 20) ? "1" : undefined} />)}</div></>;
      case "workstation": case "orbit": { const c = 2 * Math.PI * 54; return <div className="an-s-ringclock"><svg viewBox="0 0 120 120" aria-hidden><circle cx="60" cy="60" r="54" className="an-s-ringtrack" /><circle cx="60" cy="60" r="54" className="an-s-ringfill" strokeDasharray={c} strokeDashoffset={c * (1 - (secs % 60) / 60)} /></svg>{clock}</div>; }
      case "monolith": return <>{clock}<div aria-hidden className="an-s-goldline" style={{ transform: `scaleX(${live ? Math.max(level, .05) : .02})` }} /></>;
      case "ink": return <>{clock}<p className="an-s-inkstatus">{live ? "Listening. Write-up when you stop." : status}</p></>;
      case "neon": return <>{clock}<div aria-hidden className="an-s-neonbars">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ height: live ? `${Math.max(8, Math.max(level, .2) * 100 * Math.abs(Math.sin(i * 1.4 + secs)))}%` : "8%" }} />)}</div></>;
      case "paper": case "midnight": case "folio": case "nordic": case "carbon": return <>{clock}<div aria-hidden className="an-x-wave">{Array.from({ length: 48 }, (_, i) => <i key={i} style={{ transform: `scaleY(${live ? Math.max(.06, Math.max(level, .2) * Math.abs(Math.sin(i * .55 + secs * 1.7))) : .06})` }} />)}</div></>;
      case "console": return <>{clock}<p aria-hidden className="an-l-ascii">{live ? Array.from({ length: 24 }, (_, i) => "▁▂▃▅▇▆▄▂"[(i * 3 + secs) % 8]).join("") : "▁".repeat(24)}</p></>;
      // The interactive looks: the toy moves with your voice while it records.
      case "spinner": return <>{clock}<div aria-hidden className="an-p-art"><Spinner size={210} energy={e} center={<MicIcon size={20} />} arms={[]} /></div></>;
      case "bubbles": return <>{clock}<div aria-hidden className="an-p-art"><BubbleWrap items={[]} energy={e} /></div></>;
      case "lava": return <div className="an-p-lavarow an-p-artrow"><LavaLamp count={6} energy={e} />{clock}</div>;
      case "marbles": return <>{clock}<div aria-hidden className="an-p-art"><MarbleJar items={[]} energy={e} height={190} /></div></>;
      case "synth": return <>{clock}<div aria-hidden className="an-p-art"><SynthKeys energy={e} /></div></>;
      case "jelly": return <>{clock}<div aria-hidden className="an-p-art an-p-onejelly"><Jelly label={status.toLowerCase()} value="●" color="#ff4f8b" energy={e} /></div></>;
      case "orrery": return <>{clock}<div aria-hidden className="an-p-art"><Orrery size={230} energy={e} days={week()} /></div></>;
      case "dial": return <>{clock}<div aria-hidden className="an-p-art"><RadioDial items={["Low", "Talk", "Loud", "Peak"]} energy={e} /></div></>;
      case "ferro": return <>{clock}<div aria-hidden className="an-p-art"><Ferro size={220} energy={e} /></div></>;
      case "slots": return <>{clock}<div aria-hidden className="an-p-art"><Slots items={[]} energy={e} /></div></>;
      default: return <>{clock}{bars}</>;
    }
  })();
  return <div className={`an-l-rec an-l-rec-${look.id}`}><p className="an-l-status">{status}</p>{inner}</div>;
}

/** The big title at the top of a note. */
export function LookNoteTitle({ look, title, meta }: { look: NotesTheme; title: string; meta: string }) {
  if (hasArch(look)) return <ProtoNoteTitle look={look} title={title} meta={meta} />;
  if (SUITE_LOOKS.has(look.id)) return <header className={`an-l-notetitle an-x-notetitle an-l-notetitle-${look.id}`}><p>{meta}</p><h1>{title}</h1></header>;
  return <header className={`an-l-notetitle an-l-notetitle-${look.id}`}><h1>{look.id === "console" ? title.toLowerCase().replace(/\s+/g, "_") : title}</h1><p>{meta}</p></header>;
}

/** The floating icon bar at the bottom: Home, Notes, Record and your settings. */
export function LookTabBar({ look, on, initial, home, notes, record, settings }: { look?: NotesTheme | null; on: "ai" | "pages"; initial: string; home: () => void; notes: () => void; record: () => void; settings: () => void }) {
  // Carries its own look, so it is dressed and pinned to the bottom on every screen, including the
  // Notes tab, which uses the plain page colors (without this the bar lost its styling there and vanished).
  if (hasArch(look)) return <div className={`pl-barscope${archClass(look)}`} style={themeVars(look) as CSSProperties}><ProtoTabBar look={look} on={on} initial={initial} home={home} notes={notes} record={record} settings={settings} /></div>;
  return <nav aria-label="Arise Notes" className="an-noprint an-l-bar" data-testid="notes-tabs">
    <button type="button" aria-label="Home" aria-current={on === "ai" ? "page" : undefined} onClick={home} data-testid="notes-tab-ai"><Svg size={25}><path d="M4 11.5 12 4l8 7.5V19a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z" /></Svg></button>
    <button type="button" aria-label="Notes" aria-current={on === "pages" ? "page" : undefined} onClick={notes} data-testid="notes-tab-pages"><Svg size={25}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5zM15 5l4 4" /></Svg></button>
    <button type="button" aria-label="Record" onClick={record} data-testid="notes-tab-record"><Svg size={27}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></Svg></button>
    <button type="button" aria-label="Settings" onClick={settings} data-testid="notes-tab-settings"><span className="an-l-avatar">{initial}</span></button>
  </nav>;
}
