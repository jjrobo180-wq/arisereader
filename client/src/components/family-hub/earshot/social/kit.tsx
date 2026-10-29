// Pod+ Social: the shared pieces of the app. Types (the same shapes the server sends), the look
// (light and dark, set by CSS variables on the app's root), avatars, names with a verified mark,
// text with clickable @mentions, #hashtags and links, sheets, buttons, uploads with progress, and
// a hook for lists that keep loading as you scroll.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { PodEpisode, PodShow } from "@shared/earshot";
import { ArrowLeft, BadgeCheck, Loader2, X } from "lucide-react";
import type { Media, PollView } from "@shared/socialKit";
export { compactCount, shortAgo } from "@shared/socialKit";
export type { Media, PollView } from "@shared/socialKit";

export type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
export type Profile = { handle: string; name: string; bio: string; avatar: string; photo?: string; cover?: string; website?: string; location?: string; verified?: boolean; joined?: string };
export type Person = Profile & { followed?: boolean; followers?: number; me?: boolean; followsYou?: boolean };
export type PostEpisode = { id: string; showId: string; show: string; title: string; art: string; audio: string; secs: number; date: string; about?: string };
export type Clip = { s: number; e: number; quote: string; audio?: string };
export type Post = {
  id: string; kind: "share" | "bookmark" | "own" | "text" | "clip" | "repost"; caption: string; at: string;
  episode: PostEpisode | null; clip: Clip | null; repost: Post | null; author: Profile;
  likes: number; liked: boolean; comments: number; reposts: number; reposted: boolean; mine: boolean;
  media?: Media[]; poll?: PollView | null; saved?: boolean; recommended?: boolean;
};
export type Comment = { id: string; postId: string; parentId: string | null; body: string; at: string; author: Profile; likes: number; liked: boolean; mine: boolean };
export type Note = { id: string; kind: "like" | "comment" | "reply" | "follow" | "repost" | "comment_like" | "episode" | "guestbook" | "mention"; at: string; read: boolean; actor: Profile; post: { id: string; kind: Post["kind"]; text: string; art: string } | null; comment: string };
export type Thread = { id: string; with: Profile; lastText: string; lastAt: string; lastFromMe: boolean; unread: boolean; accepted: boolean; request: boolean };
export type Message = { id: string; mine: boolean; body: string; media: Media[]; post: Post | null; at: string };
export type Story = { id: string; media: Media | null; body: string; bg: string; episode: PostEpisode | null; at: string; seen: boolean; views?: number };
export type TrayItem = { author: Profile; me: boolean; stories: Story[]; unseen: boolean; last: string };
export type ProfileData = {
  profile: Profile; me: boolean; followers: number; following: number; posts: number; followed: boolean; followsYou: boolean;
  blocked: boolean; mutuals: Profile[]; mutualCount: number; favorites: { id: string; name: string; art: string; author?: string }[];
};
export type Counts = { notes: number; dms: number; requests: number };

export const ACCENT = "#ff6a1f";

/** What every screen gets: the server, the signed-in person, and ways to move around the app. */
export type SCtx = {
  api: Api; say: (m: string) => void; me: Profile | null;
  openProfile: (handle: string) => void; openPost: (p: Post | string) => void; openTag: (tag: string) => void;
  openChatWith: (handle: string) => void; compose: (o?: { quote?: Post }) => void; sharePost: (p: Post) => void;
  /** True (and the profile maker opens) when they need a profile first. */
  needProfile: () => boolean;
  /** Email sign-in (Pod+ website) before photos and videos; resolves true once signed in. */
  signIn: () => Promise<boolean>;
  play: (show: PodShow, ep: PodEpisode, at?: number) => void; hush: () => void;
};

/** Overlays (sheets, photo viewer, stories) render here, on top of the whole app. */
export function Layer({ children }: { children: ReactNode }) {
  const el = typeof document !== "undefined" ? document.getElementById("sx-layer") : null;
  return el ? createPortal(children, el) : <>{children}</>;
}

/** Colors for both looks. Everything in the app reads these variables. */
export const SX_CSS = `
.sx{--bg:#000;--surface:#000;--elev:#16181c;--elev2:#202327;--fg:#e7e9ea;--muted:#71767b;--line:rgba(255,255,255,.12);--hover:rgba(255,255,255,.04);--accent:${ACCENT};--accent-ink:#fff;--like:#f91880;--repost:#00ba7c;--link:#1d9bf0;--overlay:rgba(91,112,131,.4);color:var(--fg);background:var(--bg)}
.sx.sx-light{--bg:#fff;--surface:#fff;--elev:#f2f3f5;--elev2:#e8eaed;--fg:#0f1419;--muted:#536471;--line:rgba(15,20,25,.1);--hover:rgba(15,20,25,.035);--overlay:rgba(0,0,0,.4)}
.sx .bg{background:var(--bg)}.sx .surface{background:var(--surface)}.sx .elev{background:var(--elev)}.sx .elev2{background:var(--elev2)}
.sx .fg{color:var(--fg)}.sx .muted{color:var(--muted)}.sx .line{border-color:var(--line)}.sx .accent{color:var(--accent)}.sx .bg-accent{background:var(--accent);color:var(--accent-ink)}
.sx .hov:hover{background:var(--hover)}.sx .divide>*+*{border-top:1px solid var(--line)}
.sx .btn-fg{background:var(--fg);color:var(--bg)}.sx .btn-line{box-shadow:inset 0 0 0 1px var(--line);color:var(--fg)}
.sx .btn-line:hover{background:var(--hover)}.sx .link{color:var(--link)}
.sx input,.sx textarea{color:var(--fg)}.sx input::placeholder,.sx textarea::placeholder{color:var(--muted)}
.sx .glass{background:var(--bg);background:color-mix(in srgb,var(--bg) 84%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
.sx .noscroll{scrollbar-width:none}.sx .noscroll::-webkit-scrollbar{display:none}
@keyframes sx-pop{0%{transform:scale(1)}40%{transform:scale(1.28)}100%{transform:scale(1)}}.sx .pop{animation:sx-pop .35s ease}
@keyframes sx-burst{0%{opacity:0;transform:scale(.4)}30%{opacity:1;transform:scale(1.1)}100%{opacity:0;transform:scale(1.4)}}.sx .burst{animation:sx-burst .8s ease forwards}
@keyframes sx-up{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}.sx .rise{animation:sx-up .22s ease-out}
@keyframes sx-fade{from{opacity:0}to{opacity:1}}.sx .fade{animation:sx-fade .18s ease-out}

/* Pod+ Social / mature responsive layout. Components keep their existing functionality. */
.sx-social-root{
  container-type:inline-size;position:relative;display:flex;width:100%;height:100%;min-width:0;min-height:0;flex-direction:column;
  box-sizing:border-box;padding-top:4rem;overflow:hidden;isolation:isolate;
  --bg:#101116;--surface:#181a20;--elev:#252830;--elev2:#2b2e36;--fg:#f4f5f7;
  --muted:#92949e;--line:rgba(245,245,255,.095);--hover:rgba(255,255,255,.052);
  --accent:#ee6945;--accent-ink:#fff;--link:#9bb6f9;
  font-size:15px;line-height:1.48;letter-spacing:-.008em;
}
.sx-social-root.sx-light{
  --bg:#f7f8fa;--surface:#fff;--elev:#edeff3;--elev2:#e7e9ee;--fg:#181b24;
  --muted:#717684;--line:rgba(30,38,53,.1);--hover:rgba(20,24,36,.04);--link:#295cb0;
}
.sx-social-root .glass{background:color-mix(in srgb,var(--surface) 92%,transparent)}
.sx-workspace{display:flex;flex:1;min-width:0;min-height:0;width:100%;max-width:1440px;margin:0 auto}
.sx-left-sidebar,.sx-right-sidebar{display:none}
.sx-main-column{position:relative;flex:1;min-width:0;min-height:0;background:var(--surface)}
.sx-screens{position:relative;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;isolation:isolate}
.sx-scroll-layer{position:absolute;inset:0;box-sizing:border-box;min-width:0;width:100%;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--elev2) transparent}
.sx-content-layer{box-sizing:border-box;min-height:100%;min-width:0;width:100%;padding-bottom:calc(5rem + var(--ps-safe-b,0px));margin:0 auto}
.sx-social-root>.sx-overlay-root{position:absolute;inset:0;z-index:100;pointer-events:none;isolation:isolate}
.sx-social-root>.sx-overlay-root>*{pointer-events:auto}
.sx-social-root .sx-profile-cover{background-color:var(--elev)!important;background-image:linear-gradient(120deg,#202b38 0%,#344253 54%,#b4684a 160%)!important;border-bottom:1px solid var(--line)}
.sx-home{min-height:100%}
.sx-feed-header{position:sticky;top:0;z-index:20;border-bottom:1px solid var(--line)}
.sx-feed-title-row{display:flex;align-items:center;gap:12px;height:65px;padding:0 19px}
.sx-feed-heading{display:flex;flex:1;align-items:center;min-width:0}
.sx-mobile-avatar{display:grid;flex:none;place-items:center}
.sx-mobile-brand{display:flex;align-items:center;gap:2px;font-size:24px;font-weight:790;letter-spacing:-.065em}
.sx-mobile-brand small{margin-left:9px;font-size:10px;font-weight:700;letter-spacing:.23em;color:var(--muted)}
.sx-desktop-heading,.sx-desktop-subheading{display:none}
.sx-header-alert{width:37px;height:37px;display:grid;place-items:center;position:relative;border-radius:10px;color:var(--fg)}
.sx-header-alert:hover{background:var(--hover)}
.sx-count,.sx-mobile-badge,.sx-side-badge{position:absolute;display:grid;place-items:center;min-width:18px;height:18px;padding:0 4px;font-size:10px;font-weight:800;border-radius:20px;background:var(--accent);color:#fff}
.sx-count{right:-1px;top:-2px}
.sx-feed-tabs{display:flex;padding:0 14px;gap:8px}
.sx-feed-tab{position:relative;min-height:50px;min-width:100px;padding:0 14px;flex:1;text-align:center;font-size:14px;font-weight:540;color:var(--muted);transition:color .16s ease}
.sx-feed-tab:hover{color:var(--fg)}
.sx-feed-tab-active{color:var(--fg);font-weight:750}
.sx-feed-tab-active:after{content:"";position:absolute;bottom:0;left:18%;right:18%;height:3px;background:var(--accent);border-radius:4px 4px 0 0}
.sx-composer-row{display:flex;align-items:center;gap:14px;padding:18px 20px;border-bottom:1px solid var(--line)}
.sx-composer-prompt{flex:1;text-align:left;min-height:42px;color:var(--muted);font-size:15px}
.sx-composer-prompt:hover{color:var(--fg)}
.sx-composer-media{display:grid;place-items:center;width:39px;height:39px;border-radius:10px;background:var(--elev);color:var(--fg)}
.sx-composer-media:hover{background:var(--elev2)}
.sx-join{padding:28px 23px;border-bottom:1px solid var(--line)}
.sx-join-eyebrow{color:var(--accent);font-size:10px;letter-spacing:.18em;font-weight:800;margin-bottom:10px}
.sx-mobile-nav{box-sizing:content-box;display:flex;position:absolute;bottom:0;left:0;right:0;z-index:40;height:58px;padding-bottom:var(--ps-safe-b,0px);border-top:1px solid var(--line)}
.sx-mobile-nav button{color:var(--muted)}
.sx-mobile-nav button[aria-current="page"]{color:var(--fg)}
.sx-mobile-create{display:grid;place-items:center;width:43px;height:34px;background:var(--fg);color:var(--bg);border-radius:9px}
.sx-mobile-badge{top:4px;left:56%}
.sx-mobile-fab{position:absolute;z-index:30;right:18px;bottom:calc(74px + var(--ps-safe-b,0px));width:54px;height:54px;display:grid;place-items:center;border-radius:17px;box-shadow:0 8px 32px rgba(0,0,0,.3);transition:transform .14s ease}
.sx-mobile-fab:active{transform:scale(.96)}
.sx-social-root article{background:var(--surface);transition:background .15s ease}
.sx-social-root article.hov:hover{background:var(--hover)}
.sx-social-root article .rounded-2xl{border-radius:13px}
.sx-social-root .sx-post-recommended{display:flex;align-items:center;gap:7px;margin-bottom:9px;color:var(--muted);font-size:12px;font-weight:600;letter-spacing:.015em}
.sx-social-root .sx-post-recommended strong{color:var(--fg);font-weight:700}
.sx-social-root .sx-post-recommended svg{color:var(--accent)}
.sx-social-root .sx-official-mark{display:inline-grid;place-items:center;width:15px;height:15px;border-radius:50%;font-size:10px;background:#4b83cb;color:white;margin-left:5px;vertical-align:middle;line-height:1}
.sx-brand{display:flex;align-items:center;gap:12px;padding:10px 16px 31px}
.sx-brand-word{font-size:37px;font-weight:850;letter-spacing:-.09em;line-height:1}
.sx-brand-word span{color:var(--accent)}
.sx-brand-tag{font-size:10px;font-weight:800;letter-spacing:.25em;color:var(--muted);padding-left:2px;padding-top:9px}
.sx-sidebar-menu{display:flex;flex-direction:column;gap:4px}
.sx-side-link{display:flex;align-items:center;gap:18px;width:100%;height:53px;padding:0 17px;border-radius:11px;text-align:left;color:var(--muted);font-size:16px;font-weight:560;position:relative;transition:background .15s ease,color .15s ease}
.sx-side-link:hover{background:var(--hover);color:var(--fg)}
.sx-side-link-active{background:var(--elev);color:var(--fg);font-weight:770}
.sx-side-link-active svg{color:var(--accent)}
.sx-side-badge{position:static;margin-left:auto}
.sx-side-create{margin:24px 5px 0;min-height:49px;display:flex;align-items:center;justify-content:center;gap:10px;border-radius:10px;background:var(--accent);color:#fff;font-size:14px;font-weight:760;transition:filter .15s ease}
.sx-side-create:hover{filter:brightness(1.12)}
.sx-side-appearance{margin-top:auto;padding:22px 3px 17px}
.sx-side-theme-options{display:flex;gap:3px;margin-top:10px;padding:4px;border:1px solid var(--line);border-radius:11px;background:var(--surface)}
.sx-side-theme-options button{min-width:0;min-height:35px;flex:1;display:flex;align-items:center;justify-content:center;gap:4px;border-radius:8px;font-size:11px;font-weight:720;color:var(--muted);transition:background .15s ease,color .15s ease}
.sx-side-theme-options button:hover{background:var(--hover);color:var(--fg)}
.sx-side-theme-options button.sx-side-theme-active{background:var(--accent);color:#fff}
.sx-side-bottom{padding-top:18px;border-top:1px solid var(--line)}
.sx-side-bottom-label{font-size:10px;letter-spacing:.17em;color:var(--muted);font-weight:800;padding-left:9px}
.sx-account-row{display:flex;align-items:center;gap:11px;width:100%;text-align:left;padding:14px 6px;border-radius:10px}
.sx-account-row:hover{background:var(--hover)}
.sx-account-copy{display:flex;min-width:0;flex-direction:column;gap:1px}
.sx-account-copy strong{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:750}
.sx-account-copy small{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx-right-sidebar{overflow-y:auto;scrollbar-width:none;padding:25px 18px 30px;min-height:0}
.sx-discovery-search{display:flex;align-items:center;gap:10px;width:100%;height:45px;padding:0 15px;margin-bottom:25px;border-radius:10px;background:var(--elev);color:var(--muted);text-align:left;font-size:13px}
.sx-discovery-search:hover{color:var(--fg);background:var(--elev2)}
.sx-discovery-card{padding:20px 0 12px;border-top:1px solid var(--line)}
.sx-panel-heading{display:flex;align-items:center;gap:10px;padding:0 2px 12px;color:var(--fg)}
.sx-panel-heading svg{color:var(--accent)}
.sx-panel-heading h2{font-size:16px;font-weight:770;letter-spacing:-.025em}
.sx-discovery-muted{font-size:13px;color:var(--muted);line-height:1.7;padding:12px 4px 18px}
.sx-trend{display:flex;flex-direction:column;gap:3px;width:100%;text-align:left;padding:11px 8px;border-radius:10px}
.sx-trend:hover,.sx-follow-row:hover{background:var(--hover)}
.sx-trend strong{font-size:14px;font-weight:750}
.sx-trend-kicker,.sx-trend-meta{font-size:11px;color:var(--muted)}
.sx-see-more{width:100%;display:flex;justify-content:space-between;align-items:center;padding:13px 8px 3px;text-align:left;color:var(--accent);font-size:12px;font-weight:740}
.sx-see-more:hover{filter:brightness(1.2)}
.sx-follow-row{display:flex;align-items:center;gap:9px;margin:2px 0;padding:10px 3px;border-radius:10px}
.sx-follow-info{display:flex;min-width:0;flex:1;flex-direction:column;text-align:left}
.sx-follow-info strong{font-size:12px;line-height:1.25;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.sx-follow-info small{font-size:11px;color:var(--muted);line-height:1.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx-official-hint{font-size:10px;color:var(--accent);font-weight:660;white-space:nowrap}
.sx-follow-action{flex:none;min-width:66px;padding:8px 10px;font-size:11px;border-radius:7px;background:var(--fg);color:var(--bg);font-weight:750}
.sx-followed{background:var(--elev);color:var(--fg)}
.sx-right-footer{font-size:11px;color:var(--muted);line-height:1.6;padding-top:25px;border-top:1px solid var(--line)}
.sx-story-tray{background:var(--surface)}
@container (min-width:760px){
  .sx-left-sidebar{display:flex;flex:none;box-sizing:border-box;flex-direction:column;width:211px;min-height:0;overflow-y:auto;scrollbar-width:none;padding:28px 17px 24px;background:var(--bg)}
  .sx-main-column{border-left:1px solid var(--line);border-right:1px solid var(--line)}
  .sx-mobile-nav,.sx-mobile-fab,.sx-mobile-avatar,.sx-mobile-brand{display:none}
  .sx-content-layer{padding-bottom:42px;max-width:760px}
  .sx-feed-title-row{height:86px;padding:0 26px}
  .sx-feed-heading{display:block}
  .sx-desktop-heading{display:block;font-size:23px;line-height:1.2;font-weight:770;letter-spacing:-.04em}
  .sx-desktop-subheading{display:block;margin-top:4px;font-size:12px;color:var(--muted)}
  .sx-feed-tabs{padding:0 20px;gap:10px}
  .sx-feed-tab{flex:none;min-width:130px;text-align:left;padding-left:12px}
  .sx-feed-tab-active:after{left:12px;right:auto;width:45px}
  .sx-composer-row{padding:22px 25px}
  .sx-join{padding:36px}
  .sx-social-root article{padding-left:25px;padding-right:25px}
}
@container (min-width:1180px){
  .sx-right-sidebar{display:block;box-sizing:border-box;flex:none;width:310px;background:var(--bg)}
}

@media (prefers-reduced-motion:reduce){.sx .pop,.sx .burst,.sx .rise,.sx .fade{animation:none}}
`;

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------
const hue = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 17);
export function Avatar({ p, size = 40, onClick, ring }: { p: Pick<Profile, "handle" | "name" | "photo">; size?: number; onClick?: () => void; ring?: string }) {
  const h = hue(p.handle || p.name || "?");
  const letters = (p.name || p.handle || "?").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0]).join("").toUpperCase() || "?";
  const inner = p.photo
    ? <img src={p.photo} alt="" loading="lazy" className="block h-full w-full rounded-full object-cover" />
    : <span className="grid h-full w-full select-none place-items-center rounded-full font-semibold text-white" style={{ background: `linear-gradient(135deg, hsl(${(h * 0.1 + 208) % 360} 14% 34%), hsl(${(h * 0.1 + 225) % 360} 12% 21%))`, fontSize: Math.round(size * (letters.length > 1 ? 0.38 : 0.44)) }}>{letters}</span>;
  const box = <span className="relative block flex-none overflow-hidden rounded-full" style={{ width: size, height: size, boxShadow: ring }}>{inner}</span>;
  return onClick ? <button type="button" onClick={onClick} aria-label={`${p.name}'s profile`} className="flex-none rounded-full">{box}</button> : box;
}
export const Verified = ({ size = 16 }: { size?: number }) => <BadgeCheck size={size} className="flex-none fill-[#1d9bf0] text-white" aria-label="Verified" />;
export function NameLine({ p, onClick, small }: { p: Profile; onClick?: () => void; small?: boolean }) {
  const body = <span className="flex min-w-0 items-center gap-1"><b className={`truncate ${small ? "text-[14px]" : "text-[15px]"} font-bold`}>{p.name}</b>{p.verified && <Verified size={small ? 14 : 16} />}</span>;
  return onClick ? <button type="button" onClick={onClick} className="min-w-0 hover:underline">{body}</button> : body;
}

// ---------------------------------------------------------------------------
// Text with @mentions, #hashtags and links you can tap
// ---------------------------------------------------------------------------
export function RichText({ text, onMention, onTag, className = "" }: { text: string; onMention: (h: string) => void; onTag: (t: string) => void; className?: string }) {
  const parts: ReactNode[] = [];
  const re = /(https?:\/\/[^\s]+)|(^|[^\w@])@([a-zA-Z0-9_]{3,20})\b|(^|[^\w&])#([a-zA-Z0-9_]{2,30})\b/g;
  let last = 0; let m: RegExpExecArray | null; let k = 0;
  while ((m = re.exec(text))) {
    const lead = m[2] ?? m[4] ?? "";
    const start = m.index + lead.length;
    if (start > last) parts.push(text.slice(last, start));
    if (m[1]) {
      const url = m[1].replace(/[),.!?]+$/, "");
      parts.push(<a key={k++} href={url} target="_blank" rel="noopener noreferrer nofollow ugc" className="link break-all hover:underline" onClick={(e) => e.stopPropagation()}>{url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}{url.length > 48 ? "…" : ""}</a>);
      last = m.index + url.length;
      re.lastIndex = last;
      continue;
    }
    if (m[3]) { const h = m[3]; parts.push(<button key={k++} type="button" className="link hover:underline" onClick={(e) => { e.stopPropagation(); onMention(h.toLowerCase()); }}>@{h}</button>); }
    else if (m[5]) { const t = m[5]; parts.push(<button key={k++} type="button" className="link hover:underline" onClick={(e) => { e.stopPropagation(); onTag(t.toLowerCase()); }}>#{t}</button>); }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className={`whitespace-pre-wrap break-words ${className}`}>{parts}</span>;
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------
export const Spinner = ({ className = "" }: { className?: string }) => <div className={`grid place-items-center py-10 ${className}`}><Loader2 className="animate-spin accent" size={26} /></div>;
export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return <div className="mx-auto max-w-sm px-8 py-16 text-center"><p className="text-[26px] font-extrabold leading-tight">{title}</p>{text && <p className="muted mt-2 text-[15px]">{text}</p>}{action && <div className="mt-5">{action}</div>}</div>;
}
export const PillButton = ({ children, onClick, kind = "fg", disabled, className = "", small }: { children: ReactNode; onClick?: () => void; kind?: "fg" | "line" | "accent"; disabled?: boolean; className?: string; small?: boolean }) =>
  <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-1.5 rounded-full font-bold transition disabled:opacity-40 ${small ? "min-h-8 px-3.5 text-[14px]" : "min-h-9 px-4 text-[15px]"} ${kind === "fg" ? "btn-fg hover:opacity-90" : kind === "accent" ? "bg-accent hover:opacity-90" : "btn-line"} ${className}`}>{children}</button>;

/** Follow / Following (hover says Unfollow). */
export function FollowButton({ on, onToggle, small, followsYou }: { on: boolean; onToggle: () => void; small?: boolean; followsYou?: boolean }) {
  const [hover, setHover] = useState(false);
  return <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(); }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
    className={`inline-flex flex-none items-center justify-center rounded-full font-bold transition ${small ? "min-h-8 px-3.5 text-[14px]" : "min-h-9 px-4 text-[15px]"} ${on ? (hover ? "text-[#f4212e] shadow-[inset_0_0_0_1px_rgba(244,33,46,.5)]" : "btn-line") : "btn-fg hover:opacity-90"}`}>
    {on ? (hover ? "Unfollow" : "Following") : followsYou ? "Follow back" : "Follow"}
  </button>;
}

/** A sheet from the bottom on phones, a centered box on wide screens. */
export function Sheet({ title, onClose, children, wide, full }: { title?: string; onClose: () => void; children: ReactNode; wide?: boolean; full?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return <Layer><div className="fade absolute inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" style={{ background: "var(--overlay)" }} onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
      className={`rise surface flex w-full flex-col overflow-hidden rounded-t-3xl shadow-2xl sm:rounded-3xl ${wide ? "sm:max-w-xl" : "sm:max-w-md"} ${full ? "h-[92%] sm:h-[85%]" : "max-h-[88%]"}`}>
      {title !== undefined && <div className="flex flex-none items-center gap-2 border-b line px-3 py-2">
        <button type="button" onClick={onClose} aria-label="Close" className="hov grid h-9 w-9 place-items-center rounded-full"><X size={20} /></button>
        <h3 className="flex-1 text-[17px] font-bold">{title}</h3>
      </div>}
      {children}
    </div>
  </div></Layer>;
}
/** A list of choices in a sheet (post menus, repost options...). */
export function ActionSheet({ items, onClose }: { items: { label: string; icon?: ReactNode; danger?: boolean; onClick: () => void }[]; onClose: () => void }) {
  return <Sheet onClose={onClose}>
    <div className="p-2 pb-[max(.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto mb-2 mt-1 h-1 w-10 rounded-full elev2 sm:hidden" />
      {items.map((it) => <button key={it.label} type="button" onClick={() => { onClose(); it.onClick(); }} className={`hov flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-bold ${it.danger ? "text-[#f4212e]" : ""}`}>{it.icon}{it.label}</button>)}
      <button type="button" onClick={onClose} className="btn-line mt-2 min-h-11 w-full rounded-full text-[15px] font-bold">Cancel</button>
    </div>
  </Sheet>;
}

/** The bar at the top of a screen: back, a title (and a line under it), and buttons on the right. */
export function TopBar({ title, sub, onBack, right }: { title?: ReactNode; sub?: ReactNode; onBack?: () => void; right?: ReactNode }) {
  return <div className="glass sticky top-0 z-20 flex min-h-[53px] items-center gap-2 px-2">
    {onBack && <button type="button" onClick={onBack} aria-label="Back" className="hov grid h-10 w-10 flex-none place-items-center rounded-full"><ArrowLeft size={20} /></button>}
    <div className={`min-w-0 flex-1 ${onBack ? "" : "pl-2"}`}>{title && <h2 className="truncate text-[19px] font-extrabold leading-tight">{title}</h2>}{sub && <p className="muted truncate text-[13px]">{sub}</p>}</div>
    {right}
  </div>;
}

// ---------------------------------------------------------------------------
// Lists that keep loading as you scroll
// ---------------------------------------------------------------------------
/** Loads page after page. `load(cursor)` returns items and the next cursor (null at the end). */
export function usePaged<T extends { id: string }, C = unknown>(load: (cursor: C | null) => Promise<{ items: T[]; next: C | null }>, deps: unknown[]) {
  const [items, setItems] = useState<T[] | null>(null);
  const [next, setNext] = useState<C | null>(null);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const busy = useRef(false);
  const gen = useRef(0);
  const loadRef = useRef(load); loadRef.current = load;
  const reset = useCallback(() => {
    const g = ++gen.current; busy.current = true; setErr("");
    loadRef.current(null).then((r) => { if (g !== gen.current) return; setItems(r.items); setNext(r.next); setDone(r.next == null); })
      .catch((e) => { if (g === gen.current) { setItems([]); setErr(e?.message || "That didn't load."); } })
      .finally(() => { if (g === gen.current) busy.current = false; });
  }, []);
  useEffect(() => { setItems(null); setDone(false); reset(); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  const more = useCallback(() => {
    if (busy.current || done || next == null) return;
    busy.current = true; const g = gen.current;
    loadRef.current(next).then((r) => {
      if (g !== gen.current) return;
      setItems((l) => { const seen = new Set((l || []).map((x) => x.id)); return [...(l || []), ...r.items.filter((x) => !seen.has(x.id))]; });
      setNext(r.next); setDone(r.next == null);
    }).catch(() => setDone(true)).finally(() => { if (g === gen.current) busy.current = false; });
  }, [done, next]);
  const patch = useCallback((id: string, f: (t: T) => T | null) => setItems((l) => (l ? l.map((x) => (x.id === id ? f(x) : x)).filter(Boolean) as T[] : l)), []);
  const prepend = useCallback((t: T) => setItems((l) => [t, ...(l || []).filter((x) => x.id !== t.id)]), []);
  return { items, more, done, err, reset, patch, prepend, setItems };
}
/** Calls `onSeen` when this comes into view (put it at the end of a list). */
export function Sentinel({ onSeen, done }: { onSeen: () => void; done: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onSeen); cb.current = onSeen;
  useEffect(() => {
    const el = ref.current; if (!el || done) return;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) cb.current(); }, { rootMargin: "800px 0px" });
    io.observe(el); return () => io.disconnect();
  }, [done]);
  return done ? null : <div ref={ref} className="grid place-items-center py-8"><Loader2 className="animate-spin muted" size={22} /></div>;
}

// ---------------------------------------------------------------------------
// Uploads: photos are shrunk on the phone first (faster), then sent straight to storage.
// ---------------------------------------------------------------------------
export class NeedSignIn extends Error {}
async function shrink(file: File): Promise<{ blob: Blob; type: string; w: number; h: number }> {
  const type = file.type || "image/jpeg";
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const w = img.naturalWidth, h = img.naturalHeight;
    if (type === "image/gif" || Math.max(w, h) <= 2048) return { blob: file, type, w, h };
    const k = 2048 / Math.max(w, h), cw = Math.round(w * k), ch = Math.round(h * k);
    const c = document.createElement("canvas"); c.width = cw; c.height = ch;
    c.getContext("2d")!.drawImage(img, 0, 0, cw, ch);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.86));
    return blob ? { blob, type: "image/jpeg", w: cw, h: ch } : { blob: file, type, w, h };
  } finally { URL.revokeObjectURL(url); }
}
async function videoSize(file: File): Promise<{ w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((res) => { const v = document.createElement("video"); v.preload = "metadata"; v.onloadedmetadata = () => res({ w: v.videoWidth, h: v.videoHeight }); v.onerror = () => res({ w: 0, h: 0 }); v.src = url; setTimeout(() => res({ w: 0, h: 0 }), 4000); });
  } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
}
export async function uploadMedia(api: Api, file: File, onProgress: (f: number) => void): Promise<Media> {
  const video = (file.type || "").startsWith("video/") || /\.(mov|mp4|webm)$/i.test(file.name);
  let blob: Blob = file, type = file.type || (video ? "video/mp4" : "image/jpeg"), w = 0, h = 0;
  if (video) { if (/\.mov$/i.test(file.name) && !file.type) type = "video/quicktime"; ({ w, h } = await videoSize(file)); }
  else ({ blob, type, w, h } = await shrink(file));
  let u: any;
  try { u = await api("/api/earshot/social/upload-url", { method: "POST", body: { kind: video ? "video" : "image", type, size: blob.size } }); }
  catch (e: any) { if (e?.needSignIn || /sign in/i.test(e?.message || "")) throw new NeedSignIn(e?.message || "Sign in to post photos and videos."); throw e; }
  await new Promise<void>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", u.url); x.setRequestHeader("Content-Type", type); x.setRequestHeader("x-upsert", "false");
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    x.onload = () => (x.status < 300 ? resolve() : reject(new Error("The upload didn't go through. Try again.")));
    x.onerror = () => reject(new Error("The upload didn't go through. Check your connection."));
    x.send(blob);
  });
  return { type: video ? "video" : "image", url: u.publicUrl, ...(w && h ? { w, h } : {}) };
}

/** Remembered on this device (recent searches...). */
export const local = {
  get<T>(k: string, fb: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fb; } catch { return fb; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window */ } },
};

/** The link to a post or profile (opens Pod+ on it). */
export const linkTo = (path: string) => `${typeof location !== "undefined" ? location.origin + location.pathname : ""}#/social/${path}`;
export async function shareOrCopy(url: string, title: string, say: (m: string) => void) {
  try {
    if (navigator.share) { await navigator.share({ title, url }); return; }
    await navigator.clipboard.writeText(url); say("Link copied.");
  } catch { /* cancelled */ }
}
