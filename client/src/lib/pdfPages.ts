// A PDF turned into pictures of its pages, in the browser (pdf.js, loaded from its CDN only when needed, like the
// QR reader). The AI reads pictures reliably; a PDF sent as a file can be turned down (a locked or unusual PDF,
// as school systems often print). Locked-for-editing PDFs with no open password still draw fine.
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
const WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
let lib: Promise<any> | null = null;
const load = () => (lib ??= import(/* @vite-ignore */ PDFJS).then((m: any) => { m.GlobalWorkerOptions.workerSrc = WORKER; return m; }).catch((e) => { lib = null; throw e; }));

/** JPEG data URLs of the first pages (wide enough for small print to read). */
export async function pdfToImages(file: File, maxPages = 4, width = 1800): Promise<string[]> {
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
