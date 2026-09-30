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
  const [adminLbRewards, setAdminLbRewards] = useState<Record<number, string>>({ 1: "", 2: "", 3: "" });
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
    const placeIcons = ["★", "◆", "▲"];
    const topThree = leaders.slice(0, 3).map((entry: any, idx: number) => {
      const rank = idx + 1;
      const detail = [entry.grade ? "Grade " + escapeHtml(entry.grade) : "", entry.schoolName ? escapeHtml(entry.schoolName) : ""].filter(Boolean).join(" • ");
      const reward = (adminLbRewards[rank] || "").trim();
      return \`<article class="champ-card place-\${rank}">
        <div class="place-badge"><span>\${placeIcons[idx]}</span> \${placeWords[idx]}</div>
        <div class="champ-name">\${escapeHtml(entry.displayName || "Reader")}</div>
        <div class="champ-meta">\${detail || "A.R.I.S.E. Reader"}</div>
        <div class="score-row"><div><b>\${Number(entry.totalPoints || 0).toLocaleString()}</b><span>POINTS</span></div><div><b>\${Number(entry.quizzesTaken || 0)}</b><span>QUIZZES</span></div></div>
        \${reward ? \`<div class="reward"><span>🏆 PRIZE</span><strong>\${escapeHtml(reward)}</strong></div>\` : ""}
      </article>\`;
    }).join("");

    const remainingRows = leaders.slice(3).map((entry: any, offset: number) => {
      const rank = offset + 4;
      const studentDetail = [entry.grade ? "Grade " + escapeHtml(entry.grade) : "", entry.schoolName ? escapeHtml(entry.schoolName) : ""].filter(Boolean).join(" • ");
      return \`<div class="standing-row">
        <div class="rank-bubble">#\${rank}</div>
        <div class="standing-reader"><strong>\${escapeHtml(entry.displayName || "Reader")}</strong><small>\${studentDetail || "A.R.I.S.E. Reader"}</small></div>
        <div class="standing-stat"><b>\${Number(entry.quizzesTaken || 0)}</b><span>QUIZZES</span></div>
        <div class="standing-stat points"><b>\${Number(entry.totalPoints || 0).toLocaleString()}</b><span>POINTS</span></div>
      </div>\`;
    }).join("");

    const html = \`<!doctype html>
<html><head><meta charset="utf-8"><title>A.R.I.S.E. Reader Hallway Leaderboard</title>
<style>
  @page { size: Letter portrait; margin: 0.25in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #101828; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .poster { position: relative; width: 100%; min-height: 10.45in; overflow: hidden; border: 3px solid #111827; background: linear-gradient(180deg,#ffffff 0%,#fffdf5 52%,#f8fafc 100%); }
  .top-stripe { height: 13px; background: repeating-linear-gradient(135deg,#fbbf24 0 18px,#111827 18px 36px); }
  .hero { position: relative; overflow: hidden; padding: 22px 28px 20px; text-align: center; background: radial-gradient(circle at 15% 20%,rgba(250,204,21,.24),transparent 24%), radial-gradient(circle at 85% 5%,rgba(59,130,246,.28),transparent 27%), linear-gradient(135deg,#0f172a 0%,#172554 52%,#312e81 100%); color: white; }
  .hero:before,.hero:after { content: ""; position:absolute; border:2px solid rgba(255,255,255,.12); border-radius:50%; }
  .hero:before { width:170px;height:170px;left:-95px;bottom:-110px; } .hero:after { width:210px;height:210px;right:-110px;top:-130px; }
  .brand { position:relative; z-index:2; display:inline-block; padding:5px 12px; border-radius:999px; background:#fbbf24; color:#111827; font-size:10px; font-weight:1000; letter-spacing:2.5px; }
  h1 { position:relative; z-index:2; margin:9px auto 3px; max-width:700px; font-size:36px; line-height:.95; letter-spacing:-1.2px; font-weight:1000; text-transform:uppercase; }
  .message { position:relative; z-index:2; margin:7px auto 0; max-width:620px; color:#e0e7ff; font-size:13px; font-weight:700; }
  .hero-meta { position:relative; z-index:2; display:flex; justify-content:center; gap:7px; flex-wrap:wrap; margin-top:13px; }
  .pill { padding:5px 10px; border:1px solid rgba(255,255,255,.28); border-radius:999px; background:rgba(255,255,255,.10); font-size:8px; font-weight:900; letter-spacing:.8px; }
  .confetti { position:absolute; inset:0; pointer-events:none; opacity:.9; }
  .confetti i { position:absolute; display:block; width:7px; height:13px; border-radius:2px; transform:rotate(24deg); }
  .confetti i:nth-child(1){left:7%;top:22%;background:#fbbf24;transform:rotate(22deg)} .confetti i:nth-child(2){left:14%;top:68%;background:#60a5fa;transform:rotate(-35deg)} .confetti i:nth-child(3){left:25%;top:12%;background:#f472b6;transform:rotate(55deg)} .confetti i:nth-child(4){right:8%;top:25%;background:#34d399;transform:rotate(-25deg)} .confetti i:nth-child(5){right:18%;top:70%;background:#fbbf24;transform:rotate(38deg)} .confetti i:nth-child(6){right:28%;top:15%;background:#a78bfa;transform:rotate(-48deg)}
  .champions-label { margin:14px 20px 7px; display:flex; align-items:center; gap:9px; font-size:11px; font-weight:1000; letter-spacing:1.8px; color:#4338ca; }
  .champions-label:before,.champions-label:after { content:""; height:2px; flex:1; background:linear-gradient(90deg,transparent,#c7d2fe); } .champions-label:after{background:linear-gradient(90deg,#c7d2fe,transparent)}
  .podium { display:grid; grid-template-columns:repeat(3,1fr); gap:9px; padding:0 14px; align-items:stretch; }
  .champ-card { position:relative; overflow:hidden; min-height:190px; padding:15px 10px 12px; border:2px solid #d0d5dd; border-radius:17px; text-align:center; break-inside:avoid; background:#fff; }
  .champ-card:after { content:""; position:absolute; left:-20%; right:-20%; bottom:-42px; height:72px; border-radius:50%; opacity:.22; }
  .place-1 { border-color:#e6a700; background:linear-gradient(180deg,#fff8cf 0%,#fffdf3 100%); box-shadow:0 5px 0 #fbbf24; transform:translateY(-3px); }
  .place-1:after{background:#fbbf24}.place-2 { border-color:#98a2b3; background:linear-gradient(180deg,#f2f4f7,#fff); box-shadow:0 5px 0 #98a2b3; }.place-2:after{background:#98a2b3}.place-3 { border-color:#d97706; background:linear-gradient(180deg,#fff0dc,#fffaf5); box-shadow:0 5px 0 #d97706; }.place-3:after{background:#d97706}
  .place-badge { display:inline-flex; align-items:center; gap:4px; padding:5px 8px; border-radius:999px; background:#111827; color:#fff; font-size:8px; font-weight:1000; letter-spacing:.8px; }
  .place-1 .place-badge { background:#b77900; } .place-2 .place-badge { background:#475467; } .place-3 .place-badge { background:#b54708; }
  .champ-name { margin-top:10px; min-height:36px; display:flex; align-items:center; justify-content:center; font-size:18px; line-height:1.02; font-weight:1000; letter-spacing:-.35px; }
  .champ-meta { margin-top:4px; min-height:12px; font-size:8px; font-weight:700; color:#667085; }
  .score-row { display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-top:10px; }
  .score-row div { padding:7px 4px; border-radius:10px; background:rgba(255,255,255,.72); border:1px solid rgba(17,24,39,.08); }
  .score-row b { display:block; font-size:17px; line-height:1; color:#4338ca; } .score-row span { display:block; margin-top:3px; font-size:6px; font-weight:1000; letter-spacing:1px; color:#667085; }
  .reward { position:relative; z-index:2; margin-top:9px; padding:7px 8px; border-radius:10px; background:#111827; color:white; }
  .reward span { display:block; color:#fbbf24; font-size:7px; font-weight:1000; letter-spacing:1.3px; } .reward strong { display:block; margin-top:2px; font-size:11px; line-height:1.1; }
  .standings { padding:0 14px; }
  .standings-title { display:flex; justify-content:space-between; align-items:end; margin:15px 2px 6px; border-bottom:2px solid #111827; padding-bottom:5px; }
  .standings-title h2 { margin:0; font-size:14px; font-weight:1000; text-transform:uppercase; letter-spacing:.4px; } .standings-title span { font-size:8px; color:#667085; font-weight:700; }
  .standing-row { display:grid; grid-template-columns:42px 1fr 68px 78px; align-items:center; gap:7px; margin-bottom:5px; padding:6px 8px; border:1px solid #e4e7ec; border-radius:11px; background:#fff; break-inside:avoid; }
  .rank-bubble { width:31px;height:31px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#eef2ff;color:#4338ca;font-size:11px;font-weight:1000; }
  .standing-reader strong { display:block; font-size:11px; } .standing-reader small { display:block; margin-top:1px; color:#667085; font-size:7px; }
  .standing-stat { text-align:center; border-left:1px solid #eaecf0; } .standing-stat b { display:block; font-size:11px; } .standing-stat span { display:block; font-size:6px; color:#667085; font-weight:900; letter-spacing:.7px; } .standing-stat.points b { color:#4338ca; }
  .footer { margin:12px 14px 0; padding:9px 2px 11px; border-top:2px solid #fbbf24; display:flex; justify-content:space-between; align-items:center; font-size:8px; color:#667085; }
  .footer strong { color:#111827; font-size:10px; letter-spacing:.8px; } .rise { font-weight:1000; color:#4338ca; }
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
  \${remainingRows ? \`<section class="standings"><div class="standings-title"><h2>More Readers Rising</h2><span>KEEP READING • KEEP CLIMBING</span></div>\${remainingRows}</section>\` : ""}
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
                className="w-full sm:w-auto gap-2 font-black bg-amber-400 hover:bg-amber-500 text-slate-950"
              >
                <Printer className="w-4 h-4" />
                Print Hallway Poster
              </Button>
            </div>

            <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-white to-indigo-50 p-4 space-y-4">
              <div>
                <div className="flex items-center gap-2 font-black text-slate-900"><Trophy className="w-5 h-5 text-amber-500" /> Hallway Poster Setup</div>
                <p className="mt-1 text-xs text-slate-600">Make the printed leaderboard feel like an awards poster. Add a headline and tell everyone exactly what the top winners earned.</p>
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
                <div className="text-xs font-black uppercase tracking-wider text-slate-600 mb-2">Winner Rewards</div>
                <div className="grid gap-2 md:grid-cols-3">
                  {[1, 2, 3].map((rank) => (
                    <div key={rank} className="rounded-xl border bg-white p-3 shadow-sm">
                      <Label className="text-xs font-black">{rank === 1 ? "🥇 1st Place" : rank === 2 ? "🥈 2nd Place" : "🥉 3rd Place"}</Label>
                      <Input
                        value={adminLbRewards[rank] || ""}
                        onChange={(e) => setAdminLbRewards((prev) => ({ ...prev, [rank]: e.target.value }))}
                        maxLength={60}
                        placeholder={rank === 1 ? "Ex: Free lunch / food prize" : rank === 2 ? "Ex: $10 gift card" : "Ex: Snack prize"}
                        className="mt-1"
                      />
                      {adminLeaderboard[rank - 1]?.displayName && <p className="mt-1 text-[10px] text-muted-foreground">Current #{rank}: <strong>{adminLeaderboard[rank - 1].displayName}</strong></p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">The printout is optimized as a full-color Letter-size hallway poster. Your current reading-band filter and reward text are added automatically.</p>
            {adminLbLoading ? (`;
admin = admin.replace(controlsMarker, controlsReplacement);

writeFileSync(adminPath, admin);
console.log("[leaderboard-print] installed hallway poster leaderboard with customizable rewards");
