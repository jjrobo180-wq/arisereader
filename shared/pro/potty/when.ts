// Potty Training: "when did it happen?". Peed, Pooped, ate and drank are stamped with the clock by default,
// but a parent who forgot to tap (or lost the phone for a while) can say how long ago, or type the time.
import { clockOf, dayOf } from "./model";

/** How long ago, or a clock time (today, or yesterday). */
export type When = { mode: "ago"; ago: number } | { mode: "time"; time: string; yesterday: boolean };
export const JUST_NOW: When = { mode: "ago", ago: 0 };
export const AGO_CHOICES: [string, number][] = [["Just now", 0], ["5 min ago", 5], ["15 min ago", 15], ["30 min ago", 30], ["1 hour ago", 60]];
/** How far back a time can be typed: yesterday's start. A day or two is the most anyone forgets. */
const MAX_BACK_MS = 48 * 3600_000;

export type WhenResult = { ok: true; at: number } | { ok: false; error: string };

/** "14:05" (or "2:05") as hours and minutes, or null. */
export function parseClock(text: string): { h: number; m: number } | null {
  const hit = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(text || "");
  if (!hit) return null;
  const h = Number(hit[1]), m = Number(hit[2]);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59 ? { h, m } : null;
}

/** The moment a When means, as of `now`. A time that is still ahead is not accepted: nobody can log what has not happened. */
export function resolveWhen(when: When, now: number): WhenResult {
  if (when.mode === "ago") {
    const ago = Number.isFinite(when.ago) ? Math.max(0, Math.min(when.ago, 48 * 60)) : 0;
    return { ok: true, at: now - ago * 60_000 };
  }
  const t = parseClock(when.time);
  if (!t) return { ok: false, error: "Pick the time it happened." };
  const d = new Date(now);
  d.setDate(d.getDate() - (when.yesterday ? 1 : 0));
  d.setHours(t.h, t.m, 0, 0);
  const at = d.getTime();
  if (at > now + 60_000) return { ok: false, error: when.yesterday ? "That time is still ahead." : "That time hasn't happened yet today. Pick an earlier time, or choose Yesterday." };
  if (now - at > MAX_BACK_MS) return { ok: false, error: "That was too long ago to add here." };
  return { ok: true, at: Math.min(at, now) };
}

/** "3:20 PM", "3:20 PM yesterday", or "3:20 PM on Oct 14" for the confirmation line. */
export function whenText(at: number, now: number): string {
  const day = dayOf(at), today = dayOf(now);
  if (day === today) return clockOf(at);
  const y = new Date(now); y.setDate(y.getDate() - 1);
  return `${clockOf(at)} ${day === dayOf(y.getTime()) ? "yesterday" : `on ${new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}`;
}

/**
 * The reminder minutes after an event that happened `at`: the trip interval counts from then, not from now, so a pee
 * logged 40 minutes late sets a timer 40 minutes shorter. At least one minute, so an overdue trip rings straight away.
 */
export const minutesAfter = (minutes: number, at: number, now: number): number => Math.max(1, minutes - Math.max(0, Math.floor((now - at) / 60_000)));
