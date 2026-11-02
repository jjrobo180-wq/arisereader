// Arise Talk on the phone: the person's boards and settings (kept on the phone, backed up to their
// account when they have one), and the voice. Every word is said in an AI voice (POST /api/voice/say);
// each one is kept on the phone the first time, so a word said once is said instantly ever after,
// even offline. The words on the board being shown are fetched ahead, so a tap never waits.
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/queryClient";
import { voiceElement } from "@/lib/mediaUnlock";
import { cleanTalk, starterData, type TalkData, type TalkVoice } from "@shared/talk";

const DATA_KEY = "arise-talk-data";

// ——— A tiny IndexedDB key/value store (the voice clips) ———————————————————————————————————————————
let dbp: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      const r = indexedDB.open("arise-talk", 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("audio"); };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbp;
}
async function idbGet(key: string): Promise<{ buf: ArrayBuffer; type: string } | null> {
  const d = await db(); if (!d) return null;
  return new Promise((resolve) => {
    try { const q = d.transaction("audio").objectStore("audio").get(key); q.onsuccess = () => resolve(q.result || null); q.onerror = () => resolve(null); }
    catch { resolve(null); }
  });
}
async function idbPut(key: string, v: { buf: ArrayBuffer; type: string }) {
  const d = await db(); if (!d) return;
  try { d.transaction("audio", "readwrite").objectStore("audio").put(v, key); } catch { /* full: it's fetched again next time */ }
}

// ——— The voice ——————————————————————————————————————————————————————————————————————————————————
const clean = (t: string) => t.replace(/\s+/g, " ").trim();
const mem = new Map<string, Promise<Blob>>();
async function fetchClip(text: string, voice: TalkVoice): Promise<Blob> {
  let msg = "The voice needs an internet connection for new words.";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 900 * attempt));
    try {
      const r = await fetch(`${API_BASE}/api/voice/say`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }) });
      if (r.ok) { const b = await r.blob(); if (b.size > 100) return b; continue; }
      const body = await r.json().catch(() => ({} as any));
      msg = body?.message || msg;
      if (r.status !== 429 && r.status < 500) break;
    } catch { /* offline for a moment */ }
  }
  throw new Error(msg);
}
/** The clip for `text` in `voice`: from memory, then the phone, then the server (and kept). */
export function clip(text: string, voice: TalkVoice): Promise<Blob> {
  const t = clean(text); const key = `${voice}|${t}`;
  const hit = mem.get(key); if (hit) return hit;
  const p = (async () => {
    const saved = await idbGet(key);
    if (saved) return new Blob([saved.buf], { type: saved.type });
    const b = await fetchClip(t, voice);
    void b.arrayBuffer().then((buf) => idbPut(key, { buf, type: b.type || "audio/mpeg" }));
    return b;
  })();
  mem.set(key, p);
  while (mem.size > 400) mem.delete(mem.keys().next().value as string);
  p.catch(() => { if (mem.get(key) === p) mem.delete(key); });
  return p;
}

// Words fetched ahead, a few at a time, newest board first.
let queue: [string, TalkVoice][] = [];
let running = 0;
export function prefetch(texts: string[], voice: TalkVoice) {
  const fresh = texts.map(clean).filter(Boolean).filter((t) => !mem.has(`${voice}|${t}`));
  queue = [...fresh.map((t) => [t, voice] as [string, TalkVoice]), ...queue.filter(([t, v]) => v === voice && !fresh.includes(t))].slice(0, 300);
  pump();
}
function pump() {
  while (running < 3 && queue.length) {
    const [t, v] = queue.shift()!;
    running++;
    clip(t, v).catch(() => {}).finally(() => { running--; setTimeout(pump, 60); });
  }
}

let speaking = 0;
let url = "";
/** Says `text`. Resolves when it's done (false if stopped or it couldn't). */
export async function say(text: string, voice: TalkVoice, rate = 1, on?: { start?: () => void; error?: (m: string) => void }): Promise<boolean> {
  const id = ++speaking;
  const a = voiceElement();
  a.pause();
  try {
    const b = await clip(text, voice);
    if (id !== speaking) return false;
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(b);
    return await new Promise<boolean>((resolve) => {
      a.onended = () => resolve(true);
      a.onerror = () => resolve(false);
      a.src = url;
      a.playbackRate = rate;
      (a as any).preservesPitch = true; (a as any).webkitPreservesPitch = true;
      a.play().then(() => on?.start?.(), () => { on?.error?.("Tap again to hear it."); resolve(false); });
    });
  } catch (e: any) {
    if (id === speaking) on?.error?.(e?.message || "The voice couldn't play right now.");
    return false;
  }
}
export function stopSaying() { speaking++; try { voiceElement().pause(); } catch { /* none */ } }

// ——— The person's words and settings ————————————————————————————————————————————————————————————————
function load(): TalkData {
  try { const raw = localStorage.getItem(DATA_KEY); if (raw) return cleanTalk(JSON.parse(raw)); } catch { /* fresh start */ }
  return starterData();
}
/** The data, a setter that saves (with undo), and undo itself. */
export function useTalkData() {
  const [data, setData] = useState<TalkData>(load);
  const past = useRef<TalkData[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(DATA_KEY, JSON.stringify(data)); } catch { /* storage full */ } }, 250);
    return () => clearTimeout(t);
  }, [data]);
  const update = useCallback((fn: (d: TalkData) => TalkData, opts: { undo?: boolean } = {}) => {
    setData((d) => {
      const next = { ...fn(d), updatedAt: new Date().toISOString() };
      if (opts.undo !== false) { past.current = [...past.current.slice(-29), d]; setCanUndo(true); }
      return next;
    });
  }, []);
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (prev) setData(prev);
    setCanUndo(past.current.length > 0);
  }, []);
  const replace = useCallback((d: TalkData) => { past.current = []; setCanUndo(false); setData(cleanTalk(d)); }, []);
  return { data, update, undo, canUndo, replace };
}

// ——— The server ———————————————————————————————————————————————————————————————————————————————————
export async function talkApi<T>(token: string | null, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/talk${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(typeof init?.body === "string" ? { "Content-Type": "application/json" } : {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(body?.message || "Can't reach Arise right now. Check your connection."), { status: res.status });
  return body as T;
}
export type TalkMe = { premium: boolean; premiumUntil: string | null; plan: "month" | "year" | null; subscribed: boolean; backupAt: string | null };

/** A photo made small for a button (or for Snap to talk): a square-ish JPEG data URL. */
export function shrinkPhoto(file: File, max = 320, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const u = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(u); reject(new Error("That picture couldn't be opened.")); };
    img.src = u;
  });
}
