// Arise WorkHub: turn phone notifications on for this device, then choose which reminders arrive and when.
// The choices are saved with the workspace (workspace.notify), so they apply on every device.
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { CalendarDays, CheckSquare, Sun, Timer, Users } from "lucide-react";
import { HUB_HEADS_UP_CHOICES, cleanHubNotify, type HubNotify } from "@shared/hubNotify";
import { clock12, type Workspace } from "@shared/teacherHub";
import HubNotifications from "./HubNotifications";
import { Card } from "./ui";

function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
    className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-emerald-500" : "bg-slate-300"}`}>
    <span className={`toggle-knob absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
  </button>;
}

function Row({ icon, tint, title, detail, on, onChange, children }: { icon: ReactNode; tint: string; title: string; detail: string; on: boolean; onChange: (on: boolean) => void; children?: ReactNode }) {
  return <li className="py-3">
    <div className="flex items-center gap-3">
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`} aria-hidden>{icon}</span>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{title}</p><p className="text-xs text-slate-500">{detail}</p></div>
      <Switch on={on} onChange={onChange} label={title} />
    </div>
    {on && children && <div className="mt-3 pl-0 sm:pl-[52px]">{children}</div>}
  </li>;
}

export default function HubNotifySettings({ token, workspace, setWorkspace, deviceCard = true, inModal = false }: {
  token: string | null; workspace: Workspace; setWorkspace: Dispatch<SetStateAction<Workspace>>;
  /** Show the "turn notifications on for this device" card above the choices. */
  deviceCard?: boolean;
  /** In a pop-up the cards stay open instead of folding shut. */
  inModal?: boolean;
}) {
  const prefs = cleanHubNotify(workspace.notify);
  const set = (fn: (p: HubNotify) => HubNotify) => setWorkspace((w) => ({ ...w, notify: fn(cleanHubNotify(w.notify)) }));
  const head = prefs.headsUp;
  const minutesLabel = (n: number) => (n === 60 ? "1 hr" : `${n} min`);
  const [h, m] = prefs.morning.time.split(":").map(Number);
  const sub = (n: HubNotify["headsUp"]) => n.on && (n.events || n.tasks || n.meetings);

  return <div className="space-y-4" data-testid="hub-notify-settings">
    {deviceCard && <HubNotifications token={token} collapseKey={inModal ? "" : undefined} />}
    <Card title="Which reminders" collapseKey={inModal ? undefined : "home-reminders"}>
      <p className="mb-1 text-sm text-slate-600">Pick the reminders you want and when they arrive. Your choices are saved to your account and work on every device where notifications are on.</p>
      <ul className="divide-y divide-slate-100">
        <Row icon={<Sun className="h-5 w-5" />} tint="bg-amber-50 text-amber-600" title="Morning summary" detail="What's on today: events, meetings and to-dos in one note"
          on={prefs.morning.on} onChange={(on) => set((p) => ({ ...p, morning: { ...p.morning, on } }))}>
          <label className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
            <span className="font-medium">Send at</span>
            <input type="time" value={prefs.morning.time} onChange={(e) => e.target.value && set((p) => ({ ...p, morning: { ...p.morning, time: e.target.value } }))}
              className="min-h-11 w-[8.5rem] rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 sm:text-sm" data-testid="hub-notify-morning-time" />
            <span className="text-xs text-slate-500">Sent once a day, between {clock12(prefs.morning.time)} and {clock12(`${String((h + 5) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`)}.</span>
          </label>
        </Row>
        <Row icon={<Timer className="h-5 w-5" />} tint="bg-violet-50 text-violet-600" title="Heads-up before things start" detail="For anything with a start time"
          on={head.on} onChange={(on) => set((p) => ({ ...p, headsUp: { ...p.headsUp, on } }))}>
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">How early</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="How early">
                {HUB_HEADS_UP_CHOICES.map((n) => <button key={n} type="button" role="radio" aria-checked={head.minutes === n} onClick={() => set((p) => ({ ...p, headsUp: { ...p.headsUp, minutes: n } }))}
                  className={`min-h-11 rounded-full px-4 text-sm font-semibold ring-1 ${head.minutes === n ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-600 ring-slate-200"}`}>{minutesLabel(n)}</button>)}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">For</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {([["events", "Calendar events", <CalendarDays key="e" className="h-4 w-4" />], ["meetings", "IEP & meetings", <Users key="m" className="h-4 w-4" />], ["tasks", "To-dos with a time", <CheckSquare key="t" className="h-4 w-4" />]] as const).map(([key, label, icon]) => (
                  <label key={key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800">
                    <input type="checkbox" className="h-5 w-5 shrink-0" checked={head[key]} onChange={(e) => set((p) => ({ ...p, headsUp: { ...p.headsUp, [key]: e.target.checked } }))} data-testid={`hub-notify-${key}`} />
                    <span className="text-slate-500">{icon}</span><span className="min-w-0 flex-1">{label}</span>
                  </label>
                ))}
              </div>
              {head.on && !sub(head) && <p className="mt-2 text-xs text-amber-700">Pick at least one, or switch the heads-up off.</p>}
            </div>
          </div>
        </Row>
      </ul>
    </Card>
  </div>;
}
