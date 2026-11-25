// Parent emails from the admin (server/parentMessages.ts): who can get one, filling in each parent's name and
// children, and turning the plain-text message into a simple, readable email.

export type ParentRecipient = { id: number; name: string; email: string; schoolIds: number[]; kids: string[] };
export type ParentDraft = { subject: string; body: string };

export function cleanDraft(raw: unknown): ParentDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const subject = String((raw as any).subject ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
  const body = String((raw as any).body ?? "").replace(/\r\n/g, "\n").trim().slice(0, 8000);
  return subject && body ? { subject, body } : null;
}

const first = (name: string) => String(name || "").trim().split(/\s+/)[0] || "";
/** "Maya", "Maya and Leo", "Maya, Leo and Ava"; "your child" when none are linked. */
export function childWords(kids: string[]): string {
  const k = kids.map(first).filter(Boolean);
  if (!k.length) return "your child";
  return k.length === 1 ? k[0] : `${k.slice(0, -1).join(", ")} and ${k[k.length - 1]}`;
}

/** {first_name} and {child_names} filled in for one parent ("there" when there's no name). */
export function fillParentEmail(d: ParentDraft, p: Pick<ParentRecipient, "name" | "kids">): ParentDraft {
  const fill = (s: string) => s.replace(/\{first_name\}/g, first(p.name) || "there").replace(/\{child_names\}/g, childWords(p.kids));
  return { subject: fill(d.subject), body: fill(d.body) };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Plain text to a plain, readable email: paragraphs, links that work, and a short footer. */
export function renderParentEmail(body: string): string {
  const paras = body.split(/\n{2,}/).map((p) => esc(p.trim()).replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#6d28d9">$1</a>')).filter(Boolean);
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#1f2937;max-width:560px">
${paras.map((p) => `<p style="margin:0 0 14px">${p}</p>`).join("\n")}
<p style="margin:24px 0 0;font-size:12px;color:#6b7280">You're getting this because you have an Arise Reader parent account.</p>
</div>`;
}

/** Which parents a choice means: everyone, the parents at a school (their own school or a child's), or picked ones. */
export function audienceOf(all: ParentRecipient[], pick: { kind: "all" } | { kind: "school"; schoolId: number } | { kind: "some"; ids: number[] }): ParentRecipient[] {
  if (pick.kind === "all") return all;
  if (pick.kind === "school") return all.filter((p) => p.schoolIds.includes(pick.schoolId));
  const ids = new Set(pick.ids);
  return all.filter((p) => ids.has(p.id));
}
