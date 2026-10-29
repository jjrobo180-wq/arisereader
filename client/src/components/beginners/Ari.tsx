// Ari, the A.R.I.S.E. Beginners guide: a rising sun with a face. Ari's mouth makes the shape of each sound while
// Ari talks (lips pressed for m, b and p; teeth on the lip for f and v; a round mouth for o and oo), so a child
// can watch how a word is said, the way Speech Blubs uses video of real children. The shapes follow the sounds
// of the words (shared/beginners/phonics.ts) along the length of the audio clip.
import { useCallback, useEffect, useRef, useState } from "react";
import { WORDS } from "@shared/beginners";
import { isVowelSound, letterSounds, soundsOf, visemeOf, type Viseme } from "@shared/beginners/phonics";
import { say, sayAll, speakingProgress, stopAll } from "./voice";

/* ------------------------------------------------------------------ the mouth timeline */

type Frame = { at: number; v: Viseme };
/** Mouth shapes over the length of a clip (0–1), with a little silence at each end. */
export function timelineOf(text: string): Frame[] {
  const units: { v: Viseme; w: number }[] = [];
  const words = text.split(/\s+/).filter(Boolean);
  words.forEach((raw, i) => {
    const w = raw.toLowerCase().replace(/[^a-z']/g, "");
    if (w) {
      const entry = WORDS.get(w);
      const sounds = entry && !entry.syll ? soundsOf(entry) : letterSounds(w);
      for (const s of sounds) units.push({ v: visemeOf(s), w: isVowelSound(s) ? 1.7 : 1 });
    }
    const pause = /[.!?]["”]?$/.test(raw) ? 2.2 : /[,;:]$/.test(raw) ? 1.4 : 0.5;
    if (i < words.length - 1) units.push({ v: "rest", w: pause });
  });
  const total = units.reduce((t, u) => t + u.w, 0) || 1;
  const lead = 0.07, span = 0.86;
  let at = lead;
  const frames: Frame[] = [{ at: 0, v: "rest" }];
  for (const u of units) { frames.push({ at, v: u.v }); at += (u.w / total) * span; }
  frames.push({ at, v: "rest" });
  return frames;
}
const frameAt = (frames: Frame[], p: number): Viseme => {
  let v: Viseme = "rest";
  for (const f of frames) { if (f.at <= p) v = f.v; else break; }
  return v;
};

/** Ari's mouth and voice: talk() says text and moves the mouth along with it. */
export function useAri() {
  const [viseme, setViseme] = useState<Viseme>("rest");
  const [talking, setTalking] = useState(false);
  const frames = useRef<Frame[]>([]);
  const raf = useRef(0);
  const loop = useCallback(() => {
    const p = speakingProgress();
    setViseme(p === null ? "rest" : frameAt(frames.current, p));
    raf.current = requestAnimationFrame(loop);
  }, []);
  useEffect(() => () => { cancelAnimationFrame(raf.current); stopAll(); }, []);
  const begin = () => { cancelAnimationFrame(raf.current); setTalking(true); raf.current = requestAnimationFrame(loop); };
  const end = () => { cancelAnimationFrame(raf.current); setTalking(false); setViseme("rest"); };
  /** Says one thing. */
  const talk = useCallback(async (text: string, opts: { slow?: boolean } = {}) => {
    frames.current = timelineOf(text);
    begin();
    try { await say(text, opts); } finally { end(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /** Says several things in a row (a line, then a word). */
  const talkAll = useCallback(async (parts: { text: string; slow?: boolean }[]) => {
    begin();
    try { await sayAll(parts, (i) => { frames.current = timelineOf(parts[i].text); }); } finally { end(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const hush = useCallback(() => { stopAll(); end(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { viseme, talking, talk, talkAll, hush };
}

/* ------------------------------------------------------------------ the picture */

const LIP = "#9a3412", DARK = "#5b1a0e", TONGUE = "#f472b6", TEETH = "#fffdf7";
function Mouth({ v }: { v: Viseme }) {
  switch (v) {
    case "mbp": return <path d="M47 79 Q60 83 73 79" stroke={LIP} strokeWidth="4.5" fill="none" strokeLinecap="round" />;
    case "ai": return <g><ellipse cx="60" cy="80" rx="11" ry="9.5" fill={DARK} stroke={LIP} strokeWidth="2.5" /><ellipse cx="60" cy="85.5" rx="6.5" ry="3.2" fill={TONGUE} /></g>;
    case "e": return <g><rect x="47" y="75" width="26" height="10" rx="5" fill={DARK} stroke={LIP} strokeWidth="2.5" /><rect x="49.5" y="76.3" width="21" height="3.6" rx="1.5" fill={TEETH} /></g>;
    case "o": return <g><ellipse cx="60" cy="80" rx="7" ry="8.5" fill={DARK} stroke={LIP} strokeWidth="3" /><ellipse cx="60" cy="84.5" rx="3.5" ry="2" fill={TONGUE} /></g>;
    case "u": return <ellipse cx="60" cy="80" rx="4.5" ry="5" fill={DARK} stroke={LIP} strokeWidth="3.5" />;
    case "fv": return <g><ellipse cx="60" cy="80" rx="10" ry="5" fill={DARK} stroke={LIP} strokeWidth="2.5" /><rect x="52" y="75.2" width="16" height="4.4" rx="1.6" fill={TEETH} /></g>;
    case "th": return <g><ellipse cx="60" cy="80" rx="9" ry="5.5" fill={DARK} stroke={LIP} strokeWidth="2.5" /><rect x="53" y="75.4" width="14" height="2.8" rx="1" fill={TEETH} /><ellipse cx="60" cy="81" rx="5.5" ry="2.8" fill={TONGUE} /></g>;
    case "l": return <g><ellipse cx="60" cy="80" rx="9" ry="7.5" fill={DARK} stroke={LIP} strokeWidth="2.5" /><ellipse cx="60" cy="76.8" rx="4" ry="2.4" fill={TONGUE} /></g>;
    case "s": return <g><rect x="49" y="76" width="22" height="7.5" rx="3.5" fill={TEETH} stroke={LIP} strokeWidth="2.5" /><path d="M50 79.8 H70" stroke="#d6d3c4" strokeWidth="1" /></g>;
    case "sh": return <g><ellipse cx="60" cy="80" rx="7.5" ry="6.5" fill={DARK} stroke={LIP} strokeWidth="4" /><rect x="55" y="75.6" width="10" height="2.6" rx="1" fill={TEETH} /><rect x="55" y="82" width="10" height="2.4" rx="1" fill={TEETH} /></g>;
    case "r": return <ellipse cx="60" cy="80" rx="6" ry="5" fill={DARK} stroke={LIP} strokeWidth="3.2" />;
    case "k": return <g><ellipse cx="60" cy="80" rx="9.5" ry="7" fill={DARK} stroke={LIP} strokeWidth="2.5" /><ellipse cx="60" cy="84.6" rx="7" ry="2.6" fill={TONGUE} /></g>;
    default: return <path d="M47 76 Q60 87 73 76" stroke={LIP} strokeWidth="3.5" fill="none" strokeLinecap="round" />;
  }
}

export type AriMood = "happy" | "cheer" | "listen" | "think";
/** Ari. `viseme` is the mouth shape; `mood` changes the eyes. */
export function Ari({ viseme = "rest", mood = "happy", size = 120, className = "", label }: { viseme?: Viseme; mood?: AriMood; size?: number; className?: string; label?: string }) {
  const cheer = mood === "cheer";
  return (
    <svg className={`bg-ari ${cheer ? "is-cheer" : ""} ${className}`} width={size} height={size} viewBox="0 0 120 120" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <radialGradient id="bgAriFace" cx="42%" cy="36%" r="70%">
          <stop offset="0%" stopColor="#fff3b0" />
          <stop offset="55%" stopColor="#ffc93a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
      </defs>
      <g className="bg-ari-rays">
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d="M60 4 L66 17 Q60 19.5 54 17 Z" fill={i % 2 ? "#fbbf24" : "#fb923c"} transform={`rotate(${i * 30} 60 60)`} />
        ))}
      </g>
      <circle cx="60" cy="60" r="38" fill="url(#bgAriFace)" stroke="#ea8a07" strokeWidth="2" />
      {cheer
        ? <g stroke="#3b1d0e" strokeWidth="3.4" fill="none" strokeLinecap="round"><path d="M41 55 q6 -7 12 0" /><path d="M67 55 q6 -7 12 0" /></g>
        : <g className="bg-ari-eyes">
            <ellipse cx="47" cy="54" rx="5.2" ry={mood === "listen" ? 6.6 : 6} fill="#3b1d0e" />
            <ellipse cx="73" cy="54" rx="5.2" ry={mood === "listen" ? 6.6 : 6} fill="#3b1d0e" />
            <circle cx={mood === "think" ? 46 : 49} cy={mood === "think" ? 50.5 : 51.5} r="1.9" fill="#fff" />
            <circle cx={mood === "think" ? 72 : 75} cy={mood === "think" ? 50.5 : 51.5} r="1.9" fill="#fff" />
          </g>}
      {mood === "think" && <path d="M68 44 q6 -3 11 0" stroke="#3b1d0e" strokeWidth="2.4" fill="none" strokeLinecap="round" />}
      <circle cx="38" cy="68" r="5.5" fill="#fb7185" opacity=".45" />
      <circle cx="82" cy="68" r="5.5" fill="#fb7185" opacity=".45" />
      <Mouth v={cheer && viseme === "rest" ? "ai" : viseme} />
      {mood === "listen" && <g className="bg-ari-ear"><path d="M98 50 q8 10 0 20" stroke="#2b1d52" strokeWidth="3" fill="none" strokeLinecap="round" /><path d="M104 44 q13 16 0 32" stroke="#2b1d52" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".55" /></g>}
    </svg>
  );
}
