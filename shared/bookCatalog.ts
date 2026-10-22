// The teacher book catalog (client/src/components/teacher-hub/BookCatalog.tsx, GET /api/teacher/book-catalog).

export type CatalogBook = { id: number; title: string; author: string; coverUrl: string | null; points: number; band: string; alsoBands: string[]; readOnArise: boolean };


/** Books matching the search (title or author), grade band (its own or an overlap) and points. */
export function filterCatalog(books: CatalogBook[], q: string, band: string, points: string): CatalogBook[] {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return books.filter((b) => {
    if (band !== "all" && b.band !== band && !b.alsoBands.includes(band)) return false;
    if (points !== "all" && String(b.points) !== points) return false;
    if (!words.length) return true;
    const hay = `${b.title} ${b.author}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
