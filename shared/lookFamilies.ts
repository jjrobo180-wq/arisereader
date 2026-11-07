// Looks that are one design in several colors are shown as one look with a color choice (the picker had 25 tiles
// that were really 7 designs). Each color is still its own look id, so saved choices and syncing don't change.
export type LookFamily = { id: string; name: string; blurb: string; variants: { id: string; color: string }[] };

export const LOOK_FAMILIES: LookFamily[] = [
  { id: "billboard", name: "Billboard", blurb: "Huge type, hard edges, one loud color.", variants: [{ id: "x-billboard", color: "Yellow" }, { id: "x-billboard-cobalt", color: "Cobalt" }, { id: "x-billboard-signal", color: "Signal red" }, { id: "x-billboard-forest", color: "Forest" }] },
  { id: "index", name: "Index", blurb: "A clean index of your notes, numbered and tidy.", variants: [{ id: "x-index-graphite", color: "Graphite" }, { id: "x-index-lime", color: "Lime" }, { id: "x-index-paper", color: "Paper" }] },
  { id: "chron", name: "Chronicle", blurb: "Your notes on a timeline.", variants: [{ id: "x-chron-teal", color: "Tide" }, { id: "x-chron-sun", color: "Sunrise" }, { id: "x-chron-night", color: "Midnight" }] },
  { id: "edit", name: "Editorial", blurb: "A magazine page for your thoughts.", variants: [{ id: "x-edit-serif", color: "Quiet" }, { id: "x-edit-fraunces", color: "Warm" }, { id: "x-edit-instrument", color: "Bold" }, { id: "x-edit-noir", color: "Noir" }] },
  { id: "field", name: "Field Notes", blurb: "A rugged field log in a monospace hand.", variants: [{ id: "x-field-lime", color: "Lime" }, { id: "x-field-amber", color: "Amber" }, { id: "x-field-paper", color: "Paper" }] },
  { id: "atlas", name: "Atlas", blurb: "Big friendly cards for everything you keep.", variants: [{ id: "x-atlas-blue", color: "Blue" }, { id: "x-atlas-coral", color: "Coral" }, { id: "x-atlas-mint", color: "Mint" }, { id: "x-atlas-violet", color: "Violet" }, { id: "x-atlas-sage", color: "Sage" }] },
  { id: "stream", name: "Stream", blurb: "One flowing feed, bright and quick.", variants: [{ id: "x-stream-orange", color: "Orange" }, { id: "x-stream-cobalt", color: "Cobalt" }, { id: "x-stream-neon", color: "Neon" }] },
];

const BY_ID = new Map(LOOK_FAMILIES.flatMap((f) => f.variants.map((v) => [v.id, f] as const)));
/** The family a look belongs to, if it's one color of a design. */
export const familyOf = (id: string): LookFamily | undefined => BY_ID.get(id);
