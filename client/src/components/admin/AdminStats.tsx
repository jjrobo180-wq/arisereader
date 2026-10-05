// The admin Stats tab: growth, who's using the app and when, sign-ins, quizzes, points and
// reading checks, with charts that fit a phone. Loaded only when the tab is opened.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import {
  Activity, AlertCircle, BookOpen, Clock, GraduationCap, LogIn, Monitor, RefreshCw, School, Sparkles,
  Star, Trophy, TrendingDown, TrendingUp, UserPlus, Users, type LucideIcon,
} from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { AdminSection, Avatar, EmptyState, SegmentedTabs, StatusPill, TONE_TILE, type Tone } from "@/components/admin/AdminUi";
import {
  QUIET_AFTER_DAYS, STATS_RANGES, STATS_RANGE_LABEL, isStatsRange,
  type AdminStats as Stats, type StatsDelta, type StatsRange, type StatsRole,
} from "@shared/adminStats";

const RANGE_STORAGE = "arise_admin_stats_range";
const COLORS = {
  violet: "#a78bfa", cyan: "#22d3ee", amber: "#fbbf24", emerald: "#34d399", fuchsia: "#e879f9", blue: "#60a5fa", slate: "#94a3b8", orange: "#fb923c",
};

const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const longDayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const shortDay = (key: string) => dayFormat.format(new Date(`${key}T00:00:00Z`));
const hourLabel = (h: number) => (h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`);
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

function ago(value: string | null | undefined) {
  if (!value) return "never";
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sinceText(value: string | null) {
  if (!value) return "";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

const ROLE_TONE: Record<StatsRole, Tone> = { student: "violet", teacher: "cyan", parent: "amber" };

// ─── Small pieces ────────────────────────────────────────────────────────────

function Delta({ delta, label }: { delta: StatsDelta; label: string }) {
  if (delta.before === null) return null;
  const diff = delta.now - delta.before;
  if (diff === 0) return <span className="text-[11px] text-muted-foreground">Same as the {label} before</span>;
  const up = diff > 0;
  const text = delta.before === 0 ? `${up ? "+" : ""}${num(diff)}` : `${up ? "+" : ""}${Math.round((diff / delta.before) * 100)}%`;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", up ? "text-emerald-400" : "text-red-400")}>
      <Icon className="h-3.5 w-3.5" />
      {text}
      <span className="font-normal text-muted-foreground">vs the {label} before</span>
    </span>
  );
}

function Kpi({ icon: Icon, tone, label, value, sub, delta, testId }: { icon: LucideIcon; tone: Tone; label: string; value: ReactNode; sub?: ReactNode; delta?: ReactNode; testId?: string }) {
  return (
    <div data-stat={testId} className="min-w-0 rounded-2xl border border-card-border bg-card p-3 shadow-sm sm:p-4">
      <div className="flex items-center gap-2">
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", TONE_TILE[tone])}><Icon className="h-4 w-4" /></span>
        <span className="min-w-0 text-xs font-semibold leading-tight text-muted-foreground">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-black leading-none tabular-nums sm:text-[28px]">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{sub}</div>}
      {delta && <div className="mt-1.5">{delta}</div>}
    </div>
  );
}

function ChartCard({ id, icon, tone, title, description, actions, children, empty }: {
  id: string; icon: LucideIcon; tone: Tone; title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; empty?: string | false;
}) {
  return (
    <AdminSection id={id} icon={icon} tone={tone} title={title} description={description} actions={actions} bodyClassName="px-2 pb-3 pt-4 sm:px-4">
      {empty ? <EmptyState title={empty} className="mx-2 py-10" /> : children}
    </AdminSection>
  );
}

/** A labelled bar made of plain HTML, for short lists like devices and grades. */
function BarRow({ label, value, max, tone, suffix }: { label: string; value: number; max: number; tone: keyof typeof COLORS; suffix?: string }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 font-semibold tabular-nums">{num(value)}{suffix}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: COLORS[tone] }} />
      </div>
    </div>
  );
}

function PersonLine({ name, role, school, onOpen, right, detail }: {
  name: string; role: StatsRole; school?: string | null; onOpen?: () => void; right?: ReactNode; detail?: ReactNode;
}) {
  const body = (
    <>
      <Avatar name={name} tone={ROLE_TONE[role]} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="min-w-0 font-semibold leading-tight [overflow-wrap:anywhere]">{name}</span>
          {role !== "student" && <StatusPill tone={ROLE_TONE[role]}>{role}</StatusPill>}
        </span>
        {(detail || school) && <span className="mt-0.5 block text-xs text-muted-foreground [overflow-wrap:anywhere]">{detail ?? school}</span>}
      </span>
      {right && <span className="shrink-0 text-right text-xs text-muted-foreground">{right}</span>}
    </>
  );
  const cls = "flex w-full min-w-0 items-center gap-3 rounded-xl px-2 py-2 text-left text-sm";
  return onOpen
    ? <button type="button" onClick={onOpen} className={cn(cls, "hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none")}>{body}</button>
    : <div className={cls}>{body}</div>;
}

// ─── The tab ─────────────────────────────────────────────────────────────────

export default function AdminStats({ token, onOpenStudent }: { token: string; onOpenStudent?: (userId: number) => void }) {
  const [range, setRange] = useState<StatsRange>(() => {
    try { const saved = sessionStorage.getItem(RANGE_STORAGE); if (isStatsRange(saved)) return saved; } catch {}
    return "30d";
  });
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [growthView, setGrowthView] = useState<"total" | "new">("total");
  const request = useRef(0);

  const load = useCallback(async (fresh = false) => {
    const id = ++request.current;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/stats?range=${range}${fresh ? "&fresh=1" : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await res.json().catch(() => ({}));
      if (id !== request.current) return;
      if (!res.ok) throw new Error(body?.message || "Could not load the stats.");
      setStats(body as Stats);
      setError("");
    } catch (e: any) {
      if (id === request.current) setError(e?.message || "Could not load the stats.");
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [range, token]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    try { sessionStorage.setItem(RANGE_STORAGE, range); } catch {}
  }, [range]);
  // keep "online now" and today's numbers current while the tab is open
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const rangeLabel = range === "all" ? "all time" : `last ${STATS_RANGE_LABEL[range]}`;
  const periodWord = range === "all" ? "" : STATS_RANGE_LABEL[range];
  const week = stats?.bucket === "week";
  const tickFormatter = (key: string) => shortDay(key);
  const tooltipLabel = (key: unknown) => (typeof key === "string" && /^\d{4}-\d{2}-\d{2}$/.test(key)
    ? (week ? `Week of ${shortDay(key)}` : longDayFormat.format(new Date(`${key}T00:00:00Z`)))
    : String(key ?? ""));

  const series = useMemo(() => {
    const b = stats?.buckets ?? [];
    const sum = (f: (x: (typeof b)[number]) => number) => b.reduce((s, x) => s + f(x), 0);
    return {
      buckets: b,
      anyNew: sum((x) => x.newStudents + x.newTeachers + x.newParents) > 0,
      anyActivity: sum((x) => x.activeStudents + x.studentLogins + x.staffLogins) > 0,
      anyQuizzes: sum((x) => x.bookQuizzes + x.eyeGazeQuizzes + x.assessments) > 0,
      anyPoints: sum((x) => x.points) > 0,
      hours: (stats?.hours ?? []).map((count, hour) => ({ hour: hourLabel(hour), count })),
      weekdays: (stats?.weekdays ?? []).map((count, i) => ({ day: WEEKDAYS[i], count })),
    };
  }, [stats]);

  const growthConfig: ChartConfig = { totalStudents: { label: "Students", color: COLORS.violet }, totalTeachers: { label: "Teachers", color: COLORS.cyan }, totalParents: { label: "Parents", color: COLORS.amber } };
  const newConfig: ChartConfig = { newStudents: { label: "Students", color: COLORS.violet }, newTeachers: { label: "Teachers", color: COLORS.cyan }, newParents: { label: "Parents", color: COLORS.amber } };
  const activityConfig: ChartConfig = { activeStudents: { label: "Active students", color: COLORS.emerald }, studentLogins: { label: "Student sign-ins", color: COLORS.blue }, staffLogins: { label: "Teacher & parent sign-ins", color: COLORS.slate } };
  const quizConfig: ChartConfig = { bookQuizzes: { label: "Book quizzes", color: COLORS.violet }, eyeGazeQuizzes: { label: "Eye Gazer quizzes", color: COLORS.fuchsia }, assessments: { label: "Reading checks", color: COLORS.cyan }, passed: { label: "Passed", color: COLORS.emerald } };
  const pointsConfig: ChartConfig = { points: { label: "Points", color: COLORS.amber } };
  const hourConfig: ChartConfig = { count: { label: "Students", color: COLORS.blue } };
  const dayConfig: ChartConfig = { count: { label: "Student visits", color: COLORS.emerald } };
  const chartBox = "aspect-auto h-56 w-full sm:h-64";
  const axis = { tickLine: false, axisLine: false, fontSize: 11 } as const;

  const header = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-black sm:text-2xl">Stats</h1>
          <p className="mt-1 text-sm text-muted-foreground">How A.R.I.S.E Reader is growing and how students are using it.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={loading} className="gap-2" data-testid="stats-refresh">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          {stats ? `Updated ${new Date(stats.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "Refresh"}
        </Button>
      </div>
      <SegmentedTabs
        value={range}
        onChange={setRange}
        dataAttr="data-stats-range"
        ariaLabel="Time range"
        options={STATS_RANGES.map((r) => ({ value: r, label: STATS_RANGE_LABEL[r] }))}
      />
    </div>
  );

  if (!stats) {
    return (
      <div className="space-y-4">
        {header}
        {error ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <span className="min-w-0 flex-1">{error}</span>
            <Button size="sm" variant="outline" onClick={() => void load(true)}>Try again</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl border border-card-border bg-card" />)}
          </div>
        )}
      </div>
    );
  }

  const t = stats.totals;
  const activeShare = t.students ? Math.round((t.activeStudents.now / t.students) * 100) : 0;
  const maxDevice = Math.max(0, ...stats.devices.map((d) => d.count));
  const maxGrade = Math.max(0, ...stats.grades.map((g) => g.students));
  const maxSchool = Math.max(0, ...stats.schools.map((s) => s.students));
  const open = (role: StatsRole, userId: number) => (role === "student" && onOpenStudent ? () => onOpenStudent(userId) : undefined);

  return (
    <div className="space-y-4" data-stats-range-shown={stats.range}>
      {header}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error} Showing the last numbers that loaded.
        </div>
      )}

      {/* right now */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/[.06] px-4 py-3 text-sm">
        <span className="inline-flex items-center gap-2 font-semibold">
          <span className="relative flex h-2.5 w-2.5">
            {t.onlineNow > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
            <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", t.onlineNow > 0 ? "bg-emerald-400" : "bg-muted-foreground/50")} />
          </span>
          {t.onlineNow} online now
        </span>
        <span className="text-muted-foreground">{t.activeToday} student{t.activeToday === 1 ? "" : "s"} on today</span>
        {stats.onlineNow.length > 0 && (
          <span className="flex min-w-0 flex-wrap gap-1.5">
            {stats.onlineNow.slice(0, 12).map((p) => (
              <span key={p.userId} className={cn("inline-flex max-w-[12rem] items-center truncate rounded-full px-2 py-0.5 text-xs font-semibold", TONE_TILE[ROLE_TONE[p.role]])} title={`${p.name} · ${ago(p.lastSeen)}`}>
                {p.name}
              </span>
            ))}
            {stats.onlineNow.length > 12 && <span className="text-xs text-muted-foreground">+{stats.onlineNow.length - 12} more</span>}
          </span>
        )}
      </div>

      {/* headline numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi testId="students" icon={Users} tone="violet" label="Students" value={num(t.students)}
          sub={t.newStudents.now ? `+${num(t.newStudents.now)} new ${range === "all" ? "" : `in ${periodWord}`}` : `No new students ${range === "all" ? "yet" : `in ${periodWord}`}`}
          delta={<Delta delta={t.newStudents} label={periodWord} />} />
        <Kpi testId="active" icon={Activity} tone="emerald" label="Active students" value={num(t.activeStudents.now)}
          sub={`${activeShare}% of students, ${rangeLabel}`} delta={<Delta delta={t.activeStudents} label={periodWord} />} />
        <Kpi testId="logins" icon={LogIn} tone="blue" label="Sign-ins" value={num(t.logins.now)}
          sub={rangeLabel} delta={<Delta delta={t.logins} label={periodWord} />} />
        <Kpi testId="quizzes" icon={BookOpen} tone="fuchsia" label="Quizzes taken" value={num(t.quizzes.now)}
          sub={t.passRate === null ? rangeLabel : `${t.passRate}% passed (${num(t.passed)})`} delta={<Delta delta={t.quizzes} label={periodWord} />} />
        <Kpi testId="points" icon={Star} tone="amber" label="Points earned" value={num(t.points.now)}
          sub={`${num(t.feedViews)} book feed views`} delta={<Delta delta={t.points} label={periodWord} />} />
        <Kpi testId="staff" icon={GraduationCap} tone="cyan" label="Teachers & parents" value={`${num(t.teachers)} · ${num(t.parents)}`}
          sub={`${t.activeTeachers} teacher${t.activeTeachers === 1 ? "" : "s"} and ${t.activeParents} parent${t.activeParents === 1 ? "" : "s"} active`}
          delta={(t.newTeachers.now || t.newParents.now) ? <span className="text-[11px] text-muted-foreground">+{t.newTeachers.now} teacher{t.newTeachers.now === 1 ? "" : "s"}, +{t.newParents.now} parent{t.newParents.now === 1 ? "" : "s"} {range === "all" ? "" : `in ${periodWord}`}</span> : undefined} />
      </div>

      {/* growth */}
      <ChartCard
        id="stats-growth" icon={TrendingUp} tone="violet" title="Growth"
        description={growthView === "total" ? `Accounts over time${week ? ", by week" : ""}.` : `New accounts ${week ? "each week" : "each day"}.`}
        actions={
          <SegmentedTabs value={growthView} onChange={setGrowthView} dataAttr="data-growth-view" ariaLabel="Growth view"
            options={[{ value: "total", label: "Total" }, { value: "new", label: "New sign-ups" }]} />
        }
        empty={growthView === "new" && !series.anyNew ? `No new accounts in the ${rangeLabel}.` : false}
      >
        {growthView === "total" ? (
          <ChartContainer config={growthConfig} className={chartBox}>
            <AreaChart data={series.buckets} margin={{ left: 0, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="key" {...axis} tickFormatter={tickFormatter} minTickGap={24} />
              <YAxis {...axis} width={32} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={tooltipLabel} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Area type="monotone" dataKey="totalStudents" stackId="t" stroke="var(--color-totalStudents)" fill="var(--color-totalStudents)" fillOpacity={0.25} />
              <Area type="monotone" dataKey="totalTeachers" stackId="t" stroke="var(--color-totalTeachers)" fill="var(--color-totalTeachers)" fillOpacity={0.25} />
              <Area type="monotone" dataKey="totalParents" stackId="t" stroke="var(--color-totalParents)" fill="var(--color-totalParents)" fillOpacity={0.25} />
            </AreaChart>
          </ChartContainer>
        ) : (
          <ChartContainer config={newConfig} className={chartBox}>
            <BarChart data={series.buckets} margin={{ left: 0, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="key" {...axis} tickFormatter={tickFormatter} minTickGap={24} />
              <YAxis {...axis} width={32} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={tooltipLabel} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="newStudents" stackId="n" fill="var(--color-newStudents)" />
              <Bar dataKey="newTeachers" stackId="n" fill="var(--color-newTeachers)" />
              <Bar dataKey="newParents" stackId="n" fill="var(--color-newParents)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </ChartCard>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ChartCard
          id="stats-activity" icon={Activity} tone="emerald" title="Students using the app"
          description={`Active students and sign-ins ${week ? "each week" : "each day"}. A student is active if they opened the app or did anything in it.`}
          empty={!series.anyActivity ? `No activity in the ${rangeLabel}.` : false}
        >
          <ChartContainer config={activityConfig} className={chartBox}>
            <ComposedChart data={series.buckets} margin={{ left: 0, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="key" {...axis} tickFormatter={tickFormatter} minTickGap={24} />
              <YAxis {...axis} width={32} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={tooltipLabel} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="studentLogins" stackId="l" fill="var(--color-studentLogins)" fillOpacity={0.8} />
              <Bar dataKey="staffLogins" stackId="l" fill="var(--color-staffLogins)" fillOpacity={0.6} radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="activeStudents" stroke="var(--color-activeStudents)" strokeWidth={2.5} dot={series.buckets.length <= 31} />
            </ComposedChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          id="stats-quizzes" icon={BookOpen} tone="fuchsia" title="Quizzes"
          description={`Quizzes and reading checks finished ${week ? "each week" : "each day"}, and how many were passed (70% or better).`}
          empty={!series.anyQuizzes ? `No quizzes in the ${rangeLabel}.` : false}
        >
          <ChartContainer config={quizConfig} className={chartBox}>
            <ComposedChart data={series.buckets} margin={{ left: 0, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="key" {...axis} tickFormatter={tickFormatter} minTickGap={24} />
              <YAxis {...axis} width={32} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={tooltipLabel} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="bookQuizzes" stackId="q" fill="var(--color-bookQuizzes)" />
              <Bar dataKey="eyeGazeQuizzes" stackId="q" fill="var(--color-eyeGazeQuizzes)" />
              <Bar dataKey="assessments" stackId="q" fill="var(--color-assessments)" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="passed" stroke="var(--color-passed)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ChartContainer>
        </ChartCard>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ChartCard
          id="stats-hours" icon={Clock} tone="blue" title="When students use it"
          description={`Students on the app in each hour of the day (Mountain Time), ${rangeLabel}.`}
          empty={!series.hours.some((h) => h.count) ? `No activity in the ${rangeLabel}.` : false}
        >
          <ChartContainer config={hourConfig} className="aspect-auto h-48 w-full">
            <BarChart data={series.hours} margin={{ left: 0, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="hour" {...axis} interval={2} />
              <YAxis {...axis} width={28} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </ChartCard>
        <ChartCard
          id="stats-weekdays" icon={Sparkles} tone="emerald" title="Busiest days"
          description={`Student visits by day of the week, ${rangeLabel}.`}
          empty={!series.weekdays.some((d) => d.count) ? `No activity in the ${rangeLabel}.` : false}
        >
          <ChartContainer config={dayConfig} className="aspect-auto h-48 w-full">
            <BarChart data={series.weekdays} margin={{ left: 0, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="day" {...axis} />
              <YAxis {...axis} width={28} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </ChartCard>
      </div>

      <ChartCard
        id="stats-points" icon={Star} tone="amber" title="Points earned"
        description={`Points from quizzes and points added by staff, ${week ? "each week" : "each day"}.`}
        empty={!series.anyPoints ? `No points earned in the ${rangeLabel}.` : false}
      >
        <ChartContainer config={pointsConfig} className="aspect-auto h-48 w-full">
          <BarChart data={series.buckets} margin={{ left: 0, right: 8, top: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="key" {...axis} tickFormatter={tickFormatter} minTickGap={24} />
            <YAxis {...axis} width={32} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={tooltipLabel} />} />
            <Bar dataKey="points" fill="var(--color-points)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      {/* people */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <AdminSection id="stats-top" icon={Trophy} tone="amber" title="Most active students" description={`Days on the app, quizzes and points, ${rangeLabel}.`} bodyClassName="p-2 sm:p-3">
          {stats.topStudents.length === 0 ? <EmptyState title={`No student activity in the ${rangeLabel}.`} className="m-2" /> : (
            <ol className="space-y-0.5">
              {stats.topStudents.map((s, i) => (
                <li key={s.userId} className="flex min-w-0 items-center gap-1">
                  <span className={cn("w-6 shrink-0 text-center text-xs font-black tabular-nums", i < 3 ? "text-amber-300" : "text-muted-foreground")}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <PersonLine
                      name={s.name} role={s.role} onOpen={open(s.role, s.userId)}
                      detail={[`${s.activeDays} day${s.activeDays === 1 ? "" : "s"}`, `${s.quizzes} quiz${s.quizzes === 1 ? "" : "zes"}${s.quizzes ? ` (${s.passed} passed)` : ""}`, `${num(s.points)} pts`].join(" · ")}
                      right={s.lastSeen ? ago(s.lastSeen) : undefined}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </AdminSection>

        <AdminSection id="stats-logins" icon={LogIn} tone="blue" title="Recent sign-ins" description="The latest sign-ins by students, teachers and parents." bodyClassName="p-2 sm:p-3">
          {stats.recentLogins.length === 0 ? <EmptyState title="No sign-ins yet." className="m-2" /> : (
            <div className="max-h-[26rem] space-y-0.5 overflow-y-auto">
              {stats.recentLogins.map((l, i) => (
                <PersonLine key={`${l.userId}-${l.at}-${i}`} name={l.name} role={l.role} onOpen={open(l.role, l.userId)}
                  detail={[l.device, l.school].filter(Boolean).join(" · ") || undefined} right={ago(l.at)} />
              ))}
            </div>
          )}
        </AdminSection>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <AdminSection
          id="stats-quiet" icon={AlertCircle} tone="red" title="Haven't been on lately" count={stats.quietCount}
          description={`Students who haven't opened the app in ${QUIET_AFTER_DAYS}+ days. A good list for a nudge.`}
          bodyClassName="p-2 sm:p-3"
        >
          {stats.quietStudents.length === 0 ? <EmptyState title="Every student has been on in the last two weeks." className="m-2" /> : (
            <div className="max-h-[26rem] space-y-0.5 overflow-y-auto">
              {stats.quietStudents.map((q) => (
                <PersonLine key={q.userId} name={q.name} role={q.role} school={q.school} onOpen={open(q.role, q.userId)}
                  right={q.lastSeen ? `${q.daysAway} days ago` : "no visits on record"} />
              ))}
              {stats.quietCount > stats.quietStudents.length && (
                <p className="px-2 pt-1 text-xs text-muted-foreground">And {stats.quietCount - stats.quietStudents.length} more.</p>
              )}
            </div>
          )}
        </AdminSection>

        <AdminSection id="stats-reading" icon={BookOpen} tone="cyan" title="Reading checks"
          description={stats.reading.assessments ? `${stats.reading.assessments} reading check${stats.reading.assessments === 1 ? "" : "s"} and Growth Checks ${rangeLabel}${stats.reading.averagePercent !== null ? `, averaging ${stats.reading.averagePercent}%` : ""}.` : `Reading checks and Growth Checks, ${rangeLabel}.`}
          bodyClassName="p-2 sm:p-3"
        >
          {stats.reading.recent.length === 0 ? <EmptyState title={`No reading checks in the ${rangeLabel}.`} className="m-2" /> : (
            <div className="space-y-0.5">
              {stats.reading.recent.map((r, i) => (
                <PersonLine key={`${r.userId}-${r.at}-${i}`} name={r.name} role={r.role} onOpen={open(r.role, r.userId)}
                  detail={`${r.kind} · ${r.detail}`}
                  right={<span className="flex flex-col items-end gap-0.5">{r.percent !== null && <span className="text-sm font-black text-foreground">{r.percent}%</span>}<span>{ago(r.at)}</span></span>} />
              ))}
            </div>
          )}
        </AdminSection>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <AdminSection id="stats-schools" icon={School} tone="violet" title="Schools" description={`Students active ${rangeLabel}, out of each school's students.`}>
          {stats.schools.length === 0 ? <EmptyState title="No schools yet." /> : (
            <div className="space-y-3">
              {stats.schools.map((s) => (
                <div key={s.id ?? "none"} className="min-w-0">
                  <BarRow label={s.name} value={s.students} max={maxSchool} tone="violet" suffix={` student${s.students === 1 ? "" : "s"}`} />
                  <p className="mt-1 text-xs text-muted-foreground">{s.activeStudents} active · {s.teachers} teacher{s.teachers === 1 ? "" : "s"}</p>
                </div>
              ))}
            </div>
          )}
        </AdminSection>
        <AdminSection id="stats-grades" icon={GraduationCap} tone="cyan" title="Grades" description="Students by grade.">
          {stats.grades.length === 0 ? <EmptyState title="No students yet." /> : (
            <div className="space-y-3">
              {stats.grades.map((g) => <BarRow key={g.grade} label={g.grade === "Not set" ? "Grade not set" : /^k/i.test(g.grade) ? "Kindergarten" : `Grade ${g.grade}`} value={g.students} max={maxGrade} tone="cyan" />)}
            </div>
          )}
        </AdminSection>
        <AdminSection id="stats-devices" icon={Monitor} tone="slate" title="Devices" description={`What people signed in on, ${rangeLabel}.`}>
          {stats.devices.length === 0 ? <EmptyState title="No device info yet." hint="Devices are noted at each sign-in from now on." /> : (
            <div className="space-y-3">
              {stats.devices.map((d) => <BarRow key={d.name} label={d.name} value={d.count} max={maxDevice} tone="slate" />)}
            </div>
          )}
        </AdminSection>
      </div>

      <p className="flex items-start gap-2 px-1 text-xs leading-5 text-muted-foreground">
        <UserPlus className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Days are in Mountain Time. Admins, sample accounts and archived profiles aren't counted.
          {stats.visitsSince
            ? ` Every visit is counted from ${sinceText(stats.visitsSince)}. Before that, a student counts as active on days they signed in, took a quiz, used the book feed, played a game or sent a message.`
            : " Every visit is counted from today. Before that, a student counts as active on days they signed in, took a quiz, used the book feed, played a game or sent a message."}
        </span>
      </p>
    </div>
  );
}
