// Scenes 6 to 8 of the student welcome show: the leaderboard, the competitions, and the wrap-up.
// The pages are the leaderboard and competition pages' own markup, with made-up readers so no real student is on the screen.
import { useRef } from "react";
import { ArrowLeft, Award, BookOpen, Calendar, CheckCircle2, Crown, GraduationCap, LogIn, Medal, Search, Star, Trophy, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MonthCountdown from "@/components/MonthCountdown";
import { QuizProgress, Ticket } from "@/components/prizes/PrizeBoard";
import "@/components/prizes/prizes.css";
import { monthLabel, recentSchoolMonths, schoolYearMonth } from "@shared/schoolMonth";
import { SITE } from "@shared/presentShow";
import { LibraryHeader } from "./scenesA";
import { SAMPLE_READERS, Scroll, Spot, passedLabel, useScrollY, useSince, type SceneProps } from "./kit";

const GRADIENT = "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 text-white shadow-lg shadow-violet-500/15";
const QUIET = "bg-white/[.04] border border-white/10 text-slate-300";
const MEDALS = [
  { bg: "bg-gradient-to-br from-yellow-500/30 to-yellow-600/10", text: "text-yellow-400", border: "border-yellow-500/30", icon: Crown },
  { bg: "bg-gradient-to-br from-gray-400/30 to-gray-500/10", text: "text-gray-300", border: "border-gray-400/30", icon: Medal },
  { bg: "bg-gradient-to-br from-fuchsia-500/25 to-violet-600/10", text: "text-fuchsia-300", border: "border-fuchsia-400/25", icon: Award },
];
const BANDS = ["K-2", "3-5", "6-8", "9-12"] as const;

function SiteHeader({ left }: { left?: string }) {
  return (
    <header className="relative z-20 border-b border-white/10 bg-[#0d0b1a]/92">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-2.5">
        <div className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground"><ArrowLeft className="h-3 w-3" /> {left ?? "Back"}</div>
        <h1 className="text-xl font-black tracking-[-.025em] text-white">A.R.I.S.E<span className="arise-gradient-text"> Reader</span></h1>
      </div>
    </header>
  );
}

// ── 6. Leaderboard ──────────────────────────────────────────────────────────────────────────────────────

const ADVISORIES = [
  { rank: 1, teacher: "Ms. Rivera", students: 24, quizzes: 63, points: 412 },
  { rank: 2, teacher: "Mr. Okafor", students: 22, quizzes: 58, points: 385 },
  { rank: 3, teacher: "Mrs. Chen", students: 25, quizzes: 51, points: 340 },
  { rank: 4, teacher: "Mr. Davis", students: 21, quizzes: 40, points: 296 },
];

export function LeaderboardScene({ beat }: SceneProps) {
  const controlsRef = useRef<HTMLDivElement>(null);
  const podiumRef = useRef<HTMLDivElement>(null);
  // beat 2: after a few seconds the toggle moves from Monthly to All-Time
  const allTimeTapped = useSince(beat, 7200, beat === 2);
  const period: "monthly" | "all-time" = beat >= 3 ? "monthly" : beat === 2 && allTimeTapped ? "all-time" : "monthly";
  const current = schoolYearMonth();
  const months = recentSchoolMonths(6);
  const y = useScrollY(() => (beat === 2 ? controlsRef.current : beat === 3 ? podiumRef.current : null), [beat]);
  const rows = SAMPLE_READERS.map((r) => ({ name: r.name, points: period === "monthly" ? r.month : r.all, passed: r.passed }));
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  if (beat === 0) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-background text-foreground">
        <LibraryHeader menu spotProgress />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden arise-page-bg text-foreground">
      <SiteHeader left="Back" />
      <div className="absolute inset-x-0 bottom-0 top-[49px] overflow-hidden">
        <Scroll y={y}>
          {beat === 4 ? (
            <main className="mx-auto max-w-3xl px-4 py-5">
              <div className="sw-in mb-4 flex items-center justify-center gap-2">
                <div className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold ${QUIET}`}><Trophy className="h-4 w-4" />Individual</div>
                <div className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold ${GRADIENT}`}><Users className="h-4 w-4" />Advisory Challenge</div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-violet-400/25 shadow-[0_24px_70px_rgba(0,0,0,.24)]">
                <div className="flex items-center gap-3 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 px-5 py-3">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white/20"><Users className="h-6 w-6 text-white" /></div>
                  <div><h2 className="text-xl font-bold text-white">Advisory Challenge</h2><p className="text-sm text-white/90">Which advisory class has read its way to the most points?</p></div>
                </div>
                <div className="bg-[#151326] p-4">
                  <div className="space-y-2.5">
                    {ADVISORIES.map((adv) => (
                      <Spot key={adv.teacher} on={adv.rank === 1} radius={14}>
                        <div className={`flex items-center gap-4 rounded-xl p-3 ${adv.rank === 1 ? "border border-violet-400/25 bg-gradient-to-r from-violet-500/12 via-fuchsia-500/[.08] to-cyan-400/[.08]" : "border border-border bg-muted/30"}`}>
                          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-bold ${adv.rank === 1 ? "bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 text-white" : adv.rank === 2 ? "bg-gradient-to-br from-gray-300 to-gray-400 text-white" : adv.rank === 3 ? "bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white" : "bg-muted text-muted-foreground"}`}>{adv.rank}</div>
                          <div className="min-w-0 flex-1"><h3 className="text-base font-bold text-foreground">{adv.teacher}'s Advisory</h3><p className="mt-0.5 text-xs text-muted-foreground">{adv.students} students · {adv.quizzes} quizzes completed</p></div>
                          <div className="flex-shrink-0 text-right"><div className="text-lg font-bold text-violet-300">{adv.points}</div><div className="text-[10px] text-muted-foreground">pts</div></div>
                        </div>
                      </Spot>
                    ))}
                  </div>
                  <p className="mt-3 text-center text-xs text-muted-foreground">Points are earned by every student in each advisory class through reading quizzes. The advisory with the highest total at the end of the competition wins the challenge.</p>
                </div>
              </div>
            </main>
          ) : (
            <main className="mx-auto max-w-3xl px-4 py-5">
              <div className="mb-5 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl arise-icon-tile"><Trophy className="h-7 w-7 text-white" /></div>
                <h1 className="mb-2 text-4xl font-black tracking-[-.035em] text-white">Leaderboard</h1>
                <Spot on={beat === 1} radius={999} className="mb-2 inline-block">
                  <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-gradient-to-r from-violet-500/14 via-fuchsia-500/10 to-cyan-400/12 px-4 py-2"><GraduationCap className="h-4 w-4 text-primary" /><span className="text-sm font-bold text-violet-200">Your Group: Grades 3-5</span></div>
                </Spot>
                <p className="text-sm text-muted-foreground">Top readers ranked by points earned</p>
                <p className="mt-1 text-xs text-muted-foreground">You are competing only with students in your grade band.</p>
              </div>

              <div ref={controlsRef}>
                <div className="mb-4 flex items-center justify-center gap-2">
                  <div className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold ${GRADIENT}`}><Trophy className="h-4 w-4" />Individual</div>
                  <div className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold ${QUIET}`}><Users className="h-4 w-4" />Advisory Challenge</div>
                </div>
                <Spot on={beat === 1} radius={14} className="mb-4">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <div className={`rounded-lg px-4 py-2 text-sm font-medium ${GRADIENT}`}><Users className="mr-1 inline h-3 w-3" />All Bands</div>
                    {BANDS.map((b) => <div key={b} className={`rounded-lg px-4 py-2 text-sm font-medium ${QUIET}`}>Grades {b}</div>)}
                  </div>
                </Spot>
                <Spot on={beat === 2} radius={14} className="mb-4">
                  <div className="flex items-center justify-center gap-2">
                    <div className={`rounded-lg px-4 py-2 text-sm font-medium ${period === "monthly" ? GRADIENT : QUIET} ${allTimeTapped && beat === 2 ? "sw-press" : ""}`}>Monthly</div>
                    <div className={`rounded-lg px-4 py-2 text-sm font-medium ${period === "all-time" ? GRADIENT : QUIET} ${allTimeTapped && beat === 2 ? "sw-press" : ""}`}>All-Time</div>
                  </div>
                </Spot>
                {period === "monthly" && (
                  <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                    {months.map((ym) => (
                      <div key={ym} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${ym === current ? "border border-primary/50 bg-primary/20 text-primary" : "border border-white/10 bg-white/[.04] text-slate-400"}`}>{ym === current ? `${monthLabel(ym)} (now)` : monthLabel(ym)}</div>
                    ))}
                  </div>
                )}
                {period === "monthly" && <Spot on={beat === 2 && !allTimeTapped} radius={16} className="mb-4"><MonthCountdown /></Spot>}
                <div className="mb-4 text-center"><span className="text-sm text-muted-foreground">{period === "monthly" ? monthLabel(current) : "All-Time"} Leaderboard</span></div>
              </div>

              <div ref={podiumRef}>
                <Spot on={beat === 3} radius={18} className="mb-4">
                  <div className="grid grid-cols-3 gap-3">
                    {top3.map((entry, idx) => {
                      const colors = MEDALS[idx];
                      const Icon = colors.icon;
                      return (
                        <Card key={entry.name} className={`arise-surface overflow-hidden border-2 shadow-lg ${colors.border} ${idx === 0 ? "order-2 scale-105" : idx === 1 ? "order-1" : "order-3"}`}>
                          <div className={`${colors.bg} p-3 text-center`}>
                            <div className={`mx-auto mb-1.5 flex h-11 w-11 items-center justify-center rounded-full ${colors.bg}`}><Icon className={`h-6 w-6 ${colors.text}`} /></div>
                            <p className={`text-lg font-bold ${colors.text}`}>#{idx + 1}</p>
                            <p className="mt-1 truncate text-sm font-bold text-white">{entry.name}</p>
                          </div>
                          <CardContent className="p-3 text-center">
                            <div className="text-2xl font-bold text-violet-300">{entry.points}</div>
                            <div className="text-xs text-muted-foreground">points</div>
                            <div className="mt-1 text-xs text-muted-foreground">{passedLabel(entry.passed)}</div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </Spot>
                <Card className="arise-surface border-white/10 shadow-md">
                  <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Trophy className="h-4 w-4 text-primary" />All Rankings</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {rest.map((entry, i) => (
                        <div key={entry.name} className="flex items-center gap-3 rounded-xl border border-white/[.06] bg-white/[.035] p-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-violet-500/20 to-cyan-400/15 text-sm font-bold text-slate-300">{i + 4}</div>
                          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{entry.name}</p><p className="text-xs text-muted-foreground">{passedLabel(entry.passed)}</p></div>
                          <div className="flex-shrink-0 text-right"><div className="text-sm font-bold text-violet-300">{entry.points}</div><div className="text-xs text-muted-foreground">pts</div></div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </main>
          )}
        </Scroll>
      </div>
    </div>
  );
}

// ── 7. Competitions ─────────────────────────────────────────────────────────────────────────────────────

const BAND_LABELS: Record<string, string> = { "K-2": "K-2 Band", "3-5": "3-5 Band", "6-8": "6-8 Band", "9-12": "9-12 Band" };
const BAND_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "K-2": { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400" },
  "3-5": { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400" },
  "6-8": { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400" },
  "9-12": { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400" },
};
const MEDAL_ICONS = [Crown, Medal, Award];
const MEDAL_TEXT = ["text-yellow-400", "text-gray-300", "text-orange-500"];
const BAND_LEADERS: Record<string, { name: string; passed: number; points: number }[]> = {
  "K-2": [{ name: "Ella P.", passed: 7, points: 55 }, { name: "Omar S.", passed: 6, points: 50 }, { name: "Zoe H.", passed: 5, points: 40 }],
  "3-5": [{ name: "Maya R.", passed: 11, points: 85 }, { name: "Devon K.", passed: 9, points: 70 }, { name: "Aaliyah J.", passed: 8, points: 60 }],
  "6-8": [{ name: "Marcus T.", passed: 8, points: 95 }, { name: "Sophia L.", passed: 6, points: 80 }, { name: "Noah B.", passed: 6, points: 70 }],
  "9-12": [{ name: "Lily C.", passed: 5, points: 90 }, { name: "Jamal W.", passed: 4, points: 75 }, { name: "Ava M.", passed: 4, points: 60 }],
};

function LeaderRow({ idx, name, passed, points, big }: { idx: number; name: string; passed: number; points: number; big?: boolean }) {
  const Icon = MEDAL_ICONS[idx] || Star;
  const first = idx === 0;
  return (
    <div className={`flex items-center gap-3 ${big ? "rounded-xl p-3" : "rounded-lg p-2.5"} ${first ? "border border-yellow-500/20 bg-yellow-500/10" : "bg-muted/20"}`}>
      <div className={`flex ${big ? "h-10 w-10" : "h-8 w-8"} flex-shrink-0 items-center justify-center rounded-full ${first ? "bg-yellow-500/30" : "bg-muted"}`}><Icon className={`${big ? "h-5 w-5" : "h-4 w-4"} ${MEDAL_TEXT[idx]}`} /></div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{name}</p><p className="text-[10px] text-muted-foreground">{passedLabel(passed)}</p></div>
      <div className="flex-shrink-0 text-right"><div className={`${big ? "text-lg" : "text-sm"} font-bold text-primary`}>{points}</div><div className="text-[10px] text-muted-foreground">pts</div></div>
      {first && <span className="whitespace-nowrap rounded-full bg-yellow-500/30 px-2 py-0.5 text-[10px] font-bold text-yellow-300">CURRENT LEADER</span>}
    </div>
  );
}

export function CompetitionScene({ beat }: SceneProps) {
  const bandsRef = useRef<HTMLDivElement>(null);
  const prizesRef = useRef<HTMLDivElement>(null);
  // beat 0: after a while the page scrolls down to the readers of each band
  const bands = useSince(beat, 6200, beat === 0);
  // beat 1: the Reader of the Year tab is tapped
  const yearTap = useSince(beat, 1500, beat === 1);
  const yearly = beat === 1 && yearTap;
  const showPrizes = beat >= 2;
  const y = useScrollY(() => (beat === 0 && bands ? bandsRef.current : beat === 2 ? prizesRef.current : null), [beat, bands], 10);
  const current = schoolYearMonth();

  return (
    <div className="relative h-full w-full overflow-hidden bg-background text-foreground">
      <SiteHeader />
      <div className="absolute inset-x-0 bottom-0 top-[49px] overflow-hidden">
        <Scroll y={y}>
          <main className="mx-auto max-w-3xl px-4 py-5">
            <div className="mb-4 text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-500/30 to-orange-600/10"><Trophy className="h-8 w-8 text-yellow-400" /></div>
              <h1 className="mb-1 text-4xl font-bold text-white">Reading Competition</h1>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">Read books, pass quizzes, and earn points to climb the monthly and yearly leaderboards.</p>
            </div>

            {showPrizes && (
              <div className="sw-in mb-4" ref={prizesRef}>
                <Spot on={beat === 2} radius={18}>
                  <section className="pz" aria-label="Prizes you can win">
                    <div className="pz-head"><h3>Prizes you can win</h3><p>These come from your family, your teacher or your school.</p></div>
                    <ul className="pz-list">
                      <Ticket scope="class" state="open"><h4 className="pz-title">Pizza party</h4><p className="pz-from">From Ms. Rivera</p><p className="pz-how">Pass 10 quizzes as a class</p><QuizProgress passed={7} goal={10} /></Ticket>
                      <Ticket scope="school" state="open"><h4 className="pz-title">Lunch with the principal</h4><p className="pz-from">From your school</p><p className="pz-how">Be Reader of the Month</p></Ticket>
                      <Ticket scope="family" state="open"><h4 className="pz-title">Pick the family movie</h4><p className="pz-from">From home</p><p className="pz-how">Pass 5 quizzes this month</p><QuizProgress passed={3} goal={5} /></Ticket>
                    </ul>
                  </section>
                </Spot>
              </div>
            )}

            <div className="mb-4 flex items-center justify-center gap-2">
              <div className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold ${!yearly ? "bg-primary text-primary-foreground" : "border border-border bg-muted/30 text-foreground"}`}><Calendar className="h-4 w-4" />Monthly</div>
              <Spot on={beat === 1 && !yearTap} radius={10}>
                <div className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold ${yearly ? "bg-primary text-primary-foreground" : "border border-border bg-muted/30 text-foreground"} ${yearTap && beat === 1 ? "sw-press" : ""}`}><Star className="h-4 w-4" />Reader of the Year</div>
              </Spot>
            </div>

            {!yearly ? (
              <div className="space-y-5">
                <div className="text-center"><span className="text-sm font-medium text-muted-foreground">{monthLabel(current)} Leaderboard</span></div>
                <Spot on={beat === 0 && !bands} radius={14}>
                  <Card className="overflow-hidden border border-yellow-500/20 shadow-md">
                    <div className="bg-gradient-to-r from-yellow-500/15 to-transparent px-4 py-3"><div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-400" /><h3 className="text-sm font-bold text-white">Top Readers This Month — All Bands</h3></div></div>
                    <CardContent className="p-3"><div className="space-y-2">{[BAND_LEADERS["6-8"][0], BAND_LEADERS["9-12"][0], BAND_LEADERS["3-5"][0]].sort((a, b) => b.points - a.points).map((e, i) => <LeaderRow key={e.name} idx={i} {...e} />)}</div></CardContent>
                  </Card>
                </Spot>
                <div ref={bandsRef}>
                  <div className="mb-3 flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold text-white">Top Readers by Band — {monthLabel(current)}</h2></div>
                  <div className="space-y-4">
                    {Object.keys(BAND_LEADERS).map((band) => {
                      const colors = BAND_COLORS[band];
                      return (
                        <Card key={band} className={`overflow-hidden border shadow-md ${colors.border}`}>
                          <div className={`${colors.bg} flex items-center gap-2 px-4 py-3`}><GraduationCap className={`h-4 w-4 ${colors.text}`} /><h3 className={`text-sm font-bold ${colors.text}`}>{BAND_LABELS[band]}</h3><span className="ml-auto text-[10px] text-muted-foreground">Top 3</span></div>
                          <CardContent className="p-3"><div className="space-y-2">{BAND_LEADERS[band].map((e, i) => <LeaderRow key={e.name} idx={i} {...e} />)}</div></CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="sw-in space-y-5">
                <Card className="overflow-hidden border-2 border-primary/30 shadow-lg">
                  <div className="bg-gradient-to-r from-primary/20 to-primary/5 p-4"><div className="mb-2 flex items-center gap-2"><Star className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold text-white">Reader of the Year</h2></div>
                    <p className="text-sm text-muted-foreground">The readers with the most points all year earn the title. The competition is still going, so nothing is final yet.</p></div>
                </Card>
                <div className="text-center"><span className="text-sm font-medium text-muted-foreground">{new Date().getFullYear()} All-Time Leaderboard — Competition Ongoing</span></div>
                <Spot on radius={16}>
                  <Card className="overflow-hidden border-2 border-yellow-500/30 shadow-lg">
                    <div className="bg-gradient-to-r from-yellow-500/20 to-orange-600/10 p-4">
                      <div className="mb-2 flex items-center gap-2"><Star className="h-5 w-5 text-yellow-400" /><h2 className="text-lg font-bold text-white">Reader of the Year</h2><span className="rounded-full bg-yellow-500/30 px-2 py-0.5 text-[10px] font-bold text-yellow-300">IN PROGRESS</span></div>
                      <p className="mb-3 text-sm text-muted-foreground">Current leaders across the entire platform for {new Date().getFullYear()}. Nothing is final — keep reading!</p>
                      <div className="space-y-2">{SAMPLE_READERS.slice(0, 3).map((e, i) => <LeaderRow key={e.name} idx={i} name={e.name} passed={e.passed} points={e.all} big />)}</div>
                    </div>
                  </Card>
                </Spot>
              </div>
            )}
          </main>
        </Scroll>
      </div>
    </div>
  );
}

// ── 8. Wrap-up ──────────────────────────────────────────────────────────────────────────────────────────

const PLAN = [
  { Icon: LogIn, text: "Log in" },
  { Icon: Search, text: "Find a book" },
  { Icon: BookOpen, text: "Read it" },
  { Icon: CheckCircle2, text: "Pass the quiz" },
  { Icon: Trophy, text: "Earn points" },
  { Icon: Crown, text: "Climb the leaderboard" },
];

export function WrapScene({ beat }: SceneProps) {
  return (
    <div className="relative grid h-full w-full place-items-center overflow-hidden arise-page-bg px-10 text-center text-white">
      {beat === 0 ? (
        <div className="w-full max-w-[780px]">
          <h1 className="mb-6 text-5xl font-black tracking-[-.04em]">Your plan</h1>
          <div className="grid grid-cols-3 gap-4">
            {PLAN.map(({ Icon, text }, i) => (
              <div key={text} className="sw-in rounded-2xl border border-white/10 arise-surface p-4" style={{ animationDelay: `${i * 0.9}s` }}>
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl arise-icon-tile"><Icon className="h-6 w-6 text-white" /></div>
                <p className="mt-3 text-lg font-black leading-tight">{text}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="sw-in">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-cyan-400 shadow-2xl"><BookOpen className="h-10 w-10 text-white" /></div>
          <h1 className="mt-5 text-6xl font-black tracking-[-.04em]">Let's get <span className="arise-gradient-text">reading!</span></h1>
          <Spot on radius={999} className="mx-auto mt-7 inline-block">
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[#1b1830] px-8 py-3 text-3xl font-black">{SITE}</div>
          </Spot>
        </div>
      )}
    </div>
  );
}
