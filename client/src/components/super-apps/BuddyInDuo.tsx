// TTS Buddy inside Arise To Duo (WorkHub and LifeHub), opened from the menu or the Plugin Gallery like the other
// plugins: the hub's menu and header stay, and Buddy's own screens (pick teacher or student, the teacher's
// worksheet camera, a student's reader) sit in the page. Students still open arisetodo.com/buddy on their laptop.
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import TtsBuddy from "@/pages/buddy/TtsBuddy";

export default function BuddyInDuo() {
  const [mode, setMode] = useState<"" | "teach" | "kid">("");
  return (
    <div className="buddy-in-duo overflow-hidden rounded-[1.5rem] ring-1 ring-[#e7e8f0]" data-testid="buddy-in-duo">
      {mode && <div className="flex items-center gap-2 bg-white px-3 py-2 ring-1 ring-[#e7e8f0]">
        <button type="button" onClick={() => setMode("")} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" data-testid="buddy-back"><ArrowLeft size={16} />TTS Buddy</button>
        <span className="ml-auto text-xs font-semibold text-slate-500">{mode === "teach" ? "Teacher" : "Student"}</span>
      </div>}
      <TtsBuddy mode={mode || undefined} onPick={setMode} />
    </div>
  );
}
