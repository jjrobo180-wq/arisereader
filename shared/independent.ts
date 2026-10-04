// "Independent Reader" used to be an entry in the school list on the student
// sign-up page. Independent students now have their own sign-up, so that entry
// is no longer offered, and the students who picked it are moved to
// independent accounts (see server/independentTransfer.ts).

/**
 * Is this school-list entry really "no school"? Matches the old entry however
 * it was typed: "Independent Reader", "Independent Readers", "Independent
 * Student", "Independent Learner", or just "Independent".
 *
 * Kept narrow on purpose. A real school with the word in its name, such as
 * "Lakeside Independent School" or "Independence High", is not matched.
 */
export function isIndependentSchoolName(name: unknown): boolean {
  const words = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  if (words[0] !== "independent") return false;
  if (words.length === 1) return true;
  return /^(reader|readers|student|students|learner|learners)$/.test(words[1]);
}
