// The Arise tab in Arise To Do's Tasks: every "@arise" ask the person has made (shared/ariseAsks.ts), newest
// first, with what Arise made for each. Open one to read it, copy it, print it, save it as a file, make it
// again or delete it. Asks still waiting for their day show when they'll be made.
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarClock, CheckCircle2, ChevronDown, Copy, Download, Globe, Loader2, Printer, RefreshCw, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import type { AriseAsk, AskKind } from "@shared/ariseAsks";
import { deleteAsk, markAskSeen, openAsk, retryAsk } from "@/lib/ariseAsks";
import { askHtml, escHtml as esc, splitAnswerKey } from "@shared/askHtml";
export { askHtml };

const KIND_EMOJI: Record<AskKind, string> = { worksheet: "📝", quiz: "❓", lesson: "🍎", email: "✉️", list: "✅", plan: "🗓️", story: "📖", recipe: "🍲", summary: "💡", answer: "🔎", other: "✨" };
const KIND_NAME: Record<AskKind, string> = { worksheet: "Worksheet", quiz: "Quiz", lesson: "Lesson plan", email: "Message", list: "List", plan: "Plan", story: "Story", recipe: "Recipes", summary: "Summary", answer: "Answer", other: "Ask" };
const PRINT_CSS = "body{font:15px/1.7 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f1d33;max-width:760px;margin:32px auto;padding:0 20px}h1{font-size:26px;margin:0 0 4px}h2{font-size:22px}h3{font-size:18px}h4{font-size:16px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 8px;text-align:left}li.box{list-style:none;margin-left:-1.2em}li{margin:.45em 0}code{background:#f2f2f6;padding:1px 4px;border-radius:4px}.blank{display:inline-block;min-width:5em;border-bottom:1.5px solid #333;margin-left:.2em;transform:translateY(-.2em)}.name{display:flex;gap:2em;margin:6px 0 18px;font-size:14px}.name span{flex:1;border-bottom:1.5px solid #333;padding-bottom:2px}.key{page-break-before:always}";

/** What Arise made, without a first heading that just repeats the title shown above it. */
const bodyOf = (a: AriseAsk) => {
  const md = (a.result || "").trim();
  const first = /^#{1,3}\s+(.+)\n+/.exec(md);
  const same = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return first && a.title && same(first[1]) === same(a.title) ? md.slice(first[0].length) : md;
};
const isSheet = (a: AriseAsk) => a.kind === "worksheet" || a.kind === "quiz";

/** The page to print or save: the title, a name and date line on worksheets, and the answer key on its own page when wanted. */
function pageHtml(a: AriseAsk, withKey: boolean) {
  const { main, key } = splitAnswerKey(bodyOf(a));
  const name = isSheet(a) ? '<div class="name">Name: <span></span> Date: <span></span></div>' : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(a.title || "Arise")}</title><style>${PRINT_CSS}</style></head><body><h1>${esc(a.title || "Arise")}</h1>${name}${askHtml(main)}${withKey && key ? `<section class="key"><h2>Answer key</h2>${askHtml(key)}</section>` : ""}</body></html>`;
}

function printAsk(a: AriseAsk, withKey = true) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, { position: "fixed", width: "0", height: "0", border: "0", right: "0", bottom: "0" });
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) { frame.remove(); return; }
  doc.open();
  doc.write(pageHtml(a, withKey));
  doc.close();
  setTimeout(() => { try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch { /* can't print here */ } setTimeout(() => frame.remove(), 60_000); }, 250);
}

function saveAsk(a: AriseAsk) {
  const name = (a.title || "arise").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase().slice(0, 60) || "arise";
  const blob = new Blob([pageHtml(a, true)], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: `${name}.html` });
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** How Arise's writing looks in the app (askHtml's tags). Blanks are lines to write on, kept with their question. */
const DOC = "[&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-black [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-extrabold [&_h4]:mt-3 [&_h4]:font-bold [&_ol]:ml-6 [&_ol]:list-decimal [&_li]:my-1.5 [&_li]:pl-1 [&_p]:my-2 [&_table]:my-3 [&_table]:w-full [&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:ml-6 [&_ul]:list-disc [&_li.box]:-ml-5 [&_li.box]:list-none [&_hr]:my-4 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_.blank]:ml-1 [&_.blank]:inline-block [&_.blank]:w-16 [&_.blank]:translate-y-[-0.2em] [&_.blank]:border-b-2 [&_.blank]:border-slate-400 [overflow-wrap:anywhere] [&>*:first-child]:mt-0";
const shortDate = (isoString: string) => { const d = new Date(isoString); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); };

function StatusChip({ a }: { a: AriseAsk }) {
  if (a.status === "done") return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />{a.seen ? "Ready" : "New"}</span>;
  if (a.status === "working") return <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700"><Loader2 className="h-3.5 w-3.5 animate-spin" />Making it…</span>;
  if (a.status === "scheduled") return <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700"><CalendarClock className="h-3.5 w-3.5" />{a.when.replace(/^Made /, "")}</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700"><TriangleAlert className="h-3.5 w-3.5" />Didn't work</span>;
}

export function AriseAsks({ asks, loaded, open, say }: { asks: AriseAsk[]; loaded: boolean; open: string | null; say: (text: string) => void }) {
  const [busy, setBusy] = useState("");
  const current = useMemo(() => (open ? asks.find((a) => a.id === open) || null : null), [asks, open]);
  // An ask opened from a notification or straight after asking may be below the stats: bring it into view.
  const openRef = useRef<HTMLElement | null>(null);
  useEffect(() => { if (current) requestAnimationFrame(() => openRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (current?.status === "done" && !current.seen) void markAskSeen(current.id); }, [current?.id, current?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (what: string, work: () => Promise<unknown>, done: string) => {
    setBusy(what);
    try { await work(); say(done); } catch (e: any) { say(e?.message || "That didn't work."); }
    setBusy("");
  };

  if (current) {
    const answer = current.kind === "answer";
    const { main, key } = splitAnswerKey(bodyOf(current));
    const copy = () => run("copy", () => navigator.clipboard.writeText(bodyOf(current)), "Copied.");
    const btn = "inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
    return (
      <section ref={openRef} className="min-w-0 scroll-mt-24 rounded-[1.5rem] border border-[#e7e8f0] bg-white p-4 shadow-[0_8px_28px_#17152b08] sm:p-6" data-testid="arise-ask-open">
        <button type="button" onClick={() => openAsk(null)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-violet-700 hover:bg-violet-50"><ArrowLeft className="h-4 w-4" />All asks</button>
        <div className="mt-2 flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-50 text-xl" aria-hidden="true">{KIND_EMOJI[current.kind]}</span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.14em] text-violet-600">{KIND_NAME[current.kind]} <StatusChip a={current} /></p>
            <h2 className="mt-1 text-xl font-black leading-tight text-slate-900 [overflow-wrap:anywhere]">{current.title || current.ask}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500 [overflow-wrap:anywhere]">“{current.ask}” · {shortDate(current.createdAt)}{!answer && current.due ? ` · due ${new Date(`${current.due}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}` : ""}</p>
          </div>
        </div>
        {current.status === "done" && current.result ? <>
          <article className={`arise-ask-doc mt-4 rounded-2xl border border-slate-100 bg-[#fcfbff] p-4 text-[15px] leading-7 text-slate-800 sm:p-6 ${DOC}`} data-testid="arise-ask-result" dangerouslySetInnerHTML={{ __html: askHtml(main) }} />
          {key && <details className="group mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/40" data-testid="arise-ask-key">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-bold text-emerald-800">Answer key <ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary>
            <div className={`px-4 pb-4 text-[15px] leading-7 text-slate-800 ${DOC}`} dangerouslySetInnerHTML={{ __html: askHtml(key) }} />
          </details>}
          {current.source && <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500" data-testid="arise-ask-source"><Globe className="h-3.5 w-3.5" />{current.source}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={copy} disabled={!!busy} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#6e5ae0] px-3 text-sm font-bold text-white hover:bg-[#5948c8]"><Copy className="h-4 w-4" />Copy</button>
            {!answer && <button type="button" onClick={() => printAsk(current, false)} className={btn} data-testid="arise-ask-print"><Printer className="h-4 w-4" />{key ? "Print worksheet" : "Print"}</button>}
            {!answer && key && <button type="button" onClick={() => printAsk(current, true)} className={btn} data-testid="arise-ask-print-key"><Printer className="h-4 w-4" />Print with answers</button>}
            {!answer && <button type="button" onClick={() => saveAsk(current)} className={btn}><Download className="h-4 w-4" />Save</button>}
            <button type="button" onClick={() => run("retry", () => retryAsk(current.id), answer ? "Arise is checking again." : "Arise is making it again.")} disabled={!!busy} className={btn}><RefreshCw className="h-4 w-4" />{answer ? "Check again" : "Make again"}</button>
          </div>
        </> : current.status === "failed" ? (
          <div className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">{current.error || "Arise couldn't make this one."}
            <button type="button" onClick={() => run("retry", () => retryAsk(current.id), "Arise is trying again.")} disabled={!!busy} className="ml-2 font-bold underline">Try again</button></div>
        ) : (
          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-violet-50 p-5 text-sm leading-6 text-violet-900" data-testid="arise-ask-waiting">
            {current.status === "scheduled" ? <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" /> : <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />}
            <span>{current.status === "scheduled" ? <>Arise will make this <b>{current.when.replace(/^Made /, "")}</b>. You'll get a notification when it's ready.
              <button type="button" onClick={() => run("retry", () => retryAsk(current.id), "Arise is making it now.")} disabled={!!busy} className="ml-2 font-bold underline">Make it now</button></>
              : answer ? <>Arise is looking this up. The answer shows up here in a few seconds.</> : <>Arise is making this now. It usually takes under a minute, and you'll get a notification when it's ready.</>}</span>
          </div>
        )}
        <button type="button" onClick={() => { if (confirm("Delete this ask and what Arise made?")) void run("delete", () => deleteAsk(current.id), "Deleted."); }} className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-rose-500 hover:underline"><Trash2 className="h-3.5 w-3.5" />Delete this ask</button>
      </section>
    );
  }

  return (
    <section className="min-w-0 rounded-[1.5rem] border border-[#e7e8f0] bg-white p-4 shadow-[0_8px_28px_#17152b08] sm:p-6" data-testid="arise-asks">
      <p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-violet-600">Your AI helper</p>
      <h2 className="mt-1 text-xl font-black text-slate-900">Arise asks</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">Type <b className="text-violet-700">@arise</b> as a task. Ask it to make something, like a worksheet, a plan or an email, and it adds a to-do and sends a notification when it's ready. Say when, too: “by Monday” makes it now, “on Monday” makes it that morning. Ask a question, like tomorrow's weather, and it looks it up and answers here.</p>
      {!loaded ? <div className="grid min-h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-violet-600" /></div>
        : asks.length ? <ul className="mt-4 space-y-2">{asks.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => openAsk(a.id)} className={`flex w-full min-w-0 items-start gap-3 rounded-2xl border p-3 text-left transition hover:border-violet-200 hover:bg-[#fcfbff] sm:p-4 ${a.status === "done" && !a.seen ? "border-violet-200 bg-violet-50/40" : "border-[#ececf3] bg-white"}`} data-testid="arise-ask-row">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-lg" aria-hidden="true">{KIND_EMOJI[a.kind]}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-800 [overflow-wrap:anywhere] sm:text-base">{a.title || a.ask}</span>
                {a.title && <span className="mt-0.5 block line-clamp-1 text-xs text-slate-500">“{a.ask}”</span>}
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500"><StatusChip a={a} /><span>{shortDate(a.createdAt)}</span></span>
              </span>
            </button>
          </li>
        ))}</ul> : (
          <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
            <span className="rounded-2xl bg-violet-50 p-4 text-violet-600"><Sparkles className="h-[26px] w-[26px]" /></span>
            <p className="mt-4 text-lg font-extrabold text-slate-900">Nothing asked yet</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Try adding a task like:</p>
            <ul className="mt-2 space-y-1 text-sm font-semibold text-violet-700">
              <li>@arise make a worksheet for Kha by Monday</li>
              <li>@arise plan a week of easy dinners</li>
              <li>@arise email the coach about Saturday on Friday</li>
              <li>@arise what's the weather tomorrow?</li>
            </ul>
          </div>
        )}
    </section>
  );
}
