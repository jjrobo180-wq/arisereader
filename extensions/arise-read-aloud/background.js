// Coordinates the page(s), the voice player and the floating button.
let activeTab = null;      // the tab being read
let lastHighlight = null;  // { frameId, id }
let state = { state: "idle" };

async function ensurePlayer() {
  const has = (await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] })).length > 0;
  if (!has) await chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["AUDIO_PLAYBACK"], justification: "Plays the read-aloud voice" });
}
const toPlayer = (m) => chrome.runtime.sendMessage({ target: "offscreen", ...m }).catch(() => {});
const toWidget = (tabId, m) => chrome.tabs.sendMessage(tabId, { type: "widget", ...m }, { frameId: 0 }).catch(() => {});

async function setHighlight(next) {
  if (lastHighlight && (!next || next.frameId !== lastHighlight.frameId || next.id !== lastHighlight.id)) {
    chrome.tabs.sendMessage(activeTab, { type: "highlight", id: null }, { frameId: lastHighlight.frameId }).catch(() => {});
  }
  if (next && (!lastHighlight || next.frameId !== lastHighlight.frameId || next.id !== lastHighlight.id)) {
    chrome.tabs.sendMessage(activeTab, { type: "highlight", id: next.id }, { frameId: next.frameId }).catch(() => {});
  }
  lastHighlight = next;
}

// Cut a block of text into pieces short enough to start fast and sound natural.
function pieces(text, max = 260) {
  const sentences = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?:;])\s+/);
  const out = []; let cur = "";
  const flush = () => { if (cur.trim()) out.push(cur.trim()); cur = ""; };
  for (let s of sentences) {
    while (s.length > max) {
      let cut = s.lastIndexOf(", ", max); if (cut < 60) cut = s.lastIndexOf(" ", max); if (cut < 1) cut = max;
      if ((cur + " " + s.slice(0, cut)).length > max) flush();
      cur += " " + s.slice(0, cut); flush(); s = s.slice(cut).replace(/^[,\s]+/, "");
    }
    if ((cur + " " + s).length > max) flush();
    cur += " " + s;
  }
  flush();
  return out;
}

async function readTab(tabId) {
  const { voice = "hannah", rate = 1 } = await chrome.storage.local.get(["voice", "rate"]);
  activeTab = tabId;
  const frames = (await chrome.webNavigation.getAllFrames({ tabId })) || [{ frameId: 0 }];
  const answers = await Promise.all(frames.map((f) =>
    chrome.tabs.sendMessage(tabId, { type: "collect" }, { frameId: f.frameId }).then((a) => ({ frameId: f.frameId, ...a })).catch(() => null)));
  const got = answers.filter(Boolean).sort((a, b) => a.frameId - b.frameId);
  const chunks = [];
  const picked = got.find((g) => g.selection);
  if (picked) pieces(picked.selection).forEach((t) => chunks.push({ frameId: picked.frameId, id: null, text: t }));
  else for (const g of got) for (const b of g.blocks || []) pieces(b.text).forEach((t) => chunks.push({ frameId: g.frameId, id: b.id, text: t }));
  if (!chunks.length) { toWidget(tabId, { state: "empty" }); return; }
  await ensurePlayer();
  toPlayer({ cmd: "play", chunks, voice, rate });
}

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m.target === "background" && m.type === "progress") {
    if (activeTab == null) return;
    if (m.state === "done") { setHighlight(null); state = { state: "idle" }; toWidget(activeTab, { state: m.fallback ? "idle-fallback" : "idle" }); }
    else {
      if (m.chunk && m.chunk.id) setHighlight({ frameId: m.chunk.frameId, id: m.chunk.id });
      state = { state: m.state, fallback: !!m.fallback };
      toWidget(activeTab, state);
    }
    return;
  }
  if (m.target) return;
  const tabId = sender.tab && sender.tab.id;
  if (m.cmd === "read" && tabId != null) { toWidget(tabId, { state: "loading" }); readTab(tabId); }
  else if (m.cmd === "pause") toPlayer({ cmd: "pause" });
  else if (m.cmd === "resume") toPlayer({ cmd: "resume" });
  else if (m.cmd === "stop") { toPlayer({ cmd: "stop" }); setHighlight(null); }
  else if (m.cmd === "rate") { chrome.storage.local.set({ rate: m.rate }); toPlayer({ cmd: "rate", rate: m.rate }); }
  else if (m.cmd === "voice") { chrome.storage.local.set({ voice: m.voice }); toPlayer({ cmd: "voice", voice: m.voice }); }
});

// The toolbar icon opens the button on any page, not only the ones the extension already knows.
chrome.action.onClicked.addListener(async (tab) => {
  try { await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ["content.js"] }); } catch {}
  chrome.tabs.sendMessage(tab.id, { type: "widget", open: true }, { frameId: 0 }).catch(() => {});
});

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== "toggle-read") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  if (state.state === "playing") { toPlayer({ cmd: "pause" }); }
  else if (state.state === "paused") { toPlayer({ cmd: "resume" }); }
  else { activeTab = tab.id; toWidget(tab.id, { state: "loading" }); readTab(tab.id); }
});
