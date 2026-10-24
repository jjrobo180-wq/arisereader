// When the same hub is open twice at once (the two panes of Arise To Duo's split screen, or two
// tabs), a save in one tells the others right away so they pick it up before the person edits
// there, instead of waiting for the next timed check and then hitting "changed on another device".
type Kind = "todo" | "workhub";

const channelName = (kind: Kind, userId?: number | string) => `arise-saved:${kind}:${userId ?? "me"}`;

export function announceSaved(kind: Kind, userId?: number | string): void {
  try { const c = new BroadcastChannel(channelName(kind, userId)); c.postMessage(Date.now()); c.close(); } catch { /* older browser: the timed check still catches up */ }
}

/** Calls `refresh` when another copy saves, and when this copy is tapped back into (a pane gaining focus). */
export function onOtherCopySaved(kind: Kind, userId: number | string | undefined, refresh: () => void): () => void {
  let channel: BroadcastChannel | null = null;
  try { channel = new BroadcastChannel(channelName(kind, userId)); channel.onmessage = () => refresh(); } catch { channel = null; }
  window.addEventListener("focus", refresh);
  return () => { channel?.close(); window.removeEventListener("focus", refresh); };
}
