// The notification bell's feed: what shows, what clears by itself, and what each key does.
// Run with: npx tsx --test tests/notification-feed.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAdminFeed, buildMemberFeed, buildTeacherFeed, isProblemReport, keyAction, legacyKey, splitReport,
  type AdminFeedSources, type FeedFilters,
} from "../server/notificationFeed";
import { describeStoredType, parseAlertType } from "../shared/notifications";

const T = (mins: number) => new Date(Date.parse("2026-10-04T18:00:00Z") - mins * 60_000).toISOString();

const empty = (): AdminFeedSources => ({
  rows: [], pendingTeachers: [], pendingParents: [], waitingStudents: [], unlisted: [], aiQuizzes: [], quizRequests: [],
  reviewRequests: [], clubSignups: [], gradeChanges: [], eyeGazeRequests: [], conversations: [], inboxUnread: 0,
});
const open: FeedFilters = { dismissed: new Set(), clearBefore: 0 };

test("every kind of waiting work becomes an action item that links to it", () => {
  const src = empty();
  src.pendingTeachers = [{ id: 24, display_name: "Ms. Rivera", username: "ms.rivera", email: "r@lincoln.edu", created_at: T(90) }];
  src.pendingParents = [{ id: 35, display_name: "Pat", username: "pat", created_at: T(80) }];
  src.aiQuizzes = [{ id: 91, book_title: "Holes", quiz_type: "eye_gaze", student_name: "Ana", created_at: T(20) }];
  src.quizRequests = [{ id: 71, bookTitle: "Wild Robot", author: "Peter Brown", studentName: "Ana", createdAt: T(30) }];
  src.reviewRequests = [{ id: 81, studentName: "Zoe", bookTitle: "Holes", original_score: 6, total: 10, created_at: T(70) }];
  src.clubSignups = [{ id: 61, student_name: "Ana", grade: "5", created_at: T(200) }];
  src.gradeChanges = [{ id: 41, displayName: "Ana", oldGrade: "5", newGrade: "6", newBand: "6-8", requestedAt: T(10) }];
  src.eyeGazeRequests = [{ id: 42, displayName: "Jordan", requestedStatus: true, createdAt: T(5) }];
  src.unlisted = [{ userId: 15, displayName: "Jordan", schoolName: "Lincoln", createdAt: T(300) }];
  const feed = buildAdminFeed(src, open);
  assert.equal(feed.type, "admin");
  assert.equal(feed.actionCount, 9);
  assert.equal(feed.updateCount, 0);
  const byKey = Object.fromEntries(feed.items.map((i) => [i.key, i]));
  assert.deepEqual(byKey["teacher:24"].target, { type: "teacher", id: 24 });
  assert.deepEqual(byKey["ai_quiz:91"].target, { type: "ai_quiz", id: 91 });
  assert.match(byKey["ai_quiz:91"].body, /Eye Gazer quiz/);
  assert.deepEqual(byKey["request:71"].target, { type: "request", id: 71 });
  assert.match(byKey["review:81"].body, /Score 6\/10/);
  assert.match(byKey["grade_change:41"].body, /Grade 5 → Grade 6 \(6-8 band\)/);
  assert.match(byKey["eye_gaze:42"].title, /on$/);
  assert.match(byKey["unlisted:15"].body, /school “Lincoln”/);
  // newest first
  assert.deepEqual(feed.items.slice(0, 2).map((i) => i.key), ["eye_gaze:42", "grade_change:41"]);
});

test("students waiting on a teacher are one item, which comes back when someone new joins the wait", () => {
  const src = empty();
  src.waitingStudents = [
    { id: 13, display_name: "Marcus", username: "marcus", teacher_name: "Mr. J", created_at: T(60) },
    { id: 16, display_name: "Lia", username: "lia", teacher_name: "Gabby", created_at: T(5) },
  ];
  const feed = buildAdminFeed(src, open);
  assert.equal(feed.actionCount, 1);
  assert.equal(feed.items[0].key, "students-waiting:16");
  assert.equal(feed.items[0].title, "2 students are waiting for a teacher's OK");
  assert.match(feed.items[0].body, /Newest: Lia · Teacher: Gabby/);
  const dismissed = buildAdminFeed(src, { ...open, dismissed: new Set(["students-waiting:16"]) });
  assert.equal(dismissed.actionCount, 0);
  src.waitingStudents.push({ id: 17, display_name: "Kai", created_at: T(1) });
  assert.equal(buildAdminFeed(src, { ...open, dismissed: new Set(["students-waiting:16"]) }).actionCount, 1);
});

test("unread messages are one item per person and problem reports are called out", () => {
  const src = empty();
  src.conversations = [
    { userId: 11, name: "Ana", count: 2, latestText: "Can you add Dog Man?", latestAt: T(12) },
    { userId: 14, name: "Zoe", count: 1, latestText: "[REPORT A PROBLEM - Bug/Error]\nThe quiz froze", latestAt: T(48) },
  ];
  src.inboxUnread = 3;
  const feed = buildAdminFeed(src, open);
  assert.equal(feed.inboxUnread, 3);
  assert.equal(feed.items[0].title, "Ana sent you 2 messages");
  assert.equal(feed.items[0].category, "message");
  assert.equal(feed.items[1].title, "Problem report from Zoe · Bug/Error");
  assert.equal(feed.items[1].category, "report");
  assert.equal(feed.items[1].body, "The quiz froze");
  assert.deepEqual(feed.items[1].target, { type: "message", id: 14 });
  // a message item is cleared by reading it, so dismissing its key does nothing
  assert.equal(buildAdminFeed(src, { ...open, dismissed: new Set(["conv:11"]) }).actionCount, 2);
});

test("dismissed items and items older than Clear all stay hidden; newer ones show", () => {
  const src = empty();
  src.quizRequests = [
    { id: 1, bookTitle: "Old", createdAt: T(120) },
    { id: 2, bookTitle: "Dismissed", createdAt: T(10) },
    { id: 3, bookTitle: "New", createdAt: T(1) },
  ];
  const feed = buildAdminFeed(src, { dismissed: new Set(["request:2"]), clearBefore: Date.parse(T(60)) });
  assert.deepEqual(feed.items.map((i) => i.key), ["request:3"]);
});

test("the admin's in-bell switches hide whole categories", () => {
  const src = empty();
  src.aiQuizzes = [{ id: 91, book_title: "Holes", created_at: T(20) }];
  src.conversations = [{ userId: 11, name: "Ana", count: 1, latestText: "hi", latestAt: T(12) }];
  src.gradeChanges = [{ id: 41, displayName: "Ana", requestedAt: T(10) }];
  const feed = buildAdminFeed(src, { ...open, inApp: (event) => event !== "ai_quiz_review" && event !== "approval_request" });
  assert.deepEqual(feed.items.map((i) => i.key), ["conv:11"]);
});

test("stored notifications are updates; old ones the bell now shows live are hidden for the admin", () => {
  const src = empty();
  src.rows = [
    { id: 1201, type: "alert:quiz_completed:u14", title: "Quiz taken: Zoe scored 9/10", message: "Passed", created_at: T(8) },
    { id: 1200, type: "alert:teacher_signup:u24", title: "New teacher joined: Ms. Rivera", message: "@ms.rivera", created_at: T(300) },
    { id: 1199, type: "info", title: "AI Quiz Pending Review", message: "old", created_at: T(400) },
    { id: 1198, type: "info", title: "Reading Club Sign-Up", message: "old", created_at: T(500) },
    { id: 1197, type: "success", title: "Plan updated", message: "", created_at: T(600) },
  ];
  const feed = buildAdminFeed(src, open);
  assert.deepEqual(feed.items.map((i) => i.key), ["row:1201", "row:1200", "row:1197"]);
  assert.equal(feed.items[0].kind, "update");
  assert.equal(feed.items[0].category, "quiz");
  assert.deepEqual(feed.items[0].target, { type: "student", id: 14 });
  assert.deepEqual(feed.items[1].target, { type: "teacher", id: 24 });
  assert.equal(feed.items[2].category, "success");
  assert.equal(feed.unreadCount, 3);
});

test("a teacher sees book requests and students to approve as actions, other notifications as updates", () => {
  const feed = buildTeacherFeed({
    rows: [
      { id: 9, type: "info", title: "Student book request", message: 'Ana would like to read "Holes" by Louis Sachar. Can you help them find this book?', created_at: T(5) },
      { id: 8, type: "info", title: "AI Quiz Pending Review", message: "x", created_at: T(6) },
      { id: 7, type: "info", title: "Proctor password changed", message: "y", created_at: T(7) },
    ],
    pendingStudents: [{ id: 13, display_name: "Marcus", username: "marcus", created_at: T(30) }],
  }, open);
  assert.deepEqual(feed.items.map((i) => [i.key, i.kind]), [["row:9", "action"], ["user:13", "action"], ["row:7", "update"]]);
  assert.deepEqual(feed.items[0].target, { type: "request", id: 9 });
  assert.deepEqual(feed.pendingRequestItems[0], { id: 9, bookTitle: "Holes", studentName: "Ana", messageText: 'Ana would like to read "Holes" by Louis Sachar. Can you help them find this book?', createdAt: T(5) });
});

test("students and parents see unread messages and their notifications", () => {
  const feed = buildMemberFeed({
    role: "student",
    rows: [{ id: 5, type: "success", title: "Quiz Approved!", message: "Ready to take", created_at: T(2) }],
    unreadMessages: [{ id: 77, messageText: "Great job this week!", createdAt: T(1) }],
  });
  assert.deepEqual(feed.items.map((i) => i.key), ["msg:77", "row:5"]);
  assert.equal(feed.unreadCount, 2);
  assert.deepEqual(feed.items[0].target, { type: "message", id: 77 });
});

test("keys say what reading or dismissing an item does", () => {
  assert.deepEqual(keyAction("row:12"), { kind: "row", id: 12 });
  assert.deepEqual(keyAction("msg:7"), { kind: "message", id: 7 });
  assert.deepEqual(keyAction("conv:11"), { kind: "conversation", userId: 11 });
  assert.deepEqual(keyAction("teacher:24"), { kind: "dismiss", key: "teacher:24" });
  assert.deepEqual(keyAction("students-waiting:16"), { kind: "dismiss", key: "students-waiting:16" });
  assert.deepEqual(keyAction("grade_change:41"), { kind: "dismiss", key: "grade_change:41" });
  for (const bad of ["", "row:", "row:-1", "row:abc", "DROP TABLE", "row:1:2", null, 5]) assert.deepEqual(keyAction(bad), { kind: "none" }, String(bad));
});

test("requests from older pages still work, including a bare id from the teacher dashboard", () => {
  assert.equal(legacyKey({ id: 9 }, "teacher"), "row:9");
  assert.equal(legacyKey({ itemType: "generic", id: 3 }, "admin"), "row:3");
  assert.equal(legacyKey({ itemType: "message", id: 4 }, "member"), "msg:4");
  assert.equal(legacyKey({ itemType: "request", id: 5 }, "teacher"), "row:5");
  assert.equal(legacyKey({ itemType: "request", id: 5 }, "admin"), "request:5");
  assert.equal(legacyKey({ itemType: "teacher" }, "admin"), null);
});

test("problem reports are recognized by their label", () => {
  assert.equal(isProblemReport("[REPORT A PROBLEM - Suggestion]\nAdd dark mode"), true);
  assert.equal(isProblemReport("Hello"), false);
  assert.deepEqual(splitReport("[REPORT A PROBLEM]\nBroken"), { category: "Other", body: "Broken" });
  assert.deepEqual(splitReport("plain"), { category: null, body: "plain" });
});

test("alert types are read back into a category and a link", () => {
  assert.deepEqual(parseAlertType("alert:quiz_completed:u12"), { event: "quiz_completed", ref: "u12" });
  assert.equal(parseAlertType("info"), null);
  assert.deepEqual(describeStoredType("alert:parent_signup:u31"), { category: "signup", target: { type: "parent", id: 31 } });
  assert.deepEqual(describeStoredType("alert:approval_request"), { category: "reward" });
  assert.deepEqual(describeStoredType("info"), { category: "info" });
});
