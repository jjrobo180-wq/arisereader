import test from "node:test";
import assert from "node:assert/strict";
import { POEMS, POEM_BANDS, poemBySlug, poemLineCount, poemMinutes } from "../shared/poems";

test("every poem is complete and safe to publish", () => {
  assert.ok(POEMS.length >= 30);
  assert.equal(new Set(POEMS.map((p) => p.slug)).size, POEMS.length, "slugs are unique");
  assert.equal(new Set(POEMS.map((p) => p.title)).size, POEMS.length, "titles are unique");
  for (const p of POEMS) {
    assert.match(p.slug, /^[a-z0-9-]+$/, p.title);
    // published before 1929, so in the public domain in the United States
    assert.ok(p.year >= 1500 && p.year < 1929, `${p.title} (${p.year}) must be first published before 1929`);
    assert.ok(POEM_BANDS.some((b) => b.band === p.band), p.title);
    assert.ok(p.poet.length > 3 && p.hook.length > 10 && p.about.length > 40 && p.notice.length > 40, p.title + " needs its notes");
    assert.ok(p.think.length >= 2, p.title + " needs two questions");
    assert.ok(p.stanzas.length >= 1 && poemLineCount(p) >= 4, p.title + " has its text");
    for (const stanza of p.stanzas) {
      assert.ok(stanza.length >= 1, p.title);
      for (const line of stanza) {
        assert.ok(line.trim().length > 0, p.title + " has an empty line inside a stanza");
        assert.equal(line, line.trimEnd(), p.title + " has trailing spaces");
        assert.ok(!/[<>{}]/.test(line), p.title + " has markup in its text");
      }
    }
    // every word in the glossary really appears in the poem (or its title)
    const text = (p.title + " " + p.stanzas.flat().join(" ")).toLowerCase();
    for (const w of p.words) {
      const forms = w.word.toLowerCase().split(" / ");
      assert.ok(forms.some((f) => text.includes(f)), `${p.title}: glossary word "${w.word}" is not in the poem`);
      assert.ok(w.meaning.length > 2);
    }
    assert.equal(poemBySlug(p.slug), p);
    assert.ok(poemMinutes(p) >= 1);
  }
  assert.equal(poemBySlug("not-a-poem"), null);
});

test("each grade band has a good handful of poems", () => {
  for (const b of POEM_BANDS) assert.ok(POEMS.filter((p) => p.band === b.band).length >= 8, b.label);
});

test("a few well-known lines are exactly right", () => {
  const line = (slug: string, n: number) => poemBySlug(slug)!.stanzas.flat()[n - 1].trim();
  assert.equal(line("the-road-not-taken", 19), "I took the one less traveled by,");
  assert.equal(line("stopping-by-woods-on-a-snowy-evening", 8), "The darkest evening of the year.");
  assert.equal(line("nothing-gold-can-stay", 7), "So dawn goes down to day.");
  assert.equal(line("invictus", 15), "I am the master of my fate:");
  assert.equal(line("ozymandias", 5), "And wrinkled lip, and sneer of cold command,");
  assert.equal(line("jabberwocky", 8), "The frumious Bandersnatch!\"");
  assert.equal(line("if", 30), "With sixty seconds' worth of distance run,");
  assert.equal(line("sea-fever", 10), "To the gull's way and the whale's way where the wind's like a whetted knife;");
  assert.equal(line("im-nobody", 8), "To an admiring bog!");
  assert.equal(line("dreams", 3), "Life is a broken-winged bird");
});
