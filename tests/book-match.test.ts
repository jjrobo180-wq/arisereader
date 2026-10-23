import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeTitle, quizRiskFlags, rankCandidates, titleSimilarity, type BookCandidate, type QuizVerification } from "../shared/bookMatch";
import { confirmPicked, lookupBook, queryVariants, type LookupDeps } from "../server/bookLookup";

const cat = (title: string, author: string, id = 1): BookCandidate => ({ title, author, source: "catalog", bookId: id });
const CATALOG = [cat("Dog Man", "Dav Pilkey", 256), cat("Dog Man Unleashed", "Dav Pilkey", 257), cat("Diary of a Wimpy Kid", "Jeff Kinney", 3),
  cat("Wonder", "R. J. Palacio", 4), cat("Charlotte's Web", "E. B. White", 5), cat("The Hunger Games", "Suzanne Collins", 6), cat("Dog Days", "Jeff Kinney", 7)];

test("typos, missing apostrophes and lowercase still find the real book", () => {
  assert.equal(normalizeTitle("  Charlotte’s   WEB! "), "charlottes web");
  for (const [typed, author, want] of [
    ["diry of a wimpy kid", "jeff kinny", "Diary of a Wimpy Kid"],
    ["the hunger gams", "suzanne colins", "The Hunger Games"],
    ["charlottes web", "eb white", "Charlotte's Web"],
  ]) {
    const r = rankCandidates(typed, author, CATALOG);
    assert.equal(r.best?.title, want, typed);
    assert.notEqual(r.status, "none", typed);
  }
  assert.ok(titleSimilarity("wonder", "Wonder") === 1);
  assert.equal(rankCandidates("Some Made Up Book", "Nobody", CATALOG).status, "none");
});

test("an exact title is exact; a series number like 'Dog Man 2' is never exact and prefers the AI's confirmed book", () => {
  assert.equal(rankCandidates("dog man", "dav pilkey", CATALOG).status, "exact");
  assert.equal(rankCandidates("Wonder", "Palacio", CATALOG).status, "exact");
  const r = rankCandidates("Dog Man 2", "Fav Pilkey", [...CATALOG, { title: "Dog Man Unleashed", author: "Dav Pilkey", source: "ai" }]);
  assert.equal(r.status, "close");
  assert.equal(r.best?.title, "Dog Man Unleashed");
  // Two real books with the same name: the student has to pick.
  const twins = rankCandidates("Wonder", "", [cat("Wonder", "R. J. Palacio"), { title: "Wonder", author: "Somebody Else", source: "openlibrary" }]);
  assert.equal(twins.status, "close");
});

test("the lookup asks our books, Open Library and the AI, and only trusts the AI when Open Library has the book", async () => {
  const asked: string[] = [];
  const fakeFetch = (async (url: string) => {
    const u = new URL(String(url));
    asked.push(u.search);
    const q = (u.searchParams.get("q") || u.searchParams.get("title") || "").toLowerCase();
    const docs = q.includes("unleashed") ? [{ key: "/works/OL2W", title: "Dog Man Unleashed", author_name: ["Dav Pilkey"], cover_i: 7900824, edition_count: 24 }]
      : q.includes("made up") ? [] : [{ key: "/works/OL1W", title: "Dog Man", author_name: ["Dav Pilkey"], cover_i: 7894142, edition_count: 34 }];
    return new Response(JSON.stringify({ docs }), { status: 200 });
  }) as unknown as typeof fetch;
  const deps: LookupDeps = { fetch: fakeFetch, catalog: async () => [], aiGuess: async () => ({ title: "Dog Man Unleashed", author: "Dav Pilkey" }) };
  const r = await lookupBook(deps, "Dog Man 2", "Fav Pilkey");
  assert.equal(r.best?.title, "Dog Man Unleashed");
  assert.equal(r.best?.source, "ai");
  assert.match(r.best?.coverUrl || "", /7900824/);
  assert.ok(asked.length >= 2);

  // An AI guess Open Library can't find is dropped.
  const liar: LookupDeps = { ...deps, aiGuess: async () => ({ title: "A Made Up Book", author: "Nobody" }) };
  const r2 = await lookupBook(liar, "Dog Man 2", "Fav Pilkey");
  assert.ok(!r2.suggestions.some((s) => s.source === "ai"));

  // While typing: no AI.
  let aiCalls = 0;
  await lookupBook({ ...deps, aiGuess: async () => { aiCalls++; return null; } }, "dog man", "", { quick: true });
  assert.equal(aiCalls, 0);

  // A picked suggestion is checked again on the server.
  assert.equal((await confirmPicked(deps, { title: "Dog Man Unleashed", author: "Dav Pilkey", source: "ai" }))?.title, "Dog Man Unleashed");
  assert.equal(await confirmPicked(deps, { title: "A Made Up Book", author: "Nobody", source: "openlibrary" }), null);
  assert.deepEqual(queryVariants("diry of a wimpy kid").slice(0, 2), ["diry of a wimpy kid", "of a wimpy kid"]);
});

test("the approval screen is warned about unmatched titles, guessed books and missing sources", () => {
  const base: QuizVerification = { typed: { title: "Dog Man 2", author: "Fav Pilkey" }, match: "picked", book: { title: "Dog Man Unleashed", author: "Dav Pilkey", source: "ai" }, sources: ["https://example.org/a"], questionsWithEvidence: 10, questionCount: 10, checkedAt: "" };
  assert.deepEqual(quizRiskFlags(base), []);
  assert.ok(quizRiskFlags({ ...base, match: "kept" }).some((f) => f.level === "high" && /kept "Dog Man 2"/.test(f.text)));
  assert.ok(quizRiskFlags({ ...base, match: "none" }).some((f) => f.level === "high"));
  assert.ok(quizRiskFlags({ ...base, sources: [] }).some((f) => /no sources/.test(f.text)));
  assert.ok(quizRiskFlags({ ...base, aiUnsure: true }).some((f) => /couldn't find details/.test(f.text)));
  assert.ok(quizRiskFlags({ ...base, questionsWithEvidence: 3 }).some((f) => f.level === "high" && /7 of 10/.test(f.text)));
  assert.equal(quizRiskFlags(null).length, 1, "old quizzes without a check are flagged too");
});

test("quiz requests go through 'Did you mean', the AI cites sources, and risky quizzes need a check to approve", () => {
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  assert.match(routes, /app\.get\("\/api\/book-lookup"/);
  assert.match(routes, /res\.status\(409\)\.json\(\{ didYouMean: true/);
  assert.match(routes, /verification,\n\s*\}\);/);
  assert.match(routes, /temperature: 0\.2/);
  assert.match(routes, /"evidence":"Chapter 3/);
  const library = readFileSync(new URL("../client/src/pages/Library.tsx", import.meta.url), "utf8");
  assert.match(library, /<BookTitleSuggest /);
  assert.match(library, /<DidYouMeanList /);
  for (const f of ["../client/src/pages/Admin.tsx", "../client/src/components/teacher-hub/HubReaderTools.tsx"]) {
    const page = readFileSync(new URL(f, import.meta.url), "utf8");
    assert.match(page, /<QuizCheckPanel /, f);
    assert.match(page, /needsBookCheck\(/, f);
  }
  assert.match(readFileSync(new URL("../migrations/pending_ai_quizzes_verification.sql", import.meta.url), "utf8"), /add column if not exists verification jsonb/);
});
