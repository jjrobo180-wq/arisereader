// A Google Doc read and edited a paragraph at a time on the site (server/googleConnect.ts, client
// components/teacher-hub/GoogleDocsPanel.tsx). Editing one paragraph only replaces that paragraph's words, so the
// rest of the doc (pictures, tables, formatting) is left exactly as it was. Pure, so it's tested
// (tests/google-doc-text.test.ts).

export type DocStyle = "title" | "subtitle" | "h1" | "h2" | "h3" | "h4" | "text";
export type DocPara = {
  /** Where the paragraph starts and ends in the doc (end is after its line break). */
  start: number; end: number;
  /** Its words, without the line break; "" for an empty line. */
  text: string;
  style: DocStyle;
  bullet: boolean;
  /** A table, a picture or anything else that's only shown, not edited here. */
  other?: "table" | "picture" | "section";
};

const STYLES: Record<string, DocStyle> = {
  TITLE: "title", SUBTITLE: "subtitle", HEADING_1: "h1", HEADING_2: "h2", HEADING_3: "h3", HEADING_4: "h4",
  HEADING_5: "h4", HEADING_6: "h4", NORMAL_TEXT: "text",
};

/** The doc's paragraphs from a documents.get answer (the first tab's body). */
export function docParagraphs(doc: any): DocPara[] {
  const content: any[] = doc?.body?.content ?? doc?.tabs?.[0]?.documentTab?.body?.content ?? [];
  const out: DocPara[] = [];
  for (const b of content) {
    const start = Number(b?.startIndex ?? 0), end = Number(b?.endIndex ?? 0);
    if (b?.sectionBreak) continue;
    if (b?.table) { out.push({ start, end, text: "", style: "text", bullet: false, other: "table" }); continue; }
    if (!b?.paragraph) continue;
    const els: any[] = b.paragraph.elements || [];
    const picture = els.some((e) => e?.inlineObjectElement);
    const text = els.map((e) => String(e?.textRun?.content ?? "")).join("").replace(/\n$/, "");
    out.push({
      start, end, text,
      style: STYLES[String(b.paragraph.paragraphStyle?.namedStyleType || "NORMAL_TEXT")] ?? "text",
      bullet: !!b.paragraph.bullet,
      ...(picture ? { other: "picture" as const } : {}),
    });
  }
  return out;
}

/** The batchUpdate requests that put `text` in place of a paragraph's words ("" removes the paragraph).
 *  `last`: it's the doc's last paragraph, whose line break can't be deleted. */
export function replaceParaRequests(p: Pick<DocPara, "start" | "end">, text: string, last: boolean): any[] {
  const words = String(text).replace(/\r/g, "").replace(/\n+$/, "");
  const reqs: any[] = [];
  if (!words.trim()) {
    // Remove the whole paragraph with its line break (the last one keeps its line break: it's emptied).
    const end = last ? p.end - 1 : p.end;
    if (end > p.start) reqs.push({ deleteContentRange: { range: { startIndex: p.start, endIndex: end } } });
    return reqs;
  }
  if (p.end - 1 > p.start) reqs.push({ deleteContentRange: { range: { startIndex: p.start, endIndex: p.end - 1 } } });
  reqs.push({ insertText: { location: { index: p.start }, text: words } });
  return reqs;
}

/** Requests that add a new plain paragraph right after this one. */
export function addAfterRequests(p: Pick<DocPara, "end">, text: string): any[] {
  const words = String(text).replace(/\r/g, "").trim();
  if (!words) return [];
  const at = p.end - 1; // before this paragraph's line break
  return [
    { insertText: { location: { index: at }, text: `\n${words}` } },
    { updateParagraphStyle: { range: { startIndex: at + 1, endIndex: at + 1 + words.length }, paragraphStyle: { namedStyleType: "NORMAL_TEXT" }, fields: "namedStyleType" } },
  ];
}

/** The project number in an OAuth client id ("123456-abc.apps.googleusercontent.com" → "123456"): Google's
 *  file picker needs it to give this site access to the files picked. */
export function projectNumberOf(clientId: string): string {
  const m = /^(\d{6,})-/.exec(String(clientId || ""));
  return m ? m[1] : "";
}
