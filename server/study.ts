// Study Squad — server. The study hall (who is where), its tables (one
// StudyRoom each), study sets, AI-made sets, class rules for teachers, and the
// coins and weekly board readers earn. Storage is the settings table, passed
// in, so there is no database migration and the whole thing runs in tests.
import type { Express, RequestHandler } from "express";
import { randomBytes, randomInt } from "node:crypto";
import { clubDay, clubWeek } from "../shared/clubPlay";
import { ROOM, STUDY_MODES, STUDY_PHRASES, StudyRoom, StudyRoomError, type Seat } from "../shared/study/game";
import { LOUNGE, SPAWN, TABLE_SPOTS, clampToHall, seatSpot, type LoungePerson, type LoungeTable, type LoungeView } from "../shared/study/lounge";
import {
  SET_LIMITS, STUDY_GRADES, STUDY_SUBJECTS, StudySetError, blockedWord, normalizeItem, normalizeSetDraft, summarize,
  type StudyItem, type StudySet, type StudySetSummary,
} from "../shared/study/sets";
import { STARTER_SETS, starterSet } from "../shared/study/starter";

export type StudyDeps = {
  getSetting(key: string): Promise<string>;
  upsertSetting(key: string, value: string): Promise<void>;
  /** The Perplexity key used for the other AI quizzes, or "" when AI isn't set up. */
  aiKey(): Promise<string>;
  /** Does this person have Premium? AI-made sets are a Premium extra for students. Left out, everyone counts as having it. */
  premium?(user: AnyUser): Promise<boolean>;
  fetch?: typeof fetch;
  random?: () => number;
};

type AnyUser = { id: number; displayName?: string; username?: string; role?: string; isAdmin?: boolean; is_eye_gaze_user?: boolean; teacherId?: number | null; school_id?: number | null; accountApproved?: boolean };
type ClassRules = { studentSets: boolean; studentAi: boolean };
type Stats = { games: number; wins: number; correct: number; answered: number; coinDay: string; coinsToday: number };
type BoardRow = { name: string; points: number; games: number };

export const STUDY_REWARDS = { finish: 10, sharp: 5, win: 10, dailyCap: 80, sharpAt: 0.8, minAnswers: 3 };
export const AI_PER_DAY = { student: 5, teacher: 40 };
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const isTeacher = (u: AnyUser) => !!(u.isAdmin || u.role === "teacher");
const isStudent = (u: AnyUser) => !u.isAdmin && u.role === "student";
const nameOf = (u: AnyUser) => String(u.displayName || u.username || "Reader").replace(/\s+/g, " ").trim().slice(0, 24) || "Reader";
/** Readers from the same school share a study hall; without a school, the same teacher; otherwise everyone else. */
const hallOf = (u: AnyUser) => (u.school_id ? `school:${u.school_id}` : u.role === "teacher" ? `teacher:${u.id}` : u.teacherId ? `teacher:${u.teacherId}` : "readers");
const floorKey = (hall: string, floor: number) => `${hall}#${floor}`;

const KEY = {
  sets: (userId: number) => `study_sets_${userId}`,
  global: "study_sets_global",
  rules: (teacherId: number) => `study_class_rules_${teacherId}`,
  classIndex: (teacherId: number) => `study_class_index_${teacherId}`,
  ai: (userId: number, day: string) => `study_ai_${userId}_${day}`,
  stats: (userId: number) => `study_stats_${userId}`,
  board: (hall: string, week: string) => `study_board_${hall}_${week}`,
  world: (userId: number) => `avatar_world_${userId}`,
  bonus: (userId: number) => `avatar_world_bonus_${userId}`,
};

// Never 401 or 503 here: the app retries those for several seconds before showing the message.
class Refused extends Error { constructor(message: string, readonly status = 400) { super(message); } }

export function registerStudyRoutes(app: Express, auth: RequestHandler, deps: StudyDeps) {
  const random = deps.random ?? Math.random;
  const doFetch: typeof fetch = deps.fetch ?? ((...args) => fetch(...args));
  const hasPremium = async (u: AnyUser) => (deps.premium ? deps.premium(u).catch(() => true) : true);

  // ─── Small storage helpers ─────────────────────────────────────────────────
  async function readJson<T>(key: string, fallback: T): Promise<T> {
    try { const raw = await deps.getSetting(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
  }
  const writeJson = (key: string, value: unknown) => deps.upsertSetting(key, JSON.stringify(value));
  // one change at a time per key, so two saves can't overwrite each other
  const locks = new Map<string, Promise<unknown>>();
  function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const next = (locks.get(key) ?? Promise.resolve()).then(fn, fn);
    const settled = next.catch(() => undefined);
    locks.set(key, settled);
    void settled.then(() => { if (locks.get(key) === settled) locks.delete(key); });
    return next;
  }

  const wrap = (handler: (req: any, res: any) => Promise<void> | void): RequestHandler => async (req: any, res: any) => {
    try { res.set("Cache-Control", "no-store"); await handler(req, res); }
    catch (e: any) {
      if (e instanceof Refused) return void res.status(e.status).json({ message: e.message });
      if (e instanceof StudySetError) return void res.status(400).json({ message: e.message });
      if (e instanceof StudyRoomError) return void res.status(409).json({ message: e.message });
      console.error("[study]", req.method, req.path, e?.message || e);
      res.status(500).json({ message: "Something went wrong in the study hall. Try again." });
    }
  };
  const access: RequestHandler = (req: any, res: any, next: any) => {
    const u: AnyUser = req.user;
    if (!u || u.role === "parent" || u.is_eye_gaze_user || u.accountApproved === false) return void res.status(403).json({ message: "The study hall is for student and teacher accounts." });
    next();
  };

  // ─── Study sets ────────────────────────────────────────────────────────────
  const ownSets = (userId: number) => readJson<StudySet[]>(KEY.sets(userId), []);
  const globalSets = () => readJson<StudySet[]>(KEY.global, []);
  const rulesFor = async (teacherId: number | null | undefined): Promise<ClassRules> => {
    const saved = teacherId ? await readJson<Partial<ClassRules>>(KEY.rules(teacherId), {}) : {};
    return { studentSets: saved.studentSets !== false, studentAi: saved.studentAi !== false };
  };
  const newSetId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${randomBytes(4).toString("hex")}`;

  async function visibleSets(u: AnyUser): Promise<StudySet[]> {
    const [mine, global, teachers] = await Promise.all([
      u.isAdmin ? Promise.resolve([] as StudySet[]) : ownSets(u.id),
      globalSets(),
      isStudent(u) && u.teacherId ? ownSets(u.teacherId) : Promise.resolve([] as StudySet[]),
    ]);
    return [...mine, ...teachers.filter((s) => s.shared), ...global, ...STARTER_SETS];
  }

  /** A set this user may open: a starter set, one of their own, their teacher's shared sets, or (for a teacher) a set made by one of their students. */
  async function findSet(u: AnyUser, id: string): Promise<StudySet | null> {
    const starter = starterSet(id);
    if (starter) return starter;
    const visible = (await visibleSets(u)).find((s) => s.id === id);
    if (visible) return visible;
    const owner = Number(/^u(\d+)-/.exec(id)?.[1] || 0);
    if (owner && isTeacher(u)) {
      const index = u.isAdmin ? null : await readJson<Record<string, string>>(KEY.classIndex(u.id), {});
      if (u.isAdmin || index?.[owner]) return (await ownSets(owner)).find((s) => s.id === id) ?? null;
    }
    return null;
  }

  async function saveSet(u: AnyUser, id: string | null, body: any): Promise<StudySet> {
    const student = isStudent(u);
    if (!student && !isTeacher(u)) throw new Refused("Only students and teachers can make study sets.", 403);
    if (student && !(await rulesFor(u.teacherId)).studentSets) throw new Refused("Your teacher has turned off student-made sets for your class.", 403);
    const draft = normalizeSetDraft(body ?? {}, { moderate: student || body?.madeWith === "ai" });
    const key = u.isAdmin ? KEY.global : KEY.sets(u.id);
    const saved = await withLock(key, async () => {
      const list = await readJson<StudySet[]>(key, []);
      const existing = id ? list.find((s) => s.id === id) : null;
      if (id && !existing) throw new Refused("That study set wasn't found.", 404);
      if (!existing && list.length >= (student ? SET_LIMITS.setsPerStudent : SET_LIMITS.setsPerTeacher)) throw new Refused("You've reached the limit for study sets. Delete one you no longer use.");
      const set: StudySet = {
        id: existing?.id ?? newSetId(u.isAdmin ? "g" : `u${u.id}`),
        ...draft,
        shared: student ? false : draft.shared,
        madeWith: existing ? existing.madeWith : draft.madeWith,
        ownerId: u.id, ownerName: nameOf(u), ownerRole: student ? "student" : "teacher", updatedAt: Date.now(),
      };
      await writeJson(key, existing ? list.map((s) => (s.id === set.id ? set : s)) : [set, ...list]);
      return set;
    });
    if (student && u.teacherId) {
      const indexKey = KEY.classIndex(u.teacherId);
      await withLock(indexKey, async () => {
        const index = await readJson<Record<string, string>>(indexKey, {});
        if (index[u.id] !== nameOf(u)) { index[u.id] = nameOf(u); await writeJson(indexKey, index); }
      });
    }
    return saved;
  }

  async function deleteSet(ownerKey: string, id: string) {
    return withLock(ownerKey, async () => {
      const list = await readJson<StudySet[]>(ownerKey, []);
      if (!list.some((s) => s.id === id)) throw new Refused("That study set wasn't found.", 404);
      await writeJson(ownerKey, list.filter((s) => s.id !== id));
    });
  }

  // ─── AI-made sets ──────────────────────────────────────────────────────────
  const FORMAT_GUIDE: Record<string, string> = {
    mixed: 'Mix the kinds: mostly "choice", with a few "truefalse" and "typed".',
    choice: 'Every item is kind "choice" with exactly three wrong answers.',
    truefalse: 'Every item is kind "truefalse". About half should be false.',
    typed: 'Every item is kind "typed" with a one- to three-word answer. List other correct spellings in "accept".',
    card: 'Every item is kind "card": a term or name as the prompt and a short meaning (under 12 words) as the answer.',
  };

  async function generateSet(input: { topic: string; notes: string; grade: string; count: number; format: string }) {
    const apiKey = await deps.aiKey();
    if (!apiKey) throw new Refused("AI study sets aren't set up yet. You can still write your own or paste a list.");
    const prompt = `Make a study set for students.

TOPIC: ${input.topic || "(use the study material below)"}
GRADE LEVEL: ${input.grade}
NUMBER OF ITEMS: exactly ${input.count}
FORMAT: ${FORMAT_GUIDE[input.format] ?? FORMAT_GUIDE.mixed}
${input.notes ? `STUDY MATERIAL (base every item on this, and only this):\n"""\n${input.notes}\n"""` : ""}

Return ONLY valid JSON in this exact shape:
{"title":"Short title","subject":"one of: ${STUDY_SUBJECTS.join(", ")}","items":[
 {"kind":"choice","prompt":"Question?","answer":"Right answer","wrong":["Wrong","Wrong","Wrong"],"explain":"One short sentence on why."},
 {"kind":"truefalse","prompt":"A statement.","answer":"True","explain":"..."},
 {"kind":"typed","prompt":"Question with a short answer?","answer":"Answer","accept":["Other correct spelling"]},
 {"kind":"card","prompt":"Term","answer":"Short meaning"}]}

Rules:
- Every answer must be clearly, factually correct, and every wrong answer clearly wrong.
- Keep prompts under 200 characters and answers under 80 characters.
- Use words a ${input.grade} student can read.
- School-appropriate only: no politics, religion, violence, romance, or anything unkind about a person or group.
- Don't repeat a question. Don't use "all of the above" or "none of the above".
- No markdown, no commentary, JSON only.`;
    const response = await doFetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You write accurate, age-appropriate K-12 study questions and return only valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Refused("The AI couldn't make a set right now. Try again in a minute.", 502);
    const data = (await response.json()) as any;
    const raw = String(data?.choices?.[0]?.message?.content || "");
    const match = raw.match(/\{[\s\S]*\}/);
    let parsed: any = null;
    try { parsed = match ? JSON.parse(match[0]) : null; } catch { parsed = null; }
    if (!parsed || !Array.isArray(parsed.items)) throw new Refused("The AI's answer didn't come out right. Try again.", 502);
    const items: StudyItem[] = [];
    const seen = new Set<string>();
    for (const rawItem of parsed.items) {
      try {
        const item = normalizeItem(rawItem, items.length + 1);
        const texts = [item.prompt, item.answer, item.explain ?? "", ...(item.kind === "choice" ? item.wrong : []), ...(item.kind === "typed" ? item.accept : [])];
        if (texts.some((x) => blockedWord(x)) || seen.has(item.prompt.toLowerCase())) continue;
        seen.add(item.prompt.toLowerCase());
        items.push(item);
      } catch { /* skip an item the AI got wrong */ }
      if (items.length >= SET_LIMITS.maxItems) break;
    }
    if (items.length < SET_LIMITS.minItems) throw new Refused("The AI didn't make enough good questions. Try a clearer topic.", 502);
    const title = String(parsed.title || input.topic || "AI study set").replace(/\s+/g, " ").trim().slice(0, SET_LIMITS.title[1]);
    return {
      title: blockedWord(title) || title.length < 3 ? "AI study set" : title,
      subject: (STUDY_SUBJECTS as readonly string[]).includes(parsed.subject) ? parsed.subject : "Other",
      grade: input.grade, description: input.topic ? `Made with AI about “${input.topic}”. Check the answers before you play.` : "Made with AI from study notes. Check the answers before you play.",
      items, madeWith: "ai" as const,
    };
  }

  // ─── The study hall: who is where ──────────────────────────────────────────
  type Visitor = { userId: number; name: string; characterId: string; hall: string; floor: number; x: number; z: number; facing: number; seenAt: number; role: "student" | "teacher" };
  const visitors = new Map<number, Visitor>();
  const rooms = new Map<string, StudyRoom>();
  /** What each reader earned from the game they just finished: code:game → userId → coins. */
  const earned = new Map<string, Map<number, { coins: number; capped: boolean }>>();

  function sweep(now: number) {
    visitors.forEach((v, id) => { if (now - v.seenAt > LOUNGE.presenceMs && !roomOf(id)) visitors.delete(id); });
  }
  const allRooms = () => Array.from(rooms.values());
  const roomOf = (userId: number) => allRooms().find((r) => r.member(userId)) ?? null;
  const peopleOn = (key: string) => { let n = 0; visitors.forEach((v) => { if (floorKey(v.hall, v.floor) === key) n++; }); return n; };

  async function identity(u: AnyUser): Promise<Seat> {
    const world = await readJson<any>(KEY.world(u.id), {});
    return { id: u.id, name: nameOf(u), characterId: String(world?.selectedCharacter || "robin-hood") };
  }

  async function enter(u: AnyUser, now: number, wantFloor?: number): Promise<Visitor> {
    sweep(now);
    const seated = roomOf(u.id);
    let existing = visitors.get(u.id);
    // a reader who visited a friend's table goes back to their own hall once they stand up
    if (existing && !seated && existing.hall !== hallOf(u)) { visitors.delete(u.id); existing = undefined; }
    if (existing && (seated || !wantFloor || wantFloor === existing.floor)) { existing.seenAt = now; return existing; }
    const hall = hallOf(u);
    let floor = 0;
    if (wantFloor && wantFloor >= 1 && wantFloor <= LOUNGE.floors && peopleOn(floorKey(hall, wantFloor)) < LOUNGE.capacity) floor = wantFloor;
    for (let f = 1; !floor && f <= LOUNGE.floors; f++) if (peopleOn(floorKey(hall, f)) < LOUNGE.capacity) floor = f;
    if (!floor) throw new Refused("The study hall is full right now. Try again in a minute.", 409);
    const who = await identity(u);
    const v: Visitor = { userId: u.id, name: who.name, characterId: who.characterId, hall, floor, x: existing?.x ?? SPAWN.x + (random() - 0.5) * 5, z: existing?.z ?? SPAWN.z + (random() - 0.5) * 1.5, facing: SPAWN.facing, seenAt: now, role: isStudent(u) ? "student" : "teacher" };
    visitors.set(u.id, v);
    return v;
  }

  function loungeView(v: Visitor, now: number): LoungeView {
    const key = floorKey(v.hall, v.floor);
    const tables: LoungeTable[] = Array.from({ length: LOUNGE.tables }, () => null);
    const seatOf = new Map<number, { table: number; seat: number }>();
    for (const r of allRooms()) {
      if (r.floor !== key || r.table < 0 || r.table >= LOUNGE.tables) continue;
      const s = r.summary();
      for (const seat of s.seats) if (!seat.bot) seatOf.set(seat.id, { table: r.table, seat: seat.seat });
      // a private table's code is only shown to the readers sitting at it
      tables[r.table] = { ...s, code: s.publicTable || r.member(v.userId) ? s.code : "" };
    }
    const people: LoungePerson[] = [];
    visitors.forEach((p) => {
      if (floorKey(p.hall, p.floor) !== key) return;
      const at = seatOf.get(p.userId);
      people.push({ userId: p.userId, name: p.name, characterId: p.characterId, x: p.x, z: p.z, facing: p.facing, table: at?.table ?? -1, seat: at?.seat ?? -1 });
    });
    const floors = Array.from({ length: LOUNGE.floors }, (_, i) => ({ floor: i + 1, people: peopleOn(floorKey(v.hall, i + 1)) }));
    void now;
    return { floor: v.floor, floors, people, tables };
  }

  // ─── Tables ────────────────────────────────────────────────────────────────
  function newCode() {
    for (let i = 0; i < 50; i++) {
      const code = Array.from(randomBytes(6), (n) => ALPHABET[n % ALPHABET.length]).join("");
      if (!rooms.has(code)) return code;
    }
    throw new Refused("Couldn't open a table. Try again.", 409);
  }
  function standUp(userId: number, now: number, except?: StudyRoom) {
    for (const r of allRooms()) {
      if (r === except || !r.member(userId)) continue;
      r.leave(userId, now);
      if (!r.humans.length) rooms.delete(r.code);
    }
  }
  const tableRoom = (key: string, table: number) => allRooms().find((r) => r.floor === key && r.table === table) ?? null;
  function getRoom(req: any) {
    const r = rooms.get(String(req.params.code || "").toUpperCase());
    if (!r || !r.member(Number(req.user.id))) throw new Refused("This table has closed. Pick another one.", 404);
    return r;
  }
  function viewFor(r: StudyRoom, userId: number, now: number) {
    const mine = earned.get(`${r.code}:${r.gameNo}`)?.get(userId) ?? null;
    return { ...r.snapshot(userId, now), earned: r.phase === "finished" ? mine : null };
  }

  // ─── Coins, stats and the weekly board ─────────────────────────────────────
  async function reward(r: StudyRoom, now: number) {
    const key = `${r.code}:${r.gameNo}`;
    const paid = new Map<number, { coins: number; capped: boolean }>();
    earned.set(key, paid);
    if (earned.size > 400) earned.delete(earned.keys().next().value as string);
    const day = clubDay(now), week = clubWeek(now);
    for (const o of r.outcome()) {
      const who = visitors.get(o.id);
      if (!who || who.role !== "student" || o.answered < STUDY_REWARDS.minAnswers) { paid.set(o.id, { coins: 0, capped: false }); continue; }
      try {
        const want = STUDY_REWARDS.finish + (o.correct / Math.max(1, o.answered) >= STUDY_REWARDS.sharpAt ? STUDY_REWARDS.sharp : 0) + (o.won ? STUDY_REWARDS.win : 0);
        const coins = await withLock(KEY.stats(o.id), async () => {
          const s = await readJson<Stats>(KEY.stats(o.id), { games: 0, wins: 0, correct: 0, answered: 0, coinDay: day, coinsToday: 0 });
          if (s.coinDay !== day) { s.coinDay = day; s.coinsToday = 0; }
          const give = Math.max(0, Math.min(want, STUDY_REWARDS.dailyCap - s.coinsToday));
          s.games++; s.wins += o.won ? 1 : 0; s.correct += o.correct; s.answered += o.answered; s.coinsToday += give;
          await writeJson(KEY.stats(o.id), s);
          return give;
        });
        if (coins > 0) await withLock(KEY.bonus(o.id), async () => {
          const bonus = Math.max(0, Number(await deps.getSetting(KEY.bonus(o.id))) || 0);
          await deps.upsertSetting(KEY.bonus(o.id), String(bonus + coins));
        });
        paid.set(o.id, { coins, capped: coins < want });
        const boardKey = KEY.board(who.hall, week);
        await withLock(boardKey, async () => {
          const board = await readJson<Record<string, BoardRow>>(boardKey, {});
          const row = board[o.id] ?? { name: o.name, points: 0, games: 0 };
          row.name = o.name; row.points += o.correct * 10 + (o.won ? 20 : 0); row.games++;
          board[o.id] = row;
          const top = Object.entries(board).sort((a, b) => b[1].points - a[1].points).slice(0, 200);
          await writeJson(boardKey, Object.fromEntries(top));
        });
      } catch (e: any) { console.error("[study] reward", e?.message || e); paid.set(o.id, { coins: 0, capped: false }); }
    }
  }

  async function boardFor(hall: string, now: number, viewerId: number) {
    const board = await readJson<Record<string, BoardRow>>(KEY.board(hall, clubWeek(now)), {});
    return Object.entries(board).sort((a, b) => b[1].points - a[1].points).slice(0, 10).map(([id, row], i) => ({ place: i + 1, name: row.name, points: row.points, games: row.games, me: Number(id) === viewerId }));
  }

  const timer = setInterval(() => {
    const now = Date.now();
    for (const r of allRooms()) {
      r.prune(now);
      if (!r.humans.length || now - r.touched > 2 * 60 * 60 * 1000) { rooms.delete(r.code); continue; }
      r.tick(now);
      if (r.phase === "finished" && !r.rewarded) { r.rewarded = true; void reward(r, now); }
    }
  }, 250);
  timer.unref?.();

  // ─── Routes ────────────────────────────────────────────────────────────────
  app.get("/api/study/bootstrap", auth, access, wrap(async (req, res) => {
    const u: AnyUser = req.user, now = Date.now();
    const v = await enter(u, now);
    const [sets, rules, stats, board, used, key] = await Promise.all([
      visibleSets(u), rulesFor(isStudent(u) ? u.teacherId : null),
      readJson<Stats>(KEY.stats(u.id), { games: 0, wins: 0, correct: 0, answered: 0, coinDay: "", coinsToday: 0 }),
      boardFor(v.hall, now, u.id), deps.getSetting(KEY.ai(u.id, clubDay(now))), deps.aiKey().catch(() => ""),
    ]);
    const limit = isStudent(u) ? AI_PER_DAY.student : AI_PER_DAY.teacher;
    // AI-made sets are a Premium extra for students.
    const aiLocked = isStudent(u) && !(await hasPremium(u));
    res.json({
      me: { id: u.id, name: v.name, characterId: v.characterId, teacher: isTeacher(u), student: isStudent(u) },
      lounge: loungeView(v, now),
      room: roomOf(u.id)?.code ?? null,
      sets: sets.map((s) => summarize(s, u.id)),
      rules,
      ai: { available: !!key && !aiLocked, locked: aiLocked, left: Math.max(0, limit - (Number(used) || 0)), perDay: limit },
      stats: { games: stats.games, wins: stats.wins, correct: stats.correct, answered: stats.answered, coinsToday: stats.coinDay === clubDay(now) ? stats.coinsToday : 0 },
      rewards: STUDY_REWARDS,
      board,
      phrases: STUDY_PHRASES,
      modes: STUDY_MODES,
    });
  }));

  // One call keeps a reader in the hall and (when they're seated) at their table.
  app.post("/api/study/sync", auth, access, wrap(async (req, res) => {
    const u: AnyUser = req.user, now = Date.now();
    const v = await enter(u, now, Number(req.body?.floor) || undefined);
    const x = Number(req.body?.x), z = Number(req.body?.z), facing = Number(req.body?.facing);
    const r = roomOf(u.id);
    if (r) {
      r.touch(u.id, now); r.tick(now);
      if (r.phase === "finished" && !r.rewarded) { r.rewarded = true; await reward(r, now); }
      const mySeat = r.players.find((p) => p.id === u.id)?.seat ?? 0;
      if (r.table >= 0) { const s = seatSpot(r.table, mySeat); v.x = s.x; v.z = s.z; v.facing = s.facing; }
    } else if (Number.isFinite(x) && Number.isFinite(z)) {
      [v.x, v.z] = clampToHall(x, z);
      if (Number.isFinite(facing)) v.facing = Math.max(-Math.PI * 2, Math.min(Math.PI * 2, facing));
    }
    res.json({ lounge: loungeView(v, now), room: r ? viewFor(r, u.id, now) : null });
  }));

  app.post("/api/study/leave", auth, access, wrap((req, res) => {
    const id = Number(req.user.id), now = Date.now();
    standUp(id, now);
    visitors.delete(id);
    res.json({ ok: true });
  }));

  app.get("/api/study/board", auth, access, wrap(async (req, res) => {
    const u: AnyUser = req.user, now = Date.now();
    res.json({ board: await boardFor(visitors.get(u.id)?.hall ?? hallOf(u), now, u.id) });
  }));

  // sets
  app.get("/api/study/sets", auth, access, wrap(async (req, res) => {
    res.json({ sets: (await visibleSets(req.user)).map((s) => summarize(s, req.user.id)) });
  }));
  app.get("/api/study/sets/:id", auth, access, wrap(async (req, res) => {
    const id = String(req.params.id);
    // the set on your table can be studied by everyone sitting at it
    const atTable = roomOf(Number(req.user.id))?.set;
    const set = atTable?.id === id ? atTable : await findSet(req.user, id);
    if (!set) throw new Refused("That study set wasn't found.", 404);
    res.json({ set });
  }));
  app.post("/api/study/sets", auth, access, wrap(async (req, res) => {
    const set = await saveSet(req.user, null, req.body);
    res.status(201).json({ set: summarize(set, req.user.id) });
  }));
  app.put("/api/study/sets/:id", auth, access, wrap(async (req, res) => {
    const set = await saveSet(req.user, String(req.params.id), req.body);
    res.json({ set: summarize(set, req.user.id) });
  }));
  app.delete("/api/study/sets/:id", auth, access, wrap(async (req, res) => {
    const u: AnyUser = req.user;
    await deleteSet(u.isAdmin ? KEY.global : KEY.sets(u.id), String(req.params.id));
    res.json({ ok: true });
  }));

  app.post("/api/study/generate", auth, access, wrap(async (req, res) => {
    const u: AnyUser = req.user, now = Date.now();
    const student = isStudent(u);
    if (!student && !isTeacher(u)) throw new Refused("Only students and teachers can make study sets.", 403);
    if (student) {
      if (!(await hasPremium(u))) throw new Refused("AI study sets are part of A.R.I.S.E. Premium. You can still write your own set or paste a list.", 402);
      const rules = await rulesFor(u.teacherId);
      if (!rules.studentSets || !rules.studentAi) throw new Refused("Your teacher has turned off AI study sets for your class.", 403);
    }
    const topic = String(req.body?.topic || "").replace(/\s+/g, " ").trim().slice(0, 120);
    const notes = String(req.body?.notes || "").trim().slice(0, 6000);
    if (topic.length < 2 && notes.length < 40) throw new Refused("Tell the AI what to make a set about, or paste your notes.");
    if (student && (blockedWord(topic) || blockedWord(notes))) throw new Refused("Please keep it school-friendly and try a different topic.");
    const grade = (STUDY_GRADES as readonly string[]).includes(String(req.body?.grade)) ? String(req.body.grade) : "6-8";
    const count = Math.max(5, Math.min(20, Math.round(Number(req.body?.count) || 10)));
    const format = ["mixed", "choice", "truefalse", "typed", "card"].includes(String(req.body?.format)) ? String(req.body.format) : "mixed";
    const limit = student ? AI_PER_DAY.student : AI_PER_DAY.teacher;
    const usedKey = KEY.ai(u.id, clubDay(now));
    // count the try before calling the AI, so quick double-clicks can't slip past the limit
    const left = await withLock(usedKey, async () => {
      const used = Number(await deps.getSetting(usedKey)) || 0;
      if (used >= limit) throw new Refused(`You've used today's ${limit} AI sets. You can still write your own or paste a list.`, 429);
      await deps.upsertSetting(usedKey, String(used + 1));
      return limit - used - 1;
    });
    try { res.json({ draft: await generateSet({ topic, notes, grade, count, format }), left }); }
    catch (e) {
      // a failed try doesn't count
      await withLock(usedKey, async () => { const used = Number(await deps.getSetting(usedKey)) || 0; await deps.upsertSetting(usedKey, String(Math.max(0, used - 1))); }).catch(() => {});
      throw e;
    }
  }));

  // teachers: class rules and the sets their students made
  const teacherOnly: RequestHandler = (req: any, res: any, next: any) => (isTeacher(req.user) ? next() : void res.status(403).json({ message: "Teacher access required." }));
  app.get("/api/study/class", auth, access, teacherOnly, wrap(async (req, res) => {
    const u: AnyUser = req.user;
    const index = await readJson<Record<string, string>>(KEY.classIndex(u.id), {});
    const lists = await Promise.all(Object.keys(index).map((id) => ownSets(Number(id))));
    res.json({ rules: await rulesFor(u.id), sets: lists.flat().sort((a, b) => b.updatedAt - a.updatedAt).map((s) => summarize(s, u.id)) });
  }));
  app.put("/api/study/class/rules", auth, access, teacherOnly, wrap(async (req, res) => {
    const rules: ClassRules = { studentSets: req.body?.studentSets !== false, studentAi: req.body?.studentAi !== false };
    await writeJson(KEY.rules(req.user.id), rules);
    res.json({ rules });
  }));
  app.delete("/api/study/class/sets/:id", auth, access, teacherOnly, wrap(async (req, res) => {
    const u: AnyUser = req.user, id = String(req.params.id);
    const owner = Number(/^u(\d+)-/.exec(id)?.[1] || 0);
    const index = await readJson<Record<string, string>>(KEY.classIndex(u.id), {});
    if (!owner || (!u.isAdmin && !index[owner])) throw new Refused("That study set wasn't found.", 404);
    await deleteSet(KEY.sets(owner), id);
    res.json({ ok: true });
  }));

  // tables
  app.post("/api/study/tables/sit", auth, access, wrap(async (req, res) => {
    const u: AnyUser = req.user, now = Date.now();
    const v = await enter(u, now);
    const code = String(req.body?.code || "").trim().toUpperCase();
    let r: StudyRoom | null = null;
    if (code) {
      r = rooms.get(code) ?? null;
      if (!r) throw new Refused("No table has that code. Check it with your friend.", 404);
    } else {
      const table = Number(req.body?.table);
      if (!Number.isInteger(table) || table < 0 || table >= LOUNGE.tables) throw new Refused("Pick a table.");
      r = tableRoom(floorKey(v.hall, v.floor), table);
      if (r && !r.settings.publicTable && !r.member(u.id)) throw new Refused("That's a private table. Ask your friend for the table code.", 403);
      if (!r) {
        if (rooms.size >= 400) throw new Refused("Every table is busy. Try again soon.", 409);
        standUp(u.id, now);
        const seat = await identity(u);
        r = new StudyRoom(newCode(), seat, { table, floor: floorKey(v.hall, v.floor), random, now });
        r.configure(u.id, {}, now, STARTER_SETS[Math.floor(random() * STARTER_SETS.length)]);
        rooms.set(r.code, r);
      }
    }
    if (!r.member(u.id)) {
      r.add(await identity(u), now); // throws if the table is full or mid-game, before the reader leaves their old table
      standUp(u.id, now, r);
    }
    // sitting down at a friend's table moves you to their floor
    const [hall, floor] = r.floor.split("#");
    v.hall = hall; v.floor = Number(floor) || 1;
    r.touch(u.id, now);
    res.json({ lounge: loungeView(v, now), room: viewFor(r, u.id, now) });
  }));

  app.post("/api/study/tables/:code/action", auth, access, wrap(async (req, res) => {
    const u: AnyUser = req.user, now = Date.now(), r = getRoom(req), b = req.body ?? {};
    r.touch(u.id, now); r.tick(now);
    switch (b.type) {
      case "settings": {
        const set = b.setId ? await findSet(u, String(b.setId)) : undefined;
        if (b.setId && !set) throw new Refused("That study set wasn't found.", 404);
        r.configure(u.id, { mode: b.mode, questions: b.questions, seconds: b.seconds, bots: b.bots, publicTable: b.publicTable }, now, set ?? undefined);
        break;
      }
      case "start": r.start(u.id, now); break;
      case "answer": r.answer(u.id, Number(b.questionId), { choice: b.choice, text: b.text }, now); break;
      case "say": r.say(u.id, String(b.phrase || ""), now); break;
      case "again": r.again(u.id, now); break;
      default: throw new Refused("That isn't something you can do at a table.");
    }
    if (r.phase === "finished" && !r.rewarded) { r.rewarded = true; await reward(r, now); }
    res.json({ room: viewFor(r, u.id, now) });
  }));

  app.post("/api/study/tables/:code/leave", auth, access, wrap(async (req, res) => {
    const id = Number(req.user.id), now = Date.now();
    const r = rooms.get(String(req.params.code || "").toUpperCase());
    if (r?.member(id)) {
      const spot = r.table >= 0 ? seatSpot(r.table, r.players.find((p) => p.id === id)?.seat ?? 0) : null;
      r.leave(id, now);
      if (!r.humans.length) rooms.delete(r.code);
      const seated = visitors.get(id);
      // stand up just behind the chair
      if (seated && spot) {
        const c = TABLE_SPOTS[r.table];
        [seated.x, seated.z] = clampToHall(c.x + (spot.x - c.x) * 1.35, c.z + (spot.z - c.z) * 1.35);
      }
    }
    const v = await enter(req.user, now);
    res.json({ ok: true, lounge: loungeView(v, now) });
  }));

  return { rooms, visitors, stop: () => clearInterval(timer) };
}
