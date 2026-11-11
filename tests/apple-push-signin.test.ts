// The iPhone app registers for server notifications with apiRequest. The server only accepts a Bearer
// token, so apiRequest must carry the sign-in: without it every registration was answered 401 and no
// iPhone ever got an alert from another person (Accountability showed "No device" for everyone).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f: string) => readFileSync(f, "utf8");

test("apiRequest sends the signed-in account's token", async () => {
  const g = globalThis as any;
  const calls: any[] = [];
  g.fetch = async (url: string, init: any) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({}) }; };
  const session = Buffer.from(JSON.stringify({ user: { id: 7 }, token: "saved-token" })).toString("base64");
  g.document = { cookie: "" };
  g.window = { localStorage: { getItem: (k: string) => (k === "arise_session_backup" ? session : null) } };
  g.atob = (s: string) => Buffer.from(s, "base64").toString("binary");
  const { apiRequest, setApiAuthToken } = await import("../client/src/lib/queryClient");
  await apiRequest("POST", "/api/push/apple", { token: "abc" });
  assert.equal(calls[0].init.headers.Authorization, "Bearer saved-token", "before AuthContext is up, the sign-in kept on the device is used");
  setApiAuthToken("live-token");
  await apiRequest("POST", "/api/push/apple", { token: "abc" });
  assert.equal(calls[1].init.headers.Authorization, "Bearer live-token");
  setApiAuthToken(null); g.window.localStorage.getItem = () => null;
  await apiRequest("GET", "/api/x");
  assert.equal(calls[2].init.headers.Authorization, undefined, "signed out: no header");
});

test("the iPhone signs up again once someone signs in, and the screens say when it isn't connected", () => {
  const auth = read("client/src/context/AuthContext.tsx");
  assert.match(auth, /setApiAuthToken\(isSampleMode\(\) \? null : token\)/);
  assert.match(auth, /m\.syncApplePush\(\)/);
  assert.match(read("client/src/lib/applePush.ts"), /export async function syncApplePush/);
  const panel = read("client/src/components/NativeRemindersPanel.tsx");
  assert.match(panel, /native-push-retry/, "a button to connect when the server doesn't have this iPhone");
  assert.match(panel, /arise:push-linked/);
  const acct = read("client/src/components/family-hub/Accountability.tsx");
  assert.match(acct, /acct-connect-me/, "the row for You has a Connect button, not a dead end");
  assert.doesNotMatch(acct, /p\.userId === me \? "Not on yet\. Turn it on above\."/);
});
