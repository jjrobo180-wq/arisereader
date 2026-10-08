// What a parent invitation says about prizes and competitions.
//
// Two kinds of lines:
// - Prizes the admin has set (Reader of the Year, Reader of the Month). The admin can change them
//   on the admin page; until then the two below are used.
// - Competitions that are on right now (the Fall Break Competition, the chess competition). These
//   are added by themselves while they run, and drop out when they end.
import { clashDates, clashFirstDay, clashPhase, currentClash } from "./chessCompetition";
import { TIMED_COMPETITIONS, competitionPhase, whenText } from "./timedCompetitions";

export const INVITE_PRIZES_KEY = "invite_prizes";
export const PRIZE_LINE_MAX = 200;
export const PRIZE_LINES_MAX = 8;

export const DEFAULT_INVITE_PRIZES = [
  "Reader of the Year: the reader who earns the most points overall wins AirPods.",
  "Reader of the Month: the reader who earns the most points each month wins free DoorDash.",
];

/** Prize lines made safe to use: one line each, no list marks or odd characters, not too long, not too many. Takes a list or lines of text. */
export function cleanPrizeLines(raw: unknown): string[] {
  const lines = Array.isArray(raw) ? raw.map((x) => String(x ?? "")) : String(raw ?? "").split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const clean = line.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().replace(/^[-*•]\s*/, "").slice(0, PRIZE_LINE_MAX).trim();
    if (clean && !out.includes(clean)) out.push(clean);
    if (out.length >= PRIZE_LINES_MAX) break;
  }
  return out;
}

/** The prize lines the admin saved. Nothing saved yet means the two built-in ones; a saved empty list means none. */
export function readInvitePrizes(raw: unknown): string[] {
  if (raw === null || raw === undefined || raw === "") return [...DEFAULT_INVITE_PRIZES];
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(data?.lines) ? cleanPrizeLines(data.lines) : [...DEFAULT_INVITE_PRIZES];
  } catch { return [...DEFAULT_INVITE_PRIZES]; }
}

/** The competitions that are on, or about to start, each as one line. */
export function competitionLines(nowMs: number, siteUrl: string): string[] {
  const site = siteUrl.replace(/\/+$/, "");
  const out: string[] = [];
  for (const c of TIMED_COMPETITIONS) {
    if (competitionPhase(c, nowMs) === "over") continue;
    out.push(`${c.title}: from ${whenText(c.start)} to ${whenText(c.end)}, the reader who earns the most points wins ${c.prize}. Leaderboard: ${site}/#/${c.slug}`);
  }
  const clash = currentClash(nowMs);
  if (clash && clashPhase(clash, nowMs) === "live") out.push(`Chess: the ${clash.name} chess competition is on now (${clashDates(clash)}). Every finished game of Ultimate Chess earns competition points toward the crown.`);
  else if (clash && clashPhase(clash, nowMs) === "soon") out.push(`Chess: the ${clash.name} chess competition starts ${clashFirstDay(clash)} (${clashDates(clash)}). Every finished game of Ultimate Chess earns competition points toward the crown.`);
  return out;
}

/** Every line for the "Prizes and competitions" part of an invitation: the admin's prizes, then what is on right now. */
export const invitePrizeLines = (saved: string[], nowMs: number, siteUrl: string): string[] => [...saved, ...competitionLines(nowMs, siteUrl)];
