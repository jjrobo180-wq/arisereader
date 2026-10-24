// Arise To Duo split screen (/duo): inside each pane.
// The split screen shows ONE floating button for both sides (pages/DuoSplit.tsx), so each pane hides
// its own Add and AI buttons (index.css, html[data-duo-pane]) and does what that one button asks
// when it is dropped on this side: open this hub's Add menu, or its AI assistant.
import { inDuoPane } from "@/lib/useAriseDuo";

export type DuoPaneAction = "add" | "ai";
export type DuoPaneMessage = { type: "arise-duo-action"; action: DuoPaneAction };
export type DuoPaneReply = { type: "arise-duo-result"; action: DuoPaneAction; ok: boolean };

const ADD = ['[data-testid="life-add-button"]', '[data-testid="quick-add-event"]'];
const AI = ['[data-testid="hub-chat-open"]'];

function press(selectors: string[]): boolean {
  for (const s of selectors) {
    const el = document.querySelector<HTMLElement>(s);
    if (el) { el.click(); return true; }
  }
  return false;
}

export function installDuoPaneBridge(): void {
  if (!inDuoPane()) return;
  document.documentElement.dataset.duoPane = "1";
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    const data = event.data as Partial<DuoPaneMessage> | null;
    if (!data || data.type !== "arise-duo-action" || (data.action !== "add" && data.action !== "ai")) return;
    const ok = press(data.action === "add" ? ADD : AI);
    const reply: DuoPaneReply = { type: "arise-duo-result", action: data.action, ok };
    window.parent.postMessage(reply, window.location.origin);
  });
}
