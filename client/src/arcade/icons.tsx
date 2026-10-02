// Small inline icons for the arcade (stroke icons, 24×24).
type P = { className?: string };
const base = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const IconBack = (p: P) => <svg {...base} {...p}><path d="M15 5l-7 7 7 7" /></svg>;
export const IconClose = (p: P) => <svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconSearch = (p: P) => <svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>;
export const IconHelp = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.6 2.6 0 015 .9c0 1.8-2.6 2.2-2.6 3.9" /><circle cx="12" cy="17.2" r=".6" fill="currentColor" /></svg>;
export const IconSound = (p: P & { off?: boolean }) => (
  <svg {...base} className={p.className}>
    <path d="M4 10v4h4l5 4V6L8 10H4z" />
    {p.off ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" />}
  </svg>
);
export const IconUsers = (p: P) => <svg {...base} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0" /><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.5a6.5 6.5 0 013.5 5.5" /></svg>;
export const IconBot = (p: P) => <svg {...base} {...p}><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 4v4M9 13h.01M15 13h.01M9.5 17h5" /></svg>;
export const IconFlag = (p: P) => <svg {...base} {...p}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>;
export const IconRefresh = (p: P) => <svg {...base} {...p}><path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" /></svg>;
export const IconCrown = (p: P) => <svg viewBox="0 0 24 24" aria-hidden="true" className={p.className}><path d="M3 18l1.5-10 5 4.5L12 5l2.5 7.5 5-4.5L21 18z" fill="#ffd23f" stroke="#7a5a00" strokeWidth="1.4" strokeLinejoin="round" /></svg>;
