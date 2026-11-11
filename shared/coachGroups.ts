
/** Cleaned as you type: the start is trimmed but a space (or new line) just typed at the end stays, or the next word could never be typed. */
const typedEnd = (s: string) => s.replace(/^\s+/, "").replace(/ {2,}$/, "");
// Arise Trainer groups (November 2026): a trainer puts clients in a group with a page (posts, photos, comments,
// likes, pinned posts), a group chat, and challenges like a 21-day sugar reset with daily check-offs and a
// leaderboard. Members see their groups in Cooked (My trainer → Groups). Server: server/coachGroups.ts.

export type GroupPostComment = { id: string; by: number; name: string; at: string; text: string };
export type GroupPost = { id: string; by: number; name: string; coach: boolean; at: string; text: string; photo: string; likes: number[]; comments: GroupPostComment[]; pinned: boolean };
export type GroupMsg = { id: string; by: number; name: string; coach: boolean; at: string; text: string };
export type ChallengeTask = { id: string; label: string; points: number };
export type Challenge = { id: string; name: string; about: string; start: string; days: number; tasks: ChallengeTask[]; prize: string;
  /** clientId → day (YYYY-MM-DD) → task ids done. */
  log: Record<string, Record<string, string[]>> };
export type Group = { id: string; trainerId: number; name: string; about: string; cover: string; members: number[]; memberPosts: boolean; chatOn: boolean; createdAt: string };

export const GROUP_LIMITS = { groups: 50, members: 500, posts: 300, chat: 500, comments: 100, challenges: 20 };
export const COVER_COLORS = ["#ff5a1f", "#e11d48", "#7c3aed", "#2563eb", "#0d9488", "#16a34a", "#ca8a04", "#111827"];

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+$/g, "").slice(0, max) : "");
const rid = (v: unknown) => (typeof v === "string" && /^[\w-]{1,40}$/.test(v) ? v : Math.random().toString(36).slice(2, 12));
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** A cover is a color from the list or a small photo. */
const cover = (v: unknown) => (typeof v === "string" && (COVER_COLORS.includes(v) || (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= 300_000)) ? v : COVER_COLORS[0]);
export const photoOk = (v: unknown) => (typeof v === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= 300_000 ? v : "");

/** A group's id carries its trainer's id, so the server can find it without an index. */
export const newGroupId = (trainerId: number) => `g${trainerId.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export const trainerOfGroup = (gid: string): number | null => { const m = /^g([0-9a-z]{1,10})-[a-z0-9]{4,12}$/.exec(String(gid || "")); if (!m) return null; const n = parseInt(m[1], 36); return Number.isSafeInteger(n) && n > 0 ? n : null; };

export function cleanGroup(raw: unknown, trainerId: number, keep?: Group): Group | null {
  const r = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
  const name = typedEnd(str(r.name, 60));
  if (!name) return null;
  const members = Array.isArray(r.members) ? [...new Set(r.members.map(Number).filter((n: number) => Number.isSafeInteger(n) && n > 0 && n !== trainerId))].slice(0, GROUP_LIMITS.members) as number[] : keep?.members ?? [];
  return { id: keep?.id ?? newGroupId(trainerId), trainerId, name, about: str(r.about, 600), cover: cover(r.cover), members, memberPosts: r.memberPosts !== false, chatOn: r.chatOn !== false, createdAt: keep?.createdAt ?? new Date().toISOString() };
}

export function cleanChallenge(raw: unknown, keep?: Challenge): Challenge | null {
  const r = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
  const name = typedEnd(str(r.name, 60));
  const tasks = (Array.isArray(r.tasks) ? r.tasks : []).slice(0, 8).map((t: any) => ({ id: rid(t?.id), label: typedEnd(str(t?.label, 80)), points: Math.max(1, Math.min(10, Math.round(Number(t?.points) || 1))) })).filter((t: ChallengeTask) => t.label);
  if (!name || !tasks.length || !DAY.test(String(r.start))) return null;
  return { id: keep?.id ?? rid(undefined), name, about: str(r.about, 800), start: r.start, days: Math.max(1, Math.min(90, Math.round(Number(r.days) || 21))), tasks, prize: str(r.prize, 120), log: keep?.log ?? {} };
}

const addDays = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const challengeEnd = (c: Challenge) => addDays(c.start, c.days - 1);
export const challengeDays = (c: Challenge) => Array.from({ length: c.days }, (_, i) => addDays(c.start, i));
export const challengeState = (c: Challenge, today: string): "upcoming" | "live" | "done" => (today < c.start ? "upcoming" : today > challengeEnd(c) ? "done" : "live");
/** Day number (1-based) of a live challenge. */
export const challengeDay = (c: Challenge, today: string) => Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${c.start}T12:00:00Z`)) / 864e5) + 1;
/** Members may check off today and yesterday (for anyone who forgot before bed), inside the challenge. */
export const canCheck = (c: Challenge, day: string, today: string) => DAY.test(day) && day >= c.start && day <= challengeEnd(c) && day <= today && day >= addDays(today, -1);

export type Standing = { clientId: number; points: number; perfect: number; streak: number; days: number };
/** Points, perfect days (every task done) and current perfect-day streak for each member. */
export function standings(c: Challenge, members: number[], today: string): Standing[] {
  const ids = new Set(c.tasks.map((t) => t.id)); const pts = new Map(c.tasks.map((t) => [t.id, t.points]));
  const days = challengeDays(c).filter((d) => d <= today);
  return members.map((m) => {
    const log = c.log[String(m)] ?? {};
    let points = 0, perfect = 0, active = 0;
    const full = (d: string) => { const done = new Set((log[d] ?? []).filter((x) => ids.has(x))); return done.size === ids.size && ids.size > 0; };
    for (const d of days) { const done = (log[d] ?? []).filter((x) => ids.has(x)); if (done.length) active++; points += done.reduce((t, x) => t + (pts.get(x) ?? 0), 0); if (full(d)) perfect++; }
    // A streak counts back from today, or from yesterday when today isn't finished yet.
    let streak = 0; let i = days.length - 1;
    if (i >= 0 && !full(days[i])) i--;
    for (; i >= 0 && full(days[i]); i--) streak++;
    return { clientId: m, points, perfect, streak, days: active };
  }).sort((a, b) => b.points - a.points || b.perfect - a.perfect || a.clientId - b.clientId);
}
export const maxPoints = (c: Challenge) => c.tasks.reduce((t, x) => t + x.points, 0) * c.days;

export type ChallengeTemplate = { id: string; name: string; days: number; about: string; tasks: { label: string; points: number }[] };
export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  { id: "sugar", name: "21-day sugar reset", days: 21, about: "Three weeks with no added sugar. Cravings usually drop hard after the first week. Read labels: sugar hides in sauces, bread and \"healthy\" snacks.", tasks: [{ label: "No added sugar today", points: 3 }, { label: "8 glasses of water", points: 1 }, { label: "Protein with every meal", points: 1 }, { label: "Read the label before I ate it", points: 1 }] },
  { id: "steps", name: "30-day step challenge", days: 30, about: "Walk more every day. Most people find 8,000 steps is two short walks plus normal life.", tasks: [{ label: "8,000+ steps", points: 2 }, { label: "Bonus: 10,000+ steps", points: 1 }] },
  { id: "water", name: "14-day hydration", days: 14, about: "Drink enough water and drop the sugary drinks for two weeks.", tasks: [{ label: "3 liters of water (about 12 cups)", points: 2 }, { label: "No soda, juice or energy drinks", points: 1 }] },
  { id: "sleep", name: "14-day sleep reset", days: 14, about: "Better sleep makes training, hunger and mood easier. Same bedtime every night.", tasks: [{ label: "In bed by my bedtime", points: 2 }, { label: "No screens 30 minutes before bed", points: 1 }, { label: "7+ hours of sleep", points: 1 }] },
  { id: "strength", name: "6-week strength block", days: 42, about: "Show up for every workout on your plan, hit your protein and move a little every day.", tasks: [{ label: "Did my workout (or a rest day on plan)", points: 3 }, { label: "Hit my protein", points: 1 }, { label: "10 minutes of mobility", points: 1 }] },
  { id: "veggies", name: "21-day eat the rainbow", days: 21, about: "Five servings of vegetables and fruit a day, and more meals cooked at home.", tasks: [{ label: "5 servings of veg and fruit", points: 2 }, { label: "Cooked at home", points: 1 }] },
  { id: "core", name: "30-day core", days: 30, about: "A short core circuit and a stretch every day.", tasks: [{ label: "Plank + core circuit", points: 2 }, { label: "Stretch for 5 minutes", points: 1 }] },
];
