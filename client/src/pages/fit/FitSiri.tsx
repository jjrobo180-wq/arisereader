// Cooked with Siri. Every action has a link: arisefit://do/<action> opens the iPhone app and does it
// (the app registers the arisefit:// scheme: .github/scripts/configure_fit_app.py), and
// …/#/fit?do=<action> does the same on the website. A shortcut in Apple's Shortcuts app that opens the
// link runs when you say its name to Siri ("Hey Siri, start my workout"). Circle invites and guest
// passes use arisefit://circle|pass/<CODE> and …/#/fit?circle=|pass=<CODE> (shared/fitLinks.ts).
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Mic } from "lucide-react";
import { TODO_APP } from "@/lib/hubs";
import { isNativeApp, nativeCall, nativeListen } from "@/lib/nativeApp";
import { Btn, C, Card, Sheet, Title, display, haptic } from "./fitUi";
import { SIRI_ACTIONS, readLink, type FitLink, type SiriAction } from "@shared/fitLinks";
export { SIRI_ACTIONS, readLink, type SiriAction };

export const actionLink = (id: SiriAction, native = isNativeApp()) => (native ? `arisefit://do/${id}` : `${TODO_APP}#/fit?do=${id}`);

/** Runs links the app was opened with: on the website (the page address) and in the iPhone app
 *  (the link that opened it, and any opened while it's running). The address is cleaned afterwards so
 *  a reload doesn't run it again. */
export function useDeepLinks(handle: (l: FitLink) => void) {
  const fn = useRef(handle); fn.current = handle;
  useEffect(() => {
    const run = (url: string | undefined | null) => { if (!url) return; const l = readLink(url); if (l.action || l.circle || l.pass) fn.current(l); };
    const href = window.location.href;
    if (/[?&](do|circle|pass)=/.test(href)) {
      run(href);
      try { const h = window.location.hash.replace(/[?&](do|circle|pass)=[^&]*/g, "").replace(/\?$/, ""); history.replaceState(null, "", `${window.location.pathname}${window.location.search}${h}`); } catch { /* keep the address */ }
    }
    if (!isNativeApp()) return;
    nativeCall(/^App$/, "App", "getLaunchUrl").then((r: any) => run(r?.url)).catch(() => {});
    void nativeListen("App", "appUrlOpen", (e: any) => run(e?.url));
    // A tapped reminder (the morning sleep check-in, wind down) carries its link.
    void nativeListen("LocalNotifications", "localNotificationActionPerformed", (e: any) => run(e?.notification?.extra?.url));
  }, []);
}

export function SiriSheet({ onClose }: { onClose: () => void }) {
  const native = isNativeApp();
  const [copied, setCopied] = useState<string>("");
  const copy = async (id: SiriAction) => {
    try { await navigator.clipboard.writeText(actionLink(id, true)); setCopied(id); haptic("success"); window.setTimeout(() => setCopied((c) => (c === id ? "" : c)), 2500); } catch { window.prompt("Copy this link", actionLink(id, true)); }
  };
  return <Sheet title="Siri & Shortcuts" onClose={onClose} testId="fit-siri">
    <Card className="!p-4"><div className="flex items-start gap-3"><Mic className="mt-0.5 h-6 w-6 shrink-0" style={{ color: C.lime }} />
      <div><p className="text-[20px] leading-none" style={display}>"Hey Siri, start my workout"</p>
        <p className="mt-1.5 text-[14px]" style={{ color: C.steel }}>Set up each phrase once in Apple's Shortcuts app. It takes about 20 seconds.</p></div></div></Card>
    <Title>Set one up</Title>
    <Card className="!p-4"><ol className="space-y-2 text-[15px] leading-snug">
      <li><b>1.</b> Tap <b>Copy</b> next to a phrase below.</li>
      <li><b>2.</b> Open <b>Shortcuts</b>, tap <b>+</b>, then <b>Add Action</b> and pick <b>Open URLs</b>.</li>
      <li><b>3.</b> Paste the link where it says URL.</li>
      <li><b>4.</b> Tap the name at the top and rename it to the phrase (like "Start my workout"). Done.</li>
    </ol>
      <p className="mt-3 text-[13px]" style={{ color: C.dim }}>Now say "Hey Siri," then the phrase. Shortcuts can also go on your Home Screen, Action button or Back Tap.</p>
      {native && <a href="shortcuts://create-shortcut" className="mt-3 flex min-h-12 items-center justify-center rounded-[12px] text-[15px] font-semibold" style={{ background: C.card2, color: C.text }}>Open Shortcuts</a>}
      {!native && <p className="mt-3 text-[13px]" style={{ color: C.dim }}>These links open the Cooked iPhone app.</p>}</Card>
    <Title>Phrases</Title>
    <div className="space-y-2">{SIRI_ACTIONS.map((a) => <Card key={a.id} className="flex items-center gap-3 !p-3.5" testId={`fit-siri-${a.id}`}>
      <div className="min-w-0 flex-1"><p className="text-[16px] font-semibold">"{a.phrase}"</p><p className="text-[12px]" style={{ color: C.dim }}>{a.does}</p></div>
      <Btn kind="soft" className="!min-h-10 !px-3 !text-[14px]" onClick={() => void copy(a.id)}>{copied === a.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied === a.id ? "Copied" : "Copy"}</Btn>
    </Card>)}</div>
  </Sheet>;
}
