// The Arise To Duo iPhone app's build: To Duo alone (App Review 2.5.19, no hidden or dormant features).
// The same web code also runs Arise Reader's student side, the games, the eye-gaze and AAC apps, Arise Talk,
// Arise Undercover and the admin pages. None of them can be opened in To Duo, so this build leaves them out:
//  - one page only (the app itself): no Arise Notes, Undercover or Scholar pages;
//  - each left-out file (script/todoBundle.mjs) becomes a tiny stand-in that shows nothing;
//  - __TODO_APP__ is true, so code marked with it (the Undercover looks and words) is dropped.
// Used by .github/workflows/arisetodo-signed-release.yml and arisetodo-ios.yml; the website keeps vite.config.ts.
import { defineConfig, mergeConfig, type Plugin } from "vite";
import path from "node:path";
import base from "./vite.config";
import { TODO_STAND_IN, todoLeavesOut } from "./script/todoBundle.mjs";

const ROOT = import.meta.dirname;
const PREFIX = "\0todo-left-out-";

function leaveOutOtherProducts(): Plugin {
  const ids = new Map<string, string>();
  return {
    name: "arise-todo-only",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!importer || source.startsWith("\0")) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved || resolved.external || !todoLeavesOut(resolved.id.split("?")[0], ROOT)) return null;
      // A plain id, so no chunk is named after the page it stands in for.
      if (!ids.has(resolved.id)) ids.set(resolved.id, `${PREFIX}${ids.size + 1}`);
      return ids.get(resolved.id)!;
    },
    load(id) {
      return id.startsWith(PREFIX) ? TODO_STAND_IN : null;
    },
  };
}

const config = mergeConfig(base, {
  plugins: [leaveOutOtherProducts()],
  define: { __TODO_APP__: "true" },
});
// mergeConfig adds inputs together; To Duo has only its own page.
config.build.rollupOptions.input = { main: path.resolve(ROOT, "client", "index.html") };

export default defineConfig(config);
