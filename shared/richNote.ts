// Rich notes: a note can keep formatted text (fonts, sizes, colours, headings, lists, checklists)
// as HTML in `html`, written in the full-screen note editor (client/src/components/notes/
// FullNoteEditor.tsx). `body` is always kept as the plain-text version of the same note, so search,
// note cards, Home, share links and older code keep working without knowing about HTML.
//
// Notes live inside the hub's one saved file, so pictures are not kept in notes (they would make
// that file huge) and the HTML is capped. The same sanitizer as Arise Docs removes anything unsafe.

import { htmlText, sanitizeHtml } from "./office/docModel";

export const NOTE_HTML_MAX = 60_000;
export const NOTE_BODY_MAX = 5000;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A note's saved HTML made safe: allowed tags only, no pictures, capped. "" when there's nothing. */
export function cleanNoteHtml(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return "";
  const safe = sanitizeHtml(raw.slice(0, NOTE_HTML_MAX * 2)).replace(/<img\b[^>]*>/gi, "");
  if (safe.length > NOTE_HTML_MAX) return ""; // too big to keep formatted; the plain body still is
  return htmlText(safe).trim() ? safe : "";
}

/** Plain text (a template, an older note) as editor HTML, one paragraph per line. */
export function textToNoteHtml(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  return lines.map((l) => `<p>${esc(l) || "<br>"}</p>`).join("") || "<p><br></p>";
}

/** The plain-text body saved alongside the HTML. */
export const noteTextOf = (html: string) => htmlText(html).slice(0, NOTE_BODY_MAX);

/** What the editor opens with: the formatted HTML if there is some, otherwise the plain body. */
export const noteStartHtml = (note: { html?: string; body: string }) => (note.html && note.html.trim() ? note.html : textToNoteHtml(note.body));
