// Runs in every frame of the page: finds the words on screen and highlights the part being read.
// In the top frame it also draws the floating button.
(() => {
  if (window.__ariseReadAloud) return;
  window.__ariseReadAloud = true;
  const isTop = window.top === window;
  let nextId = 1;

  // ---- What is on the screen right now ----
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "CANVAS", "TEMPLATE", "IFRAME", "HEAD"]);
  const isInline = (el) => { const d = getComputedStyle(el).display; return d === "inline" || d === "contents" || d === "ruby"; };
  const blockOf = (node) => { let el = node.parentElement; while (el && el !== document.body && isInline(el)) el = el.parentElement; return el; };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return null;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0" || e.hidden || e.getAttribute("aria-hidden") === "true") return null;
    }
    return r;
  };

  function collect() {
    const sel = String(getSelection() || "").replace(/\s+/g, " ").trim();
    if (sel) return { selection: sel, blocks: [] };
    const groups = new Map();
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) => n.nodeType === 1
        ? (SKIP.has(n.tagName.toUpperCase()) || n.id === "arise-read-aloud-root" ? NodeFilter.FILTER_REJECT : (n.tagName === "IMG" ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP))
        : (n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      let el, text;
      if (n.nodeType === 1) { const alt = (n.getAttribute("alt") || "").trim(); if (!alt) continue; el = n; text = "Picture: " + alt; }
      else { el = blockOf(n); text = n.nodeValue; }
      if (!el) continue;
      const g = groups.get(el) || []; g.push(text); groups.set(el, g);
    }
    const blocks = [];
    for (const [el, parts] of groups) {
      const r = visible(el); if (!r) continue;
      const text = parts.join("").replace(/\s+/g, " ").trim();
      if (text.length < 2) continue;
      blocks.push({ el, r, text });
    }
    // reading order: top to bottom in rows, then left to right
    blocks.sort((a, b) => (Math.round(a.r.top / 12) - Math.round(b.r.top / 12)) || a.r.left - b.r.left);
    document.querySelectorAll("[data-arise-ra]").forEach((e) => e.removeAttribute("data-arise-ra"));
    const out = []; let last = "";
    for (const b of blocks.slice(0, 80)) {
      if (b.text === last) continue; last = b.text;
      const id = "ra" + nextId++; b.el.setAttribute("data-arise-ra", id);
      out.push({ id, text: b.text });
    }
    return { selection: "", blocks: out };
  }

  // ---- Highlight the block being read ----
  const style = document.createElement("style");
  style.textContent = '[data-arise-ra-on]{outline:3px solid #ffb800!important;outline-offset:3px;background:rgba(255,214,0,.28)!important;border-radius:4px}';
  (document.head || document.documentElement).appendChild(style);
  function highlight(id) {
    document.querySelectorAll("[data-arise-ra-on]").forEach((e) => e.removeAttribute("data-arise-ra-on"));
    if (!id) return;
    const el = document.querySelector('[data-arise-ra="' + id + '"]');
    if (el) el.setAttribute("data-arise-ra-on", "1");
  }

  // ---- The floating button (top frame only) ----
  let ui = null;
  function buildUi() {
    const host = document.createElement("div");
    host.id = "arise-read-aloud-root";
    host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483647";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
<style>
  *{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  .fab{width:60px;height:60px;border-radius:50%;border:0;background:#5b45d8;color:#fff;font-size:28px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35)}
  .fab:focus-visible,button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid #ffb800;outline-offset:2px}
  .panel{display:none;width:270px;background:#fff;color:#1b1b24;border-radius:16px;padding:14px;box-shadow:0 8px 30px rgba(0,0,0,.35);margin-bottom:10px}
  .wrap{display:flex;flex-direction:column;align-items:flex-end}
  .open .panel{display:block}
  h2{font-size:15px;margin:0 0 10px;display:flex;justify-content:space-between;align-items:center}
  .x{border:0;background:none;font-size:20px;cursor:pointer;color:#555}
  .go{width:100%;padding:14px;font-size:18px;font-weight:700;border:0;border-radius:12px;background:#16a34a;color:#fff;cursor:pointer}
  .row{display:flex;gap:8px;margin-top:8px}
  .row button{flex:1;padding:11px;font-size:15px;font-weight:600;border:2px solid #d4d4dc;border-radius:10px;background:#f6f6fa;cursor:pointer}
  label{display:block;font-size:12px;color:#555;margin-top:12px}
  select,input[type=range]{width:100%;margin-top:4px}
  select{padding:8px;font-size:14px;border-radius:8px}
  .msg{font-size:12px;color:#555;margin-top:10px;min-height:16px}
  .hide{display:none}
</style>
<div class="wrap">
  <div class="panel" role="dialog" aria-label="Read aloud">
    <h2>Read aloud <button class="x" aria-label="Close">×</button></h2>
    <button class="go">▶ Read this screen</button>
    <div class="row hide" id="ctl"><button id="pp">⏸ Pause</button><button id="st">■ Stop</button></div>
    <label>Speed <span id="rv"></span><input id="rate" type="range" min="0.7" max="1.5" step="0.05"></label>
    <label>Voice<select id="voice">
      <option value="hannah">Hannah (friendly)</option><option value="diana">Diana</option><option value="autumn">Autumn (calm)</option>
      <option value="austin">Austin</option><option value="daniel">Daniel (deep)</option><option value="troy">Troy</option></select></label>
    <div class="msg" id="msg">Tip: select words first to hear just those.</div>
  </div>
  <button class="fab" aria-label="Read aloud">🔊</button>
</div>`;
    document.documentElement.appendChild(host);
    const $ = (s) => root.querySelector(s);
    const send = (m) => chrome.runtime.sendMessage(m).catch(() => {});
    const wrap = $(".wrap");
    const openIt = (v) => wrap.classList.toggle("open", v);
    $(".fab").onclick = () => openIt(!wrap.classList.contains("open"));
    $(".x").onclick = () => openIt(false);
    $(".go").onclick = () => send({ cmd: "read" });
    $("#st").onclick = () => send({ cmd: "stop" });
    let playing = false;
    $("#pp").onclick = () => send({ cmd: playing ? "pause" : "resume" });
    $("#rate").oninput = (e) => { $("#rv").textContent = Number(e.target.value).toFixed(2) + "x"; send({ cmd: "rate", rate: Number(e.target.value) }); };
    $("#voice").onchange = (e) => send({ cmd: "voice", voice: e.target.value });
    chrome.storage.local.get(["voice", "rate"]).then(({ voice = "hannah", rate = 1 }) => {
      $("#voice").value = voice; $("#rate").value = rate; $("#rv").textContent = Number(rate).toFixed(2) + "x";
    });
    const msgs = { loading: "Getting the voice ready…", playing: "Reading…", paused: "Paused.", empty: "I could not find any words on the screen.", idle: "Done. Tip: select words first to hear just those.", "idle-fallback": "Done. (The AI voice was not reachable, so the device voice was used.)" };
    ui = {
      open: openIt,
      state(s, fallback) {
        $("#msg").textContent = (msgs[s] || "") + (fallback && s === "playing" ? " (device voice)" : "");
        const active = s === "loading" || s === "playing" || s === "paused";
        playing = s === "playing" || s === "loading";
        $("#ctl").classList.toggle("hide", !active);
        $("#pp").textContent = s === "paused" ? "▶ Resume" : "⏸ Pause";
        $(".go").textContent = active ? "↻ Start over" : "▶ Read this screen";
      },
    };
  }

  chrome.runtime.onMessage.addListener((m, _s, reply) => {
    if (m.type === "collect") { reply(collect()); return; }
    if (m.type === "highlight") { highlight(m.id); return; }
    if (m.type === "widget" && isTop) {
      if (!ui) buildUi();
      if (m.open) ui.open(true);
      if (m.state) ui.state(m.state, m.fallback);
    }
  });
  if (isTop) buildUi();
})();
