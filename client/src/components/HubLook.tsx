// Arise To Duo and WorkHub with an Arise Notes look: the hub root's colors and fonts, the areas around
// the page on the iPhone, and each look's own top of Home. Classic, Tile and Old Computer add nothing.
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { hubThemeOf } from "@shared/appThemes";
import { themeVars, type NotesTheme } from "@shared/notesThemes";
import { isNativeApp, nativeCall } from "@/lib/nativeApp";
import "@/components/arise-notes/notes-themes.css";
import "@/pages/hubLooks.css";

const fonts = new Set<string>();
const loadFont = (href?: string) => {
  if (!href || fonts.has(href)) return;
  fonts.add(href);
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = href;
  document.head.appendChild(l);
};

/** What the hub root needs for its theme. A look replaces night mode, since it has its own colors. */
export function useHubLook(themeId: unknown, night: boolean): { look: NotesTheme | null; className: string; style?: CSSProperties } {
  const look = hubThemeOf(themeId).look ?? null;
  const sent = useRef(false);
  useEffect(() => { if (look) loadFont(look.fontUrl); }, [look]);
  useEffect(() => {
    const html = document.documentElement, body = document.body;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (look) {
      const before = [html.style.background, body.style.background, meta?.content];
      html.style.background = look.bg;
      body.style.background = look.bg;
      if (meta) meta.content = look.bg;
      if (isNativeApp()) {
        sent.current = true;
        void nativeCall(/arisewidgets/i, "AriseWidgets", "setBackdrop", { color: look.bg }).catch(() => {});
        void nativeCall(/statusbar/i, "StatusBar", "setStyle", { style: look.dark ? "DARK" : "LIGHT" }).catch(() => {});
      }
      return () => { html.style.background = before[0] ?? ""; body.style.background = before[1] ?? ""; if (meta && before[2]) meta.content = before[2]; };
    }
    if (sent.current && isNativeApp()) {
      sent.current = false;
      void nativeCall(/arisewidgets/i, "AriseWidgets", "setBackdrop", { color: night ? "#14121f" : "#ffffff" }).catch(() => {});
      void nativeCall(/statusbar/i, "StatusBar", "setStyle", { style: night ? "DARK" : "LIGHT" }).catch(() => {});
    }
    return undefined;
  }, [look, night]);
  return look ? { look, className: `hub-look hub-theme-${look.id}`, style: themeVars(look) as CSSProperties } : { look: null, className: "" };
}

export type HubHeroLink = { label: string; onClick: () => void };

/** The top of Home for a look: its title, the main action and up to three shortcuts. */
export function HubLookHero({ look, date, greeting, primary, links }: { look: NotesTheme; date: string; greeting: string; primary: HubHeroLink; links: HubHeroLink[] }) {
  const main = (children: ReactNode, cls = "") => <button type="button" className={`an-l-record ${cls}`} onClick={primary.onClick} data-testid="hub-look-primary">{children}</button>;
  const rest = <div className="an-l-secondary">{links.slice(0, 3).map((l) => <button key={l.label} type="button" onClick={l.onClick}>{look.id === "console" ? `[ ${l.label.toLowerCase()} ]` : look.id === "punch" ? l.label.toUpperCase() : l.label}</button>)}</div>;
  const title = <h1>{greeting}</h1>;
  const body = (() => {
    switch (look.id) {
      case "studio": return <>{main(<><span className="an-l-rectop"><b>Today</b></span><small>{primary.label}</small></>)}{title}{rest}</>;
      case "bloom": return <>{title}<div className="an-l-tiles">{main(<b>{primary.label}</b>)}{links.slice(0, 2).map((l, i) => <button key={l.label} type="button" className={i ? "an-l-memo" : ""} onClick={l.onClick}>{l.label}</button>)}</div></>;
      case "timeline": return <>{title}{main(<><span className="an-l-tdot" /><span><b>{primary.label}</b><small>{date}</small></span></>)}{rest}</>;
      case "console": return <><h1>&gt; {greeting.toLowerCase()}</h1>{main(`[ ${primary.label.toLowerCase()} ]`)}{rest}</>;
      case "swiss": return <>{main(<b>Today</b>)}{rest}<h1 className="an-l-pad">{greeting}</h1></>;
      case "cassette": return <><div aria-hidden className="an-l-tape"><span>Side A: {date}</span><div><i /><i /></div></div>{title}{main(primary.label)}{rest}</>;
      case "grove": return <>{title}<div className="an-l-pills">{main(primary.label)}{links.slice(0, 2).map((l) => <button key={l.label} type="button" onClick={l.onClick}>{l.label}</button>)}</div></>;
      case "gazette": return <><header className="an-l-masthead"><h1>The Daily Duo</h1><p>{date}</p></header><h2 className="an-l-headline">{greeting}</h2>{main(primary.label)}{rest}</>;
      case "punch": return <><h1>{greeting.toUpperCase()}</h1>{main(primary.label.toUpperCase())}{rest}</>;
      case "chatline": return <><h1>{date}</h1><p className="an-l-bubble-them">{greeting}</p><button type="button" className="an-l-bubble-me" onClick={primary.onClick}>{primary.label}</button>{rest}</>;
      default: return <>{title}{main(primary.label)}{rest}</>;
    }
  })();
  return <section className={`an-l-hero an-l-hero-${look.id}`}>{body}</section>;
}
