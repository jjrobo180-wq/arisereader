// Earshot (a LifeHub App Store app): real podcasts in a feed you swipe like short videos.
// Shows, episodes and artwork come from Apple Podcasts through the server (server/earshot.ts); audio
// comes from each podcast's host through the server, so stitched-in ads can be found and skipped. The ranking, parsing and saved-data rules live in
// shared/earshot.ts. What someone picked, follows, likes and saves is kept in family.earshot.
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { applySignal, emptyEarshot, type Earshot as EarshotData, type Signal } from "@shared/earshot";
import type { SectionProps } from "../ui";
import { Player, Setup } from "./EarshotPlayer";

export default function Earshot({ family, setFamily, say }: SectionProps) {
  const { token, user } = useAuth();
  const student = user?.role === "student";
  const es: EarshotData = family.earshot ?? emptyEarshot();
  const esRef = useRef(es); esRef.current = es;
  const update = useCallback((fn: (e: EarshotData) => EarshotData) => setFamily((f) => ({ ...f, earshot: fn(f.earshot ?? emptyEarshot()) })), [setFamily]);
  const explicit = !student && es.settings.explicit;

  const api = useCallback(async (path: string, init?: { method?: string; body?: unknown }) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: init?.method ?? "GET",
      headers: { ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body?.message || "Something went wrong. Try again."), { status: res.status, needSignIn: !!body?.needSignIn, needProfile: !!body?.needProfile });
    return body;
  }, [token]);
  // Audio comes through the server so smart ad skip can find the ads in this copy (server/podcastPlay.ts).
  const mediaUrl = useCallback((path: string) => `${API_BASE}${path}`, []);

  // ---------------- taste signals, saved in small batches ----------------
  const pending = useRef<{ genre: string; signal: Signal }[]>([]);
  const flushT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(() => {
    if (flushT.current) { clearTimeout(flushT.current); flushT.current = null; }
    const list = pending.current; pending.current = [];
    if (list.length) update((e) => list.reduce((acc, s) => applySignal(acc, s.genre, s.signal), e));
  }, [update]);
  const signal = useCallback((genre: string, s: Signal) => {
    pending.current.push({ genre, signal: s });
    if (!flushT.current) flushT.current = setTimeout(flush, 5000);
  }, [flush]);
  useEffect(() => () => flush(), [flush]);

  // ---------------- setup ----------------
  const [editing, setEditing] = useState(false);
  if (!es.setupDone || editing) {
    return <Setup initial={es} student={student} onDone={(genres, pace) => {
      update((e) => {
        const taste = { ...e.taste };
        for (const g of genres) taste[g] = Math.max(taste[g] ?? 0, 3);
        for (const g of e.genres) if (!genres.includes(g)) taste[g] = Math.min(taste[g] ?? 0.3, 0.6);
        return { ...e, setupDone: true, genres, pace, taste };
      });
      setEditing(false);
      say("Your feed is ready. Tap a cover to listen, swipe up for the next one.");
    }} onCancel={es.setupDone ? () => setEditing(false) : undefined} />;
  }
  return <Player es={es} esRef={esRef} update={update} api={api} signal={signal} say={say} student={student} explicit={explicit} onEditInterests={() => setEditing(true)} mediaUrl={mediaUrl} />;
}

