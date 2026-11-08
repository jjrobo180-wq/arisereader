// How the looks are organized in the pickers (Arise Notes > Settings > Appearance, and To Duo's
// Customize): the groups, and the name and description each look is shown with. The look's own
// colors and type stay in notesThemes.ts / protoLooks.ts; this is only the shelf they sit on.
import { NOTES_THEMES, type NotesTheme } from "./notesThemes";

export type LookGroupId = "loud" | "calm" | "pro" | "dark" | "tactile" | "play" | "structure" | "original";
export const LOOK_GROUPS: { id: LookGroupId; name: string; note: string }[] = [
  { id: "loud", name: "Bold & loud", note: "Big type, strong colour, impossible to miss." },
  { id: "calm", name: "Calm & writerly", note: "Quiet pages and warm paper for thinking slowly." },
  { id: "pro", name: "Clean & professional", note: "Minimal, precise, and easy on the eyes at work." },
  { id: "dark", name: "After dark", note: "Dark looks that glow instead of glare." },
  { id: "tactile", name: "Tactile & retro", note: "Real objects: tapes, records, typewriters and old computers." },
  { id: "play", name: "Playful & interactive", note: "Toys you can touch while you think." },
  { id: "structure", name: "Organized & structured", note: "Folders, timelines, dashboards and clear sections." },
  { id: "original", name: "The original", note: "How Arise has always looked." },
];

/** Older looks: [id, name, description, group]. */
const OLD: [string, string, string, LookGroupId][] = [
  ["classic", "Original", "The look Arise launched with: soft violet, friendly and familiar.", "original"],
  ["studio", "Coral Night", "Dark and confident, with a hot coral Record button.", "dark"],
  ["margin", "Blue Ink", "Crisp white pages and a blue-pen accent, with dates down the margin.", "pro"],
  ["bloom", "Violet Pop", "Bold violet with big, friendly, rounded shapes.", "play"],
  ["timeline", "Day by Day", "Soft teal, rounded type and a timeline that tells your day as a story.", "calm"],
  ["console", "Terminal", "Black and green like a command line. Every button is a command.", "dark"],
  ["swiss", "Swiss Grid", "Red, white and a strict grid. Nothing decorative.", "pro"],
  ["cassette", "Mixtape", "A warm tape deck. Your recordings are tracks, and the reels really turn.", "tactile"],
  ["frost", "Glacier", "Icy blue panels that feel like frosted glass.", "calm"],
  ["grove", "Fernwood", "Calm forest green with elegant headings.", "calm"],
  ["gazette", "Daily Gazette", "A newspaper front page for your day, with a masthead and headlines.", "tactile"],
  ["punch", "Pop Art", "Loud colours and thick black outlines.", "loud"],
  ["chatline", "Messenger", "Bright and clean, like a conversation with your notes.", "pro"],
  ["deck", "Flip Deck", "Colourful cards you flip through one at a time.", "structure"],
  ["tide", "Deep Tide", "One deep teal and a running gauge of your days.", "dark"],
  ["vinyl", "Turntable", "Warm black and gold, with a record that really spins.", "tactile"],
  ["hush", "Whisper", "Almost nothing. Just what is next.", "pro"],
  ["aurora", "Northern Lights", "Slow green and violet lights drifting behind your day.", "dark"],
  ["atelier", "Couture", "Cream, bronze and the fine serif type of a fashion house.", "calm"],
  ["blueprint", "Blueprint", "Your day drafted on a technical drawing sheet.", "structure"],
  ["arcade", "Arcade", "Quests, points and levels in pixel neon.", "play"],
  ["typewriter", "Typewriter", "Paper, ink and round keys that press down.", "tactile"],
  ["darkroom", "Darkroom", "Safelight red and a strip of film.", "dark"],
  ["zen", "Zen Garden", "Raked sand, stones and a slow breath.", "calm"],
  ["cockpit", "Cockpit", "Dials, switches and an amber glow.", "dark"],
  ["pocket", "Pocket Phone", "A phone home screen: app icons, widgets and a frosted tab bar.", "structure"],
  ["glass", "Glass", "Clear panes floating over slow, glowing colour.", "dark"],
  ["desktop", "Desktop", "A computer desktop: menu bar, windows and a dock that grows under your finger.", "structure"],
  ["millennium", "Y2K Desktop", "An early-2000s desktop with a blue taskbar and glossy windows.", "tactile"],
  ["workstation", "Workstation", "A modern PC: a centred taskbar and soft frosted windows.", "structure"],
  ["retro", "Retro 98", "Grey beveled windows, a teal desktop and chunky 3-D buttons.", "tactile"],
  ["monolith", "Monolith", "Black, gold and giant type. Quiet luxury.", "dark"],
  ["ink", "E-Ink", "Paper-white and perfectly still, like an e-reader. Nothing moves.", "calm"],
  ["neon", "Neon HUD", "A glowing heads-up display after dark.", "dark"],
  ["orbit", "Watch Face", "Rings that close as your day fills in.", "dark"],
  ["spinner", "Fidget Spinner", "Flick it. It clicks, buzzes and counts your day.", "play"],
  ["bubbles", "Bubble Wrap", "Pop a task to finish it.", "play"],
  ["lava", "Lava Lamp", "A warm lamp that bubbles faster when you touch it.", "play"],
  ["marbles", "Marble Jar", "Your tasks as glass marbles. Shake the jar.", "play"],
  ["synth", "Synth Keys", "A glowing keyboard you can play, with a beat that follows your day.", "play"],
  ["jelly", "Jelly", "Squishy, wobbly buttons that boing.", "play"],
  ["orrery", "Orrery", "Your week as planets around today. Spin the system.", "play"],
  ["dial", "Radio Dial", "A brass radio dial that clicks into place.", "tactile"],
  ["ferro", "Liquid Metal", "Silver that reaches for your finger.", "play"],
  ["slots", "Slot Machine", "Pull the lever and the machine picks what to do next.", "play"],
  ["editorial", "Sage Editorial", "Quiet white pages, deep sage and plenty of space.", "pro"],
  ["slatepro", "Slate", "Precise blue-grey for a focused workspace.", "pro"],
  ["graphitepro", "Graphite", "Refined charcoal with understated contrast.", "dark"],
  ["linenpro", "Linen", "Warm ivory, muted espresso and soft edges.", "calm"],
  ["paper", "Notepad", "Clean white pages, grouped lists and a warm yellow touch.", "pro"],
  ["midnight", "Midnight", "Deep blue-black and soft light. Easy on the eyes at night.", "dark"],
  ["folio", "Folio", "Warm paper and a fine serif title, like a leather notebook.", "calm"],
  ["nordic", "Nordic", "Cool grey, crisp lines and calm steel blue.", "pro"],
  ["carbon", "Carbon", "Matte black and white. Nothing extra.", "dark"],
];
const OLD_BY_ID = new Map(OLD.map((o) => [o[0], o]));

export type LookInfo = { id: string; name: string; blurb: string; group: LookGroupId; swatch: string[]; look: NotesTheme };
/** What the pickers show for a look: its name, description, group and colour swatch. */
export function lookInfo(t: NotesTheme): LookInfo {
  const o = OLD_BY_ID.get(t.id);
  return { id: t.id, name: o ? o[1] : t.label, blurb: o ? o[2] : t.blurb, group: (o ? o[3] : (t.group as LookGroupId)) ?? "pro", swatch: [t.bg, t.card, t.accent, t.ink], look: t };
}
/** Every look, grouped for the picker: the groups in order, the Studio series first inside each. */
export function groupedLooks(): { group: (typeof LOOK_GROUPS)[number]; items: LookInfo[] }[] {
  const all = NOTES_THEMES.map(lookInfo);
  return LOOK_GROUPS.map((group) => ({ group, items: [...all.filter((l) => l.group === group.id && l.id.startsWith("x-")), ...all.filter((l) => l.group === group.id && !l.id.startsWith("x-"))] })).filter((g) => g.items.length);
}
