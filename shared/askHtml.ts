// What Arise made for an "@arise" ask (Markdown) as HTML for the Arise tab, printing and saving
// (client/src/components/teacher-hub/AriseAsks.tsx). Every bit of text is escaped first, so only the few tags
// made here can appear, never anything from the AI.
export const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const inline = (s: string) => escHtml(s)
  // A blank to write in (____) is a line to write on, kept on the same line as the words before it.
  .replace(/\s*_{3,}/g, '&nbsp;<span class="blank" aria-label="blank"></span>')
  .replace(/`([^`]+)`/g, "<code>$1</code>")
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");

/** Arise's Markdown as HTML. Every bit of text is escaped first, so only these few tags can appear. */
export function askHtml(md: string): string {
  const out: string[] = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let list: "ul" | "ol" | null = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { close(); continue; }
    // A table: | a | b | rows, with a |---| line under the header.
    if (/^\|.*\|$/.test(t) && /^\|?\s*:?-{2,}/.test((lines[i + 1] || "").trim())) {
      close();
      const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim()));
      const head = cells(t); i += 2;
      const body: string[][] = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) { body.push(cells(lines[i])); i++; }
      i--;
      out.push(`<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(t);
    if (h) { close(); const n = Math.min(4, h[1].length + 1); out.push(`<h${n}>${inline(h[2])}</h${n}>`); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { close(); out.push("<hr>"); continue; }
    const box = /^[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(t);
    const ul = /^[-*•]\s+(.*)$/.exec(t);
    const ol = /^(\d{1,3})[.)]\s+(.*)$/.exec(t);
    if (box || ul) {
      if (list !== "ul") { close(); out.push('<ul>'); list = "ul"; }
      out.push(box ? `<li class="box"><span aria-hidden="true">${box[1].trim() ? "☑" : "☐"}</span> ${inline(box[2])}</li>` : `<li>${inline(ul![1])}</li>`);
      continue;
    }
    if (ol) {
      if (list !== "ol") { close(); out.push(`<ol start="${Number(ol[1])}">`); list = "ol"; }
      out.push(`<li>${inline(ol[2])}</li>`);
      continue;
    }
    close();
    out.push(`<p>${inline(t)}</p>`);
  }
  close();
  return out.join("");
}


/** A worksheet's or quiz's answer key, taken off the end ("## Answer key" and what follows), so the
 *  page can hide it until asked and print with or without it. */
export function splitAnswerKey(md: string): { main: string; key: string } {
  const m = /^#{1,4}\s*\**\s*(answer key|answers|answer sheet|key)\b.*$/im.exec(md);
  if (!m || m.index < 20) return { main: md, key: "" };
  return { main: md.slice(0, m.index).trimEnd(), key: md.slice(m.index + m[0].length).trim() };
}
