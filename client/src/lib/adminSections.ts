// The A.R.I.S.E. Reader admin console's sections, in menu order.
//
// They live here, apart from the admin page itself, so Arise WorkHub's Reader menu can list
// them in its one dropdown without importing (and so eagerly loading) the admin console.
import { BarChart3, Inbox, LayoutDashboard, Library, ListTodo, School, Settings, Users, type LucideIcon } from "lucide-react";

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
