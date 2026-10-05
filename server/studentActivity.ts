// What a student has been doing: logins, quizzes (online and paper), points and
// where they came from, arcade games and messages, in one timeline for the admin.
// Also lets the admin credit a paper book quiz so it counts exactly like an
// online one (points, the quiz list and unlocking games).
import type { Express, RequestHandler } from "express";
import { getAdminSupabase } from "./supabase";
import { clearCache, storage } from "./storage";
import { GAMES } from "../shared/arcade/catalog";
import { describeDevice } from "../shared/deviceName";

const LOG_CAP = 200;
const logKey = (userId: number) => `login_log_${userId}`;

/** Records a sign-in (kept in settings so no new table is needed). Never throws. */
export async function recordLogin(userId: number, userAgent?: string) {
  try {
    const raw = await storage.getSetting(logKey(userId));
    let list: { at: string; device: string }[] = [];
    if (raw) { try { const v = JSON.parse(raw); if (Array.isArray(v)) list = v; } catch { /* start fresh */ } }
    list.unshift({ at: new Date().toISOString(), device: describeDevice(userAgent) });
    await storage.upsertSetting(logKey(userId), JSON.stringify(list.slice(0, LOG_CAP)));
    clearCache("setting_" + logKey(userId));
  } catch { /* a missed log entry must never block a sign-in */ }
}

export type ActivityKind = "login" | "quiz" | "points" | "game" | "message" | "review" | "proctor";
export type ActivityItem = { at: string; kind: ActivityKind; title: string; detail?: string; points?: number };

const passMark = (total: number) => Math.ceil(total * 0.7);
const gameName = (id: string) => GAMES.find((g) => g.id === id)?.title ?? id.replace(/_/g, " ");

export function registerStudentActivityRoutes(app: Express, auth: RequestHandler, admin: RequestHandler) {
  app.get("/api/admin/students/:id/activity", auth, admin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: "Invalid student." });
    const db = getAdminSupabase();
    try {
      const [userQ, attemptsQ, awardsQ, sessionsQ, matchesQ, messagesQ, reviewsQ, cameraQ, loginRaw] = await Promise.all([
        db.from("users").select("id, display_name, created_at, total_points").eq("id", id).maybeSingle(),
        db.from("attempts").select("id, book_id, score, total, points_earned, completed_at, proctor_type, proctor_name").eq("user_id", id).order("completed_at", { ascending: false }).limit(500),
        db.from("manual_point_awards").select("id, points, reason, earned_on, created_at, awarded_by").eq("student_id", id).order("created_at", { ascending: false }).limit(500),
        db.from("sessions").select("created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(200),
        db.from("club_arise_matches").select("id, game_type, status, player1_id, player2_id, winner_id, updated_at, state").eq("status", "finished").or(`player1_id.eq.${id},player2_id.eq.${id}`).order("updated_at", { ascending: false }).limit(200),
        db.from("messages").select("id, sender_type, message_text, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(100),
        db.from("quiz_reviews").select("id, book_id, status, created_at, reviewed_at").eq("user_id", id).order("created_at", { ascending: false }).limit(100),
        db.from("quiz_integrity_sessions").select("id, quiz_id, status, created_at, submitted_at, flag, flag_reasons, voided, void_reason, leaves, camera_off").eq("student_id", id).order("created_at", { ascending: false }).limit(100),
        storage.getSetting(logKey(id)),
      ]);
      if (!userQ.data) return res.status(404).json({ message: "Student not found." });

      // book titles and the names of whoever awarded points or played against them
      const bookIds = new Set<number>();
      for (const a of attemptsQ.data || []) bookIds.add(Number(a.book_id));
      for (const r of reviewsQ.data || []) bookIds.add(Number(r.book_id));
      for (const c of cameraQ.data || []) bookIds.add(Number(c.quiz_id));
      const userIds = new Set<number>();
      for (const a of awardsQ.data || []) userIds.add(Number(a.awarded_by));
      for (const m of matchesQ.data || []) { userIds.add(Number(m.player1_id)); if (m.player2_id) userIds.add(Number(m.player2_id)); }
      const [booksQ, peopleQ] = await Promise.all([
        bookIds.size ? db.from("books").select("id, title, points_value").in("id", [...bookIds].filter((b) => b > 0)) : Promise.resolve({ data: [] as any[] }),
        userIds.size ? db.from("users").select("id, display_name, username").in("id", [...userIds]) : Promise.resolve({ data: [] as any[] }),
      ]);
      const book = new Map<number, any>((booksQ.data || []).map((b: any) => [Number(b.id), b]));
      const person = new Map<number, string>((peopleQ.data || []).map((p: any) => [Number(p.id), p.display_name || p.username]));
      const title = (bookId: number) => book.get(bookId)?.title ?? (bookId > 0 ? `Book #${bookId}` : "Quiz");

      const items: ActivityItem[] = [];

      // sign-ins: the log kept from now on, plus older sessions still on record
      let logins: { at: string; device: string }[] = [];
      if (loginRaw) { try { const v = JSON.parse(loginRaw); if (Array.isArray(v)) logins = v; } catch { /* ignore */ } }
      const seen = logins.map((l) => Date.parse(l.at));
      for (const l of logins) items.push({ at: l.at, kind: "login", title: "Signed in", detail: l.device });
      for (const s of sessionsQ.data || []) {
        const t = Date.parse(s.created_at);
        if (!seen.some((x) => Math.abs(x - t) < 10_000)) items.push({ at: s.created_at, kind: "login", title: "Signed in" });
      }

      for (const a of attemptsQ.data || []) {
        const total = Number(a.total) || 0, score = Number(a.score) || 0, pts = Number(a.points_earned) || 0;
        const passed = total > 0 && score >= passMark(total);
        const how = a.proctor_type === "paper" ? (a.proctor_name || "Paper quiz entered by staff")
          : a.proctor_type === "camera" ? "Online · on their own with the camera on"
            : a.proctor_type === "parent" ? `Online · parent proctored${a.proctor_name ? ` by ${a.proctor_name}` : ""}`
              : a.proctor_type === "teacher" ? `Online · teacher proctored${a.proctor_name ? ` by ${a.proctor_name}` : ""}`
                : "Online";
        items.push({
          at: a.completed_at, kind: "quiz",
          title: `${passed ? "Passed" : "Did not pass"} the quiz for ${title(Number(a.book_id))}`,
          detail: `${score}/${total} (${total ? Math.round((score / total) * 100) : 0}%) · ${how}${passed ? (pts ? ` · earned ${pts} points` : "") : " · no points (70% needed)"}`,
          points: pts || undefined,
        });
      }

      for (const w of awardsQ.data || []) {
        const by = person.get(Number(w.awarded_by));
        const auto = /quick challenge/i.test(w.reason);
        items.push({
          at: w.created_at, kind: "points",
          title: `+${w.points} points: ${w.reason}`,
          detail: auto ? "Earned by finishing the Daily Quick Challenge" : `Added by ${by ?? "staff"} · counted for ${w.earned_on}`,
          points: Number(w.points),
        });
      }

      for (const m of matchesQ.data || []) {
        if (m.state?.adminPreview) continue;
        const other = Number(m.player1_id) === id ? Number(m.player2_id) : Number(m.player1_id);
        const vs = other ? person.get(other) : null;
        const result = !m.winner_id ? "Draw" : Number(m.winner_id) === id ? "Won" : "Lost";
        items.push({ at: m.updated_at, kind: "game", title: `Played ${gameName(String(m.game_type))}`, detail: `${result}${vs ? ` against ${vs}` : other ? "" : " against the computer"}` });
      }

      for (const msg of messagesQ.data || []) {
        const fromStudent = msg.sender_type === "student";
        const text = String(msg.message_text || "");
        items.push({ at: msg.created_at, kind: "message", title: fromStudent ? "Sent a message" : "Received a message", detail: text.length > 120 ? text.slice(0, 117) + "…" : text });
      }

      for (const r of reviewsQ.data || []) items.push({ at: r.created_at, kind: "review", title: `Asked for a quiz review: ${title(Number(r.book_id))}`, detail: `Status: ${r.status}` });

      for (const c of cameraQ.data || []) {
        const flags = Array.isArray(c.flag_reasons) ? c.flag_reasons.filter((x: any) => typeof x === "string") : [];
        const bits = [c.status === "submitted" ? "Submitted" : c.status === "expired" ? "Ran out of time" : "Started"];
        if (c.flag && c.flag !== "clear") bits.push(`flagged for ${c.flag === "high" ? "close review" : "review"}${flags.length ? `: ${flags.join(", ")}` : ""}`);
        if (c.voided) bits.push(`voided${c.void_reason ? ` (${c.void_reason})` : ""}`);
        items.push({ at: c.created_at, kind: "proctor", title: `Camera quiz session: ${title(Number(c.quiz_id))}`, detail: bits.join(" · ") });
      }

      items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

      // where the points came from
      const quizPoints = (attemptsQ.data || []).filter((a: any) => a.proctor_type !== "paper").reduce((s: number, a: any) => s + (Number(a.points_earned) || 0), 0);
      const paperPoints = (attemptsQ.data || []).filter((a: any) => a.proctor_type === "paper").reduce((s: number, a: any) => s + (Number(a.points_earned) || 0), 0);
      const challengePoints = (awardsQ.data || []).filter((w: any) => /quick challenge/i.test(w.reason)).reduce((s: number, w: any) => s + Number(w.points || 0), 0);
      const manualPoints = (awardsQ.data || []).reduce((s: number, w: any) => s + Number(w.points || 0), 0) - challengePoints;
      const loginTimes = items.filter((i) => i.kind === "login").map((i) => Date.parse(i.at));
      const week = Date.now() - 7 * 86_400_000;
      res.json({
        summary: {
          joined: userQ.data.created_at,
          totalPoints: Number(userQ.data.total_points) || 0,
          lastLogin: loginTimes.length ? new Date(Math.max(...loginTimes)).toISOString() : null,
          loginsThisWeek: loginTimes.filter((t) => t >= week).length,
          quizzesPassed: (attemptsQ.data || []).filter((a: any) => Number(a.total) > 0 && Number(a.score) >= passMark(Number(a.total))).length,
          quizzesTaken: (attemptsQ.data || []).length,
          gamesPlayed: items.filter((i) => i.kind === "game").length,
          points: { onlineQuizzes: quizPoints, paperQuizzes: paperPoints, addedByStaff: manualPoints, dailyChallenge: challengePoints },
        },
        items: items.slice(0, 400),
      });
    } catch (e: any) {
      res.status(500).json({ message: "Could not load this student's activity." });
    }
  });

  /**
   * Credits a book quiz taken on paper. It's saved as a real quiz result, so it
   * earns the book's points, shows in their quiz list and unlocks games, exactly
   * like a quiz taken on the computer.
   */
  app.post("/api/admin/students/:id/book-quiz-credit", auth, admin, async (req: any, res) => {
    const id = Number(req.params.id), bookId = Number(req.body?.bookId);
    const score = Number(req.body?.score), total = Number(req.body?.total);
    const takenOn = String(req.body?.takenOn || "");
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(takenOn) && !Number.isNaN(Date.parse(`${takenOn}T12:00:00Z`));
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(bookId) || bookId < 1) return res.status(400).json({ message: "Choose a student and a book." });
    if (!Number.isSafeInteger(total) || total < 1 || total > 100 || !Number.isSafeInteger(score) || score < 0 || score > total) return res.status(400).json({ message: "Enter the number correct and the number of questions." });
    if (!validDate) return res.status(400).json({ message: "Enter the date the quiz was taken." });
    const db = getAdminSupabase();
    const student = await storage.getUser(id);
    if (!student || student.isAdmin || (student.role && student.role !== "student")) return res.status(404).json({ message: "Student not found." });
    const { data: bk } = await db.from("books").select("id, title, points_value").eq("id", bookId).maybeSingle();
    if (!bk) return res.status(404).json({ message: "Book not found." });

    const passed = score >= passMark(total);
    const points = passed ? Number(bk.points_value) || 0 : 0;
    // today means right now (so it unlocks games this week); an earlier date is stamped at midday
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Denver" });
    const completedAt = takenOn === today ? new Date().toISOString() : new Date(`${takenOn}T18:00:00Z`).toISOString();
    const staff = req.user?.displayName || req.user?.username || "staff";
    const row = { score, total, points_earned: points, completed_at: completedAt, proctor_type: "paper", proctor_user_id: req.user?.id ?? null, proctor_name: `Paper quiz entered by ${staff}` };

    const { data: existing } = await db.from("attempts").select("id, score, total, points_earned").eq("user_id", id).eq("book_id", bookId).maybeSingle();
    let previousPoints = 0;
    if (existing) {
      previousPoints = Number(existing.points_earned) || 0;
      if (previousPoints > 0) return res.status(409).json({ message: `${student.displayName} already passed the quiz for ${bk.title}.` });
      const { error } = await db.from("attempts").update(row).eq("id", existing.id);
      if (error) return res.status(500).json({ message: "Could not save the quiz." });
    } else {
      const { error } = await db.from("attempts").insert({ user_id: id, book_id: bookId, answers: null, ...row });
      if (error) return res.status(500).json({ message: "Could not save the quiz." });
    }
    if (points > previousPoints) {
      const { data: u } = await db.from("users").select("total_points").eq("id", id).single();
      await db.from("users").update({ total_points: Math.round((Number(u?.total_points || 0) + points - previousPoints) * 10) / 10 }).eq("id", id);
    }
    for (const c of ["allUsers", "leaderboard", "monthlyLeaderboard", "advisoryLeaderboard", "session_"]) clearCache(c);
    res.status(201).json({
      passed, points, title: bk.title,
      message: passed ? `${bk.title}: ${score}/${total} saved. ${student.displayName} earned ${points} points and it counts as a passed quiz.` : `${bk.title}: ${score}/${total} saved. That's under 70%, so no points and it doesn't unlock games.`,
    });
  });
}
