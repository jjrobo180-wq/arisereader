import test from "node:test";
import assert from "node:assert/strict";
import { shelvesByPoints } from "../shared/libraryShelves";
import { ARISE_POINTS } from "../shared/bookPoints";

test("every point value gets its own shelf, so no book is left off the Library page", () => {
  const books = ARISE_POINTS.map((p, i) => ({ id: i, pointsValue: p }));
  const { groups, order } = shelvesByPoints(books);
  assert.deepEqual(order, ARISE_POINTS.map(String));
  const shown = order.flatMap(k => groups[k]).length;
  assert.equal(shown, books.length);
});

test("a 25-point book like Clap When You Land is on a shelf", () => {
  const { groups, order } = shelvesByPoints([{ title: "Clap When You Land", pointsValue: 25 }, { title: "Other", pointsValue: "20.0" }]);
  assert.ok(order.includes("25"));
  assert.equal(groups["25"][0].title, "Clap When You Land");
  assert.deepEqual(order, ["20", "25"]);
});
