// Arise All Access: one $10 a month plan for Arise To Duo, Arise Fit, Arise Notes and Pod+ together
// (shared/plans.ts's "all_access" kind). Sold on the website, one person per plan; the only sharing is
// Arise Fit's guest pass (server/fitPass.ts). Older plans (Duo Unlimited, the Notes plans, Fit+) are no
// longer sold, and everyone on one keeps it at its price until they cancel.
//
// What it costs us, and why the allowances are what they are (November 2026 prices):
//   - AI requests (Duo's AI, Fit's meal logs and coach, Notes' Ask your notes and study tools, Pod+'s
//     audiobook recaps and questions): chat runs on Groq's gpt-oss-120b, $0.15 / $0.60 per million
//     tokens, about $0.0006-$0.0015 a request. 1,000 a month: about $1.50 at most.
//   - Audio hours (Arise Notes recordings, and Pod+ episodes made ad-free for the first time; episodes
//     already ad-free cost nothing and don't count): Groq Whisper turbo about $0.04 an hour, plus the
//     ad finding, storage and download, about $0.05 an hour. Speaker names use Deepgram (nova-3 with
//     diarization, about $0.58 an hour), so only 2 of the 20 hours can have them. 20 hours: about $1.97.
//   - At the limit: about $3.47 a month. $10 less Apple's 15% is $8.50 (the website, after card fees,
//     $9.41), so at least $5.03 (or $5.94) profit per person; a typical person uses 20-30% of it.

export const ALL_ACCESS_NAME = "Arise All Access";
export const ALL_ACCESS_MONTHLY_CENTS = 1000;
/** AI requests a month, across all four apps. */
export const ALL_ACCESS_AI_PER_MONTH = 1000;
/** Minutes of audio a month: Notes recordings and new Pod+ ad-free episodes, together (20 hours). */
export const ALL_ACCESS_AUDIO_MINUTES = 1200;
/** Of those, minutes that can have speaker names (2 hours). */
export const ALL_ACCESS_SPEAKER_MINUTES = 120;
/** A new Pod+ episode counts for its length, up to this much (a 6-hour episode isn't 6 hours of anyone's month). */
export const POD_EPISODE_MAX_MINUTES = 180;
/** A new Pod+ episode whose length isn't known counts as this much. */
export const POD_EPISODE_GUESS_MINUTES = 45;

export const ALL_ACCESS_APPS = ["Arise To Duo", "Arise Fit", "Arise Notes", "Pod+"] as const;
export const ALL_ACCESS_BLURB =
  "Arise To Duo, Arise Fit, Arise Notes and Pod+ together: every app in Duo, Fit+ (with a guest pass for one friend), " +
  "Notes with 20 hours of recordings a month, and ad-free Pod+. 1,000 AI requests a month across all four.";
/** The website page that sells it (each app's upgrade button opens it). */
export const ALL_ACCESS_PATH = "/all-access";

/** This month's use of the shared allowances, saved per person. */
export type AccessUsage = {
  /** "2026-11" style: a record from an earlier month counts as empty. */
  month: string;
  ai: number;
  /** Seconds of recordings transcribed with speaker names. */
  speakerSecs: number;
  /** Pod+ episodes that already counted this month (each counts once). */
  podEpisodes: string[];
};

export const accessMonth = (now = Date.now()) => { const d = new Date(now); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

/** A saved record made safe; empty when it's from an earlier month. */
export function cleanAccessUsage(raw: unknown, now = Date.now()): AccessUsage {
  const month = accessMonth(now);
  const r: any = raw && typeof raw === "object" ? raw : {};
  if (r.month !== month) return { month, ai: 0, speakerSecs: 0, podEpisodes: [] };
  const n = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
  const eps = Array.isArray(r.podEpisodes) ? r.podEpisodes.filter((x: unknown): x is string => typeof x === "string" && x.length <= 80).slice(-600) : [];
  return { month, ai: n(r.ai), speakerSecs: n(r.speakerSecs), podEpisodes: eps };
}

export const aiLeft = (u: AccessUsage) => Math.max(0, ALL_ACCESS_AI_PER_MONTH - u.ai);
export const speakerMinutesLeft = (u: AccessUsage) => Math.max(0, ALL_ACCESS_SPEAKER_MINUTES - Math.ceil(u.speakerSecs / 60));

/** How many minutes a new Pod+ episode counts for. */
export function podEpisodeMinutes(secs: unknown): number {
  const s = Number(secs);
  if (!Number.isFinite(s) || s <= 0) return POD_EPISODE_GUESS_MINUTES;
  return Math.max(1, Math.min(POD_EPISODE_MAX_MINUTES, Math.ceil(s / 60)));
}

/** Words for the price: "$10 a month". */
export const allAccessPrice = () => `$${ALL_ACCESS_MONTHLY_CENTS / 100} a month`;
