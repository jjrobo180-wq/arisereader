// Pod+ Studio: notes that come in as a PDF, a photo, or a recording, turned into plain text for
// Study Pod+ and Meeting Pod.
//   PDF       the text inside it, read here (most PDFs made from Word, Google Docs or slides).
//             A scanned PDF has no text inside: the person is asked to add photos of the pages.
//   Photo     an AI that can see reads the handwriting or printed notes (Groq's vision model,
//             or OpenAI's when that's on).
//   Recording a lecture or meeting, written down by speech to text (podcastDirectory.openAiTranscribe).
import zlib from "node:zlib";

// ---- PDF text ----
const unescapePdf = (s: string) => s.replace(/\\(\d{1,3}|[nrtbf()\\]|\r?\n)/g, (_, e: string) => {
  if (/^\d/.test(e)) return String.fromCharCode(parseInt(e, 8));
  return ({ n: "\n", r: "", t: " ", b: "", f: "", "(": "(", ")": ")", "\\": "\\" } as Record<string, string>)[e] ?? "";
});

/** The text shown by one page's drawing instructions (strings drawn with Tj, TJ, ' and "). */
export function contentText(ops: string): string {
  let out = "";
  const re = /\((?:\\.|[^\\)])*\)|\[(?:\\.|[^\]\\])*\]\s*TJ|(?<![A-Za-z*])(?:T\*|Td|TD|Tm|ET)(?![A-Za-z*])|-?\d*\.?\d+\s+(-?\d*\.?\d+)\s+T[dD]\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ops))) {
    const t = m[0];
    if (t.startsWith("(")) out += unescapePdf(t.slice(1, -1));
    else if (t.startsWith("[")) {
      for (const part of t.slice(1, t.lastIndexOf("]")).match(/\((?:\\.|[^\\)])*\)|-?\d*\.?\d+/g) || []) {
        if (part.startsWith("(")) out += unescapePdf(part.slice(1, -1));
        else if (Number(part) < -180) out += " ";
      }
    } else if (m[1] !== undefined) { if (Number(m[1]) !== 0) out += "\n"; }
    else if (t === "T*" || t === "ET") out += "\n";
    else if (t === "Tm") out += " ";
  }
  return out;
}

/** Everything written in a PDF, as plain text ("" when it's a scan or uses fonts this can't read). */
export function pdfText(pdf: Buffer, max = 40_000): string {
  const raw = pdf.toString("latin1");
  const parts: string[] = [];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) && parts.join("").length < max * 2) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    const head = raw.slice(Math.max(0, raw.lastIndexOf("<<", m.index)), m.index);
    re.lastIndex = end;
    if (/\/Subtype\s*\/Image|\/Type\s*\/XObject|\/Length1|\/FontFile/.test(head)) continue;
    let body = pdf.subarray(start, end);
    if (/FlateDecode/.test(head)) {
      try { body = zlib.inflateSync(body); } catch { try { body = zlib.inflateSync(body.subarray(0, body.length - 1)); } catch { continue; } }
    } else if (/\/Filter/.test(head)) continue;
    const ops = body.toString("latin1");
    if (!/\b(BT|Tj|TJ)\b/.test(ops)) continue;
    parts.push(contentText(ops));
  }
  return parts.join("\n").replace(/[^\S\n]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}

/** Does this look like real words (and not the codes of a font this can't read)? */
export function looksReadable(text: string): boolean {
  const t = text.replace(/\s+/g, "");
  if (t.length < 40) return false;
  const letters = (t.match(/[A-Za-z]/g) || []).length;
  return letters / t.length > 0.55 && /\b[a-z]{3,}\b.*\b[a-z]{3,}\b/i.test(text);
}

// ---- Photos ----
export const PHOTO_PROMPT = "These are someone's notes (handwritten or printed, maybe a slide or a page of a book). Write out all the text exactly as it is, in reading order, keeping headings and lists on their own lines. Describe a diagram or chart in one short line in [brackets]. Don't add anything that isn't there. If there's no text, answer with nothing.";

type See = (dataUrl: string) => Promise<string>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function seeWith(url: string, key: string, model: string, dataUrl: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature: 0, max_tokens: 3000, messages: [{ role: "user", content: [{ type: "text", text: PHOTO_PROMPT }, { type: "image_url", image_url: { url: dataUrl } }] }] }),
      signal: AbortSignal.timeout(90_000),
    });
    // Busy: wait and ask again, a few times.
    if ((r.status === 429 || r.status >= 500) && attempt < 4) { await sleep(Math.min(15, Number(r.headers.get("retry-after")) || 2 * 2 ** attempt) * 1000); continue; }
    if (!r.ok) throw Object.assign(new Error(`vision ${r.status}`), { status: r.status });
    const body: any = await r.json().catch(() => null);
    return String(body?.choices?.[0]?.message?.content || "").trim();
  }
}

const openAiOn = () => !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "routed-to-grok" && process.env.USE_OPENAI === "1";
export const canSeePhotos = () => !!process.env.GROQ_API_KEY || openAiOn();

/** The text in a photo of notes. */
export const readPhoto: See = async (dataUrl) => {
  let last: any = new Error("no vision");
  if (process.env.GROQ_API_KEY) {
    try { return await seeWith("https://api.groq.com/openai/v1/chat/completions", process.env.GROQ_API_KEY, process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct", dataUrl); }
    catch (e) { last = e; }
  }
  if (openAiOn()) return seeWith("https://api.openai.com/v1/chat/completions", process.env.OPENAI_API_KEY!, "gpt-4.1-mini", dataUrl);
  throw last;
};

export const IMAGE_DATA = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;
