// The Arise marketplace (November 2026), like Thumbtack for trainers: a client posts what they need (the same six
// answers as matching), trainers who fit get told and reply with a short pitch and a price, and the client hires
// one in a tap. Server: server/coach.ts. Matching rules: shared/coachMatch.ts.
import { MODE_LABEL, type PublicTrainer, type TrainerProfile } from "./coach";
import { matchTrainers, type Need } from "./coachMatch";

export type MarketReply = { trainerId: number; at: string; message: string; price: string };
export type MarketRequest = { id: string; clientId: number; name: string; at: string; need: Need; status: "open" | "hired" | "closed"; hired: number | null; replies: MarketReply[] };
export const MARKET = { days: 14, openPerClient: 3, replies: 12, notify: 15, total: 1000 };

export const isOpen = (r: MarketRequest, now: number) => r.status === "open" && now - Date.parse(r.at) < MARKET.days * 864e5;
/** A short title a trainer scans: "Fat loss · Online coaching or In person · Denver area". */
export const requestTitle = (n: Need, city = "") => [n.goal || "General fitness", n.modes.length ? n.modes.map((m) => MODE_LABEL[m]).join(" or ") : "Any way", n.modes.includes("inPerson") && (city || n.state) ? `${city || n.state} area` : ""].filter(Boolean).join(" · ");
/** Would this trainer be a fit? The same rules as matching (taking clients, a way to train, in person only nearby). */
export const trainerFits = (t: PublicTrainer, r: MarketRequest) => matchTrainers([t], { ...r.need, budgetCents: 0 }, 1).length > 0;
/** What a trainer sees: first name, the answers, the area (never the ZIP or the account). */
export const forTrainer = (r: MarketRequest, trainerId: number) => {
  const mine = r.replies.find((x) => x.trainerId === trainerId) ?? null;
  return { id: r.id, name: r.name.split(" ")[0], at: r.at, title: requestTitle(r.need), need: { ...r.need, zip: r.need.zip ? `${r.need.zip.slice(0, 3)}xx` : "" }, replies: r.replies.length, mine, status: r.status, hiredMe: r.hired === trainerId };
};
export const cleanReply = (raw: any, trainerId: number, at: string): MarketReply | null => {
  const message = typeof raw?.message === "string" ? raw.message.trim().slice(0, 800) : "";
  const price = typeof raw?.price === "string" ? raw.price.trim().slice(0, 60) : "";
  return message.length >= 10 ? { trainerId, at, message, price } : null;
};
/** Who to tell about a new request: listed trainers who fit, best match first. */
export const whoToTell = (list: PublicTrainer[], r: MarketRequest) => matchTrainers(list.filter((t) => t.id !== r.clientId), r.need, MARKET.notify).map((m) => m.trainer.id);
export const replyNote = (p: Pick<TrainerProfile, "name">, r: MarketRequest) => `${p.name} replied to your request (${r.need.goal || "fitness"}).`;
