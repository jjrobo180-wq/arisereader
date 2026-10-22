// Toolbar icons for Arise Office drawn here (24 × 24, stroke style matching lucide), so the
// editors don't depend on icon names that differ between icon-library versions.
import type { ReactNode } from "react";

type P = { size?: number; className?: string };
const make = (paths: ReactNode) => ({ size = 16, className }: P) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths}</svg>
);

export const RemoveFormatting = make(<><path d="M4 7V4h16v3" /><path d="M5 20h6" /><path d="M13 4 8 20" /><path d="m15 15 5 5" /><path d="m20 15-5 5" /></>);
export const Highlighter = make(<><path d="m9 11-6 6v3h9l3-3" /><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" /></>);
export const BringToFront = make(<><rect x="8" y="8" width="8" height="8" rx="2" /><path d="M4 10a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2" /><path d="M14 20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2" /></>);
export const SendToBack = make(<><rect x="14" y="14" width="8" height="8" rx="2" /><rect x="2" y="2" width="8" height="8" rx="2" /><path d="M7 14v1a2 2 0 0 0 2 2h1" /><path d="M14 7h1a2 2 0 0 1 2 2v1" /></>);
export const PanelLeft = make(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></>);
export const Baseline = make(<><path d="M4 20h16" /><path d="m6 16 6-12 6 12" /><path d="M8 12h8" /></>);
export const MoveVertical = make(<><path d="M12 2v20" /><path d="m8 18 4 4 4-4" /><path d="m8 6 4-4 4 4" /></>);
export const ArrowUpToLine = make(<><path d="M5 3h14" /><path d="m18 13-6-6-6 6" /><path d="M12 7v14" /></>);
export const ArrowDownToLine = make(<><path d="M12 17V3" /><path d="m6 11 6 6 6-6" /><path d="M19 21H5" /></>);
export const PaintBucket = make(<><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z" /><path d="m5 2 5 5" /><path d="M2 13h15" /><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z" /></>);
export const Indent = make(<><path d="M21 5H3" /><path d="M21 12H11" /><path d="M21 19H3" /><path d="m3 8 4 4-4 4" /></>);
export const Outdent = make(<><path d="M21 5H3" /><path d="M21 12H11" /><path d="M21 19H3" /><path d="m7 8-4 4 4 4" /></>);
export const Sigma = make(<path d="M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2" />);
export const WrapText = make(<><path d="M3 6h18" /><path d="M3 12h15a3 3 0 1 1 0 6h-4" /><path d="m16 16-2 2 2 2" /><path d="M3 18h7" /></>);
export const Grid3x3 = make(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /><path d="M15 3v18" /></>);
export const Strikethrough = make(<><path d="M16 4H9a3 3 0 0 0-2.8 4" /><path d="M14 12a4 4 0 0 1 0 8H6" /><path d="M4 12h16" /></>);
export const Redo2 = make(<><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13" /></>);
export const Undo2 = make(<><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11" /></>);
export const ListOrdered = make(<><path d="M10 6h11" /><path d="M10 12h11" /><path d="M10 18h11" /><path d="M4 6h1v4" /><path d="M4 10h2" /><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" /></>);
export const AlignJustify = make(<><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>);
export const DollarSign = make(<><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>);
export const RotateCw = make(<><path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8 1 6.5 2.7L21 8" /><path d="M21 3v5h-5" /></>);
export const CheckSquare = make(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m9 12 2 2 4-4" /></>);
export const BarChart3 = make(<><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></>);
export const Combine = make(<><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /><path d="M7 11v4a2 2 0 0 0 2 2h4" /></>);
export const Shapes = make(<><path d="M8.3 10a.7.7 0 0 1-.6-1.1l3.7-6a.7.7 0 0 1 1.2 0l3.7 6a.7.7 0 0 1-.6 1.1Z" /><rect x="3" y="14" width="7" height="7" rx="1" /><circle cx="17.5" cy="17.5" r="3.5" /></>);
