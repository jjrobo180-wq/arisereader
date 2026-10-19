// The Library's "by points" shelves: one shelf per point value, smallest first.
// Every value gets a shelf, so no book is left off the page (15- and 25-point books once were).
export function shelvesByPoints<T extends { pointsValue?: number | string | null }>(books: readonly T[]) {
  const groups: Record<string, T[]> = {};
  for (const b of books) { const key = String(Number(b.pointsValue) || 10); (groups[key] ||= []).push(b); }
  const order = Object.keys(groups).sort((a, b) => Number(a) - Number(b));
  return { groups, order };
}
