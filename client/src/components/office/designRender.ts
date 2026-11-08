// Arise Design exports: each page drawn on a canvas from the same numbers the screen uses (designDom.tsx),
// saved as PNG or JPG, or as a PDF with one page per design page (a small PDF writer: each page is a JPEG).
import { designShapePath, gradientParts, type DEl, type Design, type DPage } from "@shared/office/designModel";

const images = new Map<string, Promise<HTMLImageElement>>();
const loadImg = (src: string) => {
  let p = images.get(src);
  if (!p) { p = new Promise((ok, no) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => no(new Error("A picture couldn't be loaded.")); i.src = src; }); images.set(src, p); }
  return p;
};

function paint(ctx: CanvasRenderingContext2D, fill: string, w: number, h: number): string | CanvasGradient {
  const g = gradientParts(fill);
  if (!g) return fill;
  // CSS angles: 0deg points up, 90deg right. The gradient line runs through the box's center.
  const a = ((g.angle - 90) * Math.PI) / 180, len = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
  const cx = w / 2, cy = h / 2, dx = (Math.cos(a) * len) / 2, dy = (Math.sin(a) * len) / 2;
  const lg = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  g.stops.forEach((c, i) => lg.addColorStop(i / (g.stops.length - 1), c));
  return lg;
}

/** Text wrapped to a width, the way the screen wraps it (words, then long words by letter). */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      const test = line + word;
      if (ctx.measureText(test).width <= width || !line.trim()) {
        if (ctx.measureText(test).width > width && !line.trim()) {
          // A single word wider than the box: break it.
          let part = "";
          for (const ch of Array.from(word)) { if (ctx.measureText(part + ch).width > width && part) { out.push(part); part = ch; } else part += ch; }
          line = part;
        } else line = test;
      } else { out.push(line.trimEnd()); line = word.trimStart(); }
    }
    out.push(line.trimEnd());
  }
  return out;
}

async function drawEl(ctx: CanvasRenderingContext2D, e: DEl) {
  ctx.save();
  ctx.globalAlpha = e.opacity ?? 1;
  ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
  if (e.rot) ctx.rotate((e.rot * Math.PI) / 180);
  ctx.scale(e.flipX ? -1 : 1, e.flipY ? -1 : 1);
  ctx.translate(-e.w / 2, -e.h / 2);
  if (e.shadow) { ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = Math.max(4, e.h * 0.06); ctx.shadowOffsetY = Math.max(2, e.h * 0.03); }
  if (e.type === "shape") {
    const p = new Path2D(designShapePath(e.shape || "rect", e.w, e.h, e.radius));
    if (e.fill && e.fill !== "none") { ctx.fillStyle = paint(ctx, e.fill, e.w, e.h); ctx.fill(p); }
    if (e.stroke && e.stroke !== "none" && e.strokeW) { ctx.shadowColor = "transparent"; ctx.lineWidth = e.strokeW; ctx.strokeStyle = e.stroke; ctx.stroke(p); }
  } else if (e.type === "line") {
    const sw = e.strokeW || 4, mid = e.h / 2;
    ctx.strokeStyle = e.stroke || "#111827"; ctx.fillStyle = e.stroke || "#111827"; ctx.lineWidth = sw; ctx.lineCap = "round";
    ctx.setLineDash(e.line === "dashed" ? [sw * 3, sw * 2] : e.line === "dotted" ? [0.01, sw * 2] : []);
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(e.line === "arrow" ? e.w - sw * 2 : e.w, mid); ctx.stroke(); ctx.setLineDash([]);
    if (e.line === "arrow") { ctx.beginPath(); ctx.moveTo(e.w - sw * 4, mid - sw * 2.4); ctx.lineTo(e.w, mid); ctx.lineTo(e.w - sw * 4, mid + sw * 2.4); ctx.closePath(); ctx.fill(); }
  } else if (e.type === "image") {
    const clip = e.shape && e.shape !== "rect" ? new Path2D(designShapePath(e.shape, e.w, e.h, e.radius)) : e.radius ? new Path2D(designShapePath("round", e.w, e.h, e.radius)) : null;
    if (clip) ctx.clip(clip);
    if (e.src) {
      const img = await loadImg(e.src);
      const r = e.fit === "contain" ? Math.min(e.w / img.width, e.h / img.height) : Math.max(e.w / img.width, e.h / img.height);
      const dw = img.width * r, dh = img.height * r;
      ctx.drawImage(img, (e.w - dw) / 2, (e.h - dh) / 2, dw, dh);
    } else { ctx.fillStyle = paint(ctx, e.fill || "#cbd5e1", e.w, e.h); ctx.fillRect(0, 0, e.w, e.h); }
  } else if (e.type === "sticker") {
    const s = Math.min(e.w, e.h) * 0.86;
    ctx.font = `${s}px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(e.emoji || "", e.w / 2, e.h / 2 + s * 0.05);
  } else if (e.type === "text") {
    const size = e.size || 40, lh = size * (e.lineH || 1.2);
    ctx.font = `${e.italic ? "italic " : ""}${e.weight || 400} ${size}px '${e.font || "Inter"}', Inter, sans-serif`;
    if ("letterSpacing" in ctx && e.letter) (ctx as any).letterSpacing = `${e.letter}px`;
    ctx.textBaseline = "middle"; ctx.textAlign = e.align === "left" ? "left" : e.align === "right" ? "right" : "center";
    const text = e.upper ? (e.text || "").toUpperCase() : e.text || "";
    const rows = wrap(ctx, text, e.w);
    const x = e.align === "left" ? 0 : e.align === "right" ? e.w : e.w / 2;
    rows.forEach((row, i) => {
      const y = i * lh + lh / 2;
      if (e.highlight && row) {
        const tw = ctx.measureText(row).width, pad = size * 0.18, left = e.align === "left" ? 0 : e.align === "right" ? e.w - tw : (e.w - tw) / 2;
        ctx.save(); ctx.shadowColor = "transparent"; ctx.fillStyle = e.highlight; ctx.fillRect(left - pad, i * lh, tw + pad * 2, lh); ctx.restore();
        ctx.save(); ctx.translate(e.align === "left" ? pad : e.align === "right" ? -pad : 0, 0);
      }
      if (e.outline) { ctx.lineJoin = "round"; ctx.lineWidth = Math.max(1, size * 0.08); ctx.strokeStyle = e.outline; ctx.strokeText(row, x, y); }
      ctx.fillStyle = e.color || "#111827"; ctx.fillText(row, x, y);
      if (e.underline && row) { const tw = ctx.measureText(row).width, left = e.align === "left" ? 0 : e.align === "right" ? e.w - tw : (e.w - tw) / 2; ctx.fillRect(left, y + size * 0.42, tw, Math.max(1, size * 0.06)); }
      if (e.highlight && row) ctx.restore();
    });
  }
  ctx.restore();
}

/** Draws one page on a new canvas, `scale` times the design's size. */
export async function renderPage(d: Pick<Design, "w" | "h">, page: DPage, scale = 1): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  c.width = Math.round(d.w * scale); c.height = Math.round(d.h * scale);
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  // Every font the page uses, loaded before anything is drawn.
  const fonts = new Set(page.elements.filter((e) => e.type === "text").map((e) => `${e.italic ? "italic " : ""}${e.weight || 400} 40px '${e.font || "Inter"}'`));
  await Promise.all(Array.from(fonts).map((f) => (document as any).fonts?.load?.(f).catch(() => null)));
  ctx.fillStyle = paint(ctx, page.bg || "#ffffff", d.w, d.h); ctx.fillRect(0, 0, d.w, d.h);
  if (page.bgImage) { const img = await loadImg(page.bgImage); const r = Math.max(d.w / img.width, d.h / img.height); ctx.drawImage(img, (d.w - img.width * r) / 2, (d.h - img.height * r) / 2, img.width * r, img.height * r); }
  for (const e of page.elements) await drawEl(ctx, e);
  return c;
}

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) => new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("The picture couldn't be made."))), type, q));

/** PNG or JPG of one page. */
export async function exportImage(d: Design, pageIndex: number, type: "png" | "jpg", scale = 1): Promise<Blob> {
  const c = await renderPage(d, d.pages[pageIndex], scale);
  return toBlob(c, type === "png" ? "image/png" : "image/jpeg", 0.92);
}

/** A PDF of every page (print size: 72 points per inch at 150 pixels per inch for print sizes). */
export async function exportPdf(d: Design, pages = d.pages.map((_, i) => i)): Promise<Blob> {
  const ptPerPx = 72 / 150;
  const jpgs: { bytes: Uint8Array; w: number; h: number }[] = [];
  for (const i of pages) {
    const c = await renderPage(d, d.pages[i], Math.min(2, 3000 / Math.max(d.w, d.h)));
    jpgs.push({ bytes: new Uint8Array(await (await toBlob(c, "image/jpeg", 0.92)).arrayBuffer()), w: c.width, h: c.height });
  }
  return pdfFromJpegs(jpgs, d.w * ptPerPx, d.h * ptPerPx);
}

/** A minimal PDF: one page per JPEG, each filling its page. */
export function pdfFromJpegs(jpgs: { bytes: Uint8Array; w: number; h: number }[], pw: number, ph: number): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = []; const offsets: number[] = []; let len = 0;
  const push = (b: Uint8Array | string) => { const u = typeof b === "string" ? enc.encode(b) : b; parts.push(u); len += u.length; };
  const obj = (n: number, body: () => void) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push("\nendobj\n"); };
  push("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
  const n = jpgs.length, pageIds = jpgs.map((_, i) => 3 + i * 3);
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push(`<< /Type /Pages /Kids [${pageIds.map((p) => `${p} 0 R`).join(" ")}] /Count ${n} >>`));
  jpgs.forEach((j, i) => {
    const p = pageIds[i], img = p + 1, content = p + 2, w = pw.toFixed(2), h = ph.toFixed(2);
    obj(p, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im${i} ${img} 0 R >> >> /Contents ${content} 0 R >>`));
    obj(img, () => { push(`<< /Type /XObject /Subtype /Image /Width ${j.w} /Height ${j.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${j.bytes.length} >>\nstream\n`); push(j.bytes); push("\nendstream"); });
    const draw = `q ${w} 0 0 ${h} 0 0 cm /Im${i} Do Q`;
    obj(content, () => push(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
  });
  const total = 3 + n * 3, xref = len;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let k = 1; k < total; k++) push(`${String(offsets[k]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}

/** A picture someone adds, made small enough to keep in the design (longest side 1600 px, JPEG unless it has see-through parts). */
export async function shrinkImage(file: File, max = 1600): Promise<{ src: string; w: number; h: number }> {
  if (!/^image\//.test(file.type)) throw new Error("Pick a picture (JPG, PNG, GIF or WebP).");
  if (file.size > 25_000_000) throw new Error("That picture is too big (over 25 MB).");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("That picture couldn't be opened.")); i.src = url; });
    const r = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const png = file.type === "image/png" || file.type === "image/webp" || file.type === "image/gif";
    return { src: c.toDataURL(png ? "image/png" : "image/jpeg", 0.86), w: c.width, h: c.height };
  } finally { URL.revokeObjectURL(url); }
}
