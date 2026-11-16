// Kha ELA Worksheet Maker (a button inside the Math Lessons app, #/math-lessons).
//
// A teacher says what the worksheet should cover (or pastes / photographs a worksheet to follow) and gets, every time
// in the same shape, a poetry worksheet for a middle-school student with an IEP, written in simple, literal language
// and built around the student's favorite animals:
//   1. the WORKSHEET: a few very short poems, each with a picture (drawn in code, gently animated on screen), a
//      Poet's Toolbox, the questions in three parts, and a Bird Points box;
//   2. the COMIC: the same story as comic panels with captions and sound effects, ending in the big message;
//   3. the TEACHER KEY: every answer, why, clue and standard.
//
// This file is everything that is the same each time: the teacher's requirements (shown on the page AND written into the
// AI's instructions), the settings, the prompts (with the golden example so the AI copies its shape and voice), the
// cleaners that refuse a reply with a wrong count or a quote that isn't in the poems (the server sends back exactly what
// is wrong), the answer check, and the three document renderers. The server is server/khaEla.ts; the pictures are
// shared/khaElaArt.ts.
import { KHA_EXAMPLE } from "./khaElaExample";
import { SETTINGS, cleanScene, sceneSvg, ANIM_CSS, BIRDS, PROPS, ACTIONS, MOODS, type Scene } from "./khaElaArt";
import { esc, inline, parseJsonLoose, type Cleaned } from "./spedExemplar";

export { parseJsonLoose, type Cleaned };

// ─── The teacher's requirements ───────────────────────────────────────────────────────────────────
export const KHA_REQUIREMENTS: { id: string; text: string }[] = [
  { id: "audience", text: "Made for a student with an IEP: simple, literal words, short sentences, one task per question, and a layout that is the same every time (name and date box, mission, poems, toolbox, three parts, points box)." },
  { id: "poems", text: "Very short poems (about 4 to 7 lines) written new about the student's favorite animals, or the teacher's own poems used word for word. Three by default; you pick 1 to 4." },
  { id: "theme", text: "The poems follow the same idea as what the class is reading (a group treated unfairly, then respect), told with animals only. Real people are never turned into animals; real people are named only in the last question, in your own words." },
  { id: "tools", text: "Covers literary devices and theme. A Poet's Toolbox explains each tool in kid words with an example, and the questions use only those tools." },
  { id: "tenq", text: "Ten questions by default (you pick 5 to 15), in three parts: Spot the Poet's Tools, Read the Clues, Think Bigger. Circle, fill-in, sentence-starter and write-or-draw questions; every question points to the lines it is about." },
  { id: "pictures", text: "A picture for every poem so the student can see it, with speech bubbles. On a screen the pictures move gently (they can be paused, and stay still when printed or when a device asks for less motion)." },
  { id: "comic", text: "A comic version of the same poems: panels with captions and sound effects, ending with “The Big Message.”" },
  { id: "worksheet", text: "A printable worksheet with a Name and Date box, a mission, “Bird Points” for finishing questions, and a points box at the end." },
  { id: "key", text: "A teacher answer key: every answer, why it is right, the clue from the poem, a sample written answer, and the standard it practices." },
  { id: "checked", text: "Every question is answered again from the poems by a second reader. A question whose answer or wording doesn't check out is rewritten once, then marked “Double-check this one,” never passed off as sure." },
  { id: "change", text: "Change anything before or after: other animals, another focus, a worksheet or poem to follow, more or fewer poems and questions, or a plain-words instruction (“make it shorter”, “add a rhyme question”)." },
];

// ─── Settings ─────────────────────────────────────────────────────────────────────────────────────
export type KhaSettings = {
  /** First name only. It is the only thing about the student that is sent to the AI. */
  student: string;
  grade: string;
  interests: string;
  focus: string;
  /** What the class is reading, in the teacher's words (the last question connects to it). */
  classText: string;
  poems: number;
  questions: number;
  /** "new": write new poems. "asis": use the poems / worksheet pasted or photographed, word for word. */
  source: "new" | "asis";
  /** Autism-friendly supports: no idioms or sarcasm, one task at a time, sentence starters and word banks. */
  supports: boolean;
  /** "auto": draw the pictures (birds only). "box": leave a draw-it box for each (for other animals). */
  pictures: "auto" | "box";
  /** Anything else, in the teacher's words. */
  extra: string;
};
export const KHA_DEFAULTS: KhaSettings = {
  student: "Kha", grade: "7", interests: "pigeons and flamingos", focus: "literary devices and theme",
  classText: "poems about how Native Americans were treated, and an American Girl poem",
  poems: 3, questions: 10, source: "new", supports: true, pictures: "auto", extra: "",
};
export const KHA_LIMITS = { text: 24_000, images: 4, imageChars: 4_000_000, change: 600, extra: 800, field: 160, poemsMin: 1, poemsMax: 4, qMin: 5, qMax: 15, perDay: 12 } as const;

const clipStr = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[ \t]+/g, " ").trim().slice(0, n);
const intIn = (v: unknown, lo: number, hi: number, dflt: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };

/** Settings from the page, made safe. A first name only: letters, spaces, apostrophes and hyphens, never more than 20. */
export function cleanSettings(raw: unknown): KhaSettings {
  const r: any = raw && typeof raw === "object" ? raw : {};
  const name = String(r.student ?? "").replace(/[^\p{L} '’-]/gu, "").trim().split(/\s+/)[0]?.slice(0, 20) || KHA_DEFAULTS.student;
  return {
    student: name,
    grade: /^(K|[1-9]|1[0-2])$/.test(String(r.grade ?? "").trim()) ? String(r.grade).trim() : KHA_DEFAULTS.grade,
    interests: clipStr(r.interests, KHA_LIMITS.field) || KHA_DEFAULTS.interests,
    focus: clipStr(r.focus, KHA_LIMITS.field) || KHA_DEFAULTS.focus,
    classText: clipStr(r.classText, KHA_LIMITS.field * 2),
    poems: intIn(r.poems, KHA_LIMITS.poemsMin, KHA_LIMITS.poemsMax, KHA_DEFAULTS.poems),
    questions: intIn(r.questions, KHA_LIMITS.qMin, KHA_LIMITS.qMax, KHA_DEFAULTS.questions),
    source: r.source === "asis" ? "asis" : "new",
    supports: r.supports === false ? false : true,
    pictures: r.pictures === "box" ? "box" : "auto",
    extra: clipStr(r.extra, KHA_LIMITS.extra),
  };
}

// ─── The worksheet's shape ────────────────────────────────────────────────────────────────────────
export const STANDARDS: Record<string, string> = {
  "RL.7.1": "Cite textual evidence to support what a text says.",
  "RL.7.2": "Find a theme or central idea and how it develops.",
  "RL.7.3": "Tell how a story's parts (setting, events, characters) work together.",
  "RL.7.4": "Understand words and phrases, including rhyme, repetition and figurative language.",
  "RL.7.5": "Tell how a poem's form or structure adds to its meaning.",
  "RL.7.6": "Tell how a speaker's or character's point of view is shown.",
  "RL.7.9": "Compare a text with another text or with real history.",
};
const DEFAULT_STANDARD: Record<string, string> = { choice: "RL.7.4", fill: "RL.7.3", write: "RL.7.1", connect: "RL.7.9" };

export type KhaQuestion = {
  id: string;
  type: "choice" | "fill" | "write" | "connect";
  q: string;
  /** Which poem it is about (1, 2, 3...), or 0 for all of them. */
  poem: number;
  /** The toolbox tool it practices ("" when none). */
  tool: string;
  /** A phrase copied word for word from the poems. */
  evidence: string;
  why: string;
  standard: string;
  // choice
  options?: string[]; answer?: number;
  // fill: the question has ___ where each blank goes
  blanks?: { options: string[]; answer: number }[];
  // write / connect
  starter?: string; lines?: number; pick?: string[]; sample?: string;
  /** False when the second reader could not confirm it. */
  verified: boolean;
};
export type KhaPoem = { title: string; lines: string[]; scene: Scene };
export type KhaTool = { name: string; kid: string; example: string };
export type KhaPart = { title: string; questions: KhaQuestion[] };
export type KhaPanel = { caption: string; sfx: string; scene: Scene };
export type KhaSheet = {
  title: string; subtitle: string; mission: string;
  poems: KhaPoem[]; toolbox: KhaTool[]; parts: KhaPart[]; theme: string;
  comic: { title: string; subtitle: string; panels: KhaPanel[]; bigMessage: string };
  teacherNotes: string[];
};
export type KhaPack = { id: string; title: string; createdAt: string; ownerId: number; settings: KhaSettings; sheet: KhaSheet; check: { checked: number; flagged: number } };

/** How many questions go in each of the three parts (about 40%, 30%, 30%): 10 → 4, 3, 3. */
export function partSizes(n: number): [number, number, number] {
  const a = Math.round(n * 0.4), b = Math.round(n * 0.3);
  return [a, b, n - a - b];
}
export const comicPanelCount = (poems: number) => poems * 2 + 1;
const PART_TITLES = ["Spot the Poet's Tools", "Read the Clues", "Think Bigger"];

// ─── Cleaning: refuse a reply that is wrong, and say exactly what ─────────────────────────────────
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const flat = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^a-z0-9 ']+/g, " ").replace(/\s+/g, " ").trim();
const OPEN_ENDED = /\b(all|none|both|neither) of the (above|these)\b/i;
export const QUOTE_OK = (quote: string, poems: { lines: string[] }[]) => { const q = flat(quote); return !q || poems.some((p) => flat(p.lines.join(" ")).includes(q)); };

function cleanQuestion(v: any, where: string, poems: { lines: string[] }[], toolNames: string[], errors: string[]): Omit<KhaQuestion, "id" | "verified"> | null {
  const type = ["choice", "fill", "write", "connect"].includes(v?.type) ? (v.type as KhaQuestion["type"]) : null;
  const q = clipStr(v?.q, 520), why = clipStr(v?.why, 300), evidence = clipStr(v?.evidence, 200);
  const bad: string[] = [];
  if (!type) { errors.push(`${where} needs a type: "choice", "fill", "write" or "connect".`); return null; }
  if (!q) bad.push("the question (q)");
  if (type !== "connect" && words(q) > 36) bad.push(`a shorter question (it is ${words(q)} words; 36 or fewer)`);
  if (!why) bad.push("why (the reason it is right, one sentence)");
  if (!QUOTE_OK(evidence, poems)) bad.push(`evidence copied word for word from a poem ("${evidence.slice(0, 50)}" is not in the poems)`);
  if ((type === "choice" || type === "write") && !evidence) bad.push("evidence (a phrase copied word for word from a poem)");
  const poem = intIn(v?.poem, 0, poems.length, 0);
  const tool = toolNames.find((n) => n.toLowerCase() === clipStr(v?.tool, 40).toLowerCase()) ?? "";
  const standard = clipStr(v?.standard, 10) in STANDARDS ? clipStr(v?.standard, 10) : DEFAULT_STANDARD[type];
  const out: Omit<KhaQuestion, "id" | "verified"> = { type, q, poem, tool, evidence, why, standard };
  if (type === "choice") {
    const options = (Array.isArray(v?.options) ? v.options : []).map((o: unknown) => clipStr(o, 90)).filter(Boolean).slice(0, 4);
    const answer = Math.round(Number(v?.answer));
    if (options.length < 2 || options.length > 4) bad.push("2 to 4 options");
    else {
      if (!(answer >= 0 && answer < options.length)) bad.push(`answer (the number of the right option, starting at 0; there are ${options.length} options)`);
      if (new Set(options.map((o: string) => o.toLowerCase())).size !== options.length) bad.push("options that are all different");
      if (options.some((o: string) => OPEN_ENDED.test(o))) bad.push('options without "all of the above" or "none of the above"');
      const long = options.find((o: string) => words(o) > 14);
      if (long) bad.push(`shorter options ("${long.slice(0, 40)}…" is over 14 words)`);
    }
    out.options = options; out.answer = answer;
  } else if (type === "fill") {
    const stems = (q.match(/___/g) || []).length;
    const blanks = (Array.isArray(v?.blanks) ? v.blanks : []).slice(0, 3).map((b: any) => ({ options: (Array.isArray(b?.options) ? b.options : []).map((o: unknown) => clipStr(o, 50)).filter(Boolean).slice(0, 3), answer: Math.round(Number(b?.answer)) }));
    if (stems < 1 || stems > 3) bad.push('1 to 3 blanks written as ___ inside the question');
    else if (blanks.length !== stems) bad.push(`blanks: one { "options": [...], "answer": n } for each ___ (the question has ${stems}, you sent ${blanks.length})`);
    else if (blanks.some((b: any) => b.options.length < 2 || !(b.answer >= 0 && b.answer < b.options.length))) bad.push("2 or 3 options in every blank, and an answer number that points at one");
    out.blanks = blanks;
  } else {
    const sample = clipStr(v?.sample, 320), starter = clipStr(v?.starter, 120);
    if (!sample) bad.push("sample (a good written answer for the key)");
    if (type === "connect" && !starter) bad.push("starter (the start of the sentence)");
    const pick = (Array.isArray(v?.pick) ? v.pick : []).map((o: unknown) => clipStr(o, 30)).filter(Boolean).slice(0, 4);
    out.starter = starter; out.sample = sample; out.lines = intIn(v?.lines, 1, 4, type === "connect" ? 3 : 2);
    if (pick.length) out.pick = pick;
  }
  if (bad.length) { errors.push(`${where} is missing or has a problem with: ${bad.join("; ")}.`); return null; }
  return out;
}

/** Makes the right answers fall in different places: when over 60% of the circle questions share one position, the options are rotated. */
export function balanceAnswers(parts: KhaPart[]): void {
  const qs = parts.flatMap((p) => p.questions).filter((q) => q.type === "choice" && q.options && typeof q.answer === "number");
  if (qs.length < 4) return;
  const counts = new Map<number, number>();
  for (const q of qs) counts.set(q.answer!, (counts.get(q.answer!) ?? 0) + 1);
  if (Math.max(...counts.values()) / qs.length <= 0.6) return;
  qs.forEach((q, k) => {
    const n = q.options!.length, target = k % n, shift = (target - q.answer! + n) % n;
    q.options = q.options!.map((_, i) => q.options![(i - shift + n) % n]);
    q.answer = target;
  });
}

function cleanScenes(v: any, where: string, needBird: boolean, errors: string[]): Scene | null {
  const scene = cleanScene(v);
  if (needBird && !scene.birds.length) { errors.push(`${where} needs a scene with at least one bird (birds: [{ kind, x, size, facing, action, mood }]).`); return null; }
  return scene;
}

/** The AI's reply, checked against every rule, or the exact list of what to fix. */
export function cleanKhaSheet(raw: unknown, ask: KhaSettings): Cleaned<KhaSheet> {
  const r: any = raw && typeof raw === "object" ? raw : {};
  const errors: string[] = [];
  const needArt = ask.pictures === "auto";
  const title = clipStr(r.title, 70), subtitle = clipStr(r.subtitle, 110), mission = clipStr(r.mission, 260), theme = clipStr(r.theme, 200);
  if (!title) errors.push("title is missing.");
  if (!mission) errors.push("mission is missing (what the student will do, ending with how many questions earn Bird Points).");
  if (!theme) errors.push("theme is missing (the big message, one sentence).");

  const rawPoems = Array.isArray(r.poems) ? r.poems : [];
  if (rawPoems.length !== ask.poems) errors.push(`poems must have exactly ${ask.poems} poem${ask.poems === 1 ? "" : "s"} (you sent ${rawPoems.length}).`);
  const poems: KhaPoem[] = [];
  rawPoems.slice(0, ask.poems).forEach((p: any, i: number) => {
    const where = `Poem ${i + 1}`;
    const lines = (Array.isArray(p?.lines) ? p.lines : []).map((l: unknown) => clipStr(l, 90)).filter(Boolean);
    const ptitle = clipStr(p?.title, 60);
    if (!ptitle) errors.push(`${where} needs a title.`);
    if (lines.length < 2 || lines.length > 8) errors.push(`${where} needs 2 to 8 lines (it has ${lines.length}), one line per item in "lines".`);
    const long = lines.find((l: string) => words(l) > 11);
    if (long) errors.push(`${where} is too long for a very short poem: the line "${long.slice(0, 40)}…" is over 11 words.`);
    const scene = needArt ? cleanScenes(p?.scene, `${where}'s scene`, true, errors) : cleanScene(p?.scene);
    if (ptitle && lines.length >= 2 && scene) poems.push({ title: ptitle, lines, scene });
  });

  const tools: KhaTool[] = (Array.isArray(r.toolbox) ? r.toolbox : []).slice(0, 9).map((t: any) => ({ name: clipStr(t?.name, 28), kid: clipStr(t?.kid, 110), example: clipStr(t?.example, 110) })).filter((t: KhaTool) => t.name && t.kid && t.example);
  if (tools.length < 4) errors.push(`toolbox needs 4 to 9 tools, each with name, kid (what it means in kid words) and example (you sent ${tools.length} complete ones).`);
  const toolNames = tools.map((t) => t.name);

  const sizes = partSizes(ask.questions);
  const rawParts = Array.isArray(r.parts) ? r.parts : [];
  if (rawParts.length !== 3) errors.push(`parts must be exactly 3 parts (Spot the Poet's Tools, Read the Clues, Think Bigger); you sent ${rawParts.length}.`);
  const parts: KhaPart[] = [];
  rawParts.slice(0, 3).forEach((p: any, pi: number) => {
    const raws = Array.isArray(p?.questions) ? p.questions : [];
    if (raws.length !== sizes[pi]) errors.push(`Part ${pi + 1} must have exactly ${sizes[pi]} questions (you sent ${raws.length}); all three parts together make exactly ${ask.questions}.`);
    const qs: KhaQuestion[] = [];
    raws.slice(0, sizes[pi]).forEach((q: any, qi: number) => {
      const here = `Part ${pi + 1} question ${qi + 1}`;
      const c = cleanQuestion(q, here, poems, toolNames, errors);
      if (c) qs.push({ ...c, id: "", verified: true });
    });
    parts.push({ title: clipStr(p?.title, 50) || PART_TITLES[pi], questions: qs });
  });
  const last = parts[2]?.questions[parts[2].questions.length - 1];
  if (parts.length === 3 && parts[2].questions.length === sizes[2] && last && last.type !== "connect") errors.push('The very last question must have type "connect" (the real-life connection to what the class is reading, answered by writing or drawing).');
  if (parts.length === 3 && parts.slice(0, 2).some((p) => p.questions.some((q) => q.type === "connect"))) errors.push('Only the very last question may have type "connect".');

  const panelsWanted = comicPanelCount(ask.poems);
  const rawPanels = Array.isArray(r.comic?.panels) ? r.comic.panels : [];
  if (rawPanels.length !== panelsWanted) errors.push(`comic.panels must have exactly ${panelsWanted} panels (you sent ${rawPanels.length}): about two for each poem, then the ending.`);
  const panels: KhaPanel[] = [];
  rawPanels.slice(0, panelsWanted).forEach((p: any, i: number) => {
    const caption = clipStr(p?.caption, 170);
    if (!caption) errors.push(`Comic panel ${i + 1} needs a caption.`);
    const scene = needArt ? cleanScenes(p?.scene, `Comic panel ${i + 1}'s scene`, true, errors) : cleanScene(p?.scene);
    const sfx = clipStr(p?.sfx, 16);
    if (caption && scene) panels.push({ caption, sfx, scene });
  });
  const bigMessage = clipStr(r.comic?.bigMessage, 200);
  if (!bigMessage) errors.push("comic.bigMessage is missing (the theme, in one or two simple sentences).");

  const notes = (Array.isArray(r.teacherNotes) ? r.teacherNotes : []).map((n: unknown) => clipStr(n, 260)).filter(Boolean).slice(0, 5);
  if (notes.length < 2) errors.push("teacherNotes needs 2 to 5 short notes for the teacher (how to introduce it, and one careful note about the real-life topic).");

  if (errors.length) return { ok: false, errors: errors.slice(0, 14) };
  balanceAnswers(parts);
  let n = 0;
  for (const p of parts) for (const q of p.questions) q.id = `q${++n}`;
  return { ok: true, value: { title, subtitle, mission, poems, toolbox: tools, parts, theme, comic: { title: clipStr(r.comic?.title, 70) || title, subtitle: clipStr(r.comic?.subtitle, 110) || subtitle, panels, bigMessage }, teacherNotes: notes } };
}

/** One repaired question (used by the check): the same rules, for one question. */
export function cleanQuestionForRepair(v: unknown, poems: { lines: string[] }[], toolNames: string[]): Omit<KhaQuestion, "id" | "verified"> | null {
  return cleanQuestion(v, "Repaired question", poems, toolNames, []);
}

// ─── The prompts ──────────────────────────────────────────────────────────────────────────────────
const KHA_SHAPE = JSON.stringify(KHA_EXAMPLE);
const ENUMS = `Pictures are drawn by code from a description. "setting" is one of ${SETTINGS.join(", ")}. A bird "kind" is one of ${BIRDS.join(", ")}; "action" one of ${ACTIONS.join(", ")}; "mood" one of ${MOODS.join(", ")}; "facing" is "left" or "right"; "x" is 8 to 92 (left to right), "size" 0.6 to 1.4. A prop "kind" is one of ${PROPS.join(", ")}. "bubbles" are speech bubbles: { "who": the number of a bird in "birds" starting at 0, "text": 34 characters or fewer }. Use the same bird "kind" for the same character in every picture (the pigeon is always a pigeon).`;

export function khaPrompt(ask: KhaSettings): string {
  const n = ask.questions, [a, b, c] = partSizes(n);
  const asIs = ask.source === "asis";
  return `You write poetry worksheets for ${ask.student}, a grade ${ask.grade} student with an IEP, for their teacher. Reply with ONE JSON object and nothing else.

THE TEACHER'S REQUIREMENTS (every one is checked):
${KHA_REQUIREMENTS.map((r, i) => `${i + 1}. ${r.text}`).join("\n")}

THIS WORKSHEET:
- Favorite animals: ${ask.interests}.
- Focus: ${ask.focus}.
- ${ask.classText ? `The class is reading: ${ask.classText}. The poems follow the SAME IDEA (a group is treated unfairly because of who they are, then respect wins) but only with the animals. The last question connects the poems to the class reading, in the teacher's words above.` : "No class reading was named, so the last question connects the poems to the student's own life."}
- ${asIs ? "The teacher gave the poems or a worksheet (text or photos). Use the poems WORD FOR WORD (do not rewrite or shorten them) and build the questions from them. If a worksheet is given, follow its layout and kinds of questions as closely as these rules allow." : `Write ${ask.poems} NEW very short poems (4 to 7 lines, at most 8 words a line), all about the favorite animals, with clear rhyme and repetition so the tools can be taught. Together they tell a small story: the first shows the division, the next shows what it is like (a fence, a rule, a look), the last turns to respect and friendship. If a worksheet is given, follow its style.`}
- Exactly ${ask.poems} poem${ask.poems === 1 ? "" : "s"}, exactly ${n} questions: Part 1 "Spot the Poet's Tools" has ${a}, Part 2 "Read the Clues" has ${b}, Part 3 "Think Bigger" has ${c}. Exactly ${comicPanelCount(ask.poems)} comic panels.
${ask.supports ? `- Autism-friendly supports: literal words only. No idioms, sarcasm or riddles (a figure of speech is used ONLY when it is the thing being taught, and then the toolbox explains it literally). One task per question, said plainly ("Circle one." "Write one sentence."). Sentence starters on every writing question. Keep a calm, predictable order.` : "- Plain, simple wording."}
${ask.extra ? `- The teacher also asked: ${ask.extra}` : ""}

VOICE: grade 3 to 4 reading level, sentences of 12 words or fewer in questions, friendly and a little fun (Bird Points, short exclamations are fine). Say exactly what to do. Choices are short, believable, and only one is right. Never "all of the above" or "none of the above".

SAFETY: the poems are about animals only. Never make an animal group stand for a real race, nation or people, never use hateful words, never show cruelty. Unfairness is shown gently and answered with respect. Real people (what the class is reading) appear only in the last question, said plainly and respectfully.

QUESTIONS: each has "type": "choice" (q, options 2 to 4, answer = number of the right option starting at 0), "fill" (q with ___ for each of 1 to 3 blanks, "blanks": [{ "options": [2 or 3], "answer": n }]), "write" (q, "starter" sentence start, "lines" 1 to 4, optional "pick": 2 to 4 words to circle first, "sample" good answer) or "connect" (the real-life connection: q, starter, sample; answered by writing OR drawing; it is the very last question). Every question has "poem" (1, 2, 3... or 0 for all), "tool" (a toolbox name or ""), "evidence" (a phrase copied WORD FOR WORD from a poem; a poem line number is only used when you have counted it from the poem's "lines" list), "why" (one sentence) and "standard" (one of ${Object.keys(STANDARDS).join(", ")}). Practice only tools that are in the toolbox. When a question names a line, count the lines of that poem exactly as listed. Spread the right answers over different positions.

TOOLBOX: 4 to 9 tools (name, kid words, a tiny example), starting with the ones the questions use. Theme is always in it.

${ENUMS}

COMIC: ${comicPanelCount(ask.poems)} panels in order (about two per poem, then the ending), each { "caption" (a line or two from the poem, or a very short retelling), "sfx" (a short sound word like "THUNK!" or "" for none), "scene" }, then "bigMessage" (the theme).

TEACHER NOTES: 2 to 5 short notes ("teacherNotes"): how to introduce it, and one careful note about talking about the real-life topic.

THE SHAPE AND VOICE TO COPY. This is a finished worksheet the teacher liked; it has 3 poems and 10 questions. Copy its shape, keys and voice, not its poems (unless the teacher's own words ask for them):
${KHA_SHAPE}`;
}

/** What is sent with the instructions: the teacher's pasted worksheet / poems, and a note about photos. */
export const khaText = (ask: KhaSettings, text: string, images: number) =>
  [`Student first name: ${ask.student}`, text.trim() && `The teacher's worksheet / poems (typed or pasted):\n${text.trim()}`, images ? `${images} photo${images === 1 ? "" : "s"} of the teacher's worksheet or poems follow. Read every one closely, even if it is tilted or cut off.` : "", !text.trim() && !images && ask.source === "new" ? "No file was given: write everything new from the settings above." : ""].filter(Boolean).join("\n\n");

/** A change the teacher typed after seeing a worksheet: it goes back with the whole previous worksheet. */
export const refineText = (prev: KhaSheet, change: string) =>
  `Here is the worksheet you made (JSON):\n${JSON.stringify({ title: prev.title, subtitle: prev.subtitle, mission: prev.mission, poems: prev.poems, toolbox: prev.toolbox, parts: prev.parts.map((p) => ({ title: p.title, questions: p.questions.map(({ id, verified, ...q }) => q) })), theme: prev.theme, comic: prev.comic, teacherNotes: prev.teacherNotes })}\n\nThe teacher wants this change:\n"${change.replace(/"/g, "'")}"\n\nSend the WHOLE worksheet again as one JSON object with the change made and everything else kept the same, still following every requirement, count and rule above.`;

export const fixText = (errors: string[]) => `Your last reply could not be used. Fix exactly these problems, keep everything that was already right, and send the WHOLE JSON object again (nothing else):\n- ${errors.join("\n- ")}`;

// ─── The check: a second reader answers every question from the poems ─────────────────────────────
export const poemsForReader = (poems: KhaPoem[]) => poems.map((p, i) => `Poem ${i + 1}: ${p.title}\n${p.lines.map((l, j) => `  line ${j + 1}: ${l}`).join("\n")}`).join("\n\n");

export const CHECK_SYSTEM = `You are a careful reader checking a student's poetry worksheet against its poems. You see only the poems and the questions, not the answers. For each question:
- "choice": pick the one right option using ONLY the poems. Reply with its letter (A, B, C or D).
- "fill": pick the right option for each blank, in order. Reply with letters like ["B","A"].
- "write": nothing to pick (answers can be many).
- Also set "problem": a short sentence ONLY if something the question or an option says about the poems is clearly false (for example a wrong line number, a quote that is not there, a wrong rhyme), or if the question cannot be answered from the poems. Otherwise "". Questions with several fine answers are not a problem.
Reply with one JSON object and nothing else: { "results": [ { "id": "q1", "answer": ["A"], "problem": "" } ] }`;

export type CheckItem = { id: string; text: string };
export function checkItems(sheet: KhaSheet): CheckItem[] {
  const L = "ABCD";
  return sheet.parts.flatMap((p) => p.questions).map((q) => {
    let body = `${q.id} (${q.type}, about ${q.poem ? `poem ${q.poem}` : "all the poems"}): ${q.q}`;
    if (q.type === "choice") body += `\n${q.options!.map((o, i) => `  ${L[i]}. ${o}`).join("\n")}`;
    if (q.type === "fill") body += `\n${q.blanks!.map((b, i) => `  blank ${i + 1}: ${b.options.map((o, j) => `${L[j]}. ${o}`).join("  ")}`).join("\n")}`;
    if (q.type === "write" || q.type === "connect") body += `\n  (the student writes: "${q.starter ?? ""}")`;
    if (q.evidence) body += `\n  clue quoted: "${q.evidence}"`;
    return { id: q.id, text: body };
  });
}
export const checkText = (sheet: KhaSheet, only?: Set<string>) => `${poemsForReader(sheet.poems)}\n\nQuestions:\n${checkItems(sheet).filter((i) => !only || only.has(i.id)).map((i) => i.text).join("\n\n")}`;

/** The questions the second reader disagrees with, and why. */
export function judgeSheet(sheet: KhaSheet, results: unknown, only?: Set<string>): Map<string, string> {
  const flagged = new Map<string, string>();
  const rows: any[] = Array.isArray((results as any)?.results) ? (results as any).results : [];
  const byId = new Map(rows.map((r) => [String(r?.id), r]));
  const L = "ABCD";
  for (const q of sheet.parts.flatMap((p) => p.questions)) {
    if (only && !only.has(q.id)) continue;
    const r = byId.get(q.id);
    if (!r) { flagged.set(q.id, "The second reader did not answer it."); continue; }
    const problem = clipStr(r.problem, 200);
    const got = (Array.isArray(r.answer) ? r.answer : [r.answer]).map((x: unknown) => String(x ?? "").trim().toUpperCase().charAt(0));
    if (q.type === "choice" && got[0] !== L[q.answer!]) flagged.set(q.id, `The second reader chose ${got[0] || "nothing"}, not ${L[q.answer!]}. ${problem}`.trim());
    else if (q.type === "fill" && q.blanks!.some((b, i) => got[i] !== L[b.answer])) flagged.set(q.id, `The second reader's blanks (${got.join(", ") || "none"}) do not match. ${problem}`.trim());
    else if (problem) flagged.set(q.id, problem);
  }
  return flagged;
}

export const REPAIR_SYSTEM = `You are fixing poetry-worksheet questions that failed a check. You get the poems (with numbered lines) and each question with what was wrong. Rewrite each question so it is true about the poems, has exactly one right answer where it is a circle question, and keeps the same id, type, simple voice, "evidence" copied word for word from a poem, and the same fields.
Reply with one JSON object and nothing else: { "questions": [ { "id": "q1", "type": "...", "q": "...", "poem": 1, "tool": "...", "evidence": "...", "why": "...", "standard": "RL.7.4", "options": ["..."], "answer": 0 } ] }
(choice: options + answer starting at 0. fill: ___ in q + blanks [{ "options": [...], "answer": n }]. write / connect: starter, lines, sample, optional pick.)`;

// ─── Documents (printable HTML; every word of AI text is escaped) ─────────────────────────────────
const BASE_CSS = `@page{size:Letter;margin:.6in .65in .7in}*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font:13pt/1.5 'Helvetica Neue',Arial,sans-serif;color:#1d2433;margin:0;padding:0 6px;background:#fff}
h1{font:800 30pt/1.1 'Trebuchet MS',Arial,sans-serif;margin:0 0 4pt;color:#1d2433}h2{font:800 16pt 'Trebuchet MS',Arial,sans-serif;margin:0 0 6pt;break-after:avoid}h3{font:800 12pt Arial,sans-serif;margin:0 0 4pt}
.sub{font-size:13pt;color:#4a5468;margin:0 0 8pt}p{margin:0 0 6pt}.small{font-size:10pt;color:#4a5468}
.pause{position:absolute;opacity:0;pointer-events:none}.pausebtn{display:inline-flex;align-items:center;gap:6px;border:2px solid #1d2433;border-radius:999px;padding:5px 12px;font:700 10.5pt Arial;background:#fff;cursor:pointer;margin:0 0 8pt}.pause:focus-visible+.pausebtn{outline:3px solid #7c5cc4}.pause:checked+.pausebtn{background:#1d2433;color:#fff}
@media print{.pausebtn,.pause{display:none!important}}
${ANIM_CSS}`;
const shell = (title: string, css: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${BASE_CSS}${css}</style></head><body><input type="checkbox" id="pause" class="pause" aria-label="Pause the moving pictures"><label for="pause" class="pausebtn">⏸ Pause the pictures</label><div>${body}</div></body></html>`;
const picture = (scene: Scene, box: boolean, label: string) => box ? `<div class="drawbox"><span>Draw it here</span></div>` : sceneSvg(scene, { label });

const WORKSHEET_CSS = `
.top{margin:0 0 10pt}.namebox{display:flex;gap:16pt;border:2.5px solid #1d2433;border-radius:12pt;padding:8pt 14pt;margin:8pt 0;font:700 13pt Arial}.namebox span{flex:1;border-bottom:2px solid #1d2433;min-height:16pt;display:flex;align-items:flex-end}
.mission{background:#fff4c9;border:2.5px solid #1d2433;border-radius:14pt;padding:10pt 14pt;margin:0 0 12pt;font-size:13pt}
.poem{display:grid;grid-template-columns:1fr 1fr;gap:12pt;align-items:center;border:2.5px solid #1d2433;border-radius:16pt;padding:12pt;margin:0 0 12pt;break-inside:avoid}.poem:nth-of-type(odd){background:#fff1f6}.poem:nth-of-type(even){background:#eef3fb}
.poem h2{font-size:14pt;margin-bottom:6pt}.lines{list-style:none;margin:0;padding:0;counter-reset:l}.lines li{counter-increment:l;position:relative;padding-left:22pt;margin:0 0 2pt;font-size:13.5pt;line-height:1.4}.lines li::before{content:counter(l);position:absolute;left:0;top:3pt;width:15pt;height:15pt;border-radius:50%;background:#1d2433;color:#fff;font:700 8.5pt/15pt Arial;text-align:center}
.drawbox{border:2.5px dashed #1d2433;border-radius:12pt;min-height:130pt;display:flex;align-items:center;justify-content:center;color:#4a5468;font-weight:700}
.toolbox{margin:6pt 0 14pt;break-inside:avoid}.tools{display:grid;grid-template-columns:repeat(3,1fr);gap:8pt}.tool{border:2px solid #1d2433;border-radius:12pt;padding:7pt 10pt;background:#f1fbf6;break-inside:avoid}.tool b{font:800 12.5pt Arial}.tool p{font-size:10.5pt;margin:2pt 0 0;line-height:1.35}.tool .ex{color:#4a5468}
.part{margin:0 0 6pt}.part>h2{background:#1d2433;color:#fff;border-radius:10pt;padding:5pt 12pt;margin:12pt 0 8pt}
.q{border:2px solid #cfd6e4;border-radius:12pt;padding:9pt 12pt;margin:0 0 9pt;break-inside:avoid}.qh{display:flex;gap:9pt;align-items:flex-start}.num{flex:none;width:26pt;height:26pt;border-radius:50%;background:#e85d8a;color:#fff;font:800 13pt/26pt Arial;text-align:center}.qt{flex:1;font-weight:600}
.opts{list-style:none;margin:6pt 0 0 35pt;padding:0}.opts li{display:flex;align-items:center;gap:8pt;margin:0 0 5pt;font-size:13pt}.circ{flex:none;width:15pt;height:15pt;border:2.5px solid #1d2433;border-radius:50%;display:inline-block}
.fill .pickset{display:inline-flex;gap:6pt;align-items:center;border:2px dashed #1d2433;border-radius:999px;padding:0 8pt;margin:0 2pt;font-weight:800;white-space:nowrap}.pickset i{font-style:normal;font-weight:400;color:#4a5468}
.write{margin:6pt 0 0 35pt}.starter{font-weight:700;margin:0 0 2pt}.wl{border-bottom:2px solid #1d2433;height:23pt}.picks{display:flex;gap:12pt;flex-wrap:wrap;margin:6pt 0 4pt;font-weight:700}.picks span{display:inline-flex;gap:5pt;align-items:center}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10pt}.two .drawbox{min-height:90pt}
.points{border:3px solid #1d2433;border-radius:14pt;background:#fff4c9;padding:10pt 16pt;margin:12pt 0 0;font:800 16pt Arial;display:flex;justify-content:space-between;align-items:center;break-inside:avoid}.points .blank{display:inline-block;width:46pt;border-bottom:3px solid #1d2433}
@media (max-width:640px){.poem,.two{grid-template-columns:1fr}.tools{grid-template-columns:1fr 1fr}}`;

function questionHtml(q: KhaQuestion, num: number): string {
  let body = "";
  if (q.type === "choice") body = `<ul class="opts">${q.options!.map((o) => `<li><span class="circ"></span><span>${inline(o)}</span></li>`).join("")}</ul>`;
  const stem = q.type === "fill" ? (() => { let i = 0; return inline(q.q).replace(/___/g, () => { const b = q.blanks![i++]; return `<span class="pickset">${b.options.map((o, j) => `${j ? "<i>/</i> " : ""}<span class="circ"></span>${esc(o)}`).join(" ")}</span>`; }); })() : inline(q.q);
  if (q.type === "write") body = `<div class="write">${q.pick?.length ? `<div class="picks">${q.pick.map((p) => `<span><span class="circ"></span>${esc(p)}</span>`).join("")}</div>` : ""}${q.starter ? `<p class="starter">${inline(q.starter)}</p>` : ""}${'<div class="wl"></div>'.repeat(q.lines ?? 2)}</div>`;
  if (q.type === "connect") body = `<div class="write">${q.starter ? `<p class="starter">${inline(q.starter)}</p>` : ""}<div class="two"><div>${'<div class="wl"></div>'.repeat(q.lines ?? 3)}</div><div class="drawbox"><span>Or draw it here</span></div></div></div>`;
  return `<section class="q ${q.type}" data-q="${esc(q.id)}"><div class="qh"><span class="num">${num}</span><div class="qt">${stem}</div></div>${body}</section>`;
}

/** Document 1: the student's worksheet. No answers on it. */
export function worksheetHtml(sheet: KhaSheet, settings: Pick<KhaSettings, "pictures">): string {
  const box = settings.pictures === "box";
  let n = 0;
  const total = sheet.parts.reduce((s, p) => s + p.questions.length, 0);
  const body = `<header class="top"><h1>${esc(sheet.title)}</h1><p class="sub">${esc(sheet.subtitle)}</p>
<div class="namebox">Name <span></span> Date <span></span></div><div class="mission"><b>Mission:</b> ${inline(sheet.mission)}</div></header>
${sheet.poems.map((p, i) => `<section class="poem" aria-label="Poem ${i + 1}"><div><h2>Poem ${i + 1}: ${esc(p.title)}</h2><ol class="lines">${p.lines.map((l) => `<li>${inline(l)}</li>`).join("")}</ol></div><div>${picture(p.scene, box, p.scene.alt || p.title)}</div></section>`).join("")}
<section class="toolbox"><h2>Poet's Toolbox</h2><div class="tools">${sheet.toolbox.map((t) => `<div class="tool"><b>${esc(t.name)}</b><p>${inline(t.kid)}</p><p class="ex">Example: ${inline(t.example)}</p></div>`).join("")}</div></section>
${sheet.parts.map((p, i) => `<section class="part"><h2>Part ${i + 1}: ${esc(p.title)}</h2>${p.questions.map((q) => questionHtml(q, ++n)).join("")}</section>`).join("")}
<div class="points"><span>Bird Points:</span><span><span class="blank"></span> / ${total}</span></div>`;
  return shell(sheet.title, WORKSHEET_CSS, body);
}

const COMIC_CSS = `
.ctitle{border:4px solid #1d2433;border-radius:6pt;background:#ffd54a;padding:16pt;text-align:center;margin:0 0 12pt;box-shadow:5px 5px 0 #1d2433}.ctitle h1{font-size:34pt;text-transform:uppercase;letter-spacing:.02em}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12pt}.panel{margin:0;border:4px solid #1d2433;border-radius:4pt;background:#fff;position:relative;break-inside:avoid;box-shadow:4px 4px 0 #1d2433}.panel .scene{border-radius:0!important}
.cap{background:#fff0a8;border-bottom:3px solid #1d2433;padding:6pt 10pt;font:700 11.5pt/1.35 Arial}
.sfx{position:absolute;right:10pt;bottom:-14pt;z-index:2;transform:rotate(-8deg);background:#ff6b6b;color:#fff;border:3px solid #1d2433;padding:3pt 12pt;font:900 17pt/1 Impact,'Arial Black',Arial,sans-serif;letter-spacing:.04em;clip-path:polygon(0 12%,10% 0,22% 10%,36% 0,50% 10%,64% 0,78% 10%,90% 0,100% 14%,92% 34%,100% 56%,90% 78%,100% 100%,76% 90%,60% 100%,44% 90%,28% 100%,12% 90%,0 100%,8% 60%,0 36%);text-shadow:2px 2px 0 #1d2433}
.drawbox{border:2.5px dashed #1d2433;min-height:130pt;display:flex;align-items:center;justify-content:center;color:#4a5468;font-weight:700}
.big{grid-column:1/-1;border:4px solid #1d2433;border-radius:4pt;background:#7c5cc4;color:#fff;text-align:center;padding:16pt 20pt;box-shadow:5px 5px 0 #1d2433;break-inside:avoid}.big h2{font:900 15pt Arial;letter-spacing:.1em;text-transform:uppercase;color:#ffd54a;margin:0 0 6pt}.big p{font:800 19pt/1.3 'Trebuchet MS',Arial;margin:0}
@media (max-width:640px){.grid{grid-template-columns:1fr}}`;

/** Document 2: the comic. */
export function comicHtml(sheet: KhaSheet, settings: Pick<KhaSettings, "pictures">): string {
  const box = settings.pictures === "box";
  const c = sheet.comic;
  const body = `<div class="ctitle"><h1>${esc(c.title)}</h1><p class="sub" style="margin:0">${esc(c.subtitle)}</p></div>
<div class="grid">${c.panels.map((p, i) => `<figure class="panel" aria-label="Panel ${i + 1}"><div class="cap">${inline(p.caption)}</div>${picture(p.scene, box, p.scene.alt || p.caption)}${p.sfx ? `<span class="sfx" aria-hidden="true">${esc(p.sfx)}</span>` : ""}</figure>`).join("")}
<div class="big"><h2>The Big Message (Theme)</h2><p>${inline(c.bigMessage)}</p></div></div>`;
  return shell(`${c.title} (comic)`, COMIC_CSS, body);
}

const KEY_CSS = `
h1{font-size:24pt}.kicker{font:800 9pt Arial;letter-spacing:.08em;text-transform:uppercase;color:#7c5cc4;margin:0}body{font-size:11pt}
.k{border:1.5px solid #cfd6e4;border-radius:10pt;padding:7pt 11pt;margin:0 0 8pt;break-inside:avoid}.kh{display:flex;gap:8pt;align-items:baseline}.kn{background:#e85d8a;color:#fff;border-radius:6pt;padding:0 7pt;font:800 11pt Arial}
.ans{background:#1d2433;color:#fff;border-radius:7pt;padding:4pt 9pt;margin:5pt 0;font-weight:800}.row{margin:3pt 0;font-size:10.5pt}.row b{color:#4a5468}
.warn{background:#fff0cf;border-left:5pt solid #b45309;border-radius:6pt;padding:4pt 9pt;margin:5pt 0;font-weight:700;break-inside:avoid}
.poemk{border:1.5px solid #cfd6e4;border-radius:10pt;padding:7pt 11pt;margin:0 0 8pt;break-inside:avoid}.poemk p{margin:0;font-size:10.5pt}
.box{background:#eef3fb;border-radius:10pt;padding:8pt 12pt;margin:0 0 10pt;break-inside:avoid}ul{margin:3pt 0 6pt;padding-left:16pt}li{margin:0 0 3pt}`;
const SUPPORTS = [
  "Read each poem aloud once, then let the student read it with a finger under each line. The line numbers help with questions that name a line.",
  "Give one part at a time. A Bird Point can be given for trying, not only for right answers.",
  "Circle questions have one right answer. Writing questions take any answer that uses a clue from the poem; use the sample as a guide, not a script.",
  "Let the student write or draw the last question, and let them pause the moving pictures if they are distracting (the box at the top of the screen).",
];

/** Document 3: the teacher key. */
export function keyHtml(sheet: KhaSheet, settings: Pick<KhaSettings, "student" | "supports">, check: { checked: number; flagged: number }): string {
  const L = "ABCD";
  let n = 0;
  const qk = (q: KhaQuestion) => {
    const num = ++n;
    let ans = "";
    if (q.type === "choice") ans = `${L[q.answer!]}. ${q.options![q.answer!]}`;
    else if (q.type === "fill") ans = q.blanks!.map((b) => b.options[b.answer]).join("  ·  ");
    else ans = q.sample || "";
    return `<section class="k"><div class="kh"><span class="kn">${num}</span><b>${inline(q.q)}</b></div>
<div class="ans">${q.type === "write" || q.type === "connect" ? "Sample answer: " : "Answer: "}${inline(ans)}</div>
<p class="row"><b>Why:</b> ${inline(q.why)}</p>${q.evidence ? `<p class="row"><b>Clue in the poem:</b> “${esc(q.evidence)}”</p>` : ""}
<p class="row"><b>Practices:</b> ${esc(q.standard)}, ${esc(STANDARDS[q.standard] || "")}${q.tool ? ` · Tool: ${esc(q.tool)}` : ""}</p>
${q.verified ? "" : `<div class="warn">Double-check this one before you use it. The second reader could not confirm it.</div>`}</section>`;
  };
  const total = check.checked;
  const body = `<p class="kicker">Teacher answer key</p><h1>${esc(sheet.title)}</h1><p class="sub">For ${esc(settings.student)}'s worksheet and comic. Do not give this page to the student.</p>
<div class="box"><b>Check:</b> ${check.flagged === 0 ? `All ${total} questions were answered again from the poems by a second reader, and they matched.` : `${total - check.flagged} of ${total} questions were confirmed by a second reader. ${check.flagged} ${check.flagged === 1 ? "is" : "are"} marked “Double-check this one.”`}<br><b>Theme:</b> ${inline(sheet.theme)}</div>
<h2>The poems</h2>${sheet.poems.map((p, i) => `<div class="poemk"><h3>Poem ${i + 1}: ${esc(p.title)}</h3>${p.lines.map((l, j) => `<p><span class="small">${j + 1}.</span> ${inline(l)}</p>`).join("")}</div>`).join("")}
${sheet.parts.map((p, i) => `<h2>Part ${i + 1}: ${esc(p.title)}</h2>${p.questions.map(qk).join("")}`).join("")}
<h2>Notes for you</h2><ul>${sheet.teacherNotes.map((t) => `<li>${inline(t)}</li>`).join("")}${settings.supports ? SUPPORTS.map((t) => `<li>${esc(t)}</li>`).join("") : ""}</ul>`;
  return shell(`${sheet.title} (answer key)`, KEY_CSS, body);
}
