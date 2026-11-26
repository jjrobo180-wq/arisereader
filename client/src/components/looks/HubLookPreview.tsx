// What a look really does to the hubs: the WorkHub / To Do Tasks screen, drawn full size (390 px
// wide, like a phone) in the look's own colors, type, corners and borders, then scaled down evenly so
// nothing is squeezed. Used for the cards and the preview sheet in Customize > Theme.
// Nothing here can change anything; it is only for looking.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { NotesTheme } from "@shared/notesThemes";

const W = 390;
const fonts = new Set<string>();
export const loadLookFont = (href?: string) => {
  if (!href || fonts.has(href) || typeof document === "undefined") return;
  fonts.add(href);
  const l = document.createElement("link");
  l.rel = "stylesheet"; l.href = href;
  document.head.appendChild(l);
};

/** The few colors a theme that is not a look (Tile, Old Computer, Classic) draws with. */
export type PreviewColors = Pick<NotesTheme, "bg" | "card" | "line" | "ink" | "muted" | "accent" | "onAccent" | "font" | "display" | "radius"> & Partial<Pick<NotesTheme, "border" | "hardShadow" | "dark" | "fontUrl" | "accentSoft" | "accentInk">>;

const TASKS = [
  { t: "Send Kha’s family the CMAS opt-out form", m: "Overdue · yesterday", late: true },
  { t: "Email paras the ELA meeting recap", m: "Overdue · Monday", late: true },
  { t: "Print Emmett Till test for Dec 4", m: "Today · 3:00 PM · Routines" },
  { t: "Poems for 1:1 kids approved", m: "Done", done: true },
];

function Screen({ c, height }: { c: PreviewColors; height: number }) {
  const r = Math.min(c.radius, 28), bw = c.border ?? 1;
  const edge = `${bw}px solid ${c.line}`;
  const shadow = c.hardShadow ? `3px 3px 0 ${c.ink}` : c.dark ? "none" : "0 1px 2px rgba(0,0,0,.05)";
  const late = c.dark ? "#ff8a7a" : "#c0392b";
  const soft = c.accentSoft ?? c.card;
  const box: CSSProperties = { background: c.card, border: edge, borderRadius: r, boxShadow: shadow };
  const chip = (on: boolean): CSSProperties => ({ padding: "0 14px", height: 36, display: "inline-flex", alignItems: "center", borderRadius: Math.min(r, 18), fontSize: 14, fontWeight: on ? 700 : 500, background: on ? c.accent : c.card, color: on ? c.onAccent : c.ink, border: on ? `${bw}px solid ${c.accent}` : edge, whiteSpace: "nowrap" });
  return <div style={{ width: W, height, overflow: "hidden", position: "relative", background: c.bg, color: c.ink, fontFamily: c.font, display: "flex", flexDirection: "column" }}>
    <div style={{ padding: "22px 18px 0", display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 30, height: 30, borderRadius: Math.min(r, 9), background: c.accent }} />
        <b style={{ fontFamily: c.display, fontSize: 17, marginRight: "auto" }}>WorkHub</b>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: 36, height: 36, borderRadius: Math.min(r, 18), border: edge, background: c.card }} />)}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: c.display, fontSize: 38, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1 }}>Tasks</span>
        <span style={{ fontSize: 15, color: c.muted }}>22 open · <span style={{ color: late, fontWeight: 700 }}>2 overdue</span></span>
      </div>
      <div style={{ display: "flex", gap: 8, overflow: "hidden" }}><span style={chip(true)}>All 22</span><span style={chip(false)}>Today 3</span><span style={chip(false)}>Upcoming 4</span><span style={chip(false)}>Done</span></div>
      <div style={{ ...box, background: soft, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
        <span style={{ width: 22, height: 22, borderRadius: 11, background: c.accent }} />
        <b style={{ flex: 1, fontSize: 15, color: c.accentInk ?? c.ink }}>Arise asks</b>
        <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 10, background: c.accent, color: c.onAccent }}>1 new</span>
      </div>
      <div style={{ ...box, overflow: "hidden" }}>
        {TASKS.map((x, i) => <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "13px 14px", borderTop: i ? `1px solid ${c.line}` : undefined, opacity: x.done ? 0.6 : 1 }}>
          <span style={{ width: 22, height: 22, flex: "none", borderRadius: c.radius === 0 ? 0 : 11, border: `2px solid ${x.done ? c.accent : c.muted}`, background: x.done ? c.accent : "transparent", marginTop: 1 }} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 16, fontWeight: 600, textDecoration: x.done ? "line-through" : undefined }}>{x.t}</span>
            <span style={{ display: "block", marginTop: 3, fontSize: 13, color: x.late ? late : c.muted }}>{x.m}</span>
          </span>
        </div>)}
      </div>
    </div>
    <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", padding: "10px 8px 22px", background: c.card, borderTop: edge }}>
      {["Home", "Tasks", "+", "Plugins", "You"].map((l) => l === "+"
        ? <span key={l} style={{ width: 50, height: 50, borderRadius: Math.min(r, 25), background: c.accent, color: c.onAccent, display: "grid", placeItems: "center", fontSize: 28, fontWeight: 600 }}>+</span>
        : <span key={l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontSize: 12, fontWeight: l === "Tasks" ? 800 : 500, color: l === "Tasks" ? (c.accentInk ?? c.accent) : c.muted }}>
          <span style={{ width: 22, height: 22, borderRadius: Math.min(r, 6), border: `2px solid currentColor` }} />{l}</span>)}
    </div>
  </div>;
}

/** The Tasks screen in this look, scaled to the width it is given. `crop` shows only the top of the
 *  screen (for the small cards); without it the whole phone screen shows, tab bar included. */
export default function HubLookPreview({ colors, crop, className = "" }: { colors: PreviewColors; crop?: number; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const measure = () => setW(el.clientWidth);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    // Fonts load when a preview first comes into view, not all at once for every look.
    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { loadLookFont(colors.fontUrl); io?.disconnect(); } }) : null;
    if (io) io.observe(el); else loadLookFont(colors.fontUrl);
    return () => { ro?.disconnect(); io?.disconnect(); };
  }, [colors.fontUrl]);
  const full = 780, height = crop ?? full;
  const scale = w ? w / W : 0;
  return <div ref={box} className={className} aria-hidden style={{ width: "100%", height: w ? height * scale : undefined, aspectRatio: w ? undefined : `${W} / ${height}`, overflow: "hidden", position: "relative" }}>
    {w > 0 && <div style={{ width: W, height, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}><Screen c={colors} height={full} /></div>}
  </div>;
}
