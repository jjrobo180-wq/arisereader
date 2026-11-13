// Reading a worksheet as fast as it can feel (Nov 13): each page starts reading the moment the teacher snaps it,
// not when they tap "Make it a quiz", and the editor opens as soon as page 1 is in while the other pages keep
// reading behind it. One page at a time (all at once made the reader say "busy"), each its own small request.
// Lives above the screens, so leaving the snap screen for the editor doesn't stop it.
import type { Item, Worksheet } from "../../../../shared/ttsBuddy";

/** How the reader talks to the server and saves pictures (BuddyTeacher passes the real ones; tests pass stand-ins). */
export type ReaderApi = <T>(path: string, opts?: { method?: string; body?: unknown; teacher?: boolean }) => Promise<T>;
export type CutPictures = (ws: Worksheet, items: Item[], photo: string, page: number) => Promise<void>;

export type PageState = "waiting" | "reading" | "done" | "failed";
export type Page = { key: number; photo: string; state: PageState; removed: boolean; added: string[]; page: number; error: string };

export class WorksheetReader {
  constructor(private call: ReaderApi, private cutPictures: CutPictures) {}
  pages: Page[] = [];
  wid = "";
  title = "";
  private running = false;
  private next = 1;
  private listeners = new Set<() => void>();
  /** Pages the editor hasn't shown yet: it asks for these (and clears them) when told something changed. */
  fresh: string[] = [];

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { for (const fn of this.listeners) fn(); }

  get live() { return this.pages.filter((p) => !p.removed); }
  get busy() { return this.live.some((p) => p.state === "waiting" || p.state === "reading"); }
  get progress() { const l = this.live; return { done: l.filter((p) => p.state === "done" || p.state === "failed").length, total: l.length, missed: l.filter((p) => p.state === "failed").map((p) => l.indexOf(p) + 1) }; }
  /** Nothing snapped, or the last worksheet is finished and handed over: the next photos start a new one. */
  get idle() { return !this.busy && (!this.pages.length || !!this.handedOver); }
  handedOver = false;

  reset() { this.pages = []; this.wid = ""; this.title = ""; this.fresh = []; this.handedOver = false; this.emit(); }

  add(photos: string[]) {
    if (this.handedOver && !this.busy) this.reset();
    for (const photo of photos) if (this.live.length < 8) this.pages.push({ key: this.next++, photo, state: "waiting", removed: false, added: [], page: 0, error: "" });
    this.emit(); void this.run();
  }

  /** A page taken away before the quiz was made: if it was already read, its steps come back out. */
  async remove(key: number) {
    const p = this.pages.find((x) => x.key === key); if (!p) return;
    p.removed = true; this.emit();
    if (p.state === "done") await this.dropSteps(p);
  }
  private async dropSteps(p: Page) {
    if (!this.wid || !p.added.length) return;
    try {
      const { worksheet } = await this.call<{ worksheet: Worksheet }>(`/teacher/worksheets/${this.wid}`, { teacher: true });
      const items = worksheet.items.filter((i) => !p.added.includes(i.id));
      if (items.length) await this.call(`/teacher/worksheets/${this.wid}`, { method: "PUT", teacher: true, body: { ...worksheet, items } });
    } catch { /* the teacher can delete them in the editor */ }
  }

  /** Resolves with the worksheet as soon as its first page is in (or rejects if no page could be read). */
  first(): Promise<Worksheet> {
    return new Promise((ok, no) => {
      const check = async () => {
        if (this.wid) { off(); try { ok((await this.call<{ worksheet: Worksheet }>(`/teacher/worksheets/${this.wid}`, { teacher: true })).worksheet); } catch (e) { no(e); } return; }
        if (!this.busy) { off(); const f = this.live.find((p) => p.state === "failed"); no(new Error(f?.error || "Couldn't read those pages. Try clearer photos, straight on, in good light.")); }
      };
      const off = this.subscribe(() => void check());
      void check();
    });
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      for (;;) {
        const p = this.pages.find((x) => x.state === "waiting" && !x.removed);
        if (!p) break;
        p.state = "reading"; this.emit();
        try {
          if (!this.wid) {
            const r = await this.call<{ worksheet: Worksheet }>("/teacher/read", { teacher: true, body: { images: [p.photo] } });
            this.wid = r.worksheet.id; this.title = r.worksheet.title; p.page = 1; p.added = r.worksheet.items.map((i) => i.id);
            await this.cutPictures(r.worksheet, r.worksheet.items, p.photo, 1);
          } else {
            const r = await this.call<{ worksheet: Worksheet; added: string[]; page: number }>(`/teacher/worksheets/${this.wid}/pages`, { teacher: true, body: { image: p.photo } });
            p.page = r.page; p.added = r.added;
            await this.cutPictures(r.worksheet, r.worksheet.items.filter((x) => r.added.includes(x.id)), p.photo, r.page);
          }
          p.state = "done"; this.fresh.push(...p.added);
          if (p.removed) await this.dropSteps(p);
        } catch (e: any) { p.state = "failed"; p.error = e?.message || "Couldn't read that page."; }
        this.emit();
      }
    } finally { this.running = false; this.emit(); }
  }
}
