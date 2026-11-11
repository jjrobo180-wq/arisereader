// Arise Undercover: an AI chat that looks like something else (a text thread, a group chat, a
// document), for asking quick questions in a meeting without it looking like an AI app.
// Shared by the server (server/undercover.ts) and the app (client/src/undercover/).

export type UndercoverTheme = "text" | "group" | "inbox" | "docNotes" | "docComments" | "docPhone";
export type UndercoverMsg = { role: "user" | "assistant"; content: string };

export const UNDERCOVER_THEMES: { id: UndercoverTheme; name: string; blurb: string; kind: "text" | "doc" }[] = [
  { id: "text", name: "Text thread", blurb: "Looks like texting a friend.", kind: "text" },
  { id: "group", name: "Group chat", blurb: "Answers come from three friends.", kind: "text" },
  { id: "inbox", name: "Chats inbox", blurb: "Tap the name to swap to a decoy chat.", kind: "text" },
  { id: "docNotes", name: "Meeting notes", blurb: "Answers write into your notes.", kind: "doc" },
  { id: "docComments", name: "Doc comments", blurb: "A colleague replies in comments.", kind: "doc" },
  { id: "docPhone", name: "Phone doc", blurb: "Bullet points; tap the title to hide them.", kind: "doc" },
];
export const isUndercoverTheme = (v: unknown): v is UndercoverTheme => UNDERCOVER_THEMES.some((t) => t.id === v);

export const UNDERCOVER_MAX_MSG = 2000;
export const UNDERCOVER_MAX_HISTORY = 16;

/** How the AI should write for each look, so the answer blends in. */
export function undercoverSystemPrompt(theme: UndercoverTheme): string {
  const base = "You are a discreet assistant someone is using during a meeting or class. Answer fast and to the point. Never mention being an AI or a chatbot. No greetings, no sign-offs, no markdown headings, no emoji.";
  const style: Record<UndercoverTheme, string> = {
    text: "Write like a text message from a smart friend: lowercase is fine, one to three short sentences, under 60 words.",
    group: "Write like a group chat: 1 to 3 very short messages, one per line, each under 20 words. Separate messages with a new line.",
    inbox: "Write like a text message: one to three short sentences, under 60 words.",
    docNotes: "Write like someone's own meeting notes: plain sentences or short lines starting with '- '. Under 80 words.",
    docComments: "Write like a helpful colleague's comment on a document: 1 to 3 sentences, under 60 words.",
    docPhone: "Write 2 to 4 short bullet points, one per line, each starting with '- ', each under 14 words.",
  };
  return `${base} ${style[theme]}`;
}

/** Keeps only well-formed recent messages, trimmed, ending with the person's question. */
export function cleanHistory(raw: unknown): UndercoverMsg[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: UndercoverMsg[] = [];
  for (const m of list) {
    const role = (m as any)?.role, content = String((m as any)?.content ?? "").trim().slice(0, UNDERCOVER_MAX_MSG);
    if ((role === "user" || role === "assistant") && content) out.push({ role, content });
  }
  const recent = out.slice(-UNDERCOVER_MAX_HISTORY);
  while (recent.length && recent[0].role !== "user") recent.shift();
  return recent.length && recent[recent.length - 1].role === "user" ? recent : [];
}

/** Splits an answer into lines (group chat messages, bullet points), without bullet marks. */
export function answerLines(text: string): string[] {
  return String(text || "").split(/\n+/).map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim()).filter(Boolean);
}
