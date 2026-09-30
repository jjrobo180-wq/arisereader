import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const adminPath = resolve(process.cwd(), "client/src/pages/Admin.tsx");
let admin = readFileSync(adminPath, "utf8");

if (admin.includes("const printAdminLeaderboard = () =>")) {
  console.log("[leaderboard-print] already installed");
  process.exit(0);
}

admin = admin.replace(
  "MessageSquarePlus, CheckCircle2, Search, ChevronDown, ChevronLeft, ChevronRight, Building, FileQuestion, FileSearch, RotateCcw, Brain, Trash2, BarChart3, Gift, Check, ShieldCheck",
  "MessageSquarePlus, CheckCircle2, Search, ChevronDown, ChevronLeft, ChevronRight, Building, FileQuestion, FileSearch, RotateCcw, Brain, Trash2, BarChart3, Gift, Check, ShieldCheck, Printer"
);

const stateMarker = '  const [adminLbBand, setAdminLbBand] = useState("");\n';
if (!admin.includes(stateMarker)) throw new Error("Could not locate admin leaderboard state");
admin = admin.replace(stateMarker, stateMarker + '  const [adminLbPrintCount, setAdminLbPrintCount] = useState("10");\n');

const functionMarker = "  const openManualPoints = async (student: Student) => {\n";
if (!admin.includes(functionMarker)) throw new Error("Could not locate leaderboard function insertion point");
const printFunction = `  const printAdminLeaderboard = () => {
    if (!adminLeaderboard.length) return;
    const requestedCount = adminLbPrintCount === "all" ? adminLeaderboard.length : Math.max(1, Number(adminLbPrintCount) || 10);
    const leaders = adminLeaderboard.slice(0, requestedCount);
    const printWindow = window.open("", "_blank", "width=900,height=1100");
    if (!printWindow) {
      alert("Please allow pop-ups so the leaderboard print preview can open.");
      return;
    }

    const escapeHtml = (value: any) => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
    const bandLabel = adminLbBand ? adminLbBand + " Band" : "All Bands";
    const listLabel = adminLbPrintCount === "all" ? "Full Leaderboard" : "Top " + leaders.length + " Readers";
    const printedOn = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const medals = ["1st", "2nd", "3rd"];
    const topThree = leaders.slice(0, 3).map((entry: any, idx: number) => {
      const detail = [entry.grade ? "Grade " + escapeHtml(entry.grade) : "", entry.schoolName ? escapeHtml(entry.schoolName) : ""].filter(Boolean).join(" · ");
      return \`<div class="podium-card place-\${idx + 1}">
        <div class="medal">\${medals[idx]}</div>
        <div class="podium-rank">#\${idx + 1}</div>
        <div class="podium-name">\${escapeHtml(entry.displayName || "Reader")}</div>
        <div class="podium-meta">\${detail || "A.R.I.S.E. Reader"}</div>
        <div class="podium-points">\${Number(entry.totalPoints || 0).toLocaleString()} <span>PTS</span></div>
        <div class="podium-quizzes">\${Number(entry.quizzesTaken || 0)} quizzes completed</div>
      </div>\`;
    }).join("");

    const remainingRows = leaders.slice(3).map((entry: any, offset: number) => {
      const rank = offset + 4;
      const studentDetail = [entry.grade ? "Grade " + escapeHtml(entry.grade) : "", entry.schoolName ? escapeHtml(entry.schoolName) : ""].filter(Boolean).join(" · ");
      return \`<tr>
        <td class="rank">#\${rank}</td>
        <td><strong>\${escapeHtml(entry.displayName || "Reader")}</strong><small>\${studentDetail || "A.R.I.S.E. Reader"}</small></td>
        <td class="center">\${Number(entry.quizzesTaken || 0)}</td>
        <td class="points">\${Number(entry.totalPoints || 0).toLocaleString()}</td>
      </tr>\`;
    }).join("");

    const html = \`<!doctype html>
<html><head><meta charset="utf-8"><title>A.R.I.S.E. Reader Leaderboard</title>
<style>
  @page { size: Letter portrait; margin: 0.38in; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #172033; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { width: 100%; }
  .hero { position: relative; overflow: hidden; border-radius: 22px; padding: 26px 28px 24px; background: linear-gradient(135deg,#111827 0%,#1f2937 55%,#312e81 100%); color: white; }
  .hero:after { content: ""; position: absolute; width: 220px; height: 220px; right: -65px; top: -95px; border-radius: 50%; background: rgba(245,158,11,.22); }
  .brand { font-size: 11px; font-weight: 800; letter-spacing: 3px; color: #fbbf24; text-transform: uppercase; }
  h1 { margin: 6px 0 4px; font-size: 31px; line-height: 1.05; letter-spacing: -.8px; }
  .subtitle { font-size: 13px; color: #d1d5db; }
  .hero-meta { display: flex; gap: 8px; margin-top: 15px; flex-wrap: wrap; }
  .pill { padding: 6px 10px; border-radius: 999px; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.18); font-size: 10px; font-weight: 700; }
  .podium { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin: 14px 0; }
  .podium-card { position: relative; min-height: 152px; padding: 16px 13px 13px; border-radius: 18px; border: 1px solid #e5e7eb; background: #f8fafc; text-align: center; break-inside: avoid; }
  .place-1 { background: linear-gradient(180deg,#fffbeb,#fff7d6); border-color: #f6c453; box-shadow: inset 0 4px 0 #f59e0b; }
  .place-2 { background: linear-gradient(180deg,#f8fafc,#eef2f7); border-color: #cbd5e1; box-shadow: inset 0 4px 0 #94a3b8; }
  .place-3 { background: linear-gradient(180deg,#fff7ed,#ffedd5); border-color: #fdba74; box-shadow: inset 0 4px 0 #c97732; }
  .medal { display: inline-block; padding: 4px 8px; border-radius: 999px; background: #172033; color: white; font-size: 9px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; }
  .podium-rank { margin-top: 7px; font-size: 23px; font-weight: 900; line-height: 1; }
  .podium-name { margin-top: 6px; font-size: 15px; font-weight: 800; line-height: 1.15; }
  .podium-meta { min-height: 14px; margin-top: 3px; font-size: 9px; color: #64748b; }
  .podium-points { margin-top: 9px; font-size: 20px; font-weight: 900; color: #4338ca; }
  .podium-points span { font-size: 8px; letter-spacing: 1px; }
  .podium-quizzes { margin-top: 2px; font-size: 9px; color: #64748b; }
  .section-title { display: flex; align-items: center; justify-content: space-between; margin: 15px 2px 7px; }
  .section-title h2 { margin: 0; font-size: 14px; }
  .section-title span { font-size: 9px; color: #64748b; }
  table { width: 100%; border-collapse: separate; border-spacing: 0 5px; }
  thead th { padding: 0 10px 3px; font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; text-align: left; }
  thead th.center { text-align: center; } thead th.right { text-align: right; }
  tbody tr { break-inside: avoid; }
  tbody td { padding: 8px 10px; background: #f8fafc; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
  tbody td:first-child { border-left: 1px solid #e5e7eb; border-radius: 10px 0 0 10px; }
  tbody td:last-child { border-right: 1px solid #e5e7eb; border-radius: 0 10px 10px 0; }
  td.rank { width: 52px; font-weight: 900; color: #4338ca; }
  td strong { display: block; font-size: 11px; } td small { display: block; margin-top: 2px; font-size: 8px; color: #64748b; }
  td.center { text-align: center; width: 72px; } td.points { text-align: right; width: 80px; font-weight: 900; color: #4338ca; }
  .footer { margin-top: 13px; padding-top: 9px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; color: #64748b; font-size: 8px; }
  .footer strong { color: #172033; letter-spacing: .5px; }
  @media print { body { background: white; } .sheet { page-break-after: avoid; } }
</style></head>
<body><main class="sheet">
  <section class="hero">
    <div class="brand">A.R.I.S.E. READER</div>
    <h1>Reader Leaderboard</h1>
    <div class="subtitle">Celebrating reading, effort, and growth.</div>
    <div class="hero-meta"><span class="pill">\${escapeHtml(listLabel)}</span><span class="pill">\${escapeHtml(bandLabel)}</span><span class="pill">\${escapeHtml(printedOn)}</span></div>
  </section>
  <section class="podium">\${topThree}</section>
  \${remainingRows ? \`<div class="section-title"><h2>Leaderboard Standings</h2><span>Quizzes &amp; points earned</span></div><table><thead><tr><th>Rank</th><th>Reader</th><th class="center">Quizzes</th><th class="right">Points</th></tr></thead><tbody>\${remainingRows}</tbody></table>\` : ""}
  <footer class="footer"><strong>A.R.I.S.E. Reader</strong><span>Keep reading. Keep rising.</span></footer>
</main></body></html>\`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => setTimeout(() => { printWindow.focus(); printWindow.print(); }, 150);
  };

`;
admin = admin.replace(functionMarker, printFunction + functionMarker);

const controlsMarker = `                <option value="9-12">9-12 Band</option>
              </select>
            </div>
            {adminLbLoading ? (`;
if (!admin.includes(controlsMarker)) throw new Error("Could not locate leaderboard controls");
const controlsReplacement = `                <option value="9-12">9-12 Band</option>
              </select>
              <div className="hidden sm:block h-7 w-px bg-border" />
              <span className="text-sm font-medium">Print:</span>
              <select
                value={adminLbPrintCount}
                onChange={(e) => setAdminLbPrintCount(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm"
                aria-label="Number of leaderboard students to print"
              >
                <option value="3">Top 3</option>
                <option value="5">Top 5</option>
                <option value="10">Top 10</option>
                <option value="20">Top 20</option>
                <option value="all">All Students</option>
              </select>
              <Button
                type="button"
                variant="outline"
                onClick={printAdminLeaderboard}
                disabled={adminLbLoading || adminLeaderboard.length === 0}
                className="w-full sm:w-auto gap-2 font-semibold"
              >
                <Printer className="w-4 h-4" />
                Print Leaderboard
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Print a polished one-page leaderboard handout. The current band filter is used automatically.</p>
            {adminLbLoading ? (`;
admin = admin.replace(controlsMarker, controlsReplacement);

writeFileSync(adminPath, admin);
console.log("[leaderboard-print] installed printable admin leaderboard");
