// Pod+ Clips: TikTok videos that play inside Pod+ through TikTok's embed player. One shared list,
// set by the site owner (server/podcastClips.ts), that everyone sees on the Clips page.

/** How many clips the list holds at most. */
export const CLIPS_MAX = 500;

/** The video id from a TikTok link ("…/video/7123…") or a bare id; "" when there isn't one. */
export const clipId = (s: string) => (/\/video\/(\d{8,25})/.exec(s)?.[1] || (/^\d{8,25}$/.test(s.trim()) ? s.trim() : ""));

/** "@name" from "@name" or a tiktok.com/@name profile link; "" otherwise (video links aren't profiles). */
export const clipCreator = (s: string) => {
  const t = s.trim();
  if (/\/video\//.test(t)) return "";
  const m = /^@([A-Za-z0-9._]{2,24})$/.exec(t) || /tiktok\.com\/@([A-Za-z0-9._]{2,24})\/?(?:[?#].*)?$/.exec(t);
  return m ? `@${m[1].toLowerCase()}` : "";
};
/** One entry: a video id, or "@name" for that person's latest videos. */
export const clipItem = (s: string) => clipId(s) || clipCreator(s);
export const isCreatorItem = (s: string) => s.startsWith("@");

/** Videos and @people in pasted text or a list, in order, without repeats, at most CLIPS_MAX. */
export function clipItems(input: unknown): string[] {
  const parts = Array.isArray(input) ? input.map((x) => String(x ?? "")) : String(input ?? "").split(/[\s,]+/);
  return [...new Set(parts.map(clipItem).filter(Boolean))].slice(0, CLIPS_MAX);
}
/** Only the video ids. */
export const clipIds = (input: unknown) => clipItems(input).filter((x) => !isCreatorItem(x));
