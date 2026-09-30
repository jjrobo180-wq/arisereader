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
admin = admin.replace(stateMarker, stateMarker + `  const [adminLbPrintCount, setAdminLbPrintCount] = useState("10");
  const [adminLbPosterTitle, setAdminLbPosterTitle] = useState("READING CHAMPIONS");
  const [adminLbPosterMessage, setAdminLbPosterMessage] = useState("Celebrating the readers who rose to the top!");
  const [adminLbRewards, setAdminLbRewards] = useState<Record<string, string>>({});
`);

const functionMarker = "  const openManualPoints = async (student: Student) => {\n";
if (!admin.includes(functionMarker)) throw new Error("Could not locate leaderboard function insertion point");
const printFunction = `  const printAdminLeaderboard = () => {
    if (!adminLeaderboard.length) return;
    const requestedCount = adminLbPrintCount === "all" ? adminLeaderboard.length : Math.max(1, Number(adminLbPrintCount) || 10);
    const leaders = adminLeaderboard.slice(0, requestedCount);
    const printWindow = window.open("", "_blank", "width=900,height=1100");
    if (!printWindow) {
      alert("Please allow pop-ups so the leaderboard poster preview can open.");
      return;
    }

    const escapeHtml = (value: any) => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
    const bandLabel = adminLbBand ? adminLbBand + " BAND" : "ALL READING BANDS";
    const listLabel = adminLbPrintCount === "all" ? "FULL LEADERBOARD" : "TOP " + leaders.length + " READERS";
    const printedOn = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const placeWords = ["1ST PLACE", "2ND PLACE", "3RD PLACE"];
    const placeIcons = ["1", "2", "3"];
    const topThree = leaders.slice(0, 3).map((entry: any, idx: number) => {
      const rank = idx + 1;
      const detail = [entry.grade ? "Grade " + escapeHtml(entry.grade) : "", entry.schoolName ? escapeHtml(entry.schoolName) : ""].filter(Boolean).join(" • ");
      const reward = (adminLbRewards[String(entry.id ?? rank)] || "").trim();
      return \`<article class="champ-card place-\${rank}">
        <div class="place-badge"><span>\${placeIcons[idx]}</span> \${placeWords[idx]}</div>
        <div class="champ-name">\${escapeHtml(entry.displayName || "Reader")}</div>
        <div class="champ-meta">\${detail || "A.R.I.S.E. Reader"}</div>
        <div class="score-row"><div><b>\${Number(entry.totalPoints || 0).toLocaleString()}</b><span>POINTS</span></div><div><b>\${Number(entry.quizzesTaken || 0)}</b><span>QUIZZES</span></div></div>
        \${reward ? \`<div class="reward"><span>REWARD</span><strong>\${escapeHtml(reward)}</strong></div>\` : ""}
      </article>\`;
    }).join("");

    const remainingRows = leaders.slice(3).map((entry: any, offset: number) => {
      const rank = offset + 4;
      const studentDetail = [entry.grade ? "Grade " + escapeHtml(entry.grade) : "", entry.schoolName ? escapeHtml(entry.schoolName) : ""].filter(Boolean).join(" • ");
      const reward = (adminLbRewards[String(entry.id ?? rank)] || "").trim();
      return \`<div class="standing-row">
        <div class="rank-bubble">#\${rank}</div>
        <div class="standing-reader"><strong>\${escapeHtml(entry.displayName || "Reader")}</strong><small>\${studentDetail || "A.R.I.S.E. Reader"}</small></div>
        <div class="standing-stat"><b>\${Number(entry.quizzesTaken || 0)}</b><span>QUIZZES</span></div>
        <div class="standing-stat points"><b>\${Number(entry.totalPoints || 0).toLocaleString()}</b><span>POINTS</span></div>
        <div class="standing-reward"><span>REWARD</span><strong>\${reward ? escapeHtml(reward) : "—"}</strong></div>
      </div>\`;
    }).join("");

    const html = \`<!doctype html>
<html><head><meta charset="utf-8"><title>A.R.I.S.E. Reader Hallway Leaderboard</title>
<style>
  @page { size: Letter portrait; margin: 0.35in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #172033; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .poster { width: 100%; min-height: 10.1in; border: 1px solid #cfd6df; background: #ffffff; }
  .top-stripe { height: 7px; background: #172033; }
  .hero { padding: 24px 28px 20px; background: #ffffff; color: #172033; border-bottom: 1px solid #dfe4ea; text-align: left; }
  .confetti { display: none; }
  .brand { display: inline-block; color: #8b6507; font-size: 10px; font-weight: 800; letter-spacing: 2.4px; text-transform: uppercase; }
  h1 { margin: 9px 0 5px; max-width: 700px; font-size: 34px; line-height: 1; letter-spacing: -1px; font-weight: 800; text-transform: uppercase; color: #172033; }
  .message { margin: 0; max-width: 650px; color: #5d6878; font-size: 13px; line-height: 1.45; font-weight: 500; }
  .hero-meta { display: flex; gap: 7px; flex-wrap: wrap; margin-top: 14px; }
  .pill { padding: 5px 9px; border: 1px solid #d8dee7; border-radius: 999px; background: #f7f8fa; color: #4d596a; font-size: 8px; font-weight: 700; letter-spacing: .7px; }
  .champions-label { margin: 16px 20px 8px; display: flex; align-items: center; gap: 10px; font-size: 10px; font-weight: 800; letter-spacing: 1.6px; color: #5d6878; text-transform: uppercase; }
  .champions-label:before,.champions-label:after { content:""; height:1px; flex:1; background:#dfe4ea; }
  .podium { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; padding:0 14px; align-items:stretch; }
  .champ-card { min-height: 182px; padding: 14px 11px 12px; border: 1px solid #d6dce5; border-top: 5px solid #b7c0cc; border-radius: 10px; text-align:center; break-inside:avoid; background:#ffffff; }
  .place-1 { border-top-color:#c99616; }
  .place-2 { border-top-color:#8d99a8; }
  .place-3 { border-top-color:#aa6d3a; }
  .place-badge { display:inline-flex; align-items:center; gap:4px; padding:4px 8px; border-radius:999px; background:#f2f4f7; color:#344054; font-size:8px; font-weight:800; letter-spacing:.7px; }
  .place-1 .place-badge { color:#7a5700; background:#fff8df; }
  .place-2 .place-badge { color:#475467; background:#f2f4f7; }
  .place-3 .place-badge { color:#7a4422; background:#fff3e8; }
  .champ-name { margin-top:10px; min-height:36px; display:flex; align-items:center; justify-content:center; font-size:17px; line-height:1.05; font-weight:800; letter-spacing:-.25px; }
  .champ-meta { margin-top:4px; min-height:12px; font-size:8px; color:#667085; }
  .score-row { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:10px; }
  .score-row div { padding:7px 4px; border-radius:7px; background:#f8fafc; border:1px solid #e5e9ef; }
  .score-row b { display:block; font-size:16px; line-height:1; color:#172033; }
  .score-row span { display:block; margin-top:3px; font-size:6px; font-weight:800; letter-spacing:.9px; color:#7a8595; }
  .reward { margin-top:9px; padding:7px 8px; border-radius:7px; background:#fff9e8; border:1px solid #ead79f; color:#172033; }
  .reward span { display:block; color:#8b6507; font-size:7px; font-weight:800; letter-spacing:1.2px; }
  .reward strong { display:block; margin-top:2px; font-size:10px; line-height:1.2; }
  .standings { padding:0 14px 4px; }
  .standings-title { display:flex; justify-content:space-between; align-items:end; margin:16px 2px 7px; border-bottom:1px solid #b9c2cf; padding-bottom:6px; }
  .standings-title h2 { margin:0; font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:.4px; }
  .standings-title span { font-size:7px; color:#7a8595; font-weight:700; }
  .standing-row { display:grid; grid-template-columns:38px minmax(0,1fr) 58px 72px minmax(105px,145px); align-items:center; gap:7px; margin-bottom:5px; padding:7px 8px; border-bottom:1px solid #e7ebf0; background:#fff; break-inside:avoid; }
  .rank-bubble { width:29px;height:29px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#f3f5f7;color:#344054;font-size:10px;font-weight:800; }
  .standing-reader strong { display:block; font-size:10px; }
  .standing-reader small { display:block; margin-top:2px; color:#7a8595; font-size:7px; }
  .standing-stat { text-align:center; border-left:1px solid #e7ebf0; }
  .standing-stat b { display:block; font-size:10px; }
  .standing-stat span { display:block; font-size:6px; color:#7a8595; font-weight:800; letter-spacing:.6px; }
  .standing-reward { border-left:1px solid #e7ebf0; padding-left:8px; min-width:0; }
  .standing-reward span { display:block; font-size:6px; color:#8b6507; font-weight:800; letter-spacing:.7px; }
  .standing-reward strong { display:block; margin-top:2px; font-size:8px; line-height:1.15; overflow-wrap:anywhere; }
  .footer { margin:12px 14px 0; padding:9px 2px 11px; border-top:1px solid #dfe4ea; display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:7px; color:#7a8595; }
  .footer strong { color:#172033; font-size:9px; letter-spacing:.8px; }
  .rise { font-weight:800; color:#8b6507; }
  @media print { body { background:#fff; } .poster { page-break-after:avoid; } }
</style></head>
<body><main class="poster">
  <div class="top-stripe"></div>
  <section class="hero">
    <div class="confetti"><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="brand">A.R.I.S.E. READER</div>
    <h1>\${escapeHtml(adminLbPosterTitle || "READING CHAMPIONS")}</h1>
    <div class="message">\${escapeHtml(adminLbPosterMessage || "Celebrating the readers who rose to the top!")}</div>
    <div class="hero-meta"><span class="pill">\${escapeHtml(listLabel)}</span><span class="pill">\${escapeHtml(bandLabel)}</span><span class="pill">\${escapeHtml(printedOn)}</span></div>
  </section>
  <div class="champions-label">TOP READERS</div>
  <section class="podium">\${topThree}</section>
  \${remainingRows ? \`<section class="standings"><div class="standings-title"><h2>Reader Standings</h2><span>CURRENT RESULTS</span></div>\${remainingRows}</section>\` : ""}
  <footer class="footer"><strong>A.R.I.S.E. READER</strong><span class="rise">READ • LEARN • EARN • PLAY • GROW</span><span>Keep reading. Keep rising.</span></footer>
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
              <span className="text-sm font-medium">Poster:</span>
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
                onClick={printAdminLeaderboard}
                disabled={adminLbLoading || adminLeaderboard.length === 0}
                className="w-full sm:w-auto gap-2 font-semibold"
              >
                <Printer className="w-4 h-4" />
                Print Hallway Poster
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div>
                <div className="flex items-center gap-2 font-semibold text-foreground"><Trophy className="w-5 h-5 text-primary" /> Hallway Poster Setup</div>
                <p className="mt-1 text-xs text-muted-foreground">Make the printed leaderboard feel like an awards poster. Add a headline and tell everyone exactly what the top winners earned.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs font-bold">Poster headline</Label>
                  <Input value={adminLbPosterTitle} onChange={(e) => setAdminLbPosterTitle(e.target.value)} maxLength={45} placeholder="READING CHAMPIONS" className="mt-1 font-bold" />
                </div>
                <div>
                  <Label className="text-xs font-bold">Poster message</Label>
                  <Input value={adminLbPosterMessage} onChange={(e) => setAdminLbPosterMessage(e.target.value)} maxLength={90} placeholder="Celebrating the readers who rose to the top!" className="mt-1" />
                </div>
              </div>
              <div>
                <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Student rewards</div>
                    <p className="mt-1 text-xs text-muted-foreground">Optional. Edit the prize for any student included on this printout.</p>
                  </div>
                  {Object.keys(adminLbRewards).length > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAdminLbRewards({})}>Clear rewards</Button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-border divide-y divide-border bg-background">
                  {adminLeaderboard
                    .slice(0, adminLbPrintCount === "all" ? adminLeaderboard.length : Math.max(1, Number(adminLbPrintCount) || 10))
                    .map((entry: any, idx: number) => {
                      const rewardKey = String(entry.id ?? idx + 1);
                      return (
                        <div key={rewardKey} className="grid gap-2 sm:grid-cols-[44px_minmax(0,1fr)_minmax(190px,1fr)] items-center p-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground">#{idx + 1}</div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate">{entry.displayName || "Reader"}</div>
                            <div className="text-[11px] text-muted-foreground">{Number(entry.totalPoints || 0).toLocaleString()} points • {Number(entry.quizzesTaken || 0)} quizzes</div>
                          </div>
                          <Input
                            value={adminLbRewards[rewardKey] || ""}
                            onChange={(e) => setAdminLbRewards((prev) => ({ ...prev, [rewardKey]: e.target.value }))}
                            maxLength={80}
                            placeholder="Optional prize / reward"
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">The printout uses a clean Letter-size school poster layout. Your current reading-band filter, student list, and any rewards you enter are added automatically.</p>
            {adminLbLoading ? (`;
admin = admin.replace(controlsMarker, controlsReplacement);

writeFileSync(adminPath, admin);
console.log("[leaderboard-print] installed hallway poster leaderboard with customizable rewards");
