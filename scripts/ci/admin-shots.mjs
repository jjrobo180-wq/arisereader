// CI-only: serves the built client with a mocked API and takes screenshots of
// the admin page on a phone and a laptop. Not part of the app.
import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { buildAdminStats } from "../../server/adminStats.ts";

const ROOT = path.resolve("dist/public");
const OUT = path.resolve("ci-out/shots");
const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;
await mkdir(OUT, { recursive: true });

const unknown = new Map();
const writes = [];
const errors = [];
const now = Date.now();
const ago = (mins) => new Date(now - mins * 60_000).toISOString();

const admin = { id: 1, username: "admin", displayName: "Mr. J", isAdmin: true, role: "admin", accountApproved: true, approvedByTeacher: true, email: "jjrobo180@gmail.com" };

const schools = [
  { id: 1, name: "CGMS Hornets" },
  { id: 2, name: "Independent Reader- (Available to ALL Kids)(Click here if your school isn't listed)" },
  { id: 3, name: "Science and Technology Academy of the Greater Denver Metropolitan Area" },
];
const teachers = [
  { id: 21, display_name: "Gabby", username: "gabby", email: "gabby.gilder@scienceandtech.org", school_id: 1, role: "teacher", account_approved: true },
  { id: 22, display_name: "Independent Educator (For Independent Readers)", username: "independenteducator", email: "jjjrobo180@gmail.com", school_id: 2, role: "teacher", account_approved: true },
  { id: 23, display_name: "Mr. J", username: "mrj", email: "jermaine.robinson@scienceandtech.org", school_id: 1, role: "teacher", account_approved: true },
];
const pendingTeachers = [
  { id: 24, display_name: "Ms. Rivera", username: "ms.rivera", email: "rivera@lincolnelementary.edu", role: "teacher", account_approved: false, created_at: ago(95) },
];
const students = [
  { id: 11, username: "ana.lopez", displayName: "Ana Lopez", createdAt: ago(60 * 24 * 20), quizzesTaken: 14, quizzesMastered: 12, totalPoints: 186.5, approvedByTeacher: true, teacherId: 21, teacherName: "Gabby", role: "student", schoolId: 1 },
  { id: 12, username: "sampleeyegazer", displayName: "Sample Eye Gazer With A Really Long Display Name", createdAt: ago(60 * 24 * 9), quizzesTaken: 3, quizzesMastered: 2, totalPoints: 30, approvedByTeacher: true, teacherId: 22, teacherName: "Independent Educator (For Independent Readers)", role: "student", schoolId: 2 },
  { id: 13, username: "marcus.t", displayName: "Marcus Thompson", createdAt: ago(60 * 5), quizzesTaken: 0, quizzesMastered: 0, totalPoints: 0, approvedByTeacher: false, teacherId: 23, teacherName: "Mr. J", role: "student", schoolId: 1 },
  { id: 14, username: "zoe", displayName: "Zoe", createdAt: ago(60 * 24 * 40), quizzesTaken: 31, quizzesMastered: 29, totalPoints: 512, approvedByTeacher: true, teacherId: 21, teacherName: "Gabby", role: "student", schoolId: 1 },
  { id: 15, username: "independent.reader.with.a.long.username", displayName: "Jordan", createdAt: ago(60 * 24 * 2), quizzesTaken: 1, quizzesMastered: 1, totalPoints: 10, approvedByTeacher: true, role: "student" },
];
const parents = [
  { id: 31, display_name: "Sample Parent", username: "sample-parent", email: null, studentName: "Sample Eye Gazer", accountApproved: true },
  { id: 32, display_name: "arisdad1", username: "arisdad1", email: "jjrobo180@gmail.com", studentName: "Unknown", accountApproved: true },
  { id: 33, display_name: "Jrobinson", username: "jrobinson", email: "jjjrobo180@gmail.com", studentName: "Unknown", accountApproved: true },
  { id: 34, display_name: "arianasdad", username: "arianasdad", email: "jjjjrobo180@gmail.com", studentName: "Unknown", accountApproved: true },
  { id: 35, display_name: "Jermaine Robinson", username: "jjrob", email: "jjjrobo180@gmail.com", studentName: "Unknown", accountApproved: false },
];
const studentMsgs = [
  { id: 501, userId: 11, studentName: "Ana Lopez", studentUsername: "ana.lopez", senderRole: "student", messageText: "Can you add the new Dog Man book? I finished all the others!", linkUrl: null, isRead: false, createdAt: ago(12) },
  { id: 502, userId: 14, studentName: "Zoe", studentUsername: "zoe", senderRole: "student", messageText: "[REPORT A PROBLEM - Bug/Error]\nThe quiz froze on question 7 and I lost my answers.", linkUrl: null, isRead: false, createdAt: ago(48) },
  { id: 503, userId: 32, studentName: "arisdad1", studentUsername: "arisdad1", senderRole: "parent", messageText: "Thanks for the update on Ari's reading!", linkUrl: null, isRead: true, createdAt: ago(60 * 26) },
];
const sentMsgs = [
  { id: 601, userId: 32, studentName: "arisdad1", studentUsername: "arisdad1", messageText: "Ari is doing great this week.", linkUrl: null, isRead: true, createdAt: ago(60 * 27) },
];
const books = Array.from({ length: 30 }, (_, i) => ({ id: 100 + i, title: ["Frindle", "Wonder", "Holes", "Hatchet", "Dog Man", "The One and Only Ivan"][i % 6] + (i > 5 ? ` ${i}` : ""), author: "Author " + i, ageGroup: "3-5", coverUrl: null, pointsValue: (i % 3 + 1) * 5, readUrl: i % 4 === 0 ? "https://example.org" : null }));
const quizRequests = [
  { id: 71, bookTitle: "The Wild Robot Protects", author: "Peter Brown", status: "pending", createdAt: ago(30), studentName: "Ana Lopez" },
  { id: 70, bookTitle: "Wings of Fire", author: "Tui T. Sutherland", status: "completed", createdAt: ago(60 * 50), studentName: "Zoe" },
];
const reviewRequests = [
  { id: 81, studentName: "Zoe", bookTitle: "Holes", status: "pending", original_score: 6, total: 10, original_points: 0, reason: "I think question 4 had two right answers", reviewed_score: null, created_at: ago(70) },
];
const pendingQuizzes = [
  { id: 91, book_title: "Diary of a Wimpy Kid: Hot Mess", author: "Jeff Kinney", quiz_type: "book", age_group: "3-5", student_name: "Ana Lopez", created_at: ago(20), questions: JSON.stringify([{ question: "Who is the main character?", options: ["Greg", "Rowley", "Rodrick", "Manny"], correct: "A" }]) },
];
const feedItems = [
  { key: "ai_quiz:91", kind: "action", category: "ai_quiz", title: "AI quiz to review: “Diary of a Wimpy Kid: Hot Mess”", body: "Ana Lopez · Book quiz", createdAt: ago(20), target: { type: "ai_quiz", id: 91 } },
  { key: "conv:11", kind: "action", category: "message", title: "Ana Lopez sent you a message", body: "Can you add the new Dog Man book? I finished all the others!", createdAt: ago(12), target: { type: "message", id: 11 } },
  { key: "conv:14", kind: "action", category: "report", title: "Problem report from Zoe", body: "The quiz froze on question 7 and I lost my answers.", createdAt: ago(48), target: { type: "message", id: 14 } },
  { key: "teacher:24", kind: "action", category: "teacher", title: "Ms. Rivera hasn't turned on their teacher account", body: "@ms.rivera · rivera@lincolnelementary.edu · waiting for the code from their school email", createdAt: ago(95), target: { type: "teacher", id: 24 } },
  { key: "row:1201", kind: "update", category: "quiz", title: "Quiz taken: Zoe scored 9/10 on “Holes”", body: "Passed · 10 points · Parent proctored", createdAt: ago(8), target: { type: "student", id: 14 } },
  { key: "row:1200", kind: "update", category: "signup", title: "New student: Marcus Thompson", body: "@marcus.t · Grade 6 · CGMS Hornets · waiting for Mr. J", createdAt: ago(300), target: { type: "student", id: 13 } },
];
const alertSettings = {
  settings: {
    emailEnabled: true, recipients: ["jjrobo180@gmail.com"], bundle: true, dailyLimit: 80,
    events: {
      student_signup: { email: true, inApp: true }, teacher_signup: { email: true, inApp: true }, parent_signup: { email: true, inApp: true },
      quiz_completed: { email: true, inApp: true }, eye_gaze_quiz_completed: { email: true, inApp: true }, assessment_completed: { email: false, inApp: true },
      ai_quiz_review: { email: true, inApp: true }, quiz_request: { email: true, inApp: true }, review_request: { email: true, inApp: true },
      approval_request: { email: true, inApp: true }, club_signup: { email: true, inApp: true }, student_message: { email: true, inApp: true }, problem_report: { email: true, inApp: true },
    },
  },
  email: { configured: true, from: "A.R.I.S.E Reader <alerts@arisereader.com>", sentToday: 7, dailyLimit: 80 },
  log: [
    { at: ago(8), subject: "Quiz taken: Zoe scored 9/10 on “Holes”", to: ["jjrobo180@gmail.com"], events: ["quiz_completed"], status: "sent" },
    { at: ago(300), subject: "New student: Marcus Thompson", to: ["jjrobo180@gmail.com"], events: ["student_signup"], status: "sent" },
    { at: ago(1440), subject: "3 new alerts", to: ["jjrobo180@gmail.com"], events: ["quiz_completed", "quiz_completed", "student_signup"], status: "failed", detail: "Email API error 403: The resend.dev domain can only send to your own address" },
  ],
};

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function apiGet(p) {
  const exact = {
    "/api/me": admin,
    "/api/notifications": {
      type: "admin", items: feedItems, actionCount: 4, updateCount: 2, unreadCount: 6, inboxUnread: 2,
      // the shape the old bell reads
      pendingRequestItems: [{ id: 71, bookTitle: "The Wild Robot Protects", author: "Peter Brown", studentName: "Ana Lopez", createdAt: ago(30) }],
      newUserItems: [{ id: 13, displayName: "Marcus Thompson", username: "marcus.t", createdAt: ago(300) }],
      pendingTeacherItems: [{ id: 24, displayName: "Ms. Rivera", username: "ms.rivera", createdAt: ago(95) }],
      pendingParentItems: [], pendingAIQuizItems: [{ id: 91, bookTitle: "Diary of a Wimpy Kid: Hot Mess", studentName: "Ana Lopez", createdAt: ago(20) }],
      genericItems: [{ id: 1201, title: "Quiz taken: Zoe scored 9/10", messageText: "Passed · 10 points", createdAt: ago(8) }],
    },
    "/api/admin/students": students,
    "/api/admin/user-grades": { 11: "5", 12: "3", 13: "6", 14: "8" },
    "/api/admin/books": books,
    "/api/public/stats": { quizzesAvailable: 2140 },
    "/api/admin/messages": studentMsgs,
    "/api/admin/messages/sent": sentMsgs,
    "/api/admin/messages/unread-count": { count: 2 },
    "/api/admin/quiz-requests": quizRequests,
    "/api/admin/review-requests": reviewRequests,
    "/api/announcement": { text: "Book fair starts Monday!" },
    "/api/banners": { studentBanner: { text: "Read 3 books this month to earn a prize!", bgColor: "#f59e0b", textColor: "#1a1a1a", active: true }, teacherBanner: { text: "", bgColor: "#3b82f6", textColor: "#ffffff", active: false }, loginBanner: { text: "", bgColor: "#f59e0b", textColor: "#1a1a1a", active: false } },
    "/api/donation-settings": { goalAmount: 1000, currentAmount: 250, title: "Support Our Readers", description: "Help us keep A.R.I.S.E Reader free", donateUrl: "", milestones: [], active: false },
    "/api/admin/ai-settings": { configured: true, keyPreview: "pplx-…9f2c", guidelines: "", eyeGazeGuidelines: "" },
    "/api/proctor-password": { password: "READ2026" },
    "/api/admin/club-closing-hours": { enabled: true, start: "21:00", end: "07:00", days: [0, 1, 2, 3, 4, 5, 6], timeZone: "America/Denver", closedNow: true },
    "/api/admin/teacher-club-closing-hours": { teachers: [{ id: 21, displayName: "Gabby", username: "gabby", schedule: { enabled: false, start: "21:00", end: "07:00", days: [1, 2, 3, 4, 5] } }] },
    "/api/admin/easter-eggs": { active: false, totalEggs: 0, remainingEggs: 0, pointsPerEgg: 2, claims: [] },
    "/api/competition-settings": { settings: { monthlyCountdownDate: "2026-10-31", yearlyCountdownDate: "" } },
    "/api/admin/pending-parents": parents.filter((p) => !p.accountApproved),
    "/api/admin/all-parents": parents,
    "/api/grade-change-requests": { requests: [{ id: 41, displayName: "Ana Lopez", username: "ana.lopez", oldGrade: "5", oldBand: "3-5", newGrade: "6", newBand: "6-8" }] },
    "/api/eye-gaze-requests": { requests: [{ id: 42, userId: 15, displayName: "Jordan", username: "independent.reader.with.a.long.username", currentStatus: false, requestedStatus: true }] },
    "/api/leaderboard": [
      { id: 14, displayName: "Zoe", totalPoints: 512, quizzesTaken: 31, schoolName: "CGMS Hornets", grade: "8" },
      { id: 11, displayName: "Ana Lopez", totalPoints: 186.5, quizzesTaken: 14, schoolName: "CGMS Hornets", grade: "5" },
      { id: 12, displayName: "Sample Eye Gazer With A Really Long Display Name", totalPoints: 30, quizzesTaken: 3, isEyeGazeUser: true, grade: "3" },
    ],
    "/api/admin/schools": schools,
    "/api/admin/school-stats": [],
    "/api/admin/pending-teachers": pendingTeachers,
    "/api/teachers": teachers,
    "/api/teacher-admin/teachers": teachers.map((t) => ({ id: t.id, displayName: t.display_name, username: t.username })),
    "/api/admin/pending-quizzes": { pending: pendingQuizzes },
    "/api/admin/club-signups": { signups: [{ id: 61, student_name: "Ana Lopez", grade: "5", parent_name: "Maria Lopez", parent_contact: "555-0100", parent_email: "maria.lopez.family@example.com", notes: "Can come every Thursday", status: "pending", created_at: ago(200) }] },
    "/api/admin/growth-check/windows": [],
    "/api/admin/growth-check/forms": [],
    "/api/teacher/growth-check/overview": [],
    "/api/admin/unlisted-signups": [{ userId: 15, username: "independent.reader.with.a.long.username", displayName: "Jordan", gradeLevel: "4", schoolId: null, schoolName: "Lincoln Elementary School of the Arts", teacherName: null, createdAt: ago(60 * 30), resolved: false }],
    "/api/integrity/review": { sessions: [] },
    "/api/admin/archived-users": [],
    "/api/admin/plans": { enforced: false, plans: [], freeSchools: [{ id: 1, name: "CGMS Hornets", free: true, byName: true }], stripe: { keySet: false, keyPreview: "", keyFromHosting: false, webhookSet: false, webhookPreview: "", webhookFromHosting: false } },
    "/api/play-time/manage": { globalMinutes: 10, day: "2026-10-04", students: [], canSetGlobal: true },
    "/api/schools": [],
    "/api/teacher/my-band": { bandsText: "" },
    "/api/admin/alert-settings": alertSettings,
  };
  if (p in exact) return exact[p];
  if (/^\/api\/admin\/schools\/\d+\/classes$/.test(p)) return [];
  if (/^\/api\/admin\/schools\/\d+\/class-stats$/.test(p)) return [];
  if (/^\/api\/admin\/students\/\d+$/.test(p)) return { user: students[0], totalPoints: 186.5, quizzesTaken: 14, totalBooks: 40, quizHistory: [], messages: [] };
  if (/^\/api\/admin\/students\/\d+\/(reading-progress)$/.test(p)) return { profile: null, history: [] };
  if (/^\/api\/admin\/students\/\d+\/activity/.test(p)) return { days: [] };
  return undefined;
}


// Stats tab: realistic numbers made by the real stats code from made-up activity.
function fakeStatsInput() {
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const DAY = 86_400_000;
  const first = ["Ana", "Ben", "Cy", "Dee", "Eli", "Fay", "Gus", "Hana", "Ivan", "Jade", "Kai", "Lena", "Milo", "Nia", "Omar", "Pia", "Quinn", "Rosa", "Sam", "Tia"];
  const last = ["Lopez", "Nguyen", "Smith", "Patel", "Brown", "Garcia", "Kim", "Johnson", "Okafor", "Rossi"];
  const users = [{ id: 1, username: "admin", displayName: "Mr. J", role: "admin", isAdmin: true, createdAt: new Date(now - 40 * DAY).toISOString(), schoolId: null, archived: false }];
  const grades = {};
  for (let i = 0; i < 64; i++) {
    const created = now - Math.floor(Math.pow(rand(), 1.6) * 38 * DAY) - 3600_000;
    users.push({ id: 100 + i, username: `s${i}`, displayName: i === 3 ? "Maximiliano Alexander Fernández-Rodríguez" : `${first[i % 20]} ${last[(i * 7) % 10]}`, role: "student", isAdmin: false, createdAt: new Date(created).toISOString(), schoolId: i % 5 === 0 ? null : (i % 3) + 1, archived: false });
    grades[100 + i] = String(3 + (i % 6));
  }
  for (let i = 0; i < 9; i++) users.push({ id: 300 + i, username: `t${i}`, displayName: `Teacher ${i + 1}`, role: "teacher", isAdmin: false, createdAt: new Date(now - (30 - i * 3) * DAY).toISOString(), schoolId: (i % 3) + 1, archived: false });
  for (let i = 0; i < 6; i++) users.push({ id: 400 + i, username: `p${i}`, displayName: `Parent ${i + 1}`, role: "parent", isAdmin: false, createdAt: new Date(now - (25 - i * 4) * DAY).toISOString(), schoolId: null, archived: false });
  const devices = ["Chromebook · Chrome", "Chromebook · Chrome", "iPad · Safari", "Windows computer · Edge", "iPhone · Safari", "Mac · Chrome", "Android phone · Chrome"];
  const sessions = [], loginLogs = [], activityDays = {}, bookQuizzes = [], feedEvents = [], eyeGazeQuizzes = [], readingChecks = [], growthChecks = [], pointAwards = [];
  const dayKeyLocal = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
  for (const u of users) {
    if (u.isAdmin) continue;
    const start = Date.parse(u.createdAt);
    const keen = rand();
    for (let t = start; t < now; t += DAY) {
      const dow = new Date(t).getUTCDay();
      if (rand() > keen * (dow === 0 || dow === 6 ? 0.35 : 0.9)) continue;
      const at = Math.min(now - 60_000, t - (t % DAY) + (14 + Math.floor(rand() * 9)) * 3600_000 + Math.floor(rand() * 3600_000));
      if (at < start) continue;
      if (rand() < 0.4) (rand() < 0.5 ? loginLogs.push({ userId: u.id, at: new Date(at).toISOString(), device: devices[Math.floor(rand() * devices.length)] }) : sessions.push({ userId: u.id, at: new Date(at).toISOString() }));
      if (now - at < 4 * DAY) { const k = dayKeyLocal(at); (activityDays[k] ??= {})[u.id] = [at, at + Math.floor(rand() * 2 * 3600_000)]; }
      if (u.role !== "student") continue;
      if (rand() < 0.25) { const total = 10; const score = 4 + Math.floor(rand() * 7); bookQuizzes.push({ userId: u.id, at: new Date(at + 600_000).toISOString(), score, total, points: score >= 7 ? Math.round((0.5 + rand() * 4) * 10) / 10 : 0 }); }
      if (rand() < 0.05) eyeGazeQuizzes.push({ userId: u.id, at: new Date(at + 900_000).toISOString(), score: 3 + Math.floor(rand() * 3), total: 5 });
      if (rand() < 0.6) for (let k = 0; k < 3; k++) feedEvents.push({ userId: u.id, at: new Date(at + k * 60_000).toISOString(), type: "view" });
      if (rand() < 0.02) readingChecks.push({ userId: u.id, at: new Date(at + 1200_000).toISOString(), score: 8 + Math.floor(rand() * 7), total: 15, level: (3 + rand() * 4).toFixed(1) });
      if (rand() < 0.02) pointAwards.push({ userId: u.id, at: new Date(at).toISOString(), points: 1, reason: "Daily Quick Challenge" });
    }
  }
  growthChecks.push({ userId: 105, at: new Date(now - 2 * DAY).toISOString(), raw: 14, max: 18, scaled: 512 });
  return {
    users, schools, grades, sessions, loginLogs, activityDays, bookQuizzes, eyeGazeQuizzes, readingChecks, growthChecks, pointAwards, feedEvents,
    games: [], messages: [], liveJoins: [],
  };
}
const STATS_INPUT = fakeStatsInput();
const statsFor = (range) => buildAdminStats(STATS_INPUT, { range: ["7d", "30d", "90d", "all"].includes(range) ? range : "30d", now, heardFrom: new Map([[101, now - 60_000], [104, now - 3 * 60_000], [302, now - 5 * 60_000]]) });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".json": "application/json", ".woff2": "font/woff2", ".ico": "image/x-icon", ".mp3": "audio/mpeg" };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE);
  const p = url.pathname;
  if (p.startsWith("/api/")) {
    if (req.method !== "GET") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => { writes.push(`${req.method} ${p} ${body.slice(0, 200)}`); json(res, 200, { ok: true, success: true, message: "Saved" }); });
      return;
    }
    const data = p === "/api/admin/stats" ? statsFor(url.searchParams.get("range")) : apiGet(p);
    if (data === undefined) { unknown.set(p, (unknown.get(p) || 0) + 1); return json(res, 200, {}); }
    return json(res, 200, data);
  }
  let file = path.join(ROOT, decodeURIComponent(p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try {
    if (p === "/" || p.endsWith("/")) file = path.join(ROOT, "index.html");
    const buf = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(buf);
  } catch {
    try { const buf = await readFile(path.join(ROOT, "index.html")); res.writeHead(200, { "Content-Type": "text/html" }); res.end(buf); }
    catch { res.writeHead(404); res.end(); }
  }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const browser = await chromium.launch();
const cookieValue = Buffer.from(JSON.stringify({ user: admin, token: "ci-token" })).toString("base64");
const settle = (page, ms = 900) => page.waitForTimeout(ms);

async function clickAll(page, prefix, selector, attr) {
  const values = await page.$$eval(selector, (els, a) => [...new Set(els.filter((e) => e.offsetParent !== null).map((e) => e.getAttribute(a)))], attr);
  for (const v of values) {
    const el = page.locator(`${selector.replace(/\]$/, "")}="${v}"]`).locator("visible=true").first();
    try { await el.click({ timeout: 3000 }); } catch (e) { errors.push(`${prefix} click ${v}: ${e.message.split("\n")[0]}`); continue; }
    await settle(page);
    await page.screenshot({ path: `${OUT}/${prefix}-${v}.png`, fullPage: true });
  }
  return values;
}

async function run(name, viewport, mobile) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await context.addCookies([{ name: "arise_session", value: cookieValue, url: BASE }]);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${name} console: ${m.text().slice(0, 300)}`); });
  await page.goto(`${BASE}/#/admin`, { waitUntil: "networkidle" });
  await settle(page, 2500);
  await page.screenshot({ path: `${OUT}/${name}-00-landing.png`, fullPage: true });
  const overflow = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll("body *")].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > w + 1; }).slice(0, 12).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 80)} right=${Math.round(el.getBoundingClientRect().right)}`);
    return { scrollWidth: document.documentElement.scrollWidth, clientWidth: w, wide };
  });
  errors.push(`${name} landing overflow: ${JSON.stringify(overflow)}`);

  const tabs = await page.$$eval("[data-admin-tab]", (els) => [...new Set(els.map((e) => e.getAttribute("data-admin-tab")))]);
  for (const t of tabs) {
    const el = page.locator(`[data-admin-tab="${t}"]`).locator("visible=true").first();
    try { await el.click({ timeout: 3000 }); } catch (e) { errors.push(`${name} tab ${t}: ${e.message.split("\n")[0]}`); continue; }
    await settle(page);
    await page.screenshot({ path: `${OUT}/${name}-tab-${t}.png`, fullPage: true });
    const tabOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (tabOverflow > 1) errors.push(`${name} tab ${t} overflows by ${tabOverflow}px`);
    if (t === "people") await clickAll(page, `${name}-people`, "[data-people-tab]", "data-people-tab");
    if (t === "settings") await clickAll(page, `${name}-settings`, "[data-settings-section]", "data-settings-section");
    if (t === "stats") {
      await clickAll(page, `${name}-stats-growth`, "[data-growth-view]", "data-growth-view");
      await clickAll(page, `${name}-stats-range`, "[data-stats-range]", "data-stats-range");
    }
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  const bell = page.locator('[data-testid="notification-bell"]').locator("visible=true").first();
  try {
    await bell.click({ timeout: 3000 });
    await settle(page);
    await page.screenshot({ path: `${OUT}/${name}-zz-bell.png` });
  } catch (e) { errors.push(`${name} bell: ${e.message.split("\n")[0]}`); }
  try {
    await page.evaluate(() => { location.hash = "/this-page-does-not-exist"; });
    await settle(page, 1500);
    await page.screenshot({ path: `${OUT}/${name}-zz-not-found.png` });
  } catch (e) { errors.push(`${name} not-found: ${e.message.split("\n")[0]}`); }
  await context.close();
}

async function farm() {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await context.addCookies([{ name: "arise_session", value: cookieValue, url: BASE }]);
  const page = await context.newPage();
  const models = [];
  page.on("response", (r) => { if (/\.glb(\?|$)/.test(r.url())) models.push(`${r.status()} ${r.url()}`); });
  page.on("requestfailed", (r) => { if (/\.glb/.test(r.url())) models.push(`FAILED ${r.failure()?.errorText} ${r.url()}`); });
  page.on("pageerror", (e) => errors.push(`farm pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`farm console: ${m.text().slice(0, 300)}`); });
  await page.goto(`${BASE}/#/eye-gaze-farm`, { waitUntil: "networkidle" });
  await page.waitForTimeout(9000);
  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 500));
  await page.screenshot({ path: `${OUT}/farm-laptop.png` });
  errors.push(`farm models (${models.length}): ${JSON.stringify(models)}`);
  errors.push(`farm text: ${text}`);
  await context.close();
}

await run("phone", { width: 390, height: 844 }, true);
await run("laptop", { width: 1366, height: 900 }, false);
await farm();
await browser.close();
server.close();

await writeFile("ci-out/browser.txt", [
  "== errors and checks ==", ...errors, "",
  "== unknown GET endpoints (returned {}) ==", ...[...unknown].map(([k, v]) => `${k} x${v}`), "",
  "== writes ==", ...writes,
].join("\n"));
console.log("screenshots done", errors.length, "notes");
