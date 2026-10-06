// Teacher Hub: "Add with AI". The teacher types or pastes something, adds photos
// or screenshots, or uploads a file. The server reads it and sends back suggested
// items; the teacher checks them here, fixes anything that is off, and only then
// are they added to the Hub.
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { ArrowLeft, Check, Edit3, ImagePlus, Loader2, Upload, WandSparkles, X } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import {
  HUB_IMPORT, HUB_IMPORT_KINDS, HUB_IMPORT_LIMITS, describeHubItem, emptyHubImport, hubImportCount,
  type HubField, type HubImportItem, type HubImportItems, type HubImportKind,
} from "@shared/teacherHub";
import { Field, GhostButton, PrimaryButton, Select, TextArea } from "./ui";

type Attachment =
  | { id: string; kind: "image"; name: string; dataUrl: string }
  | { id: string; kind: "file"; name: string; base64: string };

const IMAGE_NAME = /\.(png|jpe?g|webp|gif|heic|heif|bmp)$/i;
export const HUB_FILE_ACCEPT = ".xlsx,.xlsm,.csv,.tsv,.docx,.pdf,.txt,.ics,image/*";

/** Today where the teacher is, as YYYY-MM-DD. */
export function localDay(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function localZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; }
}

/** A photo made small enough to send: at most 1,800 pixels on its long side, saved as a JPEG. */
async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("unreadable"));
      el.src = url;
    });
    const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight, 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("unreadable");
    context.fillStyle = "#ffffff"; // a see-through screenshot would turn black as a JPEG
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.84);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const newId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

type Props = {
  token: string | null;
  /** Names on the caseload, so the AI can match "Jordan" to "Jordan Lee". */
  students: string[];
  /** Adds the checked items to the Hub. */
  onAdd: (items: HubImportItems) => void;
  onClose: () => void;
  /** Open the photo or the file picker straight away. */
  start?: "photo" | "file";
};

export default function HubImport({ token, students, onAdd, onClose, start }: Props) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [found, setFound] = useState<{ items: HubImportItems; summary: string; usedAI: boolean } | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (start === "photo") photoRef.current?.click();
    else if (start === "file") fileRef.current?.click();
    else textRef.current?.focus();
  }, [start]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function addFiles(list: FileList | File[] | null) {
    const files = Array.from(list || []);
    if (!files.length) return;
    setError("");
    const next = [...attachments];
    for (const file of files) {
      const isImage = file.type.startsWith("image/") || IMAGE_NAME.test(file.name);
      if (isImage) {
        if (next.filter((a) => a.kind === "image").length >= HUB_IMPORT_LIMITS.images) { setError(`Add up to ${HUB_IMPORT_LIMITS.images} photos at a time.`); continue; }
        try {
          next.push({ id: newId(), kind: "image", name: file.name || "Screenshot", dataUrl: await shrinkImage(file) });
        } catch {
          setError("That photo could not be opened. Try a screenshot, or save it as a JPEG first.");
        }
        continue;
      }
      if (file.size > HUB_IMPORT_LIMITS.fileBytes) { setError("That file is too large. The most this page can read is 8 MB."); continue; }
      // One file at a time: a new one takes the place of the last.
      const without = next.filter((a) => a.kind !== "file");
      next.length = 0;
      next.push(...without, { id: newId(), kind: "file", name: file.name, base64: await toBase64(file) });
    }
    setAttachments(next);
  }

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    // A copied screenshot arrives as a file, not as text.
    const files = Array.from(e.clipboardData?.files || []);
    if (!files.length) return;
    e.preventDefault();
    void addFiles(files);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    void addFiles(e.dataTransfer?.files || null);
  }

  async function read() {
    if (busy || (!text.trim() && !attachments.length)) return;
    setBusy(true);
    setError("");
    try {
      const file = attachments.find((a): a is Extract<Attachment, { kind: "file" }> => a.kind === "file");
      const response = await fetch(`${API_BASE}/api/teacher-hub/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          text: text.trim(),
          images: attachments.filter((a): a is Extract<Attachment, { kind: "image" }> => a.kind === "image").map((a) => a.dataUrl),
          file: file ? { name: file.name, data: file.base64 } : undefined,
          today: localDay(),
          timeZone: localZone(),
          students,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || (response.status === 413 ? "That is too large to read at once. Try fewer photos or a smaller file." : "That could not be read right now. Try again in a moment."));
      setFound({ items: { ...emptyHubImport(), ...(data.items || {}) }, summary: String(data.summary || ""), usedAI: data.usedAI !== false });
      setOff(new Set());
      setEditing(null);
    } catch (err: any) {
      setError(err?.message || "That could not be read right now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  const total = found ? hubImportCount(found.items) : 0;
  const chosen = useMemo(() => {
    if (!found) return emptyHubImport();
    const out = emptyHubImport();
    for (const kind of HUB_IMPORT_KINDS) out[kind] = found.items[kind].filter((_item, index) => !off.has(`${kind}:${index}`));
    return out;
  }, [found, off]);
  const chosenCount = hubImportCount(chosen);

  function change(kind: HubImportKind, index: number, name: string, value: string | number | boolean | null) {
    setFound((prev) => prev && { ...prev, items: { ...prev.items, [kind]: prev.items[kind].map((item, i) => (i === index ? { ...item, [name]: value } : item)) } });
  }

  const canRead = !busy && (!!text.trim() || attachments.length > 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Add with AI" data-testid="hub-import">
      <div
        className={`flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${dragging ? "ring-4 ring-teal-400" : ""}`}
        onDragOver={(e) => { e.preventDefault(); if (!found) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={found ? undefined : onDrop}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-950"><WandSparkles className="h-5 w-5 shrink-0 text-teal-600" /> {found ? "Check what was found" : "Add with AI"}</div>
            <p className="mt-1 text-sm text-slate-600">
              {found
                ? found.summary || (total ? `${total} ${total === 1 ? "thing" : "things"} to add.` : "")
                : "Paste or type anything, add a photo or screenshot, or upload a file. It gets sorted into your Hub, and you check it before anything is saved."}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="-m-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-40"><X className="h-5 w-5" /></button>
        </div>

        {!found && (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
              <TextArea
                ref={textRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onPaste={onPaste}
                maxLength={HUB_IMPORT_LIMITS.textChars}
                placeholder={"Paste a list, notes, an email or a class roster…\n\nOr ask for something: “Make a to-do list to get ready for Jordan's IEP meeting on Friday.”"}
                className="min-h-40"
                aria-label="Type or paste here"
                data-testid="hub-import-text"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => photoRef.current?.click()} className="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50">
                  <ImagePlus className="h-5 w-5 shrink-0 text-teal-600" />
                  <span><span className="block text-sm font-semibold text-slate-900">Photo or screenshot</span><span className="block text-xs text-slate-500">Reminders, notes, a calendar, a whiteboard</span></span>
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50">
                  <Upload className="h-5 w-5 shrink-0 text-teal-600" />
                  <span><span className="block text-sm font-semibold text-slate-900">Upload a file</span><span className="block text-xs text-slate-500">Excel, Word, PDF, CSV or a calendar file</span></span>
                </button>
              </div>
              <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} data-testid="hub-import-photo" />
              <input ref={fileRef} type="file" accept={HUB_FILE_ACCEPT} hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} data-testid="hub-import-file" />

              {attachments.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Added photos and files">
                  {attachments.map((a) => (
                    <li key={a.id} className="flex max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-1 pl-1 pr-1 text-sm">
                      {a.kind === "image"
                        ? <img src={a.dataUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                        : <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-teal-700"><Upload className="h-4 w-4" /></span>}
                      <span className="min-w-0 truncate text-slate-700">{a.name}</span>
                      <button type="button" aria-label={`Remove ${a.name}`} onClick={() => setAttachments((list) => list.filter((x) => x.id !== a.id))} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-red-600"><X className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              )}

              {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}
              <p className="text-xs leading-5 text-slate-500">
                What you add here is sent to an AI service (OpenAI) to be read. A.R.I.S.E. does not keep the photo, file or text you send. Leave out anything you are not allowed to share. You can also copy a screenshot and paste it into the box.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3 sm:px-6">
              <GhostButton onClick={onClose}>Cancel</GhostButton>
              <PrimaryButton onClick={() => void read()} disabled={!canRead}>
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Reading…</> : <><WandSparkles className="h-4 w-4" /> Read it</>}
              </PrimaryButton>
            </div>
          </>
        )}

        {found && (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
              {total === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-600">
                  Nothing to add was found. Try a clearer photo, or paste the words instead.
                </div>
              )}
              {HUB_IMPORT_KINDS.filter((kind) => found.items[kind].length > 0).map((kind) => (
                <section key={kind} aria-label={HUB_IMPORT[kind].label}>
                  <h3 className="mb-2 flex items-baseline justify-between gap-3 text-sm font-semibold text-slate-900">
                    <span>{HUB_IMPORT[kind].label}</span>
                    <span className="text-xs font-medium text-slate-500">{found.items[kind].length}</span>
                  </h3>
                  <ul className="space-y-2">
                    {found.items[kind].map((item, index) => {
                      const key = `${kind}:${index}`;
                      const on = !off.has(key);
                      const words = describeHubItem(kind, item);
                      return (
                        <li key={key} className={`rounded-2xl border p-3 ${on ? "border-slate-200" : "border-slate-100 bg-slate-50"}`}>
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={on} aria-label={`Add ${words.title}`}
                              onChange={() => setOff((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; })}
                            />
                            <div className={`min-w-0 flex-1 ${on ? "" : "opacity-50"}`}>
                              <div className="line-clamp-3 whitespace-pre-wrap break-words text-sm font-medium text-slate-900">{words.title || "(blank)"}</div>
                              {words.detail && <div className="mt-0.5 line-clamp-2 break-words text-xs text-slate-500">{words.detail}</div>}
                            </div>
                            <button type="button" onClick={() => setEditing(editing === key ? null : key)} aria-expanded={editing === key} aria-label={editing === key ? undefined : `Change ${words.title}`} className="-m-1 inline-flex h-10 shrink-0 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                              {editing === key ? <><Check className="h-4 w-4" /> Done</> : <><Edit3 className="h-4 w-4" /> Change</>}
                            </button>
                          </div>
                          {editing === key && (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {Object.entries(HUB_IMPORT[kind].fields as Record<string, HubField>).map(([name, field]) => (
                                <ItemField key={name} field={field} value={item[name]} onChange={(value) => change(kind, index, name, value)} />
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 sm:px-6">
              <GhostButton onClick={() => { setFound(null); setError(""); }}><ArrowLeft className="h-4 w-4" /> Back</GhostButton>
              <PrimaryButton onClick={() => onAdd(chosen)} disabled={chosenCount === 0}>
                <Check className="h-4 w-4" /> {chosenCount ? `Add ${chosenCount} to my Hub` : "Nothing chosen"}
              </PrimaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** One field of a suggested item, in the right kind of box. */
function ItemField({ field, value, onChange }: { field: HubField; value: HubImportItem[string]; onChange: (value: string | number | boolean | null) => void }) {
  const label = <span className="mb-1 block text-xs font-medium text-slate-600">{field.label}</span>;
  if (field.kind === "flag") {
    return <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-5 w-5" checked={value === true} onChange={(e) => onChange(e.target.checked)} /> {field.label}</label>;
  }
  if (field.kind === "choice") {
    return <label className="block">{label}<Select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>{field.options.map((option) => <option key={option} value={option}>{option || "One-time"}</option>)}</Select></label>;
  }
  if (field.kind === "number") {
    return <label className="block">{label}<Field type="number" value={value === null || value === undefined ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? field.fallback : Number(e.target.value))} /></label>;
  }
  if (field.kind === "text" && field.long) {
    return <label className="block sm:col-span-2">{label}<TextArea value={String(value ?? "")} maxLength={field.max} onChange={(e) => onChange(e.target.value)} /></label>;
  }
  return (
    <label className="block">
      {label}
      <Field
        type={field.kind === "date" ? "date" : field.kind === "time" ? "time" : "text"}
        value={String(value ?? "")}
        maxLength={field.kind === "text" ? field.max : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
