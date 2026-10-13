// What the premium apps may ask the site's AI to make. Each task is a fixed instruction written
// here; the app only fills in the blanks (the topic, the notes, the numbers), so the AI route can't
// be used as a general chatbot. Every answer is one JSON object; each app checks what it gets.

export type AiTask = {
  /** What the AI is told it is. */
  system: string;
  /** The request, built from what the person typed. Every value is already trimmed and capped. */
  prompt: (input: Record<string, string>) => string;
  maxTokens: number;
};

const BASE = "You are a helpful assistant inside Arise, an organizer app for teachers and families. Be practical, specific, warm and accurate. Answer with one JSON object only, in exactly the shape asked for.";
const t = (system: string, prompt: AiTask["prompt"], maxTokens = 2500): AiTask => ({ system: `${BASE}\n${system}`, prompt, maxTokens });
const v = (i: Record<string, string>, k: string, fallback = "") => (i[k] || fallback).trim();

export const AI_TASKS: Record<string, AiTask> = {
  // Office
  "doc-write": t("You write and rewrite documents.", (i) => `Task: ${v(i, "action", "write")}. Tone: ${v(i, "tone", "clear and friendly")}.\nTopic or instructions: ${v(i, "topic")}\n${i.text ? `Text to work on:\n${i.text}` : ""}\nReturn {"html": string} — clean HTML using only <h1>,<h2>,<h3>,<p>,<ul>,<ol>,<li>,<strong>,<em>,<u>,<blockquote>,<table>,<tr>,<th>,<td>. No <html>/<body>/<style>.`, 3500),
  "slides-deck": t("You make presentation decks.", (i) => `Make a ${v(i, "count", "8")}-slide presentation about: ${v(i, "topic")}\nAudience: ${v(i, "audience", "general")}. ${v(i, "notes")}\nFirst slide is a title slide. Bullets short (under 14 words, at most 5 per slide). Put what the presenter says in notes.\nReturn {"title": string, "slides": [{"title": string, "bullets": string[], "notes": string}]}.`, 3500),
  "sheet-formula": t("You are a spreadsheet expert (Excel/Google Sheets formulas).", (i) => `Write one spreadsheet formula for: ${v(i, "ask")}\nThe sheet's columns: ${v(i, "headers", "unknown")}\nSupported functions include SUM, AVERAGE, IF, IFS, SUMIF(S), COUNTIF(S), AVERAGEIF, VLOOKUP, XLOOKUP, INDEX, MATCH, ROUND, TEXT, DATE, TODAY, LEFT, RIGHT, MID, LEN, CONCAT, TEXTJOIN, IFERROR, MAX, MIN, MEDIAN, RANK.\nReturn {"formula": string (starting with =), "explain": string (one sentence)}.`, 600),

  // Health, fitness & mind
  "workout-plan": t("You are a certified personal trainer. Plans are safe, progressive and realistic.", (i) => `Make a ${v(i, "days", "3")}-day-a-week workout plan. Goal: ${v(i, "goal", "general fitness")}. Level: ${v(i, "level", "beginner")}. Equipment: ${v(i, "equipment", "none")}. Minutes per session: ${v(i, "minutes", "30")}. Notes: ${v(i, "notes")}\nReturn {"name": string, "days": [{"title": string, "focus": string, "exercises": [{"name": string, "sets": number, "reps": string, "rest": string, "tip": string}]}], "tips": string[]}.`, 3500),
  "meal-plan": t("You are a registered dietitian. Meals are realistic, family-friendly and use common ingredients.", (i) => `Make a 7-day meal plan (breakfast, lunch, dinner, snack). Diet: ${v(i, "diet", "no restrictions")}. Calories a day: ${v(i, "calories", "about 2000")}. People: ${v(i, "people", "2")}. Avoid: ${v(i, "avoid", "nothing")}. Budget: ${v(i, "budget", "moderate")}.\nReturn {"days": [{"day": string, "breakfast": string, "lunch": string, "dinner": string, "snack": string}], "grocery": [{"item": string, "amount": string, "aisle": string}]}.`, 4000),
  "journal-reflect": t("You are a kind, encouraging journaling companion (not a therapist). Never diagnose. If the writing mentions self-harm or wanting to die, gently encourage calling or texting 988 (US) or a trusted person.", (i) => `Someone wrote this journal entry:\n${v(i, "text")}\nReflect it back warmly in 2-3 sentences, notice one strength, and ask one gentle follow-up question.\nReturn {"reflection": string, "question": string}.`, 600),
  "thought-reframe": t("You help people practice CBT-style balanced thinking. Supportive, not clinical. Never diagnose.", (i) => `Situation: ${v(i, "situation")}\nAutomatic thought: ${v(i, "thought")}\nOffer three gentler, balanced ways to see it.\nReturn {"reframes": string[]}.`, 600),

  // Work & meetings
  "meeting-agenda": t("You plan effective meetings.", (i) => `Plan a ${v(i, "minutes", "30")}-minute meeting. Purpose: ${v(i, "purpose")}. Attendees: ${v(i, "people", "the team")}.\nReturn {"title": string, "goal": string, "items": [{"topic": string, "minutes": number, "owner": string, "notes": string}]}.`, 1500),
  "meeting-summary": t("You write crisp meeting minutes.", (i) => `Meeting notes:\n${v(i, "notes")}\nReturn {"summary": string, "decisions": string[], "actions": [{"task": string, "owner": string, "due": string}]}.`, 2000),
  "email-rewrite": t("You rewrite emails.", (i) => `Rewrite this email to be ${v(i, "tone", "professional and friendly")}. Keep the facts.\n${v(i, "text")}\nReturn {"subject": string, "body": string}.`, 1500),
  "resume-bullets": t("You are a résumé coach.", (i) => `Job: ${v(i, "role")}. What they did: ${v(i, "text")}\nWrite 4 strong résumé bullets that start with action verbs and include results/numbers where reasonable (don't invent specific numbers; use placeholders like [X]).\nReturn {"bullets": string[]}.`, 800),
  "cover-letter": t("You write cover letters that sound human, specific and confident.", (i) => `Name: ${v(i, "name")}. Job: ${v(i, "role")} at ${v(i, "company")}. Background: ${v(i, "background")}. Why this job: ${v(i, "why")}. Tone: ${v(i, "tone", "warm and professional")}.\nReturn {"letter": string} (about 300 words, plain text with blank lines between paragraphs).`, 1500),
  "brainstorm": t("You brainstorm creatively.", (i) => `Brainstorm ${v(i, "count", "10")} ideas for: ${v(i, "topic")}. ${v(i, "notes")}\nReturn {"ideas": [{"title": string, "detail": string}]}.`, 1500),

  // School
  "flashcards": t("You make study flashcards that test one fact each.", (i) => `Make ${v(i, "count", "15")} flashcards about: ${v(i, "topic")}\n${i.text ? `From these notes:\n${i.text}` : ""}\nLevel: ${v(i, "level", "middle school")}.\nReturn {"cards": [{"front": string, "back": string}]}.`, 3000),
  "quiz": t("You write fair, clear quiz questions.", (i) => `Write ${v(i, "count", "10")} multiple-choice questions about: ${v(i, "topic")}\n${i.text ? `Based on:\n${i.text}` : ""}\nLevel: ${v(i, "level", "middle school")}. 4 choices each, one correct.\nReturn {"questions": [{"q": string, "choices": string[], "answer": number (0-3), "why": string}]}.`, 3500),
  "essay-outline": t("You are a writing teacher.", (i) => `Make an essay outline. Prompt or topic: ${v(i, "topic")}. Type: ${v(i, "type", "argumentative")}. Level: ${v(i, "level", "high school")}.\nReturn {"thesis": string, "hook": string, "body": [{"point": string, "evidence": string[], "explain": string}], "counter": string, "conclusion": string}.`, 2000),
  "study-guide": t("You make clear study guides.", (i) => `Make a study guide on: ${v(i, "topic")}\n${i.text ? `From:\n${i.text}` : ""}\nReturn {"title": string, "keyTerms": [{"term": string, "meaning": string}], "bigIdeas": string[], "practice": string[]}.`, 3000),
  "mnemonic": t("You make memorable mnemonics.", (i) => `Make 3 mnemonics to remember: ${v(i, "topic")}\nReturn {"mnemonics": [{"device": string, "how": string}]}.`, 800),
  "vocab": t("You are a vocabulary teacher.", (i) => `For each word give a kid-friendly definition, part of speech, an example sentence and a synonym: ${v(i, "words")}\nReturn {"words": [{"word": string, "pos": string, "meaning": string, "example": string, "synonym": string}]}.`, 2500),

  // Teachers
  "rubric": t("You are an experienced teacher who writes clear rubrics.", (i) => `Make a rubric for: ${v(i, "task")}. Grade: ${v(i, "grade", "any")}. Criteria count: ${v(i, "criteria", "4")}. Levels: ${v(i, "levels", "4 (Exceeds, Meets, Approaching, Beginning)")}.\nReturn {"title": string, "levels": string[], "criteria": [{"name": string, "descriptors": string[]}]}.`, 3000),
  "newsletter": t("You write warm, clear class/family newsletters.", (i) => `Write a newsletter. Audience: ${v(i, "audience", "families")}. Include: ${v(i, "points")}. Tone: ${v(i, "tone", "warm")}.\nReturn {"title": string, "sections": [{"heading": string, "body": string}]}.`, 2500),
  "story": t("You write delightful, age-appropriate stories for kids and families.", (i) => `Write a ${v(i, "length", "short")} story for age ${v(i, "age", "7")}. Characters: ${v(i, "characters")}. Setting: ${v(i, "setting")}. Lesson or theme: ${v(i, "theme")}.\nReturn {"title": string, "pages": [string] (6-10 short pages, 2-4 sentences each)}.`, 3000),

  // Home
  "gift-ideas": t("You suggest thoughtful gifts.", (i) => `Gift ideas for: ${v(i, "who")}. Interests: ${v(i, "likes")}. Budget: ${v(i, "budget", "$25-50")}. Occasion: ${v(i, "occasion", "birthday")}.\nReturn {"ideas": [{"gift": string, "why": string, "price": string}]} (10 ideas).`, 1500),
  "party-plan": t("You plan fun, organized events.", (i) => `Plan a ${v(i, "event", "birthday party")} for ${v(i, "guests", "15")} guests, theme ${v(i, "theme", "any")}, budget ${v(i, "budget", "$200")}.\nReturn {"checklist": [{"task": string, "when": string}], "menu": string[], "activities": string[], "shopping": string[]}.`, 2500),
};

export const AI_TASK_IDS = Object.keys(AI_TASKS);

/** What the person typed, made safe: only short strings, only known keys' worth. */
export function cleanAiInput(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, val] of Object.entries(raw).slice(0, 16)) {
    if (!/^[a-z][a-zA-Z]{0,20}$/.test(k)) continue;
    if (typeof val === "string" || typeof val === "number") out[k] = String(val).replace(/\u0000/g, "").slice(0, k === "text" || k === "notes" ? 12000 : 1500);
  }
  return out;
}
