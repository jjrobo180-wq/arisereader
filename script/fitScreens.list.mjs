// The newer Arise Fit screens for script/fitScreens.mjs.
export default ({ tap, seq }) => [
  ["apps", tap("fit-tab-apps"), { scrolls: 3 }],
  ["apps-dark", tap("fit-tab-apps"), { dark: true, scrolls: 1 }],
  ["apps-edit", seq(tap("fit-tab-apps"), tap("fit-apps-edit")), { scrolls: 1 }],
  ["store", seq(tap("fit-tab-apps"), async (p) => { await p.getByTestId("fit-apps-store").scrollIntoViewIfNeeded(); }, tap("fit-apps-store")), { scrolls: 4 }],
  ["yoga", seq(tap("fit-tab-apps"), tap("fit-apps-open-yoga")), { scrolls: 3 }],
  ["breathe", seq(tap("fit-tab-apps"), tap("fit-apps-open-mind")), { scrolls: 2 }],
  ["water", seq(tap("fit-tab-apps"), tap("fit-apps-open-water")), { scrolls: 2 }],
  ["recovery", seq(tap("fit-tab-apps"), tap("fit-apps-open-recovery")), { scrolls: 2 }],
  ["fast", seq(tap("fit-tab-apps"), tap("fit-apps-open-fast")), { scrolls: 1 }],
  ["sleep-ways", seq(tap("fit-today-sleep"), tap("fit-sleep-ways-open")), { scrolls: 2 }],
  ["sleep-dark", tap("fit-today-sleep"), { dark: true, scrolls: 2 }],
  ["sleep-checkin", async () => {}, { scrolls: 1, at: "07:30", noTodaySleep: true, prefs: (t) => ({ "arise-fit-phone": JSON.stringify({ guess: { bed: t - 8 * 3600e3, wake: t - 25 * 60e3 } }) }) }],
  ["sleep-checkin-schedule", async () => {}, { scrolls: 1, at: "07:10", noTodaySleep: true, prefs: { "arise-fit-sleep-phone": "0" }, schedule: true }],
  ["run", tap("fit-tab-run"), { scrolls: 1 }],
  // The interval player (solid, nothing showing through) and a message above the tab bar.
  ["hiit-player", seq(tap("fit-tab-apps"), async (p) => { const b = p.getByTestId("fit-apps-open-hiit"); if (await b.count()) await b.first().click(); else { await p.getByTestId("fit-apps-store").click(); await p.waitForTimeout(500); await p.getByTestId("fit-store-add-hiit").click(); await p.waitForTimeout(600); } }, async (p) => { const s = p.getByTestId("fit-guided-hiit-start"); if (await s.count()) await s.first().click(); }), { scrolls: 1 }],
  ["toast", seq(tap("fit-tab-apps"), tap("fit-apps-store"), async (p) => { const b = p.locator('[data-testid^="fit-store-add-"]').first(); if (await b.count()) await b.click(); }), { scrolls: 1 }],
  ["tip-player", seq(async (p) => { await p.getByTestId("fit-today-tip").scrollIntoViewIfNeeded(); }, tap("fit-today-tip")), { scrolls: 1 }],
  // The five layouts: Today in Light and Dark, another tab, and the picker in Settings.
  ...Object.entries({ athletic: "ember", studio: "rose", bloom: "lilac", pro: "volt", zen: "mono" }).flatMap(([l, pal]) => [
    [`layout-${l}`, async () => {}, { scrolls: 3, prefs: { "arise-fit-layout": l, "arise-fit-palette": pal } }],
    [`layout-${l}-dark`, async () => {}, { dark: true, scrolls: 2, prefs: { "arise-fit-layout": l, "arise-fit-palette": pal } }],
    [`layout-${l}-train`, tap("fit-tab-train"), { scrolls: 1, prefs: { "arise-fit-layout": l, "arise-fit-palette": pal } }],
    [`layout-${l}-food`, tap("fit-tab-food"), { scrolls: 1, dark: l === "studio" || l === "bloom", prefs: { "arise-fit-layout": l, "arise-fit-palette": pal } }],
  ]),
  ["layout-picker", seq(tap("fit-open-settings"), async (p) => { await p.getByTestId("fit-layouts").scrollIntoViewIfNeeded(); }), { scrolls: 2, prefs: { "arise-fit-layout": "studio", "arise-fit-palette": "rose" } }],
];
