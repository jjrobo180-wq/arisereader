// The faces of the start screen's own live tiles: the clock, the weather, and the Drive photo slideshow's pictures.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { weatherCode, type Forecast } from "@shared/lifePlugins";
import type { HomeSize } from "@shared/hubLayout";
import type { DriveFile } from "@shared/driveApp";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";

/** The time as the clock shows it: "9:55" and "PM". */
export function clockParts(d: Date): { time: string; ampm: string; weekday: string; date: string } {
  const h = d.getHours();
  return {
    time: `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`, ampm: h < 12 ? "AM" : "PM",
    weekday: d.toLocaleDateString(undefined, { weekday: "long" }), date: d.toLocaleDateString(undefined, { month: "long", day: "numeric" }),
  };
}

/** A clock that ticks on its own. */
export function ClockBody({ size }: { size: HomeSize }): ReactNode {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 5000); return () => clearInterval(t); }, []);
  const c = clockParts(now), wide = size === "large";
  return (
    <span className={`relative flex h-full w-full ${wide ? "flex-row items-center justify-between px-[4cqw]" : "flex-col justify-between p-2 sm:p-3"}`} role="timer" aria-label={`${c.time} ${c.ampm}, ${c.weekday} ${c.date}`}>
      <span className="flex items-baseline gap-[1.2cqw] leading-none">
        <span className="font-extralight tabular-nums tracking-tight" style={{ fontSize: wide ? "26cqw" : "14cqw" }}>{c.time}</span>
        <span className="font-semibold uppercase opacity-90" style={{ fontSize: wide ? "5cqw" : "4cqw" }}>{c.ampm}</span>
      </span>
      <span className={wide ? "text-right" : "block"}>
        <span className="block font-semibold leading-tight" style={{ fontSize: wide ? "6cqw" : "4.4cqw" }}>{c.weekday}</span>
        <span className="block leading-tight opacity-90" style={{ fontSize: wide ? "5cqw" : "3.8cqw" }}>{c.date}</span>
      </span>
    </span>
  );
}

export type WeatherState = { data: Forecast | null; busy: boolean; error: string; place: string };

/** The weather: today's temperature and sky, and the high and low. */
export function WeatherBody({ size, w }: { size: HomeSize; w: WeatherState }): ReactNode {
  const wide = size === "large";
  const shell = `relative flex h-full w-full ${wide ? "flex-row items-center gap-[4cqw] px-[4cqw]" : "flex-col justify-between p-2 sm:p-3"}`;
  if (!w.place) return <span className={shell}><span className="text-[4.6cqw] font-semibold leading-tight">Weather</span><span className="text-[3.8cqw] leading-snug opacity-90">Tap to choose your town and see today's weather here.</span></span>;
  if (!w.data) return <span className={shell}><span className="text-[4.6cqw] font-semibold leading-tight">{w.place.split(",")[0]}</span><span className="text-[3.8cqw] leading-snug opacity-90">{w.error ? "Can't reach the weather right now." : "Checking the sky…"}</span></span>;
  const now = weatherCode(w.data.current.code), today = w.data.days[0];
  return (
    <span className={shell}>
      <span className="flex items-center gap-[2cqw] leading-none">
        <span style={{ fontSize: wide ? "15cqw" : "11cqw" }} aria-hidden>{now.icon}</span>
        <span className="font-extralight tabular-nums tracking-tight" style={{ fontSize: wide ? "21cqw" : "13cqw" }}>{w.data.current.temp}°</span>
      </span>
      <span className={wide ? "text-right" : "block"}>
        <span className="block font-semibold leading-tight" style={{ fontSize: wide ? "6cqw" : "4.4cqw" }}>{now.text}{today ? ` · ${today.high}°/${today.low}°` : ""}</span>
        <span className="block truncate leading-tight opacity-90" style={{ fontSize: wide ? "5cqw" : "3.8cqw" }}>{w.data.place.split(",")[0]}{today && today.rain >= 20 ? ` · ${today.rain}% rain` : ""}</span>
      </span>
    </span>
  );
}

/** Pictures from the family's Drive for the photo tile: a handful of the newest, each as a short-lived link. */
export function useDrivePhotos(files: DriveFile[] | undefined, enabled: boolean, max = 6): string[] {
  const { token } = useAuth();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const asked = useRef(new Set<string>());
  const wanted = enabled ? (files ?? []).filter((f) => (f.contentType || "").startsWith("image/")).slice(0, max) : [];
  const key = wanted.map((f) => f.id).join(",");
  useEffect(() => {
    if (!token || !wanted.length) return;
    let live = true;
    for (const f of wanted) {
      if (asked.current.has(f.id)) continue;
      asked.current.add(f.id);
      fetch(`${API_BASE}/api/lifehub/drive/url`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ path: f.path }) })
        .then((r) => r.json().catch(() => null))
        .then((j) => { if (live && j?.url) setUrls((u) => ({ ...u, [f.id]: j.url })); })
        .catch(() => { asked.current.delete(f.id); });
    }
    return () => { live = false; };
  }, [key, token]);
  return wanted.map((f) => urls[f.id]).filter((u): u is string => !!u);
}
