// Builds the notification bell's feed (see shared/notifications.ts) from what the routes read.
// Pure: no database here, so the rules are easy to test.
import { describeStoredType, type FeedCategory, type FeedItem, type FeedResponse } from "../shared/notifications";
import type { AlertEventKey } from "../shared/adminAlerts";

export type StoredRow = { id: number; type?: string | null; title?: string | null; message?: string | null; created_at?: string | null };
export type PersonRow = { id: number; display_name?: string | null; username?: string | null; email?: string | null; created_at?: string | null };

export type AdminFeedSources = {
  rows: StoredRow[];
  pendingTeachers: PersonRow[];
  pendingParents: PersonRow[];
  waitingStudents: (PersonRow & { teacher_name?: string | null })[];
  unlisted: { userId: number; displayName?: string | null; username?: string | null; schoolName?: string | null; teacherName?: string | null; createdAt?: string | null }[];
  aiQuizzes: { id: number; book_title?: string | null; quiz_type?: string | null; student_name?: string | null; created_at?: string | null }[];
  quizRequests: { id: number; bookTitle?: string | null; author?: string | null; studentName?: string | null; createdAt?: string | null }[];
  reviewRequests: { id: number; studentName?: string | null; bookTitle?: string | null; original_score?: number | null; total?: number | null; created_at?: string | null }[];
  clubSignups: { id: number; student_name?: string | null; grade?: string | null; created_at?: string | null }[];
  gradeChanges: { id: number; displayName?: string | null; username?: string | null; oldGrade?: string | null; newGrade?: string | null; newBand?: string | null; requestedAt?: string | null }[];
  eyeGazeRequests: { id: number; displayName?: string | null; username?: string | null; requestedStatus?: boolean | null; createdAt?: string | null }[];
  conversations: Conversation[];
  inboxUnread: number;
};

export type Conversation = { userId: number; name: string; role?: string | null; count: number; latestText: string; latestAt: string };

export type FeedFilters = {
  /** Keys the person dismissed. */
  dismissed: Set<string>;
  /** Action items older than this (ms) were cleared with "Clear all". 0 = never. */
  clearBefore: number;
  /** The admin's in-bell switch for each alert event. */
  inApp?: (event: AlertEventKey) => boolean;
};

const REPORT_PREFIX = /^\[REPORT A PROBLEM(?: - ([^\]]+))?\]\s*/i;

export function isProblemReport(text: string): boolean {
  return REPORT_PREFIX.test(String(text || "").trim());
}

/** The message without the "[REPORT A PROBLEM - …]" label, and the label's category. */
export function splitReport(text: string): { category: string | null; body: string } {
  const trimmed = String(text || "").trim();
  const match = REPORT_PREFIX.exec(trimmed);
  if (!match) return { category: null, body: trimmed };
  return { category: match[1] || "Other", body: trimmed.slice(match[0].length).trim() };
}

const clip = (value: unknown, max = 160) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
const at = (value: unknown) => {
  const time = new Date(String(value || "")).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : new Date(0).toISOString();
};
const nameOf = (p: { display_name?: string | null; username?: string | null }) => String(p.display_name || p.username || "Someone");
const handle = (username?: string | null) => (username ? `@${username}` : "");
const joinBits = (...bits: (string | null | undefined | false)[]) => bits.filter(Boolean).join(" · ");

// Old stored notifications that the bell now shows from live state instead.
const ADMIN_HIDDEN_TITLES = ["ai quiz pending review", "student book request", "reading club sign-up", "student needs a teacher connection"];

/** Which admin alert switch decides whether a live category shows in the bell. */
const CATEGORY_EVENT: Partial<Record<FeedCategory, AlertEventKey>> = {
  teacher: "teacher_signup",
  parent: "parent_signup",
  student: "student_signup",
  unlisted: "student_signup",
  ai_quiz: "ai_quiz_review",
  request: "quiz_request",
  review: "review_request",
  club: "club_signup",
  grade_change: "approval_request",
  eye_gaze: "approval_request",
  message: "student_message",
  report: "problem_report",
};

export function finishFeed(type: FeedResponse["type"], items: FeedItem[], extra: Partial<FeedResponse> = {}): FeedResponse {
  const byNewest = (a: FeedItem, b: FeedItem) => b.createdAt.localeCompare(a.createdAt);
  const actions = items.filter((i) => i.kind === "action").sort(byNewest);
  const updates = items.filter((i) => i.kind === "update").sort(byNewest);
  return {
    type,
    items: [...actions, ...updates],
    actionCount: actions.length,
    updateCount: updates.length,
    unreadCount: actions.length + updates.length,
    ...extra,
  };
}

function storedUpdates(rows: StoredRow[], hiddenTitles: string[]): FeedItem[] {
  return rows
    .filter((row) => !hiddenTitles.some((t) => String(row.title || "").toLowerCase().includes(t)))
    .map((row) => {
      const { category, target } = describeStoredType(row.type);
      return {
        key: `row:${row.id}`,
        kind: "update" as const,
        category,
        title: clip(row.title || "Update", 140),
        body: clip(row.message || "", 240),
        createdAt: at(row.created_at),
        ...(target ? { target } : {}),
      };
    });
}

export function buildAdminFeed(src: AdminFeedSources, filters: FeedFilters): FeedResponse {
  const showCategory = (category: FeedCategory) => {
    const event = CATEGORY_EVENT[category];
    return !event || !filters.inApp || filters.inApp(event);
  };
  const actions: FeedItem[] = [];
  const add = (item: Omit<FeedItem, "kind">) => {
    if (!showCategory(item.category)) return;
    if (filters.dismissed.has(item.key)) return;
    if (filters.clearBefore && new Date(item.createdAt).getTime() <= filters.clearBefore) return;
    actions.push({ ...item, kind: "action" });
  };

  for (const t of src.pendingTeachers) {
    add({
      key: `teacher:${t.id}`, category: "teacher", createdAt: at(t.created_at), target: { type: "teacher", id: t.id },
      title: `${nameOf(t)}'s teacher account isn't on yet`,
      body: joinBits(handle(t.username), t.email, "Waiting for their school email code — you can turn it on by hand"),
    });
  }
  for (const p of src.pendingParents) {
    add({
      key: `parent:${p.id}`, category: "parent", createdAt: at(p.created_at), target: { type: "parent", id: p.id },
      title: `${nameOf(p)} is waiting for parent approval`,
      body: joinBits(handle(p.username), p.email),
    });
  }
  if (src.waitingStudents.length) {
    const newest = [...src.waitingStudents].sort((a, b) => at(b.created_at).localeCompare(at(a.created_at)))[0];
    const n = src.waitingStudents.length;
    const newestId = Math.max(...src.waitingStudents.map((s) => Number(s.id) || 0));
    add({
      key: `students-waiting:${newestId}`, category: "student", createdAt: at(newest.created_at), target: { type: "user", id: Number(newest.id) },
      title: n === 1 ? `${nameOf(newest)} is waiting for a teacher's OK` : `${n} students are waiting for a teacher's OK`,
      body: joinBits(n === 1 ? handle(newest.username) : `Newest: ${nameOf(newest)}`, newest.teacher_name ? `Teacher: ${newest.teacher_name}` : null),
    });
  }
  for (const u of src.unlisted) {
    const missing = [u.schoolName && `school “${u.schoolName}”`, u.teacherName && `teacher “${u.teacherName}”`].filter(Boolean).join(" and ");
    add({
      key: `unlisted:${u.userId}`, category: "unlisted", createdAt: at(u.createdAt), target: { type: "unlisted", id: u.userId },
      title: `${u.displayName || u.username || "A student"} needs a teacher connection`,
      body: missing ? `Couldn't find their ${missing} at sign-up` : "Signed up without a school or teacher",
    });
  }
  for (const q of src.aiQuizzes) {
    const kind = q.quiz_type === "eye_gaze" ? "Eye Gazer quiz" : q.quiz_type === "iarise" ? "iArise quiz" : q.quiz_type === "favorite_topic" ? "Favorite topic quiz" : "Book quiz";
    add({
      key: `ai_quiz:${q.id}`, category: "ai_quiz", createdAt: at(q.created_at), target: { type: "ai_quiz", id: q.id },
      title: `AI quiz to review: “${clip(q.book_title || "Untitled", 80)}”`,
      body: joinBits(q.student_name || "Student", kind),
    });
  }
  for (const r of src.quizRequests) {
    add({
      key: `request:${r.id}`, category: "request", createdAt: at(r.createdAt), target: { type: "request", id: r.id },
      title: `Quiz request: “${clip(r.bookTitle || "A book", 80)}”`,
      body: joinBits(r.studentName || "Student", r.author ? `by ${r.author}` : null),
    });
  }
  for (const r of src.reviewRequests) {
    add({
      key: `review:${r.id}`, category: "review", createdAt: at(r.created_at), target: { type: "review", id: r.id },
      title: `${r.studentName || "A student"} asked you to re-check a quiz`,
      body: joinBits(r.bookTitle ? `“${clip(r.bookTitle, 80)}”` : null, r.original_score != null ? `Score ${r.original_score}/${r.total || 10}` : null),
    });
  }
  for (const c of src.clubSignups) {
    add({
      key: `club:${c.id}`, category: "club", createdAt: at(c.created_at), target: { type: "club", id: c.id },
      title: `${c.student_name || "A student"} signed up for Reading Club`,
      body: joinBits(c.grade ? `Grade ${c.grade}` : null, "Confirm or deny"),
    });
  }
  for (const g of src.gradeChanges) {
    add({
      key: `grade_change:${g.id}`, category: "grade_change", createdAt: at(g.requestedAt), target: { type: "grade_change", id: g.id },
      title: `${g.displayName || g.username || "A student"} wants to change grade`,
      body: `Grade ${g.oldGrade || "?"} → Grade ${g.newGrade || "?"}${g.newBand ? ` (${g.newBand} band)` : ""}`,
    });
  }
  for (const e of src.eyeGazeRequests) {
    add({
      key: `eye_gaze:${e.id}`, category: "eye_gaze", createdAt: at(e.createdAt), target: { type: "eye_gaze", id: e.id },
      title: `${e.displayName || e.username || "A student"} wants Eye Gaze mode ${e.requestedStatus ? "on" : "off"}`,
      body: joinBits(handle(e.username), "Approve or deny"),
    });
  }
  for (const c of src.conversations) {
    const { category, body } = splitReport(c.latestText);
    const isReport = category !== null;
    // Unread messages clear when the conversation is read, not by dismissing a key.
    const item: Omit<FeedItem, "kind"> = {
      key: `conv:${c.userId}`, category: isReport ? "report" : "message", createdAt: at(c.latestAt), target: { type: "message", id: c.userId },
      title: isReport ? `Problem report from ${c.name}${category && category !== "Other" ? ` · ${category}` : ""}` : c.count > 1 ? `${c.name} sent you ${c.count} messages` : `${c.name} sent you a message`,
      body: clip(body, 200),
    };
    if (!showCategory(item.category)) continue;
    if (filters.clearBefore && new Date(item.createdAt).getTime() <= filters.clearBefore) continue;
    actions.push({ ...item, kind: "action" });
  }

  return finishFeed("admin", [...actions, ...storedUpdates(src.rows, ADMIN_HIDDEN_TITLES)], { inboxUnread: src.inboxUnread });
}

export type TeacherFeedSources = {
  rows: StoredRow[];
  pendingStudents: PersonRow[];
};

const isBookRequest = (row: StoredRow) => String(row.title || "").toLowerCase().includes("student book request");

export function buildTeacherFeed(src: TeacherFeedSources, filters: FeedFilters): FeedResponse & { pendingRequestItems: any[] } {
  const rows = src.rows.filter((row) => !String(row.title || "").toLowerCase().includes("ai quiz pending review"));
  const requests = rows.filter(isBookRequest);
  const actions: FeedItem[] = requests.map((row) => ({
    key: `row:${row.id}`, kind: "action", category: "request", createdAt: at(row.created_at), target: { type: "request", id: row.id },
    title: "Student book request",
    body: clip(row.message || "", 240),
  }));
  for (const s of src.pendingStudents) {
    const key = `user:${s.id}`;
    const createdAt = at(s.created_at);
    if (filters.dismissed.has(key)) continue;
    if (filters.clearBefore && new Date(createdAt).getTime() <= filters.clearBefore) continue;
    actions.push({
      key, kind: "action", category: "student", createdAt, target: { type: "user", id: s.id },
      title: `${nameOf(s)} wants to join your class`,
      body: joinBits(handle(s.username), "Approve them on your dashboard"),
    });
  }
  const feed = finishFeed("teacher", [...actions, ...storedUpdates(rows.filter((row) => !isBookRequest(row)), [])]);
  // Read by the teacher dashboard's book request list.
  const pendingRequestItems = requests.map((row) => ({
    id: row.id,
    bookTitle: String(row.message || "").match(/read "(.+?)"/)?.[1] || String(row.message || "").match(/requested "(.+?)"/)?.[1] || "Book request",
    studentName: String(row.message || "").match(/^(.+?) would like/)?.[1] || String(row.message || "").match(/^(.+?) requested/)?.[1] || "Student",
    messageText: row.message,
    createdAt: row.created_at,
  }));
  return { ...feed, pendingRequestItems };
}

export type MemberFeedSources = {
  role: "student" | "parent";
  rows: StoredRow[];
  unreadMessages: { id: number; messageText?: string | null; createdAt?: string | null }[];
};

export function buildMemberFeed(src: MemberFeedSources): FeedResponse {
  const rows = src.rows.filter((row) => !String(row.title || "").toLowerCase().includes("ai quiz pending review"));
  const messages: FeedItem[] = src.unreadMessages.map((m) => ({
    key: `msg:${m.id}`, kind: "update", category: "message", createdAt: at(m.createdAt), target: { type: "message", id: m.id },
    title: "New message",
    body: clip(m.messageText || "Open your messages", 240),
  }));
  return finishFeed(src.role, [...messages, ...storedUpdates(rows, [])]);
}

/** What a key from the bell points at, for marking it read or dismissing it. */
export type KeyAction =
  | { kind: "row"; id: number }
  | { kind: "message"; id: number }
  | { kind: "conversation"; userId: number }
  | { kind: "dismiss"; key: string }
  | { kind: "none" };

export function keyAction(key: unknown): KeyAction {
  const text = String(key ?? "").trim();
  const match = /^([a-z_-]+):(\d+)$/.exec(text);
  if (!match) return { kind: "none" };
  const id = Number(match[2]);
  if (!Number.isSafeInteger(id) || id <= 0) return { kind: "none" };
  if (match[1] === "row") return { kind: "row", id };
  if (match[1] === "msg") return { kind: "message", id };
  if (match[1] === "conv") return { kind: "conversation", userId: id };
  return { kind: "dismiss", key: text };
}

/** Requests from older pages ({ itemType, id } or just { id }) as a key. */
export function legacyKey(body: any, role: "admin" | "teacher" | "member"): string | null {
  const id = Number(body?.id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const itemType = String(body?.itemType || "");
  if (!itemType || itemType === "generic") return `row:${id}`;
  if (itemType === "message") return `msg:${id}`;
  if (itemType === "request" && role === "teacher") return `row:${id}`;
  return `${itemType}:${id}`;
}
