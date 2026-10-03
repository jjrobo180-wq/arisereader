import type { CSSProperties, ReactNode } from "react";
import { logoFor, logoLines, logoScale, type LogoStyle } from "./styles";

/**
 * A title logo. It sizes itself to its box (the parent must be a size
 * container), so the same logo works on a small cover and in the spotlight.
 * `look` overrides the arcade style for `id` (the Worlds page has its own).
 */
export function TitleLogo({ id, title, classic, max, look }: { id: string; title: string; classic?: string; max?: number; look?: LogoStyle }) {
  const st = look ?? logoFor(id);
  // Titles are stored in title case (so they read well in sentences and to
  // screen readers); the logo itself is always set in capitals.
  const logo = title.toUpperCase();
  const fs = logoScale(logo, st.family, max ?? (st.family === "legend" ? 21 : 31));
  const style = {
    "--m1": st.metal[0],
    "--m2": st.metal[1],
    "--m3": st.metal[2],
    "--glow": st.glow,
    "--fs": `${fs.toFixed(2)}cqw`,
  } as CSSProperties;
  return (
    <span className={`axl-logo ${st.family}`} style={style}>
      <b>{logoLines(logo).map((line) => <span key={line}>{line}</span>)}</b>
      {classic && <small>{classic}</small>}
    </span>
  );
}

/**
 * A 3:4 cover: painted art, the title logo, and (for arcade games) how many
 * readers are waiting. The caller passes the art so this file stays free of
 * any one page's scenes.
 */
export function CoverTile({ id, title, name, art, look, waiting = 0, onOpen, pressed, testId }: {
  id: string; title: string; name: string; art: ReactNode; look?: LogoStyle;
  waiting?: number; onOpen: () => void; pressed?: boolean; testId?: string;
}) {
  const st = look ?? logoFor(id);
  return (
    <button
      type="button"
      className="axl-cover"
      onClick={onOpen}
      aria-label={`${title}, ${name}${waiting ? `, ${waiting} waiting` : ""}`}
      aria-pressed={pressed}
      data-testid={testId ?? `cover-${id}`}
      style={{ "--accent": st.accent } as CSSProperties}
    >
      {art}
      <span className="axl-cover-shade" aria-hidden="true" />
      <span className="axl-cover-logo" aria-hidden="true"><TitleLogo id={id} title={title} classic={name} look={st} /></span>
      {waiting > 0 && <span className="axl-pill" aria-hidden="true"><i /> {waiting} waiting</span>}
    </button>
  );
}
