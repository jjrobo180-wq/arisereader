// Arise WorkHub: pinned banners. A teacher pins up to five to-dos, events or meetings
// and they show as colored banners across the top of the Hub.
import type { HubEvent, Meeting, Task, Workspace } from "./teacherHub";

export const MAX_PINS = 5;
export type PinKind = "task" | "event" | "meeting";
export type Pin = {
  id: string; kind: PinKind; refId: string; color: string;
  /** Replaces the item's own title in the banner, when the teacher wants different words. */
  label: string;
  /** What an event looked like when pinned. A synced calendar hands out new ids, so this finds it again. */
  snap?: { title: string; date: string; start: string };
};

export const PIN_COLORS = [
  { name: "Teal", hex: "#0f766e" }, { name: "Blue", hex: "#1d4ed8" }, { name: "Purple", hex: "#7e22ce" },
  { name: "Pink", hex: "#be185d" }, { name: "Red", hex: "#b91c1c" }, { name: "Orange", hex: "#c2410c" },
  { name: "Yellow", hex: "#facc15" }, { name: "Green", hex: "#15803d" }, { name: "Dark", hex: "#0f172a" },
] as const;

export const cleanColor = (value: unknown, fallback: string = PIN_COLORS[0].hex): string => {
  const v = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : fallback;
};

/** White or dark text, whichever reads better on this color. */
export function textOn(hex: string): "#ffffff" | "#0f172a" {
  const c = cleanColor(hex);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#0f172a" : "#ffffff";
}

export type PinnedItem = {
  pin: Pin; title: string; detail: string; done: boolean | null;
  item: { kind: "task"; task: Task } | { kind: "event"; event: HubEvent } | { kind: "meeting"; meeting: Meeting };
};

const joined = (...parts: (string | undefined | false)[]) => parts.filter(Boolean).join(" · ");
const clock = (e: HubEvent) => (e.start ? `${e.start}${e.end ? `–${e.end}` : ""}` : "All day");

export function findEvent(ws: Pick<Workspace, "events">, pin: Pin): HubEvent | undefined {
  return ws.events.find((e) => e.id === pin.refId)
    ?? (pin.snap ? ws.events.find((e) => e.title === pin.snap!.title && e.date === pin.snap!.date && e.start === pin.snap!.start) : undefined);
}

/** The pins that still point at something, in the order they were pinned. */
export function resolvePins(ws: Pick<Workspace, "pins" | "tasks" | "events" | "meetings">): PinnedItem[] {
  const out: PinnedItem[] = [];
  for (const pin of ws.pins || []) {
    if (pin.kind === "task") {
      const task = ws.tasks.find((t) => t.id === pin.refId);
      if (task) out.push({ pin, title: pin.label || task.title, detail: joined(task.dueDate ? `Due ${task.dueDate}` : "", task.recurring), done: task.done, item: { kind: "task", task } });
    } else if (pin.kind === "event") {
      const event = findEvent(ws, pin);
      if (event) out.push({ pin, title: pin.label || event.title, detail: joined(event.repeat ? `Repeats: ${event.repeat}` : event.date, clock(event), event.location), done: null, item: { kind: "event", event } });
    } else {
      const meeting = ws.meetings.find((m) => m.id === pin.refId);
      if (meeting) out.push({ pin, title: pin.label || joined(meeting.student, meeting.type), detail: meeting.date || "No date", done: meeting.done, item: { kind: "meeting", meeting } });
    }
  }
  return out;
}

export const isPinned = (ws: Pick<Workspace, "pins" | "tasks" | "events" | "meetings">, kind: PinKind, refId: string) =>
  resolvePins(ws).some((p) => p.pin.kind === kind && (kind === "event" ? (p.item as any).event.id === refId : p.pin.refId === refId));

/** Pins or unpins one thing. Dead pins are cleared first so they never use up the five spots. */
export function togglePin(ws: Workspace, kind: PinKind, refId: string, makeId: () => string): { workspace: Workspace; full: boolean } {
  const live = new Set(resolvePins(ws).map((p) => p.pin.id));
  const pins = (ws.pins || []).filter((p) => live.has(p.id));
  const existing = resolvePins(ws).find((p) => p.pin.kind === kind && (kind === "event" ? (p.item as any).event.id === refId : p.pin.refId === refId));
  if (existing) return { workspace: { ...ws, pins: pins.filter((p) => p.id !== existing.pin.id) }, full: false };
  if (pins.length >= MAX_PINS) return { workspace: { ...ws, pins }, full: true };
  const event = kind === "event" ? ws.events.find((e) => e.id === refId) : undefined;
  if (kind === "event" && !event) return { workspace: ws, full: false };
  const color = PIN_COLORS.find((c) => !pins.some((p) => p.color === c.hex))?.hex ?? PIN_COLORS[0].hex;
  const pin: Pin = { id: makeId(), kind, refId, color, label: "", ...(event ? { snap: { title: event.title, date: event.date, start: event.start } } : {}) };
  return { workspace: { ...ws, pins: [...pins, pin] }, full: false };
}

/** A saved list of pins made safe: right shape, real colors, no more than five. */
export function cleanPins(raw: unknown): Pin[] {
  if (!Array.isArray(raw)) return [];
  const out: Pin[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const kind = (p as any).kind;
    if (kind !== "task" && kind !== "event" && kind !== "meeting") continue;
    const snap = (p as any).snap;
    out.push({
      id: String((p as any).id ?? "").slice(0, 80) || `pin${out.length}`, kind, refId: String((p as any).refId ?? "").slice(0, 80),
      color: cleanColor((p as any).color), label: String((p as any).label ?? "").slice(0, 120),
      ...(snap && typeof snap === "object" ? { snap: { title: String(snap.title ?? "").slice(0, 200), date: String(snap.date ?? ""), start: String(snap.start ?? "") } } : {}),
    });
    if (out.length >= MAX_PINS) break;
  }
  return out;
}
