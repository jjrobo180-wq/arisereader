// Builds the two self-contained games into client/public/standalone/<name>.html.
//
// Each game is one page with everything inside it: its markup and styles
// (<name>.html), the shared 3D engine (engine.js) and the game itself (<name>.js).
// The site shows them in a frame (client/src/pages/StandaloneGame.tsx).
//
// After changing anything in this folder, run:
//   node client/standalone-games/build.mjs
// and commit the rebuilt pages. tests/standalone-games.test.ts fails if they are stale.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
export const GAMES = ["twinlight-run", "chime-of-aoren"];

const HEAD = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<style>html,body{margin:0}body{font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
`;

/** The finished page for one game. */
export function page(name) {
  const read = (f) => readFileSync(dir + f, "utf8");
  // <name>.html starts with the title, fonts and styles, then the markup from <div id="app"> on
  const html = read(name + ".html"), cut = html.indexOf('<div id="app">');
  if (cut < 0) throw new Error(name + '.html has no <div id="app">');
  const out = HEAD + html.slice(0, cut) + "</head>\n<body>\n" + html.slice(cut) + "\n<script>\n" + read("engine.js") + "\n</script>\n<script>\n" + read(name + ".js") + "\n</script>\n</body>\n</html>\n";
  // A script cannot contain its own closing tag: it would end the script early.
  const scripts = out.split("<script>").slice(1).map((s) => s.split("</script>")[0]);
  if (scripts.length !== 2 || out.split("</script>").length !== 3) throw new Error(name + ": a script contains a closing script tag");
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(dir + "../public/standalone", { recursive: true });
  for (const name of GAMES) {
    const html = page(name);
    writeFileSync(dir + "../public/standalone/" + name + ".html", html);
    console.log(name + ".html", Math.round(html.length / 1024) + " KB");
  }
}
