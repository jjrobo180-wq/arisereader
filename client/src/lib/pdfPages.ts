// A PDF turned into pictures of its pages, in the browser (pdf.js, loaded from its CDN only when needed, like the
// QR reader). The AI reads pictures reliably; a PDF sent as a file can be turned down (a locked or unusual PDF,
// as school systems often print). Locked-for-editing PDFs with no open password still draw fine.
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
const WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
let lib: Promise<any> | null = null;
const load = () => (lib ??= import(/* @vite-ignore */ PDFJS).then((m: any) => { m.GlobalWorkerOptions.workerSrc = WORKER; return m; }).catch((e) => { lib = null; throw e; }));

/** JPEG data URLs of the first pages (wide enough for small print to read). */
export async function pdfToImages(file: Blob, maxPages = 4, width = 1800): Promise<string[]> {
  const pdfjs = await load();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const out: string[] = [];
  try {
    for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(3, width / base.width) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      out.push(canvas.toDataURL("image/jpeg", 0.85));
      page.cleanup?.();
    }
  } finally { void doc.destroy?.(); }
  return out;
}

/** The words in a PDF, page by page (little or nothing for a scan). */
export async function pdfToText(file: Blob, maxPages = 30): Promise<string> {
  const pdfjs = await load();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const pages: string[] = [];
  try {
    for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      pages.push((content.items as any[]).map((it) => (typeof it?.str === "string" ? it.str + (it.hasEOL ? "\n" : "") : "")).join("").replace(/[ \t]+\n/g, "\n").trim());
      page.cleanup?.();
    }
  } finally { void doc.destroy?.(); }
  return pages.filter(Boolean).join("\n\n");
}

const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const toB64 = (bytes: Uint8Array) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
/** Groq (the site's AI) reads at most this many pictures in one ask. */
export const AI_MAX_PICTURES = 5;

/**
 * Uploaded files made ready for an AI that can't open PDFs (the site's AI, Groq, reads words and pictures only):
 * a PDF with words in it becomes a text file of those words (cheap for the AI, and exact); a scanned PDF becomes
 * pictures of its pages, up to `room` pictures in all. Other files, and a PDF that can't be opened here, go as
 * they were.
 */
export async function pdfsForAi(files: { name: string; data: string }[], room: number): Promise<{ files: { name: string; data: string }[]; images: string[] }> {
  const out: { name: string; data: string }[] = [];
  const images: string[] = [];
  for (const f of files) {
    if (!/\.pdf$/i.test(f.name)) { out.push(f); continue; }
    try {
      const blob = new Blob([fromB64(f.data)], { type: "application/pdf" });
      const text = (await pdfToText(blob)).slice(0, 60_000);
      if (text.replace(/\s+/g, "").length >= 200) { out.push({ name: f.name.replace(/\.pdf$/i, ".txt"), data: toB64(new TextEncoder().encode(text)) }); continue; }
      const pages = room - images.length > 0 ? await pdfToImages(blob, room - images.length, 1600) : [];
      if (pages.length) { images.push(...pages); continue; }
    } catch { /* sent as it was */ }
    out.push(f);
  }
  return { files: out, images };
}
