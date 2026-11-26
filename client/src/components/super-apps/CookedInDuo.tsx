// Arise Health & Fitness inside Arise To Do (the Cooked app's screens and data, signed in with the To Do account),
// in To Do's look, under To Do's heading and tab bar. Its tabs are Today and every part with a screen of its
// own; Edit (FitTabsEditor.tsx) turns tabs and Today's tools on and off and puts them in order.
import { useMemo } from "react";
import { superAppOf } from "@shared/superApps";
import type { FitEmbed } from "@/pages/fit/FitApp";
import { FitInDuo } from "@/pages/fit/FitApp";
import { PageStrip, SuperHead } from "./SuperShell";
import { InDuoCtx } from "@/pages/fit/fitUi";

export default function CookedInDuo({ say, night, start, coach }: { say: (m: string) => void; night: boolean; start?: string | null; coach?: string | null }) {
  const app = superAppOf("cooked")!;
  const embed = useMemo<FitEmbed>(() => ({
    night, start, coach,
    top: ({ tabs, tab, go, openSettings, editTabs, groupWaiting }) => {
      // Cooked's own names for its pages, with the shorter To Do labels where they exist.
      const known = { ...app, pages: tabs.map((t) => ({ id: t.id, label: t.label, icon: app.pages.find((p) => p.id === t.id)?.icon ?? "Circle" })) };
      return <>
        <SuperHead app={app} onSettings={openSettings} settingsLabel="Health & Fitness settings" tabs={<PageStrip app={known} pages={tabs.map((t) => t.id)} current={tab} onPick={go} onEdit={editTabs} dots={Object.fromEntries(tabs.map((t) => [t.id, groupWaiting(t.id)]))} />} />
      </>;
    },
  }), [night, start, coach]); // eslint-disable-line react-hooks/exhaustive-deps
  return <InDuoCtx.Provider value><div className="super-cooked" data-testid="super-app-cooked"><FitInDuo say={say} embed={embed} /></div></InDuoCtx.Provider>;
}
