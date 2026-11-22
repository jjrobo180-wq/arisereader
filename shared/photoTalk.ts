// Photo Talk (Arise AAC, Talk shelf): talking with real photos of a child's own things. A grown-up takes or
// picks the photos in the app; the child uses them four ways:
//   Swipe       one big photo at a time, swipe up for the next, tap to say it (like a video feed)
//   Right now   only 3 photos, the ones for this part of her day (morning, lunch, afternoon, dinner, bed)
//   This or that two big photos side by side, plus "neither"
//   My phrases  whole phrases she already uses, each on a photo, in a voice she knows
// Room scenes (tap the fridge in a photo of the kitchen) are My World, which already does that with photos.
// The photos live in the same private storage as My World (never a public link); this file holds the rules
// both the server and the screens use.

export const TIMES = ["morning", "lunch", "afternoon", "dinner", "bed"] as const;
export type TimeOfDay = typeof TIMES[number];
export const TIME_LABEL: Record<TimeOfDay, string> = { morning: "Morning", lunch: "Lunch", afternoon: "Afternoon", dinner: "Dinner", bed: "Bedtime" };

export type PhotoCard = { id: string; label: string; phrase: string; photoPath: string | null; times: TimeOfDay[] };
export type PhotoPhrase = { id: string; say: string; means: string; photoPath: string | null };
export type PhotoTalkConfig = { cards: PhotoCard[]; phrases: PhotoPhrase[] };

export const MAX_CARDS = 60;
export const MAX_PHRASES = 30;
export const RIGHT_NOW_COUNT = 3;

const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const cleanId = (v: unknown, fallback: string) => String(v ?? "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || fallback;

export const emptyPhotoTalk = (): PhotoTalkConfig => ({ cards: [], phrases: [] });

/** What the child sees when there is a photo but no sentence yet: "I want juice". */
export const cardSays = (c: Pick<PhotoCard, "label" | "phrase">) => c.phrase || (c.label ? `I want ${c.label}` : "");

/** Checks and tidies a board before it is saved. `owner` is the child's id: every photo has to be one of
 *  theirs (stored under `<owner>/…`), so a board can never point at another child's pictures. */
export function normalizePhotoTalk(input: unknown, owner: number): PhotoTalkConfig {
  const raw: any = input && typeof input === "object" ? input : {};
  const cardsIn = Array.isArray(raw.cards) ? raw.cards : [];
  const phrasesIn = Array.isArray(raw.phrases) ? raw.phrases : [];
  if (cardsIn.length > MAX_CARDS) throw new Error(`Use up to ${MAX_CARDS} photos.`);
  if (phrasesIn.length > MAX_PHRASES) throw new Error(`Use up to ${MAX_PHRASES} phrases.`);
  const photo = (p: unknown) => {
    if (p == null || p === "") return null;
    const path = String(p);
    if (!path.startsWith(`${owner}/`) || path.includes("..")) throw new Error("A photo does not belong to this child.");
    return path.slice(0, 200);
  };
  const seen = new Set<string>();
  const unique = (id: string) => { let out = id; let n = 2; while (seen.has(out)) out = `${id}-${n++}`; seen.add(out); return out; };
  const cards = cardsIn.map((c: any, i: number): PhotoCard => {
    const label = clean(c?.label, 40);
    if (!label) throw new Error("Every photo needs a word, like “juice”.");
    const times = Array.isArray(c?.times) ? TIMES.filter((t) => c.times.includes(t)) : [];
    return { id: unique(cleanId(c?.id, `card-${i + 1}`)), label, phrase: clean(c?.phrase, 120), photoPath: photo(c?.photoPath), times };
  });
  const phrases = phrasesIn.map((p: any, i: number): PhotoPhrase => {
    const say = clean(p?.say, 120);
    if (!say) throw new Error("Every phrase needs the words she says.");
    return { id: unique(cleanId(p?.id, `phrase-${i + 1}`)), say, means: clean(p?.means, 120), photoPath: photo(p?.photoPath) };
  });
  return { cards, phrases };
}

/** The part of the day it is at this hour (0–23). */
export function timeOfDay(hour: number): TimeOfDay {
  if (hour < 11) return "morning";
  if (hour < 14) return "lunch";
  if (hour < 17) return "afternoon";
  if (hour < 20) return "dinner";
  return "bed";
}

/** Right now: the 3 photos for this part of the day. When fewer are marked for it, the first photos on
 *  her board fill the rest, so there are always 3 (or as many as she has). */
export function rightNow<T extends Pick<PhotoCard, "id" | "times">>(cards: readonly T[], time: TimeOfDay, count = RIGHT_NOW_COUNT): T[] {
  const marked = cards.filter((c) => c.times.includes(time));
  const rest = cards.filter((c) => !c.times.includes(time));
  return [...marked, ...rest].slice(0, count);
}

/** This or that, round n: two different photos. Rounds go through every pair in a steady order, the same
 *  round always the same pair, and the two swap sides so one photo isn't always on top. */
export function thisOrThat<T>(cards: readonly T[], round: number): [T, T] | null {
  const n = cards.length;
  if (n < 2) return null;
  const pairs: Array<[number, number]> = [];
  for (let gap = 1; gap < n; gap++) for (let i = 0; i + gap < n; i++) pairs.push([i, i + gap]);
  const r = ((round % pairs.length) + pairs.length) % pairs.length;
  const [a, b] = pairs[r];
  return r % 2 ? [cards[b], cards[a]] : [cards[a], cards[b]];
}

/** Swipe: the card after (step 1) or before (step -1) this one, going round. */
export const swipeTo = (index: number, step: number, count: number) => (count ? (((index + step) % count) + count) % count : 0);
