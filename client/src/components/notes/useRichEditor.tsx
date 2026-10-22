// The rich text editing used by notes: a toolbar with the formatting tools of Arise Docs
// (paragraph styles, fonts and sizes, bold/italic/underline/strike, text colour and highlight,
// bullets, numbers and checklists, alignment, indent, links, undo) and the editable page itself.
// Used by the full-screen note editor (LifeHub Notes, Notes app installs) and WorkHub notes.
//
// useRichEditor returns the toolbar and the page as two pieces so each screen can place them; the
// page is edited directly and onChange gets its HTML after every change. Save it through
// shared/richNote.ts (cleanNoteHtml + noteTextOf), never as typed.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Link as LinkIcon, List, Underline } from "lucide-react";
import { Baseline, CheckSquare, Highlighter, Indent, ListOrdered, Outdent, Redo2, RemoveFormatting, Strikethrough, Undo2 } from "@/components/office/icons";
import { ColorGrid, DropButton, MenuList, Tool, ToolSep } from "@/components/office/officeUi";
import { loadOfficeFonts } from "@/components/office/sheetsHelpers";
import { DOC_FONTS, sanitizeHtml } from "@shared/office/docModel";

const SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48];
const STYLES = [
  { tag: "p", label: "Body" }, { tag: "h1", label: "Title" }, { tag: "h2", label: "Heading" }, { tag: "h3", label: "Subheading" },
  { tag: "blockquote", label: "Quote" }, { tag: "pre", label: "Monospaced" },
] as const;

export type RichEditorOptions = {
  /** What the page starts with. Read again only when resetKey changes. */
  startHtml: string;
  resetKey: string;
  onChange: (html: string) => void;
  /** Ctrl/Cmd + S. */
  onSaveKey?: () => void;
  placeholder?: string;
  toolbarClassName?: string;
  pageClassName?: string;
  testId?: string;
  label?: string;
};

export function useRichEditor({ startHtml, resetKey, onChange, onSaveKey, placeholder = "Start writing…", toolbarClassName = "", pageClassName = "", testId = "rich", label = "Note" }: RichEditorOptions): { toolbar: ReactNode; page: ReactNode; html: () => string; focus: () => void } {
  const ed = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [state, setState] = useState({ block: "p", font: "", size: 16, b: false, i: false, u: false, s: false, ul: false, ol: false, align: "left" });
  const changeRef = useRef(onChange); changeRef.current = onChange;
  const changed = () => changeRef.current(ed.current?.innerHTML || "");

  useEffect(() => { loadOfficeFonts(); }, []);
  // The page is edited directly; it is filled when it opens (and when resetKey changes).
  useEffect(() => {
    if (!ed.current) return;
    ed.current.innerHTML = sanitizeHtml(startHtml) || "<p><br></p>";
    try { document.execCommand("styleWithCSS", false, "true"); document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* old browser */ }
    changeRef.current(ed.current.innerHTML);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // ─── Selection and commands (the same approach as Arise Docs) ───
  const saveSel = () => { const s = window.getSelection(); if (s && s.rangeCount && ed.current?.contains(s.anchorNode)) savedRange.current = s.getRangeAt(0).cloneRange(); };
  const restoreSel = () => { ed.current?.focus({ preventScroll: true }); const r = savedRange.current; if (r) { const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r); } };
  const readState = () => {
    const s = window.getSelection();
    if (!s || !s.rangeCount || !ed.current?.contains(s.anchorNode)) return;
    const el = (s.anchorNode?.nodeType === 1 ? s.anchorNode as HTMLElement : s.anchorNode?.parentElement) as HTMLElement | null;
    if (!el) return;
    const block = el.closest("h1,h2,h3,blockquote,pre,p,li");
    const cs = getComputedStyle(el);
    const q = (c: string) => { try { return document.queryCommandState(c); } catch { return false; } };
    setState({
      block: block && block.tagName !== "LI" ? block.tagName.toLowerCase() : "p",
      font: cs.fontFamily.split(",")[0].replace(/['"]/g, "").trim(),
      size: Math.round(parseFloat(cs.fontSize)),
      b: q("bold"), i: q("italic"), u: q("underline"), s: q("strikeThrough"), ul: q("insertUnorderedList"), ol: q("insertOrderedList"),
      align: q("justifyCenter") ? "center" : q("justifyRight") ? "right" : "left",
    });
  };
  useEffect(() => {
    const on = () => { saveSel(); readState(); };
    document.addEventListener("selectionchange", on);
    return () => document.removeEventListener("selectionchange", on);
  }, []);
  const exec = (cmd: string, value?: string) => { restoreSel(); document.execCommand(cmd, false, value); saveSel(); changed(); readState(); };
  const fontSize = (px: number) => {
    restoreSel();
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand("fontSize", false, "7");
    ed.current?.querySelectorAll('font[size="7"]').forEach((f) => { const span = document.createElement("span"); span.style.fontSize = `${px}px`; span.innerHTML = (f as HTMLElement).innerHTML; f.replaceWith(span); });
    document.execCommand("styleWithCSS", false, "true");
    saveSel(); changed(); readState();
  };
  const anchorEl = () => { const s = window.getSelection(); return s?.anchorNode ? ((s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement) as HTMLElement) : null; };
  const checklist = () => {
    restoreSel();
    const ul = anchorEl()?.closest("ul");
    if (ul && ul.hasAttribute("data-check")) { ul.removeAttribute("data-check"); ul.querySelectorAll("li").forEach((li) => li.removeAttribute("data-checked")); changed(); return; }
    if (!ul) document.execCommand("insertUnorderedList");
    const list = anchorEl()?.closest("ul");
    if (list) { list.setAttribute("data-check", ""); list.querySelectorAll(":scope > li").forEach((li) => li.setAttribute("data-checked", li.getAttribute("data-checked") || "false")); }
    saveSel(); changed();
  };
  const addLink = () => {
    saveSel();
    const url = window.prompt("Link address (https://…)", "https://");
    if (!url || !/^(https?:|mailto:|tel:)/i.test(url.trim())) return;
    const s = window.getSelection();
    restoreSel();
    if (s && s.isCollapsed) document.execCommand("insertHTML", false, `<a href="${url.trim().replace(/"/g, "%22")}">${url.trim().replace(/</g, "&lt;")}</a>`);
    else document.execCommand("createLink", false, url.trim());
    changed();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); onSaveKey?.(); return; }
    if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); addLink(); return; }
    if (mod && e.shiftKey && (e.key === "9" || e.key === "(")) { e.preventDefault(); checklist(); return; }
    if (e.key === "Tab" && anchorEl()?.closest("li")) { e.preventDefault(); exec(e.shiftKey ? "outdent" : "indent"); return; }
    if (e.key === " ") {
      // Typing shortcuts at the start of a line: "# ", "## ", "- ", "1. ", "[] ", "> ".
      const s = window.getSelection(); const node = s?.anchorNode;
      if (node && node.nodeType === 3 && s!.anchorOffset === (node.textContent || "").length) {
        const block = (node.parentElement as HTMLElement).closest("p,div");
        const t = node.textContent || "";
        if (block && block.textContent === t) {
          const map: Record<string, () => void> = {
            "#": () => document.execCommand("formatBlock", false, "h1"), "##": () => document.execCommand("formatBlock", false, "h2"), "###": () => document.execCommand("formatBlock", false, "h3"),
            "-": () => document.execCommand("insertUnorderedList"), "*": () => document.execCommand("insertUnorderedList"), "1.": () => document.execCommand("insertOrderedList"),
            "[]": () => checklist(), ">": () => document.execCommand("formatBlock", false, "blockquote"),
          };
          const fn = map[t];
          if (fn) { e.preventDefault(); const r = document.createRange(); r.setStart(node, 0); r.setEnd(node, t.length); s!.removeAllRanges(); s!.addRange(r); document.execCommand("delete"); fn(); saveSel(); changed(); }
        }
      }
    }
  };
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    if (html) document.execCommand("insertHTML", false, sanitizeHtml(html.replace(/<!--StartFragment-->|<!--EndFragment-->/g, "")).replace(/<img\b[^>]*>/gi, ""));
    else document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
    changed();
  };
  const onClick = (e: React.MouseEvent) => {
    const li = (e.target as HTMLElement).closest("li");
    if (li && li.parentElement?.hasAttribute("data-check") && e.clientX - li.getBoundingClientRect().left < 26) { li.setAttribute("data-checked", li.getAttribute("data-checked") === "true" ? "false" : "true"); changed(); }
    const a = (e.target as HTMLElement).closest("a");
    if (a && (e.ctrlKey || e.metaKey)) window.open(a.getAttribute("href") || "", "_blank", "noopener");
  };

  const styleLabel = STYLES.find((s) => s.tag === state.block)?.label || "Body";
  const toolbar = (
      <div className={`flex shrink-0 items-center gap-0.5 overflow-x-auto px-2 py-1.5 [scrollbar-width:none] ${toolbarClassName}`} role="toolbar" aria-label="Formatting" data-testid={`${testId}-toolbar`}>
        <Tool title="Undo" keys="Ctrl+Z" onClick={() => exec("undo")}><Undo2 size={16} /></Tool>
        <Tool title="Redo" keys="Ctrl+Y" onClick={() => exec("redo")}><Redo2 size={16} /></Tool>
        <ToolSep />
        <DropButton title="Paragraph style" label={<span className="w-[72px] truncate text-left text-[12px] font-semibold">{styleLabel}</span>}>{(close) => <MenuList items={STYLES.map((s) => ({ label: s.label, checked: state.block === s.tag, onClick: () => exec("formatBlock", s.tag) }))} onDone={close} />}</DropButton>
        <DropButton title="Font" label={<span className="w-[78px] truncate text-left text-[12px]" style={{ fontFamily: state.font || undefined }}>{state.font || "Font"}</span>}>{(close) => <MenuList items={DOC_FONTS.map((f) => ({ label: f, checked: state.font === f, icon: <span style={{ fontFamily: f }}>A</span>, onClick: () => exec("fontName", f) }))} onDone={close} />}</DropButton>
        <DropButton title="Text size" label={<span className="w-6 text-center text-[12px]">{state.size}</span>}>{(close) => <MenuList items={SIZES.map((s) => ({ label: String(s), checked: state.size === s, onClick: () => fontSize(s) }))} onDone={close} />}</DropButton>
        <ToolSep />
        <Tool title="Bold" keys="Ctrl+B" active={state.b} onClick={() => exec("bold")}><Bold size={16} /></Tool>
        <Tool title="Italic" keys="Ctrl+I" active={state.i} onClick={() => exec("italic")}><Italic size={16} /></Tool>
        <Tool title="Underline" keys="Ctrl+U" active={state.u} onClick={() => exec("underline")}><Underline size={16} /></Tool>
        <Tool title="Strikethrough" active={state.s} onClick={() => exec("strikeThrough")}><Strikethrough size={16} /></Tool>
        <DropButton title="Text color" label={<Baseline size={16} />}>{(close) => <ColorGrid onPick={(c) => { exec("foreColor", c || "#1f2937"); close(); }} resetLabel="Automatic" />}</DropButton>
        <DropButton title="Highlight" label={<Highlighter size={16} />}>{(close) => <ColorGrid onPick={(c) => { exec("hiliteColor", c || "transparent"); close(); }} resetLabel="None" />}</DropButton>
        <ToolSep />
        <Tool title="Checklist" keys="Ctrl+Shift+9" onClick={checklist}><CheckSquare size={16} /></Tool>
        <Tool title="Bulleted list" active={state.ul} onClick={() => exec("insertUnorderedList")}><List size={16} /></Tool>
        <Tool title="Numbered list" active={state.ol} onClick={() => exec("insertOrderedList")}><ListOrdered size={16} /></Tool>
        <Tool title="Decrease indent" onClick={() => exec("outdent")}><Outdent size={16} /></Tool>
        <Tool title="Increase indent" onClick={() => exec("indent")}><Indent size={16} /></Tool>
        <ToolSep />
        <Tool title="Align left" active={state.align === "left"} onClick={() => exec("justifyLeft")}><AlignLeft size={16} /></Tool>
        <Tool title="Align center" active={state.align === "center"} onClick={() => exec("justifyCenter")}><AlignCenter size={16} /></Tool>
        <Tool title="Align right" active={state.align === "right"} onClick={() => exec("justifyRight")}><AlignRight size={16} /></Tool>
        <ToolSep />
        <Tool title="Link" keys="Ctrl+K" onClick={addLink}><LinkIcon size={16} /></Tool>
        <Tool title="Clear formatting" onClick={() => exec("removeFormat")}><RemoveFormatting size={16} /></Tool>
      </div>
  );
  const page = (
    <>
      <style>{NOTE_CSS}</style>
      <div ref={ed} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={label} spellCheck
        onInput={changed} onKeyDown={onKeyDown} onPaste={onPaste} onClick={onClick} onKeyUp={() => { saveSel(); readState(); }} onMouseUp={() => { saveSel(); readState(); }}
        className={`arise-note text-[16px] leading-7 text-slate-800 outline-none ${pageClassName}`} style={{ ["--note-placeholder" as string]: JSON.stringify(placeholder) }} data-testid={`${testId}-body`} />
    </>
  );
  return { toolbar, page, html: () => ed.current?.innerHTML || "", focus: () => ed.current?.focus() };
}

const NOTE_CSS = `
.arise-note:empty::before, .arise-note:has(> p:only-child > br:only-child) > p::before { content: var(--note-placeholder); color: #94a3b8; pointer-events: none; }
.arise-note h1 { font-size: 1.75em; font-weight: 800; margin: 0.5em 0 0.25em; line-height: 1.25; }
.arise-note h2 { font-size: 1.35em; font-weight: 800; margin: 0.6em 0 0.25em; line-height: 1.3; }
.arise-note h3 { font-size: 1.12em; font-weight: 700; margin: 0.5em 0 0.2em; }
.arise-note p { margin: 0 0 0.35em; }
.arise-note ul { list-style: disc; padding-left: 1.6em; margin: 0 0 0.5em; } .arise-note ul ul { list-style: circle; }
.arise-note ol { list-style: decimal; padding-left: 1.6em; margin: 0 0 0.5em; } .arise-note ol ol { list-style: lower-alpha; }
.arise-note ul[data-check] { list-style: none; padding-left: 0.2em; }
.arise-note ul[data-check] > li { position: relative; padding-left: 1.9em; margin: 0.2em 0; }
.arise-note ul[data-check] > li::before { content: ""; position: absolute; left: 0; top: 0.2em; width: 1.2em; height: 1.2em; border: 2px solid #8b7cf0; border-radius: 999px; cursor: pointer; background: #fff; }
.arise-note ul[data-check] > li[data-checked="true"] { color: #94a3b8; text-decoration: line-through; }
.arise-note ul[data-check] > li[data-checked="true"]::before { background: #6e5ae0; border-color: #6e5ae0; content: "✓"; color: #fff; font-size: 0.8em; line-height: 1.35em; text-align: center; text-decoration: none; }
.arise-note blockquote { border-left: 4px solid #c4b5fd; padding-left: 12px; color: #475569; font-style: italic; margin: 0.5em 0; }
.arise-note pre { background: rgba(15,23,42,.06); padding: 8px 10px; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 0.9em; white-space: pre-wrap; }
.arise-note a { color: #5b45d6; text-decoration: underline; }
.arise-note table { border-collapse: collapse; width: 100%; } .arise-note td, .arise-note th { border: 1px solid #cbd5e1; padding: 4px 6px; }
`;
