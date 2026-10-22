// Ready-made spreadsheets to start from, each with working formulas, formats and colours.
import { blankSheet, key, type CellStyle, type Sheet, type Workbook } from "./workbook";

export type SheetTemplate = { id: string; name: string; blurb: string; emoji: string; color: string; make: () => Workbook };

type Row = (string | [string, CellStyle])[];
function sheet(name: string, rows: Row[], opts: { colW?: number[]; freezeR?: number; rowStyle?: Record<number, CellStyle>; colStyle?: Record<number, CellStyle>; extra?: (s: Sheet) => void } = {}): Sheet {
  const s = blankSheet(name);
  rows.forEach((row, r) => row.forEach((item, c) => {
    const [v, st] = Array.isArray(item) ? item : [item, undefined];
    const style = { ...(opts.colStyle?.[c] || {}), ...(opts.rowStyle?.[r] || {}), ...(st || {}) };
    if (v !== "" || Object.keys(style).length) s.cells[key(r, c)] = { v, ...(Object.keys(style).length ? { s: style } : {}) };
  }));
  (opts.colW || []).forEach((w, c) => { if (w) s.colW[c] = w; });
  s.freezeR = opts.freezeR || 0;
  opts.extra?.(s);
  return s;
}
const wb = (...sheets: Sheet[]): Workbook => ({ v: 1, sheets, active: 0 });
const H = (bg: string, c = "#ffffff"): CellStyle => ({ b: true, bg, c, v: "middle" });
const title = (v: string, color: string): [string, CellStyle] => [v, { b: true, z: 18, c: color }];
const money: CellStyle = { nf: "$#,##0.00" };

export const SHEET_TEMPLATES: SheetTemplate[] = [
  {
    id: "budget", name: "Monthly budget", emoji: "💰", color: "#16a34a", blurb: "Plan vs. actual for every category, with totals and what's left.",
    make: () => wb(sheet("Budget", [
      [title("Monthly budget", "#15803d")],
      ["Income this month", ["4500", money]],
      [],
      ["Category", "Planned", "Actual", "Difference", "% of income"],
      ["Rent / mortgage", "1400", "1400", "=B5-C5", "=C5/$B$2"],
      ["Groceries", "550", "612", "=B6-C6", "=C6/$B$2"],
      ["Utilities", "220", "198", "=B7-C7", "=C7/$B$2"],
      ["Transportation", "300", "260", "=B8-C8", "=C8/$B$2"],
      ["Insurance", "180", "180", "=B9-C9", "=C9/$B$2"],
      ["Phone & internet", "120", "120", "=B10-C10", "=C10/$B$2"],
      ["Eating out", "200", "245", "=B11-C11", "=C11/$B$2"],
      ["Savings", "600", "600", "=B12-C12", "=C12/$B$2"],
      ["Fun", "150", "90", "=B13-C13", "=C13/$B$2"],
      ["Other", "100", "64", "=B14-C14", "=C14/$B$2"],
      [["Total", { b: true }], ["=SUM(B5:B14)", { b: true }], ["=SUM(C5:C14)", { b: true }], ["=SUM(D5:D14)", { b: true }], ["=C15/$B$2", { b: true }]],
      [],
      [["Left after spending", { b: true }], ["=B2-C15", { b: true, nf: "$#,##0.00", bg: "#dcfce7" }]],
    ], { colW: [190, 110, 110, 110, 110], freezeR: 4, rowStyle: { 3: H("#15803d") }, colStyle: { 1: money, 2: money, 3: money, 4: { nf: "0.0%" } },
      extra: (s) => { s.cond.push({ id: "c1", range: "D5:D15", kind: "lt", a: "0", style: { c: "#b91c1c", b: true } }); s.charts.push({ id: "ch1", kind: "doughnut", range: "A4:B14", title: "Planned spending", x: 660, y: 20, w: 420, h: 320, headers: true, legend: true }); } }),
    ),
  },
  {
    id: "gradebook", name: "Gradebook", emoji: "📒", color: "#7c3aed", blurb: "Scores, averages, letter grades and who needs help, coloured for you.",
    make: () => wb(sheet("Grades", [
      ["Student", "Quiz 1", "Quiz 2", "Test 1", "Project", "Average", "Letter", "Status"],
      ["Ava Moore", "92", "88", "95", "100", "=AVERAGE(B2:E2)", '=IFS(F2>=90,"A",F2>=80,"B",F2>=70,"C",F2>=60,"D",TRUE,"F")', '=IF(F2<70,"Reteach","On track")'],
      ["Ben Diaz", "71", "65", "68", "80", "=AVERAGE(B3:E3)", '=IFS(F3>=90,"A",F3>=80,"B",F3>=70,"C",F3>=60,"D",TRUE,"F")', '=IF(F3<70,"Reteach","On track")'],
      ["Cam Lee", "85", "90", "82", "88", "=AVERAGE(B4:E4)", '=IFS(F4>=90,"A",F4>=80,"B",F4>=70,"C",F4>=60,"D",TRUE,"F")', '=IF(F4<70,"Reteach","On track")'],
      ["Dina Park", "58", "72", "61", "75", "=AVERAGE(B5:E5)", '=IFS(F5>=90,"A",F5>=80,"B",F5>=70,"C",F5>=60,"D",TRUE,"F")', '=IF(F5<70,"Reteach","On track")'],
      ["Eli Ross", "99", "94", "97", "95", "=AVERAGE(B6:E6)", '=IFS(F6>=90,"A",F6>=80,"B",F6>=70,"C",F6>=60,"D",TRUE,"F")', '=IF(F6<70,"Reteach","On track")'],
      [],
      [["Class average", { b: true }], "=AVERAGE(B2:B6)", "=AVERAGE(C2:C6)", "=AVERAGE(D2:D6)", "=AVERAGE(E2:E6)", "=AVERAGE(F2:F6)"],
      [["Highest", { b: true }], "=MAX(B2:B6)", "=MAX(C2:C6)", "=MAX(D2:D6)", "=MAX(E2:E6)", "=MAX(F2:F6)"],
      [["Lowest", { b: true }], "=MIN(B2:B6)", "=MIN(C2:C6)", "=MIN(D2:D6)", "=MIN(E2:E6)", "=MIN(F2:F6)"],
    ], { colW: [160, 80, 80, 80, 80, 90, 70, 100], freezeR: 1, rowStyle: { 0: { ...H("#6d28d9"), h: "center" } }, colStyle: { 5: { nf: "0.0", b: true }, 6: { h: "center", b: true } },
      extra: (s) => {
        s.cond.push({ id: "c1", range: "B2:F6", kind: "scale", min: "#fca5a5", mid: "#fef9c3", max: "#86efac" });
        s.cond.push({ id: "c2", range: "H2:H6", kind: "eq", a: "Reteach", style: { bg: "#fee2e2", c: "#b91c1c", b: true } });
        for (let r = 7; r <= 9; r++) for (let c = 1; c <= 5; c++) s.cells[key(r, c)] = { ...s.cells[key(r, c)], s: { nf: "0.0", bg: "#f5f3ff" } };
        s.charts.push({ id: "ch1", kind: "column", range: "A1:E6", title: "Scores by student", x: 840, y: 10, w: 460, h: 300, headers: true, legend: true });
      } }),
    ),
  },
  {
    id: "attendance", name: "Attendance", emoji: "🗓️", color: "#0284c7", blurb: "A month of P / A / T with dropdowns, totals and attendance rate.",
    make: () => {
      const days = Array.from({ length: 20 }, (_, i) => String(i + 1));
      const names = ["Ava Moore", "Ben Diaz", "Cam Lee", "Dina Park", "Eli Ross"];
      const last = String.fromCharCode(65 + 20);
      return wb(sheet("Attendance", [
        ["Student", ...days, "Present", "Absent", "Tardy", "Rate"],
        ...names.map((n, i) => [n, ...days.map((_, d) => ((i + d) % 9 === 0 ? "A" : (i * d) % 11 === 3 ? "T" : "P")), `=COUNTIF(B${i + 2}:${last}${i + 2},"P")`, `=COUNTIF(B${i + 2}:${last}${i + 2},"A")`, `=COUNTIF(B${i + 2}:${last}${i + 2},"T")`, `=(V${i + 2}+X${i + 2})/COUNTA(B${i + 2}:${last}${i + 2})`]),
      ], { colW: [150, ...days.map(() => 34), 70, 70, 60, 70], freezeR: 1, rowStyle: { 0: { ...H("#0369a1"), h: "center" } }, colStyle: Object.fromEntries([...days.map((_, d): [number, CellStyle] => [d + 1, { h: "center" }]), [24, { nf: "0%" }] as [number, CellStyle]]),
        extra: (s) => {
          s.freezeC = 1;
          s.valid.push({ id: "v1", range: `B2:${last}40`, kind: "list", list: ["P", "A", "T", "E"], help: "P present, A absent, T tardy, E excused" });
          s.cond.push({ id: "c1", range: `B2:${last}40`, kind: "eq", a: "A", style: { bg: "#fee2e2", c: "#b91c1c", b: true } });
          s.cond.push({ id: "c2", range: `B2:${last}40`, kind: "eq", a: "T", style: { bg: "#fef3c7", c: "#92400e" } });
          s.cond.push({ id: "c3", range: "Y2:Y40", kind: "lt", a: "0.9", style: { c: "#b91c1c", b: true } });
        } }));
    },
  },
  {
    id: "todo", name: "To-do checklist", emoji: "✅", color: "#0d9488", blurb: "Tick boxes, due dates, priorities and a progress count.",
    make: () => wb(sheet("To-do", [
      [title("To-do list", "#0f766e"), "", "", "", ["=COUNTIF(A3:A40,TRUE)&\" of \"&COUNTA(B3:B40)&\" done\"", { c: "#0f766e", b: true }]],
      ["Done", "Task", "Due", "Priority", "Notes"],
      ["TRUE", "Email the team the agenda", "10/13/2026", "High", ""],
      ["FALSE", "Book the room for Thursday", "10/14/2026", "Medium", ""],
      ["FALSE", "Order supplies", "10/16/2026", "Low", "Pens, sticky notes"],
      ["FALSE", "Finish the report", "10/20/2026", "High", ""],
      ["FALSE", "", "", "", ""],
    ], { colW: [60, 260, 110, 100, 240], freezeR: 2, rowStyle: { 1: H("#0f766e") },
      extra: (s) => {
        for (let r = 2; r < 40; r++) s.cells[key(r, 0)] = { v: s.cells[key(r, 0)]?.v || "FALSE", s: { nf: "checkbox", h: "center" } };
        for (let r = 2; r < 40; r++) s.cells[key(r, 2)] = { ...(s.cells[key(r, 2)] || { v: "" }), s: { nf: "m/d/yyyy" } };
        s.valid.push({ id: "v1", range: "D3:D40", kind: "list", list: ["High", "Medium", "Low"] });
        s.cond.push({ id: "c1", range: "B3:B40", kind: "formula", a: "=$A3=TRUE", style: { s: true, c: "#94a3b8" } });
        s.cond.push({ id: "c2", range: "D3:D40", kind: "eq", a: "High", style: { c: "#b91c1c", b: true } });
        s.cells[key(1, 0)].s = { ...H("#0f766e"), h: "center" };
      } })),
  },
  {
    id: "invoice", name: "Invoice", emoji: "🧾", color: "#ea580c", blurb: "Line items, tax and total due, ready to print or send as a PDF.",
    make: () => wb(sheet("Invoice", [
      [title("INVOICE", "#c2410c"), "", "", ["Invoice #", { b: true }], "1001"],
      ["Your business name", "", "", ["Date", { b: true }], "10/13/2026"],
      ["123 Main St, Your Town", "", "", ["Due", { b: true }], "=E2+30"],
      [],
      [["Bill to", { b: true }]],
      ["Client name"],
      ["Client address"],
      [],
      ["Description", "", "Qty", "Price", "Amount"],
      ["Design work", "", "10", "75", "=C10*D10"],
      ["Printing", "", "2", "40", "=C11*D11"],
      ["", "", "", "", "=IF(C12=\"\",\"\",C12*D12)"],
      ["", "", "", "", "=IF(C13=\"\",\"\",C13*D13)"],
      [],
      ["", "", "", ["Subtotal", { b: true }], "=SUM(E10:E13)"],
      ["", "", "", ["Tax rate", { b: true }], ["7%", { nf: "0.00%" }]],
      ["", "", "", ["Tax", { b: true }], "=E15*E16"],
      ["", "", "", [ "Total due", { b: true, z: 13 }], ["=E15+E17", { b: true, z: 13, bg: "#ffedd5" }]],
      [],
      [["Thank you for your business!", { i: true, c: "#64748b" }]],
    ], { colW: [220, 60, 70, 110, 130], rowStyle: { 8: H("#c2410c") },
      extra: (s) => {
        for (const r of [9, 10, 11, 12]) { s.cells[key(r, 3)] = { ...(s.cells[key(r, 3)] || { v: "" }), s: money }; s.cells[key(r, 4)] = { ...(s.cells[key(r, 4)] || { v: "" }), s: money }; }
        for (const r of [14, 16]) s.cells[key(r, 4)].s = money;
        s.cells[key(17, 4)].s = { ...s.cells[key(17, 4)].s, ...money };
        s.cells[key(1, 4)].s = { nf: "m/d/yyyy" }; s.cells[key(2, 4)].s = { nf: "m/d/yyyy" };
        s.merges.push({ r1: 8, c1: 0, r2: 8, c2: 1 }); s.grid = false;
      } })),
  },
  {
    id: "habits", name: "Habit tracker", emoji: "🔥", color: "#dc2626", blurb: "Check off habits each day of the week and watch the streaks.",
    make: () => {
      const habits = ["Drink 8 glasses of water", "Read 20 minutes", "Walk 30 minutes", "Sleep by 11", "No phone at dinner"];
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      return wb(sheet("Habits", [
        ["Habit", ...days, "Done", "Goal", "Progress"],
        ...habits.map((h, i) => [h, ...days.map((_, d) => ((i + d) % 3 ? "TRUE" : "FALSE")), `=COUNTIF(B${i + 2}:H${i + 2},TRUE)`, "5", `=MIN(1,I${i + 2}/J${i + 2})`]),
      ], { colW: [220, 50, 50, 50, 50, 50, 50, 50, 60, 60, 120], freezeR: 1, rowStyle: { 0: { ...H("#b91c1c"), h: "center" } },
        extra: (s) => {
          for (let r = 1; r <= 20; r++) for (let c = 1; c <= 7; c++) s.cells[key(r, c)] = { v: s.cells[key(r, c)]?.v || "", s: { nf: "checkbox", h: "center" } };
          for (let r = 1; r <= habits.length; r++) s.cells[key(r, 10)].s = { nf: "0%" };
          s.cond.push({ id: "c1", range: "K2:K21", kind: "bars", max: "#f87171" });
        } }));
    },
  },
  {
    id: "project", name: "Project tracker", emoji: "📌", color: "#2563eb", blurb: "Tasks, owners, status dropdowns, due dates and a status count.",
    make: () => wb(sheet("Project", [
      ["Task", "Owner", "Status", "Start", "Due", "Days left", "Notes"],
      ["Kickoff meeting", "Jordan", "Done", "10/1/2026", "10/2/2026", "=IF(C2=\"Done\",\"\",E2-TODAY())", ""],
      ["Draft the plan", "Sam", "In progress", "10/5/2026", "10/16/2026", "=IF(C3=\"Done\",\"\",E3-TODAY())", ""],
      ["Budget sign-off", "Alex", "Not started", "10/12/2026", "10/23/2026", "=IF(C4=\"Done\",\"\",E4-TODAY())", ""],
      ["Build", "Team", "Not started", "10/19/2026", "11/13/2026", "=IF(C5=\"Done\",\"\",E5-TODAY())", ""],
      ["Review and launch", "Jordan", "Blocked", "11/16/2026", "11/20/2026", "=IF(C6=\"Done\",\"\",E6-TODAY())", "Waiting on budget"],
      [],
      [["Summary", { b: true }]],
      ["Done", "=COUNTIF(C2:C6,\"Done\")"], ["In progress", "=COUNTIF(C2:C6,\"In progress\")"], ["Not started", "=COUNTIF(C2:C6,\"Not started\")"], ["Blocked", "=COUNTIF(C2:C6,\"Blocked\")"],
    ], { colW: [200, 100, 120, 100, 100, 90, 220], freezeR: 1, rowStyle: { 0: H("#1d4ed8") }, colStyle: { 3: { nf: "m/d/yyyy" }, 4: { nf: "m/d/yyyy" } },
      extra: (s) => {
        for (let r = 7; r <= 11; r++) { const c3 = s.cells[key(r, 3)]; if (c3) delete c3.s; const c4 = s.cells[key(r, 4)]; if (c4) delete c4.s; }
        s.valid.push({ id: "v1", range: "C2:C60", kind: "list", list: ["Not started", "In progress", "Done", "Blocked"] });
        s.cond.push({ id: "c1", range: "C2:C60", kind: "eq", a: "Done", style: { bg: "#dcfce7", c: "#166534" } });
        s.cond.push({ id: "c2", range: "C2:C60", kind: "eq", a: "Blocked", style: { bg: "#fee2e2", c: "#991b1b" } });
        s.cond.push({ id: "c3", range: "C2:C60", kind: "eq", a: "In progress", style: { bg: "#dbeafe", c: "#1e40af" } });
        s.cond.push({ id: "c4", range: "F2:F60", kind: "lt", a: "3", style: { c: "#b91c1c", b: true } });
        s.charts.push({ id: "ch1", kind: "pie", range: "A9:B12", title: "Status", x: 900, y: 10, w: 360, h: 260, headers: false, legend: true });
      } })),
  },
  {
    id: "schedule", name: "Weekly schedule", emoji: "⏰", color: "#9333ea", blurb: "Half-hour slots Monday to Sunday, colour-coded.",
    make: () => {
      const times: string[] = [];
      for (let h = 7; h <= 20; h++) for (const m of ["00", "30"]) times.push(`${h > 12 ? h - 12 : h}:${m} ${h >= 12 ? "PM" : "AM"}`);
      return wb(sheet("Week", [["Time", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], ...times.map((t) => [t])], {
        colW: [90, 130, 130, 130, 130, 130, 130, 130], freezeR: 1, rowStyle: { 0: { ...H("#7e22ce"), h: "center" } }, colStyle: { 0: { c: "#64748b", h: "right" } },
        extra: (s) => { s.freezeC = 1; s.cond.push({ id: "c1", range: "B2:H40", kind: "notEmpty", style: { bg: "#f3e8ff", c: "#6b21a8" } }); s.cells[key(1, 1)] = { v: "Team stand-up" }; s.cells[key(5, 3)] = { v: "Gym" }; },
      }));
    },
  },
];
