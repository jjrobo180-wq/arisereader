// TTS Buddy's calls to the server (server/ttsBuddy.ts) and the voice player that lights up each word as it's said.
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/queryClient";
import { wordAt, type WordTime } from "@shared/ttsBuddy";

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string | null) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private window: works until reload */ } },
};
const randomKey = () => { const b = new Uint8Array(24); crypto.getRandomValues(b); return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };

/** The teacher's phone keeps one long random key; it's their worksheets' only "account". */
export function teacherKey(): string {
  let k = store.get("tts-buddy-teacher");
  if (!k || !/^[A-Za-z0-9_-]{32,80}$/.test(k)) { k = randomKey(); store.set("tts-buddy-teacher", k); }
  return k;
}
export type LaptopId = { id: string; key: string };
export const savedLaptop = (): LaptopId | null => { try { const v = JSON.parse(store.get("tts-buddy-laptop") || "null"); return v?.id && v?.key ? v : null; } catch { return null; } };
export const saveLaptop = (v: LaptopId | null) => store.set("tts-buddy-laptop", v ? JSON.stringify(v) : null);

export class BuddyError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function call<T>(path: string, opts: { method?: string; body?: unknown; teacher?: boolean; laptop?: LaptopId | null } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.teacher) headers["x-buddy-teacher"] = teacherKey();
  if (opts.laptop) headers["x-buddy-laptop"] = opts.laptop.key;
  let r: Response;
  try { r = await fetch(`${API_BASE}/api/buddy${path}`, { method: opts.method || (opts.body ? "POST" : "GET"), headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: "no-store" }); }
  catch { throw new BuddyError("No internet connection. Check the Wi-Fi and try again.", 0); }
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new BuddyError(j.message || "Something went wrong. Try again.", r.status);
  return j as T;
}

/** Shrinks a phone photo so it uploads quickly but stays sharp enough to read (long side 1800px, JPEG). */
export async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("That photo couldn't be opened.")); i.src = url; });
    const scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  } finally { URL.revokeObjectURL(url); }
}

// ---------------- The voice ----------------
export type Clip = { audio: string; words: WordTime[]; duration: number };
export type Playing = { itemId: string; part: string; word: number } | null;
type Fetch = (itemId: string, part: string) => Promise<Clip>;

/** Plays parts of a worksheet one after another ("q", then "c0", "c1"…) and reports which word is being said. */
export function useVoice(fetchClip: Fetch, rate: number) {
  const cache = useRef(new Map<string, Promise<Clip>>());
  const audio = useRef<HTMLAudioElement | null>(null);
  const run = useRef(0);
  const [playing, setPlaying] = useState<Playing>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const rateRef = useRef(rate); rateRef.current = rate;

  const get = useCallback((itemId: string, part: string) => {
    const k = `${itemId}|${part}`;
    let p = cache.current.get(k);
    if (!p) { p = fetchClip(itemId, part); cache.current.set(k, p); p.catch(() => cache.current.delete(k)); }
    return p;
  }, [fetchClip]);
  /** Gets clips ready ahead of time, so tapping "Read to me" plays straight away. */
  const prefetch = useCallback((itemId: string, parts: string[]) => { for (const p of parts) get(itemId, p).catch(() => {}); }, [get]);

  const stop = useCallback(() => { run.current++; audio.current?.pause(); setPlaying(null); setLoading(false); }, []);
  const play = useCallback(async (itemId: string, parts: string[]) => {
    const me = ++run.current;
    audio.current?.pause();
    if (!audio.current) audio.current = new Audio();
    const a = audio.current;
    setError("");
    for (const part of parts) {
      setLoading(true);
      let clip: Clip;
      try { clip = await get(itemId, part); } catch (e: any) { if (me === run.current) { setError(e.message || "The voice isn't available right now."); setLoading(false); setPlaying(null); } return; }
      if (me !== run.current) return;
      setLoading(false);
      a.src = clip.audio; a.playbackRate = rateRef.current; (a as any).preservesPitch = true;
      setPlaying({ itemId, part, word: -1 });
      const finished = new Promise<void>((done) => { a.onended = () => done(); a.onerror = () => done(); a.onpause = () => { if (me !== run.current) done(); }; });
      try { await a.play(); } catch { if (me === run.current) { setPlaying(null); setError("Tap Read to me to hear it."); } return; }
      let raf = 0;
      const tick = () => { if (me !== run.current) return; setPlaying({ itemId, part, word: wordAt(clip.words, a.currentTime) }); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
      await finished; cancelAnimationFrame(raf);
      if (me !== run.current) return;
      await new Promise((r) => setTimeout(r, 350)); // a breath between the question and each choice
      if (me !== run.current) return;
    }
    setPlaying(null);
  }, [get]);
  useEffect(() => () => { run.current++; audio.current?.pause(); }, []);
  useEffect(() => { if (audio.current) audio.current.playbackRate = rate; }, [rate]);
  return { play, stop, prefetch, playing, loading, error };
}

/** Atkinson Hyperlegible: a typeface made for readers who find letters hard to tell apart. */
export function useBuddyFont() {
  useEffect(() => {
    if (document.getElementById("buddy-font")) return;
    const l = document.createElement("link"); l.id = "buddy-font"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Fredoka:wght@500;600;700&display=swap";
    document.head.appendChild(l);
  }, []);
}
export const FONT = "'Atkinson Hyperlegible', ui-sans-serif, system-ui, sans-serif";
export const BRAND_FONT = "Fredoka, 'Atkinson Hyperlegible', ui-rounded, system-ui, sans-serif";
export const B = { bg: "#fbf6ec", ink: "#1d2433", dim: "#5d6577", line: "#e7dfcf", card: "#ffffff", accent: "#ff6b3d", accentDeep: "#e2521f", blue: "#2f6fdb", green: "#1f9d6b", mark: "#ffe066", soft: "#fff1e8" };
