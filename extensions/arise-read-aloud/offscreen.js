// Plays the voice. It lives in its own page so a website's security rules can never block the audio.
const VOICE_URL = "https://arisetodo.com/api/voice/say";
const audioCache = new Map(); // "voice|text" -> Promise<Blob>
let run = 0;            // changes on every new read or stop, so older work quietly stops
let chunks = [], index = 0, voice = "hannah", rate = 1;
let audio = null, paused = false;

const send = (m) => chrome.runtime.sendMessage({ target: "background", ...m }).catch(() => {});

function fetchVoice(text) {
  const key = voice + "|" + text;
  if (!audioCache.has(key)) {
    const p = (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await fetch(VOICE_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }) });
        if (r.status === 429 && attempt === 0) { await new Promise((ok) => setTimeout(ok, Math.min(8000, (Number(r.headers.get("Retry-After")) || 3) * 1000))); continue; }
        if (!r.ok) throw new Error("voice " + r.status);
        return await r.blob();
      }
      throw new Error("voice busy");
    })();
    p.catch(() => audioCache.delete(key));
    audioCache.set(key, p);
    if (audioCache.size > 60) audioCache.delete(audioCache.keys().next().value);
  }
  return audioCache.get(key);
}

function stop() {
  run++; paused = false;
  if (audio) { audio.pause(); audio.src = ""; audio = null; }
  speechSynthesis.cancel();
}

function speakWithBrowserVoice(text, myRun) {
  return new Promise((done) => {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    u.onend = u.onerror = () => done();
    speechSynthesis.speak(u);
  });
}

async function play(list, v, r) {
  stop();
  const myRun = run;
  chunks = list; index = 0; voice = v || voice; rate = r || rate;
  let usedFallback = false;
  for (index = 0; index < chunks.length; index++) {
    if (myRun !== run) return;
    const c = chunks[index];
    send({ type: "progress", state: "loading", index, chunk: c });
    let blob = null;
    try { blob = await fetchVoice(c.text); } catch { blob = null; }
    if (myRun !== run) return;
    while (paused && myRun === run) await new Promise((ok) => setTimeout(ok, 150));
    if (myRun !== run) return;
    if (chunks[index + 1]) fetchVoice(chunks[index + 1].text).catch(() => {}); // get the next one ready while this one plays
    send({ type: "progress", state: "playing", index, chunk: c, fallback: !blob });
    if (blob) {
      await new Promise((done) => {
        const a = new Audio(URL.createObjectURL(blob));
        audio = a; a.playbackRate = rate; a.preservesPitch = true;
        a.onended = a.onerror = () => { URL.revokeObjectURL(a.src); done(); };
        a.play().catch(() => done());
      });
    } else {
      usedFallback = true;
      await speakWithBrowserVoice(c.text, myRun);
    }
    while (paused && myRun === run) await new Promise((ok) => setTimeout(ok, 150));
  }
  if (myRun === run) send({ type: "progress", state: "done", fallback: usedFallback });
}

chrome.runtime.onMessage.addListener((m) => {
  if (m.target !== "offscreen") return;
  if (m.cmd === "play") play(m.chunks, m.voice, m.rate);
  else if (m.cmd === "stop") { stop(); send({ type: "progress", state: "done" }); }
  else if (m.cmd === "pause") { paused = true; if (audio) audio.pause(); speechSynthesis.pause(); send({ type: "progress", state: "paused", index, chunk: chunks[index] }); }
  else if (m.cmd === "resume") { paused = false; if (audio) audio.play(); speechSynthesis.resume(); send({ type: "progress", state: "playing", index, chunk: chunks[index] }); }
  else if (m.cmd === "rate") { rate = m.rate; if (audio) audio.playbackRate = rate; }
  else if (m.cmd === "voice") { voice = m.voice; }
});
