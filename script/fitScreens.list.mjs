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
];
