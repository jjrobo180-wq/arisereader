// Small inline icons for Study Squad (stroke icons, 24×24).
const base = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const IconBack = () => <svg {...base}><path d="M15 5l-7 7 7 7" /></svg>;
export const IconClose = () => <svg {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconTables = () => <svg {...base}><ellipse cx="12" cy="9" rx="8" ry="3.2" /><path d="M12 12.2V20M8 20h8" /></svg>;
export const IconSets = () => <svg {...base}><path d="M5 4h10a2 2 0 012 2v14H7a2 2 0 01-2-2V4z" /><path d="M17 8h2v12H9" /><path d="M8.5 9h5M8.5 12.5h5" /></svg>;
export const IconCards = () => <svg {...base}><rect x="3.5" y="7" width="12" height="13" rx="2" transform="rotate(-8 9.5 13.5)" /><rect x="9" y="4.5" width="12" height="13" rx="2" transform="rotate(8 15 11)" /></svg>;
export const IconTrophy = () => <svg {...base}><path d="M8 4h8v5a4 4 0 01-8 0V4z" /><path d="M8 6H5a3 3 0 003 3M16 6h3a3 3 0 01-3 3M12 13v4M8.5 20h7" /></svg>;
export const IconDoor = () => <svg {...base}><path d="M6 21V4a1 1 0 011-1h10a1 1 0 011 1v17M4 21h16" /><circle cx="14.5" cy="12" r=".8" fill="currentColor" /></svg>;
export const IconWave = () => <svg {...base}><path d="M8 13V6.5a1.5 1.5 0 013 0V11M11 10V5a1.5 1.5 0 013 0v6M14 10.5V7a1.5 1.5 0 013 0v7.5a6 6 0 01-11.2 3L4.6 15a1.6 1.6 0 012.7-1.7L8 14" /></svg>;
export const IconCoin = () => <svg {...base}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v9M9.6 9.8c0-1 1-1.6 2.4-1.6s2.4.7 2.4 1.7c0 2.4-4.8 1.2-4.8 3.8 0 1 1 1.7 2.4 1.7s2.4-.6 2.4-1.6" strokeWidth="1.8" /></svg>;
export const IconCheck = () => <svg {...base} strokeWidth={3}><path d="M5 12.5l4.5 4.5L19 7" /></svg>;
export const IconX = () => <svg {...base} strokeWidth={3}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconHeart = ({ off }: { off?: boolean }) => <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7.6a4.3 4.3 0 017.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" fill={off ? "none" : "currentColor"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>;
export const IconCrown = () => <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3 18l1.5-10 5 4.5L12 5l2.5 7.5 5-4.5L21 18z" fill="currentColor" /></svg>;
export const IconBot = () => <svg {...base} width={18} height={18}><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 4v4M9 13h.01M15 13h.01M9.5 17h5" /></svg>;
export const IconFlag = () => <svg {...base} width={18} height={18}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>;
export const IconTrash = () => <svg {...base} width={18} height={18}><path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v5M14 11v5" /></svg>;
export const IconPlus = () => <svg {...base} width={18} height={18}><path d="M12 5v14M5 12h14" /></svg>;
export const IconSpark = () => <svg {...base} width={18} height={18}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16z" /></svg>;
