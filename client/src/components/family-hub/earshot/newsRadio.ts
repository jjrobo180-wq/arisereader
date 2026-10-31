// Pod+ Live News Radio: nonstop news, built from the news publishers' own hourly bulletins and news
// shows (NPR News Now, CBS News Roundup, ABC News Update, BBC...), the same public podcast feeds every
// podcast app plays. Newest first, one per show, and a bulletin that comes out while it's playing
// goes in next, so it plays like a live news station. The episodes come from Up to the Minute News
// (server/podcastNow.ts, GET /api/earshot/now).
import type { PodEpisode } from "@shared/earshot";

export const NEWS_RADIO_ID = "__newsradio";
export const NEWS_RADIO_NAME = "Pod+ Live News Radio";
/** How far back the lineup reaches. */
export const NEWS_RADIO_HOURS = 12;
/** Long shows (a 50-minute interview) don't suit a news station; bulletins and daily news shows do. */
const MAX_SECS = 35 * 60;

const ok = (e: PodEpisode) => /^https:\/\//i.test(e.audio || "") && (!e.secs || e.secs <= MAX_SECS) && Number.isFinite(Date.parse(e.date));
const when = (e: PodEpisode) => Date.parse(e.date) || 0;

/** The station's lineup: the newest episode of each news show, newest first, from the last
 *  `hours`. Nothing from the future (a wrong date), nothing without an https file. */
export function newsLineup(list: PodEpisode[], now = Date.now(), hours = NEWS_RADIO_HOURS): PodEpisode[] {
  const since = now - hours * 3600_000;
  const seen = new Set<string>(); const out: PodEpisode[] = [];
  for (const e of list.filter(ok).sort((a, b) => when(b) - when(a))) {
    const t = when(e);
    if (t < since || t > now + 15 * 60_000 || seen.has(e.showId)) continue;
    seen.add(e.showId); out.push(e);
  }
  return out;
}

/** Just in: bulletins newer than anything already on the air, not queued yet, newest first. */
export function justIn(list: PodEpisode[], queued: Set<string>, newestOnAir: number, now = Date.now()): PodEpisode[] {
  return newsLineup(list, now).filter((e) => !queued.has(e.id) && when(e) > newestOnAir);
}

/** What to add when the station is about to run out: lineup episodes not played yet, or (nothing
 *  new anywhere) the lineup again from the top, like a station repeating the latest headlines. */
export function refill(list: PodEpisode[], played: Set<string>, now = Date.now()): PodEpisode[] {
  const lineup = newsLineup(list, now);
  const fresh = lineup.filter((e) => !played.has(e.id));
  return fresh.length ? fresh : lineup;
}

export const newestOf = (list: PodEpisode[]) => list.reduce((m, e) => Math.max(m, when(e)), 0);
