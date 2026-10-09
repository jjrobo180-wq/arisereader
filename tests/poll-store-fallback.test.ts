// Run with: npx tsx --test tests/poll-store-fallback.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { createSupabasePollStore } from "../server/meetingPoll";

/** A tiny pretend database that refuses columns the newer SQL has not added yet. */
function oldDatabase() {
  const missing: Record<string, string[]> = { meeting_polls: ["sender_name", "reply_to", "send_via", "send_text"], meeting_poll_invitees: ["phone"] };
  return {
    from(table: string) {
      return {
        insert(rows: any) {
          const list = Array.isArray(rows) ? rows : [rows];
          const bad = list.flatMap((r) => Object.keys(r)).find((k) => missing[table]?.includes(k));
          const made = list.map((r, n) => ({ id: `${table}-${n}`, created_at: "now", status: "open", chosen_option: null, answers: {}, comment: "", email_sent: false, ...r }));
          const result: any = bad ? { data: null, error: { message: `Could not find the '${bad}' column of '${table}'` } } : { data: Array.isArray(rows) ? made : made[0], error: null };
          const chain: any = { select: () => ({ single: async () => result, then: (f: any) => f(result) }), delete: () => ({ eq: async () => ({}) }) };
          return chain;
        },
        delete: () => ({ eq: async () => ({}) }),
      };
    },
  };
}

test("a poll made before the new SQL was run still comes back as send-it-yourself, with phone numbers", async () => {
  const store = createSupabasePollStore(oldDatabase());
  const made = await store.create(
    { teacher_id: 7, title: "IEP", location: "", message: "", hub_meeting_id: "", sender_name: "Ms. R", reply_to: "r@x.org", send_via: "self", send_text: false, options: [] } as any,
    [{ name: "Dad", email: "", phone: "+15551234567", role: "Parent or guardian", token: "tok1" }],
  );
  assert.equal(made.poll.send_via, "self");
  assert.equal(made.invitees[0].phone, "+15551234567");
});
