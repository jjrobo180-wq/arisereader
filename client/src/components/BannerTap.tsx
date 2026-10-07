// A site banner that can be tapped: with a link it opens that page of the site, without one it is plain text.
import type { CSSProperties, ReactNode } from "react";
import { bannerHref } from "@shared/banners";

export default function BannerTap({ link, className = "", style, cueColor, children }: { link?: string; className?: string; style?: CSSProperties; /** The color of the "Open" cue, when the banner's text color is not set on the banner itself. */ cueColor?: string; children: ReactNode }) {
  const href = bannerHref(link);
  if (!href) return <div className={className} style={style}>{children}</div>;
  return (
    <a href={href} className={className} style={{ textDecoration: "none", cursor: "pointer", ...style }} data-testid="banner-link">
      {children}
      <span style={{ marginLeft: "auto", flexShrink: 0, alignSelf: "center", fontSize: 12, fontWeight: 800, textDecoration: "underline", textUnderlineOffset: 4, whiteSpace: "nowrap", ...(cueColor ? { color: cueColor } : {}) }}>Open ›</span>
    </a>
  );
}
