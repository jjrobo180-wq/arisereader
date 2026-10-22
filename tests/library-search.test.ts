// Library search: matches show right under the search bar (before the 5-Minute Reads shelf),
// and quick reads that match are listed with them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lib = readFileSync(new URL("../client/src/pages/Library.tsx", import.meta.url), "utf8");

test("search results come before the shelves", () => {
  const results = lib.indexOf('data-testid="library-search-results"');
  const shelf = lib.indexOf("<QuickReadsShelf");
  const search = lib.indexOf('placeholder="Search books by title or author..."');
  assert.ok(search > 0 && results > search && results < shelf, "results sit between the search bar and the shelf");
  assert.match(lib, /\) : searching \? \(/, "while searching, the shelves are replaced by the results");
});

test("quick reads matching a search are listed with the results", () => {
  const shelf = readFileSync(new URL("../client/src/components/QuickReadsShelf.tsx", import.meta.url), "utf8");
  assert.match(shelf, /export function matchQuickReads/);
  assert.match(lib, /matchQuickReads\(searchText\)/);
});
