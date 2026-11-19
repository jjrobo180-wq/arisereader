// Arise Kids' newer built-in apps, drawn like Card Quest and Pick It! (dark game screen, a round close button
// top left, big words, big yellow buttons): Color Hunt, First / Then, Timer, Breathe and Animal Sounds.
// Rules: shared/ariseKids.ts.
import { useEffect, useRef, useState } from "react";
import { Icon, css } from "./kidsUi";
import {
  ANIMAL_SOUNDS, BREATHS, COLORS, FIRSTS, HUNT_GOAL, SHAPES, THENS, TIMER_MINUTES,
  animalLine, breathAt, clock, firstThenSentence, huntRound, huntStep, timerLeft, type FTItem,
} from "@shared/ariseKids";

const CLOSE = "M6 6l12 12M18 6 6 18";
const CHECK = "m5 12 5 5 9-10";
const SPEAKER = "M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7";
// --sat-in: the clock's space when the app draws edge to edge (index.css); on the web, and in an older app build, the browser's own.
const TOP = (px: number) => `max(${px}px, var(--sat-in, env(safe-area-inset-top)))`;

export type ExtraProps = { onClose: () => void; onWin: () => void; say: (text: string) => void; go: (path: string) => void; openTab: (tab: string) => void };

/** The top row every game screen has: close, the title, and what's on the right. */
function Top({ title, right, onClose }: { title: string; right?: string; onClose: () => void }) {
  return (
    <div style={{ ...css("display: flex; align-items: center; gap: 12px"), marginTop: `calc(${TOP(52)} - 52px)` }}>
      <button type="button" data-close onClick={onClose} aria-label="Close" style={css("width: 48px; height: 48px; flex-shrink: 0; border-radius: 24px; border: 0; background: #2a3450; color: #ffffff; display: flex; align-items: center; justify-content: center")}><Icon d={CLOSE} size={22} width={2.6} /></button>
      <span style={css("font-size: 20px; font-weight: 800; flex-grow: 1; color: #ffffff")}>{title}</span>
      {right && <span style={css("font-size: 17px; font-weight: 800; color: #ffffff")}>{right}</span>}
    </div>
  );
}
const SCREEN = "position: absolute; inset: 0; background: #111827; color: #ffffff; padding: 52px 18px 26px; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px; overflow-y: auto";
const BIG_YELLOW = "min-height: 70px; border-radius: 35px; border: 0; background: #ffd34d; color: #111827; font-family: inherit; font-size: 21px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 0 24px";
const GHOST = "min-height: 70px; border-radius: 35px; border: 2px solid #4a5675; background: transparent; color: #ffffff; font-family: inherit; font-size: 18px; font-weight: 600; padding: 0 20px";

// ---------------------------------------------------------------- Color Hunt
export function ColorHunt({ onClose, onWin, say }: ExtraProps) {
  const [st, setSt] = useState({ round: 0, score: 0 });
  const [flash, setFlash] = useState<{ i: number; right: boolean } | null>(null);
  const r = huntRound(st.round);
  const target = COLORS[r.target];
  useEffect(() => { say(`Find the ${target.name} one!`); }, [st.round]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (i: number) => {
    if (flash) return;
    const o = r.options[i];
    const next = huntStep(st, o.color);
    setFlash({ i, right: next.right });
    say(next.right ? (next.win ? "You found them all!" : `Yes! ${target.name}!`) : `That one is ${COLORS[o.color].name}. Try again!`);
    window.setTimeout(() => { setFlash(null); setSt({ round: next.round, score: next.score }); if (next.win) onWin(); }, next.right ? 900 : 700);
  };
  return (
    <div style={css(SCREEN)} data-screen="hunt">
      <Top title="Color Hunt" right={`${st.score} of ${HUNT_GOAL}`} onClose={onClose} />
      <button type="button" onClick={() => say(`Find the ${target.name} one!`)} style={css("border: 0; border-radius: 28px; background: " + target.hex + "; color: " + (target.name === "yellow" ? "#111827" : "#ffffff") + "; min-height: 92px; font-family: inherit; font-size: 32px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 12px")}>
        <Icon d={SPEAKER} size={30} width={2.4} />Find {target.name}!
      </button>
      <div style={css("flex-grow: 1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; min-height: 340px")}>
        {r.options.map((o, i) => {
          const c = COLORS[o.color], s = SHAPES[o.shape];
          const ring = flash?.i === i ? (flash.right ? "#2ee88a" : "#ff8a3d") : "#2a3450";
          return <button key={i} type="button" onClick={() => pick(i)} aria-label={`${c.name} ${s.name}`} data-testid={`hunt-${c.name}`}
            style={css("border-radius: 28px; border: 6px solid " + ring + "; background: #1b2235; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-family: inherit; color: #ffffff")}>
            <Icon d={s.d} size={110} stroke="#ffffff" width={1.2} fill={c.hex} />
            <span style={css("font-size: 20px; font-weight: 800")}>{c.name}</span>
          </button>;
        })}
      </div>
      <div style={css("display: flex; gap: 6px")} aria-hidden="true">{Array.from({ length: HUNT_GOAL }, (_, i) => <span key={i} style={css("flex-grow: 1; height: 12px; border-radius: 6px; background: " + (i < st.score ? "#ffd34d" : "#2a3450"))} />)}</div>
    </div>
  );
}

// ---------------------------------------------------------------- First / Then
const FT_KEY = "arise-kids:first-then";
export function FirstThen({ onClose, say, go, openTab }: ExtraProps) {
  const saved = (() => { try { return JSON.parse(localStorage.getItem(FT_KEY) || "null") as { first: string; then: string } | null; } catch { return null; } })();
  const [first, setFirst] = useState<FTItem | null>(() => FIRSTS.find((f) => f.name === saved?.first) ?? null);
  const [then, setThen] = useState<FTItem | null>(() => THENS.find((t) => t.name === saved?.then) ?? null);
  const [step, setStep] = useState<"first" | "then" | "board">(first && then ? "board" : "first");
  const [done, setDone] = useState(false);
  useEffect(() => { if (first && then) try { localStorage.setItem(FT_KEY, JSON.stringify({ first: first.name, then: then.name })); } catch { /* only for now */ } }, [first, then]);
  useEffect(() => { if (step === "first") say("What do we do first?"); if (step === "then") say("And then?"); if (step === "board" && first && then) say(firstThenSentence(first.name, then.name)); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  const grid = (items: FTItem[], onPick: (i: FTItem) => void) => (
    <div style={css("display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px")}>
      {items.map((i) => <button key={i.name} type="button" onClick={() => onPick(i)} style={css("min-height: 128px; border: 0; border-radius: 24px; background: " + i.bg + "; color: #14102a; font-family: inherit; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px")}>
        <Icon d={i.d} size={54} stroke="#14102a" width={1.8} /><span style={css("font-size: 19px; font-weight: 800")}>{i.name}</span></button>)}
    </div>
  );
  if (step === "first") return <div style={css(SCREEN)} data-screen="firstthen"><Top title="First / Then" right="1 of 2" onClose={onClose} /><span style={css("font-size: 30px; font-weight: 800")}>First…</span>{grid(FIRSTS, (i) => { setFirst(i); setDone(false); say(i.name); setStep("then"); })}</div>;
  if (step === "then" || !first || !then) return <div style={css(SCREEN)} data-screen="firstthen"><Top title="First / Then" right="2 of 2" onClose={onClose} /><span style={css("font-size: 30px; font-weight: 800")}>Then…</span>{grid(THENS, (i) => { setThen(i); say(i.name); setStep("board"); })}</div>;
  const panel = (label: string, item: FTItem, lit: boolean, checked: boolean) => (
    <div style={css("flex-grow: 1; border-radius: 30px; background: " + item.bg + "; color: #14102a; border: 6px solid " + (lit ? "#ffd34d" : "transparent") + "; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; position: relative; opacity: " + (checked ? ".55" : "1"))}>
      <span style={css("position: absolute; left: 18px; top: 14px; font-size: 22px; font-weight: 800")}>{label}</span>
      {checked && <span style={css("position: absolute; right: 16px; top: 12px; width: 52px; height: 52px; border-radius: 26px; background: #2ee88a; display: flex; align-items: center; justify-content: center")}><Icon d={CHECK} size={30} width={3.2} stroke="#14102a" /></span>}
      <Icon d={item.d} size={110} stroke="#14102a" width={1.5} />
      <span style={css("font-size: 30px; font-weight: 800; text-align: center")}>{item.name}</span>
    </div>
  );
  const goThen = () => { if (then.path) go(then.path); else if (then.tab) openTab(then.tab); else say(`${then.name} time!`); };
  return (
    <div style={css(SCREEN)} data-screen="firstthen">
      <Top title="First / Then" onClose={onClose} />
      <div style={css("flex-grow: 1; display: flex; flex-direction: column; gap: 12px; min-height: 420px")}>
        {panel("First", first, !done, done)}
        {panel("Then", then, done, false)}
      </div>
      {!done
        ? <div style={css("display: flex; gap: 12px")}><button type="button" onClick={() => setStep("first")} style={css(GHOST)}>Change</button><button type="button" data-testid="ft-done" onClick={() => { setDone(true); say(`All done! Now, ${then.name.toLowerCase()}!`); }} style={{ ...css(BIG_YELLOW), flexGrow: 1 }}><Icon d={CHECK} size={24} width={3} />{first.name} done</button></div>
        : <div style={css("display: flex; gap: 12px")}><button type="button" onClick={() => { setDone(false); setStep("first"); }} style={css(GHOST)}>New board</button><button type="button" onClick={goThen} style={{ ...css(BIG_YELLOW), flexGrow: 1 }}>{then.path || then.tab ? `Go to ${then.name}` : `${then.name} time!`}</button></div>}
    </div>
  );
}

// ---------------------------------------------------------------- Timer
export function KidsTimer({ onClose, say }: ExtraProps) {
  const [total, setTotal] = useState<number | null>(null);
  const [start, setStart] = useState(0);
  const [now, setNow] = useState(Date.now());
  const warned = useRef(false), ended = useRef(false);
  useEffect(() => { if (total === null) return; const t = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(t); }, [total]);
  const t = total === null ? null : timerLeft(start, total, now);
  useEffect(() => {
    if (!t || total === null) return;
    if (!warned.current && total >= 120_000 && t.ms <= 60_000 && !t.done) { warned.current = true; say("One more minute."); }
    if (!ended.current && t.done) { ended.current = true; say("All done! Time is up."); }
  }, [t?.ms]); // eslint-disable-line react-hooks/exhaustive-deps
  const begin = (min: number) => { warned.current = false; ended.current = false; setStart(Date.now()); setNow(Date.now()); setTotal(min * 60_000); say(`${min} minute${min > 1 ? "s" : ""}. Go!`); };
  if (total === null || !t) return (
    <div style={css(SCREEN)} data-screen="timer">
      <Top title="Timer" onClose={onClose} />
      <span style={css("font-size: 30px; font-weight: 800")}>How long?</span>
      <div style={css("display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px")}>
        {TIMER_MINUTES.map((m, i) => <button key={m} type="button" onClick={() => begin(m)} style={css("min-height: 140px; border: 0; border-radius: 28px; background: " + ["#9de0f5", "#c7f09a", "#ffe3a1", "#ffc9de"][i] + "; color: #14102a; font-family: inherit; display: flex; flex-direction: column; align-items: center; justify-content: center")}>
          <span style={css("font-size: 52px; font-weight: 800; line-height: 1")}>{m}</span><span style={css("font-size: 19px; font-weight: 800")}>minute{m > 1 ? "s" : ""}</span></button>)}
      </div>
    </div>
  );
  const R = 120, C = 2 * Math.PI * R;
  const color = t.done ? "#2ee88a" : t.left < 0.2 ? "#ff8a3d" : "#ffd34d";
  return (
    <div style={css(SCREEN)} data-screen="timer">
      <Top title="Timer" onClose={onClose} />
      <div style={css("flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px")}>
        <svg width="280" height="280" viewBox="0 0 280 280" role="img" aria-label={t.done ? "Time is up" : `${clock(t.ms)} left`}>
          <circle cx="140" cy="140" r={R} fill="none" stroke="#2a3450" strokeWidth="34" />
          <circle cx="140" cy="140" r={R} fill="none" stroke={color} strokeWidth="34" strokeDasharray={C} strokeDashoffset={C * (1 - t.left)} transform="rotate(-90 140 140)" strokeLinecap="butt" />
          <text x="140" y="156" textAnchor="middle" fill="#ffffff" style={{ fontFamily: "inherit", fontSize: 54, fontWeight: 800 }}>{t.done ? "Done!" : clock(t.ms)}</text>
        </svg>
        <span style={css("font-size: 24px; font-weight: 800; text-align: center")}>{t.done ? "All done! Time is up." : t.left < 0.2 ? "Almost done…" : "Keep going!"}</span>
      </div>
      <div style={css("display: flex; gap: 12px")}>
        <button type="button" onClick={() => setTotal(null)} style={css(GHOST)}>{t.done ? "New timer" : "Stop"}</button>
        {t.done && <button type="button" onClick={onClose} style={{ ...css(BIG_YELLOW), flexGrow: 1 }}><Icon d={CHECK} size={24} width={3} />OK</button>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Breathe
export function Breathe({ onClose, onWin, say }: ExtraProps) {
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const lastSaid = useRef("");
  useEffect(() => { if (start === null) return; const t = window.setInterval(() => setNow(Date.now()), 50); return () => window.clearInterval(t); }, [start]);
  const b = start === null ? null : breathAt(now - start);
  useEffect(() => {
    if (!b) return;
    const key = b.done ? "done" : `${b.breath}-${b.phase}`;
    if (key === lastSaid.current) return;
    lastSaid.current = key;
    if (b.done) { say("Well done. You are calm."); setStart(null); onWin(); } else say(b.phase === "in" ? "Breathe in" : "Breathe out");
  }, [b?.done, b?.phase, b?.breath]); // eslint-disable-line react-hooks/exhaustive-deps
  const size = 120 + (b ? b.size : 0) * 150;
  return (
    <div style={{ ...css(SCREEN), background: "#0f2a2a" }} data-screen="breathe">
      <Top title="Breathe" right={b ? `${b.breath} of ${BREATHS}` : undefined} onClose={onClose} />
      <div style={css("flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 26px; min-height: 380px")}>
        <div style={css("width: 290px; height: 290px; display: flex; align-items: center; justify-content: center")}>
          <div aria-hidden="true" style={{ width: size, height: size, borderRadius: size / 2, background: "radial-gradient(circle at 35% 30%, #d6fff3, #5fd6b8 60%, #2c9c86)", boxShadow: "0 0 60px rgba(95,214,184,.45)" }} />
        </div>
        <span role="status" style={css("font-size: 36px; font-weight: 800; text-align: center")}>{!b ? "Ready?" : b.phase === "in" ? "Breathe in…" : "Breathe out…"}</span>
      </div>
      {!b && <button type="button" onClick={() => { lastSaid.current = ""; setStart(Date.now()); setNow(Date.now()); }} style={css(BIG_YELLOW)}>Start</button>}
    </div>
  );
}

// ---------------------------------------------------------------- Animal Sounds
export function AnimalSounds({ onClose, say }: ExtraProps) {
  const [hit, setHit] = useState<string | null>(null);
  return (
    <div style={css(SCREEN)} data-screen="sounds">
      <Top title="Animal Sounds" onClose={onClose} />
      <span style={css("font-size: 24px; font-weight: 800")}>Tap an animal!</span>
      <div style={css("display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px")}>
        {ANIMAL_SOUNDS.map((a) => (
          <button key={a.name} type="button" onClick={() => { setHit(a.name); say(animalLine(a.name, a.sound)); window.setTimeout(() => setHit((h) => h === a.name ? null : h), 900); }}
            style={{ ...css("min-height: 140px; border: 0; border-radius: 26px; background: " + a.bg + "; color: #14102a; font-family: inherit; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px"), transform: hit === a.name ? "scale(1.06)" : "none", transition: "transform .15s" }}>
            <Icon d={a.d} size={66} stroke="#14102a" width={1.6} />
            <span style={css("font-size: 21px; font-weight: 800")}>{a.name}</span>
            {hit === a.name && <span style={css("font-size: 16px; font-weight: 800")}>“{a.sound}!”</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
