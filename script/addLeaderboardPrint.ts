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
  @page { size: Letter portrait; margin: 0.28in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #101828; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .poster { position: relative; width: 100%; min-height: 10.2in; overflow: hidden; border: 2px solid #111827; background:
    radial-gradient(circle at 8% 88%, rgba(124,58,237,.07), transparent 20%),
    radial-gradient(circle at 94% 78%, rgba(14,165,233,.08), transparent 22%),
    linear-gradient(180deg,#ffffff 0%,#fbfcff 100%); }
  .top-stripe { height: 10px; background: linear-gradient(90deg,#f4b400 0 20%,#7c3aed 20% 40%,#0ea5e9 40% 60%,#22c55e 60% 80%,#f97316 80% 100%); }
  .hero { position: relative; overflow: hidden; padding: 26px 30px 25px; text-align: center; color: #ffffff;
    background:
      radial-gradient(circle at 15% 15%,rgba(124,58,237,.46),transparent 31%),
      radial-gradient(circle at 88% 10%,rgba(14,165,233,.34),transparent 30%),
      linear-gradient(135deg,#070b14 0%,#111827 52%,#172554 100%);
    border-bottom: 5px solid #f4b400; }
  .hero:before { content:""; position:absolute; width:250px; height:250px; border:1px solid rgba(255,255,255,.10); border-radius:50%; left:-145px; top:-140px; }
  .hero:after { content:""; position:absolute; width:300px; height:300px; border:1px solid rgba(255,255,255,.08); border-radius:50%; right:-170px; bottom:-210px; }
  .confetti { position:absolute; inset:0; pointer-events:none; }
  .confetti i { position:absolute; display:block; width:7px; height:7px; border-radius:50%; background:#f4b400; box-shadow:0 0 12px rgba(244,180,0,.7); opacity:.8; }
  .confetti i:nth-child(1){left:7%;top:28%}.confetti i:nth-child(2){left:16%;top:72%;background:#38bdf8}.confetti i:nth-child(3){left:28%;top:14%;background:#a78bfa}.confetti i:nth-child(4){right:8%;top:26%;background:#34d399}.confetti i:nth-child(5){right:18%;top:70%;background:#f4b400}.confetti i:nth-child(6){right:30%;top:13%;background:#fb7185}
  .brand { position:relative; z-index:2; display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:999px; background:#f4b400; color:#111827; font-size:9px; font-weight:1000; letter-spacing:2px; box-shadow:0 4px 18px rgba(244,180,0,.24); }
  h1 { position:relative; z-index:2; margin:10px auto 5px; max-width:760px; font-size:40px; line-height:.95; letter-spacing:-1.5px; font-weight:1000; text-transform:uppercase; text-shadow:0 3px 18px rgba(0,0,0,.35); }
  .message { position:relative; z-index:2; margin:8px auto 0; max-width:650px; color:#dbeafe; font-size:13px; line-height:1.45; font-weight:700; }
  .hero-meta { position:relative; z-index:2; display:flex; justify-content:center; gap:7px; flex-wrap:wrap; margin-top:14px; }
  .pill { padding:5px 10px; border:1px solid rgba(255,255,255,.24); border-radius:999px; background:rgba(255,255,255,.09); color:#ffffff; font-size:7px; font-weight:900; letter-spacing:.8px; }
  .champions-label { margin:17px 18px 9px; display:flex; align-items:center; gap:10px; font-size:10px; font-weight:1000; letter-spacing:1.9px; color:#7c3aed; text-transform:uppercase; }
  .champions-label:before,.champions-label:after { content:""; height:3px; flex:1; border-radius:99px; background:linear-gradient(90deg,transparent,#f4b400,#7c3aed); }
  .champions-label:after { background:linear-gradient(90deg,#7c3aed,#0ea5e9,transparent); }
  .podium { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; padding:0 14px; align-items:stretch; }
  .champ-card { position:relative; overflow:hidden; min-height:198px; padding:15px 11px 13px; border:2px solid #d8dee7; border-radius:16px; text-align:center; break-inside:avoid; background:#ffffff; box-shadow:0 6px 0 rgba(17,24,39,.08); }
  .champ-card:before { content:"★"; position:absolute; right:10px; top:5px; font-size:40px; line-height:1; color:rgba(17,24,39,.06); transform:rotate(9deg); }
  .champ-card:after { content:""; position:absolute; left:-10%; right:-10%; bottom:-47px; height:74px; border-radius:50%; opacity:.13; }
  .place-1 { border-color:#e8b20f; background:linear-gradient(180deg,#fff7cc 0%,#ffffff 58%); box-shadow:0 7px 0 #e8b20f; transform:translateY(-4px); }
  .place-1:after{background:#f4b400}.place-2 { border-color:#9aa5b1; background:linear-gradient(180deg,#f4f6f8 0%,#ffffff 60%); box-shadow:0 6px 0 #9aa5b1; }.place-2:after{background:#94a3b8}.place-3 { border-color:#d97706; background:linear-gradient(180deg,#fff0dc 0%,#ffffff 60%); box-shadow:0 6px 0 #d97706; }.place-3:after{background:#d97706}
  .place-badge { position:relative; z-index:2; display:inline-flex; align-items:center; gap:4px; padding:5px 9px; border-radius:999px; background:#111827; color:#fff; font-size:8px; font-weight:1000; letter-spacing:.8px; }
  .place-1 .place-badge { background:#9a6a00; } .place-2 .place-badge { background:#475467; } .place-3 .place-badge { background:#a45111; }
  .champ-name { position:relative; z-index:2; margin-top:12px; min-height:38px; display:flex; align-items:center; justify-content:center; font-size:19px; line-height:1.02; font-weight:1000; letter-spacing:-.45px; color:#111827; }
  .champ-meta { position:relative; z-index:2; margin-top:4px; min-height:12px; font-size:8px; font-weight:700; color:#667085; }
  .score-row { position:relative; z-index:2; display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:11px; }
  .score-row div { padding:8px 4px; border-radius:10px; background:rgba(255,255,255,.82); border:1px solid rgba(17,24,39,.10); }
  .score-row b { display:block; font-size:18px; line-height:1; color:#111827; }
  .score-row span { display:block; margin-top:3px; font-size:6px; font-weight:1000; letter-spacing:1px; color:#667085; }
  .reward { position:relative; z-index:2; margin-top:9px; padding:8px; border-radius:10px; background:#111827; color:#ffffff; }
  .reward span { display:block; color:#facc15; font-size:7px; font-weight:1000; letter-spacing:1.2px; }
  .reward strong { display:block; margin-top:2px; font-size:10px; line-height:1.15; }
  .standings { padding:0 14px 5px; }
  .standings-title { display:flex; justify-content:space-between; align-items:end; margin:17px 2px 7px; border-bottom:2px solid #111827; padding-bottom:6px; }
  .standings-title h2 { margin:0; font-size:14px; font-weight:1000; text-transform:uppercase; letter-spacing:.4px; }
  .standings-title span { font-size:7px; color:#7c3aed; font-weight:900; letter-spacing:.8px; }
  .standing-row { position:relative; display:grid; grid-template-columns:42px minmax(0,1fr) 58px 72px minmax(105px,145px); align-items:center; gap:7px; margin-bottom:6px; padding:7px 9px; border:1px solid #e3e8ef; border-radius:10px; background:#ffffff; break-inside:avoid; overflow:hidden; }
  .standing-row:nth-child(even) { background:#f8fafc; }
  .standing-row:before { content:""; position:absolute; left:0; top:0; bottom:0; width:4px; background:linear-gradient(180deg,#7c3aed,#0ea5e9); }
  .rank-bubble { width:31px;height:31px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#111827;color:#facc15;font-size:10px;font-weight:1000; box-shadow:0 2px 0 #f4b400; }
  .standing-reader strong { display:block; font-size:10px; color:#111827; } .standing-reader small { display:block; margin-top:2px; color:#667085; font-size:7px; }
  .standing-stat { text-align:center; border-left:1px solid #e7ebf0; } .standing-stat b { display:block; font-size:10px; color:#111827; } .standing-stat span { display:block; font-size:6px; color:#667085; font-weight:900; letter-spacing:.7px; }
  .standing-stat.points b { color:#7c3aed; }
  .standing-reward { border-left:1px solid #e7ebf0; padding-left:8px; min-width:0; }
  .standing-reward span { display:block; font-size:6px; color:#9a6a00; font-weight:1000; letter-spacing:.7px; }
  .standing-reward strong { display:block; margin-top:2px; font-size:8px; line-height:1.15; color:#111827; overflow-wrap:anywhere; }
  .footer { margin:12px 0 0; padding:10px 14px 11px; background:#111827; display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:7px; color:#cbd5e1; }
  .footer strong { color:#ffffff; font-size:9px; letter-spacing:1px; } .rise { font-weight:1000; color:#facc15; letter-spacing:.4px; }
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
