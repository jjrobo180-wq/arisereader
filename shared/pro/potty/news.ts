// What's new in a saved Potty Training app: the entries a save added, so the server can tell the other people who
// share the app ("Sarah logged Pee in the potty · Ariana · just now") and check off Accountability to-dos linked to
// Potty Training (server/pottySync.ts). Pure, so it's tested (tests/potty-news.test.ts).
import { KINDS, cleanData, type Kind } from "./model";

export type PottyNews = { id: string; kind: Kind; kid: string; at: number; label: string; emoji: string; counts: boolean };

/** Entries in `after` that weren't in `before`, logged in the last 12 hours, newest first (at most 5). `counts`:
 *  a potty trip, an accident or a diaper, which checks off a linked to-do (drinks, food and sleep don't). */
export function newPottyEntries(before: unknown, after: unknown, nowMs: number): PottyNews[] {
  const old = new Set(cleanData(before).logs.map((e) => e.id));
  const d = cleanData(after);
  const name = (id: string) => d.kids.find((k) => k.id === id)?.name || "";
  return d.logs
    .filter((e) => !old.has(e.id) && e.at > nowMs - 12 * 3_600_000 && e.at < nowMs + 10 * 60_000)
    .sort((a, b) => b.at - a.at)
    .slice(0, 5)
    .map((e) => {
      const k = KINDS[e.kind];
      return { id: e.id, kind: e.kind, kid: name(e.kid), at: e.at, label: k.label, emoji: k.emoji, counts: k.group === "potty" || k.group === "accident" || k.group === "diaper" };
    });
}

/** "just now", "5 min ago", "2 hr ago". */
export function agoWords(at: number, nowMs: number): string {
  const m = Math.max(0, Math.round((nowMs - at) / 60_000));
  return m < 2 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} hr ago`;
}

/** The notification the others get. */
export function pottyNewsText(who: string, news: PottyNews[], nowMs: number): { title: string; body: string } {
  const top = news[0];
  const by = who || "Someone";
  const title = news.length > 1 ? `${by} logged ${news.length} things in Potty Training` : `${top.emoji} ${by} logged: ${top.label}`;
  const body = news.length > 1
    ? news.map((n) => `${n.emoji} ${n.label}`).join(" · ")
    : [top.kid, agoWords(top.at, nowMs)].filter(Boolean).join(" · ");
  return { title: title.slice(0, 120), body: body.slice(0, 200) };
}
