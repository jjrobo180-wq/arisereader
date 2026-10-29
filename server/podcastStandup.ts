// Pod+ Stand-up: a listener's favorite comedians, and only their stand-up. Interviews, podcast chats,
// reviews and news about a comedian are left out: episodes are found on Apple Podcasts (the
// comedian's name with "stand-up", "comedy special" and so on), then an AI reads each one's title,
// show and description and keeps only recordings of actual stand-up or comedy performance (a set,
// a special, a live show, a comedy album track, a roast or showcase set). Search inside the hub
// works the same way, so it only ever returns stand-up. Answers are kept a while, so the AI reads
// each episode once.
import { appleSearchUrl, parseEpisode, type PodEpisode } from "../shared/earshot";

export type AskText = (system: string, user: string) => Promise<unknown>;
export type StandupDeps = { apple: (url: string) => Promise<any>; ask: AskText; now?: () => number };

/** Words that mark an episode as talk about comedy rather than comedy itself. */
const TALK = /\binterview|\bin conversation|\bconversation with|\bsits down|\bchats? (with|about)|\btalks? (to|with|about)|\bjoins (us|the show|me)|\bguest\b|\bQ&A\b|\breview(s|ed)?\b|\breact(s|ion)\b|\bdiscuss|\bnews\b|\bpodcast episode\b|\bbreak(s|ing)? down\b|\bexplains?\b/i;
/** Words that mark a performance. */
const SET = /stand[- ]?up|comedy special|\bspecial\b|\blive (at|from|in)\b|\bset\b|\bcomedy (album|hour|set|showcase)|\bshowcase\b|\bcrowd work\b|\broast\b|\bopen mic\b|\bfull (show|set|special)\b|\bperforms?\b/i;

export const cleanName = (v: unknown) => String(v ?? "").replace(/[^\p{L}\p{N} .'&-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);

const json = (v: unknown): any => {
  if (v && typeof v === "object") return v;
  const t = String(v ?? ""), a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
};

/** Quick first pass before the AI: clear talk is dropped, and an episode about someone else isn't
 *  kept for a comedian search unless their name is in it. */
export function looksLikeSet(e: Pick<PodEpisode, "title" | "show" | "about">, name = ""): boolean {
  const text = `${e.title} ${e.show} ${e.about}`.slice(0, 1200);
  if (name) {
    const last = name.toLowerCase().split(" ").filter((w) => w.length > 2).pop() || name.toLowerCase();
    if (!text.toLowerCase().includes(last)) return false;
  }
  if (TALK.test(e.title)) return false;
  return SET.test(text) || /comedy/i.test(e.show);
}

export const STANDUP_SYSTEM = `You sort podcast episodes for a stand-up comedy app. Keep an episode ONLY if it is a recording of an actual comedy performance: a stand-up set, a comedy special, a live stand-up show, a comedy album track, a roast or showcase set, crowd work from a show, or a sketch/character comedy performance. Leave out everything else: interviews, conversations, podcast chat (even with comedians or about comedy), reviews, news, behind-the-scenes, advice, and any episode where the comedian is a guest talking. When unsure, leave it out. Reply with JSON only: {"keep": [the ids to keep]}.`;

export function standupService(deps: StandupDeps) {
  const now = deps.now ?? Date.now;
  const kept = new Map<string, { ok: boolean; at: number }>(); // episode id → stand-up or not
  const lists = new Map<string, { at: number; value: PodEpisode[] }>();
  const DAY = 24 * 3600_000;

  async function search(term: string, limit = 60): Promise<PodEpisode[]> {
    const b = await deps.apple(appleSearchUrl(term, "podcastEpisode", limit, true)).catch(() => null);
    return (Array.isArray(b?.results) ? b.results : []).map((r: unknown) => parseEpisode(r)).filter(Boolean) as PodEpisode[];
  }

  /** The AI's verdict on each episode (kept a month, so it reads each one once). */
  async function judge(list: PodEpisode[]): Promise<PodEpisode[]> {
    const fresh = list.filter((e) => !kept.has(e.id) || now() - kept.get(e.id)!.at > 30 * DAY);
    for (let i = 0; i < fresh.length; i += 25) {
      const batch = fresh.slice(i, i + 25);
      const lines = batch.map((e) => `${e.id} | ${e.show} | ${e.title} | ${e.about.replace(/\s+/g, " ").slice(0, 260)}`).join("\n");
      try {
        const out = json(await deps.ask(STANDUP_SYSTEM, `Episodes (id | show | title | description):\n${lines}`));
        const keep = new Set((Array.isArray(out?.keep) ? out.keep : []).map(String));
        for (const e of batch) kept.set(e.id, { ok: keep.has(e.id), at: now() });
      } catch {
        // The AI is busy: only the clearest sets get through for now (and are asked about next time).
        for (const e of batch) if (/stand[- ]?up|comedy special/i.test(`${e.title} ${e.show}`) && !TALK.test(e.title)) kept.set(e.id, { ok: true, at: now() - 29 * DAY });
      }
    }
    return list.filter((e) => kept.get(e.id)?.ok);
  }

  const unique = (list: PodEpisode[]) => { const seen = new Set<string>(); return list.filter((e) => !seen.has(e.id) && !!seen.add(e.id)); };
  const newestFirst = (list: PodEpisode[]) => [...list].sort((a, b) => Date.parse(b.date || "0") - Date.parse(a.date || "0"));
  async function cachedList(key: string, ttl: number, make: () => Promise<PodEpisode[]>) {
    const hit = lists.get(key);
    if (hit && now() - hit.at < ttl) return hit.value;
    const value = await make();
    lists.set(key, { at: now(), value });
    if (lists.size > 800) lists.delete(lists.keys().next().value!);
    return value;
  }

  /** One comedian's stand-up. */
  function comic(name: string): Promise<PodEpisode[]> {
    const n = cleanName(name);
    return cachedList(`comic:${n.toLowerCase()}`, 12 * 3600_000, async () => {
      const found = unique((await Promise.all([`${n} stand-up`, `${n} comedy special`].map((t) => search(t, 50)))).flat());
      return newestFirst(await judge(found.filter((e) => looksLikeSet(e, n)))).slice(0, 40);
    });
  }

  /** Search inside the hub: stand-up only, whatever the words. */
  function find(q: string): Promise<PodEpisode[]> {
    const words = cleanName(q);
    return cachedList(`q:${words.toLowerCase()}`, 6 * 3600_000, async () => {
      const found = unique((await Promise.all([`${words} stand-up`, `${words} comedy`].map((t) => search(t, 50)))).flat());
      return await judge(found.filter((e) => looksLikeSet(e)));
    });
  }

  /** Stand-up for anyone (no favorites picked yet). */
  function sampler(): Promise<PodEpisode[]> {
    return cachedList("sampler", 12 * 3600_000, async () => {
      const found = unique((await Promise.all(["stand-up comedy set", "stand-up comedy special"].map((t) => search(t, 60)))).flat());
      return newestFirst(await judge(found.filter((e) => looksLikeSet(e)))).slice(0, 60);
    });
  }

  /** Comedians like the ones picked (AI). */
  async function suggest(comics: string[]): Promise<{ name: string; why: string }[]> {
    const names = comics.map(cleanName).filter(Boolean).slice(0, 10);
    const out = json(await deps.ask(
      `You suggest stand-up comedians. Reply with JSON only: {"comics":[{"name":string,"why":string}]}, 10 real, well-known stand-up comedians the listener is likely to enjoy, none of the ones they already like. "why" is under 12 words, about their style.`,
      names.length ? `They like: ${names.join(", ")}` : "They haven't picked anyone yet: suggest a varied mix of popular stand-ups.",
    ));
    const seen = new Set(names.map((x) => x.toLowerCase()));
    return (Array.isArray(out?.comics) ? out.comics : []).map((c: any) => ({ name: cleanName(c?.name), why: String(c?.why || "").slice(0, 120) }))
      .filter((c: { name: string }) => c.name && !seen.has(c.name.toLowerCase()) && !!seen.add(c.name.toLowerCase())).slice(0, 10);
  }

  return { comic, find, sampler, suggest, judge };
}
