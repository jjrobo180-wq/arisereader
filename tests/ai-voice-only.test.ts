import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { voicePieces, aiVoiceOr } from "../client/src/lib/aiVoice";

function files(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (n === "node_modules" || n === "ios-app" || n === "dist") continue;
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(tsx?|html)$/.test(n)) out.push(p);
  }
  return out;
}

test("no app speaks with the phone's built-in robot voice", () => {
  const offenders = [...files("client/src"), ...files("podscroll"), ...files("client/public")].filter((f) => /SpeechSynthesisUtterance|speechSynthesis\.speak/.test(readFileSync(f, "utf8")));
  assert.deepEqual(offenders, []);
});

test("long text is said in pieces at sentence ends", () => {
  const long = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
  const parts = voicePieces(long, 300);
  assert.ok(parts.length > 1 && parts.every((p) => p.length <= 300));
  assert.ok(parts.slice(0, -1).every((p) => p.endsWith(".")));
  assert.equal(parts.join(" "), long);
  assert.deepEqual(voicePieces("One.\n\nTwo."), ["One.", "Two."]);
  assert.equal(aiVoiceOr("troy"), "troy");
  assert.equal(aiVoiceOr("robot"), "hannah");
});

test("the server tries every AI voice it has before giving up", async () => {
  const src = readFileSync("server/groqVoice.ts", "utf8");
  assert.match(src, /export async function aiSpeech/);
  assert.match(src, /deepgram/i);
  const routes = readFileSync("server/routes.ts", "utf8");
  assert.match(routes, /app\.post\("\/api\/voice\/say"/);
  assert.match(readFileSync("server/earshot.ts", "utf8"), /speak: \(text, voice\) => aiSpeech\(text, voice\)/);
});

test("Pod+ home shows the episode you were on, to finish or continue", () => {
  const home = readFileSync("podscroll/Home.tsx", "utf8");
  assert.match(home, /function ContinueListening/);
  assert.match(home, /earshot\.spots/);
  assert.match(home, /Finish this episode/);
  assert.match(home, /chip === "all" && <ContinueListening/);
});

test("opening Arise To Duo on iPhone doesn't stop other apps' audio", () => {
  const unlock = readFileSync("client/src/lib/mediaUnlock.ts", "utf8");
  assert.match(unlock, /window\.location\.protocol === "capacitor:"\) \{ startEnginesOnlyWhenPlaying\(\); return; \}/);
  assert.match(readFileSync("arisetodo/ios-app/configure-ios.py", "utf8"), /setCategory\(\.ambient, mode: \.default, options: \[\.mixWithOthers\]\)/);
});
