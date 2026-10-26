import { test } from "node:test";
import assert from "node:assert/strict";
import { accountForEmailSignIn, checkResetToken, resetPassword, sendRecovery, type RecoveryAccount, type RecoveryDeps } from "../server/accountRecovery";

const acct = (id: number, username: string, password: string, email = "parent@example.com"): RecoveryAccount => ({ id, username, displayName: `Name ${id}`, email, role: "parent", password });

function fakeDeps(accounts: RecoveryAccount[]) {
  const tokens = new Map<string, { userId: number; expiresAt: Date; usedAt: Date | null }>();
  const sent: { to: string; html: string }[] = [];
  const passwords = new Map<number, string>();
  const signedOut: number[] = [];
  let clock = 1_000_000;
  const deps: RecoveryDeps = {
    accountsByEmail: async (e) => accounts.filter((a) => a.email?.toLowerCase() === e.toLowerCase()),
    saveToken: async ({ tokenHash, userId, expiresAt }) => { tokens.set(tokenHash, { userId, expiresAt, usedAt: null }); },
    loadToken: async (h) => tokens.get(h) ?? null,
    useToken: async (h) => { const t = tokens.get(h); if (!t || t.usedAt) return false; t.usedAt = new Date(clock); return true; },
    getAccount: async (id) => accounts.find((a) => a.id === id) ?? null,
    setPassword: async (id, p) => { passwords.set(id, p); },
    signOutEverywhere: async (id) => { signedOut.push(id); },
    sendEmail: async (to, _s, html) => { sent.push({ to, html }); return { sent: true }; },
    siteUrl: "https://arisereader.com/",
    now: () => clock,
  };
  return { deps, sent, passwords, signedOut, tick: (ms: number) => { clock += ms; } };
}
const check = async (p: string, h: string) => p === h;
const tokenFrom = (html: string) => /token=([a-f0-9]{48})/.exec(html)![1];

test("signing in with an email picks the one account whose password fits", async () => {
  const { deps } = fakeDeps([acct(1, "raflaa", "pw-one"), acct(2, "raflaa82", "pw-two")]);
  const r = await accountForEmailSignIn(deps, "Parent@Example.com", "pw-two", check);
  assert.equal(r.account?.username, "raflaa82");
  assert.deepEqual(await accountForEmailSignIn(deps, "parent@example.com", "wrong", check), { account: null, reason: "none" });
  assert.deepEqual(await accountForEmailSignIn(deps, "nobody@example.com", "pw-one", check), { account: null, reason: "none" });
});

test("the same password on two accounts of one email is ambiguous, not a guess", async () => {
  const { deps } = fakeDeps([acct(1, "a", "same"), acct(2, "b", "same")]);
  assert.deepEqual(await accountForEmailSignIn(deps, "parent@example.com", "same", check), { account: null, reason: "ambiguous" });
});

test("one recovery email lists every username on the address with its own link", async () => {
  const { deps, sent } = fakeDeps([acct(1, "raflaa", "x"), acct(2, "raflaa82", "y")]);
  assert.deepEqual(await sendRecovery(deps, "parent@example.com"), { sentTo: 2 });
  assert.equal(sent.length, 1);
  assert.match(sent[0].html, /raflaa82/);
  assert.match(sent[0].html, /Username: raflaa</);
  assert.equal((sent[0].html.match(/reset-password\?token=/g) || []).length, 2);
  assert.match(sent[0].html, /https:\/\/arisereader\.com\/#\/reset-password\?token=/);
});

test("an unknown email sends nothing (and the route answers the same either way)", async () => {
  const { deps, sent } = fakeDeps([acct(1, "raflaa", "x")]);
  assert.deepEqual(await sendRecovery(deps, "someone@else.com"), { sentTo: 0 });
  assert.equal(sent.length, 0);
});

test("a reset link changes the password once, signs out everywhere, then stops working", async () => {
  const { deps, sent, passwords, signedOut } = fakeDeps([acct(1, "raflaa", "old")]);
  await sendRecovery(deps, "parent@example.com");
  const token = tokenFrom(sent[0].html);
  const checked = await checkResetToken(deps, token);
  assert.ok("account" in checked && checked.account.username === "raflaa");
  assert.deepEqual(await resetPassword(deps, token, "hashed-new"), { username: "raflaa" });
  assert.equal(passwords.get(1), "hashed-new");
  assert.deepEqual(signedOut, [1]);
  const again = await resetPassword(deps, token, "hashed-other");
  assert.ok("error" in again && /already used/.test(again.error));
  assert.equal(passwords.get(1), "hashed-new");
});

test("reset links expire after an hour and junk tokens are refused", async () => {
  const { deps, sent, tick } = fakeDeps([acct(1, "raflaa", "old")]);
  await sendRecovery(deps, "parent@example.com");
  tick(60 * 60_000 + 1);
  const r = await checkResetToken(deps, tokenFrom(sent[0].html));
  assert.ok("error" in r && /expired/.test(r.error));
  const junk = await checkResetToken(deps, "not-a-token");
  assert.ok("error" in junk);
  const unknown = await checkResetToken(deps, "a".repeat(48));
  assert.ok("error" in unknown && /isn't valid/.test(unknown.error));
});

test("usernames in the email are escaped", async () => {
  const { deps, sent } = fakeDeps([{ ...acct(1, "kid", "x"), displayName: "<b>Hi</b>" }]);
  await sendRecovery(deps, "parent@example.com");
  assert.ok(!sent[0].html.includes("<b>Hi</b>"));
});
