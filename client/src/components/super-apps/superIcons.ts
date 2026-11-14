// The icons named in shared/superApps.ts (the apps and their pages), for To Duo's page pills and menu.
import {
  Apple, ArrowDownToLine, AudioLines, BarChart3, BookOpen, Briefcase, CalendarDays, CalendarHeart, Clock, Droplets, Dumbbell, Flower2, Footprints,
  GalleryVertical, GraduationCap, HeartHandshake, HeartPulse, Home, Inbox, LayoutGrid, Library, Medal, MessageCircle, Mic, Mic2, Moon, Music,
  NotebookPen, PersonStanding, Pill, Podcast, Radio, Route, Settings, Sparkles, ThumbsUp, Timer, Upload, Users, Wind, Zap, Circle, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Apple, ArrowDownToLine, AudioLines, BarChart3, BookOpen, Briefcase, CalendarDays, CalendarHeart, Clock, Droplets, Dumbbell, Flower2, Footprints,
  GalleryVertical, GraduationCap, HeartHandshake, HeartPulse, Home, Inbox, LayoutGrid, Library, Medal, MessageCircle, Mic, Mic2, Moon, Music,
  NotebookPen, PersonStanding, Pill, Podcast, Radio, Route, Settings, Sparkles, ThumbsUp, Timer, Upload, Users, Wind, Zap,
};

export const superIcon = (name: string): LucideIcon => ICONS[name] ?? Circle;
