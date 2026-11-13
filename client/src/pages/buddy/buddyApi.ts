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
    // The reader takes about 4 MB per page, so step down the size and quality until it fits (usually the first try).
    for (const [side, q] of [[1800, 0.82], [1600, 0.75], [1400, 0.7], [1200, 0.65]] as const) {
      const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
      const g = c.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      const url = c.toDataURL("image/jpeg", q);
      if (url.length <= 3_500_000) return url;
    }
    throw new Error("That photo is too big. Try again, a little farther back.");
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

// ---------------- Pictures ----------------
/** Fetches an image the server only gives to the right device (teacher key or linked laptop) as a local URL. */
export function useAuthedImage(path: string | null, auth: { teacher?: boolean; laptop?: LaptopId | null }) {
  const [url, setUrl] = useState("");
  const laptopId = auth.laptop?.id; const laptopKey = auth.laptop?.key;
  useEffect(() => {
    if (!path) { setUrl(""); return; }
    let gone = false; let made = "";
    const headers: Record<string, string> = {};
    if (auth.teacher) headers["x-buddy-teacher"] = teacherKey();
    if (laptopKey) headers["x-buddy-laptop"] = laptopKey;
    const q = laptopId ? `${path.includes("?") ? "&" : "?"}lid=${laptopId}` : "";
    fetch(`${API_BASE}/api/buddy${path}${q}`, { headers }).then((r) => (r.ok ? r.blob() : null)).then((b) => { if (b && !gone) { made = URL.createObjectURL(b); setUrl(made); } }).catch(() => {});
    return () => { gone = true; if (made) URL.revokeObjectURL(made); };
  }, [path, auth.teacher, laptopId, laptopKey]);
  return url;
}
export const figurePath = (wid: string, item: { id: string; figure: { img: string } | null }) => (item.figure?.img ? `/figure/${wid}/${item.id}/${item.figure.img}` : null);

export const loadImage = (src: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("That photo couldn't be opened.")); i.src = src; });
/** Cuts a picture out of a page photo. box is [left, top, right, bottom] in thousandths of the photo. */
export async function cropPhoto(src: string | HTMLImageElement, box: [number, number, number, number], pad = 15): Promise<string> {
  const img = typeof src === "string" ? await loadImage(src) : src;
  const W = img.naturalWidth, H = img.naturalHeight;
  const x0 = Math.max(0, (box[0] - pad) / 1000 * W), y0 = Math.max(0, (box[1] - pad) / 1000 * H);
  const x1 = Math.min(W, (box[2] + pad) / 1000 * W), y1 = Math.min(H, (box[3] + pad) / 1000 * H);
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  const scale = Math.min(1, 1400 / Math.max(w, h));
  const c = document.createElement("canvas"); c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  const g = c.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, x0, y0, w, h, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.88);
}

// ---------------- Say the answer ----------------
/** Records the student's voice until they tap again, then returns it as a data URL. */
export function useRecorder() {
  const rec = useRef<MediaRecorder | null>(null);
  const [on, setOn] = useState(false);
  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t)) || "";
    const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = []; r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    (r as any)._done = new Promise<string>((ok) => { r.onstop = () => { stream.getTracks().forEach((t) => t.stop()); const b = new Blob(chunks, { type: r.mimeType || "audio/webm" }); const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.readAsDataURL(b); }; });
    r.start(); rec.current = r; setOn(true);
  }, []);
  const stop = useCallback(async (): Promise<string> => { const r = rec.current; if (!r) return ""; r.stop(); rec.current = null; setOn(false); return (r as any)._done; }, []);
  useEffect(() => () => { try { rec.current?.stop(); } catch { /* fine */ } }, []);
  return { on, start, stop };
}
