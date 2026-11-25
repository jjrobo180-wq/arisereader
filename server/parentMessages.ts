// Emails to parents from the admin (Nov 25, 2026): pick who gets it (every parent, the parents at a school, or
// chosen ones), have the AI write a draft from a sentence or two, edit it, send yourself a test, then send. Each
// parent gets their own copy ({first_name} and {child_names} filled in), never a shared list of addresses.
import type { Express } from "express";
import { renderParentEmail, fillParentEmail, cleanDraft, type ParentRecipient } from "../shared/parentMessages";

type Deps = {
  auth: (req: any, res: any, next: any) => void;
  admin: (req: any, res: any, next: any) => void;
  /** Every current parent with an email, with their children and schools. */
  parents: () => Promise<ParentRecipient[]>;
  schools: () => Promise<Array<{ id: number; name: string }>>;
  sendEmail: (to: string, subject: string, html: string) => Promise<{ sent: boolean; error?: string }>;
  /** The last messages sent, for the admin's history. */
  readLog: () => Promise<string>;
  saveLog: (json: string) => Promise<void>;
  ask?: (system: string, user: string) => Promise<string>;
};

const openAiJson = async (system: string, user: string) => {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4.1-mini", temperature: 0.6, max_tokens: 1200, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(res.status === 429 ? "The AI is busy. Try again in a minute." : "The AI couldn't write a draft right now.");
  const body: any = await res.json().catch(() => null);
  return String(body?.choices?.[0]?.message?.content || "");
};

const SYSTEM = `You write short, warm emails from Arise Reader (a free reading app schools use) to parents.
Plain words a busy parent reads in 20 seconds. No emojis, no exclamation marks in a row, no hype, no made-up facts:
use only the details given. You may use {first_name} for the parent's first name and {child_names} for their
children's first names. Sign off as "The Arise Reader team". Answer with JSON: {"subject": "...", "body": "..."}
where body is plain text with blank lines between short paragraphs.`;

export function registerParentMessages(app: Express, deps: Deps) {
  const ask = deps.ask ?? openAiJson;

  app.get("/api/admin/parent-messages/audience", deps.auth, deps.admin, async (_req, res) => {
    try {
      const [parents, schools, log] = await Promise.all([deps.parents(), deps.schools(), deps.readLog().catch(() => "")]);
      let history: unknown[] = []; try { history = log ? JSON.parse(log) : []; } catch { history = []; }
      res.json({ parents, schools, history });
    } catch (e: any) { res.status(500).json({ message: e?.message || "Couldn't load the parents." }); }
  });

  app.post("/api/admin/parent-messages/draft", deps.auth, deps.admin, async (req: any, res) => {
    const prompt = String(req.body?.prompt || "").trim().slice(0, 2000);
    if (!prompt) return res.status(400).json({ message: "Say what the email is about." });
    try {
      const raw = await ask(SYSTEM, `Write this email: ${prompt}`);
      let parsed: unknown = null; try { parsed = JSON.parse(raw); } catch { parsed = null; }
      const draft = cleanDraft(parsed);
      if (!draft) return res.status(502).json({ message: "The AI's draft didn't come through. Try again." });
      res.json(draft);
    } catch (e: any) { res.status(502).json({ message: e?.message || "The AI couldn't write a draft right now." }); }
  });

  app.post("/api/admin/parent-messages/send", deps.auth, deps.admin, async (req: any, res) => {
    const draft = cleanDraft(req.body);
    if (!draft) return res.status(400).json({ message: "Add a subject and a message." });
    const test = !!req.body?.test;
    try {
      const all = await deps.parents();
      let to: ParentRecipient[];
      if (test) {
        const me = String(req.user?.email || "").trim();
        if (!me) return res.status(400).json({ message: "Your admin account has no email to send the test to." });
        to = [{ id: 0, name: String(req.user?.displayName || req.user?.display_name || "Test"), email: me, schoolIds: [], kids: ["Maya"] }];
      } else {
        const ids = new Set((Array.isArray(req.body?.parentIds) ? req.body.parentIds : []).map(Number));
        to = all.filter((p) => ids.has(p.id));
        if (!to.length) return res.status(400).json({ message: "Pick at least one parent." });
      }
      let sent = 0; const failed: string[] = [];
      for (const p of to) {
        const filled = fillParentEmail(draft, p);
        const r = await deps.sendEmail(p.email, filled.subject, renderParentEmail(filled.body)).catch((e: any) => ({ sent: false, error: e?.message }));
        if (r.sent) sent++; else failed.push(p.email);
        await new Promise((ok) => setTimeout(ok, 250)); // gentle on the mail service
      }
      if (!test) {
        let history: any[] = []; try { history = JSON.parse((await deps.readLog().catch(() => "")) || "[]"); } catch { history = []; }
        history = [{ at: new Date().toISOString(), subject: draft.subject, sent, failed: failed.length }, ...history].slice(0, 30);
        await deps.saveLog(JSON.stringify(history)).catch(() => {});
      }
      res.json({ sent, failed });
    } catch (e: any) { res.status(500).json({ message: e?.message || "Couldn't send the emails." }); }
  });
}
