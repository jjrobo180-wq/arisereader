// Cooked inside Arise To Duo: Cooked's own screens and data (signed in with the To Duo account), in To Duo's
// look, under To Duo's heading and row of pages. Its pages are Today, every Cooked plugin that has a screen
// of its own, and Plugins, where Cooked's add-ons are added and removed (the same list as the Cooked app).
import { useMemo } from "react";
import { superAppOf } from "@shared/superApps";
import type { FitEmbed } from "@/pages/fit/FitApp";
import { FitInDuo } from "@/pages/fit/FitApp";
import { PageStrip, SuperHead } from "./SuperShell";

export default function CookedInDuo({ say, night, start, coach }: { say: (m: string) => void; night: boolean; start?: string | null; coach?: string | null }) {
  const app = superAppOf("cooked")!;
  const embed = useMemo<FitEmbed>(() => ({
    night, start, coach,
    top: ({ tabs, tab, go, openSettings }) => {
      // Cooked's own names for its pages, with the shorter To Duo labels where they exist.
      const known = { ...app, pages: tabs.map((t) => ({ id: t.id, label: t.label, icon: app.pages.find((p) => p.id === t.id)?.icon ?? "Circle" })) };
      return <>
        <SuperHead app={app} onSettings={openSettings} settingsLabel="Cooked settings" />
        <PageStrip app={known} pages={tabs.map((t) => t.id)} current={tab} onPick={go} />
      </>;
    },
  }), [night, start, coach]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="super-cooked" data-testid="super-app-cooked"><FitInDuo say={say} embed={embed} /></div>;
}
