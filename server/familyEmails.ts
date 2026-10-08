// Sends the automatic family emails (shared/familyEmails.ts): the weekly progress update and the
// "time to read" nudge. A timer checks every few minutes; nothing goes out unless the admin has turned
// them on. Every email has a "stop these emails" link that needs no sign-in.
import type { Express } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  FAMILY_EMAIL_OPTOUT_KEY, FAMILY_EMAIL_SETTINGS_KEY, FAMILY_EMAIL_STATE_KEY, SAMPLE_CHILD, SENDS_PER_PASS, WEEKDAYS,
  cleanFamilyEmailSettings, hourText, needsNudge, nudgeDue, pairKey, readFamilyEmailState, readOptOuts, readingNudgeEmail, schoolClock, weeklyDue, weeklyProgressEmail,
  type ChildProgress, type FamilyEmailState,
} from "../shared/familyEmails";
import { emailDocument } from "./emailFormat";

export type Family = { parentId: number; parentName: string; email: string; children: { id: number; name: string }[] };

export type FamilyEmailDeps = {
  getSetting(key: string): Promise<string | null | undefined>;
  saveSetting(key: string, value: string): Promise<unknown>;
  /** Parents with an email address and the current students they are connected to. */
  families(): Promise<Family[]>;
  /** Each child's reading, for the emails. */
  progress(children: { id: number; name: string }[], nowMs: number): Promise<Map<number, ChildProgress>>;
  /** The prize and competition lines to mention right now. */
  prizes(nowMs: number): Promise<string[]>;
  emailConfigured(): boolean;
  sendEmail(to: string, subject: string, html: string): Promise<{ sent: boolean; error?: string }>;
  siteUrl: string;
  /** Signs the "stop these emails" links. */
  signKey: Buffer | string;
  now(): number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── The "stop these emails" link ──────────────────────────────────────────

const mac = (key: Buffer | string, parentId: number) => createHmac("sha256", key).update(`family-email-stop:${parentId}`).digest("base64url").slice(0, 32);
/** A link token for one parent. It never runs out, so an old email's link still works. */
export const stopToken = (key: Buffer | string, parentId: number) => `${parentId}.${mac(key, parentId)}`;
export function readStopToken(key: Buffer | string, token: unknown): number | null {
  const m = /^(\d{1,12})\.([A-Za-z0-9_-]{32})$/.exec(String(token ?? ""));
  if (!m) return null;
  const id = Number(m[1]);
  const want = Buffer.from(mac(key, id)), got = Buffer.from(m[2]);
  return want.length === got.length && timingSafeEqual(want, got) ? id : null;
}
export const stopUrl = (deps: Pick<FamilyEmailDeps, "siteUrl" | "signKey">, parentId: number) => `${deps.siteUrl.replace(/\/+$/, "")}/api/family-emails/stop?t=${encodeURIComponent(stopToken(deps.signKey, parentId))}`;

// ─── One pass of the timer ─────────────────────────────────────────────────

export type PassResult = { weekly: number; nudges: number; failed: number; skipped?: string };

/** Old records are dropped so the saved state stays small. */
function prune(state: FamilyEmailState, nowMs: number, today: string): FamilyEmailState {
  const cutoff = new Date(nowMs - 60 * DAY_MS).toISOString().slice(0, 10);
  const weekly = Object.fromEntries(Object.entries(state.weekly).filter(([, day]) => day >= cutoff || day === today));
  const nudge = Object.fromEntries(Object.entries(state.nudge).filter(([, at]) => nowMs - at < 30 * DAY_MS));
  return { ...state, weekly, nudge };
}

/**
 * Sends what is due right now: the weekly updates on their day and hour, and nudges for children who
 * haven't passed a quiz in a while. Each email is noted as sent before it goes out, so a restart can't
 * send it twice; one that fails is un-noted, to try again on a later pass.
 */
export async function runFamilyEmails(deps: FamilyEmailDeps): Promise<PassResult> {
  const settings = cleanFamilyEmailSettings(await deps.getSetting(FAMILY_EMAIL_SETTINGS_KEY));
  if (!settings.enabled) return { weekly: 0, nudges: 0, failed: 0, skipped: "off" };
  if (!deps.emailConfigured()) return { weekly: 0, nudges: 0, failed: 0, skipped: "email not set up" };
  const now = deps.now();
  const doWeekly = weeklyDue(settings, now), doNudge = nudgeDue(settings, now);
  if (!doWeekly && !doNudge) return { weekly: 0, nudges: 0, failed: 0, skipped: "not time" };

  const today = schoolClock(now).day;
  let state = readFamilyEmailState(await deps.getSetting(FAMILY_EMAIL_STATE_KEY));
  const optedOut = new Set(readOptOuts(await deps.getSetting(FAMILY_EMAIL_OPTOUT_KEY)));
  const families = (await deps.families()).filter((f) => !optedOut.has(f.parentId) && f.email && f.children.length);
  const pairs = families.flatMap((f) => f.children.map((c) => ({ f, c, key: pairKey(f.parentId, c.id) })));
  // Only what is due is looked up and sent.
  const weeklyPairs = doWeekly ? pairs.filter((p) => state.weekly[p.key] !== today) : [];
  const nudgeCandidates = doNudge ? pairs.filter((p) => !(state.nudge[p.key] && now - state.nudge[p.key] < 7 * DAY_MS)) : [];
  if (!weeklyPairs.length && !nudgeCandidates.length) return { weekly: 0, nudges: 0, failed: 0, skipped: "nothing due" };

  const kids = Array.from(new Map([...weeklyPairs, ...nudgeCandidates].map((p) => [p.c.id, p.c])).values());
  const progress = await deps.progress(kids, now);
  const prizes = settings.competitions ? await deps.prizes(now) : [];
  const week = Math.floor(now / (7 * DAY_MS));

  type Job = { to: string; subject: string; html: string; key: string; kind: "weekly" | "nudge" };
  const jobs: Job[] = [];
  for (const p of weeklyPairs) {
    const child = progress.get(p.c.id);
    if (!child || jobs.length >= SENDS_PER_PASS) continue;
    const mail = weeklyProgressEmail(child, { siteUrl: deps.siteUrl, stopUrl: stopUrl(deps, p.f.parentId), prizes, seed: week + p.c.id });
    jobs.push({ to: p.f.email, ...mail, key: p.key, kind: "weekly" });
  }
  for (const p of nudgeCandidates) {
    const child = progress.get(p.c.id);
    if (!child || jobs.length >= SENDS_PER_PASS || !needsNudge(child, settings, now, state.nudge[p.key] ?? null)) continue;
    const mail = readingNudgeEmail(child, { siteUrl: deps.siteUrl, stopUrl: stopUrl(deps, p.f.parentId), prizes, seed: week + p.c.id, nowMs: now });
    jobs.push({ to: p.f.email, ...mail, key: p.key, kind: "nudge" });
  }
  if (!jobs.length) return { weekly: 0, nudges: 0, failed: 0, skipped: "nothing due" };

  // Note them all as sent first, then send.
  for (const j of jobs) { if (j.kind === "weekly") state.weekly[j.key] = today; else state.nudge[j.key] = now; }
  state = prune(state, now, today);
  await deps.saveSetting(FAMILY_EMAIL_STATE_KEY, JSON.stringify(state));

  const result: PassResult = { weekly: 0, nudges: 0, failed: 0 };
  const failed: Job[] = [];
  for (const j of jobs) {
    let ok = false;
    try { ok = (await deps.sendEmail(j.to, j.subject, j.html)).sent; } catch { ok = false; }
    if (ok) result[j.kind === "weekly" ? "weekly" : "nudges"]++;
    else { result.failed++; failed.push(j); }
  }
  // Read again, so anything another pass saved meanwhile is kept, then un-note the failures and record the pass.
  const fresh = readFamilyEmailState(await deps.getSetting(FAMILY_EMAIL_STATE_KEY));
  for (const j of failed) { if (j.kind === "weekly") delete fresh.weekly[j.key]; else delete fresh.nudge[j.key]; }
  fresh.lastRun = { at: now, weekly: result.weekly, nudges: result.nudges, failed: result.failed, ...(failed.length ? { note: "Some emails could not be sent and will be tried again." } : {}) };
  await deps.saveSetting(FAMILY_EMAIL_STATE_KEY, JSON.stringify(fresh));
  return result;
}

/** Checks every few minutes. One pass at a time. */
export function startFamilyEmailTimer(deps: FamilyEmailDeps, everyMs = 10 * 60_000): () => void {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const r = await runFamilyEmails(deps);
      if (r.weekly || r.nudges || r.failed) console.log(`[family-email] sent ${r.weekly} weekly, ${r.nudges} nudges, ${r.failed} failed`);
    } catch (error: any) {
      console.error("[family-email] pass failed:", error?.message);
    } finally { busy = false; }
  };
  const timer = setInterval(() => void tick(), everyMs);
  (timer as any).unref?.();
  const first = setTimeout(() => void tick(), 60_000);
  (first as any).unref?.();
  return () => { clearInterval(timer); clearTimeout(first); };
}

// ─── The admin's screen ────────────────────────────────────────────────────

type Sender = { id: number; isAdmin?: boolean; email?: string | null };
type Reply = { status: number; body: Record<string, unknown> };
const no = (status: number, message: string): Reply => ({ status, body: { message } });

/** Everything the admin's screen shows: the settings, who would get the emails, and what the last pass did. */
export async function familyEmailOverview(deps: FamilyEmailDeps, sender: Sender): Promise<Reply> {
  if (!sender.isAdmin) return no(403, "Admin access required.");
  const settings = cleanFamilyEmailSettings(await deps.getSetting(FAMILY_EMAIL_SETTINGS_KEY));
  const state = readFamilyEmailState(await deps.getSetting(FAMILY_EMAIL_STATE_KEY));
  const optedOut = new Set(readOptOuts(await deps.getSetting(FAMILY_EMAIL_OPTOUT_KEY)));
  const families = await deps.families();
  const getting = families.filter((f) => !optedOut.has(f.parentId) && f.children.length);
  const children = Array.from(new Map(families.flatMap((f) => f.children).map((c) => [c.id, c])).values()).sort((a, b) => a.name.localeCompare(b.name));
  return {
    status: 200,
    body: {
      settings,
      emailReady: deps.emailConfigured(),
      counts: { parents: getting.length, children: new Set(getting.flatMap((f) => f.children.map((c) => c.id))).size, stopped: families.filter((f) => optedOut.has(f.parentId)).length },
      schedule: { weekly: `${WEEKDAYS[settings.weekly.day]}s from ${hourText(settings.weekly.hour)}`, nudge: `after ${settings.nudge.afterDays} days without a passed quiz, from ${hourText(settings.nudge.hour)}` },
      lastRun: state.lastRun || null,
      children,
    },
  };
}

export async function saveFamilyEmailSettings(deps: FamilyEmailDeps, sender: Sender, input: unknown): Promise<Reply> {
  if (!sender.isAdmin) return no(403, "Admin access required.");
  const settings = cleanFamilyEmailSettings(input);
  await deps.saveSetting(FAMILY_EMAIL_SETTINGS_KEY, JSON.stringify(settings));
  const overview = await familyEmailOverview(deps, sender);
  return { status: 200, body: { ...overview.body, message: settings.enabled ? "Saved. Automatic emails are on." : "Saved. Automatic emails are off." } };
}

/** A preview of either email, for a real child (or a made-up one). With `sendToMe`, it is emailed to the admin. */
export async function previewFamilyEmail(deps: FamilyEmailDeps, sender: Sender & { email?: string | null }, input: { kind?: unknown; childId?: unknown; sendToMe?: unknown }): Promise<Reply> {
  if (!sender.isAdmin) return no(403, "Admin access required.");
  const kind = input?.kind === "nudge" ? "nudge" : "weekly";
  const now = deps.now();
  const settings = cleanFamilyEmailSettings(await deps.getSetting(FAMILY_EMAIL_SETTINGS_KEY));
  let child: ChildProgress = SAMPLE_CHILD;
  const id = Number(input?.childId);
  if (Number.isSafeInteger(id) && id > 0) {
    const known = (await deps.families()).flatMap((f) => f.children).find((c) => c.id === id);
    if (!known) return no(404, "That student has no parent connected, so they get no family emails.");
    child = (await deps.progress([known], now)).get(id) || { ...SAMPLE_CHILD, childId: id, name: known.name };
  }
  const prizes = settings.competitions ? await deps.prizes(now) : [];
  const parts = { siteUrl: deps.siteUrl, stopUrl: `${deps.siteUrl.replace(/\/+$/, "")}/#/`, prizes, seed: Math.floor(now / (7 * DAY_MS)) + child.childId };
  const mail = kind === "nudge" ? readingNudgeEmail(child, { ...parts, nowMs: now }) : weeklyProgressEmail(child, parts);
  let message = "";
  if (input?.sendToMe === true) {
    const to = String(sender.email || "").trim();
    if (!to) return no(400, "Your admin account has no email address to send the preview to.");
    if (!deps.emailConfigured()) return no(503, "Email isn't set up on the site yet.");
    const sent = await deps.sendEmail(to, `[Preview] ${mail.subject}`, mail.html);
    if (!sent.sent) return no(503, "The preview could not be sent just now. Please try again.");
    message = `Preview sent to ${to}.`;
  }
  return { status: 200, body: { subject: mail.subject, html: emailDocument(mail.subject, mail.html, deps.siteUrl), ...(message ? { message } : {}) } };
}

// ─── The stop link's page ──────────────────────────────────────────────────

const page = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:24px 16px;background:#0b0a16;color:#f8fafc;font-family:Arial,Helvetica,sans-serif;"><div style="max-width:520px;margin:40px auto;background:#151326;border-radius:20px;padding:28px;">
<h1 style="margin:0 0 12px;font-size:22px;color:#c4b5fd;">A.R.I.S.E. Reader</h1>${body}</div></body></html>`;
const button = (token: string, action: "stop" | "resume", label: string) => `<form method="post" action="/api/family-emails/${action}"><input type="hidden" name="t" value="${token.replace(/[^\w.-]/g, "")}"><button type="submit" style="margin-top:8px;min-height:44px;padding:10px 18px;border:0;border-radius:12px;background:#7c3aed;color:#fff;font-size:16px;font-weight:bold;cursor:pointer;">${label}</button></form>`;

export async function setStopped(deps: FamilyEmailDeps, token: unknown, stop: boolean): Promise<{ status: number; html: string }> {
  const parentId = readStopToken(deps.signKey, token);
  if (!parentId) return { status: 400, html: page("Link not recognized", `<p style="line-height:1.6;color:#cbd5e1;">This link isn't recognized. Please use the link from your most recent email.</p>`) };
  const list = new Set(readOptOuts(await deps.getSetting(FAMILY_EMAIL_OPTOUT_KEY)));
  if (stop) list.add(parentId); else list.delete(parentId);
  await deps.saveSetting(FAMILY_EMAIL_OPTOUT_KEY, JSON.stringify({ parentIds: Array.from(list) }));
  const t = String(token);
  return stop
    ? { status: 200, html: page("Emails stopped", `<p style="line-height:1.6;color:#cbd5e1;">Done. You won't get progress updates or reading reminders anymore.</p><p style="line-height:1.6;color:#94a3b8;">Changed your mind?</p>${button(t, "resume", "Turn them back on")}`) }
    : { status: 200, html: page("Emails back on", `<p style="line-height:1.6;color:#cbd5e1;">You're all set. Progress updates and reading reminders will come again.</p>`) };
}

export function registerFamilyEmailRoutes(app: Express, auth: any, deps: FamilyEmailDeps, options: { startTimer?: boolean } = {}): void {
  const send = (res: any, reply: Reply) => res.set("Cache-Control", "no-store").status(reply.status).json(reply.body);
  const guard = (fn: (req: any) => Promise<Reply>) => async (req: any, res: any) => {
    try { send(res, await fn(req)); } catch (error: any) {
      console.error("[family-email] request failed:", error?.message);
      res.status(500).json({ message: "That did not work. Please try again." });
    }
  };
  app.get("/api/admin/family-emails", auth, guard((req) => familyEmailOverview(deps, req.user)));
  app.put("/api/admin/family-emails", auth, guard((req) => saveFamilyEmailSettings(deps, req.user, req.body || {})));
  app.post("/api/admin/family-emails/preview", auth, guard((req) => previewFamilyEmail(deps, req.user, req.body || {})));

  // The link in the email opens a page with a button, so a mail app that checks links can't stop the emails by itself.
  app.get("/api/family-emails/stop", (req: any, res: any) => {
    const t = String(req.query?.t || "");
    if (!readStopToken(deps.signKey, t)) return res.status(400).type("html").send(page("Link not recognized", `<p style="line-height:1.6;color:#cbd5e1;">This link isn't recognized. Please use the link from your most recent email.</p>`));
    res.type("html").send(page("Stop these emails?", `<p style="line-height:1.6;color:#cbd5e1;">Stop the weekly progress updates and reading reminders from A.R.I.S.E. Reader?</p>${button(t, "stop", "Stop these emails")}`));
  });
  const formToken = (req: any) => String(req.body?.t || req.query?.t || "");
  app.post("/api/family-emails/stop", async (req: any, res: any) => {
    try { const r = await setStopped(deps, formToken(req), true); res.status(r.status).type("html").send(r.html); }
    catch { res.status(500).type("html").send(page("Something went wrong", `<p>Please try again in a minute.</p>`)); }
  });
  app.post("/api/family-emails/resume", async (req: any, res: any) => {
    try { const r = await setStopped(deps, formToken(req), false); res.status(r.status).type("html").send(r.html); }
    catch { res.status(500).type("html").send(page("Something went wrong", `<p>Please try again in a minute.</p>`)); }
  });
  if (options.startTimer !== false) startFamilyEmailTimer(deps);
}
