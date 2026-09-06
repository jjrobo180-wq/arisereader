import type { Express } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
import { seedData } from "./storage";
import { supabase } from "./supabase";
import bcrypt from "bcryptjs";

// Email helper using Resend REST API
// Supports both direct API key and custom-cred proxy (for published sites)

function gradeToBand(grade: string): string | null {
  const g = grade.toUpperCase().trim();
  if (["K", "1", "2"].includes(g)) return "K-2";
  if (["3", "4", "5"].includes(g)) return "3-5";
  if (["6", "7", "8"].includes(g)) return "6-8";
  if (["9", "10", "11", "12"].includes(g)) return "9-12";
  return null;
}
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const PROXY_URL = process.env.CUSTOM_CRED_API_RESEND_COM_URL || "";
const PROXY_TOKEN = process.env.CUSTOM_CRED_API_RESEND_COM_TOKEN || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "A.R.I.S.E Reader <onboarding@resend.dev>";
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "jjrobo180@gmail.com";
const APP_URL = process.env.APP_URL || "https://arisereader.pplx.app";

async function sendEmail(to: string, subject: string, html: string): Promise<{ sent: boolean; error?: string }> {
  const hasProxy = PROXY_URL && PROXY_TOKEN;
  const hasDirect = RESEND_API_KEY;
  if (!hasProxy && !hasDirect) {
    return { sent: false, error: "No email API key configured" };
  }
  try {
    const apiUrl = hasProxy ? PROXY_URL + "/emails" : "https://api.resend.com/emails";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (hasProxy) {
      headers["x-api-key"] = PROXY_TOKEN;
    } else {
      headers["Authorization"] = `Bearer ${RESEND_API_KEY}`;
    }
    const res = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: to,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { sent: false, error: `Email API error ${res.status}: ${err}` };
    }
    return { sent: true };
  } catch (e: any) {
    return { sent: false, error: e.message };
  }
}

function teacherApprovedEmail(displayName: string, username: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 40px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #FF5900; font-size: 28px; margin: 0;">A.R.I.S.E Reader</h1>
        <p style="color: #999; margin: 5px 0 0 0;">Read a book. Take a quiz. Earn points.</p>
      </div>
      <h2 style="color: #FF5900; font-size: 22px;">Your Teacher Account is Approved!</h2>
      <p style="color: #ccc; font-size: 16px; line-height: 1.6;">Hi ${displayName},</p>
      <p style="color: #ccc; font-size: 16px; line-height: 1.6;">Your teacher account on A.R.I.S.E Reader has been approved. You can now log in and start managing your students.</p>
      <div style="background: #2a2a2a; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <p style="color: #999; margin: 0 0 5px 0; font-size: 14px;">Your username:</p>
        <p style="color: #FF5900; font-size: 18px; margin: 0; font-weight: bold;">${username}</p>
      </div>
      <a href="${APP_URL}" style="display: inline-block; background: #FF5900; color: #fff; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-size: 16px; font-weight: bold; margin: 20px 0;">Log In Now</a>
      <p style="color: #666; font-size: 14px; margin-top: 30px;">If you didn't create this account, please ignore this email.</p>
    </div>
  `;
}

function teacherSignupNotifyEmail(displayName: string, username: string, email: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 40px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #FF5900; font-size: 28px; margin: 0;">A.R.I.S.E Reader</h1>
      </div>
      <h2 style="color: #FF5900; font-size: 22px;">New Teacher Signup</h2>
      <p style="color: #ccc; font-size: 16px; line-height: 1.6;">A new teacher has requested an account:</p>
      <div style="background: #2a2a2a; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <p style="color: #999; margin: 0 0 5px 0; font-size: 14px;">Name: <span style="color: #fff;">${displayName}</span></p>
        <p style="color: #999; margin: 0 0 5px 0; font-size: 14px;">Username: <span style="color: #fff;">${username}</span></p>
        <p style="color: #999; margin: 0; font-size: 14px;">Email: <span style="color: #fff;">${email}</span></p>
      </div>
      <a href="${APP_URL}" style="display: inline-block; background: #FF5900; color: #fff; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-size: 16px; font-weight: bold;">Review in Admin Dashboard</a>
    </div>
  `;
}

function teacherCreatedEmail(displayName: string, username: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 40px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #FF5900; font-size: 28px; margin: 0;">A.R.I.S.E Reader</h1>
        <p style="color: #999; margin: 5px 0 0 0;">Read a book. Take a quiz. Earn points.</p>
      </div>
      <h2 style="color: #FF5900; font-size: 22px;">Your Teacher Account is Ready</h2>
      <p style="color: #ccc; font-size: 16px; line-height: 1.6;">Hi ${displayName},</p>
      <p style="color: #ccc; font-size: 16px; line-height: 1.6;">An administrator has created a teacher account for you on A.R.I.S.E Reader. Your account is approved and ready to use.</p>
      <div style="background: #2a2a2a; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <p style="color: #999; margin: 0 0 5px 0; font-size: 14px;">Your username:</p>
        <p style="color: #FF5900; font-size: 18px; margin: 0; font-weight: bold;">${username}</p>
      </div>
      <p style="color: #999; font-size: 14px; margin: 15px 0;">Please contact the administrator for your temporary password.</p>
      <a href="${APP_URL}" style="display: inline-block; background: #FF5900; color: #fff; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-size: 16px; font-weight: bold; margin: 10px 0;">Log In Now</a>
    </div>
  `;
}

// Simple auth middleware
async function authMiddleware(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const session = await storage.getSession(token);
  if (!session) {
    return res.status(401).json({ message: "Invalid or expired session" });
  }
  req.user = session.user;
  req.sessionToken = token;
  next();
}

async function adminMiddleware(req: any, res: any, next: any) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Seed data on startup
  await seedData();
  await storage.seedEyeGazeQuizzes();
  await storage.seedExtraEyeGazeQuizzes();

  // Warm up cache - fetch books and leaderboard on startup
  console.log("Warming up cache...");
  try {
    const warmupTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Warmup timeout")), 15000)
    );
    await Promise.race([
      Promise.all([
        storage.getAllBooks(),
        storage.getAllUsers(),
        storage.getLeaderboard(),
        storage.getAllPassages(),
        storage.getAllEyeGazeQuizzes(),
      ]),
      warmupTimeout,
    ]);
    console.log("Cache warmed up successfully");
  } catch (e) {
    console.log("Cache warmup failed, will retry on first request:", (e as Error).message);
  }

  // Refresh cache every 5 minutes
  setInterval(async () => {
    try {
      await storage.getAllBooks();
      await storage.getAllUsers();
      await storage.getLeaderboard();
      await storage.getAllPassages();
    await storage.getAllEyeGazeQuizzes();
    } catch (e) {}
  }, 300000);

  // Auth routes
  app.post("/api/register", async (req, res) => {
    try {
      const { username, password, displayName, isEyeGazeUser, teacherId, schoolId, gradeLevel } = req.body;
      if (!username || !password || !displayName) {
        return res.status(400).json({ message: "All fields are required" });
      }
      if (username.length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters" });
      }
      if (password.length < 4) {
        return res.status(400).json({ message: "Password must be at least 4 characters" });
      }

      const existing = await storage.getUserByUsername(username.toLowerCase());
      if (existing) {
        return res.status(409).json({ message: "Username already taken" });
      }

      const hashedPassword = bcrypt.hashSync(password, 10);
      const user = await storage.createUser({
        username: username.toLowerCase(),
        password: hashedPassword,
        displayName,
        isEyeGazeUser: !!isEyeGazeUser,
        role: 'student',
        teacherId: teacherId ? parseInt(teacherId) : null,
        approvedByTeacher: teacherId ? false : true,
        schoolId: schoolId ? parseInt(schoolId) : null,
      });

      // Save grade level for student
      if (gradeLevel) {
        const rawGrades = await storage.getSetting('user_grades');
        let userGrades: Record<string, string> = {};
        if (rawGrades) { try { userGrades = JSON.parse(rawGrades); } catch {} }
        userGrades[String(user.id)] = gradeLevel;
        await storage.upsertSetting('user_grades', JSON.stringify(userGrades));
      }

      const session = await storage.createSession(user.id);
      res.status(201).json({
        token: session.token,
        user: { id: user.id, username: user.username, displayName: user.displayName, isAdmin: user.isAdmin, is_eye_gaze_user: user.is_eye_gaze_user, role: user.role, teacherId: user.teacherId, approvedByTeacher: user.approvedByTeacher, accountApproved: user.accountApproved, schoolId: user.school_id, totalPoints: user.totalPoints || 0 },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Teacher signup (pending admin approval)
  app.post("/api/auth/register-teacher", async (req, res) => {
    try {
      const { username, password, displayName, email, schoolId, gradeLevel, gradesTaught } = req.body;
      if (!username || !password || !displayName) {
        return res.status(400).json({ message: "All fields are required" });
      }
      if (username.length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const existing = await storage.getUserByUsername(username.toLowerCase());
      if (existing) {
        return res.status(409).json({ message: "Username already taken" });
      }

      const hashedPassword = bcrypt.hashSync(password, 10);
      const user = await storage.createUser({
        username: username.toLowerCase(),
        password: hashedPassword,
        displayName,
        role: 'teacher',
        accountApproved: false,
        email: email || null,
        schoolId: schoolId ? parseInt(schoolId) : null,
      });

      // Save grade level for teacher
      if (gradesTaught && Array.isArray(gradesTaught)) {
        const rawGrades = await storage.getSetting('teacher_grades');
        let teacherGrades: Record<string, string[]> = {};
        if (rawGrades) { try { teacherGrades = JSON.parse(rawGrades); } catch {} }
        teacherGrades[String(user.id)] = gradesTaught;
        await storage.upsertSetting('teacher_grades', JSON.stringify(teacherGrades));
      }

      // Don't create a session - teacher must be approved first
      // Clear teachers cache so admin sees the new pending teacher immediately
      res.status(201).json({
        success: true,
        message: "Your request has been submitted! The admin will review your account and notify you when it's approved.",
      });
      setImmediate(() => {
        try { clearCache('teachers'); } catch {}
        // Notify admin about the new teacher signup
        sendEmail(
          ADMIN_NOTIFY_EMAIL,
          "New teacher signup - A.R.I.S.E Reader",
          teacherSignupNotifyEmail(displayName, username.toLowerCase(), email || 'No email provided')
        ).catch(() => {});
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/register-parent", async (req, res) => {
    try {
      const { username, password, displayName, email, schoolId, studentUsername } = req.body;
      if (!username || !password || !displayName) {
        return res.status(400).json({ message: "All fields are required" });
      }
      if (username.length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      if (!studentUsername) {
        return res.status(400).json({ message: "Please enter your student's username" });
      }

      const existing = await storage.getUserByUsername(username.toLowerCase());
      if (existing) {
        return res.status(409).json({ message: "Username already taken" });
      }

      // Verify student exists
      const student = await storage.getUserByUsername(studentUsername.toLowerCase());
      if (!student) {
        return res.status(404).json({ message: `Student "${studentUsername}" not found. Please check the username.` });
      }
      if (student.role !== 'student') {
        return res.status(400).json({ message: `"${studentUsername}" is not a student account.` });
      }

      const hashedPassword = bcrypt.hashSync(password, 10);
      const user = await storage.createUser({
        username: username.toLowerCase(),
        password: hashedPassword,
        displayName,
        role: 'parent',
        accountApproved: false,
        email: email || null,
        schoolId: schoolId ? parseInt(schoolId) : null,
        teacherId: student.teacherId || null,
      });

      // Link parent to student by storing parent_id in a setting
      const rawLinks = await storage.getSetting('parent_student_links');
      let parentLinks: Record<string, number> = {};
      if (rawLinks) { try { parentLinks = JSON.parse(rawLinks); } catch {} }
      parentLinks[String(user.id)] = student.id;
      await storage.upsertSetting('parent_student_links', JSON.stringify(parentLinks));

      res.status(201).json({
        success: true,
        message: "Your request has been submitted! The admin will review your account and link you to your student.",
      });
      setImmediate(() => {
        try { clearCache('teachers'); } catch {}
        sendEmail(
          ADMIN_NOTIFY_EMAIL,
          "New parent signup - A.R.I.S.E Reader",
          `Parent signup request from ${displayName} (@${username.toLowerCase()}). Email: ${email || 'N/A'}. Linked student: ${studentUsername}.`
        ).catch(() => {});
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      const user = await storage.getUserByUsername(username.toLowerCase());
      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Teachers and parents must be approved by admin
      if ((user.role === 'teacher' || user.role === 'parent') && !user.accountApproved) {
        return res.status(403).json({ message: `Your ${user.role} account is pending approval. The administrator will review it shortly.` });
      }

      const session = await storage.createSession(user.id);
      const popupShown = !!(user as any).assessment_prompt_seen_at;
      res.json({
        token: session.token,
        user: { id: user.id, username: user.username, displayName: user.displayName, isAdmin: user.isAdmin, assessmentPromptShown: popupShown, is_eye_gaze_user: user.is_eye_gaze_user, role: user.role, teacherId: user.teacherId, approvedByTeacher: user.approvedByTeacher, accountApproved: user.accountApproved, email: user.email, schoolId: user.school_id, totalPoints: user.totalPoints || 0 },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/logout", authMiddleware, async (req: any, res) => {
    await storage.deleteSession(req.sessionToken);
    res.json({ message: "Logged out" });
  });

  app.get("/api/me", authMiddleware, async (req: any, res) => {
    res.json({
      id: req.user.id,
      username: req.user.username,
      displayName: req.user.displayName,
      isAdmin: req.user.isAdmin,
      totalPoints: req.user.totalPoints || 0,
    });
  });

  // Book routes
  app.get("/api/books", authMiddleware, async (req: any, res) => {
    const allBooks = await storage.getAllBooks();
    // Regular library only shows books WITH quizzes (points_value > 0)
    // FYP feed uses a separate endpoint and shows ALL books
    const books = allBooks.filter((b: any) => b.pointsValue > 0);

    // Fetch all settings needed for filtering
    const rawGrades = await storage.getSetting('user_grades');
    let userGrades: Record<string, string> = {};
    if (rawGrades) { try { userGrades = JSON.parse(rawGrades); } catch {} }
    const userGrade = userGrades[String(req.user.id)];

    const rawBands = await storage.getSetting('book_grade_bands');
    let bookBands: Record<string, string> = {};
    if (rawBands) { try { bookBands = JSON.parse(rawBands); } catch {} }

    const rawOverlaps = await storage.getSetting('book_grade_overlaps');
    let bookOverlaps: Record<string, string[]> = {};
    if (rawOverlaps) { try { bookOverlaps = JSON.parse(rawOverlaps); } catch {} }

    const rawOverrides = await storage.getSetting('book_point_overrides');
    let pointOverrides: Record<string, Record<string, number>> = {};
    if (rawOverrides) { try { pointOverrides = JSON.parse(rawOverrides); } catch {} }

    // ── Eye gaze student library filtering ──
    // Eye gaze students (is_eye_gaze_user=true AND role='student') see ONLY iArise books
    const isEyeGazeStudent = req.user.is_eye_gaze_user === true && req.user.role === 'student';
    if (isEyeGazeStudent) {
      const rawIAriseIds = await storage.getSetting('i_arise_book_ids');
      let iAriseIds: number[] = [];
      if (rawIAriseIds) { try { iAriseIds = JSON.parse(rawIAriseIds); } catch {} }
      const idSet = new Set(iAriseIds.map(String));
      const filtered = books.filter((b: any) => idSet.has(String(b.id)));

      // Also filter by grade band (same logic as regular students)
      const userBand = userGrade ? gradeToBand(userGrade) : null;
      if (userBand) {
        const band = userBand;
        const bandFiltered = filtered.filter((b: any) => {
          const bid = String(b.id);
          const bookBand = bookBands[bid];
          // Include if no band assigned, primary band matches, or overlap includes this band
          if (!bookBand || bookBand === band) return true;
          const overlaps = bookOverlaps[bid];
          if (overlaps && overlaps.includes(band)) return true;
          return false;
        }).map((b: any) => {
          const bid = String(b.id);
          const overrides = pointOverrides[bid];
          if (overrides && overrides[band]) {
            return { ...b, points_value: overrides[band], original_points_value: b.points_value };
          }
          return b;
        });
        return res.json(bandFiltered);
      }

      return res.json(filtered);
    }

    // ── Teacher band filtering ──
    // Teachers only see books in their assigned grade bands
    if (req.user.role === 'teacher' && !req.user.isAdmin) {
      const rawTeacherGrades = await storage.getSetting('teacher_grades');
      let teacherGrades: Record<string, string[]> = {};
      if (rawTeacherGrades) { try { teacherGrades = JSON.parse(rawTeacherGrades); } catch {} }
      const myGrades = teacherGrades[String(req.user.id)] || [];
      const myBands = new Set(myGrades.map((g: string) => gradeToBand(g)).filter(Boolean));

      if (myBands.size > 0) {
        const filtered = books.filter((b: any) => {
          const bid = String(b.id);
          const bookBand = bookBands[bid];
          // Include if no band assigned, primary band matches, or overlap includes one of teacher's bands
          if (!bookBand || myBands.has(bookBand)) return true;
          const overlaps = bookOverlaps[bid];
          if (overlaps && overlaps.some((o: string) => myBands.has(o))) return true;
          return false;
        }).map((b: any) => {
          const bid = String(b.id);
          // Apply point override for the first matching band
          const overrides = pointOverrides[bid];
          if (overrides) {
            for (const band of myBands) {
              if (overrides[band]) {
                return { ...b, points_value: overrides[band], original_points_value: b.points_value };
              }
            }
          }
          return b;
        });
        return res.json(filtered);
      }
    }

    // ── Admin band simulation ──
    // Admin can pass ?band=X to view books as if from that band
    const adminBandOverride = req.user.isAdmin ? req.query.band as string : null;
    const effectiveBand = adminBandOverride || (userGrade ? gradeToBand(userGrade) : null);

    if (effectiveBand) {
      const band = effectiveBand;
      const filtered = books.filter((b: any) => {
        const bid = String(b.id);
        const bookBand = bookBands[bid];
        // Include if primary band matches, or if overlap includes this band
        if (!bookBand || bookBand === band) return true;
        const overlaps = bookOverlaps[bid];
        if (overlaps && overlaps.includes(band)) return true;
        return false;
      }).map((b: any) => {
        const bid = String(b.id);
        // Apply point override if this book is an overlap for this band
        const overrides = pointOverrides[bid];
        if (overrides && overrides[band]) {
          return { ...b, points_value: overrides[band], original_points_value: b.points_value };
        }
        return b;
      });
      return res.json(filtered);
    }

    res.json(books);
  });

  // Grade band info endpoint (for loading screen)
  app.get("/api/grade-band-info", authMiddleware, async (req: any, res) => {
    try {
      const rawGrades = await storage.getSetting('user_grades');
      let userGrades: Record<string, string> = {};
      if (rawGrades) { try { userGrades = JSON.parse(rawGrades); } catch {} }
      const userGrade = userGrades[String(req.user.id)];
      const band = userGrade ? gradeToBand(userGrade) : null;
      
      if (!band) return res.json({ grade: null, band: null, bookCount: 0 });
      
      const books = await storage.getAllBooks();
      const rawBands = await storage.getSetting('book_grade_bands');
      let bookBands: Record<string, string> = {};
      if (rawBands) { try { bookBands = JSON.parse(rawBands); } catch {} }
      const rawOverlaps = await storage.getSetting('book_grade_overlaps');
      let bookOverlaps: Record<string, string[]> = {};
      if (rawOverlaps) { try { bookOverlaps = JSON.parse(rawOverlaps); } catch {} }
      
      const bookCount = books.filter((b: any) => {
        const bid = String(b.id);
        const bookBand = bookBands[bid];
        if (!bookBand || bookBand === band) return true;
        const overlaps = bookOverlaps[bid];
        if (overlaps && overlaps.includes(band)) return true;
        return false;
      }).length;
      
      res.json({ grade: userGrade, band, bookCount });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Public stats endpoint (no auth needed) — for login page display
  // Last-known-good stats cache (survives transient failures)
  let lastGoodStats: any = null;

  app.get("/api/public/stats", async (_req, res) => {
    try {
      const books = await storage.getAllBooks();
      if (!books || books.length === 0) {
        await new Promise(r => setTimeout(r, 500));
        const retry = await storage.getAllBooks();
        if (retry && retry.length > 0) {
          return computeStats(res, retry);
        }
        // Return last-known-good stats if available
        if (lastGoodStats) return res.json(lastGoodStats);
        return res.status(503).json({ message: "Stats temporarily unavailable" });
      }
      return computeStats(res, books);
    } catch (e) {
      if (lastGoodStats) return res.json(lastGoodStats);
      res.status(503).json({ message: "Stats temporarily unavailable" });
    }
  });

  async function computeStats(res: any, books: any[]) {
    // Fetch all questions using pagination with retry
    const bookIdsWithQuiz = new Set<number>();
    let offset = 0;
    let questionsFetched = false;
    for (let retry = 0; retry < 5 && !questionsFetched; retry++) {
      offset = 0;
      bookIdsWithQuiz.clear();
      questionsFetched = false;
      while (true) {
        let pageData: any = null;
        let pageError: any = null;
        for (let r = 0; r <= 5; r++) {
          try {
            const result = await supabase.from("questions").select("book_id").range(offset, offset + 999);
            pageData = result.data;
            pageError = result.error;
            if (!pageError) break;
          } catch (e) { pageError = e; }
          if (r < 5) await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (pageError || !pageData || pageData.length === 0) break;
        questionsFetched = true;
        for (const q of pageData) bookIdsWithQuiz.add(q.book_id);
        if (pageData.length < 1000) break;
        offset += 1000;
      }
      if (!questionsFetched && retry < 4) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    const quizzesAvailable = books.filter(b => bookIdsWithQuiz.has(b.id)).length;
    const booksAvailable = books.filter(b => b.readUrl).length;
    // Also count eye gaze quizzes
    let eyeGazeCount = 0;
    try {
      const egRes = await supabase.from('eye_gaze_quizzes').select('id', { count: 'exact', head: true });
      eyeGazeCount = egRes.count || 0;
    } catch {}
    const stats = {
      booksAvailable,
      quizzesAvailable: quizzesAvailable + eyeGazeCount,
      totalPoints: books.reduce((sum, b) => sum + b.pointsValue, 0),
    };
    // Save as last-known-good
    if (quizzesAvailable > 0) lastGoodStats = stats;
    res.json(stats);
  }

  // Public books endpoint for tutorial (no auth needed, no correct answers)
  app.get("/api/tutorial/books", async (_req, res) => {
    const books = await storage.getAllBooks();
    res.json(books);
  });

  // Public quiz endpoint for tutorial (no auth, no attempt tracking, strips correct answers)
  app.get("/api/tutorial/books/:id/quiz", async (req, res) => {
    const bookId = parseInt(req.params.id);
    const book = await storage.getBook(bookId);
    if (!book) return res.status(404).json({ message: "Book not found" });
    const allQuestions = await storage.getQuestionsByBook(bookId);
    const safeQuestions = allQuestions.map(q => ({
      id: q.id,
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      questionOrder: q.questionOrder,
    }));
    res.json({ book, questions: safeQuestions });
  });

  app.get("/api/books/:id", authMiddleware, async (req, res) => {
    const id = parseInt(req.params.id);
    const book = await storage.getBook(id);
    if (!book) return res.status(404).json({ message: "Book not found" });
    res.json(book);
  });

  // Quiz routes - returns questions WITHOUT correct answers
  app.get("/api/books/:id/quiz", authMiddleware, async (req: any, res) => {
    const bookId = parseInt(req.params.id);

    // Check if already attempted
    const existingAttempt = await storage.getAttempt(req.user.id, bookId);
    if (existingAttempt) {
      return res.status(403).json({ message: "You have already taken this quiz", score: existingAttempt.score, total: existingAttempt.totalQuestions, points: existingAttempt.pointsEarned || 0 });
    }

    const book = await storage.getBook(bookId);
    if (!book) return res.status(404).json({ message: "Book not found" });

    // Grade band enforcement: students can only take quizzes in their band (or overlaps)
    const rawGrades = await storage.getSetting('user_grades');
    let userGrades: Record<string, string> = {};
    if (rawGrades) { try { userGrades = JSON.parse(rawGrades); } catch {} }
    const userGrade = userGrades[String(req.user.id)];
    if (userGrade) {
      const userBand = gradeToBand(userGrade);
      const rawBands = await storage.getSetting('book_grade_bands');
      let bookBands: Record<string, string> = {};
      if (rawBands) { try { bookBands = JSON.parse(rawBands); } catch {} }
      const rawOverlaps = await storage.getSetting('book_grade_overlaps');
      let bookOverlaps: Record<string, string[]> = {};
      if (rawOverlaps) { try { bookOverlaps = JSON.parse(rawOverlaps); } catch {} }
      const bookBand = bookBands[String(bookId)];
      const overlaps = bookOverlaps[String(bookId)] || [];
      if (userBand && bookBand && userBand !== bookBand && !overlaps.includes(userBand)) {
        return res.status(403).json({ message: "This book is not available for your grade level" });
      }
    }
    const allQuestions = await storage.getQuestionsByBook(bookId);
    // Strip correct answers before sending to client
    const safeQuestions = allQuestions.map(q => ({
      id: q.id,
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      questionOrder: q.questionOrder,
    }));

    res.json({ book, questions: safeQuestions });
  });

  // Submit quiz
  app.post("/api/books/:id/quiz", authMiddleware, async (req: any, res) => {
    const bookId = parseInt(req.params.id);

    // Check if already attempted
    const existingAttempt = await storage.getAttempt(req.user.id, bookId);
    if (existingAttempt) {
      return res.status(403).json({ message: "You have already taken this quiz" });
    }

    // Grade band enforcement on submit too (with overlaps)
    const rawGrades = await storage.getSetting('user_grades');
    let userGrades: Record<string, string> = {};
    if (rawGrades) { try { userGrades = JSON.parse(rawGrades); } catch {} }
    const userGrade = userGrades[String(req.user.id)];
    let effectivePoints = 0;
    if (userGrade) {
      const userBand = gradeToBand(userGrade);
      const rawBands = await storage.getSetting('book_grade_bands');
      let bookBands: Record<string, string> = {};
      if (rawBands) { try { bookBands = JSON.parse(rawBands); } catch {} }
      const rawOverlaps = await storage.getSetting('book_grade_overlaps');
      let bookOverlaps: Record<string, string[]> = {};
      if (rawOverlaps) { try { bookOverlaps = JSON.parse(rawOverlaps); } catch {} }
      const rawOverrides = await storage.getSetting('book_point_overrides');
      let pointOverrides: Record<string, Record<string, number>> = {};
      if (rawOverrides) { try { pointOverrides = JSON.parse(rawOverrides); } catch {} }
      const bookBand = bookBands[String(bookId)];
      const overlaps = bookOverlaps[String(bookId)] || [];
      if (userBand && bookBand && userBand !== bookBand && !overlaps.includes(userBand)) {
        return res.status(403).json({ message: "This book is not available for your grade level" });
      }
      // Get effective points (override if this is an overlap book for this band)
      const book = await storage.getBook(bookId);
      effectivePoints = book?.pointsValue || 10;
      const overrides = pointOverrides[String(bookId)];
      if (overrides && overrides[userBand]) {
        effectivePoints = overrides[userBand];
      }
    }

    const { answers } = req.body; // { questionId: "A"|"B"|"C"|"D" }
    if (!answers || typeof answers !== "object") {
      return res.status(400).json({ message: "Answers are required" });
    }

    const allQuestions = await storage.getQuestionsByBook(bookId);
    if (allQuestions.length === 0) {
      return res.status(404).json({ message: "No questions found for this book" });
    }

    let score = 0;
    for (const q of allQuestions) {
      const userAnswer = answers[String(q.id)];
      if (userAnswer === q.correctAnswer) {
        score++;
      }
    }

    const attempt = await storage.createAttempt(req.user.id, bookId, score, allQuestions.length, answers, effectivePoints || undefined);
    const book = await storage.getBook(bookId);
    res.json({
      score,
      total: allQuestions.length,
      points: attempt.pointsEarned,
      bookPoints: effectivePoints || book?.pointsValue || 10,
      passed: attempt.passed,
      passingScore: attempt.passingScore,
      bookTitle: book?.title,
      studentName: req.user.displayName,
      attemptId: attempt.id,
    });
  });

  // Profile routes
  app.get("/api/profile", authMiddleware, async (req: any, res) => {
    const attempts = await storage.getUserAttempts(req.user.id);
    const books = await storage.getAllBooks();
    const bookMap = new Map(books.map(b => [b.id, b]));

    const quizResults = attempts.map(a => {
      const book = bookMap.get(a.bookId);
      const passingScore = Math.ceil((a.totalQuestions || 10) * 0.7);
      const passed = a.score >= passingScore;
      return {
        bookId: a.bookId,
        title: book?.title || "Unknown",
        author: book?.author || "",
        coverUrl: book?.coverUrl,
        readUrl: book?.readUrl,
        pointsValue: book?.pointsValue || 10,
        score: a.score,
        total: a.totalQuestions,
        pointsEarned: a.pointsEarned ?? 0,
        passed,
        passingScore,
        completedAt: a.completedAt,
      };
    });

    const totalPoints = attempts.reduce((sum, a) => sum + (a.pointsEarned || 0), 0);
    const quizzesTaken = attempts.length;
    const totalBooks = books.length;

    // Fetch teacher info if student has a teacher assigned
    let teacherInfo = null;
    if (req.user.teacherId) {
      const teacher = await storage.getUser(req.user.teacherId);
      if (teacher) {
        teacherInfo = {
          id: teacher.id,
          displayName: teacher.displayName,
          approved: req.user.approvedByTeacher !== false,
        };
      }
    }

    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        displayName: req.user.displayName,
      },
      teacher: teacherInfo,
      totalPoints,
      quizzesTaken,
      totalBooks,
      quizResults,
    });
  });

  // Profile stats endpoint — reflects band if specified (for admin band simulation)
  app.get("/api/profile/stats", authMiddleware, async (req: any, res) => {
    try {
      const attempts = await storage.getUserAttempts(req.user.id);
      const books = await storage.getAllBooks();
      const bookMap = new Map(books.map(b => [b.id, b]));

      const quizResults = attempts.map(a => {
        const book = bookMap.get(a.bookId);
        const passingScore = Math.ceil((a.totalQuestions || 10) * 0.7);
        const passed = a.score >= passingScore;
        return {
          bookId: a.bookId,
          title: book?.title || "Unknown",
          author: book?.author || "",
          coverUrl: book?.coverUrl,
          readUrl: book?.readUrl,
          pointsValue: book?.pointsValue || 10,
          score: a.score,
          total: a.totalQuestions,
          pointsEarned: a.pointsEarned ?? 0,
          passed,
          passingScore,
          completedAt: a.completedAt,
        };
      });

      const totalPoints = attempts.reduce((sum, a) => sum + (a.pointsEarned || 0), 0);
      const quizzesTaken = attempts.length;

      // ── Band-aware book count ──
      // Admin can pass ?band=X to simulate viewing as that band
      const bandParam = req.query.band as string;
      let totalBooks = books.length;

      // Fetch user grade and band info
      const rawGrades = await storage.getSetting('user_grades');
      let userGrades: Record<string, string> = {};
      if (rawGrades) { try { userGrades = JSON.parse(rawGrades); } catch {} }
      const userGrade = userGrades[String(req.user.id)];
      const userBand = userGrade ? gradeToBand(userGrade) : null;

      // Determine effective band
      let effectiveBand: string | null = null;
      if (req.user.isAdmin && bandParam) {
        effectiveBand = bandParam;
      } else if (req.user.is_eye_gaze_user === true && req.user.role === 'student') {
        // Eye gaze students see only iArise books
        const rawIAriseIds = await storage.getSetting('i_arise_book_ids');
        let iAriseIds: number[] = [];
        if (rawIAriseIds) { try { iAriseIds = JSON.parse(rawIAriseIds); } catch {} }
        const idSet = new Set(iAriseIds.map(String));
        totalBooks = books.filter((b: any) => idSet.has(String(b.id))).length;
      } else if (userBand) {
        effectiveBand = userBand;
      }

      if (effectiveBand) {
        const rawBands = await storage.getSetting('book_grade_bands');
        let bookBands: Record<string, string> = {};
        if (rawBands) { try { bookBands = JSON.parse(rawBands); } catch {} }
        const rawOverlaps = await storage.getSetting('book_grade_overlaps');
        let bookOverlaps: Record<string, string[]> = {};
        if (rawOverlaps) { try { bookOverlaps = JSON.parse(rawOverlaps); } catch {} }
        totalBooks = books.filter((b: any) => {
          const bid = String(b.id);
          const bookBand = bookBands[bid];
          if (!bookBand || bookBand === effectiveBand) return true;
          const overlaps = bookOverlaps[bid];
          if (overlaps && overlaps.includes(effectiveBand)) return true;
          return false;
        }).length;
      }

      // Fetch teacher info if student has a teacher assigned
      let teacherInfo = null;
      if (req.user.teacherId) {
        const teacher = await storage.getUser(req.user.teacherId);
        if (teacher) {
          teacherInfo = {
            id: teacher.id,
            displayName: teacher.displayName,
            approved: req.user.approvedByTeacher !== false,
          };
        }
      }

      res.json({
        user: {
          id: req.user.id,
          username: req.user.username,
          displayName: req.user.displayName,
          isEyeGazeUser: req.user.is_eye_gaze_user || false,
          role: req.user.role,
        },
        teacher: teacherInfo,
        totalPoints,
        quizzesTaken,
        totalBooks,
        quizResults,
        grade: userGrade,
        band: effectiveBand || userBand,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Message routes
  app.get("/api/messages", authMiddleware, async (req: any, res) => {
    const msgs = await storage.getUserMessages(req.user.id);
    res.json(msgs);
  });

  app.post("/api/messages", authMiddleware, async (req: any, res) => {
    const { messageText } = req.body;
    if (!messageText || messageText.trim().length === 0) {
      return res.status(400).json({ message: "Message text is required" });
    }
    const msg = await storage.createMessage(req.user.id, "student", messageText.trim());
    res.status(201).json(msg);
  });

  app.post("/api/messages/:id/read", authMiddleware, async (req, res) => {
    await storage.markMessageRead(parseInt(req.params.id));
    res.json({ message: "Marked as read" });
  });

  // Admin routes
  app.get("/api/admin/students", authMiddleware, adminMiddleware, async (_req, res) => {
    // Use embedded resources to fetch users with attempts in a single query
    const students = (await storage.getAllUsers()).filter((s: any) => s.role === 'student' || (!s.role && !s.isAdmin));
    // Fetch all attempts for all students in one query using embedded resources
    let allUsersWithAttempts: any[] = [];
    for (let retry = 0; retry < 5; retry++) {
      try {
        const { data, error } = await supabase.from("users").select("id, attempts(points_earned)").eq("is_admin", false).eq("role", "student");
        if (!error && data) { allUsersWithAttempts = data; break; }
      } catch (e) {}
      if (retry < 4) await new Promise(r => setTimeout(r, 1000));
    }
    const attemptsMap = new Map();
    for (const u of allUsersWithAttempts) {
      const attempts = u.attempts || [];
      attemptsMap.set(u.id, attempts);
    }
    const result = [];
    // Build a map of teacher names for student approval display
    const allUsers = await storage.getAllUsers();
    const teacherMap = new Map();
    for (const u of allUsers) {
      if (u.role === 'teacher') teacherMap.set(u.id, u.displayName);
    }
    for (const s of students) {
      const attempts = attemptsMap.get(s.id) || [];
      const totalPoints = attempts.reduce((sum, a) => sum + (a.points_earned || 0), 0);
      const quizzesMastered = attempts.filter(a => (a.points_earned || 0) > 0).length;
      const teacherName = s.teacherId ? (teacherMap.get(s.teacherId) || 'Teacher') : null;
      result.push({
        id: s.id,
        username: s.username,
        displayName: s.displayName,
        createdAt: s.createdAt,
        quizzesTaken: attempts.length,
        quizzesMastered,
        totalPoints,
        approvedByTeacher: s.approvedByTeacher,
        teacherId: s.teacherId,
        teacherName,
      });
    }
    res.json(result);
  });

  app.post("/api/admin/students/:id/reset-password", authMiddleware, adminMiddleware, async (req, res) => {
    const userId = parseInt(req.params.id);
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ message: "Password must be at least 4 characters" });
    }
    const hashed = bcrypt.hashSync(newPassword, 10);
    await storage.resetPassword(userId, hashed);
    res.json({ message: "Password reset successfully" });
  });

  app.post("/api/admin/students/:id/message", authMiddleware, adminMiddleware, async (req, res) => {
    const userId = parseInt(req.params.id);
    const { messageText, linkUrl } = req.body;
    if (!messageText || messageText.trim().length === 0) {
      return res.status(400).json({ message: "Message text is required" });
    }
    const msg = await storage.createMessage(userId, "teacher", messageText.trim(), linkUrl || undefined);
    res.status(201).json(msg);
  });

  // Notification endpoints
  app.get("/api/notifications", authMiddleware, async (req: any, res) => {
    if (req.user.isAdmin) {
      const reqSeenAt = await storage.getNotifSeenAt("quiz_requests");
      const usersSeenAt = await storage.getNotifSeenAt("new_users");
      const teachersSeenAt = await storage.getNotifSeenAt("pending_teachers");
      const quizRequests = await storage.getQuizRequests();
      const pendingReqs = quizRequests.filter((r: any) =>
        r.status === "pending" && (!reqSeenAt || new Date(r.createdAt) > new Date(reqSeenAt))
      );
      const allUsers = await storage.getAllUsers();
      const cutoff = usersSeenAt ? new Date(usersSeenAt) : new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const newUsersList = allUsers.filter((u: any) => new Date(u.createdAt) > cutoff);
      // Pending teachers (not yet approved) - fetch directly without cache
      const { data: allTeacherRows } = await supabase
        .from("users")
        .select("id, display_name, username, role, account_approved, email, created_at")
        .eq("role", 'teacher')
        .order("display_name", { ascending: true });
      const pendingTeachersList = (allTeacherRows || []).filter((t: any) =>
        !t.account_approved && (!teachersSeenAt || new Date(t.created_at) > new Date(teachersSeenAt))
      );
      res.json({
        unreadCount: pendingReqs.length + newUsersList.length + pendingTeachersList.length,
        type: "admin",
        pendingRequests: pendingReqs.length,
        newUsers: newUsersList.length,
        pendingTeachers: pendingTeachersList.length,
        pendingRequestItems: pendingReqs.map((r: any) => ({
          id: r.id,
          bookTitle: r.bookTitle,
          author: r.author,
          studentName: r.studentName,
          createdAt: r.createdAt,
        })),
        newUserItems: newUsersList.map((u: any) => ({
          id: u.id,
          displayName: u.displayName,
          username: u.username,
          createdAt: u.createdAt,
        })),
        pendingTeacherItems: pendingTeachersList.map((t: any) => ({
          id: t.id,
          displayName: t.display_name,
          username: t.username,
          email: t.email,
          createdAt: t.created_at,
        })),
      });
    } else {
      // Students: bell shows unread messages from teacher
      const messages = await storage.getUserMessages(req.user.id);
      const unreadMsgs = messages.filter((m: any) => !m.isRead && m.senderType === "teacher");
      res.json({
        unreadCount: unreadMsgs.length,
        type: "student",
        messageItems: unreadMsgs.map((m: any) => ({
          id: m.id,
          messageText: m.messageText,
          createdAt: m.createdAt,
        })),
      });
    }
  });

  // Mark notifications as seen (clears bell — all or individual type)
  app.post("/api/notifications/mark-seen", authMiddleware, async (req, res) => {
    try {
      const notifType = req.body?.type;
      if (notifType === "quiz_requests" || notifType === "new_users" || notifType === "pending_teachers") {
        // Only admins can clear admin notification types
        if (!req.user.isAdmin) return res.status(403).json({ message: "Forbidden" });
        await storage.setNotifSeenAt(notifType);
      } else if (notifType === "messages") {
        // Mark all student messages as read
        await storage.markAllMessagesRead(req.user.id);
      } else {
        // Clear all — admins clear admin types, students clear messages
        if (req.user.isAdmin) {
          await storage.setNotifSeenAt("quiz_requests");
          await storage.setNotifSeenAt("new_users");
          await storage.setNotifSeenAt("pending_teachers");
        } else {
          await storage.markAllMessagesRead(req.user.id);
        }
      }
      res.json({ message: "Notifications cleared" });
    } catch (e) {
      res.status(500).json({ message: "Failed to clear notifications" });
    }
  });

  // Announcement (public to authenticated users)
  app.get("/api/announcement", authMiddleware, async (_req, res) => {
    const text = await storage.getAnnouncement();
    res.json({ text });
  });

  // Admin: set announcement
  app.post("/api/admin/announcement", authMiddleware, adminMiddleware, async (req, res) => {
    const { text } = req.body;
    await storage.setAnnouncement(text || "");
    res.json({ message: "Announcement updated" });
  });

  // Leaderboard
  // Public leaderboard (no auth needed — for login page)
  app.get("/api/tutorial/leaderboard", async (req, res) => {
    const month = req.query.month as string;
    const band = req.query.band as string;
    let leaderboard = month
      ? await storage.getMonthlyLeaderboard(month)
      : await storage.getLeaderboard();
    
    // Filter by grade band if requested
    if (band) {
      const rawGrades = await storage.getSetting('user_grades');
      let userGrades: Record<string, string> = {};
      if (rawGrades) { try { userGrades = JSON.parse(rawGrades); } catch {} }
      leaderboard = leaderboard.filter((entry: any) => {
        const userGrade = userGrades[String(entry.userId)] || userGrades[String(entry.id)];
        return userGrade && gradeToBand(userGrade) === band;
      });
    }
    
    // Only expose display name, points, quizzes, eye gaze flag — no usernames or IDs
    const allUsers = await storage.getAllUsers();
    const userMap = new Map(allUsers.map((u: any) => [u.id, u]));
    const safe = leaderboard.map((entry: any, idx: number) => {
      const uid = entry.userId || entry.id;
      const user = userMap.get(uid);
      const isEyeGazeUser = user?.is_eye_gaze_user || user?.isEyeGazeUser || false;
      return {
        rank: idx + 1,
        displayName: entry.displayName,
        totalPoints: entry.totalPoints,
        quizzesTaken: entry.quizzesTaken,
        isEyeGazeUser,
      };
    });
    res.json(safe);
  });

  // Authenticated leaderboard (supports monthly filtering)
  app.get("/api/leaderboard", authMiddleware, async (req: any, res) => {
    const month = req.query.month as string;
    const bandParam = req.query.band as string;
    let leaderboard = month
      ? await storage.getMonthlyLeaderboard(month)
      : await storage.getLeaderboard();

    // Fetch enrichment data: user grades, eye gaze flags, schools
    const rawGrades = await storage.getSetting('user_grades');
    let userGrades: Record<string, string> = {};
    if (rawGrades) { try { userGrades = JSON.parse(rawGrades); } catch {} }

    // Fetch all users with eye gaze flag and school_id
    const allUsers = await storage.getAllUsers();
    const userMap = new Map(allUsers.map((u: any) => [u.id, u]));

    // Fetch all schools for name lookup
    const schools = await storage.getAllSchools();
    const schoolMap = new Map(schools.map((s: any) => [s.id, s.name]));

    // Determine the effective band for filtering
    let effectiveBand: string | null = null;

    if (req.user.isAdmin) {
      // Admin can pass ?band=X to see a different band's leaderboard
      effectiveBand = bandParam || null;
    } else if (req.user.role === 'teacher') {
      // Teachers see students in their assigned grades/bands
      const rawTeacherGrades = await storage.getSetting('teacher_grades');
      let teacherGrades: Record<string, string[]> = {};
      if (rawTeacherGrades) { try { teacherGrades = JSON.parse(rawTeacherGrades); } catch {} }
      const myGrades = teacherGrades[String(req.user.id)] || [];
      const myBands = new Set(myGrades.map((g: string) => gradeToBand(g)).filter(Boolean));

      // Filter leaderboard to students in teacher's bands
      leaderboard = leaderboard.filter((entry: any) => {
        const uid = entry.userId || entry.id;
        const grade = userGrades[String(uid)];
        const band = grade ? gradeToBand(grade) : null;
        // Include students with no grade (they show in all bands) or in teacher's bands
        return !band || myBands.has(band);
      });
    } else {
      // Students only see their own band's leaderboard
      const myGrade = userGrades[String(req.user.id)];
      effectiveBand = myGrade ? gradeToBand(myGrade) : null;
    }

    // Filter by grade band if determined
    if (effectiveBand) {
      const band = effectiveBand;
      leaderboard = leaderboard.filter((entry: any) => {
        const uid = entry.userId || entry.id;
        const grade = userGrades[String(uid)];
        return grade && gradeToBand(grade) === band;
      });
    }

    // Enrich each entry with school name, is_eye_gaze_user, grade, and band
    const enriched = leaderboard.map((entry: any, idx: number) => {
      const uid = entry.userId || entry.id;
      const user = userMap.get(uid);
      const grade = userGrades[String(uid)] || null;
      const band = grade ? gradeToBand(grade) : null;
      const schoolId = user?.school_id || user?.schoolId || null;
      const schoolName = schoolId ? (schoolMap.get(schoolId) || null) : null;
      const isEyeGazeUser = user?.is_eye_gaze_user || user?.isEyeGazeUser || false;
      return {
        rank: idx + 1,
        ...entry,
        schoolName,
        isEyeGazeUser,
        grade,
        band,
      };
    });

    res.json(enriched);
  });

  // Eye Gaze student ranking within their band (inclusive leaderboard)
  app.get("/api/eye-gaze-band-rank", authMiddleware, async (req: any, res) => {
    try {
      const rawGrades = await storage.getSetting('user_grades');
      let userGrades: Record<string, string> = {};
      if (rawGrades) { try { userGrades = JSON.parse(rawGrades); } catch {} }
      const userGrade = userGrades[String(req.user.id)];
      const userBand = userGrade ? gradeToBand(userGrade) : null;
      
      if (!userBand) return res.json({ band: null, overallRank: null, eyeGazeRank: null, totalInBand: 0, totalEyeGazeInBand: 0 });
      
      // Get full leaderboard (all-time)
      const fullLeaderboard = await storage.getLeaderboard();
      
      // Filter to user's band
      const bandLeaderboard = fullLeaderboard.filter((entry: any) => {
        const g = userGrades[String(entry.userId)] || userGrades[String(entry.id)];
        return g && gradeToBand(g) === userBand;
      });
      
      // Find user's overall rank in band
      const overallRank = bandLeaderboard.findIndex((e: any) => e.userId === req.user.id || e.id === req.user.id) + 1;
      
      // Filter to eye gaze users in band
      const eyeGazeInBand = bandLeaderboard.filter((entry: any) => entry.is_eye_gaze_user);
      const eyeGazeRank = eyeGazeInBand.findIndex((e: any) => e.userId === req.user.id || e.id === req.user.id) + 1;
      
      res.json({
        band: userBand,
        overallRank: overallRank || null,
        eyeGazeRank: eyeGazeRank || null,
        totalInBand: bandLeaderboard.length,
        totalEyeGazeInBand: eyeGazeInBand.length
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── Schools & Classes (Admin) ────────────────────────────────────────

  // Eye Gaze Leaderboard (public, safe data only)
  app.get("/api/tutorial/eye-gaze-leaderboard", async (req, res) => {
    const month = req.query.month as string;
    const leaderboard = month
      ? await storage.getMonthlyEyeGazeLeaderboard(month)
      : await storage.getEyeGazeLeaderboard();
    const safe = leaderboard.map((entry: any, idx: number) => ({
      rank: idx + 1,
      displayName: entry.displayName,
      totalPoints: entry.totalPoints,
      quizzesTaken: entry.quizzesTaken,
    }));
    res.json(safe);
  });

  // Authenticated eye gaze leaderboard (supports monthly filtering)
  app.get("/api/eye-gaze/leaderboard", authMiddleware, async (req, res) => {
    const month = req.query.month as string;
    const leaderboard = month
      ? await storage.getMonthlyEyeGazeLeaderboard(month)
      : await storage.getEyeGazeLeaderboard();
    const safe = leaderboard.map((entry: any, idx: number) => ({
      rank: idx + 1,
      displayName: entry.displayName,
      totalPoints: entry.totalPoints,
      quizzesTaken: entry.quizzesTaken,
      username: entry.username,
      id: entry.id,
    }));
    res.json(safe);
  });

  // Public endpoint - get all schools with themes (for signup dropdown)
  app.get("/api/schools", async (_req, res) => {
    try {
      const schools = await storage.getAllSchools();
      // Get school themes from settings
      const themesSetting = await storage.getSetting('school_themes');
      let themes: Record<string, any> = {};
      if (themesSetting) {
        try { themes = JSON.parse(themesSetting); } catch {}
      }
      const result = schools.map(s => ({
        id: s.id,
        name: s.name,
        mascotName: themes[String(s.id)]?.mascotName || 'Reader',
        primaryHsl: themes[String(s.id)]?.primaryHsl || '21 100% 50%',
        primaryForegroundHsl: themes[String(s.id)]?.primaryForegroundHsl || '0 0% 100%',
        mascotEmoji: themes[String(s.id)]?.mascotEmoji || '',
      }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Public endpoint - get I ARISE book IDs
  app.get("/api/i-arise-book-ids", async (_req, res) => {
    try {
      const raw = await storage.getSetting('i_arise_book_ids');
      let ids: number[] = [];
      if (raw) {
        try { ids = JSON.parse(raw); } catch {}
      }
      res.json({ bookIds: Array.isArray(ids) ? ids : [] });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get user's grade level
  app.get("/api/user-grade", authMiddleware, async (req: any, res) => {
    try {
      const raw = await storage.getSetting('user_grades');
      let grades: Record<string, string> = {};
      if (raw) { try { grades = JSON.parse(raw); } catch {} }
      const grade = grades[String(req.user.id)] || null;
      res.json({ grade, band: grade ? gradeToBand(grade) : null });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get teachers filtered by school and grade
  app.get("/api/teachers/by-school-grade", async (req, res) => {
    try {
      const schoolId = req.query.schoolId;
      const grade = req.query.grade;
      const teachers = await storage.getApprovedTeachers();
      
      // Fetch teacher grade assignments
      const rawGrades = await storage.getSetting('teacher_grades');
      let teacherGrades: Record<string, string[]> = {};
      if (rawGrades) { try { teacherGrades = JSON.parse(rawGrades); } catch {} }
      
      // Filter by school and grade
      const filtered = teachers.filter((t: any) => {
        const schoolMatch = !schoolId || String(t.school_id) === String(schoolId);
        const gradesTaught = teacherGrades[String(t.id)] || [];
        const gradeMatch = !grade || gradesTaught.includes(grade);
        return schoolMatch && gradeMatch;
      });
      
      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: set user grade
  app.post("/api/admin/users/:id/assign-grade", authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const { grade } = req.body;
      const raw = await storage.getSetting('user_grades');
      let grades: Record<string, string> = {};
      if (raw) { try { grades = JSON.parse(raw); } catch {} }
      grades[userId] = grade;
      await storage.upsertSetting('user_grades', JSON.stringify(grades));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: set teacher grades
  app.post("/api/admin/teachers/:id/assign-grades", authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const teacherId = req.params.id;
      const { grades: gradeList } = req.body;
      const raw = await storage.getSetting('teacher_grades');
      let teacherGrades: Record<string, string[]> = {};
      if (raw) { try { teacherGrades = JSON.parse(raw); } catch {} }
      teacherGrades[teacherId] = gradeList;
      await storage.upsertSetting('teacher_grades', JSON.stringify(teacherGrades));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Public endpoint - get book grade bands
  app.get("/api/book-grade-bands", async (_req, res) => {
    try {
      const raw = await storage.getSetting('book_grade_bands');
      let bands: Record<string, string> = {};
      if (raw) { try { bands = JSON.parse(raw); } catch {} }
      res.json(bands);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Public endpoint - get iArise course content
  app.get("/api/iarise-course/:bookId", async (req, res) => {
    try {
      const raw = await storage.getSetting('iarise_course_content');
      let courses: any = {};
      if (raw) {
        try { courses = JSON.parse(raw); } catch {}
      }
      const bookId = req.params.bookId;
      const course = courses[bookId];
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      res.json(course);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
  app.get("/api/i-arise-est-times", async (_req, res) => {
    try {
      const raw = await storage.getSetting('iarise_est_times');
      let times: Record<string, string> = {};
      if (raw) {
        try { times = JSON.parse(raw); } catch {}
      }
      res.json(times);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/schools", authMiddleware, adminMiddleware, async (_req, res) => {
    const schools = await storage.getAllSchools();
    res.json(schools);
  });

  app.post("/api/admin/schools", authMiddleware, adminMiddleware, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "School name required" });
    try {
      const school = await storage.createSchool(name);
      res.status(201).json(school);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/admin/schools/:id/classes", authMiddleware, adminMiddleware, async (req, res) => {
    const schoolId = parseInt(req.params.id);
    const classes = await storage.getClassesBySchool(schoolId);
    res.json(classes);
  });

  app.post("/api/admin/schools/:id/classes", authMiddleware, adminMiddleware, async (req, res) => {
    const schoolId = parseInt(req.params.id);
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Class name required" });
    try {
      const cls = await storage.createClass(schoolId, name);
      res.status(201).json(cls);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/admin/schools/:id", authMiddleware, adminMiddleware, async (req, res) => {
    const schoolId = parseInt(req.params.id);
    try {
      await storage.deleteSchool(schoolId);
      try { clearCache('allUsers'); } catch {}
      res.json({ message: "School deleted" });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/admin/classes/:id", authMiddleware, adminMiddleware, async (req, res) => {
    const classId = parseInt(req.params.id);
    try {
      await storage.deleteClass(classId);
      try { clearCache('allUsers'); } catch {}
      res.json({ message: "Class deleted" });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/admin/classes", authMiddleware, adminMiddleware, async (_req, res) => {
    const classes = await storage.getAllClasses();
    res.json(classes);
  });

  app.post("/api/admin/students/:id/assign-school", authMiddleware, adminMiddleware, async (req, res) => {
    const userId = parseInt(req.params.id);
    const { schoolId } = req.body;
    await storage.assignStudentToSchool(userId, schoolId || null);
    res.json({ message: "School updated" });
  });

  app.post("/api/admin/students/:id/assign-class", authMiddleware, adminMiddleware, async (req, res) => {
    const userId = parseInt(req.params.id);
    const { classId } = req.body;
    await storage.assignStudentToClass(userId, classId || null);
    res.json({ message: "Class updated" });
  });

  // Admin: assign school to a teacher
  app.post("/api/admin/teachers/:id/assign-school", authMiddleware, adminMiddleware, async (req, res) => {
    const userId = parseInt(req.params.id);
    const { schoolId } = req.body;
    try {
      const { error } = await supabase.from("users").update({ school_id: schoolId || null }).eq("id", userId).eq("role", "teacher");
      if (error) return res.status(500).json({ message: error.message });
      res.json({ message: "School updated" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/school-stats", authMiddleware, adminMiddleware, async (_req, res) => {
    const stats = await storage.getSchoolStats();
    res.json(stats);
  });

  app.get("/api/admin/schools/:id/class-stats", authMiddleware, adminMiddleware, async (req, res) => {
    const schoolId = parseInt(req.params.id);
    const stats = await storage.getClassStats(schoolId);
    res.json(stats);
  });

  // Admin: student detail
  app.get("/api/admin/students/:id", authMiddleware, adminMiddleware, async (req, res) => {
    const userId = parseInt(req.params.id);
    const detail = await storage.getStudentDetail(userId);
    if (!detail) {
      return res.status(404).json({ message: "Student not found" });
    }
    res.json(detail);
  });

  // Student: get unread message count (for inbox badge)
  app.get("/api/messages/unread-count", authMiddleware, async (req: any, res) => {
    const count = await storage.getUnreadMessageCount(req.user.id);
    res.json({ count });
  });

  // Admin: unread student message count (for inbox badge)
  app.get("/api/admin/messages/unread-count", authMiddleware, adminMiddleware, async (_req, res) => {
    const count = await storage.getUnreadStudentMessageCount();
    res.json({ count });
  });

  // Admin: all student messages (inbox)
  app.get("/api/admin/messages", authMiddleware, adminMiddleware, async (_req, res) => {
    const msgs = await storage.getAllStudentMessages();
    res.json(msgs);
  });

  // Admin: sent messages
  app.get("/api/admin/messages/sent", authMiddleware, adminMiddleware, async (_req, res) => {
    const msgs = await storage.getSentMessages();
    res.json(msgs);
  });

  // Admin: reply to a student message
  app.post("/api/admin/messages/:id/reply", authMiddleware, adminMiddleware, async (req, res) => {
    const msgId = parseInt(req.params.id);
    const { messageText, linkUrl } = req.body;
    if (!messageText || messageText.trim().length === 0) {
      return res.status(400).json({ message: "Reply text is required" });
    }
    // Get the original message to find the student
    const { data: origMsg } = await supabase.from("messages").select("user_id").eq("id", msgId).single();
    if (!origMsg) {
      return res.status(404).json({ message: "Original message not found" });
    }
    // Mark the original message as read
    await storage.markMessageRead(msgId);
    // Create the reply message
    const reply = await storage.createMessage(origMsg.user_id, "teacher", messageText.trim(), linkUrl || undefined);
    res.status(201).json(reply);
  });

  // Admin: mark student message as read
  app.post("/api/admin/messages/:id/read", authMiddleware, adminMiddleware, async (req, res) => {
    const msgId = parseInt(req.params.id);
    await storage.markMessageRead(msgId);
    res.json({ message: "Marked as read" });
  });

  // Admin: add new quiz/book
  // Admin: Suggest grade band for a book
  app.post("/api/admin/suggest-band", authMiddleware, adminMiddleware, async (req, res) => {
    const { title, author } = req.body;
    if (!title) return res.status(400).json({ message: "Title is required" });
    const t = title.toLowerCase();
    // Simple heuristic based on common book titles and keywords
    const k2 = ["picture book", "beginning reader", "easy reader", "children's", "kindergarten", "cat in the hat", "very hungry caterpillar", "goodnight moon", "where the wild things are"];
    const elem = ["magic tree house", "junie b", "diary of a wimpy kid", "captain underpants", "charlotte's web", "bridge to terabithia", "because of winn-dixie", "hatchet", "number the stars", "tale of despereaux", "the giver", "holes", "bud not buddy", "walter bobbsey", "boxcar children"];
    const mid = ["harry potter", "percy jackson", "hunger games", "twilight", "divergent", "maze runner", "the outsiders", "fault in our stars", "looking for alaska", "wonder", "ghost", "patina", "refugee", "amenity"];
    const hs = ["1984", "to kill a mockingbird", "the great gatsby", "lord of the flies", "catcher in the rye", "romeo and juliet", "macbeth", "hamlet", "of mice and men", "the crucible", "the odyssey", "frankenstein", "pride and prejudice", "jane eyre", "brave new world", "handmaid's tale", "beloved", "things fall apart", "native son", "invisible man", "slaughterhouse"];
    
    if (k2.some(k => t.includes(k))) return res.json({ band: "K-2" });
    if (elem.some(k => t.includes(k))) return res.json({ band: "3-5" });
    if (mid.some(k => t.includes(k))) return res.json({ band: "6-8" });
    if (hs.some(k => t.includes(k))) return res.json({ band: "9-12" });
    
    // Fallback: use author keywords
    const a = (author || "").toLowerCase();
    if (["seuss", "carle", "goodman", "numeroff", "willems"].some(k => a.includes(k))) return res.json({ band: "K-2" });
    if (["cleary", "dahl", "white", "lowry", "spinelli", "sachar"].some(k => a.includes(k))) return res.json({ band: "3-5" });
    if (["riordan", "rowling", "collins", "meyer", "green"].some(k => a.includes(k))) return res.json({ band: "6-8" });
    if (["shakespeare", "fitzgerald", "orwell", "huxley", "atwood", "morrison"].some(k => a.includes(k))) return res.json({ band: "9-12" });
    
    // Default suggestion based on title length (longer titles tend to be higher level)
    if (title.split(" ").length > 8) return res.json({ band: "9-12" });
    if (title.split(" ").length > 5) return res.json({ band: "6-8" });
    if (title.split(" ").length > 3) return res.json({ band: "3-5" });
    return res.json({ band: "K-2" });
  });

  // Admin: Get ALL books (including those without quizzes) for management
  app.get("/api/admin/books", authMiddleware, adminMiddleware, async (_req, res) => {
    try {
      const allBooks = await storage.getAllBooks();
      res.json(allBooks);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/books", authMiddleware, adminMiddleware, async (req, res) => {
    const { title, author, coverUrl, description, questions: quizQuestions, pointsValue, readUrl, gradeBand } = req.body;
    if (!title || !author) {
      return res.status(400).json({ message: "Title and author are required" });
    }
    if (!quizQuestions || !Array.isArray(quizQuestions) || quizQuestions.length !== 10) {
      return res.status(400).json({ message: "Exactly 10 questions are required" });
    }
    for (const q of quizQuestions) {
      if (!q.question || !q.options || q.options.length !== 4 || !q.correct) {
        return res.status(400).json({ message: "Each question needs text, 4 options, and a correct answer (A/B/C/D)" });
      }
      if (!["A", "B", "C", "D"].includes(q.correct)) {
        return res.status(400).json({ message: "Correct answer must be A, B, C, or D" });
      }
    }
    const pts = [10, 20, 30].includes(Number(pointsValue)) ? Number(pointsValue) : 20;
    const derivedAgeGroup = pts === 10 ? "Ages 3-6" : pts === 20 ? "Ages 6-9" : "Ages 9-12";
    const book = await storage.createBookWithQuestions(
      { title, author, ageGroup: derivedAgeGroup, coverUrl, description, pointsValue: pts, readUrl: readUrl || null },
      quizQuestions
    );
    // Save grade band if provided
    if (gradeBand && ["K-2", "3-5", "6-8", "9-12"].includes(gradeBand)) {
      try {
        const rawBands = await storage.getSetting('book_grade_bands');
        let bookBands: Record<string, string> = {};
        if (rawBands) { try { bookBands = JSON.parse(rawBands); } catch {} }
        bookBands[String(book.id)] = gradeBand;
        await storage.upsertSetting('book_grade_bands', JSON.stringify(bookBands));
      } catch {}
    }
    res.status(201).json({ message: "Quiz created successfully", bookId: book.id });
  });

  // Admin: update book cover
  app.patch("/api/admin/books/:id/cover", authMiddleware, adminMiddleware, async (req, res) => {
    const bookId = parseInt(req.params.id);
    const { coverUrl } = req.body;
    if (!coverUrl) {
      return res.status(400).json({ message: "Cover URL is required" });
    }
    await storage.updateBookCover(bookId, coverUrl);
    res.json({ message: "Cover updated successfully" });
  });

  // Student: request a quiz
  app.post("/api/quiz-requests", authMiddleware, async (req: any, res) => {
    const { bookTitle, author } = req.body;
    if (!bookTitle || bookTitle.trim().length < 2) {
      return res.status(400).json({ message: "Book title is required" });
    }
    if (!author || author.trim().length < 2) {
      return res.status(400).json({ message: "Author is required" });
    }
    await storage.createQuizRequest(req.user.id, bookTitle.trim(), author.trim());
    // Create a notification message for the admin
    const adminUser = await storage.getUserByUsername("admin");
    if (adminUser) {
      await storage.createMessage(adminUser.id, "student", `${req.user.displayName} requested a quiz for "${bookTitle.trim()}" by ${author.trim()}`, null);
    }
    res.status(201).json({ message: "Quiz request submitted! Your teacher will create it soon." });
  });

  // Admin: get quiz requests
  app.get("/api/admin/quiz-requests", authMiddleware, adminMiddleware, async (_req, res) => {
    const requests = await storage.getQuizRequests();
    res.json(requests);
  });

  // Admin: update quiz request status
  app.patch("/api/admin/quiz-requests/:id", authMiddleware, adminMiddleware, async (req, res) => {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    await storage.updateQuizRequestStatus(id, status || "completed");
    res.json({ message: "Quiz request updated" });
  });

  // Change password (any logged-in user)
  app.post("/api/change-password", authMiddleware, async (req: any, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new passwords are required" });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ message: "New password must be at least 4 characters" });
    }
    try {
      await storage.changePassword(req.user.id, currentPassword, newPassword);
      res.json({ message: "Password changed successfully" });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to change password" });
    }
  });

  // Change display name (any logged-in user)
  app.post("/api/change-name", authMiddleware, async (req: any, res) => {
    const { displayName } = req.body;
    if (!displayName || displayName.trim().length < 2) {
      return res.status(400).json({ message: "Name must be at least 2 characters" });
    }
    try {
      const updated = await storage.updateDisplayName(req.user.id, displayName.trim());
      res.json({ message: "Name updated successfully", displayName: updated.display_name });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to update name" });
    }
  });

  // Verify proctor password (students use this before taking a quiz)
  app.post("/api/verify-proctor", authMiddleware, async (req, res) => {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }
    const proctorPassword = await storage.getProctorPassword();
    if (password === proctorPassword) {
      res.json({ verified: true });
    } else {
      res.status(403).json({ message: "Incorrect proctor password" });
    }
  });

  // Admin: get/set proctor password
  app.get("/api/admin/proctor-password", authMiddleware, adminMiddleware, async (_req, res) => {
    const password = await storage.getProctorPassword();
    res.json({ password });
  });

  app.post("/api/admin/proctor-password", authMiddleware, adminMiddleware, async (req, res) => {
    const { password } = req.body;
    if (!password || password.length < 4) {
      return res.status(400).json({ message: "Password must be at least 4 characters" });
    }
    await storage.setProctorPassword(password);
    res.json({ message: "Proctor password updated" });
  });

  // Student: request manual review of a quiz
  app.post("/api/quiz-review/:attemptId", authMiddleware, async (req: any, res) => {
    const attemptId = parseInt(req.params.attemptId);
    const { reason } = req.body;
    const { data: attempt } = await supabase.from("attempts").select("*").eq("id", attemptId).eq("user_id", req.user.id).single();
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });
    // Check for existing pending review
    const { data: existing } = await supabase.from("quiz_review_requests").select("*").eq("attempt_id", attemptId).eq("status", "pending").single();
    if (existing) return res.status(400).json({ message: "A review is already pending for this quiz" });
    const { data: book } = await supabase.from("books").select("title, points_value").eq("id", attempt.book_id).single();
    const { data: review } = await supabase.from("quiz_review_requests").insert({
      attempt_id: attemptId,
      user_id: req.user.id,
      book_id: attempt.book_id,
      reason: reason || null,
      status: "pending",
      original_score: attempt.score,
      original_points: attempt.points_earned || 0,
    }).select().single();
    // Also create a message for admin inbox
    await storage.createMessage(req.user.id, "student", `[MANUAL REVIEW REQUEST] ${req.user.displayName} requested a review for "${book?.title || "Unknown"}". Score: ${attempt.score}/${attempt.total}. ${reason || ""}`);
    res.status(201).json({ message: "Review request submitted. Your teacher will review it." });
  });

  // Admin: list review requests
  app.get("/api/admin/review-requests", authMiddleware, adminMiddleware, async (_req, res) => {
    const { data } = await supabase.from("quiz_review_requests").select("*").order("created_at", { ascending: false });
    if (!data) return res.json([]);
    const enriched = await Promise.all(data.map(async (r) => {
      const { data: user } = await supabase.from("users").select("display_name, username").eq("id", r.user_id).single();
      const { data: book } = await supabase.from("books").select("title").eq("id", r.book_id).single();
      return { ...r, studentName: user?.display_name || "Unknown", studentUsername: user?.username || "", bookTitle: book?.title || "Unknown" };
    }));
    res.json(enriched);
  });

  // Admin: get review request details with questions and answers
  app.get("/api/admin/review-requests/:id", authMiddleware, adminMiddleware, async (req, res) => {
    const reviewId = parseInt(req.params.id);
    const { data: review } = await supabase.from("quiz_review_requests").select("*").eq("id", reviewId).single();
    if (!review) return res.status(404).json({ message: "Review request not found" });
    const { data: attempt } = await supabase.from("attempts").select("*").eq("id", review.attempt_id).single();
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });
    const { data: book } = await supabase.from("books").select("title, points_value").eq("id", review.book_id).single();
    const { data: user } = await supabase.from("users").select("display_name, username").eq("id", review.user_id).single();
    const { data: questions } = await supabase.from("questions").select("*").eq("book_id", review.book_id).order("question_order", { ascending: true });
    const studentAnswers = attempt.answers ? (typeof attempt.answers === "string" ? JSON.parse(attempt.answers) : attempt.answers) : {};
    res.json({
      review,
      attempt,
      book: { title: book?.title || "Unknown", pointsValue: book?.points_value || 10 },
      student: { displayName: user?.display_name || "Unknown", username: user?.username || "" },
      questions: (questions || []).map((q: any) => ({
        id: q.id,
        questionText: q.question_text,
        optionA: q.option_a,
        optionB: q.option_b,
        optionC: q.option_c,
        optionD: q.option_d,
        correctAnswer: q.correct_answer,
        studentAnswer: studentAnswers[String(q.id)] || null,
        questionOrder: q.question_order,
      })),
    });
  });

  // Admin: regrade a quiz with corrected answers
  app.post("/api/admin/review-requests/:id/regrade", authMiddleware, adminMiddleware, async (req, res) => {
    const reviewId = parseInt(req.params.id);
    const { correctedAnswers, updateAnswerKey, adminNotes } = req.body;
    const { data: review } = await supabase.from("quiz_review_requests").select("*").eq("id", reviewId).single();
    if (!review) return res.status(404).json({ message: "Review request not found" });
    if (review.status === "resolved") return res.status(400).json({ message: "This review has already been resolved" });
    const { data: attempt } = await supabase.from("attempts").select("*").eq("id", review.attempt_id).single();
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });
    const { data: questions } = await supabase.from("questions").select("*").eq("book_id", review.book_id).order("question_order", { ascending: true });
    const studentAnswers = attempt.answers ? (typeof attempt.answers === "string" ? JSON.parse(attempt.answers) : attempt.answers) : {};
    // Calculate new score using corrected answer keys
    let newScore = 0;
    for (const q of (questions || [])) {
      const correctKey = correctedAnswers?.[String(q.id)] || q.correct_answer;
      if (studentAnswers[String(q.id)] === correctKey) {
        newScore++;
      }
    }
    const total = (questions || []).length;
    const passingScore = Math.ceil(total * 0.7);
    const passed = newScore >= passingScore;
    const { data: book } = await supabase.from("books").select("points_value").eq("id", review.book_id).single();
    const bookPoints = book?.points_value || 10;
    const newPoints = passed ? bookPoints : 0;
    const oldPoints = attempt.points_earned || 0;
    // Update the attempt
    await supabase.from("attempts").update({
      score: newScore,
      points_earned: newPoints,
    }).eq("id", attempt.id);
    // Optionally update the answer key for future students
    if (updateAnswerKey && correctedAnswers) {
      for (const [qId, correctAns] of Object.entries(correctedAnswers)) {
        await supabase.from("questions").update({ correct_answer: correctAns }).eq("id", parseInt(qId));
      }
    }
    // Mark review as resolved
    await supabase.from("quiz_review_requests").update({
      status: "resolved",
      reviewed_score: newScore,
      reviewed_points: newPoints,
      admin_notes: adminNotes || null,
      resolved_at: new Date().toISOString(),
    }).eq("id", reviewId);
    // Send student a message about the result
    const { data: bookTitle } = await supabase.from("books").select("title").eq("id", review.book_id).single();
    const pointDiff = newPoints - oldPoints;
    let msgText = `[QUIZ REVIEW COMPLETE] Your quiz for "${bookTitle?.title || "Unknown"}" has been reviewed. `;
    msgText += `Updated score: ${newScore}/${total}. `;
    if (pointDiff > 0) {
      msgText += `You earned ${pointDiff} additional point${pointDiff > 1 ? "s" : ""}!`;
    } else if (pointDiff < 0) {
      msgText += `${Math.abs(pointDiff)} point${Math.abs(pointDiff) > 1 ? "s" : ""} were removed.`;
    } else {
      msgText += `Your score remained the same.`;
    }
    await storage.createMessage(review.user_id, "teacher", msgText);
    res.json({
      message: "Quiz regraded successfully",
      newScore,
      total,
      newPoints,
      oldPoints,
      pointDiff,
    });
  });

  // ─── Reading Assessment Routes ──────────────────────────────────────

  // Get available passages for a grade level
  app.get("/api/reading-assessment/passages/:grade", authMiddleware, async (req, res) => {
    try {
      const grade = parseInt(req.params.grade);
      const passages = await storage.getPassagesByGrade(grade);
      res.json(passages);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch passages" });
    }
  });

  // Get all passages (for admin)
  app.get("/api/reading-assessment/passages", authMiddleware, async (req, res) => {
    try {
      const passages = await storage.getAllPassages();
    await storage.getAllEyeGazeQuizzes();
      res.json(passages);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch passages" });
    }
  });

  // Start a new assessment
  app.post("/api/reading-assessment/start", authMiddleware, async (req, res) => {
    try {
      const { passageId } = req.body;
      if (!passageId) return res.status(400).json({ message: "Passage ID required" });

      // Check if user already completed this assessment
      const { data: existing } = await supabase
        .from("reading_assessment_attempts")
        .select("*")
        .eq("user_id", req.user.id)
        .eq("passage_id", passageId)
        .eq("status", "completed")
        .limit(1);
      if (existing && existing.length > 0) {
        return res.status(400).json({ message: "You have already taken this assessment" });
      }

      const attempt = await storage.createAssessmentAttempt(req.user.id, passageId);
      const passage = await storage.getPassage(passageId);
      res.json({ attempt, passage });
    } catch (err) {
      res.status(500).json({ message: "Failed to start assessment" });
    }
  });

  // Start questions phase (passage disappears)
  app.post("/api/reading-assessment/:attemptId/start-questions", authMiddleware, async (req, res) => {
    try {
      const attempt = await storage.startAssessmentQuestions(parseInt(req.params.attemptId));
      const questions = await storage.getPassageQuestions(attempt.passage_id);
      res.json({ attempt, questions });
    } catch (err) {
      res.status(500).json({ message: "Failed to start questions" });
    }
  });

  // Submit assessment answers
  app.post("/api/reading-assessment/:attemptId/submit", authMiddleware, async (req, res) => {
    try {
      const { answers } = req.body;
      if (!Array.isArray(answers)) {
        return res.status(400).json({ message: "Answers must be an array" });
      }
      const attemptId = parseInt(req.params.attemptId);
      const attempt = await storage.getAssessmentAttempt(attemptId);
      if (!attempt) return res.status(404).json({ message: "Attempt not found" });
      if (attempt.user_id !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const questions = await storage.getPassageQuestions(attempt.passage_id);
      const result = await storage.submitAssessment(attemptId, answers, questions);
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to submit assessment" });
    }
  });

  // Get reading profile
  app.get("/api/reading-profile", authMiddleware, async (req, res) => {
    try {
      const profile = await storage.getReadingProfile(req.user.id);
      res.json(profile || { current_level: 3, independent_level: 3, instructional_level: 3 });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // Get assessment history
  app.get("/api/reading-profile/history", authMiddleware, async (req, res) => {
    try {
      const history = await storage.getAssessmentHistory(req.user.id);
      res.json(history);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  // Get book recommendations based on reading level
  app.get("/api/reading-profile/recommendations", authMiddleware, async (req, res) => {
    try {
      const recs = await storage.getReadingRecommendations(req.user.id);
      res.json(recs);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  // Admin: get student reading progress
  app.get("/api/admin/students/:id/reading-progress", authMiddleware, async (req, res) => {
    try {
      if (!req.user.isAdmin) return res.status(403).json({ message: "Admin only" });
      const userId = parseInt(req.params.id);
      const profile = await storage.getReadingProfile(userId);
      const history = await storage.getAssessmentHistory(userId);
      res.json({ profile, history });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch reading progress" });
    }
  });

  // Admin: enter i-Ready scores to set reading level (bypasses initial assessment)
  app.post("/api/admin/students/:id/iready-score", authMiddleware, async (req, res) => {
    try {
      if (!req.user.isAdmin) return res.status(403).json({ message: "Admin only" });
      const userId = parseInt(req.params.id);
      const { gradeLevel, scaleScore, comprehensionPct, vocabularyPct } = req.body;
      if (!gradeLevel || gradeLevel < 1 || gradeLevel > 12) {
        return res.status(400).json({ message: "Grade level must be 1-12" });
      }
      if (!scaleScore || scaleScore < 100) {
        return res.status(400).json({ message: "Scale score is required" });
      }
      const result = await storage.setIReadyScore(userId, parseInt(gradeLevel), parseInt(scaleScore), comprehensionPct, vocabularyPct);
      res.json({ message: "i-Ready score saved", ...result });
    } catch (err) {
      res.status(500).json({ message: "Failed to save i-Ready score" });
    }
  });

  // ─── COMPREHENSIVE ASSESSMENT (Timed, all passages) ──────────────

  // Start comprehensive assessment
  app.post("/api/reading-assessment/start-comprehensive", authMiddleware, async (req, res) => {
    try {
      const result = await storage.startComprehensiveAssessment(req.user.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to start assessment" });
    }
  });

  // Start questions phase for comprehensive assessment — no longer needed (round-based flow)
  // Kept for backwards compatibility but not used in round-based flow

  // Submit comprehensive assessment — receives answersByQuestionId, scores server-side
  app.post("/api/reading-assessment/:attemptId/submit-comprehensive", authMiddleware, async (req, res) => {
    try {
      const { answersByQuestionId, timeUsedSeconds } = req.body;
      if (!answersByQuestionId || typeof answersByQuestionId !== "object") {
        return res.status(400).json({ message: "answersByQuestionId object is required" });
      }
      const result = await storage.submitComprehensiveAssessment(
        parseInt(req.params.attemptId),
        answersByQuestionId,
        timeUsedSeconds || 0
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to submit assessment" });
    }
  });

  // Student i-Ready opt-in (self-service, locked once set)
  app.post("/api/reading-assessment/iready-optin", authMiddleware, async (req, res) => {
    try {
      const { scaleScore, comprehensionPct, vocabularyPct } = req.body;
      if (!scaleScore || scaleScore < 100 || scaleScore > 800) {
        return res.status(400).json({ message: "Scale score must be between 100 and 800" });
      }
      const result = await storage.setIReadyOptIn(req.user.id, parseInt(scaleScore), comprehensionPct, vocabularyPct);
      const gradeLevel = storage.ireadyToGrade(parseInt(scaleScore));
      res.json({ message: "i-Ready score saved", gradeLevel, scaleScore: parseInt(scaleScore), ...result });
    } catch (err: any) {
      const status = err.message.includes("already saved") ? 409 : 500;
      res.status(status).json({ message: err.message || "Failed to save i-Ready score" });
    }
  });

  // Assessment popup — check if shown, mark as seen
  app.get("/api/assessment-popup-status", authMiddleware, async (req, res) => {
    try {
      const shown = await storage.hasAssessmentPopupBeenShown(req.user.id);
      res.json({ shown });
    } catch {
      res.json({ shown: true }); // Fail closed — don't show popup on error
    }
  });

  app.post("/api/assessment-popup-dismiss", authMiddleware, async (req, res) => {
    try {
      await storage.markAssessmentPopupSeen(req.user.id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to dismiss popup" });
    }
  });

  // ─── RETAKE FUNCTIONALITY ──────────────────────────────────────────

  // Student requests a retake
  app.post("/api/reading-assessment/request-retake", authMiddleware, async (req, res) => {
    try {
      const { reason } = req.body;
      const result = await storage.requestRetake(req.user.id, reason);
      res.json({ message: "Retake request sent", ...result });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to request retake" });
    }
  });

  // Admin: get retake requests
  app.get("/api/admin/retake-requests", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const requests = await storage.getRetakeRequests();
      res.json(Array.isArray(requests) ? requests : []);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch retake requests" });
    }
  });

  // Admin: approve retake
  app.post("/api/admin/retake-requests/:id/approve", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { adminResponse } = req.body;
      const result = await storage.approveRetake(parseInt(req.params.id), adminResponse);
      res.json({ message: "Retake approved", ...result });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to approve retake" });
    }
  });

  // Admin: deny retake
  app.post("/api/admin/retake-requests/:id/deny", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { adminResponse } = req.body;
      const result = await storage.denyRetake(parseInt(req.params.id), adminResponse);
      res.json({ message: "Retake denied", ...result });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to deny retake" });
    }
  });

  // Admin: send retake to student
  app.post("/api/admin/students/:id/send-retake", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const result = await storage.sendRetakeToStudent(parseInt(req.params.id));
      res.json({ message: "Retake sent to student", ...result });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to send retake" });
    }
  });

  // Check if student has a pending retake approval
  app.get("/api/reading-assessment/retake-status", authMiddleware, async (req, res) => {
    try {
      const requests = await storage.getRetakeRequests();
      const studentRequests = (requests || []).filter((r: any) => r.user_id === req.user.id);
      const approved = studentRequests.find((r: any) => r.status === "approved");
      const pending = studentRequests.find((r: any) => r.status === "pending");
      res.json({
        canRetake: !!approved,
        hasPendingRequest: !!pending,
        approvedRetake: approved || null,
      });
    } catch {
      res.json({ canRetake: false, hasPendingRequest: false });
    }
  });

  // ─── EYE GAZE TESTING ────────────────────────────────────────────────

  // Public endpoint - verify proctor password for eye gaze quizzes
  app.post("/api/eye-gaze/verify-proctor", authMiddleware, async (req, res) => {
    try {
      const { password } = req.body;
      const proctorPassword = await storage.getSetting('proctor_password');
      if (password === proctorPassword) {
        res.json({ verified: true });
      } else {
        res.status(403).json({ message: "Invalid proctor password" });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/eye-gaze/quizzes", authMiddleware, async (req, res) => {
    try {
      const quizzes = await storage.getAllEyeGazeQuizzes();
      const quizzesWithStatus = [];
      for (const quiz of quizzes) {
        const completed = await storage.hasUserCompletedEyeGazeQuiz(req.user.id, quiz.id);
        quizzesWithStatus.push({ ...quiz, hasCompleted: completed });
      }
      res.json(quizzesWithStatus);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/eye-gaze/quizzes/:id", authMiddleware, async (req, res) => {
    try {
      const quizId = parseInt(req.params.id);
      const quiz = await storage.getEyeGazeQuiz(quizId);
      if (!quiz) return res.status(404).json({ message: "Quiz not found" });
      const completed = await storage.hasUserCompletedEyeGazeQuiz(req.user.id, quizId);
      res.json({ ...quiz, hasCompleted: completed });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/eye-gaze/quizzes/:id/start", authMiddleware, async (req, res) => {
    try {
      const quizId = parseInt(req.params.id);
      const quiz = await storage.getEyeGazeQuiz(quizId);
      if (!quiz) return res.status(404).json({ message: "Quiz not found" });
      const completed = await storage.hasUserCompletedEyeGazeQuiz(req.user.id, quizId);
      if (completed) return res.status(400).json({ message: "You have already taken this quiz." });
      const attempt = await storage.startEyeGazeAttempt(req.user.id, quizId);
      res.json({ ...quiz, attemptId: attempt.id });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/eye-gaze/quizzes/:attemptId/submit", authMiddleware, async (req, res) => {
    try {
      const attemptId = parseInt(req.params.attemptId);
      const { answers } = req.body;
      const result = await storage.submitEyeGazeAttempt(attemptId, answers);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/eye-gaze/profile", authMiddleware, async (req, res) => {
    try {
      const profile = await storage.getEyeGazeProfile(req.user.id);
      const history = await storage.getEyeGazeAttemptHistory(req.user.id);
      res.json({ ...profile, history });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── EYE GAZE APPROVAL WORKFLOW ────────────────────────────────────

  // Student: Request eye gaze toggle (creates a pending request, does NOT toggle directly)
  app.post("/api/eye-gaze-toggle-request", authMiddleware, async (req: any, res) => {
    try {
      const { requestedStatus } = req.body; // true or false
      if (requestedStatus === undefined || requestedStatus === null) {
        return res.status(400).json({ message: "requestedStatus (true/false) is required" });
      }

      // Fetch current user to get current status
      const user = await storage.getUser(req.user.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const currentStatus = !!user.is_eye_gaze_user;
      const requested = !!requestedStatus;

      // No-op if already in the requested state
      if (currentStatus === requested) {
        return res.json({ success: true, message: `Eye gaze status is already ${requested ? "enabled" : "disabled"}` });
      }

      // Load existing requests
      const rawRequests = await storage.getSetting('eye_gaze_change_requests');
      let requests: any[] = [];
      if (rawRequests) { try { requests = JSON.parse(rawRequests); } catch {} }

      // Remove any existing pending request for this user
      requests = requests.filter((r: any) => r.userId !== req.user.id || r.status !== 'pending');

      // Add new request
      const newRequest = {
        id: Date.now(),
        userId: req.user.id,
        username: req.user.username,
        displayName: req.user.displayName || req.user.username,
        currentStatus,
        requestedStatus: requested,
        createdAt: new Date().toISOString(),
        status: 'pending' as const,
      };
      requests.push(newRequest);

      await storage.upsertSetting('eye_gaze_change_requests', JSON.stringify(requests));

      // Notify admins
      const { data: adminRows } = await supabase.from("users").select("id").eq("is_admin", true);
      for (const admin of (adminRows || [])) {
        await storage.createMessage(
          admin.id,
          'system',
          `${req.user.displayName || req.user.username} requested to ${requested ? "enable" : "disable"} eye gaze mode. Review and approve or deny in the Admin panel.`,
          '/admin'
        );
      }

      res.json({ success: true, message: `Your request to ${requested ? "enable" : "disable"} eye gaze mode has been submitted for approval.` });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Student: Check their own eye gaze request status
  app.get("/api/eye-gaze-toggle-request", authMiddleware, async (req: any, res) => {
    try {
      const rawRequests = await storage.getSetting('eye_gaze_change_requests');
      let requests: any[] = [];
      if (rawRequests) { try { requests = JSON.parse(rawRequests); } catch {} }

      const myRequest = requests.find((r: any) => r.userId === req.user.id && r.status === 'pending');
      res.json({ request: myRequest || null });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin/Teacher: List pending eye gaze toggle requests
  app.get("/api/eye-gaze-requests", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== 'teacher' && !req.user.isAdmin) {
        return res.status(403).json({ message: "Teacher or admin access required" });
      }

      const rawRequests = await storage.getSetting('eye_gaze_change_requests');
      let requests: any[] = [];
      if (rawRequests) { try { requests = JSON.parse(rawRequests); } catch {} }

      let pending = requests.filter((r: any) => r.status === 'pending');

      // Teachers only see their own students' requests
      if (req.user.role === 'teacher' && !req.user.isAdmin) {
        const teacherStudents = await storage.getTeacherStudents(req.user.id);
        const studentIds = new Set(teacherStudents.map((s: any) => s.id));
        pending = pending.filter((r: any) => studentIds.has(r.userId));
      }

      res.json({ requests: pending });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Approve or deny eye gaze toggle request
  app.post("/api/admin/eye-gaze-approve", authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { requestId, approved } = req.body;
      if (!requestId) return res.status(400).json({ message: "requestId is required" });
      if (approved === undefined || approved === null) return res.status(400).json({ message: "approved (true/false) is required" });

      const rawRequests = await storage.getSetting('eye_gaze_change_requests');
      let requests: any[] = [];
      if (rawRequests) { try { requests = JSON.parse(rawRequests); } catch {} }

      const request = requests.find((r: any) => r.id === requestId);
      if (!request) return res.status(404).json({ message: "Request not found" });
      if (request.status !== 'pending') return res.status(400).json({ message: "Request already processed" });

      if (approved) {
        // Update the user's is_eye_gaze_user in the users table
        const { error } = await supabase
          .from("users")
          .update({ is_eye_gaze_user: request.requestedStatus })
          .eq("id", request.userId);
        if (error) throw new Error(error.message);

        request.status = 'approved';
        request.processedAt = new Date().toISOString();
        request.processedBy = req.user.id;

        // Clear caches (including session cache so authMiddleware returns fresh user data)
        try { clearCache('allUsers'); clearCache('leaderboard'); clearCache('session_'); } catch {}

        // Notify the student
        await storage.createMessage(
          request.userId,
          'admin',
          `Your eye gaze mode request has been ${request.requestedStatus ? "enabled" : "disabled"}.`,
          '/profile'
        );
      } else {
        request.status = 'denied';
        request.processedAt = new Date().toISOString();
        request.processedBy = req.user.id;

        // Notify the student
        await storage.createMessage(
          request.userId,
          'admin',
          `Your eye gaze mode request was not approved at this time.`,
          '/profile'
        );
      }

      await storage.upsertSetting('eye_gaze_change_requests', JSON.stringify(requests));
      res.json({ success: true, request });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Legacy endpoint — now creates a request instead of directly toggling
  app.put("/api/settings/eye-gaze", authMiddleware, async (req, res) => {
    try {
      const { isEyeGaze } = req.body;
      // Redirect to the request workflow
      const user = await storage.getUser(req.user.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const currentStatus = !!user.is_eye_gaze_user;
      const requested = !!isEyeGaze;

      if (currentStatus === requested) {
        return res.json({ success: true, message: `Eye gaze status is already ${requested ? "enabled" : "disabled"}` });
      }

      // Load existing requests
      const rawRequests = await storage.getSetting('eye_gaze_change_requests');
      let requests: any[] = [];
      if (rawRequests) { try { requests = JSON.parse(rawRequests); } catch {} }

      // Remove any existing pending request for this user
      requests = requests.filter((r: any) => r.userId !== req.user.id || r.status !== 'pending');

      requests.push({
        id: Date.now(),
        userId: req.user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        currentStatus,
        requestedStatus: requested,
        createdAt: new Date().toISOString(),
        status: 'pending',
      });

      await storage.upsertSetting('eye_gaze_change_requests', JSON.stringify(requests));

      // Notify admins
      const { data: adminRows } = await supabase.from("users").select("id").eq("is_admin", true);
      for (const admin of (adminRows || [])) {
        await storage.createMessage(
          admin.id,
          'system',
          `${user.displayName || user.username} requested to ${requested ? "enable" : "disable"} eye gaze mode. Review and approve or deny in the Admin panel.`,
          '/admin'
        );
      }

      res.json({ success: true, message: `Your request to ${requested ? "enable" : "disable"} eye gaze mode has been submitted for approval.` });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── BANNER SYSTEM ───────────────────────────────────────────────

  // Get banners (student banner visible to all, teacher banner visible to teachers+admin)
  // Public: Get login banner (no auth required)
  app.get("/api/banners/login", async (req, res) => {
    try {
      const raw = await storage.getSetting('login_banner');
      if (raw) {
        const banner = JSON.parse(raw);
        if (banner.active) return res.json(banner);
      }
      res.json(null);
    } catch {
      res.json(null);
    }
  });

  // Admin: Update login banner
  app.put("/api/admin/banners/login", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { text, bgColor, textColor, active } = req.body;
      const banner = { text: text || '', bgColor: bgColor || '#f59e0b', textColor: textColor || '#1a1a1a', active: active !== false };
      await storage.upsertSetting('login_banner', JSON.stringify(banner));
      res.json({ success: true, banner });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public: Get banners for logged-in users
  app.get("/api/banners", authMiddleware, async (req, res) => {
    try {
      const rawStudent = await storage.getSetting('student_banner');
      const rawTeacher = await storage.getSetting('teacher_banner');
      const result: any = {};
      if (rawStudent) { try { result.studentBanner = JSON.parse(rawStudent); } catch {} }
      if (rawTeacher) {
        try {
          result.teacherBanner = JSON.parse(rawTeacher);
        } catch {}
      }
      // Also return login banner for admin editing
      const rawLogin = await storage.getSetting('login_banner');
      if (rawLogin) { try { result.loginBanner = JSON.parse(rawLogin); } catch {} }
      // Only show teacher banner to teachers and admins
      if (req.user.role !== 'teacher' && !req.user.isAdmin) {
        delete result.teacherBanner;
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Update student banner
  app.put("/api/admin/banners/student", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { text, bgColor, textColor, active } = req.body;
      const banner = { text: text || '', bgColor: bgColor || '#f59e0b', textColor: textColor || '#1a1a1a', active: active !== false };
      await storage.upsertSetting('student_banner', JSON.stringify(banner));
      res.json({ success: true, banner });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Update teacher banner
  app.put("/api/admin/banners/teacher", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { text, bgColor, textColor, active } = req.body;
      const banner = { text: text || '', bgColor: bgColor || '#3b82f6', textColor: textColor || '#ffffff', active: active !== false };
      await storage.upsertSetting('teacher_banner', JSON.stringify(banner));
      res.json({ success: true, banner });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Sync banners (copy student to teacher or vice versa)
  app.post("/api/admin/banners/sync", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { direction } = req.body; // 'student-to-teacher' or 'teacher-to-student'
      if (direction === 'student-to-teacher') {
        const raw = await storage.getSetting('student_banner');
        if (raw) { await storage.upsertSetting('teacher_banner', raw); }
      } else if (direction === 'teacher-to-student') {
        const raw = await storage.getSetting('teacher_banner');
        if (raw) { await storage.upsertSetting('student_banner', raw); }
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── PROCTOR PASSWORD ──────────────────────────────────────────────

  // Get proctor password (teachers and admins only)
  app.get("/api/proctor-password", authMiddleware, async (req, res) => {
    try {
      if (req.user.role !== 'teacher' && !req.user.isAdmin) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      const raw = await storage.getSetting('proctor_password');
      res.json({ password: raw || '' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Update proctor password (notifies all teachers)
  app.put("/api/admin/proctor-password", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { password } = req.body;
      if (!password || password.trim().length < 4) {
        return res.status(400).json({ message: 'Password must be at least 4 characters' });
      }
      await storage.upsertSetting('proctor_password', password.trim());
      
      // Send notification to all teachers
      const allTeachers = await storage.getApprovedTeachers();
      for (const teacher of allTeachers) {
        await storage.createMessage(
          teacher.id,
          'admin',
          `The proctor password has been updated. Click here to view the new password.`,
          '/profile'
        );
      }
      
      res.json({ success: true, password: password.trim() });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── GRADE BAND CHANGE REQUESTS ───────────────────────────────────

  // Student: Request grade band change
  app.post("/api/grade-change-request", authMiddleware, async (req: any, res) => {
    try {
      const { newGrade } = req.body;
      if (!newGrade) return res.status(400).json({ message: 'New grade is required' });
      
      // Check if student already has a pending request
      const rawRequests = await storage.getSetting('grade_change_requests');
      let requests: any[] = [];
      if (rawRequests) { try { requests = JSON.parse(rawRequests); } catch {} }
      
      // Remove any existing pending request for this user
      requests = requests.filter((r: any) => r.userId !== req.user.id || r.status !== 'pending');
      
      // Add new request
      const newBand = gradeToBand(newGrade);
      const oldGrade = await (async () => {
        const rawGrades = await storage.getSetting('user_grades');
        let userGrades: Record<string, string> = {};
        if (rawGrades) { try { userGrades = JSON.parse(rawGrades); } catch {} }
        return userGrades[String(req.user.id)] || null;
      })();
      const oldBand = oldGrade ? gradeToBand(oldGrade) : null;
      
      requests.push({
        id: Date.now(),
        userId: req.user.id,
        username: req.user.username,
        displayName: req.user.display_name || req.user.username,
        oldGrade,
        oldBand,
        newGrade,
        newBand,
        status: 'pending',
        requestedAt: new Date().toISOString()
      });
      
      await storage.upsertSetting('grade_change_requests', JSON.stringify(requests));
      
      // Notify all admins
      const { data: adminRows } = await supabase.from("users").select("id").eq("is_admin", true).eq("role", "admin");
      for (const admin of (adminRows || [])) {
        await storage.createMessage(
          admin.id,
          'system',
          `${req.user.display_name || req.user.username} requested to change from Grade ${oldGrade || 'N/A'} (${oldBand || 'N/A'} Band) to Grade ${newGrade} (${newBand} Band). Review and approve or deny in the Admin panel.`,
          '/admin'
        );
      }
      
      res.json({ success: true, message: 'Grade change request submitted' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Student: Check their grade change request status
  app.get("/api/grade-change-request", authMiddleware, async (req: any, res) => {
    try {
      const rawRequests = await storage.getSetting('grade_change_requests');
      let requests: any[] = [];
      if (rawRequests) { try { requests = JSON.parse(rawRequests); } catch {} }
      
      const myRequest = requests.find((r: any) => r.userId === req.user.id && r.status === 'pending');
      res.json({ request: myRequest || null });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Teacher/Admin: Get pending grade change requests
  app.get("/api/grade-change-requests", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== 'teacher' && !req.user.isAdmin) {
        return res.status(403).json({ message: 'Teacher or admin access required' });
      }
      const rawRequests = await storage.getSetting('grade_change_requests');
      let requests: any[] = [];
      if (rawRequests) { try { requests = JSON.parse(rawRequests); } catch {} }
      
      // For teachers, only show their students' requests
      let pending = requests.filter((r: any) => r.status === 'pending');
      if (req.user.role === 'teacher' && !req.user.isAdmin) {
        const teacherStudents = await storage.getTeacherStudents(req.user.id);
        const studentIds = new Set(teacherStudents.map((s: any) => s.id));
        pending = pending.filter((r: any) => studentIds.has(r.userId));
      }
      res.json({ requests: pending });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Get all user grades (for student filtering)
  app.get("/api/admin/user-grades", authMiddleware, async (req: any, res) => {
    try {
      if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin only' });
      const rawGrades = await storage.getSetting('user_grades');
      let userGrades: Record<string, string> = {};
      if (rawGrades) { try { userGrades = JSON.parse(rawGrades); } catch {} }
      res.json(userGrades);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Get book grade bands (for library filtering)
  app.get("/api/admin/book-bands", authMiddleware, async (req: any, res) => {
    try {
      if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin only' });
      const rawBands = await storage.getSetting('book_grade_bands');
      let bookBands: Record<string, string> = {};
      if (rawBands) { try { bookBands = JSON.parse(rawBands); } catch {} }
      res.json(bookBands);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Teacher/Admin: Approve or deny grade change request
  app.post("/api/grade-change-requests/:id", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== 'teacher' && !req.user.isAdmin) {
        return res.status(403).json({ message: 'Teacher or admin access required' });
      }
      const { action } = req.body; // 'approve' or 'deny'
      const requestId = parseInt(req.params.id);
      
      const rawRequests = await storage.getSetting('grade_change_requests');
      let requests: any[] = [];
      if (rawRequests) { try { requests = JSON.parse(rawRequests); } catch {} }
      
      const request = requests.find((r: any) => r.id === requestId);
      if (!request) return res.status(404).json({ message: 'Request not found' });
      if (request.status !== 'pending') return res.status(400).json({ message: 'Request already processed' });
      
      // For teachers, verify this is their student
      if (req.user.role === 'teacher' && !req.user.isAdmin) {
        const teacherStudents = await storage.getTeacherStudents(req.user.id);
        const studentIds = new Set(teacherStudents.map((s: any) => s.id));
        if (!studentIds.has(request.userId)) {
          return res.status(403).json({ message: 'This student is not in your class' });
        }
      }
      
      if (action === 'approve') {
        request.status = 'approved';
        request.processedAt = new Date().toISOString();
        request.processedBy = req.user.id;
        
        // Update the student's grade
        const rawGrades = await storage.getSetting('user_grades');
        let userGrades: Record<string, string> = {};
        if (rawGrades) { try { userGrades = JSON.parse(rawGrades); } catch {} }
        userGrades[String(request.userId)] = request.newGrade;
        await storage.upsertSetting('user_grades', JSON.stringify(userGrades));
        
        // Notify the student
        await storage.createMessage(
          request.userId,
          req.user.isAdmin ? 'admin' : req.user.username,
          `Your grade change request has been approved! You are now in Grade ${request.newGrade} (${request.newBand} Band). Your library and leaderboard have been updated.`,
          '/library'
        );
      } else {
        request.status = 'denied';
        request.processedAt = new Date().toISOString();
        request.processedBy = req.user.id;
        
        // Notify the student
        await storage.createMessage(
          request.userId,
          req.user.isAdmin ? 'admin' : req.user.username,
          `Your grade change request to Grade ${request.newGrade} (${request.newBand} Band) was not approved at this time.`,
          '/profile'
        );
      }
      
      await storage.upsertSetting('grade_change_requests', JSON.stringify(requests));
      res.json({ success: true, request });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── TEACHER ROUTES ────────────────────────────────────────────────

  // List approved teachers for student signup dropdown
  app.get("/api/teachers", async (_req, res) => {
    try {
      const teachers = await storage.getApprovedTeachers();
      res.json(teachers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Teacher middleware
  async function teacherOrAdminMiddleware(req: any, res: any, next: any) {
    if (req.user.role !== 'teacher' && !req.user.isAdmin) {
      return res.status(403).json({ message: "Teacher or admin access required" });
    }
    next();
  }

  app.get("/api/teacher/students", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const teacherId = req.user.isAdmin ? null : req.user.id;
      let students;
      if (teacherId) {
        students = await storage.getTeacherStudents(teacherId);
      } else {
        // Admin sees all students (role = student only, no teachers)
        students = (await storage.getAllUsers()).filter((u: any) => u.role === 'student' || (!u.role && !u.isAdmin));
      }
      res.json(students);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/teacher/pending-students", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const teacherId = req.user.isAdmin ? null : req.user.id;
      const students = teacherId
        ? await storage.getPendingStudents(teacherId)
        : await storage.getAllUsers().then((all: any[]) => all.filter(u => !u.approvedByTeacher));
      res.json(students);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/teacher/approve/:studentId", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const studentId = parseInt(req.params.studentId);
      const teacherId = req.user.isAdmin ? null : req.user.id;
      if (teacherId) {
        await storage.approveStudent(studentId, teacherId);
        // Send notification message to student
        const teacher = await storage.getUser(teacherId);
        const teacherName = teacher?.displayName || "your teacher";
        await storage.createMessage(studentId, "teacher", `Welcome! You've been approved and are now in ${teacherName}'s class.`);
      } else {
        // Admin approving on behalf of teacher
        await supabase.from("users").update({ approved_by_teacher: true }).eq("id", studentId);
        const student = await storage.getUser(studentId);
        const teacherName = student?.teacherId ? ((await storage.getUser(student.teacherId))?.displayName || "your teacher") : "your teacher";
        await storage.createMessage(studentId, "teacher", `Welcome! You've been approved by an admin and are now in ${teacherName}'s class.`);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/teacher/reset-password/:studentId", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const studentId = parseInt(req.params.studentId);
      const tempPassword = 'arise' + Math.random().toString(36).slice(2, 8);
      const hashedPassword = bcrypt.hashSync(tempPassword, 10);
      await storage.resetPassword(studentId, hashedPassword);
      res.json({ success: true, tempPassword });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Student: get classmates (approved students with same teacher)
  app.get("/api/student/classmates", authMiddleware, async (req: any, res) => {
    try {
      if (!req.user.teacherId) {
        return res.json([]);
      }
      const classmates = await storage.getTeacherStudents(req.user.teacherId);
      // Filter out the current student
      const filtered = classmates.filter((c: any) => c.id !== req.user.id);
      res.json(filtered.map((c: any) => ({
        id: c.id,
        displayName: c.displayName,
        totalPoints: c.totalPoints || 0,
        isEyeGazeUser: c.is_eye_gaze_user || false,
      })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Teacher: get student profile (quiz history, stats)
  app.get("/api/teacher/student/:id/profile", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const studentId = parseInt(req.params.id);
      // Verify student belongs to this teacher (or admin)
      const student = await storage.getUser(studentId);
      if (!student) return res.status(404).json({ message: "Student not found" });
      if (!req.user.isAdmin && student.teacherId !== req.user.id) {
        return res.status(403).json({ message: "You can only view your own students" });
      }
      const attempts = await storage.getUserAttempts(studentId);
      const books = await storage.getAllBooks();
      const bookMap = new Map(books.map(b => [b.id, b]));
      const quizResults = attempts.map(a => {
        const book = bookMap.get(a.bookId);
        const passingScore = Math.ceil((a.totalQuestions || 10) * 0.7);
        const passed = a.score >= passingScore;
        return {
          bookId: a.bookId,
          title: book?.title || "Unknown",
          author: book?.author || "",
          coverUrl: book?.coverUrl,
          readUrl: book?.readUrl,
          pointsValue: book?.pointsValue || 10,
          score: a.score,
          total: a.totalQuestions,
          pointsEarned: a.pointsEarned ?? 0,
          passed,
          passingScore,
          completedAt: a.completedAt,
        };
      });
      const totalPoints = attempts.reduce((sum, a) => sum + (a.pointsEarned || 0), 0);
      res.json({
        student: {
          id: student.id,
          displayName: student.displayName,
          username: student.username,
          isEyeGazeUser: student.is_eye_gaze_user || false,
        },
        totalPoints,
        quizzesTaken: attempts.length,
        totalBooks: books.length,
        quizResults,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Teacher: get messages with a student
  app.get("/api/teacher/student/:id/messages", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const studentId = parseInt(req.params.id);
      const student = await storage.getUser(studentId);
      if (!student) return res.status(404).json({ message: "Student not found" });
      if (!req.user.isAdmin && student.teacherId !== req.user.id) {
        return res.status(403).json({ message: "You can only view your own students" });
      }
      const messages = await storage.getUserMessages(studentId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Teacher: send message to a student
  app.post("/api/teacher/student/:id/message", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const studentId = parseInt(req.params.id);
      const student = await storage.getUser(studentId);
      if (!student) return res.status(404).json({ message: "Student not found" });
      if (!req.user.isAdmin && student.teacherId !== req.user.id) {
        return res.status(403).json({ message: "You can only message your own students" });
      }
      const { messageText, linkUrl } = req.body;
      if (!messageText || messageText.trim().length === 0) {
        return res.status(400).json({ message: "Message text is required" });
      }
      const msg = await storage.createMessage(studentId, "teacher", messageText.trim(), linkUrl || undefined);
      res.status(201).json(msg);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Teacher: get student certificates (passed quizzes)
  app.get("/api/teacher/student/:id/certificates", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const studentId = parseInt(req.params.id);
      const student = await storage.getUser(studentId);
      if (!student) return res.status(404).json({ message: "Student not found" });
      if (!req.user.isAdmin && student.teacherId !== req.user.id) {
        return res.status(403).json({ message: "You can only view your own students" });
      }
      const attempts = await storage.getUserAttempts(studentId);
      const books = await storage.getAllBooks();
      const bookMap = new Map(books.map(b => [b.id, b]));
      const passed = attempts
        .filter(a => {
          const passingScore = Math.ceil((a.totalQuestions || 10) * 0.7);
          return a.score >= passingScore;
        })
        .map(a => {
          const book = bookMap.get(a.bookId);
          return {
            bookId: a.bookId,
            title: book?.title || "Unknown",
            pointsEarned: a.pointsEarned ?? 0,
            completedAt: a.completedAt,
          };
        });
      res.json({
        student: { id: student.id, displayName: student.displayName },
        certificates: passed,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: reset teacher password
  app.post("/api/admin/teachers/:id/reset-password", authMiddleware, adminMiddleware, async (req, res) => {
    const userId = parseInt(req.params.id);
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ message: "Password must be at least 4 characters" });
    }
    const hashed = bcrypt.hashSync(newPassword, 10);
    await storage.resetPassword(userId, hashed);
    res.json({ message: "Password reset successfully" });
  });

  // Admin: approve teacher account
  app.post("/api/admin/teacher-approve/:userId", authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      // Get teacher info for email
      const { data: teacher } = await supabase.from("users").select("*").eq("id", userId).single();
      const { error } = await supabase.from("users").update({ account_approved: true }).eq("id", userId);
      if (error) throw new Error(error.message);
      const hasEmail = !!teacher?.email;
      res.json({ success: true, hasEmail });
      // Clear cache and send email after response is sent
      setImmediate(() => {
        try { clearCache('teachers'); clearCache('allUsers'); } catch {}
        if (hasEmail) {
          try {
            sendEmail(
              teacher.email,
              "Your A.R.I.S.E Reader teacher account is approved!",
              teacherApprovedEmail(teacher.display_name || teacher.username, teacher.username)
            ).catch(() => {});
          } catch {}
        }
      });
    } catch (error: any) {
      console.error("[teacher-approve] Error:", error);
      res.status(500).json({ message: error.message || "Failed to approve teacher" });
    }
  });

  // Admin: manually create teacher account (pre-approved)
  app.post("/api/admin/teachers", authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { username, password, displayName, email } = req.body;
      if (!username || !password || !displayName) {
        return res.status(400).json({ message: "Username, password, and display name are required" });
      }
      if (username.length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      const existing = await storage.getUserByUsername(username.toLowerCase());
      if (existing) {
        return res.status(409).json({ message: "Username already taken" });
      }
      const hashedPassword = bcrypt.hashSync(password, 10);
      let user;
      try {
        user = await storage.createUser({
          username: username.toLowerCase(),
          password: hashedPassword,
          displayName,
          role: 'teacher',
          accountApproved: true,
          email: email || null,
        });
      } catch (createErr) {
        return res.status(500).json({ message: 'Failed to create user: ' + createErr.message });
      }
      res.status(201).json({ success: true, hasEmail: !!user.email, user: { id: user.id, username: user.username, displayName: user.displayName, email: user.email } });
      setImmediate(() => {
        try { clearCache('teachers'); } catch {}
        if (user.email) {
          sendEmail(
            user.email,
            "Your A.R.I.S.E Reader teacher account is ready",
            teacherCreatedEmail(displayName, user.username)
          ).catch(() => {});
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: get pending teachers
  app.get("/api/admin/pending-teachers", authMiddleware, adminMiddleware, async (_req, res) => {
    try {
      // Fetch directly without cache to ensure new signups show up immediately
      const { data, error } = await supabase
        .from("users")
        .select("id, username, display_name, role, account_approved, email, created_at")
        .eq("role", 'teacher')
        .order("display_name", { ascending: true });
      if (error) throw new Error(error.message);
      const pending = (data || []).filter((t: any) => !t.account_approved);
      res.json(pending);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: delete user
  app.delete("/api/admin/users/:userId", authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { error } = await supabase.from("users").delete().eq("id", userId);
      if (error) throw new Error(error.message);
      res.json({ success: true });
      setImmediate(() => {
        try { clearCache('allUsers'); clearCache('teachers'); } catch {}
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── CUSTOM EYE GAZE QUIZZES (Teacher/Parent created) ──────────────

  app.get("/api/custom-quizzes", authMiddleware, async (req: any, res) => {
    try {
      // For students: show global quizzes + their teacher's quizzes
      // For admin/teacher: show their own quizzes + global
      let quizzes;
      if (req.user.role === 'student' && req.user.teacherId) {
        quizzes = await storage.getCustomQuizzesForStudent(req.user.id, req.user.teacherId);
      } else if (req.user.role === 'student') {
        quizzes = await storage.getCustomQuizzesForStudent(req.user.id, null);
      } else {
        // Admin or teacher: show all
        quizzes = await storage.getAllCustomEyeGazeQuizzes();
      }
      const quizzesWithStatus = [];
      for (const quiz of quizzes) {
        const completed = await storage.hasUserCompletedCustomQuiz(req.user.id, quiz.id);
        quizzesWithStatus.push({ ...quiz, hasCompleted: completed });
      }
      res.json(quizzesWithStatus);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/custom-quizzes/:id", authMiddleware, async (req, res) => {
    try {
      const quizId = parseInt(req.params.id);
      const quiz = await storage.getCustomEyeGazeQuiz(quizId);
      if (!quiz) return res.status(404).json({ message: "Quiz not found" });
      const questions = await storage.getCustomEyeGazeQuizQuestions(quizId);
      const completed = await storage.hasUserCompletedCustomQuiz(req.user.id, quizId);
      res.json({ ...quiz, questions, hasCompleted: completed });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/custom-quizzes", authMiddleware, async (req: any, res) => {
    try {
      const { title, description, level, questions, visibility, quizType } = req.body;
      if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ message: "Title and at least one question are required" });
      }
      // Teachers can only create eye_gaze quizzes
      const effectiveQuizType = req.user.role === 'teacher' ? 'eye_gaze' : (quizType || 'eye_gaze');
      // Teachers can only create for their own students; admin can choose
      const quizVisibility = req.user.role === 'teacher' ? 'teacher_students' : (visibility || 'global');
      const targetTeacherId = req.user.role === 'teacher' ? req.user.id : (quizVisibility === 'teacher_students' ? req.body.targetTeacherId : null);
      const quiz = await storage.createCustomEyeGazeQuiz(
        req.user.id,
        title,
        description || "",
        level || "Custom",
        questions,
        quizVisibility,
        targetTeacherId,
        effectiveQuizType
      );
      res.status(201).json({ success: true, quiz });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Edit custom quiz
  app.put("/api/custom-quizzes/:id", authMiddleware, async (req: any, res) => {
    try {
      const quizId = parseInt(req.params.id);
      const { title, description, level, questions } = req.body;
      if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ message: "Title and at least one question are required" });
      }
      const quiz = await storage.updateCustomEyeGazeQuiz(quizId, req.user.id, title, description || "", level || "Custom", questions);
      res.json({ success: true, quiz });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/custom-quizzes/:id", authMiddleware, async (req, res) => {
    try {
      const quizId = parseInt(req.params.id);
      await storage.deleteCustomEyeGazeQuiz(quizId, req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/custom-quizzes/:id/start", authMiddleware, async (req, res) => {
    try {
      const quizId = parseInt(req.params.id);
      const quiz = await storage.getCustomEyeGazeQuiz(quizId);
      if (!quiz) return res.status(404).json({ message: "Quiz not found" });
      const completed = await storage.hasUserCompletedCustomQuiz(req.user.id, quizId);
      if (completed) return res.status(400).json({ message: "You have already taken this quiz." });
      const attempt = await storage.startCustomEyeGazeAttempt(req.user.id, quizId);
      res.json({ ...quiz, attemptId: attempt.id });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/custom-quizzes/:attemptId/submit", authMiddleware, async (req, res) => {
    try {
      const attemptId = parseInt(req.params.attemptId);
      const { answers } = req.body;
      const result = await storage.submitCustomEyeGazeAttempt(attemptId, answers);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== POLLS ==========

  // Helper: read polls directly from Supabase (no cache)
  async function getPolls(): Promise<any[]> {
    try {
      const { data, error } = await supabase.from("settings").select("value").eq("key", "polls").maybeSingle();
      if (error || !data) return [];
      try { return JSON.parse(data.value); } catch { return []; }
    } catch { return []; }
  }

  // Helper: save polls to Supabase
  async function savePolls(polls: any[]): Promise<boolean> {
    try {
      const json = JSON.stringify(polls);
      // Use upsert with onConflict to handle both insert and update cases
      const { error } = await supabase
        .from("settings")
        .upsert({ key: "polls", value: json }, { onConflict: "key" });
      if (error) {
        // Fallback: try update, then insert
        const { data: updateData, error: updateErr } = await supabase
          .from("settings")
          .update({ value: json })
          .eq("key", "polls")
          .select();
        if (updateErr || !updateData || updateData.length === 0) {
          const { error: insertErr } = await supabase
            .from("settings")
            .insert({ key: "polls", value: json });
          if (insertErr) return false;
        }
      }
      return true;
    } catch { return false; }
  }

  // GET /api/polls - get all polls
  app.get("/api/polls", authMiddleware, async (req: any, res) => {
    try {
      const polls = await getPolls();
      const userId = req.user.id;
      const isAdmin = req.user.isAdmin;
      const result = polls.map(p => {
        const now = new Date();
        const endsAt = new Date(p.endsAt);
        const isActive = now < endsAt;
        const userVote = p.votes && p.votes[userId];
        const totalVotes = p.votes ? Object.keys(p.votes).length : 0;
        const optionCounts: Record<string, number> = {};
        if (p.votes) {
          for (const [uid, v] of Object.entries(p.votes)) {
            optionCounts[(v as any).optionId] = (optionCounts[(v as any).optionId] || 0) + 1;
          }
        }
        const optionResults = p.options.map((opt: any) => ({
          id: opt.id,
          text: opt.text,
          count: optionCounts[opt.id] || 0,
          percentage: totalVotes > 0 ? Math.round(((optionCounts[opt.id] || 0) / totalVotes) * 100) : 0,
        }));
        const showResults = !!userVote || isAdmin || !isActive;
        return {
          id: p.id,
          question: p.question,
          options: showResults ? optionResults : p.options.map((o: any) => ({ id: o.id, text: o.text })),
          isActive,
          endsAt: p.endsAt,
          createdAt: p.createdAt,
          hasVoted: !!userVote,
          selectedOptionId: userVote ? (userVote as any).optionId : null,
          totalVotes,
          showResults,
        };
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/admin/polls - create a poll (admin only)
  app.post("/api/admin/polls", authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { question, options, durationHours } = req.body;
      if (!question || !question.trim()) return res.status(400).json({ message: "Question is required" });
      if (!options || !Array.isArray(options) || options.length < 2 || options.length > 6) {
        return res.status(400).json({ message: "Provide 2-6 options" });
      }
      const dur = durationHours || 24;
      const now = new Date();
      const endsAt = new Date(now.getTime() + dur * 60 * 60 * 1000);
      const polls = await getPolls();
      const newPoll = {
        id: `poll_${Date.now()}`,
        question: question.trim(),
        options: options.map((text: string, i: number) => ({ id: `opt_${i}`, text: text.trim() })),
        createdAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
        createdBy: req.user.id,
        votes: {},
      };
      polls.unshift(newPoll);
      const trimmed = polls.slice(0, 20);
      const ok = await savePolls(trimmed);
      if (!ok) return res.status(500).json({ message: "Failed to save poll" });
      res.json({ success: true, poll: newPoll });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/polls/:pollId/vote - vote on a poll
  app.post("/api/polls/:pollId/vote", authMiddleware, async (req: any, res) => {
    try {
      const { pollId } = req.params;
      const { optionId } = req.body;
      const userId = req.user.id;
      for (let attempt = 0; attempt < 3; attempt++) {
        const polls = await getPolls();
        const poll = polls.find(p => p.id === pollId);
        if (!poll) return res.status(404).json({ message: "Poll not found" });
        const now = new Date();
        const endsAt = new Date(poll.endsAt);
        if (now >= endsAt) return res.status(400).json({ message: "This poll has ended" });
        if (poll.votes && poll.votes[userId]) return res.status(400).json({ message: "You have already voted on this poll" });
        const validOption = poll.options.find((o: any) => o.id === optionId);
        if (!validOption) return res.status(400).json({ message: "Invalid option" });
        if (!poll.votes) poll.votes = {};
        poll.votes[userId] = { optionId, votedAt: new Date().toISOString() };
        const ok = await savePolls(polls);
        if (ok) {
          const totalVotes = Object.keys(poll.votes).length;
          const optionCounts: Record<string, number> = {};
          for (const [uid, v] of Object.entries(poll.votes)) {
            optionCounts[(v as any).optionId] = (optionCounts[(v as any).optionId] || 0) + 1;
          }
          const optionResults = poll.options.map((opt: any) => ({
            id: opt.id,
            text: opt.text,
            count: optionCounts[opt.id] || 0,
            percentage: totalVotes > 0 ? Math.round(((optionCounts[opt.id] || 0) / totalVotes) * 100) : 0,
          }));
          return res.json({
            success: true,
            poll: {
              id: poll.id,
              question: poll.question,
              options: optionResults,
              isActive: true,
              endsAt: poll.endsAt,
              hasVoted: true,
              selectedOptionId: optionId,
              totalVotes,
              showResults: true,
            },
          });
        }
      }
      res.status(500).json({ message: "Failed to submit vote after retries" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/admin/polls/:pollId/close - close a poll early (admin only)
  app.post("/api/admin/polls/:pollId/close", authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { pollId } = req.params;
      const polls = await getPolls();
      const poll = polls.find(p => p.id === pollId);
      if (!poll) return res.status(404).json({ message: "Poll not found" });
      poll.endsAt = new Date().toISOString();
      const ok = await savePolls(polls);
      if (!ok) return res.status(500).json({ message: "Failed to close poll" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // DELETE /api/admin/polls/:pollId - delete a poll (admin only)
  app.delete("/api/admin/polls/:pollId", authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { pollId } = req.params;
      const polls = await getPolls();
      const filtered = polls.filter(p => p.id !== pollId);
      const ok = await savePolls(filtered);
      if (!ok) return res.status(500).json({ message: "Failed to delete poll" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ─── A.R.I.S.E F.Y.P ROUTES ─────────────────────────────────────

  // GET /api/fyp/feed - Get personalized book feed
  app.get("/api/fyp/feed", authMiddleware, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const user = req.user;
      
      // Get user grade from user_grades setting
      let userGrade: string | null = null;
      const rawGrades = await storage.getSetting('user_grades');
      if (rawGrades) {
        try {
          const grades = JSON.parse(rawGrades);
          userGrade = grades[String(user.id)] || null;
        } catch {}
      }
      
      // Check teacher bands
      let teacherBands: Set<string> | null = null;
      if (user.role === 'teacher' || user.role === 'admin') {
        const teacherGradesSetting = await storage.getSetting('teacher_grades');
        if (teacherGradesSetting) {
          try {
            const teacherGrades = JSON.parse(teacherGradesSetting);
            const myGrades = teacherGrades[String(user.id)];
            if (myGrades) {
              const bands = new Set<string>();
              for (const g of myGrades) {
                const band = gradeToBand(g);
                if (band) bands.add(band);
              }
              if (bands.size > 0) teacherBands = bands;
            }
          } catch {}
        }
      }
      
      const feed = await storage.getFypFeed(user.id, userGrade, teacherBands, limit);
      res.json({ items: feed, nextCursor: null });
    } catch (error: any) {
      console.error('FYP feed error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/fyp/reaction - Like or dislike a book
  app.post("/api/fyp/reaction", authMiddleware, async (req: any, res) => {
    try {
      const { bookId, reaction } = req.body;
      if (!bookId) return res.status(400).json({ message: 'bookId is required' });
      if (reaction && !['like', 'dislike'].includes(reaction)) {
        return res.status(400).json({ message: 'Invalid reaction' });
      }
      const counts = await storage.setFypReaction(req.user.id, parseInt(bookId), reaction);
      res.json(counts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/fyp/event - Log feed interaction
  app.post("/api/fyp/event", authMiddleware, async (req: any, res) => {
    try {
      const { bookId, eventType, dwellMs, feedSessionId, metadata } = req.body;
      if (!bookId || !eventType) return res.status(400).json({ message: 'bookId and eventType required' });
      const validEvents = ['view', 'dwell', 'expand', 'read_click', 'quiz_click', 'share', 'skip', 'like', 'dislike'];
      if (!validEvents.includes(eventType)) {
        return res.status(400).json({ message: 'Invalid event type' });
      }
      await storage.logFypEvent(req.user.id, parseInt(bookId), eventType, dwellMs, feedSessionId, metadata);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/fyp/share - Create share link
  app.post("/api/fyp/share", authMiddleware, async (req: any, res) => {
    try {
      const { bookId } = req.body;
      if (!bookId) return res.status(400).json({ message: 'bookId is required' });
      const token = await storage.createFypShareLink(req.user.id, parseInt(bookId));
      const shareUrl = `${process.env.APP_URL || 'https://arisereader.pplx.app'}/fyp/share/${token}`;
      res.json({ shareUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/fyp/save - Save or unsave a book
  app.post("/api/fyp/save", authMiddleware, async (req: any, res) => {
    try {
      const { bookId, saved } = req.body;
      if (!bookId) return res.status(400).json({ message: 'bookId is required' });
      await storage.setFypSave(req.user.id, parseInt(bookId), saved);
      res.json({ success: true, saved });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/fyp/my-books - Get saved and liked books
  app.get("/api/fyp/my-books", authMiddleware, async (req: any, res) => {
    try {
      const data = await storage.getFypMyBooks(req.user.id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/fyp/share/:token - Public share data (no auth)
  app.get("/api/fyp/share/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const data = await storage.getFypShareData(token);
      if (!data) return res.status(404).json({ message: 'Share link not found' });
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
