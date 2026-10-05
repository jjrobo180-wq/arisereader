// The US school list, searchable. About 122,000 public and private K-12 schools
// from the National Center for Education Statistics (see server/data/README.md).
//
// The list is one block of text, one school per line:
//   id <tab> name <tab> city <tab> state <tab> lowest grade <tab> highest grade
//
// Searching works on a second block of text built from it the first time
// someone searches: one line per school, holding just the folded name and town.
// Two blocks of text and a few number arrays keep the whole country in about
// 15 MB of memory, and a search is a handful of scans through the second block.
import { US_STATES, foldSchoolText, gradeSpan, isUsState, mayBeInitials, schoolInitials } from "../shared/schoolNames";
// Bundled into the server when it is built, so the list is always there in production.
import usSchools from "./data/usSchools.json";

export type DirectorySchool = {
  /** The school's NCES id. Stable from one year's list to the next. */
  key: string;
  name: string;
  city: string;
  state: string;
  /** "Pre-K to 5", or "" when the list doesn't say. */
  grades: string;
  private: boolean;
};

export type SchoolDirectory = {
  size: number;
  get(key: unknown): DirectorySchool | null;
  /** Finds a school by exact name, town and state, however it was typed. */
  find(name: string, city: string, state: string): DirectorySchool | null;
  search(query: unknown, opts?: { state?: unknown; limit?: number }): { schools: DirectorySchool[]; more: boolean };
};

// People type "high school"; lists write "H S" or "HS". Both sides are spelled out before comparing.
const SPELLED: Record<string, string> = {
  hs: "high school", ms: "middle school", es: "elementary school", jhs: "junior high school", shs: "senior high school",
  jh: "junior high", el: "elementary", elem: "elementary", sch: "school", schl: "school", acad: "academy", ctr: "center",
  st: "saint", mt: "mount", ft: "fort", jr: "junior", sr: "senior", pri: "primary", mid: "middle", int: "intermediate",
  interm: "intermediate", alt: "alternative", prep: "preparatory", chrn: "christian", chrstn: "christian", lthrn: "lutheran",
  cmty: "community", cnty: "county", co: "county", lrn: "learning", educ: "education", ed: "education", sci: "science",
  tech: "technology", spec: "special", voc: "vocational", mtn: "mountain", hts: "heights", spgs: "springs",
};
const fold = (text: string) => foldSchoolText(text).replace(/\bh s\b/g, "hs").replace(/\bm s\b/g, "ms").replace(/\bj h\b/g, "jh").replace(/\be s\b/g, "es");

/**
 * The text a school is searched by, built from the list's own spelling: folded,
 * with each short form followed by its full words ("hs" becomes "high school hs"),
 * and names like O'Fallon findable both ways ("ofallon" and "o fallon").
 */
function searchText(text: string): string {
  const words = fold(text).split(" ").map((w) => (SPELLED[w] ? `${SPELLED[w]} ${w}` : w));
  // the list writes "O Fallon" or "O'Fallon"; people type either
  for (const m of text.matchAll(/\b([ODLModlm])['\u2019 ]([A-Za-z]{3,})/g)) {
    words.push(`${m[1]}${m[2]}`.toLowerCase(), m[1].toLowerCase(), m[2].toLowerCase());
  }
  return words.join(" ");
}

/**
 * What a person typed, as a list of words to find. A short form can be matched
 * as typed or by its full words: "ft" finds "Ft Lupton" and "Fort Collins",
 * "tech" finds "Technical" and "Technology".
 */
function typedWords(text: string): Array<{ word: string; ways: string[][]; initialsWay: number }> {
  const words = [...new Set(fold(text).split(" ").filter(Boolean))].slice(0, 8);
  return words.map((word) => {
    const ways = SPELLED[word] ? [[` ${word}`], SPELLED[word].split(" ").map((w) => ` ${w}`)] : [[` ${word}`]];
    // "cgms" can also be a school's initials, kept in the name's line as "#cgms"
    const initialsWay = mayBeInitials(word) ? ways.push([` #${word}`]) - 1 : -1;
    return { word, ways, initialsWay };
  });
}
/** A school's initials as words for its search line: "#dcgms #cgms #gms". */
const initialsText = (name: string) => schoolInitials(name, SPELLED).map((t) => ` #${t}`).join("");

// "east high school denver co": a state at the end of what was typed
const STATE_BY_NAME = new Map<string, string>(US_STATES.map(([code, name]) => [foldSchoolText(name), code]));
function trailingState(text: string): { state: string; rest: string } | null {
  const words = foldSchoolText(text).split(" ").filter(Boolean);
  for (const take of [3, 2, 1]) {
    if (words.length <= take) continue;
    const tail = words.slice(-take).join(" ");
    const state = STATE_BY_NAME.get(tail) ?? (take === 1 && isUsState(tail.toUpperCase()) ? tail.toUpperCase() : "");
    if (state) return { state, rest: words.slice(0, -take).join(" ") };
  }
  return null;
}

type Index = {
  /** Where each school's line starts in the list (one extra entry marks the end). */
  rawStart: Uint32Array;
  /** One line per school: " name town\n", folded. A leading space lets " word" mean "a word that starts here". */
  hay: string;
  hayStart: Uint32Array;
  /** How much of each hay line is the name. */
  nameLen: Uint16Array;
  /** Rows of each state, when the list keeps a state's schools together (it does). */
  ranges: Map<string, [number, number]> | null;
  /** Each school's state, as a position in `stateNames`. */
  stateOf: Uint8Array;
  stateNames: string[];
};

export function createSchoolDirectory(rowsText: string): SchoolDirectory {
  const text = rowsText || "";
  let size = 0;
  if (text) { size = 1; for (let at = text.indexOf("\n"); at !== -1; at = text.indexOf("\n", at + 1)) size++; }
  let index: Index | null = null;

  const build = (): Index => {
    if (index) return index;
    const rawStart = new Uint32Array(size + 1), hayStart = new Uint32Array(size + 1), nameLen = new Uint16Array(size);
    const stateOf = new Uint8Array(size), stateNames: string[] = [];
    const parts: string[] = new Array(size);
    const ranges = new Map<string, [number, number]>();
    let together = true, at = 0, hayAt = 0;
    for (let i = 0; i < size; i++) {
      let end = text.indexOf("\n", at);
      if (end === -1) end = text.length;
      const fields = text.slice(at, end).split("\t");
      const name = searchText(fields[1] || "") + initialsText(fields[1] || "");
      const line = ` ${name} ${searchText(fields[2] || "")}\n`;
      rawStart[i] = at; hayStart[i] = hayAt; nameLen[i] = Math.min(65535, name.length + 1);
      parts[i] = line; hayAt += line.length;
      const state = fields[3] || "";
      let code = stateNames.indexOf(state);
      if (code === -1) code = stateNames.push(state) - 1;
      stateOf[i] = code;
      const range = ranges.get(state);
      if (!range) ranges.set(state, [i, i + 1]);
      else if (range[1] === i) range[1] = i + 1;
      else together = false;
      at = end + 1;
    }
    rawStart[size] = text.length + 1; hayStart[size] = hayAt;
    index = { rawStart, hay: parts.join(""), hayStart, nameLen, ranges: together ? ranges : null, stateOf, stateNames };
    return index;
  };

  const parse = (ix: Index, i: number): DirectorySchool | null => {
    const [key, name, city, state, low = "", high = ""] = text.slice(ix.rawStart[i], ix.rawStart[i + 1] - 1).split("\t");
    if (!key || !name || !state) return null;
    return { key, name, city: city || "", state, grades: gradeSpan(low, high), private: !/^\d{12}$/.test(key) };
  };
  /** The row a position in the hay belongs to. */
  const rowAt = (ix: Index, pos: number): number => {
    let lo = 0, hi = size - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ix.hayStart[mid] <= pos) lo = mid; else hi = mid - 1; }
    return lo;
  };
  const rowsOf = (ix: Index, state: string): [number, number] => (state && ix.ranges ? ix.ranges.get(state) ?? [0, 0] : [0, size]);

  const directory: SchoolDirectory = {
    size,
    get(key) {
      if (typeof key !== "string" || !/^[A-Z0-9]{6,14}$/.test(key) || !size) return null;
      // ids are at the start of a line, so this finds the line without keeping a table of all 122,000
      const at = text.startsWith(`${key}\t`) ? 0 : text.indexOf(`\n${key}\t`) + 1;
      if (at === 0 && !text.startsWith(`${key}\t`)) return null;
      const end = text.indexOf("\n", at);
      const [k, name, city, state, low = "", high = ""] = text.slice(at, end === -1 ? text.length : end).split("\t");
      if (!name || !state) return null;
      return { key: k, name, city: city || "", state, grades: gradeSpan(low, high), private: !/^\d{12}$/.test(k) };
    },
    find(name, city, state) {
      const wantName = foldSchoolText(name), wantCity = foldSchoolText(city);
      if (!wantName || !isUsState(state) || !size) return null;
      const ix = build();
      const [from, to] = rowsOf(ix, state);
      const code = ix.stateNames.indexOf(state);
      for (let i = from; i < to; i++) {
        if (ix.stateOf[i] !== code) continue;
        const school = parse(ix, i);
        if (school && foldSchoolText(school.name) === wantName && (!wantCity || foldSchoolText(school.city) === wantCity)) return school;
      }
      return null;
    },
    search(query, opts = {}) {
      const limit = Math.min(50, Math.max(1, Math.floor(opts.limit ?? 20)));
      const state = isUsState(opts.state) ? opts.state : "";
      const text = String(query ?? "").slice(0, 80);
      // two letters at least, so a single keystroke doesn't list half the country
      if (fold(text).replace(/ /g, "").length < 2 || !size) return { schools: [], more: false };
      const first = run(text, state, limit);
      if (first.schools.length || state) return first;
      // nothing found: perhaps the state was typed after the name
      const tail = trailingState(text);
      return tail && tail.rest.replace(/ /g, "").length >= 2 ? run(tail.rest, tail.state, limit) : first;
    },
  };

  function run(text: string, state: string, limit: number): { schools: DirectorySchool[]; more: boolean } {
    const ix = build();
    const groups = typedWords(text);
    const lead = ` ${fold(text)}`;
    const [fromRow, toRow] = rowsOf(ix, state);
    const stateCode = state ? ix.stateNames.indexOf(state) : -1;
    const found: Array<{ i: number; score: number }> = [];
    const MOST = 20_000; // enough to rank well; a search for "school" needn't sort the whole country

    /** Checks one school's line against every typed word. */
    const consider = (i: number) => {
      if (state && ix.stateOf[i] !== stateCode) return;
      // only this school's own line is looked at: an unbounded search would run on through the rest of the country
      const line = ix.hay.slice(ix.hayStart[i], ix.hayStart[i + 1]);
      const nameEnd = ix.nameLen[i];
      let inName = true, byInitials = false;
      for (const group of groups) {
        let best = -1; // 2: matched a word of the name, 1: matched the name's initials, 0: matched the town
        group.ways.forEach((way, w) => {
          if (best === 2) return;
          let all = true, name = true;
          for (const needle of way) {
            const hit = line.indexOf(needle);
            if (hit === -1) { all = false; break; }
            if (hit >= nameEnd) name = false;
          }
          if (all) best = Math.max(best, !name ? 0 : w === group.initialsWay ? 1 : 2);
        });
        if (best === -1) return;
        if (best === 0) inName = false;
        if (best === 1) byInitials = true;
      }
      // best: the name starts with what was typed. Then: every word is in the name. Then: initials. Last: a word matched the town.
      found.push({ i, score: line.startsWith(lead) ? 0 : !inName ? 3 : byInitials ? 2 : 1 });
    };

    // Jump from school to school using the longest typed word: it is in the fewest schools.
    // Each way of matching that word is followed (the word itself, its full words, its initials),
    // using the longest piece of each way, and a school found more than one way is looked at once.
    const anchor = [...groups].sort((a, b) => b.word.length - a.word.length)[0];
    if (anchor) {
      const stop = ix.hayStart[toRow];
      const rows = new Set<number>();
      for (const way of anchor.ways) {
        const needle = [...way].sort((a, b) => b.length - a.length)[0];
        let pos = ix.hayStart[fromRow];
        while (rows.size < MOST) {
          pos = ix.hay.indexOf(needle, pos);
          if (pos === -1 || pos >= stop) break;
          const i = rowAt(ix, pos);
          pos = ix.hayStart[i + 1]; // on to the next school
          rows.add(i);
        }
      }
      for (const i of rows) { if (found.length >= MOST) break; consider(i); }
    }
    found.sort((a, b) => a.score - b.score || ix.nameLen[a.i] - ix.nameLen[b.i] || a.i - b.i);
    const schools = found.slice(0, limit).map((f) => parse(ix, f.i)).filter((x): x is DirectorySchool => !!x);
    return { schools, more: found.length > limit };
  }

  return directory;
}

let loaded: SchoolDirectory | null = null;
/** The full US list. If the data file is damaged the list is empty and sign-up still works. */
export function usSchoolDirectory(): SchoolDirectory {
  if (loaded) return loaded;
  const rows = (usSchools as { rows?: unknown })?.rows;
  if (typeof rows !== "string" || !rows) console.error("[schools] the US school list is empty: sign-up will only offer schools already on the site");
  loaded = createSchoolDirectory(typeof rows === "string" ? rows : "");
  return loaded;
}
