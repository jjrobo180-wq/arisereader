// Moving to Arise Trainer, in the Business tab: import clients and workouts from Trainerize, TrueCoach or any
// spreadsheet (CSV), email everyone your invite link, and export everything any time. Server: server/coach.ts.
import { useState } from "react";
import { ArrowDownToLine, Check, Copy, Download, FileUp, Mail, Users } from "lucide-react";
import type { Lead } from "@shared/coachSite";
import { coachApi, post } from "../coach/coachApi";
import { Btn, C, Card, Sheet, Title, display } from "../fit/fitUi";

/** Saves a file: the share sheet on a phone (so it can go to Files, Mail or Drive), a download on a computer. */
async function saveFile(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  try {
    const file = new File([blob], name, { type });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e: any) { if (e?.name === "AbortError") return; }
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const readFile = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ""; return f ? (f.size > 2_500_000 ? Promise.reject(new Error("That file is too big. Split it into smaller files.")) : f.text()) : Promise.resolve(""); };

export function MoveCard({ token, say }: { token: string | null; say: (m: string) => void }) {
  const [open, setOpen] = useState<"clients" | "workouts" | null>(null);
  const [busy, setBusy] = useState(false);
  const exportAll = async () => {
    setBusy(true);
    try {
      const r = await coachApi<{ clientsCsv: string } & Record<string, unknown>>(token, "/trainer/export");
      const stamp = new Date().toISOString().slice(0, 10);
      const { clientsCsv, ...all } = r;
      await saveFile(`arise-trainer-${stamp}.json`, JSON.stringify(all, null, 2), "application/json");
      await saveFile(`arise-trainer-clients-${stamp}.csv`, clientsCsv, "text/csv");
    } catch (e: any) { say(e.message); } finally { setBusy(false); }
  };
  return <>
    <Title>Move your business here</Title>
    <Card className="!p-4" testId="tr-move">
      <p className="text-[14px]" style={{ color: C.steel }}>Coming from Trainerize, TrueCoach or a spreadsheet? Export your client list and workouts there as CSV, then bring them in. Your data is yours: take everything out any time.</p>
      <div className="mt-3 grid gap-2">
        <Btn kind="soft" className="!justify-start !text-[15px]" onClick={() => setOpen("clients")} testId="tr-import-clients"><Users className="h-5 w-5" />Import clients</Btn>
        <Btn kind="soft" className="!justify-start !text-[15px]" onClick={() => setOpen("workouts")} testId="tr-import-workouts"><FileUp className="h-5 w-5" />Import workouts</Btn>
        <Btn kind="soft" className="!justify-start !text-[15px]" disabled={busy} onClick={exportAll} testId="tr-export"><Download className="h-5 w-5" />{busy ? "Getting your data…" : "Export everything"}</Btn>
      </div>
    </Card>
    {open === "clients" && <ImportClients token={token} say={say} onClose={() => setOpen(null)} />}
    {open === "workouts" && <ImportWorkouts token={token} say={say} onClose={() => setOpen(null)} />}
  </>;
}

function ImportClients({ token, say, onClose }: { token: string | null; say: (m: string) => void; onClose: () => void }) {
  const [res, setRes] = useState<{ added: number; already: number; skipped: number; leads: Lead[] } | null>(null);
  const [busy, setBusy] = useState(""); const [err, setErr] = useState(""); const [sent, setSent] = useState<number | null>(null);
  const [link, setLink] = useState("");
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErr(""); setBusy("read");
    try { const csv = await readFile(e); if (!csv) return; setRes(await post(token, "/trainer/import/clients", { csv })); } catch (x: any) { setErr(x.message); } finally { setBusy(""); }
  };
  const imported = (res?.leads ?? []).filter((l) => l.source === "import" && l.status === "new");
  const withEmail = imported.filter((l) => l.email);
  const emailAll = async () => {
    setBusy("mail"); setErr("");
    try { const r = await post<{ sent: number }>(token, "/trainer/import/invite", { leadIds: withEmail.map((l) => l.id) }); setSent(r.sent); say(`Invite sent to ${r.sent}.`); }
    catch (x: any) { setErr(x.message); } finally { setBusy(""); }
  };
  const copy = async () => { try { const r = link || (await coachApi<{ url: string }>(token, "/trainer/invite")).url; setLink(r); await navigator.clipboard.writeText(r); say("Invite link copied."); } catch { say("Couldn't copy. Use the Invite a client button on Clients."); } };
  return <Sheet title="Import clients" onClose={onClose} testId="tr-import-clients-sheet">
    {!res ? <>
      <ol className="space-y-2 text-[15px]" style={{ color: C.steel }}>
        <li><b style={{ color: C.text }}>1.</b> Export your client list from Trainerize or TrueCoach as a CSV file (their support can send it if you can't find the button). Any spreadsheet saved as CSV works too.</li>
        <li><b style={{ color: C.text }}>2.</b> It needs a name column and an email or phone column. Tags come over too.</li>
        <li><b style={{ color: C.text }}>3.</b> They land in your Leads, and you invite them to Arise Fit in one go.</li>
      </ol>
      <label className="mt-5 flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-[14px] text-[16px] font-bold" style={{ background: C.lime, color: "var(--fit-on-accent)" }}><ArrowDownToLine className="h-5 w-5" />{busy ? "Reading…" : "Choose the CSV file"}
        <input type="file" accept=".csv,text/csv,.txt,text/plain,.tsv" className="sr-only" onChange={pick} data-testid="tr-import-clients-file" /></label>
    </> : <>
      <Card className="!p-4 text-center"><p className="text-[40px] leading-none" style={display}>{res.added}</p><p className="mt-1 text-[14px]" style={{ color: C.dim }}>clients added to your leads{res.already ? ` · ${res.already} already there` : ""}{res.skipped ? ` · ${res.skipped} rows skipped (no name, or no email or phone)` : ""}</p></Card>
      <Title>Invite them</Title>
      {sent !== null ? <p className="flex items-center gap-2 rounded-[12px] p-3 text-[15px] font-semibold" style={{ background: C.card, color: C.lime }}><Check className="h-5 w-5" />Invite emailed to {sent}. They'll show up in Clients as they join.</p>
        : withEmail.length > 0 && <Btn className="w-full" disabled={!!busy} onClick={emailAll} testId="tr-invite-all"><Mail className="h-5 w-5" />{busy === "mail" ? "Sending…" : `Email all ${withEmail.length} my invite link`}</Btn>}
      <Btn kind="soft" className="mt-2 w-full" onClick={copy}><Copy className="h-5 w-5" />Copy invite link</Btn>
      <p className="mt-3 text-[13px]" style={{ color: C.dim }}>Each one gets a short note from you with a button to join you in Arise Fit. Replies come to your email. Clients without an email are in Leads with their phone number, ready to text.</p>
    </>}
    {err && <p className="mt-3 text-[14px]" style={{ color: C.red }}>{err}</p>}
  </Sheet>;
}

function ImportWorkouts({ token, say, onClose }: { token: string | null; say: (m: string) => void; onClose: () => void }) {
  const [csv, setCsv] = useState("");
  const [pv, setPv] = useState<{ workouts: { name: string; exercises: number }[]; matched: number; added: number } | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErr(""); setBusy(true);
    try { const t = await readFile(e); if (!t) return; setCsv(t); setPv(await post(token, "/trainer/import/workouts", { csv: t })); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  const apply = async () => { setBusy(true); try { await post(token, "/trainer/import/workouts", { csv, apply: true }); say(`${pv?.workouts.length} workouts added to your Library.`); onClose(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } };
  const sample = "Workout,Exercise,Sets,Reps,Rest,Notes\r\nUpper A,Bench Press,4,6-8,120,Pause the first rep\r\nUpper A,Seated Cable Row,3,10-12,90,\r\nLower A,Back Squat,4,5,180,\r\n";
  return <Sheet title="Import workouts" onClose={onClose} testId="tr-import-workouts-sheet">
    {!pv ? <>
      <p className="text-[15px]" style={{ color: C.steel }}>One exercise per row, with columns <b style={{ color: C.text }}>Workout, Exercise, Sets, Reps</b> (Rest and Notes are optional). Exercises are matched to Arise's library with its how-to cues. Anything it doesn't know becomes your own exercise, so nothing is lost.</p>
      <label className="mt-5 flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-[14px] text-[16px] font-bold" style={{ background: C.lime, color: "var(--fit-on-accent)" }}><ArrowDownToLine className="h-5 w-5" />{busy ? "Reading…" : "Choose the CSV file"}
        <input type="file" accept=".csv,text/csv,.txt,text/plain,.tsv" className="sr-only" onChange={pick} data-testid="tr-import-workouts-file" /></label>
      <button type="button" onClick={() => saveFile("arise-workouts-template.csv", sample, "text/csv")} className="mt-3 w-full text-center text-[14px] font-semibold" style={{ color: C.lime }}>Get a template to fill in</button>
    </> : <>
      <Card className="!p-4"><p className="text-[22px] leading-none" style={display}>{pv.workouts.length} workouts</p><p className="mt-1 text-[14px]" style={{ color: C.dim }}>{pv.matched} exercises matched Arise's library{pv.added ? ` · ${pv.added} new ones become your own exercises` : ""}</p></Card>
      <div className="mt-3 space-y-1.5">{pv.workouts.slice(0, 40).map((w, i) => <div key={i} className="flex items-center gap-2 rounded-[10px] px-3 py-2.5" style={{ background: C.card }}><span className="flex-1 font-semibold">{w.name}</span><span className="text-[13px]" style={{ color: C.dim }}>{w.exercises} exercises</span></div>)}
        {pv.workouts.length > 40 && <p className="text-center text-[13px]" style={{ color: C.dim }}>and {pv.workouts.length - 40} more</p>}</div>
      <Btn className="mt-5 w-full" disabled={busy} onClick={apply} testId="tr-import-workouts-apply">{busy ? "Adding…" : `Add ${pv.workouts.length} to my Library`}</Btn>
    </>}
    {err && <p className="mt-3 text-[14px]" style={{ color: C.red }}>{err}</p>}
  </Sheet>;
}
