import type { Express } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
import { seedData } from "./storage";
import { clearCache } from "./storage";
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
const EMAIL_FROM = process.env.EMAIL_FROM || "A.R.I.S.E Reader <noreply@arisereader.com>";
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "jjrobo180@gmail.com";
const APP_URL = process.env.APP_URL || "https://arisereader.pplx.app";

// LLM API for instant quiz generation
// Uses Perplexity API (sonar model) to generate quiz questions via HTTP
// API key is read from database settings (set in admin panel) or env vars
const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";
const PERPLEXITY_API_URL = PERPLEXITY_BASE_URL + "/chat/completions";

async function getPerplexityApiKey(): Promise<string> {
  // First try database settings (works on ALL domains)
  try {
    const dbKey = await storage.getSetting("perplexity_api_key");
    if (dbKey) return dbKey;
  } catch {}
  // Then try env vars (for pplx.app deployment)
  const envKey = process.env.CUSTOM_CRED_API_PERPLEXITY_AI_TOKEN || process.env.PERPLEXITY_API_KEY || "";
  if (envKey) {
    // Auto-save to database so it works on all domains
    try { await storage.upsertSetting("perplexity_api_key", envKey); } catch {}
    return envKey;
  }
  return "";
}

async function generateQuizWithAI(bookTitle: string, author: string, ageGroup?: string, studentGrade?: string): Promise<{ questions: Array<{ question: string; options: string[]; correct: string }>; bookGradeLevel: string; pointsValue: number } | { error: string; needsManualReview?: boolean; reviewReason?: string }> {
  const apiKey = await getPerplexityApiKey();
  if (!apiKey) {
    return { error: "AI quiz generation is not configured. An admin needs to set the Perplexity API key in the admin panel." };
  }
  try {
    // Load admin-configured quiz guidelines
    let guidelines = "";
    try {
      guidelines = await storage.getSetting("quiz_generation_guidelines") || "";
    } catch {}

    const prompt = `You are an expert reading comprehension quiz creator for students. Create exactly 10 multiple-choice questions for the book "${bookTitle}" by ${author}.

First, analyze the book and determine:
1. The estimated US grade level of this book (e.g., "3", "5", "8", "10")
2. The vocabulary complexity (1=simple, 2=moderate, 3=advanced)
3. The book length category (1=short/picture book, 2=chapter book, 3=full novel)

Then create 10 multiple-choice questions appropriate for ${ageGroup || "middle school"} students.

Return ONLY a JSON object (no markdown, no explanation, no code blocks) with this exact format:
{"bookGradeLevel":"5","vocabComplexity":2,"lengthCategory":2,"questions":[{"question":"The question text here?","options":["Option A text","Option B text","Option C text","Option D text"],"correct":"A"}]}

Rules:
- Questions should test reading comprehension, plot details, character understanding, and themes
- Each question has exactly 4 options labeled A, B, C, D
- The "correct" field is a single letter: "A", "B", "C", or "D"
- Make questions appropriate for ${ageGroup || "middle school"} students
- Do NOT make questions about the author's life or publication details
- Focus on the story content, characters, plot, and themes
- Return exactly 10 questions${guidelines ? `\n\nAdditional guidelines from the admin:\n${guidelines}` : ""}`;

    const res = await fetch(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You are a quiz generator. Return ONLY valid JSON arrays, no markdown or explanation." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { error: `AI API error ${res.status}: ${errText.slice(0, 200)}` };
    }

    const data = await res.json() as any;
    const content = data.choices?.[0]?.message?.content || "";

    if (!content) {
      return { error: "AI returned empty response" };
    }

    // Extract JSON from response (handles markdown code blocks)
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const parsed = JSON.parse(jsonStr);
    const questions = parsed.questions || parsed;
    const bookGradeLevel = parsed.bookGradeLevel || studentGrade || "5";
    const vocabComplexity = parsed.vocabComplexity || 2;
    const lengthCategory = parsed.lengthCategory || 2;

    if (!Array.isArray(questions) || questions.length === 0) {
      return { error: "AI generated invalid questions" };
    }

    // Grade level mismatch check
    const studentGradeNum = parseInt(studentGrade || "5");
    const bookGradeNum = parseInt(bookGradeLevel);
    const gradeDiff = studentGradeNum - bookGradeNum; // positive = book is below student grade

    // If book is 3+ grades below student's level, require manual review
    if (gradeDiff >= 3) {
      return {
        error: `This book appears to be at a grade ${bookGradeLevel} reading level, which is well below your grade ${studentGrade} level. This quiz requires manual review by an educator before it can be granted.`,
        needsManualReview: true,
        reviewReason: `Book "${bookTitle}" is estimated at grade ${bookGradeLevel} level, but student is in grade ${studentGrade}. Difference of ${gradeDiff} grades.`,
      };
    }

    // Calculate points based on grade level, vocab, and length
    let pointsValue = 10; // base
    if (gradeDiff <= -2) {
      // Book is 2+ grades above student → harder, more points
      pointsValue = 30;
    } else if (gradeDiff <= -1) {
      // Book is 1 grade above → moderately harder
      pointsValue = 20;
    } else {
      // Book is at or near grade level
      // Adjust for vocab and length
      if (vocabComplexity >= 3 && lengthCategory >= 3) pointsValue = 20;
      else if (vocabComplexity >= 3 || lengthCategory >= 3) pointsValue = 15;
      else pointsValue = 10;
    }

    // Validate and clean up questions
    const validQuestions = questions.slice(0, 10).map((q: any) => {
      const correctLetter = (q.correct || "A").toUpperCase().charAt(0);
      const options = (q.options || []).slice(0, 4);
      while (options.length < 4) options.push("None of the above");
      return {
        question: q.question || "What is this book about?",
        options,
        correct: correctLetter,
      };
    }).filter((q: any) => q.options.length === 4);

    if (validQuestions.length < 5) {
      return { error: "AI generated too few valid questions" };
    }

    return { questions: validQuestions, bookGradeLevel, pointsValue };
  } catch (e: any) {
    return { error: `AI generation failed: ${e.message}` };
  }
}

// Generate iArise lesson content via AI — short readable lessons for students
async function generateIariseLessonContent(topic: string, ageGroup: string): Promise<{ title: string; lessons: Array<{ title: string; content: string }> } | { error: string }> {
  const apiKey = await getPerplexityApiKey();
  if (!apiKey) {
    return { error: "AI lesson generation is not configured." };
  }
  try {
    const prompt = `You are an expert educator creating lesson content for students. Create a short lesson series about "${topic}" for ${ageGroup} students.

Create 3 short lessons. Each lesson should be age-appropriate, engaging, and educational.

Return ONLY a JSON object (no markdown, no code blocks, no explanation) with this exact format:
{"title":"${topic} — iArise Lesson","lessons":[{"title":"Lesson 1 Title","content":"2-3 paragraphs of lesson content. Use \n between paragraphs. Include a Key takeaway: line at the end."},{"title":"Lesson 2 Title","content":"..."},{"title":"Lesson 3 Title","content":"..."}]}

Rules:
- Content should be appropriate for ${ageGroup} reading level
- Each lesson should be 2-3 short paragraphs
- Include real educational content — facts, explanations, examples
- End each lesson with a "Key takeaway:" line
- Keep it engaging and easy to read`;

    const res = await fetch(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You are a lesson content generator. Return ONLY valid JSON, no markdown or explanation." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      return { error: `AI API error ${res.status}` };
    }

    const data = await res.json() as any;
    const content = data.choices?.[0]?.message?.content || "";
    if (!content) {
      return { error: "AI returned empty response" };
    }

    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const parsed = JSON.parse(jsonStr);
    if (!parsed.lessons || !Array.isArray(parsed.lessons) || parsed.lessons.length === 0) {
      return { error: "AI generated invalid lesson content" };
    }

    return {
      title: parsed.title || `${topic} — iArise Lesson`,
      lessons: parsed.lessons.map((l: any) => ({
        title: l.title || "Lesson",
        content: l.content || "",
      })),
    };
  } catch (e: any) {
    return { error: `AI lesson generation failed: ${e.message}` };
  }
}

// Generate an eye gaze quiz with AI — questions use prompt, visual (emoji), option_a-d, correct_answer
async function generateEyeGazeQuizWithAI(topic: string, description?: string, sourceLink?: string): Promise<{ questions: Array<{ prompt: string; question_image: string | null; option_a_text: string; option_a_image: string | null; option_b_text: string; option_b_image: string | null; option_c_text: string; option_c_image: string | null; option_d_text: string; option_d_image: string | null; correct_answer: string }> } | { error: string }> {
  const apiKey = await getPerplexityApiKey();
  if (!apiKey) {
    return { error: "AI quiz generation is not configured. An admin needs to set the Perplexity API key in the admin panel." };
  }
  try {
    let guidelines = "";
    try {
      guidelines = await storage.getSetting("quiz_generation_guidelines") || "";
    } catch {}

    // Build a flexible prompt that accepts any topic, description, or source
    let userRequest = `Topic: "${topic}"`;
    if (description && description.trim()) {
      userRequest += `\nDescription: ${description.trim()}`;
    }
    if (sourceLink && sourceLink.trim()) {
      userRequest += `\nSource/Reference: ${sourceLink.trim()}`;
    }

    const prompt = `You are an expert quiz creator for eye gaze and non-verbal students. Create exactly 5 multiple-choice questions based on the following request:

${userRequest}

These quizzes are for students who use eye gaze technology or are non-verbal. Questions should be visual, simple, and accessible. Each question must have a visual element (an emoji that represents the concept).

IMPORTANT CONTENT RULES:
- All content MUST be school-appropriate and child-friendly
- All answers MUST be factually accurate
- If the topic involves a YouTube video, song, or specific media, create questions about the general educational concepts, not about the video itself
- Do NOT reference YouTube, specific video titles, or brand names in questions
- Focus on the educational content and learning objectives
- If the topic is too vague, make reasonable educational assumptions

Return ONLY a JSON object (no markdown, no explanation, no code blocks) with this exact format:
{"questions":[{"prompt":"What color is the sky?","question_image":"☁️","option_a_text":"Red","option_a_image":null,"option_b_text":"Blue","option_b_image":null,"option_c_text":"Green","option_c_image":null,"option_d_text":"Yellow","option_d_image":null,"correct_answer":"B"}]}

Rules:
- Create exactly 5 questions — no more, no less
- Questions should be simple, visual, and appropriate for eye gaze / non-verbal students
- The "question_image" field should be a single emoji that represents the question topic
- Each question has exactly 4 options (option_a_text through option_d_text) — these are the answer choices shown to the student
- The "correct_answer" is a single letter: "A", "B", "C", or "D"
- Make questions about identification, matching, and simple comprehension
- Use clear, simple language
- Return exactly 5 questions${guidelines ? `\n\nAdditional guidelines from the admin:\n${guidelines}` : ""}`;

    const res = await fetch(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You are a quiz generator for eye gaze students. Return ONLY valid JSON, no markdown or explanation." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { error: `AI API error ${res.status}: ${errText.slice(0, 200)}` };
    }

    const data = await res.json() as any;
    const content = data.choices?.[0]?.message?.content || "";
    if (!content) return { error: "AI returned empty response" };

    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
    
    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return { error: "AI returned invalid JSON. Please try again." };
    }
    const questions = parsed.questions || parsed;

    if (!Array.isArray(questions) || questions.length === 0) {
      return { error: "AI generated invalid questions" };
    }

    const validQuestions = questions.slice(0, 5).map((q: any) => ({
      prompt: q.prompt || "What is this?",
      question_image: q.question_image || q.visual || null,
      option_a_text: q.option_a_text || q.option_a || q.options?.[0] || "",
      option_a_image: q.option_a_image || null,
      option_b_text: q.option_b_text || q.option_b || q.options?.[1] || "",
      option_b_image: q.option_b_image || null,
      option_c_text: q.option_c_text || q.option_c || q.options?.[2] || "",
      option_c_image: q.option_c_image || null,
      option_d_text: q.option_d_text || q.option_d || q.options?.[3] || "",
      option_d_image: q.option_d_image || null,
      correct_answer: (q.correct_answer || q.correct || "A").toUpperCase().charAt(0),
    })).filter((q: any) => q.option_a_text && q.option_b_text && q.option_c_text && q.option_d_text);

    if (validQuestions.length < 3) {
      return { error: "AI generated too few valid questions. Please try a more specific topic." };
    }

    return { questions: validQuestions };
  } catch (e: any) {
    return { error: `AI generation failed: ${e.message}` };
  }
}

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

function parentApprovedEmail(displayName: string, username: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 40px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #FF5900; font-size: 28px; margin: 0;">A.R.I.S.E Reader</h1>
        <p style="color: #999; margin: 5px 0 0 0;">Read a book. Take a quiz. Earn points.</p>
      </div>
      <h2 style="color: #FF5900; font-size: 22px;">Your Parent Account is Approved!</h2>
      <p style="color: #ccc; font-size: 16px; line-height: 1.6;">Hi ${displayName},</p>
      <p style="color: #ccc; font-size: 16px; line-height: 1.6;">Your parent account on A.R.I.S.E Reader has been approved. You can now log in and view your student's progress, print certificates, and message their teacher.</p>
      <div style="background: #2a2a2a; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <p style="color: #999; margin: 0 0 5px 0; font-size: 14px;">Your username:</p>
        <p style="color: #FF5900; font-size: 18px; margin: 0; font-weight: bold;">${username}</p>
      </div>
      <a href="${APP_URL}" style="display: inline-block; background: #FF5900; color: #fff; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-size: 16px; font-weight: bold; margin: 20px 0;">Log In Now</a>
      <p style="color: #666; font-size: 14px; margin-top: 30px;">If you didn't create this account, please ignore this email.</p>
    </div>
  `;
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

function teacherSignupConfirmEmail(displayName: string, username: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 40px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #FF5900; font-size: 28px; margin: 0;">A.R.I.S.E Reader</h1>
        <p style="color: #999; margin: 5px 0 0 0;">Read a book. Take a quiz. Earn points.</p>
      </div>
      <h2 style="color: #FF5900; font-size: 22px;">Teacher Account Request Received</h2>
      <p style="color: #ccc; font-size: 16px; line-height: 1.6;">Hi ${displayName},</p>
      <p style="color: #ccc; font-size: 16px; line-height: 1.6;">We received your teacher account request for A.R.I.S.E Reader. Your account is now pending administrator approval.</p>
      <p style="color: #ccc; font-size: 16px; line-height: 1.6;">You will receive another email once your account has been approved, at which point you can log in and start managing your students.</p>
      <div style="background: #2a2a2a; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <p style="color: #999; margin: 0 0 5px 0; font-size: 14px;">Your username:</p>
        <p style="color: #FF5900; font-size: 18px; margin: 0; font-weight: bold;">${username}</p>
      </div>
      <p style="color: #666; font-size: 14px; margin-top: 30px;">If you didn't create this account, please ignore this email.</p>
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

      // Clear teachers cache
      try { clearCache('teachers'); } catch {}

      // Send emails BEFORE responding so they actually execute
      let emailSent = false;
      let emailError = '';
      try {
        const result = await sendEmail(
          ADMIN_NOTIFY_EMAIL,
          "New teacher signup - A.R.I.S.E Reader",
          teacherSignupNotifyEmail(displayName, username.toLowerCase(), email || 'No email provided')
        );
        emailSent = result.sent;
        if (!result.sent) emailError = result.error || 'Unknown error';
      } catch (e: any) {
        emailError = e.message;
      }

      // Send confirmation email to the teacher (non-blocking - failure is OK)
      if (email) {
        sendEmail(
          email,
          "Teacher account request received - A.R.I.S.E Reader",
          teacherSignupConfirmEmail(displayName, username.toLowerCase())
        ).catch(() => {});
      }

      res.status(201).json({
        success: true,
        emailSent,
        emailError,
        message: "Your request has been submitted! The admin will review your account and notify you when it's approved.",
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
          `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 40px; border-radius: 12px;">
            <h1 style="color: #FF5900; font-size: 28px;">New Parent Signup</h1>
            <p style="color: #ccc; font-size: 16px;"><strong>Name:</strong> ${displayName}</p>
            <p style="color: #ccc; font-size: 16px;"><strong>Username:</strong> @${username.toLowerCase()}</p>
            <p style="color: #ccc; font-size: 16px;"><strong>Email:</strong> ${email || 'N/A'}</p>
            <p style="color: #ccc; font-size: 16px;"><strong>Linked Student:</strong> ${studentUsername}</p>
            <p style="color: #999; font-size: 14px; margin-top: 20px;">Log in to the admin panel to approve or reject this parent.</p>
          </div>`
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

      // Track login count for students (for leaderboard popup)
      let loginCount = 0;
      if (!user.isAdmin && user.role !== 'teacher' && user.role !== 'parent') {
        const rawCounts = await storage.getSetting('login_counts');
        let counts: Record<string, number> = {};
        if (rawCounts) { try { counts = JSON.parse(rawCounts); } catch {} }
        counts[String(user.id)] = (counts[String(user.id)] || 0) + 1;
        loginCount = counts[String(user.id)];
        await storage.upsertSetting('login_counts', JSON.stringify(counts));
        clearCache('setting_login_counts');
      }

      res.json({
        token: session.token,
        user: { id: user.id, username: user.username, displayName: user.displayName, isAdmin: user.isAdmin, assessmentPromptShown: popupShown, is_eye_gaze_user: user.is_eye_gaze_user, role: user.role, teacherId: user.teacherId, approvedByTeacher: user.approvedByTeacher, accountApproved: user.accountApproved, email: user.email, schoolId: user.school_id, totalPoints: user.totalPoints || 0, loginCount },
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
      role: req.user.role || 'student',
      teacherId: req.user.teacherId || null,
      approvedByTeacher: req.user.approvedByTeacher,
      accountApproved: req.user.accountApproved,
      is_eye_gaze_user: req.user.is_eye_gaze_user || false,
      email: req.user.email || null,
      schoolId: req.user.school_id || null,
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

  // Public setting lookup (for anime/comic book IDs etc.)
  app.get("/api/settings/:key", async (req, res) => {
    try {
      const value = await storage.getSetting(req.params.key);
      res.json({ value });
    } catch {
      res.json({ value: null });
    }
  });

  // Auto-fetch missing book covers
  app.post("/api/admin/fetch-missing-covers", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const allBooks = await storage.getAllBooks();
      const missing = allBooks.filter(b => !b.coverUrl);
      let updated = 0;
      for (const book of missing) {
        let coverUrl: string | null = null;
        const cleanTitle = (book.title || "").replace(/[:\-]/g, " ").trim();
        const cleanAuthor = (book.author || "").trim();
        // Method 1: covers by title
        try {
          const coverRes = await fetch(
            `https://covers.openlibrary.org/b/title/${encodeURIComponent(cleanTitle)}?format=json&limit=1`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (coverRes.ok) {
            const coverData = await coverRes.json() as any;
            if (coverData.covers && coverData.covers.length > 0) {
              coverUrl = `https://covers.openlibrary.org/b/id/${coverData.covers[0].id}-L.jpg`;
            }
          }
        } catch {}
        // Method 2: search by title + author
        if (!coverUrl) {
          try {
            const searchRes = await fetch(
              `https://openlibrary.org/search.json?title=${encodeURIComponent(cleanTitle)}&author=${encodeURIComponent(cleanAuthor)}&limit=1`,
              { signal: AbortSignal.timeout(5000) }
            );
            if (searchRes.ok) {
              const searchData = await searchRes.json() as any;
              if (searchData.docs && searchData.docs.length > 0 && searchData.docs[0].cover_i) {
                coverUrl = `https://covers.openlibrary.org/b/id/${searchData.docs[0].cover_i}-L.jpg`;
              }
            }
          } catch {}
        }
        // Method 3: search by title only (broader)
        if (!coverUrl) {
          try {
            const searchRes2 = await fetch(
              `https://openlibrary.org/search.json?title=${encodeURIComponent(cleanTitle)}&limit=1`,
              { signal: AbortSignal.timeout(5000) }
            );
            if (searchRes2.ok) {
              const searchData2 = await searchRes2.json() as any;
              if (searchData2.docs && searchData2.docs.length > 0 && searchData2.docs[0].cover_i) {
                coverUrl = `https://covers.openlibrary.org/b/id/${searchData2.docs[0].cover_i}-L.jpg`;
              }
            }
          } catch {}
        }
        if (coverUrl) {
          await storage.updateBookCover(book.id, coverUrl);
          updated++;
        }
      }
      res.json({ success: true, updated, total: missing.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

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

  // === Student Rewards (admin-assigned) ===
  // GET: list rewards for a student
  app.get("/api/admin/students/:id/rewards", authMiddleware, adminMiddleware, async (req, res) => {
    const studentId = parseInt(req.params.id);
    const key = `student_rewards_${studentId}`;
    const raw = await storage.getSetting(key);
    let rewards: any[] = [];
    if (raw) { try { rewards = JSON.parse(raw); } catch {} }
    res.json({ rewards });
  });

  // POST: create a reward for a student
  app.post("/api/admin/students/:id/rewards", authMiddleware, adminMiddleware, async (req: any, res) => {
    const studentId = parseInt(req.params.id);
    const { title, message, requiredQuizCount, expiresAt } = req.body;
    if (!title || !message) {
      return res.status(400).json({ message: "Title and message are required" });
    }
    const key = `student_rewards_${studentId}`;
    const raw = await storage.getSetting(key);
    let rewards: any[] = [];
    if (raw) { try { rewards = JSON.parse(raw); } catch {} }
    const reward = {
      id: Date.now(),
      title: title.trim(),
      message: message.trim(),
      requiredQuizCount: requiredQuizCount ? parseInt(requiredQuizCount) : 0,
      expiresAt: expiresAt || null,
      active: true,
      createdAt: new Date().toISOString(),
      createdByAdminId: req.user.id,
    };
    rewards.push(reward);
    await storage.upsertSetting(key, JSON.stringify(rewards));
    res.status(201).json({ reward, message: "Reward added!" });
  });

  // PATCH: update a reward (toggle active, edit text, etc.)
  app.patch("/api/admin/students/:id/rewards/:rewardId", authMiddleware, adminMiddleware, async (req, res) => {
    const studentId = parseInt(req.params.id);
    const rewardId = parseInt(req.params.rewardId);
    const key = `student_rewards_${studentId}`;
    const raw = await storage.getSetting(key);
    let rewards: any[] = [];
    if (raw) { try { rewards = JSON.parse(raw); } catch {} }
    const idx = rewards.findIndex(r => r.id === rewardId);
    if (idx === -1) return res.status(404).json({ message: "Reward not found" });
    const { title, message, requiredQuizCount, expiresAt, active } = req.body;
    if (title !== undefined) rewards[idx].title = title.trim();
    if (message !== undefined) rewards[idx].message = message.trim();
    if (requiredQuizCount !== undefined) rewards[idx].requiredQuizCount = parseInt(requiredQuizCount);
    if (expiresAt !== undefined) rewards[idx].expiresAt = expiresAt;
    if (active !== undefined) rewards[idx].active = active;
    await storage.upsertSetting(key, JSON.stringify(rewards));
    res.json({ reward: rewards[idx], message: "Reward updated!" });
  });

  // DELETE: remove a reward
  app.delete("/api/admin/students/:id/rewards/:rewardId", authMiddleware, adminMiddleware, async (req, res) => {
    const studentId = parseInt(req.params.id);
    const rewardId = parseInt(req.params.rewardId);
    const key = `student_rewards_${studentId}`;
    const raw = await storage.getSetting(key);
    let rewards: any[] = [];
    if (raw) { try { rewards = JSON.parse(raw); } catch {} }
    rewards = rewards.filter(r => r.id !== rewardId);
    await storage.upsertSetting(key, JSON.stringify(rewards));
    res.json({ message: "Reward deleted" });
  });

  // Student-facing: get their active rewards
  app.get("/api/student/rewards", authMiddleware, async (req: any, res) => {
    const key = `student_rewards_${req.user.id}`;
    const raw = await storage.getSetting(key);
    let rewards: any[] = [];
    if (raw) { try { rewards = JSON.parse(raw); } catch {} }
    // Filter to active, non-expired
    const now = new Date().toISOString();
    const active = rewards.filter(r => r.active && (!r.expiresAt || r.expiresAt > now));
    // Count completed quizzes by this student for progress tracking
    const attempts = await storage.getUserAttempts(req.user.id);
    const quizzesCompleted = attempts ? attempts.length : 0;
    const enriched = active.map(r => ({
      ...r,
      progress: r.requiredQuizCount ? `${Math.min(quizzesCompleted, r.requiredQuizCount)}/${r.requiredQuizCount}` : null,
      quizzesCompleted,
      completed: !r.requiredQuizCount || r.requiredQuizCount === 0 ? true : quizzesCompleted >= r.requiredQuizCount,
    }));
    res.json({ rewards: enriched });
  });

  // Student-facing: claim a reward (sends request to admin)
  app.post("/api/student/rewards/:rewardId/claim", authMiddleware, async (req: any, res) => {
    const key = `student_rewards_${req.user.id}`;
    const raw = await storage.getSetting(key);
    let rewards: any[] = [];
    if (raw) { try { rewards = JSON.parse(raw); } catch {} }
    const idx = rewards.findIndex((r: any) => r.id === parseInt(req.params.rewardId));
    if (idx === -1) return res.status(404).json({ message: "Reward not found" });
    const reward = rewards[idx];
    if (!reward.active) return res.status(400).json({ message: "This reward is not active" });
    if (reward.expiresAt && reward.expiresAt < new Date().toISOString()) return res.status(400).json({ message: "This reward has expired" });
    if (reward.claimStatus === "requested") return res.status(400).json({ message: "You already requested this reward" });
    if (reward.claimStatus === "approved" || reward.claimStatus === "used") return res.status(400).json({ message: "This reward has already been processed" });
    // Check quiz requirement met
    if (reward.requiredQuizCount && reward.requiredQuizCount > 0) {
      const attempts = await storage.getUserAttempts(req.user.id);
      const quizzesCompleted = attempts ? attempts.length : 0;
      if (quizzesCompleted < reward.requiredQuizCount) {
        return res.status(400).json({ message: `You need to complete ${reward.requiredQuizCount} quiz(zes) first. You have completed ${quizzesCompleted}.` });
      }
    }
    // Mark as requested
    rewards[idx].claimStatus = "requested";
    rewards[idx].claimedAt = new Date().toISOString();
    await storage.upsertSetting(key, JSON.stringify(rewards));
    // Notify admin (user ID 1 = admin)
    const studentName = req.user.displayName || req.user.username || `Student #${req.user.id}`;
    try {
      await storage.createMessage(1, "system", `Reward Request: ${studentName} is requesting to claim "${reward.title}" — ${reward.message}`);
    } catch {}
    res.json({ reward: rewards[idx], message: "Reward request sent to your admin!" });
  });

  // Admin: approve / deny / mark-used a reward claim
  app.patch("/api/admin/students/:id/rewards/:rewardId/claim", authMiddleware, adminMiddleware, async (req: any, res) => {
    const studentId = parseInt(req.params.id);
    const rewardId = parseInt(req.params.rewardId);
    const { claimStatus } = req.body; // "approved" | "denied" | "used"
    if (!["approved", "denied", "used"].includes(claimStatus)) {
      return res.status(400).json({ message: "Invalid claim status" });
    }
    const key = `student_rewards_${studentId}`;
    const raw = await storage.getSetting(key);
    let rewards: any[] = [];
    if (raw) { try { rewards = JSON.parse(raw); } catch {} }
    const idx = rewards.findIndex((r: any) => r.id === rewardId);
    if (idx === -1) return res.status(404).json({ message: "Reward not found" });
    rewards[idx].claimStatus = claimStatus;
    rewards[idx].adminReviewedAt = new Date().toISOString();
    rewards[idx].adminReviewedBy = req.user.id;
    await storage.upsertSetting(key, JSON.stringify(rewards));
    // Notify student of the decision
    const studentMsg = claimStatus === "approved"
      ? `Your reward "${rewards[idx].title}" has been approved! Show this to your teacher to use it.`
      : claimStatus === "used"
      ? `Your reward "${rewards[idx].title}" has been marked as used. Great job!`
      : `Your reward request for "${rewards[idx].title}" was not approved yet. Please ask your teacher.`;
    try { await storage.createMessage(studentId, "system", studentMsg); } catch {}
    res.json({ reward: rewards[idx], message: `Reward ${claimStatus}!` });
  });

  // === Competition Settings ===
  // Public GET — anyone can read competition settings
  app.get("/api/competition-settings", async (req, res) => {
    const raw = await storage.getSetting("competition_settings");
    let settings: any = {};
    if (raw) { try { settings = JSON.parse(raw); } catch {} }
    res.json({ settings });
  });

  // Admin POST — update competition settings
  app.post("/api/admin/competition-settings", authMiddleware, adminMiddleware, async (req: any, res) => {
    const {
      monthlyPrize, monthlyDesc, monthlyCountdownDate,
      yearly1stPrize, yearly1stAmount, yearlyCountdownDate,
      yearly2ndPrize, yearly2ndAmount,
      yearly3rdPrize, yearly3rdAmount,
      donationNote,
    } = req.body;
    const settings: any = {};
    if (monthlyPrize !== undefined) settings.monthlyPrize = monthlyPrize.trim();
    if (monthlyDesc !== undefined) settings.monthlyDesc = monthlyDesc.trim();
    if (monthlyCountdownDate !== undefined) settings.monthlyCountdownDate = monthlyCountdownDate;
    if (yearly1stPrize !== undefined) settings.yearly1stPrize = yearly1stPrize.trim();
    if (yearly1stAmount !== undefined) settings.yearly1stAmount = yearly1stAmount.trim();
    if (yearlyCountdownDate !== undefined) settings.yearlyCountdownDate = yearlyCountdownDate;
    if (yearly2ndPrize !== undefined) settings.yearly2ndPrize = yearly2ndPrize.trim();
    if (yearly2ndAmount !== undefined) settings.yearly2ndAmount = yearly2ndAmount.trim();
    if (yearly3rdPrize !== undefined) settings.yearly3rdPrize = yearly3rdPrize.trim();
    if (yearly3rdAmount !== undefined) settings.yearly3rdAmount = yearly3rdAmount.trim();
    if (donationNote !== undefined) settings.donationNote = donationNote.trim();

    // Merge with existing
    const raw = await storage.getSetting("competition_settings");
    let existing: any = {};
    if (raw) { try { existing = JSON.parse(raw); } catch {} }
    const merged = { ...existing, ...settings };
    await storage.upsertSetting("competition_settings", JSON.stringify(merged));
    res.json({ settings: merged, message: "Competition settings updated!" });
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
      // Pending parents
      const { data: allParentRows } = await supabase
        .from("users")
        .select("id, display_name, username, role, account_approved, email, created_at")
        .eq("role", 'parent')
        .order("created_at", { ascending: false });
      const pendingParentsList = (allParentRows || []).filter((p: any) =>
        !p.account_approved
      );
      // Pending AI quizzes
      const { data: pendingAIList } = await supabase
        .from("pending_ai_quizzes")
        .select("id, book_title, author, student_id, quiz_type, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      const aiSeenAt = await storage.getNotifSeenAt("ai_quiz_pending");
      const pendingAIItems = (pendingAIList || []).filter((r: any) =>
        !aiSeenAt || new Date(r.created_at) > new Date(aiSeenAt)
      );
      // Fetch student names for AI quizzes
      let aiStudentMap: Record<number, string> = {};
      if (pendingAIItems.length > 0) {
        const studentIds = [...new Set(pendingAIItems.map((r: any) => r.student_id))];
        const { data: aiStudents } = await supabase
          .from("users")
          .select("id, display_name")
          .in("id", studentIds);
        (aiStudents || []).forEach((s: any) => { aiStudentMap[s.id] = s.display_name; });
      }
      res.json({
        unreadCount: pendingReqs.length + newUsersList.length + pendingTeachersList.length + pendingParentsList.length + pendingAIItems.length,
        type: "admin",
        pendingRequests: pendingReqs.length,
        newUsers: newUsersList.length,
        pendingTeachers: pendingTeachersList.length,
        pendingParents: pendingParentsList.length,
        pendingAIQuizzes: pendingAIItems.length,
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
        pendingAIQuizItems: pendingAIItems.map((r: any) => ({
          id: r.id,
          bookTitle: r.book_title,
          author: r.author,
          studentName: aiStudentMap[r.student_id] || 'Unknown',
          quizType: r.quiz_type,
          createdAt: r.created_at,
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
      if (notifType === "quiz_requests" || notifType === "new_users" || notifType === "pending_teachers" || notifType === "ai_quiz_pending") {
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
    
    // Exclude sample/demo account from leaderboard
    leaderboard = leaderboard.filter((entry: any) => entry.username !== 'sample');
    
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

    // Exclude sample/demo account from leaderboard
    leaderboard = leaderboard.filter((entry: any) => entry.username !== 'sample');

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

  // Student: Get their leaderboard standing + recommendations
  app.get("/api/leaderboard/my-standing", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.isAdmin || req.user.role === 'teacher' || req.user.role === 'parent') {
        return res.json({ show: false });
      }

      const rawGrades = await storage.getSetting('user_grades');
      let userGrades: Record<string, string> = {};
      if (rawGrades) { try { userGrades = JSON.parse(rawGrades); } catch {} }
      const myGrade = userGrades[String(req.user.id)];
      const myBand = myGrade ? gradeToBand(myGrade) : null;

      const fullLeaderboard = await storage.getLeaderboard();

      // Exclude sample/demo account
      const filteredLeaderboard = fullLeaderboard.filter((entry: any) => entry.username !== 'sample');

      // Filter to user's band (or all if no band)
      const bandLeaderboard = myBand
        ? filteredLeaderboard.filter((entry: any) => {
            const g = userGrades[String(entry.userId)] || userGrades[String(entry.id)];
            return g && gradeToBand(g) === myBand;
          })
        : filteredLeaderboard;

      // Sort by points desc
      bandLeaderboard.sort((a: any, b: any) => (b.totalPoints || 0) - (a.totalPoints || 0));

      const myRank = bandLeaderboard.findIndex((e: any) =>
        (e.userId || e.id) === req.user.id
      ) + 1;
      const totalInBand = bandLeaderboard.length;
      const myPoints = bandLeaderboard.find((e: any) => (e.userId || e.id) === req.user.id)?.totalPoints || 0;

      // Person above
      const personAbove = myRank > 1 ? bandLeaderboard[myRank - 2] : null;
      const pointsBehind = personAbove ? (personAbove.totalPoints || 0) - myPoints : 0;

      // Count quizzes available that they haven't taken
      const allBooks = await storage.getAllBooks();
      const booksWithQuizzes = allBooks.filter((b: any) => b.pointsValue > 0);
      const myAttempts = await storage.getUserAttempts(req.user.id);
      const takenBookIds = new Set(myAttempts.map((a: any) => a.bookId));
      const availableQuizzes = booksWithQuizzes.filter((b: any) => !takenBookIds.has(b.id));

      // Easter egg status
      const eggSettings = await storage.getSetting('easter_eggs');
      let eggActive = false;
      if (eggSettings) { try { eggActive = JSON.parse(eggSettings).active; } catch {} }
      const { data: eggClaim } = await supabase.from('easter_egg_claims').select('id').eq('user_id', req.user.id).maybeSingle();

      // Recommendations
      const recommendations: string[] = [];
      if (availableQuizzes.length > 0) {
        const sample = availableQuizzes.slice(0, 3).map((b: any) => b.title);
        recommendations.push(`Take ${Math.min(availableQuizzes.length, 3)} more quiz${availableQuizzes.length > 1 ? 'zes' : ''} to earn ${availableQuizzes.slice(0, 3).reduce((s: number, b: any) => s + (b.pointsValue || 10), 0)} points. Start with "${sample[0]}".`);
      }
      if (eggActive && !eggClaim) {
        recommendations.push('Find the hidden Easter Egg in the FYP feed for +2 bonus points!');
      }
      if (personAbove && pointsBehind > 0) {
        recommendations.push(`You're only ${pointsBehind} point${pointsBehind > 1 ? 's' : ''} behind ${personAbove.displayName || personAbove.username}. Pass them to climb to rank #${myRank - 1}!`);
      }
      if (recommendations.length === 0) {
        recommendations.push('You\'re at the top of your band. Keep reading to stay ahead!');
      }

      res.json({
        show: true,
        rank: myRank || totalInBand,
        totalInBand,
        myPoints,
        band: myBand,
        personAbove: personAbove ? {
          name: personAbove.displayName || personAbove.username,
          points: personAbove.totalPoints || 0,
        } : null,
        pointsBehind,
        availableQuizzes: availableQuizzes.length,
        eggAvailable: eggActive && !eggClaim,
        recommendations,
      });
    } catch (e: any) {
      res.json({ show: false });
    }
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

      // Exclude sample/demo account
      const filteredLeaderboard = fullLeaderboard.filter((entry: any) => entry.username !== 'sample');
      
      // Filter to user's band
      const bandLeaderboard = filteredLeaderboard.filter((entry: any) => {
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

  // Admin: update book details (title, author, description, coverUrl, readUrl)
  app.patch("/api/admin/books/:id", authMiddleware, adminMiddleware, async (req, res) => {
    const bookId = parseInt(req.params.id);
    const { title, author, description, coverUrl, readUrl, ageGroup } = req.body;
    const update: any = {};
    if (title) update.title = title;
    if (author) update.author = author;
    if (description !== undefined) update.description = description;
    if (coverUrl) update.cover_url = coverUrl;
    if (readUrl !== undefined) update.read_url = readUrl;
    if (ageGroup) update.age_group = ageGroup;
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }
    const { data, error } = await supabase.from("books").update(update).eq("id", bookId).select().single();
    if (error) {
      console.error("Book update error:", error.message);
      return res.status(500).json({ message: "Failed to update book: " + error.message });
    }
    clearCache('allBooks');
    res.json(data);
  });

  // Admin: delete a book and its quiz questions
  app.delete("/api/admin/books/:id", authMiddleware, adminMiddleware, async (req, res) => {
    const bookId = parseInt(req.params.id);
    await supabase.from("questions").delete().eq("book_id", bookId);
    const { error } = await supabase.from("books").delete().eq("id", bookId);
    if (error) {
      return res.status(500).json({ message: "Failed to delete book" });
    }
    clearCache('allBooks');
    res.json({ message: "Book deleted successfully" });
  });

  // Admin: set Perplexity API key for instant quiz generation
  app.post("/api/admin/ai-settings", authMiddleware, adminMiddleware, async (req, res) => {
    const { perplexityApiKey } = req.body;
    if (!perplexityApiKey || perplexityApiKey.trim().length < 10) {
      return res.status(400).json({ message: "A valid API key is required" });
    }
    await storage.upsertSetting("perplexity_api_key", perplexityApiKey.trim());
    res.json({ message: "AI settings saved successfully" });
  });

  // Admin: get AI settings status (does NOT return the key)
  app.get("/api/admin/ai-settings", authMiddleware, adminMiddleware, async (req, res) => {
    const key = await storage.getSetting("perplexity_api_key");
    const guidelines = await storage.getSetting("quiz_generation_guidelines");
    res.json({ configured: !!key, keyPreview: key ? key.slice(0, 8) + "..." + key.slice(-4) : null, guidelines: guidelines || "" });
  });

  // Admin: set quiz generation guidelines
  app.post("/api/admin/quiz-guidelines", authMiddleware, adminMiddleware, async (req, res) => {
    const { guidelines } = req.body;
    await storage.upsertSetting("quiz_generation_guidelines", guidelines || "");
    res.json({ message: "Quiz guidelines saved successfully" });
  });

  // Student: generate an instant AI quiz for a book
  app.post("/api/instant-quiz", authMiddleware, async (req: any, res) => {
    try {
      const { bookTitle, author } = req.body;
      if (!bookTitle || bookTitle.trim().length < 2) {
        return res.status(400).json({ message: "Book title is required" });
      }
      if (!author || author.trim().length < 2) {
        return res.status(400).json({ message: "Author is required" });
      }

      // Only students can use instant quiz
      if (req.user.role === 'teacher' || req.user.role === 'parent' || req.user.isAdmin) {
        return res.status(403).json({ message: "Only students can generate instant quizzes" });
      }

      // Fix spelling and capitalization
      const fixTitle = (raw: string): string => {
        return raw.trim().toLowerCase().replace(/(^|[\s&-])(\w)/g, (_, sep, char) => sep + char.toUpperCase());
      };
      const cleanTitle = fixTitle(bookTitle);
      const cleanAuthor = fixTitle(author);

      // Check if this book already exists with a quiz
      const allBooks = await storage.getAllBooks();
      const existing = allBooks.find((b: any) =>
        b.title.toLowerCase().trim() === cleanTitle.toLowerCase()
      );
      if (existing && existing.pointsValue > 0) {
        // Book already has a quiz, redirect to it
        return res.json({ bookId: existing.id, message: "A quiz for this book already exists!", existing: true });
      }

      // Get student's grade band for appropriate question difficulty
      const rawGrades = await storage.getSetting('user_grades');
      let userGrades: Record<string, string> = {};
      if (rawGrades) { try { userGrades = JSON.parse(rawGrades); } catch {} }
      const studentGrade = userGrades[String(req.user.id)] || "5";
      const ageGroup = studentGrade <= "2" ? "K-2" : studentGrade <= "5" ? "3-5" : studentGrade <= "8" ? "6-8" : "9-12";

      // Generate quiz with AI
      const result = await generateQuizWithAI(cleanTitle, cleanAuthor, ageGroup, studentGrade);
      if ("error" in result) {
        if (result.needsManualReview) {
          // Create a quiz request notification for the admin
          try {
            await supabase.from('quiz_requests').insert({
              student_id: req.user.id,
              book_title: cleanTitle,
              author: cleanAuthor,
              status: 'pending',
              reason: result.reviewReason || ''
            });
            await supabase.from('notifications').insert({
              user_id: 1,
              type: 'info',
              title: 'Manual review needed',
              message: `A student requested a quiz for "${cleanTitle}" but it appears to be below their grade level. Review needed.`
            });
          } catch {}
          return res.status(403).json({ message: result.error, needsManualReview: true });
        }
        return res.status(500).json({ message: result.error });
      }

      // Fetch book cover from Open Library
      let coverUrl: string | null = null;
      try {
        const coverRes = await fetch(
          `https://covers.openlibrary.org/b/title/${encodeURIComponent(cleanTitle)}?format=json&limit=1`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (coverRes.ok) {
          const coverData = await coverRes.json() as any;
          if (coverData.covers && coverData.covers.length > 0) {
            coverUrl = `https://covers.openlibrary.org/b/id/${coverData.covers[0].id}-L.jpg`;
          }
        }
      } catch {}
      if (!coverUrl) {
        try {
          const searchRes = await fetch(
            `https://openlibrary.org/search.json?title=${encodeURIComponent(cleanTitle)}&author=${encodeURIComponent(cleanAuthor)}&limit=1`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (searchRes.ok) {
            const searchData = await searchRes.json() as any;
            if (searchData.docs && searchData.docs.length > 0 && searchData.docs[0].cover_i) {
              coverUrl = `https://covers.openlibrary.org/b/id/${searchData.docs[0].cover_i}-L.jpg`;
            }
          }
        } catch {}
      }

      // Save the generated quiz for admin/teacher review before publishing
      try {
        await supabase.from('pending_ai_quizzes').insert({
          student_id: req.user.id,
          book_title: cleanTitle,
          author: cleanAuthor,
          questions: JSON.stringify(result.questions),
          cover_url: coverUrl,
          age_group: ageGroup,
          quiz_type: 'book',
          status: 'pending'
        });
        // Notify admin and teachers
        try {
          const { data: teachers } = await supabase.from('users').select('id').eq('role', 'teacher');
          const notifyIds = [1, ...(teachers || []).map((t: any) => t.id)];
          for (const uid of notifyIds) {
            await supabase.from('notifications').insert({
              user_id: uid,
              type: 'info',
              title: 'AI Quiz Pending Review',
              message: `Student requested an AI quiz for "${cleanTitle}" by ${cleanAuthor}. Review and approve it in the admin panel.`
            });
          }
        } catch {}
      } catch {}

      return res.status(201).json({ 
        pendingReview: true, 
        message: `Your quiz for "${cleanTitle}" has been sent to your teacher for review. You'll get a notification when it's ready!`,
        questions: result.questions 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to generate quiz" });
    }
  });

  // Student: get their favorites (topics + created quiz book IDs)
  app.get("/api/student/favorites", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role === 'teacher' || req.user.role === 'parent') {
        return res.status(403).json({ message: "Only students and admins can access favorites" });
      }
      const favKey = `student_favorites_${req.user.id}`;
      const booksKey = `student_favorite_books_${req.user.id}`;
      const favRaw = await storage.getSetting(favKey);
      const booksRaw = await storage.getSetting(booksKey);
      let topics: string[] = [];
      let bookIds: number[] = [];
      if (favRaw) { try { topics = JSON.parse(favRaw); } catch {} }
      if (booksRaw) { try { bookIds = JSON.parse(booksRaw); } catch {} }
      res.json({ topics, bookIds, onboarded: !!favRaw });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Student: save their favorites (1-5 topics)
  app.post("/api/student/favorites", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role === 'teacher' || req.user.role === 'parent') {
        return res.status(403).json({ message: "Only students can save favorites" });
      }
      const { topics } = req.body;
      if (!Array.isArray(topics) || topics.length < 1 || topics.length > 5) {
        return res.status(400).json({ message: "Select 1 to 5 favorites" });
      }
      const cleanTopics = topics.map((t: string) => t.trim()).filter((t: string) => t.length > 0).slice(0, 5);
      if (cleanTopics.length < 1) {
        return res.status(400).json({ message: "Select at least 1 favorite" });
      }
      const favKey = `student_favorites_${req.user.id}`;
      await storage.upsertSetting(favKey, JSON.stringify(cleanTopics));
      // Clear old suggested books cache so fresh results are fetched
      const cacheKey = `student_suggested_books_${req.user.id}`;
      await storage.upsertSetting(cacheKey, JSON.stringify([]));
      res.json({ topics: cleanTopics, message: "Favorites saved!" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Student: get suggested REAL books from Open Library based on favorite topics
  app.get("/api/student/suggested-books", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role === 'teacher' || req.user.role === 'parent') {
        return res.status(403).json({ message: "Only students can get suggestions" });
      }
      const favKey = `student_favorites_${req.user.id}`;
      const favRaw = await storage.getSetting(favKey);
      let topics: string[] = [];
      if (favRaw) { try { topics = JSON.parse(favRaw); } catch {} }
      if (topics.length === 0) return res.json({ books: [] });

      // Check cache — stored in student_suggested_books_<userId>
      const cacheKey = `student_suggested_books_${req.user.id}`;
      const cacheRaw = await storage.getSetting(cacheKey);
      let cached: { topic: string; title: string; author: string; coverUrl: string; }[] = [];
      if (cacheRaw) { try { cached = JSON.parse(cacheRaw); } catch {} }
      // If cache covers all topics and has at least 2 books per topic, return it
      const cachedTopics = new Set(cached.map(c => c.topic));
      if (topics.every(t => cachedTopics.has(t)) && cached.length >= topics.length * 2) {
        const filtered = cached.filter(c => topics.includes(c.topic));
        return res.json({ books: filtered });
      }

      // Search Open Library for each topic — return multiple real books per topic
      const suggestions: { topic: string; title: string; author: string; coverUrl: string; }[] = [];
      for (const topic of topics) {
        try {
          const searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(topic)}&limit=12&sort=rating&language=eng&subject=kids`;
          const searchRes = await fetch(searchUrl);
          const searchData = await searchRes.json();
          if (searchData.docs && searchData.docs.length > 0) {
            // Collect up to 4 results with covers per topic
            let count = 0;
            for (const doc of searchData.docs) {
              if (count >= 4) break;
              if (doc.cover_i) {
                suggestions.push({
                  topic,
                  title: doc.title,
                  author: doc.author_name ? doc.author_name[0] : "Unknown",
                  coverUrl: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
                });
                count++;
              }
            }
            // If not enough with covers, add some without
            if (count < 2) {
              for (const doc of searchData.docs) {
                if (count >= 2) break;
                if (!doc.cover_i) {
                  suggestions.push({
                    topic,
                    title: doc.title,
                    author: doc.author_name ? doc.author_name[0] : "Unknown",
                    coverUrl: "",
                  });
                  count++;
                }
              }
            }
          }
        } catch (e) {
          // Skip on error
        }
      }

      // Cache the results
      await storage.upsertSetting(cacheKey, JSON.stringify(suggestions));
      res.json({ books: suggestions });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Student: get book recommendations based on reading score + favorite picks
  // Returns two sets: matchLevel (at current level) and growScore (next level up)
  app.get("/api/student/reading-recommendations", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role === 'teacher' || req.user.role === 'parent') {
        return res.status(403).json({ message: "Only students can get recommendations" });
      }
      const userId = req.user.id;

      // Get student's favorite topics
      const favKey = `student_favorites_${userId}`;
      const favRaw = await storage.getSetting(favKey);
      let topics: string[] = [];
      if (favRaw) { try { topics = JSON.parse(favRaw); } catch {} }

      // Get reading profile for current level
      const profile = await storage.getReadingProfile(userId);
      const currentLevel = profile?.current_level || 3;
      const nextLevel = Math.min(currentLevel + 1, 8);

      // Get all books on the site
      const allBooks = await storage.getAllBooks();
      const userAttempts = await storage.getUserAttempts(userId);
      const completedIds = new Set(userAttempts.map(a => a.bookId));

      // Map grade level to pointsValue ranges
      // Level 2-3 = 10pts, Level 4-5 = 20pts, Level 6+ = 30pts
      const matchPoints = currentLevel >= 6 ? 30 : currentLevel >= 4 ? 20 : 10;
      const growPoints = nextLevel >= 6 ? 30 : nextLevel >= 4 ? 20 : 10;

      // SECTION 1: Match My Level — books at current reading level + matching favorite topics
      let matchLevelBooks = allBooks.filter(b => b.pointsValue === matchPoints && !completedIds.has(b.id));

      // SECTION 2: Grow My Score — books at next level up + matching favorite topics
      let growScoreBooks = allBooks.filter(b => b.pointsValue === growPoints && !completedIds.has(b.id));

      // If favorite topics exist, prioritize books that match
      if (topics.length > 0) {
        const matchesTopic = (book: any) => {
          const titleLower = (book.title || '').toLowerCase();
          const descLower = (book.description || '').toLowerCase();
          return topics.some(t => titleLower.includes(t.toLowerCase()) || descLower.includes(t.toLowerCase()));
        };
        // Sort: topic matches first, then the rest
        matchLevelBooks = [...matchLevelBooks].sort((a, b) => {
          const aMatch = matchesTopic(a) ? 0 : 1;
          const bMatch = matchesTopic(b) ? 0 : 1;
          return aMatch - bMatch;
        });
        growScoreBooks = [...growScoreBooks].sort((a, b) => {
          const aMatch = matchesTopic(a) ? 0 : 1;
          const bMatch = matchesTopic(b) ? 0 : 1;
          return aMatch - bMatch;
        });
      }

      // Limit each section
      matchLevelBooks = matchLevelBooks.slice(0, 8);
      growScoreBooks = growScoreBooks.slice(0, 8);

      // Also fetch Open Library suggestions based on favorite topics for each section
      const olMatchBooks: any[] = [];
      const olGrowBooks: any[] = [];

      if (topics.length > 0) {
        // Use cache for Open Library results
        const cacheKey = `student_ol_recs_${userId}_${currentLevel}_${nextLevel}`;
        const cacheRaw = await storage.getSetting(cacheKey);
        let cached: any[] = [];
        if (cacheRaw) { try { cached = JSON.parse(cacheRaw); } catch {} }

        if (cached.length >= topics.length * 2) {
          cached.forEach(c => {
            if (c.type === 'match') olMatchBooks.push(c);
            else olGrowBooks.push(c);
          });
        } else {
          // Fetch from Open Library for each topic
          for (const topic of topics.slice(0, 3)) {
            try {
              // Match level: search for books at current grade level
              const matchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(topic)}&limit=6&sort=rating&language=eng`;
              const matchRes = await fetch(matchUrl);
              const matchData = await matchRes.json();
              if (matchData.docs) {
                let count = 0;
                for (const doc of matchData.docs) {
                  if (count >= 3) break;
                  if (doc.cover_i) {
                    olMatchBooks.push({
                      topic, title: doc.title,
                      author: doc.author_name ? doc.author_name[0] : "Unknown",
                      coverUrl: `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`,
                      type: 'match'
                    });
                    count++;
                  }
                }
              }
              // Grow level: same topic but search for slightly harder books
              const growUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(topic)}&limit=6&sort=rating&language=eng&subject=young-adult`;
              const growRes = await fetch(growUrl);
              const growData = await growRes.json();
              if (growData.docs) {
                let count = 0;
                for (const doc of growData.docs) {
                  if (count >= 3) break;
                  if (doc.cover_i) {
                    olGrowBooks.push({
                      topic, title: doc.title,
                      author: doc.author_name ? doc.author_name[0] : "Unknown",
                      coverUrl: `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`,
                      type: 'grow'
                    });
                    count++;
                  }
                }
              }
            } catch (e) {
              // Skip on error
            }
          }
          // Cache the Open Library results
          const allOL = [...olMatchBooks, ...olGrowBooks];
          await storage.upsertSetting(cacheKey, JSON.stringify(allOL));
        }
      }

      res.json({
        currentLevel,
        nextLevel,
        favoriteTopics: topics,
        matchLevel: {
          siteBooks: matchLevelBooks,
          openLibraryBooks: olMatchBooks.slice(0, 8)
        },
        growScore: {
          siteBooks: growScoreBooks,
          openLibraryBooks: olGrowBooks.slice(0, 8)
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Student: create an AI quiz for one of their favorite topics
  app.post("/api/student/favorite-quiz", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role === 'teacher' || req.user.role === 'parent' || req.user.isAdmin) {
        return res.status(403).json({ message: "Only students can create favorite quizzes" });
      }
      const { topic } = req.body;
      if (!topic || topic.trim().length < 2) {
        return res.status(400).json({ message: "Topic is required" });
      }
      // Verify topic is in student's favorites
      const favKey = `student_favorites_${req.user.id}`;
      const favRaw = await storage.getSetting(favKey);
      let topics: string[] = [];
      if (favRaw) { try { topics = JSON.parse(favRaw); } catch {} }
      const matched = topics.find(t => t.toLowerCase() === topic.trim().toLowerCase());
      if (!matched) {
        return res.status(403).json({ message: "This topic is not in your favorites" });
      }
      const cleanTopic = matched; // Use the stored version

      // Get student grade
      const rawGrades = await storage.getSetting('user_grades');
      let userGrades: Record<string, string> = {};
      if (rawGrades) { try { userGrades = JSON.parse(rawGrades); } catch {} }
      const studentGrade = userGrades[String(req.user.id)] || "5";
      const ageGroup = studentGrade <= "2" ? "K-2" : studentGrade <= "5" ? "3-5" : studentGrade <= "8" ? "6-8" : "9-12";

      // Check if quiz already exists for this topic for this student — allow multiple
      const booksKey = `student_favorite_books_${req.user.id}`;
      const booksRaw = await storage.getSetting(booksKey);
      let existingBookIds: number[] = [];
      if (booksRaw) { try { existingBookIds = JSON.parse(booksRaw); } catch {} }
      // Always generate a new quiz — students can create as many as they like

      // Generate quiz with AI
      const result = await generateQuizWithAI(cleanTopic, "Favorite Topic", ageGroup, studentGrade);
      if ("error" in result) {
        return res.status(500).json({ message: result.error });
      }

      // Fetch cover
      let coverUrl: string | null = null;
      try {
        const coverRes = await fetch(
          `https://covers.openlibrary.org/b/title/${encodeURIComponent(cleanTopic)}?format=json&limit=1`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (coverRes.ok) {
          const coverData = await coverRes.json() as any;
          if (coverData.covers && coverData.covers.length > 0) {
            coverUrl = `https://covers.openlibrary.org/b/id/${coverData.covers[0].id}-L.jpg`;
          }
        }
      } catch {}
      if (!coverUrl) {
        try {
          const searchRes = await fetch(
            `https://openlibrary.org/search.json?title=${encodeURIComponent(cleanTopic)}&limit=1`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (searchRes.ok) {
            const searchData = await searchRes.json() as any;
            if (searchData.docs && searchData.docs.length > 0 && searchData.docs[0].cover_i) {
              coverUrl = `https://covers.openlibrary.org/b/id/${searchData.docs[0].cover_i}-L.jpg`;
            }
          }
        } catch {}
      }

      // Save as pending for admin/teacher review
      try {
        await supabase.from('pending_ai_quizzes').insert({
          student_id: req.user.id,
          book_title: cleanTopic,
          author: 'Favorite Topic',
          questions: JSON.stringify(result.questions),
          cover_url: coverUrl,
          age_group: ageGroup,
          quiz_type: 'favorite_topic',
          status: 'pending'
        });
        // Notify admin and teachers
        try {
          const { data: teachers } = await supabase.from('users').select('id').eq('role', 'teacher');
          const notifyIds = [1, ...(teachers || []).map((t: any) => t.id)];
          for (const uid of notifyIds) {
            await supabase.from('notifications').insert({
              user_id: uid,
              type: 'info',
              title: 'AI Quiz Pending Review',
              message: `Student requested an AI quiz about "${cleanTopic}" (favorite topic). Review and approve it in the admin panel.`
            });
          }
        } catch {}
      } catch {}

      return res.status(201).json({ 
        pendingReview: true, 
        message: `Your quiz about "${cleanTopic}" has been sent to your teacher for review. You'll get a notification when it's ready!`,
        questions: result.questions 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to generate quiz" });
    }
  });

  // Admin: get any student's favorites
  app.get("/api/admin/student-favorites/:userId", authMiddleware, async (req: any, res) => {
    try {
      if (!req.user.isAdmin) return res.status(403).json({ message: "Admin only" });
      const userId = parseInt(req.params.userId);
      const favKey = `student_favorites_${userId}`;
      const booksKey = `student_favorite_books_${userId}`;
      const favRaw = await storage.getSetting(favKey);
      const booksRaw = await storage.getSetting(booksKey);
      let topics: string[] = [];
      let bookIds: number[] = [];
      if (favRaw) { try { topics = JSON.parse(favRaw); } catch {} }
      if (booksRaw) { try { bookIds = JSON.parse(booksRaw); } catch {} }
      res.json({ topics, bookIds, onboarded: !!favRaw });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: override a student's favorites
  app.post("/api/admin/student-favorites/:userId", authMiddleware, async (req: any, res) => {
    try {
      if (!req.user.isAdmin) return res.status(403).json({ message: "Admin only" });
      const userId = parseInt(req.params.userId);
      const { topics } = req.body;
      if (!Array.isArray(topics) || topics.length < 1 || topics.length > 5) {
        return res.status(400).json({ message: "Select 1 to 5 favorites" });
      }
      const cleanTopics = topics.map((t: string) => t.trim()).filter((t: string) => t.length > 0).slice(0, 5);
      const favKey = `student_favorites_${userId}`;
      await storage.upsertSetting(favKey, JSON.stringify(cleanTopics));
      res.json({ topics: cleanTopics, message: "Favorites updated!" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Student: get their custom iArise topics
  app.get("/api/student/iarise-topics", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role === 'teacher' || req.user.role === 'parent') {
        return res.status(403).json({ message: "Only students can access iArise topics" });
      }
      const topicsKey = `student_iarise_topics_${req.user.id}`;
      const booksKey = `student_iarise_books_${req.user.id}`;
      const topicsRaw = await storage.getSetting(topicsKey);
      const booksRaw = await storage.getSetting(booksKey);
      let topics: string[] = [];
      let bookIds: number[] = [];
      if (topicsRaw) { try { topics = JSON.parse(topicsRaw); } catch {} }
      if (booksRaw) { try { bookIds = JSON.parse(booksRaw); } catch {} }
      res.json({ topics, bookIds });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Student: save their custom iArise topics (1-5)
  app.post("/api/student/iarise-topics", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role === 'teacher' || req.user.role === 'parent') {
        return res.status(403).json({ message: "Only students can save iArise topics" });
      }
      const { topics } = req.body;
      if (!Array.isArray(topics) || topics.length < 1 || topics.length > 5) {
        return res.status(400).json({ message: "Select 1 to 5 topics" });
      }
      const cleanTopics = topics.map((t: string) => t.trim()).filter((t: string) => t.length > 0).slice(0, 5);
      if (cleanTopics.length < 1) {
        return res.status(400).json({ message: "Select at least 1 topic" });
      }
      const topicsKey = `student_iarise_topics_${req.user.id}`;
      await storage.upsertSetting(topicsKey, JSON.stringify(cleanTopics));
      res.json({ topics: cleanTopics, message: "iArise topics saved!" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Student: create an AI quiz for their custom iArise topic
  app.post("/api/student/iarise-quiz", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role === 'teacher' || req.user.role === 'parent' || req.user.isAdmin) {
        return res.status(403).json({ message: "Only students can create iArise quizzes" });
      }
      const { topic } = req.body;
      if (!topic || topic.trim().length < 2) {
        return res.status(400).json({ message: "Topic is required" });
      }
      // Verify topic is in student's iArise topics
      const topicsKey = `student_iarise_topics_${req.user.id}`;
      const topicsRaw = await storage.getSetting(topicsKey);
      let topics: string[] = [];
      if (topicsRaw) { try { topics = JSON.parse(topicsRaw); } catch {} }
      const matched = topics.find(t => t.toLowerCase() === topic.trim().toLowerCase());
      if (!matched) {
        return res.status(403).json({ message: "This topic is not in your iArise list" });
      }
      const cleanTopic = matched;

      // Get student grade
      const rawGrades = await storage.getSetting('user_grades');
      let userGrades: Record<string, string> = {};
      if (rawGrades) { try { userGrades = JSON.parse(rawGrades); } catch {} }
      const studentGrade = userGrades[String(req.user.id)] || "5";
      const ageGroup = studentGrade <= "2" ? "K-2" : studentGrade <= "5" ? "3-5" : studentGrade <= "8" ? "6-8" : "9-12";

      // Generate quiz with AI
      const result = await generateQuizWithAI(cleanTopic, "iArise Lesson", ageGroup, studentGrade);
      if ("error" in result) {
        return res.status(500).json({ message: result.error });
      }

      // Fetch cover
      let coverUrl: string | null = null;
      try {
        const coverRes = await fetch(
          `https://covers.openlibrary.org/b/title/${encodeURIComponent(cleanTopic)}?format=json&limit=1`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (coverRes.ok) {
          const coverData = await coverRes.json() as any;
          if (coverData.covers && coverData.covers.length > 0) {
            coverUrl = `https://covers.openlibrary.org/b/id/${coverData.covers[0].id}-L.jpg`;
          }
        }
      } catch {}
      if (!coverUrl) {
        try {
          const searchRes = await fetch(
            `https://openlibrary.org/search.json?title=${encodeURIComponent(cleanTopic)}&limit=1`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (searchRes.ok) {
            const searchData = await searchRes.json() as any;
            if (searchData.docs && searchData.docs.length > 0 && searchData.docs[0].cover_i) {
              coverUrl = `https://covers.openlibrary.org/b/id/${searchData.docs[0].cover_i}-L.jpg`;
            }
          }
        } catch {}
      }

      // Save as pending for admin/teacher review
      try {
        await supabase.from('pending_ai_quizzes').insert({
          student_id: req.user.id,
          book_title: cleanTopic,
          author: 'iArise Lesson',
          questions: JSON.stringify(result.questions),
          cover_url: coverUrl,
          age_group: ageGroup,
          quiz_type: 'iarise',
          status: 'pending'
        });
        // Notify admin and teachers
        try {
          const { data: teachers } = await supabase.from('users').select('id').eq('role', 'teacher');
          const notifyIds = [1, ...(teachers || []).map((t: any) => t.id)];
          for (const uid of notifyIds) {
            await supabase.from('notifications').insert({
              user_id: uid,
              type: 'info',
              title: 'AI Quiz Pending Review',
              message: `Student requested an AI iArise quiz about "${cleanTopic}". Review and approve it in the admin panel.`
            });
          }
        } catch {}
      } catch {}

      return res.status(201).json({ 
        pendingReview: true, 
        message: `Your iArise quiz about "${cleanTopic}" has been sent to your teacher for review. You'll get a notification when it's ready!`,
        questions: result.questions 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to generate iArise quiz" });
    }
  });

  // Student: generate an instant AI eye gaze quiz
  app.post("/api/instant-quiz-eye-gaze", authMiddleware, async (req: any, res) => {
    try {
      const { topic, description, sourceLink } = req.body;
      if (!topic || topic.trim().length < 2) {
        return res.status(400).json({ message: "Please enter a topic or description for your quiz" });
      }

      // Generate eye gaze quiz with AI
      const result = await generateEyeGazeQuizWithAI(topic.trim(), description, sourceLink);
      if ("error" in result) {
        return res.status(500).json({ message: result.error });
      }

      // Save as pending for admin/teacher review
      try {
        await supabase.from('pending_ai_quizzes').insert({
          student_id: req.user.id,
          book_title: quizTitle,
          author: topic.trim(),
          questions: JSON.stringify(result.questions),
          cover_url: null,
          age_group: 'Custom',
          quiz_type: 'eye_gaze',
          status: 'pending'
        });
        // Notify admin and teachers
        try {
          const { data: teachers } = await supabase.from('users').select('id').eq('role', 'teacher');
          const notifyIds = [1, ...(teachers || []).map((t: any) => t.id)];
          for (const uid of notifyIds) {
            await supabase.from('notifications').insert({
              user_id: uid,
              type: 'info',
              title: 'AI Quiz Pending Review',
              message: `Student requested an AI eye gaze quiz about "${topic.trim()}". Review and approve it in the admin panel.`
            });
          }
        } catch {}
      } catch {}

      return res.status(201).json({ 
        pendingReview: true, 
        message: `Your eye gaze quiz about "${topic.trim()}" has been sent to your teacher for review. You'll get a notification when it's ready!`,
        questions: result.questions 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to generate eye gaze quiz. Please try again." });
    }
  });

  // === AI Quiz Review System ===
  // Admin/Teacher: list pending AI quizzes
  app.get("/api/admin/pending-quizzes", authMiddleware, async (req: any, res) => {
    try {
      if (!req.user.isAdmin && req.user.role !== 'teacher') return res.status(403).json({ message: "Admin or teacher only" });
      const { data, error } = await supabase
        .from('pending_ai_quizzes')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      
      // Fetch student names separately
      const studentIds = [...new Set((data || []).map((r: any) => r.student_id))];
      let studentMap: Record<number, string> = {};
      if (studentIds.length > 0) {
        const { data: students } = await supabase
          .from('users')
          .select('id, display_name')
          .in('id', studentIds);
        (students || []).forEach((s: any) => { studentMap[s.id] = s.display_name; });
      }
      
      const pending = (data || []).map((row: any) => ({
        ...row,
        student_name: studentMap[row.student_id] || 'Unknown'
      }));
      res.json({ pending });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin/Teacher: approve a pending AI quiz
  app.post("/api/admin/pending-quizzes/:id/approve", authMiddleware, async (req: any, res) => {
    try {
      if (!req.user.isAdmin && req.user.role !== 'teacher') return res.status(403).json({ message: "Admin or teacher only" });
      const { data: pendingRows, error: fetchError } = await supabase
        .from('pending_ai_quizzes')
        .select('*')
        .eq('id', req.params.id)
        .eq('status', 'pending');
      if (fetchError) throw new Error(fetchError.message);
      if (!pendingRows || pendingRows.length === 0) return res.status(404).json({ message: "Pending quiz not found" });
      const pending = pendingRows[0];
      const questions = JSON.parse(pending.questions);

      if (pending.quiz_type === 'eye_gaze') {
        // Create as a custom eye gaze quiz
        const quiz = await storage.createCustomEyeGazeQuiz(
          pending.student_id,
          pending.book_title.slice(0, 60),
          `AI-generated eye gaze quiz about ${pending.author}`,
          pending.age_group || "Custom",
          questions,
          "global", null, "eye_gaze"
        );
        // Notify student
        await supabase.from('notifications').insert({
          user_id: pending.student_id,
          type: 'success',
          title: 'Quiz Approved!',
          message: `Your eye gaze quiz "${pending.book_title}" has been approved and is ready to take!`
        });
      } else {
        // Create as a book quiz
        const book = await storage.createBookWithQuestions({
          title: pending.book_title,
          author: pending.author,
          ageGroup: pending.age_group,
          coverUrl: pending.cover_url,
          description: `Quiz for "${pending.book_title}" by ${pending.author}`,
          pointsValue: pending.quiz_type === 'iarise' ? 2 : 10,
          readUrl: null,
        }, questions);

        // Assign grade band
        try {
          const rawBands = await storage.getSetting('book_grade_bands');
          let bookBands: Record<string, string> = {};
          if (rawBands) { try { bookBands = JSON.parse(rawBands); } catch {} }
          bookBands[String(book.id)] = pending.age_group;
          await storage.upsertSetting('book_grade_bands', JSON.stringify(bookBands));
        } catch {}

        // For iArise, generate lesson content and store book ID
        if (pending.quiz_type === 'iarise') {
          try {
            const lessonResult = await generateIariseLessonContent(pending.book_title, pending.age_group);
            if (!("error" in lessonResult)) {
              const rawCourses = await storage.getSetting('iarise_course_content');
              let courses: any = {};
              if (rawCourses) { try { courses = JSON.parse(rawCourses); } catch {} }
              courses[String(book.id)] = lessonResult;
              await storage.upsertSetting('iarise_course_content', JSON.stringify(courses));
            }
          } catch {}
          const booksKey = `student_iarise_books_${pending.student_id}`;
          const booksRaw = await storage.getSetting(booksKey);
          let existingBookIds: number[] = [];
          if (booksRaw) { try { existingBookIds = JSON.parse(booksRaw); } catch {} }
          existingBookIds.push(book.id);
          await storage.upsertSetting(booksKey, JSON.stringify(existingBookIds));
        } else if (pending.quiz_type === 'favorite_topic') {
          const booksKey = `student_favorite_books_${pending.student_id}`;
          const booksRaw = await storage.getSetting(booksKey);
          let existingBookIds: number[] = [];
          if (booksRaw) { try { existingBookIds = JSON.parse(booksRaw); } catch {} }
          existingBookIds.push(book.id);
          await storage.upsertSetting(booksKey, JSON.stringify(existingBookIds));
        }

        // Notify student
        await supabase.from('notifications').insert({
          user_id: pending.student_id,
          type: 'success',
          title: 'Quiz Approved!',
          message: `Your quiz for "${pending.book_title}" has been approved and is ready to take!`
        });
      }

      // Mark as approved
      await supabase.from('pending_ai_quizzes')
        .update({ status: 'approved', reviewer_id: req.user.id, reviewed_at: new Date().toISOString() })
        .eq('id', req.params.id);
      res.json({ message: "Quiz approved and published!" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin/Teacher: reject a pending AI quiz
  app.post("/api/admin/pending-quizzes/:id/reject", authMiddleware, async (req: any, res) => {
    try {
      if (!req.user.isAdmin && req.user.role !== 'teacher') return res.status(403).json({ message: "Admin or teacher only" });
      const { reason } = req.body;
      const { data: pendingRows, error: fetchError } = await supabase
        .from('pending_ai_quizzes')
        .select('*')
        .eq('id', req.params.id)
        .eq('status', 'pending');
      if (fetchError) throw new Error(fetchError.message);
      if (!pendingRows || pendingRows.length === 0) return res.status(404).json({ message: "Pending quiz not found" });
      const pending = pendingRows[0];
      await supabase.from('pending_ai_quizzes')
        .update({ status: 'rejected', reviewer_id: req.user.id, reviewed_at: new Date().toISOString(), review_reason: reason || 'Not specified' })
        .eq('id', req.params.id);
      // Notify student
      await supabase.from('notifications').insert({
        user_id: pending.student_id,
        type: 'info',
        title: 'Quiz Update',
        message: `Your quiz for "${pending.book_title}" was not approved. ${reason || 'Please try again with a different book.'}`
      });
      res.json({ message: "Quiz rejected and student notified." });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: generate quiz for an existing book (bypasses review)
  app.post("/api/admin/books/:id/generate-quiz", authMiddleware, async (req: any, res) => {
    try {
      if (!req.user.isAdmin) return res.status(403).json({ message: "Admin only" });
      const bookId = parseInt(req.params.id);
      const allBooks = await storage.getAllBooks();
      const book = allBooks.find((b: any) => b.id === bookId);
      if (!book) return res.status(404).json({ message: "Book not found" });

      // Generate quiz with AI
      const result = await generateQuizWithAI(book.title, book.author, book.ageGroup, '5');
      if ("error" in result) {
        return res.status(500).json({ message: result.error });
      }

      // Delete old questions for this book
      await supabase.from('questions').delete().eq('book_id', bookId);

      // Insert new questions
      const questionRows = result.questions.map((q: any, i: number) => ({
        book_id: bookId,
        question_text: q.question,
        option_a: q.options[0],
        option_b: q.options[1],
        option_c: q.options[2],
        option_d: q.options[3],
        correct_answer: q.correct,
        question_order: i + 1
      }));
      const { error: insertError } = await supabase.from('questions').insert(questionRows);
      if (insertError) throw new Error(insertError.message);

      // Update points value
      await supabase.from('books').update({ points_value: result.pointsValue || 10 }).eq('id', bookId);

      // Clear cache
      clearCache('allBooks');

      res.json({ message: `Quiz generated with ${result.questions.length} questions!`, questions: result.questions });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
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

  // Student: request Learning Ally / Clever access for a book
  app.post("/api/books/request-learning-ally", authMiddleware, async (req: any, res) => {
    try {
      const { bookTitle, author } = req.body;
      if (!bookTitle) return res.status(400).json({ message: "Book title is required" });
      const adminUser = await storage.getUserByUsername("admin");
      if (adminUser) {
        await storage.createMessage(
          adminUser.id,
          "student",
          `${req.user.displayName} requested Learning Ally / Clever access for "${bookTitle}"${author ? ` by ${author}` : ""}. Please add it to Clever so they can read it.`,
          null
        );
      }
      res.status(201).json({ message: "Request sent! We'll add it to Clever soon." });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
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

  // Public: Get donation goal settings
  app.get("/api/donation-settings", async (_req, res) => {
    try {
      const raw = await storage.getSetting('donation_settings');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.active) return res.json(data);
      }
      res.json(null);
    } catch {
      res.json(null);
    }
  });

  // Admin: Update donation settings
  app.put("/api/admin/donation-settings", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { goalAmount, currentAmount, title, description, donateUrl, milestones, active } = req.body;
      const data = { goalAmount, currentAmount, title, description, donateUrl, milestones, active };
      await storage.upsertSetting('donation_settings', JSON.stringify(data));
      res.json({ success: true, data });
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

  // DEBUG: Test email endpoint
  // Get the logged-in teacher's grade band
  app.get("/api/teacher/my-band", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
        return res.json({ bands: [], bandsText: '' });
      }
      const rawGrades = await storage.getSetting('teacher_grades');
      let teacherGrades: Record<string, string[]> = {};
      if (rawGrades) { try { teacherGrades = JSON.parse(rawGrades); } catch {} }
      const grades = teacherGrades[String(req.user.id)] || [];
      
      // Convert grade strings to band names
      const gradeToBand = (g: string): string => {
        const n = parseInt(g);
        if (g === 'K' || n === 1 || n === 2) return 'K-2';
        if (n === 3 || n === 4 || n === 5) return '3-5';
        if (n === 6 || n === 7 || n === 8) return '6-8';
        if (n >= 9) return '9-12';
        return '';
      };
      
      const bands = [...new Set(grades.map(gradeToBand).filter(Boolean))];
      const bandsText = bands.join(' / ');
      res.json({ bands, bandsText });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

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
      try { clearCache('allUsers'); } catch {}
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

  // Admin: list pending parents
  app.get("/api/admin/pending-parents", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { data: parents } = await supabase
        .from("users")
        .select("id, display_name, username, email, created_at, school_id")
        .eq("role", "parent")
        .eq("account_approved", false)
        .order("created_at", { ascending: false });

      // Get linked student info
      const rawLinks = await storage.getSetting('parent_student_links');
      let parentLinks: Record<string, number> = {};
      if (rawLinks) { try { parentLinks = JSON.parse(rawLinks); } catch {} }

      const parentsWithStudents = await Promise.all((parents || []).map(async (p: any) => {
        const studentId = parentLinks[String(p.id)];
        let studentName = "Unknown";
        if (studentId) {
          const { data: student } = await supabase.from("users").select("display_name, username").eq("id", studentId).single();
          if (student) studentName = student.display_name || student.username;
        }
        return { ...p, studentName };
      }));

      res.json(parentsWithStudents);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch pending parents" });
    }
  });

  // Admin: get ALL parents (approved + pending)
  app.get("/api/admin/all-parents", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { data: parents, error } = await supabase
        .from("users")
        .select("id, display_name, username, email, created_at, school_id, account_approved, role")
        .eq("role", "parent")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);

      // Get linked student info
      const rawLinks = await storage.getSetting('parent_student_links');
      let parentLinks: Record<string, number> = {};
      if (rawLinks) { try { parentLinks = JSON.parse(rawLinks); } catch {} }

      const parentsWithStudents = await Promise.all((parents || []).map(async (p: any) => {
        const studentId = parentLinks[String(p.id)];
        let studentName = "Unknown";
        if (studentId) {
          const { data: student } = await supabase.from("users").select("display_name, username").eq("id", studentId).single();
          if (student) studentName = student.display_name || student.username;
        }
        return { ...p, accountApproved: p.account_approved, displayName: p.display_name, schoolId: p.school_id };
      }));

      res.json(parentsWithStudents);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch parents" });
    }
  });

  // Admin: approve parent account
  app.post("/api/admin/parent-approve/:userId", authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { data: parent } = await supabase.from("users").select("*").eq("id", userId).single();
      const { error } = await supabase.from("users").update({ account_approved: true }).eq("id", userId);
      if (error) throw new Error(error.message);
      const hasEmail = !!parent?.email;
      res.json({ success: true, hasEmail });
      setImmediate(() => {
        try { clearCache('allUsers'); } catch {}
        if (hasEmail) {
          sendEmail(
            parent.email,
            "Your A.R.I.S.E Reader parent account is approved!",
            parentApprovedEmail(parent.display_name || parent.username, parent.username)
          ).catch(() => {});
        }
      });
    } catch (error: any) {
      console.error("[parent-approve] Error:", error);
      res.status(500).json({ message: error.message || "Failed to approve parent" });
    }
  });

  // Admin: reject parent account
  app.delete("/api/admin/parent-reject/:userId", authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { error } = await supabase.from("users").delete().eq("id", userId);
      if (error) throw new Error(error.message);
      // Remove from parent_student_links
      const rawLinks = await storage.getSetting('parent_student_links');
      if (rawLinks) {
        try {
          const parentLinks = JSON.parse(rawLinks);
          delete parentLinks[String(userId)];
          await storage.upsertSetting('parent_student_links', JSON.stringify(parentLinks));
        } catch {}
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to reject parent" });
    }
  });

  // Parent: get their linked student's profile
  app.get("/api/parent/student-profile", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== 'parent') {
        return res.status(403).json({ message: "Only parents can access this endpoint" });
      }
      const rawLinks = await storage.getSetting('parent_student_links');
      if (!rawLinks) return res.status(404).json({ message: "No student linked to your account" });
      const parentLinks = JSON.parse(rawLinks);
      const studentId = parentLinks[String(req.user.id)];
      if (!studentId) return res.status(404).json({ message: "No student linked to your account" });
      const student = await storage.getUser(studentId);
      if (!student) return res.status(404).json({ message: "Student not found" });
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
          teacherId: student.teacherId || null,
        },
        totalPoints,
        quizzesTaken: attempts.length,
        totalBooks: books.length,
        quizResults,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to load student profile" });
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

      // Delete all related records first to avoid foreign key constraint errors
      const tables = [
        { table: "attempts", column: "user_id" },
        { table: "quiz_review_requests", column: "user_id" },
        { table: "messages", column: "sender_id" },
        { table: "messages", column: "recipient_id" },
        { table: "quiz_requests", column: "user_id" },
        { table: "parent_student_links", column: "student_id" },
        { table: "parent_student_links", column: "parent_id" },
        { table: "custom_quizzes", column: "creator_id" },
        { table: "easter_egg_claims", column: "user_id" },
        { table: "eye_gaze_quizzes", column: "creator_id" },
      ];

      for (const { table, column } of tables) {
        try { await supabase.from(table).delete().eq(column, userId); } catch {}
      }

      // Also clean up any settings referencing this user
      try {
        const { data: grades } = await supabase.from("settings").select("key, value").eq("key", "user_grades").single();
        if (grades?.value) {
          const parsed = JSON.parse(grades.value);
          delete parsed[String(userId)];
          await supabase.from("settings").update({ value: JSON.stringify(parsed) }).eq("key", "user_grades");
        }
      } catch {}

      // Finally delete the user
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

  // Seed anime & comic book quizzes
  app.post("/api/admin/seed-anime-comics", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const animeComicBooks = [
        {
          title: "Naruto: The First Test",
          author: "Masashi Kishimoto",
          ageGroup: "6-8",
          description: "A young ninja begins his journey at the ninja academy.",
          questions: [
            { question: "What is Naruto's dream?", options: ["To become Hokage", "To become a chef", "To leave the village", "To become a farmer"], correct: "A" },
            { question: "What animal is Naruto associated with?", options: ["Fox", "Cat", "Wolf", "Eagle"], correct: "A" },
            { question: "What is a ninja school called in Naruto?", options: ["Academy", "Dojo", "Temple", "Castle"], correct: "A" },
            { question: "What color is Naruto's jacket?", options: ["Orange", "Blue", "Green", "Purple"], correct: "A" },
            { question: "What does Naruto say before eating?", options: ["Itadakimasu", "Hello", "Goodbye", "Thanks"], correct: "A" },
            { question: "What is Naruto's signature attack?", options: ["Shadow Clone Jutsu", "Fire Ball", "Water Sword", "Wind Slash"], correct: "A" },
            { question: "Who is Naruto's rival?", options: ["Sasuke", "Sakura", "Kakashi", "Gaara"], correct: "A" },
            { question: "What village is Naruto from?", options: ["Hidden Leaf Village", "Sand Village", "Mist Village", "Cloud Village"], correct: "A" },
            { question: "What is a ninja's headband called?", options: ["Forehead Protector", "Hat", "Helmet", "Crown"], correct: "A" },
            { question: "What does Hokage mean?", options: ["Fire Shadow / Village Leader", "Water King", "Wind Master", "Earth Chief"], correct: "A" },
          ],
        },
        {
          title: "My Hero Academia: The Entrance Exam",
          author: "Kohei Horikoshi",
          ageGroup: "6-8",
          description: "A boy born without powers tries to get into hero school.",
          questions: [
            { question: "What are superpowers called in this world?", options: ["Quirks", "Magic", "Spells", "Talents"], correct: "A" },
            { question: "What is the main character's name?", options: ["Izuku Midoriya", "Bakugo", "Todoroki", "All Might"], correct: "A" },
            { question: "What is Izuku's nickname?", options: ["Deku", "Hero", "Zero", "Might"], correct: "A" },
            { question: "Who is the number one hero?", options: ["All Might", "Endeavor", "Best Jeanist", "Hawks"], correct: "A" },
            { question: "What is the hero school called?", options: ["U.A. High School", "Hero Academy", "Might School", "Plus Ultra"], correct: "A" },
            { question: "What is All Might's catchphrase?", options: ["Plus Ultra", "Go Beyond", "Hero Time", "I am here"], correct: "A" },
            { question: "What color is Izuku's hair?", options: ["Green", "Red", "Blue", "Black"], correct: "A" },
            { question: "What is Bakugo's quirk?", options: ["Explosion", "Fire", "Ice", "Lightning"], correct: "A" },
            { question: "What does Izuku want to become?", options: ["A hero", "A villain", "A teacher", "A doctor"], correct: "A" },
            { question: "What does U.A. stand for in the story?", options: ["A hero academy", "A sports school", "A music school", "A science lab"], correct: "A" },
          ],
        },
        {
          title: "Pokemon Adventures: The Journey Begins",
          author: "Hidenori Kusaka",
          ageGroup: "3-5",
          description: "A trainer sets out to catch Pokemon and earn badges.",
          questions: [
            { question: "What do trainers catch?", options: ["Pokemon", "Bugs", "Fish", "Stars"], correct: "A" },
            { question: "What color is Pikachu?", options: ["Yellow", "Red", "Blue", "Green"], correct: "A" },
            { question: "What does Pikachu say?", options: ["Pika Pika", "Meow", "Woof", "Bzz"], correct: "A" },
            { question: "What do you use to catch a Pokemon?", options: ["A Pokeball", "A net", "A rope", "Your hands"], correct: "A" },
            { question: "What is the starting Pokemon region?", options: ["Kanto", "Johto", "Hoenn", "Sinnoh"], correct: "A" },
            { question: "What type is Pikachu?", options: ["Electric", "Fire", "Water", "Grass"], correct: "A" },
            { question: "What is Ash's goal?", options: ["To be a Pokemon Master", "To be a chef", "To be a pilot", "To be a doctor"], correct: "A" },
            { question: "What does a Pokemon Center do?", options: ["Heals Pokemon", "Sells food", "Trains Pokemon", "Catches Pokemon"], correct: "A" },
            { question: "What are the three starter types?", options: ["Fire, Water, Grass", "Earth, Wind, Fire", "Ice, Rock, Steel", "Dark, Psychic, Ghost"], correct: "A" },
            { question: "What is the Pokemon motto?", options: ["Gotta catch em all", "Be the best", "Train hard", "Catch and release"], correct: "A" },
          ],
        },
        {
          title: "Dragon Ball: The Search for the Dragon Balls",
          author: "Akira Toriyama",
          ageGroup: "6-8",
          description: "A young fighter searches for magical dragon balls.",
          questions: [
            { question: "What is the main character's name?", options: ["Goku", "Vegeta", "Gohan", "Piccolo"], correct: "A" },
            { question: "How many dragon balls are there?", options: ["Seven", "Five", "Three", "Ten"], correct: "A" },
            { question: "What does Goku love to do?", options: ["Eat and fight", "Sleep", "Read", "Swim"], correct: "A" },
            { question: "What does Shenron do?", options: ["Grants wishes", "Breathes fire", "Flies", "Roars"], correct: "A" },
            { question: "What is Goku's signature move?", options: ["Kamehameha", "Fireball", "Lightning Strike", "Ice Beam"], correct: "A" },
            { question: "What does Goku turn into during a full moon?", options: ["A giant ape", "A wolf", "A dragon", "A bird"], correct: "A" },
            { question: "Who is Goku's rival?", options: ["Vegeta", "Krillin", "Yamcha", "Tien"], correct: "A" },
            { question: "What is a Saiyan?", options: ["A warrior race", "A type of food", "A dragon", "A planet"], correct: "A" },
            { question: "What does Goku use to fly?", options: ["Ki energy", "Wings", "A jet pack", "Magic dust"], correct: "A" },
            { question: "What color is Goku's outfit?", options: ["Orange", "Blue", "Green", "Red"], correct: "A" },
          ],
        },
        {
          title: "Avatar: The Last Airbender (Graphic Novel)",
          author: "Gene Luen Yang",
          ageGroup: "9-12",
          description: "The Avatar continues their journey to restore balance to the world.",
          questions: [
            { question: "What are the four nations?", options: ["Water, Earth, Fire, Air", "North, South, East, West", "Fire, Ice, Stone, Wind", "River, Mountain, Sun, Sky"], correct: "A" },
            { question: "Who is the Avatar?", options: ["A person who can bend all four elements", "A king", "A warrior", "A spirit"], correct: "A" },
            { question: "What does Aang have on his body?", options: ["Arrow tattoos", "Dragon scales", "Fire marks", "Water symbols"], correct: "A" },
            { question: "What element does Katara bend?", options: ["Water", "Fire", "Earth", "Air"], correct: "A" },
            { question: "What nation did the Fire Nation attack?", options: ["The Air Nomads", "The Water Tribe", "The Earth Kingdom", "The Sun Warriors"], correct: "A" },
            { question: "What is Aang's animal companion?", options: ["A flying bison named Appa", "A dragon", "A wolf", "An eagle"], correct: "A" },
            { question: "What does the Avatar cycle follow?", options: ["Water, Earth, Fire, Air", "Fire, Air, Water, Earth", "Earth, Water, Air, Fire", "Air, Fire, Earth, Water"], correct: "A" },
            { question: "What is the goal of the Avatar?", options: ["To bring balance to the world", "To conquer nations", "To find treasure", "To win battles"], correct: "A" },
            { question: "Who is Zuko's uncle?", options: ["Iroh", "Ozai", "Azulon", "Sozin"], correct: "A" },
            { question: "What does Zuko eventually do?", options: ["Joins Aang to restore balance", "Becomes Fire Lord immediately", "Leaves the Fire Nation", "Becomes a monk"], correct: "A" },
          ],
        },
        {
          title: "One Piece: The Pirate Journey",
          author: "Eiichiro Oda",
          ageGroup: "6-8",
          description: "A young pirate sets sail to find the greatest treasure.",
          questions: [
            { question: "What is the main character's name?", options: ["Luffy", "Zoro", "Nami", "Sanji"], correct: "A" },
            { question: "What treasure is Luffy searching for?", options: ["One Piece", "The Crown", "The Map", "The Sword"], correct: "A" },
            { question: "What can Luffy do?", options: ["Stretch his body like rubber", "Breathe fire", "Turn invisible", "Fly"], correct: "A" },
            { question: "What is Luffy's dream?", options: ["To become King of the Pirates", "To be rich", "To be a chef", "To be a sailor"], correct: "A" },
            { question: "What is Luffy's ship called?", options: ["The Going Merry", "The Black Pearl", "The Flying Dutchman", "The Nautilus"], correct: "A" },
            { question: "Who is the swordsman in Luffy's crew?", options: ["Zoro", "Sanji", "Usopp", "Chopper"], correct: "A" },
            { question: "What does Luffy love to eat?", options: ["Meat", "Vegetables", "Fish", "Fruit"], correct: "A" },
            { question: "What is the name of Luffy's crew?", options: ["Straw Hat Pirates", "Skull Pirates", "Fire Pirates", "Sea Pirates"], correct: "A" },
            { question: "What ocean did Luffy come from?", options: ["East Blue", "North Blue", "West Blue", "South Blue"], correct: "A" },
            { question: "What does Luffy wear on his head?", options: ["A straw hat", "A helmet", "A crown", "A bandana"], correct: "A" },
          ],
        },
        {
          title: "Spider-Man: The Origin Story",
          author: "Stan Lee",
          ageGroup: "9-12",
          description: "A teenager gains spider powers and becomes a hero.",
          questions: [
            { question: "What is Spider-Man's real name?", options: ["Peter Parker", "Bruce Wayne", "Clark Kent", "Tony Stark"], correct: "A" },
            { question: "How did Spider-Man get his powers?", options: ["A radioactive spider bit him", "He was born with them", "A wizard gave them", "He built a suit"], correct: "A" },
            { question: "What can Spider-Man shoot from his wrists?", options: ["Webs", "Fire", "Water", "Lightning"], correct: "A" },
            { question: "What is Spider-Man's famous saying?", options: ["With great power comes great responsibility", "With great wealth comes great power", "With great speed comes great victory", "With great knowledge comes great wisdom"], correct: "A" },
            { question: "Who is Spider-Man's uncle?", options: ["Uncle Ben", "Uncle Joe", "Uncle Sam", "Uncle Tom"], correct: "A" },
            { question: "Where does Peter Parker live?", options: ["New York City", "Los Angeles", "Chicago", "Miami"], correct: "A" },
            { question: "What color is Spider-Man's suit?", options: ["Red and blue", "Green and yellow", "Black and white", "Purple and gold"], correct: "A" },
            { question: "What can Spider-Man climb?", options: ["Walls", "Trees only", "Mountains only", "Nothing"], correct: "A" },
            { question: "What is Spider-Man's sixth sense called?", options: ["Spider-Sense", "Danger Sense", "Hero Sense", "Web Sense"], correct: "A" },
            { question: "What newspaper does Peter Parker work for?", options: ["The Daily Bugle", "The Daily Planet", "The New York Times", "The Daily News"], correct: "A" },
          ],
        },
        {
          title: "Batman: The Dark Knight Returns",
          author: "Frank Miller",
          ageGroup: "9-12",
          description: "An aging hero comes out of retirement to protect Gotham.",
          questions: [
            { question: "What is Batman's real name?", options: ["Bruce Wayne", "Clark Kent", "Peter Parker", "Tony Stark"], correct: "A" },
            { question: "What city does Batman protect?", options: ["Gotham City", "Metropolis", "New York", "Star City"], correct: "A" },
            { question: "What is Batman's secret base called?", options: ["The Batcave", "The Fortress", "The Lair", "The Cave"], correct: "A" },
            { question: "Who is Batman's loyal butler?", options: ["Alfred", "James", "Thomas", "Henry"], correct: "A" },
            { question: "What signal does the police use to call Batman?", options: ["The Bat-Signal", "A phone call", "A radio", "A flare"], correct: "A" },
            { question: "What is Batman's main weapon against criminals?", options: ["His mind and gadgets", "Guns", "Magic", "Super strength"], correct: "A" },
            { question: "What animal is Batman's symbol?", options: ["A bat", "A cat", "A wolf", "An eagle"], correct: "A" },
            { question: "What color is Batman's suit?", options: ["Black", "Blue", "Red", "Green"], correct: "A" },
            { question: "Who is Batman's famous villain?", options: ["The Joker", "The Riddler", "Two-Face", "All of the above"], correct: "A" },
            { question: "Why is Batman called the Dark Knight?", options: ["He works at night", "He wears gold armor", "He lives in a castle", "He rides a horse"], correct: "A" },
          ],
        },
        {
          title: "Sailor Moon: The Guardian Awakens",
          author: "Naoko Takeuchi",
          ageGroup: "3-5",
          description: "A girl discovers she is a magical guardian who protects the world.",
          questions: [
            { question: "What is Sailor Moon's real name?", options: ["Usagi", "Rei", "Ami", "Mina"], correct: "A" },
            { question: "What animal is Sailor Moon's companion?", options: ["A cat named Luna", "A dog", "A bird", "A rabbit"], correct: "A" },
            { question: "What does Sailor Moon fight for?", options: ["Love and justice", "Money", "Fame", "Power"], correct: "A" },
            { question: "What is Sailor Moon's transformation item?", options: ["A brooch", "A ring", "A necklace", "A wand"], correct: "A" },
            { question: "What color is Sailor Moon's outfit?", options: ["Blue and white", "Red and black", "Green and yellow", "Purple and gold"], correct: "A" },
            { question: "What does Sailor Moon say before transforming?", options: ["Moon Prism Power", "Star Power", "Sun Power", "Earth Power"], correct: "A" },
            { question: "What is Usagi's favorite thing to do?", options: ["Eat and sleep", "Run", "Swim", "Read"], correct: "A" },
            { question: "What is Sailor Moon's weapon?", options: ["A magic wand", "A sword", "A bow", "A shield"], correct: "A" },
            { question: "How many Sailor Guardians are there?", options: ["Five main ones", "Three", "Seven", "Ten"], correct: "A" },
            { question: "What planet is Sailor Moon named after?", options: ["The Moon", "The Sun", "Mars", "Venus"], correct: "A" },
          ],
        },
        {
          title: "Captain Underpants: The First Adventure",
          author: "Dav Pilkey",
          ageGroup: "3-5",
          description: "Two pranksters turn their principal into a superhero.",
          questions: [
            { question: "Who are the two main characters?", options: ["George and Harold", "Tom and Jerry", "Mike and Ike", "Ben and Jerry"], correct: "A" },
            { question: "What do George and Harold love to make?", options: ["Comic books", "Movies", "Music", "Food"], correct: "A" },
            { question: "Who is Captain Underpants?", options: ["Their principal Mr. Krupp", "A teacher", "A police officer", "A firefighter"], correct: "A" },
            { question: "How do they turn Mr. Krupp into Captain Underpants?", options: ["By snapping their fingers", "By clapping", "By whistling", "By stomping"], correct: "A" },
            { question: "What does Captain Underpants wear?", options: ["Underwear and a cape", "A suit", "A costume", "Pajamas"], correct: "A" },
            { question: "What do George and Harold do at school?", options: ["Pull pranks", "Play sports", "Sing songs", "Dance"], correct: "A" },
            { question: "What is Captain Underpants' catchphrase?", options: ["Tra-La-Laaa", "Ta-Da", "Woohoo", "Yippee"], correct: "A" },
            { question: "What is the boys' favorite thing to draw?", options: ["Superheroes", "Animals", "Cars", "Houses"], correct: "A" },
            { question: "What happens when you snap your fingers again?", options: ["He turns back to normal", "He flies", "He disappears", "He shrinks"], correct: "A" },
            { question: "What kind of book is Captain Underpants?", options: ["A comic book", "A textbook", "A cookbook", "A history book"], correct: "A" },
          ],
        },
      ];

      const createdIds: number[] = [];
      for (const bookData of animeComicBooks) {
        // Check if already exists
        const { data: existing } = await supabase.from("books").select("id").ilike("title", bookData.title).limit(1);
        if (existing && existing.length > 0) {
          createdIds.push(existing[0].id);
          continue;
        }
        const book = await storage.createBookWithQuestions({
          title: bookData.title,
          author: bookData.author,
          ageGroup: bookData.ageGroup,
          coverUrl: null,
          description: bookData.description,
          pointsValue: 5,
          readUrl: null,
        }, bookData.questions);
        createdIds.push(book.id);
      }

      // Save anime/comic book IDs to settings for filtering
      await storage.upsertSetting("anime_comic_book_ids", JSON.stringify(createdIds));

      res.json({ success: true, count: createdIds.length, bookIds: createdIds });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

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

  app.delete("/api/custom-quizzes/:id", authMiddleware, async (req: any, res) => {
    try {
      const quizId = parseInt(req.params.id);
      const isAdmin = req.user.isAdmin || req.user.role === 'admin';
      await storage.deleteCustomEyeGazeQuiz(quizId, req.user.id, isAdmin);
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

  // ===== EASTER EGGS =====

  // Admin: Get easter egg settings + claims
  app.get("/api/admin/easter-eggs", authMiddleware, async (req: any, res) => {
    try {
      const { data: settings } = await supabase.from('easter_eggs').select('*').limit(1).single();
      
      let claimsWithUsers: any[] = [];
      const { data: claims } = await supabase
        .from('easter_egg_claims')
        .select('id, user_id, points_awarded, claimed_at')
        .order('claimed_at', { ascending: false });

      if (claims && claims.length > 0) {
        const userIds = claims.map((c: any) => c.user_id);
        const { data: users } = await supabase
          .from('users')
          .select('id, username, display_name, total_points')
          .in('id', userIds);
        const userMap: Record<number, any> = {};
        (users || []).forEach((u: any) => { userMap[u.id] = u; });
        claimsWithUsers = claims.map((c: any) => ({
          ...c,
          username: userMap[c.user_id]?.username || 'Unknown',
          displayName: userMap[c.user_id]?.display_name || 'Unknown',
          totalPoints: userMap[c.user_id]?.total_points || 0,
        }));
      }

      res.json({
        active: settings?.active || false,
        totalEggs: settings?.total_eggs || 0,
        remainingEggs: settings?.remaining_eggs || 0,
        pointsPerEgg: settings?.points_per_egg || 2,
        claims: claimsWithUsers,
      });
    } catch (e) {
      res.status(500).json({ message: 'Failed to fetch easter egg data' });
    }
  });

  // Admin: Set/update easter egg campaign
  app.post("/api/admin/easter-eggs", authMiddleware, async (req: any, res) => {
    if (!req.user?.isAdmin) return res.status(403).json({ message: 'Admin only' });
    try {
      const { totalEggs, active } = req.body;
      if (typeof totalEggs !== 'number' || totalEggs < 0) {
        return res.status(400).json({ message: 'Invalid egg count' });
      }

      // Get current settings
      const { data: existing } = await supabase.from('easter_eggs').select('*').limit(1).single();

      if (existing) {
        // Update existing - reset remaining to new total if increasing or resetting
        const newRemaining = totalEggs > (existing.remaining_eggs || 0) ? totalEggs : (active ? existing.remaining_eggs : totalEggs);
        await supabase
          .from('easter_eggs')
          .update({
            total_eggs: totalEggs,
            remaining_eggs: active ? totalEggs : existing.remaining_eggs,
            active: active,
          })
          .eq('id', existing.id);

        // If activating fresh, clear old claims
        if (active && totalEggs > 0) {
          await supabase.from('easter_egg_claims').delete().neq('id', 0);
        }
      } else {
        await supabase.from('easter_eggs').insert({
          active: active,
          total_eggs: totalEggs,
          remaining_eggs: totalEggs,
          points_per_egg: 2,
        });
      }

      res.json({ success: true, message: `Easter eggs ${active ? 'activated' : 'updated'} with ${totalEggs} eggs` });
    } catch (e) {
      res.status(500).json({ message: 'Failed to update easter eggs' });
    }
  });

  // Student: Check if easter eggs are active
  app.get("/api/easter-eggs/status", authMiddleware, async (req: any, res) => {
    try {
      // Also check tutorial status in the same call to reduce API round-trips
      const tutorialShownUsers = await storage.getSetting('tutorial_shown_users');
      let tutorialShown: Record<string, boolean> = {};
      if (tutorialShownUsers) { try { tutorialShown = JSON.parse(tutorialShownUsers); } catch {} }

      const { data: settings } = await supabase.from('easter_eggs').select('*').limit(1).single();

      if (!settings?.active || settings.remaining_eggs <= 0) {
        return res.json({ active: false, remaining: 0, tutorialShown: !!tutorialShown[String(req.user.id)] });
      }

      // Check if this user already claimed
      const { data: claim } = await supabase
        .from('easter_egg_claims')
        .select('id')
        .eq('user_id', req.user.id)
        .maybeSingle();

      if (claim) {
        return res.json({ active: true, remaining: settings.remaining_eggs, alreadyClaimed: true, tutorialShown: !!tutorialShown[String(req.user.id)] });
      }

      res.json({ active: true, remaining: settings.remaining_eggs, alreadyClaimed: false, tutorialShown: !!tutorialShown[String(req.user.id)] });
    } catch (e) {
      res.json({ active: false, remaining: 0, tutorialShown: false });
    }
  });

  // Student: Dismiss tutorial (server-side, persists across devices)
  app.post("/api/tutorial/dismiss", authMiddleware, async (req: any, res) => {
    try {
      const raw = await storage.getSetting('tutorial_shown_users');
      let shown: Record<string, boolean> = {};
      if (raw) { try { shown = JSON.parse(raw); } catch {} }
      shown[String(req.user.id)] = true;
      await storage.upsertSetting('tutorial_shown_users', JSON.stringify(shown));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ message: 'Failed to dismiss tutorial' });
    }
  });

  // Admin: Reset tutorial for all students (so they see the new GuidedTour)
  app.post("/api/admin/reset-tutorial", authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      await storage.upsertSetting('tutorial_shown_users', '{}');
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ message: 'Failed to reset tutorial' });
    }
  });

  // Student: Claim an easter egg
  app.post("/api/easter-eggs/claim", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.isAdmin || req.user.role === 'teacher') {
        return res.status(403).json({ message: 'Teachers and admins cannot claim easter eggs' });
      }

      // Get settings
      const { data: settings } = await supabase.from('easter_eggs').select('*').limit(1).single();

      if (!settings?.active || settings.remaining_eggs <= 0) {
        return res.status(400).json({ message: 'No easter eggs available' });
      }

      // Check if already claimed (unique constraint on user_id)
      const { data: existingClaim } = await supabase
        .from('easter_egg_claims')
        .select('id')
        .eq('user_id', req.user.id)
        .maybeSingle();

      if (existingClaim) {
        return res.status(400).json({ message: 'You already claimed an easter egg!' });
      }

      // Atomic: insert claim with unique user_id constraint
      const { error: claimError } = await supabase
        .from('easter_egg_claims')
        .insert({
          user_id: req.user.id,
          points_awarded: settings.points_per_egg,
        });

      if (claimError) {
        // Unique constraint violation = already claimed
        if (claimError.code === '23505') {
          return res.status(400).json({ message: 'You already claimed an easter egg!' });
        }
        throw claimError;
      }

      // Decrement remaining count
      const newRemaining = settings.remaining_eggs - 1;
      await supabase.from('easter_eggs').update({ remaining_eggs: newRemaining }).eq('id', settings.id);

      // Add points to user's total_points
      const { data: userData } = await supabase.from('users').select('total_points').eq('id', req.user.id).single();
      const currentPoints = userData?.total_points || 0;
      await supabase.from('users').update({ total_points: currentPoints + settings.points_per_egg }).eq('id', req.user.id);

      // Invalidate leaderboard cache so points show immediately
      clearCache('leaderboard');
      clearCache('allUsers');
      clearCache('monthlyLeaderboard');
      // Clear this user's session cache so /api/me returns fresh points
      clearCache('session_');

      res.json({
        success: true,
        points: settings.points_per_egg,
        message: `You found an easter egg! +${settings.points_per_egg} points!`,
      });
    } catch (e) {
      res.status(500).json({ message: 'Failed to claim easter egg' });
    }
  });

  // Auto-seed anime/comic books on startup if not already present
  try {
    const existing = await storage.getSetting("anime_comic_book_ids");
    if (!existing) {
      console.log("Seeding anime & comic book quizzes...");
      const animeComicBooks = [
        {
          title: "Naruto: The First Test",
          author: "Masashi Kishimoto",
          ageGroup: "6-8",
          description: "A young ninja begins his journey at the ninja academy.",
          questions: [
            { question: "What is Naruto's dream?", options: ["To become Hokage", "To become a chef", "To leave the village", "To become a farmer"], correct: "A" },
            { question: "What animal is Naruto associated with?", options: ["Fox", "Cat", "Wolf", "Eagle"], correct: "A" },
            { question: "What is a ninja school called in Naruto?", options: ["Academy", "Dojo", "Temple", "Castle"], correct: "A" },
            { question: "What color is Naruto's jacket?", options: ["Orange", "Blue", "Green", "Purple"], correct: "A" },
            { question: "What does Naruto say before eating?", options: ["Itadakimasu", "Hello", "Goodbye", "Thanks"], correct: "A" },
            { question: "What is Naruto's signature attack?", options: ["Shadow Clone Jutsu", "Fire Ball", "Water Sword", "Wind Slash"], correct: "A" },
            { question: "Who is Naruto's rival?", options: ["Sasuke", "Sakura", "Kakashi", "Gaara"], correct: "A" },
            { question: "What village is Naruto from?", options: ["Hidden Leaf Village", "Sand Village", "Mist Village", "Cloud Village"], correct: "A" },
            { question: "What is a ninja's headband called?", options: ["Forehead Protector", "Hat", "Helmet", "Crown"], correct: "A" },
            { question: "What does Hokage mean?", options: ["Fire Shadow / Village Leader", "Water King", "Wind Master", "Earth Chief"], correct: "A" },
          ],
        },
        {
          title: "My Hero Academia: The Entrance Exam",
          author: "Kohei Horikoshi",
          ageGroup: "6-8",
          description: "A boy born without powers tries to get into hero school.",
          questions: [
            { question: "What are superpowers called in this world?", options: ["Quirks", "Magic", "Spells", "Talents"], correct: "A" },
            { question: "What is the main character's name?", options: ["Izuku Midoriya", "Bakugo", "Todoroki", "All Might"], correct: "A" },
            { question: "What is Izuku's nickname?", options: ["Deku", "Hero", "Zero", "Might"], correct: "A" },
            { question: "Who is the number one hero?", options: ["All Might", "Endeavor", "Best Jeanist", "Hawks"], correct: "A" },
            { question: "What is the hero school called?", options: ["U.A. High School", "Hero Academy", "Might School", "Plus Ultra"], correct: "A" },
            { question: "What is All Might's catchphrase?", options: ["Plus Ultra", "Go Beyond", "Hero Time", "I am here"], correct: "A" },
            { question: "What color is Izuku's hair?", options: ["Green", "Red", "Blue", "Black"], correct: "A" },
            { question: "What is Bakugo's quirk?", options: ["Explosion", "Fire", "Ice", "Lightning"], correct: "A" },
            { question: "What does Izuku want to become?", options: ["A hero", "A villain", "A teacher", "A doctor"], correct: "A" },
            { question: "What does U.A. stand for in the story?", options: ["A hero academy", "A sports school", "A music school", "A science lab"], correct: "A" },
          ],
        },
        {
          title: "Pokemon Adventures: The Journey Begins",
          author: "Hidenori Kusaka",
          ageGroup: "3-5",
          description: "A trainer sets out to catch Pokemon and earn badges.",
          questions: [
            { question: "What do trainers catch?", options: ["Pokemon", "Bugs", "Fish", "Stars"], correct: "A" },
            { question: "What color is Pikachu?", options: ["Yellow", "Red", "Blue", "Green"], correct: "A" },
            { question: "What does Pikachu say?", options: ["Pika Pika", "Meow", "Woof", "Bzz"], correct: "A" },
            { question: "What do you use to catch a Pokemon?", options: ["A Pokeball", "A net", "A rope", "Your hands"], correct: "A" },
            { question: "What is the starting Pokemon region?", options: ["Kanto", "Johto", "Hoenn", "Sinnoh"], correct: "A" },
            { question: "What type is Pikachu?", options: ["Electric", "Fire", "Water", "Grass"], correct: "A" },
            { question: "What is Ash's goal?", options: ["To be a Pokemon Master", "To be a chef", "To be a pilot", "To be a doctor"], correct: "A" },
            { question: "What does a Pokemon Center do?", options: ["Heals Pokemon", "Sells food", "Trains Pokemon", "Catches Pokemon"], correct: "A" },
            { question: "What are the three starter types?", options: ["Fire, Water, Grass", "Earth, Wind, Fire", "Ice, Rock, Steel", "Dark, Psychic, Ghost"], correct: "A" },
            { question: "What is the Pokemon motto?", options: ["Gotta catch em all", "Be the best", "Train hard", "Catch and release"], correct: "A" },
          ],
        },
        {
          title: "Dragon Ball: The Search for the Dragon Balls",
          author: "Akira Toriyama",
          ageGroup: "6-8",
          description: "A young fighter searches for magical dragon balls.",
          questions: [
            { question: "What is the main character's name?", options: ["Goku", "Vegeta", "Gohan", "Piccolo"], correct: "A" },
            { question: "How many dragon balls are there?", options: ["Seven", "Five", "Three", "Ten"], correct: "A" },
            { question: "What does Goku love to do?", options: ["Eat and fight", "Sleep", "Read", "Swim"], correct: "A" },
            { question: "What does Shenron do?", options: ["Grants wishes", "Breathes fire", "Flies", "Roars"], correct: "A" },
            { question: "What is Goku's signature move?", options: ["Kamehameha", "Fireball", "Lightning Strike", "Ice Beam"], correct: "A" },
            { question: "What does Goku turn into during a full moon?", options: ["A giant ape", "A wolf", "A dragon", "A bird"], correct: "A" },
            { question: "Who is Goku's rival?", options: ["Vegeta", "Krillin", "Yamcha", "Tien"], correct: "A" },
            { question: "What is a Saiyan?", options: ["A warrior race", "A type of food", "A dragon", "A planet"], correct: "A" },
            { question: "What does Goku use to fly?", options: ["Ki energy", "Wings", "A jet pack", "Magic dust"], correct: "A" },
            { question: "What color is Goku's outfit?", options: ["Orange", "Blue", "Green", "Red"], correct: "A" },
          ],
        },
        {
          title: "Avatar: The Last Airbender (Graphic Novel)",
          author: "Gene Luen Yang",
          ageGroup: "9-12",
          description: "The Avatar continues their journey to restore balance to the world.",
          questions: [
            { question: "What are the four nations?", options: ["Water, Earth, Fire, Air", "North, South, East, West", "Fire, Ice, Stone, Wind", "River, Mountain, Sun, Sky"], correct: "A" },
            { question: "Who is the Avatar?", options: ["A person who can bend all four elements", "A king", "A warrior", "A spirit"], correct: "A" },
            { question: "What does Aang have on his body?", options: ["Arrow tattoos", "Dragon scales", "Fire marks", "Water symbols"], correct: "A" },
            { question: "What element does Katara bend?", options: ["Water", "Fire", "Earth", "Air"], correct: "A" },
            { question: "What nation did the Fire Nation attack?", options: ["The Air Nomads", "The Water Tribe", "The Earth Kingdom", "The Sun Warriors"], correct: "A" },
            { question: "What is Aang's animal companion?", options: ["A flying bison named Appa", "A dragon", "A wolf", "An eagle"], correct: "A" },
            { question: "What does the Avatar cycle follow?", options: ["Water, Earth, Fire, Air", "Fire, Air, Water, Earth", "Earth, Water, Air, Fire", "Air, Fire, Earth, Water"], correct: "A" },
            { question: "What is the goal of the Avatar?", options: ["To bring balance to the world", "To conquer nations", "To find treasure", "To win battles"], correct: "A" },
            { question: "Who is Zuko's uncle?", options: ["Iroh", "Ozai", "Azulon", "Sozin"], correct: "A" },
            { question: "What does Zuko eventually do?", options: ["Joins Aang to restore balance", "Becomes Fire Lord immediately", "Leaves the Fire Nation", "Becomes a monk"], correct: "A" },
          ],
        },
        {
          title: "One Piece: The Pirate Journey",
          author: "Eiichiro Oda",
          ageGroup: "6-8",
          description: "A young pirate sets sail to find the greatest treasure.",
          questions: [
            { question: "What is the main character's name?", options: ["Luffy", "Zoro", "Nami", "Sanji"], correct: "A" },
            { question: "What treasure is Luffy searching for?", options: ["One Piece", "The Crown", "The Map", "The Sword"], correct: "A" },
            { question: "What can Luffy do?", options: ["Stretch his body like rubber", "Breathe fire", "Turn invisible", "Fly"], correct: "A" },
            { question: "What is Luffy's dream?", options: ["To become King of the Pirates", "To be rich", "To be a chef", "To be a sailor"], correct: "A" },
            { question: "What is Luffy's ship called?", options: ["The Going Merry", "The Black Pearl", "The Flying Dutchman", "The Nautilus"], correct: "A" },
            { question: "Who is the swordsman in Luffy's crew?", options: ["Zoro", "Sanji", "Usopp", "Chopper"], correct: "A" },
            { question: "What does Luffy love to eat?", options: ["Meat", "Vegetables", "Fish", "Fruit"], correct: "A" },
            { question: "What is the name of Luffy's crew?", options: ["Straw Hat Pirates", "Skull Pirates", "Fire Pirates", "Sea Pirates"], correct: "A" },
            { question: "What ocean did Luffy come from?", options: ["East Blue", "North Blue", "West Blue", "South Blue"], correct: "A" },
            { question: "What does Luffy wear on his head?", options: ["A straw hat", "A helmet", "A crown", "A bandana"], correct: "A" },
          ],
        },
        {
          title: "Spider-Man: The Origin Story",
          author: "Stan Lee",
          ageGroup: "9-12",
          description: "A teenager gains spider powers and becomes a hero.",
          questions: [
            { question: "What is Spider-Man's real name?", options: ["Peter Parker", "Bruce Wayne", "Clark Kent", "Tony Stark"], correct: "A" },
            { question: "How did Spider-Man get his powers?", options: ["A radioactive spider bit him", "He was born with them", "A wizard gave them", "He built a suit"], correct: "A" },
            { question: "What can Spider-Man shoot from his wrists?", options: ["Webs", "Fire", "Water", "Lightning"], correct: "A" },
            { question: "What is Spider-Man's famous saying?", options: ["With great power comes great responsibility", "With great wealth comes great power", "With great speed comes great victory", "With great knowledge comes great wisdom"], correct: "A" },
            { question: "Who is Spider-Man's uncle?", options: ["Uncle Ben", "Uncle Joe", "Uncle Sam", "Uncle Tom"], correct: "A" },
            { question: "Where does Peter Parker live?", options: ["New York City", "Los Angeles", "Chicago", "Miami"], correct: "A" },
            { question: "What color is Spider-Man's suit?", options: ["Red and blue", "Green and yellow", "Black and white", "Purple and gold"], correct: "A" },
            { question: "What can Spider-Man climb?", options: ["Walls", "Trees only", "Mountains only", "Nothing"], correct: "A" },
            { question: "What is Spider-Man's sixth sense called?", options: ["Spider-Sense", "Danger Sense", "Hero Sense", "Web Sense"], correct: "A" },
            { question: "What newspaper does Peter Parker work for?", options: ["The Daily Bugle", "The Daily Planet", "The New York Times", "The Daily News"], correct: "A" },
          ],
        },
        {
          title: "Batman: The Dark Knight Returns",
          author: "Frank Miller",
          ageGroup: "9-12",
          description: "An aging hero comes out of retirement to protect Gotham.",
          questions: [
            { question: "What is Batman's real name?", options: ["Bruce Wayne", "Clark Kent", "Peter Parker", "Tony Stark"], correct: "A" },
            { question: "What city does Batman protect?", options: ["Gotham City", "Metropolis", "New York", "Star City"], correct: "A" },
            { question: "What is Batman's secret base called?", options: ["The Batcave", "The Fortress", "The Lair", "The Cave"], correct: "A" },
            { question: "Who is Batman's loyal butler?", options: ["Alfred", "James", "Thomas", "Henry"], correct: "A" },
            { question: "What signal does the police use to call Batman?", options: ["The Bat-Signal", "A phone call", "A radio", "A flare"], correct: "A" },
            { question: "What is Batman's main weapon against criminals?", options: ["His mind and gadgets", "Guns", "Magic", "Super strength"], correct: "A" },
            { question: "What animal is Batman's symbol?", options: ["A bat", "A cat", "A wolf", "An eagle"], correct: "A" },
            { question: "What color is Batman's suit?", options: ["Black", "Blue", "Red", "Green"], correct: "A" },
            { question: "Who is Batman's famous villain?", options: ["The Joker", "The Riddler", "Two-Face", "All of the above"], correct: "A" },
            { question: "Why is Batman called the Dark Knight?", options: ["He works at night", "He wears gold armor", "He lives in a castle", "He rides a horse"], correct: "A" },
          ],
        },
        {
          title: "Sailor Moon: The Guardian Awakens",
          author: "Naoko Takeuchi",
          ageGroup: "3-5",
          description: "A girl discovers she is a magical guardian who protects the world.",
          questions: [
            { question: "What is Sailor Moon's real name?", options: ["Usagi", "Rei", "Ami", "Mina"], correct: "A" },
            { question: "What animal is Sailor Moon's companion?", options: ["A cat named Luna", "A dog", "A bird", "A rabbit"], correct: "A" },
            { question: "What does Sailor Moon fight for?", options: ["Love and justice", "Money", "Fame", "Power"], correct: "A" },
            { question: "What is Sailor Moon's transformation item?", options: ["A brooch", "A ring", "A necklace", "A wand"], correct: "A" },
            { question: "What color is Sailor Moon's outfit?", options: ["Blue and white", "Red and black", "Green and yellow", "Purple and gold"], correct: "A" },
            { question: "What does Sailor Moon say before transforming?", options: ["Moon Prism Power", "Star Power", "Sun Power", "Earth Power"], correct: "A" },
            { question: "What is Usagi's favorite thing to do?", options: ["Eat and sleep", "Run", "Swim", "Read"], correct: "A" },
            { question: "What is Sailor Moon's weapon?", options: ["A magic wand", "A sword", "A bow", "A shield"], correct: "A" },
            { question: "How many Sailor Guardians are there?", options: ["Five main ones", "Three", "Seven", "Ten"], correct: "A" },
            { question: "What planet is Sailor Moon named after?", options: ["The Moon", "The Sun", "Mars", "Venus"], correct: "A" },
          ],
        },
        {
          title: "Captain Underpants: The First Adventure",
          author: "Dav Pilkey",
          ageGroup: "3-5",
          description: "Two pranksters turn their principal into a superhero.",
          questions: [
            { question: "Who are the two main characters?", options: ["George and Harold", "Tom and Jerry", "Mike and Ike", "Ben and Jerry"], correct: "A" },
            { question: "What do George and Harold love to make?", options: ["Comic books", "Movies", "Music", "Food"], correct: "A" },
            { question: "Who is Captain Underpants?", options: ["Their principal Mr. Krupp", "A teacher", "A police officer", "A firefighter"], correct: "A" },
            { question: "How do they turn Mr. Krupp into Captain Underpants?", options: ["By snapping their fingers", "By clapping", "By whistling", "By stomping"], correct: "A" },
            { question: "What does Captain Underpants wear?", options: ["Underwear and a cape", "A suit", "A costume", "Pajamas"], correct: "A" },
            { question: "What do George and Harold do at school?", options: ["Pull pranks", "Play sports", "Sing songs", "Dance"], correct: "A" },
            { question: "What is Captain Underpants' catchphrase?", options: ["Tra-La-Laaa", "Ta-Da", "Woohoo", "Yippee"], correct: "A" },
            { question: "What is the boys' favorite thing to draw?", options: ["Superheroes", "Animals", "Cars", "Houses"], correct: "A" },
            { question: "What happens when you snap your fingers again?", options: ["He turns back to normal", "He flies", "He disappears", "He shrinks"], correct: "A" },
            { question: "What kind of book is Captain Underpants?", options: ["A comic book", "A textbook", "A cookbook", "A history book"], correct: "A" },
          ],
        },
      ];

      const createdIds: number[] = [];
      for (const bookData of animeComicBooks) {
        const { data: existingBook } = await supabase.from("books").select("id").ilike("title", bookData.title).limit(1);
        if (existingBook && existingBook.length > 0) {
          createdIds.push(existingBook[0].id);
          continue;
        }
        const book = await storage.createBookWithQuestions({
          title: bookData.title,
          author: bookData.author,
          ageGroup: bookData.ageGroup,
          coverUrl: null,
          description: bookData.description,
          pointsValue: 5,
          readUrl: null,
        }, bookData.questions);
        createdIds.push(book.id);
      }
      await storage.upsertSetting("anime_comic_book_ids", JSON.stringify(createdIds));
      console.log(`Seeded ${createdIds.length} anime & comic book quizzes.`);

      // Auto-fetch covers for the newly seeded books
      for (const bookId of createdIds) {
        const book = await storage.getBook(bookId);
        if (book && !book.coverUrl) {
          const cleanTitle = (book.title || "").replace(/[:\-]/g, " ").trim();
          const cleanAuthor = (book.author || "").trim();
          let coverUrl: string | null = null;
          try {
            const coverRes = await fetch(
              `https://covers.openlibrary.org/b/title/${encodeURIComponent(cleanTitle)}?format=json&limit=1`,
              { signal: AbortSignal.timeout(5000) }
            );
            if (coverRes.ok) {
              const coverData = await coverRes.json() as any;
              if (coverData.covers && coverData.covers.length > 0) {
                coverUrl = `https://covers.openlibrary.org/b/id/${coverData.covers[0].id}-L.jpg`;
              }
            }
          } catch {}
          if (!coverUrl) {
            try {
              const searchRes = await fetch(
                `https://openlibrary.org/search.json?title=${encodeURIComponent(cleanTitle)}&author=${encodeURIComponent(cleanAuthor)}&limit=1`,
                { signal: AbortSignal.timeout(5000) }
              );
              if (searchRes.ok) {
                const searchData = await searchRes.json() as any;
                if (searchData.docs && searchData.docs.length > 0 && searchData.docs[0].cover_i) {
                  coverUrl = `https://covers.openlibrary.org/b/id/${searchData.docs[0].cover_i}-L.jpg`;
                }
              }
            } catch {}
          }
          if (coverUrl) {
            await storage.updateBookCover(bookId, coverUrl);
            console.log(`Fetched cover for: ${book.title}`);
          } else {
            console.log(`No cover found for: ${book.title}`);
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to seed anime/comic books:", (e as Error).message);
  }

  // Update anime/comic book covers with real cover art
  try {
    const animeCovers: Record<string, string> = {
      "Naruto: The First Test": "https://upload.wikimedia.org/wikipedia/en/9/94/NarutoCoverTankobon1.jpg",
      "My Hero Academia: The Entrance Exam": "https://upload.wikimedia.org/wikipedia/en/5/5a/Boku_no_Hero_Academia_Volume_1.png",
      "Pokemon Adventures: The Journey Begins": "https://upload.wikimedia.org/wikipedia/en/1/1b/Wikipokespe_poster.jpg",
      "Dragon Ball: The Search for the Dragon Balls": "https://covers.openlibrary.org/b/id/1787375-L.jpg",
      "Avatar: The Last Airbender (Graphic Novel)": "https://upload.wikimedia.org/wikipedia/en/2/2a/The_Promise_Hardcover_Collection.jpg",
      "One Piece: The Pirate Journey": "https://upload.wikimedia.org/wikipedia/en/9/90/One_Piece%2C_Volume_61_Cover_%28Japanese%29.jpg",
      "Spider-Man: The Origin Story": "https://upload.wikimedia.org/wikipedia/en/2/21/Web_of_Spider-Man_Vol_1_129-1.png",
      "Batman: The Dark Knight Returns": "https://upload.wikimedia.org/wikipedia/en/b/b2/Batman_The_Dark_Knight_Returns_1_%28February_1986%29.jpg",
      "Sailor Moon: The Guardian Awakens": "https://upload.wikimedia.org/wikipedia/en/e/e5/SMVolume1.jpg",
      "Captain Underpants: The First Adventure": "https://upload.wikimedia.org/wikipedia/en/c/ca/Cunderpants.png",
    };
    const allBooks = await storage.getAllBooks();
    for (const book of allBooks) {
      const cover = animeCovers[book.title];
      if (cover && book.coverUrl !== cover) {
        await storage.updateBookCover(book.id, cover);
        console.log(`Updated cover for: ${book.title}`);
      }
    }
  } catch (e) {
    console.error("Failed to update anime/comic covers:", (e as Error).message);
  }

  // Seed "What You're Reading in Class" books (Shadowshaper + The Outsiders)
  try {
    const existingClassReading = await storage.getSetting("class_reading_book_ids");
    if (!existingClassReading) {
      console.log("Seeding class reading books (Shadowshaper, The Outsiders)...");
      const classBooks = [
        {
          title: "Shadowshaper",
          author: "Daniel Jose Older",
          ageGroup: "9-12",
          description: "A Brooklyn teen discovers she can infuse ancestral spirits into art.",
          questions: [
            { question: "What is the main character's name?", options: ["Sierra", "Maria", "Lucia", "Rosa"], correct: "A" },
            { question: "What city does Shadowshaper take place in?", options: ["Brooklyn", "Manhattan", "Queens", "Bronx"], correct: "A" },
            { question: "What can Sierra do with art?", options: ["Infuse ancestral spirits into it", "Sell it for money", "Make it move", "Paint perfectly"], correct: "A" },
            { question: "What is Sierra's grandfather known as?", options: ["Lazaro", "Carlos", "Manny", "Tomas"], correct: "A" },
            { question: "What does Shadowshaping connect Sierra to?", options: ["Her ancestors", "Her teachers", "Strangers", "Animals"], correct: "A" },
            { question: "What danger threatens the shadowshapers?", options: ["A corrupt spirit named Stroke", "A fire", "A flood", "A drought"], correct: "A" },
            { question: "What does Sierra use to fight back?", options: ["Murals and art", "Guns", "Magic wands", "Technology"], correct: "A" },
            { question: "What culture is Shadowshaping rooted in?", options: ["Afro-Caribbean", "European", "Asian", "Native American"], correct: "A" },
            { question: "Who helps Sierra understand her powers?", options: ["Robbie", "James", "David", "Michael"], correct: "A" },
            { question: "What theme is central to Shadowshaper?", options: ["The power of community and heritage", "The danger of technology", "The importance of sports", "The value of money"], correct: "A" },
          ],
        },
        {
          title: "The Outsiders",
          author: "S.E. Hinton",
          ageGroup: "6-8",
          description: "Rival teen groups, the Greasers and Socs, clash in 1960s Oklahoma.",
          questions: [
            { question: "Who is the narrator of The Outsiders?", options: ["Ponyboy Curtis", "Johnny Cade", "Darry Curtis", "Two-Bit"], correct: "A" },
            { question: "What are the two rival groups called?", options: ["Greasers and Socs", "Sharks and Jets", "Bloods and Crips", "Bears and Wolves"], correct: "A" },
            { question: "What does Ponyboy's name come from?", options: ["A horse his father owned", "A comic book", "A movie", "A song"], correct: "A" },
            { question: "Who is Ponyboy's oldest brother?", options: ["Darry", "Sodapop", "Dally", "Steve"], correct: "A" },
            { question: "What poem does Ponyboy recite?", options: ["Nothing Gold Can Stay by Robert Frost", "The Raven by Poe", "Ozymandias by Shelley", "The Road Not Taken by Frost"], correct: "A" },
            { question: "What happens to Johnny in the church fire?", options: ["He is badly burned saving children", "He escapes unharmed", "He breaks his leg", "He loses his sight"], correct: "A" },
            { question: "What does Johnny tell Ponyboy before he dies?", options: ["Stay gold", "Run away", "Get revenge", "Forget me"], correct: "A" },
            { question: "What state does The Outsiders take place in?", options: ["Oklahoma", "Texas", "California", "New York"], correct: "A" },
            { question: "Who is the tough Greaser from New York?", options: ["Dallas Winston", "Keith Matthews", "Steve Randle", "Tim Shepard"], correct: "A" },
            { question: "What does Ponyboy do at the end of the story?", options: ["Writes his English essay about the events", "Joins the Socs", "Moves away", "Becomes a Soc"], correct: "A" },
          ],
        },
      ];

      const classBookIds: number[] = [];
      for (const bookData of classBooks) {
        const { data: existing } = await supabase.from("books").select("id").ilike("title", bookData.title).limit(1);
        if (existing && existing.length > 0) {
          classBookIds.push(existing[0].id);
          continue;
        }
        // Fetch cover from Open Library
        let coverUrl: string | null = null;
        try {
          const coverRes = await fetch(
            `https://covers.openlibrary.org/b/title/${encodeURIComponent(bookData.title)}?format=json&limit=1`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (coverRes.ok) {
            const coverData = await coverRes.json() as any;
            if (coverData.covers && coverData.covers.length > 0) {
              coverUrl = `https://covers.openlibrary.org/b/id/${coverData.covers[0].id}-L.jpg`;
            }
          }
        } catch {}
        if (!coverUrl) {
          try {
            const searchRes = await fetch(
              `https://openlibrary.org/search.json?title=${encodeURIComponent(bookData.title)}&author=${encodeURIComponent(bookData.author)}&limit=1`,
              { signal: AbortSignal.timeout(5000) }
            );
            if (searchRes.ok) {
              const searchData = await searchRes.json() as any;
              if (searchData.docs && searchData.docs.length > 0 && searchData.docs[0].cover_i) {
                coverUrl = `https://covers.openlibrary.org/b/id/${searchData.docs[0].cover_i}-L.jpg`;
              }
            }
          } catch {}
        }
        const book = await storage.createBookWithQuestions({
          title: bookData.title,
          author: bookData.author,
          ageGroup: bookData.ageGroup,
          coverUrl,
          description: bookData.description,
          pointsValue: 10,
          readUrl: null,
        }, bookData.questions);
        classBookIds.push(book.id);
      }
      await storage.upsertSetting("class_reading_book_ids", JSON.stringify(classBookIds));
      console.log(`Seeded ${classBookIds.length} class reading book quizzes.`);
    }
  } catch (e) {
    console.error("Failed to seed class reading books:", (e as Error).message);
  }

  // Auto-fetch covers for any books missing them (especially anime/comic books)
  try {
    const allBooks = await storage.getAllBooks();
    const missingCovers = allBooks.filter(b => !b.coverUrl);
    if (missingCovers.length > 0) {
      console.log(`Fetching covers for ${missingCovers.length} books missing covers...`);
      let fetched = 0;
      for (const book of missingCovers) {
        const cleanTitle = (book.title || "").replace(/[:\-]/g, " ").trim();
        const cleanAuthor = (book.author || "").trim();
        let coverUrl: string | null = null;
        // Method 1: covers by title
        try {
          const coverRes = await fetch(
            `https://covers.openlibrary.org/b/title/${encodeURIComponent(cleanTitle)}?format=json&limit=1`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (coverRes.ok) {
            const coverData = await coverRes.json() as any;
            if (coverData.covers && coverData.covers.length > 0) {
              coverUrl = `https://covers.openlibrary.org/b/id/${coverData.covers[0].id}-L.jpg`;
            }
          }
        } catch {}
        // Method 2: search by title + author
        if (!coverUrl) {
          try {
            const searchRes = await fetch(
              `https://openlibrary.org/search.json?title=${encodeURIComponent(cleanTitle)}&author=${encodeURIComponent(cleanAuthor)}&limit=1`,
              { signal: AbortSignal.timeout(5000) }
            );
            if (searchRes.ok) {
              const searchData = await searchRes.json() as any;
              if (searchData.docs && searchData.docs.length > 0 && searchData.docs[0].cover_i) {
                coverUrl = `https://covers.openlibrary.org/b/id/${searchData.docs[0].cover_i}-L.jpg`;
              }
            }
          } catch {}
        }
        // Method 3: search by title only
        if (!coverUrl) {
          try {
            const searchRes2 = await fetch(
              `https://openlibrary.org/search.json?title=${encodeURIComponent(cleanTitle)}&limit=1`,
              { signal: AbortSignal.timeout(5000) }
            );
            if (searchRes2.ok) {
              const searchData2 = await searchRes2.json() as any;
              if (searchData2.docs && searchData2.docs.length > 0 && searchData2.docs[0].cover_i) {
                coverUrl = `https://covers.openlibrary.org/b/id/${searchData2.docs[0].cover_i}-L.jpg`;
              }
            }
          } catch {}
        }
        if (coverUrl) {
          await storage.updateBookCover(book.id, coverUrl);
          fetched++;
        }
      }
      console.log(`Fetched ${fetched} book covers.`);
    }
  } catch (e) {
    console.error("Failed to fetch missing covers:", (e as Error).message);
  }

  // ===================== GROWTH CHECK ROUTES =====================

  // Student: Get current growth check status
  app.get("/api/growth-check/current", authMiddleware, async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (user.role !== 'student') return res.status(403).json({ error: "Only students can take growth checks" });

      const window = await storage.getActiveGrowthCheckWindow();
      if (!window) return res.json({ available: false, message: "No active benchmark window" });

      const gradeBand = gradeToBand(user.grade || '3') || 'K-2';
      const form = await storage.getGrowthCheckForm(gradeBand, window.id);
      if (!form) return res.json({ available: false, message: `No form available for grade band ${gradeBand}` });

      const attempt = await storage.getOrCreateGrowthCheckAttempt(userId, form.id, window.id);
      const passages = await storage.getGrowthCheckPassages(form.id);
      const items = await storage.getGrowthCheckItems(form.id);
      const responses = await storage.getGrowthCheckResponses(attempt.id);

      // Group items by passage
      const passagesWithItems = passages.map((p: any) => ({
        ...p,
        items: items.filter((i: any) => i.passage_id === p.id),
      }));

      res.json({
        available: true,
        window,
        form: { ...form, passages: passagesWithItems },
        attempt,
        responses: responses.reduce((acc: any, r: any) => ({ ...acc, [r.item_id]: r }), {}),
      });
    } catch (e) {
      console.error("Get growth check current error:", e);
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Student: Start growth check attempt
  app.post("/api/growth-check/start", authMiddleware, async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      const window = await storage.getActiveGrowthCheckWindow();
      if (!window) return res.status(400).json({ error: "No active benchmark window" });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const gradeBand = gradeToBand(user.grade || '3') || 'K-2';
      const form = await storage.getGrowthCheckForm(gradeBand, window.id);
      if (!form) return res.status(400).json({ error: "No form available for your grade band" });

      const attempt = await storage.getOrCreateGrowthCheckAttempt(userId, form.id, window.id);
      if (attempt.status === 'completed') return res.status(400).json({ error: "You have already completed this growth check" });

      const started = await storage.startGrowthCheckAttempt(attempt.id);
      res.json({ attempt: started });
    } catch (e) {
      console.error("Start growth check error:", e);
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Student: Submit growth check attempt
  app.post("/api/growth-check/submit", authMiddleware, async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      const { attemptId, responses } = req.body as { attemptId: number; responses: { itemId: number; answer: string }[] };

      const { data: attemptData } = await supabase.from('growth_check_attempts').select('*').eq('id', attemptId).single();
      if (!attemptData) return res.status(404).json({ error: "Attempt not found" });
      if (attemptData.student_id !== userId) return res.status(403).json({ error: "Not your attempt" });
      if (attemptData.status === 'completed') return res.status(400).json({ error: "Already submitted" });

      const items = await storage.getGrowthCheckItems(attemptData.form_id);
      const itemMap = new Map(items.map((i: any) => [i.id, i]));

      let rawScore = 0;
      let maxScore = 0;
      const skillStats: any = {};

      for (const resp of responses) {
        const item = itemMap.get(resp.itemId);
        if (!item) continue;
        maxScore += item.points || 1;

        const correctAnswers = item.correct_answer_json || [];
        const isCorrect = item.question_type === 'multiple_choice'
          ? correctAnswers.includes(resp.answer)
          : null;

        const pointsEarned = isCorrect === true ? (item.points || 1) : 0;
        const needsReview = item.question_type === 'short_response';

        rawScore += pointsEarned;

        await storage.saveGrowthCheckResponse(attemptId, resp.itemId, { answer: resp.answer }, isCorrect, pointsEarned, needsReview);

        // Track skill stats
        const skill = item.primary_skill;
        if (!skillStats[skill]) skillStats[skill] = { correct: 0, total: 0, skillName: skill };
        if (!needsReview) {
          skillStats[skill].total++;
          if (isCorrect) skillStats[skill].correct++;
        }
      }

      // Calculate Arise Reading Score (100-900 scale)
      const pct = maxScore > 0 ? rawScore / maxScore : 0;
      const ariseScore = Math.round(100 + (pct * 800));

      // Build skill summary
      const skillSummary = Object.entries(skillStats).map(([skill, stats]: [string, any]) => ({
        skill,
        skillName: formatSkillName(skill),
        correct: stats.correct,
        total: stats.total,
        pct: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        level: stats.total > 0 ? getSkillLevel(stats.correct, stats.total) : 'more_evidence',
      }));

      // Generate student-facing summary
      const studentSummary = generateStudentSummary(ariseScore, skillSummary);

      // Generate next steps
      const nextSteps = generateNextSteps(skillSummary);

      const submitted = await storage.submitGrowthCheckAttempt(
        attemptId, rawScore, maxScore, ariseScore, skillSummary, studentSummary, nextSteps
      );

      res.json({ attempt: submitted, skillSummary, studentSummary, nextSteps });
    } catch (e) {
      console.error("Submit growth check error:", e);
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Student: Get growth check history/results
  app.get("/api/growth-check/results", authMiddleware, async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      const summary = await storage.getStudentGrowthCheckSummary(userId);
      if (!summary) return res.json({ available: false });
      res.json({ available: true, ...summary });
    } catch (e) {
      console.error("Get growth check results error:", e);
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Teacher: Get growth check overview for all students
  app.get("/api/teacher/growth-check/overview", authMiddleware, adminMiddleware, async (req: any, res: any) => {
    try {
      const allAttempts = await storage.getAllGrowthCheckAttempts();
      res.json({ attempts: allAttempts });
    } catch (e) {
      console.error("Teacher growth check overview error:", e);
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Teacher: Assign growth check to student
  app.post("/api/teacher/growth-check/assign", authMiddleware, adminMiddleware, async (req: any, res: any) => {
    try {
      const { studentId, formId, dueAt } = req.body as { studentId: number; formId: number; dueAt?: string };
      const window = await storage.getActiveGrowthCheckWindow();
      if (!window) return res.status(400).json({ error: "No active benchmark window" });
      const assignment = await storage.assignGrowthCheck(studentId, req.user.id, formId, window.id, dueAt);
      res.json({ assignment });
    } catch (e) {
      console.error("Assign growth check error:", e);
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Family: Get student growth check results
  app.get("/api/family/growth-check/student/:studentId", authMiddleware, async (req: any, res: any) => {
    try {
      const studentId = parseInt(req.params.studentId);
      // Verify parent has access to this student
      const rawLinks = await storage.getSetting('parent_student_links');
      let parentLinks: Record<string, number> = {};
      if (rawLinks) { try { parentLinks = JSON.parse(rawLinks); } catch {} }
      const linkedStudentId = parentLinks[String(req.user.id)];
      if (linkedStudentId !== studentId && !req.user.isAdmin) return res.status(403).json({ error: "Not authorized for this student" });
      const summary = await storage.getStudentGrowthCheckSummary(studentId);
      if (!summary) return res.json({ available: false });
      res.json({ available: true, ...summary });
    } catch (e) {
      console.error("Family growth check error:", e);
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Admin: Get all growth check forms
  app.get("/api/admin/growth-check/forms", authMiddleware, adminMiddleware, async (req: any, res: any) => {
    try {
      const forms = await storage.getAllGrowthCheckForms();
      res.json({ forms });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Admin: Get all windows
  app.get("/api/admin/growth-check/windows", authMiddleware, adminMiddleware, async (req: any, res: any) => {
    try {
      const windows = await storage.getAllGrowthCheckWindows();
      res.json({ windows });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Admin: Upsert window
  app.post("/api/admin/growth-check/windows", authMiddleware, adminMiddleware, async (req: any, res: any) => {
    try {
      const { schoolYear, windowName, startDate, endDate, isActive } = req.body;
      const window = await storage.upsertGrowthCheckWindow(schoolYear, windowName, startDate, endDate, isActive);
      res.json({ window });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Admin: Assign growth check to all students in a grade band
  app.post("/api/admin/growth-check/assign-all", authMiddleware, adminMiddleware, async (req: any, res: any) => {
    try {
      const { formId, gradeBand } = req.body as { formId: number; gradeBand: string };
      const window = await storage.getActiveGrowthCheckWindow();
      if (!window) return res.status(400).json({ error: "No active benchmark window" });

      // Get all students
      const { data: students } = await supabase.from('users').select('id, grade').eq('role', 'student');
      let assigned = 0;
      if (students) {
        for (const student of students) {
          const studentBand = gradeToBand(student.grade || '3');
          if (studentBand === gradeBand) {
            try {
              await storage.assignGrowthCheck(student.id, req.user.id, formId, window.id);
              assigned++;
            } catch {}
          }
        }
      }
      res.json({ assigned, total: assigned });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return httpServer;
}

// Helper functions for growth check scoring
function formatSkillName(skill: string): string {
  const names: Record<string, string> = {
    main_idea: 'Main Idea',
    key_details: 'Key Details',
    inference: 'Inference',
    vocabulary_in_context: 'Vocabulary in Context',
    text_evidence: 'Text Evidence',
    authors_purpose: 'Author\'s Purpose',
    text_structure: 'Text Structure',
    theme: 'Theme',
    literary_elements: 'Literary Elements',
    summary: 'Summary',
    compare_contrast: 'Compare & Contrast',
  };
  return names[skill] || skill;
}

function getSkillLevel(correct: number, total: number): string {
  if (total === 0) return 'more_evidence';
  const pct = correct / total;
  if (pct >= 0.8) return 'strength';
  if (pct >= 0.5) return 'developing';
  if (pct >= 0.25) return 'practice';
  return 'more_evidence';
}

function generateStudentSummary(ariseScore: number, skillSummary: any[]): string {
  const strengths = skillSummary.filter(s => s.level === 'strength').map(s => s.skillName);
  const developing = skillSummary.filter(s => s.level === 'developing').map(s => s.skillName);
  const practice = skillSummary.filter(s => s.level === 'practice').map(s => s.skillName);

  let summary = `Your Arise Reading Score is ${ariseScore}. `;
  if (strengths.length > 0) summary += `You showed strong skills in ${strengths.join(', ')}. `;
  if (developing.length > 0) summary += `You are building your skills in ${developing.join(', ')}. `;
  if (practice.length > 0) summary += `Keep practicing ${practice.join(', ')} - you are on your way! `;
  if (strengths.length === 0 && developing.length === 0) summary += `Keep reading and practicing - every book makes you a stronger reader!`;
  return summary;
}

function generateNextSteps(skillSummary: any[]): any[] {
  const steps: any[] = [];
  const practice = skillSummary.filter(s => s.level === 'practice');
  const developing = skillSummary.filter(s => s.level === 'developing');
  const moreEvidence = skillSummary.filter(s => s.level === 'more_evidence');

  for (const skill of practice) {
    steps.push({
      skill: skill.skillName,
      level: 'practice',
      action: `Find a book and practice ${skill.skillName.toLowerCase()} skills. Try pausing after each chapter to identify the main idea.`,
    });
  }
  for (const skill of developing) {
    steps.push({
      skill: skill.skillName,
      level: 'developing',
      action: `You are making progress with ${skill.skillName.toLowerCase()}. Keep reading books you enjoy and talk about what you read with a friend or teacher.`,
    });
  }
  if (steps.length === 0) {
    steps.push({
      skill: 'General Reading',
      level: 'strength',
      action: 'Great work! Keep reading books you love. Try a new genre or a longer book to challenge yourself.',
    });
  }
  return steps;
}
