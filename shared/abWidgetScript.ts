// The text of an iPhone widget for the free Scriptable app. Pasted in once, it shows today's A or B day on the home
// screen (small) or today plus the next days (medium). It reads the schedule from the site, keeps a copy for when
// the phone has no signal, and refreshes itself.

export function abWidgetScript(origin: string): string {
  const url = `${origin.replace(/\/+$/, "")}/ab-days.json`;
  return `// A/B Day widget (Arise)
const URL_JSON = ${JSON.stringify(url)};
const fm = FileManager.local();
const cache = fm.joinPath(fm.documentsDirectory(), "ab-days.json");
async function load() {
  try {
    const days = await new Request(URL_JSON).loadJSON();
    fm.writeString(cache, JSON.stringify(days));
    return days;
  } catch (e) {
    return fm.fileExists(cache) ? JSON.parse(fm.readString(cache)) : {};
  }
}
const pad = (n) => String(n).padStart(2, "0");
const key = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const plus = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
const days = await load();
const now = new Date();
const letter = days[key(now)];
const COLOR = { A: new Color("#2dd4bf"), B: new Color("#c4b5fd") };
const w = new ListWidget();
w.backgroundColor = new Color("#0b1220");
w.setPadding(12, 14, 12, 14);
const head = w.addText(now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }).toUpperCase());
head.font = Font.boldSystemFont(10);
head.textColor = new Color("#a8b3c5");
const big = w.addText(letter || "–");
big.font = Font.heavySystemFont(letter ? 64 : 40);
big.textColor = letter ? COLOR[letter] : new Color("#a8b3c5");
w.addText(letter ? letter + " Day" : "No A/B day").textColor = Color.white();
if (config.widgetFamily === "medium" || config.widgetFamily === undefined) {
  w.addSpacer(6);
  const row = w.addStack();
  let shown = 0;
  for (let i = 1; i < 14 && shown < 4; i++) {
    const d = plus(now, i), l = days[key(d)];
    if (!l) continue;
    const col = row.addStack();
    col.layoutVertically();
    col.setPadding(0, 0, 0, 14);
    const t = col.addText(d.toLocaleDateString(undefined, { weekday: "short" }));
    t.font = Font.mediumSystemFont(10);
    t.textColor = new Color("#a8b3c5");
    const c = col.addText(l);
    c.font = Font.heavySystemFont(22);
    c.textColor = COLOR[l];
    shown++;
  }
}
// Refresh a little after midnight so the letter changes on its own.
const next = plus(now, 1);
next.setHours(0, 5, 0, 0);
w.refreshAfterDate = next;
if (config.runsInWidget) Script.setWidget(w);
else await w.presentMedium();
Script.complete();
`;
}
