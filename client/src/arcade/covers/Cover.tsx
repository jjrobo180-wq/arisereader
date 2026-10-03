import type { CSSProperties } from "react";
import GameArt from "./Art";
import { logoFor, logoLines, logoScale } from "./styles";

/**
 * A game's title logo. It sizes itself to its box (the parent must be a size
 * container), so the same logo works on a small cover and in the spotlight.
 */
export function TitleLogo({ id, title, classic, max }: { id: string; title: string; classic?: string; max?: number }) {
  const st = logoFor(id);
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

/** A 3:4 game cover: painted art, the title logo, and how many readers are waiting. */
export function CoverTile({ id, title, name, waiting = 0, onOpen, pressed }: { id: string; title: string; name: string; waiting?: number; onOpen: () => void; pressed?: boolean }) {
  return (
    <button
      type="button"
      className="axl-cover"
      onClick={onOpen}
      aria-label={`${title}, ${name}${waiting ? `, ${waiting} waiting` : ""}`}
      aria-pressed={pressed}
      data-testid={`cover-${id}`}
      style={{ "--accent": logoFor(id).accent } as CSSProperties}
    >
      <GameArt gameId={id} />
      <span className="axl-cover-shade" aria-hidden="true" />
      <span className="axl-cover-logo" aria-hidden="true"><TitleLogo id={id} title={title} classic={name} /></span>
      {waiting > 0 && <span className="axl-pill" aria-hidden="true"><i /> {waiting} waiting</span>}
    </button>
  );
}
