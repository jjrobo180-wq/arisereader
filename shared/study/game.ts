// Study Squad: the rules of a study table. One StudyRoom is one table: a lobby
// where readers sit down, then a game played on a study set. The server owns
// the room and calls tick() often; clients only ever see snapshot(), which
// never includes the right answer until a question is over.
import { typedAnswerMatches, type StudyItem, type StudyKind, type StudySet, type StudySubject } from "./sets";

export const STUDY_MODES = [
  { id: "lightning", name: "Lightning Round", icon: "⚡", blurb: "Everyone answers the same question. Right and fast scores the most.", teams: false },
  { id: "survival", name: "Last One Standing", icon: "❤️", blurb: "Three hearts each. A wrong answer costs a heart. Outlast everyone.", teams: false },
  { id: "tug", name: "Tug of War", icon: "🪢", blurb: "Two teams. The team that answers better pulls the rope.", teams: true },
  { id: "race", name: "Summit Race", icon: "⛰️", blurb: "Answer at your own speed. Every right answer is a step up the mountain.", teams: false },
] as const;
export type StudyMode = (typeof STUDY_MODES)[number]["id"];
export const studyMode = (id: string) => STUDY_MODES.find((m) => m.id === id) ?? STUDY_MODES[0];

export const STUDY_PHRASES = ["Hi!", "Good luck!", "Let's study!", "Nice one!", "So close!", "Good game!", "Rematch?", "Ready!", "One more round?", "Thanks!"] as const;
export const TEAM_NAMES = ["Red Rockets", "Blue Comets"] as const;

export const ROOM = {
  seats: 6,
  maxBots: 3,
  questionChoices: [5, 10, 15, 20],
  secondChoices: [10, 15, 20, 30],
  countdownMs: 3000,
  revealMs: 4500,
  hearts: 3,
  tugWin: 4,
  raceFreezeMs: 2500,
  raceSprintMs: 20_000,
  awayMs: 12_000,
  lobbyDropMs: 25_000,
  gameDropMs: 90_000,
  phraseMs: 5000,
};

export type StudyPhase = "lobby" | "countdown" | "question" | "reveal" | "racing" | "finished";
export type RoomSettings = { mode: StudyMode; questions: number; seconds: number; bots: number; publicTable: boolean };

/** A question as a player sees it. */
export type Asked = { id: number; prompt: string; kind: StudyKind; input: "pick" | "type"; options: string[] };
type Built = Asked & { correct: number; accepted: string[]; answerText: string; explain?: string };

export type Seat = { id: number; name: string; characterId: string };

export type StudyPlayerView = {
  id: number; name: string; characterId: string; bot: boolean; seat: number; team: 0 | 1; host: boolean; away: boolean;
  score: number; streak: number; correct: number; answered: number; hearts: number; out: boolean; step: number; finished: boolean;
  /** Has answered the question that is open right now. */
  answeredNow: boolean;
  /** Shown once a question is over (or after each answer in Summit Race). */
  lastCorrect: boolean | null;
  phrase: string | null;
};

export type StudyResultRow = { id: number; name: string; bot: boolean; team: 0 | 1; place: number; score: number; correct: number; answered: number; bestStreak: number; hearts: number; step: number };

export type StudyRoomView = {
  code: string;
  table: number;
  floor: string;
  hostId: number;
  phase: StudyPhase;
  settings: RoomSettings;
  set: { id: string; title: string; subject: StudySubject; count: number; ownerName: string } | null;
  players: StudyPlayerView[];
  now: number;
  phaseEnds: number;
  round: { index: number; total: number } | null;
  question: Asked | null;
  myAnswer: { choice: number | null; text: string | null } | null;
  reveal: { correct: number; answerText: string; explain?: string; counts: number[]; mine: { correct: boolean; points: number } | null; note: string } | null;
  tug: { rope: number; win: number; lastPull: number } | null;
  race: { goal: number; frozenUntil: number; last: { correct: boolean; answerText: string; explain?: string; boost: boolean } | null } | null;
  results: { ranking: StudyResultRow[]; winnerTeam: 0 | 1 | -1 | null; missed: { prompt: string; answer: string; yours: string }[] } | null;
};

type Player = Seat & {
  bot: boolean; seat: number; team: 0 | 1; lastSeen: number;
  score: number; streak: number; bestStreak: number; correct: number; answered: number;
  hearts: number; out: boolean; outRound: number; step: number; finishedAt: number;
  ans: { choice: number | null; text: string | null; at: number; correct: boolean; points: number } | null;
  shown: boolean | null;
  botAt: number; botRight: boolean; skill: number;
  order: number[]; cursor: number; frozenUntil: number; last: { correct: boolean; answerText: string; explain?: string; boost: boolean } | null;
  missed: { prompt: string; answer: string; yours: string }[];
  phrase: string | null; phraseAt: number;
};

const BOT_NAMES = ["Byte", "Pixel", "Nova", "Quill", "Echo"];
const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export class StudyRoomError extends Error {}

export class StudyRoom {
  readonly code: string;
  table: number;
  floor: string;
  hostId: number;
  phase: StudyPhase = "lobby";
  settings: RoomSettings = { mode: "lightning", questions: 10, seconds: 20, bots: 0, publicTable: true };
  set: StudySet | null = null;
  players: Player[] = [];
  touched: number;
  /** Set once the server has handed out coins for the finished game. */
  rewarded = false;
  /** How many games this room has started (used to tell one game from the next). */
  gameNo = 0;

  private random: () => number;
  private built: Built[] = [];
  private index = -1;
  private phaseEnds = 0;
  private questionStart = 0;
  private reveal: StudyRoomView["reveal"] = null;
  private rope = 0;
  private lastPull = 0;
  private raceGoal = 0;
  private winnerTeam: 0 | 1 | -1 | null = null;
  private ranking: StudyResultRow[] = [];
  private startedWith = 0;
  private nextBot = -1;

  constructor(code: string, host: Seat, opts: { table?: number; floor?: string; random?: () => number; now?: number } = {}) {
    this.code = code;
    this.table = opts.table ?? -1;
    this.floor = opts.floor ?? "";
    this.random = opts.random ?? Math.random;
    this.hostId = host.id;
    this.touched = opts.now ?? Date.now();
    this.add(host, this.touched);
  }

  // ─── Who is at the table ───────────────────────────────────────────────────
  member(id: number) { return this.players.some((p) => p.id === id && !p.bot); }
  get humans() { return this.players.filter((p) => !p.bot); }
  private player(id: number) {
    const p = this.players.find((x) => x.id === id);
    if (!p) throw new StudyRoomError("Sit down at this table first.");
    return p;
  }
  private fresh(seat: Seat, bot: boolean, now: number): Player {
    const taken = new Set(this.players.map((p) => p.seat));
    let n = 0;
    while (taken.has(n)) n++;
    return {
      ...seat, bot, seat: n, team: 0, lastSeen: now,
      score: 0, streak: 0, bestStreak: 0, correct: 0, answered: 0, hearts: ROOM.hearts, out: false, outRound: -1, step: 0, finishedAt: 0,
      ans: null, shown: null, botAt: 0, botRight: false, skill: 0.6 + this.random() * 0.25,
      order: [], cursor: 0, frozenUntil: 0, last: null, missed: [], phrase: null, phraseAt: 0,
    };
  }

  add(seat: Seat, now: number) {
    const existing = this.players.find((p) => p.id === seat.id);
    if (existing) { existing.lastSeen = now; existing.name = seat.name; existing.characterId = seat.characterId; return; }
    if (this.phase !== "lobby" && this.phase !== "finished") throw new StudyRoomError("This table is in the middle of a game. Try again when it ends.");
    if (this.players.length >= ROOM.seats) {
      const bot = this.players.find((p) => p.bot);
      if (!bot) throw new StudyRoomError("This table is full.");
      this.players = this.players.filter((p) => p !== bot);
      this.settings.bots = Math.max(0, this.settings.bots - 1);
    }
    this.players.push(this.fresh({ id: seat.id, name: seat.name.slice(0, 24) || "Reader", characterId: seat.characterId }, false, now));
    this.touched = now;
  }

  leave(id: number, now: number) {
    const p = this.players.find((x) => x.id === id);
    if (!p) return;
    this.players = this.players.filter((x) => x !== p);
    if (this.hostId === id) this.hostId = this.humans[0]?.id ?? 0;
    this.touched = now;
    if (this.phase === "question") this.maybeClose(now);
  }

  touch(id: number, now: number) {
    const p = this.players.find((x) => x.id === id);
    if (p) p.lastSeen = now;
    this.touched = now;
  }

  private away(p: Player, now: number) { return !p.bot && now - p.lastSeen > ROOM.awayMs; }

  /** Drops readers who walked away. */
  prune(now: number) {
    const limit = this.phase === "lobby" || this.phase === "finished" ? ROOM.lobbyDropMs : ROOM.gameDropMs;
    for (const p of this.humans) if (now - p.lastSeen > limit) this.leave(p.id, now);
  }

  private syncBots(now: number) {
    const want = Math.max(0, Math.min(this.settings.bots, ROOM.seats - this.humans.length));
    let bots = this.players.filter((p) => p.bot);
    while (bots.length > want) { const drop = bots.pop()!; this.players = this.players.filter((p) => p !== drop); }
    while (bots.length < want) {
      const used = new Set(this.players.map((p) => p.name));
      const name = BOT_NAMES.find((n) => !used.has(n + " (bot)")) ?? "Bot";
      const bot = this.fresh({ id: this.nextBot--, name: name + " (bot)", characterId: "bot" }, true, now);
      this.players.push(bot); bots.push(bot);
    }
    this.settings.bots = want;
  }

  // ─── The lobby ─────────────────────────────────────────────────────────────
  private host(id: number) { if (id !== this.hostId) throw new StudyRoomError("Only the table host can do that."); }

  configure(id: number, patch: Partial<RoomSettings>, now: number, set?: StudySet) {
    this.host(id);
    if (this.phase !== "lobby") throw new StudyRoomError("Change the table settings between games.");
    if (set) this.set = set;
    if (patch.mode && STUDY_MODES.some((m) => m.id === patch.mode)) this.settings.mode = patch.mode;
    if (ROOM.questionChoices.includes(Number(patch.questions))) this.settings.questions = Number(patch.questions);
    if (ROOM.secondChoices.includes(Number(patch.seconds))) this.settings.seconds = Number(patch.seconds);
    if (typeof patch.publicTable === "boolean") this.settings.publicTable = patch.publicTable;
    if (patch.bots !== undefined && Number.isFinite(Number(patch.bots))) this.settings.bots = Math.max(0, Math.min(ROOM.maxBots, Math.round(Number(patch.bots))));
    this.syncBots(now);
    this.touched = now;
  }

  say(id: number, phrase: string, now: number) {
    const p = this.player(id);
    if (!(STUDY_PHRASES as readonly string[]).includes(phrase)) throw new StudyRoomError("That phrase is not available.");
    if (now - p.phraseAt < 1500) return;
    p.phrase = phrase; p.phraseAt = now;
  }

  // ─── Building the questions ────────────────────────────────────────────────
  private shuffle<T>(list: T[]): T[] {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  private build(item: StudyItem, id: number, all: StudyItem[]): Built {
    const base = { id, prompt: item.prompt, kind: item.kind, explain: item.explain };
    if (item.kind === "truefalse") return { ...base, input: "pick", options: ["True", "False"], correct: item.answer === "True" ? 0 : 1, accepted: [], answerText: item.answer };
    if (item.kind === "typed") return { ...base, input: "type", options: [], correct: -1, accepted: [item.answer, ...item.accept], answerText: item.answer };
    let wrong: string[];
    if (item.kind === "choice") wrong = item.wrong;
    else {
      // flashcards borrow wrong answers from the other cards (then from anything else in the set)
      const others = this.shuffle(all.filter((o) => o !== item)).sort((a, b) => Number(b.kind === "card") - Number(a.kind === "card"));
      wrong = [];
      for (const o of others) {
        if (wrong.length >= 3) break;
        if (!sameText(o.answer, item.answer) && !wrong.some((w) => sameText(w, o.answer)) && o.kind !== "truefalse") wrong.push(o.answer);
      }
      if (!wrong.length) return { ...base, input: "type", options: [], correct: -1, accepted: [item.answer], answerText: item.answer };
    }
    const options = this.shuffle([item.answer, ...wrong]);
    return { ...base, input: "pick", options, correct: options.indexOf(item.answer), accepted: [], answerText: item.answer };
  }

  // ─── Starting and running a game ───────────────────────────────────────────
  start(id: number, now: number) {
    this.host(id);
    if (this.phase !== "lobby") throw new StudyRoomError("The game has already started.");
    if (!this.set) throw new StudyRoomError("Pick a study set first.");
    const mode = this.settings.mode;
    if (mode === "tug" && this.players.length < 2) { this.settings.bots = Math.max(1, this.settings.bots); this.syncBots(now); }
    const items = this.set.items;
    const pool = this.shuffle(items);
    const count = mode === "race" ? pool.length : Math.min(this.settings.questions, pool.length);
    this.built = pool.slice(0, count).map((item, i) => this.build(item, i, items));
    this.gameNo++;
    this.rewarded = false;
    this.rope = 0; this.lastPull = 0; this.reveal = null; this.winnerTeam = null; this.ranking = [];
    this.raceGoal = Math.max(5, Math.min(this.settings.questions, 20));
    this.startedWith = this.players.length;
    // teams: humans are dealt out first so they are split as evenly as possible
    const dealt = [...this.shuffle(this.humans), ...this.players.filter((p) => p.bot)];
    dealt.forEach((p, i) => { p.team = (i % 2) as 0 | 1; });
    for (const p of this.players) {
      Object.assign(p, { score: 0, streak: 0, bestStreak: 0, correct: 0, answered: 0, hearts: ROOM.hearts, out: false, outRound: -1, step: 0, finishedAt: 0, ans: null, shown: null, frozenUntil: 0, last: null, missed: [], cursor: 0 });
      p.order = this.shuffle(this.built.map((_, i) => i));
    }
    this.index = -1;
    this.phase = "countdown";
    this.phaseEnds = now + ROOM.countdownMs;
    this.touched = now;
  }

  again(id: number, now: number) {
    this.host(id);
    if (this.phase !== "finished") throw new StudyRoomError("Finish this game first.");
    this.phase = "lobby";
    this.reveal = null; this.ranking = []; this.winnerTeam = null; this.index = -1;
    for (const p of this.players) { p.out = false; p.ans = null; p.shown = null; p.last = null; }
    this.syncBots(now);
    this.touched = now;
  }

  private active() { return this.players.filter((p) => !p.out); }

  private open(now: number) {
    this.index++;
    this.phase = "question";
    this.questionStart = now;
    this.phaseEnds = now + this.settings.seconds * 1000;
    this.reveal = null;
    for (const p of this.players) {
      p.ans = null; p.shown = null;
      if (p.bot && !p.out) {
        p.botAt = now + (0.2 + this.random() * 0.55) * this.settings.seconds * 1000;
        p.botRight = this.random() < p.skill;
      }
    }
  }

  private points(p: Player, now: number) {
    const total = this.settings.seconds * 1000;
    const left = Math.max(0, Math.min(1, (this.phaseEnds - now) / total));
    return 500 + Math.round((500 * left) / 10) * 10 + Math.min(p.streak, 5) * 50;
  }

  private judge(q: Built, choice: number | null, text: string | null) {
    return q.input === "pick" ? choice === q.correct : typedAnswerMatches(text || "", q.accepted);
  }

  answer(id: number, questionId: number, payload: { choice?: unknown; text?: unknown }, now: number) {
    this.tick(now);
    const p = this.player(id);
    p.lastSeen = now;
    if (this.phase === "racing") return this.raceAnswer(p, questionId, payload, now);
    if (this.phase !== "question") throw new StudyRoomError("That question is over.");
    const q = this.built[this.index];
    if (!q || q.id !== questionId) throw new StudyRoomError("That question is over.");
    if (p.out) throw new StudyRoomError("You're out this game. Cheer on your friends!");
    if (p.ans) throw new StudyRoomError("You already answered.");
    const { choice, text } = this.read(q, payload);
    const correct = this.judge(q, choice, text);
    p.ans = { choice, text, at: now, correct, points: correct ? this.points(p, now) : 0 };
    this.touched = now;
    this.maybeClose(now);
  }

  private read(q: Built, payload: { choice?: unknown; text?: unknown }) {
    if (q.input === "pick") {
      const choice = Number(payload?.choice);
      if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length) throw new StudyRoomError("Choose one answer.");
      return { choice, text: null };
    }
    const text = String(payload?.text ?? "").trim().slice(0, 120);
    if (!text) throw new StudyRoomError("Type an answer.");
    return { choice: null, text };
  }

  private maybeClose(now: number) {
    if (this.phase !== "question") return;
    const waiting = this.active().filter((p) => !p.ans && !this.away(p, now));
    if (!waiting.length || now >= this.phaseEnds) this.close(now);
  }

  private close(now: number) {
    const q = this.built[this.index];
    const playing = this.active();
    const counts = q.options.map((_, i) => playing.filter((p) => p.ans?.choice === i).length);
    let note = "";
    for (const p of playing) {
      const right = !!p.ans?.correct;
      p.answered++;
      p.shown = right;
      if (right) { p.correct++; p.streak++; p.bestStreak = Math.max(p.bestStreak, p.streak); p.score += p.ans!.points; }
      else {
        p.streak = 0;
        if (!p.bot) p.missed.push({ prompt: q.prompt, answer: q.answerText, yours: p.ans ? (p.ans.text ?? q.options[p.ans.choice ?? -1] ?? "") : "" });
      }
    }
    const mode = this.settings.mode;
    if (mode === "survival") {
      const missed = playing.filter((p) => !p.ans?.correct);
      // if everyone left misses, nobody loses a heart (so a hard question can't end the game for all)
      if (playing.length >= 2 && missed.length === playing.length) note = "Everyone missed that one, so hearts are safe.";
      else for (const p of missed) { p.hearts--; if (p.hearts <= 0) { p.out = true; p.outRound = this.index; } }
    }
    if (mode === "tug") {
      const stat = ([0, 1] as const).map((team) => {
        const members = playing.filter((p) => p.team === team);
        const right = members.filter((p) => p.ans?.correct);
        return {
          size: members.length,
          acc: members.length ? right.length / members.length : 0,
          speed: right.length ? right.reduce((sum, p) => sum + (p.ans!.at - this.questionStart), 0) / right.length : Infinity,
        };
      });
      let pull = 0;
      if (stat[0].acc !== stat[1].acc) {
        const lead = stat[0].acc > stat[1].acc ? 0 : 1;
        pull = (lead === 0 ? -1 : 1) * (stat[lead].acc === 1 && stat[1 - lead].acc === 0 ? 2 : 1);
      } else if (stat[0].acc > 0 && stat[0].speed !== stat[1].speed) pull = stat[0].speed < stat[1].speed ? -1 : 1;
      this.rope = Math.max(-ROOM.tugWin, Math.min(ROOM.tugWin, this.rope + pull));
      this.lastPull = pull;
      note = pull === 0 ? "Dead even. The rope doesn't move." : `${TEAM_NAMES[pull < 0 ? 0 : 1]} pull${Math.abs(pull) > 1 ? " hard" : ""}!`;
    }
    this.reveal = { correct: q.correct, answerText: q.answerText, explain: q.explain, counts, mine: null, note };
    this.phase = "reveal";
    this.phaseEnds = now + ROOM.revealMs;
    this.touched = now;
  }

  private over() {
    const mode = this.settings.mode;
    if (this.index >= this.built.length - 1) return true;
    if (mode === "survival") {
      const alive = this.active().length;
      return this.startedWith >= 2 ? alive <= 1 : alive === 0;
    }
    if (mode === "tug") return Math.abs(this.rope) >= ROOM.tugWin;
    return false;
  }

  // ─── Summit Race (everyone answers at their own speed) ─────────────────────
  private raceQuestion(p: Player) { return this.built[p.order[p.cursor % p.order.length]]; }

  private raceStep(p: Player, correct: boolean, yours: string, now: number) {
    const q = this.raceQuestion(p);
    p.answered++;
    let boost = false;
    if (correct) {
      p.correct++; p.streak++; p.bestStreak = Math.max(p.bestStreak, p.streak);
      boost = p.streak % 3 === 0;
      p.step = Math.min(this.raceGoal, p.step + (boost ? 2 : 1));
      p.score = p.step * 100 + p.correct * 10;
    } else {
      p.streak = 0;
      p.frozenUntil = now + ROOM.raceFreezeMs;
      if (!p.bot && p.missed.length < 30) p.missed.push({ prompt: q.prompt, answer: q.answerText, yours });
    }
    p.last = { correct, answerText: q.answerText, explain: q.explain, boost };
    p.shown = correct;
    p.cursor++;
    if (p.cursor % p.order.length === 0) {
      // start the pile again in a new order, without asking the same question twice in a row
      const justAsked = q.id;
      p.order = this.shuffle(p.order);
      if (p.order.length > 1 && this.built[p.order[0]].id === justAsked) [p.order[0], p.order[1]] = [p.order[1], p.order[0]];
    }
    if (p.step >= this.raceGoal && !p.finishedAt) {
      p.finishedAt = now;
      p.score += 500;
      this.phaseEnds = Math.min(this.phaseEnds, now + ROOM.raceSprintMs);
    }
    this.touched = now;
  }

  private raceAnswer(p: Player, questionId: number, payload: { choice?: unknown; text?: unknown }, now: number) {
    if (p.finishedAt) throw new StudyRoomError("You reached the summit!");
    if (now < p.frozenUntil) throw new StudyRoomError("Catch your breath for a moment.");
    const q = this.raceQuestion(p);
    if (q.id !== questionId) throw new StudyRoomError("That question is over.");
    const { choice, text } = this.read(q, payload);
    this.raceStep(p, this.judge(q, choice, text), text ?? q.options[choice ?? -1] ?? "", now);
    this.raceCheck(now);
  }

  private raceCheck(now: number) {
    const humans = this.humans.filter((p) => !this.away(p, now));
    if (now >= this.phaseEnds || (humans.length > 0 && humans.every((p) => p.finishedAt))) this.finish(now);
  }

  // ─── The clock ─────────────────────────────────────────────────────────────
  tick(now: number) {
    if (this.phase === "countdown" && now >= this.phaseEnds) {
      if (this.settings.mode === "race") {
        this.phase = "racing";
        this.phaseEnds = now + Math.max(90_000, Math.min(300_000, this.raceGoal * 15_000));
        for (const p of this.players) if (p.bot) p.botAt = now + 3000 + this.random() * 4000;
      } else this.open(now);
    }
    if (this.phase === "question") {
      for (const p of this.players) {
        if (!p.bot || p.out || p.ans || now < p.botAt) continue;
        const q = this.built[this.index];
        const wrongPick = q.input === "pick" ? (q.correct + 1 + Math.floor(this.random() * Math.max(1, q.options.length - 1))) % q.options.length : null;
        const at = Math.min(p.botAt, this.phaseEnds);
        const total = this.settings.seconds * 1000;
        const left = Math.max(0, Math.min(1, (this.phaseEnds - at) / total));
        p.ans = {
          choice: q.input === "pick" ? (p.botRight ? q.correct : wrongPick) : null,
          text: q.input === "type" ? (p.botRight ? q.answerText : "?") : null,
          at, correct: p.botRight,
          points: p.botRight ? 500 + Math.round((500 * left) / 10) * 10 + Math.min(p.streak, 5) * 50 : 0,
        };
      }
      this.maybeClose(now);
    }
    if (this.phase === "reveal" && now >= this.phaseEnds) {
      if (this.over()) this.finish(now); else this.open(now);
    }
    if (this.phase === "racing") {
      for (const p of this.players) {
        if (!p.bot || p.finishedAt) continue;
        let guard = 0;
        while (now >= p.botAt && !p.finishedAt && guard++ < 50) {
          const right = this.random() < p.skill;
          this.raceStep(p, right, "?", p.botAt);
          p.botAt += 3500 + this.random() * 4500 + (right ? 0 : ROOM.raceFreezeMs);
        }
      }
      this.raceCheck(now);
    }
  }

  private finish(now: number) {
    const mode = this.settings.mode;
    const sorted = this.players.slice().sort((a, b) => {
      if (mode === "race") {
        if (!!a.finishedAt !== !!b.finishedAt) return a.finishedAt ? -1 : 1;
        if (a.finishedAt && b.finishedAt && a.finishedAt !== b.finishedAt) return a.finishedAt - b.finishedAt;
        return b.step - a.step || b.correct - a.correct;
      }
      if (mode === "survival") {
        if (a.out !== b.out) return a.out ? 1 : -1;
        if (a.out && b.out && a.outRound !== b.outRound) return b.outRound - a.outRound;
        return b.hearts - a.hearts || b.score - a.score;
      }
      return b.score - a.score || b.correct - a.correct;
    });
    const tie = (a: Player, b: Player) => {
      if (mode === "race") return a.finishedAt === b.finishedAt && a.step === b.step && a.correct === b.correct;
      if (mode === "survival") return a.out === b.out && a.outRound === b.outRound && a.hearts === b.hearts && a.score === b.score;
      return a.score === b.score && a.correct === b.correct;
    };
    let place = 0;
    this.ranking = sorted.map((p, i) => {
      if (i === 0 || !tie(sorted[i - 1], p)) place = i + 1;
      return { id: p.id, name: p.name, bot: p.bot, team: p.team, place, score: p.score, correct: p.correct, answered: p.answered, bestStreak: p.bestStreak, hearts: Math.max(0, p.hearts), step: p.step };
    });
    if (mode === "tug") {
      if (this.rope !== 0) this.winnerTeam = this.rope < 0 ? 0 : 1;
      else {
        const acc = ([0, 1] as const).map((team) => { const m = this.players.filter((p) => p.team === team); return m.reduce((s, p) => s + p.correct, 0) / Math.max(1, m.reduce((s, p) => s + p.answered, 0)); });
        this.winnerTeam = acc[0] === acc[1] ? -1 : acc[0] > acc[1] ? 0 : 1;
      }
    }
    this.phase = "finished";
    this.phaseEnds = 0;
    this.touched = now;
  }

  /** Readers who finished the game, with what they earned it for. The server turns this into coins. */
  outcome() {
    if (this.phase !== "finished") return [];
    const rivals = this.players.length;
    return this.ranking.filter((r) => !r.bot).map((r) => ({
      id: r.id, name: r.name, correct: r.correct, answered: r.answered, score: r.score,
      won: rivals >= 2 && (this.settings.mode === "tug" ? this.winnerTeam === r.team : r.place === 1),
    }));
  }

  // ─── What a reader sees ────────────────────────────────────────────────────
  summary() {
    return {
      code: this.code, table: this.table, phase: this.phase, mode: this.settings.mode, publicTable: this.settings.publicTable,
      setTitle: this.set?.title ?? "", hostName: this.players.find((p) => p.id === this.hostId)?.name ?? "Reader",
      seats: this.players.map((p) => ({ id: p.id, seat: p.seat, bot: p.bot, name: p.name })),
    };
  }

  snapshot(viewerId: number, now: number): StudyRoomView {
    const me = this.players.find((p) => p.id === viewerId);
    const mode = this.settings.mode;
    const showResult = this.phase === "reveal" || this.phase === "finished" || this.phase === "racing";
    let question: Asked | null = null;
    if (this.phase === "question" || this.phase === "reveal") { const q = this.built[this.index]; question = { id: q.id, prompt: q.prompt, kind: q.kind, input: q.input, options: q.options }; }
    if (this.phase === "racing" && me && !me.finishedAt) { const q = this.raceQuestion(me); question = { id: q.id, prompt: q.prompt, kind: q.kind, input: q.input, options: q.options }; }
    return {
      code: this.code, table: this.table, floor: this.floor, hostId: this.hostId, phase: this.phase, settings: { ...this.settings },
      set: this.set ? { id: this.set.id, title: this.set.title, subject: this.set.subject, count: this.set.items.length, ownerName: this.set.ownerName } : null,
      players: this.players.slice().sort((a, b) => a.seat - b.seat).map((p) => ({
        id: p.id, name: p.name, characterId: p.characterId, bot: p.bot, seat: p.seat, team: p.team, host: p.id === this.hostId, away: this.away(p, now),
        score: p.score, streak: p.streak, correct: p.correct, answered: p.answered, hearts: Math.max(0, p.hearts), out: p.out, step: p.step, finished: !!p.finishedAt,
        answeredNow: this.phase === "question" && !!p.ans,
        lastCorrect: showResult ? p.shown : null,
        phrase: p.phrase && now - p.phraseAt < ROOM.phraseMs ? p.phrase : null,
      })),
      now, phaseEnds: this.phaseEnds,
      round: this.index >= 0 && mode !== "race" ? { index: this.index, total: this.built.length } : null,
      question,
      myAnswer: me?.ans && (this.phase === "question" || this.phase === "reveal") ? { choice: me.ans.choice, text: me.ans.text } : null,
      reveal: this.phase === "reveal" && this.reveal ? { ...this.reveal, mine: me && me.shown !== null ? { correct: me.shown, points: me.shown ? me.ans?.points ?? 0 : 0 } : null } : null,
      tug: mode === "tug" && this.phase !== "lobby" ? { rope: this.rope, win: ROOM.tugWin, lastPull: this.phase === "reveal" ? this.lastPull : 0 } : null,
      race: mode === "race" && this.phase !== "lobby" ? { goal: this.raceGoal, frozenUntil: me?.frozenUntil ?? 0, last: me?.last ?? null } : null,
      results: this.phase === "finished" ? { ranking: this.ranking, winnerTeam: this.winnerTeam, missed: me?.missed.slice(0, 20) ?? [] } : null,
    };
  }
}
