import { isSampleAccount } from "../shared/sampleAccounts";
import { YOUTUBE_CHANNEL_OPTIONS, normalizeYoutubeChannels, youtubeChannelAllowed } from "../shared/youtubeChannels";
import { normalizeEyeGazeBackground } from "../shared/eyeGazeAppearance";
import type { Express } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
// Cache-bust: force server restart to pick up new DB entries
import { seedData } from "./storage";
import { clearCache, AlreadySubmittedError } from "./storage";
import { supabase, getAdminSupabase } from "./supabase";
import { registerLiveQuizRoutes } from "./liveQuizzes";
import { registerStudyRoutes } from "./study";
import { registerPlanRoutes } from "./plans";
import { registerPrizeRoutes } from "./prizes";
import { transferIndependentStudents } from "./independentTransfer";
import { registerSchoolPickerRoutes, SchoolPickError } from "./schoolPicker";
import { checkSchoolEmail } from "../shared/schoolEmail";
import { confirmTeacherEmail, createTeacherEmailCodes, resendTeacherCode, teacherEmailCodeEmail, teacherWelcomeEmail, type TeacherAccount, type TeacherConfirmDeps } from "./teacherSignup";
import { usSchoolDirectory } from "./schoolDirectory";
import { isIndependentSchoolName } from "../shared/independent";
import { registerBoardQuestRoutes } from "./boardQuest";
import { registerPaintballArenaRoutes } from "./paintballArena";
import { registerRacingRoutes, supabaseSaveStore } from "./racing";
import { registerSkyboundRoutes } from "./skybound";
import { createTheaterCatalogStore, registerTheaterAdminRoutes } from "./theaterCatalog";
import { theaterMediaKey, type TheaterMovie } from "../shared/clubTheater";
import { registerClubPlayRoutes } from "./clubPlay";
import { registerClubAriseRoutes } from "./clubArise";
import { registerAriseNewsRoutes } from "./ariseNews";
import { registerReadsRoutes } from "./readsSync";
import { registerBuildWorldRoutes } from "./buildWorld";
import { registerChessArenaRoutes } from "./chessArena";
import { registerQuizIntegrityRoutes } from "./quizIntegrity";
import { recordLogin, registerStudentActivityRoutes } from "./studentActivity";
import { countHubStudents, createHubGate, registerTeacherHubRoutes } from "./teacherHub";
import { registerTeacherHubImportRoutes } from "./teacherHubImport";
import { matchEarnsCoins } from "./arcadeMatches";
import { lookupARBook, verifyAndSaveARBook, syncUnverifiedARBooks } from "./arBookfinder";
import { createAdminAlerts, type Alert } from "./adminAlerts";
import { buildAdminFeed, buildMemberFeed, buildTeacherFeed, keyAction, legacyKey, splitReport, type Conversation } from "./notificationFeed";
import { ALERT_EVENTS } from "../shared/adminAlerts";
import { createPresenceTracker, registerAdminStatsRoutes } from "./adminStats";
import { shuffleChoices, storedLetter } from "./quizShuffle";
import { clientAddress, createAttemptLimiter, waitWords } from "./attemptLimiter";
import { DEFAULT_SITE_URL, PARENT_INVITES_PER_DAY, emailDocument, parentInviteEmail } from "./emailFormat";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";
import { raw } from "express";

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

// Students who signed up with "my school/teacher isn't listed".
const UNLISTED_SIGNUPS_KEY = "unlisted_signup_requests";
type UnlistedSignup = {
  userId: number; username: string; displayName: string; gradeLevel: string | null;
  schoolId: number | null; schoolName: string | null; teacherName: string | null;
  createdAt: string; resolved: boolean; resolvedAt?: string;
  resolvedTeacherId?: number | null; resolvedSchoolId?: number | null;
};
async function readUnlistedSignups(): Promise<UnlistedSignup[]> {
  const stored = await storage.getSetting(UNLISTED_SIGNUPS_KEY);
  if (!stored) return [];
  try { const parsed = JSON.parse(stored); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function arPassingScore(total: number): number {
  return Math.ceil(total * 0.70);
}

function arPointsForScore(bookPoints: number, score: number, total: number): number {
  if (!total || score < arPassingScore(total)) return 0;
  return Number(bookPoints || 0);
}
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const PROXY_URL = process.env.CUSTOM_CRED_API_RESEND_COM_URL || "";
const PROXY_TOKEN = process.env.CUSTOM_CRED_API_RESEND_COM_TOKEN || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "A.R.I.S.E Reader <noreply@arisereader.com>";
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "jjrobo180@gmail.com";
const APP_URL = process.env.APP_URL || DEFAULT_SITE_URL;

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

async function generateQuizWithAI(bookTitle: string, author: string, ageGroup?: string, studentGrade?: string): Promise<{ questions: Array<{ question: string; options: string[]; correct: string }>; bookGradeLevel: string; pointsValue: number } | { error: string }> {
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

    // AR points are assigned from verified AR Bookfinder metadata when the book quiz is saved.
    const pointsValue = 0;

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


// Strip answer words from question prompts to prevent revealing the answer
// e.g., "Which one is the apple?" with answer "Apple" becomes "Which one is this?"
function stripAnswerFromPrompt(prompt: string, options: string[], correctAnswer: string): string {
  let cleaned = prompt;
  const correctIdx = ["A","B","C","D"].indexOf(correctAnswer.toUpperCase());
  if (correctIdx === -1) return cleaned;
  const correctText = (options[correctIdx] || "").toLowerCase().trim();
  if (!correctText || correctText.length < 2) return cleaned;
  
  // Check if the correct answer word appears in the prompt
  const promptLower = cleaned.toLowerCase();
  if (promptLower.includes(correctText)) {
    // Replace the answer word with a neutral placeholder
    const regex = new RegExp(correctText, "gi");
    cleaned = cleaned.replace(regex, "this");
  }
  
  // Also check if ANY option text appears in the prompt
  for (const opt of options) {
    const optLower = opt.toLowerCase().trim();
    if (optLower.length < 2) continue;
    if (cleaned.toLowerCase().includes(optLower)) {
      const regex = new RegExp(optLower, "gi");
      cleaned = cleaned.replace(regex, "this");
    }
  }
  
  // Clean up double spaces and odd phrasing
  cleaned = cleaned.replace(/\s+/g, " ").replace(/\bthis this\b/gi, "this").trim();
  
  return cleaned;
}

// Fetch a real photo from Wikipedia/Wikimedia Commons for the given concept
// Tries the exact term first, then falls back to broader search terms
async function generateImageUrl(concept: string): Promise<string | null> {
  const cleanConcept = concept.replace(/[".!?]/g, '').trim();
  if (!cleanConcept || cleanConcept.length < 2) return null;
  try {
    const wikiTitle = encodeURIComponent(cleanConcept);
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}`, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'ARISEReader/1.0 (educational quiz platform)' },
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const thumb = data?.thumbnail?.source;
    if (thumb) {
      return thumb;
    }
    return null;
  } catch {
    return null;
  }
}

// Food-specific search terms — search for the FOOD version, not the plant/animal
// This prevents getting a rice plant when the kid needs to see a bowl of rice
const FOOD_SEARCH_TERMS: Record<string, string[]> = {
  "rice": ["Cooked rice", "Bowl of rice", "Steamed rice"],
  "orange": ["Orange (fruit)", "Orange fruit"],
  "apple": ["Apple (fruit)", "Apple fruit"],
  "banana": ["Banana (fruit)", "Banana fruit"],
  "milk": ["Glass of milk", "Milk glass"],
  "juice": ["Orange juice", "Glass of juice"],
  "bread": ["Bread loaf", "Sliced bread"],
  "soup": ["Bowl of soup", "Chicken soup"],
  "water": ["Glass of water", "Drinking water glass"],
  "soda": ["Soft drink glass", "Soda can"],
  "tea": ["Cup of tea", "Tea cup"],
  "coffee": ["Cup of coffee", "Coffee cup"],
  "cracker": ["Cracker (food)", "Saltine cracker"],
  "cookie": ["Cookie (food)", "Chocolate chip cookie"],
  "biscuit": ["Biscuit (food)", "Digestive biscuit"],
  "pear": ["Pear (fruit)", "Pear fruit"],
  "grapes": ["Grapes fruit", "Red grapes"],
  "strawberry": ["Strawberry fruit", "Strawberries"],
  "blueberry": ["Blueberry fruit", "Blueberries"],
  "lemon": ["Lemon fruit", "Lemon whole"],
  "peach": ["Peach fruit", "Peach whole"],
  "plum": ["Plum fruit", "Plum whole"],
  "cherry": ["Cherry fruit", "Cherries red"],
  "mango": ["Mango fruit", "Mango whole"],
  "pineapple": ["Pineapple fruit", "Pineapple whole"],
  "watermelon": ["Watermelon fruit", "Watermelon slice"],
  "carrot": ["Carrot vegetable", "Carrots bunch"],
  "tomato": ["Tomato vegetable", "Tomato red"],
  "potato": ["Potato vegetable", "Baked potato"],
  "corn": ["Corn (food)", "Corn on the cob"],
  "broccoli": ["Broccoli vegetable", "Broccoli head"],
  "lettuce": ["Lettuce vegetable", "Lettuce head"],
  "onion": ["Onion vegetable", "Onion bulb"],
  "garlic": ["Garlic bulb", "Garlic clove"],
  "cheese": ["Cheese (food)", "Cheese slice"],
  "butter": ["Butter (food)", "Butter stick"],
  "yogurt": ["Yogurt cup", "Yoghurt"],
  "ice cream": ["Ice cream cone", "Ice cream scoop"],
  "cake": ["Cake slice", "Birthday cake"],
  "pizza": ["Pizza slice", "Pizza pepperoni"],
  "pasta": ["Cooked pasta", "Spaghetti plate"],
  "spaghetti": ["Spaghetti plate", "Spaghetti pasta"],
  "noodles": ["Noodles bowl", "Cooked noodles"],
  "hamburger": ["Hamburger food", "Cheeseburger"],
  "hot dog": ["Hot dog food", "Hot dog sausage"],
  "sandwich": ["Sandwich food", "Ham sandwich"],
  "salad": ["Salad bowl", "Green salad"],
  "egg": ["Boiled egg", "Fried egg"],
  "chicken": ["Cooked chicken", "Roast chicken"],
  "beef": ["Cooked beef", "Steak plate"],
  "fish": ["Cooked fish", "Grilled fish"],
  "shrimp": ["Cooked shrimp", "Shrimp dish"],
  "taco": ["Taco food", "Mexican taco"],
  "burrito": ["Burrito food", "Mexican burrito"],
  "nacho": ["Nachos food", "Nacho chips"],
  "popcorn": ["Popcorn bowl", "Popcorn food"],
  "chips": ["Potato chips", "Crisps bag"],
  "chocolate": ["Chocolate bar", "Chocolate food"],
  "candy": ["Candy sweets", "Hard candy"],
  "donut": ["Donut food", "Doughnut"],
  "pancake": ["Pancake stack", "Pancake food"],
  "waffle": ["Waffle food", "Belgian waffle"],
  "cereal": ["Cereal bowl", "Breakfast cereal"],
  "oatmeal": ["Oatmeal bowl", "Cooked oatmeal"],
  "gravy": ["Gravy bowl", "Meat gravy"],
  "sauce": ["Sauce bowl", "Tomato sauce"],
  "honey": ["Honey jar", "Honey food"],
  "jam": ["Jam jar", "Strawberry jam"],
  "peanut butter": ["Peanut butter jar", "Peanut butter"],
  "jelly": ["Jelly food", "Jelly dessert"],
  "pudding": ["Pudding dessert", "Chocolate pudding"],
  "smoothie": ["Smoothie glass", "Fruit smoothie"],
  "milkshake": ["Milkshake glass", "Milkshake drink"],
  "lemonade": ["Lemonade glass", "Lemonade drink"],
  "hot chocolate": ["Hot chocolate cup", "Hot cocoa"],
  "wine": ["Wine glass", "Red wine glass"],
  "beer": ["Beer glass", "Beer mug"],
  "dog": ["Dog animal", "Dog pet"],
  "cat": ["Cat animal", "Cat pet"],
  "lion": ["Lion animal", "Lion photo"],
  "tiger": ["Tiger animal", "Tiger photo"],
  "elephant": ["Elephant animal", "Elephant photo"],
  "bear": ["Bear animal", "Brown bear"],
  "rabbit": ["Rabbit animal", "Domestic rabbit"],
  "horse": ["Horse animal", "Horse photo"],
  "cow": ["Cow animal", "Dairy cow"],
  "pig": ["Pig animal", "Domestic pig"],
  "sheep": ["Sheep animal", "Domestic sheep"],
  "goat": ["Goat animal", "Domestic goat"],
  "chicken animal": ["Chicken animal", "Rooster photo"],
  "duck": ["Duck animal", "Duck photo"],
  "frog": ["Frog animal", "Green frog"],
  "snake": ["Snake animal", "Snake photo"],
  "fish animal": ["Fish animal", "Goldfish"],
  "bird": ["Bird animal", "Bird photo"],
  "penguin": ["Penguin animal", "Penguin photo"],
  "monkey": ["Monkey animal", "Monkey photo"],
  "giraffe": ["Giraffe animal", "Giraffe photo"],
  "zebra": ["Zebra animal", "Zebra photo"],
  "umbrella": ["Umbrella open", "Rain umbrella"],
  "shoes": ["Shoes pair", "Sneakers pair"],
  "shirt": ["T-shirt", "Polo shirt"],
  "pants": ["Jeans clothing", "Trousers"],
  "hat": ["Hat clothing", "Baseball cap"],
  "gloves": ["Gloves pair", "Winter gloves"],
  "socks": ["Socks pair", "Sock clothing"],
  "boots": ["Boots pair", "Leather boots"],
  "jacket": ["Jacket clothing", "Winter jacket"],
  "scarf": ["Scarf clothing", "Winter scarf"],
  "spoon": ["Metal spoon", "Soup spoon"],
  "fork": ["Assorted forks", "Fork (tool)"],
  "knife": ["Knife utensil", "Kitchen knife"],
  "plate": ["Dinner plate", "Ceramic plate", "Dish plate"],
  "bowl": ["Bowl dish", "White bowl"],
  "cup": ["Cup drinkware", "Coffee mug"],
  "napkin": ["Paper napkin", "Serviette"],
  "towel": ["Bath towel", "Towel (textile)"],
  "toothbrush": ["Toothbrush", "Toothbrush brush"],
  "comb": ["Comb hair", "Hair comb"],
  "scissors": ["Scissors", "Kitchen shears"],
  "key": ["Key (lock)", "House key"],
  "clock": ["Analog clock", "Wall clock"],
  "lamp": ["Desk lamp", "Table lamp"],
  "book": ["Open book", "Book stack"],
  "pencil": ["Pencil", "Colored pencils"],
  "crayon": ["Crayon art", "Crayon color"],
  "ball": ["Soccer ball", "Tennis ball"],
  "doll": ["Doll toy", "Toy doll"],
  "car": ["Hatchback car", "Toyota Corolla"],
  "bus": ["School bus", "Transit bus"],
  "truck": ["Pickup truck", "Semi-truck"],
  "train": ["Train vehicle", "Train locomotive"],
  "bicycle": ["Bicycle vehicle", "Bike"],
  "airplane": ["Airplane vehicle", "Passenger plane"],
  "boat": ["Boat vehicle", "Sailboat"],
  "flower": ["Sunflower", "Red rose"],
  "tree": ["Oak tree", "Pine tree"],
  "leaf": ["Leaf green", "Green leaf"],
  "rock": ["Rock stone", "Gray rock"],
  "cloud": ["Cloud sky", "White cloud"],
  "sun": ["Sun (star)", "Solar eclipse"],
  "moon": ["Moon sky", "Full moon"],
  "star": ["Five-pointed star", "Star symbol"],
  "rain": ["Rain weather", "Rain drops"],
  "snow": ["Snow weather", "Snowflakes"],
  "wind": ["Wind weather", "Wind blowing"],
};

// Fetch image with food-specific search terms FIRST
async function generateImageUrlWithFallback(concept: string): Promise<string | null> {
  const lower = concept.toLowerCase().trim();
  
  // For food items, search food-specific terms FIRST (prevents rice plant instead of bowl of rice)
  const foodTerms = FOOD_SEARCH_TERMS[lower];
  if (foodTerms) {
    for (const term of foodTerms) {
      const img = await generateImageUrl(term);
      if (img) return img;
    }
  }
  
  // Try the exact concept
  let img = await generateImageUrl(concept);
  if (img) return img;
  
  // Try generic fallbacks
  const genericFallbacks = [
    concept + " food",
    concept + " photo",
    concept + " image",
  ];
  for (const term of genericFallbacks) {
    img = await generateImageUrl(term);
    if (img) return img;
  }
  
  return null;
}

// Quality check: verify all images exist, retry missing ones
async function qualityCheckQuiz(validQuestions: any[], allPics: boolean): Promise<void> {
  if (!allPics) return;
  
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  
  for (const q of validQuestions) {
    const options = [
      { key: "option_a_image", text: q.option_a_text },
      { key: "option_b_image", text: q.option_b_text },
      { key: "option_c_image", text: q.option_c_text },
      { key: "option_d_image", text: q.option_d_text },
    ];
    
    for (const opt of options) {
      if (!q[opt.key]) {
        // Image missing — retry with fallback terms
        await sleep(300); // Avoid Wikipedia rate limiting
        const img = await generateImageUrlWithFallback(opt.text);
        if (img) {
          q[opt.key] = img;
        } else {
          // Last resort: try even more generic terms
          await sleep(300);
          const lastResort = await generateImageUrl(opt.text + " (food)");
          if (lastResort) q[opt.key] = lastResort;
        }
      }
    }
  }
}

async function generateEyeGazeQuizWithAI(topic: string, description?: string, sourceLink?: string, level: number = 1, questionCount: number = 5, exactMode: boolean = false, allPics: boolean = true, customQuestions?: string): Promise<{ questions: Array<{ prompt: string; question_image: string | null; option_a_text: string; option_a_image: string | null; option_b_text: string; option_b_image: string | null; option_c_text: string; option_c_image: string | null; option_d_text: string; option_d_image: string | null; correct_answer: string }> } | { error: string }> {
  const apiKey = await getPerplexityApiKey();
  if (!apiKey) {
    return { error: "AI quiz generation is not configured. An admin needs to set the Perplexity API key in the admin panel." };
  }
  try {
    let guidelines = "";
    try {
      guidelines = await storage.getSetting("eye_gaze_quiz_guidelines") || "";
    } catch {}

    // Build a flexible prompt that accepts any topic, description, or source
    let userRequest = `Topic: "${topic}"`;
    if (description && description.trim()) {
      userRequest += `\nDescription: ${description.trim()}`;
    }
    if (sourceLink && sourceLink.trim()) {
      userRequest += `\nSource/Reference: ${sourceLink.trim()}`;
    }

    const levelDescriptions: Record<number, string> = {
      1: "Level 1 (Toddler/Pre-K): Very simple identification — one clear correct answer, obvious distractors. Simple nouns only (e.g., 'Which one is a dog?').",
      2: "Level 2 (K-1): Basic identification and matching. Simple categories (e.g., 'Which one is red?', 'Which animal says moo?').",
      3: "Level 3 (2-3): Simple comprehension and categorization (e.g., 'Which one do you wear on your feet?'). Slightly less obvious distractors.",
      4: "Level 4 (3-5): Multi-step identification and function (e.g., 'Which tool do you use to eat soup?'). More nuanced distractors.",
      5: "Level 5 (6+): Abstract concepts and reasoning (e.g., 'Which of these is a source of energy?'). Complex distractors.",
    };

    // Check if user provided their own questions
    const customQuestionLines = customQuestions ? customQuestions.split("\n").map((q: string) => q.trim()).filter((q: string) => q.length > 0) : [];
    const hasCustomQuestions = customQuestionLines.length > 0;
    const actualQuestionCount = hasCustomQuestions ? customQuestionLines.length : questionCount;
    
    let prompt: string;
    
    if (hasCustomQuestions) {
      // USER WROTE THEIR OWN QUESTIONS - AI only generates answer options
      const questionsList = customQuestionLines.map((q: string, i: number) => (i + 1) + ". " + q).join("\n");
      prompt = `You are an expert quiz creator for eye gaze and non-verbal students, including autistic children and toddlers.

The user has written their OWN questions below. Your job is to generate 4 answer choices for each question. DO NOT change the user's question text. Use each question EXACTLY as written.

USER'S QUESTIONS:
${questionsList}

Difficulty level: ${levelDescriptions[level] || levelDescriptions[1]}

CRITICAL RULES:
- Use the user's question text EXACTLY as written for the "prompt" field
- Generate exactly 4 answer options for each question (option_a through option_d)
- Only 1 option is correct
- Make option texts concrete nouns or simple phrases that can be searched for images
- Make all 4 options from the same category so the student must distinguish between them
- All content MUST be school-appropriate and child-friendly
- All answers MUST be factually accurate
- DO NOT use emojis anywhere

Return ONLY a JSON object (no markdown, no explanation, no code blocks) with this exact format:
{"questions":[{"prompt":"Select the zoo animal","question_image":null,"option_a_text":"Lion","option_a_image":null,"option_b_text":"Elephant","option_b_image":null,"option_c_text":"Penguin","option_c_image":null,"option_d_text":"Giraffe","option_d_image":null,"correct_answer":"A"}]}

Return exactly ${actualQuestionCount} questions — one for each of the user's questions above.${guidelines ? `\n\nAdditional guidelines from the admin:\n${guidelines}` : ""}`;
    } else {
      // AI generates everything (original behavior)
      prompt = `You are an expert quiz creator for eye gaze and non-verbal students, including autistic children and toddlers. Create exactly ${questionCount} multiple-choice questions based on the following request:

${userRequest}

Difficulty level: ${levelDescriptions[level] || levelDescriptions[1]}

${exactMode ? "IMPORTANT: The user wants an EXACT quiz based on their specific input. Use ONLY the items, concepts, or content they provided. Do NOT add new items or generalize beyond what they specified." : ""}

These quizzes are for students who use eye gaze technology or are non-verbal, including autistic children and toddlers. Questions should be visual, simple, and accessible. DO NOT use emojis in any field. Leave question_image and option_*_image fields as null.

CRITICAL QUESTION RULES:
- NEVER reveal the answer in the question prompt
- Ask about a characteristic, function, or category instead
- The question must make students THINK
- Make all 4 options from the same category
- Do NOT use the exact word from any option in the question prompt

IMPORTANT CONTENT RULES:
- All content MUST be school-appropriate and child-friendly
- All answers MUST be factually accurate
- If the topic involves a YouTube video, song, or specific media, create questions about the general educational concepts
- Do NOT reference YouTube, specific video titles, or brand names in questions
- Make option texts concrete nouns or simple phrases that can be searched for images

Return ONLY a JSON object (no markdown, no explanation, no code blocks) with this exact format:
{"questions":[{"prompt":"What do we use to stay dry in the rain?","question_image":null,"option_a_text":"Umbrella","option_a_image":null,"option_b_text":"Sunglasses","option_b_image":null,"option_c_text":"Boots","option_c_image":null,"option_d_text":"Hat","option_d_image":null,"correct_answer":"A"}]}

Create exactly ${questionCount} questions. DO NOT use emojis. Each question has exactly 4 options. The correct_answer is a single letter A, B, C, or D. Make option texts concrete image-searchable nouns.${guidelines ? `\n\nAdditional guidelines from the admin:\n${guidelines}` : ""}`;
    }

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

    const validQuestions = questions.slice(0, questionCount).map((q: any) => ({
      prompt: q.prompt || "What is this?",
      question_image: null, // No question image — text prompt only
      option_a_text: q.option_a_text || q.option_a || q.options?.[0] || "",
      option_a_image: null, // Will be set by image search below
      option_b_text: q.option_b_text || q.option_b || q.options?.[1] || "",
      option_b_image: null,
      option_c_text: q.option_c_text || q.option_c || q.options?.[2] || "",
      option_c_image: null,
      option_d_text: q.option_d_text || q.option_d || q.options?.[3] || "",
      option_d_image: null,
      correct_answer: (q.correct_answer || q.correct || "A").toUpperCase().charAt(0),
    })).filter((q: any) => q.option_a_text && q.option_b_text && q.option_c_text && q.option_d_text);

    if (validQuestions.length < 3) {
      return { error: "AI generated too few valid questions. Please try a more specific topic." };
    }

    // Fetch real photos for answer options only if allPics is true
    try {
      if (allPics) {
        for (const q of validQuestions) {
          const [aImg, bImg, cImg, dImg] = await Promise.all([
            generateImageUrlWithFallback(q.option_a_text),
            generateImageUrlWithFallback(q.option_b_text),
            generateImageUrlWithFallback(q.option_c_text),
            generateImageUrlWithFallback(q.option_d_text),
          ]);
          q.option_a_image = aImg;
          q.option_b_image = bImg;
          q.option_c_image = cImg;
          q.option_d_image = dImg;
          
          // Anti-reveal: strip answer words from question prompt
          const options = [q.option_a_text, q.option_b_text, q.option_c_text, q.option_d_text];
          q.prompt = stripAnswerFromPrompt(q.prompt, options, q.correct_answer);
        }
      }
    } catch {}
    
    // Quality check: verify all images exist, retry missing ones
    if (allPics) {
      try {
        await qualityCheckQuiz(validQuestions, allPics);
      } catch {}
    }

    return { questions: validQuestions };
  } catch (e: any) {
    return { error: `AI generation failed: ${e.message}` };
  }
}

function emailConfigured(): boolean {
  return !!((PROXY_URL && PROXY_TOKEN) || RESEND_API_KEY);
}

// Sends through Resend. A request that times out, is rate limited or hits a Resend outage is tried
// again (up to three tries); the idempotency key keeps a retry from sending the same email twice.
// Every email goes out as a complete page with the site's footer (server/emailFormat.ts).
async function sendEmail(to: string | string[], subject: string, html: string): Promise<{ sent: boolean; error?: string }> {
  const hasProxy = PROXY_URL && PROXY_TOKEN;
  if (!emailConfigured()) {
    return { sent: false, error: "No email API key configured" };
  }
  const recipients = (Array.isArray(to) ? to : [to]).map((value) => String(value || "").trim()).filter(Boolean);
  if (!recipients.length) return { sent: false, error: "No email address to send to" };
  const apiUrl = hasProxy ? PROXY_URL + "/emails" : "https://api.resend.com/emails";
  const headers: Record<string, string> = { "Content-Type": "application/json", "Idempotency-Key": randomUUID() };
  if (hasProxy) {
    headers["x-api-key"] = PROXY_TOKEN;
  } else {
    headers["Authorization"] = `Bearer ${RESEND_API_KEY}`;
  }
  const body = JSON.stringify({ from: EMAIL_FROM, to: recipients, subject, html: emailDocument(subject, html, APP_URL) });
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(apiUrl, { method: "POST", headers, body, signal: AbortSignal.timeout(15000) });
      if (res.ok) return { sent: true };
      const err = await res.text().catch(() => "");
      lastError = `Email API error ${res.status}: ${err.slice(0, 400)}`;
      if (res.status !== 429 && res.status < 500) break;
    } catch (e: any) {
      lastError = e?.name === "TimeoutError" ? "The email service didn't answer in time" : (e?.message || "Network error");
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
  }
  console.error(`[email] not sent: ${lastError}`);
  return { sent: false, error: lastError };
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

function clubSignupNotifyAdminEmail(studentName: string, grade: string, parentName: string, parentContact: string, parentEmail: string, notes: string): string {
  const info = (label: string, val: string) => val ? `<p style="color: #ccc; font-size: 15px; margin: 4px 0;"><strong style="color: #999;">${label}:</strong> ${val}</p>` : '';
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 40px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #FF5900; font-size: 28px; margin: 0;">A.R.I.S.E Reader</h1>
        <p style="color: #999; margin: 5px 0 0 0;">Read a book. Take a quiz. Earn points.</p>
      </div>
      <h2 style="color: #FF5900; font-size: 22px;">New Reading Club Sign-Up</h2>
      <p style="color: #ccc; font-size: 16px; line-height: 1.6;">A student has signed up for the A.R.I.S.E Reading Club (Thursdays after school).</p>
      <div style="background: #2a2a2a; border-radius: 8px; padding: 20px; margin: 20px 0;">
        ${info('Student Name', studentName)}
        ${info('Grade', grade)}
        ${info('Parent / Guardian', parentName)}
        ${info('Parent Phone', parentContact)}
        ${info('Parent Email', parentEmail)}
        ${info('Notes', notes)}
      </div>
      <p style="color: #999; font-size: 14px;">Review and approve or deny this sign-up in the admin dashboard under "Reading Club Sign-Ups".</p>
      <a href="${APP_URL}" style="display: inline-block; background: #FF5900; color: #fff; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-size: 16px; font-weight: bold; margin: 10px 0;">Review in Admin Dashboard</a>
    </div>
  `;
}

function clubApprovedEmail(studentName: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 40px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #FF5900; font-size: 28px; margin: 0;">A.R.I.S.E Reader</h1>
        <p style="color: #999; margin: 5px 0 0 0;">Read a book. Take a quiz. Earn points.</p>
      </div>
      <h2 style="color: #4ade80; font-size: 22px;">You're Approved for Reading Club!</h2>
      <p style="color: #ccc; font-size: 16px; line-height: 1.6;">Hi ${studentName},</p>
      <p style="color: #ccc; font-size: 16px; line-height: 1.6;">Great news! Your sign-up for the A.R.I.S.E Reading Club has been approved. You're all set to join us every Thursday after school at CGMS.</p>
      <div style="background: #2a2a2a; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <p style="color: #999; margin: 0 0 8px 0; font-size: 14px;">Here's what to remember:</p>
        <p style="color: #ccc; font-size: 15px; margin: 4px 0;">📅 Every Thursday after school</p>
        <p style="color: #ccc; font-size: 15px; margin: 4px 0;">📍 CGMS</p>
        <p style="color: #ccc; font-size: 15px; margin: 4px 0;">🏆 Earn 100 points each week</p>
        <p style="color: #ccc; font-size: 15px; margin: 4px 0;">📖 Bring a book or find one in the library</p>
      </div>
      <a href="${APP_URL}" style="display: inline-block; background: #FF5900; color: #fff; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-size: 16px; font-weight: bold; margin: 10px 0;">Go to A.R.I.S.E Reader</a>
    </div>
  `;
}

function clubDeniedEmail(studentName: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 40px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #FF5900; font-size: 28px; margin: 0;">A.R.I.S.E Reader</h1>
        <p style="color: #999; margin: 5px 0 0 0;">Read a book. Take a quiz. Earn points.</p>
      </div>
      <h2 style="color: #f87171; font-size: 22px;">Reading Club Sign-Up Update</h2>
      <p style="color: #ccc; font-size: 16px; line-height: 1.6;">Hi ${studentName},</p>
      <p style="color: #ccc; font-size: 16px; line-height: 1.6;">Thank you for your interest in the A.R.I.S.E Reading Club. Unfortunately, your sign-up could not be approved at this time. Please contact your teacher or school administrator for more information.</p>
      <p style="color: #999; font-size: 14px; margin-top: 20px;">You can always try signing up again in the future.</p>
      <a href="${APP_URL}" style="display: inline-block; background: #FF5900; color: #fff; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-size: 16px; font-weight: bold; margin: 10px 0;">Go to A.R.I.S.E Reader</a>
    </div>
  `;
}

// Notes who used the app each day (first and last visit), for the admin Stats tab.
// One save every half minute at most; see server/adminStats.ts.
const presence = createPresenceTracker({
  readSetting: async (key) => {
    const { data, error } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
    if (error) throw new Error(error.message);
    return data?.value || "";
  },
  upsertSetting: (key, value) => storage.upsertSetting(key, value),
});

// Wrong passwords and proctor codes: after this many misses, wait before trying again.
const loginFailsByName = createAttemptLimiter({ max: 10, windowMs: 15 * 60_000 });
const loginFailsByAddress = createAttemptLimiter({ max: 100, windowMs: 15 * 60_000 });
const proctorFails = createAttemptLimiter({ max: 8, windowMs: 15 * 60_000 });
// Parent invitations a student has sent today (each send is counted with .fail()).
const parentInviteSends = createAttemptLimiter({ max: PARENT_INVITES_PER_DAY, windowMs: 24 * 60 * 60_000 });

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
  const previewHeader = String(req.headers["x-arise-admin-preview"] || "");
  const previewMode = session.user?.isAdmin && (previewHeader === "regular" || previewHeader === "eye-gaze")
    ? previewHeader
    : null;
  req.realUser = session.user;
  req.adminPreview = previewMode;
  req.user = previewMode
    ? {
        ...session.user,
        isAdmin: false,
        role: "student",
        is_eye_gaze_user: previewMode === "eye-gaze",
        username: "admin-preview",
      }
    : session.user;
  req.sessionToken = token;
  if (!previewMode) presence.touch(session.user);
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
  // Picking a school at sign-up: search the US school list, or (teachers) type one that is missing.
  // Its one route is public, so it can sit in front of the plan check.
  const schoolPicker = registerSchoolPickerRoutes(app, {
    directory: usSchoolDirectory(),
    // throws if the list can't be read in full: a short list would make duplicate schools
    allSchools: async () => (await storage.getAllSchoolsOrThrow()).map((s: any) => ({ id: Number(s.id), name: String(s.name || "") })),
    createSchool: async (name) => { const made = await storage.createSchool(name); return { id: Number(made.id), name: String(made.name || name) }; },
    approvedTeacherIds: async () => new Set((await storage.getAllUsers()).filter((u: any) => u.role === "teacher" && u.accountApproved !== false).map((u: any) => Number(u.id))),
    getSetting: (key) => storage.getSetting(key),
    upsertSetting: (key, value) => storage.upsertSetting(key, value),
    // storage.getSetting turns a database error into "", which would un-hide schools and then be saved back as "no records"
    readSetting: async (key) => {
      const { data, error } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
      if (error) throw new Error(error.message);
      return data?.value || "";
    },
  });
  // Admin alerts: sign-ups, quizzes and requests, by email and in the bell, following the
  // switches under Admin > Settings > Notifications. See server/adminAlerts.ts.
  const adminAlerts = createAdminAlerts({
    readSetting: async (key) => {
      const { data, error } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
      if (error) throw new Error(error.message);
      return data?.value || "";
    },
    upsertSetting: (key, value) => storage.upsertSetting(key, value),
    adminIds: async () => {
      const { data, error } = await supabase.from("users").select("id").eq("is_admin", true).is("archived_at", null);
      if (error) throw new Error(error.message);
      return (data || []).map((row: any) => Number(row.id)).filter((id: number) => id > 0);
    },
    insertNotifications: async (rows) => {
      const { error } = await supabase.from("notifications").insert(rows);
      if (error) throw new Error(error.message);
    },
    sendEmail: (to, subject, html) => sendEmail(to, subject, html),
    emailConfigured,
    fromAddress: EMAIL_FROM,
    fallbackRecipient: ADMIN_NOTIFY_EMAIL,
    appUrl: APP_URL,
    timeZone: "America/Denver",
  });
  /** Fire and forget: an alert never slows down or breaks the request that caused it. */
  const alertAdmin = (event: Parameters<typeof adminAlerts.notify>[0], alert: Alert) => { void adminAlerts.notify(event, alert); };
  const personName = (user: any) => String(user?.displayName || user?.display_name || user?.username || "Someone");
  // Grade, school and teacher for a student's alert. Each part is optional.
  const studentFacts = async (user: any): Promise<{ grade: string; school: string; teacher: string }> => {
    const facts = { grade: "", school: "", teacher: "" };
    try {
      const rawGrades = await storage.getSetting("user_grades");
      if (rawGrades) facts.grade = String(JSON.parse(rawGrades)[String(user.id)] || "");
    } catch {}
    try {
      const schoolId = Number(user?.school_id ?? user?.schoolId ?? 0);
      if (schoolId) facts.school = String((await storage.getAllSchools()).find((s: any) => Number(s.id) === schoolId)?.name || "");
    } catch {}
    try {
      const teacherId = Number(user?.teacherId ?? user?.teacher_id ?? 0);
      if (teacherId) facts.teacher = String((await storage.getUser(teacherId))?.displayName || "");
    } catch {}
    return facts;
  };
  const proctorLabel = (type?: string | null, name?: string | null) => {
    if (!type) return "";
    if (type === "camera") return "No proctor (camera on)";
    if (type === "paper") return "Paper quiz";
    if (type === "parent") return `Parent: ${name || "Parent / Guardian"}`;
    return `Teacher / staff: ${name || "Teacher"}`;
  };
  const alertQuizTaken = async (
    event: "quiz_completed" | "eye_gaze_quiz_completed",
    user: any,
    quiz: { title: string; score: number; total: number; passed: boolean; points: number; proctor?: string; extra?: [string, string][] },
  ) => {
    try {
      const facts = await studentFacts(user);
      const name = personName(user);
      const pct = quiz.total > 0 ? Math.round((quiz.score / quiz.total) * 100) : 0;
      const points = Math.round(Number(quiz.points || 0) * 10) / 10;
      await adminAlerts.notify(event, {
        title: `${event === "eye_gaze_quiz_completed" ? "Eye Gazer quiz" : "Quiz taken"}: ${name} scored ${quiz.score}/${quiz.total} on “${quiz.title}”`,
        summary: [quiz.passed ? `Passed · ${points} point${points === 1 ? "" : "s"}` : "Not passed", quiz.proctor, facts.teacher && `Teacher: ${facts.teacher}`].filter(Boolean).join(" · "),
        lines: [
          ["Student", `${name} (@${user?.username || "?"})`],
          ["Grade", facts.grade],
          ["School", facts.school],
          ["Teacher", facts.teacher],
          ["Quiz", quiz.title],
          ["Score", `${quiz.score}/${quiz.total} (${pct}%) · ${quiz.passed ? "passed" : "not passed"}`],
          ["Points earned", String(points)],
          ["Proctor", quiz.proctor],
          ...(quiz.extra || []),
        ],
        ref: `u${user?.id}`,
      });
    } catch (e: any) {
      console.error("[admin-alerts] quiz alert failed:", e?.message);
    }
  };
  const alertAiQuizReview = (user: any, title: string, kind: string) => alertAdmin("ai_quiz_review", {
    title: `AI quiz needs review: “${title}”`,
    summary: `${personName(user)} · ${kind}`,
    lines: [["Student", `${personName(user)} (@${user?.username || "?"})`], ["Quiz", title], ["Kind", kind]],
    note: "Approve or reject it under Admin → To-do → AI quiz review. The student is told either way.",
    row: false,
  });

  // New teachers get in without waiting for the admin: they sign up with their school email and
  // type back the code sent to it. See server/teacherSignup.ts.
  const teacherEmailCodes = createTeacherEmailCodes({
    // read straight from the database: a stale copy would hand back guesses that were already used up
    readSetting: async (key) => {
      const { data, error } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
      if (error) throw new Error(error.message);
      return data?.value || "";
    },
    upsertSetting: (key, value) => storage.upsertSetting(key, value),
  });
  const sendTeacherCode = async (account: TeacherAccount, code: string): Promise<boolean> => {
    if (!account.email) return false;
    const result = await sendEmail(account.email, `${code} is your A.R.I.S.E Reader code`, teacherEmailCodeEmail(account.displayName || account.username, code));
    if (!result.sent) console.error("[teacher-signup] could not email a code:", result.error);
    return result.sent;
  };
  const teacherConfirmDeps: TeacherConfirmDeps = {
    codes: teacherEmailCodes,
    findUser: async (username) => (await storage.getUserByUsername(username)) as any,
    turnOn: (userId) => storage.approveTeacherAccount(userId),
    sendCode: sendTeacherCode,
    // The admin no longer approves these teachers, so they are told about each one instead.
    joined: async (account) => {
      const name = account.displayName || account.username;
      if (account.email) sendEmail(account.email, "Your A.R.I.S.E Reader teacher account is ready", teacherWelcomeEmail(name, account.username, APP_URL)).catch(() => {});
      let school = "";
      try {
        const teacher = await storage.getUser(account.id);
        const schoolId = Number(teacher?.school_id || 0);
        if (schoolId) school = String((await storage.getAllSchools()).find((s: any) => Number(s.id) === schoolId)?.name || "");
      } catch {}
      alertAdmin("teacher_signup", {
        title: `New teacher joined: ${name}`,
        summary: [`@${account.username}`, account.email, school].filter(Boolean).join(" · "),
        lines: [["Teacher", name], ["Username", `@${account.username}`], ["School email", account.email || "No email"], ["School", school]],
        note: "They confirmed their school email, so the account is on. Nothing to approve.",
        ref: `u${account.id}`,
      });
    },
  };
  // Build the school search's index shortly after start-up, so the first person to search doesn't wait for it.
  setTimeout(() => { try { usSchoolDirectory().search("warm up"); } catch {} }, 4000).unref?.();

  // Plans and billing. Registered first: its teacher check has to run before every other route.
  // It locks nothing until the admin turns plan rules on, and takes no payment until a Stripe key is set.
  const plans = registerPlanRoutes(app, authMiddleware, adminMiddleware, {
    getSetting: (key) => storage.getSetting(key),
    upsertSetting: (key, value) => storage.upsertSetting(key, value),
    // storage.getSetting turns a database error into "", which would read as "no plan" and lock a paying teacher out.
    readSetting: async (key) => {
      const { data, error } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
      if (error) throw new Error(error.message);
      return data?.value || "";
    },
    userForToken: async (token) => (await storage.getSession(token))?.user ?? null,
    getUser: (id) => storage.getUser(id),
    // students only: a parent account carries its child's teacher too, and must not use up a place
    countTeacherStudents: async (teacherId) => (await storage.getTeacherStudents(teacherId)).filter((u: any) => (u.role || "student") === "student").length,
    countSchoolStudents: async (schoolId) => (await storage.getAllUsers()).filter((u: any) => (u.role || "student") === "student" && Number(u.school_id) === schoolId).length,
    countHubStudents: (teacherId) => countHubStudents(teacherId),
    schoolName: async (schoolId) => String((await storage.getAllSchools()).find((s: any) => Number(s.id) === schoolId)?.name || ""),
    schools: async () => (await storage.getAllSchools()).map((s: any) => ({ id: Number(s.id), name: String(s.name || "") })),
    // a school someone added at sign-up is never free just because of what it is called
    freeByNameAllowed: async (schoolId) => !(await schoolPicker.addedAtSignup(schoolId)),
    appUrl: APP_URL,
    envStripeKey: () => process.env.STRIPE_SECRET_KEY || "",
    envWebhookSecret: () => process.env.STRIPE_WEBHOOK_SECRET || "",
  });
  // Teacher Hub, the paid add-on: only teachers with a Teacher Hub plan can open it.
  registerTeacherHubRoutes(app, authMiddleware, { hubAccess: (user) => plans.hubAccess(user as any) });
  // Adding to the Hub from AI, photos, files, pasted text and connected calendars.
  registerTeacherHubImportRoutes(app, authMiddleware, { gate: createHubGate({ hubAccess: (user) => plans.hubAccess(user as any) }) });
  registerClubPlayRoutes(app, authMiddleware);
  registerLiveQuizRoutes(app, authMiddleware);
  // Study Squad: the study hall, its tables and study sets (kept in the settings table).
  registerStudyRoutes(app, authMiddleware, {
    getSetting: (key) => storage.getSetting(key),
    upsertSetting: (key, value) => storage.upsertSetting(key, value),
    aiKey: () => getPerplexityApiKey(),
    // An admin previewing the site as a student sees it unlocked.
    premium: (user, req) => (req?.adminPreview ? Promise.resolve(true) : plans.isPremium(user)),
  });
  registerClubAriseRoutes(app, authMiddleware);
  registerAriseNewsRoutes(app, authMiddleware);
  registerReadsRoutes(app);
  registerBuildWorldRoutes(app, authMiddleware);
  registerChessArenaRoutes(app, authMiddleware);
  registerBoardQuestRoutes(app, authMiddleware);
  registerPaintballArenaRoutes(app, authMiddleware, {
    httpServer,
    resolveToken: async (token) => (token ? (await storage.getSession(token))?.user ?? null : null),
  });
  registerRacingRoutes(app, authMiddleware, {
    httpServer,
    resolveToken: async (token) => (token ? (await storage.getSession(token))?.user ?? null : null),
    store: supabaseSaveStore(getAdminSupabase),
  });
  registerSkyboundRoutes(app, authMiddleware);
  const theaterCatalog = createTheaterCatalogStore(storage);
  // My World uses a lightweight grown-up math gate from the child's account.
  // These short-lived tokens are only an editing gate, not account authentication.
  const myWorldChallenges = new Map<string, { studentId: number; answer: number; expiresAt: number }>();
  const myWorldGrownupPasses = new Map<string, { studentId: number; expiresAt: number }>();
  const talkerChallenges = new Map<string, { studentId: number; answer: number; expiresAt: number }>();
  const talkerGrownupPasses = new Map<string, { studentId: number; expiresAt: number }>();

  type ParentStudentLinks = Record<string, number | number[]>;
  const normalizeLinkedIds = (value: unknown): number[] => {
    const raw = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
    return Array.from(new Set(raw.map(Number).filter(id => Number.isSafeInteger(id) && id > 0)));
  };
  const readParentStudentLinks = async (): Promise<ParentStudentLinks> => {
    const raw = await storage.getSetting('parent_student_links');
    if (!raw) return {};
    try { return JSON.parse(raw) as ParentStudentLinks; } catch { return {}; }
  };
  const getParentStudentIds = async (parentId: number): Promise<number[]> => {
    const links = await readParentStudentLinks();
    return normalizeLinkedIds(links[String(parentId)]);
  };
  const parentHasStudent = async (parentId: number, studentId: number) => {
    const ids = await getParentStudentIds(parentId);
    return ids.includes(Number(studentId));
  };
  const requestedParentStudentId = (req: any) => {
    const raw = req.query?.studentId ?? req.body?.studentId ?? req.headers['x-arise-child-id'];
    const id = Number(raw);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  };

  const getStudentParentIds = async (studentId: number): Promise<number[]> => {
    const links = await readParentStudentLinks();
    const parentIds: number[] = [];
    for (const [parentId, linkedValue] of Object.entries(links)) {
      if (normalizeLinkedIds(linkedValue).includes(Number(studentId))) {
        const id = Number(parentId);
        if (Number.isSafeInteger(id) && id > 0) parentIds.push(id);
      }
    }
    return Array.from(new Set(parentIds));
  };

  // Prizes that parents, teachers and schools put up for their own readers (kept in the settings table).
  // A teacher's requests pass the plan check above first, so class and school prizes are a Premium tool.
  const prizePerson = (u: any) => ({ id: Number(u.id), name: String(u.displayName || u.username || "Reader") });
  registerPrizeRoutes(app, authMiddleware, {
    getSetting: (key) => storage.getSetting(key),
    upsertSetting: (key, value) => storage.upsertSetting(key, value),
    // storage.getSetting turns a database error into "", which a save would then write back as an empty list
    readSetting: async (key) => {
      const { data, error } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
      if (error) throw new Error(error.message);
      return data?.value || "";
    },
    parentStudentIds: getParentStudentIds,
    studentParentIds: getStudentParentIds,
    getUser: (id) => storage.getUser(id),
    // a parent account carries its child's teacher too, so the roster is filtered down to students
    teacherStudents: async (teacherId) => (await storage.getTeacherStudents(teacherId)).filter((u: any) => (u.role || "student") === "student").map(prizePerson),
    // a school's students are the ones its teachers have approved into a class
    schoolStudents: async (schoolId) => {
      const users = await storage.getAllUsers();
      const teachers = new Set(users.filter((u: any) => u.role === "teacher" && u.accountApproved !== false && Number(u.school_id) === schoolId).map((u: any) => Number(u.id)));
      return users
        .filter((u: any) => (u.role || "student") === "student" && teachers.has(Number(u.teacherId)) && u.approvedByTeacher !== false)
        .map(prizePerson)
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
    schoolName: async (schoolId) => String((await storage.getAllSchools()).find((s: any) => Number(s.id) === schoolId)?.name || ""),
    passedQuizTimes: async (studentId) => (await storage.getUserAttempts(studentId))
      .filter((a: any) => a && a.score >= arPassingScore(a.totalQuestions || 10))
      .map((a: any) => Date.parse(a.completedAt)),
    notify: async (studentId, text) => { await storage.createMessage(studentId, "system", text); },
  });

  const isDemoStudent = (user: any) => {
    const username = String(user?.username || "").toLowerCase();
    return username.startsWith("sample") || username === "tutorial-eye";
  };
  /** Each student's grade (kept in the user_grades setting). */
  const studentGrades = async (): Promise<Record<string, string>> => {
    try { const raw = await storage.getSetting("user_grades"); const v = raw ? JSON.parse(raw) : {}; return v && typeof v === "object" ? v : {}; }
    catch { return {}; }
  };
  /** What anyone may see about a teacher on the public sign-up pages. */
  const publicTeacher = (t: any) => ({ id: t.id, display_name: t.display_name, displayName: t.display_name, role: t.role, school_id: t.school_id });
  /** The signed-in session for a public route, if the request carries one. */
  const sessionFromRequest = async (req: any) => {
    const token = String(req.headers?.authorization || "").replace("Bearer ", "");
    if (!token) return null;
    try { return await storage.getSession(token); } catch { return null; }
  };
  /** A teacher or the admin looking at a quiz as staff (not previewing it as a student). */
  const isStaffViewer = (req: any) => !req.adminPreview && !isDemoStudent(req.user) && (req.user?.isAdmin === true || req.user?.role === "teacher");
  /** Quiz questions without the answer key, for anyone taking the quiz. */
  const withoutAnswers = (questions: any[] | undefined) => (questions || []).map(({ correct_answer: _answer, ...rest }: any) => rest);
  /** Checks one answer of an Eye Gazer or custom quiz, so the quiz can cheer right away without sending the answer key. */
  const checkOneAnswer = async (
    req: any,
    res: any,
    table: "eye_gaze_attempts" | "custom_eye_gaze_attempts",
    loadQuestions: (quizId: number) => Promise<any[]>,
  ) => {
    try {
      const attemptId = parseInt(req.params.attemptId);
      const questionId = Number(req.body?.questionId);
      const answer = String(req.body?.answer || "").trim();
      if (!Number.isSafeInteger(attemptId) || !Number.isSafeInteger(questionId) || !answer) {
        return res.status(400).json({ message: "Choose an answer first." });
      }
      if (attemptId < 0) {
        // previews (staff, admin preview and the sample accounts) aren't saved
        const canPreview = req.adminPreview || isDemoStudent(req.user) || req.user?.isAdmin || req.user?.role === "teacher";
        if (!canPreview) return res.status(403).json({ message: "Start the quiz first." });
        const question = (await loadQuestions(-attemptId)).find((q: any) => Number(q.id) === questionId);
        if (!question) return res.status(404).json({ message: "Question not found." });
        return res.json({ correct: answer === String(question.correct_answer || "") });
      }
      const recorded = await storage.recordQuizAnswer(table, attemptId, req.user.id, questionId, answer);
      if (!recorded) return res.status(409).json({ message: "This quiz is already finished." });
      const question = (await loadQuestions(recorded.quizId)).find((q: any) => Number(q.id) === questionId);
      if (!question) return res.status(404).json({ message: "Question not found." });
      res.json({ correct: recorded.answer === String(question.correct_answer || ""), answer: recorded.answer });
    } catch (error: any) {
      res.status(500).json({ message: "Could not check that answer." });
    }
  };
  /** A real student, not an admin preview, a sample account or staff trying something out. */
  const isRealStudentRequest = (req: any) =>
    !req.adminPreview && !req.user?.isAdmin && (req.user?.role || "student") === "student" && !isDemoStudent(req.user);
  const alertAssessment = async (req: any, assessment: { kind: string; score: number; total: number; level?: string; proctor?: string; extra?: [string, string][] }) => {
    if (!isRealStudentRequest(req)) return;
    try {
      const facts = await studentFacts(req.user);
      const name = personName(req.user);
      const pct = assessment.total > 0 ? Math.round((assessment.score / assessment.total) * 100) : 0;
      await adminAlerts.notify("assessment_completed", {
        title: `${assessment.kind}: ${name} scored ${assessment.score}/${assessment.total}`,
        summary: [`${pct}%`, assessment.level, assessment.proctor].filter(Boolean).join(" · "),
        lines: [
          ["Student", `${name} (@${req.user?.username || "?"})`],
          ["Grade", facts.grade],
          ["School", facts.school],
          ["Teacher", facts.teacher],
          ["Score", `${assessment.score}/${assessment.total} (${pct}%)`],
          ["Reading level", assessment.level],
          ["Proctor", assessment.proctor],
          ...(assessment.extra || []),
        ],
        ref: `u${req.user?.id}`,
      });
    } catch (e: any) {
      console.error("[admin-alerts] assessment alert failed:", e?.message);
    }
  };
  const readingLevelLabel = (level: unknown, grade?: unknown) => {
    const names: Record<string, string> = { independent: "Independent", instructional: "Instructional", needs_support: "Needs support", frustration: "Too hard for now" };
    const label = names[String(level || "")] || "";
    return [label, grade ? `Grade ${grade} level` : ""].filter(Boolean).join(" · ");
  };

  const getOrCreateParentInvite = async (studentId: number) => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Parent codes are not configured.");
    const adminDb = getAdminSupabase();
    let { data: invite, error } = await adminDb.from("parent_invite_codes")
      .select("code").eq("student_id", studentId).maybeSingle();
    if (error) throw error;
    if (!invite) {
      const code = randomBytes(10).toString("hex").toUpperCase();
      const inserted = await adminDb.from("parent_invite_codes")
        .upsert({ student_id: studentId, code }, { onConflict: "student_id", ignoreDuplicates: true })
        .select("code").maybeSingle();
      if (inserted.error) throw inserted.error;
      invite = inserted.data;
      if (!invite) {
        const again = await adminDb.from("parent_invite_codes").select("code").eq("student_id", studentId).single();
        if (again.error) throw again.error;
        invite = again.data;
      }
    }
    const rawCode = String(invite!.code);
    return { rawCode, formattedCode: rawCode.match(/.{1,4}/g)?.join("-") || rawCode };
  };

  const getOrCreateParentProctorPassword = async (parentId: number): Promise<string> => {
    const adminDb = getAdminSupabase();
    const existing = await adminDb.from("parent_proctor_credentials")
      .select("password").eq("parent_id", parentId).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data?.password) return String(existing.data.password);

    for (let attempt = 0; attempt < 12; attempt++) {
      const value = (100000 + (parseInt(randomBytes(4).toString("hex"), 16) % 900000)).toString();
      const inserted = await adminDb.from("parent_proctor_credentials").insert({
        parent_id: parentId,
        password: value,
        updated_at: new Date().toISOString(),
      }).select("password").maybeSingle();
      if (!inserted.error && inserted.data?.password) return String(inserted.data.password);
      if (inserted.error?.code !== "23505") throw inserted.error;
    }
    throw new Error("Could not create a unique parent proctor code.");
  };

  type QuizKind = "book" | "eye_gaze" | "custom_eye_gaze" | "reading_assessment";
  type ProctorIdentity = { type: "parent" | "teacher"; userId: number | null; name: string };

  const createProctorSession = async (studentId: number, quizKind: QuizKind, quizId: number, proctor: ProctorIdentity) => {
    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const { error } = await getAdminSupabase().from("quiz_proctor_sessions").insert({
      token,
      student_id: studentId,
      quiz_kind: quizKind,
      quiz_id: quizId,
      proctor_type: proctor.type,
      proctor_user_id: proctor.userId,
      proctor_name: proctor.name,
      expires_at: expiresAt,
    });
    if (error) throw error;
    return { token, expiresAt };
  };

  const validateProctorSession = async (
    token: string,
    studentId: number,
    quizKind: QuizKind,
    quizId: number,
    consume = false
  ): Promise<ProctorIdentity | null> => {
    if (!token) return null;
    const adminDb = getAdminSupabase();
    const { data, error } = await adminDb.from("quiz_proctor_sessions").select("*")
      .eq("token", token)
      .eq("student_id", studentId)
      .eq("quiz_kind", quizKind)
      .eq("quiz_id", quizId)
      .maybeSingle();
    if (error || !data || data.used_at || new Date(data.expires_at).getTime() <= Date.now()) return null;
    if (consume) {
      const { error: updateError } = await adminDb.from("quiz_proctor_sessions")
        .update({ used_at: new Date().toISOString() }).eq("token", token).is("used_at", null);
      if (updateError) return null;
    }
    return {
      type: data.proctor_type === "parent" ? "parent" : "teacher",
      userId: data.proctor_user_id ?? null,
      name: String(data.proctor_name || (data.proctor_type === "parent" ? "Parent / Guardian" : "Teacher / School Staff")),
    };
  };

  // No-proctor quizzes: the student picks this instead of a proctor code; the camera
  // takes snapshots and teachers, parents and the admin review the record later.
  const noProctor = registerQuizIntegrityRoutes(app, authMiddleware, {
    db: getAdminSupabase,
    isDemoStudent,
    hasAttempt: async (userId, _quizKind, quizId) => !!(await storage.getAttempt(userId, quizId)),
    getTeacherStudentIds: async (teacherId) => (await storage.getTeacherStudents(teacherId)).map((student: any) => Number(student.id)),
    getParentStudentIds,
    setAttemptPoints: (attemptId, points) => storage.setAttemptPoints(attemptId, points),
  });
  // Seed data on startup
  await seedData();
  await storage.seedEyeGazeQuizzes();
  await storage.seedExtraEyeGazeQuizzes();

  // Students who picked "Independent Reader" in the old school list become independent students.
  // Runs in the background on every start; once they are moved there is nothing left to do.
  void transferIndependentStudents({
    schools: async () => (await storage.getAllSchools()).map((s: any) => ({ id: Number(s.id), name: String(s.name || "") })),
    studentsAtSchool: async (schoolId) => {
      const { data, error } = await supabase.from("users")
        .select("id, username, display_name, role, is_admin, teacher_id, class_id, approved_by_teacher").eq("school_id", schoolId);
      if (error) throw new Error(error.message);
      return (data || [])
        .filter((row: any) => !row.is_admin && (row.role || "student") === "student")
        .map((row: any) => ({
          id: Number(row.id), username: String(row.username || ""), displayName: String(row.display_name || row.username || ""),
          teacherId: row.teacher_id ? Number(row.teacher_id) : null, classId: row.class_id ? Number(row.class_id) : null,
          approvedByTeacher: row.approved_by_teacher !== false,
        }));
    },
    teacherSchoolId: async (teacherId) => {
      const teacher = await storage.getUser(teacherId);
      return teacher && teacher.role === "teacher" && teacher.school_id ? Number(teacher.school_id) : null;
    },
    detach: async (studentId) => {
      const { error } = await supabase.from("users")
        .update({ school_id: null, teacher_id: null, class_id: null, approved_by_teacher: true }).eq("id", studentId);
      if (error) throw new Error(error.message);
    },
    getSetting: (key) => storage.getSetting(key),
    upsertSetting: (key, value) => storage.upsertSetting(key, value),
    notifyAdmins: async (title, message) => {
      const { data: adminRows } = await supabase.from("users").select("id").eq("is_admin", true);
      for (const admin of adminRows || []) await supabase.from("notifications").insert({ user_id: admin.id, type: "info", title, message });
    },
  }).then((result) => {
    if (result.moved) { try { clearCache("allUsers"); } catch {} }
    if (result.moved || result.kept) console.log(`[independent-transfer] moved ${result.moved}, left ${result.kept} (${result.schools.join(", ")})`);
  }).catch((e: any) => console.error("[independent-transfer] failed:", e?.message));

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
      const { username, password, displayName, isEyeGazeUser, gradeLevel } = req.body;
      let { teacherId, schoolId } = req.body;
      if (!username || !password || !displayName) {
        return res.status(400).json({ message: "All fields are required" });
      }
      // "Independent Reader" is no longer a school to pick: independent students have their own sign-up.
      // A page that was opened before this change can still send it, so it is treated as that sign-up.
      let pickedIndependentSchool = false;
      if (schoolId && !req.body.independent) {
        try {
          const picked = (await storage.getAllSchools()).find((s: any) => Number(s.id) === parseInt(schoolId));
          pickedIndependentSchool = !!picked && isIndependentSchoolName(picked.name);
        } catch {}
      }
      if (req.body.independent || pickedIndependentSchool) { teacherId = null; schoolId = null; }
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

      // The school: one already on the site, or one picked from the US list (added to the site now).
      let pickedSchoolName = "";
      if (!req.body.independent && !pickedIndependentSchool) {
        try {
          const picked = await schoolPicker.pick({ schoolId, directorySchool: req.body.directorySchool }, "student");
          // over the hourly limit for new schools: the account is made and the admin connects the school
          if (picked.schoolId === null && picked.schoolName) pickedSchoolName = picked.schoolName;
          schoolId = picked.schoolId;
        } catch (e: any) {
          if (e instanceof SchoolPickError) return res.status(400).json({ message: e.message });
          throw e;
        }
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

      // "School/teacher not listed": these are school students, not independent
      // (homeschool) readers. They get a normal, fully approved student account
      // right away; "teacher not listed" students keep the school they picked.
      // Save what they typed so an admin can connect them later.
      // An independent student has no school or teacher to be connected to.
      const noSchool = !!req.body.independent || pickedIndependentSchool;
      const unlistedSchoolName = noSchool ? "" : pickedSchoolName || (typeof req.body.unlistedSchoolName === "string" ? req.body.unlistedSchoolName.trim().slice(0, 120) : "");
      const unlistedTeacherName = !noSchool && typeof req.body.unlistedTeacherName === "string" ? req.body.unlistedTeacherName.trim().slice(0, 120) : "";
      // Remember how every student signed up so school-not-listed students
      // are never confused with independent readers (both start with no school).
      try {
        const signupType = req.body.independent || pickedIndependentSchool ? "independent"
          : unlistedSchoolName ? "school_not_listed"
          : unlistedTeacherName ? "teacher_not_listed"
          : "school";
        const rawTypes = await storage.getSetting("student_signup_types");
        let signupTypes: Record<string, string> = {};
        if (rawTypes) { try { signupTypes = JSON.parse(rawTypes); } catch {} }
        signupTypes[String(user.id)] = signupType;
        await storage.upsertSetting("student_signup_types", JSON.stringify(signupTypes));
      } catch {}

      if (unlistedSchoolName || unlistedTeacherName) {
        try {
          const requests = await readUnlistedSignups();
          requests.push({
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
            gradeLevel: gradeLevel || null,
            schoolId: schoolId ? parseInt(schoolId) : null,
            schoolName: unlistedSchoolName || null,
            teacherName: unlistedTeacherName || null,
            createdAt: new Date().toISOString(),
            resolved: false,
          });
          // The bell shows this from the list itself until the admin connects them.
          await storage.upsertSetting(UNLISTED_SIGNUPS_KEY, JSON.stringify(requests));
        } catch (e: any) {
          console.error("[unlisted-signups] save failed:", e?.message);
        }
      }

      void (async () => {
        if (!user) return;
        const facts = await studentFacts({ id: user.id, school_id: user.school_id, teacherId: user.teacherId });
        const schoolText = noSchool ? "Independent reader (no school)" : facts.school || (unlistedSchoolName ? `Not listed: “${unlistedSchoolName}”` : "");
        const teacherText = facts.teacher
          ? `${facts.teacher}${user.approvedByTeacher === false ? " (waiting for their OK)" : ""}`
          : unlistedTeacherName ? `Not listed: “${unlistedTeacherName}”` : "";
        await adminAlerts.notify("student_signup", {
          title: `New student: ${user.displayName}`,
          summary: [`@${user.username}`, (gradeLevel || facts.grade) && `Grade ${gradeLevel || facts.grade}`, schoolText, teacherText && `Teacher: ${teacherText}`].filter(Boolean).join(" · "),
          lines: [
            ["Student", `${user.displayName} (@${user.username})`],
            ["Grade", gradeLevel || facts.grade],
            ["School", schoolText],
            ["Teacher", teacherText],
            ["Account", isEyeGazeUser ? "Eye Gazer" : "Reader"],
          ],
          note: unlistedSchoolName || unlistedTeacherName ? "Their school or teacher wasn't in the list. Connect them under Admin → People → Students." : undefined,
          ref: `u${user.id}`,
        });
      })();

      const session = await storage.createSession(user.id);
      res.status(201).json({
        token: session.token,
        user: { id: user.id, username: user.username, displayName: user.displayName, isAdmin: user.isAdmin, is_eye_gaze_user: user.is_eye_gaze_user, role: user.role, teacherId: user.teacherId, approvedByTeacher: user.approvedByTeacher, accountApproved: user.accountApproved, schoolId: user.school_id, totalPoints: user.totalPoints || 0 },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: students who signed up with "school/teacher not listed"
  app.get("/api/admin/unlisted-signups", authMiddleware, adminMiddleware, async (_req, res) => {
    try {
      const requests = await readUnlistedSignups();
      res.set("Cache-Control", "no-store");
      res.json(requests.filter(r => !r.resolved).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: connect the student to a school and/or teacher, or just dismiss the request
  app.post("/api/admin/unlisted-signups/:userId/resolve", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const studentId = parseInt(req.params.userId);
      const schoolId = req.body.schoolId ? parseInt(req.body.schoolId) : null;
      const teacherId = req.body.teacherId ? parseInt(req.body.teacherId) : null;
      if (schoolId) await storage.assignStudentToSchool(studentId, schoolId);
      if (teacherId) {
        const teacher = await storage.getUser(teacherId);
        if (!teacher || teacher.role !== "teacher") return res.status(400).json({ message: "That teacher was not found." });
        // Keep the student approved so they never lose access while being moved.
        const { error } = await supabase.from("users").update({ teacher_id: teacherId, approved_by_teacher: true }).eq("id", studentId);
        if (error) throw new Error(error.message);
        const rawLinks = await storage.getSetting("teacher_students");
        let teacherStudents: Record<string, number[]> = {};
        if (rawLinks) { try { teacherStudents = JSON.parse(rawLinks); } catch {} }
        for (const [tid, sids] of Object.entries(teacherStudents)) {
          teacherStudents[tid] = (sids as number[]).filter((sid: number) => sid !== studentId);
        }
        if (!teacherStudents[String(teacherId)]) teacherStudents[String(teacherId)] = [];
        teacherStudents[String(teacherId)].push(studentId);
        await storage.upsertSetting("teacher_students", JSON.stringify(teacherStudents));
        try { clearCache("allUsers"); } catch {}
        await storage.createMessage(studentId, "teacher", `You have been added to ${teacher.displayName}'s class.`);
      }
      const requests = await readUnlistedSignups();
      for (const r of requests) {
        if (r.userId === studentId && !r.resolved) {
          r.resolved = true;
          r.resolvedAt = new Date().toISOString();
          r.resolvedTeacherId = teacherId;
          r.resolvedSchoolId = schoolId;
        }
      }
      await storage.upsertSetting(UNLISTED_SIGNUPS_KEY, JSON.stringify(requests));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Teacher signup. A school email (.edu, .net, .org or .us) is required. The teacher confirms it with the
  // code emailed to it and is let in at once; the admin only steps in if that email can't be sent.
  app.post("/api/auth/register-teacher", async (req, res) => {
    try {
      const { username, password, displayName, email, schoolId, gradeLevel, gradesTaught } = req.body;
      if (!username || !password || !displayName) {
        return res.status(400).json({ message: "All fields are required" });
      }
      // checked before anything is made, so a refused email leaves no account and no school behind
      const schoolEmail = checkSchoolEmail(email);
      if (!schoolEmail.ok) {
        return res.status(400).json({ message: schoolEmail.message });
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

      // The school: one already on the site, one picked from the US list, or one the teacher typed
      // because it was in neither. A typed school shows for everyone else once this teacher's account is on.
      let pickedSchool: Awaited<ReturnType<typeof schoolPicker.pick>>;
      try {
        pickedSchool = await schoolPicker.pick({ schoolId, directorySchool: req.body.directorySchool, newSchool: req.body.newSchool }, "teacher");
      } catch (e: any) {
        if (e instanceof SchoolPickError) return res.status(400).json({ message: e.message });
        throw e;
      }

      const hashedPassword = bcrypt.hashSync(password, 10);
      const user = await storage.createUser({
        username: username.toLowerCase(),
        password: hashedPassword,
        displayName,
        role: 'teacher',
        // off until the teacher types the code from their school email
        accountApproved: false,
        email: schoolEmail.email,
        schoolId: pickedSchool.schoolId,
      });
      if (!user) throw new Error('Could not create teacher account.');
      if (!pickedSchool.schoolId && pickedSchool.schoolName) {
        // The school could not be added just now (too many new schools in the last hour). Don't lose its name.
        try {
          const { data: adminRows } = await supabase.from("users").select("id").eq("is_admin", true);
          for (const admin of adminRows || []) {
            await supabase.from("notifications").insert({
              user_id: admin.id,
              type: "info",
              title: "Teacher needs a school connection",
              message: `${displayName} (@${username.toLowerCase()}) signed up for “${pickedSchool.schoolName}”, but the school could not be added automatically. Add it under Schools & Classes and connect them.`,
            });
          }
        } catch (e: any) {
          console.error("[schools] could not tell the admin about a teacher's school:", e?.message);
        }
      }
      if (pickedSchool.schoolId && pickedSchool.added === "teacher") {
        try {
          await schoolPicker.setAddedBy(pickedSchool.schoolId, user.id);
          const { data: adminRows } = await supabase.from("users").select("id").eq("is_admin", true);
          for (const admin of adminRows || []) {
            await supabase.from("notifications").insert({
              user_id: admin.id,
              type: "info",
              title: "A teacher added a school",
              message: `${displayName} (@${username.toLowerCase()}) signed up with a school that wasn't in the list: “${pickedSchool.schoolName}”. Other people will see it in the school search once this teacher confirms their school email. If it isn't a real school, remove it under Schools & Classes.`,
            });
          }
        } catch (e: any) {
          console.error("[schools] could not record the teacher's school:", e?.message);
        }
      }

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

      // Email the code that turns the account on. Sent BEFORE responding so it actually executes.
      let codeSent = false;
      try {
        const issued = await teacherEmailCodes.issue(user.id);
        if (issued.ok) {
          codeSent = await sendTeacherCode({ id: user.id, username: user.username, displayName, email: schoolEmail.email }, issued.code);
          if (!codeSent) await teacherEmailCodes.forget(user.id).catch(() => {});
        }
      } catch (e: any) {
        console.error("[teacher-signup] could not make a code:", e?.message);
      }
      if (codeSent) {
        return res.status(201).json({
          success: true,
          confirmEmail: true,
          username: user.username,
          email: schoolEmail.email,
          message: `We sent a 6-digit code to ${schoolEmail.email}. Enter it to turn on your account.`,
        });
      }

      // The code could not be emailed, so this one account goes to the admin the way every sign-up used to.
      // The bell already lists teachers whose account isn't on, so this alert is the email only.
      alertAdmin("teacher_signup", {
        title: `Teacher needs you to turn their account on: ${displayName}`,
        summary: [`@${user.username}`, schoolEmail.email, pickedSchool.schoolName].filter(Boolean).join(" · "),
        lines: [["Teacher", displayName], ["Username", `@${user.username}`], ["School email", schoolEmail.email], ["School", pickedSchool.schoolName]],
        note: "We couldn't email them their confirmation code. Check the address, then turn the account on under Admin → People → Teachers.",
        ref: `u${user.id}`,
        row: false,
      });

      res.status(201).json({
        success: true,
        confirmEmail: false,
        username: user.username,
        email: schoolEmail.email,
        message: "Your account was created, but we couldn't email your confirmation code just now. The site admin has been told and will turn your account on. You can also try sending the code again.",
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // The teacher typed the code from their school email: the account turns on at once.
  app.post("/api/auth/confirm-teacher-email", async (req, res) => {
    try {
      const reply = await confirmTeacherEmail(teacherConfirmDeps, req.body);
      res.status(reply.status).json(reply.body);
    } catch (err: any) {
      console.error("[teacher-signup] confirm failed:", err?.message);
      res.status(500).json({ message: "We couldn't confirm your code just now. Please try again." });
    }
  });

  // The teacher asked for the code to be sent again.
  app.post("/api/auth/resend-teacher-code", async (req, res) => {
    try {
      const reply = await resendTeacherCode(teacherConfirmDeps, req.body);
      res.status(reply.status).json(reply.body);
    } catch (err: any) {
      console.error("[teacher-signup] resend failed:", err?.message);
      res.status(500).json({ message: "We couldn't send a new code just now. Please try again." });
    }
  });

  app.post("/api/auth/register-parent", async (req, res) => {
    try {
      const { username, password, displayName, email, parentCode } = req.body;
      if (!username || !password || !displayName) {
        return res.status(400).json({ message: "All fields are required" });
      }
      if (username.length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      const normalizedCode = typeof parentCode === 'string' ? parentCode.replace(/[-\s]/g, '').toUpperCase() : '';
      if (!/^[A-F0-9]{20}$/.test(normalizedCode)) {
        return res.status(400).json({ message: "Enter the parent code from your child's school handout." });
      }

      const existing = await storage.getUserByUsername(username.toLowerCase());
      if (existing) {
        return res.status(409).json({ message: "Username already taken" });
      }

      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ message: "Parent codes are not configured yet." });
      const { data: invite, error: inviteError } = await getAdminSupabase().from('parent_invite_codes')
        .select('student_id').eq('code', normalizedCode).maybeSingle();
      if (inviteError) return res.status(503).json({ message: "Parent codes are unavailable right now." });
      if (!invite) return res.status(400).json({ message: "That parent code was not found. Please check the handout." });
      const student = await storage.getUser(invite.student_id);
      if (!student || student.role !== 'student') return res.status(400).json({ message: "That parent code was not found. Please check the handout." });

      const hashedPassword = bcrypt.hashSync(password, 10);
      const user = await storage.createUser({
        username: username.toLowerCase(),
        password: hashedPassword,
        displayName,
        role: 'parent',
        accountApproved: true,
        email: email || null,
        schoolId: student.school_id || null,
        teacherId: student.teacherId || null,
      });
      if (!user) throw new Error('Could not create parent account.');

      // Link parent to student by storing parent_id in a setting
      const rawLinks = await storage.getSetting('parent_student_links');
      let parentLinks: ParentStudentLinks = {};
      if (rawLinks) { try { parentLinks = JSON.parse(rawLinks); } catch {} }
      parentLinks[String(user.id)] = [student.id];
      await storage.upsertSetting('parent_student_links', JSON.stringify(parentLinks));

      alertAdmin("parent_signup", {
        title: `New parent: ${displayName}`,
        summary: [`@${user.username}`, `Parent of ${student.displayName}`, email].filter(Boolean).join(" · "),
        lines: [["Parent", `${displayName} (@${user.username})`], ["Email", email || ""], ["Student", `${student.displayName} (@${student.username})`]],
        note: "They used the parent code from the student's handout, so the account is already connected.",
        ref: `u${user.id}`,
      });

      res.status(201).json({
        success: true,
        message: "Your account is ready and connected to your student. You can log in now.",
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      // Slow down password guessing: 10 misses per account (100 per network) in 15 minutes.
      const nameKey = username.trim().toLowerCase();
      const addressKey = clientAddress(req);
      const wait = Math.max(loginFailsByName.retryAfter(nameKey), loginFailsByAddress.retryAfter(addressKey));
      if (wait > 0) {
        res.set("Retry-After", String(Math.ceil(wait / 1000)));
        return res.status(429).json({ message: `Too many wrong passwords. Try again in ${waitWords(wait)}, or ask your teacher to reset your password.` });
      }

      const user = await storage.getUserByUsername(nameKey);
      if (!user || !(await bcrypt.compare(password, user.password))) {
        loginFailsByName.fail(nameKey);
        loginFailsByAddress.fail(addressKey);
        return res.status(401).json({ message: "Invalid username or password" });
      }
      loginFailsByName.reset(nameKey);

      if (user.archivedAt) {
        return res.status(403).json({ message: "This account is archived. Ask your teacher or the site admin to restore it." });
      }

      // A new teacher whose school email is not confirmed yet is sent to type the code.
      if (user.role === 'teacher' && !user.accountApproved) {
        let waitingForCode = false;
        try { waitingForCode = await teacherEmailCodes.waiting(user.id); } catch {}
        if (waitingForCode) {
          return res.status(403).json({
            message: "Your teacher account is almost ready. Enter the 6-digit code we emailed to your school address to turn it on.",
            confirmEmail: true,
            username: user.username,
          });
        }
      }

      // Teachers from before school emails were required, and parents, must be approved by admin
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
      // every sign-in (students, teachers and parents) is logged for the admin's Stats tab and student activity
      if (!user.isAdmin) void recordLogin(user.id, req.get("user-agent"));

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
    // Always the signed-in account. During an admin's student preview the app keeps
    // the admin account and layers the preview on top; answering with the preview
    // student here made the app forget it was an admin (Club Arise then refused it).
    const me = req.adminPreview && req.realUser ? req.realUser : req.user;
    res.set("Cache-Control", "no-store");
    res.json({
      id: me.id,
      username: me.username,
      displayName: me.displayName,
      isAdmin: me.isAdmin,
      role: me.role || 'student',
      teacherId: me.teacherId || null,
      approvedByTeacher: me.approvedByTeacher,
      accountApproved: me.accountApproved,
      is_eye_gaze_user: me.is_eye_gaze_user || false,
      email: me.email || null,
      schoolId: me.school_id || null,
      totalPoints: me.totalPoints || 0,
    });
  });

  // Book routes
  // Admin endpoint to clear in-memory cache
  app.post("/api/admin/clear-cache", authMiddleware, async (req: any, res) => {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin only' });
    clearCache('allBooks');
    clearCache('allUsers');
    clearCache('leaderboard');
    clearCache('monthlyLeaderboard');
    clearCache('eye_gaze_leaderboard');
    res.json({ success: true, message: 'All caches cleared' });
  });

  // Debug endpoint to check book count
  app.get("/api/admin/debug-books", authMiddleware, async (req: any, res) => {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Admin only' });
    const allBooks = await storage.getAllBooks();
    const withPoints = allBooks.filter((b: any) => b.pointsValue > 0);
    const mamba = allBooks.find((b: any) => b.title && b.title.includes('Mamba'));
    res.json({ totalBooks: allBooks.length, withPoints: withPoints.length, mambaFound: !!mamba, mambaId: mamba?.id });
  });

  // Two farm animal models are hosted on a site that browsers may not load from other sites
  // (it sends no CORS header), so the server fetches them once and serves them itself.
  const FARM_MODELS: Record<string, string> = {
    cow: "https://static.poly.pizza/382b3d4a-a7c9-4c03-9858-3df630d90047.glb",
    horse: "https://static.poly.pizza/d37dbc87-ca61-4b2c-a2da-d2f0c4240bef.glb",
  };
  const farmModelCache = new Map<string, Buffer>();
  app.get("/api/farm-models/:name", async (req, res) => {
    const name = String(req.params.name || "");
    const url = FARM_MODELS[name];
    if (!url) return res.status(404).end();
    try {
      let bytes = farmModelCache.get(name);
      if (!bytes) {
        const upstream = await fetch(url, { headers: { "User-Agent": "ARISEReader/1.0 (https://www.arisereader.com)" }, signal: AbortSignal.timeout(20000) });
        if (!upstream.ok) return res.status(502).end();
        bytes = Buffer.from(await upstream.arrayBuffer());
        if (bytes.length < 25_000_000) farmModelCache.set(name, bytes);
      }
      res.setHeader("Content-Type", "model/gltf-binary");
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      res.send(bytes);
    } catch {
      res.status(502).end();
    }
  });

  app.get("/api/book-cover/:id", async (req, res) => {
    try {
      const bookId = Number(req.params.id);
      if (!Number.isFinite(bookId)) return res.status(400).end();

      const book = await storage.getBook(bookId);
      if (!book?.coverUrl) return res.status(404).end();

      // Local covers live in the built client under /covers/*.
      // Redirect them instead of passing a relative path to Node fetch(),
      // which requires an absolute URL and was causing iARISE covers to 502.
      if (book.coverUrl.startsWith("/")) {
        res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
        return res.redirect(302, book.coverUrl);
      }

      const upstream = await fetch(book.coverUrl, {
        headers: {
          // Wikimedia refuses requests without a descriptive user agent
          "User-Agent": "ARISEReader/1.0 (https://www.arisereader.com; reading app for schools)",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(10000),
      }).catch(() => null);
      // If the server can't fetch it, let the browser try the picture itself.
      if (!upstream || !upstream.ok) return res.redirect(302, book.coverUrl);

      const type = upstream.headers.get("content-type") || "image/jpeg";
      const bytes = Buffer.from(await upstream.arrayBuffer());
      res.setHeader("Content-Type", type);
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      res.send(bytes);
    } catch {
      res.status(502).end();
    }
  });

  app.get("/api/books", authMiddleware, async (req: any, res) => {
    const allBooks = await storage.getAllBooks();
    // Regular library only shows books with a quiz to take: worth points AND with questions.
    // (Some books were imported with points but no questions; opening them led to an empty quiz.)
    // FYP feed uses a separate endpoint and shows ALL books
    let quizIds: Set<number> | null = null;
    try { quizIds = await storage.getQuizBookIds(); } catch { quizIds = null; }
    const books = allBooks.filter((b: any) => b.pointsValue > 0 && (!quizIds || quizIds.has(Number(b.id))));

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
      if (!new Set(['anime_comic_book_ids', 'class_reading_book_ids', 'hispanic_heritage_picks_v1']).has(req.params.key)) {
        return res.status(404).json({ message: 'Setting not found' });
      }
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

    const sampleAccount = isDemoStudent(req.user);

    // Admin preview and sample accounts can retake quizzes freely without creating student records.
    if (!req.adminPreview && !sampleAccount) {
      const existingAttempt = await storage.getAttempt(req.user.id, bookId);
      if (existingAttempt) {
        return res.status(403).json({ message: "You have already taken this quiz", score: existingAttempt.score, total: existingAttempt.totalQuestions, points: existingAttempt.pointsEarned || 0 });
      }
    }

    const book = await storage.getBook(bookId);
    if (!book) return res.status(404).json({ message: "Book not found" });

    const allQuestions = await storage.getQuestionsByBook(bookId);
    // Strip correct answers before sending to client, and show each student the choices
    // in their own order (see server/quizShuffle.ts); grading turns them back.
    const safeQuestions = allQuestions.map(q => shuffleChoices({
      id: q.id,
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      questionOrder: q.questionOrder,
    }, req.user.id));

    res.set("Cache-Control", "no-store");
    res.json({ book, questions: safeQuestions });
  });

  // Submit quiz
  app.post("/api/books/:id/quiz", authMiddleware, async (req: any, res) => {
    const bookId = parseInt(req.params.id);

    const sampleAccount = isDemoStudent(req.user);

    // Admin preview and sample accounts can take the full quiz repeatedly without persisting attempts.
    if (!req.adminPreview && !sampleAccount) {
      const existingAttempt = await storage.getAttempt(req.user.id, bookId);
      if (existingAttempt) {
        return res.status(403).json({ message: "You have already taken this quiz" });
      }
    }

    // No grade band restriction — all students can take any quiz
    const book = await storage.getBook(bookId);
    const effectivePoints = Number(book?.pointsValue ?? 0);

    const { answers, proctorSessionToken, integritySessionToken } = req.body; // { questionId: "A"|"B"|"C"|"D" }
    if (!answers || typeof answers !== "object") {
      return res.status(400).json({ message: "Answers are required" });
    }

    let verifiedProctor: ProctorIdentity | { type: "camera"; userId: null; name: string } | null = null;
    let integritySession: Awaited<ReturnType<typeof noProctor.checkForSubmit>> = null;
    if (!req.adminPreview && !sampleAccount) {
      if (integritySessionToken) {
        // No-proctor quiz: the camera session stands in for the proctor.
        integritySession = await noProctor.checkForSubmit(String(integritySessionToken), req.user.id, "book", bookId);
        if (!integritySession) {
          return res.status(403).json({ message: "This no-proctor quiz session ended. Go back to the library and start the quiz again." });
        }
        verifiedProctor = { type: "camera", userId: null, name: "No proctor (camera)" };
      } else {
        verifiedProctor = await validateProctorSession(
          String(proctorSessionToken || ""),
          req.user.id,
          "book",
          bookId,
          true
        );
        if (!verifiedProctor) {
          return res.status(403).json({ message: "Your proctor session expired or is not valid. Ask your parent/guardian or teacher to enter the proctor code again." });
        }
      }
    }

    const allQuestions = await storage.getQuestionsByBook(bookId);
    if (allQuestions.length === 0) {
      return res.status(404).json({ message: "No questions found for this book" });
    }

    // The student picked letters in their own order of the choices; turn them back into the
    // stored letters before grading and saving (see server/quizShuffle.ts).
    const normalizedAnswers: Record<string, string> = {};
    for (const q of allQuestions) {
      const picked = String((answers as Record<string, unknown>)[String(q.id)] ?? "").trim().toUpperCase();
      if (picked) normalizedAnswers[String(q.id)] = storedLetter(q, req.user.id, picked);
    }

    let score = 0;
    for (const q of allQuestions) {
      const userAnswer = String(normalizedAnswers[String(q.id)] || "").trim().toUpperCase();
      const correctAnswer = String(q.correctAnswer || "").trim().toUpperCase();
      if (userAnswer && userAnswer === correctAnswer) {
        score++;
      }
    }

    if (req.adminPreview || sampleAccount) {
      const passingScore = arPassingScore(allQuestions.length);
      const passed = score >= passingScore;
      return res.json({
        score,
        total: allQuestions.length,
        points: 0,
        bookPoints: effectivePoints,
        passed,
        passingScore,
        bookTitle: book?.title,
        studentName: req.adminPreview ? (req.realUser?.displayName || "Admin Preview") : (req.user?.displayName || "Sample Student"),
        preview: true,
      });
    }

    let attempt: any;
    try {
      attempt = await storage.createAttempt(
        req.user.id,
        bookId,
        score,
        allQuestions.length,
        normalizedAnswers,
        effectivePoints,
        verifiedProctor
      );
    } catch (error) {
      if (integritySession) await noProctor.release(integritySession).catch(() => {});
      throw error;
    }
    let integrity: { flag: string; autoSubmitted: boolean } | undefined;
    if (integritySession) {
      try {
        const done = await noProctor.finishAfterSubmit(integritySession, {
          attemptId: attempt.id ?? null,
          score,
          total: allQuestions.length,
          points: Number(attempt.pointsEarned || 0),
          questionCount: allQuestions.length,
          answerTimes: req.body.answerTimes,
          autoSubmitted: !!req.body.autoSubmitted,
          events: req.body.integrityEvents,
        });
        integrity = { flag: done.flag, autoSubmitted: done.autoSubmitted };
      } catch (error: any) {
        // The quiz itself is saved; only the review record failed.
        console.error("[no-proctor] finish", error?.message);
      }
    }
    void alertQuizTaken("quiz_completed", req.user, {
      title: book?.title || "a book",
      score,
      total: allQuestions.length,
      passed: !!attempt.passed,
      points: Number(attempt.pointsEarned || 0),
      proctor: proctorLabel(verifiedProctor?.type, verifiedProctor?.name),
      extra: integrity ? [["Camera check", `${integrity.flag}${integrity.autoSubmitted ? " · submitted automatically" : ""}`]] : [],
    });
    res.json({
      score,
      total: allQuestions.length,
      points: attempt.pointsEarned,
      bookPoints: effectivePoints,
      passed: attempt.passed,
      passingScore: attempt.passingScore,
      bookTitle: book?.title,
      studentName: req.user.displayName,
      attemptId: attempt.id,
      integrity,
    });
  });

  // Profile routes
  app.get("/api/profile", authMiddleware, async (req: any, res) => {
    const attempts = await storage.getUserAttempts(req.user.id);
    const regularAttempts = attempts.filter((a: any) => Number(a.bookId) > 0);
    const books = await storage.getAllBooks();
    const bookMap = new Map(books.map(b => [b.id, b]));

    const quizResults = regularAttempts.map(a => {
      const book = bookMap.get(a.bookId);
      const passingScore = arPassingScore(a.totalQuestions || 10);
      const passed = a.score >= passingScore;
      return {
        bookId: a.bookId,
        title: book?.title || "Unknown",
        author: book?.author || "",
        coverUrl: book?.coverUrl,
        readUrl: book?.readUrl,
        pointsValue: Number(book?.pointsValue ?? 0),
        score: a.score,
        total: a.totalQuestions,
        pointsEarned: a.pointsEarned ?? 0,
        passed,
        passingScore,
        completedAt: a.completedAt,
        proctorType: a.proctorType || null,
        proctorUserId: a.proctorUserId ?? null,
        proctorName: a.proctorName || null,
      };
    });

    const studentDetail = await storage.getStudentDetail(req.user.id);
    const totalPoints = Number(studentDetail?.totalPoints ?? req.user.totalPoints ?? 0);
    const quizzesTaken = Number(studentDetail?.quizzesTaken ?? regularAttempts.length);
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


  // ─── A.R.I.S.E. Avatar World ─────────────────────────────────────
  // Regular-student world progression powered by completed quizzes.
  // Character appearances are fixed presets; only world items can be purchased.
  // Purchases and coin balances are validated server-side.
  const AVATAR_WORLD_CATALOG = [
    { id:"car-street", type:"car", name:"Street Bolt", price:850, rarity:"rare" },
    { id:"car-electric", type:"car", name:"Volt X", price:1450, rarity:"epic" },
    { id:"car-super", type:"car", name:"Nova GT", price:2600, rarity:"legendary" },
    { id:"car-suv", type:"car", name:"Summit SUV", price:1750, rarity:"epic" },
    { id:"home-studio", type:"home", name:"City Studio", price:600, rarity:"rare" },
    { id:"home-loft", type:"home", name:"Skyline Loft", price:1500, rarity:"epic" },
    { id:"home-modern", type:"home", name:"Modern Mansion", price:2600, rarity:"legendary" },
    { id:"furniture-desk", type:"furniture", name:"Creator Desk", price:160, rarity:"common" },
    { id:"furniture-sofa", type:"furniture", name:"Cloud Sofa", price:220, rarity:"rare" },
    { id:"furniture-books", type:"furniture", name:"Reader Wall", price:280, rarity:"epic" },
    { id:"furniture-neon", type:"furniture", name:"Neon Wall Sign", price:360, rarity:"epic" },
    { id:"furniture-plants", type:"furniture", name:"Jungle Plants", price:120, rarity:"common" },
    { id:"furniture-beanbags", type:"furniture", name:"Beanbag Pile", price:180, rarity:"common" },
    { id:"furniture-aquarium", type:"furniture", name:"Glow Aquarium", price:320, rarity:"rare" },
    { id:"furniture-trophy", type:"furniture", name:"Trophy Shelf", price:260, rarity:"rare" },
    { id:"furniture-telescope", type:"furniture", name:"Star Telescope", price:340, rarity:"rare" },
    { id:"furniture-arcade", type:"furniture", name:"Home Arcade Cabinet", price:450, rarity:"epic" },
    { id:"furniture-fireplace", type:"furniture", name:"Cozy Fireplace", price:420, rarity:"epic" },
    { id:"furniture-piano", type:"furniture", name:"Grand Piano", price:560, rarity:"legendary" },
    { id:"pet-dog", type:"pet", name:"Club Pup", price:450, rarity:"rare" },
    { id:"pet-cat", type:"pet", name:"Club Cat", price:450, rarity:"rare" },
    { id:"pet-bunny", type:"pet", name:"Club Bunny", price:650, rarity:"epic" },
    { id:"pet-fox", type:"pet", name:"Fable Fox", price:700, rarity:"epic" },
    { id:"pet-panda", type:"pet", name:"Poppy Panda", price:750, rarity:"epic" },
    { id:"pet-penguin", type:"pet", name:"Pip Penguin", price:550, rarity:"rare" },
    { id:"pet-lion", type:"pet", name:"Leo Lion", price:900, rarity:"legendary" },
    { id:"pet-koala", type:"pet", name:"Kiki Koala", price:600, rarity:"rare" },
    { id:"pet-elephant", type:"pet", name:"Ellie Elephant", price:800, rarity:"epic" },
    { id:"pet-parrot", type:"pet", name:"Rio Parrot", price:650, rarity:"epic" },
    { id:"pet-pig", type:"pet", name:"Puddle Pig", price:500, rarity:"rare" },
    { id:"pet-deer", type:"pet", name:"Daisy Deer", price:650, rarity:"epic" },
    { id:"unlock-king-arthur", type:"character", name:"King Arthur", price:800, rarity:"rare" },
    { id:"unlock-hercules", type:"character", name:"Hercules", price:950, rarity:"epic" },
    { id:"unlock-odysseus", type:"character", name:"Odysseus", price:800, rarity:"rare" },
    { id:"unlock-dracula", type:"character", name:"Dracula", price:1100, rarity:"epic" },
    { id:"unlock-frankenstein", type:"character", name:"Frankenstein's Monster", price:1250, rarity:"epic" },
    { id:"unlock-musketeer", type:"character", name:"The Musketeer", price:900, rarity:"rare" },
  ] as const;

  const AVATAR_WORLD_FREE = new Set(["car-none","home-basic","pet-none"]);
  const AVATAR_WORLD_STARTER_CHARACTERS = new Set(["robin-hood","sherlock-holmes","sinbad","alice"]);
  const AVATAR_WORLD_CHARACTERS = new Set([
    "robin-hood","sherlock-holmes","king-arthur","hercules","odysseus",
    "sinbad","alice","dracula","frankenstein","musketeer"
  ]);
  const AVATAR_WORLD_SHOP_TYPES = new Set(["car","home","furniture","pet","character"]);
  const characterUnlockId=(characterId:string)=>"unlock-"+characterId;
  const PET_HAPPINESS_DECAY_MS=3*60*60*1000;
  const PET_FEED_COST=30;
  const PET_TREAT_COST=10;
  const PET_FEED_BOOST=30;
  const PET_TREAT_BOOST=12;
  const PET_ACTIVITY_BOOST=22;
  const PET_VET_COST=60;
  const PET_ACTIVITY_COOLDOWN_MS=45*60*1000;
  const PET_TREAT_COOLDOWN_MS=10*60*1000;
  // Re-adopting a pet that ran away costs half its price (a rescue fee).
  const petRescuePrice=(price:number)=>Math.ceil(price/2);
  const CLUB_THEATER_CHANGE_COST=0;
  const CLUB_THEATER_POPCORN_COST=25;
  const THREE_SAFE=(value:number,min:number,max:number,fallback:number)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
  const CLUB_THEATER_PRESENCE_TTL=15000;
  type ClubTheaterVisitor={userId:number;displayName:string;characterId:string;petId:string;x:number;z:number;facing:number;seatId:string|null;lastSeen:number};
  const clubTheaterPresence=new Map<number,ClubTheaterVisitor>();


  async function getClubTheaterState(touchUserId?:number, suppliedMovies?:TheaterMovie[]){
    const movies=suppliedMovies||await theaterCatalog.playable();
    const now=Date.now();
    const raw=await storage.getSetting("club_theater_state");
    let parsed:any=null;
    if(raw){try{parsed=JSON.parse(raw);}catch{}}
    const valid=movies.some(movie=>movie.id===String(parsed?.movieId||""));
    const movie=movies.find(item=>item.id===String(parsed?.movieId||""))||movies[0];
    const mediaKey=theaterMediaKey(movie);
    const sourceChanged=!!parsed?.mediaKey&&parsed.mediaKey!==mediaKey;
    let state={
      movieId:movie.id,
      mediaKey,
      positionSeconds:valid&&!sourceChanged?Math.max(0,Number(parsed?.positionSeconds)||0):0,
      startedAt:valid&&!sourceChanged&&Number.isFinite(Number(parsed?.startedAt))&&Number(parsed.startedAt)>0?Number(parsed.startedAt):now,
      playing:!!parsed?.playing
    };

    let lastExpiredAt=0;
    for(const [userId,visitor] of Array.from(clubTheaterPresence)){
      if(now-visitor.lastSeen>CLUB_THEATER_PRESENCE_TTL){
        lastExpiredAt=Math.max(lastExpiredAt,visitor.lastSeen+CLUB_THEATER_PRESENCE_TTL);
        clubTheaterPresence.delete(userId);
      }
    }

    if(clubTheaterPresence.size===0&&state.playing){
      const pauseAt=lastExpiredAt||now;
      state.positionSeconds+=Math.max(0,(pauseAt-state.startedAt)/1000);
      state.startedAt=pauseAt;
      state.playing=false;
    }

    if(touchUserId){
      const existing=clubTheaterPresence.get(touchUserId);
      clubTheaterPresence.set(touchUserId,existing?{...existing,lastSeen:now}:{userId:touchUserId,displayName:"Reader",characterId:"robin-hood",petId:"pet-none",x:0,z:20,facing:Math.PI,seatId:null,lastSeen:now});
      if(!state.playing){
        state.startedAt=now;
        state.playing=true;
      }
    }

    const changed=!raw||!valid||parsed?.mediaKey!==mediaKey
      ||state.movieId!==String(parsed?.movieId||"")
      ||state.positionSeconds!==Number(parsed?.positionSeconds||0)
      ||state.startedAt!==Number(parsed?.startedAt||0)
      ||state.playing!==!!parsed?.playing;
    if(changed)await storage.upsertSetting("club_theater_state",JSON.stringify(state));

    const currentPosition=(state.positionSeconds+(state.playing?Math.max(0,(now-state.startedAt)/1000):0))%Math.max(1,movie.duration);
    return {...state,currentPosition,audience:clubTheaterPresence.size,players:Array.from(clubTheaterPresence.values()).map(({lastSeen,...visitor})=>visitor)};
  }

  registerTheaterAdminRoutes(app, authMiddleware, adminMiddleware, theaterCatalog, async (movieId) => {
    const movies=await theaterCatalog.playable();
    const movie=movies.find(item=>item.id===movieId);
    if(!movie)throw Error("That show is unavailable.");
    const current=await getClubTheaterState(undefined,movies);
    await storage.upsertSetting("club_theater_state",JSON.stringify({movieId,mediaKey:theaterMediaKey(movie),positionSeconds:0,startedAt:Date.now(),playing:current.audience>0}));
  });

  function avatarWorldDefaultState() {
    return {
      purchased: [] as string[],
      selectedCharacter:"robin-hood",
      equipped: { car:"car-none", home:"home-basic", pet:"pet-none" } as Record<string,string>,
      furniture: [] as string[],
      petCare: {} as Record<string,{happiness:number;lastUpdatedAt:number;lastFedAt:number;lastTreatAt:number;lastWalkAt:number}>,
      lostPets: [] as string[],
      lostPetSpent: 0,
      careSpent: 0,
      spent: 0,
    };
  }

  function normalizeAvatarWorldState(raw:any) {
    const base=avatarWorldDefaultState();
    const source=raw&&typeof raw==="object"?raw:{};
    const validIds=new Set<string>(AVATAR_WORLD_CATALOG.map(item=>item.id));
    const purchased:string[]=Array.isArray(source.purchased)
      ? Array.from(new Set<string>(source.purchased.map(String).filter((id:string)=>validIds.has(id)))).slice(0,100)
      : [];
    // Grandfather a previously-selected premium character so existing students never lose it.
    const previousCharacter=String(source.selectedCharacter||"");
    if(previousCharacter&&AVATAR_WORLD_CHARACTERS.has(previousCharacter)&&!AVATAR_WORLD_STARTER_CHARACTERS.has(previousCharacter)){
      const unlock=characterUnlockId(previousCharacter);
      if(validIds.has(unlock)&&!purchased.includes(unlock))purchased.push(unlock);
    }
    const now=Date.now();
    const lostPets:string[]=Array.isArray(source.lostPets)
      ? Array.from(new Set<string>(source.lostPets.map(String).filter((id:string)=>validIds.has(id)&&AVATAR_WORLD_CATALOG.find(item=>item.id===id)?.type==="pet")))
      : [];
    let lostPetSpent=Math.max(0,Number(source.lostPetSpent)||0);
    const petCare:Record<string,{happiness:number;lastUpdatedAt:number;lastFedAt:number;lastTreatAt:number;lastWalkAt:number}>={};
    for(const id of purchased){
      if(AVATAR_WORLD_CATALOG.find(item=>item.id===id)?.type!=="pet")continue;
      const previous=source.petCare?.[id]||{};
      const previousUpdated=Number(previous.lastUpdatedAt);
      const lastUpdatedAt=Number.isFinite(previousUpdated)&&previousUpdated>0?previousUpdated:now;
      let stored=Number(previous.happiness);
      if(!Number.isFinite(stored)){
        const legacyUntil=Number(previous.fedUntil);
        stored=Number.isFinite(legacyUntil)&&legacyUntil>now?85:70;
      }
      const elapsed=Math.max(0,now-lastUpdatedAt);
      const decay=Math.floor(elapsed/PET_HAPPINESS_DECAY_MS);
      const happiness=Math.max(0,Math.min(100,Math.round(stored)-decay));
      if(happiness<=0&&!lostPets.includes(id)){
        lostPets.push(id);
        const lostItem=AVATAR_WORLD_CATALOG.find(item=>item.id===id);
        lostPetSpent+=Number(lostItem?.price||0);
      }
      petCare[id]={
        happiness,
        // Preserve the unused partial interval so frequent refreshes cannot pause decay.
        lastUpdatedAt:decay>0?lastUpdatedAt+decay*PET_HAPPINESS_DECAY_MS:lastUpdatedAt,
        lastFedAt:Math.max(0,Number(previous.lastFedAt)||0),
        lastTreatAt:Math.max(0,Number(previous.lastTreatAt)||0),
        lastWalkAt:Math.max(0,Number(previous.lastWalkAt)||0),
      };
    }
    const activePurchasedBase=purchased.filter(id=>!lostPets.includes(id));
    const purchasedSet=new Set(activePurchasedBase);
    const rawCareSpent=Number(source.careSpent);
    const careSpent=Number.isFinite(rawCareSpent)?Math.max(0,Math.floor(rawCareSpent)):0;
    const allowed=(id:any)=>AVATAR_WORLD_FREE.has(String(id))||purchasedSet.has(String(id));
    const selectedCharacter=AVATAR_WORLD_CHARACTERS.has(String(source.selectedCharacter||""))
      ? String(source.selectedCharacter)
      : base.selectedCharacter;
    const equipped={...base.equipped};
    for(const slot of ["car","home","pet"]){
      const candidate=String(source.equipped?.[slot]||"");
      if(candidate&&allowed(candidate)) equipped[slot]=candidate;
    }
    const furniture=Array.isArray(source.furniture)
      ? Array.from(new Set(source.furniture.map(String).filter((id:string)=>purchasedSet.has(id)&&AVATAR_WORLD_CATALOG.find(item=>item.id===id)?.type==="furniture"))).slice(0,12)
      : [];
    const activePurchased=activePurchasedBase.filter((id:string)=>{
      const item=AVATAR_WORLD_CATALOG.find(entry=>entry.id===id);
      return !!item&&AVATAR_WORLD_SHOP_TYPES.has(item.type);
    });
    if(lostPets.includes(equipped.pet))equipped.pet="pet-none";
    // Only active world purchases count against the wallet. Retired wearable
    // purchases are automatically refunded by excluding them from this total.
    const spent=activePurchased.reduce((sum:number,id:string)=>{
      const item=AVATAR_WORLD_CATALOG.find(entry=>entry.id===id);
      return sum+(item?.price||0);
    },careSpent+lostPetSpent);
    return {purchased:activePurchased,selectedCharacter,equipped,furniture,petCare,lostPets,lostPetSpent,careSpent,spent};
  }

  async function getAvatarWorldPayload(userId:number) {
    const detail=await storage.getStudentDetail(userId);
    if(!detail) throw new Error("Student not found.");
    const quizzesTaken=Math.max(0,Number(detail.quizzesTaken)||0);
    const totalPoints=Math.max(0,Number(detail.totalPoints)||0);
    const attempts=await storage.getUserAttempts(userId);
    const passedQuizzes=attempts.filter((a:any)=>Number(a.pointsEarned||a.points_earned||0)>0).length;
    const level=Math.min(50,Math.floor(passedQuizzes/2)+1);
    const quizzesIntoLevel=passedQuizzes%2;
    const nextLevelAt=level>=50?null:passedQuizzes+(2-quizzesIntoLevel);

    let clubGames=0,clubWins=0;
    try{
      const adminDb=getAdminSupabase();
      const {data:clubMatches}=await adminDb.from("club_arise_matches")
        .select("winner_id,player1_id,player2_id,state")
        .eq("status","finished")
        .or("player1_id.eq."+userId+",player2_id.eq."+userId);
      // Arcade games past the daily reward cap are marked so they don't add coins.
      const rewarded=(clubMatches||[]).filter((m:any)=>matchEarnsCoins(m,userId));
      clubGames=rewarded.length;
      clubWins=rewarded.filter((m:any)=>m.winner_id===userId).length;
    }catch{}
    // Spendable coins: reading is the main source; Club play adds smaller rewards.
    const quizCoins=passedQuizzes*100;
    const gameCoins=clubGames*10+clubWins*20;
    const levelBonusCoins=level*150;
    const bonusCoins=Math.max(0,Number(await storage.getSetting("avatar_world_bonus_"+userId))||0);
    const lifetimeCoins=quizCoins+gameCoins+levelBonusCoins+bonusCoins;
    const raw=await storage.getSetting("avatar_world_"+userId);
    let parsed:any=null;
    if(raw){try{parsed=JSON.parse(raw);}catch{}}
    const state=normalizeAvatarWorldState(parsed||{});
    // Persist real-time pet decay, including offline time and runaways.
    if(JSON.stringify(state)!==JSON.stringify(parsed||{}))
      await storage.upsertSetting("avatar_world_"+userId,JSON.stringify(state));
    const theaterSpent=Math.max(0,Number(await storage.getSetting("avatar_world_theater_spent_"+userId))||0);
    const wallet=Math.max(0,lifetimeCoins-state.spent-theaterSpent);
    return {
      economy:{level,quizzesTaken,passedQuizzes,totalPoints,lifetimeCoins,wallet,nextLevelAt,coinsPerPassedQuiz:100,coinsPerGame:10,winBonusCoins:20,levelBonus:150,clubGames,clubWins,bonusCoins,theaterSpent},
      state,
      catalog:AVATAR_WORLD_CATALOG,
      petRules:{feedCost:PET_FEED_COST,treatCost:PET_TREAT_COST,vetCost:PET_VET_COST,feedBoost:PET_FEED_BOOST,treatBoost:PET_TREAT_BOOST,activityBoost:PET_ACTIVITY_BOOST,
        activityCooldownMs:PET_ACTIVITY_COOLDOWN_MS,treatCooldownMs:PET_TREAT_COOLDOWN_MS,decayMs:PET_HAPPINESS_DECAY_MS,serverNow:Date.now()},
    };
  }

  app.get("/api/avatar-world", authMiddleware, async(req:any,res)=>{
    try{
      if(req.user.isAdmin||req.user.role!=="student"||req.user.is_eye_gaze_user) return res.status(403).json({message:"Avatar World is for regular student accounts."});
      res.set("Cache-Control","no-store");
      res.json(await getAvatarWorldPayload(req.user.id));
    }catch(error:any){
      console.error("[avatar-world] load:",error?.message);
      res.status(500).json({message:"Could not load Avatar World."});
    }
  });

  app.get("/api/club-theater", authMiddleware, async(req:any,res)=>{
    try{
      if(req.user.isAdmin||req.user.role!=="student"||req.user.is_eye_gaze_user) return res.status(403).json({message:"The Club theater is for student accounts."});
      const [state,world,detail]=await Promise.all([getClubTheaterState(req.user.id),getAvatarWorldPayload(req.user.id),storage.getStudentDetail(req.user.id)]);
      const current=clubTheaterPresence.get(req.user.id);
      clubTheaterPresence.set(req.user.id,{
        userId:req.user.id,
        displayName:detail?.user?.displayName||req.user.displayName||req.user.username||"Reader",
        characterId:world.state.selectedCharacter||"robin-hood",petId:world.state.equipped.pet||"pet-none",
        x:current?.x??0,z:current?.z??20,facing:current?.facing??Math.PI,seatId:current?.seatId??null,lastSeen:Date.now()
      });
      const movies=await theaterCatalog.playable();
      const refreshed=await getClubTheaterState(req.user.id,movies);
      res.set("Cache-Control","no-store");
      res.json({state:refreshed,movies,changeCost:CLUB_THEATER_CHANGE_COST,popcornCost:CLUB_THEATER_POPCORN_COST,wallet:world.economy.wallet});
    }catch(error:any){
      console.error("[club-theater] load:",error?.message);
      res.status(500).json({message:"Could not open the Club theater."});
    }
  });

  app.post("/api/club-theater/presence",authMiddleware,async(req:any,res)=>{
    try{
      if(req.user.isAdmin||req.user.role!=="student"||req.user.is_eye_gaze_user)return res.status(403).json({message:"Student account required."});
      const current=clubTheaterPresence.get(req.user.id);
      const world=await getAvatarWorldPayload(req.user.id);
      const detail=await storage.getStudentDetail(req.user.id);
      const x=THREE_SAFE(Number(req.body?.x),-13,13,current?.x??0);
      const z=THREE_SAFE(Number(req.body?.z),-7,27,current?.z??20);
      const facing=THREE_SAFE(Number(req.body?.facing),-Math.PI,Math.PI,current?.facing??Math.PI);
      const seatId=/^S(?:[1-9]|1[0-2])$/.test(String(req.body?.seatId||""))?String(req.body.seatId):null;
      clubTheaterPresence.set(req.user.id,{userId:req.user.id,displayName:detail?.user?.displayName||req.user.displayName||"Reader",characterId:world.state.selectedCharacter||"robin-hood",petId:world.state.equipped.pet||"pet-none",x,z,facing,seatId,lastSeen:Date.now()});
      const state=await getClubTheaterState(req.user.id);
      res.set("Cache-Control","no-store");res.json({state});
    }catch(error:any){console.error("[club-theater] presence:",error?.message);res.status(500).json({message:"Could not update theater presence."});}
  });

  app.post("/api/club-theater/leave",authMiddleware,async(req:any,res)=>{
    clubTheaterPresence.delete(req.user.id);
    await getClubTheaterState();
    res.json({ok:true});
  });

  app.post("/api/club-theater/change", authMiddleware, async(req:any,res)=>{
    try{
      if(req.user.isAdmin||req.user.role!=="student"||req.user.is_eye_gaze_user) return res.status(403).json({message:"The Club theater is for student accounts."});
      const movieId=String(req.body?.movieId||"");
      const movies=await theaterCatalog.playable();
      if(!movies.some(movie=>movie.id===movieId))return res.status(400).json({message:"That movie is not available."});
      const world=await getAvatarWorldPayload(req.user.id);
      if(world.economy.wallet<CLUB_THEATER_CHANGE_COST)return res.status(400).json({message:"You need more Reader Coins to change the movie."});
      const spendKey="avatar_world_theater_spent_"+req.user.id;
      const currentSpent=Math.max(0,Number(await storage.getSetting(spendKey))||0);
      await storage.upsertSetting(spendKey,String(currentSpent+CLUB_THEATER_CHANGE_COST));
      const current=await getClubTheaterState(req.user.id,movies);
      const state={movieId,mediaKey:theaterMediaKey(movies.find(movie=>movie.id===movieId)),positionSeconds:0,startedAt:Date.now(),playing:current.audience>0};
      await storage.upsertSetting("club_theater_state",JSON.stringify(state));
      const refreshed=await getAvatarWorldPayload(req.user.id);
      res.set("Cache-Control","no-store");
      res.json({state:{...state,currentPosition:0,audience:current.audience},movies,changeCost:CLUB_THEATER_CHANGE_COST,popcornCost:CLUB_THEATER_POPCORN_COST,wallet:refreshed.economy.wallet});
    }catch(error:any){
      console.error("[club-theater] change:",error?.message);
      res.status(500).json({message:"Could not change the movie."});
    }
  });

  app.post("/api/club-theater/popcorn", authMiddleware, async(req:any,res)=>{
    try{
      if(req.user.isAdmin||req.user.role!=="student"||req.user.is_eye_gaze_user)return res.status(403).json({message:"The Club theater is for student accounts."});
      const world=await getAvatarWorldPayload(req.user.id);
      if(world.economy.wallet<CLUB_THEATER_POPCORN_COST)return res.status(400).json({message:"You need "+CLUB_THEATER_POPCORN_COST+" Reader Coins for popcorn."});
      const spendKey="avatar_world_theater_spent_"+req.user.id;
      const currentSpent=Math.max(0,Number(await storage.getSetting(spendKey))||0);
      await storage.upsertSetting(spendKey,String(currentSpent+CLUB_THEATER_POPCORN_COST));
      const refreshed=await getAvatarWorldPayload(req.user.id);
      res.set("Cache-Control","no-store");
      res.json({ok:true,cost:CLUB_THEATER_POPCORN_COST,wallet:refreshed.economy.wallet});
    }catch(error:any){
      console.error("[club-theater] popcorn:",error?.message);
      res.status(500).json({message:"Could not buy popcorn right now."});
    }
  });

  app.post("/api/avatar-world/purchase", authMiddleware, async(req:any,res)=>{
    try{
      if(req.user.isAdmin||req.user.role!=="student"||req.user.is_eye_gaze_user) return res.status(403).json({message:"Avatar World is for regular student accounts."});
      const item=AVATAR_WORLD_CATALOG.find(entry=>entry.id===String(req.body?.itemId||""));
      if(!item||!AVATAR_WORLD_SHOP_TYPES.has(item.type)) return res.status(400).json({message:"That item is not available in Avatar World."});
      const payload=await getAvatarWorldPayload(req.user.id);
      if(payload.state.purchased.includes(item.id)) return res.json(payload);
      const rescue=item.type==="pet"&&(payload.state.lostPets||[]).includes(item.id);
      const price=rescue?petRescuePrice(item.price):item.price;
      if(payload.economy.wallet<price) return res.status(400).json({message:"You need "+(price-payload.economy.wallet)+" more Reader Coins for that item."});
      const now=Date.now();
      const equipSlot=item.type==="home"||item.type==="pet"||item.type==="car"?item.type:null;
      const next={...payload.state,purchased:[...payload.state.purchased,item.id],
        equipped:equipSlot?{...payload.state.equipped,[equipSlot]:item.id}:payload.state.equipped,
        // a rescue refunds the other half of the price that was lost when the pet ran away
        lostPetSpent:rescue?Math.max(0,payload.state.lostPetSpent-(item.price-price)):payload.state.lostPetSpent,
        lostPets:item.type==="pet"?(payload.state.lostPets||[]).filter((id:string)=>id!==item.id):(payload.state.lostPets||[]),
        petCare:item.type==="pet"?{...payload.state.petCare,[item.id]:{happiness:100,lastUpdatedAt:now,lastFedAt:now,lastTreatAt:0,lastWalkAt:0}}:payload.state.petCare};
      await storage.upsertSetting("avatar_world_"+req.user.id,JSON.stringify(next));
      res.set("Cache-Control","no-store");
      res.json(await getAvatarWorldPayload(req.user.id));
    }catch(error:any){
      console.error("[avatar-world] purchase:",error?.message);
      res.status(500).json({message:"Could not complete that purchase."});
    }
  });

  app.post("/api/avatar-world/customize", authMiddleware, async(req:any,res)=>{
    try{
      if(req.user.isAdmin||req.user.role!=="student"||req.user.is_eye_gaze_user) return res.status(403).json({message:"Avatar World is for regular student accounts."});
      const payload=await getAvatarWorldPayload(req.user.id);
      const nextRaw={...payload.state};
      const action=String(req.body?.action||"");
      if(action==="character"){
        const characterId=String(req.body?.characterId||"");
        if(!AVATAR_WORLD_CHARACTERS.has(characterId)) return res.status(400).json({message:"Unknown character."});
        const unlocked=AVATAR_WORLD_STARTER_CHARACTERS.has(characterId)||payload.state.purchased.includes(characterUnlockId(characterId));
        if(!unlocked)return res.status(400).json({message:"Unlock that character with Reader Coins first."});
        nextRaw.selectedCharacter=characterId;
      }else if(action==="equip"){
        const slot=String(req.body?.slot||"");
        const itemId=String(req.body?.itemId||"");
        const item=AVATAR_WORLD_CATALOG.find(entry=>entry.id===itemId);
        const slotType:Record<string,string>={car:"car",home:"home",pet:"pet"};
        if(!slotType[slot]) return res.status(400).json({message:"That item cannot be equipped."});
        if(itemId==="") return res.status(400).json({message:"That slot needs an item."});
        if(AVATAR_WORLD_FREE.has(itemId)){
          nextRaw.equipped={...payload.state.equipped,[slot]:itemId};
        }else if(item&&item.type===slotType[slot]&&payload.state.purchased.includes(itemId)){
          nextRaw.equipped={...payload.state.equipped,[slot]:itemId};
        }else return res.status(400).json({message:"Unlock that item before equipping it."});
      }else if(action==="furniture"){
        const ids=Array.isArray(req.body?.itemIds)?req.body.itemIds.map(String):[];
        nextRaw.furniture=ids.filter((id:string)=>payload.state.purchased.includes(id)&&AVATAR_WORLD_CATALOG.find(entry=>entry.id===id)?.type==="furniture").slice(0,12);
      }else{
        return res.status(400).json({message:"Unknown customization action."});
      }
      const normalized=normalizeAvatarWorldState(nextRaw);
      await storage.upsertSetting("avatar_world_"+req.user.id,JSON.stringify(normalized));
      res.set("Cache-Control","no-store");
      res.json(await getAvatarWorldPayload(req.user.id));
    }catch(error:any){
      console.error("[avatar-world] customize:",error?.message);
      res.status(500).json({message:"Could not save customization."});
    }
  });

  app.post("/api/avatar-world/pet-care",authMiddleware,async(req:any,res)=>{
    try{
      if(req.user.isAdmin||req.user.role!=="student"||req.user.is_eye_gaze_user)
        return res.status(403).json({message:"Pet care is for regular student accounts."});
      const itemId=String(req.body?.petId||"");
      const action=String(req.body?.action||"");
      const payload=await getAvatarWorldPayload(req.user.id);
      if(!payload.state.purchased.includes(itemId)||AVATAR_WORLD_CATALOG.find(item=>item.id===itemId)?.type!=="pet")
        return res.status(400).json({message:"This pet is no longer with you. Re-adopt it from the pet shop."});
      if(!["feed","treat","walk","play","vet"].includes(action))return res.status(400).json({message:"Choose food, a treat, a walk, play time, or a vet visit."});
      const now=Date.now();
      const current=payload.state.petCare[itemId]||{happiness:70,lastUpdatedAt:now,lastFedAt:0,lastTreatAt:0,lastWalkAt:0};
      const currentHappiness=Math.max(0,Number(current.happiness)||0);
      if(currentHappiness>=100)return res.status(400).json({message:"Your pet is already 100% happy! Come back later."});
      if((action==="walk"||action==="play")&&now-(Number(current.lastWalkAt)||0)<PET_ACTIVITY_COOLDOWN_MS){
        const mins=Math.ceil((PET_ACTIVITY_COOLDOWN_MS-(now-(Number(current.lastWalkAt)||0)))/60000);
        return res.status(400).json({message:"Your pet is tired from playing. Try again in "+mins+" min, or give food or a treat."});
      }
      if(action==="treat"&&now-(Number(current.lastTreatAt)||0)<PET_TREAT_COOLDOWN_MS){
        const mins=Math.ceil((PET_TREAT_COOLDOWN_MS-(now-(Number(current.lastTreatAt)||0)))/60000);
        return res.status(400).json({message:"Too many treats! Next treat in "+mins+" min."});
      }
      const cost=action==="feed"?PET_FEED_COST:action==="treat"?PET_TREAT_COST:action==="vet"?PET_VET_COST:0;
      if(payload.economy.wallet<cost)return res.status(400).json({message:"Earn "+(cost-payload.economy.wallet)+" more Reader Coins by reading or playing."});
      const boost=action==="feed"?PET_FEED_BOOST:action==="treat"?PET_TREAT_BOOST:action==="vet"?100:PET_ACTIVITY_BOOST;
      const care={
        ...current,
        happiness:Math.min(100,currentHappiness+boost),
        lastUpdatedAt:now,
        lastFedAt:action==="feed"?now:Number(current.lastFedAt)||0,
        lastTreatAt:action==="treat"?now:Number(current.lastTreatAt)||0,
        lastWalkAt:(action==="walk"||action==="play")?now:Number(current.lastWalkAt)||0,
      };
      const next={...payload.state,careSpent:payload.state.careSpent+cost,
        petCare:{...payload.state.petCare,[itemId]:care}};
      await storage.upsertSetting("avatar_world_"+req.user.id,JSON.stringify(next));
      res.set("Cache-Control","no-store");
      res.json(await getAvatarWorldPayload(req.user.id));
    }catch(error:any){
      console.error("[avatar-world] pet care:",error?.message);
      res.status(500).json({message:"Could not care for your pet right now."});
    }
  });

  // ─── Student Engagement Hub ───────────────────────────────────────
  // Daily missions, levels, streaks, personal bests, mystery rewards,
  // and a 3-question quick challenge. Uses existing settings +
  // manual_point_awards, so no new migration is required.
  app.get("/api/engagement/summary", authMiddleware, async (req: any, res) => {
    try {
      const isStudentAccount = !req.user.isAdmin && req.user.role !== "teacher" && req.user.role !== "parent" && req.user.role !== "admin";
      if (!isStudentAccount) return res.status(403).json({ message: "Student account required." });

      const userId = req.user.id;
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const attempts = await storage.getUserAttempts(userId);

      const dayKey = (value: any) => value ? new Date(value).toISOString().slice(0, 10) : "";
      const todayAttempts = attempts.filter((a: any) => dayKey(a.completedAt) === today);
      const quizToday = todayAttempts.length > 0;
      const quizPointsToday = todayAttempts.reduce((sum: number, a: any) => sum + (a.pointsEarned || 0), 0);

      const rawQuick = await storage.getSetting("engagement_daily_quick_challenges");
      let quickMap: Record<string, any> = {};
      if (rawQuick) { try { quickMap = JSON.parse(rawQuick); } catch {} }
      const quickToday = quickMap[String(userId)]?.date === today && quickMap[String(userId)]?.completed === true;

      let manualAwards: any[] = [];
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { data } = await getAdminSupabase().from("manual_point_awards")
          .select("points, earned_on, reason")
          .eq("student_id", userId)
          .order("earned_on", { ascending: false });
        manualAwards = data || [];
      }
      const manualToday = manualAwards.filter((a: any) => a.earned_on === today).reduce((s: number, a: any) => s + (a.points || 0), 0);
      const pointsToday = quizPointsToday + manualToday;

      const missions = [
        { id: "quiz", label: "Complete 1 quiz", detail: "Any full A.R.I.S.E. quiz counts.", completed: quizToday },
        { id: "points", label: "Earn 10 points", detail: "Quiz, challenge, or bonus points count.", completed: pointsToday >= 10 },
        { id: "quick", label: "Beat the Daily Quick Challenge", detail: "Just 3 questions.", completed: quickToday },
      ];
      const completedMissions = missions.filter(m => m.completed).length;

      const activeDates = new Set<string>();
      for (const a of attempts) if (a.completedAt) activeDates.add(dayKey(a.completedAt));
      const myQuick = quickMap[String(userId)];
      if (myQuick?.completed && myQuick?.date) activeDates.add(myQuick.date);
      if (Array.isArray(myQuick?.history)) {
        for (const date of myQuick.history) if (typeof date === "string") activeDates.add(date);
      }
      // Current streak allows today OR yesterday as the most recent active day.
      let streak = 0;
      let cursor = new Date(now);
      if (!activeDates.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
      while (activeDates.has(cursor.toISOString().slice(0, 10))) {
        streak++;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }

      const startOfWeek = new Date(now);
      const dow = (startOfWeek.getUTCDay() + 6) % 7;
      startOfWeek.setUTCDate(startOfWeek.getUTCDate() - dow);
      startOfWeek.setUTCHours(0, 0, 0, 0);
      const priorStart = new Date(startOfWeek); priorStart.setUTCDate(priorStart.getUTCDate() - 7);
      const priorEnd = new Date(startOfWeek);

      const pointsInRange = (start: Date, end: Date) => {
        const quizPts = attempts.filter((a: any) => {
          const d = a.completedAt ? new Date(a.completedAt) : null;
          return d && d >= start && d < end;
        }).reduce((s: number, a: any) => s + (a.pointsEarned || 0), 0);
        const manualPts = manualAwards.filter((a: any) => {
          const d = new Date(a.earned_on + "T00:00:00Z");
          return d >= start && d < end;
        }).reduce((s: number, a: any) => s + (a.points || 0), 0);
        return quizPts + manualPts;
      };
      const thisWeekPoints = pointsInRange(startOfWeek, new Date(now.getTime() + 1000));
      const lastWeekPoints = pointsInRange(priorStart, priorEnd);

      const currentUser = await storage.getUser(userId);
      const totalPoints = currentUser?.totalPoints || 0;
      const levels = [
        { level: 1, name: "Rookie Reader", min: 0 },
        { level: 2, name: "Page Turner", min: 50 },
        { level: 3, name: "Book Boss", min: 125 },
        { level: 4, name: "Story Slayer", min: 250 },
        { level: 5, name: "Reading Legend", min: 500 },
      ];
      let level = levels[0];
      for (const item of levels) if (totalPoints >= item.min) level = item;
      const next = levels.find(item => item.level === level.level + 1) || null;
      const levelProgress = next
        ? Math.max(0, Math.min(100, Math.round(((totalPoints - level.min) / (next.min - level.min)) * 100)))
        : 100;

      const rawClaims = await storage.getSetting("engagement_mystery_claims");
      let claims: Record<string, any> = {};
      if (rawClaims) { try { claims = JSON.parse(rawClaims); } catch {} }
      const claimedToday = claims[String(userId)]?.date === today;

      res.set("Cache-Control", "no-store");
      res.json({
        date: today,
        missions,
        completedMissions,
        streak,
        totalPoints,
        level: { ...level, progress: levelProgress, nextName: next?.name || null, nextPoints: next?.min || null },
        personalBest: { thisWeekPoints, lastWeekPoints, beatLastWeek: thisWeekPoints > lastWeekPoints && lastWeekPoints > 0 },
        mystery: { unlocked: completedMissions >= 2, claimedToday, reward: claimedToday ? claims[String(userId)]?.points || 0 : null },
        quickChallengeCompleted: quickToday,
      });
    } catch (error: any) {
      console.error("[engagement] Summary failed:", error?.message);
      res.status(500).json({ message: "Could not load today's missions." });
    }
  });

  app.get("/api/engagement/badges", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== "student" || req.user.isAdmin) return res.status(403).json({ message: "Student account required." });

      const userId = req.user.id;
      const attempts = await storage.getUserAttempts(userId);
      const currentUser = await storage.getUser(userId);
      const totalPoints = currentUser?.totalPoints || 0;

      const rawQuick = await storage.getSetting("engagement_daily_quick_challenges");
      let quickMap: Record<string, any> = {};
      if (rawQuick) { try { quickMap = JSON.parse(rawQuick); } catch {} }
      const myQuick = quickMap[String(userId)] || {};
      const quickHistory = new Set<string>(
        Array.isArray(myQuick.history) ? myQuick.history.filter((d: any) => typeof d === "string") : []
      );
      if (myQuick?.completed && myQuick?.date) quickHistory.add(myQuick.date);

      const activeDates = new Set<string>();
      for (const a of attempts) {
        if (a.completedAt) activeDates.add(new Date(a.completedAt).toISOString().slice(0, 10));
      }
      for (const date of quickHistory) activeDates.add(date);

      const today = new Date().toISOString().slice(0, 10);
      let cursor = new Date();
      if (!activeDates.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
      let streak = 0;
      while (activeDates.has(cursor.toISOString().slice(0, 10))) {
        streak++;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }

      const rawClaims = await storage.getSetting("engagement_mystery_claims");
      let claims: Record<string, any> = {};
      if (rawClaims) { try { claims = JSON.parse(rawClaims); } catch {} }
      const hasOpenedMystery = !!claims[String(userId)];

      const passedQuizzes = attempts.filter((a: any) => {
        const total = a.totalQuestions || 10;
        return a.score >= arPassingScore(total);
      }).length;

      const badgeDefs = [
        { id: "first-points", name: "Point Starter", emoji: "⭐", description: "Earn your first A.R.I.S.E. point.", unlocked: totalPoints >= 1 },
        { id: "first-quiz", name: "Quiz Rookie", emoji: "📝", description: "Complete your first quiz.", unlocked: attempts.length >= 1 },
        { id: "first-pass", name: "Got It!", emoji: "✅", description: "Pass your first full quiz.", unlocked: passedQuizzes >= 1 },
        { id: "quick-one", name: "Quick Thinker", emoji: "⚡", description: "Complete your first Daily Quick Challenge.", unlocked: quickHistory.size >= 1 },
        { id: "points-50", name: "50 Club", emoji: "🏅", description: "Reach 50 total points.", unlocked: totalPoints >= 50 },
        { id: "points-100", name: "Triple Digits", emoji: "💯", description: "Reach 100 total points.", unlocked: totalPoints >= 100 },
        { id: "quiz-5", name: "Quiz Streaker", emoji: "📚", description: "Complete 5 quizzes.", unlocked: attempts.length >= 5 },
        { id: "streak-3", name: "On Fire", emoji: "🔥", description: "Build a 3-day reading streak.", unlocked: streak >= 3 },
        { id: "quick-5", name: "Daily Challenger", emoji: "⚡", description: "Complete 5 Daily Quick Challenges.", unlocked: quickHistory.size >= 5 },
        { id: "mystery", name: "Mystery Hunter", emoji: "🎁", description: "Open your first Mystery Box.", unlocked: hasOpenedMystery },
        { id: "points-250", name: "Point Pro", emoji: "🏆", description: "Reach 250 total points.", unlocked: totalPoints >= 250 },
        { id: "streak-7", name: "Week Warrior", emoji: "🔥", description: "Build a 7-day reading streak.", unlocked: streak >= 7 },
        { id: "quiz-10", name: "Quiz Master", emoji: "🧠", description: "Complete 10 quizzes.", unlocked: attempts.length >= 10 },
        { id: "points-500", name: "Reading Legend", emoji: "👑", description: "Reach 500 total points.", unlocked: totalPoints >= 500 },
      ];

      res.set("Cache-Control", "no-store");
      res.json({
        unlockedCount: badgeDefs.filter((b) => b.unlocked).length,
        totalCount: badgeDefs.length,
        badges: badgeDefs,
      });
    } catch (error: any) {
      console.error("[engagement] Badges failed:", error?.message);
      res.status(500).json({ message: "Could not load badges." });
    }
  });

  app.post("/api/engagement/mystery", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== "student" || req.user.isAdmin) return res.status(403).json({ message: "Student account required." });
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ message: "Rewards are not configured." });
      const today = new Date().toISOString().slice(0, 10);

      const rawClaims = await storage.getSetting("engagement_mystery_claims");
      let claims: Record<string, any> = {};
      if (rawClaims) { try { claims = JSON.parse(rawClaims); } catch {} }
      if (claims[String(req.user.id)]?.date === today) return res.status(409).json({ message: "You already opened today's Mystery Box." });

      // Reuse the summary's simple mission checks server-side.
      const attempts = await storage.getUserAttempts(req.user.id);
      const todayAttempts = attempts.filter((a: any) => a.completedAt && new Date(a.completedAt).toISOString().slice(0, 10) === today);
      const rawQuick = await storage.getSetting("engagement_daily_quick_challenges");
      let quickMap: Record<string, any> = {};
      if (rawQuick) { try { quickMap = JSON.parse(rawQuick); } catch {} }
      const quickDone = quickMap[String(req.user.id)]?.date === today && quickMap[String(req.user.id)]?.completed === true;
      const { data: todaysManual } = await getAdminSupabase().from("manual_point_awards").select("points").eq("student_id", req.user.id).eq("earned_on", today);
      const pointsToday = todayAttempts.reduce((s: number, a: any) => s + (a.pointsEarned || 0), 0) + (todaysManual || []).reduce((s: number, a: any) => s + (a.points || 0), 0);
      const completed = Number(todayAttempts.length > 0) + Number(pointsToday >= 10) + Number(quickDone);
      if (completed < 2) return res.status(403).json({ message: "Complete any 2 daily missions to unlock your Mystery Box." });

      const rewards = [5, 10, 10, 15, 20];
      const seed = req.user.id + Number(today.replace(/-/g, ""));
      const points = rewards[seed % rewards.length];
      const adminUser = await storage.getUserByUsername("admin");
      const awardedBy = adminUser?.id || req.user.id;
      const { error } = await getAdminSupabase().from("manual_point_awards").insert({
        student_id: req.user.id,
        awarded_by: awardedBy,
        points,
        reason: "Daily Mystery Box",
        earned_on: today,
      });
      if (error) throw error;

      claims[String(req.user.id)] = { date: today, points };
      await storage.upsertSetting("engagement_mystery_claims", JSON.stringify(claims));
      clearCache("leaderboard"); clearCache("monthlyLeaderboard_"); clearCache("allUsers");
      res.json({ success: true, points });
    } catch (error: any) {
      console.error("[engagement] Mystery claim failed:", error?.message);
      res.status(500).json({ message: "Could not open the Mystery Box." });
    }
  });

  const dailyQuickChallenges = [
    {
      id: "octopus",
      topic: "Animals",
      title: "The Octopus Escape Artist",
      passage: "An octopus has eight arms and a soft body with no bones. Because its body is soft, it can squeeze through very small spaces. Octopuses can also change color to blend in with rocks and plants. When one feels threatened, it may release a dark cloud of ink and swim away.",
      questions: [
        { id: "q1", questionText: "Why can an octopus squeeze through small spaces?", optionA: "It has no bones", optionB: "It can fly", optionC: "It has fur", optionD: "It is very loud", correctAnswer: "A" },
        { id: "q2", questionText: "What can an octopus do to hide?", optionA: "Grow wings", optionB: "Change color", optionC: "Turn into a rock", optionD: "Dig a tunnel", correctAnswer: "B" },
        { id: "q3", questionText: "What may an octopus release when it feels threatened?", optionA: "Bubbles", optionB: "Sand", optionC: "Ink", optionD: "Leaves", correctAnswer: "C" },
      ],
    },
    {
      id: "basketball",
      topic: "Sports",
      title: "Why Basketball Players Dribble",
      passage: "In basketball, a player cannot simply run while holding the ball. To move with the ball, the player must bounce it on the floor. This is called dribbling. Good players keep the ball low and close to their body so it is harder for another player to steal it.",
      questions: [
        { id: "q1", questionText: "What is dribbling?", optionA: "Throwing the ball at the hoop", optionB: "Bouncing the ball while moving", optionC: "Passing to the referee", optionD: "Holding the ball still", correctAnswer: "B" },
        { id: "q2", questionText: "Why do players keep the ball close?", optionA: "To make it harder to steal", optionB: "To make it heavier", optionC: "To stop the game", optionD: "To make the court smaller", correctAnswer: "A" },
        { id: "q3", questionText: "What can a player NOT do while holding the ball?", optionA: "Stand still", optionB: "Pass it", optionC: "Run without dribbling", optionD: "Shoot it", correctAnswer: "C" },
      ],
    },
    {
      id: "mars",
      topic: "Space",
      title: "Why Mars Looks Red",
      passage: "Mars is often called the Red Planet. Its surface contains a lot of iron. Over time, that iron reacted with oxygen and formed rust. Tiny pieces of rusty dust cover much of the planet. That dust gives Mars its reddish color when we see it from space.",
      questions: [
        { id: "q1", questionText: "Why is Mars called the Red Planet?", optionA: "It is covered in red water", optionB: "Rusty dust makes it look red", optionC: "It is made of fire", optionD: "Red lights shine on it", correctAnswer: "B" },
        { id: "q2", questionText: "What metal is common on Mars?", optionA: "Iron", optionB: "Gold", optionC: "Silver", optionD: "Copper", correctAnswer: "A" },
        { id: "q3", questionText: "What formed when iron reacted with oxygen?", optionA: "Ice", optionB: "Glass", optionC: "Rust", optionD: "Smoke", correctAnswer: "C" },
      ],
    },
    {
      id: "gaming",
      topic: "Gaming",
      title: "How Video Games Save Progress",
      passage: "Many video games save a player's progress so they do not have to start over every time. The game stores information such as completed levels, items, or scores. Some games save this information on the device, while others save it online in the cloud.",
      questions: [
        { id: "q1", questionText: "Why do games save progress?", optionA: "So players do not always start over", optionB: "To make the screen brighter", optionC: "To turn off the controller", optionD: "To slow the game down", correctAnswer: "A" },
        { id: "q2", questionText: "Which is something a game may save?", optionA: "The weather outside", optionB: "Completed levels", optionC: "The player's shoes", optionD: "The room temperature", correctAnswer: "B" },
        { id: "q3", questionText: "Where can some games save information?", optionA: "Only on paper", optionB: "Inside a pencil", optionC: "In the cloud", optionD: "Under the keyboard", correctAnswer: "C" },
      ],
    },
    {
      id: "popcorn",
      topic: "Food",
      title: "Why Popcorn Pops",
      passage: "Each popcorn kernel has a tiny amount of water trapped inside it. When the kernel gets hot, the water turns into steam. Pressure builds inside the hard shell. When the pressure becomes strong enough, the shell bursts and the soft inside expands into the popcorn we eat.",
      questions: [
        { id: "q1", questionText: "What is trapped inside a popcorn kernel?", optionA: "A little water", optionB: "Sand", optionC: "Oil only", optionD: "Air only", correctAnswer: "A" },
        { id: "q2", questionText: "What happens to the water when it gets hot?", optionA: "It freezes", optionB: "It turns into steam", optionC: "It disappears forever", optionD: "It becomes sugar", correctAnswer: "B" },
        { id: "q3", questionText: "Why does the shell burst?", optionA: "Pressure builds inside", optionB: "The kernel gets cold", optionC: "The shell becomes wet", optionD: "Someone cuts it open", correctAnswer: "A" },
      ],
    },
    {
      id: "velcro",
      topic: "Inventions",
      title: "An Invention Inspired by Plants",
      passage: "Velcro was inspired by tiny plant burrs that stuck to clothing and animal fur. An inventor looked closely at the burrs and saw that they had small hooks. He copied that idea by making two strips: one with tiny hooks and one with soft loops. Pressed together, they stick.",
      questions: [
        { id: "q1", questionText: "What inspired Velcro?", optionA: "Raindrops", optionB: "Plant burrs", optionC: "Bird feathers", optionD: "Snowflakes", correctAnswer: "B" },
        { id: "q2", questionText: "What did the inventor notice on the burrs?", optionA: "Tiny hooks", optionB: "Tiny lights", optionC: "Tiny wheels", optionD: "Tiny magnets", correctAnswer: "A" },
        { id: "q3", questionText: "What are the two Velcro strips made to have?", optionA: "Hooks and loops", optionB: "Buttons and zippers", optionC: "Glue and tape", optionD: "Metal and wood", correctAnswer: "A" },
      ],
    },
    {
      id: "lightning",
      topic: "Weather",
      title: "Why We See Lightning Before Thunder",
      passage: "Lightning and thunder happen at nearly the same time, but light travels much faster than sound. That is why we usually see the flash of lightning before we hear the thunder. The farther away a storm is, the longer the gap may be between the flash and the sound.",
      questions: [
        { id: "q1", questionText: "Why do we see lightning before hearing thunder?", optionA: "Thunder happens later", optionB: "Light travels faster than sound", optionC: "Lightning is closer to Earth", optionD: "Our ears stop working", correctAnswer: "B" },
        { id: "q2", questionText: "What may happen when a storm is farther away?", optionA: "The gap between flash and sound is longer", optionB: "Thunder becomes light", optionC: "Lightning disappears", optionD: "The sky turns green every time", correctAnswer: "A" },
        { id: "q3", questionText: "Lightning is seen as a what?", optionA: "Flash", optionB: "Whisper", optionC: "Shadow", optionD: "Wave", correctAnswer: "A" },
      ],
    },
  ];

  function getDailyQuickChallenge(today: string) {
    const seed = Number(today.replace(/-/g, ""));
    return dailyQuickChallenges[seed % dailyQuickChallenges.length];
  }

  app.post("/api/admin/students/:id/reset-daily-challenge", authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const studentId = Number(req.params.id);
      if (!Number.isSafeInteger(studentId) || studentId < 1) return res.status(400).json({ message: "Invalid student." });

      const student = await storage.getUser(studentId);
      if (!student || student.isAdmin || (student.role && student.role !== "student")) {
        return res.status(404).json({ message: "Student not found." });
      }

      const rawQuick = await storage.getSetting("engagement_daily_quick_challenges");
      let quickMap: Record<string, any> = {};
      if (rawQuick) { try { quickMap = JSON.parse(rawQuick); } catch {} }

      const existing = quickMap[String(studentId)];
      if (existing) {
        // Preserve prior-day history for streaks but clear today's completion/result.
        quickMap[String(studentId)] = {
          userId: studentId,
          history: Array.isArray(existing.history) ? existing.history.filter((d: any) => typeof d === "string" && d !== new Date().toISOString().slice(0, 10)) : [],
        };
      }

      await storage.upsertSetting("engagement_daily_quick_challenges", JSON.stringify(quickMap));

      // Also clear today's mystery-box claim so the full engagement flow can be tested again.
      const rawClaims = await storage.getSetting("engagement_mystery_claims");
      let claims: Record<string, any> = {};
      if (rawClaims) { try { claims = JSON.parse(rawClaims); } catch {} }
      if (claims[String(studentId)]?.date === new Date().toISOString().slice(0, 10)) {
        delete claims[String(studentId)];
        await storage.upsertSetting("engagement_mystery_claims", JSON.stringify(claims));
      }

      res.json({ success: true, message: `Daily Challenge reset for ${student.displayName}.` });
    } catch (error: any) {
      console.error("[engagement] Admin reset failed:", error?.message);
      res.status(500).json({ message: "Could not reset the Daily Challenge." });
    }
  });

  app.get("/api/engagement/quick-challenge", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== "student" || req.user.isAdmin) return res.status(403).json({ message: "Student account required." });
      const today = new Date().toISOString().slice(0, 10);
      const rawQuick = await storage.getSetting("engagement_daily_quick_challenges");
      let quickMap: Record<string, any> = {};
      if (rawQuick) { try { quickMap = JSON.parse(rawQuick); } catch {} }
      if (quickMap[String(req.user.id)]?.date === today && quickMap[String(req.user.id)]?.completed) {
        return res.json({ completed: true, score: quickMap[String(req.user.id)].score, points: quickMap[String(req.user.id)].points || 0 });
      }

      const challenge = getDailyQuickChallenge(today);
      res.set("Cache-Control", "no-store");
      res.json({
        completed: false,
        challenge: {
          id: challenge.id,
          topic: challenge.topic,
          title: challenge.title,
          passage: challenge.passage,
        },
        questions: challenge.questions.map((q: any) => ({
          id: q.id,
          questionText: q.questionText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ message: "Could not load the Daily Quick Challenge." });
    }
  });

  app.post("/api/engagement/quick-challenge", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== "student" || req.user.isAdmin) return res.status(403).json({ message: "Student account required." });
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ message: "Challenges are not configured." });
      const today = new Date().toISOString().slice(0, 10);
      const rawQuick = await storage.getSetting("engagement_daily_quick_challenges");
      let quickMap: Record<string, any> = {};
      if (rawQuick) { try { quickMap = JSON.parse(rawQuick); } catch {} }
      if (quickMap[String(req.user.id)]?.date === today && quickMap[String(req.user.id)]?.completed) {
        return res.status(409).json({ message: "You already completed today's Quick Challenge." });
      }

      const challengeId = String(req.body?.challengeId || "");
      const answers = req.body?.answers;
      const challenge = getDailyQuickChallenge(today);
      if (challengeId !== challenge.id || !answers || typeof answers !== "object") {
        return res.status(400).json({ message: "Challenge answers are required." });
      }

      let score = 0;
      for (const q of challenge.questions) if (answers[String(q.id)] === q.correctAnswer) score++;
      const passed = score >= 2;
      const points = passed ? 5 : 0;

      if (points > 0) {
        const adminUser = await storage.getUserByUsername("admin");
        const { error } = await getAdminSupabase().from("manual_point_awards").insert({
          student_id: req.user.id,
          awarded_by: adminUser?.id || req.user.id,
          points,
          reason: "Daily Quick Challenge",
          earned_on: today,
        });
        if (error) throw error;
      }

      const previousQuick = quickMap[String(req.user.id)] || {};
      const history = Array.isArray(previousQuick.history) ? previousQuick.history.filter((d: any) => typeof d === "string") : [];
      if (!history.includes(today)) history.push(today);
      quickMap[String(req.user.id)] = {
        userId: req.user.id,
        date: today,
        completed: true,
        challengeId: challenge.id,
        score,
        points,
        history: history.slice(-60),
      };
      await storage.upsertSetting("engagement_daily_quick_challenges", JSON.stringify(quickMap));
      clearCache("leaderboard"); clearCache("monthlyLeaderboard_"); clearCache("allUsers");
      res.json({ success: true, score, total: 3, passed, points });
    } catch (error: any) {
      console.error("[engagement] Quick challenge failed:", error?.message);
      res.status(500).json({ message: "Could not submit the Daily Quick Challenge." });
    }
  });

  // Profile stats endpoint — reflects band if specified (for admin band simulation)
  app.get("/api/profile/stats", authMiddleware, async (req: any, res) => {
    try {
      const attempts = await storage.getUserAttempts(req.user.id);
      const books = await storage.getAllBooks();
      const bookMap = new Map(books.map(b => [b.id, b]));

      const quizResults = attempts.map(a => {
        const book = bookMap.get(a.bookId);
        const passingScore = arPassingScore(a.totalQuestions || 10);
        const passed = a.score >= passingScore;
        return {
          bookId: a.bookId,
          title: book?.title || "Unknown",
          author: book?.author || "",
          coverUrl: book?.coverUrl,
          readUrl: book?.readUrl,
          pointsValue: Number(book?.pointsValue ?? 0),
          score: a.score,
          total: a.totalQuestions,
          pointsEarned: a.pointsEarned ?? 0,
          passed,
          passingScore,
          completedAt: a.completedAt,
        };
      });

      const totalPoints = Math.max(req.user.totalPoints || 0, attempts.reduce((sum, a) => sum + (a.pointsEarned || 0), 0));
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
    if (!req.user.isAdmin && !req.adminPreview) {
      const { category, body } = splitReport(messageText);
      const role = req.user.role && req.user.role !== "student" ? ` (${req.user.role})` : "";
      // The admin's bell shows unread messages by itself; this is the email.
      alertAdmin(category ? "problem_report" : "student_message", {
        title: category ? `Problem report from ${personName(req.user)}: ${category}` : `Message from ${personName(req.user)}`,
        summary: body.slice(0, 200),
        lines: [["From", `${personName(req.user)} (@${req.user.username})${role}`], ...(category ? [["Kind", category] as [string, string]] : []), ["Message", body.slice(0, 2000)]],
        note: "Reply from the Inbox on the admin page.",
        ref: `u${req.user.id}`,
        row: false,
      });
    }
  });

  app.post("/api/messages/:id/read", authMiddleware, async (req: any, res) => {
    const id = parseInt(req.params.id);
    if (req.user.isAdmin && !req.adminPreview) await storage.markMessageRead(id);
    else await storage.markMessageReadById(id, req.user.id);
    res.json({ message: "Marked as read" });
  });

  // Admin routes
  registerStudentActivityRoutes(app, authMiddleware, adminMiddleware);
  registerAdminStatsRoutes(app, authMiddleware, adminMiddleware, { db: () => getAdminSupabase(), presence });
  app.post("/api/admin/students/:id/manual-points", authMiddleware, adminMiddleware, async (req: any, res) => {
    const studentId = Number(req.params.id);
    const points = req.body?.points;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    const earnedOn = req.body?.earnedOn;
    const validDate = typeof earnedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(earnedOn) &&
      !Number.isNaN(Date.parse(`${earnedOn}T00:00:00Z`)) &&
      new Date(`${earnedOn}T00:00:00Z`).toISOString().slice(0, 10) === earnedOn;
    if (!Number.isSafeInteger(studentId) || studentId < 1 || !Number.isSafeInteger(points) || points < 1 || points > 1000 || reason.length < 3 || reason.length > 200 || !validDate) {
      return res.status(400).json({ message: "Enter 1–1000 points, a reason (3–200 characters), and a valid date." });
    }
    const student = await storage.getUser(studentId);
    if (!student || student.isAdmin || (student.role && student.role !== "student")) {
      return res.status(404).json({ message: "Student not found." });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ message: "Manual points are not configured on the server." });
    const { data, error } = await getAdminSupabase().from("manual_point_awards").insert({
      student_id: studentId, awarded_by: req.user.id, points, reason, earned_on: earnedOn,
    }).select("id, student_id, points, reason, earned_on, created_at").single();
    if (error) return res.status(500).json({ message: "Could not save points. Check that the manual_point_awards migration has been applied." });
    clearCache("allUsers");
    clearCache("leaderboard");
    clearCache("monthlyLeaderboard");
    clearCache("advisoryLeaderboard");
    clearCache("session_");
    res.status(201).json(data);
  });

  app.get("/api/admin/students/:id/manual-points", authMiddleware, adminMiddleware, async (req, res) => {
    const studentId = Number(req.params.id);
    if (!Number.isSafeInteger(studentId) || studentId < 1) return res.status(400).json({ message: "Invalid student." });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ message: "Manual points are not configured on the server." });
    const { data, error } = await getAdminSupabase().from("manual_point_awards")
      .select("id, points, reason, earned_on, created_at").eq("student_id", studentId)
      .order("created_at", { ascending: false }).limit(50);
    if (error) return res.status(500).json({ message: "Could not load manual point history." });
    res.json(data || []);
  });

  app.get("/api/admin/students", authMiddleware, adminMiddleware, async (_req, res) => {
    // Use embedded resources to fetch users with attempts in a single query
    const students = (await storage.getAllUsers()).filter((s: any) => s.role === 'student' || (!s.role && !s.isAdmin));
    // Fetch all attempts for all students in one query using embedded resources
    let allUsersWithAttempts: any[] = [];
    for (let retry = 0; retry < 5; retry++) {
      try {
        const { data, error } = await supabase.from("users").select("id, attempts:attempts!attempts_user_id_fkey(points_earned)").eq("is_admin", false).eq("role", "student");
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
      const totalPoints = Math.max(s.totalPoints || 0, attempts.reduce((sum, a) => sum + (a.points_earned || 0), 0));
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
    const studentName = req.user.displayName || req.user.username || `Student #${req.user.id}`;
    alertAdmin("approval_request", {
      title: `Reward claim: ${studentName} wants “${reward.title}”`,
      summary: String(reward.message || "").slice(0, 200),
      lines: [["Student", `${studentName} (@${req.user.username})`], ["Reward", reward.title], ["Message", reward.message || ""]],
      note: "Approve it from the student's Reward button under Admin → People → Students.",
      ref: `u${req.user.id}`,
    });
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
  // Public GET — anyone can read competition settings.
  // Only the two countdown dates are settings. The site gives no prizes of its own:
  // parents, teachers and schools put up theirs (see server/prizes.ts).
  const competitionDates = (stored: any) => ({
    monthlyCountdownDate: typeof stored?.monthlyCountdownDate === "string" ? stored.monthlyCountdownDate : "",
    yearlyCountdownDate: typeof stored?.yearlyCountdownDate === "string" ? stored.yearlyCountdownDate : "",
  });
  app.get("/api/competition-settings", async (req, res) => {
    const raw = await storage.getSetting("competition_settings");
    let settings: any = {};
    if (raw) { try { settings = JSON.parse(raw); } catch {} }
    res.json({ settings: competitionDates(settings) });
  });

  // Admin POST — update competition settings
  app.post("/api/admin/competition-settings", authMiddleware, adminMiddleware, async (req: any, res) => {
    const { monthlyCountdownDate, yearlyCountdownDate } = req.body || {};
    const settings: any = {};
    if (typeof monthlyCountdownDate === "string") settings.monthlyCountdownDate = monthlyCountdownDate.trim().slice(0, 40);
    if (typeof yearlyCountdownDate === "string") settings.yearlyCountdownDate = yearlyCountdownDate.trim().slice(0, 40);

    // Merge with existing
    const raw = await storage.getSetting("competition_settings");
    let existing: any = {};
    if (raw) { try { existing = JSON.parse(raw); } catch {} }
    const merged = { ...existing, ...settings };
    await storage.upsertSetting("competition_settings", JSON.stringify(merged));
    res.json({ settings: competitionDates(merged), message: "Competition settings updated!" });
  });

  // Notification bell. Action items come from the live state of what they're about (a teacher
  // waiting, an AI quiz to review, an unread message), so they clear by themselves once dealt with,
  // wherever that happens. Updates are stored notifications and clear once read.
  // The rules are in server/notificationFeed.ts and the shape in shared/notifications.ts.
  const notifDismissedKey = (userId: number) => `notification_dismissed_${userId}`;
  const notifClearBeforeKey = (userId: number) => `notification_clear_before_${userId}`;
  const parseJsonList = (raw: string): any[] => {
    try { const value = raw ? JSON.parse(raw) : []; return Array.isArray(value) ? value : []; } catch { return []; }
  };

  const getDismissedNotificationKeys = async (userId: number): Promise<Set<string>> => {
    try { return new Set(parseJsonList(await storage.getSetting(notifDismissedKey(userId))).map(String)); }
    catch { return new Set<string>(); }
  };

  const addDismissedNotificationKeys = async (userId: number, keys: string[]) => {
    if (!keys.length) return;
    const dismissed = await getDismissedNotificationKeys(userId);
    for (const key of keys) { dismissed.delete(key); dismissed.add(key); }
    await storage.upsertSetting(notifDismissedKey(userId), JSON.stringify(Array.from(dismissed).slice(-800)));
  };

  const getNotificationClearBefore = async (userId: number): Promise<number> => {
    const raw = await storage.getSetting(notifClearBeforeKey(userId));
    const parsed = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  };

  let adminIdCache: { ids: Set<number>; at: number } | null = null;
  const getAdminIds = async (): Promise<Set<number>> => {
    if (adminIdCache && Date.now() - adminIdCache.at < 60_000) return adminIdCache.ids;
    const { data, error } = await supabase.from("users").select("id").eq("is_admin", true);
    if (error) return adminIdCache?.ids || new Set<number>();
    adminIdCache = { ids: new Set((data || []).map((row: any) => Number(row.id))), at: Date.now() };
    return adminIdCache.ids;
  };

  /** Marks everything a person sent to the admin inbox as read. */
  const markConversationRead = async (senderId: number) => {
    const { error } = await supabase.from("messages").update({ is_read: true })
      .eq("user_id", senderId).eq("sender_type", "student").eq("is_read", false);
    if (error) throw new Error(error.message);
  };

  const unreadRows = (userId: number) => supabase
    .from("notifications")
    .select("id, type, title, message, created_at")
    .eq("user_id", userId)
    .eq("read", false)
    .order("created_at", { ascending: false })
    .limit(50);

  async function adminFeed(userId: number) {
    const [dismissed, clearBefore] = await Promise.all([getDismissedNotificationKeys(userId), getNotificationClearBefore(userId)]);
    const people = "id, display_name, username, email, created_at";
    const [
      rowsRes, teachersRes, parentsRes, waitingRes, aiRes, requestsRes, reviewsRes, clubRes, unreadRes,
      gradeRaw, eyeRaw, unlisted, settings, adminIds,
    ] = await Promise.all([
      unreadRows(userId),
      supabase.from("users").select(people).eq("role", "teacher").eq("account_approved", false).is("archived_at", null).order("created_at", { ascending: false }).limit(50),
      supabase.from("users").select(people).eq("role", "parent").eq("account_approved", false).is("archived_at", null).order("created_at", { ascending: false }).limit(50),
      supabase.from("users").select("id, display_name, username, created_at, teacher_id").eq("role", "student").eq("approved_by_teacher", false).is("archived_at", null).order("created_at", { ascending: false }).limit(200),
      supabase.from("pending_ai_quizzes").select("id, book_title, quiz_type, student_id, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(50),
      supabase.from("quiz_requests").select("id, book_title, author, user_id, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(50),
      supabase.from("quiz_review_requests").select("id, user_id, book_id, attempt_id, original_score, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(50),
      supabase.from("club_signups").select("id, student_name, grade, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(50),
      supabase.from("messages").select("id, user_id, message_text, created_at").eq("sender_type", "student").eq("is_read", false).order("created_at", { ascending: false }).limit(500),
      storage.getSetting("grade_change_requests").catch(() => ""),
      storage.getSetting("eye_gaze_change_requests").catch(() => ""),
      readUnlistedSignups().catch(() => [] as UnlistedSignup[]),
      adminAlerts.getSettings(),
      getAdminIds(),
    ]);

    const waiting = waitingRes.data || [];
    const ai = aiRes.data || [];
    const requests = requestsRes.data || [];
    const reviews = reviewsRes.data || [];
    // Messages saved under an admin's own id are old notes, not mail from someone.
    const unread = (unreadRes.data || []).filter((m: any) => !adminIds.has(Number(m.user_id)));

    const userIds = Array.from(new Set([
      ...waiting.map((s: any) => Number(s.teacher_id)),
      ...ai.map((q: any) => Number(q.student_id)),
      ...requests.map((r: any) => Number(r.user_id)),
      ...reviews.map((r: any) => Number(r.user_id)),
      ...unread.map((m: any) => Number(m.user_id)),
    ].filter((id) => id > 0)));
    const bookIds = Array.from(new Set(reviews.map((r: any) => Number(r.book_id)).filter((id: number) => id > 0)));
    const attemptIds = Array.from(new Set(reviews.map((r: any) => Number(r.attempt_id)).filter((id: number) => id > 0)));
    const [usersRes, booksRes, attemptsRes] = await Promise.all([
      userIds.length ? supabase.from("users").select("id, display_name, username, role").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
      bookIds.length ? supabase.from("books").select("id, title").in("id", bookIds) : Promise.resolve({ data: [] as any[] }),
      attemptIds.length ? supabase.from("attempts").select("id, total").in("id", attemptIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const users = new Map<number, any>((usersRes.data || []).map((u: any) => [Number(u.id), u]));
    const books = new Map<number, string>((booksRes.data || []).map((b: any) => [Number(b.id), String(b.title || "")]));
    const totals = new Map<number, number>((attemptsRes.data || []).map((a: any) => [Number(a.id), Number(a.total || 0)]));
    const nameFor = (id: unknown) => {
      const u = users.get(Number(id));
      return u ? String(u.display_name || u.username || "Someone") : "Someone";
    };

    const conversations = new Map<number, Conversation>();
    for (const m of unread) {
      const senderId = Number(m.user_id);
      const existing = conversations.get(senderId);
      if (existing) { existing.count += 1; continue; }
      // newest first, so the first one seen is the latest
      conversations.set(senderId, { userId: senderId, name: nameFor(senderId), role: users.get(senderId)?.role || null, count: 1, latestText: String(m.message_text || ""), latestAt: m.created_at });
    }

    return buildAdminFeed({
      rows: rowsRes.data || [],
      pendingTeachers: teachersRes.data || [],
      pendingParents: parentsRes.data || [],
      waitingStudents: waiting.map((s: any) => ({ ...s, teacher_name: s.teacher_id ? nameFor(s.teacher_id) : null })),
      unlisted: (unlisted || []).filter((r) => !r.resolved),
      aiQuizzes: ai.map((q: any) => ({ ...q, student_name: nameFor(q.student_id) })),
      quizRequests: requests.map((r: any) => ({ id: r.id, bookTitle: r.book_title, author: r.author, studentName: nameFor(r.user_id), createdAt: r.created_at })),
      reviewRequests: reviews.map((r: any) => ({ id: r.id, studentName: nameFor(r.user_id), bookTitle: books.get(Number(r.book_id)) || null, original_score: r.original_score, total: totals.get(Number(r.attempt_id)) || null, created_at: r.created_at })),
      clubSignups: clubRes.data || [],
      gradeChanges: parseJsonList(gradeRaw).filter((r: any) => r?.status === "pending"),
      eyeGazeRequests: parseJsonList(eyeRaw).filter((r: any) => r?.status === "pending"),
      conversations: Array.from(conversations.values()),
      inboxUnread: unread.length,
    }, {
      dismissed,
      clearBefore,
      inApp: (event) => settings.events[event]?.inApp !== false,
    });
  }

  app.get("/api/notifications", authMiddleware, async (req: any, res) => {
    try {
      res.set("Cache-Control", "no-store");
      const userId = Number(req.user.id);
      if (req.user.isAdmin) return res.json(await adminFeed(userId));

      if (req.user.role === "teacher") {
        const [dismissed, clearBefore, rowsRes, pendingRes] = await Promise.all([
          getDismissedNotificationKeys(userId),
          getNotificationClearBefore(userId),
          unreadRows(userId),
          supabase.from("users").select("id, display_name, username, created_at")
            .eq("teacher_id", userId).eq("approved_by_teacher", false).is("archived_at", null)
            .order("created_at", { ascending: false }).limit(100),
        ]);
        return res.json(buildTeacherFeed({ rows: rowsRes.data || [], pendingStudents: pendingRes.data || [] }, { dismissed, clearBefore }));
      }

      const [rowsRes, messagesRes] = await Promise.all([
        unreadRows(userId),
        supabase.from("messages").select("id, message_text, created_at")
          .eq("user_id", userId).eq("sender_type", "teacher").eq("is_read", false)
          .order("created_at", { ascending: false }).limit(50),
      ]);
      return res.json(buildMemberFeed({
        role: req.user.role === "parent" ? "parent" : "student",
        rows: rowsRes.data || [],
        unreadMessages: (messagesRes.data || []).map((m: any) => ({ id: m.id, messageText: m.message_text, createdAt: m.created_at })),
      }));
    } catch (error: any) {
      console.error("[notifications] load failed:", error?.message);
      return res.status(500).json({ message: "Could not load notifications" });
    }
  });

  // Reads or dismisses bell items by key ({ key } or { keys }); { all: true } clears the bell.
  // Older pages send { itemType, id } or a bare { id }; those still work.
  app.post("/api/notifications/mark-seen", authMiddleware, async (req: any, res) => {
    try {
      const userId = Number(req.user.id);
      const role: "admin" | "teacher" | "member" = req.user.isAdmin ? "admin" : req.user.role === "teacher" ? "teacher" : "member";
      const body = req.body || {};
      const legacyCategory = String(body.type || "");
      const clearAll = body.all === true || (!body.key && !Array.isArray(body.keys) && !body.itemType && !legacyCategory && body.id == null);

      if (clearAll) {
        await storage.upsertSetting(notifClearBeforeKey(userId), new Date().toISOString());
        const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
        if (error) throw new Error(error.message);
        if (role === "member") await storage.markAllMessagesRead(userId);
        return res.json({ message: "Notifications cleared" });
      }

      if (legacyCategory === "messages") {
        await storage.markAllMessagesRead(userId);
        return res.json({ message: "Messages marked read" });
      }

      const keys: string[] = Array.isArray(body.keys)
        ? body.keys.slice(0, 100).map((k: unknown) => String(k))
        : body.key ? [String(body.key)] : [];
      if (!keys.length) {
        const legacy = legacyKey(body, role);
        if (legacy) keys.push(legacy);
      }
      if (!keys.length) {
        // A very old page clearing a whole category: clear this person's bell.
        if (legacyCategory) {
          await storage.upsertSetting(notifClearBeforeKey(userId), new Date().toISOString());
          return res.json({ message: "Notifications updated" });
        }
        return res.json({ message: "No notification change needed" });
      }

      const dismiss: string[] = [];
      for (const key of keys) {
        const action = keyAction(key);
        if (action.kind === "row") {
          const { error } = await supabase.from("notifications").update({ read: true }).eq("id", action.id).eq("user_id", userId);
          if (error) throw new Error(error.message);
        } else if (action.kind === "message") {
          await storage.markMessageReadById(action.id, userId);
        } else if (action.kind === "conversation") {
          if (role === "admin") await markConversationRead(action.userId);
        } else if (action.kind === "dismiss") {
          dismiss.push(action.key);
        }
      }
      await addDismissedNotificationKeys(userId, dismiss);
      return res.json({ message: "Notifications updated" });
    } catch (error: any) {
      console.error("[notifications] update failed:", error?.message);
      return res.status(500).json({ message: "Failed to update notifications" });
    }
  });

  // Admin alert settings: which alerts go by email and to the bell, where emails go, and the email log.
  app.get("/api/admin/alert-settings", authMiddleware, adminMiddleware, async (_req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      const [settings, status] = await Promise.all([adminAlerts.getSettings(), adminAlerts.status()]);
      res.json({ settings, events: ALERT_EVENTS, ...status });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Could not load alert settings." });
    }
  });

  app.put("/api/admin/alert-settings", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const settings = await adminAlerts.saveSettings(req.body?.settings ?? req.body);
      const status = await adminAlerts.status();
      res.json({ settings, events: ALERT_EVENTS, ...status, message: "Notification settings saved." });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Could not save alert settings." });
    }
  });

  app.post("/api/admin/alert-settings/test", authMiddleware, adminMiddleware, async (_req, res) => {
    try {
      const result = await adminAlerts.sendTest();
      const status = await adminAlerts.status();
      if (!result.sent) return res.status(400).json({ ...status, message: result.error || "The test email could not be sent." });
      res.json({ ...status, message: `Test email sent to ${result.to.join(", ")}. It can take a minute to arrive — check spam too.` });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Could not send the test email." });
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
    leaderboard = leaderboard.filter((entry: any) => !isSampleAccount(entry));
    
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
        quizzesPassed: entry.quizzesPassed ?? entry.quizzesTaken,
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
    leaderboard = leaderboard.filter((entry: any) => !isSampleAccount(entry));

    // Fetch enrichment data: user grades, eye gaze flags, schools
    const rawGrades = await storage.getSetting('user_grades');
    let userGrades: Record<string, string> = {};
    if (rawGrades) { try { userGrades = JSON.parse(rawGrades); } catch {} }

    // Fetch all current users with eye gaze flag and school_id.
    // Filter out leaderboard rows whose user account has been deleted.
    const allUsers = await storage.getAllUsers();
    const userMap = new Map(allUsers.map((u: any) => [u.id, u]));
    leaderboard = leaderboard.filter((entry: any) => {
      const uid = entry.userId || entry.id;
      const user = userMap.get(uid);
      return !!user && !user.isAdmin && (!user.role || user.role === 'student');
    });

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
      // usernames are sign-in names: only the admin sees them
      const { username: _username, ...shown } = entry;
      return {
        rank: idx + 1,
        ...(req.user?.isAdmin && !req.adminPreview ? entry : shown),
        schoolName,
        isEyeGazeUser,
        grade,
        band,
      };
    });

    res.json(enriched);
  });

  // Advisory leaderboard (grouped by teacher)
  app.get("/api/advisory-leaderboard", authMiddleware, async (req: any, res) => {
    try {
      const advisoryData = await storage.getAdvisoryLeaderboard();
      res.json(advisoryData);
    } catch (err: any) {
      console.error('Advisory leaderboard error:', err);
      res.status(500).json({ message: "Failed to fetch advisory leaderboard" });
    }
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
      const filteredLeaderboard = fullLeaderboard.filter((entry: any) => !isSampleAccount(entry));

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
        recommendations.push(`Take ${Math.min(availableQuizzes.length, 3)} more quiz${availableQuizzes.length > 1 ? 'zes' : ''} to earn ${availableQuizzes.slice(0, 3).reduce((s: number, b: any) => s + Number(b.pointsValue ?? 0), 0)} points. Start with "${sample[0]}".`);
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
      const filteredLeaderboard = fullLeaderboard.filter((entry: any) => !isSampleAccount(entry));
      
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
  app.get("/api/eye-gaze/leaderboard", authMiddleware, async (req: any, res) => {
    const month = req.query.month as string;
    const leaderboard = month
      ? await storage.getMonthlyEyeGazeLeaderboard(month)
      : await storage.getEyeGazeLeaderboard();
    const admin = req.user?.isAdmin && !req.adminPreview;
    const safe = leaderboard.map((entry: any, idx: number) => ({
      rank: idx + 1,
      displayName: entry.displayName,
      totalPoints: entry.totalPoints,
      quizzesTaken: entry.quizzesTaken,
      // usernames are sign-in names: only the admin sees them
      ...(admin ? { username: entry.username } : {}),
      id: entry.id,
    }));
    res.json(safe);
  });

  // Public endpoint - get all schools with themes (for signup dropdown)
  app.get("/api/schools", async (_req, res) => {
    try {
      // A school a teacher typed in is left out until that teacher is approved.
      const schools = await schoolPicker.visibleSchools();
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
      
      res.json(filtered.map(publicTeacher));
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
    // where each school sits in the US school list, and whether it is still waiting to be shown
    let linked: Record<number, any> = {}, hidden = new Set<number>();
    try { [linked, hidden] = await Promise.all([schoolPicker.linkedEntries(), schoolPicker.hiddenIds()]); } catch {}
    res.json(schools.map((s: any) => ({ ...s, usList: linked[Number(s.id)] || null, waitingForTeacherApproval: hidden.has(Number(s.id)) })));
  });

  // Admin: match one of the site's schools to its entry in the US school list (or take the match away).
  // Someone who then searches the school's full name at sign-up lands in this school instead of making a second one.
  app.post("/api/admin/schools/:id/us-list", authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const key = typeof req.body?.key === "string" && req.body.key ? req.body.key : null;
      const entry = await schoolPicker.link(parseInt(req.params.id), key);
      res.json({ success: true, usList: entry });
    } catch (err: any) {
      res.status(err instanceof SchoolPickError ? 400 : 500).json({ message: err.message });
    }
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

  // Admin: unread message count (for the inbox badge)
  app.get("/api/admin/messages/unread-count", authMiddleware, adminMiddleware, async (_req, res) => {
    res.set("Cache-Control", "no-store");
    const [adminIds, { data }] = await Promise.all([
      getAdminIds(),
      supabase.from("messages").select("user_id").eq("sender_type", "student").eq("is_read", false).limit(1000),
    ]);
    res.json({ count: (data || []).filter((m: any) => !adminIds.has(Number(m.user_id))).length });
  });

  // Admin: everything people sent to the inbox
  app.get("/api/admin/messages", authMiddleware, adminMiddleware, async (_req, res) => {
    res.set("Cache-Control", "no-store");
    const msgs = await storage.getAllStudentMessages();
    res.json(msgs);
  });

  // Admin: messages sent to students
  app.get("/api/admin/messages/sent", authMiddleware, adminMiddleware, async (_req, res) => {
    res.set("Cache-Control", "no-store");
    const msgs = await storage.getSentMessages();
    res.json(msgs);
  });

  // Admin: opening a conversation marks everything that person sent as read, in one step
  app.post("/api/admin/messages/conversation/:userId/read", authMiddleware, adminMiddleware, async (req, res) => {
    const senderId = parseInt(req.params.userId);
    if (!Number.isSafeInteger(senderId) || senderId <= 0) return res.status(400).json({ message: "Invalid conversation" });
    try {
      await markConversationRead(senderId);
      res.json({ message: "Conversation marked as read" });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Could not mark the conversation as read" });
    }
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
    const derivedAgeGroup = gradeBand || "Custom";
    const book = await storage.createBookWithQuestions(
      { title, author, ageGroup: derivedAgeGroup, coverUrl, description, pointsValue: 0, readUrl: readUrl || null },
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
    const eyeGazeGuidelines = await storage.getSetting("eye_gaze_quiz_guidelines");
    res.json({ configured: !!key, keyPreview: key ? key.slice(0, 8) + "..." + key.slice(-4) : null, guidelines: guidelines || "", eyeGazeGuidelines: eyeGazeGuidelines || "" });
  });

  // Admin: set quiz generation guidelines
  app.post("/api/admin/quiz-guidelines", authMiddleware, adminMiddleware, async (req, res) => {
    const { guidelines } = req.body;
    await storage.upsertSetting("quiz_generation_guidelines", guidelines || "");
    res.json({ message: "Quiz guidelines saved successfully" });
  });

  // Admin: set eye gaze quiz guidelines
  app.post("/api/admin/eye-gaze-guidelines", authMiddleware, adminMiddleware, async (req, res) => {
    const { guidelines } = req.body;
    await storage.upsertSetting("eye_gaze_quiz_guidelines", guidelines || "");
    res.json({ message: "Eye gaze quiz guidelines saved successfully" });
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
        alertAiQuizReview(req.user, `${cleanTitle} by ${cleanAuthor}`, "Book quiz");
        // Tell the teachers too. The admin's bell lists these from the pending quizzes themselves.
        try {
          const { data: teachers } = await supabase.from('users').select('id').eq('role', 'teacher');
          const notifyIds = (teachers || []).map((t: any) => t.id);
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
      // On the Free plan the only AI quiz is the one for a book.
      if (await plans.blockFreeStudent(req, res)) return;
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
        alertAiQuizReview(req.user, cleanTopic, "Favorite topic quiz");
        // Tell the teachers too. The admin's bell lists these from the pending quizzes themselves.
        try {
          const { data: teachers } = await supabase.from('users').select('id').eq('role', 'teacher');
          const notifyIds = (teachers || []).map((t: any) => t.id);
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
      // Lessons built from a student's own topics are a Premium extra.
      if (await plans.blockFreeStudent(req, res)) return;
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
        alertAiQuizReview(req.user, cleanTopic, "iArise quiz");
        // Tell the teachers too. The admin's bell lists these from the pending quizzes themselves.
        try {
          const { data: teachers } = await supabase.from('users').select('id').eq('role', 'teacher');
          const notifyIds = (teachers || []).map((t: any) => t.id);
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
      const { topic, description, sourceLink, level, questionCount, exactMode, allPics, customQuestions } = req.body;
      if (!topic || topic.trim().length < 2) {
        return res.status(400).json({ message: "Please enter a topic or description for your quiz" });
      }

      const quizLevel = Math.min(Math.max(parseInt(level) || 1, 1), 5);
      const quizCount = [3, 5, 10].includes(parseInt(questionCount)) ? parseInt(questionCount) : 5;
      const useExactMode = !!exactMode;
      const useAllPics = allPics !== false; // default true

      // Generate eye gaze quiz with AI
      const result = await generateEyeGazeQuizWithAI(topic.trim(), description, sourceLink, quizLevel, quizCount, useExactMode, useAllPics, customQuestions);
      if ("error" in result) {
        return res.status(500).json({ message: result.error });
      }

      // Create the quiz immediately — no teacher review needed
      const quiz = await storage.createCustomEyeGazeQuiz(
        req.user.id,
        topic.trim(),
        `AI-generated eye gaze quiz about ${topic.trim()}`,
        `Level ${quizLevel}`,
        result.questions,
        'global',
        null,
        'eye_gaze'
      );

      return res.status(201).json({ 
        created: true,
        quizId: quiz.id,
        message: `Your eye gaze quiz about "${topic.trim()}" is ready!` 
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
          pointsValue: pending.quiz_type === 'iarise' ? 2 : 0,
          skipAR: pending.quiz_type === 'iarise',
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

      // Refresh verified AR metadata instead of assigning AI-guessed points.
      const refreshedBook = await storage.getBook(bookId);
      if (refreshedBook) {
        await verifyAndSaveARBook(bookId, refreshedBook.title, refreshedBook.author);
      }

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
    // The admin's bell lists open quiz requests by itself; this is the email.
    alertAdmin("quiz_request", {
      title: `Quiz request: “${bookTitle.trim()}” by ${author.trim()}`,
      summary: `${personName(req.user)} asked for a quiz`,
      lines: [["Student", `${personName(req.user)} (@${req.user.username})`], ["Book", bookTitle.trim()], ["Author", author.trim()]],
      note: "Create the quiz or mark the request done under Admin → To-do → Quiz requests.",
      ref: `u${req.user.id}`,
      row: false,
    });
    res.status(201).json({ message: "Quiz request submitted! Your teacher will create it soon." });
  });

  // Student: request Learning Ally / Clever access for a book
  app.post("/api/books/request-learning-ally", authMiddleware, async (req: any, res) => {
    try {
      const { bookTitle, author } = req.body;
      if (!bookTitle) return res.status(400).json({ message: "Book title is required" });
      alertAdmin("quiz_request", {
        title: `Learning Ally / Clever request: “${bookTitle}”`,
        summary: `${personName(req.user)} wants to read it${author ? ` · by ${author}` : ""}`,
        lines: [["Student", `${personName(req.user)} (@${req.user.username})`], ["Book", bookTitle], ["Author", author || ""]],
        note: "Add the book to Clever so they can read it.",
        ref: `u${req.user.id}`,
      });
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

  // Verify a quiz proctor and issue a short-lived session tied to this student + quiz.
  // A linked parent/guardian is required for real student accounts.
  app.post("/api/verify-proctor", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== "student" || req.user.isAdmin) {
        return res.status(403).json({ message: "Student account required." });
      }
      const password = String(req.body?.password || "").trim();
      const quizKind = String(req.body?.quizKind || "book") as QuizKind;
      const quizId = Number(req.body?.quizId);
      if (!password) return res.status(400).json({ message: "Proctor password is required." });
      if (!["book", "eye_gaze", "custom_eye_gaze", "reading_assessment"].includes(quizKind) || !Number.isSafeInteger(quizId)) {
        return res.status(400).json({ message: "A valid quiz is required." });
      }

      if (isDemoStudent(req.user) || req.adminPreview) {
        return res.json({
          verified: true,
          preview: true,
          proctorSessionToken: "demo",
          proctorType: "teacher",
          proctorName: "Tutorial Preview",
        });
      }

      // Slow down guessing the proctor password or a parent's code.
      const proctorKey = `student:${req.user.id}`;
      const proctorWait = proctorFails.retryAfter(proctorKey);
      if (proctorWait > 0) {
        res.set("Retry-After", String(Math.ceil(proctorWait / 1000)));
        return res.status(429).json({ message: `Too many wrong proctor codes. Try again in ${waitWords(proctorWait)}.` });
      }

      let identity: ProctorIdentity | null = null;

      // School staff proctoring must work even when a student's parent account is
      // not linked yet. Check the shared school proctor password first.
      const schoolPassword = String((await storage.getProctorPassword()) || "").trim();
      if (schoolPassword && password.toLowerCase() === schoolPassword.toLowerCase()) {
        identity = { type: "teacher", userId: null, name: "Teacher / School Staff" };
      } else {
        // Parent/guardian proctoring still requires the parent to be linked to
        // this specific student.
        const parentIds = await getStudentParentIds(req.user.id);
        if (!parentIds.length) {
          // it wasn't the school password either, so it counts as a miss
          proctorFails.fail(proctorKey);
          return res.status(403).json({
            message: "A parent or guardian must connect an A.R.I.S.E. Parent account before using a parent proctor code. School staff may use the school proctor password.",
            parentRequired: true,
          });
        }

        const adminDb = getAdminSupabase();
        const { data: credential, error } = await adminDb.from("parent_proctor_credentials")
          .select("parent_id,password")
          .eq("password", password)
          .maybeSingle();
        if (error) throw error;
        if (credential && parentIds.includes(Number(credential.parent_id))) {
          const parent = await storage.getUser(Number(credential.parent_id));
          if (parent?.role === "parent" && parent.accountApproved !== false) {
            identity = {
              type: "parent",
              userId: parent.id,
              name: parent.displayName || "Parent / Guardian",
            };
          }
        }
      }

      if (!identity) {
        proctorFails.fail(proctorKey);
        return res.status(403).json({ message: "That proctor code is not valid for this student." });
      }
      proctorFails.reset(proctorKey);

      const session = await createProctorSession(req.user.id, quizKind, quizId, identity);
      res.set("Cache-Control", "no-store");
      res.json({
        verified: true,
        proctorSessionToken: session.token,
        expiresAt: session.expiresAt,
        proctorType: identity.type,
        proctorName: identity.name,
      });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Could not verify the proctor." });
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
    // The admin's bell lists pending reviews by itself; this is the email.
    alertAdmin("review_request", {
      title: `Grade review request: ${personName(req.user)} on “${book?.title || "a quiz"}”`,
      summary: `Score ${attempt.score}/${attempt.total}${reason ? ` · “${String(reason).slice(0, 120)}”` : ""}`,
      lines: [["Student", `${personName(req.user)} (@${req.user.username})`], ["Quiz", book?.title || "Unknown"], ["Score", `${attempt.score}/${attempt.total}`], ["Points", String(attempt.points_earned || 0)], ["Reason", reason || ""]],
      note: "Re-check it under Admin → To-do → Grade reviews.",
      ref: `u${req.user.id}`,
      row: false,
    });
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
    const calculatedScore = (questions || []).reduce((sum: number, q: any) => {
      const studentKey = String(studentAnswers[String(q.id)] || "").trim().toUpperCase();
      const correctKey = String(q.correct_answer || "").trim().toUpperCase();
      return sum + (studentKey && studentKey === correctKey ? 1 : 0);
    }, 0);
    res.json({
      review,
      attempt,
      book: { title: book?.title || "Unknown", pointsValue: Number(book?.points_value ?? 0) },
      student: { displayName: user?.display_name || "Unknown", username: user?.username || "" },
      calculatedScore,
      questions: (questions || []).map((q: any) => ({
        id: q.id,
        questionText: q.question_text,
        optionA: q.option_a,
        optionB: q.option_b,
        optionC: q.option_c,
        optionD: q.option_d,
        correctAnswer: String(q.correct_answer || "").trim().toUpperCase(),
        studentAnswer: studentAnswers[String(q.id)] ? String(studentAnswers[String(q.id)]).trim().toUpperCase() : null,
        questionOrder: q.question_order,
      })),
    });
  });

  // Admin: regrade a quiz with corrected answers
  app.post("/api/admin/review-requests/:id/regrade", authMiddleware, adminMiddleware, async (req, res) => {
    const reviewId = parseInt(req.params.id);
    const { correctedAnswers, updateAnswerKey, adminNotes, manualScore } = req.body;
    const { data: review } = await supabase.from("quiz_review_requests").select("*").eq("id", reviewId).single();
    if (!review) return res.status(404).json({ message: "Review request not found" });
    if (review.status === "resolved") return res.status(400).json({ message: "This review has already been resolved" });
    const { data: attempt } = await supabase.from("attempts").select("*").eq("id", review.attempt_id).single();
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });
    const { data: questions } = await supabase.from("questions").select("*").eq("book_id", review.book_id).order("question_order", { ascending: true });
    const studentAnswers = attempt.answers ? (typeof attempt.answers === "string" ? JSON.parse(attempt.answers) : attempt.answers) : {};
    // Calculate from the answer key case-insensitively, or use an explicit manual score.
    const total = (questions || []).length;
    let calculatedScore = 0;
    for (const q of (questions || [])) {
      const correctKey = String(correctedAnswers?.[String(q.id)] || q.correct_answer || "").trim().toUpperCase();
      const studentKey = String(studentAnswers[String(q.id)] || "").trim().toUpperCase();
      if (studentKey && studentKey === correctKey) calculatedScore++;
    }
    const hasManualScore = manualScore !== undefined && manualScore !== null && manualScore !== "";
    const parsedManualScore = Number(manualScore);
    if (hasManualScore && !Number.isFinite(parsedManualScore)) {
      return res.status(400).json({ message: "Manual score must be a number." });
    }
    const newScore = hasManualScore
      ? Math.max(0, Math.min(total, Math.round(parsedManualScore)))
      : calculatedScore;
    const passingScore = arPassingScore(total);
    const passed = newScore >= passingScore;
    const { data: book } = await supabase.from("books").select("points_value").eq("id", review.book_id).single();
    const bookPoints = Number(book?.points_value ?? 0);
    const newPoints = arPointsForScore(bookPoints, newScore, total);
    const oldPoints = Number(attempt.points_earned || 0);
    const pointDiff = Math.round((newPoints - oldPoints) * 10) / 10;
    // Update the attempt
    await supabase.from("attempts").update({
      score: newScore,
      points_earned: newPoints,
    }).eq("id", attempt.id);
    // Optionally update the answer key for future students
    if (updateAnswerKey && correctedAnswers) {
      for (const [qId, correctAns] of Object.entries(correctedAnswers)) {
        const normalizedAnswer = String(correctAns || "").trim().toUpperCase();
        if (["A","B","C","D"].includes(normalizedAnswer)) {
          await supabase.from("questions").update({ correct_answer: normalizedAnswer }).eq("id", parseInt(qId));
        }
      }
    }
    // Keep the student's leaderboard total in sync with the corrected quiz points.
    if (pointDiff !== 0) {
      const { data: scoreUser } = await supabase.from("users").select("total_points").eq("id", review.user_id).single();
      const currentTotal = Number(scoreUser?.total_points || 0);
      await supabase.from("users").update({
        total_points: Math.max(0, Math.round((currentTotal + pointDiff) * 10) / 10),
      }).eq("id", review.user_id);
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
      calculatedScore,
      manualOverride: hasManualScore,
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
  app.post("/api/reading-assessment/:attemptId/start-questions", authMiddleware, async (req: any, res) => {
    try {
      const attemptId = parseInt(req.params.attemptId);
      const { data: owned } = await getAdminSupabase().from("reading_assessment_attempts").select("user_id").eq("id", attemptId).maybeSingle();
      if (!owned || Number(owned.user_id) !== Number(req.user.id)) return res.status(404).json({ message: "Reading check not found." });
      const attempt = await storage.startAssessmentQuestions(attemptId);
      const questions = await storage.getPassageQuestions(attempt.passage_id);
      res.json({ attempt, questions: withoutAnswers(questions) });
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
      void alertAssessment(req, {
        kind: "Reading check",
        score: Number(result?.score || 0),
        total: Number(result?.total || 0),
        level: readingLevelLabel(result?.estimated_grade_level),
        proctor: proctorLabel(result?.proctor_type, result?.proctor_name),
      });
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
  app.post("/api/reading-assessment/start-comprehensive", authMiddleware, async (req: any, res) => {
    try {
      const sampleAccount = isDemoStudent(req.user);
      let proctor: ProctorIdentity | null = null;
      if (!req.adminPreview && !sampleAccount && !req.user?.isAdmin && req.user?.role !== "teacher") {
        proctor = await validateProctorSession(
          String(req.body?.proctorSessionToken || ""),
          req.user.id,
          "reading_assessment",
          0,
          true
        );
        if (!proctor) {
          return res.status(403).json({
            message: "Your proctor session expired or is not valid. Ask your parent/guardian or teacher to enter the proctor code again."
          });
        }
      }
      const result = await storage.startComprehensiveAssessment(req.user.id, proctor);
      res.json({ ...result, proctorType: proctor?.type || null, proctorName: proctor?.name || null });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to start assessment" });
    }
  });

  // Start questions phase for comprehensive assessment — no longer needed (round-based flow)
  // Kept for backwards compatibility but not used in round-based flow

  // Submit comprehensive assessment — receives answersByQuestionId, scores server-side
  app.post("/api/reading-assessment/:attemptId/submit-comprehensive", authMiddleware, async (req: any, res) => {
    try {
      const { answersByQuestionId, timeUsedSeconds } = req.body;
      if (!answersByQuestionId || typeof answersByQuestionId !== "object") {
        return res.status(400).json({ message: "answersByQuestionId object is required" });
      }
      const attemptId = parseInt(req.params.attemptId);
      const attempt = await storage.getAssessmentAttempt(attemptId);
      if (!attempt) return res.status(404).json({ message: "Assessment attempt not found" });
      if (!req.adminPreview && Number(attempt.user_id) !== Number(req.user.id)) {
        return res.status(403).json({ message: "That assessment attempt does not belong to this student." });
      }
      const result = await storage.submitComprehensiveAssessment(
        attemptId,
        answersByQuestionId,
        timeUsedSeconds || 0
      );
      res.json(result);
      void alertAssessment(req, {
        kind: "Reading assessment",
        score: Number(result?.score || 0),
        total: Number(result?.total || 0),
        level: readingLevelLabel(result?.estimated_grade_level, result?.grade_level),
        proctor: proctorLabel(result?.proctor_type, result?.proctor_name),
        extra: timeUsedSeconds ? [["Time used", `${Math.round(Number(timeUsedSeconds) / 60)} min`]] : [],
      });
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

  // Legacy Eye Gazer proctor endpoint is intentionally disabled.
  // All quizzes now use /api/verify-proctor so parent linkage and audit identity are enforced.
  app.post("/api/eye-gaze/verify-proctor", authMiddleware, async (_req, res) => {
    res.status(410).json({ message: "Use the current A.R.I.S.E. proctor verification screen." });
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
      res.set("Cache-Control", "no-store");
      res.json({ ...quiz, questions: isStaffViewer(req) ? quiz.questions : withoutAnswers(quiz.questions), hasCompleted: completed });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/eye-gaze/quizzes/:id/start", authMiddleware, async (req: any, res) => {
    try {
      const quizId = parseInt(req.params.id);
      const quiz = await storage.getEyeGazeQuiz(quizId);
      if (!quiz) return res.status(404).json({ message: "Quiz not found" });
      const sampleAccount = isDemoStudent(req.user);
      const staffPreview = req.user?.isAdmin || req.user?.role === "teacher";
      res.set("Cache-Control", "no-store");
      if (req.adminPreview || sampleAccount || staffPreview) {
        return res.json({ ...quiz, questions: isStaffViewer(req) ? quiz.questions : withoutAnswers(quiz.questions), attemptId: -quizId, preview: true });
      }

      const proctor = await validateProctorSession(
        String(req.body?.proctorSessionToken || ""),
        req.user.id,
        "eye_gaze",
        quizId,
        true
      );
      if (!proctor) {
        return res.status(403).json({ message: "Your proctor session expired or is not valid. Ask your parent/guardian or teacher to enter the proctor code again." });
      }

      const completed = await storage.hasUserCompletedEyeGazeQuiz(req.user.id, quizId);
      if (completed) return res.status(400).json({ message: "You have already taken this quiz." });
      const attempt = await storage.startEyeGazeAttempt(req.user.id, quizId, proctor);
      res.json({ ...quiz, questions: withoutAnswers(quiz.questions), attemptId: attempt.id, proctorType: proctor.type, proctorName: proctor.name });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/eye-gaze/quizzes/:attemptId/submit", authMiddleware, async (req: any, res) => {
    try {
      const attemptId = parseInt(req.params.attemptId);
      const { answers } = req.body;
      const sampleAccount = isDemoStudent(req.user);
      if ((req.adminPreview || sampleAccount) && attemptId < 0) {
        const quizId = Math.abs(attemptId);
        const questions = await storage.getEyeGazeQuizQuestions(quizId);
        let score = 0;
        const skillScores: Record<string, { correct: number; total: number }> = {};
        for (const q of questions) {
          const userAnswer = String(answers?.[q.id] || "");
          const correct = userAnswer === String(q.correct_answer || "");
          if (correct) score++;
          const skill = q.skill_type || "identification";
          if (!skillScores[skill]) skillScores[skill] = { correct: 0, total: 0 };
          skillScores[skill].total++;
          if (correct) skillScores[skill].correct++;
        }
        const total = questions.length;
        const pct = total > 0 ? (score / total) * 100 : 0;
        const passingScore = Math.ceil(total * 0.7);
        return res.json({
          score,
          total,
          pct,
          passed: score >= passingScore,
          passingScore,
          pointsEarned: 0,
          skill_scores: skillScores,
          preview: true,
        });
      }
      const { data: ownedAttempt } = await getAdminSupabase().from("eye_gaze_attempts")
        .select("user_id").eq("id", attemptId).maybeSingle();
      if (!ownedAttempt || Number(ownedAttempt.user_id) !== Number(req.user.id)) {
        return res.status(403).json({ message: "That quiz attempt does not belong to this student." });
      }
      let result: any;
      try {
        result = await storage.submitEyeGazeAttempt(attemptId, answers);
      } catch (error) {
        if (error instanceof AlreadySubmittedError) return res.status(409).json({ message: error.message });
        throw error;
      }
      res.json(result);
      void (async () => {
        const { data: quiz } = await supabase.from("eye_gaze_quizzes").select("title").eq("id", Number(result.quiz_id)).maybeSingle();
        await alertQuizTaken("eye_gaze_quiz_completed", req.user, {
          title: quiz?.title || "an Eye Gazer quiz",
          score: Number(result.score || 0),
          total: Number(result.total || 0),
          passed: !!result.passed,
          points: Number(result.pointsEarned || 0),
          proctor: proctorLabel(result.proctor_type, result.proctor_name),
        });
      })();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/eye-gaze/quizzes/:attemptId/check", authMiddleware, (req: any, res) =>
    checkOneAnswer(req, res, "eye_gaze_attempts", (quizId) => storage.getEyeGazeQuizQuestions(quizId)));

  app.get("/api/eye-gaze/profile", authMiddleware, async (req: any, res) => {
    try {
      const profile = await storage.getEyeGazeProfile(req.user.id);
      const history = await storage.getEyeGazeAttemptHistory(req.user.id);
      res.json({ ...profile, history });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });


  app.get("/api/eye-gaze/appearance", authMiddleware, async (req: any, res) => {
    try {
      const background = normalizeEyeGazeBackground(await storage.getSetting(`eye_gaze_background_${req.user.id}`));
      res.set("Cache-Control", "no-store").json({ background });
    } catch { res.status(503).json({ message: "Could not load your colors." }); }
  });
  app.post("/api/eye-gaze/appearance", authMiddleware, async (req: any, res) => {
    if (typeof req.body?.background !== 'string' || !/^#[0-9a-f]{6}$/i.test(req.body.background)) return res.status(400).json({ message: "Choose a valid background color." });
    try {
      const background = normalizeEyeGazeBackground(req.body.background);
      await storage.upsertSetting(`eye_gaze_background_${req.user.id}`, background);
      res.set("Cache-Control", "no-store").json({ background });
    } catch { res.status(503).json({ message: "Could not save your colors." }); }
  });

  app.get("/api/eye-gaze/profile-photo", authMiddleware, async (req: any, res) => {
    try {
      const imageData = await storage.getSetting(`eye_gaze_profile_photo_${req.user.id}`);
      res.set("Cache-Control", "no-store");
      res.json({ imageData: imageData || null });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Could not load profile picture." });
    }
  });

  app.post("/api/eye-gaze/profile-photo", authMiddleware, async (req: any, res) => {
    try {
      const imageData = req.body?.imageData;
      const key = `eye_gaze_profile_photo_${req.user.id}`;

      if (imageData === null || imageData === "") {
        await storage.upsertSetting(key, "");
        return res.json({ imageData: null });
      }

      if (typeof imageData !== "string" || !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(imageData)) {
        return res.status(400).json({ message: "Please upload a PNG, JPG, or WEBP picture." });
      }
      if (imageData.length > 900_000) {
        return res.status(400).json({ message: "That picture is too large. Please use an image under about 600 KB." });
      }

      await storage.upsertSetting(key, imageData);
      res.json({ imageData });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Could not save profile picture." });
    }
  });

  // The student's own session and a linked parent session reach the same
  // private talker state. Photos and progress never pass through public URLs.
  async function talkerStudent(req: any): Promise<{ id: number; displayName: string } | null> {
    if (req.user.role === 'student' && req.user.is_eye_gaze_user) return req.user;
    if (req.user.role !== 'parent' || req.user.accountApproved === false) return null;
    const linkedIds = await getParentStudentIds(req.user.id);
    const requestedId = requestedParentStudentId(req);
    const candidates = requestedId ? [requestedId] : linkedIds;
    for (const id of candidates) {
      if (!linkedIds.includes(id)) continue;
      const child = await storage.getUser(id);
      if (child?.role === 'student' && child.is_eye_gaze_user) return child;
    }
    return null;
  }


  const MY_WORLD_BUCKET = 'eye-gaze-my-world';

  function validMyWorldGrownupPass(req: any, studentId: number) {
    if (req.user?.role === 'parent') return true;
    const token = String(req.headers['x-my-world-grownup-token'] || '');
    const pass = myWorldGrownupPasses.get(token);
    if (!pass) return false;
    if (pass.expiresAt <= Date.now()) {
      myWorldGrownupPasses.delete(token);
      return false;
    }
    return pass.studentId === studentId;
  }

  app.get('/api/eye-gaze/my-world/grownup-challenge', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child || req.user.role !== 'student') return res.status(403).json({ message: 'Open this from the child Eye Gazer account.' });
      const a = 2 + Math.floor(Math.random() * 8);
      const b = 2 + Math.floor(Math.random() * 8);
      const challengeId = randomBytes(18).toString('hex');
      myWorldChallenges.set(challengeId, { studentId: child.id, answer: a + b, expiresAt: Date.now() + 5 * 60_000 });
      res.set('Cache-Control', 'no-store');
      res.json({ challengeId, question: `${a} + ${b} = ?` });
    } catch {
      res.status(503).json({ message: 'Could not open the grown-up check.' });
    }
  });

  app.post('/api/eye-gaze/my-world/grownup-challenge', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child || req.user.role !== 'student') return res.status(403).json({ message: 'Open this from the child Eye Gazer account.' });
      const challengeId = String(req.body?.challengeId || '');
      const challenge = myWorldChallenges.get(challengeId);
      myWorldChallenges.delete(challengeId);
      if (!challenge || challenge.studentId !== child.id || challenge.expiresAt <= Date.now()) {
        return res.status(400).json({ message: 'That question expired. Try a new one.' });
      }
      if (Number(req.body?.answer) !== challenge.answer) {
        return res.status(400).json({ message: 'Not quite. Try a new grown-up question.' });
      }
      const grownupToken = randomBytes(24).toString('hex');
      myWorldGrownupPasses.set(grownupToken, { studentId: child.id, expiresAt: Date.now() + 30 * 60_000 });
      res.set('Cache-Control', 'no-store');
      res.json({ grownupToken, expiresInSeconds: 1800 });
    } catch {
      res.status(503).json({ message: 'Could not verify the grown-up check.' });
    }
  });

  async function ensureMyWorldBucket() {
    const adminDb = getAdminSupabase();
    const { error } = await adminDb.storage.createBucket(MY_WORLD_BUCKET, {
      public: false,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'],
      fileSizeLimit: '20MB',
    });
    if (error && !/already exists|duplicate/i.test(error.message || '')) throw error;
  }

  function safeWorldId(value: unknown, fallback: string) {
    const clean = String(value || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    return clean || fallback;
  }

  function normalizeMyWorlds(input: unknown, studentId: number) {
    if (!Array.isArray(input) || input.length > 12) throw new Error('Use up to 12 My World places.');
    return input.map((raw: any, worldIndex: number) => {
      const id = safeWorldId(raw?.id, `world-${worldIndex + 1}`);
      const name = String(raw?.name || '').trim().slice(0, 40);
      const icon = String(raw?.icon || '🏠').slice(0, 16);
      if (!name) throw new Error('Every My World place needs a name.');

      const backgroundPath = raw?.backgroundPath ? String(raw.backgroundPath) : null;
      if (backgroundPath && !backgroundPath.startsWith(`${studentId}/`)) throw new Error('A room picture does not belong to this child.');

      const itemsRaw = Array.isArray(raw?.items) ? raw.items : [];
      if (itemsRaw.length > 20) throw new Error('Use up to 20 learning items in each place.');

      const items = itemsRaw.map((item: any, itemIndex: number) => {
        const itemId = safeWorldId(item?.id, `item-${itemIndex + 1}`);
        const label = String(item?.label || '').trim().slice(0, 40);
        const phrase = String(item?.phrase || '').trim().slice(0, 160) || `This is ${label}.`;
        const mediaPath = item?.mediaPath ? String(item.mediaPath) : null;
        const mediaType = item?.mediaType === 'video' ? 'video' : item?.mediaType === 'image' ? 'image' : null;
        if (!label) throw new Error('Every My World item needs a word.');
        if (mediaPath && !mediaPath.startsWith(`${studentId}/`)) throw new Error('A learning picture or video does not belong to this child.');
        const x = Math.max(0, Math.min(96, Number(item?.x) || 41));
        const y = Math.max(0, Math.min(96, Number(item?.y) || 41));
        const w = Math.max(4, Math.min(60, Number(item?.w) || 18));
        const h = Math.max(4, Math.min(60, Number(item?.h) || 18));
        const safeW = Math.min(w, 100 - x);
        const safeH = Math.min(h, 100 - y);
        const source = item?.source === 'ai' ? 'ai' : 'manual';
        const confidence = Number.isFinite(Number(item?.confidence)) ? Math.max(0, Math.min(1, Number(item.confidence))) : null;
        return { id: itemId, label, phrase, mediaPath, mediaType, x, y, w: safeW, h: safeH, source, confidence };
      });

      return { id, name, icon, backgroundPath, items };
    });
  }

  async function signMyWorldMedia(worlds: any[]) {
    const adminDb = getAdminSupabase();
    const signed = [];
    for (const world of worlds || []) {
      let backgroundUrl: string | null = null;
      if (world.backgroundPath) {
        const { data } = await adminDb.storage.from(MY_WORLD_BUCKET).createSignedUrl(world.backgroundPath, 3600);
        backgroundUrl = data?.signedUrl || null;
      }
      const items = [];
      for (const item of world.items || []) {
        let mediaUrl: string | null = null;
        if (item.mediaPath) {
          const { data } = await adminDb.storage.from(MY_WORLD_BUCKET).createSignedUrl(item.mediaPath, 3600);
          mediaUrl = data?.signedUrl || null;
        }
        items.push({ ...item, mediaUrl });
      }
      signed.push({ ...world, backgroundUrl, items });
    }
    return signed;
  }

  app.get('/api/eye-gaze/my-world', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child) return res.status(403).json({ message: 'A linked Eye Gazer account is required.' });
      const { data, error } = await getAdminSupabase().from('eye_gaze_my_world')
        .select('setup_complete,worlds,progress').eq('student_id', child.id).maybeSingle();
      if (error) throw error;
      const worlds = await signMyWorldMedia(Array.isArray(data?.worlds) ? data.worlds : []);
      res.set('Cache-Control', 'no-store');
      res.json({
        student: { id: child.id, name: child.displayName },
        canEdit: req.user.role === 'parent',
        setupComplete: !!data?.setup_complete,
        worlds,
        progress: data?.progress || { stars: 0, learned: {}, history: [] },
      });
    } catch (error: any) {
      console.error('[my-world] load:', error?.message);
      res.status(503).json({ message: 'Could not load My World right now.' });
    }
  });


  app.post('/api/eye-gaze/my-world/ai-tag', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child) return res.status(403).json({ message: 'An Eye Gazer account is required.' });
      if (!validMyWorldGrownupPass(req, child.id)) return res.status(403).json({ message: 'Answer the grown-up math question to use AI tagging.' });

      const backgroundPath = String(req.body?.backgroundPath || '');
      const worldName = String(req.body?.worldName || 'room').trim().slice(0, 40);
      if (!backgroundPath || !backgroundPath.startsWith(`${child.id}/`)) {
        return res.status(400).json({ message: 'Upload the room photo first.' });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return res.status(503).json({ message: 'AI Auto-Tag is not configured right now.' });

      const adminDb = getAdminSupabase();
      const { data: roomBlob, error: roomError } = await adminDb.storage.from(MY_WORLD_BUCKET).download(backgroundPath);
      if (roomError || !roomBlob) throw roomError || new Error('Could not read the room photo.');
      const roomBytes = Buffer.from(await roomBlob.arrayBuffer());
      if (!roomBytes.length) throw new Error('The room photo was empty.');
      const ext = backgroundPath.split('.').pop()?.toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const roomDataUrl = `data:${mime};base64,${roomBytes.toString('base64')}`;

      const prompt = `Analyze this family-provided photo of a place called "${worldName}" for a young child's early-learning communication activity.

Your priority is ACCURACY, not quantity. Identify ONLY clear everyday objects you can genuinely see and locate with high confidence. It is completely acceptable to return only 1, 2, or 3 objects. NEVER invent extra objects just to fill a list.

Good examples: bed, shoes, TV, cup, chair, table, toothbrush, sink, door, toy, backpack, fridge, couch, lamp, ball.
Do not tag vague regions such as "wall", "floor", "room", "corner", "background", or tiny/cluttered objects that are difficult to point to.

For each object:
- Use one short child-friendly noun as the label.
- Give one simple functional sentence, such as "I put on my shoes." or "I sleep in my bed."
- Give a bounding rectangle as percentages of the ENTIRE ORIGINAL IMAGE:
  x = left edge, y = top edge, w = width, h = height, each from 0 to 100.
- Make the box tightly surround the visible object, not a large surrounding area.
- confidence must reflect visual certainty. Only include an object if confidence is at least 0.72.

Before returning an object, silently verify:
1. The object is visibly present.
2. The label matches what is actually visible.
3. The box is centered on that object.
4. A parent could tap that box and reasonably mean that object.

Important:
- Do NOT identify, name, describe, infer, or tag people, faces, private documents, screens with personal information, medication labels, addresses, or other sensitive personal details.
- Prefer large, distinct, routine-related objects useful for communication.
- Panoramic/wide photos are allowed; coordinates still refer to the full image.
- Return JSON only in this exact shape:
{"objects":[{"label":"Shoes","phrase":"I put on my shoes.","x":10,"y":64,"w":18,"h":20,"confidence":0.9}]}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1',
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: roomDataUrl, detail: 'high' } },
            ],
          }],
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error('[my-world-ai-tag] OpenAI failed:', response.status, detail.slice(0, 500));
        return res.status(503).json({ message: 'AI could not analyze that room photo right now. You can still tag objects manually.' });
      }

      const payload: any = await response.json();
      const content = payload?.choices?.[0]?.message?.content || '{}';
      let parsed: any = {};
      try { parsed = JSON.parse(content); } catch { parsed = {}; }

      const rawObjects = Array.isArray(parsed?.objects) ? parsed.objects.slice(0, 8) : [];
      const objects = rawObjects.map((obj: any, index: number) => {
        const label = String(obj?.label || '').trim().slice(0, 40);
        if (!label) return null;
        const phrase = String(obj?.phrase || '').trim().slice(0, 160) || `I see ${label}.`;
        const x = Math.max(0, Math.min(96, Number(obj?.x) || 0));
        const y = Math.max(0, Math.min(96, Number(obj?.y) || 0));
        const w = Math.max(4, Math.min(60, Number(obj?.w) || 18));
        const h = Math.max(4, Math.min(60, Number(obj?.h) || 18));
        return {
          id: `ai-${safeWorldId(label, `object-${index + 1}`)}-${index + 1}`,
          label,
          phrase,
          x,
          y,
          w: Math.min(w, 100 - x),
          h: Math.min(h, 100 - y),
          confidence: Math.max(0, Math.min(1, Number(obj?.confidence) || 0.5)),
          source: 'ai',
        };
      }).filter((obj: any) => obj && obj.confidence >= 0.72);

      res.set('Cache-Control', 'no-store');
      res.json({
        objects,
        note: 'AI tags are suggestions. A grown-up should review and adjust each box before saving.',
      });
    } catch (error: any) {
      console.error('[my-world-ai-tag]:', error?.message);
      res.status(503).json({ message: 'AI could not tag that photo right now. Manual tagging is still available.' });
    }
  });

  app.post('/api/eye-gaze/my-world/config', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child) return res.status(403).json({ message: 'A linked Eye Gazer account is required.' });
      if (!validMyWorldGrownupPass(req, child.id)) return res.status(403).json({ message: 'Answer the grown-up math question to edit My World.' });
      const worlds = normalizeMyWorlds(req.body?.worlds, child.id);
      const setupComplete = !!req.body?.setupComplete && worlds.some((world: any) => world.items.length > 0);
      const { data: previous } = await getAdminSupabase().from('eye_gaze_my_world').select('progress').eq('student_id', child.id).maybeSingle();
      const progress = previous?.progress || { stars: 0, learned: {}, history: [] };
      const { error } = await getAdminSupabase().from('eye_gaze_my_world').upsert({
        student_id: child.id,
        setup_complete: setupComplete,
        worlds,
        progress,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'student_id' });
      if (error) throw error;
      res.json({ setupComplete, worlds: await signMyWorldMedia(worlds) });
    } catch (error: any) {
      res.status(400).json({ message: error?.message || 'Could not save My World.' });
    }
  });

  app.post('/api/eye-gaze/my-world/upload', authMiddleware, raw({
    type: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/webm', 'video/quicktime', 'application/octet-stream'],
    limit: '25mb',
  }), async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child) return res.status(403).json({ message: 'A linked Eye Gazer account is required.' });
      if (!validMyWorldGrownupPass(req, child.id)) return res.status(403).json({ message: 'Answer the grown-up math question to add family media.' });

      const contentType = String(req.headers['content-type'] || '').split(';')[0].toLowerCase();
      const allowed: Record<string, { ext: string; type: 'image' | 'video' }> = {
        'image/jpeg': { ext: 'jpg', type: 'image' },
        'image/png': { ext: 'png', type: 'image' },
        'image/webp': { ext: 'webp', type: 'image' },
        'image/heic': { ext: 'heic', type: 'image' },
        'image/heif': { ext: 'heif', type: 'image' },
        'video/mp4': { ext: 'mp4', type: 'video' },
        'video/webm': { ext: 'webm', type: 'video' },
        'video/quicktime': { ext: 'mov', type: 'video' },
      };
      let format = allowed[contentType];
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);

      // Some mobile browsers omit a useful MIME type. Sniff the common image signatures
      // rather than rejecting a valid camera/library photo before it reaches storage.
      if (!format && contentType === 'application/octet-stream' && body.length >= 12) {
        const head = body.subarray(0, 16);
        const ascii = head.toString('ascii');
        if (head[0] === 0xff && head[1] === 0xd8) format = { ext: 'jpg', type: 'image' };
        else if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) format = { ext: 'png', type: 'image' };
        else if (ascii.startsWith('RIFF') && ascii.includes('WEBP')) format = { ext: 'webp', type: 'image' };
      }

      if (!format || !body.length) return res.status(400).json({ message: 'That photo did not reach A.R.I.S.E. Please choose it again.' });
      if (body.length > 25 * 1024 * 1024) return res.status(413).json({ message: 'Keep My World photos/videos under 25 MB.' });

      await ensureMyWorldBucket();
      const requested = String(req.headers['x-my-world-label'] || 'media').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32) || 'media';
      const path = `${child.id}/${Date.now()}-${requested}-${Math.random().toString(36).slice(2, 8)}.${format.ext}`;
      const adminDb = getAdminSupabase();
      const { error } = await adminDb.storage.from(MY_WORLD_BUCKET).upload(path, body, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
      const { data } = await adminDb.storage.from(MY_WORLD_BUCKET).createSignedUrl(path, 3600);
      res.json({ path, mediaType: format.type, url: data?.signedUrl || null });
    } catch (error: any) {
      console.error('[my-world] upload:', error?.message);
      res.status(503).json({ message: error?.message || 'Could not upload that family picture or video.' });
    }
  });

  app.post('/api/eye-gaze/my-world/practice', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child) return res.status(403).json({ message: 'A linked Eye Gazer account is required.' });
      const word = String(req.body?.word || '').trim().slice(0, 40);
      const outcome = String(req.body?.outcome || '');
      if (!word || !['correct', 'retry', 'explored'].includes(outcome)) return res.status(400).json({ message: 'Choose a My World learning result.' });

      const adminDb = getAdminSupabase();
      const { data } = await adminDb.from('eye_gaze_my_world').select('worlds,progress,setup_complete').eq('student_id', child.id).maybeSingle();
      const previous = data?.progress || { stars: 0, learned: {}, history: [] };
      const now = new Date().toISOString();
      const key = word.toLowerCase();
      const learned = { ...(previous.learned || {}) };
      const old = learned[key] || { attempts: 0, correct: 0 };
      learned[key] = {
        attempts: Number(old.attempts || 0) + (outcome === 'explored' ? 0 : 1),
        correct: Number(old.correct || 0) + (outcome === 'correct' ? 1 : 0),
        lastAt: now,
      };
      const progress = {
        stars: Number(previous.stars || 0) + (outcome === 'correct' ? 1 : 0),
        learned,
        history: [...(Array.isArray(previous.history) ? previous.history.slice(-149) : []), { word, outcome, at: now }],
      };
      const { error } = await adminDb.from('eye_gaze_my_world').upsert({
        student_id: child.id,
        setup_complete: !!data?.setup_complete,
        worlds: Array.isArray(data?.worlds) ? data.worlds : [],
        progress,
        updated_at: now,
      }, { onConflict: 'student_id' });
      if (error) throw error;

      // Also count My World practice in the family vocabulary tracker.
      const { data: talkerRow } = await adminDb.from('eye_gaze_talker_state').select('progress').eq('student_id', child.id).maybeSingle();
      const talkerProgress = talkerRow?.progress || { words: {}, history: [] };
      const tw = { ...(talkerProgress.words || {}) };
      const existing = tw[key] || {};
      tw[key] = {
        label: word,
        status: existing.status || 'learning',
        timesPracticed: Math.min(9999, Number(existing.timesPracticed || 0) + 1),
        attemptCount: Number(existing.attemptCount || 0) + (outcome === 'explored' ? 0 : 1),
        correctCount: Number(existing.correctCount || 0) + (outcome === 'correct' ? 1 : 0),
        lastPracticedAt: now,
        knownAt: existing.knownAt || null,
      };
      await adminDb.from('eye_gaze_talker_state').upsert({
        student_id: child.id,
        progress: {
          words: tw,
          history: [...(Array.isArray(talkerProgress.history) ? talkerProgress.history.slice(-119) : []), { word, outcome: outcome === 'explored' ? 'practiced' : outcome, at: now }],
        },
        updated_at: now,
      }, { onConflict: 'student_id' });

      res.json({ progress });
    } catch (error: any) {
      res.status(503).json({ message: 'Could not save My World practice.' });
    }
  });

  const emptyTalker = { config: { alwaysHere: null, pictures: {}, overrides: {}, recordings: {}, pageOrder: [], buttonOrder: {} }, progress: { words: {}, history: [] } };
  const validTalkerPhoto = (value: unknown) => typeof value === 'string'
    && value.length < 90_000 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value);


  const validTalkerAudio = (value: unknown) => typeof value === 'string'
    && value.length < 280_000
    && /^data:audio\/(?:webm|mp4|ogg|mpeg);base64,[A-Za-z0-9+/]+=*$/.test(value);

  function validTalkerGrownupPass(req: any, studentId: number) {
    if (req.user?.role === 'parent') return true;
    const token = String(req.headers['x-talker-grownup-token'] || '');
    const pass = talkerGrownupPasses.get(token);
    if (!pass) return false;
    if (pass.expiresAt <= Date.now()) {
      talkerGrownupPasses.delete(token);
      return false;
    }
    return pass.studentId === studentId;
  }

  const EYE_GAZE_FEATURE_PATHS = [
    '/eye-gaze-talker',
    '/my-world',
    '/library',
    '/eye-gaze-games',
    '/eye-gaze-life-skills',
    '/eye-gaze-tv',
    '/eye-gaze-flashcards',
    '/eye-gaze-buddy',
    '/leaderboard',
  ];

  function defaultEyeGazeFamilySettings() {
    return {
      version: 2,
      enabled: false,
      allowedPaths: [...EYE_GAZE_FEATURE_PATHS],
      tvDailyMinutes: 0,
      gameDailyMinutes: 0,
      tvAgeRange: '2-4',
      tvTopics: ['animals', 'numbers', 'letters', 'feelings'],
      tvChannels: normalizeYoutubeChannels(undefined),
      videos: [],
    };
  }

  function normalizeEyeGazeFamilySettings(raw: any) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const allowed = Array.isArray(source.allowedPaths)
      ? source.allowedPaths.map((value: any) => String(value)).filter((value: string) => EYE_GAZE_FEATURE_PATHS.includes(value))
      : [...EYE_GAZE_FEATURE_PATHS];
    const ageRanges = ['2-4', '5-7', '8-10', '11-13'];
    const topicIds = ['animals', 'letters', 'numbers', 'feelings', 'speech', 'daily-life', 'science', 'colors-shapes', 'social', 'safety', 'reading', 'music'];
    const tvAgeRange = ageRanges.includes(String(source.tvAgeRange)) ? String(source.tvAgeRange) : '2-4';
    const tvTopics = Array.isArray(source.tvTopics)
      ? Array.from(new Set<string>(source.tvTopics.map((value: any) => String(value)).filter((value: string) => topicIds.includes(value)))).slice(0, topicIds.length)
      : ['animals', 'numbers', 'letters', 'feelings'];
    const videos = Array.isArray(source.videos) ? source.videos.slice(0, 100).map((video: any) => {
      const id = String(video?.id || '').trim();
      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
      return {
        id,
        title: String(video?.title || 'Learning video').trim().slice(0, 120) || 'Learning video',
        channel: String(video?.channel || 'Parent approved').trim().slice(0, 80) || 'Parent approved',
        topic: String(video?.topic || 'Learning').trim().slice(0, 60) || 'Learning',
      };
    }).filter(Boolean) : [];

    if ((Number(source.version) || 1) < 2 && !allowed.includes('/eye-gaze-life-skills')) {
      allowed.push('/eye-gaze-life-skills');
    }

    return {
      version: 2,
      enabled: !!source.enabled,
      allowedPaths: Array.from(new Set(allowed)),
      tvDailyMinutes: Math.max(0, Math.min(240, Number(source.tvDailyMinutes ?? 0) || 0)),
      gameDailyMinutes: Math.max(0, Math.min(240, Number(source.gameDailyMinutes ?? 0) || 0)),
      tvAgeRange,
      tvChannels: normalizeYoutubeChannels(source.tvChannels),
      tvTopics: tvTopics.length ? tvTopics : ['animals'],
      videos,
    };
  }

  app.get('/api/eye-gaze/family-settings', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child) return res.status(403).json({ message: 'A linked Eye Gazer account is required.' });
      const raw = await storage.getSetting(`eye_gaze_family_settings_${child.id}`);
      let parsed: any = null;
      if (raw) { try { parsed = JSON.parse(raw); } catch {} }
      const settings = normalizeEyeGazeFamilySettings(parsed || defaultEyeGazeFamilySettings());
      res.set('Cache-Control', 'no-store');
      res.json({ student: { id: child.id, name: child.displayName }, settings });
    } catch (error: any) {
      console.error('[eye-gaze-family-settings] load:', error?.message);
      res.status(503).json({ message: 'Could not load family settings right now.' });
    }
  });

  app.post('/api/eye-gaze/family-settings', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child) return res.status(403).json({ message: 'A linked Eye Gazer account is required.' });
      if (!validTalkerGrownupPass(req, child.id)) return res.status(403).json({ message: 'Answer the grown-up math question to change child profile controls.' });
      const settings = normalizeEyeGazeFamilySettings(req.body);
      await storage.upsertSetting(`eye_gaze_family_settings_${child.id}`, JSON.stringify(settings));
      res.set('Cache-Control', 'no-store');
      res.json({ student: { id: child.id, name: child.displayName }, settings });
    } catch (error: any) {
      console.error('[eye-gaze-family-settings] save:', error?.message);
      res.status(503).json({ message: 'Could not save family settings. Please try again.' });
    }
  });


  function normalizeEyeGazeFlashcards(raw: any) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const sets = Array.isArray(source.sets) ? source.sets.slice(0, 24).map((set: any, setIndex: number) => {
      const id = String(set?.id || ('set-' + setIndex)).trim().slice(0, 60) || ('set-' + setIndex);
      const title = String(set?.title || 'My Cards').trim().slice(0, 60) || 'My Cards';
      const emoji = String(set?.emoji || '🃏').trim().slice(0, 16) || '🃏';
      const cards = Array.isArray(set?.cards) ? set.cards.slice(0, 80).map((card: any, cardIndex: number) => ({
        id: String(card?.id || ('card-' + cardIndex)).trim().slice(0, 80) || ('card-' + cardIndex),
        word: String(card?.word || 'Word').trim().slice(0, 50) || 'Word',
        icon: String(card?.icon || '⭐').trim().slice(0, 20) || '⭐',
        phrase: String(card?.phrase || '').trim().slice(0, 140),
      })) : [];
      return { id, title, emoji, cards };
    }) : [];
    return { sets };
  }

  app.get('/api/eye-gaze/flashcards', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child) return res.status(403).json({ message: 'A linked Eye Gazer account is required.' });
      const raw = await storage.getSetting('eye_gaze_flashcards_' + child.id);
      let parsed: any = null;
      if (raw) { try { parsed = JSON.parse(raw); } catch {} }
      res.set('Cache-Control', 'no-store');
      res.json(normalizeEyeGazeFlashcards(parsed || {}));
    } catch (error: any) {
      console.error('[eye-gaze-flashcards] load:', error?.message);
      res.status(503).json({ message: 'Could not load flash cards right now.' });
    }
  });

  app.post('/api/eye-gaze/flashcards', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child) return res.status(403).json({ message: 'A linked Eye Gazer account is required.' });
      const state = normalizeEyeGazeFlashcards(req.body);
      await storage.upsertSetting('eye_gaze_flashcards_' + child.id, JSON.stringify(state));
      res.set('Cache-Control', 'no-store');
      res.json(state);
    } catch (error: any) {
      console.error('[eye-gaze-flashcards] save:', error?.message);
      res.status(503).json({ message: 'Could not save flash cards right now.' });
    }
  });

  function normalizePottyState(raw: any) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const plan = source.plan && typeof source.plan === 'object' ? source.plan : {};
    const logs = Array.isArray(source.logs) ? source.logs.slice(-500).map((entry: any) => {
      const allowed = ['sit', 'pee', 'poop', 'accident', 'dry', 'refused'];
      const kind = allowed.includes(String(entry?.kind)) ? String(entry.kind) : 'sit';
      const atValue = new Date(String(entry?.at || '')).getTime();
      return {
        id: String(entry?.id || randomBytes(8).toString('hex')).slice(0, 80),
        kind,
        at: Number.isFinite(atValue) ? new Date(atValue).toISOString() : new Date().toISOString(),
        note: String(entry?.note || '').trim().slice(0, 180),
      };
    }) : [];
    return {
      plan: {
        checkMinutes: Math.max(10, Math.min(180, Number(plan.checkMinutes ?? 45) || 45)),
        sitMinutes: Math.max(1, Math.min(10, Number(plan.sitMinutes ?? 2) || 2)),
        observeFirst: plan.observeFirst !== false,
        visualSchedule: plan.visualSchedule !== false,
      },
      logs,
    };
  }

  app.get('/api/eye-gaze/potty', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child) return res.status(403).json({ message: 'A linked Eye Gazer account is required.' });
      const raw = await storage.getSetting('eye_gaze_potty_' + child.id);
      let parsed: any = null;
      if (raw) { try { parsed = JSON.parse(raw); } catch {} }
      const state = normalizePottyState(parsed || {});
      res.set('Cache-Control', 'no-store');
      res.json({ student: { id: child.id, name: child.displayName }, ...state });
    } catch (error: any) {
      console.error('[eye-gaze-potty] load:', error?.message);
      res.status(503).json({ message: 'Could not load potty progress right now.' });
    }
  });

  app.post('/api/eye-gaze/potty', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child) return res.status(403).json({ message: 'A linked Eye Gazer account is required.' });
      const state = normalizePottyState(req.body);
      await storage.upsertSetting('eye_gaze_potty_' + child.id, JSON.stringify(state));
      res.set('Cache-Control', 'no-store');
      res.json({ student: { id: child.id, name: child.displayName }, ...state });
    } catch (error: any) {
      console.error('[eye-gaze-potty] save:', error?.message);
      res.status(503).json({ message: 'Could not save potty progress right now.' });
    }
  });

  console.log('[youtube-shorts] API discovery configured:', !!(process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY));

  const CURATED_YOUTUBE_SHORTS = [
    { id: 'NFP_RP7Jh5c', title: 'Head, Shoulders, Knees and Toes Celebration', channel: 'Super Simple Songs', topic: 'music', ageRanges: ['2-4','5-7','8-10','11-13'] },
    { id: 'LzMdmivzDtk', title: 'Butterfly Ladybug Bumblebee', channel: 'Super Simple Songs', topic: 'animals', ageRanges: ['2-4','5-7','8-10','11-13'] },
    { id: 'dOIrnsoY21g', title: 'Phonetic Sounds', channel: 'Alphablocks', topic: 'letters', ageRanges: ['2-4','5-7'] },
    { id: 'rNokoVYDRIA', title: 'Read the Signs', channel: 'Alphablocks', topic: 'letters', ageRanges: ['2-4','5-7'] },
    { id: 'AGXxNbcvT2M', title: 'Meet Twenty One', channel: 'Numberblocks', topic: 'numbers', ageRanges: ['2-4','5-7'] },
    { id: 'ynhbcUJLdQk', title: 'Meet Twenty One', channel: 'Numberblocks', topic: 'numbers', ageRanges: ['2-4','5-7'] },
    { id: 'U5txAW1tl4k', title: 'Summer Sums', channel: 'Numberblocks', topic: 'numbers', ageRanges: ['2-4','5-7'] },
    { id: 'wvrI4e6UXXA', title: 'Build Numberblock Sixteen', channel: 'Numberblocks', topic: 'numbers', ageRanges: ['2-4','5-7'] },
    { id: 'Uxl0NPgOJag', title: 'A is for Anteater', channel: 'PBS KIDS', topic: 'animals', ageRanges: ['2-4','5-7'] },
    { id: 'ePxxwRqDx3w', title: 'How Do You Take Care of a Bunny?', channel: 'PBS KIDS', topic: 'animals', ageRanges: ['2-4','5-7'] },
    { id: 'pjMt5KaUX-Q', title: 'Feeling Faces', channel: 'PBS KIDS', topic: 'feelings', ageRanges: ['2-4','5-7'] },
    { id: 'SSeKrWX_Wk0', title: 'A Moment of Calm', channel: 'PBS KIDS', topic: 'feelings', ageRanges: ['2-4','5-7'] },
  ];

  const TRUSTED_YOUTUBE_RSS_CHANNELS = YOUTUBE_CHANNEL_OPTIONS;

  let youtubeRssCache: { at: number; items: any[] } = { at: 0, items: [] };

  function decodeYoutubeXml(value: string) {
    return String(value || '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  function classifyYoutubeShortTopic(title: string, description: string, channelTopics: string[]) {
    const text = `${title} ${description}`.toLowerCase();
    const tests: Array<[string, RegExp]> = [
      ['music', /song|sing|music|dance|rhyme/],
      ['letters', /phonics|alphabet|letter|spell|word|read|reading|sound/],
      ['numbers', /number|count|math|sum|add|subtract|plus|minus/],
      ['feelings', /feel|emotion|happy|sad|angry|calm|worry|scared|excited/],
      ['animals', /animal|dog|cat|bird|fish|bug|insect|zoo|wildlife|dinosaur/],
      ['science', /science|space|planet|weather|experiment|nature|earth|body|plant/],
      ['social', /friend|share|kind|turn|together|help|social/],
      ['safety', /safe|safety|cross|danger|emergency/],
      ['daily-life', /brush|wash|sleep|bedtime|eat|food|routine|clean/],
      ['reading', /story|book|read|vocabulary/],
    ];
    for (const [topic, regex] of tests) if (regex.test(text) && channelTopics.includes(topic)) return topic;
    return channelTopics[0] || 'reading';
  }

  async function loadTrustedYoutubeRssShorts() {
    if (youtubeRssCache.items.length && Date.now() - youtubeRssCache.at < 10 * 60_000) return youtubeRssCache.items;

    const settled = await Promise.allSettled(TRUSTED_YOUTUBE_RSS_CHANNELS.map(async channel => {
      const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`, {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'A.R.I.S.E Reader/1.0' },
      });
      if (!response.ok) return [];
      const xml = await response.text();
      const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
      return entries.flatMap(entry => {
        const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]?.trim() || '';
        const title = decodeYoutubeXml(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
        const description = decodeYoutubeXml(entry.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] || '');
        if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return [];
        if (!/#shorts?\b/i.test(`${title} ${description}`)) return [];
        return [{
          id,
          title: title.replace(/#shorts?/ig, '').replace(/\s{2,}/g, ' ').trim() || 'Learning Short',
          channel: channel.name,
          channelId: channel.id,
          topic: classifyYoutubeShortTopic(title, description, channel.topics),
          ageRanges: channel.ageRanges,
          source: 'youtube-rss',
        }];
      });
    }));

    const seen = new Set<string>();
    const items = settled.flatMap(result => result.status === 'fulfilled' ? result.value : [])
      .filter((item: any) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });

    youtubeRssCache = { at: Date.now(), items };
    return items;
  }

  const YOUTUBE_TOPIC_QUERY: Record<string, string> = {
    music: 'kids songs sing along music #shorts',
    animals: 'kids animals educational #shorts',
    letters: 'kids phonics alphabet educational #shorts',
    numbers: 'kids counting math educational #shorts',
    feelings: 'kids feelings emotions social emotional learning #shorts',
    speech: 'kids speech communication words educational #shorts',
    'daily-life': 'kids daily living routines educational #shorts',
    science: 'kids science facts educational #shorts',
    'colors-shapes': 'kids colors shapes educational #shorts',
    social: 'kids social skills educational #shorts',
    safety: 'kids safety educational #shorts',
    reading: 'kids reading vocabulary educational #shorts',
  };



  function youtubeAgeWords(ageRange: string) {
    if (ageRange === '2-4') return 'preschool toddler';
    if (ageRange === '5-7') return 'kindergarten first grade';
    if (ageRange === '8-10') return 'elementary kids';
    return 'middle school kids';
  }

  function isoDurationSeconds(value: string) {
    const match = String(value || '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    if (!match) return 99999;
    return (Number(match[1] || 0) * 3600) + (Number(match[2] || 0) * 60) + Number(match[3] || 0);
  }

  app.get('/api/eye-gaze/youtube-shorts', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child) return res.status(403).json({ message: 'A linked Eye Gazer account is required.' });

      const raw = await storage.getSetting(`eye_gaze_family_settings_${child.id}`);
      let parsed: any = null;
      if (raw) { try { parsed = JSON.parse(raw); } catch {} }
      const settings = normalizeEyeGazeFamilySettings(parsed || defaultEyeGazeFamilySettings());

      const requestedTopic = String(req.query?.topic || '');
      const topic = settings.tvTopics.includes(requestedTopic) ? requestedTopic : settings.tvTopics[0] || 'animals';
      const pageToken = String(req.query?.pageToken || '');
      const apiKey = String(process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || '').trim();

      if (!apiKey) {
        const rssItems = await loadTrustedYoutubeRssShorts().catch(() => []);
        const curated = CURATED_YOUTUBE_SHORTS.map(item => ({ ...item, channelId: YOUTUBE_CHANNEL_OPTIONS.find(c => c.name === item.channel)?.id, source: 'curated' }));
        const combined = [...rssItems, ...curated];

        const seen = new Set<string>();
        const eligible = combined.filter((item: any) => {
          if (!youtubeChannelAllowed(item.channelId, settings.tvChannels)) return false;
          if (!item?.ageRanges?.includes(settings.tvAgeRange)) return false;
          if (!settings.tvTopics.includes(item.topic) && !(settings.tvTopics.includes('music') && item.channel === 'Super Simple Songs')) return false;
          if (!/^[A-Za-z0-9_-]{11}$/.test(String(item.id || ''))) return false;
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });

        const preferred = eligible.filter((item: any) => item.topic === topic);
        const other = eligible.filter((item: any) => item.topic !== topic);
        // Interleave channels so a prolific source cannot crowd out the others.
        const buckets = settings.tvChannels.map(id => [...preferred, ...other].filter(item => item.channelId === id));
        const ordered: any[] = [];
        while (buckets.some(bucket => bucket.length)) for (const bucket of buckets) { const item = bucket.shift(); if (item) ordered.push(item); }
        const rawOffset = Math.max(0, Number.parseInt(pageToken || '0', 10) || 0);
        const offset = ordered.length ? rawOffset % ordered.length : 0;
        const pageSize = Math.min(12, Math.max(1, ordered.length));
        const items = ordered.length
          ? Array.from({ length: pageSize }, (_, i) => ordered[(offset + i) % ordered.length]).map((item: any) => ({
              id: item.id,
              title: item.title,
              channel: item.channel,
              channelId: item.channelId,
              topic: item.topic,
              source: item.source,
            }))
          : [];
        const nextOffset = ordered.length ? (offset + pageSize) % ordered.length : 0;

        res.set('Cache-Control', 'private, max-age=300');
        return res.json({
          items,
          nextPageToken: ordered.length ? String(nextOffset) : null,
          topic,
          ageRange: settings.tvAgeRange,
          automaticDiscovery: false,
          source: rssItems.length ? 'trusted-youtube-rss' : 'curated',
          message: items.length
            ? 'Showing real Shorts from trusted educational YouTube channels.'
            : 'No trusted educational YouTube Shorts matched these settings right now.',
        });
      }

      if (!settings.tvChannels.length) return res.json({ items: [], nextPageToken: null, automaticDiscovery: true });
      const selectedChannel = settings.tvChannels[Math.max(0, Number.parseInt(String(req.query.channelTurn || '0'), 10) || 0) % settings.tvChannels.length];
      const query = `${YOUTUBE_TOPIC_QUERY[topic] || YOUTUBE_TOPIC_QUERY.animals} ${youtubeAgeWords(settings.tvAgeRange)}`;
      const searchParams = new URLSearchParams({
        part: 'snippet',
        channelId: selectedChannel,
        type: 'video',
        maxResults: '25',
        q: query,
        order: 'relevance',
        safeSearch: 'strict',
        videoDuration: 'short',
        videoEmbeddable: 'true',
        videoSyndicated: 'true',
        relevanceLanguage: 'en',
        regionCode: 'US',
        key: apiKey,
      });
      if (pageToken) searchParams.set('pageToken', pageToken);

      const searchResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`);
      const searchJson: any = await searchResponse.json().catch(() => ({}));
      if (!searchResponse.ok) throw new Error(searchJson?.error?.message || 'YouTube search failed.');

      const ids = (searchJson.items || []).map((item: any) => item?.id?.videoId).filter(Boolean);
      if (!ids.length) return res.json({ items: [], nextPageToken: searchJson.nextPageToken || null, topic, ageRange: settings.tvAgeRange, automaticDiscovery: true });

      const detailsParams = new URLSearchParams({
        part: 'snippet,contentDetails,status',
        id: ids.join(','),
        key: apiKey,
      });
      const detailsResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${detailsParams.toString()}`);
      const detailsJson: any = await detailsResponse.json().catch(() => ({}));
      if (!detailsResponse.ok) throw new Error(detailsJson?.error?.message || 'YouTube video details failed.');

      const items = (detailsJson.items || [])
        .filter((video: any) => {
          const duration = isoDurationSeconds(video?.contentDetails?.duration);
          const channel = String(video?.snippet?.channelTitle || '');
          const title = String(video?.snippet?.title || '');
          const description = String(video?.snippet?.description || '');
          const shortSignal = /#shorts?\b/i.test(title + ' ' + description) || duration <= 90;
          const trusted = youtubeChannelAllowed(String(video?.snippet?.channelId || ''), settings.tvChannels);
          return duration > 0 && duration <= 180 && shortSignal && trusted && video?.status?.embeddable !== false;
        })
        .map((video: any) => ({
          id: String(video.id),
          title: String(video.snippet?.title || 'Learning Short').replace(/#shorts?/ig, '').trim(),
          channel: String(video.snippet?.channelTitle || 'Educational channel'),
          channelId: String(video.snippet?.channelId || ''),
          topic,
          source: 'youtube',
        }));

      res.set('Cache-Control', 'private, max-age=300');
      res.json({
        items,
        nextPageToken: searchJson.nextPageToken || null,
        topic,
        ageRange: settings.tvAgeRange,
        automaticDiscovery: true,
      });
    } catch (error: any) {
      console.error('[eye-gaze-youtube-shorts]', error?.message);
      res.status(503).json({ message: 'Could not load YouTube Shorts right now.' });
    }
  });

  app.get('/api/eye-gaze/game-usage', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child) return res.status(403).json({ message: 'A linked Eye Gazer account is required.' });
      const day = new Date().toISOString().slice(0, 10);
      const raw = await storage.getSetting(`eye_gaze_game_usage_${child.id}_${day}`);
      const seconds = Math.max(0, Number(raw || 0) || 0);
      res.set('Cache-Control', 'no-store');
      res.json({ seconds, minutes: seconds / 60 });
    } catch {
      res.status(503).json({ message: 'Could not load game time.' });
    }
  });

  app.post('/api/eye-gaze/game-usage', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child || req.user.role !== 'student') return res.status(403).json({ message: 'Game time is recorded from the child profile.' });
      if (String(req.user?.username || '').startsWith('sample')) return res.json({ seconds: 0, minutes: 0, sample: true });
      const addSeconds = Math.max(1, Math.min(30, Math.round(Number(req.body?.seconds || 0))));
      const day = new Date().toISOString().slice(0, 10);
      const key = `eye_gaze_game_usage_${child.id}_${day}`;
      const raw = await storage.getSetting(key);
      const seconds = Math.max(0, Number(raw || 0) || 0) + addSeconds;
      await storage.upsertSetting(key, String(seconds));
      res.set('Cache-Control', 'no-store');
      res.json({ seconds, minutes: seconds / 60 });
    } catch {
      res.status(503).json({ message: 'Could not record game time.' });
    }
  });

  app.get('/api/eye-gaze/tv-usage', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child) return res.status(403).json({ message: 'A linked Eye Gazer account is required.' });
      const day = new Date().toISOString().slice(0, 10);
      const raw = await storage.getSetting(`eye_gaze_tv_usage_${child.id}_${day}`);
      const seconds = Math.max(0, Number(raw || 0) || 0);
      res.set('Cache-Control', 'no-store');
      res.json({ seconds, minutes: seconds / 60 });
    } catch {
      res.status(503).json({ message: 'Could not load TV time.' });
    }
  });

  app.post('/api/eye-gaze/tv-usage', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child || req.user.role !== 'student') return res.status(403).json({ message: 'TV time is recorded from the child profile.' });
      const addSeconds = Math.max(1, Math.min(30, Math.round(Number(req.body?.seconds || 0))));
      const day = new Date().toISOString().slice(0, 10);
      const key = `eye_gaze_tv_usage_${child.id}_${day}`;
      const raw = await storage.getSetting(key);
      const seconds = Math.max(0, Number(raw || 0) || 0) + addSeconds;
      await storage.upsertSetting(key, String(seconds));
      res.set('Cache-Control', 'no-store');
      res.json({ seconds, minutes: seconds / 60 });
    } catch {
      res.status(503).json({ message: 'Could not record TV time.' });
    }
  });

  app.get('/api/eye-gaze/talker-state/grownup-challenge', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child || req.user.role !== 'student') return res.status(403).json({ message: 'Open this from the child Talker account.' });
      const a = 2 + Math.floor(Math.random() * 8);
      const b = 2 + Math.floor(Math.random() * 8);
      const challengeId = randomBytes(18).toString('hex');
      talkerChallenges.set(challengeId, { studentId: child.id, answer: a + b, expiresAt: Date.now() + 5 * 60_000 });
      res.set('Cache-Control', 'no-store');
      res.json({ challengeId, question: `${a} + ${b} = ?` });
    } catch {
      res.status(503).json({ message: 'Could not open the grown-up check.' });
    }
  });

  app.post('/api/eye-gaze/talker-state/grownup-challenge', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child || req.user.role !== 'student') return res.status(403).json({ message: 'Open this from the child Talker account.' });
      const challengeId = String(req.body?.challengeId || '');
      const challenge = talkerChallenges.get(challengeId);
      talkerChallenges.delete(challengeId);
      if (!challenge || challenge.studentId !== child.id || challenge.expiresAt <= Date.now()) {
        return res.status(400).json({ message: 'That question expired. Try a new one.' });
      }
      if (Number(req.body?.answer) !== challenge.answer) {
        return res.status(400).json({ message: 'Not quite. Try a new grown-up question.' });
      }
      const grownupToken = randomBytes(24).toString('hex');
      talkerGrownupPasses.set(grownupToken, { studentId: child.id, expiresAt: Date.now() + 30 * 60_000 });
      res.set('Cache-Control', 'no-store');
      res.json({ grownupToken, expiresInSeconds: 1800 });
    } catch {
      res.status(503).json({ message: 'Could not verify the grown-up check.' });
    }
  });

  app.get('/api/eye-gaze/talker-state', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child) return res.status(403).json({ message: 'A linked Eye Gazer account is required.' });
      const { data, error } = await getAdminSupabase().from('eye_gaze_talker_state')
        .select('config,progress').eq('student_id', child.id).maybeSingle();
      if (error) throw error;
      res.set('Cache-Control', 'no-store');
      res.json({ student: { id: child.id, name: child.displayName }, ...(data || emptyTalker) });
    } catch (error: any) {
      console.error('[eye-gaze-talker] load:', error?.message);
      res.status(503).json({ message: 'Could not load the family talker right now.' });
    }
  });

  app.post('/api/eye-gaze/talker-state/config', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child) return res.status(403).json({ message: 'A linked Eye Gazer account is required.' });
      if (!validTalkerGrownupPass(req, child.id)) return res.status(403).json({ message: 'Answer the grown-up math question to edit Talker words.' });
      const submitted = req.body || {};
      const { data: existingTalker } = await getAdminSupabase().from('eye_gaze_talker_state')
        .select('config').eq('student_id', child.id).maybeSingle();
      const submittedOverrides = submitted.overrides ?? existingTalker?.config?.overrides ?? {};
      const submittedRecordings = submitted.recordings ?? existingTalker?.config?.recordings ?? {};
      const submittedPageOrder = submitted.pageOrder ?? existingTalker?.config?.pageOrder ?? [];
      const submittedButtonOrder = submitted.buttonOrder ?? existingTalker?.config?.buttonOrder ?? {};
      if (!Array.isArray(submitted.alwaysHere) || submitted.alwaysHere.length > 24
        || !submitted.pictures || typeof submitted.pictures !== 'object' || Array.isArray(submitted.pictures)
        || Object.keys(submitted.pictures).length > 50
        || !submittedOverrides || typeof submittedOverrides !== 'object' || Array.isArray(submittedOverrides)
        || Object.keys(submittedOverrides).length > 120
        || !submittedRecordings || typeof submittedRecordings !== 'object' || Array.isArray(submittedRecordings)
        || Object.keys(submittedRecordings).length > 120
        || !Array.isArray(submittedPageOrder) || submittedPageOrder.length > 20
        || !submittedButtonOrder || typeof submittedButtonOrder !== 'object' || Array.isArray(submittedButtonOrder)
        || Object.keys(submittedButtonOrder).length > 20) {
        return res.status(400).json({ message: 'Please keep Talker customization within the supported limits.' });
      }
      const ids = new Set<string>();
      const alwaysHere = [];
      for (const button of submitted.alwaysHere) {
        const id = String(button?.id || '');
        const label = String(button?.label || '').trim().slice(0, 40);
        const sentence = String(button?.sentence || '').trim().slice(0, 180);
        const picture = String(button?.picture || '💬').slice(0, 16);
        if (!/^[a-z0-9_-]{1,50}$/.test(id) || ids.has(id) || !label || !sentence
          || (button?.imageData && !validTalkerPhoto(button.imageData))) {
          return res.status(400).json({ message: 'Check the button names, phrases, and pictures.' });
        }
        ids.add(id);
        alwaysHere.push({ id, label, sentence, picture, imageData: button?.imageData || null });
      }
      const pictures: Record<string, string> = {};
      for (const [key, value] of Object.entries(submitted.pictures)) {
        if (!/^[a-z0-9 -]{1,40}$/.test(key) || !validTalkerPhoto(value)) {
          return res.status(400).json({ message: 'A picture could not be saved. Try a smaller JPG, PNG, or WEBP.' });
        }
        pictures[key] = value as string;
      }
      const overrides: Record<string, { label?: string; sentence?: string; picture?: string }> = {};
      for (const [key, raw] of Object.entries(submittedOverrides)) {
        if (!/^[a-z0-9 _-]{1,60}$/.test(key) || !raw || typeof raw !== 'object') return res.status(400).json({ message: 'One word edit could not be saved.' });
        const value: any = raw;
        const label = String(value.label || '').trim().slice(0, 40);
        const sentence = String(value.sentence || '').trim().slice(0, 180);
        const picture = String(value.picture || '').slice(0, 16);
        overrides[key] = { ...(label ? { label } : {}), ...(sentence ? { sentence } : {}), ...(picture ? { picture } : {}) };
      }

      const recordings: Record<string, { word?: string; sentence?: string }> = {};
      for (const [key, raw] of Object.entries(submittedRecordings)) {
        if (!/^[a-z0-9 _-]{1,60}$/.test(key) || !raw || typeof raw !== 'object') return res.status(400).json({ message: 'One voice recording could not be saved.' });
        const value: any = raw;
        const wordAudio = value.word && validTalkerAudio(value.word) ? String(value.word) : '';
        const sentenceAudio = value.sentence && validTalkerAudio(value.sentence) ? String(value.sentence) : '';
        if ((value.word && !wordAudio) || (value.sentence && !sentenceAudio)) return res.status(400).json({ message: 'Keep each parent voice recording short.' });
        recordings[key] = { ...(wordAudio ? { word: wordAudio } : {}), ...(sentenceAudio ? { sentence: sentenceAudio } : {}) };
      }

      const pageOrder = submittedPageOrder.map((value: any) => String(value).trim().toLowerCase().slice(0, 32)).filter((value: string) => /^[a-z0-9_-]+$/.test(value));
      const buttonOrder: Record<string, string[]> = {};
      for (const [page, rawOrder] of Object.entries(submittedButtonOrder)) {
        const pageKey = String(page).trim().toLowerCase().slice(0, 32);
        if (!/^[a-z0-9_-]+$/.test(pageKey) || !Array.isArray(rawOrder) || rawOrder.length > 120) {
          return res.status(400).json({ message: 'One Talker page order could not be saved.' });
        }
        buttonOrder[pageKey] = rawOrder.map((value: any) => String(value).trim().toLowerCase().slice(0, 60)).filter(Boolean);
      }

      const config = { alwaysHere, pictures, overrides, recordings, pageOrder, buttonOrder };
      if (JSON.stringify(config).length > 4_500_000) return res.status(413).json({ message: 'Too many Talker photos or recordings. Remove a few before saving.' });
      const { error } = await getAdminSupabase().from('eye_gaze_talker_state').upsert({
        student_id: child.id, config, updated_at: new Date().toISOString(),
      }, { onConflict: 'student_id' });
      if (error) throw error;
      res.set('Cache-Control', 'no-store');
      res.json({ config });
    } catch (error: any) {
      console.error('[eye-gaze-talker] save config:', error?.message);
      res.status(503).json({ message: 'Could not save the talker. Please try again.' });
    }
  });

  app.post('/api/eye-gaze/talker-state/practice', authMiddleware, async (req: any, res) => {
    try {
      const child = await talkerStudent(req);
      if (!child) return res.status(403).json({ message: 'A linked Eye Gazer account is required.' });
      const word = String(req.body?.word || '').trim().slice(0, 40);
      const outcome = String(req.body?.outcome || '');
      if (!word || !/^[^\x00-\x1F<>]{1,40}$/.test(word) || !['known', 'learning', 'practiced', 'correct', 'retry'].includes(outcome)) {
        return res.status(400).json({ message: 'Choose a word and a practice result.' });
      }
      const adminDb = getAdminSupabase();
      const { data, error: loadError } = await adminDb.from('eye_gaze_talker_state')
        .select('progress').eq('student_id', child.id).maybeSingle();
      if (loadError) throw loadError;
      const previous = data?.progress || emptyTalker.progress;
      const words = previous.words && typeof previous.words === 'object' ? { ...previous.words } : {};
      const key = word.toLocaleLowerCase('en-US');
      const now = new Date().toISOString();
      const old = words[key] || {};
      const answer = outcome === 'correct' || outcome === 'retry';
      words[key] = {
        label: word, status: ['known', 'learning'].includes(outcome) ? outcome : old.status || 'learning',
        timesPracticed: Math.min(9999, (Number(old.timesPracticed) || 0) + 1),
        attemptCount: (Number(old.attemptCount) || 0) + (answer ? 1 : 0),
        correctCount: (Number(old.correctCount) || 0) + (outcome === 'correct' ? 1 : 0),
        lastPracticedAt: now,
        knownAt: outcome === 'known' ? now : outcome === 'learning' ? null : old.knownAt || null,
      };
      const prompt = Number(req.body?.prompt);
      const history = [...(Array.isArray(previous.history) ? previous.history.slice(-119) : []), { word, outcome, at: now, ...(Number.isInteger(prompt) && prompt >= 1 && prompt <= 3 ? { prompt } : {}) }];
      const progress = { words, history };
      const { error } = await adminDb.from('eye_gaze_talker_state').upsert({
        student_id: child.id, progress, updated_at: now,
      }, { onConflict: 'student_id' });
      if (error) throw error;
      res.set('Cache-Control', 'no-store');
      res.json({ progress });
    } catch (error: any) {
      console.error('[eye-gaze-talker] save practice:', error?.message);
      res.status(503).json({ message: 'Could not save practice. Please try again.' });
    }
  });

  console.log("[eye-gaze-tts] natural voice configured:", !!process.env.OPENAI_API_KEY);

  app.get("/api/eye-gaze/tts/status", (_req, res) => {
    res.json({
      configured: !!process.env.OPENAI_API_KEY,
      provider: process.env.OPENAI_API_KEY ? "openai" : null,
      model: process.env.OPENAI_API_KEY ? "gpt-4o-mini-tts" : null,
    });
  });

  // Shared in-process cache for neural Learning Buddy speech.
  // One generated phrase can be reused across students until the service restarts.
  const ttsAudioCache = new Map<string, { audio: Buffer; lastUsed: number }>();
  const ttsAudioInFlight = new Map<string, Promise<Buffer>>();
  const TTS_AUDIO_CACHE_LIMIT = 250;

  function rememberTtsAudio(key: string, audio: Buffer) {
    if (ttsAudioCache.has(key)) ttsAudioCache.delete(key);
    ttsAudioCache.set(key, { audio, lastUsed: Date.now() });

    while (ttsAudioCache.size > TTS_AUDIO_CACHE_LIMIT) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [candidateKey, entry] of ttsAudioCache.entries()) {
        if (entry.lastUsed < oldestTime) {
          oldestTime = entry.lastUsed;
          oldestKey = candidateKey;
        }
      }
      if (!oldestKey) break;
      ttsAudioCache.delete(oldestKey);
    }
  }

  async function generateTtsAudio(text: string, calmMode: boolean, apiKey: string, style: "buddy" | "announcer" = "buddy"): Promise<Buffer> {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: style === "announcer" ? "cedar" : "marin",
        input: text,
        instructions: (style === "announcer"
          ? "Speak in a confident masculine game-show and sports-arena announcer style. Deep, energetic, cinematic, exciting, clear, and age-appropriate. Use dramatic pauses without shouting. Make Board Quest feel like a major competition."
          : calmMode
            ? "Speak like a warm, gentle, friendly children's educational character. Natural human pacing, soft enthusiasm, clear pronunciation, reassuring tone, no exaggerated baby talk."
            : "Speak like a lively, warm, friendly children's educational character hosting an interactive reading game. Sound natural and human, expressive and encouraging, with playful energy, clear pronunciation, and short natural pauses. Do not sound like a screen reader or announcer.")
          + " Read every word of the input verbatim from beginning to end; do not omit, paraphrase, or cut off the last words.",
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      const error: any = new Error(`OpenAI speech failed: ${response.status}`);
      error.status = response.status;
      error.detail = errText.slice(0, 300);
      throw error;
    }

    return Buffer.from(await response.arrayBuffer());
  }

  // Neural Learning Buddy voice. Uses OpenAI TTS when OPENAI_API_KEY is configured.
  // The generated voice is AI-generated and should be disclosed to users.
  app.post("/api/eye-gaze/tts", authMiddleware, async (req: any, res) => {
    try {
      const text = String(req.body?.text || "").trim();
      const calmMode = !!req.body?.calmMode;
      const style: "buddy" | "announcer" = req.body?.style === "announcer" ? "announcer" : "buddy";

      if (!text) return res.status(400).json({ message: "Text is required." });
      if (text.length > 500) return res.status(400).json({ message: "Text is too long." });

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ message: "AI voice is not configured." });
      }

      const cacheKey = `${style}|${calmMode ? "calm" : "normal"}|${text}`;
      const cached = ttsAudioCache.get(cacheKey);

      if (cached) {
        cached.lastUsed = Date.now();
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "private, max-age=3600");
        res.setHeader("X-ARISE-TTS-Cache", "HIT");
        return res.send(cached.audio);
      }

      let pending = ttsAudioInFlight.get(cacheKey);
      if (!pending) {
        pending = generateTtsAudio(text, calmMode, apiKey, style);
        ttsAudioInFlight.set(cacheKey, pending);
      }

      let audio: Buffer;
      try {
        audio = await pending;
      } catch (error: any) {
        console.error("[eye-gaze-tts] OpenAI speech failed:", error?.status || "", error?.detail || error?.message);
        return res.status(502).json({ message: "AI voice is temporarily unavailable." });
      } finally {
        if (ttsAudioInFlight.get(cacheKey) === pending) {
          ttsAudioInFlight.delete(cacheKey);
        }
      }

      rememberTtsAudio(cacheKey, audio);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.setHeader("X-ARISE-TTS-Cache", "MISS");
      res.send(audio);
    } catch (error: any) {
      console.error("[eye-gaze-tts] failed:", error?.message);
      res.status(500).json({ message: "Could not create AI voice." });
    }
  });

  // A short, opt-in recording is transcribed for the Talker's word practice.
  // The recording is forwarded to the transcription service and is never persisted here.
  app.post("/api/eye-gaze/listen", authMiddleware, raw({ type: ["audio/webm", "audio/ogg", "audio/mp4"], limit: "2mb" }), async (req: any, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!req.user?.is_eye_gaze_user) return res.status(403).json({ message: "Eye Gazer account required." });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(503).json({ message: "Listening is unavailable right now." });
    const mime = String(req.headers["content-type"] || "").split(";")[0].toLowerCase();
    const extension = mime === "audio/mp4" ? "mp4" : mime === "audio/ogg" ? "ogg" : mime === "audio/webm" ? "webm" : null;
    const audio: Buffer = req.body;
    if (!extension || !Buffer.isBuffer(audio) || audio.length < 500 || audio.length > 2_000_000) {
      return res.status(400).json({ message: "Please try recording again." });
    }
    try {
      const form = new FormData();
      form.append("model", "gpt-4o-mini-transcribe");
      form.append("language", "en");
      form.append("response_format", "json");
      form.append("file", new Blob([Uint8Array.from(audio)], { type: mime }), `word.${extension}`);
      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        console.error("[eye-gaze-listen] transcription failed:", response.status);
        return res.status(502).json({ message: "I couldn't listen that time. Please try again." });
      }
      const result: any = await response.json();
      res.json({ heard: String(result?.text || "").trim().slice(0, 120) });
    } catch (error: any) {
      console.error("[eye-gaze-listen] failed:", error?.name || error?.message);
      res.status(502).json({ message: "I couldn't listen that time. Please try again." });
    }
  });

  // Learning Buddy preference for Eye Gaze games
  app.get("/api/eye-gaze/learning-buddy", authMiddleware, async (req: any, res) => {
    try {
      const raw = await storage.getSetting(`learning_buddy_${req.user.id}`);
      if (!raw) {
        return res.json({ type: "preset", preset: "puppy", name: "Buddy", imageData: null, voiceEnabled: true, calmMode: false });
      }
      try {
        const parsed = JSON.parse(raw);
        res.set("Cache-Control", "no-store");
        return res.json(parsed);
      } catch {
        return res.json({ type: "preset", preset: "puppy", name: "Buddy", imageData: null, voiceEnabled: true, calmMode: false });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Could not load Learning Buddy." });
    }
  });

  app.post("/api/eye-gaze/learning-buddy", authMiddleware, async (req: any, res) => {
    try {
      const { type, preset, name, imageData, voiceEnabled, calmMode } = req.body || {};
      const allowedPresets = ["puppy", "dino", "robot", "bunny"];
      const safeType = type === "upload" ? "upload" : "preset";
      const safePreset = allowedPresets.includes(preset) ? preset : "puppy";
      const safeName = String(name || "Buddy").trim().slice(0, 30) || "Buddy";

      let safeImageData: string | null = null;
      if (safeType === "upload") {
        if (typeof imageData !== "string" || !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(imageData)) {
          return res.status(400).json({ message: "Please upload a PNG, JPG, or WEBP image." });
        }
        if (imageData.length > 2_000_000) {
          return res.status(400).json({ message: "That picture is too large. Please use an image under about 1.5 MB." });
        }
        safeImageData = imageData;
      }

      const value = {
        type: safeType,
        preset: safePreset,
        name: safeName,
        imageData: safeImageData,
        voiceEnabled: voiceEnabled !== false,
        calmMode: !!calmMode,
      };
      await storage.upsertSetting(`learning_buddy_${req.user.id}`, JSON.stringify(value));
      res.json(value);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Could not save Learning Buddy." });
    }
  });

  // Celebration style preference
  app.get("/api/eye-gaze/celebration-style", authMiddleware, async (req: any, res) => {
    try {
      const style = await storage.getSetting(`celebration_style_${req.user.id}`);
      res.json({ style: style || "confetti" });
    } catch {
      res.json({ style: "confetti" });
    }
  });

  app.post("/api/eye-gaze/celebration-style", authMiddleware, async (req: any, res) => {
    try {
      const { style } = req.body;
      if (!style) return res.status(400).json({ message: "style is required" });
      await storage.saveSetting(`celebration_style_${req.user.id}`, style);
      res.json({ success: true, style });
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

      // The admin's bell lists pending Eye Gaze requests by itself; this is the email.
      alertAdmin("approval_request", {
        title: `Eye Gaze mode request: ${personName(req.user)} wants it ${requested ? "on" : "off"}`,
        summary: `@${req.user.username}`,
        lines: [["Student", `${personName(req.user)} (@${req.user.username})`], ["Wants", requested ? "Eye Gaze mode on" : "Eye Gaze mode off"]],
        note: "Approve or deny it under Admin → To-do → Student requests.",
        ref: `u${req.user.id}`,
        row: false,
      });

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
      
      // The admin's bell lists pending grade changes by itself; this is the email.
      alertAdmin("approval_request", {
        title: `Grade change request: ${personName(req.user)}`,
        summary: `Grade ${oldGrade || "?"} → Grade ${newGrade} (${newBand} band)`,
        lines: [["Student", `${personName(req.user)} (@${req.user.username})`], ["Now", `Grade ${oldGrade || "not set"}${oldBand ? ` (${oldBand} band)` : ""}`], ["Wants", `Grade ${newGrade} (${newBand} band)`]],
        note: "Approve or deny it under Admin → To-do → Student requests.",
        ref: `u${req.user.id}`,
        row: false,
      });
      
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
  app.get("/api/teachers", async (req: any, res) => {
    try {
      const teachers = await storage.getApprovedTeachers();
      // Emails and usernames are only for the admin; sign-up pages need names.
      const session = await sessionFromRequest(req);
      res.json(session?.user?.isAdmin ? teachers : teachers.map(publicTeacher));
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


  // === Teacher Scenes =========================================================
  // Teachers create one wide, saved visualization for up to three chapters.
  // Images are generated once at low quality, stored privately, and re-used on
  // every future view so presenting a saved Scene does not spend AI credits.
  const TEACHER_SCENES_BUCKET = "teacher-scenes";
  let teacherScenesBucketReady = false;
  const teacherScenesDailyUsage = new Map<string, number>();

  type TeacherSceneLabel = { name: string; x: number; y: number };
  type TeacherSceneQuestion = { id: string; prompt: string; options: string[]; correct: "A" | "B" | "C" | "D" };

  type TeacherScene = {
    id: string;
    teacherId: number;
    bookTitle: string;
    author: string;
    chapterStart: number;
    chapterEnd: number;
    characters: string[];
    sceneNotes: string;
    style: string;
    labelCharacters: boolean;
    characterLabels?: TeacherSceneLabel[];
    questions?: TeacherSceneQuestion[];
    imagePath: string;
    fingerprint: string;
    createdAt: string;
  };

  const teacherSceneKey = (teacherId: number) => "teacher_scenes_" + teacherId;

  const readTeacherScenes = async (teacherId: number): Promise<TeacherScene[]> => {
    const rawScenes = await storage.getSetting(teacherSceneKey(teacherId));
    if (!rawScenes) return [];
    try {
      const parsed = JSON.parse(rawScenes);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const saveTeacherScenes = async (teacherId: number, scenes: TeacherScene[]) => {
    await storage.upsertSetting(teacherSceneKey(teacherId), JSON.stringify(scenes.slice(0, 120)));
  };

  const sceneFingerprint = (value: string) => {
    let hash = 5381;
    for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
    return (hash >>> 0).toString(36);
  };

  const ensureTeacherScenesBucket = async () => {
    if (teacherScenesBucketReady) return;
    const adminDb = getAdminSupabase();
    const existing = await adminDb.storage.getBucket(TEACHER_SCENES_BUCKET);
    if (!existing.data) {
      const created = await adminDb.storage.createBucket(TEACHER_SCENES_BUCKET, {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: ["image/webp", "image/jpeg", "image/png"],
      });
      if (created.error && !/already exists/i.test(String(created.error.message || ""))) throw created.error;
    }
    teacherScenesBucketReady = true;
  };

  const signTeacherScene = async (scene: TeacherScene) => {
    const signed = await getAdminSupabase().storage.from(TEACHER_SCENES_BUCKET).createSignedUrl(scene.imagePath, 60 * 60);
    return { ...scene, imageUrl: signed.data?.signedUrl || null };
  };

  app.get("/api/teacher/scenes", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      if (!req.user.isAdmin && req.user.accountApproved === false) return res.status(403).json({ message: "Teacher account approval required." });
      const scenes = (await readTeacherScenes(req.user.id)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      const signed = [];
      for (const scene of scenes) signed.push(await signTeacherScene(scene));
      res.set("Cache-Control", "no-store");
      res.json({ scenes: signed });
    } catch (error: any) {
      console.error("[teacher-scenes] load failed:", error?.message);
      res.status(503).json({ message: "Could not load your saved Scenes right now." });
    }
  });

  app.post("/api/teacher/scenes/generate", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      if (!req.user.isAdmin && req.user.accountApproved === false) return res.status(403).json({ message: "Teacher account approval required." });

      const bookTitle = String(req.body?.bookTitle || "").trim().slice(0, 120);
      const author = String(req.body?.author || "").trim().slice(0, 100);
      const chapterStart = Math.max(1, Math.floor(Number(req.body?.chapterStart) || 1));
      const chapterEnd = Math.max(chapterStart, Math.floor(Number(req.body?.chapterEnd) || chapterStart));
      const characters = (Array.isArray(req.body?.characters) ? req.body.characters : [])
        .map((name: unknown) => String(name || "").trim().slice(0, 60))
        .filter(Boolean)
        .slice(0, 12);
      const sceneNotes = String(req.body?.sceneNotes || "").trim().slice(0, 2200);
      const allowedStyles = new Set(["cinematic illustrated", "graphic novel", "warm storybook", "semi-realistic classroom visual"]);
      const requestedStyle = String(req.body?.style || "cinematic illustrated");
      const style = allowedStyles.has(requestedStyle) ? requestedStyle : "cinematic illustrated";
      const labelCharacters = req.body?.labelCharacters !== false;

      if (!bookTitle) return res.status(400).json({ message: "Book title is required." });
      if (chapterEnd - chapterStart > 2) return res.status(400).json({ message: "One panorama can cover up to three chapters." });
      if (sceneNotes.length < 20) return res.status(400).json({ message: "Add a short description of what students should see." });

      const fingerprintSource = JSON.stringify({
        bookTitle: bookTitle.toLowerCase(),
        author: author.toLowerCase(),
        chapterStart,
        chapterEnd,
        characters: characters.map((name: string) => name.toLowerCase()),
        sceneNotes: sceneNotes.toLowerCase(),
        style,
        labelCharacters,
      });
      const fingerprint = sceneFingerprint(fingerprintSource);
      const existingScenes = await readTeacherScenes(req.user.id);
      const existing = existingScenes.find((scene) => scene.fingerprint === fingerprint);
      if (existing) {
        return res.json({ scene: await signTeacherScene(existing), reused: true });
      }

      const today = new Date().toISOString().slice(0, 10);
      const usageKey = String(req.user.id) + ":" + today;
      const usedToday = teacherScenesDailyUsage.get(usageKey) || 0;
      if (usedToday >= 25) {
        return res.status(429).json({ message: "You reached today's Scene generation limit. Saved Scenes still work and do not use AI credits." });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return res.status(503).json({ message: "Scene generation is not configured on the server yet." });
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ message: "Scene storage is not configured on the server yet." });

      const chapterCount = chapterEnd - chapterStart + 1;
      const chapterLabel = chapterCount === 1
        ? "Chapter " + chapterStart
        : "Chapters " + chapterStart + " through " + chapterEnd;
      const characterInstruction = characters.length
        ? "Keep these named characters visually consistent across every panel: " + characters.join(", ") + "."
        : "Keep recurring characters visually consistent across every panel.";
      const labelInstruction = "Do not draw character-name text into the image. A.R.I.S.E. will add crisp interactive character labels as a separate website layer.";

      const prompt = [
        "Create one extra-wide classroom visualization panorama for a teacher helping students visualize a novel while it is read aloud.",
        "Book context: " + bookTitle + (author ? " by " + author : "") + ".",
        "Coverage: " + chapterLabel + ".",
        "The teacher supplied a brief scene summary below. Visualize ONLY those supplied details. Do not add spoilers or events from later chapters.",
        chapterCount > 1
          ? "Divide the panorama left-to-right into " + chapterCount + " clearly distinct but visually connected chapter scenes, one section per chapter in order."
          : "Create one strong continuous scene for this chapter.",
        "Use a " + style + " look: polished, expressive, student-friendly, cinematic lighting, clear faces and body language, rich environmental detail, and age-appropriate imagery.",
        characterInstruction,
        labelInstruction,
        "If chapter markers are used, keep them short and readable (for example CHAPTER 4). Do not reproduce book pages, quotations, cover art, publisher logos, or copyrighted text.",
        "The image should function as a visual support, not a replacement for reading the book.",
        "Teacher scene notes:",
        sceneNotes,
      ].join("\n");

      const generation = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-2.5-flare",
          prompt,
          size: "1536x768",
          quality: "low",
          output_format: "webp",
          output_compression: 82,
          n: 1,
          user: String(req.user.id),
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!generation.ok) {
        const detail = await generation.text().catch(() => "");
        console.error("[teacher-scenes] OpenAI image failed:", generation.status, detail.slice(0, 800));
        const message = generation.status === 403
          ? "Image generation is not enabled for this API organization yet."
          : generation.status === 429
            ? "Scene generation is busy or has reached the API rate limit. Try again shortly."
            : "The AI could not create that Scene right now.";
        return res.status(generation.status === 429 ? 429 : 503).json({ message });
      }

      const payload: any = await generation.json();
      const imageBase64 = payload?.data?.[0]?.b64_json;
      if (!imageBase64) throw new Error("The image service returned no image data.");
      const imageBytes = Buffer.from(imageBase64, "base64");
      if (!imageBytes.length || imageBytes.length > 10 * 1024 * 1024) throw new Error("The generated Scene image was invalid.");

      await ensureTeacherScenesBucket();
      const id = randomBytes(8).toString("hex");
      const imagePath = String(req.user.id) + "/" + Date.now() + "-" + id + ".webp";
      const uploaded = await getAdminSupabase().storage.from(TEACHER_SCENES_BUCKET).upload(imagePath, imageBytes, {
        contentType: "image/webp",
        cacheControl: "86400",
        upsert: false,
      });
      if (uploaded.error) throw uploaded.error;

      const scene: TeacherScene = {
        id,
        teacherId: req.user.id,
        bookTitle,
        author,
        chapterStart,
        chapterEnd,
        characters,
        sceneNotes,
        style,
        labelCharacters,
        characterLabels: [],
        questions: [],
        imagePath,
        fingerprint,
        createdAt: new Date().toISOString(),
      };
      await saveTeacherScenes(req.user.id, [scene, ...existingScenes]);
      teacherScenesDailyUsage.set(usageKey, usedToday + 1);

      res.status(201).json({ scene: await signTeacherScene(scene), reused: false });
    } catch (error: any) {
      console.error("[teacher-scenes] generation failed:", error?.name || error?.message);
      res.status(503).json({ message: "Could not create and save that Scene right now." });
    }
  });



  app.post("/api/teacher/scenes/:id/labels", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const id = String(req.params.id || "").trim();
      const scenes = await readTeacherScenes(req.user.id);
      const index = scenes.findIndex(scene => scene.id === id);
      if (index < 0) return res.status(404).json({ message: "Scene not found." });
      const allowedNames = new Set((scenes[index].characters || []).map(name => String(name)));
      const labels: TeacherSceneLabel[] = (Array.isArray(req.body?.labels) ? req.body.labels : [])
        .map((label: any) => ({
          name: String(label?.name || "").trim().slice(0, 60),
          x: Math.max(0, Math.min(100, Number(label?.x) || 0)),
          y: Math.max(0, Math.min(100, Number(label?.y) || 0)),
        }))
        .filter(label => label.name && allowedNames.has(label.name))
        .slice(0, 20);
      scenes[index] = { ...scenes[index], characterLabels: labels, labelCharacters: labels.length > 0 || scenes[index].labelCharacters };
      await saveTeacherScenes(req.user.id, scenes);
      res.json({ scene: await signTeacherScene(scenes[index]) });
    } catch (error: any) {
      console.error("[teacher-scenes] label save failed:", error?.message);
      res.status(500).json({ message: "Could not save character labels." });
    }
  });

  app.post("/api/teacher/scenes/:id/questions/generate", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const id = String(req.params.id || "").trim();
      const count = Math.max(1, Math.min(5, Math.round(Number(req.body?.count) || 1)));
      const scenes = await readTeacherScenes(req.user.id);
      const index = scenes.findIndex(scene => scene.id === id);
      if (index < 0) return res.status(404).json({ message: "Scene not found." });
      const scene = scenes[index];
      const apiKey = process.env.OPENAI_API_KEY || "";
      if (!apiKey) return res.status(503).json({ message: "Interactive question generation is temporarily unavailable." });

      const prompt = [
        "Create exactly " + count + " multiple-choice comprehension question" + (count === 1 ? "" : "s") + " for a teacher using a visual scene while reading a book aloud.",
        "Book: " + scene.bookTitle + (scene.author ? " by " + scene.author : ""),
        "Chapters: " + scene.chapterStart + (scene.chapterEnd !== scene.chapterStart ? "-" + scene.chapterEnd : ""),
        "Teacher scene notes: " + scene.sceneNotes,
        "Make each question answerable from the teacher-provided scene notes and appropriate for students. Do not introduce spoilers or facts outside the notes.",
        'Return ONLY JSON: {"questions":[{"prompt":"...","options":["...","...","...","..."],"correct":"A"}]}',
        "Use exactly four choices and correct must be A, B, C, or D."
      ].join("\n");

      const ai = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          temperature: 0.35,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You create concise, safe K-12 reading-comprehension questions. Return valid JSON only." },
            { role: "user", content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!ai.ok) {
        const detail = await ai.text().catch(() => "");
        console.error("[teacher-scenes] OpenAI question generation failed:", ai.status, detail.slice(0, 500));
        throw new Error("Question AI request failed (" + ai.status + ").");
      }
      const payload: any = await ai.json();
      const raw = String(payload?.choices?.[0]?.message?.content || "{}");
      const parsed = JSON.parse(raw);
      const letters = ["A", "B", "C", "D"] as const;
      const questions: TeacherSceneQuestion[] = (Array.isArray(parsed?.questions) ? parsed.questions : []).slice(0, count).map((q: any) => {
        const options = (Array.isArray(q?.options) ? q.options : []).slice(0, 4).map((v: any) => String(v || "").trim().slice(0, 180));
        const correct = letters.includes(String(q?.correct || "").toUpperCase() as any) ? String(q.correct).toUpperCase() as "A" | "B" | "C" | "D" : "A";
        return { id: randomBytes(6).toString("hex"), prompt: String(q?.prompt || "").trim().slice(0, 300), options, correct };
      }).filter((q: TeacherSceneQuestion) => q.prompt && q.options.length === 4);
      if (!questions.length) throw new Error("Question AI returned no usable questions.");

      scenes[index] = { ...scene, questions };
      await saveTeacherScenes(req.user.id, scenes);
      res.json({ scene: await signTeacherScene(scenes[index]), questions });
    } catch (error: any) {
      console.error("[teacher-scenes] question generation failed:", error?.message);
      res.status(503).json({ message: "Could not generate questions for this Scene right now." });
    }
  });

  type TeacherSceneLiveSession = {
    id: string;
    code: string;
    teacherId: number;
    teacherName: string;
    sceneId: string;
    status: "live" | "ended";
    createdAt: string;
    updatedAt: string;
    viewers: number[];
    currentQuestionId?: string | null;
    answers?: Record<string, Record<string, { studentId: number; studentName: string; choice: string; submittedAt: string }>>;
  };

  const TEACHER_SCENE_LIVE_KEY = "teacher_scene_live_sessions_v1";

  const readSceneLiveSessions = async (): Promise<Record<string, TeacherSceneLiveSession>> => {
    const raw = await storage.getSetting(TEACHER_SCENE_LIVE_KEY);
    let sessions: Record<string, TeacherSceneLiveSession> = {};
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) sessions = parsed;
      } catch {}
    }
    const now = Date.now();
    let changed = false;
    for (const [code, session] of Object.entries(sessions)) {
      const age = now - Date.parse(session.updatedAt || session.createdAt || "");
      if (!Number.isFinite(age) || age > 24 * 60 * 60 * 1000) {
        delete sessions[code];
        changed = true;
      }
    }
    if (changed) await storage.upsertSetting(TEACHER_SCENE_LIVE_KEY, JSON.stringify(sessions));
    return sessions;
  };

  const saveSceneLiveSessions = async (sessions: Record<string, TeacherSceneLiveSession>) => {
    await storage.upsertSetting(TEACHER_SCENE_LIVE_KEY, JSON.stringify(sessions));
  };

  const makeSceneLiveCode = (sessions: Record<string, TeacherSceneLiveSession>) => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let attempt = 0; attempt < 30; attempt++) {
      let value = "";
      for (let i = 0; i < 6; i++) value += alphabet[Math.floor(Math.random() * alphabet.length)];
      if (!sessions[value]) return value;
    }
    return randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
  };

  const publicSceneLivePayload = async (session: TeacherSceneLiveSession, userId?: number, isHost = false) => {
    const teacherScenes = await readTeacherScenes(session.teacherId);
    const scene = teacherScenes.find(item => item.id === session.sceneId);
    const signedScene: any = scene ? await signTeacherScene(scene) : null;
    const question = scene?.questions?.find(item => item.id === session.currentQuestionId) || null;
    const answerMap = question ? (session.answers?.[question.id] || {}) : {};
    const ownAnswer = userId && question ? answerMap[String(userId)] || null : null;
    const safeScene = signedScene ? {
      ...signedScene,
      questions: isHost ? (signedScene.questions || []) : undefined,
    } : null;
    return {
      id: session.id,
      code: session.code,
      teacherId: session.teacherId,
      teacherName: session.teacherName,
      status: session.status,
      updatedAt: session.updatedAt,
      viewerCount: Array.isArray(session.viewers) ? session.viewers.length : 0,
      scene: safeScene,
      currentQuestion: question ? {
        id: question.id,
        prompt: question.prompt,
        options: question.options,
        ...(isHost ? { correct: question.correct } : {}),
      } : null,
      ...(isHost ? { responses: Object.values(answerMap) } : { myAnswer: ownAnswer ? { choice: ownAnswer.choice, submittedAt: ownAnswer.submittedAt } : null }),
    };
  };

  app.post("/api/teacher/scenes/live/start", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const sceneId = String(req.body?.sceneId || "").trim();
      const teacherScenes = await readTeacherScenes(req.user.id);
      const scene = teacherScenes.find(item => item.id === sceneId);
      if (!scene) return res.status(404).json({ message: "Choose one of your saved Scenes first." });

      const sessions = await readSceneLiveSessions();
      for (const session of Object.values(sessions)) {
        if (session.teacherId === req.user.id && session.status === "live") {
          session.status = "ended";
          session.updatedAt = new Date().toISOString();
        }
      }
      const code = makeSceneLiveCode(sessions);
      const now = new Date().toISOString();
      const session: TeacherSceneLiveSession = {
        id: randomBytes(8).toString("hex"),
        code,
        teacherId: req.user.id,
        teacherName: String(req.user.displayName || req.user.username || "Teacher").slice(0, 80),
        sceneId: scene.id,
        status: "live",
        createdAt: now,
        updatedAt: now,
        viewers: [],
        currentQuestionId: null,
        answers: {},
      };
      sessions[code] = session;
      await saveSceneLiveSessions(sessions);
      res.status(201).json(await publicSceneLivePayload(session, req.user.id, (req.user.role === "teacher" || req.user.isAdmin) && session.teacherId === req.user.id));
    } catch (error: any) {
      console.error("[teacher-scenes-live] start failed:", error?.message);
      res.status(500).json({ message: "Could not start the live Scene." });
    }
  });

  app.post("/api/teacher/scenes/live/:code/select", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const code = String(req.params.code || "").trim().toUpperCase();
      const sceneId = String(req.body?.sceneId || "").trim();
      const sessions = await readSceneLiveSessions();
      const session = sessions[code];
      if (!session || session.status !== "live" || session.teacherId !== req.user.id) return res.status(404).json({ message: "Live Scene not found." });
      const teacherScenes = await readTeacherScenes(req.user.id);
      if (!teacherScenes.some(item => item.id === sceneId)) return res.status(404).json({ message: "Scene not found." });
      session.sceneId = sceneId;
      session.currentQuestionId = null;
      session.updatedAt = new Date().toISOString();
      await saveSceneLiveSessions(sessions);
      res.json(await publicSceneLivePayload(session, req.user.id, (req.user.role === "teacher" || req.user.isAdmin) && session.teacherId === req.user.id));
    } catch (error: any) {
      console.error("[teacher-scenes-live] select failed:", error?.message);
      res.status(500).json({ message: "Could not change the live Scene." });
    }
  });

  app.post("/api/teacher/scenes/live/:code/send", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const code = String(req.params.code || "").trim().toUpperCase();
      const sessions = await readSceneLiveSessions();
      const session = sessions[code];
      if (!session || session.status !== "live" || session.teacherId !== req.user.id) return res.status(404).json({ message: "Live Scene not found." });

      const roster = req.user.isAdmin
        ? (await storage.getAllUsers()).filter((u: any) => u.role === "student" && !u.isAdmin)
        : await storage.getTeacherStudents(req.user.id);
      const requestedIds = Array.isArray(req.body?.studentIds)
        ? new Set(req.body.studentIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isSafeInteger(id) && id > 0))
        : null;
      const recipients = requestedIds?.size ? roster.filter((student: any) => requestedIds.has(student.id)) : roster;
      const linkUrl = "/#/scene-live?code=" + encodeURIComponent(code);
      for (const student of recipients) {
        await storage.createMessage(
          student.id,
          "teacher",
          session.teacherName + " started a live A.R.I.S.E. Scene. Tap to join with code " + code + ".",
          linkUrl
        );
      }
      res.json({ sent: recipients.length, code });
    } catch (error: any) {
      console.error("[teacher-scenes-live] send failed:", error?.message);
      res.status(500).json({ message: "Could not send the live Scene to students." });
    }
  });

  app.post("/api/teacher/scenes/live/:code/end", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const code = String(req.params.code || "").trim().toUpperCase();
      const sessions = await readSceneLiveSessions();
      const session = sessions[code];
      if (!session || session.teacherId !== req.user.id) return res.status(404).json({ message: "Live Scene not found." });
      session.status = "ended";
      session.updatedAt = new Date().toISOString();
      await saveSceneLiveSessions(sessions);
      res.json({ status: "ended", code });
    } catch (error: any) {
      res.status(500).json({ message: "Could not end the live Scene." });
    }
  });

  app.post("/api/scenes/live/join", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== "student" || req.user.isAdmin) return res.status(403).json({ message: "Student account required." });
      const code = String(req.body?.code || "").trim().toUpperCase();
      if (!/^[A-Z2-9]{6}$/.test(code)) return res.status(400).json({ message: "Enter the 6-character Scene code." });
      const sessions = await readSceneLiveSessions();
      const session = sessions[code];
      if (!session || session.status !== "live") return res.status(404).json({ message: "That live Scene is not open. Check the code with your teacher." });
      if (!Array.isArray(session.viewers)) session.viewers = [];
      if (!session.viewers.includes(req.user.id)) session.viewers.push(req.user.id);
      session.updatedAt = new Date().toISOString();
      await saveSceneLiveSessions(sessions);
      res.json(await publicSceneLivePayload(session, req.user.id, (req.user.role === "teacher" || req.user.isAdmin) && session.teacherId === req.user.id));
    } catch (error: any) {
      console.error("[teacher-scenes-live] join failed:", error?.message);
      res.status(500).json({ message: "Could not join the live Scene." });
    }
  });


  app.post("/api/teacher/scenes/live/:code/question", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const code = String(req.params.code || "").trim().toUpperCase();
      const questionId = req.body?.questionId == null ? null : String(req.body.questionId).trim();
      const sessions = await readSceneLiveSessions();
      const session = sessions[code];
      if (!session || session.status !== "live" || session.teacherId !== req.user.id) return res.status(404).json({ message: "Live Scene not found." });
      const scenes = await readTeacherScenes(req.user.id);
      const scene = scenes.find(item => item.id === session.sceneId);
      if (questionId && !scene?.questions?.some(q => q.id === questionId)) return res.status(404).json({ message: "Question not found for this Scene." });
      session.currentQuestionId = questionId;
      session.updatedAt = new Date().toISOString();
      await saveSceneLiveSessions(sessions);
      res.json(await publicSceneLivePayload(session, req.user.id, true));
    } catch (error: any) {
      res.status(500).json({ message: "Could not launch that question." });
    }
  });

  app.post("/api/scenes/live/:code/answer", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== "student" || req.user.isAdmin) return res.status(403).json({ message: "Student account required." });
      const code = String(req.params.code || "").trim().toUpperCase();
      const choice = String(req.body?.choice || "").trim().toUpperCase();
      if (!["A", "B", "C", "D"].includes(choice)) return res.status(400).json({ message: "Choose A, B, C, or D." });
      const sessions = await readSceneLiveSessions();
      const session = sessions[code];
      if (!session || session.status !== "live") return res.status(404).json({ message: "Live Scene not found." });
      if (!session.viewers?.includes(req.user.id)) return res.status(403).json({ message: "Join the live Scene first." });
      if (!session.currentQuestionId) return res.status(400).json({ message: "Your teacher has not launched a question yet." });
      const questionId = session.currentQuestionId;
      if (!session.answers) session.answers = {};
      if (!session.answers[questionId]) session.answers[questionId] = {};
      const key = String(req.user.id);
      if (!session.answers[questionId][key]) {
        session.answers[questionId][key] = {
          studentId: req.user.id,
          studentName: String(req.user.displayName || req.user.username || "Student").slice(0, 80),
          choice,
          submittedAt: new Date().toISOString(),
        };
      }
      session.updatedAt = new Date().toISOString();
      await saveSceneLiveSessions(sessions);
      res.json({ saved: true, choice: session.answers[questionId][key].choice });
    } catch (error: any) {
      res.status(500).json({ message: "Could not save your answer." });
    }
  });

  app.get("/api/scenes/live/:code", authMiddleware, async (req: any, res) => {
    try {
      const code = String(req.params.code || "").trim().toUpperCase();
      const sessions = await readSceneLiveSessions();
      const session = sessions[code];
      if (!session) return res.status(404).json({ message: "Live Scene not found." });
      const isHost = (req.user.role === "teacher" || req.user.isAdmin) && session.teacherId === req.user.id;
      const isJoinedStudent = req.user.role === "student" && Array.isArray(session.viewers) && session.viewers.includes(req.user.id);
      if (!isHost && !isJoinedStudent) return res.status(403).json({ message: "Join this Scene with its code first." });
      res.set("Cache-Control", "no-store");
      res.json(await publicSceneLivePayload(session, req.user.id, (req.user.role === "teacher" || req.user.isAdmin) && session.teacherId === req.user.id));
    } catch (error: any) {
      res.status(500).json({ message: "Could not load the live Scene." });
    }
  });

  app.delete("/api/teacher/scenes/:id", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      if (!req.user.isAdmin && req.user.accountApproved === false) return res.status(403).json({ message: "Teacher account approval required." });
      const id = String(req.params.id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
      const scenes = await readTeacherScenes(req.user.id);
      const target = scenes.find((scene) => scene.id === id);
      if (!target) return res.status(404).json({ message: "Scene not found." });
      const next = scenes.filter((scene) => scene.id !== id);
      await saveTeacherScenes(req.user.id, next);
      try {
        await ensureTeacherScenesBucket();
        await getAdminSupabase().storage.from(TEACHER_SCENES_BUCKET).remove([target.imagePath]);
      } catch (storageError: any) {
        console.warn("[teacher-scenes] image cleanup failed:", storageError?.message);
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("[teacher-scenes] delete failed:", error?.message);
      res.status(503).json({ message: "Could not delete that Scene." });
    }
  });

  // Print-only parent invites. Teachers can print their roster; admins can print all students.
  app.post('/api/parent-invites/print', authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      if (!req.user.isAdmin && req.user.accountApproved === false) return res.status(403).json({ message: 'Teacher account approval required.' });
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ message: 'Parent codes are not configured.' });
      const studentId = req.body?.studentId;
      if (studentId !== undefined && (!Number.isSafeInteger(studentId) || studentId < 1)) return res.status(400).json({ message: 'Invalid student.' });
      const allStudents = (await storage.getAllUsers()).filter((u: any) => u.role === 'student' && (req.user.isAdmin || u.teacherId === req.user.id));
      const students = studentId === undefined ? allStudents : allStudents.filter((u: any) => u.id === studentId);
      if (studentId !== undefined && students.length === 0) return res.status(404).json({ message: 'Student not found on your roster.' });
      const adminDb = getAdminSupabase();
      const rows: Array<{ studentId: number; studentName: string; code: string }> = [];
      for (const student of students) {
        let { data: invite, error } = await adminDb.from('parent_invite_codes').select('code').eq('student_id', student.id).maybeSingle();
        if (error) throw error;
        if (!invite) {
          const code = randomBytes(10).toString('hex').toUpperCase();
          const inserted = await adminDb.from('parent_invite_codes').upsert({ student_id: student.id, code }, { onConflict: 'student_id', ignoreDuplicates: true }).select('code').maybeSingle();
          if (inserted.error) throw inserted.error;
          invite = inserted.data;
          if (!invite) {
            const again = await adminDb.from('parent_invite_codes').select('code').eq('student_id', student.id).single();
            if (again.error) throw again.error;
            invite = again.data;
          }
        }
        rows.push({ studentId: student.id, studentName: student.displayName, code: invite!.code.match(/.{1,4}/g)!.join('-') });
      }
      res.set('Cache-Control', 'no-store');
      res.json({ invites: rows.sort((a, b) => a.studentName.localeCompare(b.studentName)) });
    } catch (error: any) {
      console.error('[parent-invites] Print failed:', error?.message);
      res.status(503).json({ message: 'Unable to prepare parent codes. Check that the parent_invite_codes table exists.' });
    }
  });

  // Teacher parent hub: parent codes, signup links, and linked parent accounts for the teacher's roster.
  app.get('/api/teacher/parent-connections', authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      if (!req.user.isAdmin && req.user.accountApproved === false) return res.status(403).json({ message: 'Teacher account approval required.' });
      const roster = req.user.isAdmin
        ? (await storage.getAllUsers()).filter((u: any) => u.role === 'student' && !u.isAdmin)
        : await storage.getTeacherStudents(req.user.id);
      const links = await readParentStudentLinks();
      const allUsers = await storage.getAllUsers();
      const parentMap = new Map(allUsers.filter((u: any) => u.role === 'parent').map((u: any) => [u.id, u]));
      const forwardedProtocol = String(req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
      const origin = `${forwardedProtocol}://${req.get("host")}`;
      const students = [];
      for (const student of roster) {
        const invite = await getOrCreateParentInvite(student.id);
        const parentIds: number[] = [];
        for (const [parentId, linkedValue] of Object.entries(links)) {
          if (normalizeLinkedIds(linkedValue).includes(student.id)) {
            const parsed = Number(parentId);
            if (Number.isSafeInteger(parsed) && parsed > 0) parentIds.push(parsed);
          }
        }
        const parents = parentIds.map(id => parentMap.get(id)).filter(Boolean).map((parent: any) => ({
          id: parent.id,
          displayName: parent.displayName,
          username: parent.username,
          email: parent.email || null,
          accountApproved: parent.accountApproved !== false,
        }));
        students.push({
          id: student.id,
          displayName: student.displayName,
          username: student.username,
          code: invite.formattedCode,
          signupUrl: `${origin}/#/parent-signup?code=${encodeURIComponent(invite.formattedCode)}`,
          parents,
        });
      }
      students.sort((a: any, b: any) => a.displayName.localeCompare(b.displayName));
      res.set('Cache-Control', 'no-store');
      res.json({ students });
    } catch (error: any) {
      console.error('[teacher-parent-connections]', error?.message);
      res.status(500).json({ message: error?.message || 'Could not load parent connections.' });
    }
  });

  // Students can print their own parent invite letter from their profile.
  app.post('/api/parent-invites/me', authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== 'student' || req.user.isAdmin) return res.status(403).json({ message: 'Student account required.' });
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ message: 'Parent codes are not configured.' });
      const adminDb = getAdminSupabase();
      let { data: invite, error } = await adminDb.from('parent_invite_codes').select('code').eq('student_id', req.user.id).maybeSingle();
      if (error) throw error;
      if (!invite) {
        const code = randomBytes(10).toString('hex').toUpperCase();
        const inserted = await adminDb.from('parent_invite_codes').upsert({ student_id: req.user.id, code }, { onConflict: 'student_id', ignoreDuplicates: true }).select('code').maybeSingle();
        if (inserted.error) throw inserted.error;
        invite = inserted.data;
        if (!invite) {
          const again = await adminDb.from('parent_invite_codes').select('code').eq('student_id', req.user.id).single();
          if (again.error) throw again.error;
          invite = again.data;
        }
      }
      res.set('Cache-Control', 'no-store');
      res.json({ invite: { studentName: req.user.displayName, code: invite!.code.match(/.{1,4}/g)!.join('-') } });
    } catch (error: any) {
      console.error('[parent-invites] Student print failed:', error?.message);
      res.status(503).json({ message: 'Unable to prepare your parent code right now.' });
    }
  });

  // Student-facing parent connection status. The invite disappears once any approved parent is linked.
  app.get("/api/student/parent-connection", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== "student" || req.user.isAdmin) return res.status(403).json({ message: "Student account required." });
      if (isDemoStudent(req.user) || req.adminPreview) {
        return res.json({ linked: true, demo: true, parentCount: 1 });
      }
      const parentIds = await getStudentParentIds(req.user.id);
      const approvedParents = [];
      for (const parentId of parentIds) {
        const parent = await storage.getUser(parentId);
        if (parent?.role === "parent" && parent.accountApproved !== false) approvedParents.push(parent);
      }
      if (approvedParents.length) {
        res.set("Cache-Control", "no-store");
        return res.json({
          linked: true,
          parentCount: approvedParents.length,
          parents: approvedParents.map((parent: any) => ({ id: parent.id, displayName: parent.displayName })),
        });
      }

      const invite = await getOrCreateParentInvite(req.user.id);
      const forwardedProtocol = String(req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
      const origin = `${forwardedProtocol}://${req.get("host")}`;
      const signupUrl = `${origin}/#/parent-signup?code=${encodeURIComponent(invite.formattedCode)}`;
      res.set("Cache-Control", "no-store");
      res.json({
        linked: false,
        parentCount: 0,
        code: invite.formattedCode,
        signupUrl,
        message: "Connect a parent or guardian to unlock book quizzes and reading tests.",
      });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Could not check parent connection." });
    }
  });

  app.post("/api/student/parent-invite-email", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== "student" || req.user.isAdmin) return res.status(403).json({ message: "Student account required." });
      if (isDemoStudent(req.user) || req.adminPreview) return res.json({ success: true, demo: true });
      const email = String(req.body?.email || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Enter a valid parent or guardian email." });
      }
      // An invitation goes to whatever address the student types. A few a day is plenty for a family,
      // and it keeps the site from being used to fill strangers' inboxes (which gets all its mail marked as junk).
      const inviteKey = String(req.user.id);
      if (parentInviteSends.retryAfter(inviteKey) > 0) {
        return res.status(429).json({ message: `You have sent ${PARENT_INVITES_PER_DAY} invitations today. You can send more tomorrow, or show your parent the link code on this screen.` });
      }
      const invite = await getOrCreateParentInvite(req.user.id);
      const forwardedProtocol = String(req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
      const origin = `${forwardedProtocol}://${req.get("host")}`;
      const signupUrl = `${origin}/#/parent-signup?code=${encodeURIComponent(invite.formattedCode)}`;
      const safe = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const result = await sendEmail(
        email,
        `${req.user.displayName || "Your student"} invited you to A.R.I.S.E. Reader`,
        parentInviteEmail(safe(String(req.user.displayName || "your student")), safe(signupUrl), safe(String(invite.formattedCode))),
      );
      if (!result.sent) return res.status(503).json({ message: result.error || "Could not send the email right now." });
      parentInviteSends.fail(inviteKey);
      res.json({ success: true, message: "Parent invitation sent." });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Could not send the parent invitation." });
    }
  });

  // A linked parent gets one private proctor code that works for every linked child.
  app.get("/api/parent/proctor-password", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== "parent" || req.user.accountApproved === false) {
        return res.status(403).json({ message: "Approved parent account required." });
      }
      const linkedIds = await getParentStudentIds(req.user.id);
      if (!linkedIds.length) return res.status(404).json({ message: "Link a student before using a Parent Proctor Code." });
      const password = await getOrCreateParentProctorPassword(req.user.id);
      res.set("Cache-Control", "no-store");
      res.json({ password, linkedStudentCount: linkedIds.length });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Could not load your Parent Proctor Code." });
    }
  });

  // An existing parent account without a student may redeem a code after signing in.
  app.post('/api/parent/link-code', authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== 'parent' || req.user.accountApproved === false) return res.status(403).json({ message: 'Approved parent account required.' });
      // The sample parent is open to everyone, so it must never follow a real child.
      if (isDemoStudent(req.user)) return res.status(403).json({ message: 'The sample parent account can\'t link students. Create your own parent account.' });
      const code = typeof req.body?.parentCode === 'string' ? req.body.parentCode.replace(/[-\s]/g, '').toUpperCase() : '';
      if (!/^[A-F0-9]{20}$/.test(code)) return res.status(400).json({ message: 'Enter the parent code from your handout.' });
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ message: 'Parent codes are unavailable.' });
      const { data: invite, error } = await getAdminSupabase().from('parent_invite_codes').select('student_id').eq('code', code).maybeSingle();
      if (error) return res.status(503).json({ message: 'Parent codes are unavailable.' });
      if (!invite) return res.status(400).json({ message: 'That parent code was not found.' });
      const links = await readParentStudentLinks();
      const ids = normalizeLinkedIds(links[String(req.user.id)]);
      if (!ids.includes(Number(invite.student_id))) {
        // One parent profile follows up to five children on the Free plan.
        const room = await plans.parentLinkAllowed(ids, Number(invite.student_id));
        if (!room.ok) return res.status(409).json({ message: room.message });
        ids.push(Number(invite.student_id));
      }
      links[String(req.user.id)] = ids;
      await storage.upsertSetting('parent_student_links', JSON.stringify(links));
      res.json({ success: true, studentIds: ids });
    } catch { res.status(500).json({ message: 'Could not link this student right now.' }); }
  });

  // === Teacher Admin endpoints: limited admin access for ALL teachers ===
  // These mirror admin endpoints but are accessible to any approved teacher

  // GET all students across all teachers (with stats + teacher names)
  app.get("/api/teacher-admin/all-students", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const students = (await storage.getAllUsers()).filter((s: any) => s.role === 'student' || (!s.role && !s.isAdmin));
      const allUsers = await storage.getAllUsers();
      const teacherMap = new Map();
      for (const u of allUsers) {
        if (u.role === 'teacher') teacherMap.set(u.id, u.displayName);
      }
      // Fetch attempts for stats
      let allUsersWithAttempts: any[] = [];
      for (let retry = 0; retry < 5; retry++) {
        try {
          const { data, error } = await supabase.from("users").select("id, role, attempts:attempts!attempts_user_id_fkey(points_earned)").eq("is_admin", false);
          if (!error && data) { allUsersWithAttempts = data; break; }
        } catch (e) {}
        if (retry < 4) await new Promise(r => setTimeout(r, 1000));
      }
      const attemptsMap = new Map();
      for (const u of allUsersWithAttempts) {
        attemptsMap.set(u.id, u.attempts || []);
      }
      const result = students.map((s: any) => {
        const attempts = attemptsMap.get(s.id) || [];
        const totalPoints = attempts.reduce((sum: number, a: any) => sum + (a.points_earned || 0), 0);
        const quizzesMastered = attempts.filter((a: any) => (a.points_earned || 0) > 0).length;
        return {
          id: s.id,
          username: s.username,
          displayName: s.displayName,
          createdAt: s.createdAt,
          quizzesTaken: attempts.length,
          quizzesMastered,
          totalPoints,
          approvedByTeacher: s.approvedByTeacher,
          teacherId: s.teacherId,
          teacherName: s.teacherId ? (teacherMap.get(s.teacherId) || 'Teacher') : null,
          isEyeGazeUser: !!s.is_eye_gaze_user,
        };
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET all teachers (for reassignment dropdown)
  app.get("/api/teacher-admin/teachers", authMiddleware, teacherOrAdminMiddleware, async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const teachers = allUsers
        .filter((u: any) => u.role === 'teacher')
        .map((t: any) => ({ id: t.id, displayName: t.displayName, username: t.username }));
      res.json(teachers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET pending students across ALL teachers
  app.get("/api/teacher-admin/pending-students", authMiddleware, teacherOrAdminMiddleware, async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const pending = allUsers.filter((u: any) => !u.approvedByTeacher && (u.role === 'student' || (!u.role && !u.isAdmin)));
      const teacherMap = new Map();
      for (const u of allUsers) {
        if (u.role === 'teacher') teacherMap.set(u.id, u.displayName);
      }
      const result = pending.map((s: any) => ({
        id: s.id,
        username: s.username,
        displayName: s.displayName,
        teacherId: s.teacherId,
        teacherName: s.teacherId ? (teacherMap.get(s.teacherId) || 'Teacher') : null,
      }));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST approve any student (across all teachers)
  app.post("/api/teacher-admin/students/:id/approve", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const studentId = parseInt(req.params.id);
      const seat = await plans.seatCheck(req.user);
      if (!seat.ok) return res.status(409).json({ message: seat.message });
      await supabase.from("users").update({ approved_by_teacher: true }).eq("id", studentId);
      const student = await storage.getUser(studentId);
      const teacherName = student?.teacherId ? ((await storage.getUser(student.teacherId))?.displayName || "your teacher") : "your teacher";
      await storage.createMessage(studentId, "teacher", `Welcome! You've been approved and are now in ${teacherName}'s class.`);
      try { clearCache('allUsers'); } catch {}
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST reset any student's password
  app.post("/api/teacher-admin/students/:id/reset-password", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const studentId = parseInt(req.params.id);
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ message: "Password must be at least 4 characters" });
      }
      const hashed = bcrypt.hashSync(newPassword, 10);
      await storage.resetPassword(studentId, hashed);
      res.json({ success: true, message: "Password reset successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET rewards for any student
  app.get("/api/teacher-admin/students/:id/rewards", authMiddleware, teacherOrAdminMiddleware, async (req, res) => {
    try {
      const studentId = parseInt(req.params.id);
      const key = `student_rewards_${studentId}`;
      const raw = await storage.getSetting(key);
      let rewards: any[] = [];
      if (raw) { try { rewards = JSON.parse(raw); } catch {} }
      res.json({ rewards });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST add reward to any student
  app.post("/api/teacher-admin/students/:id/rewards", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
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
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // DELETE reward for any student
  app.delete("/api/teacher-admin/students/:id/rewards/:rewardId", authMiddleware, teacherOrAdminMiddleware, async (req, res) => {
    try {
      const studentId = parseInt(req.params.id);
      const rewardId = parseInt(req.params.rewardId);
      const key = `student_rewards_${studentId}`;
      const raw = await storage.getSetting(key);
      let rewards: any[] = [];
      if (raw) { try { rewards = JSON.parse(raw); } catch {} }
      rewards = rewards.filter(r => r.id !== rewardId);
      await storage.upsertSetting(key, JSON.stringify(rewards));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST reassign student to a different teacher
  app.post("/api/teacher-admin/students/:id/reassign", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const studentId = parseInt(req.params.id);
      const { newTeacherId } = req.body;
      if (!newTeacherId) {
        return res.status(400).json({ message: "newTeacherId is required" });
      }
      // Moving a student onto a paid plan uses one of its seats.
      const seat = await plans.seatCheckFor(newTeacherId);
      if (!seat.ok) return res.status(409).json({ message: seat.message });
      // Update the student's teacher_id in users table
      const { error } = await supabase.from("users").update({ teacher_id: newTeacherId }).eq("id", studentId);
      if (error) throw new Error(error.message);
      // Also update teacher_students setting
      const rawLinks = await storage.getSetting('teacher_students');
      let teacherStudents: Record<string, number[]> = {};
      if (rawLinks) { try { teacherStudents = JSON.parse(rawLinks); } catch {} }
      // Remove student from all teachers
      for (const [tid, sids] of Object.entries(teacherStudents)) {
        teacherStudents[tid] = (sids as number[]).filter((sid: number) => sid !== studentId);
      }
      // Add to new teacher
      if (!teacherStudents[String(newTeacherId)]) teacherStudents[String(newTeacherId)] = [];
      teacherStudents[String(newTeacherId)].push(studentId);
      await storage.upsertSetting('teacher_students', JSON.stringify(teacherStudents));
      try { clearCache('allUsers'); } catch {}
      const newTeacher = await storage.getUser(newTeacherId);
      const teacherName = newTeacher?.displayName || "your new teacher";
      await storage.createMessage(studentId, "teacher", `You have been moved to ${teacherName}'s class.`);
      res.json({ success: true, message: `Student reassigned to ${teacherName}` });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET pending AI quizzes (already accessible to teachers via /api/admin/pending-quizzes, but adding a teacher-admin alias)
  app.get("/api/teacher-admin/pending-quizzes", authMiddleware, teacherOrAdminMiddleware, async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from('pending_ai_quizzes')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      const studentIds = [...new Set((data || []).map((r: any) => r.student_id))];
      let studentMap: Record<number, string> = {};
      if (studentIds.length > 0) {
        const { data: students } = await supabase.from('users').select('id, display_name').in('id', studentIds);
        (students || []).forEach((s: any) => { studentMap[s.id] = s.display_name; });
      }
      const pending = (data || []).map((row: any) => ({ ...row, student_name: studentMap[row.student_id] || 'Unknown' }));
      res.json({ pending });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST approve pending AI quiz (teacher-admin version)
  app.post("/api/teacher-admin/pending-quizzes/:id/approve", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
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
        const quiz = await storage.createCustomEyeGazeQuiz(
          pending.student_id, pending.book_title.slice(0, 60),
          `AI-generated eye gaze quiz about ${pending.author}`,
          pending.age_group || "Custom", questions, "global", null, "eye_gaze"
        );
        await supabase.from('notifications').insert({
          user_id: pending.student_id, type: 'success',
          title: 'Quiz Approved!',
          message: `Your eye gaze quiz "${pending.book_title}" has been approved and is ready to take!`
        });
      } else {
        const book = await storage.createBookWithQuestions({
          title: pending.book_title, author: pending.author,
          ageGroup: pending.age_group, coverUrl: pending.cover_url,
          description: `Quiz for "${pending.book_title}" by ${pending.author}`,
          pointsValue: pending.quiz_type === 'iarise' ? 2 : 0,
          skipAR: pending.quiz_type === 'iarise', readUrl: null,
        }, questions);
        try {
          const rawBands = await storage.getSetting('book_grade_bands');
          let bookBands: Record<string, string> = {};
          if (rawBands) { try { bookBands = JSON.parse(rawBands); } catch {} }
          bookBands[String(book.id)] = pending.age_group;
          await storage.upsertSetting('book_grade_bands', JSON.stringify(bookBands));
        } catch {}
        await supabase.from('notifications').insert({
          user_id: pending.student_id, type: 'success',
          title: 'Quiz Approved!',
          message: `Your quiz "${pending.book_title}" has been approved and is ready to take!`
        });
      }
      await supabase.from('pending_ai_quizzes').update({ status: 'approved', reviewed_by: req.user.id, reviewed_at: new Date().toISOString() }).eq('id', req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST reject pending AI quiz (teacher-admin version)
  app.post("/api/teacher-admin/pending-quizzes/:id/reject", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const { reason } = req.body;
      await supabase.from('pending_ai_quizzes').update({
        status: 'rejected', reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(), rejection_reason: reason || null
      }).eq('id', req.params.id);
      const { data: pendingRows } = await supabase.from('pending_ai_quizzes').select('student_id, book_title').eq('id', req.params.id);
      if (pendingRows && pendingRows[0]) {
        await supabase.from('notifications').insert({
          user_id: pendingRows[0].student_id, type: 'info',
          title: 'Quiz Update',
          message: `Your quiz "${pendingRows[0].book_title}" was not approved. ${reason || ''}`
        });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/teacher-admin/book-requests - Get book requests for teacher (from notifications table)
  app.get("/api/teacher-admin/book-requests", authMiddleware, teacherOrAdminMiddleware, async (req: any, res) => {
    try {
      const teacherId = req.user.id;
      const { data: bookRequestNotifs } = await supabase
        .from('notifications')
        .select('id, message, created_at, read')
        .eq('user_id', teacherId)
        .eq('title', 'Student book request')
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(50);

      const requests = (bookRequestNotifs || []).map((n: any) => ({
        id: n.id,
        bookTitle: n.message.match(/read "(.+?)"/)?.[1] || n.message.match(/requested "(.+?)"/)?.[1] || 'Unknown book',
        studentName: n.message.match(/^(.+?) would like/)?.[1] || n.message.match(/^(.+?) requested/)?.[1] || 'Student',
        message: n.message,
        createdAt: n.created_at,
      }));

      res.json({ requests });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

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
        // A paid plan covers a set number of students.
        const seat = await plans.seatCheck(req.user);
        if (!seat.ok) return res.status(409).json({ message: seat.message });
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
      // This is a read-only educator profile. Approved teachers can open any student
      // shown in the All Students directory; editing and messaging stay roster-restricted.
      const student = await storage.getUser(studentId);
      if (!student || student.isAdmin || student.role !== 'student') return res.status(404).json({ message: "Student not found" });
      if (!req.user.isAdmin && req.user.accountApproved === false) return res.status(403).json({ message: "Teacher account approval required" });
      const attempts = await storage.getUserAttempts(studentId);
      const books = await storage.getAllBooks();
      const bookMap = new Map(books.map(b => [b.id, b]));
      const quizResults = attempts.map(a => {
        const book = bookMap.get(a.bookId);
        const passingScore = arPassingScore(a.totalQuestions || 10);
        const passed = a.score >= passingScore;
        return {
          bookId: a.bookId,
          title: book?.title || "Unknown",
          author: book?.author || "",
          coverUrl: book?.coverUrl,
          readUrl: book?.readUrl,
          pointsValue: Number(book?.pointsValue ?? 0),
          score: a.score,
          total: a.totalQuestions,
          pointsEarned: a.pointsEarned ?? 0,
          passed,
          passingScore,
          completedAt: a.completedAt,
          proctorType: a.proctorType || null,
          proctorUserId: a.proctorUserId ?? null,
          proctorName: a.proctorName || null,
        };
      });
      const readingAssessments = await storage.getAssessmentHistory(studentId);
      const totalPoints = Math.max(student.totalPoints || 0, attempts.reduce((sum, a) => sum + (a.pointsEarned || 0), 0));
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
        readingAssessments,
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
          const passingScore = arPassingScore(a.totalQuestions || 10);
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
        .is("archived_at", null)
        .order("created_at", { ascending: false });

      const parentLinks = await readParentStudentLinks();
      const parentsWithStudents = await Promise.all((parents || []).map(async (p: any) => {
        const studentIds = normalizeLinkedIds(parentLinks[String(p.id)]);
        const students = studentIds.length
          ? (await supabase.from("users").select("id, display_name, username, is_eye_gaze_user").in("id", studentIds)).data || []
          : [];
        const studentNames = students.map((student: any) => student.display_name || student.username);
        return { ...p, studentName: studentNames.join(", ") || "Unknown", studentNames, studentCount: students.length };
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
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);

      const parentLinks = await readParentStudentLinks();
      const parentsWithStudents = await Promise.all((parents || []).map(async (p: any) => {
        const studentIds = normalizeLinkedIds(parentLinks[String(p.id)]);
        const students = studentIds.length
          ? (await supabase.from("users").select("id, display_name, username, is_eye_gaze_user").in("id", studentIds)).data || []
          : [];
        const studentNames = students.map((student: any) => student.display_name || student.username);
        return {
          ...p,
          accountApproved: p.account_approved,
          displayName: p.display_name,
          schoolId: p.school_id,
          studentName: studentNames.join(", ") || "Unknown",
          studentNames,
          studentCount: students.length,
        };
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

  app.get("/api/parent/students", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== 'parent') return res.status(403).json({ message: "Only parents can access this endpoint" });
      const ids = await getParentStudentIds(req.user.id);
      const students = (await Promise.all(ids.map(id => storage.getUser(id))))
        .filter((student: any) => student?.role === 'student' && !student.archivedAt)
        .map((student: any) => ({
          id: student.id,
          displayName: student.displayName,
          username: student.username,
          isEyeGazeUser: !!student.is_eye_gaze_user,
          teacherId: student.teacherId || null,
        }));
      res.set("Cache-Control", "no-store");
      res.json({ students });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to load linked students" });
    }
  });

  // Parent: get one linked student's profile. If no studentId is supplied, use the first linked child.
  app.get("/api/parent/student-profile", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== 'parent') {
        return res.status(403).json({ message: "Only parents can access this endpoint" });
      }
      const linkedIds = await getParentStudentIds(req.user.id);
      if (!linkedIds.length) return res.status(404).json({ message: "No student linked to your account" });
      const requestedId = requestedParentStudentId(req);
      const studentId = requestedId || linkedIds[0];
      if (!linkedIds.includes(studentId)) return res.status(403).json({ message: "That student is not linked to your account" });
      const student = await storage.getUser(studentId);
      if (!student) return res.status(404).json({ message: "Student not found" });
      const attempts = await storage.getUserAttempts(studentId);
      const books = await storage.getAllBooks();
      const bookMap = new Map(books.map(b => [b.id, b]));
      const quizResults = attempts.map(a => {
        const book = bookMap.get(a.bookId);
        const passingScore = arPassingScore(a.totalQuestions || 10);
        const passed = a.score >= passingScore;
        return {
          bookId: a.bookId,
          title: book?.title || "Unknown",
          author: book?.author || "",
          coverUrl: book?.coverUrl,
          readUrl: book?.readUrl,
          pointsValue: Number(book?.pointsValue ?? 0),
          score: a.score,
          total: a.totalQuestions,
          pointsEarned: a.pointsEarned ?? 0,
          passed,
          passingScore,
          completedAt: a.completedAt,
          proctorType: a.proctorType || null,
          proctorUserId: a.proctorUserId ?? null,
          proctorName: a.proctorName || null,
        };
      });
      const totalPoints = Math.max(student.totalPoints || 0, attempts.reduce((sum, a) => sum + (a.pointsEarned || 0), 0));
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

  // Parent controls for a regular (non-Eye-Gazer) student.
  // These mirror the teacher Club A.R.I.S.E. controls, but are scoped strictly
  // to children linked to the signed-in parent.
  app.get("/api/parent/student-controls/:studentId", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") return res.status(403).json({ message: "Parent account required." });
      const studentId = Number(req.params.studentId);
      if (!Number.isSafeInteger(studentId) || studentId <= 0 || !(await parentHasStudent(req.user.id, studentId))) {
        return res.status(403).json({ message: "That student is not linked to your account." });
      }
      const student = await storage.getUser(studentId);
      if (!student || student.role !== "student") return res.status(404).json({ message: "Student not found." });
      if (student.is_eye_gaze_user) {
        return res.json({
          student: { id: student.id, displayName: student.displayName, isEyeGazeUser: true },
          mode: "eye-gaze",
        });
      }
      const { data: control, error } = await getAdminSupabase()
        .from("club_arise_controls")
        .select("*")
        .eq("student_id", studentId)
        .maybeSingle();
      if (error) throw error;
      res.set("Cache-Control", "no-store");
      res.json({
        student: { id: student.id, displayName: student.displayName, isEyeGazeUser: false },
        mode: "regular",
        control: control || {
          student_id: studentId,
          locked: false,
          daily_game_limit: null,
          games_per_passed_quiz: 0,
          weekly_unlimited_on_pass: true,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Could not load parent controls." });
    }
  });

  app.post("/api/parent/student-controls/:studentId", authMiddleware, async (req: any, res) => {
    try {
      if (req.user.role !== "parent") return res.status(403).json({ message: "Parent account required." });
      const studentId = Number(req.params.studentId);
      if (!Number.isSafeInteger(studentId) || studentId <= 0 || !(await parentHasStudent(req.user.id, studentId))) {
        return res.status(403).json({ message: "That student is not linked to your account." });
      }
      const student = await storage.getUser(studentId);
      if (!student || student.role !== "student" || student.is_eye_gaze_user) {
        return res.status(400).json({ message: "Use Eye Gazer family controls for this student." });
      }
      const locked = !!req.body?.locked;
      const rawLimit = req.body?.dailyGameLimit;
      const dailyGameLimit = rawLimit === null || rawLimit === "" || rawLimit === undefined
        ? null
        : Math.max(0, Math.min(180, Math.floor(Number(rawLimit) || 0)));
      const gamesPerPassedQuiz = Math.max(0, Math.min(20, Math.floor(Number(req.body?.gamesPerPassedQuiz) || 0)));
      const weeklyUnlimitedOnPass = req.body?.weeklyUnlimitedOnPass !== false;
      const row = {
        student_id: studentId,
        teacher_id: student.teacherId || null,
        locked,
        daily_game_limit: dailyGameLimit,
        games_per_passed_quiz: gamesPerPassedQuiz,
        weekly_unlimited_on_pass: weeklyUnlimitedOnPass,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await getAdminSupabase()
        .from("club_arise_controls")
        .upsert(row, { onConflict: "student_id" })
        .select("*")
        .single();
      if (error) throw error;
      res.set("Cache-Control", "no-store");
      res.json({ success: true, control: data });
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Could not save parent controls." });
    }
  });

  // Reading Club sign-up — students and parents can sign up
  app.post("/api/club/signup", authMiddleware, async (req: any, res) => {
    try {
      const { studentName, grade, parentName, parentContact, parentEmail, notes } = req.body;
      if (!studentName) return res.status(400).json({ message: "Student name is required" });

      // Determine student_id: selected linked child for parents, or the logged-in student.
      let studentId = req.user.id;
      if (req.user.role === 'parent') {
        const linkedIds = await getParentStudentIds(req.user.id);
        const requestedId = requestedParentStudentId(req);
        studentId = requestedId && linkedIds.includes(requestedId) ? requestedId : (linkedIds[0] || req.user.id);
      }

      // Check if already signed up
      const { data: existing } = await supabase
        .from('club_signups')
        .select('id, status')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existing && existing.length > 0 && existing[0].status === 'pending') {
        return res.status(409).json({ message: "You're already signed up for the Reading Club!" });
      }

      const { data, error } = await supabase
        .from('club_signups')
        .insert({
          student_id: studentId,
          student_name: studentName,
          grade: grade || null,
          parent_name: parentName || null,
          parent_contact: parentContact || null,
          parent_email: parentEmail || null,
          notes: notes || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      // Tell the teachers in their bell. The admin's bell lists pending sign-ups by itself.
      try {
        const { data: teachers } = await supabase.from('users').select('id').eq('role', 'teacher');
        const notifyIds = (teachers || []).map((t: any) => t.id);
        for (const uid of notifyIds) {
          await supabase.from('notifications').insert({
            user_id: uid,
            type: 'info',
            title: 'Reading Club Sign-Up',
            message: `${studentName} has signed up for the Reading Club (Thursdays after school).`
          });
        }
      } catch {}

      alertAdmin("club_signup", {
        title: `Reading Club sign-up: ${studentName}`,
        summary: [grade && `Grade ${grade}`, parentName && `Parent: ${parentName}`].filter(Boolean).join(" · ") || "Waiting for you to confirm",
        lines: [["Student", studentName], ["Grade", grade || ""], ["Parent / guardian", parentName || ""], ["Parent phone", parentContact || ""], ["Parent email", parentEmail || ""], ["Notes", notes || ""], ["Signed up by", `${personName(req.user)} (@${req.user.username})`]],
        note: "Confirm or deny it under Admin → To-do → Reading Club.",
        ref: `u${studentId}`,
        row: false,
      });

      res.status(201).json({ success: true, message: "You're signed up for the Reading Club!", signup: data });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to sign up" });
    }
  });

  // Check club sign-up status for current user
  app.get("/api/club/signup-status", authMiddleware, async (req: any, res) => {
    try {
      let studentId = req.user.id;
      if (req.user.role === 'parent') {
        const linkedIds = await getParentStudentIds(req.user.id);
        const requestedId = requestedParentStudentId(req);
        studentId = requestedId && linkedIds.includes(requestedId) ? requestedId : (linkedIds[0] || req.user.id);
      }

      const { data, error } = await supabase
        .from('club_signups')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw new Error(error.message);
      res.json({ signup: data && data.length > 0 ? data[0] : null });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to check sign-up status" });
    }
  });

  // Admin: list all club sign-ups
  app.get("/api/admin/club-signups", authMiddleware, async (req: any, res) => {
    try {
      if (!req.user.isAdmin && req.user.role !== 'teacher') return res.status(403).json({ message: "Admin or teacher only" });
      const { data, error } = await supabase
        .from('club_signups')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      res.json({ signups: data || [] });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch sign-ups" });
    }
  });

  // Admin: update club sign-up status
  app.post("/api/admin/club-signups/:id/status", authMiddleware, async (req: any, res) => {
    try {
      if (!req.user.isAdmin && req.user.role !== 'teacher') return res.status(403).json({ message: "Admin or teacher only" });
      const { status } = req.body;
      if (!['pending', 'confirmed', 'denied'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const { data, error } = await supabase
        .from('club_signups')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', parseInt(req.params.id))
        .select()
        .single();
      if (error) throw new Error(error.message);

      // Email the student/parent about approval or denial
      if (status === 'confirmed' || status === 'denied') {
        const studentName = data.student_name || 'Student';
        const parentEmail = data.parent_email;
        const studentEmail = data.student_id ? (
          await supabase.from('users').select('email').eq('id', data.student_id).maybeSingle()
        ).data?.email : null;
        const emailRecipients = [parentEmail, studentEmail].filter(Boolean) as string[];
        for (const emailAddr of emailRecipients) {
          if (status === 'confirmed') {
            sendEmail(
              emailAddr,
              "You're approved for Reading Club - A.R.I.S.E Reader",
              clubApprovedEmail(studentName)
            ).catch(() => {});
          } else {
            sendEmail(
              emailAddr,
              "Reading Club sign-up update - A.R.I.S.E Reader",
              clubDeniedEmail(studentName)
            ).catch(() => {});
          }
        }
      }

      res.json({ success: true, signup: data });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update status" });
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
        .is("archived_at", null)
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
      if (!Number.isSafeInteger(userId) || userId < 1) return res.status(400).json({ message: "Invalid user." });
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ message: "Admin deletion is not configured on the server." });

      const adminDb = getAdminSupabase();
      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: "User not found." });

      // Most rows that belong to the person are removed by the database when the user is
      // deleted (on delete cascade). These are cleared first anyway, in an order that
      // keeps one row from blocking another (review requests point at attempts).
      const tables = [
        { table: "quiz_review_requests", column: "user_id" },
        { table: "manual_point_awards", column: "student_id" },
        { table: "attempts", column: "user_id" },
        { table: "live_players", column: "user_id" },
        { table: "reading_retake_requests", column: "user_id" },
        { table: "notifications", column: "user_id" },
        { table: "quiz_requests", column: "user_id" },
        { table: "easter_egg_claims", column: "user_id" },
        { table: "custom_quizzes", column: "creator_id" },
        { table: "eye_gaze_quizzes", column: "creator_id" },
      ];

      for (const { table, column } of tables) {
        const { error } = await adminDb.from(table).delete().eq(column, userId);
        // Ignore missing optional tables/columns, but surface real FK/permission failures later via the user delete.
        if (error && !/does not exist|column .* does not exist/i.test(error.message || "")) {
          console.warn(`[admin-delete] Cleanup ${table}.${column}:`, error.message);
        }
      }
      // Points a teacher gave their students stay with the students.
      {
        const { error } = await adminDb.from("manual_point_awards").update({ awarded_by: null }).eq("awarded_by", userId);
        if (error && !/does not exist/i.test(error.message || "")) console.warn("[admin-delete] Keep awarded points:", error.message);
      }
      // A teacher's live quiz rooms go with them (players' rows go with each room),
      // and growth checks they assigned stay with the students.
      for (const table of ["live_sessions", "live_quizzes"]) {
        const { error } = await adminDb.from(table).delete().eq("teacher_id", userId);
        if (error && !/does not exist/i.test(error.message || "")) console.warn(`[admin-delete] Cleanup ${table}.teacher_id:`, error.message);
      }
      {
        const { error } = await adminDb.from("growth_check_assignments").update({ teacher_id: null }).eq("teacher_id", userId);
        if (error && !/does not exist/i.test(error.message || "")) console.warn("[admin-delete] Keep growth checks:", error.message);
      }

      // Parent invite rows cascade from users, but deleting explicitly is harmless and keeps cleanup obvious.
      try { await adminDb.from("parent_invite_codes").delete().eq("student_id", userId); } catch {}

      // Clean settings-backed relationships that reference users.
      for (const key of ["user_grades", "parent_student_links", "teacher_students"]) {
        try {
          const raw = await storage.getSetting(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          let changed = false;
          if (key === "user_grades" || key === "parent_student_links") {
            if (Object.prototype.hasOwnProperty.call(parsed, String(userId))) {
              delete parsed[String(userId)];
              changed = true;
            }
            if (key === "parent_student_links") {
              for (const [parentId, studentValue] of Object.entries(parsed)) {
                const ids = normalizeLinkedIds(studentValue);
                const next = ids.filter(id => id !== userId);
                if (next.length !== ids.length) {
                  if (next.length) parsed[parentId] = next;
                  else delete parsed[parentId];
                  changed = true;
                }
              }
            }
          } else if (key === "teacher_students") {
            if (Object.prototype.hasOwnProperty.call(parsed, String(userId))) {
              delete parsed[String(userId)];
              changed = true;
            }
            for (const [teacherId, studentIds] of Object.entries(parsed)) {
              if (Array.isArray(studentIds)) {
                const next = studentIds.filter((id: any) => Number(id) !== userId);
                if (next.length !== studentIds.length) {
                  parsed[teacherId] = next;
                  changed = true;
                }
              }
            }
          }
          if (changed) await storage.upsertSetting(key, JSON.stringify(parsed));
        } catch {}
      }

      const { error } = await adminDb.from("users").delete().eq("id", userId);
      if (error) {
        const blocked = /foreign key constraint .*on table "([^"]+)"/i.exec(error.message || "");
        if (blocked) {
          console.error("[admin-delete] Blocked by", blocked[1]);
          return res.status(409).json({ message: `This profile still has ${blocked[1].replace(/_/g, " ")} linked to it, so it can't be deleted yet. Archive it instead to hide it right away.` });
        }
        throw new Error(error.message);
      }

      // Invalidate all user/ranking caches immediately so deleted accounts disappear at once.
      clearCache('allUsers');
      clearCache('teachers');
      clearCache('leaderboard');
      clearCache('monthlyLeaderboard_');
      clearCache('eye_gaze_leaderboard');
      clearCache('advisoryLeaderboard');

      res.json({ success: true, deletedRole: target.role || (target.isAdmin ? "admin" : "student") });
    } catch (error: any) {
      console.error("[admin-delete] Failed:", error?.message);
      res.status(500).json({ message: error?.message || "Failed to delete user." });
    }
  });

  // Admin: archive a profile (signed out and hidden from lists, rosters and
  // leaderboards, nothing deleted) or restore it.
  const setArchived = (archive: boolean) => async (req: any, res: any) => {
    try {
      const userId = parseInt(req.params.userId);
      if (!Number.isSafeInteger(userId) || userId < 1) return res.status(400).json({ message: "Invalid user." });
      if (userId === req.user.id) return res.status(400).json({ message: "You can't archive your own account." });
      const adminDb = getAdminSupabase();
      const { data: target, error: findError } = await adminDb.from("users").select("id, role, is_admin, archived_at").eq("id", userId).maybeSingle();
      if (findError) throw new Error(findError.message);
      if (!target) return res.status(404).json({ message: "User not found." });
      if (target.is_admin) return res.status(400).json({ message: "Admin accounts can't be archived." });
      const patch = archive ? { archived_at: new Date().toISOString(), archived_by: req.user.id } : { archived_at: null, archived_by: null };
      const { error } = await adminDb.from("users").update(patch).eq("id", userId);
      if (error) throw new Error(error.message);
      // Sign the person out everywhere.
      if (archive) await adminDb.from("sessions").delete().eq("user_id", userId);
      clearCache('session_');
      clearCache('allUsers');
      clearCache('teachers');
      clearCache('leaderboard');
      clearCache('monthlyLeaderboard_');
      clearCache('eye_gaze_leaderboard');
      clearCache('advisoryLeaderboard');
      res.json({ success: true, archived: archive });
    } catch (error: any) {
      console.error("[admin-archive] Failed:", error?.message);
      res.status(500).json({ message: error?.message || "Could not change the profile." });
    }
  };
  app.post("/api/admin/users/:userId/archive", authMiddleware, adminMiddleware, setArchived(true));
  app.post("/api/admin/users/:userId/restore", authMiddleware, adminMiddleware, setArchived(false));

  app.get("/api/admin/archived-users", authMiddleware, adminMiddleware, async (_req, res) => {
    try {
      const adminDb = getAdminSupabase();
      const { data, error } = await adminDb.from("users")
        .select("id, username, display_name, role, email, total_points, teacher_id, is_eye_gaze_user, created_at, archived_at, archived_by")
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false });
      if (error) throw new Error(error.message);
      const rows = data || [];
      const peopleIds = [...new Set<number>(rows.flatMap((r: any) => [r.teacher_id, r.archived_by]).filter((v: any) => Number.isSafeInteger(v)))];
      const { data: people } = peopleIds.length
        ? await adminDb.from("users").select("id, display_name, username").in("id", peopleIds)
        : { data: [] as any[] };
      const nameOf = new Map<number, string>((people || []).map((p: any) => [Number(p.id), String(p.display_name || p.username)]));
      res.set("Cache-Control", "no-store");
      res.json(rows.map((r: any) => ({
        id: r.id,
        username: r.username,
        displayName: r.display_name || r.username,
        role: r.is_eye_gaze_user && (!r.role || r.role === "student") ? "eye-gaze student" : (r.role || "student"),
        email: r.email || null,
        totalPoints: Number(r.total_points || 0),
        teacherName: r.teacher_id ? nameOf.get(Number(r.teacher_id)) || null : null,
        createdAt: r.created_at,
        archivedAt: r.archived_at,
        archivedBy: r.archived_by ? nameOf.get(Number(r.archived_by)) || null : null,
      })));
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Could not load archived profiles." });
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

  app.get("/api/custom-quizzes/:id", authMiddleware, async (req: any, res) => {
    try {
      const quizId = parseInt(req.params.id);
      const quiz = await storage.getCustomEyeGazeQuiz(quizId);
      if (!quiz) return res.status(404).json({ message: "Quiz not found" });
      const staff = isStaffViewer(req) || Number(quiz.creator_user_id) === Number(req.user.id);
      if (!staff && !(await customQuizVisibleTo(req.user, quiz))) return res.status(404).json({ message: "Quiz not found" });
      const questions = await storage.getCustomEyeGazeQuizQuestions(quizId);
      const completed = await storage.hasUserCompletedCustomQuiz(req.user.id, quizId);
      res.set("Cache-Control", "no-store");
      res.json({ ...quiz, questions: staff ? questions : withoutAnswers(questions), hasCompleted: completed });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/custom-quizzes", authMiddleware, async (req: any, res) => {
    try {
      if (!isStaffViewer(req)) return res.status(403).json({ message: "Only teachers can make quizzes." });
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
      if (!isStaffViewer(req)) return res.status(403).json({ message: "Only teachers can edit quizzes." });
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

  // Regenerate an eye gaze quiz with new AI questions (keeps same quiz ID)
  app.post("/api/custom-quizzes/:id/regenerate", authMiddleware, async (req: any, res) => {
    try {
      if (!isStaffViewer(req)) return res.status(403).json({ message: "Only teachers can change quizzes." });
      const quizId = parseInt(req.params.id);
      const isAdmin = req.user.isAdmin || req.user.role === 'admin';
      // Get the existing quiz
      const quiz = await storage.getCustomEyeGazeQuiz(quizId);
      if (!quiz) return res.status(404).json({ message: "Quiz not found" });
      if (!isAdmin && quiz.creator_user_id !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to regenerate this quiz" });
      }
      // Parse the level number from "Level X"
      const levelNum = parseInt((quiz.level || "Level 1").replace(/[^0-9]/g, "")) || 1;
      const questionCount = quiz.questions?.length || 5;
      // Extract topic from title (strip "AI-generated eye gaze quiz about " prefix)
      const topic = quiz.title.replace(/^AI-generated eye gaze quiz about\s+/i, "").trim() || quiz.title;

      // Generate new questions
      const result = await generateEyeGazeQuizWithAI(topic, quiz.description, undefined, levelNum, questionCount);
      if ("error" in result) {
        return res.status(500).json({ message: result.error });
      }

      // Update the quiz with new questions
      await storage.updateCustomEyeGazeQuiz(quizId, quiz.creator_user_id, quiz.title, quiz.description, quiz.level || `Level ${levelNum}`, result.questions);
      res.json({ success: true, quizId, message: "Quiz regenerated with new questions!" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/custom-quizzes/:id/start", authMiddleware, async (req: any, res) => {
    try {
      const quizId = parseInt(req.params.id);
      const quiz = await storage.getCustomEyeGazeQuiz(quizId);
      if (!quiz) return res.status(404).json({ message: "Quiz not found" });

      const sampleAccount = isDemoStudent(req.user);
      const staffPreview = req.user?.isAdmin || req.user?.role === "teacher";
      res.set("Cache-Control", "no-store");
      if (req.adminPreview || sampleAccount || staffPreview) {
        const questions = await storage.getCustomEyeGazeQuizQuestions(quizId);
        return res.json({ ...quiz, questions: isStaffViewer(req) ? questions : withoutAnswers(questions), attemptId: -quizId, preview: true });
      }
      if (!(await customQuizVisibleTo(req.user, quiz))) return res.status(404).json({ message: "Quiz not found" });

      const proctor = await validateProctorSession(
        String(req.body?.proctorSessionToken || ""),
        req.user.id,
        "custom_eye_gaze",
        quizId,
        true
      );
      if (!proctor) {
        return res.status(403).json({ message: "Your proctor session expired or is not valid. Ask your parent/guardian or teacher to enter the proctor code again." });
      }

      const completed = await storage.hasUserCompletedCustomQuiz(req.user.id, quizId);
      if (completed) return res.status(400).json({ message: "You have already taken this quiz." });
      const attempt = await storage.startCustomEyeGazeAttempt(req.user.id, quizId, proctor);
      res.json({ ...quiz, questions: withoutAnswers(quiz.questions), attemptId: attempt.id, proctorType: proctor.type, proctorName: proctor.name });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/custom-quizzes/:attemptId/submit", authMiddleware, async (req: any, res) => {
    try {
      const attemptId = parseInt(req.params.attemptId);
      const { answers } = req.body;

      if ((req.adminPreview || isDemoStudent(req.user) || req.user?.isAdmin || req.user?.role === "teacher") && attemptId < 0) {
        const quizId = Math.abs(attemptId);
        const questions = await storage.getCustomEyeGazeQuizQuestions(quizId);
        let score = 0;
        for (const q of questions) {
          if (String(answers?.[q.id] || "") === String(q.correct_answer || "")) score++;
        }
        const total = questions.length;
        const passingScore = Math.ceil(total * 0.7);
        return res.json({ score, total, pct: total > 0 ? Math.round((score / total) * 100) : 0, passed: score >= passingScore, passingScore, pointsEarned: 0, preview: true });
      }

      const { data: ownedAttempt } = await getAdminSupabase().from("custom_eye_gaze_attempts")
        .select("user_id").eq("id", attemptId).maybeSingle();
      if (!ownedAttempt || Number(ownedAttempt.user_id) !== Number(req.user.id)) {
        return res.status(403).json({ message: "That quiz attempt does not belong to this student." });
      }

      let result: any;
      try {
        result = await storage.submitCustomEyeGazeAttempt(attemptId, answers);
      } catch (error) {
        if (error instanceof AlreadySubmittedError) return res.status(409).json({ message: error.message });
        throw error;
      }
      res.json(result);
      void (async () => {
        const { data: quiz } = await supabase.from("custom_eye_gaze_quizzes").select("title").eq("id", Number(result.quiz_id)).maybeSingle();
        await alertQuizTaken("eye_gaze_quiz_completed", req.user, {
          title: quiz?.title || "a custom Eye Gazer quiz",
          score: Number(result.score || 0),
          total: Number(result.total || 0),
          passed: !!result.passed,
          points: Number(result.pointsEarned || 0),
          proctor: proctorLabel(result.proctor_type, result.proctor_name),
        });
      })();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/custom-quizzes/:attemptId/check", authMiddleware, (req: any, res) =>
    checkOneAnswer(req, res, "custom_eye_gaze_attempts", (quizId) => storage.getCustomEyeGazeQuizQuestions(quizId)));

  /** A student sees published quizzes for everyone, and their own teacher's quizzes. */
  async function customQuizVisibleTo(user: any, quiz: any) {
    if (!quiz || quiz.is_published === false) return false;
    if (quiz.visibility === "global") return true;
    const teacherId = Number(user?.teacherId ?? user?.teacher_id ?? 0);
    return quiz.visibility === "teacher_students" && teacherId > 0 && Number(quiz.target_teacher_id) === teacherId;
  }

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
      const shareUrl = `${APP_URL}/fyp/share/${token}`;
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

  // POST /api/fyp/request-book - Student requests a book from their teacher
  app.post("/api/fyp/request-book", authMiddleware, async (req: any, res) => {
    try {
      const { bookId, title, author } = req.body;
      if (!bookId && !title) return res.status(400).json({ message: 'bookId or title is required' });
      const user = req.user;

      // Find the student's teacher
      let teacherId: number | null = null;
      const linksRaw = await storage.getSetting('teacher_students');
      if (linksRaw) {
        try {
          const links = JSON.parse(linksRaw);
          // teacher_students is a map of teacher_id -> [student_ids]
          for (const [tid, sids] of Object.entries(links)) {
            if (Array.isArray(sids) && sids.includes(user.id)) {
              teacherId = parseInt(tid);
              break;
            }
          }
        } catch {}
      }

      // Fallback: check student_links setting
      if (!teacherId) {
        const studentLinksRaw = await storage.getSetting('student_links');
        if (studentLinksRaw) {
          try {
            const studentLinks = JSON.parse(studentLinksRaw);
            const tid = studentLinks[String(user.id)];
            if (tid) teacherId = parseInt(tid);
          } catch {}
        }
      }

      if (!teacherId) {
        return res.status(200).json({
          success: false,
          message: `No teacher is linked to your account yet. Ask your teacher to add you so they can help find "${title || 'this book'}"!`
        });
      }

      // Fetch teacher info
      const { data: teacher } = await supabase
        .from('users')
        .select('id, display_name, username, email')
        .eq('id', teacherId)
        .single();

      if (!teacher) {
        return res.status(200).json({
          success: false,
          message: `Your teacher's account could not be found. Please ask them for help finding "${title || 'this book'}".`
        });
      }

      const bookTitle = title || 'a book';
      const bookAuthor = author || 'unknown author';
      const studentName = user.display_name || user.username;

      // Create in-app notification for the teacher
      await supabase.from('notifications').insert({
        user_id: teacherId,
        type: 'info',
        title: 'Student book request',
        message: `${studentName} would like to read "${bookTitle}" by ${bookAuthor}. Can you help them find this book?`
      });

      // Also tell the admin
      alertAdmin("quiz_request", {
        title: `Book request: “${bookTitle}”`,
        summary: `${studentName} asked ${teacher.display_name || teacher.username} for it`,
        lines: [["Student", `${studentName} (@${user.username})`], ["Book", bookTitle], ["Author", bookAuthor], ["Sent to teacher", teacher.display_name || teacher.username]],
        ref: `u${user.id}`,
      });

      // Send email to teacher if they have an email
      if (teacher.email) {
        setImmediate(() => {
          try {
            sendEmail(
              teacher.email,
              `Book Request from ${studentName} - A.R.I.S.E Reader`,
              `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 40px; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: #FF5900; font-size: 28px; margin: 0;">A.R.I.S.E Reader</h1>
                  <p style="color: #999; margin: 5px 0 0 0;">Read a book. Take a quiz. Earn points.</p>
                </div>
                <h2 style="color: #FF5900; font-size: 22px;">Book Request from Your Student</h2>
                <p style="color: #ccc; font-size: 16px; line-height: 1.6;">Hi ${teacher.display_name || teacher.username},</p>
                <p style="color: #ccc; font-size: 16px; line-height: 1.6;">Your student <strong style="color: #FF5900;">${studentName}</strong> would like to read the following book:</p>
                <div style="background: #2a2a2a; border-radius: 8px; padding: 20px; margin: 20px 0;">
                  <p style="color: #FF5900; font-size: 18px; margin: 0 0 5px 0; font-weight: bold;">${bookTitle}</p>
                  <p style="color: #999; margin: 0; font-size: 14px;">by ${bookAuthor}</p>
                </div>
                <p style="color: #ccc; font-size: 16px; line-height: 1.6;">Please help ${studentName} find this book so they can continue their reading journey!</p>
                <a href="${APP_URL}" style="display: inline-block; background: #FF5900; color: #fff; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-size: 16px; font-weight: bold; margin: 20px 0;">Go to A.R.I.S.E Reader</a>
                <p style="color: #666; font-size: 14px; margin-top: 30px;">This is an automated message from A.R.I.S.E Reader.</p>
              </div>
              `
            ).catch(() => {});
          } catch {}
        });
      }

      res.json({
        success: true,
        message: `Request sent to your teacher${teacher.display_name ? ' ' + teacher.display_name : ''} for "${bookTitle}"! They'll help you find it.`
      });
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
  app.get("/api/admin/easter-eggs", authMiddleware, adminMiddleware, async (req: any, res) => {
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

  // Hispanic Heritage Month: teacher-recommended books shown in the Library.
  // Stored as [{ bookId, teacher }]. Reuses a book already in the library when
  // the title matches; otherwise creates it with a quiz. Bump the key to reseed.
  try {
    const HHM_KEY = "hispanic_heritage_picks_v1";
    const existingPicks = await storage.getSetting(HHM_KEY);
    if (!existingPicks) {
      console.log("Seeding Hispanic Heritage Month teacher picks...");
      const picks = [
        {
          teacher: "Ms. Garcia",
          title: "Esperanza Rising",
          author: "Pam Muñoz Ryan",
          ageGroup: "6-8",
          description: "After tragedy strikes her wealthy family in Mexico, Esperanza and her mother move to a California farm labor camp during the Great Depression and must start over.",
          questions: [
            { question: "Where does Esperanza live at the beginning of the story?", options: ["A city apartment in Mexico City", "El Rancho de las Rosas in Aguascalientes, Mexico", "A farm labor camp in California", "A fishing village in Spain"], correct: "B" },
            { question: "What happens to Esperanza's papa just before her birthday?", options: ["He moves to the United States", "He loses the ranch in a card game", "He is killed by bandits", "He becomes very sick"], correct: "C" },
            { question: "Which uncle wants to marry Mama and take control of the ranch?", options: ["Tío Luis", "Tío Marco", "Tío Juan", "Tío Pedro"], correct: "A" },
            { question: "Where do Esperanza and Mama move after leaving Mexico?", options: ["Texas", "New York", "Florida", "A farm labor camp in California"], correct: "D" },
            { question: "What does the name Esperanza mean in English?", options: ["Hope", "Rose", "Strength", "Freedom"], correct: "A" },
            { question: "Which illness does Mama catch in California?", options: ["Measles", "Valley Fever", "The flu", "Chicken pox"], correct: "B" },
            { question: "Who is the boy, the son of the ranch's housekeeper, who travels with them?", options: ["Alfonso", "Marco", "Miguel", "Luis"], correct: "C" },
            { question: "What does Abuelita teach Esperanza to make?", options: ["Tortillas", "A clay pot", "A doll", "A crocheted blanket"], correct: "D" },
            { question: "What is Marta trying to organize among the workers?", options: ["A strike for better pay and conditions", "A school for the children", "A birthday party", "A trip back to Mexico"], correct: "A" },
            { question: "How does Abuelita finally get to California?", options: ["Tío Luis sends her", "Miguel uses Esperanza's saved money to bring her", "She wins a prize trip", "Mama travels back for her"], correct: "B" },
          ],
        },
        {
          teacher: "Ms. Garcia",
          title: "The House on Mango Street",
          author: "Sandra Cisneros",
          ageGroup: "6-8",
          description: "Told in short vignettes, Esperanza Cordero grows up in a Latino neighborhood in Chicago and dreams of a house, and a future, of her own.",
          questions: [
            { question: "Who is the narrator of The House on Mango Street?", options: ["Nenny", "Sally", "Esperanza Cordero", "Marin"], correct: "C" },
            { question: "In which city is Mango Street located?", options: ["Chicago", "Los Angeles", "Miami", "San Antonio"], correct: "A" },
            { question: "How is the book written?", options: ["As one long letter", "As a play", "As a series of short vignettes", "As a poem with one rhyme"], correct: "C" },
            { question: "How does Esperanza feel about the house on Mango Street?", options: ["It is the house of her dreams", "It is small and not the house she imagined", "It is too big for her family", "It is haunted"], correct: "B" },
            { question: "Who was Esperanza named after?", options: ["Her great-grandmother", "Her teacher", "Her aunt", "A movie star"], correct: "A" },
            { question: "What is the name of Esperanza's little sister?", options: ["Lucy", "Rachel", "Sally", "Nenny"], correct: "D" },
            { question: "Which two friends share a bike with Esperanza?", options: ["Sally and Marin", "Lucy and Rachel", "Nenny and Minerva", "Alicia and Cathy"], correct: "B" },
            { question: "What does Esperanza dream of having someday?", options: ["A house of her own", "A famous restaurant", "A horse", "A car"], correct: "A" },
            { question: "What do the three sisters tell Esperanza she must do after she leaves?", options: ["Never return", "Become a doctor", "Come back for the ones who cannot leave", "Change her name"], correct: "C" },
            { question: "How does Esperanza find a way to deal with Mango Street?", options: ["By ignoring everyone", "By playing sports", "By moving to Mexico", "By writing her stories down"], correct: "D" },
          ],
        },
        {
          teacher: "Ms. Garcia",
          title: "Before We Were Free",
          author: "Julia Alvarez",
          ageGroup: "6-8",
          description: "In the Dominican Republic in 1960, twelve-year-old Anita de la Torre's family is caught up in the fight against the dictator Trujillo.",
          questions: [
            { question: "In which country does Before We Were Free take place?", options: ["Cuba", "Puerto Rico", "The Dominican Republic", "Mexico"], correct: "C" },
            { question: "Who is the narrator of the story?", options: ["Anita de la Torre", "Lucinda", "Mundín", "Oscar Mendoza"], correct: "A" },
            { question: "Who is the dictator ruling the country?", options: ["Castro", "Trujillo", "Batista", "Perón"], correct: "B" },
            { question: "What is the SIM?", options: ["A school club", "A radio station", "A soccer team", "The dictator's secret police"], correct: "D" },
            { question: "What are Papi and Tío Toni secretly part of?", options: ["A plan to rob a bank", "A plot to overthrow the dictator", "A plan to start a business", "A government election campaign"], correct: "B" },
            { question: "Where do Anita and Mami hide to stay safe?", options: ["In a closet in the Mendoza family's home", "In a church", "On a boat", "In a cave in the mountains"], correct: "A" },
            { question: "Where does Anita write down her thoughts and fears?", options: ["In letters to her cousins", "In a school notebook she turns in", "In a diary", "On the walls of her room"], correct: "C" },
            { question: "Who is the American boy Anita has a crush on?", options: ["Oscar", "Mundín", "Toni", "Sam Washburn"], correct: "D" },
            { question: "Where does Anita go at the end of the story?", options: ["The United States", "Spain", "Haiti", "She stays home"], correct: "A" },
            { question: "What big idea does the title Before We Were Free point to?", options: ["Winning money", "Living without fear under a dictator", "Going on vacation", "Finishing school early"], correct: "B" },
          ],
        },
      ];
      const norm = (t: string) => String(t || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const allBooks = await storage.getAllBooks();
      const saved: { bookId: number; teacher: string }[] = [];
      for (const pick of picks) {
        // Only reuse a library copy that already has a quiz (points > 0);
        // 0-point books are hidden from the student library.
        let book: any = allBooks.find((b: any) => norm(b.title) === norm(pick.title) && Number(b.pointsValue) > 0);
        if (!book) {
          let coverUrl: string | null = null;
          try {
            const searchRes = await fetch(
              `https://openlibrary.org/search.json?title=${encodeURIComponent(pick.title)}&author=${encodeURIComponent(pick.author)}&limit=1`,
              { signal: AbortSignal.timeout(5000) }
            );
            if (searchRes.ok) {
              const searchData = await searchRes.json() as any;
              if (searchData.docs?.[0]?.cover_i) coverUrl = `https://covers.openlibrary.org/b/id/${searchData.docs[0].cover_i}-L.jpg`;
            }
          } catch {}
          book = await storage.createBookWithQuestions({
            title: pick.title,
            author: pick.author,
            ageGroup: pick.ageGroup,
            coverUrl,
            description: pick.description,
            pointsValue: 10,
            readUrl: null,
          }, pick.questions);
          // If Bookfinder couldn't verify official points, fall back to 10 so the
          // quiz still appears in the Library (it hides 0-point books).
          if (!(Number(book.pointsValue ?? book.points_value) > 0)) {
            await supabase.from("books").update({ points_value: 10 }).eq("id", book.id);
            try { clearCache("allBooks"); } catch {}
          }
          console.log(`Created Hispanic Heritage pick: ${pick.title}`);
        }
        saved.push({ bookId: book.id, teacher: pick.teacher });
      }
      await storage.upsertSetting(HHM_KEY, JSON.stringify(saved));
      console.log(`Saved ${saved.length} Hispanic Heritage Month teacher picks.`);
    }
  } catch (e) {
    console.error("Failed to seed Hispanic Heritage picks:", (e as Error).message);
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

      const gradeBand = gradeToBand((await studentGrades())[String(user.id)] || '3') || 'K-2';
      const form = await storage.getGrowthCheckForm(gradeBand, window.id);
      if (!form) return res.json({ available: false, message: `No form available for grade band ${gradeBand}` });

      const attempt = await storage.getOrCreateGrowthCheckAttempt(userId, form.id, window.id);
      const passages = await storage.getGrowthCheckPassages(form.id);
      const items = await storage.getGrowthCheckItems(form.id);
      const responses = await storage.getGrowthCheckResponses(attempt.id);

      // Group items by passage. The answer key stays on the server (grading happens there).
      const passagesWithItems = passages.map((p: any) => ({
        ...p,
        items: items.filter((i: any) => i.passage_id === p.id).map(({ correct_answer_json: _key, ...item }: any) => item),
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

      const gradeBand = gradeToBand((await studentGrades())[String(user.id)] || '3') || 'K-2';
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
      void alertAssessment(req, {
        kind: "Growth Check",
        score: rawScore,
        total: maxScore,
        level: `Arise Reading Score ${ariseScore}`,
      });
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
      if (!req.user.isAdmin && (req.user.role !== 'parent' || !(await parentHasStudent(req.user.id, studentId)))) {
        return res.status(403).json({ error: "Not authorized for this student" });
      }
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
      const body = req.body || {};
      const pick = (camel: string, snake: string) => body[camel] ?? body[snake];
      const id = Number(body.id);
      const fields = {
        schoolYear: pick("schoolYear", "school_year"),
        windowName: pick("windowName", "window_name"),
        startDate: pick("startDate", "start_date"),
        endDate: pick("endDate", "end_date"),
        isActive: pick("isActive", "is_active") === true,
      };
      if (!Number.isSafeInteger(id) && (!fields.schoolYear || !fields.windowName || !fields.startDate || !fields.endDate)) {
        return res.status(400).json({ message: "Choose a school year, a window (fall, winter or spring) and its dates." });
      }
      const window = await storage.saveGrowthCheckWindow(Number.isSafeInteger(id) && id > 0 ? id : null, fields);
      // the admin page reads the saved row itself; older callers read { window }
      res.json({ ...window, window });
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

      // Every current student; grades are kept in the user_grades setting, not on the user row
      const { data: students } = await supabase.from('users').select('id').eq('role', 'student').is('archived_at', null);
      const grades = await studentGrades();
      let assigned = 0;
      if (students) {
        for (const student of students) {
          const studentBand = gradeToBand(grades[String(student.id)] || '3');
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

  // AR Bookfinder catalog alignment status + controlled manual batch.
  app.get("/api/admin/ar-sync-status", authMiddleware, adminMiddleware, async (_req: any, res: any) => {
    try {
      const { data, error } = await supabase.from("books").select("ar_match_status");
      if (error) throw new Error(error.message);
      const counts: Record<string, number> = { exact: 0, formula: 0, not_found: 0, ambiguous: 0, error: 0, unverified: 0 };
      for (const row of data || []) {
        const key = row.ar_match_status || "unverified";
        counts[key] = (counts[key] || 0) + 1;
      }
      res.json({ total: (data || []).length, counts });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/ar-sync", authMiddleware, adminMiddleware, async (req: any, res: any) => {
    try {
      const limit = Math.max(1, Math.min(Number(req.body?.limit || 10), 50));
      const result = await syncUnverifiedARBooks({ limit, delayMs: 800 });
      clearCache("allBooks");
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Existing catalog alignment runs in small, sequential batches after startup.
  // It is resume-safe because completed statuses are not queried again.
  const runBackgroundARAlignment = async () => {
    try {
      let batches = 0;
      while (batches < 150) {
        const result = await syncUnverifiedARBooks({ limit: 12, delayMs: 850 });
        console.log("[AR catalog sync]", JSON.stringify(result));
        clearCache("allBooks");
        if (!result.processed) break;
        // If Bookfinder is unavailable for an entire batch, stop instead of hammering it.
        if (result.errors === result.processed) {
          console.error("[AR catalog sync] Bookfinder unavailable; stopping this run safely.");
          break;
        }
        batches++;
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
    } catch (e: any) {
      console.error("[AR catalog sync] stopped:", e?.message || e);
    }
  };
  if (process.env.AR_AUTO_SYNC === "1") {
    setTimeout(() => void runBackgroundARAlignment(), 7000);
  } else {
    console.log("[AR catalog sync] automatic migration paused pending Bookfinder smoke verification.");
  }

  // Temporary startup smoke check: lookup only, does not modify any book row.
  setTimeout(() => {
    void lookupARBook("Frindle", "Andrew Clements")
      .then(async result => {
        console.log("[AR smoke test Frindle]", JSON.stringify(result));
        await storage.upsertSetting("ar_bookfinder_smoke_result", JSON.stringify({
          checkedAt: new Date().toISOString(),
          title: "Frindle",
          author: "Andrew Clements",
          result,
        }));
      })
      .catch(async error => {
        console.error("[AR smoke test Frindle] failed:", error?.message || error);
        await storage.upsertSetting("ar_bookfinder_smoke_result", JSON.stringify({
          checkedAt: new Date().toISOString(),
          title: "Frindle",
          author: "Andrew Clements",
          error: error?.message || String(error),
        }));
      });
  }, 3000);

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

// Cache clear for FYP verification
