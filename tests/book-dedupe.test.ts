import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bookKey, sameBook } from "../shared/bookIdentity";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("the same book under small differences is one book", () => {
  assert.ok(sameBook({ title: "Harry Potter and the Chamber of Secrets", author: "J.K. Rowling" }, { title: "Harry Potter and the Chamber of Secrets", author: "J. K. Rowling" }));
  assert.ok(sameBook({ title: "The House of Hades", author: "Rick Riordan" }, { title: "House of Hades", author: "Rick Riordan" }));
  assert.ok(sameBook({ title: "Esperanza Rising", author: "Pam Muñoz Ryan" }, { title: "Esperanza Rising", author: "Pam Munoz Ryan" }));
  assert.ok(sameBook({ title: "Petty  Crimes", author: "Gary Soto" }, { title: "Petty Crimes", author: "Gary Soto" }));
  assert.ok(sameBook({ title: "Shadow Shaper", author: "Daniel José Older" }, { title: "Shadowshaper", author: "Daniel Jose Older" }));
});

test("different books that share a title stay separate", () => {
  assert.ok(!sameBook({ title: "Crash", author: "Jerry Spinelli" }, { title: "Crash", author: "Lisa McMann" }));
  assert.ok(!sameBook({ title: "The Lost World", author: "Michael Crichton" }, { title: "The Lost World", author: "Arthur Conan Doyle" }));
  assert.equal(bookKey("鬼滅の刃", "Koyoharu Gotoge"), "");
});

test("a new book quiz reuses the copy already there, and points count once per book", () => {
  const storage = read("../server/storage.ts"), routes = read("../server/routes.ts");
  assert.match(storage, /const twin = await this\.findSameBook\(book\.title, book\.author\);/);
  assert.match(storage, /async getAttemptAnyCopy\(userId: number, bookId: number\)/);
  assert.equal((routes.match(/storage\.getAttemptAnyCopy\(req\.user\.id, bookId\)/g) || []).length, 2);
  assert.doesNotMatch(routes, /storage\.getAttempt\(req\.user\.id, bookId\)/);
});

test("students never get the install pop-ups", () => {
  assert.match(read("../client/src/components/InstallAppPrompt.tsx"), /user\.role === "student" \|\| !user\.role/);
  assert.match(read("../client/src/components/WelcomeGuide.tsx"), /const eligible = !!user && !student/);
});

test("a parent back from checkout lands in LifeHub, not the sign-in page", () => {
  const app = read("../client/src/App.tsx");
  assert.match(app, /user\.role === "parent" \? <OpenHubTab to="\/lifehub" storageKey="lifehub_tab" value="reader" \/>/);
  assert.match(read("../client/src/components/family-hub/Reader.tsx"), /<HubAddons which="life" returnPath="\/lifehub" \/>/);
});
