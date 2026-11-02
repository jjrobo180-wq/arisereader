// Arise Coaching on the phone: calls to server/coach.ts and the hooks both apps use (Arise Fit's
// "Find a trainer" and "My trainer", and the Arise Trainer app).
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/queryClient";
import type { ClientSide, Coaching, Consent, Library, LinkStatus, Message, PublicTrainer, Review, Snapshot, TrainerProfile } from "@shared/coach";

export async function coachApi<T>(token: string | null, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/coach${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.body ? { "Content-Type": "application/json" } : {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || "Can't reach Arise right now. Check your connection.");
  return body as T;
}
export const post = <T,>(token: string | null, path: string, body: unknown = {}) => coachApi<T>(token, path, { method: "POST", body: JSON.stringify(body) });
export const put = <T,>(token: string | null, path: string, body: unknown) => coachApi<T>(token, path, { method: "PUT", body: JSON.stringify(body) });

export type MyLink = { id: string; status: LinkStatus; consent: Consent; since: string; coaching: Omit<Coaching, "notes" | "tags">; clientSide: ClientSide; unread: number; last?: Message; trainer: (PublicTrainer & { welcome: string }) | null };
export type Compliance = { workouts: [number, number]; habits: [number, number]; pct: number | null };
export type ClientRow = { id: string; clientId: number; name: string; status: LinkStatus; since: string; consent: Consent; tags: string[]; phase: string; unread: number; last?: Message; compliance: Compliance; lastWorkout: string | null; nextAppt: string | null };
export type TrainerHome = { profile: TrainerProfile; listed: boolean; paidUntil: string | null; subscribed: boolean; problems: string[]; library: Library; clients: ClientRow[]; reviews: Review[]; price: { cents: number; trialDays: number; name: string }; payments: boolean };
export type ClientDetail = { id: string; status: LinkStatus; consent: Consent; coaching: Coaching; clientSide: ClientSide; snapshot: Snapshot; compliance: Compliance; compliance30: Compliance };

/** Loads something, and again every `every` ms while the screen is open (and when the app comes back). */
export function usePoll<T>(load: () => Promise<T>, deps: unknown[], every = 0) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState("");
  const live = useRef(true);
  const run = useCallback(async () => { try { const d = await load(); if (live.current) { setData(d); setErr(""); } } catch (e: any) { if (live.current) setErr(e.message); } }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    live.current = true; void run();
    const t = every ? window.setInterval(() => { if (document.visibilityState !== "hidden") void run(); }, every) : 0;
    const vis = () => { if (document.visibilityState === "visible") void run(); };
    document.addEventListener("visibilitychange", vis);
    return () => { live.current = false; if (t) window.clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [run, every]);
  return { data, err, reload: run, setData };
}

/** A conversation, checking for new messages every few seconds. */
export function useMessages(token: string | null, linkId: string) {
  const [list, setList] = useState<Message[]>([]);
  const last = useRef(0);
  const fetchNew = useCallback(async () => {
    const r = await coachApi<{ messages: Message[] }>(token, `/links/${linkId}/messages?after=${last.current}`);
    if (r.messages.length) { last.current = r.messages[r.messages.length - 1].id; setList((l) => [...l.filter((m) => !r.messages.some((n) => n.id === m.id)), ...r.messages]); }
    return r.messages.length;
  }, [token, linkId]);
  const { err } = usePoll(fetchNew, [fetchNew], 5000);
  const send = useCallback(async (body: string, img?: string) => {
    const r = await post<{ message: Message }>(token, `/links/${linkId}/messages`, { body, img });
    last.current = Math.max(last.current, r.message.id);
    setList((l) => [...l, r.message]);
  }, [token, linkId]);
  return { list, send, err };
}

/** Shrinks a photo on the phone to a JPEG data URL (longest side `max` px), small enough to send. */
export function shrinkImage(file: File, max = 900, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That photo couldn't be opened.")); };
    img.src = url;
  });
}

export const dayKeyOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const shortDate = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
export const ago = (iso: string) => { const s = (Date.now() - Date.parse(iso)) / 1000; return s < 60 ? "now" : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`; };
