// Moving to Arise Trainer (November 2026): bring clients and workouts over from Trainerize, TrueCoach or a
// spreadsheet (CSV), and take everything out again whenever you like. Server: server/coach.ts.
import type { OwnExercise, PlanWorkout } from "./coach";
import { CATALOG } from "./fit";

/** CSV with quoted fields, commas or tabs or semicolons, and Windows or Mac line ends. */
export function parseCsv(text: string): string[][] {
  const src = String(text ?? "").replace(/^﻿/, "").slice(0, 2_000_000);
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = [",", "\t", ";"].map((c) => [c, firstLine.split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"' && cell === "") q = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && src[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((c) => c.trim())) rows.push(row.map((c) => c.trim())); row = []; }
    else cell += ch;
  }
  row.push(cell); if (row.some((c) => c.trim())) rows.push(row.map((c) => c.trim()));
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Finds a column by any of its usual names (Trainerize, TrueCoach, Google Sheets, Excel). */
const col = (head: string[], ...names: string[]) => { const h = head.map(norm); for (const n of names) { const i = h.indexOf(n); if (i >= 0) return i; } for (const n of names) { const i = h.findIndex((x) => x.includes(n)); if (i >= 0) return i; } return -1; };

export type ImportedClient = { name: string; email: string; phone: string; tags: string[]; note: string };
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
/** A client list: needs a name column (or first + last) and an email or phone column. */
export function importClients(text: string): { clients: ImportedClient[]; skipped: number; problem?: string } {
  const rows = parseCsv(text); if (rows.length < 2) return { clients: [], skipped: 0, problem: "That file has no rows under the header." };
  const head = rows[0];
  const iFirst = col(head, "first name", "firstname", "first"), iLast = col(head, "last name", "lastname", "last", "surname"), iName = col(head, "name", "full name", "client name", "client");
  const iEmail = col(head, "email", "email address", "e mail"), iPhone = col(head, "phone", "phone number", "mobile", "cell");
  const iTags = col(head, "tags", "tag", "group", "groups", "label"), iNote = col(head, "notes", "note", "goal", "goals");
  if (iEmail < 0 && iPhone < 0) return { clients: [], skipped: rows.length - 1, problem: "Couldn't find an Email or Phone column." };
  if (iFirst < 0 && iName < 0) return { clients: [], skipped: rows.length - 1, problem: "Couldn't find a Name (or First name) column." };
  const seen = new Set<string>(); const out: ImportedClient[] = []; let skipped = 0;
  for (const r of rows.slice(1, 2001)) {
    const name = (iFirst >= 0 ? [r[iFirst], iLast >= 0 ? r[iLast] : ""].filter(Boolean).join(" ") : r[iName] ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    const email = (r[iEmail] ?? "").trim().toLowerCase(); const phone = (r[iPhone] ?? "").replace(/[^\d+()\-.\s]/g, "").trim().slice(0, 30);
    const okEmail = EMAIL.test(email), okPhone = phone.replace(/\D/g, "").length >= 7;
    const key = okEmail ? email : phone.replace(/\D/g, "");
    if (!name || (!okEmail && !okPhone) || seen.has(key)) { skipped++; continue; }
    seen.add(key);
    out.push({ name, email: okEmail ? email : "", phone: okPhone ? phone : "", tags: iTags >= 0 ? (r[iTags] ?? "").split(/[,;|]/).map((t) => t.trim()).filter(Boolean).slice(0, 5) : [], note: iNote >= 0 ? (r[iNote] ?? "").slice(0, 300) : "" });
  }
  return { clients: out, skipped };
}

/** Best catalog match for an exercise name ("DB Bench Press" → dumbbell bench press). */
const ABBR: [RegExp, string][] = [[/\bdb\b/g, "dumbbell"], [/\bbb\b/g, "barbell"], [/\bkb\b/g, "kettlebell"], [/\bohp\b/g, "overhead press"], [/\brdl\b/g, "romanian deadlift"], [/\bsl\b/g, "single leg"], [/\bpulldowns?\b/g, "pulldown"], [/\bpushups?\b/g, "push up"], [/\bpullups?\b/g, "pull up"], [/\bchinups?\b/g, "chin up"], [/\bsquats\b/g, "squat"], [/\brows\b/g, "row"], [/\bcurls\b/g, "curl"], [/\blunges\b/g, "lunge"], [/\bups\b/g, "up"], [/\bbiceps? curl\b/g, "dumbbell curl"]];
const canon = (s: string) => { let x = norm(s); for (const [re, to] of ABBR) x = x.replace(re, to); return x.replace(/\s+/g, " ").trim(); };
const CANON = CATALOG.map((e) => ({ id: e.id, name: e.name, c: canon(e.name), words: new Set(canon(e.name).split(" ")) }));
export function matchExercise(name: string): { id: string; name: string } | null {
  const c = canon(name); if (!c) return null;
  const exact = CANON.find((e) => e.c === c); if (exact) return { id: exact.id, name: exact.name };
  const words = c.split(" "); const have = new Set(words);
  // A catalog name whose every word is in theirs ("Barbell Bench Press" has all of "bench press"): the longest one wins.
  const inside = CANON.filter((e) => [...e.words].every((w) => have.has(w)) && e.words.size / words.length >= 0.5).sort((a, b) => b.words.size - a.words.size);
  if (inside.length) return { id: inside[0].id, name: inside[0].name };
  let best: (typeof CANON)[number] | null = null, bestScore = 0;
  for (const e of CANON) {
    const hit = words.filter((w) => e.words.has(w)).length;
    const score = hit / Math.max(words.length, e.words.size);
    if (score > bestScore) { best = e; bestScore = score; }
  }
  return best && bestScore >= 0.75 ? { id: best.id, name: best.name } : null;
}

/** Workouts from a sheet with one exercise per row: Workout, Exercise, Sets, Reps, Rest (seconds), Notes.
 *  Exercises not in Arise's catalog become the trainer's own exercises. */
export function importWorkouts(text: string, own: OwnExercise[] = [], newId = () => Math.random().toString(36).slice(2, 10)): { workouts: PlanWorkout[]; exercises: OwnExercise[]; matched: number; added: number; problem?: string } {
  const rows = parseCsv(text); if (rows.length < 2) return { workouts: [], exercises: [], matched: 0, added: 0, problem: "That file has no rows under the header." };
  const head = rows[0];
  const iW = col(head, "workout", "workout name", "session", "day", "program day"), iE = col(head, "exercise", "exercise name", "movement");
  const iS = col(head, "sets"), iR = col(head, "reps", "repetitions", "rep range"), iRest = col(head, "rest", "rest seconds", "rest sec"), iN = col(head, "notes", "note", "instructions", "cues");
  if (iW < 0 || iE < 0) return { workouts: [], exercises: [], matched: 0, added: 0, problem: "Needs a Workout column and an Exercise column." };
  const byName = new Map<string, PlanWorkout>(); const exercises: OwnExercise[] = []; let matched = 0, added = 0;
  const ownByName = new Map([...own].map((e) => [canon(e.name), e]));
  for (const r of rows.slice(1, 3001)) {
    const wName = (r[iW] ?? "").slice(0, 80).trim(); const eName = (r[iE] ?? "").slice(0, 80).trim();
    if (!wName || !eName) continue;
    let w = byName.get(wName); if (!w) { if (byName.size >= 300) break; w = { id: newId(), name: wName, items: [] }; byName.set(wName, w); }
    if (w.items.length >= 30) continue;
    const m = matchExercise(eName);
    let exId: string, name: string;
    if (m) { exId = m.id; name = m.name; matched++; }
    else {
      let o = ownByName.get(canon(eName));
      if (!o) { o = { id: `own-${newId()}`, name: eName, muscle: "", video: "", cues: "" }; ownByName.set(canon(eName), o); exercises.push(o); added++; }
      exId = o.id; name = o.name;
    }
    const sets = Math.max(1, Math.min(20, parseInt(r[iS] ?? "", 10) || 3));
    const reps = (r[iR] ?? "").replace(/\s*(reps?|x)\s*$/i, "").slice(0, 16).trim() || "10";
    const restRaw = (r[iRest] ?? "").toLowerCase(); const restN = parseFloat(restRaw);
    const rest = Number.isFinite(restN) ? Math.round(Math.min(900, Math.max(0, /min|m\b|:/.test(restRaw) && !/sec|s\b/.test(restRaw) ? (restRaw.includes(":") ? Number(restRaw.split(":")[0]) * 60 + Number(restRaw.split(":")[1] || 0) : restN * 60) : restN))) : 90;
    const note = iN >= 0 ? (r[iN] ?? "").slice(0, 200) : "";
    w.items.push({ exId, name, sets, reps, rest, ...(note ? { note } : {}) });
  }
  return { workouts: [...byName.values()].filter((w) => w.items.length), exercises, matched, added };
}

/** A spreadsheet of the trainer's clients for their own records. */
export function clientsCsv(rows: { name: string; status: string; since: string; tags: string[]; phase: string; workoutsPct: number | null; email?: string; phone?: string }[]): string {
  const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ["Name", "Status", "Client since", "Tags", "Phase", "Plan followed this week (%)"];
  return [head, ...rows.map((r) => [r.name, r.status, r.since.slice(0, 10), r.tags.join("; "), r.phase, r.workoutsPct ?? ""])].map((r) => r.map(esc).join(",")).join("\r\n");
}
