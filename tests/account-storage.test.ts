import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

class FakeStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
}

test("each account keeps its own things on the device; the sign-in itself is shared", async () => {
  const g = globalThis as any;
  const store = new FakeStorage();
  let reloads = 0;
  g.Storage = FakeStorage;
  g.window = { localStorage: store, location: { reload: () => { reloads++; } } };
  store.setItem("arise-night", "1"); // there before the update
  store.setItem("arise_session_backup", "SIGNIN");
  const { installAccountStorage, setAccount } = await import("../client/src/lib/accountStorage");
  installAccountStorage({ accountKey: "arise-account", deviceWide: (k) => k === "arise_session_backup" });

  setAccount(7); // the first account after the update keeps what was there
  assert.equal(reloads, 1);
  assert.equal(store.getItem("arise-night"), "1");
  assert.equal(store.getItem("arise_session_backup"), "SIGNIN");
  store.setItem("podplus.studio", "seven's pods");

  setAccount(null); // sign out
  setAccount(9); // another account: none of 7's things
  assert.equal(reloads, 2);
  assert.equal(store.getItem("arise-night"), null);
  assert.equal(store.getItem("podplus.studio"), null);
  assert.equal(store.getItem("arise_session_backup"), "SIGNIN");
  store.setItem("podplus.studio", "nine's pods");

  setAccount(null); setAccount(7); // back to 7: its own things again
  assert.equal(store.getItem("podplus.studio"), "seven's pods");
  assert.equal(store.getItem("arise-night"), "1");
  setAccount(7); // same account again: no reload
  assert.equal(reloads, 3);
});

test("signing out forgets this iPhone's Apple push token for that account", () => {
  const push = readFileSync(new URL("../client/src/lib/applePush.ts", import.meta.url), "utf8");
  assert.match(push, /export async function forgetAppleDevice\(/, "pushDevice.ts imports it");
  assert.match(push, /localStorage\.setItem\(TOKEN_KEY, token\)/, "the token is kept for the device");
  assert.match(push, /\/api\/push\/apple\/forget/);
});
