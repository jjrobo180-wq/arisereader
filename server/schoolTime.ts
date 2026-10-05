// Months as the school sees them: they start at midnight Mountain Time, not midnight in London.

/** When a month starts in the school's time zone (Mountain Time), as a time. */
export function monthStartMs(yearMonth: string, timeZone = "America/Denver"): number {
  const [y, m] = yearMonth.split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, 1);
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(new Date(utcMidnight)).find((p) => p.type === "timeZoneName")?.value || "GMT";
  const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const offsetMin = match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] || 0)) : 0;
  return utcMidnight - offsetMin * 60_000;
}
/** The month after "YYYY-MM". */
export function nextYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
