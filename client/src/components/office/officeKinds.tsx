// The three Arise Office apps as the Office home screen sees them: what a blank file is, the
// templates, how files are imported and downloaded, and which editor opens them.
import { lazy } from "react";
import { cleanWorkbook, blankWorkbook, Calc, type Workbook } from "@shared/office/workbook";
import { SHEET_TEMPLATES } from "@shared/office/sheetTemplates";
import { parseCsv, readXlsx, sheetFromRows, sheetToCsv, writeXlsx } from "@shared/office/xlsx";
import type { Spreadsheet } from "@shared/sheetsApp";
import { blankDoc, cleanDoc, docPrintHtml, writeDocx } from "@shared/office/docModel";
import { DOC_TEMPLATES } from "@shared/office/docTemplates";
import { blankDeck, cleanDeck, readPptx, writePptx } from "@shared/office/slidesModel";
import { SLIDE_TEMPLATES } from "@shared/office/slideTemplates";
import { OfficeIcons, type LegacyFiles, type OfficeKind } from "./OfficeApp";
import { downloadBlob } from "./officeUi";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const SHEETS: OfficeKind = {
  kind: "sheet", title: "Sheets", noun: "spreadsheet", color: "#0f9d58", icon: OfficeIcons.sheet,
  blank: blankWorkbook, templates: SHEET_TEMPLATES,
  importAccept: ".xlsx,.xlsm,.csv,.tsv,.txt",
  importFile: async (f) => {
    const name = f.name.replace(/\.[^.]+$/, "").slice(0, 120);
    if (/\.(xlsx|xlsm)$/i.test(f.name)) return { name, content: await readXlsx(await f.arrayBuffer()) };
    if (/\.xls$/i.test(f.name)) throw new Error("Old .xls files can't be opened. In Excel, use Save As → .xlsx, then import that.");
    const rows = parseCsv(await f.text(), /\.tsv$/i.test(f.name) ? "\t" : undefined);
    return { name, content: { ...blankWorkbook(), sheets: [sheetFromRows(rows, "Sheet1")] } };
  },
  downloads: [
    { label: "as Excel (.xlsx)", run: (c, name) => { const wb = cleanWorkbook(c); downloadBlob(`${name}.xlsx`, writeXlsx(wb, new Calc(wb)) as BlobPart, XLSX_MIME); } },
    { label: "as CSV (first sheet)", run: (c, name) => { const wb: Workbook = cleanWorkbook(c); downloadBlob(`${name}.csv`, "﻿" + sheetToCsv(wb, 0, new Calc(wb)), "text/csv"); } },
  ],
  Editor: lazy(() => import("./SheetsEditor")),
};

/** Sheets made with the old simple Sheets app, ready to move into the account. */
export function legacySheets(list: Spreadsheet[], remove: (id: string) => void): LegacyFiles {
  return {
    items: list.filter((s) => s.rows.some((r) => r.some((c) => c.trim()))).map((s) => ({ id: s.id, name: s.name || "Untitled spreadsheet", content: { ...blankWorkbook(), sheets: [sheetFromRows(s.rows, "Sheet1")] } })),
    remove,
  };
}

// ─── Docs and Slides ───

export const DOCS: OfficeKind = {
  kind: "doc", title: "Docs", noun: "document", color: "#2563eb", icon: OfficeIcons.doc,
  blank: () => blankDoc(), templates: DOC_TEMPLATES,
  importAccept: ".docx,.html,.htm,.txt,.md",
  importFile: async (f) => { const { importDocFile } = await import("./DocsEditor"); return { name: f.name.replace(/\.[^.]+$/, "").slice(0, 120), content: await importDocFile(f) }; },
  downloads: [
    { label: "as Word (.docx)", run: (c, name) => downloadBlob(`${name}.docx`, writeDocx(cleanDoc(c), name) as BlobPart, "application/vnd.openxmlformats-officedocument.wordprocessingml.document") },
    { label: "as a web page (.html)", run: (c, name) => downloadBlob(`${name}.html`, docPrintHtml(cleanDoc(c), name), "text/html") },
  ],
  Editor: lazy(() => import("./DocsEditor")),
};

export const SLIDES: OfficeKind = {
  kind: "slides", title: "Slides", noun: "presentation", color: "#f59e0b", icon: OfficeIcons.slides,
  blank: () => blankDeck(), templates: SLIDE_TEMPLATES,
  importAccept: ".pptx",
  importFile: async (f) => {
    if (/\.ppt$/i.test(f.name)) throw new Error("Old .ppt files can't be opened. In PowerPoint, use Save As → .pptx, then import that.");
    return { name: f.name.replace(/\.[^.]+$/, "").slice(0, 120), content: await readPptx(await f.arrayBuffer()) };
  },
  downloads: [{ label: "as PowerPoint (.pptx)", run: (c, name) => downloadBlob(`${name}.pptx`, writePptx(cleanDeck(c), name) as BlobPart, "application/vnd.openxmlformats-officedocument.presentationml.presentation") }],
  Editor: lazy(() => import("./SlidesEditor")),
};

export const OFFICE_KINDS = { sheet: SHEETS, doc: DOCS, slides: SLIDES } as const;
