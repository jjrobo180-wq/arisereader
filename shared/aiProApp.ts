// Arise AI Pro: the premium AI assistant, a paid App Store add-on ($10/mo, see shared/plans.ts's
// "ai_pro" plan kind). Separate from the free assistant plugin (server/hubChat.ts's /api/hub-chat,
// "Your chat stays on this device" — a light, unmetered helper): AI Pro is the heavier, longer-
// context assistant with its own per-user monthly usage cap, so the flat $10/mo price keeps a
// healthy margin against the real per-call LLM cost.
//
// Margin math (GPT-4.1 pricing, ~$0.0044/turn at ~600 input + ~400 output tokens):
//   500 messages/month cap -> ~$2.20/mo cost per subscriber -> ~78% gross margin ($7.80 profit).

export const AI_PRO_MONTHLY_MESSAGE_LIMIT = 500;

export type AiProUsage = {
  /** "2026-10" style month key, so the count resets automatically each month. */
  month: string;
  count: number;
};

export function currentMonthKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** A saved usage record made safe, reset if it's from an earlier month. */
export function cleanAiProUsage(raw: unknown, now = new Date()): AiProUsage {
  const month = currentMonthKey(now);
  if (!raw || typeof raw !== "object") return { month, count: 0 };
  const r = raw as any;
  if (r.month !== month) return { month, count: 0 };
  const count = Number.isFinite(r.count) && r.count >= 0 ? Math.floor(r.count) : 0;
  return { month, count: Math.min(count, AI_PRO_MONTHLY_MESSAGE_LIMIT + 50) };
}

export const aiProMessagesLeft = (usage: AiProUsage): number => Math.max(0, AI_PRO_MONTHLY_MESSAGE_LIMIT - usage.count);
export const aiProCanSend = (usage: AiProUsage): boolean => usage.count < AI_PRO_MONTHLY_MESSAGE_LIMIT;
