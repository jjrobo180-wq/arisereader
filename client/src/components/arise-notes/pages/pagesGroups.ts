// Groups a list of notes the way Apple Notes does: Pinned, Today, Yesterday, Previous 7 Days, Previous 30 Days,
// then a heading per month (and year, for older ones). Pure, so it's tested.
export type Dated = { id: string; pinned: boolean; updatedAt: string; createdAt: string };

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function groupLabel(iso: string, now = new Date()): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "Earlier";
  const days = Math.floor((startOfDay(now) - startOfDay(t)) / 864e5);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Previous 7 Days";
  if (days < 30) return "Previous 30 Days";
  const sameYear = t.getFullYear() === now.getFullYear();
  return t.toLocaleDateString("en-US", sameYear ? { month: "long" } : { month: "long", year: "numeric" });
}

/** Sections in the order the notes arrive (the list is already sorted); pinned notes gather at the top. */
export function groupNotes<T extends Dated>(list: T[], by: "updatedAt" | "createdAt", now = new Date()): { label: string; items: T[] }[] {
  const out: { label: string; items: T[] }[] = [];
  const add = (label: string, m: T) => { const last = out.find((s) => s.label === label); if (last) last.items.push(m); else out.push({ label, items: [m] }); };
  for (const m of list) if (m.pinned) add("Pinned", m);
  for (const m of list) if (!m.pinned) add(groupLabel(m[by], now), m);
  return out;
}
