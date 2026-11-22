// Arise To Duo ↔ Google (Classroom, Docs, Calendar, Gmail). The rules are in shared/googleConnect.ts.
//
// The Google sign-in stays here: the refresh token is kept encrypted in the settings table, one row per
// account, and the browser and the iPhone app only ever talk to these routes. Signing in happens in a real
// browser tab (Google refuses sign-in inside an app's web view), so the iPhone app opens Safari and checks
// again when it comes back to the front.
//
// Nothing works until the site owner adds GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (a Google Cloud
// project's OAuth client); until then every route says Google isn't set up yet.
import crypto from "node:crypto";
import type { Express, RequestHandler } from "express";
import {
  FEATURE_SCOPES, GOOGLE_FEATURES, calendarEvent, classroomItem, driveFile, driveQuery, eventForTask, featuresFromScopes,
  googleAuthUrl, mailItem, type ClassroomItem, type GoogleFeature,
} from "../shared/googleConnect";

export type GoogleDeps = {
  gate(req: any, res: any): Promise<unknown | null>;
  getSetting(key: string): Promise<string>;
  upsertSetting(key: string, value: string): Promise<void>;
  /** Server secret: signs the sign-in round trip and encrypts the saved Google sign-in. */
  key(): Buffer;
  clientId?: string;
  clientSecret?: string;
  /** Where Google sends people back to. Must be listed on the Google OAuth client exactly. */
  redirectUri: string;
  /** Where people land on the website afterwards. */
  siteUrl: string;
  fetch?: typeof fetch;
  now?: () => number;
};

type Saved = { refresh: string; access?: string; expiresAt?: number; scope: string; email: string };
export class GoogleError extends Error { constructor(message: string, public status = 400) { super(message); } }

const rowKey = (userId: number) => `google_connect_${userId}`;
const isFeature = (v: unknown): v is GoogleFeature => typeof v === "string" && (GOOGLE_FEATURES as readonly string[]).includes(v);

// ——— the sign-in round trip ———
const stateSig = (key: Buffer, body: string) => crypto.createHmac("sha256", key).update(`google-state:${body}`).digest("base64url").slice(0, 32);
/** userId.feature.expiresAt.app.returnTo, signed. */
export function makeState(key: Buffer, userId: number, feature: GoogleFeature, now: number, app: boolean, returnTo: string): string {
  const back = Buffer.from(safeReturn(returnTo)).toString("base64url");
  const body = `${userId}.${feature}.${now + 15 * 60_000}.${app ? 1 : 0}.${back}`;
  return `${body}.${stateSig(key, body)}`;
}
export function readState(key: Buffer, state: string, now: number): { userId: number; feature: GoogleFeature; app: boolean; returnTo: string } | null {
  const m = /^(\d{1,12})\.([a-zA-Z]{1,20})\.(\d{1,15})\.([01])\.([A-Za-z0-9_-]{0,400})\.([A-Za-z0-9_-]{32})$/.exec(String(state || ""));
  if (!m) return null;
  const body = `${m[1]}.${m[2]}.${m[3]}.${m[4]}.${m[5]}`;
  const want = Buffer.from(stateSig(key, body)), got = Buffer.from(m[6]);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  if (+m[3] < now || !isFeature(m[2])) return null;
  return { userId: +m[1], feature: m[2], app: m[4] === "1", returnTo: safeReturn(Buffer.from(m[5], "base64url").toString()) };
}
/** Only a path on our own site ("/to-do?tab=tasks"), never somewhere else. */
export const safeReturn = (p: string) => (/^\/(?!\/)[A-Za-z0-9/_\-?=&.%]*$/.test(String(p || "")) ? String(p).slice(0, 200) : "/");

// ——— the saved sign-in, encrypted ———
const cipherKey = (key: Buffer) => Buffer.from(crypto.hkdfSync("sha256", key, "arise-google", "google-connect-v1", 32));
export function seal(key: Buffer, data: Saved): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", cipherKey(key), iv);
  const body = Buffer.concat([c.update(JSON.stringify(data), "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${body.toString("base64url")}`;
}
export function unseal(key: Buffer, raw: string): Saved | null {
  const m = /^v1\.([^.]+)\.([^.]+)\.([^.]+)$/.exec(String(raw || ""));
  if (!m) return null;
  try {
    const d = crypto.createDecipheriv("aes-256-gcm", cipherKey(key), Buffer.from(m[1], "base64url"));
    d.setAuthTag(Buffer.from(m[2], "base64url"));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(m[3], "base64url")), d.final()]).toString("utf8"));
  } catch { return null; }
}

export function registerGoogleRoutes(app: Express, auth: RequestHandler, deps: GoogleDeps) {
  const f = deps.fetch || fetch;
  const now = () => (deps.now ? deps.now() : Date.now());
  const configured = () => !!(deps.clientId && deps.clientSecret);
  const load = async (userId: number) => unseal(deps.key(), await deps.getSetting(rowKey(userId)));
  const save = (userId: number, s: Saved | null) => deps.upsertSetting(rowKey(userId), s ? seal(deps.key(), s) : "");

  async function tokenCall(params: Record<string, string>) {
    const res = await f("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: deps.clientId!, client_secret: deps.clientSecret!, ...params }).toString() });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new GoogleError(data.error === "invalid_grant" ? "Google sign-in has expired. Connect again." : "Google didn't answer. Try again.", data.error === "invalid_grant" ? 401 : 502);
    return data;
  }

  /** A working access token for this account, refreshed when it's about to run out. */
  async function access(userId: number, need: GoogleFeature): Promise<{ token: string; saved: Saved }> {
    if (!configured()) throw new GoogleError("Google isn't set up on this site yet.", 503);
    const saved = await load(userId);
    if (!saved?.refresh) throw new GoogleError("Connect Google first.", 409);
    if (!FEATURE_SCOPES[need].every((s) => saved.scope.split(" ").includes(s))) throw new GoogleError("Connect this part of Google first.", 409);
    if (saved.access && (saved.expiresAt || 0) > now() + 60_000) return { token: saved.access, saved };
    try {
      const t = await tokenCall({ grant_type: "refresh_token", refresh_token: saved.refresh });
      const next = { ...saved, access: t.access_token, expiresAt: now() + (Number(t.expires_in) || 3600) * 1000, scope: t.scope || saved.scope };
      await save(userId, next);
      return { token: next.access!, saved: next };
    } catch (e) {
      if (e instanceof GoogleError && e.status === 401) await save(userId, null);
      throw e;
    }
  }

  /** A Google API call as this account. */
  async function google(userId: number, need: GoogleFeature, url: string, init: { method?: string; body?: unknown } = {}): Promise<any> {
    const { token } = await access(userId, need);
    const res = await f(url, { method: init.method || "GET", headers: { Authorization: `Bearer ${token}`, ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: init.body !== undefined ? JSON.stringify(init.body) : undefined });
    if (res.status === 204) return {};
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String(data?.error?.message || "");
      if (res.status === 403 && /has not been used|is disabled/i.test(msg)) throw new GoogleError("That Google service isn't turned on in the site's Google Cloud project yet.", 503);
      if (res.status === 403) throw new GoogleError("Google says this account can't do that (a school account may block it).", 403);
      if (res.status === 404) throw new GoogleError("Google couldn't find that.", 404);
      throw new GoogleError("Google didn't answer. Try again.", 502);
    }
    return data;
  }

  const route = (handler: (req: any, res: any, userId: number) => Promise<unknown>) => async (req: any, res: any) => {
    try {
      if (!(await deps.gate(req, res))) return;
      const userId = Number(req.user?.id);
      const out = await handler(req, res, userId);
      if (out !== undefined && !res.headersSent) res.json(out);
    } catch (e: any) {
      if (res.headersSent) return;
      if (e instanceof GoogleError) return res.status(e.status).json({ message: e.message, ...(e.status === 409 || e.status === 401 ? { reconnect: true } : {}) });
      console.error("[google]", e?.message);
      res.status(500).json({ message: "Something went wrong with Google. Try again." });
    }
  };

  // ——— connecting ———
  app.get("/api/google/status", auth, route(async (_req, res, userId) => {
    res.set("Cache-Control", "no-store");
    if (!configured()) return { configured: false, connected: false, email: "", features: [] };
    const saved = await load(userId);
    return { configured: true, connected: !!saved?.refresh, email: saved?.email || "", features: saved ? featuresFromScopes(saved.scope) : [] };
  }));

  app.post("/api/google/connect", auth, route(async (req, _res, userId) => {
    if (!configured()) throw new GoogleError("Google isn't set up on this site yet. The site owner adds it in Render (see the setup steps).", 503);
    const feature = req.body?.feature;
    if (!isFeature(feature)) throw new GoogleError("Pick what to connect.");
    const state = makeState(deps.key(), userId, feature, now(), !!req.body?.app, String(req.body?.returnTo || "/"));
    return { url: googleAuthUrl({ clientId: deps.clientId!, redirectUri: deps.redirectUri, feature, state, email: String(req.user?.email || "") || undefined }) };
  }));

  // Google sends the person back here with a one-time code. No sign-in on this request (it comes from
  // Google's page): the signed state says which account asked.
  app.get("/api/google/callback", async (req: any, res) => {
    const page = (title: string, text: string, link?: string) => res.status(200).type("html").send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:-apple-system,system-ui,sans-serif;max-width:28rem;margin:15vh auto;padding:0 1.5rem;text-align:center;color:#1f2430"><h1 style="font-size:1.5rem">${title}</h1><p style="font-size:1.05rem;line-height:1.5">${text}</p>${link ? `<p><a href="${link}" style="display:inline-block;margin-top:1rem;padding:.8rem 1.4rem;border-radius:999px;background:#1f2430;color:#fff;text-decoration:none;font-weight:600">Back to Arise To Duo</a></p>` : ""}</body>`);
    const state = readState(deps.key(), String(req.query.state || ""), now());
    if (!state) return page("That link expired", "Go back to Arise To Duo and tap Connect again.");
    const back = `${deps.siteUrl.replace(/\/$/, "")}${state.returnTo}`;
    if (req.query.error) return page("Not connected", "Google wasn't connected. You can try again any time from Arise To Duo.", state.app ? undefined : back);
    try {
      const t = await tokenCall({ grant_type: "authorization_code", code: String(req.query.code || ""), redirect_uri: deps.redirectUri });
      const old = await load(state.userId);
      let email = old?.email || "";
      if (t.id_token) { try { email = JSON.parse(Buffer.from(String(t.id_token).split(".")[1], "base64url").toString()).email || email; } catch { /* keep */ } }
      const refresh = t.refresh_token || old?.refresh;
      if (!refresh) return page("Almost", "Google didn't send a lasting sign-in. Go back to Arise To Duo and tap Connect again.");
      await save(state.userId, { refresh, access: t.access_token, expiresAt: now() + (Number(t.expires_in) || 3600) * 1000, scope: String(t.scope || ""), email });
      if (state.app) return page("Connected", "Google is connected. Go back to the Arise To Duo app; it picks this up as soon as you're back.");
      return res.redirect(302, `${back}${back.includes("?") ? "&" : "?"}google=connected`);
    } catch (e: any) {
      return page("Not connected", e instanceof GoogleError ? e.message : "Google didn't answer. Try again.", state.app ? undefined : back);
    }
  });

  app.post("/api/google/disconnect", auth, route(async (_req, _res, userId) => {
    const saved = await load(userId);
    if (saved?.refresh) await f(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(saved.refresh)}`, { method: "POST" }).catch(() => null);
    await save(userId, null);
    return { ok: true };
  }));

  // ——— Classroom ———
  const C = "https://classroom.googleapis.com/v1";
  async function courses(userId: number, role: "studentId" | "teacherId") {
    const data = await google(userId, "classroom", `${C}/courses?${role}=me&courseStates=ACTIVE&pageSize=40`);
    return (data.courses || []).map((c: any) => ({ id: String(c.id), name: String(c.name || "Class"), section: String(c.section || ""), link: String(c.alternateLink || "") }));
  }

  app.get("/api/google/classroom/assignments", auth, route(async (_req, _res, userId) => {
    const [asStudent, asTeacher] = await Promise.all([courses(userId, "studentId"), courses(userId, "teacherId")]);
    const items: ClassroomItem[] = [];
    for (const course of asStudent.slice(0, 15)) {
      const [work, subs] = await Promise.all([
        google(userId, "classroom", `${C}/courses/${course.id}/courseWork?pageSize=40&courseWorkStates=PUBLISHED`),
        google(userId, "classroom", `${C}/courses/${course.id}/courseWork/-/studentSubmissions?userId=me&pageSize=100`),
      ]);
      const byWork = new Map<string, any>((subs.studentSubmissions || []).map((s: any) => [String(s.courseWorkId), s]));
      for (const w of work.courseWork || []) { const item = classroomItem(course, w, byWork.get(String(w.id))); if (item) items.push(item); }
    }
    return { items, studentClasses: asStudent, teacherClasses: asTeacher };
  }));

  app.get("/api/google/classroom/courses/:id/students", auth, route(async (req, _res, userId) => {
    const id = String(req.params.id).replace(/[^0-9A-Za-z_-]/g, "");
    const data = await google(userId, "classroom", `${C}/courses/${id}/students?pageSize=100`);
    return { students: (data.students || []).map((s: any) => ({ id: String(s.userId), name: String(s.profile?.name?.fullName || "Student") })).sort((a: any, b: any) => a.name.localeCompare(b.name)) };
  }));

  app.post("/api/google/classroom/courses/:id/post", auth, route(async (req, _res, userId) => {
    const id = String(req.params.id).replace(/[^0-9A-Za-z_-]/g, "");
    const kind = req.body?.kind === "assignment" ? "assignment" : "announcement";
    const text = String(req.body?.text || "").trim().slice(0, 5000);
    if (kind === "announcement") {
      if (!text) throw new GoogleError("Write the announcement first.");
      const a = await google(userId, "classroomPost", `${C}/courses/${id}/announcements`, { method: "POST", body: { text, state: "PUBLISHED" } });
      return { link: String(a.alternateLink || "") };
    }
    const title = String(req.body?.title || "").trim().slice(0, 300);
    if (!title) throw new GoogleError("Give the assignment a title.");
    const body: any = { title, description: text || undefined, workType: "ASSIGNMENT", state: "PUBLISHED" };
    const due = String(req.body?.dueAt || "");
    if (due) {
      const d = new Date(due);
      if (!Number.isFinite(d.getTime())) throw new GoogleError("That due date doesn't look right.");
      body.dueDate = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
      body.dueTime = { hours: d.getUTCHours(), minutes: d.getUTCMinutes() };
    }
    const w = await google(userId, "classroomPost", `${C}/courses/${id}/courseWork`, { method: "POST", body });
    return { link: String(w.alternateLink || "") };
  }));

  // ——— Docs and Drive ———
  app.get("/api/google/drive/files", auth, route(async (req, _res, userId) => {
    const q = encodeURIComponent(driveQuery(String(req.query.q || "")));
    const data = await google(userId, "docs", `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime%20desc&pageSize=25&fields=files(id,name,mimeType,webViewLink,modifiedTime)`);
    return { files: (data.files || []).map(driveFile) };
  }));

  app.post("/api/google/docs/create", auth, route(async (req, _res, userId) => {
    const title = String(req.body?.title || "").trim().slice(0, 200) || "Untitled";
    const doc = await google(userId, "docs", "https://docs.googleapis.com/v1/documents", { method: "POST", body: { title } });
    const text = String(req.body?.text || "").trim().slice(0, 20000);
    if (text) await google(userId, "docs", `https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, { method: "POST", body: { requests: [{ insertText: { location: { index: 1 }, text } }] } });
    return { file: { id: String(doc.documentId), name: title, kind: "doc", link: `https://docs.google.com/document/d/${doc.documentId}/edit`, modified: new Date(now()).toISOString() } };
  }));

  const docId = (raw: string) => { const id = String(raw || ""); if (!/^[A-Za-z0-9_-]{10,100}$/.test(id)) throw new GoogleError("That isn't a Google Doc."); return id; };

  app.get("/api/google/docs/:id/text", auth, route(async (req, _res, userId) => {
    const doc = await google(userId, "docs", `https://docs.googleapis.com/v1/documents/${docId(req.params.id)}`);
    const text = (doc.body?.content || []).flatMap((b: any) => (b.paragraph?.elements || []).map((e: any) => e.textRun?.content || "")).join("");
    return { title: String(doc.title || ""), text: text.slice(0, 100_000) };
  }));

  app.post("/api/google/docs/:id/append", auth, route(async (req, _res, userId) => {
    const id = docId(req.params.id);
    const text = String(req.body?.text || "").trim().slice(0, 20000);
    if (!text) throw new GoogleError("Write something to add.");
    const doc = await google(userId, "docs", `https://docs.googleapis.com/v1/documents/${id}`);
    const end = Math.max(1, Number(doc.body?.content?.at(-1)?.endIndex || 2) - 1);
    await google(userId, "docs", `https://docs.googleapis.com/v1/documents/${id}:batchUpdate`, { method: "POST", body: { requests: [{ insertText: { location: { index: end }, text: `\n${text}` } }] } });
    return { ok: true };
  }));

  // ——— Calendar ———
  app.get("/api/google/calendar/events", auth, route(async (_req, _res, userId) => {
    const from = new Date(now()).toISOString(), to = new Date(now() + 30 * 86_400_000).toISOString();
    const data = await google(userId, "calendar", `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=50&timeMin=${encodeURIComponent(from)}&timeMax=${encodeURIComponent(to)}`);
    return { events: (data.items || []).filter((e: any) => e.status !== "cancelled").map(calendarEvent) };
  }));

  app.post("/api/google/calendar/events", auth, route(async (req, _res, userId) => {
    const tz = /^[A-Za-z_]+(\/[A-Za-z_+-]+){0,2}$/.test(String(req.body?.timeZone || "")) ? String(req.body.timeZone) : "UTC";
    const title = String(req.body?.title || "").trim().slice(0, 200);
    if (!title) throw new GoogleError("The to-do needs a title.");
    let event;
    try { event = eventForTask({ title, dueDate: String(req.body?.dueDate || ""), dueTime: String(req.body?.dueTime || "") || undefined, notes: String(req.body?.notes || "") || undefined }, tz); }
    catch (e: any) { throw new GoogleError(e.message); }
    const made = await google(userId, "calendar", "https://www.googleapis.com/calendar/v3/calendars/primary/events", { method: "POST", body: event });
    return { link: String(made.htmlLink || "") };
  }));

  // ——— Gmail ———
  app.get("/api/google/gmail/recent", auth, route(async (req, _res, userId) => {
    const q = String(req.query.q || "").trim().slice(0, 100);
    const list = await google(userId, "gmail", `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&labelIds=INBOX${q ? `&q=${encodeURIComponent(q)}` : ""}`);
    const ids: string[] = (list.messages || []).map((m: any) => String(m.id)).slice(0, 15);
    const full = await Promise.all(ids.map((id) => google(userId, "gmail", `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`)));
    return { mail: full.map(mailItem) };
  }));
}
