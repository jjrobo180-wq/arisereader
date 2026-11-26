// Potty Training, shared: when someone logs in a Potty Training app that's shared (a parent logging in the other
// parent's), everyone else who shares it hears about it, with a push and in the bell ("Sarah logged: Pee in the
// potty · Ariana · just now"), and the logger's Accountability to-dos linked to Potty Training are checked off for
// the day (server/accountability.ts checkOffLinkedTasks), which tells whoever asked. Wired to the app-data save in
// server/userDocs.ts. What's new is worked out by shared/pro/potty/news.ts.
import { newPottyEntries, pottyNewsText, TIMER_URL } from "../shared/pro/potty";
import type { AppSaved } from "./userDocs";

export type PottySyncDeps = {
  push: (userId: number, m: { title: string; body: string; url?: string; tag?: string }) => Promise<unknown> | unknown;
  nameOf: (userId: number) => Promise<string>;
  /** Everyone the owner shares the app with. */
  sharers: (ownerId: number, appKey: string) => Promise<number[]>;
  /** Checks off the logger's to-dos linked to Potty Training. */
  checkOff: (userId: number, what: string) => Promise<number>;
  now?: () => number;
};

export const POTTY_APP = "pro-potty";

export function makePottyWatcher(deps: PottySyncDeps) {
  return async (s: AppSaved): Promise<{ told: number; checked: number }> => {
    if (s.app !== POTTY_APP || !s.editorId) return { told: 0, checked: 0 };
    const nowMs = (deps.now ?? Date.now)();
    const news = newPottyEntries(s.before, s.after, nowMs).filter((n) => n.counts);
    if (!news.length) return { told: 0, checked: 0 };
    const who = await deps.nameOf(s.editorId).catch(() => "");
    const people = new Set([s.ownerId, ...(await deps.sharers(s.ownerId, s.app).catch(() => [] as number[]))]);
    people.delete(s.editorId);
    const text = pottyNewsText(who, news, nowMs);
    let told = 0;
    for (const p of people) {
      try { await deps.push(p, { ...text, url: TIMER_URL, tag: `potty-log-${news[0].id}` }); told++; } catch { /* the others still hear */ }
    }
    const top = news[0];
    const checked = await deps.checkOff(s.editorId, [top.label, top.kid].filter(Boolean).join(" · ")).catch((e) => { console.error("[potty] linked to-dos:", e?.message); return 0; });
    return { told, checked };
  };
}
