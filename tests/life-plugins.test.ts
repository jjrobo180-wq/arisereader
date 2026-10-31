// The eight LifeHub plugins from the Plugin Store: off until added, data kept safely, feeds read right.
import test from "node:test";
import assert from "node:assert/strict";
import { ADD_ON_SECTIONS, TOGGLEABLE, cleanFamily, emptyFamily, isCurrentFamily, isOn } from "../shared/familyHub";
import { PLUGINS, lifeInstalled, setLifePlugin } from "../shared/pluginStore";
import { VERSES, QUOTES, cleanReference, daysUntil, forDay, guessAisle, parseMostRead, parseOnThisDay, parseTrendsRss, safeUrl } from "../shared/lifePlugins";

test("the new sections start off, and adding one from the store turns it on", () => {
  const f = emptyFamily();
  // The Calorie counter (health) comes added for everyone (Oct 30, 2026); the rest start off.
  assert.equal(isOn("health", f), true, "the Calorie counter starts added");
  for (const s of ADD_ON_SECTIONS.filter((x) => x !== "health")) {
    assert.ok(TOGGLEABLE.includes(s), s);
    assert.equal(isOn(s, f), false, `${s} starts off`);
    const p = PLUGINS.find((q) => q.target.kind === "section" && q.target.section === s);
    assert.ok(p, `${s} is in the store`);
    assert.equal(lifeInstalled(p!, f), false);
    assert.equal(isOn(s, setLifePlugin(f, p!, true)), true);
  }
  assert.equal(isOn("calendar", f), true, "the built-in sections still start on");
});

test("a saved family keeps journal, countdowns, groceries, verses, meditation and quotes, cleaned", () => {
  const raw = {
    ...emptyFamily(),
    sections: { journal: true, grocery: true, bogus: true },
    journal: [{ id: "j1", date: "2026-10-10", title: "Hi", body: "A good day.", mood: "😊", createdAt: "x" }, { id: "j2", date: "nope", body: "bad date" }, { id: "j3", date: "2026-10-09", body: "  " }],
    countdowns: [{ id: "c1", title: "Trip", date: "2026-12-20", emoji: "✈️", color: "#ff0000" }, { id: "c2", title: "", date: "2026-12-20" }],
    groceries: [{ id: "g1", name: "Milk", qty: "2", aisle: "Dairy & eggs", checked: false }, { id: "g2", name: "" }],
    savedVerses: [{ id: "v1", reference: "John 3:16", text: "For God so loved the world" }],
    meditations: [{ id: "m1", date: "2026-10-10", minutes: 5, kind: "calm" }, { id: "m2", date: "2026-10-10", minutes: 99999, kind: "x" }],
    savedQuotes: ["q1", "q1", 5, "q2"],
  };
  const f = cleanFamily(raw);
  assert.deepEqual(f.sections, { journal: true, grocery: true, health: true }, "the Calorie counter is added unless removed");
  assert.deepEqual(f.journal.map((e) => e.id), ["j1"]);
  assert.deepEqual(f.countdowns.map((c) => c.id), ["c1"]);
  assert.deepEqual(f.groceries.map((g) => g.id), ["g1"]);
  assert.equal(f.savedVerses.length, 1);
  assert.equal(f.meditations[1].minutes, 600, "minutes are capped");
  assert.deepEqual(f.savedQuotes, ["q1", "q2"]);
  assert.ok(isCurrentFamily(f));
  // An older saved family without the new lists is cleaned (and so gets empty ones) before use.
  const old: any = { ...emptyFamily() };
  delete old.journal;
  assert.equal(isCurrentFamily(old), false);
  assert.deepEqual(cleanFamily(old).journal, []);
});

test("the daily picks are the same all day and the content is well-formed", () => {
  assert.equal(forDay(VERSES, "2026-10-10"), forDay(VERSES, "2026-10-10"));
  assert.ok(new Set(["2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13"].map((d) => forDay(QUOTES, d).id)).size > 1);
  assert.equal(new Set(QUOTES.map((q) => q.id)).size, QUOTES.length);
  for (const v of VERSES) assert.ok(cleanReference(v.reference), v.reference);
  assert.equal(daysUntil("2026-12-25", "2026-10-10"), 76);
  assert.equal(daysUntil("2026-10-10", "2026-10-10"), 0);
});

test("Bible references are checked before they're looked up", () => {
  for (const ok of ["John 3:16", "Psalm 23", "1 Corinthians 13:4-7", "Song of Solomon 2", "Romans 8:28-39"]) assert.ok(cleanReference(ok), ok);
  for (const bad of ["", "javascript:alert(1)", "John", "<b>John 3</b>", "x".repeat(80) + " 1"]) assert.equal(cleanReference(bad), "", bad);
});

test("grocery items find their aisle", () => {
  assert.equal(guessAisle("Bananas"), "Produce");
  assert.equal(guessAisle("2% milk"), "Dairy & eggs");
  assert.equal(guessAisle("Chicken thighs"), "Meat & fish");
  assert.equal(guessAisle("Paper towels"), "Household");
  assert.equal(guessAisle("Mystery item"), "Other");
});

test("the trending and history feeds are read safely", () => {
  const rss = `<rss><channel><item><title>World Series</title><ht:approx_traffic>500K+</ht:approx_traffic><ht:picture>https://x.test/a.jpg</ht:picture>
    <ht:news_item><ht:news_item_title><![CDATA[Game 1 recap &amp; more]]></ht:news_item_title><ht:news_item_url>https://news.test/1</ht:news_item_url><ht:news_item_source>News</ht:news_item_source></ht:news_item>
    <ht:news_item><ht:news_item_title>Bad link</ht:news_item_title><ht:news_item_url>javascript:alert(1)</ht:news_item_url></ht:news_item></item></channel></rss>`;
  const t = parseTrendsRss(rss);
  assert.equal(t[0].title, "World Series");
  assert.equal(t[0].traffic, "500K+");
  assert.deepEqual(t[0].news, [{ title: "Game 1 recap & more", url: "https://news.test/1", source: "News" }]);
  const mr = parseMostRead({ mostread: { articles: [{ titles: { normalized: "Main Page" } }, { titles: { normalized: "Moon" }, views: 1000, content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Moon" } } }] } });
  assert.deepEqual(mr.map((a) => a.title), ["Moon"]);
  const h = parseOnThisDay([{ year: 1900, text: "Old", pages: [] }, { year: 2000, text: "New", pages: [{ titles: { normalized: "X" }, content_urls: { desktop: { page: "https://w.test/X" } } }] }, { text: "" }]);
  assert.deepEqual(h.map((e) => e.year), [2000, 1900]);
  assert.equal(safeUrl("javascript:alert(1)"), "");
});

test("sticky notes live on Home: added from the store, placed anywhere, kept in bounds", () => {
  const p = PLUGINS.find((q) => q.id === "life-stickies")!;
  const f = emptyFamily();
  assert.equal(lifeInstalled(p, f), false);
  const on = setLifePlugin(f, p, true);
  assert.equal(on.widgets.stickies, true);
  assert.equal(lifeInstalled(p, on), true);
  const cleaned = cleanFamily({ ...on, stickies: [{ id: "s1", text: "Hi", color: "#fff7d6", x: 3, y: -50 }, { id: "s2", text: "", color: "bad", x: 0.25, y: 300 }] });
  assert.deepEqual(cleaned.stickies.map((s) => [s.x, s.y]), [[1, 0], [0.25, 300]], "positions stay on the board");
  assert.equal(cleaned.stickies[1].color, "#fff7d6");
  assert.equal(cleaned.widgets.stickies, true);
});

test("the link page keeps only real links, and can be shared", async () => {
  const f = cleanFamily({ ...emptyFamily(), linkPage: { title: "Maya", bio: "Hi", links: [{ id: "a", title: "Site", url: "https://maya.test" }, { id: "b", title: "Bad", url: "javascript:alert(1)" }, { id: "c", title: "Mail", url: "mailto:m@x.test" }] } });
  assert.deepEqual(f.linkPage.links.map((l) => l.id), ["a", "c"]);
  const { parseTarget, sharedView, targetLabel } = await import("../shared/todoShare");
  assert.deepEqual(parseTarget("links"), { kind: "links" });
  assert.equal(parseTarget("links:x"), null);
  const view: any = sharedView({ family: f }, { kind: "links" }, "2026-10-10");
  assert.equal(view.kind, "links");
  assert.equal(view.title, "Maya");
  assert.equal(view.links.length, 2);
  assert.equal(targetLabel({ family: f }, { kind: "links" }), "Link page");
});

test("dictionary words are checked and entries read safely", async () => {
  const { cleanWord, parseDefinition, WORDS } = await import("../shared/lifePlugins");
  assert.equal(cleanWord("Serendipity "), "serendipity");
  assert.equal(cleanWord("<script>"), "");
  assert.equal(new Set(WORDS.map((w) => w.word)).size, WORDS.length);
  const d = parseDefinition([{ word: "hello", phonetics: [{ text: "/həˈləʊ/", audio: "https://a.test/hello.mp3" }], meanings: [{ partOfSpeech: "noun", definitions: [{ definition: "A greeting.", example: "She said hello." }], synonyms: ["hi"] }] }]);
  assert.equal(d?.phonetic, "/həˈləʊ/");
  assert.equal(d?.meanings[0].definitions[0].example, "She said hello.");
  assert.equal(parseDefinition({ title: "No Definitions Found" }), null);
});

test("the 20 everyday plugins: all in the store, off until added, data cleaned", async () => {
  const ids = ["habits", "gratitude", "focus", "bucket", "recipes", "meals", "upkeep", "plants", "birthdays", "gifts", "pets", "contacts", "subscriptions", "jars", "tips", "reading", "watchlist", "weather", "convert", "car"];
  const f = emptyFamily();
  for (const id of ids) {
    assert.ok(ADD_ON_SECTIONS.includes(id as any), id);
    assert.ok(PLUGINS.some((p) => p.target.kind === "section" && p.target.section === id), `${id} in the store`);
    assert.equal(isOn(id as any, f), false);
  }
  const c = cleanFamily({ ...f,
    habits: [{ id: "h", name: "Walk", days: ["2026-10-10", "2026-10-10", "bad"] }],
    care: [{ id: "c", kind: "pets", group: "Biscuit", name: "Vet", everyDays: 99999, lastDone: "2026-01-01" }],
    birthdays: [{ id: "b", name: "Mom", month: 2, day: 29, year: 1970 }, { id: "x", name: "Bad", month: 13, day: 1 }],
    collections: [{ id: "r", kind: "reading", title: "Dune", url: "javascript:x", rating: 9 }],
    weather: { place: "Denver, CO", unit: "K" },
  });
  assert.deepEqual(c.habits[0].days, ["2026-10-10"]);
  assert.equal(c.care[0].everyDays, 3650);
  assert.deepEqual(c.birthdays.map((b) => b.id), ["b"]);
  assert.equal(c.collections[0].url, "");
  assert.equal(c.collections[0].rating, 5);
  assert.deepEqual(c.weather, { place: "Denver, CO", unit: "F" });
});

test("everyday helpers: streaks, yearly dates, care due, renewals, units, ingredients", async () => {
  const m = await import("../shared/lifePlugins");
  assert.equal(m.streak(["2026-10-08", "2026-10-09", "2026-10-10"], "2026-10-10"), 3);
  assert.equal(m.streak(["2026-10-08", "2026-10-09"], "2026-10-10"), 2, "today not checked yet keeps the streak");
  assert.equal(m.streak(["2026-10-07"], "2026-10-10"), 0);
  assert.deepEqual(m.nextYearly(10, 10, 1990, "2026-10-10"), { date: "2026-10-10", days: 0, turns: 36 });
  assert.equal(m.nextYearly(2, 29, 0, "2026-10-10").date, "2027-02-28", "Feb 29 in a non-leap year");
  assert.equal(m.nextYearly(1, 5, 0, "2026-10-10").turns, null);
  assert.deepEqual(m.careDue({ everyDays: 30, lastDone: "2026-10-01" }, "2026-10-10"), { due: "2026-10-31", days: 21 });
  assert.equal(m.careDue({ everyDays: 30, lastDone: "" }, "2026-10-10").days, 0);
  assert.equal(m.nextRenewal({ nextDate: "2026-01-31", cycle: "monthly" }, "2026-10-10"), "2026-10-28");
  assert.equal(m.nextRenewal({ nextDate: "2025-03-01", cycle: "yearly" }, "2026-10-10"), "2027-03-01");
  assert.equal(Math.round(m.monthlyCost({ amount: 120, cycle: "yearly" })), 10);
  assert.equal(Math.round(m.convertUnit("Temperature", 212, "Fahrenheit", "Celsius")), 100);
  assert.equal(Math.round(m.convertUnit("Cooking", 1, "Cups", "Tablespoons")), 16);
  assert.equal(Math.round(m.convertUnit("Length", 1, "Miles", "Kilometers") * 1000) / 1000, 1.609);
  assert.deepEqual(m.ingredientToGrocery("2 cups flour"), { qty: "2 cups", name: "flour" });
  assert.deepEqual(m.ingredientToGrocery("salt"), { qty: "", name: "salt" });
  assert.equal(m.weatherCode(0).text, "Clear");
  assert.equal(m.cleanPlace("Denver, CO"), "Denver, CO");
  assert.equal(m.cleanPlace("<x>"), "");
  const fc = m.parseForecast({ current: { temperature_2m: 61.4, apparent_temperature: 59, weather_code: 2, wind_speed_10m: 7, relative_humidity_2m: 30 }, daily: { time: ["2026-10-10"], weather_code: [1], temperature_2m_max: [70], temperature_2m_min: [44], precipitation_probability_max: [10] } }, "Denver", "F");
  assert.equal(fc?.current.temp, 61);
  assert.equal(fc?.days[0].high, 70);
});

test("the third batch of 20: in the store, off until added, data cleaned", async () => {
  const ids = ["wishlist", "restaurants", "learning", "projects", "loans", "cleaning", "checkups", "sleep", "workouts", "routines", "milestones", "ious", "allowance", "giftcards", "warranties", "mileage", "mortgage", "clocks", "timers", "medical"];
  const f = emptyFamily();
  for (const id of ids) {
    assert.ok(ADD_ON_SECTIONS.includes(id as any), id);
    assert.ok(PLUGINS.some((p) => p.target.kind === "section" && p.target.section === id), `${id} in the store`);
    assert.equal(isOn(id as any, f), false);
  }
  const c = cleanFamily({ ...f,
    sleep: [{ id: "s", date: "2026-10-10", bed: "23:00", wake: "07:00", quality: 9 }, { id: "t", date: "2026-10-09", bed: "late", wake: "07:00" }],
    routines: [{ id: "r", name: "Morning", steps: [{ id: "a", text: "Brush teeth" }, { id: "b", text: "" }], doneDate: "2026-10-10", doneSteps: ["a", 5] }],
    clocks: ["America/New_York", "javascript:x", "America/New_York", "Europe/London"],
    collections: [{ id: "w", kind: "wishlist", title: "Bike", price: 300 }],
    care: [{ id: "k", kind: "checkups", group: "Maya", name: "Dentist", everyDays: 182 }],
    mileageRate: 99,
  });
  assert.deepEqual(c.sleep.map((s) => [s.id, s.quality]), [["s", 5]]);
  assert.deepEqual(c.routines[0].steps.map((s) => s.id), ["a"]);
  assert.deepEqual(c.routines[0].doneSteps, ["a"]);
  assert.deepEqual(c.clocks, ["America/New_York", "Europe/London"]);
  assert.equal(c.collections[0].kind, "wishlist");
  assert.equal(c.care[0].kind, "checkups");
  assert.equal(c.mileageRate, 10);
  const m = await import("../shared/lifePlugins");
  assert.equal(m.sleepHours("23:15", "06:45"), 7.5);
  assert.equal(m.sleepHours("01:00", "09:00"), 8);
  const loan = m.loanPayment(30000, 7, 5);
  assert.equal(Math.round(loan.monthly), 594);
  assert.equal(Math.round(m.loanPayment(1200, 0, 1).monthly), 100);
});
