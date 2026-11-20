// How the AI refers to a student. A student's pronouns are set in their profile (Student.pronouns).
// With none set, the AI must never guess a gender from a name: it writes the student's name instead.
// Every AI feature that writes about a student puts this line in its prompt.

export function pronounRule(p: string | undefined, firstName = "the student"): string {
  if (p === "he") return `Pronouns for ${firstName}: he/him/his. Use only these.`;
  if (p === "she") return `Pronouns for ${firstName}: she/her/hers. Use only these.`;
  if (p === "they") return `Pronouns for ${firstName}: they/them/their. Use only these.`;
  return `Pronouns for ${firstName}: NOT GIVEN. Never use he, him, his, she, her or hers for ${firstName}, and never guess from the name: write "${firstName}" every time, or rephrase.`;
}
