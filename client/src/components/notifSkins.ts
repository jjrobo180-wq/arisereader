// The notification panel dresses for the hub's theme (Customize → Theme): its colors, type, corners
// and a few words of its own, so it looks like part of the theme instead of one dark box for all.
// The colors live in notifSkins.css; here are the words, read when the panel opens from what the hub
// put on the page (html data-hub-theme / data-hub-night, set by useHubLook).

export type NotifWords = { title: string; needs: string; updates: string; empty: string; emptySub: string; open: string; clear: string; markRead: string; settings: string; hint: string };

const BASE: NotifWords = {
  title: "Notifications", needs: "Needs you", updates: "Updates", empty: "You're all caught up", emptySub: "New tasks and updates show up here.",
  open: "Open", clear: "Clear all", markRead: "Mark all read", settings: "Notification settings", hint: "Tasks clear by themselves once they're done. Use × to hide one for now.",
};

/** Each theme's own words (anything left out uses the plain ones). Kept short and clear: it's still a list of what needs doing. */
const WORDS: Record<string, Partial<NotifWords>> = {
  crt: { title: "> NOTIFICATIONS", needs: "! NEEDS YOU", updates: "* UPDATES", empty: "NO NEW MESSAGES_", emptySub: "READY.", open: "RUN", clear: "CLR", markRead: "ACK ALL", settings: "> SETTINGS" },
  console: { title: "~/notifications", needs: "needs-you/", updates: "updates/", empty: "0 unread", emptySub: "$ nothing to do", open: "open", clear: "rm -all", markRead: "mark-read --all", settings: "$ settings" },
  tile: { title: "notifications", needs: "needs you", updates: "updates", empty: "all caught up", open: "open", clear: "clear all", markRead: "mark all read", settings: "settings" },
  gazette: { title: "Bulletins", needs: "Front Page", updates: "In Brief", empty: "No news today", emptySub: "The presses are quiet.", open: "Read on", settings: "Subscription settings" },
  typewriter: { title: "Memos", needs: "Urgent", updates: "For your information", empty: "The tray is empty.", open: "Open file" },
  retro: { title: "Notifications.exe", needs: "Action required", updates: "Messages", empty: "No new messages.", open: "Open...", clear: "Clear All", markRead: "Mark All Read", settings: "Properties..." },
  millennium: { title: "Notification Area", needs: "Action required", updates: "Messages", open: "Open", settings: "Properties" },
  desktop: { title: "Notification Center", needs: "Needs you", updates: "Earlier" },
  workstation: { title: "Notifications", needs: "Focus", updates: "Other" },
  cassette: { title: "Notifications", needs: "Side A · Needs you", updates: "Side B · Updates", empty: "Blank tape", open: "Play" },
  vinyl: { title: "Now playing", needs: "Side A", updates: "Side B", empty: "Silence", open: "Play" },
  arcade: { title: "QUEST LOG", needs: "ACTIVE QUESTS", updates: "LOOT", empty: "ALL CLEAR!", emptySub: "PRESS + FOR A NEW QUEST", open: "GO", clear: "CLEAR", markRead: "TAKE ALL", settings: "OPTIONS" },
  cockpit: { title: "Alerts", needs: "Master caution", updates: "Advisories", empty: "All systems normal", open: "Engage" },
  blueprint: { title: "Change notices", needs: "Open items", updates: "Revisions", empty: "No open items" },
  darkroom: { title: "Contact sheet", needs: "Developing", updates: "Proofs", empty: "Nothing in the tray" },
  zen: { title: "A few gentle notes", needs: "When you're ready", updates: "Along the way", empty: "All is still.", emptySub: "Nothing is asking for you.", open: "Tend to it" },
  hush: { title: "notes", needs: "soon", updates: "lately", empty: "nothing.", emptySub: "", open: "open", clear: "clear", markRead: "read all", settings: "settings" },
  deck: { title: "Cards", needs: "Top of the deck", updates: "Dealt earlier", empty: "Deck is empty" },
  chatline: { title: "Messages", needs: "Waiting for a reply", updates: "Earlier", empty: "No new messages", open: "Reply" },
  orbit: { title: "Signals", needs: "In range", updates: "Received", empty: "Clear skies" },
  neon: { title: "SYS.ALERTS", needs: "PRIORITY", updates: "LOG", empty: "ALL CLEAR", emptySub: "SYS ONLINE", open: "EXEC", clear: "PURGE", markRead: "ACK", settings: "CONFIG" },
  monolith: { title: "NOTICES", needs: "REQUIRED", updates: "NOTED", empty: "NOTHING REMAINS", open: "OPEN", clear: "CLEAR", markRead: "READ ALL", settings: "SETTINGS" },
  ink: { title: "Correspondence", needs: "Awaiting reply", updates: "Received", empty: "No letters today", open: "Read" },
  margin: { title: "Margin notes", needs: "Circled", updates: "Jotted", empty: "Clean margins" },
  atelier: { title: "Notes from the studio", needs: "On the easel", updates: "In the sketchbook", empty: "Nothing to edit today" },
  timeline: { title: "Timeline", needs: "Now", updates: "Earlier" },
  studio: { title: "Notifications", needs: "In the queue", updates: "Played" },
  punch: { title: "HEADS UP!", needs: "DO IT!", updates: "NEWS", empty: "ALL DONE!", open: "GO!" },
  swiss: { title: "Notifications", needs: "01 Action", updates: "02 Updates" },
  frost: { title: "Notifications", needs: "Today", updates: "Earlier" },
  grove: { title: "Notes from the grove", needs: "Ripe", updates: "Fallen leaves", empty: "Nothing is waiting for you." },
  tide: { title: "Tide notes", needs: "High tide", updates: "Washed up", empty: "Calm waters" },
  aurora: { title: "Notifications", needs: "Rising", updates: "Earlier" },
  bloom: { title: "Notifications", needs: "In bloom", updates: "Petals" },
  glass: { title: "Notifications", needs: "Needs you", updates: "Earlier" },
  pocket: { title: "Notifications", needs: "Today", updates: "Earlier" },
  synth: { title: "Tracklist", needs: "Now playing", updates: "Played", empty: "0 tracks", open: "Play" },
  slots: { title: "Notifications", needs: "Your turn", updates: "Paid out", empty: "No spins left", open: "Pull" },
  orrery: { title: "Signals", needs: "In orbit", updates: "Passed by", empty: "The sky is clear" },
  dial: { title: "Stations", needs: "On air", updates: "Earlier broadcasts", empty: "Static", open: "Tune in" },
  bubbles: { title: "Bubbles", needs: "Pop these", updates: "Popped", empty: "Nothing to pop" },
  marbles: { title: "Notifications", needs: "In the jar", updates: "Rolled away", empty: "Empty jar" },
  lava: { title: "Notifications", needs: "Warming up", updates: "Cooled", empty: "All calm" },
  jelly: { title: "Notifications", needs: "Squish these", updates: "Squished", empty: "Nothing to squish" },
  spinner: { title: "Notifications", needs: "Spinning", updates: "Stopped", empty: "All still" },
  ferro: { title: "NOTIFICATIONS", needs: "PULLING", updates: "SETTLED", empty: "NOTHING WAITING" },
};

/** The hub theme showing right now, as a skin name for the panel ("" = the plain dark panel). */
export function notifSkin(): string {
  if (typeof document === "undefined") return "";
  const d = document.documentElement.dataset;
  const theme = d.hubLook || d.hubTheme || "";
  if (theme && theme !== "classic") return theme;
  return d.hubNight === "1" ? "night" : theme === "classic" ? "classic" : "";
}

export function notifWords(skin: string): NotifWords {
  return { ...BASE, ...(WORDS[skin] ?? {}) };
}
