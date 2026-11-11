// "@arise" in a typed Arise Notes note: type "@arise <what you want>" on a line and press Enter, and Arise's AI
// answers right under it. The prompt and the answer live together in one quote block (marked data-arise) so the
// person can delete the whole thing, or merge it: keep just the answer as plain note text, without the prompt.
// All of it works on the note's HTML text, so it saves, syncs and exports like any other part of the note.
// The note page is client/src/components/arise-notes/pages/PageScreen.tsx.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const BLOCK = (id: string) => new RegExp(`<blockquote\\b[^>]*\\bdata-arise="${id.replace(/[^a-z0-9-]/gi, "")}"[^>]*>([\\s\\S]*?)<\\/blockquote>`, "i");
const FIRST_P = /^\s*<p\b[^>]*>[\s\S]*?<\/p>/i;
export const WAIT = "w-";

/** The request on a line that starts with @arise, or null when it isn't one (or has nothing after it). */
export function parseAtArise(line: string): string | null {
  const m = /^\s*@arise\b[\s,:;.-]*([\s\S]*)$/i.exec(line.replace(/ /g, " "));
  const ask = m?.[1]?.trim() ?? "";
  return ask.length >= 2 ? ask.slice(0, 500) : null;
}

export const newReplyId = () => Math.random().toString(36).slice(2, 8).padEnd(6, "0");

const promptP = (ask: string) => `<p><b>@arise</b> ${esc(ask)}</p>`;
/** The block while Arise is still writing. */
export const waitingBlock = (id: string, ask: string) => `<blockquote data-arise="${WAIT}${id}">${promptP(ask)}<p><i>Arise is writing…</i></p></blockquote>`;
/** The answer's lines as note HTML: bullets when it is a list, a paragraph otherwise. */
export const answerHtml = (lines: string[]) => lines.length > 1 ? `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : `<p>${esc(lines[0] ?? "")}</p>`;

/** Swaps a waiting block for the finished one (prompt, then the answer). Unchanged when the block is gone. */
export function finishReply(html: string, id: string, answer: string): string {
  return html.replace(BLOCK(`${WAIT}${id}`), (_m, inner: string) => `<blockquote data-arise="${id}">${FIRST_P.exec(inner)?.[0] ?? ""}${answer}</blockquote>`);
}
/** When no answer came: the block goes back to being the plain line that was typed. */
export function failReply(html: string, id: string): string {
  return html.replace(BLOCK(`${WAIT}${id}`), (_m, inner: string) => (FIRST_P.exec(inner)?.[0] ?? "").replace(/<\/?b>/gi, ""));
}
/** Every waiting block that nothing is working on any more (the page was closed mid-answer) turned back into its line. */
export function clearStale(html: string, working: Set<string>): string {
  return html.replace(/<blockquote\b[^>]*\bdata-arise="w-([a-z0-9]+)"[^>]*>([\s\S]*?)<\/blockquote>/gi,
    (m, id: string, inner: string) => (working.has(id) ? m : (FIRST_P.exec(inner)?.[0] ?? "").replace(/<\/?b>/gi, "")));
}

/** Keeps just the answer: the quote block is replaced by what Arise wrote, with no prompt. */
export function mergeReply(html: string, id: string): string {
  return html.replace(BLOCK(id), (_m, inner: string) => inner.replace(FIRST_P, "").trim());
}
/** Removes the prompt and the answer. */
export function deleteReply(html: string, id: string): string {
  return html.replace(BLOCK(id), "");
}
/** The ids of finished replies in a note, in order. */
export const replyIds = (html: string): string[] => [...html.matchAll(/<blockquote\b[^>]*\bdata-arise="([a-z0-9]+)"/gi)].map((m) => m[1]).filter((id) => !id.startsWith(WAIT));
