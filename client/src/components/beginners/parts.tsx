// A.R.I.S.E. Beginners: the small pieces every screen uses. Letter tiles follow the Montessori colors teachers know
// (vowels blue, consonants red), syllables are purple; sound boxes have a dot under each box for each sound.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { API_BASE } from "@/lib/queryClient";
import { isVowelPart } from "@shared/beginners/phonics";

/** Loads the two reading fonts once: Andika (made for beginning readers: a and g as children write them) and Lexend. */
export function useBeginnersFonts() {
  useEffect(() => {
    if (document.getElementById("bg-fonts")) return;
    const l = document.createElement("link");
    l.id = "bg-fonts"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Andika:wght@400;700&family=Lexend:wght@500;700;800&display=swap";
    document.head.appendChild(l);
  }, []);
}

/** The Beginners API, signed in as the current user. Errors carry the server's message. */
export function useApi(token: string | null) {
  return useCallback(async (path: string, init: RequestInit = {}) => {
    const r = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { const e: any = new Error(data.message || "Something went wrong. Please try again."); e.status = r.status; e.data = data; throw e; }
    return data;
  }, [token]);
}

export type TileKind = "vowel" | "consonant" | "syllable";
export const tileKind = (part: string, syll = false): TileKind => (syll ? "syllable" : isVowelPart(part.toLowerCase()) || /^(a|e|i|o|u)_e$/.test(part) ? "vowel" : "consonant");

/** A letter tile, like a magnetic letter. */
export function Tile({ text, syll = false, onClick, disabled, size = "md", state, label, pulse }: {
  text: string; syll?: boolean; onClick?: () => void; disabled?: boolean; size?: "sm" | "md" | "lg"; state?: "ok" | "bad" | null; label?: string; pulse?: boolean;
}) {
  const kind = tileKind(text, syll);
  const cls = `bg-tile bg-tile-${kind} bg-tile-${size}${state ? ` is-${state}` : ""}${pulse ? " is-pulse" : ""}${text.length > 2 ? " is-wide" : ""}`;
  if (!onClick) return <span className={cls} aria-label={label}>{text}</span>;
  return <button type="button" className={cls} onClick={onClick} disabled={disabled} aria-label={label || text}>{text}</button>;
}

/** Sound boxes: one box per spelling part, with a dot under it for each sound (none for a silent e). */
export function SoundBoxes({ parts, dots, syll = false, states, onBox, big = false, label }: {
  parts: (string | null)[]; dots?: number[]; syll?: boolean; states?: ("ok" | "bad" | null)[]; onBox?: (i: number) => void; big?: boolean; label?: string;
}) {
  return (
    <div className={`bg-boxes${big ? " is-big" : ""}`} role="group" aria-label={label || "Sound boxes"}>
      {parts.map((p, i) => (
        <div key={i} className="bg-box-col">
          <button type="button" className={`bg-box${p ? " is-filled" : ""}${states?.[i] ? ` is-${states[i]}` : ""}`} onClick={() => onBox?.(i)} disabled={!onBox || !p}
            aria-label={p ? `Box ${i + 1}: ${p}. Tap to take it out.` : `Box ${i + 1}, empty`}>
            {p ? <Tile text={p} syll={syll} size={big ? "lg" : "md"} /> : <span className="bg-box-empty" aria-hidden="true" />}
          </button>
          {dots && !syll && <span className="bg-dots" aria-hidden="true">{Array.from({ length: dots[i] ?? 1 }, (_, j) => <i key={j} />)}{dots[i] === 0 && <em>silent</em>}</span>}
        </div>
      ))}
    </div>
  );
}

export function Stars({ n, of = 3, size = 22, label }: { n: number; of?: number; size?: number; label?: string }) {
  return (
    <span className="bg-stars" role="img" aria-label={label ?? `${n} of ${of} stars`}>
      {Array.from({ length: of }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" className={i < n ? "is-on" : ""} aria-hidden="true">
          <path d="M12 2.6l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.3 6.1 20.5l1.3-6.5L2.5 9.4l6.6-.8z" />
        </svg>
      ))}
    </span>
  );
}

/** What Ari says, in a speech bubble. Tapping the speaker says it again. */
export function Bubble({ children, onSpeak, tone = "plain" }: { children: ReactNode; onSpeak?: () => void; tone?: "plain" | "good" | "try" }) {
  return (
    <div className={`bg-bubble is-${tone}`} aria-live="polite">
      <span className="bg-bubble-text">{children}</span>
      {onSpeak && <button type="button" className="bg-speak" onClick={onSpeak} aria-label="Hear it again"><SpeakerIcon /></button>}
    </div>
  );
}
export function SpeakerIcon({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" /><path d="M16 8.5c1.3 1 2 2.2 2 3.5s-.7 2.5-2 3.5M18.5 6c2 1.6 3 3.6 3 6s-1 4.4-3 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>;
}
export function MicIcon({ size = 26 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" /><path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" /></svg>;
}

/** The voice bar: fills while the child makes sound (Speech Blubs' "fill the bar"). */
export function VoiceBar({ fill, level }: { fill: number; level: number }) {
  return (
    <div className="bg-voicebar" role="progressbar" aria-label="Voice bar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fill * 100)}>
      <span className="bg-voicebar-fill" style={{ width: `${Math.round(Math.min(1, fill) * 100)}%` }} />
      <span className="bg-voicebar-level" style={{ transform: `scaleY(${0.25 + level * 0.75})` }} />
      {fill >= 1 && <span className="bg-voicebar-done" aria-hidden="true">⭐</span>}
    </div>
  );
}

/** Confetti for the one big moment (respects reduced motion). */
export function Confetti({ go }: { go: number }) {
  const [bits, setBits] = useState<{ id: number; left: number; color: string; dur: number; delay: number; rot: number }[]>([]);
  useEffect(() => {
    if (!go) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#ffbe2e", "#2f6fe4", "#e5484d", "#12a150", "#7c4dff", "#fb923c"];
    setBits(Array.from({ length: 70 }, (_, i) => ({ id: go * 100 + i, left: Math.random() * 100, color: colors[i % colors.length], dur: 1.8 + Math.random() * 1.4, delay: Math.random() * 0.5, rot: Math.random() * 360 })));
    const t = setTimeout(() => setBits([]), 3600);
    return () => clearTimeout(t);
  }, [go]);
  return bits.length ? <div className="bg-confetti" aria-hidden="true">{bits.map((b) => <i key={b.id} style={{ left: `${b.left}%`, background: b.color, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s`, transform: `rotate(${b.rot}deg)` }} />)}</div> : null;
}

/** A small dialog (never the browser's own pop-ups, which freeze the page). */
export function Dialog({ title, children, actions }: { title: string; children?: ReactNode; actions: ReactNode }) {
  return (
    <div className="bg-dialog-back" role="dialog" aria-modal="true" aria-label={title}>
      <div className="bg-dialog">
        <h2>{title}</h2>
        {children}
        <div className="bg-dialog-actions">{actions}</div>
      </div>
    </div>
  );
}
