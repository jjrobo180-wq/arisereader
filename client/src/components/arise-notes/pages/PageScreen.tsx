// One note, open: typed (the Arise Docs formatting tools on the note's own paper, font and lines) or
// handwritten (pages you write on with the Apple Pencil). It saves itself as you go, syncs, and can be
// locked with the notes password. Menu: appearance, pin, colour, folder, lock, AI, versions, export.
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, Maximize2, MessageCircle, Minimize2, Send, Clock, Copy, Download, FileText, Image as ImageIcon, Lock, LockOpen, MoreHorizontal, Palette, PenLine, Pin, PinOff, Sparkles, Table2, Trash2, Wand2 } from "lucide-react";
import { DEFAULT_LOOK, blankInkPage, pageTitle, textOfHtml, type InkPage, type Page, type PageContent, type PageLook, type PageMeta } from "@shared/arisePages";
import { noteHtml as aiNoteHtml } from "@shared/ariseNotes";
import { wordCount } from "@shared/office/docModel";
import { useRichEditor } from "@/components/notes/useRichEditor";
import { addToAppleReminders, appleAddAvailable } from "@/lib/notesApple";
import { hasNativePlugin, isNativeApp, nativeCall } from "@/lib/nativeApp";
import { api, notesApi } from "../api";
import { copyText, mailtoLink } from "../exporters";
import { Btn, IconBtn, Notice, Sheet, Spinner, plural, shortDate, useToast } from "../ui";
import type { AppCtx } from "../NotesApp";
import InkCanvas, { type ToolState } from "./InkCanvas";
import InkToolbar from "./InkToolbar";
import { pageImage, strokesPng } from "./inkDraw";
import { exportInkImage, exportInkPdf, exportMarkdown, exportText, exportWord, printPage } from "./pagesExport";
import { lockContent, unlockContent } from "./pagesLock";
import { AppearanceSheet, ColorDots, ForgotSheet, SYNC_WORDS, UnlockSheet, VaultSheet, loadPageFont, lookStyle, usePages, useUnlocked } from "./pagesUi";
import { drafts } from "./drafts";
import { useAppearance } from "../appearance";
import { askAi, undercoverPrefs } from "@/undercover/askUndercover";
import { answerLines } from "@shared/undercover";

type Panel = "" | "more" | "look" | "folder" | "ai" | "versions" | "export" | "unlock" | "vault" | "forgot" | "sketch" | "ainote" | "info";

export default function PageScreen({ ctx, id, onBack, expanded, onExpand }: { ctx: AppCtx; id: string; onBack: () => void; expanded?: boolean; onExpand?: () => void }) {
  const userId = ctx.me.user.id;
  const say = useToast();
  const { sync, settings, metas, state } = usePages(userId);
  const key = useUnlocked(settings.vault);
  const appearance = useAppearance();
  const [page, setPage] = useState<Page | null | undefined>(undefined);
  const [content, setContent] = useState<(PageContent & { inkText?: string }) | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [panel, setPanel] = useState<Panel>("");
  // Ask AI in the note (Undercover's AI): a bar under the note; each answer is written into the note
  // like your own lines, so on screen it just looks like note taking. On or off is remembered.
  const [askOn, setAskOn] = useState(() => { try { return localStorage.getItem("arise-notes-ask-in-note") === "1"; } catch { return false; } });
  const [askQ, setAskQ] = useState("");
  const [askBusy, setAskBusy] = useState(false);
  const toggleAsk = () => setAskOn((v) => { try { localStorage.setItem("arise-notes-ask-in-note", v ? "0" : "1"); } catch { /* not kept */ } return !v; });
  const [lockAfter, setLockAfter] = useState(false); // locking this note once the password is ready
  const pageRef = useRef<Page | null>(null);
  const contentRef = useRef<(PageContent & { inkText?: string }) | null>(null);
  const lastEdit = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  pageRef.current = page ?? null;
  contentRef.current = content;

  // ─── Loading ───
  const load = useCallback(async () => {
    const p = drafts.get(id) ?? (await sync.open(id));
    setPage(p);
    if (!p) return;
    if (!p.locked) { setContent(p.content); setResetKey((k) => k + 1); }
    else setContent(null);
  }, [id, sync]);
  useEffect(() => { void load(); }, [load]);
  // A locked note opens once the key is here.
  useEffect(() => {
    const p = page;
    if (!p?.locked || content || !key) return;
    void unlockContent(key, p).then((c) => { setContent(c); setResetKey((k) => k + 1); }).catch(() => say("This note couldn't be opened with your notes password."));
  }, [page, key, content, say]);
  useEffect(() => { if (page?.locked && !key && settings.vault) setPanel((x) => x || "unlock"); }, [page?.locked, key, settings.vault]);
  // Changed on another device while open: reload, unless it's being written in right now.
  useEffect(() => sync.onRemote((changed) => { if (changed === id && Date.now() - lastEdit.current > 2500) void load(); }), [id, sync, load]);
  useEffect(() => { if (content) loadPageFont(content.look.font); }, [content?.look.font]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Saving ───
  const persist = useCallback(async (meta?: Partial<Page>) => {
    const base = pageRef.current, c = contentRef.current;
    if (!base) return;
    let out: Page = { ...base, ...meta };
    if (base.locked) {
      if (!c || !key) { if (meta) sync.save(out); return; }
      out = { ...out, cipher: await lockContent(key, c, { inkText: c.inkText }), content: { title: "", html: "", ink: [], look: c.look }, preview: "", tags: [] };
    } else if (c) {
      const text = out.kind === "text" ? textOfHtml(c.html) : c.inkText ?? "";
      out = { ...out, content: { title: c.title, html: c.html, ink: c.ink, look: c.look }, preview: text.replace(/\s+/g, " ").slice(0, 240) };
      (out as any).inkText = c.inkText ?? "";
    }
    drafts.delete(out.id);
    setPage(out);
    sync.save(out);
  }, [key, sync]);
  const edit = (patch: Partial<PageContent & { inkText?: string }>) => {
    if (!contentRef.current) return;
    const next = { ...contentRef.current, ...patch };
    contentRef.current = next;
    setContent(next);
    lastEdit.current = Date.now();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(), 450);
  };
  const setMeta = (patch: Partial<Page>) => { void persist(patch); };
  // Leaving: save now, and drop a new note nobody wrote in.
  useEffect(() => () => {
    if (timer.current) { clearTimeout(timer.current); void persist(); }
    void sync.flush();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const back = () => {
    const c = contentRef.current, p = pageRef.current;
    if (p && drafts.has(p.id) && c && isEmpty(c)) drafts.delete(p.id);
    onBack();
  };

  // Handwriting becomes searchable: the iPhone reads it (on the device) a little after you stop writing.
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readInk = (ink: InkPage[]) => {
    if (!isNativeApp() || !hasNativePlugin(/arise.?on.?device/i)) return;
    if (readTimer.current) clearTimeout(readTimer.current);
    readTimer.current = setTimeout(async () => {
      const parts: string[] = [];
      for (const pg of ink.slice(0, 30)) {
        if (!pg.strokes.length) continue;
        try { const r = await nativeCall(/arise.?on.?device/i, "AriseOnDevice", "readHandwriting", { image: pageImage(pg, 1000, 0.8) }); if (r?.text) parts.push(String(r.text)); } catch { /* not readable */ }
      }
      edit({ inkText: parts.join("\n").slice(0, 20_000) });
    }, 4000);
  };

  // ─── Locking ───
  const lockNote = async () => {
    if (!settings.vault) { setLockAfter(true); setPanel("vault"); return; }
    if (!key) { setLockAfter(true); setPanel("unlock"); return; }
    const p = pageRef.current, c = contentRef.current;
    if (!p || !c) return;
    const locked: Page = { ...p, locked: true, cipher: await lockContent(key, c, { inkText: c.inkText }), content: { title: "", html: "", ink: [], look: c.look }, preview: "", tags: [] };
    setPage(locked); drafts.delete(p.id); sync.save(locked);
    say("Locked. Only your notes password (or Face ID) opens it.");
    setPanel("");
  };
  useEffect(() => { if (lockAfter && key && settings.vault) { setLockAfter(false); void lockNote(); } }, [lockAfter, key, settings.vault]); // eslint-disable-line react-hooks/exhaustive-deps
  const unlockNote = () => {
    const p = pageRef.current, c = contentRef.current;
    if (!p || !c) return;
    const plain: Page = { ...p, locked: false, cipher: null, content: { title: c.title, html: c.html, ink: c.ink, look: c.look } };
    (plain as any).inkText = c.inkText ?? "";
    setPage(plain); sync.save(plain);
    say("The lock is removed from this note.");
    setPanel("");
  };

  if (page === undefined) return <div className="grid h-full place-items-center"><Spinner /></div>;
  if (!page) return <div className="mx-auto max-w-md p-6"><Notice tone="bad" action={<Btn kind="primary" onClick={onBack}>Back to notes</Btn>}>That note isn't here. It may have been deleted on another device.</Notice></div>;

  // The typing screen follows Light / Dark / Auto: the plain white paper turns charcoal in dark mode (the
  // saved note keeps its own paper; other papers you picked on purpose stay as they are).
  const savedLook = content?.look ?? page.content.look ?? DEFAULT_LOOK;
  const look = appearance.dark && savedLook.theme === "paper" ? { ...savedLook, theme: "charcoal" as const } : savedLook;
  const title = content?.title ?? "";
  const meta = sync.meta(page.id);
  const trashed = !!(meta?.deletedAt ?? page.deletedAt);

  return <div className="flex h-full min-h-0 flex-col" data-paper={look.theme} style={{ background: lookStyle(look).background as string }} data-testid="pages-note">
    {/* Top bar */}
    <header className="an-noprint an-notehead sticky top-0 z-30 flex items-center gap-1 px-2 pt-[var(--sat,env(safe-area-inset-top,0px))]">
      <IconBtn label="Back to notes" onClick={back}><ChevronLeft className="h-6 w-6" /></IconBtn>
      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--an-muted)]">{page.locked && !content ? "Locked" : SYNC_WORDS[state]}</span>
      {onExpand && <IconBtn label={expanded ? "Shrink back to the list" : "Fill the whole page"} onClick={onExpand}>{expanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}</IconBtn>}
      {content && <IconBtn label="Appearance" onClick={() => setPanel("look")}><Palette className="h-5 w-5" /></IconBtn>}
      {content && page.kind === "text" && <IconBtn label={askOn ? "Hide Ask AI" : "Ask AI in this note"} onClick={toggleAsk} className={askOn ? "!text-[var(--an-violet)]" : ""}><MessageCircle className="h-5 w-5" /></IconBtn>}
      {content && page.kind === "text" && <IconBtn label="AI tools" onClick={() => setPanel("ai")}><Sparkles className="h-5 w-5" /></IconBtn>}
      <IconBtn label="More" onClick={() => setPanel("more")}><MoreHorizontal className="h-5 w-5" /></IconBtn>
    </header>
    {trashed && <div className="px-4 pt-3"><Notice tone="warn" action={<Btn kind="soft" onClick={() => { sync.restore(page.id); say("Restored."); }}>Restore</Btn>}>This note is in Recently Deleted.</Notice></div>}

    {/* Body */}
    {page.locked && !content ? <LockedCover hasVault={!!settings.vault} onUnlock={() => setPanel(settings.vault ? "unlock" : "vault")} />
      : content && page.kind === "text" ? <TextBody key={`${page.id}-${resetKey}`} content={content} look={look} edit={edit} onSketch={() => setPanel("sketch")} onAiNote={() => setPanel("ainote")} />
        : content ? <InkBody content={content} pencilOnly={settings.prefs.pencilOnly} edit={(p) => { edit(p); if (p.ink) readInk(p.ink); }} onPencilOnly={(v) => sync.saveSettings({ ...settings, prefs: { ...settings.prefs, pencilOnly: v } })} title={title} />
          : <Spinner />}

    {askOn && content && page.kind === "text" && !trashed && <form className="an-noprint sticky bottom-0 z-20 flex gap-2 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-2" style={{ background: "linear-gradient(to top, color-mix(in srgb, var(--an-bg, #fff) 92%, transparent) 70%, transparent)" }}
      onSubmit={async (e) => {
        e.preventDefault();
        const q = askQ.trim();
        if (!q || askBusy) return;
        setAskBusy(true);
        try {
          const reply = await askAi("docNotes", [{ role: "user", content: q }], { ...undercoverPrefs(), context: textOfHtml(content.html) });
          const lines = answerLines(reply);
          const html = `<p><b>${esc(q)}</b></p>${lines.length > 1 ? `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : `<p>${esc(lines[0] || reply)}</p>`}`;
          const now = contentRef.current?.html ?? content.html;
          edit({ html: `${now}${html}` });
          setResetKey((k) => k + 1);
          setAskQ("");
        } catch (x: any) { say(x?.message || "Couldn't get an answer."); }
        finally { setAskBusy(false); }
      }} data-testid="pages-ask-bar">
      <label className="sr-only" htmlFor="pages-ask-input">Ask AI. The answer is added to this note.</label>
      <input id="pages-ask-input" className="an-input flex-1" value={askQ} onChange={(e) => setAskQ(e.target.value)} placeholder={askBusy ? "Writing…" : "Ask anything, the answer goes in the note"} maxLength={500} autoComplete="off" enterKeyHint="send" />
      <Btn kind="primary" type="submit" busy={askBusy} disabled={!askQ.trim()} aria-label="Ask"><Send className="h-4 w-4" /></Btn>
    </form>}

    {/* Sheets */}
    {panel === "look" && content && <AppearanceSheet look={savedLook} onChange={(l) => edit({ look: l })} onClose={() => setPanel("")} onDefault={() => { sync.saveSettings({ ...settings, prefs: { ...settings.prefs, look } }); say("New notes will look like this."); }} />}
    {panel === "more" && <MoreSheet page={page} meta={meta} content={content} words={content && page.kind === "text" ? wordCount(content.html).words : 0}
      folders={settings.folders} onClose={() => setPanel("")} setMeta={setMeta} open={setPanel}
      onLock={() => void lockNote()} onUnlockNote={unlockNote}
      onDuplicate={() => {
        const id2 = crypto.randomUUID();
        const base = { ...page, id: id2, rev: 0, pinned: false, createdAt: new Date().toISOString() };
        // A locked note's copy stays locked (same ciphertext, same password).
        const copy: Page = page.locked || !content ? base : { ...base, content: { title: `${content.title || pageTitle(page)} copy`, html: content.html, ink: content.ink, look: content.look } };
        sync.save(copy); setPanel(""); say("Duplicated."); ctx.go({ name: "page", id: id2 });
      }}
      onDelete={() => { sync.remove(page.id); say("Moved to Recently Deleted."); onBack(); }} />}
    {panel === "ai" && content && <AiSheet pageId={page.id} text={textOfHtml(content.html)} onClose={() => setPanel("")}
      onInsert={(t, replace) => { const html = textToHtml(t); edit({ html: replace ? html : `${content.html}${html}` }); setResetKey((k) => k + 1); setPanel(""); }}
      onTitle={(t) => { edit({ title: t }); setPanel(""); }} />}
    {panel === "versions" && <VersionsSheet page={page} onClose={() => setPanel("")} onRestore={async (v) => {
      let c: PageContent | null = v.content ?? null;
      if (v.locked && v.cipher) { if (!key) { say("Unlock your notes first."); return; } c = await unlockContent(key, { ...page, cipher: v.cipher, kind: v.kind }); }
      if (!c) return;
      contentRef.current = { ...c, inkText: contentRef.current?.inkText }; setContent(contentRef.current); setResetKey((k) => k + 1); void persist(); setPanel(""); say("That version is back.");
    }} />}
    {panel === "export" && content && <ExportSheet page={page} content={content} onClose={() => setPanel("")} />}
    {panel === "sketch" && <SketchSheet onClose={() => setPanel("")} onInsert={(png) => { insertHtml(`<p><img src="${png}" alt="Sketch" style="max-width: 100%"></p><p><br></p>`); setPanel(""); }} />}
    {panel === "ainote" && <AiNotePicker onClose={() => setPanel("")} onPick={(html) => { insertHtml(html); setPanel(""); }} />}
    {panel === "info" && content && <InfoSheet page={page} content={content} onClose={() => setPanel("")} />}
    {panel === "vault" && <VaultSheet sync={sync} settings={settings} userId={userId} onClose={() => { setLockAfter(false); setPanel(""); }} onDone={() => setPanel("")} />}
    {panel === "unlock" && settings.vault && <UnlockSheet settings={settings} userId={userId} onClose={() => { setLockAfter(false); setPanel(""); if (page.locked && !content) back(); }} onUnlocked={() => setPanel("")} onForgot={() => setPanel("forgot")} />}
    {panel === "forgot" && <ForgotSheet sync={sync} settings={settings} metas={metas} userId={userId} onClose={() => setPanel("")} onDone={() => { setPanel(""); say("Your locked notes are cleared. Lock a note to make a new password."); onBack(); }} />}
  </div>;
}

const isEmpty = (c: PageContent) => !c.title.trim() && !textOfHtml(c.html).trim() && !/<img|<table/i.test(c.html) && c.ink.every((p) => !p.strokes.length && !p.bg);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** AI text (paragraphs, "- " bullets) as note HTML. */
export function textToHtml(t: string): string {
  return t.split(/\n{2,}/).map((block) => {
    const lines = block.split("\n").filter((l) => l.trim());
    if (lines.length && lines.every((l) => /^\s*[-•*]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${esc(l.replace(/^\s*[-•*]\s+/, ""))}</li>`).join("")}</ul>`;
    return `<p>${lines.map(esc).join("<br>")}</p>`;
  }).join("");
}

// The caret's place in the note, kept so pictures and tables go where you were typing.
let savedRange: Range | null = null;
const noteEl = () => document.querySelector<HTMLElement>('[data-testid="pages-rich-body"]');
if (typeof document !== "undefined") document.addEventListener("selectionchange", () => { const s = window.getSelection(); const el = noteEl(); if (s && s.rangeCount && el?.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange(); });
export function insertHtml(html: string) {
  const el = noteEl();
  if (!el) return;
  el.focus({ preventScroll: true });
  const s = window.getSelection();
  if (savedRange && el.contains(savedRange.startContainer)) { s?.removeAllRanges(); s?.addRange(savedRange); }
  else { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); s?.removeAllRanges(); s?.addRange(r); }
  document.execCommand("insertHTML", false, html);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function LockedCover({ hasVault, onUnlock }: { hasVault: boolean; onUnlock: () => void }) {
  return <div className="grid flex-1 place-items-center p-8 text-center">
    <div><div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-[var(--an-violet-soft)] text-[var(--an-violet-ink)]"><Lock className="h-9 w-9" /></div>
      <h2 className="mt-4 text-[20px] font-bold">This note is locked</h2>
      <p className="mt-1 text-[15px] text-[var(--an-muted)]">{hasVault ? "Use your notes password or Face ID to open it." : "This note was locked on another device."}</p>
      <Btn kind="primary" className="mt-5" onClick={onUnlock} data-testid="pages-unlock-open">Unlock</Btn></div>
  </div>;
}

// ─── Typed notes ─────────────────────────────────────────────────────────────
function TextBody({ content, look, edit, onSketch, onAiNote }: { content: PageContent; look: PageLook; edit: (p: Partial<PageContent>) => void; onSketch: () => void; onAiNote: () => void }) {
  const say = useToast();
  // The editor reports the page once as it fills it; that isn't a change, so it isn't saved.
  const filled = useRef(false);
  const { toolbar, page } = useRichEditor({
    startHtml: content.html, resetKey: "page", onChange: (html) => { if (!filled.current) { filled.current = true; return; } if (html !== content.html) edit({ html }); },
    placeholder: "Start writing…", testId: "pages-rich", label: "Note", pageClassName: "min-h-[60vh] ![color:inherit] ![font-size:inherit] ![line-height:inherit] [font-family:inherit] pb-40",
    toolbarClassName: "bg-transparent",
  });
  const fileIn = useRef<HTMLInputElement>(null);
  const addImage = async (f: File | undefined) => {
    if (!f) return;
    try { insertHtml(`<p><img src="${await shrinkImage(f)}" alt="${esc(f.name.replace(/\.[^.]+$/, ""))}" style="max-width: 100%"></p><p><br></p>`); }
    catch { say("That picture couldn't be added."); }
  };
  const addTable = () => insertHtml(`<table style="border-collapse: collapse; width: 100%">${Array.from({ length: 3 }, (_, r) => `<tr>${Array.from({ length: 3 }, () => `<${r ? "td" : "th"} style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left"><br></${r ? "td" : "th"}>`).join("")}</tr>`).join("")}</table><p><br></p>`);
  const style = lookStyle(look);
  return <>
    <div className="an-noprint an-notebar z-20 flex items-center">
      <div className="min-w-0 flex-1">{toolbar}</div>
      <div className="flex shrink-0 items-center gap-0.5 border-l border-black/5 px-1">
        <IconBtn label="Add a picture" onClick={() => fileIn.current?.click()}><ImageIcon className="h-[18px] w-[18px]" /></IconBtn>
        <IconBtn label="Add a sketch" onClick={onSketch}><PenLine className="h-[18px] w-[18px]" /></IconBtn>
        <IconBtn label="Add a table" onClick={addTable}><Table2 className="h-[18px] w-[18px]" /></IconBtn>
        <IconBtn label="Add an AI note's summary" onClick={onAiNote}><Wand2 className="h-[18px] w-[18px]" /></IconBtn>
      </div>
      <input ref={fileIn} type="file" accept="image/*" className="sr-only" onChange={(e) => { void addImage(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto" data-paper={look.theme} style={style}>
      <div className={`mx-auto px-6 pb-10 pt-7 sm:px-10 ${look.wide ? "max-w-none" : "max-w-[760px]"}`}>
        <input className="an-bare an-doc-title w-full bg-transparent text-[34px] leading-[1.1] outline-none placeholder:opacity-30" style={{ fontFamily: style.fontFamily, color: "inherit" }}
          value={content.title} onChange={(e) => edit({ title: e.target.value.slice(0, 140) })} placeholder="Title" aria-label="Title" data-testid="pages-title" />
        <div className="mt-3">{page}</div>
      </div>
    </div>
  </>;
}

/** A photo made small enough to keep in a note (longest side 1600, JPEG). */
export function shrinkImage(f: Blob, max = 1600, q = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
    img.src = url;
  });
}

// ─── Handwriting ─────────────────────────────────────────────────────────────
function InkBody({ content, pencilOnly, edit, onPencilOnly, title }: { content: PageContent; pencilOnly: boolean; edit: (p: Partial<PageContent>) => void; onPencilOnly: (v: boolean) => void; title: string }) {
  const [tools, setTools] = useState<ToolState>({ tool: "pen", color: "#1b1a26", width: 3, hlColor: "#fde047", shape: "line" });
  const [zoom, setZoom] = useState(1);
  const undo = useRef<InkPage[][]>([]);
  const redo = useRef<InkPage[][]>([]);
  const [, tick] = useState(0);
  const change = (ink: InkPage[]) => { undo.current.push(content.ink); if (undo.current.length > 80) undo.current.shift(); redo.current = []; edit({ ink }); tick((n) => n + 1); };
  const setPage = (i: number, p: InkPage) => change(content.ink.map((x, k) => (k === i ? p : x)));
  const photoIn = useRef<HTMLInputElement>(null);
  const addPhotoPage = async (f: File | undefined) => { if (!f) return; const bg = await shrinkImage(f, 1600, 0.8); change([...content.ink, { ...blankInkPage("blank"), bg }]); };
  return <div className="flex min-h-0 flex-1 flex-col">
    <InkToolbar tools={tools} setTools={setTools} canUndo={undo.current.length > 0} canRedo={redo.current.length > 0}
      onUndo={() => { const prev = undo.current.pop(); if (prev) { redo.current.push(content.ink); edit({ ink: prev }); tick((n) => n + 1); } }}
      onRedo={() => { const next = redo.current.pop(); if (next) { undo.current.push(content.ink); edit({ ink: next }); tick((n) => n + 1); } }}
      pencilOnly={pencilOnly} onPencilOnly={onPencilOnly} zoom={zoom} setZoom={setZoom}
      onAddPage={(paper) => change([...content.ink, blankInkPage(paper, content.ink[content.ink.length - 1]?.tint ?? "paper")])}
      onAddPhoto={() => photoIn.current?.click()} />
    <input ref={photoIn} type="file" accept="image/*" className="sr-only" onChange={(e) => { void addPhotoPage(e.target.files?.[0]); e.target.value = ""; }} />
    <div className="min-h-0 flex-1 overflow-auto bg-[var(--an-bg)] px-3 py-5 sm:px-6" data-testid="pages-ink">
      <div className="mx-auto" style={{ width: `min(100%, ${Math.round(820 * zoom)}px)`, minWidth: zoom > 1 ? `${Math.round(820 * zoom)}px` : undefined }}>
        <input className="an-bare an-doc-title mb-3 w-full bg-transparent text-[28px] text-[var(--an-ink)] outline-none placeholder:text-[var(--an-faint)]" value={content.title} onChange={(e) => edit({ title: e.target.value.slice(0, 140) })} placeholder="Title" aria-label="Title" data-testid="pages-title" />
        <div className="space-y-5">{content.ink.map((p, i) => <div key={p.id}>
          <InkCanvas page={p} tools={tools} pencilOnly={pencilOnly} label={`${title || "Note"}, page ${i + 1}`} onChange={(np) => setPage(i, np)} onPen={() => { if (!pencilOnly) onPencilOnly(true); }} />
          <div className="mt-1.5 flex items-center justify-between text-[12px] text-[#6b6880]">
            <span>Page {i + 1} of {content.ink.length}</span>
            <span className="flex gap-3">
              {i > 0 && <button type="button" className="font-semibold" onClick={() => { const a = [...content.ink]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; change(a); }}>Move up</button>}
              <button type="button" className="font-semibold" onClick={() => { const a = [...content.ink]; a.splice(i + 1, 0, { ...structuredClone(p), id: blankInkPage().id }); change(a); }}>Duplicate</button>
              {content.ink.length > 1 && <button type="button" className="font-semibold text-[#c2283a]" onClick={() => { if (p.strokes.length && !window.confirm("Delete this page?")) return; change(content.ink.filter((_, k) => k !== i)); }}>Delete page</button>}
            </span>
          </div>
        </div>)}</div>
      </div>
    </div>
  </div>;
}

/** A quick drawing to drop into a typed note. */
function SketchSheet({ onClose, onInsert }: { onClose: () => void; onInsert: (png: string) => void }) {
  const [page, setPage] = useState<InkPage>(() => ({ ...blankInkPage("blank"), paper: "dots" }));
  const [tools, setTools] = useState<ToolState>({ tool: "pen", color: "#1b1a26", width: 3, hlColor: "#fde047", shape: "line" });
  const [undo, setUndo] = useState<InkPage[]>([]);
  return <Sheet title="Sketch" onClose={onClose} wide>
    <div className="space-y-3">
      <InkToolbar compact tools={tools} setTools={setTools} canUndo={undo.length > 0} canRedo={false} onUndo={() => { const u = [...undo]; const prev = u.pop(); if (prev) { setPage(prev); setUndo(u); } }} onRedo={() => {}} pencilOnly={false} onPencilOnly={() => {}} zoom={1} setZoom={() => {}} />
      <div className="mx-auto max-w-[520px]"><InkCanvas page={page} tools={tools} pencilOnly={false} label="Sketch" onChange={(p) => { setUndo((u) => [...u, page]); setPage(p); }} /></div>
      <Btn kind="primary" className="w-full" disabled={!page.strokes.length} onClick={() => { const png = strokesPng(page.strokes); if (png) onInsert(png); }} data-testid="pages-sketch-insert">Add to note</Btn>
    </div>
  </Sheet>;
}

// ─── Menus and sheets ────────────────────────────────────────────────────────
function MoreSheet({ page, meta, content, words, folders, onClose, setMeta, open, onLock, onUnlockNote, onDuplicate, onDelete }: {
  page: Page; meta: PageMeta | null; content: PageContent | null; words: number; folders: { id: string; name: string; icon: string }[];
  onClose: () => void; setMeta: (p: Partial<Page>) => void; open: (p: Panel) => void; onLock: () => void; onUnlockNote: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const say = useToast();
  const pinned = meta?.pinned ?? page.pinned;
  const Row = ({ icon, label, onClick, danger, testId }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; testId?: string }) =>
    <button type="button" onClick={onClick} data-testid={testId} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] font-semibold active:bg-[color-mix(in_srgb,var(--an-ink)_8%,transparent)] ${danger ? "text-[#c2283a]" : ""}`}>{icon}{label}</button>;
  return <Sheet title={pageTitle({ ...page, content: content ?? page.content })} onClose={onClose}>
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3"><span className="text-[14px] font-bold">Color</span><ColorDots value={meta?.color ?? page.color} onChange={(c) => setMeta({ color: c })} /></div>
      <label className="flex items-center justify-between gap-3 text-[14px] font-bold">Folder
        <select className="an-input !w-auto !min-h-10" value={meta?.folderId ?? page.folderId} onChange={(e) => { setMeta({ folderId: e.target.value }); say(e.target.value ? "Moved." : "Moved to All notes."); }} data-testid="pages-move">
          <option value="">No folder</option>{folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </label>
      <div className="divide-y divide-[var(--an-line)] rounded-2xl border border-[var(--an-line)]">
        <Row icon={pinned ? <PinOff className="h-5 w-5" /> : <Pin className="h-5 w-5" />} label={pinned ? "Unpin" : "Pin to top"} onClick={() => { setMeta({ pinned: !pinned }); onClose(); }} testId="pages-pin" />
        {page.locked ? (content ? <Row icon={<LockOpen className="h-5 w-5" />} label="Remove lock" onClick={onUnlockNote} /> : null) : <Row icon={<Lock className="h-5 w-5" />} label="Lock note" onClick={onLock} testId="pages-lock" />}
        {content && <Row icon={<Download className="h-5 w-5" />} label="Share and export" onClick={() => open("export")} />}
        <Row icon={<Clock className="h-5 w-5" />} label="Version history" onClick={() => open("versions")} />
        {content && <Row icon={<FileText className="h-5 w-5" />} label={`Info${words ? ` · ${plural(words, "word")}` : ""}`} onClick={() => open("info")} />}
        {content && <Row icon={<Copy className="h-5 w-5" />} label="Duplicate" onClick={onDuplicate} />}
        <Row icon={<Trash2 className="h-5 w-5" />} label="Delete" onClick={onDelete} danger testId="pages-delete" />
      </div>
    </div>
  </Sheet>;
}

function AiSheet({ pageId, text, onClose, onInsert, onTitle }: { pageId: string; text: string; onClose: () => void; onInsert: (t: string, replace: boolean) => void; onTitle: (t: string) => void }) {
  const say = useToast();
  const [busy, setBusy] = useState("");
  const [out, setOut] = useState<{ action: string; text?: string; items?: { title: string; due: string; on: boolean }[] } | null>(null);
  const run = async (action: string) => {
    setBusy(action); setOut(null);
    try {
      const r = await api<{ text?: string; items?: { title: string; due: string }[] }>(`pages/${pageId}/ai`, { body: { action, text } });
      if (action === "title" && r.text) { onTitle(r.text.replace(/^["']|["']$/g, "")); return; }
      setOut({ action, text: r.text, items: r.items?.map((x) => ({ ...x, on: true })) });
    } catch (e: any) { say(e.message); } finally { setBusy(""); }
  };
  const ACTIONS: [string, string][] = [["summarize", "Summarize"], ["tidy", "Tidy up"], ["simpler", "Make it simpler"], ["continue", "Keep writing"], ["todos", "Find to-dos"], ["title", "Suggest a title"]];
  const sendTodos = async () => {
    const items = out?.items?.filter((x) => x.on) ?? [];
    if (!items.length) return;
    try {
      await api(`pages/${pageId}/planner`, { body: { tasks: items } });
      let also = "";
      if (appleAddAvailable()) { try { if (await addToAppleReminders(items.map((x) => ({ title: x.title, due: x.due, time: "" })))) also = " and Apple Reminders"; } catch { /* LifeHub has them */ } }
      say(`Added ${plural(items.length, "to-do")} to LifeHub${also}.`); onClose();
    } catch (e: any) { say(e.message); }
  };
  return <Sheet title={<span className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-[var(--an-violet)]" />AI tools</span>} onClose={onClose} wide>
    <div className="space-y-4" data-testid="pages-ai">
      <div className="flex flex-wrap gap-2">{ACTIONS.map(([a, label]) => <Btn key={a} kind={out?.action === a ? "primary" : "soft"} busy={busy === a} disabled={!!busy} onClick={() => void run(a)}>{label}</Btn>)}</div>
      {!text.trim() && <Notice>Write something first, then the AI can help with it.</Notice>}
      {out?.text && <div className="space-y-3"><div className="max-h-[45vh] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-[15px] leading-relaxed">{out.text}</div>
        <div className="flex flex-wrap gap-2">
          {out.action !== "summarize" && out.action !== "continue" ? <Btn kind="primary" onClick={() => onInsert(out.text!, true)}>Replace the note</Btn> : null}
          <Btn kind={out.action === "summarize" || out.action === "continue" ? "primary" : "soft"} onClick={() => onInsert(out.text!, false)}>Add to the end</Btn>
          <Btn kind="plain" onClick={() => void copyText(out.text!).then(() => say("Copied."))}>Copy</Btn>
        </div></div>}
      {out?.items && (out.items.length ? <div className="space-y-2">
        {out.items.map((x, i) => <label key={i} className="flex items-start gap-3 rounded-xl border border-[var(--an-line)] p-3 text-[15px]"><input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--an-violet)]" checked={x.on} onChange={(e) => setOut({ ...out, items: out.items!.map((y, k) => (k === i ? { ...y, on: e.target.checked } : y)) })} /><span>{x.title}{x.due && <span className="text-[var(--an-muted)]"> · {x.due}</span>}</span></label>)}
        <Btn kind="primary" className="w-full" onClick={() => void sendTodos()}>Add to LifeHub{appleAddAvailable() ? " and Reminders" : ""}</Btn>
      </div> : <Notice>No to-dos found in this note.</Notice>)}
    </div>
  </Sheet>;
}

function VersionsSheet({ page, onClose, onRestore }: { page: Page; onClose: () => void; onRestore: (v: { rev: number; kind: Page["kind"]; locked: boolean; content?: PageContent; cipher?: Page["cipher"] }) => void }) {
  const say = useToast();
  const [list, setList] = useState<{ rev: number; createdAt: string; bytes: number }[] | null>(null);
  useEffect(() => { api<{ versions: { rev: number; createdAt: string; bytes: number }[] }>(`pages/${page.id}/versions`).then((r) => setList(r.versions)).catch((e) => { say(e.message); setList([]); }); }, [page.id, say]);
  return <Sheet title="Version history" onClose={onClose}>
    {!list ? <Spinner /> : list.length ? <ul className="divide-y divide-[var(--an-line)]">{list.map((v) => <li key={v.rev} className="flex items-center gap-3 py-3">
      <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">{new Date(v.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span><span className="text-[13px] text-[var(--an-muted)]">{Math.max(1, Math.round(v.bytes / 1024))} KB</span></span>
      <Btn kind="soft" onClick={async () => { try { const r = await api<{ version: any }>(`pages/${page.id}/versions/${v.rev}`); onRestore(r.version); } catch (e: any) { say(e.message); } }}>Restore</Btn>
    </li>)}</ul> : <p className="text-[15px] text-[var(--an-muted)]">Earlier versions appear here as you keep writing (one every 10 minutes, the last 30 kept).</p>}
  </Sheet>;
}

function ExportSheet({ page, content, onClose }: { page: Page; content: PageContent; onClose: () => void }) {
  const say = useToast();
  const t = content.title || pageTitle({ ...page, content });
  const text = page.kind === "text" ? textOfHtml(content.html) : "";
  const B = (label: string, fn: () => void) => <Btn kind="soft" className="justify-start" onClick={() => { fn(); }}>{label}</Btn>;
  return <Sheet title="Share and export" onClose={onClose}>
    <div className="grid gap-2">
      {page.locked && <Notice tone="warn">This note is locked. A copy you export or share isn't encrypted.</Notice>}
      {page.kind === "text" ? <>
        {B("Copy text", () => void copyText(`${t}\n\n${text}`).then((ok) => say(ok ? "Copied." : "Couldn't copy.")))}
        {B("Word document (.docx)", () => exportWord(t, content.html))}
        {B("Markdown (.md)", () => exportMarkdown(t, content.html))}
        {B("Plain text (.txt)", () => exportText(t, content.html))}
        {!isNativeApp() && B("Print or save as PDF", () => { if (!printPage(t, content.html)) say("Allow pop-ups to print."); })}
        {B("Email", () => { window.location.href = mailtoLink(t, text); })}
      </> : <>
        {B("PDF of every page", () => exportInkPdf(t, content.ink))}
        {content.ink.map((p, i) => <Btn key={p.id} kind="soft" className="justify-start" onClick={() => exportInkImage(t, p, i + 1)}>Picture of page {i + 1}</Btn>)}
      </>}
    </div>
  </Sheet>;
}

function InfoSheet({ page, content, onClose }: { page: Page; content: PageContent; onClose: () => void }) {
  const wc = page.kind === "text" ? wordCount(content.html) : null;
  const strokes = content.ink.reduce((n, p) => n + p.strokes.length, 0);
  const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between gap-4 py-2 text-[15px]"><span className="text-[var(--an-muted)]">{k}</span><span className="font-semibold">{v}</span></div>;
  return <Sheet title="Info" onClose={onClose}>
    <div className="divide-y divide-[var(--an-line)]">
      <Row k="Created" v={shortDate(page.createdAt)} /><Row k="Edited" v={shortDate(page.updatedAt)} />
      {wc ? <><Row k="Words" v={wc.words.toLocaleString()} /><Row k="Characters" v={wc.chars.toLocaleString()} /><Row k="Reading time" v={`${Math.max(1, wc.minutes)} min`} /></>
        : <><Row k="Pages" v={String(content.ink.length)} /><Row k="Strokes" v={strokes.toLocaleString()} /></>}
      <Row k="Locked" v={page.locked ? "Yes, encrypted" : "No"} />
    </div>
  </Sheet>;
}

/** An AI note's summary, dropped into this note. */
function AiNotePicker({ onClose, onPick }: { onClose: () => void; onPick: (html: string) => void }) {
  const say = useToast();
  const [list, setList] = useState<{ id: string; title: string; createdAt: string }[] | null>(null);
  useEffect(() => { notesApi.list().then((r) => setList(r.notes.filter((n: any) => n.status === "ready"))).catch((e) => { say(e.message); setList([]); }); }, [say]);
  const pick = async (id: string) => {
    try {
      const { note } = await notesApi.get(id);
      onPick(aiNoteHtml({ title: note.title, createdAt: note.createdAt, durationSecs: note.durationSecs, template: note.template, summary: note.summary, segments: note.segments, speakers: note.speakers }, false));
    } catch (e: any) { say(e.message); }
  };
  return <Sheet title="Add an AI note's summary" onClose={onClose}>
    {!list ? <Spinner /> : list.length ? <ul className="max-h-[55vh] divide-y divide-[var(--an-line)] overflow-y-auto">{list.map((n) => <li key={n.id}><button type="button" className="flex w-full items-center gap-3 py-3 text-left" onClick={() => void pick(n.id)}>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--an-violet-soft)]"><Sparkles className="h-5 w-5 text-[var(--an-violet)]" /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold">{n.title || "Untitled"}</span><span className="text-[13px] text-[var(--an-muted)]">{shortDate(n.createdAt)}</span></span></button></li>)}</ul>
      : <p className="text-[15px] text-[var(--an-muted)]">Record a meeting in the AI Notes tab, and its summary can be added here.</p>}
  </Sheet>;
}
