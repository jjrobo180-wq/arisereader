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

// ── "Did you mean" for students ──────────────────────────────────────────────────────────────
// Suggestions come from Open Library, which has every book ever printed, adult ones included.
// A student should never be shown one, so a suggestion is dropped when any sign says it's not for kids.

/** Authors who write only adult romance or erotica. */
const ADULT_ONLY_AUTHORS = [
  "rachel reid", "e l james", "colleen hoover", "ana huang", "penelope douglas", "sylvia day", "anais nin",
  "henry miller", "jackie collins", "pauline reage", "marquis de sade", "rina kent", "h d carlton", "tillie cole",
  "lucy score", "elle kennedy", "k a tucker", "j r ward", "christina lauren", "tarryn fisher", "kennedy ryan",
  "lauren asher", "vi keeland", "pepper winters", "meghan march", "c d reiss", "sierra simone", "monica murphy",
];
/** Adult books by famous authors whose other books are fine. */
const ADULT_ONLY_TITLES = ["fifty shades", "lolita", "tropic of cancer", "tropic of capricorn", "story of o", "kama sutra", "kamasutra", "the joy of sex", "delta of venus", "120 days of sodom", "american psycho"];
/** Words that never belong in a book title shown to a student. */
// (Not "naked", "dick" or "mistress": "Naked Mole Rat Gets Dressed", "Moby-Dick", "Mistress Masham's Repose".)
const EXPLICIT_WORDS = /\b(sex|sexy|sexual|sexuality|erotic|erotica|erotics|porn|porno|pornography|nude|nudes|nudity|orgasm|orgy|fetish|bdsm|kinky|lust|lustful|seduce|seduced|seduction|horny|slut|sluts|whore|whores|hooker|stripper|playboy|penthouse|dominatrix|bondage|threesome|fuck|fucked|fucking|fuckin|shit|bitch|bitches|cunt|pussy|boobs|tits|asshole|rape|raped|incest|cocaine|heroin|marijuana|cannabis|suicide|serial killer)\b/;
/** Library subjects that mark a book as adult, always. */
const ADULT_SUBJECT_WORDS = /\b(erotica|erotic|sex|sexual|sexuality|nudity|nude|pornography|explicit|adult fiction|fiction adult|new adult|romance adult|bdsm|sadomasochism|dark romance|mafia romance|prostitution|incest)\b/;
/** Subjects that mark a book as adult unless the library also marks it for kids or teens. */
const GROWN_UP_SUBJECT_WORDS = /\b(romance|love stories|contemporary romance|romantic suspense|content warning|alcoholism|drug abuse|rape)\b/;
const KID_SUBJECT = /\b(juvenile|children|childrens|young adult|picture books?|middle grade|school stories|readers|beginner|easy reading|kids)\b/;

/** May a student see this book as a "Did you mean" suggestion? */
export function isKidSafeSuggestion(c: { title?: unknown; subtitle?: unknown; author?: unknown; subjects?: unknown }): boolean {
  const title = norm(`${c.title ?? ""} ${c.subtitle ?? ""}`), author = norm(String(c.author ?? ""));
  if (!title) return false;
  if (EXPLICIT_WORDS.test(title)) return false;
  if (ADULT_ONLY_AUTHORS.some((a) => sameAuthor(author, a))) return false;
  for (const a of ADULT_AUTHORS) if (sameAuthor(author, a.author)) return false;
  for (const t of ADULT_TITLES) if (sameAuthor(author, t.author) && (title === t.title || title.startsWith(`${t.title} `))) return false;
  if (ADULT_ONLY_TITLES.some((t) => title === t || title.startsWith(`${t} `))) return false;
  const subjects = (Array.isArray(c.subjects) ? c.subjects : []).map((s) => norm(String(s))).filter(Boolean);
  if (subjects.some((s) => ADULT_SUBJECT_WORDS.test(s))) return false;
  // Romance, "love stories" and heavier topics are fine only when the library also marks the book for kids or teens.
  if (subjects.some((s) => GROWN_UP_SUBJECT_WORDS.test(s)) && !subjects.some((s) => KID_SUBJECT.test(s))) return false;
  return true;
}
