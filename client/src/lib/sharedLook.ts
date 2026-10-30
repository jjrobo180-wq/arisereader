// LifeHub and WorkHub start out the same (October 2026): night mode, the theme and where the menu
// sits are shared between the two hubs, until the person turns "Same settings in both hubs" off in
// Customize. Kept on this device; each hub still saves its own layout too, so turning the switch off
// keeps whatever each hub had last.

const SAME_KEY = "arise-same-both-hubs";
const NIGHT_KEY = "arise-night";
const LOOK_KEY = "arise-shared-look";
const OLD_NIGHT = { life: "arise-todo-night", work: "arise-hub-night" } as const;
export type Hub = keyof typeof OLD_NIGHT;
const LOOK_PARTS = ["theme", "menuSide", "deskSide", "menuClose"] as const;
type Look = Partial<Record<(typeof LOOK_PARTS)[number], string>>;
export const SHARED_LOOK_EVENT = "arise:shared-look";

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* not kept */ } };

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
  window.dispatchEvent(new Event(SHARED_LOOK_EVENT));
}

/** A hub's layout with the shared look on top (theme, where the menu sits, how it closes). */
export function withSharedLook<T extends object>(layout: T): T {
  if (!sameBothHubs()) return layout;
  let look: Look = {};
  try { look = JSON.parse(get(LOOK_KEY) || "{}") || {}; } catch { look = {}; }
  const out: any = { ...layout };
  for (const k of LOOK_PARTS) if (typeof look[k] === "string" && k in out) out[k] = look[k];
  return out;
}
/** Remembers a hub's look for the other hub (when they're shared). */
export function rememberLook(layout: object) {
  if (!sameBothHubs()) return;
  const l: any = layout, look: Look = {};
  for (const k of LOOK_PARTS) if (typeof l[k] === "string") look[k] = l[k];
  set(LOOK_KEY, JSON.stringify(look));
}
