// The add-on bar for Arise History (/history/), Arise Math (/math/) and Arise Social (/social/).
// It shows the free-trial countdown, and when the trial is over, how to keep this app:
// teachers add it for their class on top of the Class plan (Math $12, History $12, Social $7 a
// month), parents get all three in the $10 Learning Bundle, and students are asked to get a parent
// or teacher. Prices and rules come from GET /api/addons (shared/plans.ts).
(function () {
  "use strict";
  if (window.__ariseAddonBar) return;
  window.__ariseAddonBar = true;

  function token() {
    try {
      var raw = document.cookie.split(";").map(function (c) { return c.trim(); }).find(function (c) { return c.indexOf("arise_session=") === 0; });
      if (!raw) return null;
      var bin = atob(raw.slice("arise_session=".length)), data;
      try { data = JSON.parse(decodeURIComponent(escape(bin))); } catch (e) { data = JSON.parse(bin); }
      return data && data.token ? String(data.token) : null;
    } catch (e) { return null; }
  }
  var TOKEN = token();
  if (!TOKEN) return;

  var path = location.pathname;
  var PAGE = path.indexOf("/math") === 0 ? "/math/" : path.indexOf("/history") === 0 ? "/history/" : "/social/";
  var APP = PAGE.replace(/\//g, "");
  var NAMES = { math: "Arise Math", history: "Arise History", social: "Arise Social" };
  var DAY = 86400000;

  function call(url, body) {
    return fetch(url, {
      method: body ? "POST" : "GET",
      headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined, cache: "no-store",
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.message || "That didn't work. Please try again."); return d; });
    });
  }
  function money(c) { return "$" + (c / 100).toFixed(c % 100 ? 2 : 0); }
  function day(iso) { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  function left(iso) {
    var ms = Math.max(0, Date.parse(iso) - Date.now()), d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return d > 0 ? d + " day" + (d === 1 ? "" : "s") + ", " + h + " hr" : h + " hr, " + m + " min";
  }
  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }

  var css = "" +
    ".ab-pill{position:fixed;left:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:9000;display:flex;align-items:center;gap:10px;background:#1b1638;color:#fff;border:1px solid rgba(255,214,138,.45);border-radius:999px;padding:8px 8px 8px 14px;font:600 13px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif;box-shadow:0 12px 30px rgba(0,0,0,.35)}" +
    ".ab-pill b{color:#ffd38a;font-variant-numeric:tabular-nums}" +
    ".ab-pill button,.ab-wall .ab-btn{border:0;border-radius:999px;padding:8px 14px;font:800 13px/1 system-ui,-apple-system,'Segoe UI',sans-serif;cursor:pointer;background:linear-gradient(115deg,#4b3fd6,#8b5cf6 60%,#f29a14);color:#fff}" +
    ".ab-wall{position:fixed;inset:0;z-index:9500;background:rgba(8,7,18,.72);display:grid;place-items:center;padding:16px;font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif}" +
    ".ab-card{background:#15132a;color:#eeedf7;border:1px solid rgba(255,255,255,.12);border-radius:20px;max-width:520px;width:100%;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,.5);max-height:92vh;overflow:auto}" +
    ".ab-card h2{margin:6px 0 6px;font-size:22px;line-height:1.2}" +
    ".ab-card p{margin:6px 0;color:#b6b2d0}" +
    ".ab-eyebrow{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#b39bff}" +
    ".ab-apps{display:grid;gap:8px;margin:14px 0}" +
    ".ab-apps a{display:block;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.06);color:#fff;text-decoration:none;font-weight:700}" +
    ".ab-apps a.on{outline:2px solid #8b5cf6}" +
    ".ab-apps a span{display:block;font-weight:500;font-size:13px;color:#b6b2d0}" +
    ".ab-meter{margin:12px 0;padding:12px;border-radius:12px;background:rgba(255,178,63,.12);border:1px solid rgba(255,178,63,.35)}" +
    ".ab-meter b{color:#ffd38a;font-variant-numeric:tabular-nums}" +
    ".ab-bar{height:8px;border-radius:99px;background:rgba(255,255,255,.12);margin-top:8px;overflow:hidden}.ab-bar i{display:block;height:100%;background:#ffb23f;border-radius:99px}" +
    ".ab-actions{display:flex;flex-direction:column;gap:8px;margin-top:14px}" +
    ".ab-wall .ab-btn{padding:12px 16px;font-size:14px;text-align:center;text-decoration:none}" +
    ".ab-wall .ab-btn[disabled]{opacity:.5;cursor:not-allowed}" +
    ".ab-ghost{display:block;text-align:center;padding:10px;border-radius:999px;border:1px solid rgba(255,255,255,.2);color:#fff;text-decoration:none;font-weight:700;background:transparent;cursor:pointer;font:700 14px system-ui,-apple-system,'Segoe UI',sans-serif}" +
    ".ab-note{font-size:13px;color:#b6b2d0}" +
    ".ab-err{margin-top:10px;padding:10px;border-radius:10px;background:rgba(239,90,69,.15);color:#ffb4a8;font-size:14px}" +
    ".ab-toast{position:fixed;left:50%;transform:translateX(-50%);top:16px;z-index:9600;background:#1e9e62;color:#fff;padding:10px 16px;border-radius:12px;font:700 14px system-ui,-apple-system,'Segoe UI',sans-serif}" +
    "@media (max-width:600px){.ab-pill{left:8px;right:8px;justify-content:space-between;bottom:calc(76px + env(safe-area-inset-bottom,0px))}}";
  document.head.appendChild(el("<style>" + css + "</style>"));

  /** This page's app status (falls back to the summary for an older server). */
  function mine(d) { return (d.apps && d.apps[APP]) || d.bundle; }
  function classCents(d) { return d.prices.classApps ? d.prices.classApps[APP] : d.prices.teacherBundleCents; }

  function wall(d, closable) {
    var b = mine(d), role = d.role, name = NAMES[APP];
    var apps = [["/history/", "Arise History", "True stories, quizzes and points"], ["/math/", "Arise Math", "Practice that levels up"], ["/social/", "Arise Social", "Explore every career with your class"]];
    var action = "";
    if (role === "parent") action = '<button class="ab-btn" data-ab="buy" ' + (d.payment ? "" : "disabled") + ">" + (b.access ? "Keep all three" : "Get all three") + " for the whole family · " + money(d.prices.familyBundleCents) + "/month</button>" +
      '<p class="ab-note">The Learning Bundle covers you and every child you’ve linked: Arise History, Arise Math and Arise Social. If your children’s teachers add all three for their class, we refund your unused days.</p>';
    else if (role === "teacher") action = d.premium
      ? '<button class="ab-btn" data-ab="buy" ' + (d.payment ? "" : "disabled") + ">" + (b.access ? "Keep " : "Add ") + name + " for my class · " + money(classCents(d)) + "/month</button>" +
        '<p class="ab-note">Covers you and up to ' + (d.prices.classSeats || 100) + " students, on top of the Class plan. Each app is its own add-on: Arise Math " + money(d.prices.classApps.math) + ", Arise History " + money(d.prices.classApps.history) + ", Arise Social " + money(d.prices.classApps.social) + " a month.</p>"
      : '<a class="ab-btn" href="/#/billing">Get the Class plan first</a><p class="ab-note">' + name + " for a class is " + money(classCents(d)) + "/month on top of the Class plan.</p>";
    else if (role === "student") action = '<p class="ab-note"><b style="color:#fff">Ask your teacher</b> to add ' + name + ' for your class, or <b style="color:#fff">ask a parent</b> to add the Learning Bundle for your family (' + money(d.prices.familyBundleCents) + "/month).</p>";
    var meter = b.access && b.trialEndsAt ? '<div class="ab-meter">Free trial: <b data-ab="left">' + left(b.trialEndsAt) + "</b> left<div class=\"ab-bar\"><i style=\"width:" + Math.min(100, (Date.parse(b.trialEndsAt) - Date.now()) / (d.trialDays * DAY) * 100) + '%"></i></div><div class="ab-note" style="margin-top:6px">Free until ' + day(b.trialEndsAt) + ". No card needed.</div></div>" : "";
    var node = el('<div class="ab-wall" role="dialog" aria-modal="true" aria-label="Learning Bundle"><div class="ab-card">' +
      '<div class="ab-eyebrow">' + name + "</div><h2>" + (b.access ? "Keep " + name : "Your free trial has ended") + "</h2>" +
      "<p>" + (b.access ? "You’re on your free 30 days. Here’s how to keep going after." : name + " needs " + (role === "parent" ? "the Learning Bundle." : role === "student" ? "your teacher or a parent to add it." : "its class add-on.")) + "</p>" + meter +
      '<div class="ab-apps">' + apps.map(function (a) { return '<a href="' + a[0] + '" class="' + (a[0] === PAGE ? "on" : "") + '">' + a[1] + "<span>" + a[2] + "</span></a>"; }).join("") + "</div>" +
      '<div class="ab-actions">' + action + (closable ? '<button class="ab-ghost" data-ab="close">Not now</button>' : '<a class="ab-ghost" href="/">Back to A.R.I.S.E. Reader</a>') +
      (!d.payment && (role === "parent" || role === "teacher") ? '<p class="ab-note">Online payment isn’t open yet. Please check back soon.</p>' : "") + "</div></div></div>");
    node.addEventListener("click", function (e) {
      var t = e.target.closest("[data-ab]");
      if (!t) { if (closable && e.target === node) node.remove(); return; }
      if (t.dataset.ab === "close") node.remove();
      if (t.dataset.ab === "buy") {
        t.disabled = true;
        call("/api/billing/addon-checkout", { product: role === "teacher" ? APP : "bundle", returnPath: PAGE }).then(function (r) { location.href = r.url; }).catch(function (err) {
          t.disabled = false;
          var old = node.querySelector(".ab-err"); if (old) old.remove();
          t.parentNode.appendChild(el('<div class="ab-err" role="alert"></div>')).textContent = err.message;
        });
      }
    });
    document.body.appendChild(node);
    return node;
  }

  function pill(d) {
    var b = mine(d);
    var node = el('<div class="ab-pill" role="status"><span>Free trial · <b>' + left(b.trialEndsAt) + "</b> left</span>" + (d.role === "parent" || d.role === "teacher" || d.role === "student" ? '<button type="button">Keep it</button>' : "") + "</div>");
    var btn = node.querySelector("button");
    if (btn) btn.addEventListener("click", function () { wall(d, true); });
    document.body.appendChild(node);
    setInterval(function () { node.querySelector("b").textContent = left(b.trialEndsAt); }, 30000);
  }

  function start() {
    var paid = new URLSearchParams(location.search).get("paid");
    if (paid && /^cs_[A-Za-z0-9_]{8,200}$/.test(paid)) {
      call("/api/billing/confirm", { sessionId: paid }).then(function () { try { sessionStorage.setItem("arise_addon_paid", "1"); } catch (e) {} }, function () {})
        .then(function () { history.replaceState(null, "", location.pathname + location.hash); location.reload(); });
      return;
    }
    call("/api/addons").then(function (d) {
      try { if (sessionStorage.getItem("arise_addon_paid")) { sessionStorage.removeItem("arise_addon_paid"); var t = document.body.appendChild(el('<div class="ab-toast" role="status">Payment received. Your add-on is on.</div>')); setTimeout(function () { t.remove(); }, 4000); } } catch (e) {}
      var b = mine(d);
      if (!b || d.role === "admin") return;
      if (!b.access) wall(d, false);
      else if (b.via === "trial" && b.trialEndsAt) pill(d);
    }).catch(function () { /* the page still works on its own */ });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
