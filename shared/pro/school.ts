// The thinking behind the school apps, kept apart from the screens so it can be tested:
// spaced-repetition scheduling, GPA and final-grade maths, citations, word search and
// crossword generation, fraction arithmetic with worked steps, typing scores, study-session
// spreading and the periodic table.

// ─── Seeded random numbers (so a puzzle stays the same when reopened) ───
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const dayMs = 86_400_000;
const parse = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const plus = (k: string, n: number) => { const d = parse(k); d.setDate(d.getDate() + n); return key(d); };

// ─── Flashcards: Leitner boxes ───
/** Days until a card in each box comes back. Box 1 is "every session". */
export const BOX_DAYS = [0, 0, 1, 3, 7, 14, 30];
export const MAX_BOX = 6;
export type Leitner = { box: number; due: string };
/** Right answers move a card up a box (seen less often); a miss sends it back to box 1. */
export function review(card: Leitner, correct: boolean, today: string): Leitner {
  const box = correct ? Math.min(MAX_BOX, Math.max(1, card.box) + 1) : 1;
  return { box, due: plus(today, BOX_DAYS[box]) };
}
export const isDue = (c: Leitner, today: string) => !c.due || c.due <= today;

// ─── GPA ───
export const LETTERS: [string, number, number][] = [
  // letter, 4.0 points, lowest percent
  ["A+", 4.0, 97], ["A", 4.0, 93], ["A-", 3.7, 90], ["B+", 3.3, 87], ["B", 3.0, 83], ["B-", 2.7, 80],
  ["C+", 2.3, 77], ["C", 2.0, 73], ["C-", 1.7, 70], ["D+", 1.3, 67], ["D", 1.0, 63], ["D-", 0.7, 60], ["F", 0, 0],
];
export type ClassLevel = "regular" | "honors" | "ap";
export const LEVEL_BONUS: Record<ClassLevel, number> = { regular: 0, honors: 0.5, ap: 1 };
/** "B+", "b+", "88" or "88%" → the letter it counts as, or null if it isn't a grade. */
export function toLetter(grade: string): string | null {
  const g = grade.trim().toUpperCase().replace(/%$/, "");
  if (!g) return null;
  if (/^\d+(\.\d+)?$/.test(g)) { const n = Number(g); if (n > 100) return null; return LETTERS.find(([, , min]) => n >= min)![0]; }
  return LETTERS.some(([l]) => l === g) ? g : null;
}
export function gradePoints(grade: string): number | null { const l = toLetter(grade); return l === null ? null : LETTERS.find(([x]) => x === l)![1]; }
export type GpaClass = { credits: number; grade: string; level: ClassLevel };
export function gpa(classes: GpaClass[]): { unweighted: number; weighted: number; credits: number } {
  let c = 0, u = 0, w = 0;
  for (const k of classes) {
    const p = gradePoints(k.grade); const cr = Number(k.credits) || 0;
    if (p === null || cr <= 0) continue;
    c += cr; u += p * cr; w += (p > 0 ? p + LEVEL_BONUS[k.level] : 0) * cr;
  }
  return { unweighted: c ? u / c : 0, weighted: c ? w / c : 0, credits: c };
}

// ─── Final grade ───
/** Score needed on the final (percent) to finish with `target`, given the grade before it. */
export function neededOnFinal(current: number, finalWeightPct: number, target: number): number {
  const w = finalWeightPct / 100;
  if (w <= 0) return NaN;
  return (target - current * (1 - w)) / w;
}
/** Weighted average of category scores; weights needn't add to 100 (only categories with a score count). */
export function weightedGrade(cats: { weight: number; score: number | "" }[]): number | null {
  let w = 0, s = 0;
  for (const c of cats) if (c.score !== "" && Number.isFinite(c.score) && c.weight > 0) { w += c.weight; s += c.weight * Number(c.score); }
  return w ? s / w : null;
}

// ─── Citations ───
export type SourceKind = "book" | "website" | "article" | "video";
export type CiteStyle = "apa" | "mla" | "chicago";
export type Source = {
  kind: SourceKind; authors: string; title: string; container: string; publisher: string; city: string;
  date: string; accessed: string; url: string; volume: string; issue: string; pages: string; edition: string;
};
export const blankSource = (kind: SourceKind = "book"): Source => ({ kind, authors: "", title: "", container: "", publisher: "", city: "", date: "", accessed: "", url: "", volume: "", issue: "", pages: "", edition: "" });
type Name = { first: string; last: string; org: boolean };
/** "Jane A. Smith; John Doe" or "Smith, Jane; NASA" → names. Single words (or {braced}) are organisations. */
export function parseAuthors(s: string): Name[] {
  return s.split(/;|\n|\s+and\s+|\s*&\s*/).map((x) => x.trim()).filter(Boolean).map((x) => {
    if (/^\{.*\}$/.test(x)) return { first: "", last: x.slice(1, -1), org: true };
    if (x.includes(",")) { const [last, first] = x.split(",").map((p) => p.trim()); return { first: first || "", last, org: !first }; }
    const parts = x.split(/\s+/);
    if (parts.length === 1) return { first: "", last: x, org: true };
    return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1], org: false };
  });
}
const initials = (first: string) => first.split(/[\s-]+/).filter(Boolean).map((p) => `${p[0].toUpperCase()}.`).join(" ");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MLA_MON = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
function dateParts(s: string) { const m = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(s.trim()); return m ? { y: m[1], m: m[2] ? Number(m[2]) : 0, d: m[3] ? Number(m[3]) : 0 } : null; }
const end = (s: string, p = ".") => (/[.?!]$/.test(s.trim()) ? s.trim() : `${s.trim()}${p}`);
const cleanUrl = (u: string) => u.trim();
const pageRange = (p: string) => p.trim().replace(/\s*[-–]\s*/, "–");

function apaNames(ns: Name[]) {
  const f = (n: Name) => (n.org ? n.last : `${n.last}, ${initials(n.first)}`);
  if (ns.length === 1) return f(ns[0]);
  if (ns.length === 2) return `${f(ns[0])}, & ${f(ns[1])}`;
  if (ns.length <= 20) return `${ns.slice(0, -1).map(f).join(", ")}, & ${f(ns[ns.length - 1])}`;
  return `${ns.slice(0, 19).map(f).join(", ")}, . . . ${f(ns[ns.length - 1])}`;
}
function mlaNames(ns: Name[]) {
  const inv = (n: Name) => (n.org ? n.last : `${n.last}, ${n.first}`);
  const fw = (n: Name) => (n.org ? n.last : `${n.first} ${n.last}`);
  if (ns.length === 1) return inv(ns[0]);
  if (ns.length === 2) return `${inv(ns[0])}, and ${fw(ns[1])}`;
  return `${inv(ns[0])}, et al.`;
}
function chicagoNames(ns: Name[]) {
  const inv = (n: Name) => (n.org ? n.last : `${n.last}, ${n.first}`);
  const fw = (n: Name) => (n.org ? n.last : `${n.first} ${n.last}`);
  if (ns.length === 1) return inv(ns[0]);
  if (ns.length === 2) return `${inv(ns[0])}, and ${fw(ns[1])}`;
  if (ns.length <= 10) return `${inv(ns[0])}, ${ns.slice(1, -1).map(fw).join(", ")}, and ${fw(ns[ns.length - 1])}`;
  return `${inv(ns[0])}, ${ns.slice(1, 7).map(fw).join(", ")}, et al.`;
}
/**
 * One reference in the chosen style. Italics are marked with *asterisks*; use citeHtml or
 * citePlain to show it.
 */
export function cite(src: Source, style: CiteStyle): string {
  const ns = parseAuthors(src.authors); const dt = dateParts(src.date); const ac = dateParts(src.accessed);
  const t = src.title.trim(); const c = src.container.trim(); const pub = src.publisher.trim(); const url = cleanUrl(src.url);
  const ed = src.edition.trim() ? `${src.edition.trim().replace(/(st|nd|rd|th)?\s*(ed\.?|edition)?$/i, "")}` : "";
  const ord = (n: string) => { const x = Number(n); if (!x) return n; const s = x % 100 >= 11 && x % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][x % 10] || "th"; return `${x}${s}`; };
  const out: string[] = [];
  if (style === "apa") {
    const yr = dt ? (src.kind === "book" || src.kind === "article" || !dt.m ? dt.y : `${dt.y}, ${MONTHS[dt.m - 1]}${dt.d ? ` ${dt.d}` : ""}`) : "n.d.";
    const who = ns.length ? end(apaNames(ns)) : "";
    const titleIt = `*${t}*`;
    if (src.kind === "book") {
      out.push(who ? `${who} (${yr}).` : `${titleIt}${ed ? ` (${ord(ed)} ed.)` : ""}. (${yr}).`);
      if (who) out.push(`${titleIt}${ed ? ` (${ord(ed)} ed.)` : ""}.`);
      if (pub) out.push(end(pub));
      if (url) out.push(url);
    } else if (src.kind === "website") {
      out.push(who ? `${who} (${yr}).` : `${titleIt}. (${yr}).`);
      if (who) out.push(`${titleIt}.`);
      if (c && (!ns.length || c !== ns[0].last)) out.push(end(c));
      if (url) out.push(url);
    } else if (src.kind === "article") {
      out.push(who ? `${who} (${yr}).` : `${end(t)} (${yr}).`);
      if (who) out.push(end(t));
      let j = c ? `*${c}*` : "";
      if (src.volume.trim()) j += `, *${src.volume.trim()}*`;
      if (src.issue.trim()) j += `(${src.issue.trim()})`;
      if (src.pages.trim()) j += `, ${pageRange(src.pages)}`;
      if (j) out.push(`${j}.`);
      if (url) out.push(url);
    } else {
      const ch = c || (ns.length ? "" : "");
      out.push(who ? `${who} (${yr}).` : `${ch ? end(ch) : ""} (${yr}).`.trim());
      out.push(`${titleIt} [Video].`);
      if (pub) out.push(end(pub));
      if (url) out.push(url);
    }
    return out.join(" ").replace(/\s+/g, " ").trim();
  }
  if (style === "mla") {
    const d = dt ? `${dt.d ? `${dt.d} ` : ""}${dt.m ? `${MLA_MON[dt.m - 1]} ` : ""}${dt.y}` : "";
    const acc = ac ? `Accessed ${ac.d ? `${ac.d} ` : ""}${ac.m ? `${MLA_MON[ac.m - 1]} ` : ""}${ac.y}.` : "";
    const who = ns.length ? end(mlaNames(ns)) : "";
    const bare = url.replace(/^https?:\/\//, "");
    if (src.kind === "book") {
      out.push(who, `*${end(t).replace(/\.$/, "")}*.`);
      const tail = [ed ? `${ord(ed)} ed.` : "", pub, d].filter(Boolean);
      if (tail.length) out.push(`${tail.join(", ")}.`);
    } else if (src.kind === "website") {
      out.push(who, `“${end(t)}”`);
      const tail = [c ? `*${c}*` : "", pub && pub !== c ? pub : "", d, bare].filter(Boolean);
      if (tail.length) out.push(`${tail.join(", ")}.`);
      if (acc) out.push(acc);
    } else if (src.kind === "article") {
      out.push(who, `“${end(t)}”`);
      const tail = [c ? `*${c}*` : "", src.volume.trim() ? `vol. ${src.volume.trim()}` : "", src.issue.trim() ? `no. ${src.issue.trim()}` : "", d, src.pages.trim() ? `${/[-–]/.test(src.pages) ? "pp." : "p."} ${pageRange(src.pages)}` : "", bare].filter(Boolean);
      if (tail.length) out.push(`${tail.join(", ")}.`);
    } else {
      out.push(who, `“${end(t)}”`);
      const tail = [`*${pub || "YouTube"}*`, c ? `uploaded by ${c}` : "", d, bare].filter(Boolean);
      out.push(`${tail.join(", ")}.`);
    }
    return out.filter(Boolean).join(" ").replace(/\s+/g, " ").replace(/”\s*\./g, "”").trim();
  }
  // Chicago (17th, bibliography)
  const d = dt ? `${dt.m ? `${MONTHS[dt.m - 1]} ` : ""}${dt.d ? `${dt.d}, ` : ""}${dt.y}` : "n.d.";
  const who = ns.length ? end(chicagoNames(ns)) : "";
  if (src.kind === "book") {
    out.push(who, `*${end(t).replace(/\.$/, "")}*.`);
    if (ed) out.push(`${ord(ed)} ed.`);
    const place = [src.city.trim(), pub].filter(Boolean).join(": ");
    out.push(`${[place, dt ? dt.y : "n.d."].filter(Boolean).join(", ")}.`);
    if (url) out.push(`${url}.`);
  } else if (src.kind === "website") {
    out.push(who, `“${end(t)}”`);
    if (c) out.push(end(c));
    if (pub && pub !== c) out.push(end(pub));
    out.push(`${dt ? d : ac ? `Accessed ${MONTHS[(ac.m || 1) - 1]} ${ac.d ? `${ac.d}, ` : ""}${ac.y}` : "n.d."}.`);
    if (url) out.push(`${url}.`);
  } else if (src.kind === "article") {
    out.push(who, `“${end(t)}”`);
    let j = c ? `*${c}*` : "";
    if (src.volume.trim()) j += ` ${src.volume.trim()}`;
    if (src.issue.trim()) j += `, no. ${src.issue.trim()}`;
    j += ` (${dt ? (dt.m ? `${MONTHS[dt.m - 1]} ${dt.y}` : dt.y) : "n.d."})`;
    if (src.pages.trim()) j += `: ${pageRange(src.pages)}`;
    out.push(`${j.trim()}.`);
    if (url) out.push(`${url}.`);
  } else {
    out.push(who || (c ? end(c) : ""), `“${end(t)}”`, `${pub || "YouTube"} video.`, `${d}.`);
    if (url) out.push(`${url}.`);
  }
  return out.filter(Boolean).join(" ").replace(/\s+/g, " ").replace(/”\s*\./g, "”").trim();
}
/** Text used to alphabetise a bibliography. */
export const sortKey = (src: Source) => (parseAuthors(src.authors)[0]?.last || src.title.replace(/^(the|a|an)\s+/i, "")).toLowerCase();
export const citePlain = (s: string) => s.replace(/\*/g, "");
export const citeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\*([^*]+)\*/g, "<i>$1</i>");

// ─── Word search ───
export type WsLevel = "easy" | "medium" | "hard";
const WS_DIRS: Record<WsLevel, [number, number][]> = {
  easy: [[0, 1], [1, 0]],
  medium: [[0, 1], [1, 0], [1, 1], [-1, 1]],
  hard: [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]],
};
export const wsClean = (w: string) => w.toUpperCase().replace(/[^A-Z]/g, "");
export type WordSearch = { size: number; grid: string[][]; placed: { word: string; r: number; c: number; dr: number; dc: number }[]; missed: string[] };
export function makeWordSearch(words: string[], size: number, level: WsLevel, seed: number): WordSearch {
  const rand = rng(seed); const ri = (n: number) => Math.floor(rand() * n);
  const list = [...new Set(words.map(wsClean).filter((w) => w.length >= 2 && w.length <= size))].sort((a, b) => b.length - a.length);
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(""));
  const placed: WordSearch["placed"] = []; const missed: string[] = [];
  for (const w of list) {
    let ok = false;
    for (let t = 0; t < 400 && !ok; t++) {
      const [dr, dc] = WS_DIRS[level][ri(WS_DIRS[level].length)];
      const r = ri(size), c = ri(size); const er = r + dr * (w.length - 1), ec = c + dc * (w.length - 1);
      if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
      let fits = true;
      for (let i = 0; i < w.length; i++) { const g = grid[r + dr * i][c + dc * i]; if (g && g !== w[i]) { fits = false; break; } }
      if (!fits) continue;
      for (let i = 0; i < w.length; i++) grid[r + dr * i][c + dc * i] = w[i];
      placed.push({ word: w, r, c, dr, dc }); ok = true;
    }
    if (!ok) missed.push(w);
  }
  const fill = "ABCDEFGHIJKLMNOPRSTUWY"; // fewer rare letters, so fillers look natural
  for (const row of grid) for (let c = 0; c < size; c++) if (!row[c]) row[c] = fill[ri(fill.length)];
  return { size, grid, placed, missed };
}

// ─── Crossword ───
export type CwEntry = { word: string; clue: string };
export type CwPlaced = { word: string; clue: string; r: number; c: number; across: boolean; num: number };
export type Crossword = { rows: number; cols: number; cells: (string | null)[][]; numbers: (number | null)[][]; words: CwPlaced[]; missed: string[] };
function layoutOnce(entries: CwEntry[], rand: () => number) {
  const grid = new Map<string, { ch: string; a: boolean; d: boolean }>();
  const k = (r: number, c: number) => `${r},${c}`;
  const placed: Omit<CwPlaced, "num">[] = []; const missed: string[] = [];
  const canPlace = (w: string, r: number, c: number, across: boolean) => {
    const dr = across ? 0 : 1, dc = across ? 1 : 0;
    if (grid.has(k(r - dr, c - dc)) || grid.has(k(r + dr * w.length, c + dc * w.length))) return -1;
    let hits = 0;
    for (let i = 0; i < w.length; i++) {
      const rr = r + dr * i, cc = c + dc * i; const g = grid.get(k(rr, cc));
      if (g) { if (g.ch !== w[i] || (across ? g.a : g.d)) return -1; hits++; }
      else if (grid.has(k(rr + dc, cc + dr)) || grid.has(k(rr - dc, cc - dr))) return -1; // no side-by-side letters
    }
    return hits;
  };
  const put = (e: CwEntry, r: number, c: number, across: boolean) => {
    for (let i = 0; i < e.word.length; i++) { const kk = k(r + (across ? 0 : i), c + (across ? i : 0)); const g = grid.get(kk) || { ch: e.word[i], a: false, d: false }; if (across) g.a = true; else g.d = true; grid.set(kk, g); }
    placed.push({ word: e.word, clue: e.clue, r, c, across });
  };
  const queue = [...entries];
  put(queue.shift()!, 0, 0, true);
  let progress = true;
  while (queue.length && progress) {
    progress = false;
    for (let qi = 0; qi < queue.length; qi++) {
      const e = queue[qi]; let best: { r: number; c: number; across: boolean; score: number } | null = null;
      for (const [kk, g] of grid) {
        const [gr, gc] = kk.split(",").map(Number);
        for (let i = 0; i < e.word.length; i++) {
          if (e.word[i] !== g.ch) continue;
          for (const across of [true, false]) {
            const r = across ? gr : gr - i, c = across ? gc - i : gc;
            const hits = canPlace(e.word, r, c, across);
            if (hits > 0) { const score = hits * 10 + rand(); if (!best || score > best.score) best = { r, c, across, score }; }
          }
        }
      }
      if (best) { put(e, best.r, best.c, best.across); queue.splice(qi, 1); qi--; progress = true; }
    }
  }
  missed.push(...queue.map((e) => e.word));
  return { placed, missed };
}
/** Fits words into an interlocking grid. Tries many orders and keeps the fullest, most compact one. */
export function makeCrossword(entries: CwEntry[], seed: number, tries = 40): Crossword {
  const list = entries.map((e) => ({ word: wsClean(e.word), clue: e.clue.trim() })).filter((e) => e.word.length >= 2);
  const seen = new Set<string>(); const uniq = list.filter((e) => (seen.has(e.word) ? false : (seen.add(e.word), true)));
  if (!uniq.length) return { rows: 0, cols: 0, cells: [], numbers: [], words: [], missed: [] };
  const rand = rng(seed); let best: ReturnType<typeof layoutOnce> | null = null; let bestScore = -Infinity;
  for (let t = 0; t < tries; t++) {
    const order = t === 0 ? [...uniq].sort((a, b) => b.word.length - a.word.length) : [...uniq].sort(() => rand() - 0.5).sort((a, b) => (rand() < 0.5 ? b.word.length - a.word.length : 0));
    const res = layoutOnce(order, rand);
    const rs = res.placed.flatMap((p) => [p.r, p.r + (p.across ? 0 : p.word.length - 1)]); const cs = res.placed.flatMap((p) => [p.c, p.c + (p.across ? p.word.length - 1 : 0)]);
    const area = (Math.max(...rs) - Math.min(...rs) + 1) * (Math.max(...cs) - Math.min(...cs) + 1);
    const h = Math.max(...rs) - Math.min(...rs) + 1, w = Math.max(...cs) - Math.min(...cs) + 1;
    const score = res.placed.length * 1000 - area - Math.abs(h - w) * 2;
    if (score > bestScore) { bestScore = score; best = res; }
  }
  const { placed, missed } = best!;
  const minR = Math.min(...placed.map((p) => p.r)), minC = Math.min(...placed.map((p) => p.c));
  const norm = placed.map((p) => ({ ...p, r: p.r - minR, c: p.c - minC }));
  const rows = Math.max(...norm.map((p) => p.r + (p.across ? 1 : p.word.length))), cols = Math.max(...norm.map((p) => p.c + (p.across ? p.word.length : 1)));
  const cells: (string | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (const p of norm) for (let i = 0; i < p.word.length; i++) cells[p.r + (p.across ? 0 : i)][p.c + (p.across ? i : 0)] = p.word[i];
  const numbers: (number | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
  const starts = [...new Set(norm.map((p) => p.r * 1000 + p.c))].sort((a, b) => a - b);
  starts.forEach((s, i) => { numbers[Math.floor(s / 1000)][s % 1000] = i + 1; });
  const words = norm.map((p) => ({ ...p, num: numbers[p.r][p.c]! })).sort((a, b) => a.num - b.num);
  return { rows, cols, cells, numbers, words, missed };
}

// ─── Fractions ───
export type Frac = { n: number; d: number };
export const gcd = (a: number, b: number): number => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
export const lcm = (a: number, b: number) => Math.abs(a * b) / gcd(a, b);
export function simplify(f: Frac): Frac { if (!f.d) return f; const g = gcd(f.n, f.d); const s = f.d < 0 ? -1 : 1; return { n: (s * f.n) / g, d: (s * f.d) / g }; }
export const fracStr = (f: Frac) => (f.d === 1 ? `${f.n}` : `${f.n}/${f.d}`);
export function mixed(f: Frac): string { const s = simplify(f); if (Math.abs(s.n) < s.d || s.d === 1) return fracStr(s); const w = Math.trunc(s.n / s.d); const r = Math.abs(s.n % s.d); return r ? `${w} ${r}/${s.d}` : `${w}`; }
export type FracOp = "+" | "−" | "×" | "÷";
/** Does the sum and explains each step the way a teacher would write it. */
export function fracOp(a: Frac, b: Frac, op: FracOp): { result: Frac; steps: string[] } | null {
  if (!a.d || !b.d) return null;
  const steps: string[] = [];
  if (op === "+" || op === "−") {
    const L = lcm(a.d, b.d); const an = a.n * (L / a.d), bn = b.n * (L / b.d);
    if (a.d !== b.d) steps.push(`Find a common denominator: the least common multiple of ${a.d} and ${b.d} is ${L}.`, `Rewrite: ${fracStr(a)} = ${an}/${L} and ${fracStr(b)} = ${bn}/${L}.`);
    else steps.push(`The denominators already match (${L}).`);
    const n = op === "+" ? an + bn : an - bn;
    steps.push(`${op === "+" ? "Add" : "Subtract"} the numerators: ${an} ${op === "+" ? "+" : "−"} ${bn} = ${n}, so the answer is ${n}/${L}.`);
    return finish({ n, d: L }, steps);
  }
  if (op === "×") { const n = a.n * b.n, d = a.d * b.d; steps.push(`Multiply the tops: ${a.n} × ${b.n} = ${n}.`, `Multiply the bottoms: ${a.d} × ${b.d} = ${d}.`, `That gives ${n}/${d}.`); return finish({ n, d }, steps); }
  if (!b.n) return null;
  steps.push(`Dividing by a fraction is multiplying by its flip: ${fracStr(b)} flips to ${b.d}/${b.n}.`);
  const n = a.n * b.d, d = a.d * b.n; steps.push(`${fracStr(a)} × ${b.d}/${b.n} = ${n}/${d}.`);
  return finish({ n, d }, steps);
}
function finish(f: Frac, steps: string[]) {
  const s = simplify(f);
  if (s.n !== f.n || s.d !== f.d) steps.push(`Simplify by dividing top and bottom by ${gcd(f.n, f.d)}: ${fracStr(s)}.`);
  if (Math.abs(s.n) > s.d && s.d !== 1) steps.push(`As a mixed number: ${mixed(s)}.`);
  return { result: s, steps };
}
export const fracCompare = (a: Frac, b: Frac) => Math.sign(a.n * b.d * Math.sign(a.d * b.d) - b.n * a.d * Math.sign(a.d * b.d));
export const equivalents = (f: Frac, count = 5): Frac[] => { const s = simplify(f); return Array.from({ length: count }, (_, i) => ({ n: s.n * (i + 1), d: s.d * (i + 1) })); };

// ─── Typing ───
/** Words per minute counts five typed characters as a word and only counts correct ones. */
export function typingScore(target: string, typed: string, seconds: number) {
  let correct = 0; const misses: Record<string, number> = {};
  for (let i = 0; i < typed.length; i++) { if (typed[i] === target[i]) correct++; else if (target[i] !== undefined) { const ch = target[i] === " " ? "space" : target[i].toLowerCase(); misses[ch] = (misses[ch] || 0) + 1; } }
  const mins = Math.max(seconds, 1) / 60;
  return { wpm: Math.round(correct / 5 / mins), accuracy: typed.length ? Math.round((correct / typed.length) * 100) : 100, correct, misses };
}

// ─── Study planner ───
/**
 * Spreads `sessions` study sessions over the days from `from` up to the day before `due`,
 * evenly and leaning towards the end (the last session is always the day before).
 */
export function spreadSessions(from: string, due: string, sessions: number): string[] {
  const days = Math.round((parse(due).getTime() - parse(from).getTime()) / dayMs);
  if (days <= 0) return [];
  const n = Math.max(1, Math.min(sessions, days));
  const out: string[] = [];
  for (let i = 0; i < n; i++) { const off = Math.round(days - 1 - ((n - 1 - i) * (days - 1)) / Math.max(1, n - 1)); out.push(plus(from, n === 1 ? days - 1 : off)); }
  return [...new Set(out)];
}

// ─── Periodic table ───
export type ElementCat = "alkali" | "alkaline" | "transition" | "post" | "metalloid" | "nonmetal" | "halogen" | "noble" | "lanthanide" | "actinide" | "unknown";
export const CAT_INFO: Record<ElementCat, { label: string; color: string; about: string }> = {
  alkali: { label: "Alkali metal", color: "#fca5a5", about: "Soft, very reactive metals that react with water. They have one outer electron." },
  alkaline: { label: "Alkaline earth metal", color: "#fdba74", about: "Shiny, reactive metals with two outer electrons; found in rocks, bones and shells." },
  transition: { label: "Transition metal", color: "#fde68a", about: "Hard, shiny metals that conduct electricity well and often form coloured compounds." },
  post: { label: "Post-transition metal", color: "#bef264", about: "Softer metals with lower melting points than the transition metals." },
  metalloid: { label: "Metalloid", color: "#86efac", about: "In between metals and non-metals; many are semiconductors used in electronics." },
  nonmetal: { label: "Non-metal", color: "#7dd3fc", about: "Poor conductors that are often gases; the building blocks of living things." },
  halogen: { label: "Halogen", color: "#a5b4fc", about: "Very reactive non-metals that form salts with metals. They have seven outer electrons." },
  noble: { label: "Noble gas", color: "#c4b5fd", about: "Colourless gases with full outer shells, so they almost never react." },
  lanthanide: { label: "Lanthanide", color: "#f9a8d4", about: "Rare-earth metals used in magnets, screens, lasers and batteries." },
  actinide: { label: "Actinide", color: "#f0abfc", about: "Radioactive heavy metals; most are made in nuclear reactors or labs." },
  unknown: { label: "Unknown properties", color: "#e2e8f0", about: "Super-heavy elements made a few atoms at a time; their chemistry is mostly predicted." },
};
const RAW = "H,Hydrogen,1.008,nonmetal|He,Helium,4.0026,noble|Li,Lithium,6.94,alkali|Be,Beryllium,9.0122,alkaline|B,Boron,10.81,metalloid|C,Carbon,12.011,nonmetal|N,Nitrogen,14.007,nonmetal|O,Oxygen,15.999,nonmetal|F,Fluorine,18.998,halogen|Ne,Neon,20.180,noble|Na,Sodium,22.990,alkali|Mg,Magnesium,24.305,alkaline|Al,Aluminum,26.982,post|Si,Silicon,28.085,metalloid|P,Phosphorus,30.974,nonmetal|S,Sulfur,32.06,nonmetal|Cl,Chlorine,35.45,halogen|Ar,Argon,39.95,noble|K,Potassium,39.098,alkali|Ca,Calcium,40.078,alkaline|Sc,Scandium,44.956,transition|Ti,Titanium,47.867,transition|V,Vanadium,50.942,transition|Cr,Chromium,51.996,transition|Mn,Manganese,54.938,transition|Fe,Iron,55.845,transition|Co,Cobalt,58.933,transition|Ni,Nickel,58.693,transition|Cu,Copper,63.546,transition|Zn,Zinc,65.38,transition|Ga,Gallium,69.723,post|Ge,Germanium,72.630,metalloid|As,Arsenic,74.922,metalloid|Se,Selenium,78.971,nonmetal|Br,Bromine,79.904,halogen|Kr,Krypton,83.798,noble|Rb,Rubidium,85.468,alkali|Sr,Strontium,87.62,alkaline|Y,Yttrium,88.906,transition|Zr,Zirconium,91.224,transition|Nb,Niobium,92.906,transition|Mo,Molybdenum,95.95,transition|Tc,Technetium,[98],transition|Ru,Ruthenium,101.07,transition|Rh,Rhodium,102.91,transition|Pd,Palladium,106.42,transition|Ag,Silver,107.87,transition|Cd,Cadmium,112.41,transition|In,Indium,114.82,post|Sn,Tin,118.71,post|Sb,Antimony,121.76,metalloid|Te,Tellurium,127.60,metalloid|I,Iodine,126.90,halogen|Xe,Xenon,131.29,noble|Cs,Cesium,132.91,alkali|Ba,Barium,137.33,alkaline|La,Lanthanum,138.91,lanthanide|Ce,Cerium,140.12,lanthanide|Pr,Praseodymium,140.91,lanthanide|Nd,Neodymium,144.24,lanthanide|Pm,Promethium,[145],lanthanide|Sm,Samarium,150.36,lanthanide|Eu,Europium,151.96,lanthanide|Gd,Gadolinium,157.25,lanthanide|Tb,Terbium,158.93,lanthanide|Dy,Dysprosium,162.50,lanthanide|Ho,Holmium,164.93,lanthanide|Er,Erbium,167.26,lanthanide|Tm,Thulium,168.93,lanthanide|Yb,Ytterbium,173.05,lanthanide|Lu,Lutetium,174.97,lanthanide|Hf,Hafnium,178.49,transition|Ta,Tantalum,180.95,transition|W,Tungsten,183.84,transition|Re,Rhenium,186.21,transition|Os,Osmium,190.23,transition|Ir,Iridium,192.22,transition|Pt,Platinum,195.08,transition|Au,Gold,196.97,transition|Hg,Mercury,200.59,transition|Tl,Thallium,204.38,post|Pb,Lead,207.2,post|Bi,Bismuth,208.98,post|Po,Polonium,[209],post|At,Astatine,[210],halogen|Rn,Radon,[222],noble|Fr,Francium,[223],alkali|Ra,Radium,[226],alkaline|Ac,Actinium,[227],actinide|Th,Thorium,232.04,actinide|Pa,Protactinium,231.04,actinide|U,Uranium,238.03,actinide|Np,Neptunium,[237],actinide|Pu,Plutonium,[244],actinide|Am,Americium,[243],actinide|Cm,Curium,[247],actinide|Bk,Berkelium,[247],actinide|Cf,Californium,[251],actinide|Es,Einsteinium,[252],actinide|Fm,Fermium,[257],actinide|Md,Mendelevium,[258],actinide|No,Nobelium,[259],actinide|Lr,Lawrencium,[266],actinide|Rf,Rutherfordium,[267],transition|Db,Dubnium,[268],transition|Sg,Seaborgium,[269],transition|Bh,Bohrium,[270],transition|Hs,Hassium,[269],transition|Mt,Meitnerium,[278],unknown|Ds,Darmstadtium,[281],unknown|Rg,Roentgenium,[282],unknown|Cn,Copernicium,[285],unknown|Nh,Nihonium,[286],unknown|Fl,Flerovium,[289],unknown|Mc,Moscovium,[290],unknown|Lv,Livermorium,[293],unknown|Ts,Tennessine,[294],unknown|Og,Oganesson,[294],unknown";
const FACTS: Record<string, string> = {
  H: "The lightest and most common element in the universe; the Sun fuses it into helium.", He: "Lighter than air, used in balloons and to cool MRI magnets.", Li: "Powers rechargeable batteries in phones and electric cars.",
  C: "The basis of all known life; diamond and graphite are both pure carbon.", N: "About 78% of the air we breathe.", O: "About 21% of air; needed for breathing and burning.",
  F: "Added to toothpaste (as fluoride) to protect teeth.", Ne: "Glows red-orange in neon signs.", Na: "Half of table salt (sodium chloride).",
  Mg: "Burns with a brilliant white light; at the centre of chlorophyll.", Al: "The most common metal in Earth's crust; used in cans and foil.", Si: "Computer chips and solar cells are made from it; sand is silicon dioxide.",
  P: "Found in DNA, bones and match heads.", S: "Smells like rotten eggs in some compounds; used to make rubber tougher.", Cl: "Keeps swimming pools and drinking water clean.",
  Ar: "Fills light bulbs and protects metals while welding.", K: "Bananas are a good source; needed for nerves and muscles.", Ca: "Builds strong bones and teeth.",
  Ti: "Strong and light — used in planes, bikes and hip replacements.", Cr: "Gives stainless steel its shine and rust resistance.", Fe: "The main ingredient in steel; carries oxygen in your blood.",
  Co: "Gives glass and pottery a deep blue colour.", Ni: "Used in coins and stainless steel.", Cu: "Carries electricity in almost every wire; the Statue of Liberty is copper.",
  Zn: "Coats steel to stop rust (galvanizing); needed for a healthy immune system.", Ga: "Melts in your hand (about 30 °C).", Br: "One of only two elements that are liquid at room temperature.",
  Kr: "Superman's 'kryptonite' borrowed its name; used in some flash lamps.", Ag: "The best conductor of electricity of all metals.", Sn: "Coats steel 'tin' cans.",
  I: "Your thyroid needs it; added to salt and used as an antiseptic.", Xe: "Used in bright car headlights and ion engines for spacecraft.", W: "Has the highest melting point of any metal (3422 °C).",
  Pt: "Used in catalytic converters to clean car exhaust.", Au: "Doesn't rust or tarnish; used in jewellery and electronics.", Hg: "The only metal that is liquid at room temperature.",
  Pb: "Very dense; once used in paint and petrol until it was found to be toxic.", U: "Fuel for nuclear power stations.", Pu: "Powers spacecraft such as the Voyager probes and Mars rovers.",
  Nd: "Makes the strongest permanent magnets, used in headphones and motors.", Eu: "Makes the red and blue colours on some screens and euro banknotes glow.", Rn: "A radioactive gas that can build up in basements.",
  Es: "Named after Albert Einstein; first found in the debris of a hydrogen bomb test.", Og: "The heaviest element ever made; only a handful of atoms have existed.", Sr: "Makes fireworks red.",
  Ba: "Drunk as a 'barium meal' to show the gut on X-rays.", Be: "Light and stiff; used in the James Webb Space Telescope's mirrors.", B: "Used in heat-proof glass for ovenware.",
  As: "Famous as a poison, but also used in semiconductors.", Se: "Used in photocopiers and solar cells.", Cs: "Atomic clocks use it to keep time to a billionth of a second.",
  Am: "A tiny amount is in most smoke detectors.", Tc: "The first element made artificially; used in medical scans.", Mn: "Makes steel tougher; in alkaline batteries.",
};
export type Element = { z: number; sym: string; name: string; mass: string; cat: ElementCat; period: number; group: number; row: number; col: number; phase: "solid" | "liquid" | "gas" | "unknown"; config: string; fact: string };
const GASES = new Set(["H", "He", "N", "O", "F", "Ne", "Cl", "Ar", "Kr", "Xe", "Rn"]);
const ORDER = ["1s", "2s", "2p", "3s", "3p", "4s", "3d", "4p", "5s", "4d", "5p", "6s", "4f", "5d", "6p", "7s", "5f", "6d", "7p"];
const CAP: Record<string, number> = { s: 2, p: 6, d: 10, f: 14 };
const CONFIG_EXCEPTIONS: Record<number, string> = {
  24: "[Ar] 3d⁵ 4s¹", 29: "[Ar] 3d¹⁰ 4s¹", 41: "[Kr] 4d⁴ 5s¹", 42: "[Kr] 4d⁵ 5s¹", 44: "[Kr] 4d⁷ 5s¹", 45: "[Kr] 4d⁸ 5s¹", 46: "[Kr] 4d¹⁰", 47: "[Kr] 4d¹⁰ 5s¹",
  57: "[Xe] 5d¹ 6s²", 58: "[Xe] 4f¹ 5d¹ 6s²", 64: "[Xe] 4f⁷ 5d¹ 6s²", 78: "[Xe] 4f¹⁴ 5d⁹ 6s¹", 79: "[Xe] 4f¹⁴ 5d¹⁰ 6s¹",
  89: "[Rn] 6d¹ 7s²", 90: "[Rn] 6d² 7s²", 91: "[Rn] 5f² 6d¹ 7s²", 92: "[Rn] 5f³ 6d¹ 7s²", 93: "[Rn] 5f⁴ 6d¹ 7s²", 96: "[Rn] 5f⁷ 6d¹ 7s²", 103: "[Rn] 5f¹⁴ 7s² 7p¹",
};
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n: number) => String(n).split("").map((d) => SUP[Number(d)]).join("");
export function electronConfig(z: number): string {
  if (CONFIG_EXCEPTIONS[z]) return CONFIG_EXCEPTIONS[z];
  const cores: [number, string][] = [[86, "Rn"], [54, "Xe"], [36, "Kr"], [18, "Ar"], [10, "Ne"], [2, "He"]];
  const core = cores.find(([cz]) => cz < z);
  let left = z; const parts: string[] = []; let skip = core ? core[0] : 0;
  for (const o of ORDER) {
    if (left <= 0) break;
    const n = Math.min(CAP[o[1]], left); left -= n;
    if (skip > 0) { skip -= n; continue; }
    parts.push(`${o}${sup(n)}`);
  }
  return `${core ? `[${core[1]}] ` : ""}${parts.join(" ")}`;
}
function place(z: number): { period: number; group: number; row: number; col: number } {
  const period = z <= 2 ? 1 : z <= 10 ? 2 : z <= 18 ? 3 : z <= 36 ? 4 : z <= 54 ? 5 : z <= 86 ? 6 : 7;
  if (z === 1) return { period, group: 1, row: 1, col: 1 };
  if (z === 2) return { period, group: 18, row: 1, col: 18 };
  if (period <= 3) { const i = z - (period === 2 ? 3 : 11); const group = i < 2 ? i + 1 : i + 11; return { period, group, row: period, col: group }; }
  if (period <= 5) { const group = z - (period === 4 ? 18 : 36); return { period, group, row: period, col: group }; }
  const start = period === 6 ? 55 : 87;
  const i = z - start;
  if (i < 2) return { period, group: i + 1, row: period, col: i + 1 };
  if (i <= 16) return { period, group: 3, row: period === 6 ? 9 : 10, col: i + 1 }; // f-block row below the table
  const group = i - 13; return { period, group, row: period, col: group };
}
export const ELEMENTS: Element[] = RAW.split("|").map((s, i) => {
  const [sym, name, mass, cat] = s.split(","); const z = i + 1;
  const phase = z > 103 ? "unknown" : GASES.has(sym) ? "gas" : sym === "Br" || sym === "Hg" ? "liquid" : "solid";
  return { z, sym, name, mass, cat: cat as ElementCat, ...place(z), phase, config: electronConfig(z) + (z > 103 ? " (predicted)" : ""), fact: FACTS[sym] || CAT_INFO[cat as ElementCat].about };
});

// ─── Math facts ───
export type MathOp = "+" | "−" | "×" | "÷";
export type Fact = { a: number; b: number; op: MathOp; answer: number; key: string };
/** Every fact for the chosen operations with numbers 0..max (1..max for ÷), answers whole. */
export function allFacts(ops: MathOp[], max: number): Fact[] {
  const out: Fact[] = [];
  for (const op of ops) for (let a = op === "÷" ? 1 : 0; a <= max; a++) for (let b = op === "÷" ? 1 : 0; b <= max; b++) {
    if (op === "+") out.push({ a, b, op, answer: a + b, key: `${a}+${b}` });
    else if (op === "−") out.push({ a: a + b, b, op, answer: a, key: `${a + b}-${b}` });
    else if (op === "×") out.push({ a, b, op, answer: a * b, key: `${a}x${b}` });
    else out.push({ a: a * b, b, op, answer: a, key: `${a * b}/${b}` });
  }
  return out;
}
/** Picks the next fact, favouring ones that were missed or are slow (weight 1 + 3×misses). */
export function pickFact(facts: Fact[], misses: Record<string, number>, rand: () => number, last?: string): Fact {
  const pool = facts.length > 1 ? facts.filter((f) => f.key !== last) : facts;
  const weights = pool.map((f) => 1 + 3 * Math.min(5, misses[f.key] || 0));
  let r = rand() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}
