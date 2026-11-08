// Arise Design templates: 18 layouts ("recipes") that work at any size, filled with content for parties,
// sales, school, church, work, food, sports and more, in every size (Instagram, stories, flyers,
// posters, invitations, business cards, thumbnails, certificates…). Each template makes a whole design.
import { cleanDesign, dId, sizeOf, type DEl, type Design, type DesignCopy, type DPage } from "./designModel";

export type DesignTemplate = { id: string; name: string; category: string; size: string; make: () => Design };
type Pal = { bg: string; ink: string; accent: string; soft: string; on: string };
type Fill = { headline: string; sub?: string; body?: string; cta?: string; emoji?: string; extra?: string[]; name?: string };
type Recipe = (W: number, H: number, p: Pal, f: Fill) => { bg: string; els: DEl[] };

export const PALETTES: Record<string, Pal> = {
  grape: { bg: "linear:135:#7c3aed:#db2777", ink: "#ffffff", accent: "#fde047", soft: "#f5f3ff", on: "#1e1b4b" },
  sunset: { bg: "linear:135:#f97316:#e11d48", ink: "#ffffff", accent: "#fff7ed", soft: "#ffedd5", on: "#7c2d12" },
  ocean: { bg: "linear:160:#0ea5e9:#1e3a8a", ink: "#ffffff", accent: "#67e8f9", soft: "#e0f2fe", on: "#0c4a6e" },
  mint: { bg: "#ecfdf5", ink: "#064e3b", accent: "#10b981", soft: "#d1fae5", on: "#ffffff" },
  cream: { bg: "#faf7f2", ink: "#1c1917", accent: "#b45309", soft: "#f5ede1", on: "#ffffff" },
  night: { bg: "#0f172a", ink: "#f8fafc", accent: "#facc15", soft: "#1e293b", on: "#0f172a" },
  blush: { bg: "#fdf2f8", ink: "#831843", accent: "#ec4899", soft: "#fce7f3", on: "#ffffff" },
  lemon: { bg: "#fef9c3", ink: "#1f2937", accent: "#ef4444", soft: "#fef08a", on: "#ffffff" },
  forest: { bg: "#14532d", ink: "#f0fdf4", accent: "#bef264", soft: "#166534", on: "#14532d" },
  sky: { bg: "#eff6ff", ink: "#1e3a8a", accent: "#2563eb", soft: "#dbeafe", on: "#ffffff" },
  candy: { bg: "linear:135:#fbc2eb:#a6c1ee", ink: "#312e81", accent: "#ffffff", soft: "#ede9fe", on: "#312e81" },
  ink: { bg: "#ffffff", ink: "#0f172a", accent: "#0f172a", soft: "#f1f5f9", on: "#ffffff" },
  coral: { bg: "#fff1f2", ink: "#4c0519", accent: "#f43f5e", soft: "#ffe4e6", on: "#ffffff" },
  royal: { bg: "linear:180:#1e1b4b:#4c1d95", ink: "#fefce8", accent: "#fbbf24", soft: "#312e81", on: "#1e1b4b" },
};

// ─── building blocks ───
const el = (o: Partial<DEl> & { type: DEl["type"] }): DEl => ({ id: dId(), x: 0, y: 0, w: 100, h: 100, ...o });
const lines = (t: string, size: number, w: number, lineH: number) => { const per = Math.max(1, Math.floor(w / (size * 0.55))); return t.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / per)), 0) * size * lineH; };
const text = (t: string, o: Partial<DEl>): DEl => {
  const size = o.size ?? 48, w = o.w ?? 600, lineH = o.lineH ?? 1.15;
  return el({ type: "text", text: t, font: "Inter", weight: 400, align: "center", color: "#111827", lineH, h: Math.round(lines(o.upper ? t.toUpperCase() : t, size, w, lineH)), ...o, size, w });
};
const box = (o: Partial<DEl>) => el({ type: "shape", shape: "rect", ...o });
const frame = (o: Partial<DEl>) => el({ type: "image", fit: "cover", fill: "#cbd5e1", ...o });
const sticker = (emoji: string, o: Partial<DEl>) => el({ type: "sticker", emoji, ...o });
const centerX = (W: number, w: number) => Math.round((W - w) / 2);

// ─── the recipes (every number is relative to the page, so each works at any size) ───
const R: Record<string, Recipe> = {
  boldCenter: (W, H, p, f) => {
    const u = Math.min(W, H) / 100, tw = W * 0.84;
    const els = [
      box({ shape: "blob", x: -W * 0.12, y: -H * 0.08, w: W * 0.5, h: W * 0.5, fill: "#ffffff22" }),
      box({ shape: "ellipse", x: W * 0.72, y: H * 0.78, w: W * 0.42, h: W * 0.42, fill: "#ffffff1a" }),
      sticker(f.emoji || "✨", { x: centerX(W, u * 18), y: H * 0.1, w: u * 18, h: u * 18 }),
      text(f.headline, { x: centerX(W, tw), y: H * 0.3, w: tw, size: Math.round(u * 13), font: "Poppins", weight: 900, color: p.ink, lineH: 1.05 }),
      text(f.sub || "", { x: centerX(W, tw), y: H * 0.56, w: tw, size: Math.round(u * 5), font: "Poppins", color: p.ink, lineH: 1.3 }),
      box({ shape: "round", x: centerX(W, u * 44), y: H * 0.74, w: u * 44, h: u * 11, fill: p.accent, radius: u * 6 }),
      text(f.cta || "Learn more", { x: centerX(W, u * 44), y: H * 0.74 + u * 2.8, w: u * 44, size: Math.round(u * 4.6), font: "Poppins", weight: 700, color: p.on }),
    ];
    return { bg: p.bg, els };
  },
  split: (W, H, p, f) => {
    const u = Math.min(W, H) / 100, wide = W >= H, half = wide ? W * 0.5 : H * 0.5;
    const tx = wide ? W * 0.06 : W * 0.08, tw = wide ? W * 0.4 : W * 0.84, ty = wide ? H * 0.22 : H * 0.56;
    return { bg: p.soft, els: [
      frame(wide ? { x: W * 0.5, y: 0, w: W * 0.5, h: H } : { x: 0, y: 0, w: W, h: half }),
      box({ shape: "rect", x: tx, y: ty - u * 6, w: u * 16, h: u * 1.6, fill: p.accent }),
      text(f.headline, { x: tx, y: ty, w: tw, size: Math.round(u * 10), font: "DM Serif Display", color: p.ink, align: "left", lineH: 1.05 }),
      text(f.sub || "", { x: tx, y: ty + u * 30, w: tw, size: Math.round(u * 4.2), font: "Inter", color: p.ink, align: "left", lineH: 1.45 }),
      text((f.cta || "Find out more") + "  →", { x: tx, y: ty + u * 48, w: tw, size: Math.round(u * 4), font: "Inter", weight: 700, color: p.accent, align: "left" }),
    ] };
  },
  photoBand: (W, H, p, f) => {
    const u = Math.min(W, H) / 100, tw = W * 0.86;
    return { bg: "#111827", els: [
      frame({ x: 0, y: 0, w: W, h: H }),
      box({ x: 0, y: H * 0.58, w: W, h: H * 0.42, fill: "linear:180:#00000000:#000000cc" }),
      text(f.headline, { x: centerX(W, tw), y: H * 0.66, w: tw, size: Math.round(u * 11), font: "Bebas Neue", color: "#ffffff", letter: Math.round(u * 0.4), lineH: 1 }),
      text(f.sub || "", { x: centerX(W, tw), y: H * 0.86, w: tw, size: Math.round(u * 4.2), font: "Inter", weight: 700, color: "#ffffffdd", upper: true, letter: Math.round(u * 0.6) }),
    ] };
  },
  circle: (W, H, p, f) => {
    const u = Math.min(W, H) / 100, d = Math.min(W, H) * 0.78;
    return { bg: p.bg, els: [
      box({ shape: "ellipse", x: centerX(W, d), y: (H - d) / 2, w: d, h: d, fill: p.soft }),
      box({ shape: "badge", x: W / 2 + d * 0.22, y: (H - d) / 2 - u * 2, w: u * 24, h: u * 24, fill: p.accent, rot: 12 }),
      text(f.extra?.[0] || "NEW", { x: W / 2 + d * 0.22, y: (H - d) / 2 + u * 7.5, w: u * 24, size: Math.round(u * 5), font: "Archivo Black", color: p.on, rot: 12 }),
      text(f.headline, { x: centerX(W, d * 0.8), y: H / 2 - u * 16, w: d * 0.8, size: Math.round(u * 10), font: "Montserrat", weight: 900, color: p.on === "#ffffff" ? p.ink : p.ink, lineH: 1.05 }),
      text(f.sub || "", { x: centerX(W, d * 0.7), y: H / 2 + u * 10, w: d * 0.7, size: Math.round(u * 4.2), font: "Montserrat", color: p.ink, lineH: 1.35 }),
    ] };
  },
  minimal: (W, H, p, f) => {
    const u = Math.min(W, H) / 100, tw = W * 0.76;
    return { bg: p.bg, els: [
      box({ shape: "rect", x: u * 5, y: u * 5, w: W - u * 10, h: H - u * 10, fill: "none", stroke: p.ink, strokeW: Math.max(2, Math.round(u * 0.35)) }),
      text((f.extra?.[0] || "est. 2026").toUpperCase(), { x: centerX(W, tw), y: H * 0.2, w: tw, size: Math.round(u * 3), font: "Raleway", weight: 700, color: p.accent, letter: Math.round(u * 1.2) }),
      text(f.headline, { x: centerX(W, tw), y: H * 0.3, w: tw, size: Math.round(u * 11), font: "Playfair Display", italic: true, color: p.ink, lineH: 1.05 }),
      el({ type: "line", line: "solid", x: centerX(W, u * 20), y: H * 0.58, w: u * 20, h: u * 2, stroke: p.accent, strokeW: Math.max(2, Math.round(u * 0.4)) }),
      text(f.sub || "", { x: centerX(W, tw * 0.9), y: H * 0.64, w: tw * 0.9, size: Math.round(u * 4), font: "Raleway", color: p.ink, lineH: 1.5 }),
    ] };
  },
  sale: (W, H, p, f) => {
    const u = Math.min(W, H) / 100, tw = W * 0.86;
    return { bg: p.bg, els: [
      box({ shape: "star4", x: W * 0.06, y: H * 0.06, w: u * 12, h: u * 12, fill: p.accent }),
      box({ shape: "star4", x: W * 0.84, y: H * 0.8, w: u * 9, h: u * 9, fill: p.accent }),
      text(f.headline, { x: centerX(W, tw), y: H * 0.16, w: tw, size: Math.round(u * 17), font: "Anton", color: p.ink, upper: true, lineH: 0.95 }),
      box({ shape: "badge", x: centerX(W, u * 44), y: H * 0.44, w: u * 44, h: u * 44, fill: p.accent }),
      text(f.extra?.[0] || "50%\nOFF", { x: centerX(W, u * 44), y: H * 0.44 + u * 9, w: u * 44, size: Math.round(u * 11), font: "Anton", color: p.on, lineH: 0.95 }),
      text(f.sub || "", { x: centerX(W, tw), y: H * 0.86, w: tw, size: Math.round(u * 4.2), font: "Montserrat", weight: 700, color: p.ink, upper: true, letter: Math.round(u * 0.5) }),
    ] };
  },
  event: (W, H, p, f) => {
    const u = Math.min(W, H) / 100, tw = W * 0.84, x0 = centerX(W, tw);
    const [date = "SAT · JUNE 14", time = "2:00 PM", place = "Community Park"] = f.extra || [];
    return { bg: p.bg, els: [
      box({ x: 0, y: 0, w: W, h: H * 0.06, fill: p.accent }),
      text(date, { x: x0, y: H * 0.12, w: tw, size: Math.round(u * 5), font: "Bebas Neue", color: p.accent, letter: Math.round(u * 0.8) }),
      text(f.headline, { x: x0, y: H * 0.2, w: tw, size: Math.round(u * 13), font: "Bebas Neue", color: p.ink, lineH: 0.95 }),
      sticker(f.emoji || "🎉", { x: centerX(W, u * 22), y: H * 0.47, w: u * 22, h: u * 22 }),
      text(f.sub || "", { x: x0, y: H * 0.64, w: tw, size: Math.round(u * 4.4), font: "Poppins", color: p.ink, lineH: 1.4 }),
      box({ shape: "round", x: x0, y: H * 0.8, w: tw, h: H * 0.1, fill: p.soft, radius: u * 3 }),
      text(`${time}  ·  ${place}`, { x: x0, y: H * 0.8 + H * 0.05 - u * 2.6, w: tw, size: Math.round(u * 4.2), font: "Poppins", weight: 700, color: p.ink }),
    ] };
  },
  quote: (W, H, p, f) => {
    const u = Math.min(W, H) / 100, tw = W * 0.78;
    return { bg: p.bg, els: [
      text("“", { x: centerX(W, u * 30), y: H * 0.08, w: u * 30, size: Math.round(u * 40), font: "DM Serif Display", color: p.accent, lineH: 1 }),
      text(f.headline, { x: centerX(W, tw), y: H * 0.36, w: tw, size: Math.round(u * 7), font: "DM Serif Display", color: p.ink, lineH: 1.25 }),
      text(f.sub ? `— ${f.sub}` : "", { x: centerX(W, tw), y: H * 0.78, w: tw, size: Math.round(u * 3.8), font: "Inter", weight: 700, color: p.accent, upper: true, letter: Math.round(u * 0.6) }),
    ] };
  },
  list: (W, H, p, f) => {
    const u = Math.min(W, H) / 100, tw = W * 0.82, x0 = centerX(W, tw), items = (f.extra && f.extra.length ? f.extra : ["First thing", "Second thing", "Third thing", "Fourth thing"]).slice(0, 5);
    const top = H * 0.32, step = Math.min(H * 0.12, (H * 0.62) / items.length);
    return { bg: p.bg, els: [
      text(f.headline, { x: x0, y: H * 0.07, w: tw, size: Math.round(u * 9), font: "Poppins", weight: 900, color: p.ink, align: "left", lineH: 1.05 }),
      box({ x: x0, y: H * 0.25, w: u * 14, h: u * 1.4, fill: p.accent }),
      ...items.flatMap((it, i) => [
        box({ shape: "ellipse", x: x0, y: top + i * step, w: u * 10, h: u * 10, fill: p.accent }),
        text(String(i + 1), { x: x0, y: top + i * step + u * 2, w: u * 10, size: Math.round(u * 5), font: "Poppins", weight: 900, color: p.on }),
        text(it, { x: x0 + u * 14, y: top + i * step + u * 2, w: tw - u * 14, size: Math.round(u * 4.6), font: "Poppins", weight: 700, color: p.ink, align: "left" }),
      ]),
    ] };
  },
  playful: (W, H, p, f) => {
    const u = Math.min(W, H) / 100, tw = W * 0.8;
    return { bg: p.bg, els: [
      box({ shape: "blob", x: -W * 0.15, y: -H * 0.1, w: W * 0.55, h: W * 0.5, fill: p.accent, opacity: 0.85 }),
      box({ shape: "blob", x: W * 0.62, y: H * 0.72, w: W * 0.55, h: W * 0.5, fill: p.soft, rot: 160 }),
      box({ shape: "ellipse", x: W * 0.8, y: H * 0.12, w: u * 8, h: u * 8, fill: p.accent }),
      sticker(f.emoji || "🌈", { x: W * 0.1, y: H * 0.74, w: u * 16, h: u * 16, rot: -12 }),
      text(f.headline, { x: centerX(W, tw), y: H * 0.32, w: tw, size: Math.round(u * 12), font: "Righteous", color: p.ink, lineH: 1.05 }),
      text(f.sub || "", { x: centerX(W, tw * 0.8), y: H * 0.6, w: tw * 0.8, size: Math.round(u * 4.6), font: "Quicksand", weight: 700, color: p.ink, lineH: 1.35 }),
    ] };
  },
  arch: (W, H, p, f) => {
    const u = Math.min(W, H) / 100, aw = W * 0.7, ah = H * 0.72, ax = centerX(W, aw), ay = H * 0.14;
    return { bg: p.soft, els: [
      box({ shape: "arch", x: ax, y: ay, w: aw, h: ah, fill: p.bg }),
      box({ shape: "arch", x: ax + u * 2.5, y: ay + u * 2.5, w: aw - u * 5, h: ah - u * 5, fill: "none", stroke: p.accent, strokeW: Math.max(2, Math.round(u * 0.35)) }),
      text((f.extra?.[0] || "You're invited").toUpperCase(), { x: ax, y: ay + ah * 0.3, w: aw, size: Math.round(u * 3.2), font: "Raleway", weight: 700, color: p.accent, letter: Math.round(u * 1) }),
      text(f.headline, { x: ax + aw * 0.06, y: ay + ah * 0.38, w: aw * 0.88, size: Math.round(u * 10), font: "Dancing Script", weight: 700, color: p.ink, lineH: 1.05 }),
      text(f.sub || "", { x: ax + aw * 0.1, y: ay + ah * 0.68, w: aw * 0.8, size: Math.round(u * 3.8), font: "Raleway", color: p.ink, lineH: 1.5 }),
      sticker(f.emoji || "🌿", { x: centerX(W, u * 12), y: ay + ah * 0.1, w: u * 12, h: u * 12 }),
    ] };
  },
  certificate: (W, H, p, f) => {
    const u = Math.min(W, H) / 100, tw = W * 0.74;
    return { bg: p.bg, els: [
      box({ x: u * 3, y: u * 3, w: W - u * 6, h: H - u * 6, fill: "none", stroke: p.accent, strokeW: Math.max(3, Math.round(u * 1)) }),
      box({ x: u * 5.5, y: u * 5.5, w: W - u * 11, h: H - u * 11, fill: "none", stroke: p.accent, strokeW: Math.max(1, Math.round(u * 0.25)) }),
      box({ shape: "badge", x: W * 0.78, y: H * 0.66, w: u * 20, h: u * 20, fill: p.accent }),
      sticker("🏅", { x: W * 0.78 + u * 4, y: H * 0.66 + u * 4, w: u * 12, h: u * 12 }),
      text("CERTIFICATE", { x: centerX(W, tw), y: H * 0.12, w: tw, size: Math.round(u * 8), font: "Playfair Display", weight: 700, color: p.ink, letter: Math.round(u * 1.2) }),
      text((f.extra?.[0] || "of achievement").toUpperCase(), { x: centerX(W, tw), y: H * 0.25, w: tw, size: Math.round(u * 3.2), font: "Raleway", weight: 700, color: p.accent, letter: Math.round(u * 1) }),
      text("This certificate is proudly presented to", { x: centerX(W, tw), y: H * 0.36, w: tw, size: Math.round(u * 3), font: "Raleway", color: p.ink }),
      text(f.name || "Student Name", { x: centerX(W, tw), y: H * 0.44, w: tw, size: Math.round(u * 10), font: "Dancing Script", weight: 700, color: p.ink }),
      el({ type: "line", x: centerX(W, tw * 0.7), y: H * 0.6, w: tw * 0.7, h: u * 2, stroke: p.ink, strokeW: 2 }),
      text(f.headline, { x: centerX(W, tw * 0.8), y: H * 0.64, w: tw * 0.8, size: Math.round(u * 3.4), font: "Raleway", color: p.ink, lineH: 1.4 }),
      el({ type: "line", x: W * 0.14, y: H * 0.82, w: W * 0.24, h: u * 2, stroke: p.ink, strokeW: 2 }),
      text("Signature", { x: W * 0.14, y: H * 0.85, w: W * 0.24, size: Math.round(u * 2.6), font: "Raleway", color: p.ink }),
      el({ type: "line", x: W * 0.44, y: H * 0.82, w: W * 0.24, h: u * 2, stroke: p.ink, strokeW: 2 }),
      text("Date", { x: W * 0.44, y: H * 0.85, w: W * 0.24, size: Math.round(u * 2.6), font: "Raleway", color: p.ink }),
    ] };
  },
  card: (W, H, p, f) => {
    const u = Math.min(W, H) / 100;
    const [l1 = "(555) 123-4567", l2 = "hello@example.com", l3 = "www.example.com"] = f.extra || [];
    return { bg: p.bg, els: [
      box({ x: 0, y: 0, w: W * 0.34, h: H, fill: p.accent }),
      sticker(f.emoji || "💼", { x: W * 0.17 - u * 13, y: H / 2 - u * 13, w: u * 26, h: u * 26 }),
      text(f.name || f.headline, { x: W * 0.4, y: H * 0.18, w: W * 0.56, size: Math.round(u * 11), font: "Montserrat", weight: 900, color: p.ink, align: "left", lineH: 1 }),
      text((f.sub || "Job title").toUpperCase(), { x: W * 0.4, y: H * 0.42, w: W * 0.56, size: Math.round(u * 5), font: "Montserrat", weight: 700, color: p.accent, align: "left", letter: Math.round(u * 0.8) }),
      text(`${l1}\n${l2}\n${l3}`, { x: W * 0.4, y: H * 0.58, w: W * 0.56, size: Math.round(u * 5.4), font: "Inter", color: p.ink, align: "left", lineH: 1.45 }),
    ] };
  },
  thumbnail: (W, H, p, f) => {
    const u = Math.min(W, H) / 100;
    return { bg: p.bg, els: [
      frame({ x: W * 0.52, y: H * 0.08, w: W * 0.44, h: H * 0.84, shape: "round", radius: u * 4 }),
      text(f.headline, { x: W * 0.04, y: H * 0.12, w: W * 0.5, size: Math.round(u * 17), font: "Anton", color: p.ink, outline: p.on === "#ffffff" ? "#000000" : p.on, upper: true, align: "left", lineH: 0.95 }),
      box({ shape: "round", x: W * 0.04, y: H * 0.74, w: W * 0.34, h: H * 0.14, fill: p.accent, radius: u * 2, rot: -3 }),
      text(f.sub || "WATCH NOW", { x: W * 0.04, y: H * 0.74 + H * 0.07 - u * 4, w: W * 0.34, size: Math.round(u * 7), font: "Bebas Neue", color: p.on, rot: -3 }),
      sticker(f.emoji || "🔥", { x: W * 0.42, y: H * 0.62, w: u * 24, h: u * 24, rot: 10 }),
    ] };
  },
  menu: (W, H, p, f) => {
    const u = Math.min(W, H) / 100, tw = W * 0.8, x0 = centerX(W, tw);
    const items = (f.extra && f.extra.length ? f.extra : ["Pancakes|8", "Avocado toast|10", "Breakfast burrito|12", "Fruit bowl|7", "Iced latte|5", "Fresh juice|6"]).slice(0, 8);
    const top = H * 0.32, step = Math.min(H * 0.075, (H * 0.6) / items.length);
    return { bg: p.bg, els: [
      sticker(f.emoji || "☕", { x: centerX(W, u * 14), y: H * 0.05, w: u * 14, h: u * 14 }),
      text(f.headline, { x: x0, y: H * 0.14, w: tw, size: Math.round(u * 11), font: "Lobster", color: p.ink }),
      text((f.sub || "Served daily 7am – 2pm").toUpperCase(), { x: x0, y: H * 0.25, w: tw, size: Math.round(u * 2.8), font: "Raleway", weight: 700, color: p.accent, letter: Math.round(u * 0.8) }),
      ...items.flatMap((it, i) => { const [name, price = ""] = it.split("|"); return [
        text(name, { x: x0, y: top + i * step, w: tw * 0.75, size: Math.round(u * 4.2), font: "Playfair Display", weight: 700, color: p.ink, align: "left" }),
        text(price ? `$${price}` : "", { x: x0 + tw * 0.75, y: top + i * step, w: tw * 0.25, size: Math.round(u * 4.2), font: "Playfair Display", weight: 700, color: p.accent, align: "right" }),
        el({ type: "line", line: "dotted", x: x0, y: top + i * step + u * 5.8, w: tw, h: u * 1, stroke: p.ink, strokeW: Math.max(1, Math.round(u * 0.2)), opacity: 0.4 }),
      ]; }),
    ] };
  },
  worksheet: (W, H, p, f) => {
    const u = Math.min(W, H) / 100, tw = W * 0.84, x0 = centerX(W, tw);
    const qs = (f.extra && f.extra.length ? f.extra : ["What is 7 + 5?", "Write a word that rhymes with cat.", "Draw a shape with 4 sides.", "What color do you get when you mix blue and yellow?", "Count the stars: ⭐⭐⭐⭐⭐"]).slice(0, 8);
    const top = H * 0.24, step = (H * 0.7) / qs.length;
    return { bg: "#ffffff", els: [
      text("Name: ________________________     Date: ____________", { x: x0, y: H * 0.04, w: tw, size: Math.round(u * 2.8), font: "Inter", color: "#334155", align: "left" }),
      box({ shape: "round", x: x0, y: H * 0.08, w: tw, h: H * 0.11, fill: p.soft, radius: u * 3 }),
      sticker(f.emoji || "✏️", { x: x0 + u * 2, y: H * 0.08 + H * 0.055 - u * 5, w: u * 10, h: u * 10 }),
      text(f.headline, { x: x0 + u * 14, y: H * 0.08 + H * 0.055 - u * 3.6, w: tw - u * 16, size: Math.round(u * 6), font: "Lexend", weight: 700, color: p.ink, align: "left" }),
      ...qs.flatMap((q, i) => [
        text(`${i + 1}. ${q}`, { x: x0, y: top + i * step, w: tw, size: Math.round(u * 3.4), font: "Lexend", color: "#0f172a", align: "left" }),
        el({ type: "line", x: x0, y: top + i * step + step * 0.62, w: tw, h: u * 1, stroke: "#94a3b8", strokeW: 2 }),
      ]),
    ] };
  },
  banner: (W, H, p, f) => {
    const u = Math.min(W, H) / 100;
    return { bg: p.bg, els: [
      box({ shape: "ellipse", x: W * 0.72, y: -H * 0.4, w: H * 1.6, h: H * 1.6, fill: p.soft }),
      box({ shape: "ellipse", x: W * 0.86, y: H * 0.3, w: H * 0.7, h: H * 0.7, fill: p.accent }),
      text(f.headline, { x: W * 0.05, y: H * 0.18, w: W * 0.6, size: Math.round(u * 22), font: "Poppins", weight: 900, color: p.ink, align: "left", lineH: 1 }),
      text(f.sub || "", { x: W * 0.05, y: H * 0.6, w: W * 0.6, size: Math.round(u * 9), font: "Poppins", color: p.ink, align: "left" }),
      sticker(f.emoji || "🚀", { x: W * 0.88, y: H * 0.38, w: H * 0.5, h: H * 0.5 }),
    ] };
  },
  stat: (W, H, p, f) => {
    const u = Math.min(W, H) / 100, tw = W * 0.84;
    return { bg: p.bg, els: [
      text(f.extra?.[0] || "87%", { x: centerX(W, tw), y: H * 0.18, w: tw, size: Math.round(u * 32), font: "Anton", color: p.accent, lineH: 1 }),
      text(f.headline, { x: centerX(W, tw), y: H * 0.56, w: tw, size: Math.round(u * 6.5), font: "Poppins", weight: 700, color: p.ink, lineH: 1.2 }),
      text(f.sub || "", { x: centerX(W, tw), y: H * 0.8, w: tw, size: Math.round(u * 3.4), font: "Inter", color: p.ink, opacity: 0.7 }),
    ] };
  },
};
export const RECIPES = Object.keys(R);

const build = (size: string, recipe: string, pal: string, fill: Fill): Design => {
  const s = sizeOf(size)!;
  const out = R[recipe](s.w, s.h, PALETTES[pal], fill);
  const page: DPage = { id: dId(), bg: out.bg, elements: out.els.filter((e) => e.type !== "text" || (e.text || "").trim()).map((e) => { const o = { ...e, x: Math.round(e.x), y: Math.round(e.y), w: Math.round(e.w), h: Math.round(e.h) }; if (o.rot) o.rot = ((o.rot % 360) + 360) % 360; return o; }) };
  // Through the same check as anything saved, so a template is exactly what saving it would keep.
  return cleanDesign({ v: 1, size: s.id, w: s.w, h: s.h, pages: [page], uploads: [] });
};

// What each template says, by use. [id, name, category, size, recipe, palette, fill]
type Row = [string, string, string, string, string, string, Fill];
const ROWS: Row[] = [
  // Social
  ["party-post", "Birthday party", "Celebrations", "ig-post", "boldCenter", "grape", { headline: "Let's Party!", sub: "Maya turns 7 · Saturday at 2 PM", cta: "RSVP by June 1", emoji: "🎉" }],
  ["bake-sale", "Bake sale", "Events", "ig-post", "event", "cream", { headline: "Bake Sale", sub: "Cookies, brownies and cupcakes. Every dollar helps our class trip!", emoji: "🧁", extra: ["FRIDAY · MAY 9", "8:00 AM", "School gym"] }],
  ["flash-sale", "Flash sale", "Business", "ig-post", "sale", "lemon", { headline: "Flash sale", sub: "This weekend only · use code SAVE50", extra: ["50%\nOFF"] }],
  ["new-arrival", "New arrival", "Business", "ig-post", "circle", "coral", { headline: "Fresh Drop", sub: "Our spring collection is here", extra: ["NEW"] }],
  ["quote-post", "Quote of the day", "Quotes", "ig-post", "quote", "cream", { headline: "Small steps every day add up to big results.", sub: "Unknown" }],
  ["tips-post", "5 tips", "Education", "ig-post", "list", "sky", { headline: "5 tips for better sleep", extra: ["No screens an hour before bed", "Same bedtime every night", "Keep the room cool", "Skip caffeine after 2pm", "Read a few pages"] }],
  ["photo-post", "Photo with title", "Photography", "ig-post", "photoBand", "night", { headline: "Weekend getaway", sub: "Lake Tahoe · Summer 2026" }],
  ["minimal-post", "Minimal announcement", "Business", "ig-post", "minimal", "cream", { headline: "We're open", sub: "Come say hi at our new shop on Main Street", extra: ["Grand opening"] }],
  ["playful-post", "Playful hello", "Fun", "ig-post", "playful", "candy", { headline: "Hello, Summer!", sub: "Pool days, popsicles and late sunsets", emoji: "🌞" }],
  ["stat-post", "Big number", "Business", "ig-post", "stat", "night", { headline: "of parents say the app saves them time", sub: "From our 2026 family survey", extra: ["87%"] }],
  ["gym-post", "Workout challenge", "Fitness", "ig-post", "boldCenter", "ocean", { headline: "30-Day Challenge", sub: "Ten minutes a day. Starts Monday.", cta: "Join free", emoji: "💪" }],
  ["church-post", "Sunday service", "Faith", "ig-post", "minimal", "sky", { headline: "Sunday Service", sub: "10 AM · All are welcome · Kids church included", extra: ["Join us this week"] }],
  ["giveaway", "Giveaway", "Business", "ig-post", "sale", "grape", { headline: "Giveaway", sub: "Like · share · tag a friend", extra: ["WIN\nIT"] }],
  ["recipe-post", "Recipe card", "Food", "ig-portrait", "list", "cream", { headline: "Easy banana bread", extra: ["3 ripe bananas, mashed", "1/3 cup melted butter", "3/4 cup sugar + 1 egg", "1 tsp baking soda, 1½ cups flour", "Bake 60 min at 350°F"] }],
  ["portrait-photo", "Portrait photo", "Photography", "ig-portrait", "photoBand", "night", { headline: "Golden hour", sub: "Shot on my phone" }],
  ["portrait-quote", "Portrait quote", "Quotes", "ig-portrait", "quote", "blush", { headline: "Be the kind of person you needed when you were younger.", sub: "Ayesha Siddiqi" }],
  ["portrait-launch", "Product launch", "Business", "ig-portrait", "split", "mint", { headline: "Meet the new collection", sub: "Made by hand in small batches. Available Friday.", cta: "Pre-order now" }],
  // Stories
  ["story-party", "Party story", "Celebrations", "story", "boldCenter", "sunset", { headline: "Tonight!", sub: "Rooftop party · 8 PM · bring a friend", cta: "Swipe up", emoji: "🥳" }],
  ["story-poll", "This or that", "Fun", "story", "playful", "candy", { headline: "This or that?", sub: "Tap to vote in the poll below", emoji: "🤔" }],
  ["story-sale", "Story sale", "Business", "story", "sale", "night", { headline: "Last chance", sub: "Ends at midnight", extra: ["30%\nOFF"] }],
  ["story-photo", "Story photo", "Photography", "story", "photoBand", "night", { headline: "A day in my life", sub: "Swipe for more" }],
  ["story-tips", "Story checklist", "Education", "story", "list", "mint", { headline: "Morning routine", extra: ["Make the bed", "Drink a glass of water", "10 minutes of stretching", "Write 3 to-dos", "Breakfast, no phone"] }],
  ["story-event", "Story event", "Events", "story", "event", "royal", { headline: "Open Mic Night", sub: "Poetry, music and comedy. Sign up at the door.", emoji: "🎤", extra: ["THURSDAY · OCT 2", "7:00 PM", "The Coffee House"] }],
  ["story-quote", "Story quote", "Quotes", "story", "quote", "night", { headline: "Do something today that your future self will thank you for.", sub: "Sean Patrick Flanery" }],
  ["story-hello", "New post alert", "Fun", "story", "circle", "lemon", { headline: "New post!", sub: "Go check it out on my feed", extra: ["NEW"] }],
  // Facebook, Pinterest, banners
  ["fb-event", "Facebook event", "Events", "fb-post", "split", "sky", { headline: "Community clean-up day", sub: "Gloves, bags and snacks provided. Bring the whole family.", cta: "Sign up" }],
  ["fb-sale", "Facebook sale", "Business", "fb-post", "banner", "lemon", { headline: "Summer sale", sub: "Up to 40% off everything", emoji: "🛍️" }],
  ["pin-recipe", "Pinterest recipe", "Food", "pin", "photoBand", "night", { headline: "15-minute pasta", sub: "Weeknight dinner idea" }],
  ["pin-tips", "Pinterest guide", "Education", "pin", "list", "blush", { headline: "Budget makeover", extra: ["Track every dollar for a week", "Cancel one subscription", "Cook at home 5 nights", "Automate savings on payday", "Plan one free fun day"] }],
  ["x-header", "X header", "Business", "x-header", "banner", "ink", { headline: "Building in public", sub: "Founder · Writer · Coffee lover", emoji: "☕" }],
  ["li-banner", "LinkedIn banner", "Business", "li-banner", "banner", "sky", { headline: "Helping teams ship faster", sub: "Product leader · Speaker", emoji: "🚀" }],
  ["email-header", "Email header", "Business", "email-header", "banner", "mint", { headline: "Monthly newsletter", sub: "What's new this month", emoji: "💌" }],
  // Video
  ["yt-thumb", "YouTube thumbnail", "Video", "yt-thumb", "thumbnail", "lemon", { headline: "I tried it for 30 days", sub: "WATCH NOW", emoji: "😱" }],
  ["yt-thumb-2", "Tutorial thumbnail", "Video", "yt-thumb", "thumbnail", "ocean", { headline: "Easy guide", sub: "STEP BY STEP", emoji: "👉" }],
  ["yt-thumb-3", "Recipe thumbnail", "Video", "yt-thumb", "thumbnail", "sunset", { headline: "Best cookies ever", sub: "ONLY 5 INGREDIENTS", emoji: "🍪" }],
  ["yt-banner", "Channel banner", "Video", "yt-banner", "banner", "grape", { headline: "New videos every Friday", sub: "Crafts · DIY · Home", emoji: "🎬" }],
  // Presentation-size
  ["pres-title", "Presentation title", "Work", "presentation", "split", "sky", { headline: "Quarterly review", sub: "Results, lessons and what's next", cta: "Q3 2026" }],
  ["pres-stat", "Presentation big number", "Work", "presentation", "stat", "night", { headline: "growth in active users this quarter", sub: "Compared with Q2", extra: ["+42%"] }],
  ["pres-quote", "Presentation quote", "Work", "presentation", "quote", "cream", { headline: "Culture eats strategy for breakfast.", sub: "Peter Drucker" }],
  // Print: flyers and posters
  ["flyer-event", "Event flyer", "Events", "flyer", "event", "sky", { headline: "Spring Carnival", sub: "Games, food trucks, face painting and a raffle for the whole family.", emoji: "🎡", extra: ["SATURDAY · APRIL 25", "11 AM – 4 PM", "Lincoln Elementary"] }],
  ["flyer-sale", "Yard sale flyer", "Events", "flyer", "sale", "lemon", { headline: "Yard sale", sub: "Saturday 8am – 1pm · 42 Oak Street", extra: ["EVERYTHING\n$5"] }],
  ["flyer-lost", "Lost pet", "Community", "flyer", "split", "coral", { headline: "Lost dog: Biscuit", sub: "Golden retriever, red collar, very friendly. Last seen near Pine Park. Call (555) 123-4567.", cta: "Reward" }],
  ["flyer-class", "Class flyer", "Education", "flyer", "boldCenter", "mint", { headline: "Free Coding Class", sub: "For kids 8–12 · Tuesdays after school · Laptops provided", cta: "Sign up today", emoji: "💻" }],
  ["flyer-church", "Church flyer", "Faith", "flyer", "minimal", "cream", { headline: "Vacation Bible School", sub: "July 14–18 · 9 AM to noon · Ages 4–12 · Snacks, songs and crafts", extra: ["Summer 2026"] }],
  ["flyer-tutor", "Tutoring flyer", "Business", "flyer", "list", "sky", { headline: "Math tutoring", extra: ["Grades 3–8", "Homework help & test prep", "In person or online", "First session free", "Call (555) 987-6543"] }],
  ["flyer-music", "Concert flyer", "Events", "flyer", "event", "royal", { headline: "Live Music Night", sub: "Local bands, food and good vibes. All ages.", emoji: "🎸", extra: ["FRIDAY · AUG 8", "7 PM", "Riverside Park"] }],
  ["flyer-fitness", "Fitness flyer", "Fitness", "flyer", "photoBand", "night", { headline: "Bootcamp in the park", sub: "Mon · Wed · Fri · 6 AM" }],
  ["a4-notice", "Notice", "Community", "a4", "minimal", "ink", { headline: "Water shut-off notice", sub: "Tuesday, 9 AM – 1 PM, for pipe repairs. Thank you for your patience.", extra: ["Building notice"] }],
  ["poster-movie", "Movie night poster", "Events", "poster", "event", "night", { headline: "Movie Night", sub: "Bring a blanket. Popcorn's on us.", emoji: "🍿", extra: ["FRIDAY · SEPT 12", "Sundown", "Back field"] }],
  ["poster-motivation", "Motivation poster", "Quotes", "poster", "quote", "ocean", { headline: "Mistakes are proof that you are trying.", sub: "Jennifer Lim" }],
  ["poster-recruit", "We're hiring", "Business", "poster", "circle", "sunset", { headline: "We're hiring!", sub: "Barista · Cashier · Baker · Apply inside", extra: ["JOIN US"] }],
  ["poster-sport", "Game day poster", "Sports", "poster", "photoBand", "night", { headline: "Game day", sub: "Eagles vs. Hawks · Friday 7 PM" }],
  ["class-rules", "Classroom rules", "School", "classroom-poster", "list", "lemon", { headline: "Our class rules", extra: ["Be kind", "Listen when others speak", "Raise your hand", "Try your best", "Clean up after yourself"] }],
  ["class-growth", "Growth mindset", "School", "classroom-poster", "playful", "candy", { headline: "I can't do it… YET!", sub: "Mistakes help my brain grow", emoji: "🧠" }],
  ["class-welcome", "Welcome to class", "School", "classroom-poster", "boldCenter", "ocean", { headline: "Welcome to 3rd grade!", sub: "Room 12 · Ms. Rivera", cta: "We're glad you're here", emoji: "🍎" }],
  // Worksheets
  ["ws-math", "Math worksheet", "School", "worksheet", "worksheet", "sky", { headline: "Addition practice", emoji: "➕", extra: ["4 + 3 = ____", "7 + 2 = ____", "5 + 5 = ____", "8 + 6 = ____", "9 + 4 = ____", "6 + 7 = ____"] }],
  ["ws-reading", "Reading worksheet", "School", "worksheet", "worksheet", "mint", { headline: "Reading check", emoji: "📚", extra: ["Who is the main character?", "Where does the story happen?", "What problem does the character have?", "How is the problem solved?", "What was your favorite part? Why?"] }],
  ["ws-science", "Science worksheet", "School", "worksheet", "worksheet", "lemon", { headline: "Plant life cycle", emoji: "🌱", extra: ["What does a seed need to grow?", "Name the parts of a plant.", "What do leaves do?", "Draw a sprout in the box.", "Why do plants need sunlight?"] }],
  // Invitations and cards
  ["invite-wedding", "Wedding invitation", "Celebrations", "invite", "arch", "cream", { headline: "Emma & James", sub: "Saturday, the fourteenth of June · four o'clock · Rose Garden Estate", emoji: "🌿", extra: ["Together with their families"] }],
  ["invite-shower", "Baby shower", "Celebrations", "invite", "arch", "blush", { headline: "Oh baby!", sub: "A shower for Sofia · Sunday, May 3 · 1 PM", emoji: "🍼", extra: ["Please join us"] }],
  ["invite-bday", "Birthday invitation", "Celebrations", "invite", "playful", "candy", { headline: "Leo's turning 5!", sub: "Bounce house, cake and games · Saturday 2–4 PM", emoji: "🎈" }],
  ["invite-grad", "Graduation party", "Celebrations", "invite", "event", "royal", { headline: "Class of 2026", sub: "Celebrate Jordan's graduation with us!", emoji: "🎓", extra: ["SATURDAY · JUNE 7", "3 PM", "Our backyard"] }],
  ["invite-dinner", "Dinner party", "Celebrations", "invite", "minimal", "night", { headline: "Dinner at Ours", sub: "Friday at 7 · Bring a bottle and an appetite", extra: ["You're invited"] }],
  ["postcard-thanks", "Thank-you card", "Celebrations", "postcard", "boldCenter", "blush", { headline: "Thank you!", sub: "For coming and celebrating with us", cta: "With love, The Garcias", emoji: "💐" }],
  ["postcard-travel", "Travel postcard", "Photography", "postcard", "photoBand", "night", { headline: "Greetings from the coast", sub: "Wish you were here" }],
  ["card-modern", "Business card", "Business", "card", "card", "ink", { headline: "Alex Morgan", name: "Alex Morgan", sub: "Graphic designer", emoji: "🎨" }],
  ["card-teacher", "Teacher card", "Business", "card", "card", "mint", { headline: "Ms. Rivera", name: "Ms. Rivera", sub: "3rd grade · Room 12", emoji: "🍎", extra: ["rivera@school.org", "Office hours Tue 3–4", "Lincoln Elementary"] }],
  ["card-bakery", "Bakery card", "Business", "card", "card", "cream", { headline: "Sweet Crumbs", name: "Sweet Crumbs", sub: "Custom cakes & cookies", emoji: "🧁", extra: ["(555) 222-0199", "orders@sweetcrumbs.com", "@sweetcrumbs"] }],
  // Certificates and menus
  ["cert-achieve", "Achievement certificate", "School", "certificate", "certificate", "cream", { headline: "For outstanding effort and a great attitude in reading this year.", name: "Student Name", extra: ["of achievement"] }],
  ["cert-star", "Star student", "School", "certificate", "certificate", "sky", { headline: "For being a kind friend and a hard worker every single day.", name: "Star Student", extra: ["star student award"] }],
  ["cert-employee", "Employee award", "Work", "certificate", "certificate", "royal", { headline: "In recognition of exceptional dedication and leadership.", name: "Employee Name", extra: ["employee of the month"] }],
  ["menu-cafe", "Café menu", "Food", "menu", "menu", "cream", { headline: "Morning Café", sub: "Served daily 7am – 2pm", emoji: "☕" }],
  ["menu-dinner", "Dinner menu", "Food", "menu", "menu", "night", { headline: "Family Dinner", sub: "Sunday supper", emoji: "🍝", extra: ["Garden salad|", "Lasagna|", "Garlic bread|", "Tiramisu|", "Lemonade|"] }],
  ["menu-party", "Party menu", "Food", "menu", "menu", "blush", { headline: "Party Bites", sub: "Help yourself", emoji: "🎂", extra: ["Mini sliders|", "Veggie cups|", "Fruit skewers|", "Birthday cake|", "Pink lemonade|"] }],
  // Brand and fun
  ["logo-circle", "Circle logo", "Brand", "logo", "circle", "mint", { headline: "Green Leaf", sub: "Plant shop", extra: ["EST. 2026"] }],
  ["logo-minimal", "Minimal logo", "Brand", "logo", "minimal", "ink", { headline: "Studio M", sub: "Design & print", extra: ["Since 2026"] }],
  ["wall-phone", "Phone wallpaper", "Fun", "phone-wallpaper", "playful", "candy", { headline: "Good things take time", sub: "Breathe in · breathe out", emoji: "🌙" }],
  ["wall-desktop", "Desktop wallpaper", "Fun", "desktop-wallpaper", "banner", "royal", { headline: "Focus mode", sub: "One thing at a time", emoji: "✨" }],
  ["sports-roster", "Team roster", "Sports", "ig-portrait", "list", "night", { headline: "Starting lineup", extra: ["#4 · Jordan · Guard", "#11 · Sam · Forward", "#23 · Alex · Center", "#7 · Riley · Guard", "#15 · Casey · Forward"] }],
  ["sports-win", "Big win", "Sports", "ig-post", "stat", "forest", { headline: "Eagles win the championship!", sub: "Season record 18–2", extra: ["58–51"] }],
  ["realestate", "Just listed", "Business", "ig-post", "photoBand", "night", { headline: "Just listed", sub: "3 bed · 2 bath · $425,000" }],
  ["nonprofit", "Fundraiser", "Community", "ig-post", "stat", "forest", { headline: "raised for the food bank so far. Thank you!", sub: "Help us reach $10,000 by December", extra: ["$7,420"] }],
  ["holiday-post", "Holiday greeting", "Celebrations", "ig-post", "minimal", "forest", { headline: "Happy Holidays", sub: "Wishing you warmth and joy this season", extra: ["From our family to yours"] }],
  ["halloween", "Halloween party", "Celebrations", "flyer", "event", "night", { headline: "Spooky Bash", sub: "Costumes, candy and a haunted hallway. Ages 5 and up.", emoji: "🎃", extra: ["FRIDAY · OCT 31", "6 PM", "Community Center"] }],
];

export const TEMPLATES: DesignTemplate[] = ROWS.map(([id, name, category, size, recipe, pal, fill]) => ({ id, name, category, size, make: () => build(size, recipe, pal, fill) }));
export const TEMPLATE_CATEGORIES = Array.from(new Set(TEMPLATES.map((t) => t.category)));

/** Magic design: four different looks for what was asked, at the design's size. */
export function magicDesigns(copy: DesignCopy, size: string): Design[] {
  const [bg, accent, ink] = copy.palette;
  const own: Pal = { bg, ink, accent, soft: bg, on: "#ffffff" };
  const looks: [string, Pal][] = [["boldCenter", { ...PALETTES.grape }], ["event", own], ["split", { ...PALETTES.sky, accent }], ["playful", { ...PALETTES.candy }]];
  return looks.map(([recipe, p]) => {
    PALETTES.__magic = p;
    const d = build(size, recipe, "__magic", { headline: copy.headline, sub: recipe === "event" ? copy.body : copy.sub, body: copy.body, cta: copy.cta, emoji: copy.emoji, extra: [copy.sub.toUpperCase().slice(0, 30), "", ""] });
    delete PALETTES.__magic;
    return d;
  });
}
