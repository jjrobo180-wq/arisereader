// Admin > Inbox: messages from people who can't get into their account, sent from the sign-in
// screen without an account (server/helpTickets.ts). They can't be answered in the inbox's
// conversations, so each one shows who to find and, if they gave one, the email to reply to.
import { useCallback, useEffect, useState } from "react";
import { Check, LifeBuoy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/queryClient";
import { relativeTime, sessionToken } from "@/lib/notifications";
import { AdminSection } from "./AdminUi";

type Ticket = { id: number; firstName: string; lastName: string; school: string; grade: string; advisory: string; issue: string; email: string; createdAt: string };

export default function HelpTickets({ token }: { token: string | null }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState("");
  const headers = useCallback(() => ({ Authorization: `Bearer ${token || sessionToken()}`, "Content-Type": "application/json" }), [token]);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/admin/help-tickets`, { headers: headers(), cache: "no-store" });
      if (!r.ok) throw new Error("load");
      const d = await r.json();
      setTickets(Array.isArray(d?.tickets) ? d.tickets : []);
      setError("");
    } catch {
      setError("Couldn't load help tickets.");
    }
  }, [headers]);
  useEffect(() => { void load(); }, [load]);

  const done = async (id: number) => {
    const before = tickets;
    setTickets((list) => list.filter((t) => t.id !== id));
    try {
      const r = await fetch(`${API_BASE}/api/admin/help-tickets/${id}/done`, { method: "POST", headers: headers() });
      if (!r.ok) throw new Error("done");
    } catch {
      setTickets(before);
      setError("Couldn't mark that ticket done. Try again.");
    }
  };

  if (!tickets.length && !error) return null;
  return (
    <AdminSection id="help-tickets" icon={LifeBuoy} tone="amber" title="Help tickets" count={tickets.length} description="From the sign-in screen, sent without an account. No email means they expect you in their advisory by the following school day." bodyClassName="space-y-3">
      {error && <p role="alert" className="text-sm font-semibold text-red-500">{error}</p>}
      {tickets.map((t) => (
        <article key={t.id} data-testid="help-ticket" className="min-w-0 rounded-xl border border-border/60 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="min-w-0 font-bold [overflow-wrap:anywhere]">{t.firstName} {t.lastName}</h3>
            <span className="text-xs text-muted-foreground">{relativeTime(t.createdAt)}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">{t.school} · {t.grade === "K" ? "Kindergarten" : `Grade ${t.grade}`} · Advisory: {t.advisory}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{t.issue}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {t.email
              ? <Button asChild size="sm" variant="outline"><a href={`mailto:${encodeURIComponent(t.email)}?subject=${encodeURIComponent("Your A.R.I.S.E. Reader help request")}`}><Mail className="mr-1.5 h-4 w-4" />Email {t.email}</a></Button>
              : <span className="self-center text-xs font-semibold text-muted-foreground">No email: see them in advisory</span>}
            <Button size="sm" variant="secondary" onClick={() => void done(t.id)}><Check className="mr-1.5 h-4 w-4" />Done</Button>
          </div>
        </article>
      ))}
    </AdminSection>
  );
}
