// The Google plugin (Nov 25, 2026): connect Google Docs and Calendar (and Classroom in WorkHub)
// from any hub. Docs attach to the hub's own to-dos, emails become its to-dos, and to-dos with a time go on Google
// Calendar. The hub supplies its to-do list (lib/hubTasksBridge.ts); the panels are in teacher-hub/HubGoogle.tsx.
import { useAuth } from "@/context/AuthContext";
import { useHubTasks } from "@/lib/hubTasksBridge";
import GoogleCard, { GoogleRecentDocs, useGoogleStatus } from "@/components/teacher-hub/HubGoogle";

export default function GooglePlugin() {
  const { token } = useAuth();
  const bridge = useHubTasks();
  const google = useGoogleStatus(token);
  if (!bridge) return <p className="py-10 text-center text-sm text-slate-500">Open Google from WorkHub, LifeHub or FamilyHub.</p>;
  if (!google.status) return <p className="py-10 text-center text-sm font-semibold text-slate-500">Checking Google…</p>;
  return <div data-testid="google-plugin" className="space-y-4">
    <GoogleRecentDocs token={token} status={google.status} />
    <GoogleCard token={token} bridge={bridge} status={google.status} check={google.check} />
  </div>;
}
