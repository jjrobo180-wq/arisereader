// Pictures for printable worksheets, drawn as SVG so they print sharp at any size:
// coordinate planes (with points, lines and graphs), number lines (whole numbers, fractions and
// decimals), bar/line/pie graphs, fraction bars and circles, arrays, ten frames, base-ten blocks,
// clocks, shapes with labelled sides, angles, tables and grid paper.
//
// The AI describes a picture as data (for example a number line from 0 to 2 in quarters) and this
// file draws it, so every graph is exact. A "blank" picture is left for students to fill in; the
// answer key draws the same picture with the answers on it.

export type WsPoint = { x: number; y: number; label?: string };
export type WsVisual =
  | { type: "coordinate-plane"; xMin: number; xMax: number; yMin: number; yMax: number; points?: WsPoint[]; lines?: string[]; segments?: { x1: number; y1: number; x2: number; y2: number }[]; grid?: boolean }
  | { type: "number-line"; min: number; max: number; step: number; denominator?: number; labelEvery?: number; points?: { x: number; label?: string }[]; blankLabels?: boolean }
  | { type: "bar-graph" | "line-graph"; title?: string; labels: string[]; values: number[]; yLabel?: string; xLabel?: string; blank?: boolean; yMax?: number; yStep?: number }
  | { type: "pie-chart"; title?: string; labels: string[]; values: number[] }
  | { type: "picture-graph"; title?: string; labels: string[]; values: number[]; key: number; symbol?: string }
  | { type: "fraction-bar" | "fraction-circle"; parts: number; shaded: number; count?: number }
  | { type: "array"; rows: number; cols: number }
  | { type: "ten-frame"; filled: number; frames?: number }
  | { type: "base-ten"; hundreds: number; tens: number; ones: number }
  | { type: "clock"; hour: number; minute: number; hands?: boolean }
  | { type: "shape"; shape: "rectangle" | "square" | "triangle" | "right-triangle" | "circle" | "trapezoid" | "parallelogram" | "rectangular-prism"; labels?: string[] }
  | { type: "angle"; degrees: number; label?: string; protractor?: boolean }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "grid-paper"; rows: number; cols: number }
  | { type: "tally"; labels: string[]; values: number[] }
  | { type: "money"; coins: { kind: "penny" | "nickel" | "dime" | "quarter" | "dollar"; count: number }[] };

const n = (v: unknown, lo: number, hi: number, d: number) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
const s = (v: unknown, max = 80) => (typeof v === "string" || typeof v === "number" ? String(v).slice(0, max) : "");
const nums = (v: unknown, max = 20) => (Array.isArray(v) ? v.slice(0, max).map((x) => n(x, -1e6, 1e6, 0)) : []);
const strs = (v: unknown, max = 20, len = 40) => (Array.isArray(v) ? v.slice(0, max).map((x) => s(x, len)) : []);
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A picture as the AI sent it, made safe and sensible, or null when it isn't one this file draws. */
export function cleanVisual(raw: any): WsVisual | null {
  if (!raw || typeof raw !== "object") return null;
  const t = String(raw.type || "");
  switch (t) {
    case "coordinate-plane": {
      const xMin = n(raw.xMin, -50, 0, -10), xMax = n(raw.xMax, 1, 50, 10), yMin = n(raw.yMin, -50, 0, -10), yMax = n(raw.yMax, 1, 50, 10);
      const points = (Array.isArray(raw.points) ? raw.points : []).slice(0, 26).map((p: any) => ({ x: n(p?.x, -50, 50, 0), y: n(p?.y, -50, 50, 0), ...(s(p?.label, 6) ? { label: s(p.label, 6) } : {}) }));
      const lines = strs(raw.lines, 3, 60).filter((e) => compileExpr(e) !== null);
      const segments = (Array.isArray(raw.segments) ? raw.segments : []).slice(0, 12).map((g: any) => ({ x1: n(g?.x1, -50, 50, 0), y1: n(g?.y1, -50, 50, 0), x2: n(g?.x2, -50, 50, 0), y2: n(g?.y2, -50, 50, 0) }));
      return { type: t, xMin, xMax, yMin, yMax, points, lines, segments, grid: raw.grid !== false };
    }
    case "number-line": {
      const min = n(raw.min, -1000, 1000, 0); let max = n(raw.max, -1000, 1000, 10); if (max <= min) max = min + 10;
      let step = n(raw.step, 0.001, 1000, 1); if ((max - min) / step > 40) step = (max - min) / 20;
      const den = raw.denominator ? Math.round(n(raw.denominator, 2, 24, 4)) : undefined;
      return { type: t, min, max, step: den ? 1 / den : step, ...(den ? { denominator: den } : {}), labelEvery: raw.labelEvery ? n(raw.labelEvery, 1, 20, 1) : undefined, points: (Array.isArray(raw.points) ? raw.points : []).slice(0, 10).map((p: any) => ({ x: n(p?.x, min, max, min), ...(s(p?.label, 8) ? { label: s(p.label, 8) } : {}) })), blankLabels: !!raw.blankLabels };
    }
    case "bar-graph": case "line-graph": case "pie-chart": case "picture-graph": case "tally": {
      const labels = strs(raw.labels, 12, 18), values = nums(raw.values, 12).map((v) => Math.max(0, v));
      if (!labels.length) return null;
      while (values.length < labels.length) values.push(0);
      if (t === "pie-chart") return { type: t, title: s(raw.title), labels, values };
      if (t === "tally") return { type: t, labels, values: values.map((v) => Math.min(60, Math.round(v))) };
      if (t === "picture-graph") return { type: t, title: s(raw.title), labels, values, key: n(raw.key, 1, 100, 1), symbol: s(raw.symbol, 2) || "★" };
      return { type: t, title: s(raw.title), labels, values, yLabel: s(raw.yLabel, 30), xLabel: s(raw.xLabel, 30), blank: !!raw.blank, ...(raw.yMax ? { yMax: n(raw.yMax, 1, 1e6, 10) } : {}), ...(raw.yStep ? { yStep: n(raw.yStep, 0.1, 1e5, 1) } : {}) };
    }
    case "fraction-bar": case "fraction-circle": { const parts = Math.round(n(raw.parts, 1, 24, 4)); return { type: t, parts, shaded: Math.round(n(raw.shaded, 0, parts * 4, 1)), count: Math.round(n(raw.count, 1, 4, 1)) }; }
    case "array": return { type: t, rows: Math.round(n(raw.rows, 1, 12, 3)), cols: Math.round(n(raw.cols, 1, 12, 4)) };
    case "ten-frame": return { type: t, filled: Math.round(n(raw.filled, 0, 40, 5)), frames: Math.round(n(raw.frames, 1, 4, 1)) };
    case "base-ten": return { type: t, hundreds: Math.round(n(raw.hundreds, 0, 9, 1)), tens: Math.round(n(raw.tens, 0, 9, 2)), ones: Math.round(n(raw.ones, 0, 9, 3)) };
    case "clock": return { type: t, hour: Math.round(n(raw.hour, 1, 12, 3)), minute: Math.round(n(raw.minute, 0, 59, 0)), hands: raw.hands !== false };
    case "shape": { const shapes = ["rectangle", "square", "triangle", "right-triangle", "circle", "trapezoid", "parallelogram", "rectangular-prism"]; return shapes.includes(raw.shape) ? { type: t, shape: raw.shape, labels: strs(raw.labels, 4, 16) } : null; }
    case "angle": return { type: t, degrees: n(raw.degrees, 1, 359, 45), label: s(raw.label, 10), protractor: !!raw.protractor };
    case "table": { const headers = strs(raw.headers, 8, 30); const rows = (Array.isArray(raw.rows) ? raw.rows : []).slice(0, 15).map((r: any) => strs(r, 8, 40)); return headers.length || rows.length ? { type: t, headers, rows } : null; }
    case "grid-paper": return { type: t, rows: Math.round(n(raw.rows, 2, 30, 10)), cols: Math.round(n(raw.cols, 2, 30, 10)) };
    case "money": { const kinds = ["penny", "nickel", "dime", "quarter", "dollar"]; const coins = (Array.isArray(raw.coins) ? raw.coins : []).filter((c: any) => kinds.includes(c?.kind)).slice(0, 5).map((c: any) => ({ kind: c.kind, count: Math.round(n(c.count, 1, 9, 1)) })); return coins.length ? { type: t, coins } : null; }
  }
  return null;
}

/** "2x + 1", "x^2 - 3", "-0.5x+4", "sqrt(x)" as a function of x, or null for anything else. */
export function compileExpr(src: string): ((x: number) => number) | null {
  let e = String(src || "").toLowerCase().replace(/^y\s*=\s*/, "").replace(/\s+/g, "");
  if (!e || e.length > 60 || !/^[0-9x+\-*/^().a-z]*$/.test(e)) return null;
  const words = e.match(/[a-z]+/g) || [];
  if (words.some((w) => !["x", "sqrt", "abs", "sin", "cos", "tan", "pi"].includes(w))) return null;
  e = e.replace(/(\d|\))(?=[x(a-wyz])/g, "$1*").replace(/x(?=[\d(a-z])/g, "x*").replace(/\^/g, "**")
    .replace(/sqrt/g, "Math.sqrt").replace(/abs/g, "Math.abs").replace(/sin/g, "Math.sin").replace(/cos/g, "Math.cos").replace(/tan/g, "Math.tan").replace(/pi/g, "Math.PI");
  try {
    // Only digits, x, operators, brackets and the Math names above can reach here.
    const f = new Function("x", `"use strict"; return (${e});`) as (x: number) => number;
    const probe = f(1.234);
    return typeof probe === "number" ? f : null;
  } catch { return null; }
}

// ─── Drawing ────────────────────────────────────────────────────────────────

const INK = "#111827", SOFT = "#cbd5e1", FILL = "#c7d2fe", ACCENT = "#dc2626";
const fmt = (x: number) => (Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : String(Number(x.toFixed(2))));
const svg = (w: number, h: number, body: string, label: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}" style="max-width:100%;height:auto;font-family:Arial,Helvetica,sans-serif">${body}</svg>`;
const txt = (x: number, y: number, t: string, size = 12, anchor = "middle", extra = "") => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" fill="${INK}" ${extra}>${esc(t)}</text>`;

/** Fraction label for a number line: 3/4, 1 1/2. */
function fracLabel(x: number, den: number): string {
  const whole = Math.floor(x + 1e-9), num = Math.round((x - whole) * den);
  if (num === 0) return String(whole);
  let a = num, b = den; for (let g = gcd(a, b); g > 1; g = gcd(a, b)) { a /= g; b /= g; }
  return whole ? `${whole} ${a}/${b}` : `${a}/${b}`;
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

/** A stacked fraction drawn in SVG (numerator over a bar over denominator). */
function svgFrac(x: number, y: number, label: string, size = 11): string {
  const m = /^(?:(\d+) )?(\d+)\/(\d+)$/.exec(label);
  if (!m) return txt(x, y + 4, label, size);
  const w = Math.max(m[2].length, m[3].length) * size * 0.6 + 4;
  const whole = m[1] ? txt(x - w / 2 - 2, y + 4, m[1], size + 1, "end") : "";
  return `${whole}${txt(x, y - 2, m[2], size)}<line x1="${x - w / 2}" y1="${y + 1}" x2="${x + w / 2}" y2="${y + 1}" stroke="${INK}" stroke-width="1"/>${txt(x, y + size + 3, m[3], size)}`;
}

export function renderVisual(v: WsVisual, opts: { answers?: boolean } = {}): string {
  const showAnswers = !!opts.answers;
  switch (v.type) {
    case "coordinate-plane": {
      const W = 300, H = 300, pad = 18;
      const sx = (x: number) => pad + ((x - v.xMin) / (v.xMax - v.xMin)) * (W - 2 * pad);
      const sy = (y: number) => H - pad - ((y - v.yMin) / (v.yMax - v.yMin)) * (H - 2 * pad);
      const span = Math.max(v.xMax - v.xMin, v.yMax - v.yMin);
      const step = span > 30 ? 5 : span > 16 ? 2 : 1;
      let b = "";
      if (v.grid !== false) {
        for (let x = Math.ceil(v.xMin); x <= v.xMax; x++) b += `<line x1="${sx(x)}" y1="${sy(v.yMin)}" x2="${sx(x)}" y2="${sy(v.yMax)}" stroke="${SOFT}" stroke-width="${x % step === 0 ? 0.8 : 0.4}"/>`;
        for (let y = Math.ceil(v.yMin); y <= v.yMax; y++) b += `<line x1="${sx(v.xMin)}" y1="${sy(y)}" x2="${sx(v.xMax)}" y2="${sy(y)}" stroke="${SOFT}" stroke-width="${y % step === 0 ? 0.8 : 0.4}"/>`;
      }
      const x0 = sx(Math.min(Math.max(0, v.xMin), v.xMax)), y0 = sy(Math.min(Math.max(0, v.yMin), v.yMax));
      b += `<line x1="${sx(v.xMin) - 6}" y1="${y0}" x2="${sx(v.xMax) + 6}" y2="${y0}" stroke="${INK}" stroke-width="1.4" marker-end="url(#ar)" marker-start="url(#ar)"/>`;
      b += `<line x1="${x0}" y1="${sy(v.yMin) + 6}" x2="${x0}" y2="${sy(v.yMax) - 6}" stroke="${INK}" stroke-width="1.4" marker-end="url(#ar)" marker-start="url(#ar)"/>`;
      for (let x = Math.ceil(v.xMin / step) * step; x <= v.xMax; x += step) if (x !== 0) b += txt(sx(x), y0 + 12, fmt(x), 8);
      for (let y = Math.ceil(v.yMin / step) * step; y <= v.yMax; y += step) if (y !== 0) b += txt(x0 - 4, sy(y) + 3, fmt(y), 8, "end");
      b += txt(sx(v.xMax) + 2, y0 - 6, "x", 10, "end", 'font-style="italic"') + txt(x0 + 8, sy(v.yMax) + 4, "y", 10, "start", 'font-style="italic"');
      {
        for (const g of v.segments || []) b += `<line x1="${sx(g.x1)}" y1="${sy(g.y1)}" x2="${sx(g.x2)}" y2="${sy(g.y2)}" stroke="${ACCENT}" stroke-width="2"/>`;
        for (const expr of v.lines || []) {
          const f = compileExpr(expr);
          if (!f) continue;
          let d = "", pen = false;
          for (let i = 0; i <= 200; i++) {
            const x = v.xMin + ((v.xMax - v.xMin) * i) / 200, y = f(x);
            if (!Number.isFinite(y) || y < v.yMin - 1 || y > v.yMax + 1) { pen = false; continue; }
            d += `${pen ? "L" : "M"}${sx(x).toFixed(1)},${sy(y).toFixed(1)} `; pen = true;
          }
          b += `<path d="${d}" fill="none" stroke="${ACCENT}" stroke-width="2"/>`;
        }
        for (const p of v.points || []) b += `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="3.5" fill="${ACCENT}"/>${p.label ? txt(sx(p.x) + 6, sy(p.y) - 6, p.label, 10, "start", 'font-weight="bold"') : ""}`;
      }
      return svg(W, H, `<defs><marker id="ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${INK}"/></marker></defs>${b}`, "Coordinate plane");
    }
    case "number-line": {
      const W = 520, H = 70, pad = 24, y = 32;
      const ticks = Math.round((v.max - v.min) / v.step);
      const sx = (x: number) => pad + ((x - v.min) / (v.max - v.min)) * (W - 2 * pad);
      let b = `<line x1="${pad - 12}" y1="${y}" x2="${W - pad + 12}" y2="${y}" stroke="${INK}" stroke-width="1.5" marker-start="url(#nl)" marker-end="url(#nl)"/>`;
      for (let i = 0; i <= ticks; i++) {
        const x = v.min + i * v.step, whole = Math.abs(x - Math.round(x)) < 1e-9;
        b += `<line x1="${sx(x)}" y1="${y - (whole ? 8 : 5)}" x2="${sx(x)}" y2="${y + (whole ? 8 : 5)}" stroke="${INK}" stroke-width="${whole ? 1.5 : 1}"/>`;
        const every = v.labelEvery || 1;
        if (i % every === 0 && (!v.blankLabels || whole || showAnswers)) b += v.denominator ? svgFrac(sx(x), y + 20, fracLabel(x, v.denominator), 10) : txt(sx(x), y + 22, fmt(x), 11);
      }
      for (const p of v.points || []) b += `<circle cx="${sx(p.x)}" cy="${y}" r="5" fill="${ACCENT}"/>${p.label ? txt(sx(p.x), y - 12, p.label, 11, "middle", 'font-weight="bold"') : ""}`;
      return svg(W, H + (v.denominator ? 12 : 0), `<defs><marker id="nl" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${INK}"/></marker></defs>${b}`, "Number line");
    }
    case "bar-graph": case "line-graph": {
      const W = 420, H = 260, L = 46, B = 40, T = v.title ? 26 : 10;
      const top = v.yMax || niceMax(Math.max(1, ...v.values));
      const ystep = v.yStep || niceStep(top);
      const ih = H - T - B, iw = W - L - 12;
      const sy = (val: number) => T + ih - (val / top) * ih;
      let b = v.title ? txt(W / 2, 17, v.title, 13, "middle", 'font-weight="bold"') : "";
      for (let g = 0; g <= top + 1e-9; g += ystep) b += `<line x1="${L}" y1="${sy(g)}" x2="${W - 12}" y2="${sy(g)}" stroke="${SOFT}"/>${txt(L - 6, sy(g) + 4, fmt(g), 10, "end")}`;
      b += `<line x1="${L}" y1="${T}" x2="${L}" y2="${T + ih}" stroke="${INK}"/><line x1="${L}" y1="${T + ih}" x2="${W - 12}" y2="${T + ih}" stroke="${INK}"/>`;
      const bw = iw / v.labels.length;
      const fill = !v.blank || showAnswers;
      if (v.type === "bar-graph") v.labels.forEach((lab, i) => { const x = L + i * bw + bw * 0.18, w = bw * 0.64; if (fill) b += `<rect x="${x}" y="${sy(v.values[i])}" width="${w}" height="${T + ih - sy(v.values[i])}" fill="${FILL}" stroke="${INK}"/>`; b += txt(L + i * bw + bw / 2, T + ih + 15, lab, 10); });
      else { let d = ""; v.labels.forEach((lab, i) => { const x = L + i * bw + bw / 2; d += `${i ? "L" : "M"}${x},${sy(v.values[i])} `; b += txt(x, T + ih + 15, lab, 10); if (fill) b += `<circle cx="${x}" cy="${sy(v.values[i])}" r="3.5" fill="${INK}"/>`; }); if (fill) b += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2"/>`; }
      if (v.yLabel) b += `<text x="12" y="${T + ih / 2}" font-size="11" text-anchor="middle" fill="${INK}" transform="rotate(-90 12 ${T + ih / 2})">${esc(v.yLabel)}</text>`;
      if (v.xLabel) b += txt(L + iw / 2, H - 6, v.xLabel, 11);
      return svg(W, H, b, v.title || "Graph");
    }
    case "pie-chart": {
      const W = 360, H = 220, cx = 110, cy = 112, r = 90, total = v.values.reduce((a, x) => a + x, 0) || 1;
      const colors = ["#c7d2fe", "#fde68a", "#bbf7d0", "#fecaca", "#bae6fd", "#e9d5ff", "#fed7aa", "#d9f99d"];
      let a0 = -Math.PI / 2, b = v.title ? txt(W / 2, 14, v.title, 13, "middle", 'font-weight="bold"') : "";
      v.values.forEach((val, i) => {
        const a1 = a0 + (val / total) * Math.PI * 2, large = a1 - a0 > Math.PI ? 1 : 0;
        b += val >= total ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${colors[i % 8]}" stroke="${INK}"/>` : `<path d="M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${large} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} Z" fill="${colors[i % 8]}" stroke="${INK}"/>`;
        b += `<rect x="228" y="${40 + i * 20}" width="12" height="12" fill="${colors[i % 8]}" stroke="${INK}"/>${txt(246, 50 + i * 20, `${v.labels[i]} (${fmt(val)})`, 11, "start")}`;
        a0 = a1;
      });
      return svg(W, H, b, v.title || "Pie chart");
    }
    case "picture-graph": {
      const W = 420, rowH = 30, H = 40 + v.labels.length * rowH + 24;
      let b = v.title ? txt(W / 2, 18, v.title, 13, "middle", 'font-weight="bold"') : "";
      v.labels.forEach((lab, i) => {
        const y = 34 + i * rowH;
        b += `<rect x="4" y="${y}" width="${W - 8}" height="${rowH}" fill="none" stroke="${SOFT}"/>${txt(12, y + 20, lab, 12, "start")}`;
        const count = v.values[i] / v.key;
        for (let k = 0; k < Math.floor(count + 1e-9); k++) b += txt(130 + k * 22, y + 22, v.symbol || "★", 18);
        if (count % 1 > 0.01) b += `<clipPath id="pg${i}"><rect x="${130 + Math.floor(count) * 22 - 11}" y="${y}" width="${22 * (count % 1)}" height="${rowH}"/></clipPath>${txt(130 + Math.floor(count) * 22, y + 22, v.symbol || "★", 18, "middle", `clip-path="url(#pg${i})"`)}`;
      });
      b += txt(12, H - 6, `Key: ${v.symbol || "★"} = ${fmt(v.key)}`, 12, "start", 'font-weight="bold"');
      return svg(W, H, b, v.title || "Picture graph");
    }
    case "tally": {
      const W = 380, rowH = 30, H = v.labels.length * rowH + 8;
      let b = "";
      v.labels.forEach((lab, i) => {
        const y = 4 + i * rowH;
        b += `<rect x="2" y="${y}" width="${W - 4}" height="${rowH}" fill="none" stroke="${SOFT}"/>${txt(10, y + 20, lab, 12, "start")}`;
        for (let k = 0; k < v.values[i]; k++) {
          const grp = Math.floor(k / 5), pos = k % 5, x = 140 + grp * 34 + pos * 6;
          b += pos === 4 ? `<line x1="${140 + grp * 34 - 3}" y1="${y + 20}" x2="${140 + grp * 34 + 22}" y2="${y + 8}" stroke="${INK}" stroke-width="1.6"/>` : `<line x1="${x}" y1="${y + 6}" x2="${x}" y2="${y + 24}" stroke="${INK}" stroke-width="1.6"/>`;
        }
      });
      return svg(W, H, b, "Tally chart");
    }
    case "fraction-bar": {
      const W = 300, rowH = 34, cnt = v.count || 1, H = cnt * (rowH + 8);
      let b = "", left = v.shaded;
      for (let k = 0; k < cnt; k++) for (let i = 0; i < v.parts; i++) {
        const w = (W - 4) / v.parts, on = left > 0; if (on) left--;
        b += `<rect x="${2 + i * w}" y="${2 + k * (rowH + 8)}" width="${w}" height="${rowH}" fill="${on ? FILL : "#fff"}" stroke="${INK}" stroke-width="1.5"/>`;
      }
      return svg(W, H, b, `Fraction bar, ${v.shaded} of ${v.parts} parts shaded`);
    }
    case "fraction-circle": {
      const cnt = v.count || 1, r = 50, W = cnt * (2 * r + 16), H = 2 * r + 8;
      let b = "", left = v.shaded;
      for (let k = 0; k < cnt; k++) {
        const cx = r + 6 + k * (2 * r + 16), cy = r + 4;
        if (v.parts === 1) { b += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${left > 0 ? FILL : "#fff"}" stroke="${INK}" stroke-width="1.5"/>`; left--; continue; }
        for (let i = 0; i < v.parts; i++) {
          const a0 = -Math.PI / 2 + (i / v.parts) * 2 * Math.PI, a1 = -Math.PI / 2 + ((i + 1) / v.parts) * 2 * Math.PI, on = left > 0; if (on) left--;
          b += `<path d="M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 0 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} Z" fill="${on ? FILL : "#fff"}" stroke="${INK}" stroke-width="1.5"/>`;
        }
      }
      return svg(W, H, b, `Fraction circle, ${v.shaded} of ${v.parts} parts shaded`);
    }
    case "array": {
      const g = 22, W = v.cols * g + 8, H = v.rows * g + 8;
      let b = "";
      for (let r = 0; r < v.rows; r++) for (let c = 0; c < v.cols; c++) b += `<circle cx="${4 + c * g + g / 2}" cy="${4 + r * g + g / 2}" r="7" fill="${FILL}" stroke="${INK}"/>`;
      return svg(W, H, b, `Array of ${v.rows} rows and ${v.cols} columns`);
    }
    case "ten-frame": {
      const frames = v.frames || 1, c = 26, W = 5 * c + 4, H = frames * (2 * c + 10);
      let b = "", left = v.filled;
      for (let f = 0; f < frames; f++) for (let i = 0; i < 10; i++) {
        const x = 2 + (i % 5) * c, y = 2 + f * (2 * c + 10) + Math.floor(i / 5) * c, on = left > 0; if (on) left--;
        b += `<rect x="${x}" y="${y}" width="${c}" height="${c}" fill="#fff" stroke="${INK}" stroke-width="1.5"/>${on ? `<circle cx="${x + c / 2}" cy="${y + c / 2}" r="${c / 2 - 4}" fill="${ACCENT}"/>` : ""}`;
      }
      return svg(W, H, b, `Ten frame with ${v.filled} counters`);
    }
    case "base-ten": {
      const u = 8; let x = 4, b = "";
      for (let h = 0; h < v.hundreds; h++) { for (let i = 0; i <= 10; i++) b += `<line x1="${x + i * u}" y1="4" x2="${x + i * u}" y2="${4 + 10 * u}" stroke="${INK}" stroke-width="0.6"/><line x1="${x}" y1="${4 + i * u}" x2="${x + 10 * u}" y2="${4 + i * u}" stroke="${INK}" stroke-width="0.6"/>`; b = `<rect x="${x}" y="4" width="${10 * u}" height="${10 * u}" fill="${FILL}"/>` + b; x += 10 * u + 10; }
      for (let t = 0; t < v.tens; t++) { b += `<rect x="${x}" y="4" width="${u}" height="${10 * u}" fill="${FILL}" stroke="${INK}"/>`; for (let i = 1; i < 10; i++) b += `<line x1="${x}" y1="${4 + i * u}" x2="${x + u}" y2="${4 + i * u}" stroke="${INK}" stroke-width="0.6"/>`; x += u + 5; }
      x += 6;
      for (let o = 0; o < v.ones; o++) b += `<rect x="${x + (o % 3) * (u + 3)}" y="${4 + 10 * u - u - Math.floor(o / 3) * (u + 3)}" width="${u}" height="${u}" fill="${FILL}" stroke="${INK}"/>`;
      return svg(Math.max(60, x + 3 * (u + 3) + 6), 10 * u + 10, b, `Base ten blocks: ${v.hundreds} hundreds, ${v.tens} tens, ${v.ones} ones`);
    }
    case "clock": {
      const r = 70, cx = 78, cy = 78;
      let b = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="2.5"/>`;
      for (let i = 0; i < 60; i++) { const a = (i / 60) * 2 * Math.PI, big = i % 5 === 0; b += `<line x1="${cx + (r - (big ? 9 : 4)) * Math.sin(a)}" y1="${cy - (r - (big ? 9 : 4)) * Math.cos(a)}" x2="${cx + r * Math.sin(a)}" y2="${cy - r * Math.cos(a)}" stroke="${INK}" stroke-width="${big ? 2 : 0.8}"/>`; }
      for (let h = 1; h <= 12; h++) { const a = (h / 12) * 2 * Math.PI; b += txt(cx + (r - 20) * Math.sin(a), cy - (r - 20) * Math.cos(a) + 5, String(h), 13, "middle", 'font-weight="bold"'); }
      if (v.hands !== false || showAnswers) {
        const ha = ((v.hour % 12) + v.minute / 60) / 12 * 2 * Math.PI, ma = (v.minute / 60) * 2 * Math.PI;
        b += `<line x1="${cx}" y1="${cy}" x2="${cx + 36 * Math.sin(ha)}" y2="${cy - 36 * Math.cos(ha)}" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/><line x1="${cx}" y1="${cy}" x2="${cx + 56 * Math.sin(ma)}" y2="${cy - 56 * Math.cos(ma)}" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;
      }
      b += `<circle cx="${cx}" cy="${cy}" r="4" fill="${INK}"/>`;
      return svg(156, 156, b, "Clock");
    }
    case "shape": {
      const L = v.labels || [];
      const st = `fill="${FILL}" fill-opacity="0.35" stroke="${INK}" stroke-width="2"`;
      switch (v.shape) {
        case "rectangle": case "square": { const w = v.shape === "square" ? 120 : 180, h = 120; return svg(w + 70, h + 50, `<rect x="35" y="15" width="${w}" height="${h}" ${st}/>${txt(35 + w / 2, h + 38, L[0] || "", 13, "middle", 'font-weight="bold"')}${txt(w + 42, 15 + h / 2 + 4, L[1] || "", 13, "start", 'font-weight="bold"')}`, "Rectangle"); }
        case "triangle": return svg(240, 180, `<polygon points="20,160 220,160 120,20" ${st}/>${txt(120, 176, L[0] || "", 13, "middle", 'font-weight="bold"')}${L[1] ? `<line x1="120" y1="20" x2="120" y2="160" stroke="${INK}" stroke-dasharray="4 3"/>${txt(126, 100, L[1], 13, "start", 'font-weight="bold"')}` : ""}`, "Triangle");
        case "right-triangle": return svg(240, 190, `<polygon points="30,160 210,160 30,30" ${st}/><rect x="30" y="148" width="12" height="12" fill="none" stroke="${INK}"/>${txt(120, 178, L[0] || "", 13, "middle", 'font-weight="bold"')}${txt(22, 100, L[1] || "", 13, "end", 'font-weight="bold"')}${txt(130, 88, L[2] || "", 13, "start", 'font-weight="bold"')}`, "Right triangle");
        case "circle": return svg(200, 190, `<circle cx="95" cy="90" r="75" ${st}/><circle cx="95" cy="90" r="2.5" fill="${INK}"/>${L[0] ? `<line x1="95" y1="90" x2="170" y2="90" stroke="${INK}" stroke-width="1.5"/>${txt(132, 84, L[0], 13, "middle", 'font-weight="bold"')}` : ""}`, "Circle");
        case "trapezoid": return svg(260, 170, `<polygon points="20,140 240,140 180,30 80,30" ${st}/>${txt(130, 160, L[0] || "", 13, "middle", 'font-weight="bold"')}${txt(130, 22, L[1] || "", 13, "middle", 'font-weight="bold"')}${L[2] ? `<line x1="130" y1="30" x2="130" y2="140" stroke="${INK}" stroke-dasharray="4 3"/>${txt(136, 90, L[2], 13, "start", 'font-weight="bold"')}` : ""}`, "Trapezoid");
        case "parallelogram": return svg(270, 160, `<polygon points="20,130 200,130 250,30 70,30" ${st}/>${txt(110, 150, L[0] || "", 13, "middle", 'font-weight="bold"')}${L[1] ? `<line x1="70" y1="30" x2="70" y2="130" stroke="${INK}" stroke-dasharray="4 3"/>${txt(64, 85, L[1], 13, "end", 'font-weight="bold"')}` : ""}`, "Parallelogram");
        case "rectangular-prism": return svg(260, 200, `<polygon points="30,70 170,70 170,170 30,170" ${st}/><polygon points="30,70 80,30 220,30 170,70" ${st}/><polygon points="170,70 220,30 220,130 170,170" ${st}/>${txt(100, 188, L[0] || "", 13, "middle", 'font-weight="bold"')}${txt(232, 84, L[1] || "", 13, "start", 'font-weight="bold"')}${txt(210, 160, L[2] || "", 13, "start", 'font-weight="bold"')}`, "Rectangular prism");
      }
      return "";
    }
    case "angle": {
      const cx = 30, cy = 140, len = 130, a = (v.degrees * Math.PI) / 180;
      let b = `<line x1="${cx}" y1="${cy}" x2="${cx + len}" y2="${cy}" stroke="${INK}" stroke-width="2.5"/><line x1="${cx}" y1="${cy}" x2="${cx + len * Math.cos(a)}" y2="${cy - len * Math.sin(a)}" stroke="${INK}" stroke-width="2.5"/>`;
      const r = 30, large = v.degrees > 180 ? 1 : 0;
      b += `<path d="M${cx + r},${cy} A${r},${r} 0 ${large} 0 ${cx + r * Math.cos(a)},${cy - r * Math.sin(a)}" fill="none" stroke="${ACCENT}" stroke-width="1.5"/>`;
      if (v.protractor) for (let d = 0; d <= 180; d += 10) { const t = (d * Math.PI) / 180; b += `<line x1="${cx + (len - 8) * Math.cos(t)}" y1="${cy - (len - 8) * Math.sin(t)}" x2="${cx + len * Math.cos(t)}" y2="${cy - len * Math.sin(t)}" stroke="${SOFT}"/>`; }
      if (v.label || showAnswers) b += txt(cx + 46 * Math.cos(a / 2), cy - 46 * Math.sin(a / 2) + 4, showAnswers ? `${fmt(v.degrees)}°` : v.label || "", 13, "middle", 'font-weight="bold"');
      return svg(200, 160, b, "Angle");
    }
    case "table": {
      const cols = Math.max(v.headers.length, ...v.rows.map((r) => r.length), 1);
      const cw = Math.max(70, Math.min(140, Math.floor(520 / cols))), rh = 28, W = cols * cw + 2, H = (v.rows.length + (v.headers.length ? 1 : 0)) * rh + 2;
      let b = "", y = 1;
      if (v.headers.length) { b += `<rect x="1" y="1" width="${W - 2}" height="${rh}" fill="#e5e7eb"/>`; v.headers.forEach((h, i) => { b += txt(1 + i * cw + cw / 2, y + 18, h, 12, "middle", 'font-weight="bold"'); }); y += rh; }
      v.rows.forEach((row) => { for (let i = 0; i < cols; i++) b += txt(1 + i * cw + cw / 2, y + 18, row[i] ?? "", 12); y += rh; });
      for (let i = 0; i <= cols; i++) b += `<line x1="${1 + i * cw}" y1="1" x2="${1 + i * cw}" y2="${H - 1}" stroke="${INK}"/>`;
      for (let yy = 1; yy <= H; yy += rh) b += `<line x1="1" y1="${yy}" x2="${W - 1}" y2="${yy}" stroke="${INK}"/>`;
      return svg(W, H, b, "Table");
    }
    case "grid-paper": {
      const g = 18, W = v.cols * g + 2, H = v.rows * g + 2;
      let b = "";
      for (let i = 0; i <= v.cols; i++) b += `<line x1="${1 + i * g}" y1="1" x2="${1 + i * g}" y2="${H - 1}" stroke="${SOFT}"/>`;
      for (let i = 0; i <= v.rows; i++) b += `<line x1="1" y1="${1 + i * g}" x2="${W - 1}" y2="${1 + i * g}" stroke="${SOFT}"/>`;
      return svg(W, H, b, "Grid paper");
    }
    case "money": {
      const spec: Record<string, { r: number; label: string; fill: string }> = { penny: { r: 14, label: "1¢", fill: "#f4c7a1" }, nickel: { r: 16, label: "5¢", fill: "#e5e7eb" }, dime: { r: 12, label: "10¢", fill: "#e5e7eb" }, quarter: { r: 19, label: "25¢", fill: "#e5e7eb" }, dollar: { r: 0, label: "$1", fill: "#bbf7d0" } };
      let x = 6, b = "";
      for (const c of v.coins) for (let k = 0; k < c.count; k++) {
        const sp = spec[c.kind];
        if (c.kind === "dollar") { b += `<rect x="${x}" y="14" width="74" height="34" rx="3" fill="${sp.fill}" stroke="${INK}"/>${txt(x + 37, 36, "$1", 14, "middle", 'font-weight="bold"')}`; x += 82; }
        else { b += `<circle cx="${x + sp.r}" cy="31" r="${sp.r}" fill="${sp.fill}" stroke="${INK}" stroke-width="1.5"/>${txt(x + sp.r, 35, sp.label, 10, "middle", 'font-weight="bold"')}`; x += sp.r * 2 + 6; }
      }
      return svg(Math.max(60, x), 62, b, "Coins and bills");
    }
  }
  return "";
}

const niceStep = (top: number) => { const raw = top / 5; const p = Math.pow(10, Math.floor(Math.log10(raw))); return [1, 2, 5, 10].map((m) => m * p).find((x) => x >= raw) || raw; };
const niceMax = (v: number) => { const st = niceStep(v * 1.1); return Math.ceil((v * 1.05) / st) * st; };
