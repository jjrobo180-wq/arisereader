// Downloads for listening without a connection. The player shared with Arise's Earshot only asks
// this registry; Pod+ plugs in the real downloader (podscroll/downloads.ts). With nothing plugged in
// (Arise), there are no download buttons and every episode streams as before.
import { useEffect, useState } from "react";
import type { SavedEpisode } from "@shared/earshot";

export type DownloadState = { status: "none" | "saving" | "saved" | "error"; pct: number; error?: string };
export type DownloadedEpisode = { kind: "episode"; id: string; ep: SavedEpisode; bytes: number; savedAt: number };

export type OfflineAudio = {
  /** A playable copy on this device, or null. Synchronous: the player asks while picking a source. */
  url: (key: string) => string | null;
  state: (key: string) => DownloadState;
  /** Members only; others are asked to join (the downloader does that). */
  saveEpisode: (ep: SavedEpisode) => Promise<void>;
  remove: (key: string) => Promise<void>;
  episodes: () => DownloadedEpisode[];
};

let impl: OfflineAudio | null = null;
const waiting = new Set<() => void>();
/** The downloader calls this whenever a download starts, moves, finishes or is removed. */
export function notifyOffline() { waiting.forEach((f) => f()); }
export function setOfflineAudio(o: OfflineAudio | null) { impl = o; notifyOffline(); }
export const offlineAudio = () => impl;

/** Re-renders when downloads change; returns the downloader (or null where there is none). */
export function useOfflineAudio(): OfflineAudio | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const bump = () => tick((n) => n + 1);
    waiting.add(bump);
    return () => { waiting.delete(bump); };
  }, []);
  return impl;
}

export const episodeKey = (id: string) => `ep:${id}`;
export const chapterKey = (bookId: string, n: number) => `book:${bookId}:${n}`;
