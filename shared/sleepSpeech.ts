// Arise LifeHub · Sleep: turning a script into what the voice reads, one sentence at a time with
// a calm pause after each. Plain text logic, kept here so it can be tested; the narrator
// (client/src/components/family-hub/sleep/narrator.ts) does the speaking.

import type { ScriptLine } from "./sleepScripts";

export type Pace = "slow" | "slower" | "slowest";
export type Segment = { text: string; pauseMs: number };

/** The quiet after each sentence, and how much the written pauses stretch, at each pace. */
export const GAP: Record<Pace, number> = { slow: 700, slower: 1300, slowest: 2000 };
export const STRETCH: Record<Pace, number> = { slow: 0.75, slower: 1, slowest: 1.35 };
export const MAX_CHARS = 480; // the voice service takes up to 500 characters at a time

/** Splits text into sentences without regular-expression lookbehind, which older iPhones can't
 *  parse (one unparseable pattern would stop the whole page from loading). */
export function splitSentences(text: string): string[] {
  const s = text.replace(/\s+/g, " ").trim();
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== "." && c !== "!" && c !== "?" && c !== "…") continue;
    let j = i + 1;
    while (j < s.length && "”\"’')]".includes(s[j])) j++;
    if (s[j] === " " && /[“"‘'(A-Z0-9]/.test(s[j + 1] || "")) {
      out.push(s.slice(start, j).trim());
      start = j + 1;
      i = j;
    }
  }
  if (start < s.length) out.push(s.slice(start).trim());
  return out.flatMap((p) => chunk(p)).filter(Boolean);
}

/** A sentence too long for one request, broken at a comma, semicolon or colon near the limit. */
function chunk(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > MAX_CHARS) {
    const window = rest.slice(0, MAX_CHARS);
    const cut = Math.max(window.lastIndexOf("; "), window.lastIndexOf(": "), window.lastIndexOf(", "));
    const at = cut > MAX_CHARS * 0.4 ? cut + 1 : window.lastIndexOf(" ") > 0 ? window.lastIndexOf(" ") : MAX_CHARS;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/** A script as sentences with the quiet after each, for the chosen pace. */
export function toSegments(lines: readonly ScriptLine[], pace: Pace): Segment[] {
  const out: Segment[] = [];
  for (const line of lines) {
    if (typeof line === "number") {
      const extra = Math.round(line * 1000 * STRETCH[pace]);
      if (out.length) out[out.length - 1].pauseMs += extra;
      else out.push({ text: "", pauseMs: extra });
      continue;
    }
    for (const sentence of splitSentences(line)) out.push({ text: sentence, pauseMs: GAP[pace] });
  }
  return out;
}
