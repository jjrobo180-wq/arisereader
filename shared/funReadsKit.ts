// The November 2026 5-Minute Reads (shared/funReads*.ts): 100 short, kid-friendly pieces across every
// category (history, famous people, stars and entertainment, sports, soccer, science, space, animals and
// nature, inventions, arts and music, fun facts). Each is written in a compact draft form and built here into
// a NewsArticle, so it becomes a 5-point library quiz like every other Arise Original.
//
// Draft body: paragraphs separated by a blank line; a line starting "## " is a heading and "!! Title: text"
// is a fact box. Each quiz row is [question, right answer, wrong, wrong, wrong]; the right answer's spot
// rotates so every quiz uses at least three different letters.
import type { NewsArticle, NewsBlock, NewsQuestion, NewsSection } from "./ariseNews";

export type FunDraft = {
  slug: string;
  section: NewsSection;
  title: string;
  dek: string;
  /** Exact file name on Wikimedia Commons (free license), from the topic's Wikipedia page. */
  file: string;
  alt: string;
  focus?: string;
  /** The topic's Wikipedia page title (its page is the photo's source and the story's reference). */
  wiki: string;
  /** More references, as full https URLs. */
  more?: string[];
  body: string;
  words: [string, string][];
  qa: [string, string, string, string, string][];
};

export const FUN_READS_ON = "2026-11-14";
const LETTERS = ["A", "B", "C", "D"] as const;

const block = (t: string): NewsBlock => {
  if (t.startsWith("## ")) return { kind: "h", text: t.slice(3).trim() };
  if (t.startsWith("!! ")) {
    const i = t.indexOf(":");
    return { kind: "fact", title: t.slice(3, i).trim(), text: t.slice(i + 1).trim() };
  }
  return { kind: "p", text: t.trim() };
};

const wikiUrl = (title: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

/** Builds the drafts. `offset` staggers the answer key between batches. */
export function buildFunReads(drafts: FunDraft[], offset = 0): NewsArticle[] {
  return drafts.map((d, n) => ({
    slug: d.slug,
    kind: "feature",
    section: d.section,
    title: d.title,
    dek: d.dek,
    grades: "Grades 3–7",
    publishedOn: FUN_READS_ON,
    sources: [{ name: `Wikipedia: ${d.wiki}`, url: wikiUrl(d.wiki) }, ...(d.more || []).map((url) => ({ name: new URL(url).hostname.replace(/^www\./, ""), url }))],
    photo: { file: d.file, alt: d.alt, ...(d.focus ? { focus: d.focus } : {}), wikipediaTitle: d.wiki },
    body: d.body.trim().split(/\n\s*\n/).map(block),
    words: d.words.map(([word, meaning]) => ({ word, meaning })),
    questions: d.qa.map(([question, right, ...wrong], i): NewsQuestion => {
      const k = (i + n + offset) % 4;
      const options = [...wrong];
      options.splice(k, 0, right);
      return { question, options: options as NewsQuestion["options"], correct: LETTERS[k] };
    }),
  }));
}
