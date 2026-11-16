// Cooked, Cooked PT, Arise Notes and Podster inside Arise To Duo (November 2026): each is a Plugin Gallery
// plugin that opens in To Duo's frame and look, with its menu as To Duo's row of pages, signed in with the To
// Duo account (one login), with its alerts opening it inside To Duo. The four App Store apps stay as they are.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SUPER_APPS, SUPER_APP_IDS, cleanSuperPages, duoAppHash, duoLinkFor, isSuperApp, superAppOf, superPagesFor } from "../shared/superApps";
import { ADD_ON_SECTIONS, FAMILY_SECTIONS, TOGGLEABLE, cleanFamily, emptyFamily, isCurrentFamily, isOn } from "../shared/familyHub";
import { PLUGIN_CATEGORIES, PLUGINS, lifeInstalled, officeAppPlugin, pluginsFor, setLifePlugin } from "../shared/pluginStore";
import { countsAsApp, lifeApps } from "../shared/todoPlan";
import { podAlertUrl, runPodPush, type PodPushRow } from "../server/podPush";
import { ariseListener } from "../server/earshot";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("four apps, each a LifeHub section with known, ordered pages", () => {
  assert.deepEqual([...SUPER_APP_IDS], ["cooked", "cookedfood", "cookedrun", "cookedrest", "cookedsocial", "cookedpt", "arisenotes", "notesrecord", "notesask", "podcasts", "audiobooks", "podradio", "studypod", "podsocial"]);
  for (const a of SUPER_APPS) {
    assert.equal(a.section, a.id);
    assert.ok(FAMILY_SECTIONS.includes(a.id), `${a.id} is a section`);
    assert.ok(TOGGLEABLE.includes(a.id) && ADD_ON_SECTIONS.includes(a.id), `${a.id} is added from the gallery`);
    const ids = a.pages.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, `${a.id}: no repeated pages`);
    for (const id of [...a.fixed, ...a.defaults]) assert.ok(ids.includes(id), `${a.id}: ${id} is a page`);
    for (const id of a.fixed) assert.ok(a.defaults.includes(id), `${a.id}: fixed ${id} is on by default`);
    assert.match(a.color, /^#[0-9a-f]{6}$/);
    assert.match(a.appStore, /^https:\/\/apps\.apple\.com\/app\/id\d+$/);
    assert.ok(a.features.length >= 3);
  }
  assert.ok(isSuperApp("podcasts") && !isSuperApp("podster") && !isSuperApp("earshot") && !isSuperApp(7));
});

test("the pages showing: fixed ones always, the pick or the defaults, in the app's own order", () => {
  const pod = superAppOf("podcasts")!;
  assert.deepEqual(superPagesFor(pod, undefined), ["home", "feed", "now", "library"]);
  assert.deepEqual(superPagesFor(pod, ["library", "music", "nope", "music"]), ["home", "music", "library"], "home can't be taken off; order is the app's");
  assert.deepEqual(superPagesFor(pod, []), superPagesFor(pod, undefined), "nothing picked is the defaults");
  const notes = superAppOf("arisenotes")!;
  assert.deepEqual(superPagesFor(notes, ["settings"]), ["pages", "apps", "settings"], "every Arise Notes page is always there");
  assert.deepEqual(cleanSuperPages({ podcasts: ["music", "music", 4, "zzz"], podster: ["music"], bogus: ["x"], arisenotes: "record" }), { podcasts: ["music"] });
  assert.deepEqual(cleanSuperPages(null), {});
});

test("a family keeps its picks, cleaned, and a new family starts with none", () => {
  assert.deepEqual(emptyFamily().superPages, {});
  const f = cleanFamily({ ...emptyFamily(), superPages: { podcasts: ["music", "music", "x"] } });
  assert.deepEqual(f.superPages, { podcasts: ["music"] });
  assert.ok(isCurrentFamily(f));
  const old: any = { ...emptyFamily() }; delete old.superPages;
  assert.equal(isCurrentFamily(old), false, "an older family is cleaned first, so the field is always there");
  assert.deepEqual(cleanFamily(old).superPages, {});
});

test("Plugin Gallery: each app is a featured Super apps plugin for everyone, and adding or removing it only switches it", () => {
  assert.ok(PLUGIN_CATEGORIES.life.includes("Super apps"));
  for (const teacher of [false, true]) {
    const life = pluginsFor("life", { teacher });
    for (const a of SUPER_APPS) {
      const p = life.find((x) => x.target.kind === "section" && x.target.section === a.id);
      assert.ok(p, `${a.id} is in the gallery`);
      assert.equal(p!.category, "Super apps");
      assert.ok(p!.featured);
      assert.equal(p!.name, a.name);
    }
    assert.ok(!pluginsFor("work", { teacher }).some((p) => p.target.kind === "section"), "WorkHub has no LifeHub sections");
  }
  // Arise Notes was an Office app that opened its own page; in LifeHub it's this plugin now (same id).
  const notes = PLUGINS.find((p) => p.id === "life-arise-notes")!;
  assert.deepEqual(notes.target, { kind: "section", section: "arisenotes" });
  assert.equal(officeAppPlugin("life", "life-arise-notes"), undefined);
  assert.ok(officeAppPlugin("work", "work-arise-notes"), "WorkHub's Arise Notes is unchanged");
  const f = emptyFamily();
  for (const a of SUPER_APPS) {
    const p = PLUGINS.find((x) => x.target.kind === "section" && x.target.section === a.id)!;
    assert.equal(isOn(a.id, f), false, `${a.id} starts off`);
    const on = setLifePlugin(f, p, true);
    assert.ok(isOn(a.id, on) && lifeInstalled(p, on));
    assert.equal(isOn(a.id, setLifePlugin(on, p, false)), false);
  }
});

test("they're one person's own apps: not offered as Para Team apps", async () => {
  const { paraApp } = await import("../shared/paraApps");
  for (const a of SUPER_APPS) assert.equal(paraApp(a.id), undefined, a.id);
});

test("they don't use one of Free's 3 plugins (each has its own free version)", () => {
  const family = emptyFamily();
  for (const a of SUPER_APPS) {
    const p = PLUGINS.find((x) => x.target.kind === "section" && x.target.section === a.id)!;
    assert.equal(countsAsApp("life", p), false, a.id);
    family.sections[a.id] = true;
  }
  assert.deepEqual(lifeApps({ family }).filter((x) => /cooked|notes|podster/.test(x)), []);
  family.sections.chores = true;
  assert.ok(lifeApps({ family }).includes("section:chores"), "ordinary plugins still count");
});

test("their alerts and links open them inside To Duo", () => {
  assert.equal(duoAppHash("cooked"), "/to-do?go=cooked");
  assert.equal(duoLinkFor("#/fit"), "/to-do?go=cooked");
  assert.equal(duoLinkFor("https://arisetodo.com/#/fit?coach=1a-abcdefghij"), "/to-do?go=cooked&coach=1a-abcdefghij");
  assert.equal(duoLinkFor("#/trainer"), "/to-do?go=cookedpt");
  assert.equal(duoLinkFor("/notes/#/usage"), "/to-do?go=arisenotes");
  assert.equal(duoLinkFor("?s=123456&e=987654"), "/to-do?go=podcasts&s=123456&e=987654");
  assert.equal(duoLinkFor("#/lifehub?go=tasks"), null, "everything else is left alone");
  assert.equal(duoLinkFor("#/fitness"), null);
  assert.equal(duoLinkFor(""), null);
  // The To Duo iPhone app maps a tapped notification before opening it.
  const push = read("client/src/lib/applePush.ts");
  assert.match(push, /const inDuo = nativeFlavor\(\) === "todo" \? duoLinkFor\(url\) : null;/);
  // To Duo opens the plugin from go=… (and turns it on if it wasn't), with the page, episode or invite.
  const todo = read("client/src/pages/AriseTodo.tsx");
  assert.match(todo, /if \(isSuperApp\(go\)\) \{\s*setFamily\(\(f\) => \(f\.sections\[go\] \? f : \{ \.\.\.f, sections: \{ \.\.\.f\.sections, \[go\]: true \} \}\)\);/);
  assert.match(todo, /setSuperStart\(\{ app: go, page: params\.get\("page"\), s: params\.get\("s"\), e: params\.get\("e"\), coach: params\.get\("coach"\)/);
});

const T = "cd".repeat(32);
test("Podster's new-episode alerts reach To Duo's Podster on the To Duo iPhone app", async () => {
  assert.equal(podAlertUrl(T, "1", "2"), "?s=1&e=2");
  assert.equal(podAlertUrl("todo:" + T, "1", "2"), "/#/to-do?go=podcasts&s=1&e=2");
  const rows: PodPushRow[] = [
    { token: T, follows: ["9"], seen: { 9: "a" }, time_zone: "UTC", sent_day: "", sent_count: 0 },
    { token: "todo:" + T, follows: ["9"], seen: { 9: "a" }, time_zone: "UTC", sent_day: "", sent_count: 0 },
  ];
  const sent: { token: string; url: string; topic?: string }[] = [];
  const db = { save: async () => {}, forget: async () => {}, all: async () => rows.map((r) => ({ ...r, seen: { ...r.seen } })), update: async () => {} };
  const n = await runPodPush({ db, newest: async () => ({ show: "Show", episodeId: "b", title: "New" }), send: async (token, m, topic) => { sent.push({ token, url: m.url!, topic }); return { ok: true, gone: false }; } }, new Date("2026-11-13T18:00:00Z"));
  assert.equal(n, 2);
  assert.deepEqual(sent.find((x) => x.url.startsWith("?")), { token: T, url: "?s=9&e=b", topic: "com.arisereader.podplus" });
  assert.deepEqual(sent.find((x) => x.url.startsWith("/#")), { token: T, url: "/#/to-do?go=podcasts&s=9&e=b", topic: undefined }, "To Duo's own topic, its bare token");
  const server = read("server/podPush.ts");
  assert.match(server, /const token = hex && req\.body\?\.app === "todo" \? TODO_PREFIX \+ hex : hex;/);
  // To Duo signs its token up with the shows followed there, and forgets it when Podster is taken out.
  assert.match(read("client/src/components/super-apps/PodsterInDuo.tsx"), /syncDuoPodPush\(token, es\.follows\.map\(\(f\) => f\.id\)\)/);
  const link = read("client/src/components/super-apps/podsterLink.ts");
  assert.match(link, /body: JSON\.stringify\(\{ token: apns, follows, timeZone: zone\(\), app: "todo" \}\)/);
  assert.match(link, /if \(!apns \|\| !duoPodAlertsOn\(\)\) return;/, "turned off in To Duo's Notifications: not sent");
  // To Duo's Notifications lists what each plugin sends, with Podster's alerts as a switch.
  const settings = read("client/src/components/family-hub/NotificationSettings.tsx");
  assert.match(settings, /data-testid="notify-super-apps"/);
  assert.match(settings, /setDuoPodAlerts\(on, token, \(family\.earshot\?\.follows \?\? \[\]\)\.map\(\(f\) => f\.id\)\)/);
  assert.match(read("client/src/pages/AriseTodo.tsx"), /p\.target\.section === "podcasts" && !on\) forgetDuoPodPush\(token\)/);
});

test("one login: the To Duo sign-in is the Podster account with the same email", async () => {
  const made: string[] = [];
  const sessions = { forEmail: async (email: string, device: string) => { made.push(`${email}|${device}`); return { id: 7, email, device: "profile-device-0001" }; } };
  const grown = await ariseListener({ id: 42, email: "Pat@Example.com", role: "todo", displayName: "Pat Lee" }, "this-device-00000001", sessions);
  assert.deepEqual(grown, { user: { id: "profile-device-0001", role: "public", displayName: "Pat" }, creator: { email: "Pat@Example.com", id: 7 } });
  assert.deepEqual(made, ["Pat@Example.com|this-device-00000001"]);
  const noEmail = await ariseListener({ id: 42, email: null, role: "todo" }, "this-device-00000001", sessions);
  assert.deepEqual(noEmail.user, { id: "arise-user-0000000042", role: "public", displayName: "" });
  assert.equal(noEmail.creator, undefined);
  assert.match(noEmail.user.id, /^[A-Za-z0-9_-]{16,40}$/, "a valid Podster device id");
  const kid = await ariseListener({ id: 3, email: "kid@example.com", role: "student" }, "this-device-00000001", sessions);
  assert.equal(kid.user.role, "student"); assert.equal(kid.creator, undefined, "students don't get a Podster account");
  const earshot = read("server/earshot.ts");
  assert.match(earshot, /Access-Control-Allow-Headers", "Content-Type, Authorization, X-Podscroll-Device, X-Podscroll-Session"/);
  assert.match(earshot, /if \(arise && more\.ariseUser\) \{/);
  assert.match(read("server/routes.ts"), /ariseUser: async \(token\) => \{ const s: any = await storage\.getSession\(token\);/);
  assert.match(read("server/podcastAccounts.ts"), /return \{ lookup, forEmail, forget:/);
  const pod = read("client/src/components/super-apps/PodsterInDuo.tsx");
  assert.match(pod, /"X-Podscroll-Device": device, \.\.\.\(token \? \{ Authorization: `Bearer \$\{token\}` \} : \{\}\)/);
  assert.match(pod, /path\.replace\(\/\^\\\/api\\\/earshot\/, "\/api\/podscroll"\)/);
});

test("each app runs inside To Duo's frame: To Duo's heading and row of pages, its own screens below", () => {
  const todo = read("client/src/pages/AriseTodo.tsx");
  for (const [section, comp] of [["cooked", "CookedInDuo"], ["cookedpt", "CookedPtInDuo"], ["podcasts", "PodsterInDuo"]]) {
    assert.match(todo, new RegExp(`const ${comp} = lazy\\(\\(\\) => import\\("@/components/super-apps/${comp}"\\)\\);`), `${comp} loads when opened`);
    assert.match(todo, new RegExp(`shown === "${section}" \\? <SuperBoundary key="${section}" name="[^"]+"><Suspense fallback=\\{superWaiting\\}><${comp} `), `${section} renders in To Duo, and a crash in it stays in it`);
  }
  assert.match(todo, /cooked: DumbbellNav2, cookedpt: HeartHandshake, arisenotes: NotebookPen, podster: PodcastNav3, cookedfood: AppleNavA, cookedrun: RouteNavA, cookedrest: MoonNavA, cookedsocial: UsersNavA, notesrecord: MicNavA, notesask: SparklesNavA, podcasts: PodcastNav3,/);
  assert.doesNotMatch(todo, /arise-fam-|arise-from-duo/, "no shortcuts that leave To Duo");
  const app = read("client/src/App.tsx");
  assert.doesNotMatch(app, /FromDuoBack|PodsterEmbed/);
  // Cooked and Cooked PT: their screens, To Duo's look on the page while they show.
  const ui = read("client/src/pages/fit/fitUi.tsx");
  assert.match(ui, /export const DUO_CSS = `html\[data-fit-duo="light"\]/);
  assert.match(ui, /\+ LAYOUT_CSS \+ DUO_CSS;/);
  assert.match(ui, /export function useDuoLook\(mode: "light" \| "dark" \| null\)/);
  const fit = read("client/src/pages/fit/FitApp.tsx");
  assert.match(fit, /useDuoLook\(embed \? \(embed\.night \? "dark" : "light"\) : null\);/);
  assert.match(fit, /if \(embed\) return <PointsModeCtx\.Provider[^\n]*data-testid="fit-app" data-fit-embed="duo">/);
  assert.match(fit, /const tabIds = \(only \? \(only\.filter\(\(id\) => id !== "today" && id !== "apps"\) as FitAppId\[\]\) : \(embed \? apps\.added : apps\.tabs\)\.filter/, "each Cooked plugin in To Duo shows its own pages");
  assert.match(fit, /\{!embed && <AllAccessPopup app="fit"/, "To Duo has its own All Access pop-up");
  const tr = read("client/src/pages/trainer/TrainerApp.tsx");
  assert.match(tr, /export default function TrainerApp\(\{ embed \}: \{ embed\?: TrainerEmbed \} = \{\}\)/);
  assert.match(tr, /if \(embed\) return <div className="min-w-0"[^\n]*data-testid="trainer-app" data-fit-embed="duo">/);
  // Notes: To Duo's row of pages instead of Notes' own bar, To Duo's Day or Night, no backdrop of its own.
  const notes = read("client/src/components/arise-notes/NotesApp.tsx");
  assert.match(notes, /if \(ctx\.duo\) return null;/);
  assert.match(notes, /if \(bare \|\| duo\) return;/);
  assert.match(notes, /\{duo\?\.top\(\{ page: notesPageOf\(route\), go: \(page\) => go\(notesRouteOf\(page\)\) \}\)\}/);
  assert.match(read("client/src/components/super-apps/notes-duo.css"), /\.an-root\.an-in-duo::before \{ display: none !important; \}/);
  // Podster: its home page without its own header, side menu or tab bar, and To Duo's address kept.
  const home = read("podscroll/Home.tsx");
  assert.match(home, /\{!embed && header\}/);
  assert.match(home, /const sidebar = !embed && side && /);
  assert.match(home, /\{!embed && view\.kind !== "watch" && <nav aria-label="Podster tabs"/);
  assert.match(home, /if \(embedRef\.current\) \{ embedRef\.current\.onView\(v\); window\.scrollTo\(0, 0\); return; \}/);
  assert.match(read("client/src/components/family-hub/earshot/EarshotPlayer.tsx"), /export function forceTheme\(t: Theme \| null, quiet = false\)/);
  assert.match(read("tailwind.config.ts"), /"\.\/podscroll\/\*\.\{ts,tsx\}"/, "Podster's styles are built into To Duo");
});

test("the row of pages and the picker are To Duo's own (the same pills as Health Lite)", () => {
  const shell = read("client/src/components/super-apps/SuperShell.tsx");
  assert.match(shell, /role="tablist" aria-label=\{`\$\{app\.name\} pages`\}/);
  assert.match(shell, /\$\{on \? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"\}/);
  assert.match(shell, /<Modal title=\{`Pick your \$\{app\.name\} pages`\} eyebrow=\{app\.name\}/);
  assert.match(shell, /superPages: \{ \.\.\.\(f\.superPages \?\? \{\}\), \[app\.id\]: superPagesFor\(app, ids\) \}/);
  // Anyone who had added Arise Notes from the Office apps keeps it, moved to the plugin once.
  assert.match(read("client/src/pages/AriseTodo.tsx"), /sheetsInstalled: \(f\.sheetsInstalled \?\? \[\]\)\.filter\(\(id\) => id !== "life-arise-notes"\), sections: f\.sections\.arisenotes === undefined/);
});

test("Podster is five Premium plugins now (Nov 15, 2026), and anyone who had it gets all five", () => {
  const parts = ["podcasts", "audiobooks", "podradio", "studypod", "podsocial"] as const;
  for (const id of parts) assert.equal(superAppOf(id)!.family, "Podster");
  const before: any = { ...emptyFamily(), sections: { podster: true, podradio: false } }; delete before.splitDone;
  const had = cleanFamily(before);
  assert.equal(isOn("podster", had), false, "the old combined Podster is gone from the menu");
  for (const id of parts) assert.equal(isOn(id, had), id !== "podradio", `${id}${id === "podradio" ? " stays removed" : " is on"}`);
  const never = cleanFamily(emptyFamily());
  for (const id of parts) assert.equal(isOn(id, never), false, "nobody gets them without adding them");
  const life = pluginsFor("life", { teacher: false });
  assert.ok(!life.some((p) => p.id === "life-podster"));
  for (const id of parts) {
    const p = life.find((x) => x.id === `life-${id}`);
    assert.ok(p, id); assert.equal(p!.tier, "premium"); assert.deepEqual(p!.target, { kind: "section", section: id });
  }
  // An old link to Podster opens Podcasts.
  const todo = read("client/src/pages/AriseTodo.tsx");
  assert.match(todo, /const go = asked \? superAppFor\(asked\) \?\? asked : null;/);
});

test("the Podster plugins are To Duo's own screens, with one player that keeps going across To Duo", () => {
  const todo = read("client/src/pages/AriseTodo.tsx");
  for (const [section, comp] of [["audiobooks", "AudiobooksApp"], ["podradio", "RadioApp"], ["studypod", "StudyPodApp"], ["podsocial", "PodSocialApp"]]) {
    assert.match(todo, new RegExp(`const ${comp} = lazy\\(\\(\\) => import\\("@/components/arise-audio/${comp}"\\)\\);`));
    assert.match(todo, new RegExp(`shown === "${section}" \\? <SuperBoundary key="${section}"`));
    const src = read(`client/src/components/arise-audio/${comp}.tsx`);
    assert.match(src, /from "@\/components\/family-hub\/ui"/, `${comp} is built from To Duo's own parts`);
    assert.match(src, /<SuperHead app=\{app\}/, `${comp} has To Duo's heading`);
    assert.doesNotMatch(src, /#ff6a1f|#ff8a3d|ps-light|LIGHT_CSS/, `${comp} isn't Podster's look recolored`);
  }
  assert.match(todo, /<AudioDock current=\{shown\}/);
  // Meeting Pod's action items become To Duo tasks.
  assert.match(read("client/src/components/arise-audio/StudyPodApp.tsx"), /onAddTask\(a\.task,/);
  // Podster Social keeps reporting and blocking (App Store 1.2).
  const social = read("client/src/components/arise-audio/PodSocialApp.tsx");
  assert.match(social, /\/report`/); assert.match(social, /\/api\/earshot\/social\/block/);
  // Podcasts sends what moved to the plugin that has it now.
  assert.match(read("client/src/components/super-apps/PodsterInDuo.tsx"), /if \(MOVED\[v\.kind\]\) \{ openApp\(\.\.\.MOVED\[v\.kind\]\); return; \}/);
});

test("Cooked and Arise Notes are plugins of their own too, given once to anyone who had them", () => {
  const cooked = ["cooked", "cookedfood", "cookedrun", "cookedrest", "cookedsocial"] as const;
  const notes = ["arisenotes", "notesrecord", "notesask"] as const;
  for (const id of cooked) assert.equal(superAppOf(id)!.family, "Cooked");
  for (const id of notes) assert.equal(superAppOf(id)!.family, "Arise Notes");
  // Every Cooked screen that had a page is in exactly one of the parts.
  const pages = cooked.flatMap((id) => superAppOf(id)!.pages.map((p) => p.id));
  assert.equal(new Set(pages).size, pages.length);
  for (const id of ["today", "train", "food", "run", "sleep", "water", "fast", "recovery", "progress", "steps", "yoga", "mind", "mobility", "hiit", "c25k", "meds", "period", "friends"]) assert.ok(pages.includes(id), id);
  const old: any = { ...emptyFamily(), sections: { cooked: true, arisenotes: true, notesask: false } }; delete old.splitDone;
  const f = cleanFamily(old);
  for (const id of cooked) assert.equal(isOn(id, f), true, id);
  assert.equal(isOn("notesrecord", f), true); assert.equal(isOn("notesask", f), false, "a part they had taken off stays off");
  assert.equal(f.splitDone, true);
  // Once: adding Workouts later doesn't bring the rest of Cooked with it.
  const later = cleanFamily({ ...emptyFamily(), sections: { cooked: true } });
  assert.equal(isOn("cookedfood", later), false);
  const todo = read("client/src/pages/AriseTodo.tsx");
  assert.match(todo, /COOKED_PARTS\.includes\(shown as CookedPartId\) \? <SuperBoundary/);
  assert.match(todo, /NOTES_PARTS\.includes\(shown as NotesPartId\) \? <SuperBoundary/);
  assert.match(read("client/src/components/super-apps/CookedInDuo.tsx"), /only: app\.pages\.map\(\(p\) => p\.id\)/);
  const life = pluginsFor("life", { teacher: false });
  for (const id of [...cooked, ...notes]) assert.equal(life.find((x) => x.target.kind === "section" && x.target.section === id)?.tier, "premium", id);
});
