// A.R.I.S.E. Connect star videos (shared/ariseConnectVideos.ts and the course videos in
// shared/connectVideos.ts): before the page shows a video, the
// server asks YouTube about it (oEmbed). Videos YouTube says are gone, private, or not allowed to be
// played on other sites are hidden; the rest are shown with the title and channel YouTube reports.
// Answers are kept for 12 hours. If YouTube can't be reached at all, nothing is hidden for that
// reason (the page has "More from … on YouTube" either way).
import { STAR_VIDEOS, VALID_VIDEO_ID, type StarVideo } from "../shared/ariseConnectVideos";
import { allConnectVideoIds } from "../shared/connectVideos";

export type VideoCheck = { ok: boolean; title?: string; channel?: string; status?: number; at: number };
export type CheckedVideo = StarVideo & { ytTitle?: string; channel?: string };

const KEEP_MS = 12 * 60 * 60_000;
const RETRY_MS = 10 * 60_000;

export function createVideoChecker(fetchImpl: typeof fetch = fetch, now: () => number = Date.now) {
  const cache = new Map<string, VideoCheck>();
  let running: Promise<void> | null = null;

  async function checkOne(id: string): Promise<VideoCheck> {
    if (!VALID_VIDEO_ID.test(id)) return { ok: false, status: 400, at: now() };
    try {
      const res = await fetchImpl(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, { headers: { "User-Agent": "AriseConnect/1.0" }, signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data: any = await res.json().catch(() => ({}));
        return { ok: true, title: typeof data.title === "string" ? data.title.slice(0, 200) : undefined, channel: typeof data.author_name === "string" ? data.author_name.slice(0, 100) : undefined, status: 200, at: now() };
      }
      // 400/404: no such video; 401/403: private or embedding turned off. Anything else: not sure, keep it.
      return { ok: ![400, 401, 403, 404].includes(res.status), status: res.status, at: now() };
    } catch {
      return { ok: true, status: 0, at: now() }; // YouTube unreachable: don't hide anything for that
    }
  }

  function stale(c: VideoCheck | undefined) {
    if (!c) return true;
    return now() - c.at > (c.status === 0 ? RETRY_MS : KEEP_MS);
  }

  /** Checks every video that needs it, a few at a time. */
  function refresh(): Promise<void> {
    if (running) return running;
    const todo = allConnectVideoIds().filter((id) => stale(cache.get(id)));
    if (!todo.length) return Promise.resolve();
    running = (async () => {
      const queue = [...new Set(todo)];
      await Promise.all(Array.from({ length: 6 }, async () => {
        for (let id = queue.shift(); id; id = queue.shift()) cache.set(id, await checkOne(id));
      }));
    })().finally(() => { running = null; });
    return running;
  }

  /**
   * The career star videos to show, plus every id (from anywhere on Connect) YouTube says is gone, so
   * the page skips those and plays a lesson's backup instead. Waits up to `waitMs` for checks;
   * anything not checked yet is shown.
   */
  async function videos(waitMs = 4000): Promise<{ videos: CheckedVideo[]; hidden: string[]; checked: number }> {
    const job = refresh();
    await Promise.race([job, new Promise((r) => setTimeout(r, waitMs))]);
    const hidden: string[] = [];
    let checked = 0;
    for (const id of allConnectVideoIds()) {
      const c = cache.get(id);
      if (c && c.status !== 0) checked++;
      if (c && !c.ok) hidden.push(id);
    }
    const shown = STAR_VIDEOS.filter((v) => !hidden.includes(v.id)).map((v): CheckedVideo => {
      const c = cache.get(v.id);
      return { ...v, ...(c?.title ? { ytTitle: c.title } : {}), ...(c?.channel ? { channel: c.channel } : {}) };
    });
    return { videos: shown, hidden, checked };
  }

  return { videos, refresh, cache };
}
