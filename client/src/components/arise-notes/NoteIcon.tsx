// Arise Notes icons: line icons for note types and template categories, in place of emoji.
import { BookOpen, Calendar, FileText, GraduationCap, Heart, HeartPulse, Home, LayoutGrid, Mic, Plane, PiggyBank, School, Sparkles, Stethoscope, Users, UsersRound, Utensils, Zap, Puzzle, type LucideIcon } from "lucide-react";

const NOTE: Record<string, LucideIcon> = {
  general: FileText, iep: Puzzle, parent: UsersRound, staff: School, lecture: GraduationCap, doctor: Stethoscope, interview: Mic, memo: Zap,
};
export function NoteTypeIcon({ id, className = "h-5 w-5" }: { id: string; className?: string }) {
  const I = NOTE[id] || FileText;
  return <I className={className} aria-hidden />;
}

const CAT: Record<string, LucideIcon> = {
  Meetings: Users, Everyday: LayoutGrid, "Food & health": Utensils, "Home & family": Home, "School & teaching": GraduationCap,
  Planning: Calendar, Money: PiggyBank, "Faith & mind": Heart, Travel: Plane,
};
export function CategoryIcon({ category, className = "h-5 w-5" }: { category: string; className?: string }) {
  const I = CAT[category] || BookOpen;
  return <I className={className} aria-hidden />;
}
export { HeartPulse, Sparkles };
