// A live preview of a look: its real Home, a note and the recording screen, drawn with the same
// pieces the apps use and scaled down. Nothing here can change anything; it is only for looking.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { themeVars, type NotesTheme } from "@shared/notesThemes";
import type { ListNote } from "@/components/arise-notes/api";
import { LookHomeHero, LookNoteList, LookNoteTitle, LookRecordArt, LookTabBar } from "@/components/arise-notes/looks";
import { archClass } from "@/components/arise-notes/protoLooks";
import "@/components/arise-notes/notes.css";
import "@/components/arise-notes/notes-themes.css";

const fonts = new Set<string>();
const loadFont = (href?: string) => {
  if (!href || fonts.has(href)) return;
  fonts.add(href);
  const l = document.createElement("link");
  l.rel = "stylesheet"; l.href = href;
  document.head.appendChild(l);
};

const ago = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
const SAMPLE: ListNote[] = [
  { id: "1", title: "IEP meeting, Ava L.", template: "meeting", source: "record", status: "ready", durationSecs: 2520, createdAt: ago(0), folder: "IEP", tags: [], familyShared: false, mine: true, actions: 2, gist: "Reading goal added. Extended time and a quiet room stay." } as unknown as ListNote,
  { id: "2", title: "Math push-in", template: "class", source: "record", status: "ready", durationSecs: 1680, createdAt: ago(0), folder: "", tags: [], familyShared: false, mine: true, actions: 0, gist: "Halves and thirds on the number line." } as unknown as ListNote,
  { id: "3", title: "Parent call, Mia R.", template: "general", source: "memo", status: "ready", durationSecs: 540, createdAt: ago(1), folder: "", tags: [], familyShared: false, mine: true, actions: 1, gist: "Weekly email, starting Monday." } as unknown as ListNote,
  { id: "4", title: "Staff meeting", template: "meeting", source: "record", status: "ready", durationSecs: 3060, createdAt: ago(3), folder: "", tags: [], familyShared: false, mine: true, actions: 3, gist: "Three action items from Monday." } as unknown as ListNote,
];
const noop = () => {};
const actions = { first: "", minutes: null, record: noop, upload: noop, memo: noop, ask: noop, count: 48, settings: noop, pages: noop };

type Screen = "home" | "note" | "record";
export const PREVIEW_SCREENS: { id: Screen; label: string }[] = [{ id: "home", label: "Home" }, { id: "note", label: "A note" }, { id: "record", label: "Recording" }];

function Screen({ look, screen, scale }: { look: NotesTheme; screen: Screen; scale: number }) {
  const vars = themeVars(look) as CSSProperties;
  const classic = look.id === "classic";
  const cls = `an-root an-themed an-theme-${look.id}${archClass(look)} pl-preview`;
  const frame: CSSProperties = { ...vars, position: "relative", width: 390, height: 760, overflow: "hidden", borderRadius: 34, transformOrigin: "top left", transform: `scale(${scale})`, background: look.bg, color: look.ink, border: `1px solid ${look.line}` };
  return <div style={{ width: 390 * scale, height: 760 * scale, flex: "none" }} aria-hidden>
    <div className={cls} style={frame}>
      {screen === "home" && <>
        <main className="mx-auto max-w-5xl space-y-4 px-4 pb-24 pt-4">
          {classic
            ? <><h1 className="text-[24px] font-extrabold tracking-[-.02em]">Hi. What are we capturing?</h1>
              <ul className="grid gap-2">{SAMPLE.map((n) => <li key={n.id} className="an-card p-3"><b className="block text-[16px]">{n.title}</b><span className="text-[13px] text-[var(--an-muted)]">Today · {Math.round(n.durationSecs / 60)} min</span></li>)}</ul></>
            : <><LookHomeHero look={look} a={actions} /><LookNoteList look={look} notes={SAMPLE} onOpen={noop} /></>}
        </main>
        {!classic && <LookTabBar look={look} on="ai" initial="A" home={noop} notes={noop} record={noop} settings={noop} />}
      </>}
      {screen === "note" && <main className="mx-auto max-w-5xl space-y-4 px-4 pt-6">
        {classic ? <h1 className="text-[28px] font-extrabold">Ben needs a re-teach</h1> : <LookNoteTitle look={look} title="Ben needs a re-teach" meta="Nov 5 · Student note · 4 min" />}
        <p className="text-[17px] leading-relaxed">Mixed up halves and thirds on the number line. Fraction strips helped a lot. Try the strips first, then the line.</p>
        <p className="text-[15px] leading-relaxed text-[var(--an-muted)]">Next: review on Thursday and send Mia’s mom a quick update.</p>
      </main>}
      {screen === "record" && <main className="mx-auto max-w-2xl space-y-4 px-4 pt-6">
        <section className="an-card an-l-recsec flex flex-col items-center px-5 py-7 text-center">
          {classic ? <div className="font-mono text-[44px] font-bold">16:02</div> : <LookRecordArt look={look} secs={962} paused={false} finishing={false} level={.6} />}
          <p className="mt-2 text-[14px] text-[var(--an-muted)]">2 parts marked important</p>
          <div className="an-l-controls mt-5 flex flex-wrap justify-center gap-3">
            <span className="an-btn an-plain">Pause</span><span className="an-btn an-soft">This matters</span><span className="an-btn an-record">Stop</span>
          </div>
        </section>
      </main>}
    </div>
  </div>;
}

/** One screen at a time, as big as the space allows, with tabs for Home, a note and recording
 *  (three small screens side by side came out squished and cut off). */
export default function LookPreview({ look, scale }: { look: NotesTheme; scale?: number }) {
  useEffect(() => { loadFont(look.fontUrl); }, [look]);
  const [at, setAt] = useState<Screen>("home");
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0.8);
  useEffect(() => {
    const el = box.current;
    const measure = () => {
      const w = el?.clientWidth || 340, h = typeof window === "undefined" ? 800 : window.innerHeight;
      setFit(Math.max(0.5, Math.min(1, (Math.min(w, 380) - 4) / 390, (h * 0.6) / 760)));
    };
    measure();
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const s = scale ?? fit;
  return <div ref={box} data-testid="look-preview">
    <div role="tablist" aria-label="Preview screens" className="mb-3 flex justify-center gap-1.5">
      {PREVIEW_SCREENS.map((x) => <button key={x.id} type="button" role="tab" aria-selected={at === x.id} onClick={() => setAt(x.id)}
        className="min-h-10 rounded-full px-4 text-[14px] font-bold" style={at === x.id ? { background: "#0f172a", color: "#ffffff" } : { background: "#f1f5f9", color: "#334155" }}>{x.label}</button>)}
    </div>
    <div className="flex justify-center"><Screen look={look} screen={at} scale={s} /></div>
  </div>;
}
