// A.R.I.S.E. Beginners: the Reading Coach's scoring. The child reads a story out loud; speech-to-text turns
// the recording into words; this lines those words up with the story's words (the same way a teacher marks
// a running record) and works out accuracy, words correct per minute and the words to practice.
//
// Rules, as in an oral reading fluency check:
// - A word read right is correct. A word read as another word, or skipped, is a miss.
// - Extra words (sounding out, repeating, saying a word twice, fixing a mistake) are not misses.
// - The words after the last word the child reached are "not read": they don't count against accuracy,
//   so stopping early is fine.
import { distance, normWord, sameWord } from "./phonics";

export type Mark = "ok" | "miss" | "skip" | "unread" | "punct";
export type ReadingResult = {
  /** One mark per word of the story, as shown (split on spaces). */
  marks: Mark[];
  /** What the child seemed to say for each word that was missed (or ""). */
  heard: string[];
  correct: number;
  /** Words the child reached (correct + missed + skipped). */
  attempted: number;
  /** Words in the story. */
  total: number;
  /** Percent of attempted words read correctly (0–100). */
  accuracy: number;
  /** Words correct per minute. */
  wcpm: number;
  seconds: number;
  /** Up to five words to practice, as written in the story (no punctuation). */
  practice: string[];
};

const FILLERS = new Set(["uh", "um", "umm", "er", "erm", "hmm", "mm", "ah", "oh", "uhh", "like"]);

/** The story split the way it's shown: one entry per space-separated token. */
export const storyTokens = (text: string) => text.split(/\s+/).filter(Boolean);
/** A token's word without punctuation, as written ("Pip!" → "Pip"). */
export const bareWord = (token: string) => token.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, "").replace(/[’‘]/g, "'");

/** Is `said` an acceptable reading of `word`? */
export function readAs(word: string, said: string): boolean {
  if (!word || !said) return false;
  if (sameWord(word, said)) return true;
  // Speech-to-text writes "can not" as "cannot", "ok" as "okay" and names its own way; allow tiny
  // spelling differences only for names and long words, never for short words a child can misread.
  return false;
}
/** A near miss: one letter off (shown as "almost"). */
export const nearly = (word: string, said: string) => word.length >= 3 && distance(word, said) === 1;

export function splitTranscript(transcript: string): string[] {
  return transcript
    .replace(/(\w)-(\w)/g, "$1 $2")
    .split(/\s+/)
    .map((t) => normWord(t))
    .filter((t) => t && !FILLERS.has(t));
}

/**
 * Lines a transcript up with a story. `names` are words that are names in the story (speech-to-text may spell
 * a name differently, so a name one or two letters off still counts).
 */
export function scoreReading(text: string, transcript: string, seconds: number, names: string[] = []): ReadingResult {
  const tokens = storyTokens(text);
  const story = tokens.map((t) => normWord(bareWord(t)));
  const index: number[] = []; // story positions that are real words
  story.forEach((w, i) => { if (w) index.push(i); });
  const said = splitTranscript(transcript);
  const nameSet = new Set(names.map((n) => normWord(n)));
  const match = (w: string, s: string) => readAs(w, s) || (nameSet.has(w) && distance(w, s) <= Math.min(2, Math.floor(w.length / 3)));

  // Weighted edit distance: matching is free, a missed word costs 1, an extra word costs 0.6 (extras aren't
  // errors, so they should be the cheap way to explain sounding-out and repeats), a substitution costs 1.
  const n = index.length, m = said.length;
  const EXTRA = 0.6, MISS = 1, SUB = 1;
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  const step: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0)); // 0 diag, 1 skip story word, 2 extra said word
  for (let i = 1; i <= n; i++) { cost[i][0] = i * MISS; step[i][0] = 1; }
  for (let j = 1; j <= m; j++) { cost[0][j] = j * EXTRA; step[0][j] = 2; }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const w = story[index[i - 1]], s = said[j - 1];
      const diag = cost[i - 1][j - 1] + (match(w, s) ? 0 : SUB);
      const skip = cost[i - 1][j] + MISS;
      const extra = cost[i][j - 1] + EXTRA;
      if (diag <= skip && diag <= extra) { cost[i][j] = diag; step[i][j] = 0; }
      else if (extra <= skip) { cost[i][j] = extra; step[i][j] = 2; }
      else { cost[i][j] = skip; step[i][j] = 1; }
    }
  }
  // Walk back to find, for each story word, the said word it lined up with (or none).
  const pairedWith: (number | null)[] = new Array(n).fill(null);
  for (let i = n, j = m; i > 0 || j > 0;) {
    const s = i > 0 && j > 0 ? step[i][j] : i > 0 ? 1 : 2;
    if (s === 0) { pairedWith[i - 1] = j - 1; i--; j--; }
    else if (s === 1) { i--; }
    else { j--; }
  }
  // The last story word the child reached: the last one paired with something they said.
  let reached = -1;
  for (let k = n - 1; k >= 0; k--) if (pairedWith[k] !== null) { reached = k; break; }
  // A reading that never matched anything at all is treated as not read (silence, noise, another text).
  const anyRight = pairedWith.some((p, k) => p !== null && match(story[index[k]], said[p]));
  if (!anyRight) reached = -1;

  const marks: Mark[] = tokens.map((_, i) => (story[i] ? "unread" : "punct"));
  const heard: string[] = tokens.map(() => "");
  let correct = 0, attempted = 0;
  const missed: string[] = [];
  for (let k = 0; k <= reached; k++) {
    const pos = index[k];
    const p = pairedWith[k];
    attempted++;
    if (p !== null && match(story[pos], said[p])) { marks[pos] = "ok"; correct++; continue; }
    marks[pos] = p === null ? "skip" : "miss";
    heard[pos] = p === null ? "" : said[p];
    missed.push(bareWord(tokens[pos]));
  }
  const secs = Math.max(1, Math.round(seconds));
  const accuracy = attempted ? Math.round((correct / attempted) * 100) : 0;
  // Short readings would give silly rates, so the minute is never shorter than 10 seconds.
  const wcpm = attempted ? Math.round((correct / Math.max(10, secs)) * 60) : 0;
  // Practice: the missed words, each once, longest (hardest) first, up to five.
  const seen = new Set<string>();
  const practice = missed
    .filter((w) => { const k = w.toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => b.length - a.length)
    .slice(0, 5);
  return { marks, heard, correct, attempted, total: n, accuracy, wcpm, seconds: secs, practice };
}

/** Did the child say this one word? Correct, close (one letter off), or neither. */
export function checkWord(target: string, transcript: string): { correct: boolean; close: boolean; heard: string } {
  const t = normWord(bareWord(target));
  const words = splitTranscript(transcript);
  const heard = words.join(" ").slice(0, 80);
  if (words.some((w) => sameWord(w, t))) return { correct: true, close: false, heard };
  // A two-word phrase ("all done", "choo choo", "beep beep") said as written.
  const phrase = target.toLowerCase().split(/\s+/).map((w) => normWord(w)).filter(Boolean);
  if (phrase.length > 1 && phrase.every((p) => words.some((w) => sameWord(w, p)))) return { correct: true, close: false, heard };
  return { correct: false, close: words.some((w) => nearly(t, w)), heard };
}

/** Story sentences, as the voice says them and the karaoke highlights them. */
export function sentencesOf(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+["”]?|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
}
