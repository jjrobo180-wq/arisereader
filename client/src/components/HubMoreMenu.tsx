// The ⋯ menu in LifeHub and WorkHub (October 2026): one place for notifications and every setting, the
// same items in the same order in both hubs, in groups so it's easy to find things. The tab bar's You
// sheet (PhoneTabBar) shows the same items.
import { useEffect, useRef, type ReactNode } from "react";
import { Bell, BellRing, HelpCircle, Lock, LogOut, Moon, Settings2, ShieldCheck, ShoppingBag, Smartphone, Sun } from "lucide-react";
import { isNativeApp } from "@/lib/nativeApp";

export type MoreItem = { id: string; label: string; detail?: string; icon: ReactNode; onClick: () => void; danger?: boolean };
export type MoreGroup = { title: string; items: MoreItem[] };

/** Opens the first-run walkthrough again (components/AppWalkthrough.tsx). */
export const WALKTHROUGH_EVENT = "arise:walkthrough";
/** Opens the iPhone setup (notifications, iPhone Calendar, Apple Reminders) on its own, from the ⋯ menu. */
export const IPHONE_SETUP_EVENT = "arise:iphone-setup";

/** The groups both hubs show, given what each item does in that hub. */
export function hubMoreGroups(o: {
  openNotifications: () => void; notificationSettings: () => void; customize: () => void; night: boolean; toggleNight: () => void;
  lock: () => void; gallery: () => void; privacy: () => void; signOut: () => void; extra?: MoreItem[];
}): MoreGroup[] {
  return [
    { title: "Notifications", items: [
      { id: "notifications", label: "Notifications", detail: "What's new and what's due", icon: <Bell />, onClick: o.openNotifications },
      { id: "notification-settings", label: "Notification settings", detail: "Reminders on this phone and in the app", icon: <BellRing />, onClick: o.notificationSettings },
      // In the iPhone app: the first-run setup again, for anything skipped then.
      ...(isNativeApp() ? [{ id: "iphone-setup", label: "iPhone connections", detail: "Notifications, Calendar and Reminders", icon: <Smartphone />, onClick: () => window.dispatchEvent(new Event(IPHONE_SETUP_EVENT)) }] : []),
    ] },
    { title: "Settings", items: [
      { id: "customize", label: "Customize", detail: "Menu, Home, theme and split screen", icon: <Settings2 />, onClick: o.customize },
      { id: "night", label: o.night ? "Day mode" : "Night mode", icon: o.night ? <Sun /> : <Moon />, onClick: o.toggleNight },
      { id: "lock", label: "Passcode & locks", icon: <Lock />, onClick: o.lock },
      { id: "gallery", label: "App Gallery", detail: "Add apps and connections", icon: <ShoppingBag />, onClick: o.gallery },
      ...(o.extra ?? []),
    ] },
    { title: "Help & account", items: [
      { id: "walkthrough", label: "How to use Arise To Duo", detail: "The quick tour again", icon: <HelpCircle />, onClick: () => window.dispatchEvent(new Event(WALKTHROUGH_EVENT)) },
      { id: "privacy", label: "Account & privacy", detail: "Your account, data and deleting it", icon: <ShieldCheck />, onClick: o.privacy },
      { id: "signout", label: "Sign out", icon: <LogOut />, danger: true, onClick: o.signOut },
    ] },
  ];
}

/** Opens the hub's notification list (the bell in the header). */
export const openNotificationBell = () => { document.querySelector<HTMLElement>('[data-testid="notification-bell"]')?.click(); };

export function HubMoreMenu({ groups, status, open, setOpen, testId, buttonClass, panelClass = "" }: {
  groups: MoreGroup[]; status?: ReactNode; open: boolean; setOpen: (v: boolean) => void; testId: string; buttonClass: string; panelClass?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, setOpen]);
  return <div className="relative" ref={box}>
    <button type="button" onClick={() => setOpen(!open)} aria-label="More" aria-haspopup="menu" aria-expanded={open} className={buttonClass} data-testid={testId}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
    </button>
    {open && <>
      <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
      <div role="menu" data-testid={`${testId}-menu`} className={`absolute right-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(78dvh,640px)] w-72 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl ${panelClass}`}>
        {status && <div className="px-3 pb-1 pt-2 text-xs font-medium text-slate-500">{status}</div>}
        {groups.map((g, gi) => <div key={g.title} className={gi ? "mt-1 border-t border-slate-100 pt-1" : ""}>
          <p className="px-3 pb-0.5 pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{g.title}</p>
          {g.items.map((it) => <button key={it.id} type="button" role="menuitem" onClick={() => { setOpen(false); it.onClick(); }} data-testid={`${testId}-${it.id}`}
            className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left text-sm font-medium hover:bg-slate-50 ${it.danger ? "text-rose-600" : "text-slate-700"}`}>
            <span className={`shrink-0 [&_svg]:h-[17px] [&_svg]:w-[17px] ${it.danger ? "text-rose-500" : "text-slate-500"}`}>{it.icon}</span>
            <span className="min-w-0"><span className="block truncate">{it.label}</span>{it.detail && <span className="block truncate text-xs font-normal text-slate-500">{it.detail}</span>}</span>
          </button>)}
        </div>)}
      </div>
    </>}
  </div>;
}
