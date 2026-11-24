import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Reader landing header: four links and More, so the sign-in buttons never run off the right edge", () => {
  const s = readFileSync("client/public/reader-landing.html", "utf8");
  const nav = s.slice(s.indexOf('<nav class="nav-links" id="navLinks"'), s.indexOf("</nav>", s.indexOf('<nav class="nav-links"')));
  const top = nav.slice(0, nav.indexOf('<div class="nav-more"'));
  const more = nav.slice(nav.indexOf('id="navMoreMenu"'));
  assert.doesNotMatch(top, /href="#games"/);
  assert.doesNotMatch(top, /data-app-link/);
  assert.match(more, /data-app-link[\s\S]*Get the iPhone app/);
  assert.match(more, /href="#games">Games/);
});
