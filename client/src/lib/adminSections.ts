// The A.R.I.S.E. Reader admin console's sections, in menu order.
//
// They live here, apart from the admin page itself, so Arise WorkHub's Reader menu can list
// them in its one dropdown without importing (and so eagerly loading) the admin console.
import { BarChart3, BellRing, Brain, Gamepad2, Inbox, KeyRound, LayoutDashboard, Library, ListTodo, Mail, Megaphone, School, Settings, ShieldCheck, Trophy, Users, type LucideIcon } from "lucide-react";

export type AdminSection = "overview" | "stats" | "todo" | "inbox" | "people" | "library" | "schools" | "settings";

export const ADMIN_SECTIONS: { id: AdminSection; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "todo", label: "To-do", icon: ListTodo },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "people", label: "People", icon: Users },
  { id: "library", label: "Library", icon: Library },
  { id: "schools", label: "Schools & plans", icon: School },
  { id: "settings", label: "Settings", icon: Settings },
];

export const adminSectionLabel = (id: AdminSection) => ADMIN_SECTIONS.find((s) => s.id === id)?.label ?? "Overview";

// The Settings section's own parts, in menu order. On its own page the admin console shows these
// as a row of tabs across the top of Settings; inside Arise WorkHub they are listed in the
// sidebar under Admin console → Settings instead, with the rest of A.R.I.S.E. Reader's items.
export type SettingsSection = "programs" | "alerts" | "banners" | "family-emails" | "club" | "ai" | "extras" | "security";

export const SETTINGS_SECTIONS: { id: SettingsSection; label: string; icon: LucideIcon }[] = [
  { id: "programs", label: "Arise programs", icon: ShieldCheck },
  { id: "alerts", label: "Notifications", icon: BellRing },
  { id: "banners", label: "Banners", icon: Megaphone },
  { id: "family-emails", label: "Family emails", icon: Mail },
  { id: "club", label: "Club & play time", icon: Gamepad2 },
  { id: "ai", label: "AI quizzes", icon: Brain },
  { id: "extras", label: "Competition & extras", icon: Trophy },
  { id: "security", label: "Proctor password", icon: KeyRound },
];

export const settingsSectionLabel = (id: SettingsSection) => SETTINGS_SECTIONS.find((s) => s.id === id)?.label ?? "Settings";
