// Help tickets: messaging the admin from the sign-in screen without an account.
// Run with: npx tsx --test tests/help-tickets.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { helpTicketSentMessage, readHelpTicket, HELP_EMAIL_HINT } from "../shared/helpTicket";
import { registerHelpTicketRoutes, type HelpTicketDeps } from "../server/helpTickets";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const good = { firstName: " Ana ", lastName: "Ruiz", school: "Conservatory Green Middle School (Denver, CO)", grade: "7", advisory: "Chase & Shuster", issue: "I can't find my username." };

function harness(over: Partial<HelpTicketDeps> = {}) {
  const routes = new Map<string, any[]>();
  const app: any = { post: (p: string, ...h: any[]) => routes.set(`POST ${p}`, h), get: (p: string, ...h: any[]) => routes.set(`GET ${p}`, h) };
  const saved: any[] = [], alerts: any[] = [];
  registerHelpTicketRoutes(app, {
    auth: (_req, _res, next) => next(),
    admin: (_req, _res, next) => next(),
    findOpenDuplicate: async (t) => saved.some((s) => s.firstName === t.firstName && s.lastName === t.lastName && s.school === t.school && s.issue === t.issue),
    save: async (t) => { saved.push(t); },
    alert: (t) => { alerts.push(t); },
    list: async () => [],
    markDone: async (id) => id === 1,
    ...over,
  });
  const post = async (body: any, ip = "1.2.3.4") => {
    let status = 200, json: any;
    const res: any = { status(c: number) { status = c; return res; }, json(j: any) { json = j; return res; }, set() { return res; } };
    await routes.get("POST /api/auth/help-ticket")![0]({ body, ip, headers: {}, socket: { remoteAddress: ip } }, res);
    return { status, json };
  };
  return { routes, post, saved, alerts };
}

test("every field is asked for except the email", () => {
  assert.ok("ticket" in readHelpTicket(good));
  for (const missing of ["firstName", "lastName", "school", "grade", "advisory", "issue"]) {
    assert.ok("message" in readHelpTicket({ ...good, [missing]: "" }), missing);
  }
  assert.ok("message" in readHelpTicket({ ...good, grade: "99" }));
  assert.ok("message" in readHelpTicket({ ...good, email: "not-an-email" }));
  const r = readHelpTicket({ ...good, email: " Ana@Example.COM " });
  assert.ok("ticket" in r && r.ticket.email === "ana@example.com" && r.ticket.firstName === "Ana");
});

test("the sender is told when to expect an answer", () => {
  assert.match(helpTicketSentMessage({ firstName: "Ana", email: "" }), /following school day in your advisory/);
  assert.match(helpTicketSentMessage({ firstName: "Ana", email: "a@b.co" }), /reply to a@b\.co/);
  assert.match(HELP_EMAIL_HINT, /after school hours or over the weekend/);
  assert.match(HELP_EMAIL_HINT, /following school day in your advisory/);
});

test("a ticket is saved, the admin is told, and nothing is sent to the typed address", async () => {
  const h = harness();
  const r = await h.post({ ...good, email: "a@b.co" });
  assert.equal(r.status, 200);
  assert.equal(h.saved.length, 1);
  assert.equal(h.alerts.length, 1);
  assert.doesNotMatch(read("server/helpTickets.ts"), /sendEmail/);
});

test("sending the same message twice makes one ticket", async () => {
  const h = harness();
  await h.post(good); await h.post(good);
  assert.equal(h.saved.length, 1);
  assert.equal(h.alerts.length, 1);
});

test("a bad ticket isn't saved, and the spam trap keeps nothing", async () => {
  const h = harness();
  assert.equal((await h.post({ ...good, issue: "" })).status, 400);
  assert.equal((await h.post({ ...good, website: "http://spam.example" })).status, 200);
  assert.equal(h.saved.length, 0);
  assert.equal(h.alerts.length, 0);
});

test("a saving failure tells the sender it didn't send and doesn't alert", async () => {
  const h = harness({ save: async () => { throw new Error("db"); } });
  const r = await h.post(good);
  assert.equal(r.status, 500);
  assert.match(r.json.message, /didn't send/);
  assert.equal(h.alerts.length, 0);
});

test("one network can't flood the inbox, and other networks still get through", async () => {
  const h = harness();
  for (let i = 0; i < 30; i++) assert.equal((await h.post({ ...good, issue: `Problem number ${i}` })).status, 200);
  assert.equal((await h.post({ ...good, issue: "One more" })).status, 429);
  assert.equal((await h.post({ ...good, issue: "Another school" }, "9.9.9.9")).status, 200);
});

test("only admins can read or close tickets", () => {
  const h = harness();
  for (const route of ["GET /api/admin/help-tickets", "POST /api/admin/help-tickets/:id/done"]) assert.equal(h.routes.get(route)!.length, 3, route);
  const sql = read("migrations/student_help_tickets.sql");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on table public\.student_help_tickets from anon, authenticated/);
});

test("the form is reached from both forgot screens and shows in the admin inbox", () => {
  const forgot = read("client/src/components/auth/ForgotSignIn.tsx");
  assert.match(forgot, /<HelpTicketForm dark=\{dark\} onBack=\{close\} \/>/);
  assert.match(forgot, /Still stuck\?/);
  const form = read("client/src/components/auth/HelpTicketForm.tsx");
  for (const label of ["First name", "Last name", "Your school", "Your grade", "Your advisory", "What's the problem?", "Email (optional)"]) assert.ok(form.includes(label), label);
  assert.match(read("client/src/pages/Admin.tsx"), /<HelpTickets token=/);
});
