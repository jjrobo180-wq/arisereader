// Creators on Pod+ and Earshot: Open Mic (where new and independent podcasters get found), Studio
// stats, the Pod+ Rise creator program, and LivePod (live shows with chat and Cheers). The rules
// here are shared by the server and the app, so both agree on rankings, limits and wording.

/** Episodes people make get ids "77" + 12 digits of their post id (server/podcastSocial.ts ownEpisodeId). */
export const OWN_EPISODE = /^77\d{12}$/;
export const postIdOfEpisode = (episodeId: string): number | null => (OWN_EPISODE.test(episodeId) ? Number(episodeId.slice(2)) : null);

// ---------------------------------------------------------------------------
// Open Mic ranking
// ---------------------------------------------------------------------------
export type MicTab = "fresh" | "rising" | "following";
export type MicStats = { plays: number; likes: number; comments: number; reposts: number; followers: number; episodes: number; ageHours: number; playsRecent: number };

/** A creator still finding their audience: few followers, or one of their first episodes. */
export const isNewVoice = (s: Pick<MicStats, "followers" | "episodes">) => s.followers < 100 || s.episodes <= 3;

/**
 * Where an episode lands in Open Mic. Fresh favors new episodes and small creators, so a first
 * upload gets seen; Rising favors what listeners are taking to right now, measured per hour so a
 * big account can't sit on top for weeks. Both fade with age.
 */
export function micScore(tab: MicTab, s: MicStats): number {
  const age = Math.max(0, s.ageHours);
  const engage = s.plays + s.likes * 3 + s.comments * 4 + s.reposts * 5;
  const small = s.followers < 25 ? 1.6 : s.followers < 100 ? 1.35 : s.followers < 1000 ? 1.1 : 1;
  const firsts = s.episodes <= 1 ? 1.4 : s.episodes <= 3 ? 1.2 : 1;
  if (tab === "rising") return ((s.playsRecent * 2 + engage + 1) / Math.pow(age + 6, 1.15)) * (small > 1 ? 1.1 : 1);
  // fresh (and following, which only changes who's in the list)
  return (Math.log2(engage + 2) * small * firsts) / Math.pow(age + 3, 0.85);
}

/** Keeps one creator from filling the list: at most `per` episodes each in a row of picks, best first. */
export function spreadCreators<T extends { score: number }>(list: T[], creatorOf: (x: T) => string, per = 2): T[] {
  const sorted = [...list].sort((a, b) => b.score - a.score);
  const seen = new Map<string, number>(); const top: T[] = []; const rest: T[] = [];
  for (const x of sorted) { const k = creatorOf(x), n = seen.get(k) ?? 0; if (n < per) { top.push(x); seen.set(k, n + 1); } else rest.push(x); }
  return [...top, ...rest];
}

/** In For You, every Nth card is an Open Mic episode (when there's one to show). */
export const MIC_EVERY = 5;
export const isMicSlot = (index: number) => index % MIC_EVERY === MIC_EVERY - 1;

// ---------------------------------------------------------------------------
// Listening stats
// ---------------------------------------------------------------------------
export type ListenSource = "openmic" | "foryou" | "social" | "profile" | "other";
export const LISTEN_SOURCES: ListenSource[] = ["openmic", "foryou", "social", "profile", "other"];
/** A play counts once someone has listened this long. */
export const PLAY_SECS = 10;
/** Listening is reported in steps no bigger than this, so one request can't inflate the numbers. */
export const MAX_LISTEN_STEP = 75;
/** Listened to most of it. */
export const completed = (secs: number, length: number) => length > 0 && secs >= length * 0.8;

/** Change from the previous period, as a whole percent (null when there was nothing before). */
export function trend(now: number, before: number): number | null {
  if (before <= 0) return now > 0 ? null : 0;
  return Math.round(((now - before) / before) * 100);
}

// ---------------------------------------------------------------------------
// Pod+ Rise, the creator program
// ---------------------------------------------------------------------------
export type RiseInput = { episodes: number; followers: number; plays30: number; daysSinceFirst: number; livePods: number };
export type RiseStep = { id: string; label: string; have: number; need: number; done: boolean };
export const RISE_NEEDS = { episodes: 3, followers: 100, plays30: 1000, days: 30 } as const;

export function riseProgress(x: RiseInput): { steps: RiseStep[]; eligible: boolean; percent: number } {
  const step = (id: string, label: string, have: number, need: number): RiseStep => ({ id, label, have: Math.max(0, Math.floor(have)), need, done: have >= need });
  const steps = [
    step("episodes", "Publish 3 episodes", x.episodes, RISE_NEEDS.episodes),
    step("followers", "Reach 100 followers", x.followers, RISE_NEEDS.followers),
    step("plays", "1,000 plays in the last 30 days", x.plays30, RISE_NEEDS.plays30),
    step("days", "30 days since your first episode", x.daysSinceFirst, RISE_NEEDS.days),
  ];
  const percent = Math.round((steps.reduce((a, s) => a + Math.min(1, s.have / s.need), 0) / steps.length) * 100);
  return { steps, eligible: steps.every((s) => s.done), percent };
}

/** What Rise opens up. Nothing here takes or pays money yet; the app says so. */
export const RISE_PERKS = [
  { id: "supporters", title: "Supporter memberships", blurb: "Listeners back your show every month and get supporter-only episodes." },
  { id: "paid", title: "Premium episodes", blurb: "Put a price on a special episode or a whole series." },
  { id: "cheers", title: "Cash out Cheers", blurb: "Cheers from your LivePods turn into earnings." },
  { id: "badge", title: "Member badge", blurb: "A badge on your profile, so listeners know they can support you." },
] as const;

// ---------------------------------------------------------------------------
// LivePod
// ---------------------------------------------------------------------------
/** Free during LivePods: each listener has a budget of Cheer points per LivePod. */
export const CHEERS = [
  { id: "clap", name: "Applause", emoji: "👏", points: 1 },
  { id: "coffee", name: "Coffee", emoji: "☕", points: 5 },
  { id: "encore", name: "Encore", emoji: "🔥", points: 10 },
  { id: "mic", name: "Golden Mic", emoji: "🎙️", points: 25 },
  { id: "record", name: "Gold Record", emoji: "💿", points: 50 },
  { id: "headliner", name: "Headliner", emoji: "👑", points: 100 },
] as const;
export type CheerId = (typeof CHEERS)[number]["id"];
export const cheerOf = (id: unknown) => CHEERS.find((c) => c.id === id) ?? null;
export const CHEER_BUDGET = 300;
/** Cheers this big get the whole screen. */
export const BIG_CHEER = 25;

/** Everyone in a LivePod hears the host; past this many the host's connection can't keep up, so
 *  later arrivals can still read and chat. */
export const LIVE_AUDIO_CAP = 40;
export const LIVE_CHAT_MAX = 200;
export const LIVE_TITLE_MAX = 100;
export const LIVE_TOPICS = ["Talk", "Interview", "Q&A", "News", "Sports", "Comedy", "True crime", "Music", "Learning", "Behind the scenes"] as const;

export const cleanLiveText = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

/** "12:04" for a LivePod's running time. */
export function liveClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/** Public stun servers that help two browsers find each other for LivePod audio. */
export const ICE_SERVERS = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }, { urls: "stun:stun.cloudflare.com:3478" }];

// ---------------------------------------------------------------------------
// Creator sign-in (Pod+)
// ---------------------------------------------------------------------------
export function cleanEmail(v: unknown): string {
  const e = typeof v === "string" ? v.trim().toLowerCase() : "";
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : "";
}
export const CODE_MINUTES = 15;
export const CODE_TRIES = 5;
export const CODES_PER_DAY = 8;
export const CODE_WAIT_SECS = 45;
