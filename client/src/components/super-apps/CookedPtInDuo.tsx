// Cooked PT inside Arise To Duo: the trainer's clients, inbox, schedule, library and business, signed in with
// the To Duo account, in To Duo's look. The row of pages shows what's waiting (new requests, unread messages).
import { useMemo } from "react";
import { superAppOf } from "@shared/superApps";
import TrainerApp, { type TrainerEmbed } from "@/pages/trainer/TrainerApp";
import { PageStrip, SuperHead } from "./SuperShell";
import { Bell } from "lucide-react";

export default function CookedPtInDuo({ say, night, start }: { say: (m: string) => void; night: boolean; start?: string | null }) {
  const app = superAppOf("cookedpt")!;
  const embed = useMemo<TrainerEmbed>(() => ({
    night, say, start,
    top: ({ tabs, tab, go, openBell }) => <>
      <SuperHead app={app} right={<button type="button" onClick={openBell} aria-label="Cooked PT notifications" data-testid="super-cookedpt-bell"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><Bell size={18} /></button>} />
      <PageStrip app={app} pages={tabs.map((t) => t.id)} current={tab} onPick={go} badges={Object.fromEntries(tabs.map((t) => [t.id, t.badge]))} />
    </>,
  }), [night, say, start]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="super-cookedpt" data-testid="super-app-cookedpt"><TrainerApp embed={embed} /></div>;
}
