// Teacher Hub: the replies to the teacher's polls, newest first, for the bell in the Hub's header.
export type AlertPoll = {
  id: string; title: string; status: "open" | "booked";
  options: { id: string; label: string }[];
  invitees: { id: string; name: string; answers: Record<string, "yes" | "maybe" | "no">; comment: string; respondedAt: string | null }[];
};

export type PollReply = { key: string; pollId: string; title: string; name: string; at: string; unread: boolean; works: string[]; comment: string; booked: boolean };

const DAYS = 14;

/** Replies from the last two weeks. `seen` is when the teacher last opened the bell (ms); newer replies are unread. */
export function pollReplies(polls: AlertPoll[], seen: number, nowMs = Date.now()): PollReply[] {
  const out: PollReply[] = [];
  for (const poll of polls) {
    for (const person of poll.invitees) {
      const at = person.respondedAt ? Date.parse(person.respondedAt) : NaN;
      if (!Number.isFinite(at) || nowMs - at > DAYS * 86_400_000) continue;
      out.push({
        key: `${person.id}:${person.respondedAt}`, pollId: poll.id, title: poll.title, name: person.name, at: person.respondedAt!, unread: at > seen,
        works: poll.options.filter((o) => person.answers?.[o.id] === "yes").map((o) => o.label), comment: person.comment || "", booked: poll.status === "booked",
      });
    }
  }
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 30);
}
