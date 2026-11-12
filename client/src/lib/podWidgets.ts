// What the Podster widgets show (client/src/lib/widgets.ts sends it to the iPhone): a simple and a detailed widget for
// each slot. Pure, so it's tested. The widgets themselves are listed in podscroll/ios-app/widgets.json.
import type { Earshot } from "@shared/earshot";
import type { WidgetSlot } from "./widgets";

export type PodNow = { title: string; show: string; playing: boolean; live?: boolean } | null;
export type WikiNow = { title: string; playing: boolean } | null;

const TINT = "#ff6a1f";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function podWidgetSlots(es: Earshot, now: PodNow, wiki: WikiNow): WidgetSlot[] {
  const slots: WidgetSlot[] = [];

  slots.push(now
    ? { id: "pod.now", title: "Now playing", value: now.live ? "Live" : now.playing ? "Playing" : "Paused", detail: `${now.title}${now.show ? ` · ${now.show}` : ""}`, tint: TINT, lines: [now.title, now.show].filter(Boolean) }
    : { id: "pod.now", title: "Now playing", value: "Nothing yet", detail: "Open Podster and pick an episode", tint: TINT });

  const later = es.saved;
  slots.push({ id: "pod.later", title: "Listen later", value: String(later.length), detail: later[0] ? `Next: ${later[0].title}` : "Save an episode to find it here", tint: "#3ea6ff",
    lines: later.slice(0, 8).map((e) => `${e.title} · ${e.show}`) });

  const follows = es.follows;
  slots.push({ id: "pod.shows", title: "Following", value: String(follows.length), detail: follows.length ? follows.slice(0, 3).map((s) => s.name).join(", ") : "Follow a show to get new episodes", tint: "#a855f7",
    lines: follows.slice(0, 8).map((s) => s.name) });

  const liked = es.liked;
  slots.push({ id: "pod.liked", title: "Liked episodes", value: String(liked.length), detail: liked[0] ? liked[0].title : "Tap the heart on an episode", tint: "#ef4444",
    lines: liked.slice(0, 8).map((e) => `${e.title} · ${e.show}`) });

  const modes = es.modes.filter((m) => m.episodes.length);
  const total = modes.reduce((n, m) => n + m.episodes.length, 0);
  slots.push({ id: "pod.modes", title: "Pod Modes", value: String(modes.length), detail: modes.length ? `${plural(total, "episode")} ready` : "Sleep, Commute, Focus and more", tint: "#22c55e",
    lines: modes.slice(0, 8).map((m) => `${m.name} · ${plural(m.episodes.length, "episode")}`) });

  slots.push({ id: "pod.heard", title: "Recently heard", value: String(es.heard.length), detail: es.heard.length ? `${plural(es.heard.length, "episode")} you've listened to` : "Episodes you listen to show up here", tint: "#14b8a6" });

  slots.push(wiki
    ? { id: "pod.wiki", title: "Wiki podcast", value: wiki.playing ? "Playing" : "Paused", detail: wiki.title, tint: "#64748b", lines: [wiki.title, wiki.playing ? "Reading now" : "Tap to keep listening"] }
    : { id: "pod.wiki", title: "Wiki podcast", value: "Listen", detail: "Any Wikipedia article, read by an AI voice", tint: "#64748b" });

  const topGenre = Object.entries(es.taste).sort((a, b) => b[1] - a[1])[0]?.[0];
  slots.push({ id: "pod.taste", title: "Your Podster", value: es.genres.length ? plural(es.genres.length, "interest") : "Set up", detail: topGenre ? `Most into ${topGenre}` : "Pick what you like", tint: "#eab308",
    lines: es.genres.slice(0, 8) });

  return slots;
}
