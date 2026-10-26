// Explore previews (server/podcastDirectory.ts moment + cutRange): a 3-minute window from a third of
// the way in is transcribed once, the AI's pick is checked against it and kept for everyone, the
// right bytes are asked for, and without a usable pick it's 45 seconds from that point.
import test from "node:test";
import assert from "node:assert/strict";
import { createDirectory, memoryKV } from "../server/podcastDirectory";

const show = (id: number) => ({ kind: "podcast", collectionId: id, collectionName: "Show " + id, artistName: "H", primaryGenreName: "History", genres: ["History"], artworkUrl600: "https://a/600x600bb.jpg", feedUrl: "https://feed/" + id, releaseDate: new Date().toISOString() });
const ep = (id: number, sid: number) => ({ wrapperType: "podcastEpisode", kind: "podcast-episode", trackId: id, collectionId: sid, collectionName: "Show " + sid, trackName: "E" + id, episodeUrl: "https://cdn/e" + id + ".mp3", releaseDate: "2026-10-01T00:00:00Z", trackTimeMillis: 1_200_000 });
const fetcher: any = async (url: string) => { const id = Number(new URL(url).searchParams.get("id")); return { results: [show(id), ep(id * 10 + 1, id)] }; }; fetcher.idle = () => true;
const head = (() => { const out = new Uint8Array(16384); for (let o = 0; o + 417 <= out.length; o += 417) out.set([0xff, 0xfb, 0x90, 0x00], o); return out; })();
const TOTAL = 417 * 46000; // ~1199.7 s of 128 kbps

function setup(o: { ask?: any; mp3?: boolean } = {}) {
  const ranges: string[] = []; let transcribed = 0;
  const web: any = async (url: string, init: any) => {
    if (url.startsWith("https://feed/")) return new Response("<rss></rss>");
    const r = String(init?.headers?.Range || "");
    if (r === "bytes=0-16383") return new Response(o.mp3 === false ? new Uint8Array(16384) : head, { status: 206, headers: { "content-range": `bytes 0-16383/${TOTAL}`, "content-type": "audio/mpeg" } });
    ranges.push(r);
    return new Response(new Uint8Array(2000), { status: 206, headers: { "content-type": "audio/mpeg" } });
  };
  const transcribe = async () => { transcribed++; return { segments: Array.from({ length: 18 }, (_, i) => ({ start: i * 10, end: i * 10 + 10, text: `Sentence ${i}, and then the story turned.` })) }; };
  const ask = o.ask ?? (async () => JSON.stringify({ start: 3, end: 7, hook: "The night it turned", quote: "Sentence 4, and then the story turned." }));
  const dir = createDirectory({ fetcher, kv: memoryKV(), web, ask, transcribe, aiOn: () => true });
  return { dir, ranges, count: () => transcribed };
}

test("the AI's best moment, from a third of the way in, read once and kept", async () => {
  const t = setup();
  const m = await t.dir.moment("1", "11");
  const w0 = Math.round((TOTAL * 8 / 128000) * 0.33);
  assert.deepEqual(m, { s: w0 + 30, e: w0 + 80, quote: "Sentence 4, and then the story turned.", hook: "The night it turned", best: true });
  assert.deepEqual(t.ranges, [`bytes=${w0 * 16000}-${(w0 + 180) * 16000 - 1}`], "only the 3-minute window is downloaded");
  await t.dir.moment("1", "11");
  assert.equal(t.count(), 1, "kept: not transcribed again");
  const kept = await t.dir.keepMomentAudio("11", m, "https://storage/moments/11.mp3");
  assert.equal(kept.audio, "https://storage/moments/11.mp3");
  assert.equal((await t.dir.moment("1", "11")).audio, "https://storage/moments/11.mp3");
  const clip = await t.dir.cutRange("1", "11", m.s, m.e);
  assert.equal(clip.type, "audio/mpeg");
  assert.equal(t.ranges.at(-1), `bytes=${m.s * 16000}-${m.e * 16000 - 1}`, "the clip is exactly that stretch");
});

test("no usable pick: 45 seconds from that point, with a line from the transcript", async () => {
  const t = setup({ ask: async () => { throw new Error("busy"); } });
  const m = await t.dir.moment("2", "21");
  const w0 = Math.round((TOTAL * 8 / 128000) * 0.33);
  assert.deepEqual([m.s, m.e, m.best], [w0 + 15, w0 + 60, false]);
  assert.equal(m.quote, "Sentence 2, and then the story turned.");
});

test("not an MP3: no preview (the route says so) rather than a broken clip", async () => {
  const t = setup({ mp3: false });
  await assert.rejects(t.dir.moment("3", "31"), (e: any) => e.soft === true);
});
