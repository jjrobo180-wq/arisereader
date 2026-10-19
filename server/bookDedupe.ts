// One-time clean-up (Oct 19, 2026): the shelf had several copies of the same book quiz (two of every
// Harry Potter, four of The Outsiders…), and a student could earn a book's points once per copy.
// This merges every set of copies into one (shared/bookIdentity.ts decides "same book"), keeping the
// copy students already used, or the one with questions. A student who took two copies keeps their
// first attempt; the later one is removed and its points taken back off their total.
//
// It runs once, on the first server start after it ships, and never again (the settings key). Everything
// it removes is saved first, as JSON, in settings under BACKUP_KEY, so it can be put back by hand.
import { supabase } from "./supabase";
import { planMerge } from "../shared/bookIdentity";
export { planMerge };

const DONE_KEY = "book_dedupe_20261019_done";
const BACKUP_KEY = "book_dedupe_20261019_backup";

type Row = Record<string, any>;

async function all(table: string, columns: string, filter?: (q: any) => any): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select(columns).order("id").range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < 1000) return out;
  }
}

/** Moves rows that point at a duplicate onto the kept copy. Rows that would clash with one already there are dropped. */
async function repoint(table: string, column: string, merge: Map<number, number>, uniqueWith?: string, extra?: (q: any) => any) {
  for (const [dup, keep] of merge) {
    try {
      if (uniqueWith) {
        let mine = supabase.from(table).select(uniqueWith).eq(column, dup); if (extra) mine = extra(mine);
        const { data: rows } = await mine;
        for (const r of rows || []) {
          let there = supabase.from(table).select(uniqueWith).eq(column, keep).eq(uniqueWith, (r as any)[uniqueWith]).limit(1); if (extra) there = extra(there);
          const { data: clash } = await there;
          if (clash?.length) { let del = supabase.from(table).delete().eq(column, dup).eq(uniqueWith, (r as any)[uniqueWith]); if (extra) del = extra(del); await del; }
        }
      }
      let up = supabase.from(table).update({ [column]: keep }).eq(column, dup); if (extra) up = extra(up);
      const { error } = await up;
      if (error && !/does not exist|PGRST205|42P01/.test(error.message)) console.warn(`[book-dedupe] ${table}: ${error.message}`);
    } catch (e: any) { console.warn(`[book-dedupe] ${table}: ${e?.message || e}`); }
  }
}

export async function dedupeBooksOnce(settings: { get: (k: string) => Promise<string>; set: (k: string, v: string) => Promise<void> }): Promise<void> {
  if (await settings.get(DONE_KEY).catch(() => "")) return;
  const books = await all("books", "id, title, author") as { id: number; title: string; author: string }[];
  const attempts = await all("attempts", "id, user_id, book_id, completed_at, points_earned", (q) => q.gt("book_id", 0));
  const qs = await all("questions", "id, book_id");
  const attemptCount = new Map<number, number>(), questionCount = new Map<number, number>();
  for (const a of attempts) attemptCount.set(a.book_id, (attemptCount.get(a.book_id) || 0) + 1);
  for (const q of qs) questionCount.set(q.book_id, (questionCount.get(q.book_id) || 0) + 1);
  const merge = planMerge(books, attemptCount, questionCount);
  if (!merge.size) { await settings.set(DONE_KEY, new Date().toISOString()); return; }

  // A student with attempts on two copies of one book keeps the first; the rest are doubles.
  const firsts = new Map<string, Row>(); const doubles: Row[] = [];
  for (const a of [...attempts].sort((x, y) => String(x.completed_at).localeCompare(String(y.completed_at)) || x.id - y.id)) {
    const k = `${a.user_id}:${merge.get(a.book_id) ?? a.book_id}`;
    if (firsts.has(k)) doubles.push(a); else firsts.set(k, a);
  }

  // Back up everything that will be removed, before removing anything.
  const dupIds = [...merge.keys()];
  const { data: dupBooks } = await supabase.from("books").select("*").in("id", dupIds);
  const { data: dupQuestions } = await supabase.from("questions").select("*").in("book_id", dupIds);
  const { data: dupAttempts } = doubles.length ? await supabase.from("attempts").select("*").in("id", doubles.map((d) => d.id)) : { data: [] };
  await settings.set(BACKUP_KEY, JSON.stringify({ at: new Date().toISOString(), merge: Object.fromEntries(merge), books: dupBooks || [], questions: dupQuestions || [], attempts: dupAttempts || [] }));

  // Doubles: points back off, then the attempt goes.
  const back = new Map<number, number>();
  for (const d of doubles) back.set(d.user_id, (back.get(d.user_id) || 0) + Number(d.points_earned || 0));
  for (const [userId, pts] of back) {
    if (!(pts > 0)) continue;
    const { data: u } = await supabase.from("users").select("total_points").eq("id", userId).maybeSingle();
    await supabase.from("users").update({ total_points: Math.round((Number(u?.total_points || 0) - pts) * 10) / 10 }).eq("id", userId);
  }
  if (doubles.length) {
    const ids = doubles.map((d) => d.id);
    await supabase.from("quiz_integrity_sessions").update({ attempt_id: null }).in("attempt_id", ids);
    await supabase.from("comprehension_responses").update({ attempt_id: null }).in("attempt_id", ids);
    await supabase.from("quiz_review_requests").delete().in("attempt_id", ids);
    const { error } = await supabase.from("attempts").delete().in("id", ids);
    if (error) throw new Error(`attempts: ${error.message}`);
  }

  // Everything else that pointed at a copy now points at the one that stays.
  await repoint("attempts", "book_id", merge, "user_id");
  await repoint("comprehension_responses", "book_id", merge, "student_id");
  await repoint("quiz_review_requests", "book_id", merge);
  await repoint("quiz_reviews", "book_id", merge);
  await repoint("quiz_integrity_sessions", "quiz_id", merge, undefined, (q) => q.eq("quiz_kind", "book"));
  await repoint("quiz_proctor_sessions", "quiz_id", merge, undefined, (q) => q.eq("quiz_kind", "book"));
  await repoint("book_feed_events", "book_id", merge);
  await repoint("book_feed_shares", "book_id", merge);
  await repoint("book_feed_reactions", "book_id", merge, "user_id");
  await repoint("book_feed_saves", "book_id", merge, "user_id");
  for (const [dup, keep] of merge) {
    const { data: has } = await supabase.from("book_feed_cards").select("book_id").eq("book_id", keep).limit(1);
    if (has?.length) await supabase.from("book_feed_cards").delete().eq("book_id", dup);
    else await supabase.from("book_feed_cards").update({ book_id: keep }).eq("book_id", dup);
  }

  // Then the copies themselves.
  const { error: qErr } = await supabase.from("questions").delete().in("book_id", dupIds);
  if (qErr) throw new Error(`questions: ${qErr.message}`);
  const { error: bErr } = await supabase.from("books").delete().in("id", dupIds);
  if (bErr) throw new Error(`books: ${bErr.message}`);

  // Small tidy-ups on the copies that stay.
  await supabase.from("books").update({ author: "Dav Pilkey" }).eq("author", "Fav Pilkey");
  for (const b of books) if (!merge.has(b.id) && /\s{2,}/.test(b.title)) await supabase.from("books").update({ title: b.title.replace(/\s{2,}/g, " ") }).eq("id", b.id);
  for (const b of books) if (!merge.has(b.id) && b.title === "Where The Side Walk Ends") await supabase.from("books").update({ title: "Where the Sidewalk Ends" }).eq("id", b.id);

  await settings.set(DONE_KEY, new Date().toISOString());
  console.log(`[book-dedupe] merged ${merge.size} duplicate book copies; removed ${doubles.length} double attempts`);
}
