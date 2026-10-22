// Arise WorkHub: answers to your meeting polls. They count in the header's notification bell, and
// opening that item shows the answers here.
import { useCallback, useEffect, useState } from "react";
import { pollReplies, type AlertPoll, type PollReply } from "@shared/hubPollAlerts";
import { api } from "./HubAvailability";
import { HubModal } from "./HubModal";
import { Empty, GhostButton, PrimaryButton } from "./ui";

const keyFor = (userId: unknown) => `arise-hub-poll-seen-${userId ?? "me"}`;
const readSeen = (userId: unknown) => { try { const v = Number(localStorage.getItem(keyFor(userId))); if (v) return v; localStorage.setItem(keyFor(userId), String(Date.now())); return Date.now(); } catch { return Date.now(); } };

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** The answers to the teacher's polls, and how many they have not looked at yet. */
export function usePollAnswers(token: string | null, userId: unknown, enabled: boolean) {
  const [polls, setPolls] = useState<AlertPoll[]>([]);
  const [seen, setSeen] = useState(() => readSeen(userId));

  const load = useCallback(async () => {
    try { const d = await api(token, "GET", "/api/teacher-hub/polls"); setPolls(d.polls || []); } catch { /* the count just stays as it was */ }
  }, [token]);

  useEffect(() => {
    if (!enabled || !token) return;
    void load();
    const tick = () => { if (document.visibilityState === "visible") void load(); };
    const timer = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [enabled, token, load]);

  const replies = pollReplies(polls, seen);
  const unread = replies.filter((r) => r.unread).length;
  const markRead = () => { const now = Date.now(); setSeen(now); try { localStorage.setItem(keyFor(userId), String(now)); } catch { /* fine */ } };
  return { replies, unread, markRead, reload: load };
}

export default function PollAnswers({ replies, markRead, onClose, onOpenMeetings }: { replies: PollReply[]; markRead: () => void; onClose: () => void; onOpenMeetings: () => void }) {
  return (
        <HubModal title="Poll answers" onClose={onClose} closeOnBackdrop footer={<div className="flex flex-wrap gap-2"><GhostButton onClick={markRead}>Mark all read</GhostButton><PrimaryButton onClick={() => { markRead(); onClose(); onOpenMeetings(); }}>Open meetings</PrimaryButton></div>}>
          {replies.length ? (
            <ul className="space-y-2" data-testid="hub-poll-replies">
              {replies.map((r) => (
                <li key={r.key} className={`rounded-2xl border p-3 ${r.unread ? "border-teal-500 bg-teal-50/60" : "border-slate-200"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><div className="font-semibold text-slate-900">{r.name} answered</div><div className="break-words text-sm text-slate-600">{r.title}</div></div>
                    {r.unread && <span className="shrink-0 rounded-full bg-teal-600 px-2 text-[11px] font-semibold text-white">New</span>}
                  </div>
                  <div className="mt-1 text-sm text-slate-700">{r.works.length ? <>Works: {r.works.join(", ")}</> : "No time works for them."}</div>
                  {r.comment && <p className="mt-1 break-words border-l-2 border-slate-300 pl-2 text-sm text-slate-600">{r.comment}</p>}
                  <div className="mt-1 text-xs text-slate-500">{when(r.at)}{r.booked ? " · Time booked" : ""}</div>
                </li>
              ))}
            </ul>
          ) : <Empty>No answers yet. When someone answers a poll, it shows up here, and you get an email.</Empty>}
        </HubModal>
  );
}
