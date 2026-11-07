// LifeHub and WorkHub share night mode, the theme and where the menu sits, until the person turns "Same settings in
// both hubs" off in Customize. Each hub saves its look in its layout on the account (with lookAt, when it was picked,
// and night), and this device keeps a copy so the other hub can use it at once. The newest choice wins: a theme picked
// on the phone shows on the computer, and a stale copy on one device no longer overrides the account (that kept the
// computer on Classic while the phone had Corkboard).

const SAME_KEY = "arise-same-both-hubs";
const NIGHT_KEY = "arise-night";
const LOOK_KEY = "arise-shared-look";
const OLD_NIGHT = { life: "arise-todo-night", work: "arise-hub-night" } as const;
export type Hub = keyof typeof OLD_NIGHT;
const LOOK_PARTS = ["theme", "menuSide", "deskSide", "menuClose"] as const;
type Look = Partial<Record<(typeof LOOK_PARTS)[number], string>> & { at?: string; night?: boolean };
export const SHARED_LOOK_EVENT = "arise:shared-look";

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* not kept */ } };
const readLocal = (): Look => { try { return JSON.parse(get(LOOK_KEY) || "{}") || {}; } catch { return {}; } };
const time = (s: unknown) => (typeof s === "string" ? Date.parse(s) || 0 : 0);

/** Whether the two hubs share these settings (yes, until the person says otherwise). */
export const sameBothHubs = () => get(SAME_KEY) !== "0";
export function setSameBothHubs(on: boolean) { set(SAME_KEY, on ? "1" : "0"); window.dispatchEvent(new Event(SHARED_LOOK_EVENT)); }

export function readNight(hub: Hub, oldKey: string = OLD_NIGHT[hub]): boolean {
  if (sameBothHubs()) { const v = get(NIGHT_KEY); if (v !== null) return v === "1"; }
  return get(oldKey) === "1";
}
export function writeNight(hub: Hub, on: boolean, oldKey: string = OLD_NIGHT[hub]) {
  set(oldKey, on ? "1" : "0");
  if (sameBothHubs()) { set(NIGHT_KEY, on ? "1" : "0"); set(OLD_NIGHT.life, on ? "1" : "0"); set(OLD_NIGHT.work, on ? "1" : "0"); }
  const l = readLocal(); set(LOOK_KEY, JSON.stringify({ ...l, night: on, at: new Date().toISOString() }));
  window.dispatchEvent(new Event(SHARED_LOOK_EVENT));
}

/**
 * A hub's layout with the newest look on top. When the account's layout is newer than this device's copy (picked on
 * another device), the account wins and this device's copy (and night mode) catch up; otherwise this device's copy
 * (picked in the other hub, or just now) is used.
 */
export function withSharedLook<T extends object>(layout: T, hub?: Hub): T {
  const l: any = layout;
  const local = readLocal();
  if (time(l.lookAt) > time(local.at)) {
    const look: Look = { at: l.lookAt };
    for (const k of LOOK_PARTS) if (typeof l[k] === "string") look[k] = l[k];
    if (typeof l.night === "boolean") { look.night = l.night; if (hub && readNight(hub) !== l.night) { const old = OLD_NIGHT[hub]; set(old, l.night ? "1" : "0"); if (sameBothHubs()) { set(NIGHT_KEY, l.night ? "1" : "0"); set(OLD_NIGHT.life, l.night ? "1" : "0"); set(OLD_NIGHT.work, l.night ? "1" : "0"); } setTimeout(() => window.dispatchEvent(new Event(SHARED_LOOK_EVENT)), 0); } }
    else if (typeof local.night === "boolean") look.night = local.night;
    set(LOOK_KEY, JSON.stringify(look));
    return layout;
  }
  if (!sameBothHubs()) return layout;
  const out: any = { ...layout };
  for (const k of LOOK_PARTS) if (typeof local[k] === "string" && k in out) out[k] = local[k];
  return out;
}
/** A layout about to be saved, stamped when its look changed (theme, menu) so it wins on every device; remembered here too. */
export function stampLook<T extends object>(prev: T, next: T): T {
  const a: any = prev, b: any = next;
  const changed = LOOK_PARTS.some((k) => a[k] !== b[k]);
  const out: any = changed ? { ...next, lookAt: new Date().toISOString() } : next;
  rememberLook(out);
  return out;
}
/** Night mode saved with the account's layout (so the other device follows). */
export const withNight = <T extends object>(layout: T, on: boolean): T => ({ ...layout, night: on, lookAt: new Date().toISOString() });
/** Remembers a hub's look for the other hub (when they're shared). */
export function rememberLook(layout: object) {
  const l: any = layout, local = readLocal();
  if (!sameBothHubs() && !l.lookAt) return;
  const look: Look = { ...local };
  for (const k of LOOK_PARTS) if (typeof l[k] === "string") look[k] = l[k];
  if (l.lookAt && time(l.lookAt) >= time(local.at)) look.at = l.lookAt;
  set(LOOK_KEY, JSON.stringify(look));
}
