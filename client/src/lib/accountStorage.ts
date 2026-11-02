// Each account keeps its own things on this device. Almost everything the apps remember on the phone
// (settings, layouts, Pod+ progress, Study Pods, reminders switches, drafts) is kept in the browser's
// storage (localStorage). Without this, signing into a second account on the same phone showed the
// first account's things. Now every key is kept under the signed-in account ("u:<account>:<key>"),
// except the few that belong to the device itself (the saved sign-in, which account is signed in).
//
// It works by wrapping localStorage's getItem/setItem/removeItem once, before anything else runs, so
// no other code has to change. Switching accounts reloads the page, so nothing from the last account
// stays in memory. The first account to sign in after this update keeps what was already on the device.

type Options = { accountKey: string; deviceWide: (key: string) => boolean };
type Raw = { get: (k: string) => string | null; set: (k: string, v: string) => void; remove: (k: string) => void; keys: () => string[] };

const PREFIX = "u:";
let state: { who: string; opts: Options; raw: Raw } | null = null;

/** Wraps localStorage so each account's keys are kept apart. Call once, first thing. */
export function installAccountStorage(opts: Options): void {
  if (state || typeof window === "undefined") return;
  let store: Storage;
  try { store = window.localStorage; } catch { return; } // storage is off: nothing to keep apart
  const proto = Storage.prototype;
  const get = proto.getItem, set = proto.setItem, remove = proto.removeItem, key = proto.key;
  const raw: Raw = {
    get: (k) => get.call(store, k),
    set: (k, v) => set.call(store, k, v),
    remove: (k) => remove.call(store, k),
    keys: () => { const out: string[] = []; for (let i = 0; i < store.length; i++) { const k = key.call(store, i); if (k != null) out.push(k); } return out; },
  };
  const deviceWide = (k: string) => k === opts.accountKey || k.startsWith(PREFIX) || opts.deviceWide(k);
  state = { who: raw.get(opts.accountKey) || "", opts: { ...opts, deviceWide }, raw };
  const ns = (k: string) => (state && state.who && !deviceWide(k) ? `${PREFIX}${state.who}:${k}` : k);
  proto.getItem = function (this: Storage, k: string) { return this === store ? get.call(this, ns(String(k))) : get.call(this, k); };
  proto.setItem = function (this: Storage, k: string, v: string) { return this === store ? set.call(this, ns(String(k)), v) : set.call(this, k, v); };
  proto.removeItem = function (this: Storage, k: string) { return this === store ? remove.call(this, ns(String(k))) : remove.call(this, k); };
}

/** The account signed in on this device ("" when no one). */
export const currentAccount = () => state?.who || "";

/** Says who is signed in now. A different account than before reloads the page, so it opens with its own things. */
export function setAccount(id: string | number | null | undefined): void {
  if (!state) return;
  const next = id == null ? "" : String(id).trim().toLowerCase().replace(/[^a-z0-9@._-]/g, "").slice(0, 120);
  if (next === state.who) return;
  const { raw, opts } = state;
  if (next) {
    // The first account to sign in after this update gets what was already kept on this device
    // (it was theirs: until now there was only one set of things).
    const moved = `${opts.accountKey}:moved`;
    if (!raw.get(moved)) {
      for (const k of raw.keys()) {
        if (opts.deviceWide(k) || k === moved) continue;
        const v = raw.get(k);
        if (v != null && raw.get(`${PREFIX}${next}:${k}`) == null) raw.set(`${PREFIX}${next}:${k}`, v);
        raw.remove(k);
      }
      raw.set(moved, "1");
    }
    raw.set(opts.accountKey, next);
  } else raw.remove(opts.accountKey);
  const was = state.who;
  state.who = next;
  // Signing out just stops using that account's things; signing in (as anyone) starts the page fresh.
  if (next && typeof window !== "undefined") { if (was !== next) window.location.reload(); }
}
