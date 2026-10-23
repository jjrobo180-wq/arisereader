// Is a requested book right for students? Quiz requests still go to the teacher as usual, but an
// adult book (or one with other problems) comes with a notice and a recommendation not to approve.
//
// Three signals, strongest first:
//  1. Authors and titles we've already decided don't belong (Rachel Reid's adult romances, Kevin
//     Hart's adult self-help books).
//  2. The AI's own read of the book's audience ("adult") and any content warning it gives.
//  3. Open Library subjects that mark a book as adult (erotica, "adult fiction", explicit content).

export type ContentCheck = {
  /** adult: recommend not approving. mature: the teacher should look first. ok: nothing found. */
  level: "adult" | "mature" | "ok";
  reasons: string[];
};

const norm = (s: string) => String(s || "").toLowerCase().normalize("NFKD").replace(/[’'`]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Authors whose books are for adults. */
export const ADULT_AUTHORS: { author: string; why: string }[] = [
  { author: "rachel reid", why: "Rachel Reid writes adult romance novels with sexual content (Game Changers series)." },
];

/** Single adult books by authors who also write for kids (so the author alone isn't enough). */
export const ADULT_TITLES: { title: string; author: string; why: string }[] = [
  { title: "the decision", author: "kevin hart", why: "Kevin Hart's \"The Decision\" is an adult self-help book with adult language." },
  { title: "it will all work out", author: "kevin hart", why: "Kevin Hart's \"It Will All Work Out\" is an adult self-help book." },
  { title: "i cant make this up", author: "kevin hart", why: "Kevin Hart's \"I Can't Make This Up\" is an adult memoir with adult language and content." },
];

const ADULT_SUBJECTS = /\b(erotica|erotic|sexual content|explicit|adult fiction|fiction adult|new adult|romance adult)\b/;

function sameAuthor(a: string, b: string) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  // "Reid, Rachel" is the same person; a different first name is not.
  const words = (s: string) => s.split(" ").sort().join(" ");
  return x === y || words(x) === words(y);
}

export function checkBookContent(input: {
  title: string; author: string;
  /** Open Library subjects, if we have them. */
  subjects?: string[] | null;
  /** The AI's guess at who the book is written for. */
  aiAudience?: string | null;
  /** The AI's short note about content (sex, drugs, violence, language), if any. */
  aiWarning?: string | null;
}): ContentCheck {
  const reasons: string[] = [];
  let level: ContentCheck["level"] = "ok";
  const title = norm(input.title);

  for (const a of ADULT_AUTHORS) if (sameAuthor(input.author, a.author)) { level = "adult"; reasons.push(a.why); }
  for (const t of ADULT_TITLES) {
    if (sameAuthor(input.author, t.author) && (title === t.title || title.startsWith(`${t.title} `))) { level = "adult"; reasons.push(t.why); }
  }

  const subjects = (input.subjects || []).map(norm).filter(Boolean);
  const adultSubject = subjects.find((s) => ADULT_SUBJECTS.test(s));
  if (adultSubject) { level = "adult"; reasons.push(`Library records list it as "${adultSubject}".`); }

  const audience = norm(input.aiAudience || "");
  const warning = String(input.aiWarning || "").trim().slice(0, 240);
  if (audience === "adult") {
    level = "adult";
    reasons.push(warning ? `The AI says it's written for adults: ${warning}` : "The AI says this book is written for adults.");
  } else if (warning) {
    if (level === "ok") level = "mature";
    reasons.push(`Content note from the AI: ${warning}`);
  }
  return { level, reasons: [...new Set(reasons)] };
}

/** The line the teacher sees in the request notification. Empty when nothing was found. */
export function contentNotice(c: ContentCheck | null | undefined): string {
  if (!c || c.level === "ok") return "";
  return c.level === "adult"
    ? " Warning: this looks like an adult book. We recommend not approving it."
    : " Note: this book may have mature content. Check it before approving.";
}
