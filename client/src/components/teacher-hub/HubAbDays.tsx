// A/B days in the Hub calendar: today's letter, the next few days, a switch that puts them on the calendar as
// all-day events (and takes them off again), and the two ways to get them on a phone's home screen.
import { useState, type Dispatch, type SetStateAction } from "react";
import { CalendarPlus, Check, Copy, ExternalLink, Smartphone, Trash2 } from "lucide-react";
import { abLetterOn, abOnCalendar, addAbDays, removeAbDays, upcomingAb, AB_DAYS } from "@shared/abDays";
import { abWidgetScript } from "@shared/abWidgetScript";
import type { Workspace } from "@shared/teacherHub";
import { Card } from "./ui";
import { localDay } from "./HubImport";

const pillClass = (letter: "A" | "B" | null) => letter === "A" ? "bg-teal-700 text-white" : letter === "B" ? "bg-violet-700 text-white" : "bg-slate-200 text-slate-500";
const short = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const box = document.createElement("textarea");
    box.value = text; box.setAttribute("readonly", ""); box.style.position = "fixed"; box.style.opacity = "0";
    document.body.appendChild(box); box.select();
    try { document.execCommand("copy"); } catch { /* nothing more to try */ }
    box.remove();
  }
}

export default function AbDays({ workspace, setWorkspace, makeId }: { workspace: Workspace; setWorkspace: Dispatch<SetStateAction<Workspace>>; makeId: () => string }) {
  const today = localDay();
  const on = abOnCalendar(workspace);
  const [copied, setCopied] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const letter = abLetterOn(today);
  const next = upcomingAb(today, 6).filter((d) => d.date !== today).slice(0, 5);
  const last = Object.keys(AB_DAYS).sort().pop()!;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const pageUrl = `${origin}/ab-day.html`;
  const script = abWidgetScript(origin);

  return (
    <Card title="A / B days" collapseKey="hub-ab-days">
      <div className="flex flex-wrap items-center gap-3 py-3">
        <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-4xl font-black ${pillClass(letter)}`} aria-hidden>{letter || "–"}</span>
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold text-slate-900">{letter ? `Today is an ${letter} day` : "No A or B day today"}</div>
          <div className="text-sm text-slate-600">{next.length ? `Next: ${next.slice(0, 3).map((d) => `${short(d.date)} ${d.letter}`).join(" · ")}` : "No more days listed this year."}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {on ? (
          <button type="button" onClick={() => setWorkspace((p) => removeAbDays(p))} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
            <Trash2 className="h-4 w-4" /> Take A/B days off my calendar
          </button>
        ) : (
          <button type="button" onClick={() => setWorkspace((p) => addAbDays(p, makeId, today))} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800">
            <CalendarPlus className="h-4 w-4" /> Add A/B days to my calendar
          </button>
        )}
        <a href={pageUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
          <ExternalLink className="h-4 w-4" /> Open the widget page
        </a>
      </div>
      <p className="mt-2 text-xs text-slate-500">{on ? `On your calendar as all-day “A Day” and “B Day” through ${short(last)}. Your own events are not touched.` : `Adds an all-day “A Day” or “B Day” from today through ${short(last)}. You can take them off in one tap.`}</p>

      <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3" open={showScript} onToggle={(e) => setShowScript((e.target as HTMLDetailsElement).open)}>
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold text-slate-900"><Smartphone className="h-4 w-4" /> Put it on my home screen</summary>
        <div className="space-y-4 pb-1 text-sm text-slate-700">
          <div>
            <div className="font-bold text-slate-900">Easiest: a home-screen icon (iPhone or Android)</div>
            <ol className="ml-5 mt-1 list-decimal space-y-1">
              <li>Open <a className="font-semibold text-teal-700 underline" href={pageUrl} target="_blank" rel="noreferrer">{pageUrl.replace(/^https?:\/\//, "")}</a> on your phone.</li>
              <li>iPhone: tap Share, then “Add to Home Screen”. Android: tap ⋮, then “Add to Home screen”.</li>
              <li>Tap the icon any time: it opens straight to today’s big A or B.</li>
            </ol>
          </div>
          <div>
            <div className="font-bold text-slate-900">A real iPhone widget (small or medium)</div>
            <ol className="ml-5 mt-1 list-decimal space-y-1">
              <li>Get the free <a className="font-semibold text-teal-700 underline" href="https://apps.apple.com/app/scriptable/id1405459188" target="_blank" rel="noreferrer">Scriptable app</a> from the App Store.</li>
              <li>
                <button type="button" onClick={async () => { await copyText(script); setCopied(true); setTimeout(() => setCopied(false), 2500); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-3 text-sm font-bold text-white hover:bg-teal-800">
                  {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy the widget script</>}
                </button>
              </li>
              <li>In Scriptable tap +, paste, and name it “A/B Day”.</li>
              <li>On your home screen, press and hold, tap +, choose Scriptable, add it, then tap the widget → Script → “A/B Day”.</li>
            </ol>
            <p className="mt-1 text-xs text-slate-500">It keeps a copy, so it still works with no signal, and it changes by itself after midnight.</p>
          </div>
        </div>
      </details>
    </Card>
  );
}
