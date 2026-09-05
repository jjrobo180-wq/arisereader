import { supabase } from "./supabase";
import bcrypt from "bcryptjs";

let bookQuizzes: any[] = [];

// Retry wrapper for Supabase queries - handles intermittent connectivity failures
async function withRetry<T>(fn: () => Promise<T>, retries = 5, delayMs = 1000): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError;
}

// Simple in-memory cache with TTL - does NOT cache empty results
const cache = new Map<string, { data: any; expires: number }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const cachedEntry = cache.get(key);
  if (cachedEntry && Date.now() < cachedEntry.expires) {
    return cachedEntry.data as T;
  }
  const data = await fn();
  // Only cache non-empty results to avoid caching failed fetches
  if (Array.isArray(data) ? data.length > 0 : data != null) {
    cache.set(key, { data, expires: Date.now() + ttlMs });
  }
  return data;
}

// Clear cache entries matching a prefix
function clearCache(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

// Helper to fetch with retry that returns data or null (for .single() queries)
async function fetchSingle(query: any, retries = 5): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data, error } = await query;
      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found, which is a valid result (null)
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
      }
      return data;
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000));
      } else {
        return null;
      }
    }
  }
  return null;
}

// Helper to fetch lists with retry
async function fetchList(query: any, retries = 5): Promise<any[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data, error } = await query;
      if (error) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        return [];
      }
      return data || [];
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000));
      } else {
        return [];
      }
    }
  }
  return [];
}

// Map snake_case DB rows to camelCase objects that routes.ts expects
function mapUser(row: any) {
  if (!row) return undefined;
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    displayName: row.display_name,
    isAdmin: row.is_admin,
    totalPoints: row.total_points,
    createdAt: row.created_at,
    assessment_prompt_seen_at: row.assessment_prompt_seen_at,
    is_eye_gaze_user: row.is_eye_gaze_user,
    role: row.role || 'student',
    teacherId: row.teacher_id || null,
    approvedByTeacher: row.approved_by_teacher !== false,
    accountApproved: row.account_approved !== false,
    email: row.email || null,
    school_id: row.school_id || null,
  };
}

function mapBook(row: any) {
  if (!row) return undefined;
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    ageGroup: row.age_group,
    coverUrl: row.cover_url,
    description: row.description,
    pointsValue: row.points_value || 10,
    readUrl: row.read_url || null,
  };
}

function mapQuestion(row: any) {
  if (!row) return undefined;
  return {
    id: row.id,
    bookId: row.book_id,
    questionText: row.question_text,
    optionA: row.option_a,
    optionB: row.option_b,
    optionC: row.option_c,
    optionD: row.option_d,
    correctAnswer: row.correct_answer,
    questionOrder: row.question_order,
  };
}

function mapAttempt(row: any) {
  if (!row) return undefined;
  return {
    id: row.id,
    userId: row.user_id,
    bookId: row.book_id,
    score: row.score,
    totalQuestions: row.total,
    pointsEarned: row.points_earned || 0,
    completedAt: row.completed_at,
  };
}

function mapMessage(row: any) {
  if (!row) return undefined;
  return {
    id: row.id,
    userId: row.user_id,
    senderType: row.sender_type,
    messageText: row.message_text,
    linkUrl: row.link_url,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

function mapSession(row: any) {
  if (!row) return undefined;
  return {
    id: row.id,
    token: row.token,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

export async function seedData() {
  // Load quiz data at call time
  if (bookQuizzes.length === 0) {
    try {
      const { readFileSync } = require("node:fs");
      const { resolve } = require("node:path");
      const jsonPath = resolve(__dirname, "../shared/quizData.json");
      const raw = readFileSync(jsonPath, "utf-8");
      bookQuizzes = JSON.parse(raw);
    } catch (e) {
      console.error("Could not load quiz data:", e);
      return;
    }
  }

  // Check if books already exist
  const { data: existingBooks } = await supabase.from("books").select("id").limit(1);
  if (existingBooks && existingBooks.length > 0) {
    console.log("Seed data already exists, skipping.");
    return;
  }

  // Seed books and questions
  for (let qi = 0; qi < bookQuizzes.length; qi++) {
    const quiz = bookQuizzes[qi];
    const { data: book, error: bookError } = await supabase
      .from("books")
      .insert({
        title: quiz.title,
        author: quiz.author,
        age_group: quiz.ageGroup,
        cover_url: quiz.coverUrl,
        description: quiz.description,
      })
      .select()
      .single();

    if (bookError || !book) {
      console.error(`Failed to insert book ${quiz.title}:`, bookError?.message);
      continue;
    }

    const questionRows = quiz.questions.map((q: any, i: number) => ({
      book_id: book.id,
      question_text: q.question,
      option_a: q.options[0],
      option_b: q.options[1],
      option_c: q.options[2],
      option_d: q.options[3],
      correct_answer: q.correct,
      question_order: i,
    }));

    const { error: qError } = await supabase.from("questions").insert(questionRows);
    if (qError) {
      console.error(`Failed to insert questions for ${quiz.title}:`, qError.message);
    }
  }

  // Create default admin
  const adminPassword = bcrypt.hashSync("admin123", 10);
  const { error: adminError } = await supabase.from("users").insert({
    username: "admin",
    password: adminPassword,
    display_name: "Teacher (Admin)",
    is_admin: true,
  });
  if (adminError) {
    console.error("Failed to create admin user:", adminError.message);
  } else {
    console.log("Seed data inserted: books, questions, and admin user created.");
  }
}

export interface IStorage {
  getUser(id: number): Promise<any>;
  getUserByUsername(username: string): Promise<any>;
  createUser(user: { username: string; password: string; displayName: string; schoolId?: number | null }): Promise<any>;
  resetPassword(userId: number, newPassword: string): Promise<void>;
  getAllUsers(): Promise<any[]>;
  createSession(userId: number): Promise<any>;
  getSession(token: string): Promise<{ user: any } | null>;
  deleteSession(token: string): Promise<void>;
  getAllBooks(): Promise<any[]>;
  getBook(id: number): Promise<any>;
  getQuestionsByBook(bookId: number): Promise<any[]>;
  getAttempt(userId: number, bookId: number): Promise<any>;
  createAttempt(userId: number, bookId: number, score: number, total: number): Promise<any>;
  getUserAttempts(userId: number): Promise<any[]>;
  getUserMessages(userId: number): Promise<any[]>;
  createMessage(userId: number, senderType: string, text: string, linkUrl?: string): Promise<any>;
  markMessageRead(id: number): Promise<void>;
  markAllMessagesRead(userId: number): Promise<void>;
  getUnreadMessageCount(userId: number): Promise<number>;
  getUnreadStudentMessageCount(): Promise<number>;
  getAllStudentMessages(): Promise<any[]>;
  getSentMessages(): Promise<any[]>;
  markMessageReadById(id: number, userId: number): Promise<void>;
  getLeaderboard(): Promise<any[]>;
  getStudentDetail(userId: number): Promise<any>;
  createBookWithQuestions(book: any, quizQuestions: any[]): Promise<any>;
  updateBookCover(bookId: number, coverUrl: string): Promise<void>;
  getNotifsSeenAt(): Promise<string>;
  setNotifsSeenAt(): Promise<void>;
  getNotifSeenAt(key: string): Promise<string>;
  setNotifSeenAt(key: string): Promise<void>;
  getAnnouncement(): Promise<string>;
  setAnnouncement(text: string): Promise<void>;
  getSetting(key: string): Promise<string>;
  // Schools & Classes
  createSchool(name: string): Promise<any>;
  getAllSchools(): Promise<any[]>;
  createClass(schoolId: number, name: string): Promise<any>;
  getClassesBySchool(schoolId: number): Promise<any[]>;
  getAllClasses(): Promise<any[]>;
  deleteSchool(schoolId: number): Promise<void>;
  deleteClass(classId: number): Promise<void>;
  assignStudentToSchool(userId: number, schoolId: number | null): Promise<void>;
  assignStudentToClass(userId: number, classId: number | null): Promise<void>;
  getSchoolStats(): Promise<any[]>;
  getClassStats(schoolId: number): Promise<any[]>;
  // Monthly leaderboard
  getMonthlyLeaderboard(yearMonth: string): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number) {
    const data = await fetchSingle(supabase.from("users").select("*").eq("id", id).single());
    return mapUser(data);
  }

  async getUserByUsername(username: string) {
    const data = await fetchSingle(supabase.from("users").select("*").eq("username", username).single());
    return mapUser(data);
  }

  async createUser(user: { username: string; password: string; displayName: string; isEyeGazeUser?: boolean; role?: string; teacherId?: number | null; approvedByTeacher?: boolean; accountApproved?: boolean; email?: string | null; schoolId?: number | null }) {
    const { data, error } = await supabase
      .from("users")
      .insert({
        username: user.username,
        password: user.password,
        display_name: user.displayName,
        is_admin: false,
        is_eye_gaze_user: user.isEyeGazeUser || false,
        role: user.role || 'student',
        teacher_id: user.teacherId ?? null,
        approved_by_teacher: user.approvedByTeacher ?? true,
        account_approved: user.accountApproved ?? true,
        email: user.email || null,
        school_id: user.schoolId ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    clearCache('allUsers');
    clearCache('leaderboard');
    clearCache('monthlyLeaderboard');
    return mapUser(data);
  }

  async resetPassword(userId: number, newPassword: string) {
    await supabase.from("users").update({ password: newPassword }).eq("id", userId);
  }

  async getAllUsers() {
    return cached('allUsers', 300000, async () => {
      const data = await fetchList(supabase.from("users").select("*").eq("is_admin", false));
      return data.map(mapUser);
    });
  }

  async createSession(userId: number) {
    const token = crypto.randomUUID();
    const data = await fetchSingle(
      supabase.from("sessions").insert({ token, user_id: userId }).select().single()
    );
    if (!data) throw new Error("Failed to create session");
    cache.delete('session_' + token);
    return mapSession(data);
  }

  async getSession(token: string) {
    return cached('session_' + token, 120000, async () => {
      const session = await fetchSingle(
        supabase.from("sessions").select("*").eq("token", token).single()
      );
      if (!session) return null;
      const user = await fetchSingle(
        supabase.from("users").select("*").eq("id", session.user_id).single()
      );
      if (!user) return null;
      return { user: mapUser(user) };
    });
  }

  async deleteSession(token: string) {
    cache.delete('session_' + token);
    await supabase.from("sessions").delete().eq("token", token);
  }

  async getAllBooks() {
    return cached('allBooks', 300000, async () => {
      const data = await fetchList(supabase.from("books").select("*"));
      return data.map(mapBook);
    });
  }

  async getBook(id: number) {
    const data = await fetchSingle(supabase.from("books").select("*").eq("id", id).single());
    return mapBook(data);
  }

  async getQuestionsByBook(bookId: number) {
    const data = await fetchList(
      supabase.from("questions").select("*").eq("book_id", bookId).order("question_order", { ascending: true })
    );
    return data.map(mapQuestion);
  }

  async getAttempt(userId: number, bookId: number) {
    const data = await fetchSingle(
      supabase.from("attempts").select("*").eq("user_id", userId).eq("book_id", bookId).single()
    );
    return mapAttempt(data);
  }

  async createAttempt(userId: number, bookId: number, score: number, total: number, answers?: Record<string, string>) {
    // Get the book's points value
    const book = await fetchSingle(supabase.from("books").select("points_value").eq("id", bookId).single());
    const bookPoints = book?.points_value || 10;
    const passingScore = Math.ceil(total * 0.7);
    const passed = score >= passingScore;
    const pointsEarned = passed ? bookPoints : 0;
    const data = await fetchSingle(
      supabase.from("attempts").insert({
        user_id: userId,
        book_id: bookId,
        score,
        total,
        points_earned: pointsEarned,
        answers: answers ? JSON.stringify(answers) : null,
      }).select().single()
    );
    if (!data) throw new Error("Failed to create attempt");
    return { ...mapAttempt(data), passed, passingScore, bookPoints };
  }

  async getUserAttempts(userId: number) {
    const data = await fetchList(supabase.from("attempts").select("*").eq("user_id", userId));
    return data.map(mapAttempt);
  }

  async getUserMessages(userId: number) {
    const data = await fetchList(
      supabase.from("messages").select("*").eq("user_id", userId).order("created_at", { ascending: true })
    );
    return data.map(mapMessage);
  }

  async createMessage(userId: number, senderType: string, text: string, linkUrl?: string) {
    const data = await fetchSingle(
      supabase.from("messages").insert({
        user_id: userId,
        sender_type: senderType,
        message_text: text,
        link_url: linkUrl || null,
      }).select().single()
    );
    if (!data) throw new Error("Failed to create message");
    return mapMessage(data);
  }

  async markMessageRead(id: number) {
    await supabase.from("messages").update({ is_read: true }).eq("id", id);
  }

  async markAllMessagesRead(userId: number) {
    await supabase.from("messages").update({ is_read: true }).eq("user_id", userId).eq("sender_type", "teacher").eq("is_read", false);
  }

  async getUnreadMessageCount(userId: number) {
    const { data } = await supabase
      .from("messages")
      .select("id")
      .eq("user_id", userId)
      .eq("sender_type", "teacher")
      .eq("is_read", false);
    return data ? data.length : 0;
  }

  async getUnreadStudentMessageCount() {
    const { data } = await supabase
      .from("messages")
      .select("id")
      .eq("sender_type", "student")
      .eq("is_read", false);
    return data ? data.length : 0;
  }

  async getAllStudentMessages() {
    const msgs = await fetchList(
      supabase.from("messages").select("*").eq("sender_type", "student").order("created_at", { ascending: false })
    );

    if (msgs.length === 0) return [];

    const result = [];
    for (const msg of msgs) {
      const student = await fetchSingle(
        supabase.from("users").select("display_name, username").eq("id", msg.user_id).single()
      );
      result.push({
        id: msg.id,
        userId: msg.user_id,
        studentName: student?.display_name || "Unknown",
        studentUsername: student?.username || "",
        messageText: msg.message_text,
        linkUrl: msg.link_url,
        isRead: msg.is_read,
        createdAt: msg.created_at,
      });
    }
    return result;
  }

  async getSentMessages() {
    const msgs = await fetchList(
      supabase.from("messages").select("*").eq("sender_type", "teacher").order("created_at", { ascending: false })
    );

    if (msgs.length === 0) return [];

    const result = [];
    for (const msg of msgs) {
      const student = await fetchSingle(
        supabase.from("users").select("display_name, username").eq("id", msg.user_id).single()
      );
      result.push({
        id: msg.id,
        userId: msg.user_id,
        studentName: student?.display_name || "Unknown",
        studentUsername: student?.username || "",
        messageText: msg.message_text,
        linkUrl: msg.link_url,
        isRead: msg.is_read,
        createdAt: msg.created_at,
      });
    }
    return result;
  }

  async markMessageReadById(id: number, userId: number) {
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", userId);
  }

  async getLeaderboard() {
    return cached('leaderboard', 300000, async () => {
      // Use embedded resources to fetch users with their attempts in a single query
      const allUsers = await fetchList(
        supabase.from("users").select("id, username, display_name, attempts(points_earned)").eq("is_admin", false)
      );
      if (allUsers.length === 0) return [];

      const allBooks = await fetchList(supabase.from("books").select("id"));
      const totalBooks = allBooks.length;

      const result = allUsers.map((user) => {
        const attempts = user.attempts || [];
        const totalPoints = attempts.reduce((sum, a) => sum + (a.points_earned || 0), 0);
        return {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          totalPoints,
          quizzesTaken: attempts.length,
          totalBooks,
        };
      });
      return result.sort((a, b) => b.totalPoints - a.totalPoints);
    });
  }

  async getEyeGazeLeaderboard() {
    return cached('eye_gaze_leaderboard', 300000, async () => {
      const allUsers = await fetchList(
        supabase.from("users")
          .select("id, username, display_name, eye_gaze_attempts(score, total)")
          .eq("is_admin", false)
          .eq("is_eye_gaze_user", true)
      );
      if (allUsers.length === 0) return [];
      const result = allUsers.map((user) => {
        const attempts = user.eye_gaze_attempts || [];
        const totalScore = attempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0);
        const totalQuestions = attempts.reduce((sum: number, a: any) => sum + (a.total || 0), 0);
        return {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          totalPoints: totalScore,
          quizzesTaken: attempts.length,
          totalQuestions,
        };
      });
      return result.sort((a: any, b: any) => b.totalPoints - a.totalPoints);
    });
  }

  async getMonthlyEyeGazeLeaderboard(yearMonth: string) {
    return cached(`eye_gaze_leaderboard_${yearMonth}`, 300000, async () => {
      const allUsers = await fetchList(
        supabase.from("users")
          .select("id, username, display_name, eye_gaze_attempts(score, total)")
          .eq("is_admin", false)
          .eq("is_eye_gaze_user", true)
      );
      if (allUsers.length === 0) return [];
      const result = allUsers.map((user) => {
        const attempts = (user.eye_gaze_attempts || []).filter((a: any) => {
          const d = a.completed_at || a.created_at;
          return d && d.startsWith(yearMonth);
        });
        const totalScore = attempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0);
        return {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          totalPoints: totalScore,
          quizzesTaken: attempts.length,
        };
      });
      return result.sort((a: any, b: any) => b.totalPoints - a.totalPoints);
    });
  }

  async getStudentDetail(userId: number) {
    const user = await fetchSingle(
      supabase.from("users").select("*").eq("id", userId).single()
    );
    if (!user) return null;

    const userAttempts = await fetchList(
      supabase.from("attempts").select("*").eq("user_id", userId).order("completed_at", { ascending: false })
    );

    const allBooks = await fetchList(supabase.from("books").select("*"));
    const bookMap = new Map(allBooks.map((b) => [b.id, mapBook(b)]));

    const quizHistory = userAttempts.map((a) => {
      const book = bookMap.get(a.book_id);
      return {
        bookId: a.book_id,
        title: book?.title || "Unknown",
        author: book?.author || "",
        coverUrl: book?.coverUrl,
        ageGroup: book?.ageGroup || "",
        pointsValue: book?.pointsValue || 10,
        score: a.score,
        total: a.total,
        pointsEarned: a.points_earned || 0,
        completedAt: a.completed_at,
      };
    });

    const totalPoints = userAttempts.reduce((sum, a) => sum + (a.points_earned || 0), 0);

    const userMessages = await fetchList(
      supabase.from("messages").select("*").eq("user_id", userId).order("created_at", { ascending: true })
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        createdAt: user.created_at,
        schoolId: user.school_id || null,
      },
      totalPoints,
      quizzesTaken: userAttempts ? userAttempts.length : 0,
      totalBooks: allBooks ? allBooks.length : 0,
      schoolId: user.school_id || null,
      quizHistory,
      messages: (userMessages || []).map(mapMessage),
    };
  }

  async createBookWithQuestions(book: any, quizQuestions: any[]) {
    const { data: created, error: bookError } = await supabase
      .from("books")
      .insert({
        title: book.title,
        author: book.author,
        age_group: book.ageGroup,
        cover_url: book.coverUrl || null,
        description: book.description || "",
        points_value: book.pointsValue || 10,
        read_url: book.readUrl || null,
      })
      .select()
      .single();
    if (bookError) throw new Error(bookError.message);

    const questionRows = quizQuestions.map((q, i) => ({
      book_id: created.id,
      question_text: q.question,
      option_a: q.options[0],
      option_b: q.options[1],
      option_c: q.options[2],
      option_d: q.options[3],
      correct_answer: q.correct,
      question_order: i,
    }));

    const { error: qError } = await supabase.from("questions").insert(questionRows);
    if (qError) throw new Error(qError.message);

    clearCache('allBooks');
    return mapBook(created);
  }

  async updateBookCover(bookId: number, coverUrl: string) {
    await supabase.from("books").update({ cover_url: coverUrl }).eq("id", bookId);
    clearCache('allBooks');
  }

  // Quiz requests
  async createQuizRequest(userId: number, bookTitle: string, author?: string) {
    const { data, error } = await supabase
      .from("quiz_requests")
      .insert({ user_id: userId, book_title: bookTitle, author: author || null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async getQuizRequests() {
    const { data, error } = await supabase
      .from("quiz_requests")
      .select("*, users!inner(username, display_name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      bookTitle: r.book_title,
      author: r.author,
      status: r.status,
      createdAt: r.created_at,
      studentName: r.users?.display_name || r.users?.username || "Unknown",
    }));
  }

  async updateQuizRequestStatus(id: number, status: string) {
    await supabase.from("quiz_requests").update({ status }).eq("id", id);
  }

  // Change password
  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await fetchSingle(supabase.from("users").select("password").eq("id", userId).single());
    if (!user) throw new Error("User not found");
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new Error("Current password is incorrect");
    const hashed = await bcrypt.hash(newPassword, 10);
    await supabase.from("users").update({ password: hashed }).eq("id", userId);
  }

  // Update display name
  async updateDisplayName(userId: number, displayName: string) {
    const { data, error } = await supabase
      .from("users")
      .update({ display_name: displayName })
      .eq("id", userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  // Proctor password
  async getNotifsSeenAt(): Promise<string> {
    const data = await fetchSingle(supabase.from("settings").select("value").eq("key", "notifs_seen_at").single());
    return data?.value || "";
  }

  async setNotifsSeenAt(): Promise<void> {
    const { error: updateError } = await supabase.from("settings").update({ value: new Date().toISOString() }).eq("key", "notifs_seen_at");
    if (updateError) {
      const { error: insertError } = await supabase.from("settings").insert({ key: "notifs_seen_at", value: new Date().toISOString() });
      if (insertError) throw new Error(insertError.message);
    }
  }

  async getNotifSeenAt(key: string): Promise<string> {
    const data = await fetchSingle(supabase.from("settings").select("value").eq("key", `${key}_seen_at`).single());
    return data?.value || "";
  }

  async setNotifSeenAt(key: string): Promise<void> {
    const settingsKey = `${key}_seen_at`;
    const { error } = await supabase.from("settings").update({ value: new Date().toISOString() }).eq("key", settingsKey);
    if (error) throw new Error(error.message);
    // If update affected 0 rows, insert instead
    const existing = await fetchList(supabase.from("settings").select("id").eq("key", settingsKey).limit(1));
    if (existing.length === 0) {
      await supabase.from("settings").insert({ key: settingsKey, value: new Date().toISOString() });
    }
  }

  async getProctorPassword(): Promise<string> {
    return cached('proctorPassword', 300000, async () => {
      const data = await fetchSingle(supabase.from("settings").select("value").eq("key", "proctor_password").single());
      return data?.value || "";
    });
  }

  async setProctorPassword(password: string) {
    // Use update + fallback insert (upsert without onConflict crashes)
    const { error: updateError } = await supabase.from("settings").update({ value: password }).eq("key", "proctor_password");
    if (updateError) {
      // Row might not exist yet, try insert
      const { error: insertError } = await supabase.from("settings").insert({ key: "proctor_password", value: password });
      if (insertError) throw new Error(insertError.message);
    }
    clearCache('proctorPassword');
  }

  async getAnnouncement(): Promise<string> {
    return cached('announcement', 300000, async () => {
      const data = await fetchSingle(supabase.from("settings").select("value").eq("key", "announcement").single());
      return data?.value || "";
    });
  }

  async setAnnouncement(text: string): Promise<void> {
    // Use update + fallback insert (upsert without onConflict crashes)
    const { error: updateError } = await supabase.from("settings").update({ value: text }).eq("key", "announcement");
    if (updateError) {
      const { error: insertError } = await supabase.from("settings").insert({ key: "announcement", value: text });
      if (insertError) throw new Error(insertError.message);
    }
    clearCache('announcement');
  }

  async getSetting(key: string): Promise<string> {
    return cached(`setting_${key}`, 300000, async () => {
      const data = await fetchSingle(supabase.from("settings").select("value").eq("key", key).single());
      return data?.value || "";
    });
  }

  // ─── Schools & Classes ────────────────────────────────────────────────

  async createSchool(name: string) {
    const { data, error } = await supabase.from("schools").insert({ name }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async getAllSchools() {
    const data = await fetchList(supabase.from("schools").select("*").order("name", { ascending: true }));
    return data;
  }

  async createClass(schoolId: number, name: string) {
    const { data, error } = await supabase.from("classes").insert({ school_id: schoolId, name }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async getClassesBySchool(schoolId: number) {
    const data = await fetchList(supabase.from("classes").select("*").eq("school_id", schoolId).order("name", { ascending: true }));
    return data;
  }

  async getAllClasses() {
    const data = await fetchList(supabase.from("classes").select("*, schools(id, name)").order("name", { ascending: true }));
    return data;
  }

  async deleteSchool(schoolId: number) {
    // First null out school_id and class_id on any students in this school's classes
    const { data: classes } = await supabase.from("classes").select("id").eq("school_id", schoolId);
    if (classes && classes.length > 0) {
      const classIds = classes.map((c: any) => c.id);
      await supabase.from("users").update({ class_id: null }).in("class_id", classIds);
      await supabase.from("classes").delete().eq("school_id", schoolId);
    }
    // Null out school_id on remaining students
    await supabase.from("users").update({ school_id: null }).eq("school_id", schoolId);
    const { error } = await supabase.from("schools").delete().eq("id", schoolId);
    if (error) throw new Error(error.message);
  }

  async deleteClass(classId: number) {
    // First null out class_id on any students in this class
    await supabase.from("users").update({ class_id: null }).eq("class_id", classId);
    const { error } = await supabase.from("classes").delete().eq("id", classId);
    if (error) throw new Error(error.message);
  }

  async assignStudentToSchool(userId: number, schoolId: number | null) {
    await supabase.from("users").update({ school_id: schoolId }).eq("id", userId);
  }

  async assignStudentToClass(userId: number, classId: number | null) {
    await supabase.from("users").update({ class_id: classId }).eq("id", userId);
  }

  async getSchoolStats() {
    const { data: schools } = await supabase.from("schools").select("*").order("name", { ascending: true });
    if (schools.length === 0) return [];

    const result = [];
    for (const school of schools) {
      const { data: students } = await supabase.from("users").select("id, display_name, total_points").eq("school_id", school.id).eq("is_admin", false);
      const studentCount = students ? students.length : 0;
      const totalPoints = students ? students.reduce((sum: number, s: any) => sum + (s.total_points || 0), 0) : 0;

      const { data: classes } = await supabase.from("classes").select("id, name").eq("school_id", school.id);

      // Get all attempts for students in this school
      let quizzesCompleted = 0;
      if (students && students.length > 0) {
        const studentIds = students.map((s: any) => s.id);
        for (const sid of studentIds) {
          const { count } = await supabase.from("attempts").select("id", { count: "exact" }).eq("user_id", sid);
          quizzesCompleted += count || 0;
        }
      }

      result.push({
        id: school.id,
        name: school.name,
        studentCount,
        totalPoints,
        quizzesCompleted,
        classes: classes || [],
      });
    }
    return result;
  }

  async getClassStats(schoolId: number) {
    const { data: classes } = await supabase.from("classes").select("*").eq("school_id", schoolId).order("name", { ascending: true });
    if (classes.length === 0) return [];

    const result = [];
    for (const cls of classes) {
      const { data: students } = await supabase.from("users").select("id, display_name, total_points").eq("class_id", cls.id).eq("is_admin", false);
      const studentCount = students ? students.length : 0;
      const totalPoints = students ? students.reduce((sum: number, s: any) => sum + (s.total_points || 0), 0) : 0;

      let quizzesCompleted = 0;
      if (students && students.length > 0) {
        for (const s of students) {
          const { count } = await supabase.from("attempts").select("id", { count: "exact" }).eq("user_id", s.id);
          quizzesCompleted += count || 0;
        }
      }

      result.push({
        id: cls.id,
        name: cls.name,
        studentCount,
        totalPoints,
        quizzesCompleted,
      });
    }
    return result;
  }

  // ─── Monthly Leaderboard ──────────────────────────────────────────────

  async getMonthlyLeaderboard(yearMonth: string) {
    return cached('monthlyLeaderboard_' + yearMonth, 300000, async () => {
      // yearMonth format: "YYYY-MM"
      const startDate = `${yearMonth}-01T00:00:00Z`;
      const [year, month] = yearMonth.split("-").map(Number);
      const nextMonth = month === 12 ? `${year + 1}-01-01T00:00:00Z` : `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00Z`;

      // Use embedded resources to fetch users with their attempts in a single query
      const allUsers = await fetchList(
        supabase.from("users").select("id, username, display_name, attempts(points_earned, completed_at)").eq("is_admin", false)
      );
      if (allUsers.length === 0) return [];

      const allBooks = await fetchList(supabase.from("books").select("id"));
      const totalBooks = allBooks.length;

      const result = [];
      for (const user of allUsers) {
        const allAttempts = user.attempts || [];
        // Filter by date in JavaScript (single query vs N queries)
        const monthlyAttempts = allAttempts.filter(a => {
          const d = a.completed_at;
          return d && d >= startDate && d < nextMonth;
        });
        const monthlyPoints = monthlyAttempts.reduce((sum, a) => sum + (a.points_earned || 0), 0);
        if (monthlyAttempts.length > 0) {
          result.push({
            id: user.id,
            username: user.username,
            displayName: user.display_name,
            totalPoints: monthlyPoints,
            quizzesTaken: monthlyAttempts.length,
            totalBooks,
          });
        }
      }
      return result.sort((a, b) => b.totalPoints - a.totalPoints);
    });
  }

  // ─── Reading Assessment ─────────────────────────────────────────────

  async getPassagesByGrade(gradeLevel: number): Promise<any[]> {
    return cached(`passages_${gradeLevel}`, 300000, async () => {
      return fetchList(supabase.from("reading_passages").select("*").eq("grade_level", gradeLevel).eq("is_active", true).order("id"));
    });
  }

  async getPassage(passageId: number): Promise<any | null> {
    return cached(`passage_${passageId}`, 300000, async () => {
      return fetchSingle(supabase.from("reading_passages").select("*").eq("id", passageId).single());
    });
  }

  async getPassageQuestions(passageId: number): Promise<any[]> {
    return cached(`passage_questions_${passageId}`, 300000, async () => {
      return fetchList(supabase.from("reading_assessment_questions").select("*").eq("passage_id", passageId).order("question_order"));
    });
  }

  async createAssessmentAttempt(userId: number, passageId: number): Promise<any> {
    const { data, error } = await supabase.from("reading_assessment_attempts").insert({
      user_id: userId,
      passage_id: passageId,
      status: "reading",
      reading_started_at: new Date().toISOString(),
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async startAssessmentQuestions(attemptId: number): Promise<any> {
    const { data, error } = await supabase.from("reading_assessment_attempts").update({
      status: "questions",
      questions_started_at: new Date().toISOString(),
    }).eq("id", attemptId).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async submitAssessment(
    attemptId: number,
    answers: any[],
    questions: any[]
  ): Promise<any> {
    let score = 0;
    const skillScores: Record<string, { correct: number; total: number }> = {};

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const userAnswer = answers[i] || "";
      const correct = userAnswer === q.correct_answer;
      if (correct) score++;

      const skill = q.skill_type || "comprehension";
      if (!skillScores[skill]) skillScores[skill] = { correct: 0, total: 0 };
      skillScores[skill].total++;
      if (correct) skillScores[skill].correct++;
    }

    const total = questions.length;
    const passage = await this.getPassage(questions[0]?.passage_id);
    const gradeLevel = passage?.grade_level || 3;
    const pct = total > 0 ? (score / total) * 100 : 0;
    let estimatedLevel = "instructional";
    if (pct >= 80) estimatedLevel = "independent";
    else if (pct >= 70) estimatedLevel = "instructional";
    else if (pct >= 60) estimatedLevel = "needs_support";
    else estimatedLevel = "frustration";

    const { data, error } = await supabase.from("reading_assessment_attempts").update({
      status: "completed",
      answers: answers,
      score,
      total,
      skill_scores: skillScores,
      estimated_grade_level: estimatedLevel,
      completed_at: new Date().toISOString(),
    }).eq("id", attemptId).select().single();
    if (error) throw new Error(error.message);

    // Update reading profile
    await this.updateReadingProfile(data.user_id, gradeLevel, pct, skillScores);
    clearCache(`reading_profile_${data.user_id}`);
    clearCache(`reading_recommendations_${data.user_id}`);
    return data;
  }

  async updateReadingProfile(
    userId: number,
    gradeLevel: number,
    pct: number,
    skillScores: Record<string, { correct: number; total: number }>
  ): Promise<void> {
    // Determine new level based on performance
    let newLevel = gradeLevel;
    if (pct >= 85) newLevel = Math.min(gradeLevel + 1, 8);
    else if (pct < 60) newLevel = Math.max(gradeLevel - 1, 2);

    const vocabPct = skillScores.vocabulary ? (skillScores.vocabulary.correct / skillScores.vocabulary.total) * 100 : 0;
    const compPct = skillScores.comprehension ? (skillScores.comprehension.correct / skillScores.comprehension.total) * 100 : 0;
    const infPct = skillScores.inference ? (skillScores.inference.correct / skillScores.inference.total) * 100 : 0;
    const retPct = skillScores.retention ? (skillScores.retention.correct / skillScores.retention.total) * 100 : 0;

    // Try update first — check if any rows were actually affected
    const { data: updateData, error: updateError } = await supabase.from("reading_profiles").update({
      current_level: newLevel,
      independent_level: pct >= 80 ? gradeLevel : (newLevel > 2 ? newLevel - 1 : 2),
      instructional_level: newLevel,
      vocab_score_avg: Math.round(vocabPct),
      comprehension_score_avg: Math.round(compPct),
      inference_score_avg: Math.round(infPct),
      retention_score_avg: Math.round(retPct),
      next_target_level: Math.min(newLevel + 1, 8),
      last_assessed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId).select();

    if (updateError || !updateData || updateData.length === 0) {
      // Profile doesn't exist yet, create it
      const { error: insertError } = await supabase.from("reading_profiles").insert({
        user_id: userId,
        current_level: newLevel,
        independent_level: pct >= 80 ? gradeLevel : (newLevel > 2 ? newLevel - 1 : 2),
        instructional_level: newLevel,
        vocab_score_avg: Math.round(vocabPct),
        comprehension_score_avg: Math.round(compPct),
        inference_score_avg: Math.round(infPct),
        retention_score_avg: Math.round(retPct),
        next_target_level: Math.min(newLevel + 1, 8),
        last_assessed_at: new Date().toISOString(),
        total_assessments: 1,
      });
      if (insertError) throw new Error(insertError.message);
    } else {
      // Profile exists, increment total_assessments
      const current = updateData[0];
      await supabase.from("reading_profiles").update({
        total_assessments: (current.total_assessments || 0) + 1,
      }).eq("user_id", userId);
    }
  }

  async getReadingProfile(userId: number): Promise<any | null> {
    return cached(`reading_profile_${userId}`, 120000, async () => {
      return fetchSingle(supabase.from("reading_profiles").select("*").eq("user_id", userId).single());
    });
  }

  async getAssessmentHistory(userId: number): Promise<any[]> {
    return fetchList(supabase.from("reading_assessment_attempts").select("id, passage_id, status, score, total, skill_scores, estimated_grade_level, completed_at, reading_passages(title, grade_level)").eq("user_id", userId).order("completed_at", { ascending: false }).limit(20));
  }

  async getReadingRecommendations(userId: number): Promise<any> {
    const profile = await this.getReadingProfile(userId);
    const level = profile?.current_level || 3;

    // Map grade level to points
    let startPoints = 10;
    let stretchPoints = 20;
    if (level >= 6) { startPoints = 30; stretchPoints = 30; }
    else if (level >= 4) { startPoints = 20; stretchPoints = 30; }

    // Get books at the right level
    const allBooks = await this.getAllBooks();
    const userAttempts = await this.getUserAttempts(userId);
    const passedBookIds = new Set(userAttempts.filter(a => (a.pointsEarned || 0) > 0).map(a => a.bookId));

    const startHere = allBooks.filter(b => b.pointsValue === startPoints && !passedBookIds.has(b.id)).slice(0, 6);
    const stretch = allBooks.filter(b => b.pointsValue === stretchPoints && !passedBookIds.has(b.id) && b.id !== startHere[0]?.id).slice(0, 4);
    const buildConfidence = allBooks.filter(b => b.pointsValue === 10 && !passedBookIds.has(b.id)).slice(0, 4);

    return {
      currentLevel: level,
      startHere,
      stretch,
      buildConfidence,
      profile,
    };
  }

  async getAllPassages(): Promise<any[]> {
    return cached('allPassages', 300000, async () => {
      return fetchList(supabase.from("reading_passages").select("id, title, body, grade_level, genre, word_count, is_active").order("grade_level"));
    });
  }

  async getAssessmentAttempt(attemptId: number): Promise<any | null> {
    return fetchSingle(supabase.from("reading_assessment_attempts").select("*").eq("id", attemptId).single());
  }

  // Set reading level from i-Ready scores (bypasses initial assessment)
  async setIReadyScore(
    userId: number,
    gradeLevel: number,
    scaleScore: number,
    comprehensionPct?: number,
    vocabularyPct?: number
  ): Promise<any> {
    const independentLevel = gradeLevel;
    const instructionalLevel = Math.min(gradeLevel, 8);
    const nextTarget = Math.min(gradeLevel + 1, 8);
    const compScore = comprehensionPct ?? Math.round((scaleScore / 700) * 100);
    const vocabScore = vocabularyPct ?? Math.round((scaleScore / 700) * 100);
    const infScore = Math.round((scaleScore / 700) * 100);
    const retScore = Math.round((scaleScore / 700) * 100);
    const now = new Date().toISOString();

    const profileData = {
      user_id: userId,
      current_level: gradeLevel,
      independent_level: independentLevel,
      instructional_level: instructionalLevel,
      vocab_score_avg: vocabScore,
      comprehension_score_avg: compScore,
      inference_score_avg: infScore,
      retention_score_avg: retScore,
      next_target_level: nextTarget,
      last_assessed_at: now,
      total_assessments: 1,
      updated_at: now,
    };

    // Try update first — check if any rows were actually affected
    const { data: updateData, error: updateError } = await supabase
      .from("reading_profiles")
      .update({
        current_level: gradeLevel,
        independent_level: independentLevel,
        instructional_level: instructionalLevel,
        vocab_score_avg: vocabScore,
        comprehension_score_avg: compScore,
        inference_score_avg: infScore,
        retention_score_avg: retScore,
        next_target_level: nextTarget,
        last_assessed_at: now,
        updated_at: now,
      })
      .eq("user_id", userId)
      .select();

    if (updateError || !updateData || updateData.length === 0) {
      // Profile doesn't exist yet, create it
      const { error: insertError } = await supabase.from("reading_profiles").insert(profileData);
      if (insertError) throw new Error(insertError.message);
    } else {
      // Profile exists, increment total_assessments
      const current = updateData[0];
      await supabase.from("reading_profiles").update({
        total_assessments: (current.total_assessments || 0) + 1,
      }).eq("user_id", userId);
    }

    clearCache(`reading_profile_${userId}`);
    clearCache(`reading_recommendations_${userId}`);
    return { current_level: gradeLevel, scaleScore };
  }

  // i-Ready scale score to grade level mapping (Colorado middle school reading diagnostic ranges)
  ireadyToGrade(scaleScore: number): number {
    if (scaleScore >= 670) return 8;
    if (scaleScore >= 620) return 7;
    if (scaleScore >= 598) return 6;
    if (scaleScore >= 581) return 5;
    if (scaleScore >= 557) return 4;
    if (scaleScore >= 511) return 3;
    if (scaleScore >= 489) return 2;
    if (scaleScore >= 434) return 1;
    if (scaleScore >= 362) return 1;
    return 1;
  }

  // Student self-service i-Ready opt-in (locked once set — admin can override)
  async setIReadyOptIn(
    userId: number,
    scaleScore: number,
    comprehensionPct?: number,
    vocabularyPct?: number
  ): Promise<any> {
    // Check if score already exists — students can't change it once set
    const { data: profile } = await supabase
      .from("reading_profiles")
      .select("iready_scale_score")
      .eq("user_id", userId)
      .single();
    if (profile && profile.iready_scale_score) {
      throw new Error("Your i-Ready score is already saved. Ask your teacher to change it.");
    }
    const gradeLevel = this.ireadyToGrade(scaleScore);
    return this.setIReadyScore(userId, gradeLevel, scaleScore, comprehensionPct, vocabularyPct);
  }

  // Strip correct_answer from questions before sending to client
  stripAnswers(questions: any[]): any[] {
    return questions.map(q => {
      const { correct_answer, ...rest } = q;
      return rest;
    });
  }

  // ─── ASSESSMENT POPUP ────────────────────────────────────────────────

  async markAssessmentPopupSeen(userId: number): Promise<void> {
    const { error } = await supabase
      .from("users")
      .update({ assessment_prompt_seen_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) throw new Error(error.message);
  }

  async hasAssessmentPopupBeenShown(userId: number): Promise<boolean> {
    const { data, error } = await supabase
      .from("users")
      .select("assessment_prompt_seen_at")
      .eq("id", userId)
      .single();
    if (error || !data) return false;
    return !!data.assessment_prompt_seen_at;
  }

  // ─── COMPREHENSIVE ASSESSMENT (Round-based: passage → questions → next) ──

  // Fetch all questions for all passages in a single query (fast)
  private async getAllAssessmentQuestions(): Promise<any[]> {
    const passages = await this.getAllPassages();
    if (!passages || passages.length === 0) return [];
    const passageIds = passages.map((p: any) => p.id);
    const { data, error } = await supabase
      .from("reading_assessment_questions")
      .select("*")
      .in("passage_id", passageIds)
      .order("passage_id", { ascending: true })
      .order("question_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }

  // Start a comprehensive assessment — returns passages + questions (NO correct_answer)
  async startComprehensiveAssessment(userId: number): Promise<any> {
    // Check for existing incomplete comprehensive attempt
    const existing = await fetchSingle(
      supabase.from("reading_assessment_attempts")
        .select("*")
        .eq("user_id", userId)
        .eq("assessment_type", "comprehensive")
        .in("status", ["reading", "questions"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single()
    );
    if (existing) {
      const passages = await this.getAllPassages();
      const allQuestions = await this.getAllAssessmentQuestions();
      return { attempt: existing, passages, questions: this.stripAnswers(allQuestions) };
    }

    // Create new comprehensive attempt
    const { data, error } = await supabase.from("reading_assessment_attempts").insert({
      user_id: userId,
      passage_id: null,
      status: "reading",
      assessment_type: "comprehensive",
      reading_started_at: new Date().toISOString(),
    }).select().single();
    if (error) throw new Error(error.message);

    const passages = await this.getAllPassages();
    const allQuestions = await this.getAllAssessmentQuestions();

    return { attempt: data, passages, questions: this.stripAnswers(allQuestions) };
  }

  // Submit comprehensive assessment — re-fetches questions server-side for scoring
  async submitComprehensiveAssessment(
    attemptId: number,
    answersByQuestionId: Record<number, string>,
    timeUsedSeconds: number
  ): Promise<any> {
    // Re-fetch ALL questions from the database (with correct_answer) for server-side scoring
    const passages = await this.getAllPassages();
    const allQuestions = await this.getAllAssessmentQuestions();

    let score = 0;
    const skillScores: Record<string, { correct: number; total: number }> = {};

    for (const q of allQuestions) {
      const userAnswer = answersByQuestionId[q.id] || "";
      const correct = userAnswer === q.correct_answer;
      if (correct) score++;

      const skill = q.skill_type || "comprehension";
      if (!skillScores[skill]) skillScores[skill] = { correct: 0, total: 0 };
      skillScores[skill].total++;
      if (correct) skillScores[skill].correct++;
    }

    const total = allQuestions.length;
    const pct = total > 0 ? (score / total) * 100 : 0;

    let estimatedLevel = "instructional";
    if (pct >= 80) estimatedLevel = "independent";
    else if (pct >= 70) estimatedLevel = "instructional";
    else if (pct >= 60) estimatedLevel = "needs_support";
    else estimatedLevel = "frustration";

    const { data, error } = await supabase.from("reading_assessment_attempts").update({
      status: "completed",
      answers: answersByQuestionId,
      score,
      total,
      skill_scores: skillScores,
      estimated_grade_level: estimatedLevel,
      time_used_seconds: timeUsedSeconds,
      completed_at: new Date().toISOString(),
    }).eq("id", attemptId).select().single();
    if (error) throw new Error(error.message);

    // Calculate composite grade level from performance across passages
    const gradeGroups: Record<number, { correct: number; total: number }> = {};
    for (const q of allQuestions) {
      const pid = q.passage_id;
      if (!gradeGroups[pid]) gradeGroups[pid] = { correct: 0, total: 0 };
      gradeGroups[pid].total++;
      if (answersByQuestionId[q.id] === q.correct_answer) gradeGroups[pid].correct++;
    }

    const passageGradeMap: Record<number, number> = {};
    for (const p of passages) passageGradeMap[p.id] = p.grade_level;

    let highestPassedGrade = 2;
    for (const [pid, scores] of Object.entries(gradeGroups)) {
      const grade = passageGradeMap[Number(pid)] || 3;
      const gradePct = scores.total > 0 ? (scores.correct / scores.total) * 100 : 0;
      if (gradePct >= 70 && grade > highestPassedGrade) {
        highestPassedGrade = grade;
      }
    }

    if (pct >= 80) highestPassedGrade = Math.min(highestPassedGrade + 1, 8);
    if (pct < 40) highestPassedGrade = Math.max(highestPassedGrade - 1, 2);

    await this.updateReadingProfile(data.user_id, highestPassedGrade, pct, skillScores);
    clearCache(`reading_profile_${data.user_id}`);
    clearCache(`reading_recommendations_${data.user_id}`);
    return { ...data, estimated_grade_level: estimatedLevel, grade_level: highestPassedGrade };
  }

  // ─── RETAKE FUNCTIONALITY ────────────────────────────────────────────

  async requestRetake(userId: number, reason?: string): Promise<any> {
    const { data, error } = await supabase.from("reading_retake_requests").insert({
      user_id: userId,
      status: "pending",
      reason: reason || "Student requested retake",
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async getRetakeRequests(): Promise<any[]> {
    return fetchList(
      supabase.from("reading_retake_requests")
        .select("*, users(username, display_name)")
        .order("created_at", { ascending: false })
    );
  }

  async approveRetake(requestId: number, adminResponse?: string): Promise<any> {
    const { data, error } = await supabase.from("reading_retake_requests")
      .update({
        status: "approved",
        admin_response: adminResponse || "Approved",
        approved_at: new Date().toISOString(),
      }).eq("id", requestId).select().single();
    if (error) throw new Error(error.message);

    // Allow the student to retake - mark their profile as needing reassessment
    clearCache(`reading_profile_${data.user_id}`);
    clearCache(`reading_recommendations_${data.user_id}`);
    return data;
  }

  async denyRetake(requestId: number, adminResponse?: string): Promise<any> {
    const { data, error } = await supabase.from("reading_retake_requests")
      .update({
        status: "denied",
        admin_response: adminResponse || "Denied",
        approved_at: new Date().toISOString(),
      }).eq("id", requestId).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  // Admin sends retake to student (creates approved retake + notification)
  async sendRetakeToStudent(userId: number): Promise<any> {
    const { data, error } = await supabase.from("reading_retake_requests").insert({
      user_id: userId,
      status: "approved",
      reason: "Teacher assigned retake",
      admin_response: "Your teacher has assigned you a retake.",
      approved_at: new Date().toISOString(),
    }).select().single();
    if (error) throw new Error(error.message);

    // Send notification message to student
    await this.sendMessage(userId, undefined, "system", "You have been assigned a reading assessment retake. Visit the Progress Monitor to take it.");
    clearCache(`reading_profile_${userId}`);
    clearCache(`reading_recommendations_${userId}`);
    return data;
  }

  // ─── TEACHER MANAGEMENT ────────────────────────────────────────────

  async getAllTeachers(): Promise<any[]> {
    return cached('teachers', 300000, async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, username, display_name, role, account_approved, email, created_at")
        .eq("role", 'teacher')
        .order("display_name", { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    });
  }

  async getApprovedTeachers(): Promise<any[]> {
    const { data, error } = await supabase
      .from("users")
      .select("id, display_name, username, role, email, school_id")
      .or("role.eq.teacher,is_admin.eq.true")
      .eq("account_approved", true)
      .order("display_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }

  async getTeacherStudents(teacherId: number): Promise<any[]> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("teacher_id", teacherId)
      .eq("approved_by_teacher", true)
      .order("display_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data.map(mapUser);
  }

  async getPendingStudents(teacherId: number): Promise<any[]> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("teacher_id", teacherId)
      .eq("approved_by_teacher", false)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data.map(mapUser);
  }

  async approveStudent(studentId: number, teacherId: number): Promise<void> {
    const { error } = await supabase
      .from("users")
      .update({ approved_by_teacher: true })
      .eq("id", studentId)
      .eq("teacher_id", teacherId);
    if (error) throw new Error(error.message);
    clearCache('allUsers');
  }

  async approveTeacherAccount(userId: number): Promise<void> {
    const { error } = await supabase
      .from("users")
      .update({ account_approved: true })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    clearCache('allUsers');
    clearCache('teachers');
  }

  async getStudentDetailForTeacher(studentId: number, teacherId: number): Promise<any> {
    const student = await this.getUser(studentId);
    if (!student) throw new Error("Student not found");
    if (student.teacherId !== teacherId && teacherId !== 1) {
      throw new Error("Not authorized to view this student");
    }
    return student;
  }

  // ─── EYE GAZE TESTING ────────────────────────────────────────────────

  async getAllEyeGazeQuizzes(): Promise<any[]> {
    return cached("eye_gaze_quizzes", 300000, async () => {
      const { data, error } = await supabase
        .from("eye_gaze_quizzes")
        .select("*")
        .eq("is_active", true)
        .order("level", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    });
  }

  async getEyeGazeQuiz(quizId: number): Promise<any> {
    const { data: quiz, error: quizError } = await supabase
      .from("eye_gaze_quizzes")
      .select("*")
      .eq("id", quizId)
      .single();
    if (quizError) throw new Error(quizError.message);
    const { data: questions, error: qError } = await supabase
      .from("eye_gaze_questions")
      .select("*")
      .eq("quiz_id", quizId)
      .order("question_order", { ascending: true });
    if (qError) throw new Error(qError.message);
    const safe = (questions || []).map((q: any) => {
      const { correct_answer, ...rest } = q;
      return rest;
    });
    return { ...quiz, questions: safe };
  }

  async getEyeGazeQuizQuestions(quizId: number): Promise<any[]> {
    const { data, error } = await supabase
      .from("eye_gaze_questions")
      .select("*")
      .eq("quiz_id", quizId)
      .order("question_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }

  async startEyeGazeAttempt(userId: number, quizId: number): Promise<any> {
    const existing = await fetchSingle(
      supabase.from("eye_gaze_attempts")
        .select("*")
        .eq("user_id", userId)
        .eq("quiz_id", quizId)
        .eq("status", "in_progress")
        .order("created_at", { ascending: false })
        .limit(1)
        .single()
    );
    if (existing) return existing;
    const { data, error } = await supabase.from("eye_gaze_attempts").insert({
      user_id: userId,
      quiz_id: quizId,
      status: "in_progress",
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async submitEyeGazeAttempt(attemptId: number, answersByQuestionId: Record<number, string>): Promise<any> {
    const { data: attempt, error: attemptError } = await supabase
      .from("eye_gaze_attempts")
      .select("*")
      .eq("id", attemptId)
      .single();
    if (attemptError) throw new Error(attemptError.message);
    const questions = await this.getEyeGazeQuizQuestions(attempt.quiz_id);
    let score = 0;
    const skillScores: Record<string, { correct: number; total: number }> = {};
    for (const q of questions) {
      const userAnswer = answersByQuestionId[q.id] || "";
      const correct = userAnswer === q.correct_answer;
      if (correct) score++;
      const skill = q.skill_type || "identification";
      if (!skillScores[skill]) skillScores[skill] = { correct: 0, total: 0 };
      skillScores[skill].total++;
      if (correct) skillScores[skill].correct++;
    }
    const total = questions.length;
    const pct = total > 0 ? (score / total) * 100 : 0;
    const { data, error } = await supabase.from("eye_gaze_attempts").update({
      status: "completed",
      answers: answersByQuestionId,
      score,
      total,
      completed_at: new Date().toISOString(),
    }).eq("id", attemptId).select().single();
    if (error) throw new Error(error.message);
    await this.updateEyeGazeProfile(attempt.user_id, pct, skillScores);
    clearCache("eye_gaze_quizzes");
    return { ...data, skill_scores: skillScores, pct };
  }

  async getEyeGazeProfile(userId: number): Promise<any> {
    const { data, error } = await supabase
      .from("eye_gaze_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (error && error.code !== "PGRST116") throw new Error(error.message);
    return data || { user_id: userId, current_level: 1, total_completed: 0, total_score: 0, skill_matching: 0, skill_identification: 0, skill_comprehension: 0 };
  }

  async updateEyeGazeProfile(userId: number, pct: number, skillScores: Record<string, { correct: number; total: number }>): Promise<void> {
    const existing = await this.getEyeGazeProfile(userId);
    const matchingPct = skillScores.matching ? Math.round((skillScores.matching.correct / skillScores.matching.total) * 100) : existing.skill_matching || 0;
    const idPct = skillScores.identification ? Math.round((skillScores.identification.correct / skillScores.identification.total) * 100) : existing.skill_identification || 0;
    const compPct = skillScores.comprehension ? Math.round((skillScores.comprehension.correct / skillScores.comprehension.total) * 100) : existing.skill_comprehension || 0;
    const totalCompleted = (existing.total_completed || 0) + 1;
    const totalScore = (existing.total_score || 0) + Math.round(pct);
    let currentLevel = existing.current_level || 1;
    const avgScore = totalScore / totalCompleted;
    if (avgScore >= 80 && totalCompleted >= 2 && currentLevel < 5) {
      currentLevel = Math.min(currentLevel + 1, 5);
    }
    if (avgScore < 40 && currentLevel > 1) {
      currentLevel = Math.max(currentLevel - 1, 1);
    }
    const { error } = await supabase.from("eye_gaze_profiles").upsert({
      user_id: userId,
      current_level: currentLevel,
      total_completed: totalCompleted,
      total_score: totalScore,
      skill_matching: matchingPct,
      skill_identification: idPct,
      skill_comprehension: compPct,
      last_activity: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) {
      const { error: updateError } = await supabase.from("eye_gaze_profiles").update({
        current_level: currentLevel,
        total_completed: totalCompleted,
        total_score: totalScore,
        skill_matching: matchingPct,
        skill_identification: idPct,
        skill_comprehension: compPct,
        last_activity: new Date().toISOString(),
      }).eq("user_id", userId);
      if (updateError) {
        await supabase.from("eye_gaze_profiles").insert({
          user_id: userId,
          current_level: currentLevel,
          total_completed: totalCompleted,
          total_score: totalScore,
          skill_matching: matchingPct,
          skill_identification: idPct,
          skill_comprehension: compPct,
          last_activity: new Date().toISOString(),
        });
      }
    }
  }

  async getEyeGazeAttemptHistory(userId: number): Promise<any[]> {
    const { data, error } = await supabase
      .from("eye_gaze_attempts")
      .select("*, eye_gaze_quizzes(title, level, cover_visual)")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data || [];
  }

  async hasUserCompletedEyeGazeQuiz(userId: number, quizId: number): Promise<boolean> {
    const { data, error } = await supabase
      .from("eye_gaze_attempts")
      .select("id")
      .eq("user_id", userId)
      .eq("quiz_id", quizId)
      .eq("status", "completed")
      .limit(1);
    if (error) return false;
    return (data || []).length > 0;
  }

  async setEyeGazeUser(userId: number, isEyeGaze: boolean): Promise<void> {
    const { error } = await supabase.from("users").update({
      is_eye_gaze_user: isEyeGaze,
    }).eq("id", userId);
    if (error) throw new Error(error.message);
    clearCache("allUsers");
    clearCache("session_"); // Clear session cache so authMiddleware returns fresh user data
  }

  async seedEyeGazeQuizzes(): Promise<void> {
    const { data: existing, error: checkError } = await supabase
      .from("eye_gaze_quizzes")
      .select("id")
      .limit(1);
    if (checkError) return;
    if (existing && existing.length > 0) {
      console.log("Eye gaze quizzes already seeded");
      return;
    }
    const quizzes = JSON.parse(require("fs").readFileSync(__dirname + "/../passages/eye_gaze_quizzes.json", "utf-8"));
    for (const quiz of quizzes) {
      const { data: quizRow, error: quizError } = await supabase
        .from("eye_gaze_quizzes")
        .insert({
          title: quiz.title,
          description: quiz.description,
          level: quiz.level,
          cover_visual: quiz.cover_visual,
          cover_visual_type: quiz.cover_visual_type || "emoji",
          is_active: true,
        })
        .select()
        .single();
      if (quizError) {
        console.error("Failed to insert eye gaze quiz:", quiz.title, quizError.message);
        continue;
      }
      for (const q of quiz.questions) {
        await supabase.from("eye_gaze_questions").insert({
          quiz_id: quizRow.id,
          prompt: q.prompt,
          visual: q.visual,
          visual_type: q.visual_type || "emoji",
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_answer: q.correct_answer,
          skill_type: q.skill_type,
          question_order: q.question_order,
        });
      }
    }
    console.log("Eye gaze quizzes seeded successfully");
  }

  async seedExtraEyeGazeQuizzes(): Promise<void> {
    // Insert the 20 additional quizzes (only those not already present by title)
    const { data: existing } = await supabase
      .from("eye_gaze_quizzes")
      .select("title")
      .eq("is_active", true);
    const existingTitles = new Set((existing || []).map((q: any) => q.title));
    const quizzes = JSON.parse(require("fs").readFileSync(__dirname + "/../passages/eye_gaze_quizzes_new.json", "utf-8"));
    let added = 0;
    for (const quiz of quizzes) {
      if (existingTitles.has(quiz.title)) continue;
      const { data: quizRow, error: quizError } = await supabase
        .from("eye_gaze_quizzes")
        .insert({
          title: quiz.title,
          description: quiz.description,
          level: quiz.level,
          cover_visual: quiz.cover_visual,
          cover_visual_type: quiz.cover_visual_type || "emoji",
          is_active: true,
        })
        .select()
        .single();
      if (quizError) {
        console.error("Failed to insert eye gaze quiz:", quiz.title, quizError.message);
        continue;
      }
      for (const q of quiz.questions) {
        await supabase.from("eye_gaze_questions").insert({
          quiz_id: quizRow.id,
          prompt: q.prompt,
          visual: q.visual,
          visual_type: q.visual_type || "emoji",
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_answer: q.correct_answer,
          skill_type: q.skill_type,
          question_order: q.question_order,
        });
      }
      added++;
    }
    console.log(`Extra eye gaze quizzes seeded: ${added} added`);
  }

  // ─── CUSTOM EYE GAZE QUIZZES (Teacher/Parent created) ──────────────

  async getAllCustomEyeGazeQuizzes(userId?: number, userRole?: string, teacherId?: number): Promise<any[]> {
    return cached("custom_eye_gaze_quizzes", 60000, async () => {
      const { data, error } = await supabase
        .from("custom_eye_gaze_quizzes")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    });
  }

  async getCustomQuizzesForStudent(userId: number, teacherId: number | null): Promise<any[]> {
    // Global quizzes (admin-created) + quizzes from this student's teacher
    const { data: globalQuizzes, error: gErr } = await supabase
      .from("custom_eye_gaze_quizzes")
      .select("*")
      .eq("is_published", true)
      .eq("visibility", "global")
      .order("created_at", { ascending: false });
    if (gErr) throw new Error(gErr.message);
    let teacherQuizzes: any[] = [];
    if (teacherId) {
      const { data: tData, error: tErr } = await supabase
        .from("custom_eye_gaze_quizzes")
        .select("*")
        .eq("is_published", true)
        .eq("visibility", "teacher_students")
        .eq("target_teacher_id", teacherId)
        .order("created_at", { ascending: false });
      if (tErr) throw new Error(tErr.message);
      teacherQuizzes = tData || [];
    }
    return [...(globalQuizzes || []), ...teacherQuizzes];
  }

  async getCustomEyeGazeQuiz(quizId: number): Promise<any> {
    const { data: quiz, error: quizError } = await supabase
      .from("custom_eye_gaze_quizzes")
      .select("*")
      .eq("id", quizId)
      .single();
    if (quizError) throw new Error(quizError.message);
    const { data: questions, error: qError } = await supabase
      .from("custom_eye_gaze_questions")
      .select("*")
      .eq("quiz_id", quizId)
      .order("question_order", { ascending: true });
    if (qError) throw new Error(qError.message);
    const safe = (questions || []).map((q: any) => {
      const { correct_answer, ...rest } = q;
      return rest;
    });
    return { ...quiz, questions: safe };
  }

  async getCustomEyeGazeQuizQuestions(quizId: number): Promise<any[]> {
    const { data, error } = await supabase
      .from("custom_eye_gaze_questions")
      .select("*")
      .eq("quiz_id", quizId)
      .order("question_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }

  async createCustomEyeGazeQuiz(creatorUserId: number, title: string, description: string, level: string, questions: any[], visibility: string = 'global', targetTeacherId: number | null = null, quizType: string = 'eye_gaze'): Promise<any> {
    const { data: quiz, error: quizError } = await supabase
      .from("custom_eye_gaze_quizzes")
      .insert({
        creator_user_id: creatorUserId,
        title,
        description,
        level: level || "Custom",
        is_published: true,
        visibility,
        target_teacher_id: targetTeacherId,
        quiz_type: quizType,
      })
      .select()
      .single();
    if (quizError) throw new Error(quizError.message);
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const { error: qErr } = await supabase
        .from("custom_eye_gaze_questions")
        .insert({
          quiz_id: quiz.id,
          prompt: q.prompt || "",
          question_image: q.question_image || null,
          option_a_text: q.option_a_text || "",
          option_a_image: q.option_a_image || null,
          option_b_text: q.option_b_text || "",
          option_b_image: q.option_b_image || null,
          option_c_text: q.option_c_text || "",
          option_c_image: q.option_c_image || null,
          option_d_text: q.option_d_text || "",
          option_d_image: q.option_d_image || null,
          correct_answer: q.correct_answer || "A",
          question_order: i,
        });
      if (qErr) console.error("Failed to insert question:", qErr.message);
    }
    clearCache("custom_eye_gaze_quizzes");
    return quiz;
  }

  async updateCustomEyeGazeQuiz(quizId: number, userId: number, title: string, description: string, level: string, questions: any[]): Promise<any> {
    const { data: quiz, error: quizError } = await supabase
      .from("custom_eye_gaze_quizzes")
      .select("creator_user_id")
      .eq("id", quizId)
      .single();
    if (quizError) throw new Error("Quiz not found");
    if (quiz.creator_user_id !== userId) throw new Error("Not authorized to edit this quiz");
    const { error: updateErr } = await supabase
      .from("custom_eye_gaze_quizzes")
      .update({ title, description, level, updated_at: new Date().toISOString() })
      .eq("id", quizId);
    if (updateErr) throw new Error(updateErr.message);
    // Delete old questions and re-insert
    await supabase.from("custom_eye_gaze_questions").delete().eq("quiz_id", quizId);
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await supabase.from("custom_eye_gaze_questions").insert({
        quiz_id: quizId,
        prompt: q.prompt || "",
        question_image: q.question_image || null,
        option_a_text: q.option_a_text || "",
        option_a_image: q.option_a_image || null,
        option_b_text: q.option_b_text || "",
        option_b_image: q.option_b_image || null,
        option_c_text: q.option_c_text || "",
        option_c_image: q.option_c_image || null,
        option_d_text: q.option_d_text || "",
        option_d_image: q.option_d_image || null,
        correct_answer: q.correct_answer || "A",
        question_order: i,
      });
    }
    clearCache("custom_eye_gaze_quizzes");
    return { id: quizId, title, description, level };
  }

  async deleteCustomEyeGazeQuiz(quizId: number, userId: number): Promise<void> {
    const { data: quiz, error: quizErr } = await supabase
      .from("custom_eye_gaze_quizzes")
      .select("creator_user_id")
      .eq("id", quizId)
      .single();
    if (quizErr) throw new Error("Quiz not found");
    if (quiz.creator_user_id !== userId) throw new Error("Not authorized to delete this quiz");
    const { error } = await supabase
      .from("custom_eye_gaze_quizzes")
      .delete()
      .eq("id", quizId);
    if (error) throw new Error(error.message);
    clearCache("custom_eye_gaze_quizzes");
  }

  async startCustomEyeGazeAttempt(userId: number, quizId: number): Promise<any> {
    const existing = await fetchSingle(
      supabase.from("custom_eye_gaze_attempts")
        .select("*")
        .eq("user_id", userId)
        .eq("quiz_id", quizId)
        .eq("status", "in_progress")
        .order("id", { ascending: false })
        .limit(1)
        .single()
    );
    if (existing) return existing;
    const { data, error } = await supabase.from("custom_eye_gaze_attempts").insert({
      user_id: userId,
      quiz_id: quizId,
      status: "in_progress",
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async submitCustomEyeGazeAttempt(attemptId: number, answersByQuestionId: Record<number, string>): Promise<any> {
    const { data: attempt, error: attemptError } = await supabase
      .from("custom_eye_gaze_attempts")
      .select("*")
      .eq("id", attemptId)
      .single();
    if (attemptError) throw new Error(attemptError.message);
    const questions = await this.getCustomEyeGazeQuizQuestions(attempt.quiz_id);
    let score = 0;
    for (const q of questions) {
      const userAnswer = answersByQuestionId[q.id] || "";
      if (userAnswer === q.correct_answer) score++;
    }
    const total = questions.length;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const { data, error } = await supabase.from("custom_eye_gaze_attempts").update({
      status: "completed",
      answers: answersByQuestionId,
      score,
      total,
      completed_at: new Date().toISOString(),
    }).eq("id", attemptId).select().single();
    if (error) throw new Error(error.message);
    clearCache("custom_eye_gaze_quizzes");
    return { ...data, pct, score, total };
  }

  async hasUserCompletedCustomQuiz(userId: number, quizId: number): Promise<boolean> {
    const { data, error } = await supabase
      .from("custom_eye_gaze_attempts")
      .select("id")
      .eq("user_id", userId)
      .eq("quiz_id", quizId)
      .eq("status", "completed")
      .limit(1);
    if (error) return false;
    return (data || []).length > 0;
  }

  async getCustomQuizAttemptHistory(userId: number): Promise<any[]> {
    const { data, error } = await supabase
      .from("custom_eye_gaze_attempts")
      .select("*, custom_eye_gaze_quizzes(title, level)")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data || [];
  }
}

export const storage = new DatabaseStorage();
