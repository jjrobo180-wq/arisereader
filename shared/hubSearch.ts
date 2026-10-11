// Search across a hub: every section, plugin and saved thing (students, to-dos, notes, meetings, events,
// recipes…) in one box. Matching forgives small typos and finds words anywhere in the title or details.

export type SearchEntry = { id: string; kind: string; title: string; sub?: string; keywords?: string };

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Edit distance up to `max`, or max + 1 when further. */
function near(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); best = Math.min(best, cur[j]); }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** How well one typed word fits one word of the entry: whole word, start of a word, inside a word, or a near miss. */
function fit(q: string, w: string): number {
  if (w === q) return 10;
  if (w.startsWith(q)) return 8;
  if (q.length >= 3 && w.includes(q)) return 5;
  if (q.length >= 4) { const d = near(q, w.slice(0, q.length + 1), q.length >= 7 ? 2 : 1); if (d <= (q.length >= 7 ? 2 : 1)) return 4 - d; }
  return 0;
}

/** Entries that match every typed word, best first. Title matches beat matches in the details. */
export function searchHub<T extends SearchEntry>(entries: T[], typed: string, limit = 30): T[] {
  const words = norm(typed).split(" ").filter(Boolean).slice(0, 6);
  if (!words.length) return [];
  const scored: { e: T; score: number }[] = [];
  for (const e of entries) {
    const title = norm(e.title).split(" "), rest = norm(`${e.sub || ""} ${e.keywords || ""} ${e.kind}`).split(" ");
    let score = 0, ok = true;
    for (const q of words) {
      const t = Math.max(0, ...title.map((w) => fit(q, w))) * 2, r = Math.max(0, ...rest.map((w) => fit(q, w)));
      if (!t && !r) { ok = false; break; }
      score += Math.max(t, r);
    }
    if (!ok) continue;
    if (norm(e.title).startsWith(norm(typed))) score += 15;
    scored.push({ e, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.e.title.localeCompare(b.e.title)).slice(0, limit).map((x) => x.e);
}
