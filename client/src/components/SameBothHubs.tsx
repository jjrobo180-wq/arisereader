// Customize → "Same settings in both hubs" (lib/sharedLook.ts): on until the person turns it off.
import { useState } from "react";
import { sameBothHubs, setSameBothHubs } from "@/lib/sharedLook";

export default function SameBothHubs({ testId }: { testId: string }) {
  const [on, setOn] = useState(sameBothHubs);
  return <label className="mb-4 flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm" data-testid={testId}>
    <input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); setSameBothHubs(e.target.checked); }} className="mt-0.5 h-5 w-5 shrink-0 accent-slate-900" />
    <span><span className="block font-bold text-slate-900">Same settings in LifeHub and WorkHub</span>
      <span className="block text-xs text-slate-500">Night mode, theme, where the menu sits and reminders change in both hubs at once. Turn this off to set each hub its own way.</span></span>
  </label>;
}
