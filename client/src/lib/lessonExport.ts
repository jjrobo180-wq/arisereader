// The Lesson Planner's downloads, made right in the browser with nothing to install:
//  - a PowerPoint (.pptx) from slides made with AI, speaker notes included;
//  - a worksheet or its answer key as a printable page, or as a file Word opens (.doc).
import type { GenSlide, GenWorksheet } from "@shared/lessonPlanner";

// ─── A small ZIP writer (files are stored, not squeezed; PowerPoint is happy with that) ───

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zip(files: { name: string; data: string | Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true);
    local.setUint16(10, 0, true); local.setUint16(12, 0x21, true); local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true); local.setUint32(22, data.length, true); local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), name, data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(10, 0, true);
    cd.setUint16(12, 0, true); cd.setUint16(14, 0x21, true); cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true);
    cd.setUint16(28, name.length, true); cd.setUint16(30, 0, true); cd.setUint16(32, 0, true); cd.setUint16(34, 0, true); cd.setUint16(36, 0, true);
    cd.setUint32(38, 0, true); cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const all = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of all) { out.set(c, at); at += c.length; }
  return out;
}

// ─── PowerPoint ─────────────────────────────────────────────────────────────

const x = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const W = 12192000, H = 6858000;

/** The deck's colours, by the class colour picked in the planner. */
const DECK_COLORS: Record<string, [string, string]> = {
  teal: ["0F766E", "CCFBF1"], sky: ["0369A1", "E0F2FE"], violet: ["6D28D9", "EDE9FE"], rose: ["BE123C", "FFE4E6"], amber: ["B45309", "FEF3C7"],
  emerald: ["047857", "D1FAE5"], indigo: ["4338CA", "E0E7FF"], orange: ["C2410C", "FFEDD5"], slate: ["334155", "E2E8F0"],
};

function textBox(id: number, name: string, x0: number, y0: number, w: number, h: number, paras: string, anchor = "t") {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x0}" y="${y0}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="${anchor}"><a:normAutofit/></a:bodyPr><a:lstStyle/>${paras}</p:txBody></p:sp>`;
}
function rect(id: number, x0: number, y0: number, w: number, h: number, color: string) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Band ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x0}" y="${y0}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`;
}
const para = (text: string, size: number, color: string, opts: { bold?: boolean; bullet?: boolean; align?: string; space?: number } = {}) =>
  `<a:p><a:pPr${opts.align ? ` algn="${opts.align}"` : ""}${opts.bullet ? ' marL="342900" indent="-342900"' : ""}>${opts.space ? `<a:spcBef><a:spcPts val="${opts.space}"/></a:spcBef>` : ""}${opts.bullet ? `<a:buClr><a:srgbClr val="${color === "FFFFFF" ? "FFFFFF" : "64748B"}"/></a:buClr><a:buFont typeface="Arial"/><a:buChar char="&#8226;"/>` : "<a:buNone/>"}</a:pPr><a:r><a:rPr lang="en-US" sz="${size}"${opts.bold ? ' b="1"' : ""} dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${x(text)}</a:t></a:r></a:p>`;

function slideXml(slide: GenSlide, index: number, total: number, deckTitle: string, [dark, light]: [string, string]) {
  const first = index === 0;
  let shapes = "";
  if (first) {
    shapes += rect(2, 0, 0, W, H, dark);
    shapes += rect(3, 0, H - 228600, W, 228600, light);
    shapes += textBox(4, "Title", 685800, 1600200, W - 1371600, 1800000, para(slide.title, 4800, "FFFFFF", { bold: true }), "b");
    shapes += textBox(5, "Subtitle", 685800, 3500000, W - 1371600, 1800000, slide.bullets.map((b) => para(b, 2200, "FFFFFF", { space: 400 })).join("") || para(" ", 2000, "FFFFFF"));
  } else {
    shapes += rect(2, 0, 0, W, 1143000, light);
    shapes += rect(3, 0, 1143000, W, 45720, dark);
    shapes += textBox(4, "Title", 457200, 152400, W - 914400, 914400, para(slide.title, 3200, dark, { bold: true }), "ctr");
    const size = slide.bullets.length > 5 ? 2000 : 2400;
    shapes += textBox(5, "Body", 609600, 1447800, W - 1219200, H - 2133600, slide.bullets.map((b) => para(b, size, "1E293B", { bullet: true, space: 900 })).join("") || para(" ", 2000, "1E293B"));
    shapes += textBox(6, "Footer", 457200, H - 457200, W - 914400, 365760, para(`${deckTitle}  ·  ${index + 1}/${total}`, 1100, "94A3B8", { align: "r" }));
  }
  return `${HEAD}<p:sld ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function notesXml(n: number, notes: string) {
  const body = notes.split(/\n+/).map((t) => `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${x(t)}</a:t></a:r></a:p>`).join("") || "<a:p><a:endParaRPr lang=\"en-US\"/></a:p>";
  return `${HEAD}<p:notes ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image ${n}"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes ${n}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${body}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;
}

const THEME = `${HEAD}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Arise"><a:themeElements><a:clrScheme name="Arise"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1E293B"/></a:dk2><a:lt2><a:srgbClr val="F1F5F9"/></a:lt2><a:accent1><a:srgbClr val="0F766E"/></a:accent1><a:accent2><a:srgbClr val="0369A1"/></a:accent2><a:accent3><a:srgbClr val="6D28D9"/></a:accent3><a:accent4><a:srgbClr val="BE123C"/></a:accent4><a:accent5><a:srgbClr val="B45309"/></a:accent5><a:accent6><a:srgbClr val="047857"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Arise"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Arise"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
const CLRMAP = '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>';
const EMPTY_TREE = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree>';
const rels = (items: [string, string, string][]) => `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id, type, target]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`).join("")}</Relationships>`;

/** A PowerPoint file of these slides. The first slide is the title slide. */
export function buildPptx(deckTitle: string, slides: GenSlide[], color = "teal"): Uint8Array {
  const colors = DECK_COLORS[color] || DECK_COLORS.teal;
  const list = slides.length ? slides : [{ title: deckTitle, bullets: [] }];
  const n = list.length;
  const files: { name: string; data: string }[] = [];
  const slideOverrides = list.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/notesSlides/notesSlide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`).join("");
  files.push({ name: "[Content_Types].xml", data: `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slideOverrides}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` });
  files.push({ name: "_rels/.rels", data: `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` });
  files.push({ name: "docProps/core.xml", data: `${HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(deckTitle)}</dc:title><dc:creator>Arise WorkHub</dc:creator></cp:coreProperties>` });
  files.push({ name: "docProps/app.xml", data: `${HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Arise WorkHub</Application><Slides>${n}</Slides></Properties>` });
  files.push({ name: "ppt/presentation.xml", data: `${HEAD}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId3"/></p:notesMasterIdLst><p:sldIdLst>${list.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${10 + i}"/>`).join("")}</p:sldIdLst><p:sldSz cx="${W}" cy="${H}"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:defaultTextStyle></p:presentation>` });
  files.push({ name: "ppt/_rels/presentation.xml.rels", data: rels([["rId1", "slideMaster", "slideMasters/slideMaster1.xml"], ["rId2", "theme", "theme/theme1.xml"], ["rId3", "notesMaster", "notesMasters/notesMaster1.xml"], ...list.map((_, i): [string, string, string] => [`rId${10 + i}`, "slide", `slides/slide${i + 1}.xml`])]) });
  files.push({ name: "ppt/slideMasters/slideMaster1.xml", data: `${HEAD}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>${EMPTY_TREE}</p:cSld>${CLRMAP}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="3200"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="2400"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>` });
  files.push({ name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", data: rels([["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"], ["rId2", "theme", "../theme/theme1.xml"]]) });
  files.push({ name: "ppt/slideLayouts/slideLayout1.xml", data: `${HEAD}<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank">${EMPTY_TREE}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>` });
  files.push({ name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", data: rels([["rId1", "slideMaster", "../slideMasters/slideMaster1.xml"]]) });
  files.push({ name: "ppt/theme/theme1.xml", data: THEME });
  files.push({ name: "ppt/theme/theme2.xml", data: THEME });
  files.push({ name: "ppt/notesMasters/notesMaster1.xml", data: `${HEAD}<p:notesMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="381000" y="685800"/><a:ext cx="6096000" cy="3429000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="4343400"/><a:ext cx="5486400" cy="4114800"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp></p:spTree></p:cSld>${CLRMAP}<p:notesStyle><a:lvl1pPr><a:defRPr sz="1200"/></a:lvl1pPr></p:notesStyle></p:notesMaster>` });
  files.push({ name: "ppt/notesMasters/_rels/notesMaster1.xml.rels", data: rels([["rId1", "theme", "../theme/theme2.xml"]]) });
  list.forEach((slide, i) => {
    files.push({ name: `ppt/slides/slide${i + 1}.xml`, data: slideXml(slide, i, n, deckTitle, colors) });
    files.push({ name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data: rels([["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"], ["rId2", "notesSlide", `../notesSlides/notesSlide${i + 1}.xml`]]) });
    files.push({ name: `ppt/notesSlides/notesSlide${i + 1}.xml`, data: notesXml(i + 1, slide.notes || "") });
    files.push({ name: `ppt/notesSlides/_rels/notesSlide${i + 1}.xml.rels`, data: rels([["rId1", "notesMaster", "../notesMasters/notesMaster1.xml"], ["rId2", "slide", `../slides/slide${i + 1}.xml`]]) });
  });
  return zip(files);
}

// ─── Worksheets and answer keys ─────────────────────────────────────────────

const h = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const LETTERS = "ABCDEF";

/** A worksheet as a full page to print or open in Word. With `answers` it is the answer key. */
export function worksheetHtml(ws: GenWorksheet, opts: { answers: boolean; className?: string; teacher?: string }): string {
  let n = 0;
  const sections = ws.sections.map((s) => {
    const items = s.items.map((it) => {
      n++;
      const choices = it.choices?.length
        ? `<ol class="choices">${it.choices.map((c, i) => `<li class="${opts.answers && c.trim().toLowerCase() === it.answer.trim().toLowerCase() ? "right" : ""}"><b>${LETTERS[i]}.</b> ${h(c)}</li>`).join("")}</ol>`
        : "";
      const lines = !opts.answers && !it.choices?.length ? `<div class="lines">${"<div class=\"line\"></div>".repeat(it.lines || 2)}</div>` : "";
      const answer = opts.answers ? `<div class="answer"><b>Answer:</b> ${h(it.answer || "—")}</div>` : "";
      return `<li class="item"><div class="prompt">${h(it.prompt).replace(/\n/g, "<br>")}</div>${choices}${lines}${answer}</li>`;
    }).join("");
    const start = n - s.items.length + 1;
    return `<section><h2>${h(s.heading)}</h2>${s.directions ? `<p class="dir">${h(s.directions)}</p>` : ""}<ol class="items" start="${start}">${items}</ol></section>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${h(ws.title)}${opts.answers ? " — Answer key" : ""}</title><style>
  @page { margin: 0.6in; }
  body { font-family: Calibri, "Segoe UI", Arial, sans-serif; color: #111827; font-size: 12pt; line-height: 1.45; max-width: 7.5in; margin: 0 auto; padding: 16px; }
  .top { display: flex; gap: 24px; justify-content: space-between; border-bottom: 2px solid #111827; padding-bottom: 8px; font-size: 11pt; }
  .top span { flex: 1; border-bottom: 1px solid #9ca3af; min-height: 18px; }
  h1 { font-size: 20pt; margin: 18px 0 4px; }
  .key { display: inline-block; background: #fee2e2; color: #991b1b; font-weight: 700; font-size: 10pt; padding: 2px 8px; border-radius: 4px; margin-left: 8px; vertical-align: middle; }
  .inst { color: #374151; margin: 0 0 12px; }
  h2 { font-size: 13pt; margin: 20px 0 4px; padding: 4px 8px; background: #f3f4f6; border-left: 4px solid #0f766e; }
  .dir { font-style: italic; color: #4b5563; margin: 4px 0 8px; }
  .items { padding-left: 24px; }
  .item { margin: 0 0 14px; break-inside: avoid; page-break-inside: avoid; }
  .choices { list-style: none; padding-left: 8px; margin: 6px 0 0; display: grid; grid-template-columns: 1fr 1fr; gap: 2px 24px; }
  .choices .right { background: #dcfce7; font-weight: 700; border-radius: 4px; }
  .lines .line { border-bottom: 1px solid #9ca3af; height: 26px; }
  .answer { margin-top: 4px; color: #b91c1c; }
  .foot { margin-top: 24px; font-size: 9pt; color: #9ca3af; text-align: right; }
  </style></head><body>
  <div class="top"><b>Name</b><span></span><b>Date</b><span style="flex:.5"></span>${opts.className ? `<b>${h(opts.className)}</b>` : "<b>Class</b><span style=\"flex:.4\"></span>"}</div>
  <h1>${h(ws.title)}${opts.answers ? '<span class="key">ANSWER KEY</span>' : ""}</h1>
  ${ws.instructions ? `<p class="inst">${h(ws.instructions)}</p>` : ""}
  ${sections}
  <div class="foot">${opts.teacher ? `${h(opts.teacher)} · ` : ""}Made with Arise WorkHub</div>
  </body></html>`;
}

/** A plain-text answer key (for copying into a gradebook or an LMS). */
export function answerKeyText(ws: GenWorksheet): string {
  let n = 0;
  return [`${ws.title} — Answer key`, ...ws.sections.flatMap((s) => [``, s.heading, ...s.items.map((it) => {
    n++;
    const letter = it.choices ? it.choices.findIndex((c) => c.trim().toLowerCase() === it.answer.trim().toLowerCase()) : -1;
    return `${n}. ${letter >= 0 ? `${LETTERS[letter]}. ` : ""}${it.answer}`;
  })])].join("\n");
}

// ─── Saving and printing ────────────────────────────────────────────────────

export const safeFileName = (s: string) => (s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "lesson");

export function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadPptx(title: string, slides: GenSlide[], color?: string) {
  download(`${safeFileName(title)}.pptx`, buildPptx(title, slides, color) as BlobPart, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
}

/** Saves a worksheet as a file Word opens. */
export function downloadWorksheetDoc(ws: GenWorksheet, answers: boolean, className?: string) {
  const html = worksheetHtml(ws, { answers, className }).replace("<html>", '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">');
  download(`${safeFileName(ws.title)}${answers ? " - Answer key" : ""}.doc`, "﻿" + html, "application/msword");
}

/** Opens a page in a new tab and brings up the print dialog (Save as PDF lives there). */
export function printHtml(html: string) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch { /* the page is still open to print by hand */ } }, 350);
  return true;
}
