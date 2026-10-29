// Pod+ Clips: TikTok videos that play inside Pod+ through TikTok's embed player. One shared list,
// set by the site owner (server/podcastClips.ts), that everyone sees on the Clips page.

/** How many clips the list holds at most. */
export const CLIPS_MAX = 100;

/** The video id from a TikTok link ("…/video/7123…") or a bare id; "" when there isn't one. */
export const clipId = (s: string) => (/\/video\/(\d{8,25})/.exec(s)?.[1] || (/^\d{8,25}$/.test(s.trim()) ? s.trim() : ""));

/** The video ids in pasted text or a list, in order, without repeats, at most CLIPS_MAX. */
export function clipIds(input: unknown): string[] {
  const parts = Array.isArray(input) ? input.map((x) => String(x ?? "")) : String(input ?? "").split(/\s+/);
  return [...new Set(parts.map(clipId).filter(Boolean))].slice(0, CLIPS_MAX);
}
