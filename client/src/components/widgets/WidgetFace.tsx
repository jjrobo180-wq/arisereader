// What each widget looks like: one face per widget type, drawn in the widget's theme and size.
// Faces read the time from `now` (the board ticks it once a second) and never save anything,
// except Today's one thing, which reports a tick through onChange.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  DAY_COLORS, DAY_EMOJIS, DECISIONS, FORTUNES, binaryDigits, cityOf, countdownTo, dayKey, dayOfYear, daysInYear, handAngles, isoWeek, monthGrid,
  moonPhase, nextBell, offsetFromHere, parseBells, pickForDay, progressOf, seasonOf, timeIn, timeInWords, workdayState,
  type WidgetItem, type WidgetSize, type WidgetTheme,
} from "@shared/widgets";

export type FaceProps = { item: WidgetItem; theme: WidgetTheme; now: Date; size: WidgetSize; onChange?: (patch: Partial<WidgetItem>) => void };

const FONTS: Record<WidgetTheme["font"], string> = {
  sans: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
  mono: "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace",
  rounded: "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Varela Round', system-ui, sans-serif",
};
export const fontOf = (t: WidgetTheme) => FONTS[t.font];
const glow = (t: WidgetTheme, color = t.fg): CSSProperties => (t.glow ? { textShadow: `0 0 6px ${color}, 0 0 18px ${color}88` } : {});
const pad = (n: number) => String(n).padStart(2, "0");
const h12 = (d: Date) => (d.getHours() % 12 === 0 ? 12 : d.getHours() % 12);
const ampm = (d: Date) => (d.getHours() < 12 ? "AM" : "PM");
const big = (size: WidgetSize, s: string, w: string, l: string) => (size === "small" ? s : size === "wide" ? w : l);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** A label in the widget's quieter colour. */
function Sub({ t, children, className = "" }: { t: WidgetTheme; children: ReactNode; className?: string }) {
  return <p className={`text-xs font-semibold leading-snug ${className}`} style={{ color: t.sub }}>{children}</p>;
}

// ── Clocks ───────────────────────────────────────────────────────────────────

function AnalogFace({ t, now, minimal }: { t: WidgetTheme; now: Date; minimal?: boolean }) {
  const a = handAngles(now);
  const hand = (deg: number, len: number, w: number, color: string) => <line x1="50" y1="50" x2={50 + len * Math.sin((deg * Math.PI) / 180)} y2={50 - len * Math.cos((deg * Math.PI) / 180)} stroke={color} strokeWidth={w} strokeLinecap="round" />;
  return (
    <svg viewBox="0 0 100 100" className="h-full max-h-full w-full max-w-full" role="img" aria-label={`${h12(now)}:${pad(now.getMinutes())} ${ampm(now)}`}>
      {!minimal && <circle cx="50" cy="50" r="47" fill={t.soft} stroke={t.border === "transparent" ? t.soft : t.border} strokeWidth="1.5" />}
      {Array.from({ length: 60 }, (_, i) => {
        const major = i % 5 === 0;
        const r1 = minimal ? (major ? 38 : 43) : major ? 42.5 : 44.5, r2 = minimal ? 46 : 46, ang = (i * 6 * Math.PI) / 180;
        return <line key={i} x1={50 + r1 * Math.sin(ang)} y1={50 - r1 * Math.cos(ang)} x2={50 + r2 * Math.sin(ang)} y2={50 - r2 * Math.cos(ang)} stroke={major ? t.fg : t.sub} strokeWidth={major ? (minimal ? 2.2 : 1.3) : 0.6} strokeLinecap="round" />;
      })}
      {!minimal && Array.from({ length: 12 }, (_, i) => {
        const n = i + 1, ang = (n * 30 * Math.PI) / 180;
        return <text key={n} x={50 + 33.5 * Math.sin(ang)} y={50 - 33.5 * Math.cos(ang) + 3.3} textAnchor="middle" fontSize="9" fontWeight="700" fill={t.fg} fontFamily={fontOf(t)}>{n}</text>;
      })}
      {hand(a.hour, 22, minimal ? 3 : 4, t.fg)}
      {hand(a.minute, 33, minimal ? 2 : 2.8, t.fg)}
      {hand(a.second, 38, 1, t.accent)}
      <circle cx="50" cy="50" r="2.6" fill={t.accent} />
    </svg>
  );
}

function FlipFace({ t, now, size }: { t: WidgetTheme; now: Date; size: WidgetSize }) {
  const digits = [pad(h12(now)), pad(now.getMinutes())];
  const card = (s: string, k: string) => (
    <span key={k} className="relative inline-flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl font-black tabular-nums leading-none"
      style={{ background: t.soft, color: t.fg, fontSize: big(size, "2.1rem", "3.6rem", "4.6rem"), boxShadow: "inset 0 -10px 18px rgba(0,0,0,.12)" }}>
      <span key={s} className="widget-flip">{s}</span>
      <span className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2" style={{ background: t.dark ? "rgba(0,0,0,.55)" : "rgba(15,23,42,.18)" }} />
    </span>
  );
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex min-h-0 flex-1 items-stretch gap-2">{card(digits[0], "h")}{card(digits[1], "m")}</div>
      <div className="flex justify-between"><Sub t={t}>{WEEKDAYS[now.getDay()]}</Sub><Sub t={t}>{ampm(now)}</Sub></div>
    </div>
  );
}

function DigitalFace({ t, now, size, neon }: { t: WidgetTheme; now: Date; size: WidgetSize; neon?: boolean }) {
  return (
    <div className="flex h-full flex-col justify-center">
      <p className="font-black tabular-nums leading-none tracking-tight" style={{ fontSize: big(size, "2rem", "3.4rem", "4.4rem"), ...(neon ? { color: t.fg, textShadow: `0 0 4px #fff, 0 0 12px ${t.fg}, 0 0 28px ${t.accent}, 0 0 48px ${t.accent}` } : glow(t)) }}>
        {h12(now)}:{pad(now.getMinutes())}<span className="ml-1 align-top text-[.38em] font-bold" style={{ color: neon ? t.accent : t.sub }}>{pad(now.getSeconds())}</span>
      </p>
      <Sub t={t} className="mt-2">{ampm(now)} · {WEEKDAYS[now.getDay()]}, {MONTHS[now.getMonth()]} {now.getDate()}</Sub>
    </div>
  );
}

function WordFace({ t, now, size }: { t: WidgetTheme; now: Date; size: WidgetSize }) {
  return <div className="flex h-full items-center"><p className="font-semibold leading-tight" style={{ fontSize: big(size, "1.15rem", "1.9rem", "2.6rem"), ...glow(t) }}>{timeInWords(now)}</p></div>;
}

function BinaryFace({ t, now }: { t: WidgetTheme; now: Date }) {
  const cols = binaryDigits(now);
  return (
    <div className="flex h-full flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-6 gap-1">
        {cols.map((bits, c) => (
          <div key={c} className={`grid grid-rows-4 gap-1 ${c % 2 === 0 && c > 0 ? "ml-1" : ""}`}>
            {bits.map((on, r) => <span key={r} className="m-auto aspect-square w-full max-w-[1.25rem] rounded-full transition-colors" style={{ background: on ? t.accent : t.soft, boxShadow: on && t.glow ? `0 0 8px ${t.accent}` : "none" }} />)}
          </div>
        ))}
      </div>
      <Sub t={t} className="mt-1 text-center tabular-nums">{pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}</Sub>
    </div>
  );
}

function WorldFace({ t, item, now, size }: { t: WidgetTheme; item: WidgetItem; now: Date; size: WidgetSize }) {
  const tz = item.tz || "Europe/London";
  const x = timeIn(tz, now);
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-bold">{cityOf(tz)}</p><span aria-label={x.night ? "Night" : "Day"}>{x.night ? "🌙" : "☀️"}</span></div>
      <p className="font-black tabular-nums leading-none" style={{ fontSize: big(size, "1.9rem", "3rem", "3.8rem"), ...glow(t) }}>{x.time}</p>
      <Sub t={t}>{x.weekday} · {offsetFromHere(tz, now)}</Sub>
    </div>
  );
}

function World3Face({ t, item, now }: { t: WidgetTheme; item: WidgetItem; now: Date }) {
  const tzs = item.tzs?.length ? item.tzs : ["America/New_York", "Europe/London", "Asia/Tokyo"];
  return (
    <div className="grid grid-cols-1 h-full gap-2" style={{ gridTemplateColumns: `repeat(${tzs.length}, minmax(0,1fr))` }}>
      {tzs.map((tz) => {
        const x = timeIn(tz, now);
        return (
          <div key={tz} className="flex min-w-0 flex-col justify-between rounded-2xl p-2.5" style={{ background: x.night ? (t.dark ? "rgba(0,0,0,.25)" : "#1e293b") : t.soft, color: x.night && !t.dark ? "#f8fafc" : t.fg }}>
            <p className="truncate text-xs font-bold">{cityOf(tz)}</p>
            <p className="whitespace-nowrap text-[15px] font-black tabular-nums leading-tight sm:text-xl">{x.time}</p>
            <p className="text-[11px] font-semibold opacity-75">{x.night ? "🌙" : "☀️"} {x.weekday}</p>
          </div>
        );
      })}
    </div>
  );
}

function HeadlineFace({ t, now, size }: { t: WidgetTheme; now: Date; size: WidgetSize }) {
  return (
    <div className="flex h-full items-end gap-3">
      <p className="font-black leading-[.8] tabular-nums" style={{ fontSize: big(size, "3.6rem", "5.4rem", "7rem"), color: t.accent, ...glow(t, t.accent) }}>{now.getDate()}</p>
      <div className="min-w-0 pb-1">
        <p className="truncate font-black uppercase leading-none tracking-tight" style={{ fontSize: big(size, ".95rem", "1.5rem", "2rem") }}>{WEEKDAYS[now.getDay()]}</p>
        <p className="truncate font-semibold" style={{ color: t.sub }}>{MONTHS[now.getMonth()]} {now.getFullYear()}</p>
        <p className="mt-1 font-bold tabular-nums">{h12(now)}:{pad(now.getMinutes())} {ampm(now)}</p>
      </div>
    </div>
  );
}

// ── Calendars ────────────────────────────────────────────────────────────────

function MonthFace({ t, now, size }: { t: WidgetTheme; now: Date; size: WidgetSize }) {
  const [shift, setShift] = useState(0);
  const first = new Date(now.getFullYear(), now.getMonth() + shift, 1);
  const weeks = monthGrid(first.getFullYear(), first.getMonth());
  const isThis = shift === 0;
  const arrow = "inline-flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold transition active:scale-90";
  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex items-center justify-between gap-2">
        <button type="button" onClick={() => setShift((s) => s - 1)} className={arrow} style={{ background: t.soft }} aria-label="Previous month">‹</button>
        <button type="button" onClick={() => setShift(0)} className="min-w-0 truncate text-sm font-black" aria-label="Back to this month">{MONTHS[first.getMonth()]} {first.getFullYear()}</button>
        <button type="button" onClick={() => setShift((s) => s + 1)} className={arrow} style={{ background: t.soft }} aria-label="Next month">›</button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-bold" style={{ color: t.sub }}>{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="grid min-h-0 flex-1 grid-cols-7 content-stretch text-center" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0,1fr))` }}>
        {weeks.flat().map((d, i) => {
          const today = isThis && d === now.getDate();
          return <span key={i} className={`m-auto flex aspect-square items-center justify-center rounded-full font-semibold tabular-nums ${size === "small" ? "w-6 text-[10px]" : "w-8 text-xs"}`}
            style={today ? { background: t.accent, color: t.dark ? "#0b1224" : "#fff" } : { color: i % 7 === 0 || i % 7 === 6 ? t.sub : t.fg }}>{d ?? ""}</span>;
        })}
      </div>
    </div>
  );
}

function TearOffFace({ t, now, size }: { t: WidgetTheme; now: Date; size: WidgetSize }) {
  return (
    <div className="-m-4 flex h-[calc(100%+2rem)] flex-col overflow-hidden">
      <div className="px-4 py-1.5 text-center text-xs font-black uppercase tracking-wide text-white" style={{ background: t.id === "classic" ? "#dc2626" : t.accent, color: t.id === "classic" ? "#fff" : t.dark ? "#0b1224" : "#fff" }}>{MONTHS[now.getMonth()]}</div>
      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="font-black leading-none tabular-nums" style={{ fontSize: big(size, "3.4rem", "4.6rem", "6.5rem"), ...glow(t) }}>{now.getDate()}</p>
        <Sub t={t} className="mt-1">{WEEKDAYS[now.getDay()]}</Sub>
      </div>
      <div className="h-1.5" style={{ background: `repeating-linear-gradient(90deg, ${t.border === "transparent" ? t.soft : t.border} 0 6px, transparent 6px 10px)` }} />
    </div>
  );
}

function WeekFace({ t, now }: { t: WidgetTheme; now: Date }) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <Sub t={t}>Week {isoWeek(dayKey(now))} · {MONTHS[now.getMonth()]}</Sub>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), today = i === now.getDay(), past = i < now.getDay();
          return (
            <div key={i} className="flex flex-col items-center gap-1 rounded-2xl py-2" style={today ? { background: t.accent, color: t.dark ? "#0b1224" : "#fff" } : { background: t.soft, opacity: past ? 0.55 : 1 }}>
              <span className="text-[10px] font-bold">{WEEKDAYS[i].slice(0, 3)}</span>
              <span className="text-base font-black tabular-nums">{d.getDate()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YearDotsFace({ t, now }: { t: WidgetTheme; now: Date }) {
  const key = dayKey(now), total = daysInYear(now.getFullYear()), done = dayOfYear(key);
  const cols = 21, rows = Math.ceil(total / cols);
  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-baseline justify-between gap-2"><p className="text-sm font-black">{now.getFullYear()}</p><Sub t={t}>{total - done} days left</Sub></div>
      <svg viewBox={`0 0 ${cols * 10} ${rows * 10}`} className="min-h-0 w-full flex-1" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Day ${done} of ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <circle key={i} cx={(i % cols) * 10 + 5} cy={Math.floor(i / cols) * 10 + 5} r={i + 1 === done ? 4.2 : 3.2}
            fill={i + 1 === done ? t.accent : i + 1 < done ? t.fg : t.soft} opacity={i + 1 < done ? 0.85 : 1} />
        ))}
      </svg>
    </div>
  );
}

function DateFactsFace({ t, now }: { t: WidgetTheme; now: Date }) {
  const key = dayKey(now), doy = dayOfYear(key), total = daysInYear(now.getFullYear());
  const facts: [string, string][] = [["Day", `${doy}`], ["Week", `${isoWeek(key)}`], ["Quarter", `Q${Math.floor(now.getMonth() / 3) + 1}`], ["Days left", `${total - doy}`]];
  return (
    <div className="grid h-full grid-cols-4 gap-2">
      {facts.map(([k, v]) => <div key={k} className="flex flex-col justify-center rounded-2xl p-2 text-center" style={{ background: t.soft }}><p className="text-xl font-black tabular-nums sm:text-2xl" style={glow(t)}>{v}</p><Sub t={t}>{k}</Sub></div>)}
    </div>
  );
}

// ── Countdowns & progress ────────────────────────────────────────────────────

function CountdownFace({ t, item, now, size, since }: { t: WidgetTheme; item: WidgetItem; now: Date; size: WidgetSize; since?: boolean }) {
  const c = countdownTo(item.date, now);
  const label = item.label || (since ? "Days since" : "Countdown");
  let n = "—", unit = "";
  if (c) {
    if (since) { n = c.past ? String(c.days) : c.today ? "0" : "—"; unit = n === "1" ? "day" : "days"; }
    else if (c.today) { n = "Today!"; }
    else if (c.past) { n = "Done"; }
    else if (c.days < 2) { n = `${c.hours}h ${c.minutes}m`; }
    else { n = String(c.days); unit = "days"; }
  }
  return (
    <div className="flex h-full flex-col justify-between">
      <p className="line-clamp-2 text-sm font-bold leading-snug">{label}</p>
      <p className="font-black leading-none tabular-nums" style={{ fontSize: big(size, n.length > 4 ? "1.7rem" : "2.6rem", "3.6rem", "4.6rem"), ...glow(t) }}>{n}{unit && <span className="ml-1.5 text-[.35em] font-bold" style={{ color: t.sub }}>{unit}</span>}</p>
      <Sub t={t}>{item.date ? new Date(`${item.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Pick a date"}</Sub>
    </div>
  );
}

function Ring({ frac, t, label, children }: { frac: number; t: WidgetTheme; label: string; children: ReactNode }) {
  const r = 40, c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto aspect-square h-full max-h-full max-w-full">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={label}>
        <circle cx="50" cy="50" r={r} fill="none" stroke={t.soft} strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={t.accent} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} style={t.glow ? { filter: `drop-shadow(0 0 4px ${t.accent})` } : undefined} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

function DayRingFace({ t, now }: { t: WidgetTheme; now: Date }) {
  const p = progressOf(now).day;
  const left = 24 * 60 - (now.getHours() * 60 + now.getMinutes());
  return <Ring frac={p} t={t} label={`${Math.round(p * 100)}% of today has gone by`}><p className="text-xl font-black tabular-nums leading-none">{Math.round(p * 100)}%</p><p className="mt-0.5 text-[10px] font-bold" style={{ color: t.sub }}>{Math.floor(left / 60)}h {left % 60}m left</p></Ring>;
}

function Bar({ t, frac }: { t: WidgetTheme; frac: number }) {
  return <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: t.soft }}><div className="h-full rounded-full" style={{ width: `${Math.max(2, frac * 100)}%`, background: t.accent, boxShadow: t.glow ? `0 0 8px ${t.accent}` : "none" }} /></div>;
}

function ProgressFace({ t, now }: { t: WidgetTheme; now: Date }) {
  const p = progressOf(now);
  const rows: [string, number][] = [["Today", p.day], ["This week", p.week], ["This month", p.month], [String(now.getFullYear()), p.year]];
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      {rows.map(([k, v]) => <div key={k}><div className="mb-1 flex justify-between text-xs font-bold"><span>{k}</span><span className="tabular-nums" style={{ color: t.sub }}>{Math.floor(v * 100)}%</span></div><Bar t={t} frac={v} /></div>)}
    </div>
  );
}

function WorkdayFace({ t, item, now, size }: { t: WidgetTheme; item: WidgetItem; now: Date; size: WidgetSize }) {
  const s = workdayState(now, item.start, item.end);
  const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`);
  const head = s.state === "during" ? `${hm(s.left)} left` : s.state === "before" ? `Starts in ${hm(s.until)}` : s.state === "after" ? "Done for today 🎉" : "Set the start and end";
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <div className="flex items-baseline justify-between gap-2"><p className="truncate text-sm font-bold">{item.label || "Work day"}</p><Sub t={t}>{Math.round(s.frac * 100)}%</Sub></div>
      <p className="font-black leading-tight" style={{ fontSize: big(size, "1.2rem", "1.9rem", "2.4rem"), ...glow(t) }}>{head}</p>
      <Bar t={t} frac={s.frac} />
    </div>
  );
}

function BellsFace({ t, item, now, size }: { t: WidgetTheme; item: WidgetItem; now: Date; size: WidgetSize }) {
  const bells = parseBells(item.bells);
  const n = nextBell(bells, now);
  if (!bells.length) return <div className="flex h-full items-center"><Sub t={t}>Add your bell times in settings.</Sub></div>;
  return (
    <div className="flex h-full flex-col justify-between">
      <p className="text-sm font-bold">Next bell</p>
      {n ? <p className="font-black leading-none tabular-nums" style={{ fontSize: big(size, "2.4rem", "3.4rem", "4.4rem"), color: n.minutes <= 2 ? t.accent : t.fg, ...glow(t) }}>{n.minutes}<span className="ml-1 text-[.35em] font-bold" style={{ color: t.sub }}>min</span></p>
        : <p className="text-lg font-black">All done today</p>}
      <Sub t={t}>{n ? `${n.label} · bell ${n.index} of ${n.total}` : `${bells.length} bells tomorrow`}</Sub>
    </div>
  );
}

function SeasonFace({ t, now, size }: { t: WidgetTheme; now: Date; size: WidgetSize }) {
  const s = seasonOf(dayKey(now));
  return (
    <div className="flex h-full flex-col justify-between">
      <span style={{ fontSize: big(size, "2rem", "2.6rem", "3.4rem") }} aria-hidden>{s.emoji}</span>
      <p className="text-xl font-black">{s.name}</p>
      <Sub t={t}>{s.next} {s.nextEmoji} in {s.daysToNext} days</Sub>
    </div>
  );
}

// ── Fun ──────────────────────────────────────────────────────────────────────

function MoonFace({ t, now }: { t: WidgetTheme; now: Date }) {
  const m = moonPhase(now);
  // The lit part: a half disc plus an ellipse whose width follows the phase.
  const waxing = m.phase < 0.5, rx = Math.abs(Math.cos(2 * Math.PI * m.phase)) * 40;
  const lit = "#f8f3da", dark = t.dark ? "#1b2236" : "#334155";
  const half = waxing ? "M50 10 A40 40 0 0 1 50 90 Z" : "M50 10 A40 40 0 0 0 50 90 Z";
  const ellipseLit = m.lit > 0.5;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1">
      <svg viewBox="0 0 100 100" className="min-h-0 w-full flex-1" role="img" aria-label={`${m.name}, ${Math.round(m.lit * 100)}% lit`}>
        <circle cx="50" cy="50" r="40" fill={dark} stroke={t.sub} strokeOpacity=".45" strokeWidth="1" />
        <path d={half} fill={lit} />
        <ellipse cx="50" cy="50" rx={rx} ry="40" fill={ellipseLit ? lit : dark} />
      </svg>
      <p className="text-sm font-black">{m.name}</p>
      <Sub t={t}>{Math.round(m.lit * 100)}% lit · full in {m.daysToFull === 0 ? "less than a day" : `${m.daysToFull} days`}</Sub>
    </div>
  );
}

const PIPS: Record<number, [number, number][]> = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [0, 2], [2, 0], [2, 2]], 5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]], 6: [[0, 0], [1, 0], [2, 0], [0, 2], [1, 2], [2, 2]] };
function Die({ n, t, rolling }: { n: number; t: WidgetTheme; rolling: boolean }) {
  return (
    <svg viewBox="0 0 60 60" className={`h-full max-h-24 w-full ${rolling ? "widget-roll" : ""}`} role="img" aria-label={`${n}`}>
      <rect x="3" y="3" width="54" height="54" rx="12" fill={t.dark ? "#fff" : t.soft} stroke={t.fg} strokeOpacity=".15" />
      {PIPS[n].map(([r, c], i) => <circle key={i} cx={14 + c * 16} cy={14 + r * 16} r="5" fill={t.dark ? "#111" : t.fg} />)}
    </svg>
  );
}
function DiceFace({ t, item }: { t: WidgetTheme; item: WidgetItem }) {
  const count = item.dice === 2 ? 2 : 1;
  const [vals, setVals] = useState<number[]>([3, 5]);
  const [rolling, setRolling] = useState(false);
  const roll = () => { setRolling(true); setTimeout(() => { setVals([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]); setRolling(false); }, 380); };
  return (
    <button type="button" onClick={roll} className="flex h-full w-full flex-col items-center justify-center gap-1" aria-label={`Roll ${count === 2 ? "the dice" : "the die"}`}>
      <span className="flex min-h-0 w-full flex-1 items-center justify-center gap-2">{vals.slice(0, count).map((v, i) => <Die key={i} n={v} t={t} rolling={rolling} />)}</span>
      <span className="text-xs font-bold" style={{ color: t.sub }}>{count === 2 ? `Total ${vals[0] + vals[1]} · tap to roll` : "Tap to roll"}</span>
    </button>
  );
}

function CoinFace({ t }: { t: WidgetTheme }) {
  const [side, setSide] = useState<"Heads" | "Tails" | null>(null);
  const [spin, setSpin] = useState(0);
  const flip = () => { setSpin((s) => s + 1); setSide(null); setTimeout(() => setSide(Math.random() < 0.5 ? "Heads" : "Tails"), 600); };
  return (
    <button type="button" onClick={flip} className="flex h-full w-full flex-col items-center justify-center gap-1" aria-label="Flip the coin">
      <span key={spin} className={`flex aspect-square min-h-0 flex-1 items-center justify-center rounded-full text-2xl font-black ${spin ? "widget-coin" : ""}`}
        style={{ background: "radial-gradient(circle at 35% 30%, #fde68a, #d4a017 70%, #a16207)", color: "#5b3a06", boxShadow: "inset 0 0 0 4px rgba(255,255,255,.35), 0 4px 10px rgba(0,0,0,.2)" }}>{side ? side[0] : "?"}</span>
      <span className="text-sm font-black" aria-live="polite">{side ?? (spin ? "Flipping…" : "Tap to flip")}</span>
    </button>
  );
}

function EmojiFace({ t, now, size }: { t: WidgetTheme; now: Date; size: WidgetSize }) {
  const [e, word] = pickForDay(DAY_EMOJIS, dayKey(now), "emoji");
  return <div className="flex h-full flex-col items-center justify-center text-center"><span style={{ fontSize: big(size, "3rem", "3.6rem", "5rem") }} aria-hidden>{e}</span><p className="mt-1 font-black">{word}</p><Sub t={t}>Today's vibe</Sub></div>;
}

function FortuneFace({ t, now, size }: { t: WidgetTheme; now: Date; size: WidgetSize }) {
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <span className="text-2xl" aria-hidden>🥠</span>
      <p className="font-semibold leading-snug" style={{ fontSize: big(size, ".95rem", "1.25rem", "1.6rem") }}>{pickForDay(FORTUNES, dayKey(now), "fortune")}</p>
    </div>
  );
}

function ColorFace({ t, now }: { t: WidgetTheme; now: Date }) {
  const c = pickForDay(DAY_COLORS, dayKey(now), "color");
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="min-h-0 flex-1 rounded-2xl" style={{ background: c.hex, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)" }} />
      <div className="flex items-baseline justify-between gap-2"><p className="truncate font-black">{c.name}</p><Sub t={t}>{c.hex.toUpperCase()}</Sub></div>
    </div>
  );
}

function HourglassFace({ t, now }: { t: WidgetTheme; now: Date }) {
  const f = (now.getMinutes() * 60 + now.getSeconds()) / 3600;
  const sand = "#e9b949";
  const topH = 34 * (1 - f), botH = 34 * f;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1">
      <svg viewBox="0 0 60 90" className="min-h-0 w-full flex-1" role="img" aria-label={`${60 - now.getMinutes()} minutes left in this hour`}>
        <defs><clipPath id="hg-top"><path d="M12 8 H48 L32 44 H28 Z" /></clipPath><clipPath id="hg-bot"><path d="M28 46 H32 L48 82 H12 Z" /></clipPath></defs>
        <rect x="8" y="4" width="44" height="4" rx="2" fill={t.fg} /><rect x="8" y="82" width="44" height="4" rx="2" fill={t.fg} />
        <path d="M12 8 H48 L32 44 H28 Z M28 46 H32 L48 82 H12 Z" fill={t.soft} stroke={t.fg} strokeOpacity=".35" />
        <rect x="0" y={44 - topH} width="60" height={topH} fill={sand} clipPath="url(#hg-top)" />
        <rect x="0" y={82 - botH} width="60" height={botH} fill={sand} clipPath="url(#hg-bot)" />
        {f < 1 && <line x1="30" y1="44" x2="30" y2={82 - botH} stroke={sand} strokeWidth="1" strokeDasharray="1.5 2" className="widget-trickle" />}
      </svg>
      <Sub t={t}>{60 - now.getMinutes()} min left this hour</Sub>
    </div>
  );
}

function DecideFace({ t }: { t: WidgetTheme }) {
  const [answer, setAnswer] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const ask = () => { setShake((s) => s + 1); setAnswer(null); setTimeout(() => setAnswer(DECISIONS[Math.floor(Math.random() * DECISIONS.length)]), 500); };
  return (
    <button type="button" onClick={ask} className="flex h-full w-full flex-col items-center justify-center gap-2 text-center" aria-label="Ask the decision ball">
      <span key={shake} className={`flex aspect-square min-h-0 flex-1 items-center justify-center rounded-full p-3 ${shake ? "widget-shake" : ""}`} style={{ background: "radial-gradient(circle at 35% 30%, #3f3f46, #09090b 70%)" }}>
        <span className="flex aspect-square w-[62%] items-center justify-center rounded-full p-1 text-[10px] font-black leading-tight" style={{ background: "#1e1b4b", color: t.accent, ...glow(t, t.accent) }}>{answer ?? "?"}</span>
      </span>
      <span className="text-xs font-bold" style={{ color: t.sub }} aria-live="polite">{answer ?? (shake ? "Thinking…" : "Ask, then tap")}</span>
    </button>
  );
}

// ── Focus ────────────────────────────────────────────────────────────────────

const btn = (t: WidgetTheme, primary = false): CSSProperties => (primary ? { background: t.accent, color: t.dark ? "#0b1224" : "#fff" } : { background: t.soft, color: t.fg });
const fmt = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };

function StopwatchFace({ t, size }: { t: WidgetTheme; size: WidgetSize }) {
  const [base, setBase] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [, tick] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  useEffect(() => { if (startedAt === null) return; const id = setInterval(() => tick((x) => x + 1), 100); return () => clearInterval(id); }, [startedAt]);
  const elapsed = base + (startedAt !== null ? Date.now() - startedAt : 0);
  const tenths = Math.floor((elapsed % 1000) / 100);
  return (
    <div className="flex h-full flex-col justify-between gap-2">
      <p className="font-black tabular-nums leading-none" style={{ fontSize: big(size, "1.9rem", "3rem", "3.8rem"), ...glow(t) }}>{fmt(elapsed)}<span className="text-[.5em]" style={{ color: t.sub }}>.{tenths}</span></p>
      {size !== "small" && laps.length > 0 && <p className="truncate text-xs font-semibold" style={{ color: t.sub }}>Laps: {laps.slice(-4).map(fmt).join(", ")}</p>}
      <div className="flex gap-1.5">
        <button type="button" onClick={() => (startedAt === null ? setStartedAt(Date.now()) : (setBase(elapsed), setStartedAt(null)))} className="min-h-10 flex-1 rounded-xl text-sm font-bold transition active:scale-95" style={btn(t, true)}>{startedAt === null ? (elapsed ? "Go on" : "Start") : "Stop"}</button>
        <button type="button" onClick={() => (startedAt !== null ? setLaps((l) => [...l, elapsed]) : (setBase(0), setLaps([])))} className="min-h-10 flex-1 rounded-xl text-sm font-bold transition active:scale-95" style={btn(t)} disabled={!elapsed}>{startedAt !== null ? "Lap" : "Reset"}</button>
      </div>
    </div>
  );
}

function chime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25, 0.5].forEach((delay, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = [880, 1046.5, 1318.5][i];
      g.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + delay);
      o.stop(ctx.currentTime + delay + 0.65);
    });
  } catch { /* no sound on this device */ }
}

function TimerFace({ t, item, size }: { t: WidgetTheme; item: WidgetItem; size: WidgetSize }) {
  const total = (item.minutes || 5) * 60_000;
  const [left, setLeft] = useState(total);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const rang = useRef(false);
  useEffect(() => { if (endsAt === null) setLeft(total); }, [total]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => {
      const l = Math.max(0, endsAt - Date.now());
      setLeft(l);
      if (l === 0) { setEndsAt(null); if (!rang.current) { rang.current = true; chime(); try { navigator.vibrate?.([200, 100, 200]); } catch { /* no buzz */ } } }
    }, 200);
    return () => clearInterval(id);
  }, [endsAt]);
  const done = left === 0;
  return (
    <div className="flex h-full flex-col justify-between gap-2">
      <p className="font-black tabular-nums leading-none" style={{ fontSize: big(size, "1.9rem", "3rem", "3.8rem"), color: done ? t.accent : t.fg, ...glow(t) }} aria-live="polite">{done ? "Time's up!" : fmt(left + 999)}</p>
      <div className="flex gap-1.5">
        <button type="button" onClick={() => { if (endsAt !== null) { setEndsAt(null); return; } rang.current = false; setEndsAt(Date.now() + (done ? total : left)); if (done) setLeft(total); }} className="min-h-10 flex-1 rounded-xl text-sm font-bold transition active:scale-95" style={btn(t, true)}>{endsAt !== null ? "Pause" : done ? "Again" : left < total ? "Go on" : "Start"}</button>
        <button type="button" onClick={() => { setEndsAt(null); setLeft(total); }} className="min-h-10 flex-1 rounded-xl text-sm font-bold transition active:scale-95" style={btn(t)}>Reset</button>
      </div>
    </div>
  );
}

function NoteFace({ t, item, size }: { t: WidgetTheme; item: WidgetItem; size: WidgetSize }) {
  return <div className="flex h-full overflow-hidden"><p className="whitespace-pre-wrap font-semibold leading-snug" style={{ fontSize: big(size, ".95rem", "1.15rem", "1.4rem") }}>{item.text || "Tap ✎ to write a note."}</p></div>;
}

function OneThingFace({ t, item, now, size, onChange }: FaceProps & { t: WidgetTheme }) {
  const today = dayKey(now), done = item.doneOn === today;
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      <p className="text-sm font-bold" style={{ color: t.sub }}>Today's one thing</p>
      <label className="flex items-start gap-3">
        <input type="checkbox" checked={done} disabled={!item.text} onChange={() => onChange?.({ doneOn: done ? undefined : today })} className="mt-1 h-6 w-6 shrink-0 accent-current" style={{ accentColor: t.accent }} />
        <span className={`font-black leading-tight ${done ? "line-through opacity-60" : ""}`} style={{ fontSize: big(size, "1rem", "1.5rem", "2rem") }}>{item.text || "Tap ✎ to pick it."}</span>
      </label>
      {done && <p className="text-xs font-bold" style={{ color: t.accent }}>Done. Nice work.</p>}
    </div>
  );
}

// ── The face for a widget ────────────────────────────────────────────────────

export function WidgetFace(props: FaceProps) {
  const { item, theme: t, now, size } = props;
  switch (item.type) {
    case "analog": return <AnalogFace t={t} now={now} />;
    case "analog-minimal": return <AnalogFace t={t} now={now} minimal />;
    case "flip": return <FlipFace t={t} now={now} size={size} />;
    case "digital": return <DigitalFace t={t} now={now} size={size} />;
    case "neon": return <DigitalFace t={t} now={now} size={size} neon />;
    case "word": return <WordFace t={t} now={now} size={size} />;
    case "binary": return <BinaryFace t={t} now={now} />;
    case "world": return <WorldFace t={t} item={item} now={now} size={size} />;
    case "world3": return <World3Face t={t} item={item} now={now} />;
    case "headline": return <HeadlineFace t={t} now={now} size={size} />;
    case "month": return <MonthFace t={t} now={now} size={size} />;
    case "tearoff": return <TearOffFace t={t} now={now} size={size} />;
    case "week": return <WeekFace t={t} now={now} />;
    case "year-dots": return <YearDotsFace t={t} now={now} />;
    case "date-facts": return <DateFactsFace t={t} now={now} />;
    case "countdown": return <CountdownFace t={t} item={item} now={now} size={size} />;
    case "since": return <CountdownFace t={t} item={item} now={now} size={size} since />;
    case "day-ring": return <DayRingFace t={t} now={now} />;
    case "progress": return <ProgressFace t={t} now={now} />;
    case "workday": return <WorkdayFace t={t} item={item} now={now} size={size} />;
    case "bells": return <BellsFace t={t} item={item} now={now} size={size} />;
    case "season": return <SeasonFace t={t} now={now} size={size} />;
    case "moon": return <MoonFace t={t} now={now} />;
    case "dice": return <DiceFace t={t} item={item} />;
    case "coin": return <CoinFace t={t} />;
    case "emoji": return <EmojiFace t={t} now={now} size={size} />;
    case "fortune": return <FortuneFace t={t} now={now} size={size} />;
    case "color": return <ColorFace t={t} now={now} />;
    case "hourglass": return <HourglassFace t={t} now={now} />;
    case "decide": return <DecideFace t={t} />;
    case "stopwatch": return <StopwatchFace t={t} size={size} />;
    case "timer": return <TimerFace t={t} item={item} size={size} />;
    case "note": return <NoteFace t={t} item={item} size={size} />;
    case "one-thing": return <OneThingFace {...props} t={t} />;
    default: return null;
  }
}

/** The motion the faces use, once per page. Turned off for people who prefer less motion. */
export const WIDGET_CSS = `
@keyframes widget-flip{0%{transform:rotateX(90deg);opacity:.2}100%{transform:rotateX(0);opacity:1}}
.widget-flip{display:inline-block;animation:widget-flip .35s ease-out}
@keyframes widget-roll{0%{transform:rotate(0) scale(.9)}50%{transform:rotate(200deg) scale(1.05)}100%{transform:rotate(360deg) scale(1)}}
.widget-roll{animation:widget-roll .38s ease-in-out}
@keyframes widget-coin{0%{transform:rotateY(0)}100%{transform:rotateY(1080deg)}}
.widget-coin{animation:widget-coin .6s ease-out}
@keyframes widget-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px) rotate(-4deg)}40%{transform:translateX(6px) rotate(4deg)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
.widget-shake{animation:widget-shake .5s ease-in-out}
@keyframes widget-trickle{to{stroke-dashoffset:-7}}
.widget-trickle{animation:widget-trickle .6s linear infinite}
@media (prefers-reduced-motion:reduce){.widget-flip,.widget-roll,.widget-coin,.widget-shake,.widget-trickle{animation:none!important}}
`;

/** The time, ticking once a second while the page is open. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

/** Keeps a value steady while it doesn't change, so faces don't re-render for nothing. */
export const useStable = <T,>(v: T) => useMemo(() => v, [JSON.stringify(v)]); // eslint-disable-line react-hooks/exhaustive-deps
