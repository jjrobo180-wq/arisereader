import test from "node:test";
import assert from "node:assert/strict";
import { fromDeepgram } from "../server/deepgram";

test("Deepgram's answer becomes Whisper-style lines and word timings", () => {
  const body = { results: { channels: [{ alternatives: [{ words: [{ word: "this", punctuated_word: "This", start: 0, end: 0.3 }, { word: "is", punctuated_word: "is", start: 0.3, end: 0.5 }, { word: "betterhelp", punctuated_word: "BetterHelp.", start: 0.5, end: 1.2 }, { word: "back", punctuated_word: "Back", start: 3, end: 3.4 }] }] }], utterances: [{ start: 0, end: 1.2, transcript: "This is BetterHelp." }, { start: 3, end: 3.4, transcript: "Back" }] } };
  const t = fromDeepgram(body);
  assert.equal(t.segments.length, 2);
  assert.equal(t.segments[0].text, "This is BetterHelp.");
  assert.equal(t.words[2].word, "BetterHelp.");
  const noUtt = fromDeepgram({ results: { channels: body.results.channels } });
  assert.equal(noUtt.segments.length, 2);
});
