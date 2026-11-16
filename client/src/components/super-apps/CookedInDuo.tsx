// Cooked inside Arise To Duo, taken apart into plugins of its own (Nov 15, 2026): Workouts, Food & Fasting,
// Run & Steps, Sleep & Recovery and Cooked Social (shared/superApps.ts). Each one is Cooked's own screens and
// data (signed in with the To Duo account), with To Duo's heading and only its own row of pages; anything
// from another part that it links to opens as a sheet over it.
import { useMemo } from "react";
import { superAppOf, type CookedPartId } from "@shared/superApps";
import type { FitEmbed } from "@/pages/fit/FitApp";
import { FitInDuo } from "@/pages/fit/FitApp";
import { PageStrip, SuperHead } from "./SuperShell";

export default function CookedInDuo({ appId = "cooked", say, night, start, coach }: { appId?: CookedPartId; say: (m: string) => void; night: boolean; start?: string | null; coach?: string | null }) {
  const app = superAppOf(appId)!;
  const embed = useMemo<FitEmbed>(() => ({
    night, start, coach, only: app.pages.map((p) => p.id),
    top: ({ tabs, tab, go, openSettings }) => <>
      <SuperHead app={app} onSettings={openSettings} settingsLabel="Cooked settings" />
      {tabs.length > 1 && <PageStrip app={app} pages={tabs.map((t) => t.id)} current={tab} onPick={go} />}
    </>,
  }), [night, start, coach, appId]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="super-cooked" data-testid={`super-app-${appId}`}><FitInDuo say={say} embed={embed} /></div>;
}
