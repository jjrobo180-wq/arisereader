// Cooked PT inside Arise To Duo: the trainer's clients, inbox, schedule, library and business, signed in with
// the To Duo account, in To Duo's look. The row of pages shows what's waiting (new requests, unread messages).
import { useMemo } from "react";
import { superAppOf } from "@shared/superApps";
import TrainerApp, { type TrainerEmbed } from "@/pages/trainer/TrainerApp";
import { PageStrip, SuperHead } from "./SuperShell";

export default function CookedPtInDuo({ say, night, start }: { say: (m: string) => void; night: boolean; start?: string | null }) {
  const app = superAppOf("cookedpt")!;
  const embed = useMemo<TrainerEmbed>(() => ({
    night, say, start,
    // Its notifications are the bell on Clients and Schedule, as in the app.
    top: ({ tabs, tab, go }) => <>
      <SuperHead app={app} />
      <PageStrip app={app} pages={tabs.map((t) => t.id)} current={tab} onPick={go} badges={Object.fromEntries(tabs.map((t) => [t.id, t.badge]))} />
    </>,
  }), [night, say, start]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="super-cookedpt" data-testid="super-app-cookedpt"><TrainerApp embed={embed} /></div>;
}
