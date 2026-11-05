// A/B days in the Hub calendar: today's letter, the next few days, a switch that puts them on the calendar as
// all-day events (and takes them off again).
import type { Dispatch, SetStateAction } from "react";
import { CalendarPlus, Trash2 } from "lucide-react";
import { abLetterOn, abOnCalendar, addAbDays, removeAbDays, upcomingAb, AB_DAYS } from "@shared/abDays";
import type { Workspace } from "@shared/teacherHub";
import { Card } from "./ui";
import { localDay } from "./HubImport";

const pillClass = (letter: "A" | "B" | null) => letter === "A" ? "bg-teal-700 text-white" : letter === "B" ? "bg-violet-700 text-white" : "bg-slate-200 text-slate-500";
const short = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export default function AbDays({ workspace, setWorkspace, makeId }: { workspace: Workspace; setWorkspace: Dispatch<SetStateAction<Workspace>>; makeId: () => string }) {
  const today = localDay();
  const on = abOnCalendar(workspace);
  const letter = abLetterOn(today);
  const next = upcomingAb(today, 6).filter((d) => d.date !== today).slice(0, 5);
  const last = Object.keys(AB_DAYS).sort().pop()!;

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
      </div>
      <p className="mt-2 text-xs text-slate-500">{on ? `On your calendar as all-day “A Day” and “B Day” through ${short(last)}. Your own events are not touched.` : `Adds an all-day “A Day” or “B Day” from today through ${short(last)}. You can take them off in one tap.`}</p>

    </Card>
  );
}
