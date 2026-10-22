// Arise Docs: a word processor like Google Docs or Word. Styles and headings, fonts and sizes,
// colours and highlight, lists and checklists, tables, images, links, page breaks, page size and
// margins, header, footer and page numbers, find and replace, word count, an outline, Markdown-style
// shortcuts, version history, Word/PDF/HTML/text in and out, and an AI writing helper.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowLeft, Bold, Image as ImageIcon, Italic, Link as LinkIcon, List, Printer, Sparkles, Star, Table as TableIcon, Underline, FileText,
} from "lucide-react";
import { AlignJustify, CheckSquare, Highlighter, Indent, ListOrdered, Outdent, Redo2, RemoveFormatting, Strikethrough, Undo2, Baseline, PanelLeft } from "./icons";
import { useAuth } from "@/context/AuthContext";
import { askAppAi, docsApi, saveLabel, useCloudDoc } from "@/lib/cloudDocs";
import { useSavedChoice } from "@/lib/useSavedChoice";
import { DOC_FONTS, PAGE_PX, blankDoc, cleanDoc, docPrintHtml, htmlText, readDocx, sanitizeHtml, wordCount, writeDocx, type DocContent } from "@shared/office/docModel";
import { ColorGrid, Dialog, DropButton, Label, MenuBar, MenuList, Tool, ToolSep, btnGhost, btnPrimary, downloadBlob, field, pickFile, safeName, type MenuItem } from "./officeUi";
import { FONT_LINK, loadOfficeFonts } from "./sheetsHelpers";

type DocHandle = ReturnType<typeof useCloudDoc<DocContent>> & { content: DocContent };
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];
const STYLES: { tag: string; label: string; cls: string }[] = [
  { tag: "p", label: "Normal text", cls: "text-[14px]" }, { tag: "h1", label: "Heading 1", cls: "text-[22px] font-bold" }, { tag: "h2", label: "Heading 2", cls: "text-[18px] font-bold" },
  { tag: "h3", label: "Heading 3", cls: "text-[16px] font-bold" }, { tag: "h4", label: "Heading 4", cls: "text-[14px] font-bold" }, { tag: "blockquote", label: "Quote", cls: "italic text-slate-600" }, { tag: "pre", label: "Code", cls: "font-mono text-[13px]" },
];

export default function DocsEditor({ id, onBack, onOpen }: { id: string; onBack: () => void; onOpen?: (id: string) => void }) {
  const doc = useCloudDoc<DocContent>(id, cleanDoc);
  useEffect(() => { loadOfficeFonts(); }, []);
  if (!doc.content) return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-white text-slate-600">
    {doc.loading ? <><div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600" /><p className="text-sm font-semibold">Opening document…</p></>
      : <><p className="text-sm font-semibold">{doc.error || "That document couldn't be opened."}</p><button type="button" onClick={onBack} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Back to files</button></>}
  </div>;
  return <Writer doc={doc as DocHandle} id={id} onBack={onBack} onOpen={onOpen} />;
}

function Writer({ doc, id, onBack, onOpen }: { doc: DocHandle; id: string; onBack: () => void; onOpen?: (id: string) => void }) {
  const { token } = useAuth();
  const api = docsApi(token);
  const content = doc.content;
  const ed = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [zoomStr, setZoomStr] = useSavedChoice<string>("docs-zoom", "100");
  const zoom = Math.max(50, Math.min(200, Number(zoomStr) || 100)) / 100;
  const [outline, setOutline] = useSavedChoice<"on" | "off">("docs-outline", "off", ["on", "off"]);
  const [, setTick] = useState(0);
  const [toast, setToast] = useState("");
  const say = (m: string) => { setToast(m); window.setTimeout(() => setToast(""), 3000); };
  const [dialog, setDialog] = useState<null | "find" | "page" | "link" | "table" | "words" | "ai" | "versions" | "chars" | "shortcuts">(null);
  const [state, setState] = useState({ block: "p", font: "Arial", size: 11, b: false, i: false, u: false, s: false, align: "left", ul: false, ol: false, inTable: false });
  const [starred, setStarred] = useState(false);
  useEffect(() => { api.list("doc").then((all) => setStarred(!!all.find((d) => d.id === id)?.starred)).catch(() => {}); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // The page is edited directly; what's saved is read back from it a moment after typing.
  const loadedFor = useRef("");
  useEffect(() => {
    if (!ed.current || loadedFor.current === id) return;
    ed.current.innerHTML = content.html;
    loadedFor.current = id;
    try { document.execCommand("styleWithCSS", false, "true"); document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* old browser */ }
    setTick((t) => t + 1);
  }, [id, content.html]);
  const timer = useRef<number | null>(null);
  const flushHtml = useCallback(() => {
    if (!ed.current) return;
    const html = sanitizeHtml(ed.current.innerHTML);
    doc.setContent((c) => (c.html === html ? c : { ...c, html }));
  }, [doc]);
  const changed = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(flushHtml, 500); setTick((t) => t + 1); };
  useEffect(() => () => { if (timer.current) { window.clearTimeout(timer.current); flushHtml(); } }, [flushHtml]);
  /** Replaces the whole page (restore, import, AI) — undoable with Ctrl+Z through the browser. */
  const replaceAll = (html: string) => { if (!ed.current) return; ed.current.focus(); document.execCommand("selectAll"); document.execCommand("insertHTML", false, sanitizeHtml(html) || "<p><br></p>"); changed(); };

  // ─── Selection ───
  const saveSel = () => { const s = window.getSelection(); if (s && s.rangeCount && ed.current?.contains(s.anchorNode)) savedRange.current = s.getRangeAt(0).cloneRange(); };
  const restoreSel = () => { ed.current?.focus({ preventScroll: true }); const r = savedRange.current; if (r) { const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r); } };
  const exec = (cmd: string, value?: string) => { restoreSel(); document.execCommand(cmd, false, value); saveSel(); changed(); readState(); };
  const readState = () => {
    const s = window.getSelection();
    if (!s || !s.rangeCount || !ed.current?.contains(s.anchorNode)) return;
    const el = (s.anchorNode?.nodeType === 1 ? s.anchorNode as HTMLElement : s.anchorNode?.parentElement) as HTMLElement | null;
    if (!el) return;
    const block = el.closest("h1,h2,h3,h4,blockquote,pre,p,li");
    const cs = getComputedStyle(el);
    const q = (c: string) => { try { return document.queryCommandState(c); } catch { return false; } };
    setState({
      block: block ? (block.tagName === "LI" ? "p" : block.tagName.toLowerCase()) : "p",
      font: cs.fontFamily.split(",")[0].replace(/['"]/g, "").trim() || "Arial",
      size: Math.round(parseFloat(cs.fontSize) * 0.75),
      b: q("bold"), i: q("italic"), u: q("underline"), s: q("strikeThrough"),
      align: q("justifyCenter") ? "center" : q("justifyRight") ? "right" : q("justifyFull") ? "justify" : "left",
      ul: q("insertUnorderedList"), ol: q("insertOrderedList"), inTable: !!el.closest("td,th"),
    });
  };
  useEffect(() => {
    const on = () => { saveSel(); readState(); };
    document.addEventListener("selectionchange", on);
    return () => document.removeEventListener("selectionchange", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Formatting helpers ───
  const setBlock = (tag: string) => exec("formatBlock", tag === "p" ? "p" : tag);
  const fontSize = (pt: number) => {
    restoreSel();
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand("fontSize", false, "7");
    ed.current?.querySelectorAll('font[size="7"]').forEach((f) => { const span = document.createElement("span"); span.style.fontSize = `${pt}pt`; span.innerHTML = (f as HTMLElement).innerHTML; f.replaceWith(span); });
    document.execCommand("styleWithCSS", false, "true");
    saveSel(); changed(); readState();
  };
  const blocksInSelection = (): HTMLElement[] => {
    const s = window.getSelection(); if (!s || !s.rangeCount || !ed.current) return [];
    const r = s.getRangeAt(0);
    const all = Array.from(ed.current.querySelectorAll<HTMLElement>("p,h1,h2,h3,h4,li,blockquote,pre"));
    const hit = all.filter((b) => r.intersectsNode(b) && !b.querySelector("p,h1,h2,h3,h4,li"));
    if (hit.length) return hit;
    const el = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement) as HTMLElement;
    const b = el?.closest<HTMLElement>("p,h1,h2,h3,h4,li,blockquote,pre");
    return b ? [b] : [];
  };
  const lineSpacing = (lh: string) => { restoreSel(); blocksInSelection().forEach((b) => { b.style.lineHeight = lh; }); changed(); };
  const checklist = () => {
    restoreSel();
    const s = window.getSelection(); const el = s?.anchorNode ? ((s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement) as HTMLElement) : null;
    const ul = el?.closest("ul");
    if (ul && ul.hasAttribute("data-check")) { ul.removeAttribute("data-check"); ul.querySelectorAll("li").forEach((li) => li.removeAttribute("data-checked")); changed(); return; }
    if (!ul) document.execCommand("insertUnorderedList");
    const s2 = window.getSelection(); const el2 = s2?.anchorNode ? ((s2.anchorNode.nodeType === 1 ? s2.anchorNode : s2.anchorNode.parentElement) as HTMLElement) : null;
    const list = el2?.closest("ul");
    if (list) { list.setAttribute("data-check", ""); list.querySelectorAll(":scope > li").forEach((li) => li.setAttribute("data-checked", li.getAttribute("data-checked") || "false")); }
    changed();
  };
  const insertHtml = (html: string) => { restoreSel(); document.execCommand("insertHTML", false, html); saveSel(); changed(); };
  const insertImage = async () => {
    const f = await pickFile("image/*");
    if (!f) return;
    if (f.size > 15_000_000) { say("That picture is too big (15 MB max)."); return; }
    const url = await shrinkImage(f, 1400);
    insertHtml(`<img src="${url}" style="width: ${Math.min(560, 560)}px; max-width: 100%">`);
  };
  const insertTable = (rows: number, cols: number) => {
    const head = `<tr>${Array.from({ length: cols }, () => '<th style="border: 1px solid #94a3b8; background-color: #f1f5f9"><br></th>').join("")}</tr>`;
    const body = Array.from({ length: rows - 1 }, () => `<tr>${Array.from({ length: cols }, () => '<td style="border: 1px solid #94a3b8"><br></td>').join("")}</tr>`).join("");
    insertHtml(`<table style="border-collapse: collapse; width: 100%">${head}${body}</table><p><br></p>`);
  };
  const tableOp = (op: "rowAbove" | "rowBelow" | "colLeft" | "colRight" | "delRow" | "delCol" | "delTable") => {
    restoreSel();
    const s = window.getSelection(); const el = s?.anchorNode ? ((s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement) as HTMLElement) : null;
    const cell = el?.closest<HTMLTableCellElement>("td,th"); const row = cell?.parentElement as HTMLTableRowElement | null; const table = cell?.closest("table");
    if (!cell || !row || !table) { say("Put the cursor in a table first."); return; }
    const ci = cell.cellIndex;
    const blank = (tag = "td") => { const c = document.createElement(tag); c.setAttribute("style", "border: 1px solid #94a3b8"); c.innerHTML = "<br>"; return c; };
    if (op === "rowAbove" || op === "rowBelow") { const r = document.createElement("tr"); for (let i = 0; i < row.cells.length; i++) r.appendChild(blank()); row.parentElement!.insertBefore(r, op === "rowAbove" ? row : row.nextSibling); }
    if (op === "colLeft" || op === "colRight") Array.from(table.querySelectorAll("tr")).forEach((tr) => { const ref = (tr as HTMLTableRowElement).cells[ci]; const c = blank(ref?.tagName.toLowerCase() || "td"); if (ref?.tagName === "TH") c.setAttribute("style", "border: 1px solid #94a3b8; background-color: #f1f5f9"); tr.insertBefore(c, op === "colLeft" ? ref : ref?.nextSibling || null); });
    if (op === "delRow") { if (table.querySelectorAll("tr").length <= 1) table.remove(); else row.remove(); }
    if (op === "delCol") { const trs = Array.from(table.querySelectorAll("tr")); if (row.cells.length <= 1) table.remove(); else trs.forEach((tr) => (tr as HTMLTableRowElement).cells[ci]?.remove()); }
    if (op === "delTable") table.remove();
    changed();
  };

  // ─── Keyboard and typing shortcuts ───
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); saveSel(); setDialog("link"); return; }
    if (mod && e.key.toLowerCase() === "f") { e.preventDefault(); saveSel(); setDialog("find"); return; }
    if (mod && e.key.toLowerCase() === "h") { e.preventDefault(); saveSel(); setDialog("find"); return; }
    if (mod && e.key.toLowerCase() === "p") { e.preventDefault(); print(); return; }
    if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); flushHtml(); void doc.flush(); say("Saved."); return; }
    if (mod && e.altKey && /^[0-4]$/.test(e.key)) { e.preventDefault(); setBlock(e.key === "0" ? "p" : `h${e.key}`); return; }
    if (mod && e.shiftKey && (e.key === "7" || e.key === "&")) { e.preventDefault(); exec("insertOrderedList"); return; }
    if (mod && e.shiftKey && (e.key === "8" || e.key === "*")) { e.preventDefault(); exec("insertUnorderedList"); return; }
    if (mod && e.shiftKey && (e.key === "9" || e.key === "(")) { e.preventDefault(); checklist(); return; }
    if (mod && e.key === "\\") { e.preventDefault(); exec("removeFormat"); return; }
    if (mod && e.key === "Enter") { e.preventDefault(); insertHtml('<div data-page-break=""></div><p><br></p>'); return; }
    if (e.key === "Tab") {
      const s = window.getSelection(); const el = s?.anchorNode ? ((s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement) as HTMLElement) : null;
      if (el?.closest("li")) { e.preventDefault(); exec(e.shiftKey ? "outdent" : "indent"); return; }
      if (el?.closest("td,th")) {
        e.preventDefault();
        const cell = el.closest("td,th")!; const cells = Array.from(cell.closest("table")!.querySelectorAll("td,th")); const next = cells[cells.indexOf(cell) + (e.shiftKey ? -1 : 1)];
        if (next) { const r = document.createRange(); r.selectNodeContents(next); r.collapse(false); s!.removeAllRanges(); s!.addRange(r); } else if (!e.shiftKey) { tableOp("rowBelow"); }
        return;
      }
      e.preventDefault(); document.execCommand("insertText", false, " "); changed(); return;
    }
    if (e.key === " ") {
      // Markdown-style shortcuts at the start of a line: "# ", "## ", "- ", "1. ", "[] ", "> ".
      const s = window.getSelection();
      const node = s?.anchorNode;
      if (node && node.nodeType === 3 && s!.anchorOffset === (node.textContent || "").length) {
        const block = (node.parentElement as HTMLElement).closest("p,div");
        const t = (node.textContent || "");
        if (block && block.textContent === t) {
          const map: Record<string, () => void> = {
            "#": () => document.execCommand("formatBlock", false, "h1"), "##": () => document.execCommand("formatBlock", false, "h2"), "###": () => document.execCommand("formatBlock", false, "h3"),
            "-": () => document.execCommand("insertUnorderedList"), "*": () => document.execCommand("insertUnorderedList"), "1.": () => document.execCommand("insertOrderedList"),
            "[]": () => checklist(), ">": () => document.execCommand("formatBlock", false, "blockquote"),
          };
          const fn = map[t.trim()];
          if (fn && t === t.trim()) {
            e.preventDefault();
            const r = document.createRange(); r.setStart(node, 0); r.setEnd(node, t.length);
            s!.removeAllRanges(); s!.addRange(r); document.execCommand("delete");
            fn(); saveSel(); changed(); return;
          }
        }
      }
    }
  };
  const onPaste = (e: React.ClipboardEvent) => {
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    const file = (Array.from(e.clipboardData.files || []) as File[]).find((f) => f.type.startsWith("image/"));
    e.preventDefault();
    if (file) { void shrinkImage(file, 1400).then((url) => insertHtml(`<img src="${url}" style="width: 560px; max-width: 100%">`)); return; }
    if (html) { insertHtml(sanitizeHtml(html.replace(/<!--StartFragment-->|<!--EndFragment-->/g, ""))); return; }
    document.execCommand("insertText", false, text);
    changed();
  };
  const onClick = (e: React.MouseEvent) => {
    const li = (e.target as HTMLElement).closest("li");
    if (li && li.parentElement?.hasAttribute("data-check")) {
      const rect = li.getBoundingClientRect();
      if (e.clientX - rect.left < 22) { li.setAttribute("data-checked", li.getAttribute("data-checked") === "true" ? "false" : "true"); changed(); }
    }
    const a = (e.target as HTMLElement).closest("a");
    if (a && (e.ctrlKey || e.metaKey)) window.open(a.getAttribute("href") || "", "_blank", "noopener");
  };

  // ─── Files ───
  const html = () => sanitizeHtml(ed.current?.innerHTML || content.html);
  const now = (): DocContent => ({ ...content, html: html() });
  const print = () => {
    const w = window.open("", "_blank"); if (!w) { say("Allow pop-ups for Arise to print."); return; }
    w.document.open(); w.document.write(docPrintHtml(now(), doc.name, FONT_LINK)); w.document.close(); w.focus();
    window.setTimeout(() => { try { w.print(); } catch { /* still open */ } }, 600);
  };
  const download = (kind: "docx" | "html" | "txt" | "md") => {
    const name = safeName(doc.name || "Document");
    if (kind === "docx") downloadBlob(`${name}.docx`, writeDocx(now(), doc.name) as BlobPart, DOCX_MIME);
    if (kind === "html") downloadBlob(`${name}.html`, docPrintHtml(now(), doc.name), "text/html");
    if (kind === "txt") downloadBlob(`${name}.txt`, htmlText(html()), "text/plain");
    if (kind === "md") downloadBlob(`${name}.md`, toMarkdown(html()), "text/markdown");
  };
  const importInto = async () => {
    const f = await pickFile(".docx,.html,.htm,.txt,.md");
    if (!f) return;
    try { const c = await importDocFile(f); replaceAll(c.html); say(`Opened ${f.name}. Undo brings back what you had.`); }
    catch (e: any) { say(e.message || "That file couldn't be opened."); }
  };
  const newFile = async () => { try { const d = await api.create("doc", "Untitled document", blankDoc()); onOpen?.(d.id); } catch (e: any) { say(e.message); } };
  const copy = async () => { flushHtml(); try { const d = await api.create("doc", `Copy of ${doc.name}`, now()); onOpen?.(d.id); } catch (e: any) { say(e.message); } };
  const trash = async () => { if (!window.confirm(`Move "${doc.name}" to the trash? You can restore it for 30 days.`)) return; try { await api.trash(id); onBack(); } catch (e: any) { say(e.message); } };
  const setPage = (patch: Partial<DocContent>) => { flushHtml(); doc.setContent((c) => ({ ...c, ...patch })); };

  const stats = useMemo(() => wordCount(ed.current?.innerHTML || content.html), [content.html]); // eslint-disable-line react-hooks/exhaustive-deps
  const headings = useMemo(() => { const out: { level: number; text: string; i: number }[] = []; ed.current?.querySelectorAll("h1,h2,h3,h4").forEach((h, i) => out.push({ level: Number(h.tagName[1]), text: (h.textContent || "").trim() || "(untitled)", i })); return out; }, [content.html]); // eslint-disable-line react-hooks/exhaustive-deps
  const goHeading = (i: number) => { const h = ed.current?.querySelectorAll("h1,h2,h3,h4")[i] as HTMLElement | undefined; h?.scrollIntoView({ behavior: "smooth", block: "center" }); };

  const page = PAGE_PX[content.page.size];
  const pw = content.page.landscape ? page.h : page.w, ph = content.page.landscape ? page.w : page.h;
  const margin = content.page.margin * 96;
  const [height, setHeight] = useState(ph);
  useEffect(() => {
    const el = ed.current; if (!el) return;
    // The writing's own height (not the page box, which grows with the page count).
    const measure = () => { const last = el.lastElementChild as HTMLElement | null; setHeight(last ? last.offsetTop + last.offsetHeight : 0); };
    const ro = new ResizeObserver(measure); ro.observe(el); const mo = new MutationObserver(measure); mo.observe(el, { childList: true, subtree: true, characterData: true }); measure();
    return () => { ro.disconnect(); mo.disconnect(); };
  }, []);
  const pages = Math.max(1, Math.ceil((height + margin) / ph));

  const menus = [
    { label: "File", items: (): MenuItem[] => [
      { label: "New document", onClick: () => void newFile() }, { label: "Open…", onClick: onBack }, { label: "Make a copy", onClick: () => void copy() }, { sep: true },
      { label: "Open a Word or text file here…", onClick: () => void importInto() },
      { label: "Download", sub: [{ label: "Microsoft Word (.docx)", onClick: () => download("docx") }, { label: "PDF document (.pdf)", onClick: print }, { label: "Web page (.html)", onClick: () => download("html") }, { label: "Markdown (.md)", onClick: () => download("md") }, { label: "Plain text (.txt)", onClick: () => download("txt") }] },
      { sep: true }, { label: "Page setup", onClick: () => setDialog("page") }, { label: "Version history", onClick: () => setDialog("versions") }, { label: "Print", keys: "Ctrl+P", onClick: print }, { sep: true },
      { label: "Move to trash", danger: true, onClick: () => void trash() },
    ] },
    { label: "Edit", items: (): MenuItem[] => [
      { label: "Undo", keys: "Ctrl+Z", onClick: () => exec("undo") }, { label: "Redo", keys: "Ctrl+Y", onClick: () => exec("redo") }, { sep: true },
      { label: "Cut", keys: "Ctrl+X", onClick: () => exec("cut") }, { label: "Copy", keys: "Ctrl+C", onClick: () => exec("copy") }, { label: "Paste", keys: "Ctrl+V", hint: "use the keyboard", disabled: true },
      { label: "Select all", keys: "Ctrl+A", onClick: () => exec("selectAll") }, { sep: true }, { label: "Find and replace", keys: "Ctrl+H", onClick: () => { saveSel(); setDialog("find"); } },
    ] },
    { label: "View", items: (): MenuItem[] => [
      { label: "Show outline", checked: outline === "on", onClick: () => setOutline(outline === "on" ? "off" : "on") },
      { label: "Zoom", sub: [50, 75, 90, 100, 125, 150, 200].map((n): MenuItem => ({ label: `${n}%`, checked: Math.round(zoom * 100) === n, onClick: () => setZoomStr(String(n)) })) },
    ] },
    { label: "Insert", items: (): MenuItem[] => [
      { label: "Image", icon: <ImageIcon size={14} />, onClick: () => void insertImage() }, { label: "Table", icon: <TableIcon size={14} />, onClick: () => { saveSel(); setDialog("table"); } },
      { label: "Link", keys: "Ctrl+K", icon: <LinkIcon size={14} />, onClick: () => { saveSel(); setDialog("link"); } }, { sep: true },
      { label: "Horizontal line", onClick: () => insertHtml("<hr><p><br></p>") }, { label: "Page break", keys: "Ctrl+Enter", onClick: () => insertHtml('<div data-page-break=""></div><p><br></p>') },
      { label: "Checklist", icon: <CheckSquare size={14} />, onClick: checklist }, { label: "Today's date", onClick: () => insertHtml(new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })) },
      { label: "Special characters", onClick: () => { saveSel(); setDialog("chars"); } }, { label: "Table of contents", onClick: () => insertHtml(tocHtml(ed.current)) }, { sep: true },
      { label: "Header and footer", onClick: () => setDialog("page") },
    ] },
    { label: "Format", items: (): MenuItem[] => [
      { label: "Text", sub: [{ label: "Bold", keys: "Ctrl+B", onClick: () => exec("bold") }, { label: "Italic", keys: "Ctrl+I", onClick: () => exec("italic") }, { label: "Underline", keys: "Ctrl+U", onClick: () => exec("underline") }, { label: "Strikethrough", onClick: () => exec("strikeThrough") }, { label: "Superscript", onClick: () => exec("superscript") }, { label: "Subscript", onClick: () => exec("subscript") }] },
      { label: "Paragraph styles", sub: STYLES.map((s): MenuItem => ({ label: s.label, checked: state.block === s.tag, onClick: () => setBlock(s.tag) })) },
      { label: "Align", sub: [["left", "Left", "justifyLeft"], ["center", "Center", "justifyCenter"], ["right", "Right", "justifyRight"], ["justify", "Justified", "justifyFull"]].map(([k, l, c]): MenuItem => ({ label: l, checked: state.align === k, onClick: () => exec(c) })) },
      { label: "Line spacing", sub: [["1", "Single"], ["1.15", "1.15"], ["1.5", "1.5"], ["2", "Double"]].map(([v, l]): MenuItem => ({ label: l, onClick: () => lineSpacing(v) })) },
      { label: "Bullets and numbering", sub: [{ label: "Bulleted list", onClick: () => exec("insertUnorderedList") }, { label: "Numbered list", onClick: () => exec("insertOrderedList") }, { label: "Checklist", onClick: checklist }] },
      { label: "Table", disabled: !state.inTable, sub: [{ label: "Insert row above", onClick: () => tableOp("rowAbove") }, { label: "Insert row below", onClick: () => tableOp("rowBelow") }, { label: "Insert column left", onClick: () => tableOp("colLeft") }, { label: "Insert column right", onClick: () => tableOp("colRight") }, { sep: true }, { label: "Delete row", onClick: () => tableOp("delRow") }, { label: "Delete column", onClick: () => tableOp("delCol") }, { label: "Delete table", danger: true, onClick: () => tableOp("delTable") }] },
      { sep: true }, { label: "Clear formatting", keys: "Ctrl+\\", onClick: () => exec("removeFormat") },
    ] },
    { label: "Tools", items: (): MenuItem[] => [
      { label: "AI writing helper", icon: <Sparkles size={14} />, onClick: () => { saveSel(); setDialog("ai"); } }, { label: "Word count", onClick: () => setDialog("words") }, { label: "Keyboard shortcuts", onClick: () => setDialog("shortcuts") },
    ] },
  ];

  return <div className="flex h-[calc(100dvh-8rem)] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm" data-testid="docs-editor">
    <div className="flex items-start gap-2 px-2 pt-2 sm:px-3">
      <button type="button" onClick={async () => { flushHtml(); await doc.flush(); onBack(); }} aria-label="Back to files" title="Back to files" className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"><ArrowLeft size={18} /></button>
      <span className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white sm:inline-flex"><FileText size={18} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <input value={doc.name} onChange={(e) => doc.setName(e.target.value)} aria-label="Document name" data-testid="docs-name" className="min-w-0 max-w-[60vw] rounded-md border border-transparent px-1.5 py-0.5 text-[17px] font-semibold text-slate-900 hover:border-slate-300 focus:border-sky-500 focus:outline-none sm:max-w-md" />
          <button type="button" onClick={() => { const n = !starred; setStarred(n); void api.save(id, { starred: n }).catch(() => setStarred(!n)); }} aria-label={starred ? "Unstar" : "Star"} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"><Star size={15} className={starred ? "fill-amber-400 text-amber-500" : ""} /></button>
          <span className={`hidden truncate text-xs sm:inline ${doc.state === "error" || doc.state === "conflict" ? "font-bold text-rose-600" : "text-slate-500"}`}>{saveLabel(doc.state)}</span>
        </div>
        <MenuBar menus={menus} />
      </div>
    </div>
    {doc.state === "conflict" && <div className="mx-3 mt-1 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">This document was changed on another device.
      <button type="button" onClick={doc.keepMine} className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-bold text-white">Keep what's here</button>
      <button type="button" onClick={async () => { await doc.reload(); loadedFor.current = ""; setTick((t) => t + 1); }} className="rounded-md bg-white px-2.5 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-300">Load the other copy</button></div>}

    {/* Toolbar */}
    <div className="px-2 pb-1.5 pt-1 sm:px-3">
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-full bg-slate-100/80 px-2 py-1" data-testid="docs-toolbar" onMouseDown={(e) => { if ((e.target as HTMLElement).closest("button")) e.preventDefault(); }}>
        <Tool title="Undo" keys="Ctrl+Z" onClick={() => exec("undo")}><Undo2 size={16} /></Tool>
        <Tool title="Redo" keys="Ctrl+Y" onClick={() => exec("redo")}><Redo2 size={16} /></Tool>
        <Tool title="Print" keys="Ctrl+P" onClick={print}><Printer size={16} /></Tool>
        <DropButton title="Zoom" label={<span className="text-[12px]">{Math.round(zoom * 100)}%</span>}>{(close) => <MenuList items={[50, 75, 90, 100, 125, 150, 200].map((n) => ({ label: `${n}%`, onClick: () => setZoomStr(String(n)) }))} onDone={close} />}</DropButton>
        <ToolSep />
        <DropButton title="Styles" testId="docs-style" label={<span className="w-[92px] truncate text-left text-[12px]">{STYLES.find((s) => s.tag === state.block)?.label || "Normal text"}</span>}>{(close) => <div className="w-64 py-1">{STYLES.map((s) => <button key={s.tag} type="button" onClick={() => { setBlock(s.tag); close(); }} className={`block w-full px-3 py-1.5 text-left hover:bg-slate-100 ${s.cls} ${state.block === s.tag ? "bg-sky-50" : ""}`}>{s.label}</button>)}</div>}</DropButton>
        <ToolSep />
        <DropButton title="Font" label={<span className="w-[84px] truncate text-left text-[12px]" style={{ fontFamily: state.font }}>{state.font}</span>}>{(close) => <MenuList items={DOC_FONTS.map((f) => ({ label: f, checked: state.font === f, icon: <span style={{ fontFamily: f }}>A</span>, onClick: () => exec("fontName", f) }))} onDone={close} />}</DropButton>
        <ToolSep />
        <Tool title="Smaller" onClick={() => fontSize(SIZES[Math.max(0, SIZES.findIndex((s) => s >= state.size) - 1)])}><span className="text-base leading-none">−</span></Tool>
        <DropButton title="Font size" label={<span className="w-6 text-center text-[12px]">{state.size}</span>}>{(close) => <MenuList items={SIZES.map((s) => ({ label: String(s), checked: state.size === s, onClick: () => fontSize(s) }))} onDone={close} />}</DropButton>
        <Tool title="Bigger" onClick={() => fontSize(SIZES[Math.min(SIZES.length - 1, SIZES.findIndex((s) => s > state.size))] || 72)}><span className="text-base leading-none">+</span></Tool>
        <ToolSep />
        <Tool title="Bold" keys="Ctrl+B" active={state.b} onClick={() => exec("bold")} testId="docs-bold"><Bold size={16} /></Tool>
        <Tool title="Italic" keys="Ctrl+I" active={state.i} onClick={() => exec("italic")}><Italic size={16} /></Tool>
        <Tool title="Underline" keys="Ctrl+U" active={state.u} onClick={() => exec("underline")}><Underline size={16} /></Tool>
        <Tool title="Strikethrough" active={state.s} onClick={() => exec("strikeThrough")}><Strikethrough size={16} /></Tool>
        <DropButton title="Text colour" label={<Baseline size={15} />}>{(close) => <ColorGrid onPick={(c) => { exec("foreColor", c || "#111827"); close(); }} />}</DropButton>
        <DropButton title="Highlight" label={<Highlighter size={15} />}>{(close) => <ColorGrid resetLabel="None" onPick={(c) => { exec("hiliteColor", c || "transparent"); close(); }} />}</DropButton>
        <ToolSep />
        <Tool title="Insert link" keys="Ctrl+K" onClick={() => { saveSel(); setDialog("link"); }}><LinkIcon size={15} /></Tool>
        <Tool title="Insert image" onClick={() => void insertImage()}><ImageIcon size={15} /></Tool>
        <Tool title="Insert table" onClick={() => { saveSel(); setDialog("table"); }}><TableIcon size={15} /></Tool>
        <ToolSep />
        <DropButton title="Align" label={state.align === "center" ? <AlignCenter size={15} /> : state.align === "right" ? <AlignRight size={15} /> : state.align === "justify" ? <AlignJustify size={15} /> : <AlignLeft size={15} />}>{(close) => <div className="flex gap-1 p-2">{([["justifyLeft", <AlignLeft key="l" size={16} />], ["justifyCenter", <AlignCenter key="c" size={16} />], ["justifyRight", <AlignRight key="r" size={16} />], ["justifyFull", <AlignJustify key="j" size={16} />]] as const).map(([c, icon]) => <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { exec(c); close(); }} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100">{icon}</button>)}</div>}</DropButton>
        <DropButton title="Line spacing" label={<span className="text-[12px] font-bold">↕</span>}>{(close) => <MenuList items={[["1", "Single"], ["1.15", "1.15"], ["1.5", "1.5"], ["2", "Double"]].map(([v, l]) => ({ label: l, onClick: () => lineSpacing(v) }))} onDone={close} />}</DropButton>
        <Tool title="Checklist" onClick={checklist}><CheckSquare size={15} /></Tool>
        <Tool title="Bulleted list" active={state.ul} onClick={() => exec("insertUnorderedList")}><List size={16} /></Tool>
        <Tool title="Numbered list" active={state.ol} onClick={() => exec("insertOrderedList")}><ListOrdered size={16} /></Tool>
        <Tool title="Decrease indent" onClick={() => exec("outdent")}><Outdent size={15} /></Tool>
        <Tool title="Increase indent" onClick={() => exec("indent")}><Indent size={15} /></Tool>
        <Tool title="Clear formatting" keys="Ctrl+\" onClick={() => exec("removeFormat")}><RemoveFormatting size={15} /></Tool>
        <ToolSep />
        <Tool title="Outline" active={outline === "on"} onClick={() => setOutline(outline === "on" ? "off" : "on")}><PanelLeft size={15} /></Tool>
        <Tool title="AI writing helper" onClick={() => { saveSel(); setDialog("ai"); }}><span className="inline-flex items-center gap-1 text-[12px] font-bold text-violet-700"><Sparkles size={14} />AI</span></Tool>
      </div>
      {state.inTable && <div className="mt-1 flex flex-wrap items-center gap-1 text-[12px]" onMouseDown={(e) => e.preventDefault()}>
        <span className="font-bold text-slate-500">Table:</span>
        {([["rowAbove", "+ Row above"], ["rowBelow", "+ Row below"], ["colLeft", "+ Column left"], ["colRight", "+ Column right"], ["delRow", "Delete row"], ["delCol", "Delete column"], ["delTable", "Delete table"]] as const).map(([op, l]) => <button key={op} type="button" onClick={() => tableOp(op)} className={`rounded-md px-2 py-0.5 ring-1 ring-slate-200 hover:bg-slate-50 ${op.startsWith("del") ? "text-rose-600" : "text-slate-700"}`}>{l}</button>)}
      </div>}
    </div>

    {/* Page */}
    <div className="flex min-h-0 flex-1 border-t border-slate-200">
      {outline === "on" && <aside className="hidden w-56 shrink-0 overflow-auto border-r border-slate-200 bg-white p-3 text-sm md:block" data-testid="docs-outline">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Outline</p>
        {headings.length === 0 ? <p className="text-xs text-slate-500">Headings you add appear here.</p> : headings.map((h) => <button key={h.i} type="button" onClick={() => goHeading(h.i)} className="block w-full truncate rounded px-1.5 py-1 text-left hover:bg-slate-100" style={{ paddingLeft: 6 + (h.level - 1) * 12, fontWeight: h.level === 1 ? 700 : 400 }}>{h.text}</button>)}
      </aside>}
      <div className="relative min-w-0 flex-1 overflow-auto bg-[#eef1f5] py-6" data-testid="docs-scroller">
        <div className="mx-auto" style={{ width: pw * zoom }}>
          <div className="relative origin-top-left bg-white shadow-[0_1px_3px_rgba(0,0,0,.15),0_8px_24px_rgba(0,0,0,.06)]" style={{ width: pw, minHeight: ph * pages, transform: `scale(${zoom})`, marginBottom: (zoom - 1) * ph * pages }}>
            {Array.from({ length: pages - 1 }, (_, i) => <div key={i} className="pointer-events-none absolute inset-x-0 border-t-[10px] border-[#eef1f5]" style={{ top: ph * (i + 1) - 5 }}><span className="absolute right-2 top-0.5 text-[10px] text-slate-400">Page {i + 2}</span></div>)}
            {content.header && <div className="absolute inset-x-0 top-0 px-[1in] pt-6 text-[11px] text-slate-500" style={{ paddingLeft: margin, paddingRight: margin }} dangerouslySetInnerHTML={{ __html: content.header }} />}
            <div ref={ed} contentEditable suppressContentEditableWarning spellCheck data-testid="docs-page" role="textbox" aria-multiline="true" aria-label="Document"
              onInput={changed} onKeyDown={onKeyDown} onPaste={onPaste} onClick={onClick} onBlur={() => { saveSel(); flushHtml(); }} onKeyUp={readState} onMouseUp={readState}
              className="arise-doc min-h-full text-[11pt] leading-[1.5] text-slate-900 outline-none" style={{ padding: margin, minHeight: ph * pages, fontFamily: "Arial, sans-serif" }} />
            {(content.footer || content.pageNumbers) && <div className="pointer-events-none absolute inset-x-0 text-[11px] text-slate-500" style={{ top: ph * pages - 40, paddingLeft: margin, paddingRight: margin }}><span dangerouslySetInnerHTML={{ __html: content.footer }} />{content.pageNumbers && <span className="float-right">Page {pages} of {pages}</span>}</div>}
          </div>
        </div>
      </div>
    </div>
    <div className="flex items-center gap-3 border-t border-slate-200 bg-slate-50 px-3 py-1 text-[12px] text-slate-600">
      <button type="button" onClick={() => setDialog("words")} className="font-semibold hover:text-slate-900" data-testid="docs-words">{stats.words.toLocaleString()} words</button>
      <span>{pages} page{pages === 1 ? "" : "s"}</span>
      <span className="ml-auto truncate sm:hidden">{saveLabel(doc.state)}</span>
    </div>
    <style>{DOC_CSS}</style>

    {dialog === "find" && <FindReplace root={ed.current} onClose={() => setDialog(null)} onChange={changed} say={say} />}
    {dialog === "link" && <LinkDlg onClose={() => setDialog(null)} restore={restoreSel} onDone={changed} />}
    {dialog === "table" && <Dialog title="Insert table" onClose={() => setDialog(null)}><TablePicker onPick={(r, c) => { setDialog(null); insertTable(r, c); }} /></Dialog>}
    {dialog === "words" && <Dialog title="Word count" onClose={() => setDialog(null)}><dl className="grid grid-cols-2 gap-y-2">{[["Pages", pages], ["Words", stats.words], ["Characters", stats.chars], ["Characters without spaces", stats.charsNoSpaces], ["Paragraphs", stats.paragraphs], ["Reading time", `${stats.minutes} min`]].flatMap(([k, v]) => [<dt key={`k${k}`} className="text-slate-600">{k}</dt>, <dd key={`v${k}`} className="text-right font-bold">{typeof v === "number" ? v.toLocaleString() : v}</dd>])}</dl></Dialog>}
    {dialog === "page" && <PageSetup content={content} onClose={() => setDialog(null)} onSave={(p) => { setPage(p); setDialog(null); }} />}
    {dialog === "chars" && <Dialog title="Special characters" onClose={() => setDialog(null)}><div className="grid grid-cols-10 gap-1">{"©®™°±×÷≠≤≥≈∞√π∑µ½¼¾²³€£¥¢§¶•…–—«»‹›“”‘’←→↑↓↔⇒✓✗★☆♥♦♣♠☐☑☺✉☎✏✂⚠".split("").map((ch) => <button key={ch} type="button" onClick={() => { setDialog(null); insertHtml(ch); }} className="h-9 rounded-md text-lg hover:bg-slate-100">{ch}</button>)}</div></Dialog>}
    {dialog === "ai" && <AiWriter token={token} getSelection={() => { restoreSel(); return window.getSelection()?.toString() || ""; }} fullText={() => htmlText(html())} onInsert={(h, replace) => { setDialog(null); restoreSel(); if (replace === "all") replaceAll(h); else insertHtml(h); say("Added by the AI helper. Undo removes it."); }} onClose={() => setDialog(null)} />}
    {dialog === "versions" && <Versions token={token} id={id} onClose={() => setDialog(null)} onRestore={(c) => { setDialog(null); replaceAll(c.html); setPage({ page: c.page, header: c.header, footer: c.footer, pageNumbers: c.pageNumbers }); say("Restored. Undo brings back what you had."); }} />}
    {dialog === "shortcuts" && <Dialog title="Keyboard shortcuts" onClose={() => setDialog(null)} wide><div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">{[["Ctrl + B / I / U", "Bold, italic, underline"], ["Ctrl + Alt + 1–4", "Heading 1–4"], ["Ctrl + Alt + 0", "Normal text"], ["Ctrl + Shift + 7 / 8 / 9", "Numbered list / bullets / checklist"], ["Tab / Shift + Tab", "Indent list item, next table cell"], ["Ctrl + K", "Link"], ["Ctrl + Enter", "Page break"], ["Ctrl + F / H", "Find / replace"], ["Ctrl + \\", "Clear formatting"], ["Ctrl + P", "Print or PDF"], ["# + space", "Heading 1 (## for 2)"], ["- + space", "Bulleted list"], ["1. + space", "Numbered list"], ["[] + space", "Checklist"], ["> + space", "Quote"]].map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-slate-100 py-1"><span>{v}</span><kbd className="rounded bg-slate-100 px-1.5 font-mono text-xs">{k}</kbd></div>)}</div></Dialog>}
    {toast && <div role="status" className="pointer-events-none fixed bottom-6 left-1/2 z-[1100] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xl">{toast}</div>}
  </div>;
}

const DOC_CSS = `
.arise-doc h1 { font-size: 20pt; font-weight: 700; margin: 0.5em 0 0.25em; line-height: 1.25; }
.arise-doc h2 { font-size: 16pt; font-weight: 700; margin: 0.6em 0 0.25em; line-height: 1.3; }
.arise-doc h3 { font-size: 13.5pt; font-weight: 700; margin: 0.5em 0 0.2em; }
.arise-doc h4 { font-size: 12pt; font-weight: 700; margin: 0.4em 0 0.2em; }
.arise-doc p { margin: 0 0 0.45em; }
.arise-doc ul { list-style: disc; padding-left: 1.6em; margin: 0 0 0.5em; } .arise-doc ul ul { list-style: circle; } .arise-doc ol { list-style: decimal; padding-left: 1.6em; margin: 0 0 0.5em; } .arise-doc ol ol { list-style: lower-alpha; }
.arise-doc ul[data-check] { list-style: none; padding-left: 0.4em; }
.arise-doc ul[data-check] > li { position: relative; padding-left: 1.6em; }
.arise-doc ul[data-check] > li::before { content: ""; position: absolute; left: 0; top: 0.25em; width: 1em; height: 1em; border: 2px solid #64748b; border-radius: 3px; cursor: pointer; }
.arise-doc ul[data-check] > li[data-checked="true"] { color: #94a3b8; text-decoration: line-through; }
.arise-doc ul[data-check] > li[data-checked="true"]::before { background: #2563eb; border-color: #2563eb; content: "✓"; color: #fff; font-size: 0.75em; line-height: 1.1em; text-align: center; text-decoration: none; }
.arise-doc blockquote { border-left: 4px solid #cbd5e1; padding-left: 12px; color: #475569; font-style: italic; margin: 0.5em 0; }
.arise-doc pre { background: #f1f5f9; padding: 8px 10px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 10pt; white-space: pre-wrap; }
.arise-doc table { border-collapse: collapse; width: 100%; margin: 0.4em 0; } .arise-doc td, .arise-doc th { border: 1px solid #94a3b8; padding: 4px 6px; vertical-align: top; min-width: 40px; } .arise-doc th { background: #f1f5f9; text-align: left; }
.arise-doc a { color: #1d4ed8; text-decoration: underline; }
.arise-doc img { max-width: 100%; height: auto; border-radius: 2px; }
.arise-doc hr { border: 0; border-top: 1px solid #cbd5e1; margin: 0.8em 0; }
.arise-doc [data-page-break] { border-top: 2px dashed #cbd5e1; margin: 16px 0; height: 0; position: relative; }
.arise-doc [data-page-break]::after { content: "Page break"; position: absolute; right: 0; top: -9px; font-size: 10px; color: #94a3b8; background: #fff; padding: 0 4px; }
`;

function shrinkImage(f: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL(f.type === "image/png" ? "image/png" : "image/jpeg", 0.86));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That picture couldn't be opened.")); };
    img.src = url;
  });
}

export async function importDocFile(f: File): Promise<DocContent> {
  if (/\.docx$/i.test(f.name)) return readDocx(await f.arrayBuffer());
  if (/\.doc$/i.test(f.name)) throw new Error("Old .doc files can't be opened. In Word, use Save As → .docx, then open that.");
  const text = await f.text();
  if (/\.html?$/i.test(f.name)) { const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(text)?.[1] ?? text; return blankDoc(sanitizeHtml(body) || "<p><br></p>"); }
  if (/\.md$/i.test(f.name)) return blankDoc(fromMarkdown(text));
  return blankDoc(text.split(/\r?\n/).map((l) => `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;") || "<br>"}</p>`).join(""));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function mdInline(s: string) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/`(.+?)`/g, "<code>$1</code>").replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>'); }
function fromMarkdown(md: string): string {
  const out: string[] = []; let list: string | null = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const line of md.split(/\r?\n/)) {
    let m;
    if ((m = /^(#{1,4})\s+(.*)/.exec(line))) { close(); out.push(`<h${m[1].length}>${mdInline(m[2])}</h${m[1].length}>`); }
    else if ((m = /^\s*[-*]\s+\[( |x)\]\s+(.*)/i.exec(line))) { if (list !== "ul data-check") { close(); out.push('<ul data-check="">'); list = "ul data-check"; } out.push(`<li data-checked="${m[1] !== " "}">${mdInline(m[2])}</li>`); }
    else if ((m = /^\s*[-*]\s+(.*)/.exec(line))) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push(`<li>${mdInline(m[1])}</li>`); }
    else if ((m = /^\s*\d+\.\s+(.*)/.exec(line))) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; } out.push(`<li>${mdInline(m[1])}</li>`); }
    else if ((m = /^>\s?(.*)/.exec(line))) { close(); out.push(`<blockquote>${mdInline(m[1])}</blockquote>`); }
    else if (/^---+$/.test(line.trim())) { close(); out.push("<hr>"); }
    else { close(); out.push(line.trim() ? `<p>${mdInline(line)}</p>` : ""); }
  }
  close();
  return sanitizeHtml(out.join("").replace(/<ul data-check>/g, '<ul data-check="">').replace(/<\/ul data-check>/g, "</ul>")) || "<p><br></p>";
}
function toMarkdown(html: string): string {
  return html
    .replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, n, t) => `\n${"#".repeat(Number(n))} ${t}\n`)
    .replace(/<li data-checked="true"[^>]*>([\s\S]*?)<\/li>/gi, "- [x] $1\n").replace(/<li data-checked="false"[^>]*>([\s\S]*?)<\/li>/gi, "- [ ] $1\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n").replace(/<\/?(ul|ol)[^>]*>/gi, "\n")
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**").replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "*$2*")
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)").replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, "> $1\n")
    .replace(/<hr[^>]*>/gi, "\n---\n").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
function tocHtml(root: HTMLElement | null): string {
  const hs = Array.from(root?.querySelectorAll("h1,h2,h3") || []);
  if (!hs.length) return "<p><em>Add headings, then insert the table of contents again.</em></p>";
  return `<h2>Contents</h2><ul>${hs.map((h) => `<li style="margin-left: ${(Number(h.tagName[1]) - 1) * 18}px">${esc(h.textContent || "")}</li>`).join("")}</ul><p><br></p>`;
}

// ─── Dialogs ───
function FindReplace({ root, onClose, onChange, say }: { root: HTMLElement | null; onClose: () => void; onChange: () => void; say: (m: string) => void }) {
  const [q, setQ] = useState(""); const [rep, setRep] = useState(""); const [matchCase, setMatchCase] = useState(false);
  const [i, setI] = useState(-1);
  const hits = useMemo(() => {
    if (!root || !q) return [] as { node: Text; at: number }[];
    const out: { node: Text; at: number }[] = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const needle = matchCase ? q : q.toLowerCase();
    let n: Node | null;
    while ((n = w.nextNode())) { const t = matchCase ? n.textContent || "" : (n.textContent || "").toLowerCase(); let at = t.indexOf(needle); while (at >= 0) { out.push({ node: n as Text, at }); at = t.indexOf(needle, at + needle.length); } }
    return out;
  }, [root, q, matchCase, i]); // eslint-disable-line react-hooks/exhaustive-deps
  const show = (k: number) => { const h = hits[k]; if (!h) return; const r = document.createRange(); r.setStart(h.node, h.at); r.setEnd(h.node, h.at + q.length); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r); (h.node.parentElement as HTMLElement)?.scrollIntoView({ block: "center", behavior: "smooth" }); };
  const next = (d: 1 | -1) => { if (!hits.length) { say(`No matches for "${q}".`); return; } const k = (i + d + hits.length) % hits.length; setI(k); show(k); };
  const replaceOne = () => { const h = hits[i]; if (!h) { next(1); return; } const t = h.node.textContent || ""; h.node.textContent = t.slice(0, h.at) + rep + t.slice(h.at + q.length); onChange(); setI(i - 1); };
  const replaceEvery = () => { let n = 0; for (const h of [...hits].reverse()) { const t = h.node.textContent || ""; h.node.textContent = t.slice(0, h.at) + rep + t.slice(h.at + q.length); n++; } onChange(); say(`Replaced ${n}.`); setI(-1); };
  return <Dialog title="Find and replace" onClose={onClose} footer={<><button type="button" className={btnGhost} onClick={replaceOne} disabled={!q}>Replace</button><button type="button" className={btnGhost} onClick={replaceEvery} disabled={!q}>Replace all</button><button type="button" className={btnGhost} onClick={() => next(-1)} disabled={!q}>Previous</button><button type="button" className={btnPrimary} onClick={() => next(1)} disabled={!q}>Next</button></>}>
    <div className="space-y-3">
      <Label text="Find"><input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setI(-1); }} onKeyDown={(e) => { if (e.key === "Enter") next(e.shiftKey ? -1 : 1); }} className={field} /></Label>
      <Label text="Replace with"><input value={rep} onChange={(e) => setRep(e.target.value)} className={field} /></Label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} />Match case</label>
      {q && <p className="text-xs font-semibold text-slate-500">{hits.length ? `${i >= 0 ? `${i + 1} of ` : ""}${hits.length} found` : "No matches"}</p>}
    </div>
  </Dialog>;
}

function LinkDlg({ onClose, restore, onDone }: { onClose: () => void; restore: () => void; onDone: () => void }) {
  const [url, setUrl] = useState(""); const [text, setText] = useState(() => window.getSelection()?.toString() || "");
  const go = () => {
    const href = /^(https?:|mailto:|tel:)/i.test(url) ? url : `https://${url}`;
    restore();
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString() === text) document.execCommand("createLink", false, href);
    else document.execCommand("insertHTML", false, `<a href="${href.replace(/"/g, "&quot;")}">${esc(text || url)}</a>`);
    onDone(); onClose();
  };
  return <Dialog title="Link" onClose={onClose} footer={<><button type="button" className={btnGhost} onClick={() => { restore(); document.execCommand("unlink"); onDone(); onClose(); }}>Remove link</button><button type="button" className={btnPrimary} onClick={go} disabled={!url}>Apply</button></>}>
    <div className="space-y-3"><Label text="Text"><input value={text} onChange={(e) => setText(e.target.value)} className={field} /></Label><Label text="Link"><input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && url) go(); }} placeholder="https://" className={field} /></Label></div>
  </Dialog>;
}

function TablePicker({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const [hover, setHover] = useState({ r: 3, c: 3 });
  return <div><p className="mb-2 font-bold">{hover.r} × {hover.c}</p>
    <div className="inline-grid gap-1" style={{ gridTemplateColumns: "repeat(10, 22px)" }} onMouseLeave={() => setHover({ r: 3, c: 3 })}>
      {Array.from({ length: 100 }, (_, k) => { const r = Math.floor(k / 10) + 1, c = (k % 10) + 1; return <button key={k} type="button" aria-label={`${r} by ${c}`} onMouseEnter={() => setHover({ r, c })} onClick={() => onPick(r, c)} className={`h-[22px] w-[22px] rounded-sm border ${r <= hover.r && c <= hover.c ? "border-sky-500 bg-sky-100" : "border-slate-300 bg-white"}`} />; })}
    </div>
    <p className="mt-2 text-xs text-slate-500">The first row is a header row. Tab moves to the next cell (and adds a row at the end).</p>
  </div>;
}

function PageSetup({ content, onClose, onSave }: { content: DocContent; onClose: () => void; onSave: (p: Partial<DocContent>) => void }) {
  const [page, setPage] = useState(content.page);
  const [header, setHeader] = useState(htmlText(content.header));
  const [footer, setFooter] = useState(htmlText(content.footer));
  const [nums, setNums] = useState(content.pageNumbers);
  const wrap = (t: string) => (t.trim() ? `<p>${esc(t.trim())}</p>` : "");
  return <Dialog title="Page setup" onClose={onClose} footer={<><button type="button" className={btnGhost} onClick={onClose}>Cancel</button><button type="button" className={btnPrimary} onClick={() => onSave({ page, header: wrap(header), footer: wrap(footer), pageNumbers: nums })}>OK</button></>}>
    <div className="space-y-3">
      <Label text="Paper size"><select value={page.size} onChange={(e) => setPage({ ...page, size: e.target.value as DocContent["page"]["size"] })} className={field}>{Object.entries(PAGE_PX).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Label>
      <Label text="Orientation"><select value={page.landscape ? "l" : "p"} onChange={(e) => setPage({ ...page, landscape: e.target.value === "l" })} className={field}><option value="p">Portrait</option><option value="l">Landscape</option></select></Label>
      <Label text="Margins"><select value={page.margin} onChange={(e) => setPage({ ...page, margin: Number(e.target.value) })} className={field}>{[0.5, 0.75, 1, 1.25, 1.5].map((m) => <option key={m} value={m}>{m} inch{m === 1 ? "" : "es"}</option>)}</select></Label>
      <Label text="Header"><input value={header} onChange={(e) => setHeader(e.target.value)} placeholder="Shown at the top of every page" className={field} /></Label>
      <Label text="Footer"><input value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Shown at the bottom of every page" className={field} /></Label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={nums} onChange={(e) => setNums(e.target.checked)} />Page numbers</label>
    </div>
  </Dialog>;
}

const AI_ACTIONS: { id: string; label: string; needsText: boolean; prompt?: boolean }[] = [
  { id: "write", label: "Write something new", needsText: false, prompt: true }, { id: "continue writing", label: "Keep writing from here", needsText: true },
  { id: "improve the writing of", label: "Improve the writing", needsText: true }, { id: "fix spelling and grammar in", label: "Fix spelling and grammar", needsText: true },
  { id: "shorten", label: "Make it shorter", needsText: true }, { id: "expand with more detail", label: "Make it longer", needsText: true },
  { id: "summarize", label: "Summarize", needsText: true }, { id: "rewrite at a 3rd-grade reading level", label: "Simplify for kids", needsText: true },
  { id: "translate to Spanish", label: "Translate to Spanish", needsText: true }, { id: "turn into bullet points", label: "Turn into bullet points", needsText: true },
];
function AiWriter({ token, getSelection, fullText, onInsert, onClose }: { token: string | null; getSelection: () => string; fullText: () => string; onInsert: (html: string, mode: "insert" | "all") => void; onClose: () => void }) {
  const [sel] = useState(getSelection);
  const [action, setAction] = useState(sel ? "improve the writing of" : "write");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("clear and friendly");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(""); const [err, setErr] = useState("");
  const a = AI_ACTIONS.find((x) => x.id === action)!;
  const run = async () => {
    setBusy(true); setErr(""); setRes("");
    try {
      const text = a.needsText ? (sel || fullText()).slice(0, 12000) : "";
      const r = await askAppAi<{ html: string }>(token, "doc-write", { action: a.id, tone, topic: a.prompt ? topic : `the text below${topic ? ` (${topic})` : ""}`, text });
      const h = sanitizeHtml(r?.html || "");
      if (!h) throw new Error("Nothing came back. Try again.");
      setRes(h);
    } catch (e: any) { setErr(e.message || "The AI helper couldn't answer. Try again."); } finally { setBusy(false); }
  };
  return <Dialog title="AI writing helper" onClose={onClose} wide footer={<>{res && <><button type="button" className={btnGhost} onClick={() => onInsert(res, "insert")}>{sel ? "Replace selection" : "Insert at cursor"}</button></>}<button type="button" className={res ? btnGhost : btnPrimary} onClick={() => void run()} disabled={busy || (a.prompt && !topic.trim())}><Sparkles size={14} />{busy ? "Writing…" : res ? "Try again" : "Go"}</button></>}>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
      <div className="space-y-3">
        <div className="space-y-1">{AI_ACTIONS.map((x) => <button key={x.id} type="button" disabled={x.needsText && !sel && x.id !== "summarize" && x.id !== "continue writing"} onClick={() => setAction(x.id)} className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm disabled:opacity-40 ${action === x.id ? "bg-violet-100 font-bold text-violet-900" : "hover:bg-slate-50"}`}>{x.label}</button>)}</div>
        {!sel && <p className="text-xs text-slate-500">Select some text first to rewrite just that part.</p>}
      </div>
      <div className="space-y-3">
        <Label text={a.prompt ? "What should it write?" : "Anything else? (optional)"}><textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} placeholder={a.prompt ? "e.g. A letter to families about our pumpkin science project next Friday" : "e.g. keep it under 100 words"} className={`${field} h-auto py-2`} /></Label>
        <Label text="Tone"><select value={tone} onChange={(e) => setTone(e.target.value)} className={field}>{["clear and friendly", "professional", "warm and encouraging", "formal", "casual", "persuasive", "fun and playful"].map((t) => <option key={t}>{t}</option>)}</select></Label>
        {sel && <p className="max-h-20 overflow-auto rounded-lg bg-slate-50 p-2 text-xs text-slate-600">“{sel.slice(0, 400)}{sel.length > 400 ? "…" : ""}”</p>}
        {err && <p className="text-rose-600">{err}</p>}
        {res && <div className="arise-doc max-h-72 overflow-auto rounded-xl bg-violet-50 p-3 text-sm ring-1 ring-violet-200" dangerouslySetInnerHTML={{ __html: res }} />}
      </div>
    </div>
  </Dialog>;
}

function Versions({ token, id, onClose, onRestore }: { token: string | null; id: string; onClose: () => void; onRestore: (c: DocContent) => void }) {
  const [list, setList] = useState<{ at: number }[] | null>(null); const [err, setErr] = useState("");
  useEffect(() => { docsApi(token).versions(id).then(setList).catch((e) => setErr(e.message)); }, [token, id]);
  return <Dialog title="Version history" onClose={onClose}>
    <p className="mb-3 text-slate-600">A copy is kept every 10 minutes while you work (the last 25).</p>
    {err && <p className="text-rose-600">{err}</p>}
    {!list ? <p className="text-slate-500">Loading…</p> : !list.length ? <p className="text-slate-500">No earlier versions yet.</p>
      : <ul className="divide-y divide-slate-100">{list.map((v) => <li key={v.at} className="flex items-center justify-between py-2"><span>{new Date(v.at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span><button type="button" className={btnGhost} onClick={async () => { try { const d = await docsApi(token).version<unknown>(id, v.at); onRestore(cleanDoc(d.content)); } catch (e: any) { setErr(e.message); } }}>Restore</button></li>)}</ul>}
  </Dialog>;
}

