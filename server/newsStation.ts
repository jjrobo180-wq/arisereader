// Pod+ Live News Radio as one station for everyone: the server keeps a running schedule (which
// bulletin goes on air when), and every listener plays the bulletin that's on air now, from the point
// it has reached. Tune in on any phone or account and you hear the same thing at the same moment,
// like a real station. The newest bulletin from each news show goes on next; when nothing new has
// come out, the latest headlines run again. Only bulletins with a known length are scheduled (the
// length sets when the next one starts).
import type { PodEpisode } from "../shared/earshot";
import { stationLineup } from "../client/src/components/family-hub/earshot/newsRadio";

export type Slot = { ep: PodEpisode; startsAt: number; secs: number };
type Kv = { get(key: string): Promise<{ value: any; at: number } | null>; set(key: string, value: any): Promise<void> };

/** Always this far ahead of now. */
const AHEAD_MS = 40 * 60_000;
/** A bulletin played within this long isn't repeated while anything else is on hand. */
const FRESH_MS = 3 * 3600_000;
/** Kept behind now (for the record of what played). */
const KEEP_MS = 6 * 3600_000;
const MIN_SECS = 30, MAX_SECS = 35 * 60;
const KEY = "news-station:v1";

const endOf = (s: Slot) => s.startsAt + s.secs * 1000;
const usable = (e: PodEpisode) => e.secs >= MIN_SECS && e.secs <= MAX_SECS && /^https:\/\//i.test(e.audio || "");

/** The schedule from `now` on: what's already on air (or played) stays; everything after it is
 *  planned again from the newest bulletins, so one that just came out goes on next. */
export function planStation(kept: Slot[], episodes: PodEpisode[], now: number): Slot[] {
  const past = kept.filter((s) => s.startsAt <= now && endOf(s) > now - KEEP_MS).sort((a, b) => a.startsAt - b.startsAt);
  const out = past.slice();
  const lineup = stationLineup(episodes, now).filter(usable);
  if (!lineup.length) return out;
  const lastPlayed = (id: string) => { let t = -Infinity; for (const s of out) if (s.ep.id === id) t = Math.max(t, s.startsAt); return t; };
  let at = out.length ? Math.max(endOf(out[out.length - 1]), now) : now;
  // Nothing on air right now (a gap, or the very start): the newest goes on at once.
  for (let guard = 0; at < now + AHEAD_MS && guard < 200; guard++) {
    // Newest first among those not heard lately; otherwise the one heard longest ago.
    const fresh = lineup.find((e) => at - lastPlayed(e.id) > FRESH_MS);
    const next = fresh ?? lineup.slice().sort((a, b) => lastPlayed(a.id) - lastPlayed(b.id))[0];
    // Never the same bulletin twice in a row unless it's the only one there is.
    const prev = out[out.length - 1];
    const pick = prev && next.id === prev.ep.id && lineup.length > 1 ? lineup.find((e) => e.id !== prev.ep.id)! : next;
    out.push({ ep: pick, startsAt: at, secs: pick.secs });
    at += pick.secs * 1000;
  }
  return out;
}

/** What a listener needs: what's on now and the next few, and the server's clock. */
export function stationView(slots: Slot[], now: number, next = 4) {
  const i = slots.findIndex((s) => s.startsAt <= now && endOf(s) > now);
  const from = i >= 0 ? i : slots.findIndex((s) => s.startsAt > now);
  return { now, slots: from < 0 ? [] : slots.slice(from, from + 1 + next).map((s) => ({ ep: s.ep, startsAt: s.startsAt, secs: s.secs })) };
}

export function newsStation(d: { episodes: () => PodEpisode[]; kv?: Kv; now?: () => number }) {
  const now = d.now ?? Date.now;
  let slots: Slot[] = [];
  let loaded = false; let plannedAt = 0; let saving: Promise<void> | null = null;
  const load = async () => {
    if (loaded) return; loaded = true;
    try { const v = await d.kv?.get(KEY); if (Array.isArray(v?.value?.slots)) slots = v!.value.slots.filter((s: any) => s?.ep?.id && Number.isFinite(s.startsAt) && s.secs > 0); } catch { /* starts fresh */ }
  };
  return {
    async view() {
      await load();
      const t = now();
      // Planned again at most every 20 seconds (new bulletins, or the schedule running short).
      if (t - plannedAt > 20_000 || !slots.length || endOf(slots[slots.length - 1]) < t + 5 * 60_000) {
        const before = JSON.stringify(slots.filter((s) => s.startsAt <= t).map((s) => s.ep.id + s.startsAt));
        slots = planStation(slots, d.episodes(), t);
        plannedAt = t;
        // Saved when something new went on air, so a restart carries on where it was.
        if (d.kv && !saving && JSON.stringify(slots.filter((s) => s.startsAt <= t).map((s) => s.ep.id + s.startsAt)) !== before) {
          saving = d.kv.set(KEY, { slots: slots.filter((s) => s.startsAt <= t + AHEAD_MS) }).catch(() => {}).finally(() => { saving = null; });
        }
      }
      return stationView(slots, t);
    },
    /** Tests. */
    _slots: () => slots,
  };
}
