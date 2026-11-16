// Reads the files a teacher adds to the Exemplar Makers (shared/uploads.ts): Word, Excel, PowerPoint, CSV, text and web pages
// become words; a PDF or a photo goes to the AI as it is (the AI reads PDFs, scans included). Nothing is kept.
// Word, Excel and PowerPoint files are ZIPs of XML, read here with Node's own zlib (server/hubFiles.ts); nothing to install.
import { HubFileError, decodeXml, hubFileKind, hubFileText, readZip } from "./hubFiles";
import { htmlToText } from "../shared/hubInbox";
import { UPLOAD_LIMITS } from "../shared/uploads";

/** A problem with an uploaded file, in words a teacher can act on. */
export class UploadError extends Error {}
export type ReadUploads = {
  /** The words in the Word / Excel / PowerPoint / text files, each marked with its file name. */
  text: string;
  /** PDFs and photos as data URLs, for the AI to read itself. */
  attachments: string[];
};

const IMAGE_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
const ext = (name: string) => /\.([a-z0-9]+)$/i.exec(name.trim())?.[1].toLowerCase() || "";

/** A PowerPoint file as plain text: each slide's words, one line per paragraph. */
export function pptxToText(file: Buffer, maxChars = 40_000): string {
  const zip = readZip(file);
  const slides = [...zip.keys()].filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort((a, b) => Number(/(\d+)\.xml$/.exec(a)![1]) - Number(/(\d+)\.xml$/.exec(b)![1]));
  if (!slides.length) throw new UploadError("That does not look like a PowerPoint file. Save it as .pptx and try again.");
  const out: string[] = [];
  let used = 0;
  slides.forEach((name, i) => {
    if (used > maxChars) return;
    const xml = zip.get(name)!().toString("utf8");
    const lines = [...xml.matchAll(/<a:p>[\s\S]*?<\/a:p>|<a:p\s[\s\S]*?<\/a:p>/g)]
      .map((p) => [...p[0].matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((t) => decodeXml(t[1])).join("").trim())
      .filter(Boolean);
    if (!lines.length) return;
    const block = `Slide ${i + 1}:\n${lines.join("\n")}`;
    out.push(block); used += block.length + 2;
  });
  return out.join("\n\n").slice(0, maxChars).trim();
}

/** What was added: an array of { name, data: base64 }. Throws UploadError with a message for the teacher. */
export function readUploads(raw: unknown, maxChars: number): ReadUploads {
  const list = Array.isArray(raw) ? raw : [];
  if (list.length > UPLOAD_LIMITS.files) throw new UploadError(`Add up to ${UPLOAD_LIMITS.files} files at a time.`);
  const texts: string[] = [], attachments: string[] = [];
  for (const f of list) {
    const name = String(f?.name ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 160);
    const b64 = typeof f?.data === "string" ? f.data : "";
    if (!name || !b64 || !/^[A-Za-z0-9+/=\s]+$/.test(b64.slice(0, 4000))) throw new UploadError("One of the files couldn’t be read. Try adding it again.");
    const data = Buffer.from(b64, "base64");
    if (!data.length) throw new UploadError(`“${name}” is empty.`);
    if (data.length > UPLOAD_LIMITS.fileBytes) throw new UploadError(`“${name}” is too big. The most for one file is ${Math.round(UPLOAD_LIMITS.fileBytes / 1_000_000)} MB.`);
    const e = ext(name);
    try {
      if (e === "pdf") {
        if (data.subarray(0, 5).toString("latin1") !== "%PDF-") throw new UploadError(`“${name}” doesn’t look like a PDF.`);
        attachments.push(`data:application/pdf;base64,${data.toString("base64")}`);
      } else if (IMAGE_TYPES[e]) {
        attachments.push(`data:${IMAGE_TYPES[e]};base64,${data.toString("base64")}`);
      } else if (e === "pptx") {
        const inside = pptxToText(data, maxChars);
        if (!inside) throw new UploadError(`“${name}” has no words in it. Add photos of its slides instead.`);
        texts.push(`The file "${name}":\n${inside}`);
      } else if (e === "html" || e === "htm") {
        const inside = htmlToText(data.toString("utf8")).slice(0, maxChars);
        if (inside.length < 20) throw new UploadError(`“${name}” has no readable text.`);
        texts.push(`The file "${name}":\n${inside}`);
      } else {
        if (e === "ppt") throw new UploadError("That is an older PowerPoint file. Open it and use Save As to save it as .pptx, then add it again.");
        if (!/^(docx|doc|xlsx|xls|csv|tsv|txt|md|ics)$/.test(e)) throw new UploadError(`“${name}” can’t be read here. Use a PDF, Word, Excel, PowerPoint, CSV or text file, or a photo.`);
        if (hubFileKind(name) === "calendar") throw new UploadError("That is a calendar file, not a lesson. Add the lesson itself.");
        if (hubFileKind(name) !== "text") throw new UploadError(`“${name}” can’t be read here. Use a PDF, Word, Excel, PowerPoint, CSV or text file, or a photo.`);
        const inside = hubFileText({ name, data }, maxChars);
        if (!inside) throw new UploadError(`“${name}” is empty.`);
        texts.push(`The file "${name}":\n${inside}`);
      }
    } catch (error) {
      if (error instanceof UploadError) throw error;
      if (error instanceof HubFileError) throw new UploadError(error.message);
      throw new UploadError(`“${name}” couldn’t be read. It may be damaged. Try saving it again, or paste its text.`);
    }
  }
  return { text: texts.join("\n\n").slice(0, maxChars * 2), attachments };
}
