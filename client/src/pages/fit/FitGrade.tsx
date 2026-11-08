// Arise grades in Fit: scan a barcode (food, personal care or cleaning product), snap the ingredients or
// type them, and get an A–F grade with every reason and its source. The grade is worked out by fixed,
// published rules (shared/productGrade.ts); the AI only reads a label photo into text.
import { useEffect, useRef, useState } from "react";
import { Camera, ChevronRight, FlaskConical, Loader2, ScanLine, ShieldCheck, Utensils } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { canUseCamera, scanWithCamera } from "@/lib/barcodeScanner";
import { gradeBarcode, gradeLabel, shrinkPhoto, type GradeResult } from "@/lib/foodLookup";
import { GRADE_COLOR } from "@shared/productGrade";
import { Btn, C, Card, Chips, Sheet, Title, display, haptic, inputCls, inputStyle } from "./fitUi";

const RECENT = "arise-fit-grades";
type Saved = Pick<GradeResult, "name" | "brand" | "letter" | "score" | "kind"> & { at: number };
const readRecent = (): Saved[] => { try { return JSON.parse(localStorage.getItem(RECENT) || "[]").slice(0, 20); } catch { return []; } };
const NOVA = ["", "Unprocessed", "Processed ingredient", "Processed", "Ultra-processed"];

export function GradeBadge({ letter, size = 56 }: { letter: GradeResult["letter"]; size?: number }) {
  return <span className="grid shrink-0 place-items-center rounded-full font-black text-white" style={{ width: size, height: size, background: GRADE_COLOR[letter], fontSize: size * 0.52, fontFamily: "var(--fit-display)", boxShadow: `0 8px 22px -10px ${GRADE_COLOR[letter]}` }} aria-label={`Grade ${letter}`}>{letter}</span>;
}

function Result({ g, onAgain }: { g: GradeResult; onAgain: () => void }) {
  const dot = (good: boolean, level?: string) => (good ? "#16a34a" : level === "high" ? "#dc2626" : level === "moderate" ? "#f97316" : "#eab308");
  return <div className="fit-in" data-testid="fit-grade-result">
    <Card className="flex items-center gap-4 !p-4">
      <GradeBadge letter={g.letter} size={72} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[20px] leading-tight" style={display}>{g.name}</p>
        {g.brand && <p className="truncate text-[13px]" style={{ color: C.dim }}>{g.brand}</p>}
        <p className="mt-1 text-[14px] leading-snug">{g.summary}</p>
        {g.letter !== "?" && <p className="mt-1 text-[12px] tabular-nums" style={{ color: C.dim }}>{g.score}/100{g.nutri ? ` · Nutri-Score ${g.nutri.toUpperCase()}` : ""}{g.nova ? ` · ${NOVA[g.nova]}` : ""}</p>}
      </div>
      {g.image && <img src={g.image} alt="" className="h-16 w-12 shrink-0 rounded-[8px] object-contain" style={{ background: "#fff" }} />}
    </Card>
    {g.reasons.length > 0 && <><Title>Why</Title><div className="space-y-2">{g.reasons.map((r, n) => <Card key={n} className="flex items-start gap-3 !p-3">
      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot(r.good, r.level) }} />
      <div className="min-w-0"><p className="text-[14.5px] leading-snug">{r.text}</p>{r.source && <p className="mt-0.5 text-[11.5px]" style={{ color: C.dim }}>Source: {r.source}</p>}</div></Card>)}</div></>}
    <Btn kind="soft" className="mt-4 w-full" onClick={onAgain}><ScanLine className="h-5 w-5" />Grade another</Btn>
    <p className="mt-4 text-[11px] leading-relaxed" style={{ color: C.dim }}>Grades follow published science (Nutri-Score, the NOVA processing groups, and findings from IARC, the EU, the FDA, EFSA and the EPA) and the product databases Open Food Facts, Open Beauty Facts and Open Products Facts. They're a guide for comparing products, not medical advice. A missing or wrong ingredient list changes the grade.</p>
  </div>;
}

export function FitGrade({ onClose }: { onClose: () => void }) {
  const { token } = useAuth();
  const [kind, setKind] = useState<"food" | "product">("food");
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [code, setCode] = useState("");
  const [typed, setTyped] = useState("");
  const [g, setG] = useState<GradeResult | null>(null);
  const [recent, setRecent] = useState<Saved[]>(readRecent);
  const video = useRef<HTMLVideoElement>(null);
  const file = useRef<HTMLInputElement>(null);

  const keep = (r: GradeResult) => {
    setG(r); haptic(r.letter === "A" || r.letter === "B" ? "light" : "medium");
    if (r.letter === "?") return;
    const next = [{ name: r.name, brand: r.brand, letter: r.letter, score: r.score, kind: r.kind, at: Date.now() }, ...recent.filter((x) => x.name !== r.name)].slice(0, 20);
    setRecent(next); try { localStorage.setItem(RECENT, JSON.stringify(next)); } catch { /* fine */ }
  };
  const run = async (fn: () => Promise<GradeResult>) => { setBusy(true); setErr(""); try { keep(await fn()); } catch (e: any) { setErr(e?.message || "That didn't work. Try again."); } finally { setBusy(false); } };
  const byCode = (value: string) => run(() => gradeBarcode(token, value));
  useEffect(() => {
    if (!camera || !video.current) return;
    return scanWithCamera(video.current, (value) => { navigator.vibrate?.(40); setCamera(false); void byCode(value); }, (e) => { setCamera(false); setErr(e); });
  }, [camera]); // eslint-disable-line react-hooks/exhaustive-deps

  return <Sheet title="Grade it" onClose={onClose} testId="fit-grade">
    {g ? <Result g={g} onAgain={() => { setG(null); setCode(""); setTyped(""); }} /> : <>
      <div className="rounded-[14px] p-4" style={{ background: `linear-gradient(150deg, ${C.emberSoft}, ${C.card})` }}>
        <ShieldCheck className="h-8 w-8" style={{ color: C.lime }} />
        <p className="mt-2 text-[24px] leading-none" style={display}>Is it good for you?</p>
        <p className="mt-1 text-[14px] leading-snug" style={{ color: C.steel }}>Scan any food, drink, soap, shampoo, cleaner or detergent. You get an A–F grade with every reason: nutrition, ultra-processing, additives and chemicals of concern, each with its source.</p>
      </div>
      <Title>What is it?</Title>
      <Chips label="Kind" value={kind} onChange={setKind} items={[{ id: "food", label: "Food & drink" }, { id: "product", label: "Household & personal care" }]} />
      {camera ? <div className="relative mt-3 overflow-hidden rounded-[14px] bg-black" style={{ aspectRatio: "4 / 3" }}>
        <video ref={video} playsInline muted className="h-full w-full object-cover" />
        <span aria-hidden className="fit-scan absolute inset-x-[6%] h-[3px]" style={{ background: C.lime, boxShadow: `0 0 18px ${C.lime}` }} />
        <button type="button" onClick={() => setCamera(false)} className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-[14px] font-semibold" style={{ background: "rgba(0,0,0,.6)", color: "#fff" }}>Cancel</button>
      </div> : <div className="mt-3 grid grid-cols-2 gap-2">
        {canUseCamera() && <Btn onClick={() => setCamera(true)} testId="fit-grade-scan" disabled={busy}><ScanLine className="h-5 w-5" />Scan barcode</Btn>}
        <Btn kind="soft" onClick={() => file.current?.click()} disabled={busy}><Camera className="h-5 w-5" />Snap ingredients</Btn>
        <input ref={file} type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const image = await shrinkPhoto(f).catch(() => null); if (image) void run(() => gradeLabel(token, kind, { image })); }} />
      </div>}
      <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) void byCode(code.trim()); }} className="mt-3 flex gap-2">
        <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 14))} placeholder="Or type the barcode number" className={inputCls} style={inputStyle} aria-label="Barcode number" />
        <Btn type="submit" disabled={busy || code.length < 8}>Go</Btn>
      </form>
      <form onSubmit={(e) => { e.preventDefault(); if (typed.trim().length > 3) void run(() => gradeLabel(token, kind, { text: typed })); }} className="mt-3">
        <textarea value={typed} onChange={(e) => setTyped(e.target.value.slice(0, 4000))} rows={3} placeholder={kind === "food" ? "Or paste the ingredients: sugar, wheat flour, red 40…" : "Or paste the ingredients: water, sodium laureth sulfate, fragrance…"} className={`${inputCls} !h-auto py-3`} style={inputStyle} aria-label="Ingredients" />
        <Btn type="submit" kind="soft" className="mt-2 w-full" disabled={busy || typed.trim().length < 4}>Grade these ingredients</Btn>
      </form>
      {busy && <p className="mt-3 flex items-center justify-center gap-2 text-[14px]" style={{ color: C.dim }}><Loader2 className="h-4 w-4 animate-spin" />Checking it…</p>}
      {err && <p className="mt-3 text-[14px]" style={{ color: C.red }}>{err}</p>}
      {recent.length > 0 && <><Title>Recently graded</Title><div className="space-y-2">{recent.slice(0, 8).map((r) => <Card key={r.name + r.at} className="flex items-center gap-3 !p-3">
        <GradeBadge letter={r.letter} size={38} />
        <div className="min-w-0 flex-1"><p className="truncate font-semibold">{r.name}</p><p className="truncate text-[12.5px]" style={{ color: C.dim }}>{r.brand ? `${r.brand} · ` : ""}{r.kind === "food" ? "Food" : "Household"} · {r.score}/100</p></div>
        {r.kind === "food" ? <Utensils className="h-4 w-4 shrink-0" style={{ color: C.dim }} /> : <FlaskConical className="h-4 w-4 shrink-0" style={{ color: C.dim }} />}</Card>)}</div></>}
    </>}
  </Sheet>;
}

/** The card on Food that opens it. */
export function GradeCard({ onOpen }: { onOpen: () => void }) {
  return <button type="button" onClick={() => { haptic("light"); onOpen(); }} className="fit-in mt-3 flex w-full items-center gap-3 rounded-[14px] p-3.5 text-left active:scale-[.99]" style={{ background: C.card2 }} data-testid="fit-grade-card">
    <span className="flex -space-x-2">{(["A", "C", "F"] as const).map((l) => <GradeBadge key={l} letter={l} size={30} />)}</span>
    <span className="min-w-0 flex-1"><span className="block text-[17px] leading-tight" style={display}>Grade a food or product</span><span className="block truncate text-[12.5px]" style={{ color: C.dim }}>Food, soap, cleaners: A–F by the science</span></span>
    <ChevronRight className="h-5 w-5 shrink-0" style={{ color: C.dim }} />
  </button>;
}
