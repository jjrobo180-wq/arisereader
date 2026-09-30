import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const routesPath = resolve(process.cwd(), "server/routes.ts");
const adminPath = resolve(process.cwd(), "client/src/pages/Admin.tsx");

let routes = readFileSync(routesPath, "utf8");
const startMarker = "  // Notification endpoints\n";
const endMarker = "  // Announcement (public to authenticated users)\n";
const start = routes.indexOf(startMarker);
const end = routes.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error("Could not locate notification route block");

const replacement = `  // Notification endpoints v2 — per-user, individually dismissible, and consistent across roles
  const notifSeenKey = (type: string, userId: number) => \`${'${type}'}_user_${'${userId}'}\`;
  const notifDismissedSetting = (userId: number) => \`notification_dismissed_${'${userId}'}\`;
  const getDismissedNotifications = async (userId: number): Promise<Set<string>> => {
    try {
      const raw = await storage.getSetting(notifDismissedSetting(userId));
      const values = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(values) ? values.map(String) : []);
    } catch { return new Set<string>(); }
  };
  const dismissNotificationKey = async (userId: number, key: string) => {
    const dismissed = await getDismissedNotifications(userId);
    dismissed.add(key);
    await storage.upsertSetting(notifDismissedSetting(userId), JSON.stringify(Array.from(dismissed).slice(-500)));
  };

  app.get("/api/notifications", authMiddleware, async (req: any, res) => {
    try {
      res.set("Cache-Control", "no-store");
      const userId = Number(req.user.id);
      const dismissed = await getDismissedNotifications(userId);

      const { data: genericRows } = await supabase
        .from("notifications")
        .select("id, user_id, type, title, message, read, created_at")
        .eq("user_id", userId)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(30);
      const generic = (genericRows || []).filter((n: any) => !dismissed.has(\`generic:${'${n.id}'}\`));

      if (req.user.isAdmin) {
        const [reqSeenAt, usersSeenAt, teachersSeenAt, parentsSeenAt, aiSeenAt] = await Promise.all([
          storage.getNotifSeenAt(notifSeenKey("quiz_requests", userId)),
          storage.getNotifSeenAt(notifSeenKey("new_users", userId)),
          storage.getNotifSeenAt(notifSeenKey("pending_teachers", userId)),
          storage.getNotifSeenAt(notifSeenKey("pending_parents", userId)),
          storage.getNotifSeenAt(notifSeenKey("ai_quiz_pending", userId)),
        ]);

        const quizRequests = await storage.getQuizRequests();
        const pendingReqs = quizRequests.filter((r: any) =>
          r.status === "pending" &&
          (!reqSeenAt || new Date(r.createdAt) > new Date(reqSeenAt)) &&
          !dismissed.has(\`request:${'${r.id}'}\`)
        );

        const allUsers = await storage.getAllUsers();
        const userCutoff = usersSeenAt ? new Date(usersSeenAt) : new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        const newUsersList = allUsers.filter((u: any) =>
          (u.role === "student" || !u.role) &&
          new Date(u.createdAt) > userCutoff &&
          !dismissed.has(\`user:${'${u.id}'}\`)
        );

        const { data: allTeacherRows } = await supabase
          .from("users")
          .select("id, display_name, username, role, account_approved, email, created_at")
          .eq("role", "teacher")
          .order("created_at", { ascending: false });
        const pendingTeachersList = (allTeacherRows || []).filter((t: any) =>
          !t.account_approved &&
          (!teachersSeenAt || new Date(t.created_at) > new Date(teachersSeenAt)) &&
          !dismissed.has(\`teacher:${'${t.id}'}\`)
        );

        const { data: allParentRows } = await supabase
          .from("users")
          .select("id, display_name, username, role, account_approved, email, created_at")
          .eq("role", "parent")
          .order("created_at", { ascending: false });
        const pendingParentsList = (allParentRows || []).filter((p: any) =>
          !p.account_approved &&
          (!parentsSeenAt || new Date(p.created_at) > new Date(parentsSeenAt)) &&
          !dismissed.has(\`parent:${'${p.id}'}\`)
        );

        const { data: pendingAIList } = await supabase
          .from("pending_ai_quizzes")
          .select("id, book_title, author, student_id, quiz_type, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        const pendingAIItems = (pendingAIList || []).filter((r: any) =>
          (!aiSeenAt || new Date(r.created_at) > new Date(aiSeenAt)) &&
          !dismissed.has(\`ai_quiz:${'${r.id}'}\`)
        );
        const aiStudentMap: Record<number, string> = {};
        if (pendingAIItems.length) {
          const studentIds = [...new Set(pendingAIItems.map((r: any) => r.student_id))];
          const { data: aiStudents } = await supabase.from("users").select("id, display_name").in("id", studentIds);
          (aiStudents || []).forEach((s: any) => { aiStudentMap[s.id] = s.display_name; });
        }

        // Generic rows are real notification records (club sign-ups, system notices, etc.).
        // Avoid double-listing book requests, which already have a richer derived item above.
        const genericItems = generic.filter((n: any) => n.title !== "Student book request");
        const unreadCount = pendingReqs.length + newUsersList.length + pendingTeachersList.length + pendingParentsList.length + pendingAIItems.length + genericItems.length;

        return res.json({
          unreadCount,
          type: "admin",
          pendingRequestItems: pendingReqs.map((r: any) => ({ id: r.id, bookTitle: r.bookTitle, author: r.author, studentName: r.studentName, createdAt: r.createdAt })),
          newUserItems: newUsersList.map((u: any) => ({ id: u.id, displayName: u.displayName, username: u.username, createdAt: u.createdAt })),
          pendingTeacherItems: pendingTeachersList.map((t: any) => ({ id: t.id, displayName: t.display_name, username: t.username, email: t.email, createdAt: t.created_at })),
          pendingParentItems: pendingParentsList.map((p: any) => ({ id: p.id, displayName: p.display_name, username: p.username, email: p.email, createdAt: p.created_at })),
          pendingAIQuizItems: pendingAIItems.map((r: any) => ({ id: r.id, bookTitle: r.book_title, author: r.author, studentName: aiStudentMap[r.student_id] || "Unknown", quizType: r.quiz_type, createdAt: r.created_at })),
          genericItems: genericItems.map((n: any) => ({ id: n.id, title: n.title, messageText: n.message, notificationType: n.type, createdAt: n.created_at })),
        });
      }

      if (req.user.role === "teacher") {
        const teacherId = userId;
        const { data: bookRequestNotifs } = await supabase
          .from("notifications")
          .select("id, message, created_at, read")
          .eq("user_id", teacherId)
          .eq("title", "Student book request")
          .eq("read", false)
          .order("created_at", { ascending: false })
          .limit(30);

        const linksRaw = await storage.getSetting("teacher_students");
        let studentIds: number[] = [];
        if (linksRaw) { try { const links = JSON.parse(linksRaw); studentIds = links[String(teacherId)] || []; } catch {} }

        const aiSeenAt = await storage.getNotifSeenAt(notifSeenKey("ai_quiz_pending", teacherId));
        let pendingAIItems: any[] = [];
        if (studentIds.length) {
          const { data: pendingAIList } = await supabase
            .from("pending_ai_quizzes")
            .select("id, book_title, author, student_id, quiz_type, created_at")
            .eq("status", "pending")
            .in("student_id", studentIds)
            .order("created_at", { ascending: false });
          pendingAIItems = (pendingAIList || []).filter((r: any) =>
            (!aiSeenAt || new Date(r.created_at) > new Date(aiSeenAt)) && !dismissed.has(\`ai_quiz:${'${r.id}'}\`)
          );
          if (pendingAIItems.length) {
            const ids = [...new Set(pendingAIItems.map((r: any) => r.student_id))];
            const { data: students } = await supabase.from("users").select("id, display_name").in("id", ids);
            const names: Record<number, string> = {};
            (students || []).forEach((s: any) => { names[s.id] = s.display_name; });
            pendingAIItems = pendingAIItems.map((r: any) => ({ ...r, studentName: names[r.student_id] || "Unknown" }));
          }
        }

        const studentsSeenAt = await storage.getNotifSeenAt(notifSeenKey("new_users", teacherId));
        const { data: pendingStudentsData } = await supabase
          .from("users")
          .select("id, display_name, username, created_at")
          .eq("teacher_id", teacherId)
          .eq("approved_by_teacher", false)
          .order("created_at", { ascending: false });
        const pendingStudentItems = (pendingStudentsData || []).filter((s: any) =>
          (!studentsSeenAt || new Date(s.created_at) > new Date(studentsSeenAt)) && !dismissed.has(\`user:${'${s.id}'}\`)
        );
        const genericItems = generic.filter((n: any) => n.title !== "Student book request");
        const requestItems = (bookRequestNotifs || []).filter((n: any) => !dismissed.has(\`request:${'${n.id}'}\`));

        return res.json({
          unreadCount: requestItems.length + pendingAIItems.length + pendingStudentItems.length + genericItems.length,
          type: "teacher",
          pendingRequestItems: requestItems.map((n: any) => ({
            id: n.id,
            bookTitle: n.message.match(/read \"(.+?)\"/)?.[1] || n.message.match(/requested \"(.+?)\"/)?.[1] || "Unknown book",
            studentName: n.message.match(/^(.+?) would like/)?.[1] || n.message.match(/^(.+?) requested/)?.[1] || "Student",
            messageText: n.message,
            createdAt: n.created_at,
          })),
          pendingAIQuizItems: pendingAIItems.map((r: any) => ({ id: r.id, bookTitle: r.book_title, author: r.author, studentName: r.studentName, quizType: r.quiz_type, createdAt: r.created_at })),
          newUserItems: pendingStudentItems.map((s: any) => ({ id: s.id, displayName: s.display_name, username: s.username, createdAt: s.created_at })),
          genericItems: genericItems.map((n: any) => ({ id: n.id, title: n.title, messageText: n.message, notificationType: n.type, createdAt: n.created_at })),
        });
      }

      const messages = await storage.getUserMessages(userId);
      const unreadMsgs = messages.filter((m: any) => !m.isRead);
      return res.json({
        unreadCount: unreadMsgs.length + generic.length,
        type: "student",
        messageItems: unreadMsgs.map((m: any) => ({ id: m.id, messageText: m.messageText, createdAt: m.createdAt })),
        genericItems: generic.map((n: any) => ({ id: n.id, title: n.title, messageText: n.message, notificationType: n.type, createdAt: n.created_at })),
      });
    } catch (error: any) {
      console.error("[notifications] load failed:", error?.message);
      res.status(500).json({ message: "Could not load notifications" });
    }
  });

  app.post("/api/notifications/mark-seen", authMiddleware, async (req: any, res) => {
    try {
      const userId = Number(req.user.id);
      const itemType = String(req.body?.itemType || "");
      const legacyType = String(req.body?.type || "");
      const notifId = req.body?.id != null ? Number(req.body.id) : null;
      const clearAll = req.body?.all === true || (!itemType && !legacyType && notifId == null);

      if (clearAll) {
        if (req.user.isAdmin) {
          await Promise.all([
            storage.setNotifSeenAt(notifSeenKey("quiz_requests", userId)),
            storage.setNotifSeenAt(notifSeenKey("new_users", userId)),
            storage.setNotifSeenAt(notifSeenKey("pending_teachers", userId)),
            storage.setNotifSeenAt(notifSeenKey("pending_parents", userId)),
            storage.setNotifSeenAt(notifSeenKey("ai_quiz_pending", userId)),
          ]);
          await supabase.from("notifications").update({ read: true }).eq("user_id", userId);
        } else if (req.user.role === "teacher") {
          await Promise.all([
            storage.setNotifSeenAt(notifSeenKey("new_users", userId)),
            storage.setNotifSeenAt(notifSeenKey("ai_quiz_pending", userId)),
          ]);
          await supabase.from("notifications").update({ read: true }).eq("user_id", userId);
        } else {
          await storage.markAllMessagesRead(userId);
          await supabase.from("notifications").update({ read: true }).eq("user_id", userId);
        }
        return res.json({ message: "Notifications cleared" });
      }

      // Backward compatibility for TeacherDashboard's existing {id} dismiss call.
      if (!itemType && !legacyType && notifId != null && (req.user.role === "teacher" || req.user.isAdmin)) {
        await supabase.from("notifications").update({ read: true }).eq("id", notifId).eq("user_id", userId);
        return res.json({ message: "Notification dismissed" });
      }

      if (itemType && notifId != null) {
        if (itemType === "generic") {
          await supabase.from("notifications").update({ read: true }).eq("id", notifId).eq("user_id", userId);
        } else if (itemType === "message") {
          await storage.markMessageReadById(notifId, userId);
        } else if (itemType === "request" && req.user.role === "teacher" && !req.user.isAdmin) {
          await supabase.from("notifications").update({ read: true }).eq("id", notifId).eq("user_id", userId);
        } else if (["request", "user", "teacher", "parent", "ai_quiz"].includes(itemType)) {
          await dismissNotificationKey(userId, \`${'${itemType}'}:${'${notifId}'}\`);
        }
        return res.json({ message: "Notification dismissed" });
      }

      if (legacyType === "messages") {
        await storage.markAllMessagesRead(userId);
      } else {
        const typeMap: Record<string, string> = {
          quiz_requests: "quiz_requests",
          new_users: "new_users",
          pending_teachers: "pending_teachers",
          pending_parents: "pending_parents",
          ai_quiz_pending: "ai_quiz_pending",
        };
        const mapped = typeMap[legacyType];
        if (mapped) await storage.setNotifSeenAt(notifSeenKey(mapped, userId));
      }
      res.json({ message: "Notifications updated" });
    } catch (error: any) {
      console.error("[notifications] mark-seen failed:", error?.message);
      res.status(500).json({ message: "Failed to update notifications" });
    }
  });

`;

routes = routes.slice(0, start) + replacement + routes.slice(end);
writeFileSync(routesPath, routes);

// Fix admin notification navigation so AI notifications go to the AI review section
// instead of incorrectly jumping to the student table.
let admin = readFileSync(adminPath, "utf8");
admin = admin.replace(
  'const handleNotifNavigate = (type: "request" | "user" | "teacher" | "message", id: number) => {',
  'const handleNotifNavigate = (type: "request" | "user" | "teacher" | "message" | "ai_quiz", id: number) => {'
);
admin = admin.replace(
  '    } else if (type === "teacher") {\n      // Scroll to teachers section\n      teachersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });\n    } else {',
  '    } else if (type === "teacher") {\n      // Scroll to teachers section\n      teachersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });\n    } else if (type === "ai_quiz") {\n      document.querySelector(\'[data-section="ai-quiz-review"]\')?.scrollIntoView({ behavior: "smooth", block: "start" });\n    } else {'
);
writeFileSync(adminPath, admin);

console.log("[notifications] normalized notification routes and admin navigation");
