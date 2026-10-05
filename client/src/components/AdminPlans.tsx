// Admin card: plans and billing.
// Turn plan rules on or off, see who has Premium, switch it on by hand for a
// teacher or school, and store the Stripe keys that online payment needs.
import { useEffect, useState } from "react";
import { BadgeCheck, CreditCard, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLANS, usd } from "@shared/plans";

type PlanRow = { kind: "teacher" | "school"; ownerId: number; name: string; students: number; source: "stripe" | "admin"; status: string; seats: number; endsAt: string | null; live: boolean; note: string };
type FreeSchool = { id: number; name: string; free: boolean; byName: boolean };
type AdminPlansData = {
  enforced: boolean;
  plans: PlanRow[];
  freeSchools?: FreeSchool[];
  stripe: { keySet: boolean; keyPreview: string; keyFromHosting: boolean; webhookSet: boolean; webhookPreview: string; webhookFromHosting: boolean };
};

function cookieToken(): string | null {
  try {
    const c = document.cookie.split(";").map((v) => v.trim()).find((v) => v.startsWith("arise_session="));
    return c ? JSON.parse(atob(c.substring("arise_session=".length))).token || null : null;
  } catch { return null; }
}
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No end date");
const select = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export default function AdminPlans() {
  const { token } = useAuth();
  const auth = () => ({ Authorization: `Bearer ${token || cookieToken()}` });
  const [data, setData] = useState<AdminPlansData | null>(null);
  const [schools, setSchools] = useState<{ id: number; name: string }[]>([]);
  const [teachers, setTeachers] = useState<{ id: number; displayName: string; username: string }[]>([]);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [kind, setKind] = useState<"teacher" | "school">("school");
  const [ownerId, setOwnerId] = useState("");
  const [months, setMonths] = useState("12");
  const [blocks, setBlocks] = useState("1");
  const [grantNote, setGrantNote] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/plans`, { headers: auth(), cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch { /* the card says so below */ }
  };
  useEffect(() => {
    void load();
    fetch(`${API_BASE}/api/admin/schools`, { headers: auth() }).then((r) => (r.ok ? r.json() : [])).then((d) => setSchools(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${API_BASE}/api/teacher-admin/teachers`, { headers: auth() }).then((r) => (r.ok ? r.json() : [])).then((d) => setTeachers(Array.isArray(d) ? d : [])).catch(() => {});
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const post = async (what: string, path: string, body: unknown, done: string) => {
    setBusy(what); setNote(null);
    try {
      const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers: { ...auth(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "That didn't work.");
      setNote({ ok: true, text: done });
      await load();
      return true;
    } catch (e: any) {
      setNote({ ok: false, text: e.message || "That didn't work." });
      return false;
    } finally { setBusy(""); }
  };

  const toggleRules = async () => {
    if (!data) return;
    const turnOn = !data.enforced;
    const freeNames = (data.freeSchools || []).filter((f) => f.free).map((f) => f.name).join(", ");
    const noPayment = turnOn && !data.stripe.keySet ? "Online payment is not set up yet, so a new teacher would have no way to pay. Set the Stripe key first, or switch Premium on by hand for each teacher.\n\n" : "";
    const question = turnOn
      ? noPayment + "Turn plan rules ON?\n\n" + (freeNames ? `Teachers at ${freeNames} always have Premium at no charge.\n\n` : "") + "Other teachers who signed up on or after October 1, 2026 will need Premium to use their account. Students on Free lose AI study sets and lessons from their own topics. Parents can follow up to 5 children.\n\nTeachers and school students who signed up before October 1, 2026 keep everything until July 1, 2027."
      : "Turn plan rules OFF?\n\nEverything opens up for everyone again. Paid plans keep running and keep being charged.";
    if (!window.confirm(question)) return;
    await post("rules", "/api/admin/plans/enforce", { enforced: turnOn }, turnOn ? "Plan rules are on." : "Plan rules are off.");
  };
  const grant = async () => {
    if (!ownerId) { setNote({ ok: false, text: kind === "school" ? "Choose a school." : "Choose a teacher." }); return; }
    const ok = await post("grant", "/api/admin/plans/grant", { kind, ownerId: Number(ownerId), months: Number(months), blocks: Number(blocks), note: grantNote }, "Premium is on for them.");
    if (ok) { setOwnerId(""); setGrantNote(""); }
  };
  const revoke = async (row: PlanRow) => {
    if (!window.confirm(`Switch Premium off for ${row.name}?`)) return;
    await post(`revoke-${row.kind}-${row.ownerId}`, "/api/admin/plans/revoke", { kind: row.kind, ownerId: row.ownerId }, "Premium is off for them.");
  };
  const setFree = async (school: FreeSchool, free: boolean) => {
    if (!free && !window.confirm(`Stop ${school.name} being free?\n\nIts teachers will need a paid plan once plan rules are on, unless they signed up before October 1, 2026.`)) return;
    await post(`free-${school.id}`, "/api/admin/plans/free-school", { schoolId: school.id, free }, free ? `${school.name} is always free now.` : `${school.name} is no longer free.`);
  };
  const saveKeys = async () => {
    const ok = await post("keys", "/api/admin/plans/stripe", { secretKey: secretKey.trim() || undefined, webhookSecret: webhookSecret.trim() || undefined }, "Saved.");
    if (ok) { setSecretKey(""); setWebhookSecret(""); }
  };

  // Stripe has to reach the site's server, which can live at a different address from the pages.
  const webhookUrl = (() => {
    try { return new URL(`${API_BASE}/api/billing/webhook`, window.location.origin).href; }
    catch { return `${window.location.origin}/api/billing/webhook`; }
  })();

  return (
    <Card className="shadow-md border-violet-500/30" data-testid="admin-plans">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <CreditCard className="w-5 h-5 text-violet-400" />
          Plans and billing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!data ? <p className="text-sm text-muted-foreground">Loading plans…</p> : (
          <>
            {/* Plan rules */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className={`w-4 h-4 ${data.enforced ? "text-green-400" : "text-muted-foreground"}`} />
                  Plan rules are {data.enforced ? "ON" : "OFF"}
                </div>
                <Button size="sm" variant={data.enforced ? "outline" : "default"} onClick={toggleRules} disabled={busy === "rules"} data-testid="admin-plans-toggle">
                  {busy === "rules" ? "Saving…" : data.enforced ? "Turn rules off" : "Turn rules on"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {data.enforced
                  ? "Teacher accounts need Premium, unless they teach at an always-free school below or signed up before October 1, 2026 (free until July 1, 2027). Students get AI study sets and lessons from their own topics only through a Premium teacher or school. Parents can follow up to 5 children."
                  : "Nothing is locked for anyone. Turn the rules on when you are ready for the Free and Premium plans to apply."}
              </p>
            </div>

            {/* Schools that are always free */}
            <div className="space-y-2 pt-4 border-t border-border" data-testid="admin-free-schools">
              <Label className="text-sm font-medium">Schools that are always free</Label>
              <p className="text-sm text-muted-foreground">
                Every teacher at these schools has Premium at no charge, now and when they sign up later, and so do the students in their classes. CGMS is picked out by its name. A teacher still needs your approval before their account works.
              </p>
              {(data.freeSchools || []).length === 0 ? <p className="text-sm text-muted-foreground">No schools have been added to the site yet.</p> : (
                <div className="space-y-2">
                  {(data.freeSchools || []).map((f) => (
                    <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2 font-semibold">
                        {f.free && <BadgeCheck className="w-4 h-4 shrink-0 text-green-400" />}
                        <span className="truncate">{f.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${f.free ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground"}`}>{f.free ? "Always free" : "Pays for Premium"}</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setFree(f, !f.free)} disabled={busy === `free-${f.id}`} data-testid={`admin-free-school-${f.id}`}>
                        {busy === `free-${f.id}` ? "Saving…" : f.free ? "Stop being free" : "Make always free"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Who has Premium */}
            <div className="space-y-2 pt-4 border-t border-border">
              <Label className="text-sm font-medium">Premium plans ({data.plans.filter((p) => p.live).length} active)</Label>
              {data.plans.length === 0 ? <p className="text-sm text-muted-foreground">No teacher or school has a plan yet.</p> : (
                <div className="space-y-2">
                  {data.plans.map((p) => (
                    <div key={`${p.kind}-${p.ownerId}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-semibold">
                          {p.live && <BadgeCheck className="w-4 h-4 shrink-0 text-green-400" />}
                          <span className="truncate">{p.name}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{p.kind === "school" ? "School" : "Teacher"}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.live ? "Active" : "Ended"} · {p.source === "stripe" ? "Paid online" : "Switched on by you"} · {p.students} of {p.seats.toLocaleString("en-US")} students · {p.live ? (p.endsAt ? `until ${day(p.endsAt)}` : "no end date") : `ended ${day(p.endsAt)}`}
                          {p.note ? ` · ${p.note}` : ""}
                        </div>
                      </div>
                      {p.live && p.source === "admin" && (
                        <Button size="sm" variant="outline" onClick={() => revoke(p)} disabled={busy === `revoke-${p.kind}-${p.ownerId}`}>Switch off</Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Switch Premium on by hand */}
            <div className="space-y-3 pt-4 border-t border-border">
              <Label className="text-sm font-medium">Switch Premium on by hand</Label>
              <p className="text-sm text-muted-foreground">For a school paying by check or purchase order, a pilot, or a gift. Nobody is charged.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">For</Label>
                  <select className={select} value={kind} onChange={(e) => { setKind(e.target.value as "teacher" | "school"); setOwnerId(""); }}>
                    <option value="school">A whole school (up to {PLANS.school.studentCap.toLocaleString("en-US")} students)</option>
                    <option value="teacher">One teacher</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{kind === "school" ? "School" : "Teacher"}</Label>
                  <select className={select} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                    <option value="">Choose…</option>
                    {kind === "school"
                      ? schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)
                      : teachers.map((t) => <option key={t.id} value={t.id}>{t.displayName || t.username}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">How long</Label>
                  <select className={select} value={months} onChange={(e) => setMonths(e.target.value)}>
                    <option value="1">1 month</option>
                    <option value="3">3 months</option>
                    <option value="12">12 months</option>
                    <option value="0">No end date</option>
                  </select>
                </div>
                {kind === "teacher" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Students covered</Label>
                    <select className={select} value={blocks} onChange={(e) => setBlocks(e.target.value)}>
                      {[1, 2, 3, 4, 5, 10].map((b) => <option key={b} value={b}>{(b * PLANS.teacher.studentsPerBlock).toLocaleString("en-US")} students</option>)}
                    </select>
                  </div>
                )}
              </div>
              <Input value={grantNote} onChange={(e) => setGrantNote(e.target.value)} maxLength={120} placeholder="Note for yourself (optional), such as PO 1234" />
              <Button size="sm" onClick={grant} disabled={busy === "grant"} data-testid="admin-plans-grant">{busy === "grant" ? "Saving…" : "Switch Premium on"}</Button>
            </div>

            {/* Online payment */}
            <div className="space-y-3 pt-4 border-t border-border">
              <Label className="text-sm font-medium">Online payment (Stripe)</Label>
              <p className="text-sm text-muted-foreground">
                Teachers pay {usd(PLANS.teacher.monthlyCents)} a month per {PLANS.teacher.studentsPerBlock} students, or {usd(PLANS.school.yearlyCents)} a year for a school. Payment stays closed until a Stripe secret key is set.
              </p>
              <div className="space-y-1 text-sm">
                <div className={data.stripe.keySet ? "text-green-400" : "text-muted-foreground"}>
                  Secret key: {data.stripe.keySet ? `set (${data.stripe.keyPreview})${data.stripe.keyFromHosting ? ", from your hosting settings" : ""}` : "not set"}
                </div>
                <div className={data.stripe.webhookSet ? "text-green-400" : "text-muted-foreground"}>
                  Webhook secret: {data.stripe.webhookSet ? `set (${data.stripe.webhookPreview})${data.stripe.webhookFromHosting ? ", from your hosting settings" : ""}` : "not set"}
                </div>
              </div>
              <Input type="password" autoComplete="off" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder="Stripe secret key (sk_live_...)" />
              <Input type="password" autoComplete="off" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder="Stripe webhook signing secret (whsec_...)" />
              <Button size="sm" variant="outline" onClick={saveKeys} disabled={busy === "keys" || (!secretKey.trim() && !webhookSecret.trim())}>{busy === "keys" ? "Saving…" : "Save keys"}</Button>
              <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Setting up the webhook in Stripe</p>
                <p>Add an endpoint with this address: <code className="break-all">{webhookUrl}</code></p>
                <p>Send it these events: checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted.</p>
                <p>Then paste that endpoint's signing secret above. Without it, payments and renewals are still picked up when the teacher next uses the site, but a cancellation is only noticed at the end of the paid period.</p>
                <p>Safer: set both as STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in your hosting settings instead of saving them here.</p>
              </div>
            </div>

            {note && <p className={`text-sm ${note.ok ? "text-green-400" : "text-red-400"}`} role="status">{note.text}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
