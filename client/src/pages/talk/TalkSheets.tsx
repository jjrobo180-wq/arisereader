// Arise Talk's other screens: Type, Phrases and More (settings), the first-time setup, and the
// sheets: Show (the message in huge letters), Smart sentences, Listen and reply, Snap to talk,
// Premium, signing in and the code that locks changes.
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Camera, Check, Cloud, Crown, Download, Ear, Image as ImageIcon, LogOut, Mic, Play, Plus, Shield, Sparkles, Square, Star, Trash2, Upload, Volume2, X } from "lucide-react";
import AccountPrivacy from "@/components/AccountPrivacy";
import { useAuth } from "@/context/AuthContext";
import { appleSignInAvailable, askApple, APPLE_LOGO_PATH } from "@/lib/appleSignIn";
import { isNativeApp, nativeAppInfo } from "@/lib/nativeApp";
import { API_BASE } from "@/lib/queryClient";
import { PREMIUM, PREMIUM_PERKS, VOICES, cleanTalk, fillIn, nextWords, starterData, type TalkKind, type TalkPhrase, type TalkSettings } from "@shared/talk";
import type { Talk } from "./TalkApp";
import { say, shrinkPhoto, talkApi } from "./talkStore";
import { Btn, Card, Field, Layer, PremiumTag, Seg, Sheet, T, Title, Toggle, font, inputCls, inputStyle } from "./talkUi";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const setS = (talk: Talk, p: Partial<TalkSettings>) => talk.update((d) => ({ ...d, settings: { ...d.settings, ...p } }), { undo: false });

// ——— Type ———————————————————————————————————————————————————————————————————————————————————————————
export function TypeTab({ talk }: { talk: Talk }) {
  const { data } = talk;
  const [text, setText] = useState("");
  const words = useMemo(() => {
    const all = new Set<string>();
    for (const b of data.boards) for (const x of b.buttons) if (!/\s/.test(x.label) && x.label.length > 2) all.add(x.label.toLowerCase());
    for (const r of data.recent) for (const w of r.replace(/[.,!?]/g, "").split(/\s+/)) if (w.length > 2) all.add(w.toLowerCase());
    return [...all];
  }, [data.boards, data.recent]);
  const partial = /\S$/.test(text) ? text.split(/\s+/).pop()!.toLowerCase() : "";
  const guesses = partial
    ? words.filter((w) => w.startsWith(partial) && w !== partial).sort((a, b) => a.length - b.length).slice(0, 6)
    : nextWords(text.trim() ? text.trim().split(/\s+/) : [], data.recent, 6);
  const pick = (w: string) => setText((t) => (partial ? t.replace(/\S+$/, w) : t + (t && !/\s$/.test(t) ? " " : "") + w) + " ");
  const speak = () => { if (text.trim()) void talk.speak(text.trim(), { remember: true }); };
  const save = () => {
    const t = text.trim(); if (!t) return;
    talk.update((d) => ({ ...d, phrases: [...d.phrases, { id: `mine-${Date.now().toString(36)}`, text: t, group: "Mine" }] }));
    talk.flash("Saved to Phrases.");
  };
  return <div className="flex h-full flex-col overflow-y-auto px-3 pb-4 pt-3">
    <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type what you want to say" rows={4} className="w-full resize-none rounded-[20px] p-4 text-[24px] font-medium leading-snug outline-none" style={{ background: T.card, color: T.text, boxShadow: T.shadow }} data-testid="talk-type-box" />
    <div className="mt-2 flex min-h-11 gap-1.5 overflow-x-auto [scrollbar-width:none]">{guesses.map((g) => <button key={g} type="button" onClick={() => pick(g)} className="tk-press h-11 shrink-0 rounded-full px-4 text-[16px] font-semibold" style={{ background: T.accentSoft, color: T.accent }}>{g}</button>)}</div>
    <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-2">
      <Btn onClick={speak} testId="talk-type-speak"><Volume2 className="h-5 w-5" />Speak</Btn>
      <Btn kind="soft" onClick={save}><Star className="h-5 w-5" />Save</Btn>
      <Btn kind="soft" onClick={() => setText("")}><X className="h-5 w-5" /></Btn>
    </div>
    {data.recent.length > 0 && <><Title>Said lately</Title>
      <div className="space-y-1.5">{data.recent.slice(0, 12).map((r) => <button key={r} type="button" onClick={() => void talk.speak(r)} onDoubleClick={() => setText(r)} className="tk-press block w-full rounded-[14px] px-4 py-3 text-left text-[16px]" style={{ background: T.card, boxShadow: T.shadow }}>{r}</button>)}</div></>}
  </div>;
}

// ——— Phrases ——————————————————————————————————————————————————————————————————————————————————————————
export function PhrasesTab({ talk, guarded }: { talk: Talk; guarded: (fn: () => void) => void }) {
  const { data, update } = talk;
  const groups = useMemo(() => ["Recent", ...[...new Set(data.phrases.map((p) => p.group))]], [data.phrases]);
  const [group, setGroup] = useState(data.recent.length ? "Recent" : groups[1] ?? "Recent");
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState("");
  const list: TalkPhrase[] = group === "Recent" ? data.recent.map((t, i) => ({ id: `r${i}`, text: t, group: "Recent" })) : data.phrases.filter((p) => p.group === group);
  const quick = new Set(data.settings.quick);
  const toggleQuick = (id: string) => setS(talk, { quick: quick.has(id) ? data.settings.quick.filter((q) => q !== id) : [...data.settings.quick, id].slice(-8) });
  const add = () => {
    const t = adding.trim(); if (!t) return;
    const g = group === "Recent" ? "Mine" : group;
    update((d) => ({ ...d, phrases: [...d.phrases, { id: `mine-${Date.now().toString(36)}`, text: t, group: g }] }));
    setAdding(""); if (group === "Recent") setGroup("Mine");
  };
  return <div className="flex h-full flex-col">
    <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto px-3 pb-2 pt-3 [scrollbar-width:none]">
      {groups.map((g) => <button key={g} type="button" onClick={() => setGroup(g)} className="tk-press h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold" style={g === group ? { background: T.text, color: T.bg } : { background: T.card, boxShadow: T.shadow }}>{g}</button>)}
      <button type="button" onClick={() => (editing ? setEditing(false) : guarded(() => setEditing(true)))} className="ml-auto h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold" style={editing ? { background: T.accent, color: T.onAccent } : { background: T.card2 }} data-testid="talk-phrases-edit">{editing ? "Done" : "Edit"}</button>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
      {editing && group !== "Recent" && <div className="mb-2 flex gap-2"><input value={adding} onChange={(e) => setAdding(e.target.value.slice(0, 300))} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="A new phrase" className={inputCls} style={inputStyle} data-testid="talk-phrase-new" /><Btn onClick={add}><Plus className="h-5 w-5" /></Btn></div>}
      <div className="space-y-2">{list.map((p) => <div key={p.id} className="flex items-stretch gap-2">
        <button type="button" onClick={() => void talk.speak(p.text, { remember: true })} className="tk-press min-h-[58px] flex-1 rounded-[16px] px-4 py-3 text-left text-[18px] font-medium leading-snug" style={{ background: T.card, boxShadow: T.shadow }}>{fillIn(p.text, data.about)}</button>
        {editing && group !== "Recent" && <>
          <button type="button" onClick={() => toggleQuick(p.id)} aria-label="Quick phrase" aria-pressed={quick.has(p.id)} className="grid w-12 place-items-center rounded-[14px]" style={{ background: T.card2, color: quick.has(p.id) ? "#f5a623" : T.dim }}><Star className="h-5 w-5" fill={quick.has(p.id) ? "currentColor" : "none"} /></button>
          <button type="button" onClick={() => update((d) => ({ ...d, phrases: d.phrases.filter((x) => x.id !== p.id), settings: { ...d.settings, quick: d.settings.quick.filter((q) => q !== p.id) } }))} aria-label="Delete" className="grid w-12 place-items-center rounded-[14px]" style={{ background: T.card2, color: T.danger }}><Trash2 className="h-5 w-5" /></button>
        </>}
      </div>)}</div>
      {!list.length && <p className="py-10 text-center text-[15px]" style={{ color: T.dim }}>{group === "Recent" ? "What you say shows up here, so you can say it again." : "Nothing here yet."}</p>}
      {editing && <p className="mt-3 px-1 text-[13px]" style={{ color: T.dim }}>Star a phrase to keep it in the quick row above the words.</p>}
    </div>
  </div>;
}

// ——— More (settings) ——————————————————————————————————————————————————————————————————————————————————
export function MoreTab({ talk, guarded, onPremium, onSignIn }: { talk: Talk; guarded: (fn: () => void) => void; onPremium: () => void; onSignIn: () => void }) {
  const { data, me, user, token } = talk;
  const { logout } = useAuth();
  const s = data.settings;
  const [busy, setBusy] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const set = (p: Partial<TalkSettings>) => guarded(() => setS(talk, p));
  const about = (p: Partial<typeof data.about>) => talk.update((d) => ({ ...d, about: { ...d.about, ...p } }), { undo: false });
  const backup = async () => { if (!token) return onSignIn(); setBusy("backup"); try { await talkApi(token, "/backup", { method: "PUT", body: JSON.stringify({ data }) }); await talk.refreshMe(); talk.flash("Backed up."); } catch (e: any) { talk.flash(e.message); } setBusy(""); };
  const restore = async () => { if (!token) return onSignIn(); setBusy("restore"); try { const b = await talkApi<{ data: any }>(token, "/backup"); if (b.data) { talk.replace(b.data); talk.flash("Restored from your backup."); } else talk.flash("There's no backup yet."); } catch (e: any) { talk.flash(e.message); } setBusy(""); };
  const exportFile = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" })); a.download = "arise-talk-words.json"; a.click(); };
  const importFile = async (f?: File) => { if (!f) return; try { const d = cleanTalk(JSON.parse(await f.text())); talk.replace({ ...d, onboarded: true }); talk.flash("Words loaded from the file."); } catch { talk.flash("That file isn't an Arise Talk file."); } };
  const sample = (v: (typeof VOICES)[number]) => { if (!v.free && !talk.premium) { onPremium(); return; } void say(`Hi, I'm ${v.name}. This is how I sound.`, v.id, s.rate); };

  return <div className="h-full overflow-y-auto px-3 pb-8 pt-2" data-testid="talk-more">
    {talk.premium
      ? <Card className="mt-2 flex items-center gap-3"><Crown className="h-6 w-6" style={{ color: T.accent }} /><div className="min-w-0 flex-1"><p className="font-semibold">Premium is on</p><p className="text-[13px]" style={{ color: T.dim }}>{me?.premiumUntil ? `Renews or ends ${new Date(me.premiumUntil).toLocaleDateString()}` : "Every feature is open."}</p></div>
        {me?.subscribed && !isNativeApp() && <Btn kind="soft" className="!min-h-10 !px-3 !text-[14px]" onClick={async () => { try { const r = await talkApi<{ url: string }>(token, "/premium/manage", { method: "POST", body: JSON.stringify({ returnTo: window.location.origin + "/" }) }); window.location.href = r.url; } catch (e: any) { talk.flash(e.message); } }}>Manage</Btn>}</Card>
      : <Card className="mt-2" onClick={onPremium} testId="talk-more-premium"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-[14px]" style={{ background: T.accent, color: T.onAccent }}><Sparkles className="h-6 w-6" /></span><div className="min-w-0 flex-1"><p className="font-semibold">Try Premium free for {PREMIUM.trialDays} days</p><p className="text-[13px]" style={{ color: T.dim }}>Listen and reply, smart sentences, snap to talk, every voice</p></div></div></Card>}

    <Title>Voice</Title>
    <div className="grid grid-cols-2 gap-2">{VOICES.map((v) => { const locked = !v.free && !talk.premium; return <button key={v.id} type="button" onClick={() => (locked ? onPremium() : set({ voice: v.id }))} aria-pressed={s.voice === v.id} className="tk-press flex items-center gap-2 rounded-[16px] p-3 text-left" style={{ background: T.card, boxShadow: s.voice === v.id ? `inset 0 0 0 2px ${T.accent}, ${T.shadow}` : T.shadow }} data-testid={`talk-voice-${v.id}`}>
      <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-[16px] font-semibold">{v.name}{locked && <PremiumTag />}</span><span className="block truncate text-[12px]" style={{ color: T.dim }}>{v.blurb}</span></span>
      <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); sample(v); }} aria-label={`Hear ${v.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: T.accentSoft, color: T.accent }}><Play className="h-4 w-4" fill="currentColor" /></span>
    </button>; })}</div>
    <p className="mb-2 mt-4 px-1 text-[13px] font-semibold" style={{ color: T.dim }}>Speed</p>
    <Seg value={s.rate} onChange={(rate) => set({ rate })} items={[0.75, 0.9, 1, 1.15, 1.3, 1.5].map((r) => ({ id: r, label: r === 1 ? "Normal" : `${r}×` }))} testId="talk-rate" />
    <div className="mt-3 rounded-[18px] px-4" style={{ background: T.card }}>
      <Toggle on={s.speakWords} onChange={(speakWords) => set({ speakWords })} label="Say each word as I tap it" />
      <div style={{ borderTop: `1px solid ${T.line}` }} />
      <Toggle on={s.clearAfter} onChange={(clearAfter) => set({ clearAfter })} label="Clear the message after it's said" />
    </div>

    <Title>Look</Title>
    <Seg value={s.theme} onChange={(theme) => set({ theme })} items={[{ id: "light", label: "Light" }, { id: "dark", label: "Dark" }, { id: "auto", label: "Auto" }]} testId="talk-theme" />
    <p className="mb-2 mt-4 px-1 text-[13px] font-semibold" style={{ color: T.dim }}>Buttons across</p>
    <Seg value={s.cols} onChange={(cols) => set({ cols })} items={[{ id: 0, label: "Auto" }, ...[3, 4, 5, 6, 7, 8].map((n) => ({ id: n, label: String(n) }))]} />
    <p className="mb-2 mt-4 px-1 text-[13px] font-semibold" style={{ color: T.dim }}>Word size</p>
    <Seg value={s.text} onChange={(text) => set({ text })} items={[{ id: "s", label: "Small" }, { id: "m", label: "Medium" }, { id: "l", label: "Large" }]} />
    <div className="mt-3 rounded-[18px] px-4" style={{ background: T.card }}><Toggle on={s.labels} onChange={(labels) => set({ labels })} label="Show words under pictures" /></div>

    <Title>Touch</Title>
    <p className="mb-2 px-1 text-[13px] font-semibold" style={{ color: T.dim }}>Hold to choose (stops bumps from counting)</p>
    <Seg value={s.hold} onChange={(hold) => set({ hold })} items={[{ id: 0, label: "Off" }, { id: 300, label: "Short" }, { id: 600, label: "Medium" }, { id: 1000, label: "Long" }]} />
    <p className="mb-2 mt-4 px-1 text-[13px] font-semibold" style={{ color: T.dim }}>Ignore a second tap</p>
    <Seg value={s.repeat} onChange={(repeat) => set({ repeat })} items={[{ id: 0, label: "Off" }, { id: 500, label: "½ second" }, { id: 1000, label: "1 second" }]} />
    <div className="mt-3 rounded-[18px] px-4" style={{ background: T.card }}><Toggle on={s.haptics} onChange={(haptics) => set({ haptics })} label="Gentle taps (vibration)" /></div>

    <Title>About me</Title>
    <Card>
      <p className="text-[13px]" style={{ color: T.dim }}>Used in phrases like “My name is…” and the Medical phrases.</p>
      <Field label="My name"><input value={data.about.name} onChange={(e) => about({ name: e.target.value })} className={inputCls} style={inputStyle} data-testid="talk-about-name" /></Field>
      <Field label="Emergency contact"><input value={data.about.contact} onChange={(e) => about({ contact: e.target.value })} placeholder="Mom" className={inputCls} style={inputStyle} /></Field>
      <Field label="Their phone"><input value={data.about.phone} onChange={(e) => about({ phone: e.target.value })} inputMode="tel" className={inputCls} style={inputStyle} /></Field>
      <Field label="Allergies"><input value={data.about.allergies} onChange={(e) => about({ allergies: e.target.value })} placeholder="peanuts" className={inputCls} style={inputStyle} /></Field>
      {data.about.phone && <a href={`tel:${data.about.phone.replace(/[^\d+]/g, "")}`} className="mt-3 flex h-12 items-center justify-center rounded-[14px] text-[16px] font-semibold" style={{ background: "rgba(229,72,77,.12)", color: T.danger }}>Call {data.about.contact || "my contact"}</a>}
    </Card>

    <Title>Changes</Title>
    <Card>
      <p className="text-[15px]">{s.lock ? "Changing words and settings needs the code." : "Anyone can change words and settings."}</p>
      <Btn kind="soft" className="mt-3 w-full" onClick={() => guarded(() => setLockOpen(true))} testId="talk-lock"><Shield className="h-5 w-5" />{s.lock ? "Change or remove the code" : "Lock changes with a code"}</Btn>
    </Card>

    <Title>Backup</Title>
    <Card>
      {user ? <><p className="flex items-center gap-2 text-[15px] font-semibold"><Cloud className="h-5 w-5" style={{ color: T.accent }} />Signed in as {(user as any).displayName || (user as any).username}</p>
        <p className="mt-1 text-[13px]" style={{ color: T.dim }}>{me?.backupAt ? `Backed up ${new Date(me.backupAt).toLocaleString()}. Changes back up by themselves.` : "Changes back up by themselves."}</p>
        <div className="mt-3 grid grid-cols-2 gap-2"><Btn kind="soft" disabled={!!busy} onClick={backup}>Back up now</Btn><Btn kind="soft" disabled={!!busy} onClick={restore}>Restore</Btn></div>
        <div className="mt-2 grid grid-cols-2 gap-2"><Btn kind="ghost" onClick={() => setPrivacy(true)}>Account</Btn><Btn kind="ghost" onClick={() => logout()}><LogOut className="h-5 w-5" />Sign out</Btn></div></>
        : <><p className="text-[15px]">Sign in so your words are backed up and come back on a new phone.</p><Btn className="mt-3 w-full" onClick={onSignIn} testId="talk-more-signin">Sign in or create an account</Btn></>}
      <div className="mt-3 grid grid-cols-2 gap-2"><Btn kind="soft" onClick={exportFile}><Download className="h-5 w-5" />Save a file</Btn><Btn kind="soft" onClick={() => guarded(() => file.current?.click())}><Upload className="h-5 w-5" />Load a file</Btn></div>
      <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void importFile(e.target.files?.[0])} />
    </Card>
    <Btn kind="danger" className="mt-6 w-full" onClick={() => guarded(() => { if (window.confirm("Put back the original words, phrases and settings? Your own changes will be gone (unless they're backed up).")) talk.replace({ ...starterData(), onboarded: true, about: data.about }); })}>Start over with the original words</Btn>
    <p className="mt-6 text-center text-[12px]" style={{ color: T.dim }}>Arise Talk · <a href="https://arisetodo.com/privacy" className="underline">Privacy</a> · <a href="https://arisetodo.com/terms" className="underline">Terms</a></p>
    {lockOpen && <LockSheet talk={talk} onClose={() => setLockOpen(false)} />}
    {privacy && <Layer><div className="fixed inset-0 z-[600]"><AccountPrivacy onClose={() => setPrivacy(false)} /></div></Layer>}
  </div>;
}

function LockSheet({ talk, onClose }: { talk: Talk; onClose: () => void }) {
  const [code, setCode] = useState("");
  return <Sheet title="Lock changes" onClose={onClose}>
    <p className="text-[15px]" style={{ color: T.dim }}>With a code, editing words, phrases and settings asks for it first. Talking never does.</p>
    <Field label="4-digit code"><input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" className={`${inputCls} text-center text-[28px] tracking-[.5em]`} style={inputStyle} data-testid="talk-lock-code" /></Field>
    <Btn className="mt-4 w-full" disabled={code.length !== 4} onClick={() => { setS(talk, { lock: code }); talk.flash("Changes are locked."); onClose(); }}>Lock with this code</Btn>
    {talk.data.settings.lock && <Btn kind="soft" className="mt-2 w-full" onClick={() => { setS(talk, { lock: "" }); talk.flash("The code is off."); onClose(); }}>Remove the code</Btn>}
  </Sheet>;
}

export function PinSheet({ code, onOk, onClose }: { code: string; onOk: () => void; onClose: () => void }) {
  const [v, setV] = useState("");
  const [wrong, setWrong] = useState(false);
  const press = (d: string) => { const n = (v + d).slice(0, 4); setV(n); setWrong(false); if (n.length === 4) { if (n === code) onOk(); else { setWrong(true); setTimeout(() => setV(""), 350); } } };
  return <Sheet title="Enter the code" onClose={onClose} testId="talk-pin">
    <div className="flex justify-center gap-3 py-3">{[0, 1, 2, 3].map((i) => <span key={i} className="h-4 w-4 rounded-full" style={{ background: i < v.length ? (wrong ? T.danger : T.accent) : T.card2 }} />)}</div>
    <div className="mx-auto grid max-w-[300px] grid-cols-3 gap-2">{["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((d) => d === "" ? <span key="x" /> : <button key={d} type="button" onClick={() => (d === "⌫" ? setV((x) => x.slice(0, -1)) : press(d))} className="tk-press h-16 rounded-[18px] text-[26px] font-semibold" style={{ background: T.card, boxShadow: T.shadow }}>{d}</button>)}</div>
  </Sheet>;
}

// ——— Show: the message in huge letters ———————————————————————————————————————————————————————————————
export function ShowSheet({ text, onSay, onClose }: { text: string; onSay: () => void; onClose: () => void }) {
  const size = text.length < 20 ? 64 : text.length < 50 ? 48 : text.length < 100 ? 36 : 28;
  return <Layer><div className="fixed inset-0 z-[500] flex flex-col" style={{ ...font, background: T.bg, color: T.text }} data-testid="talk-show-sheet">
    <div className="flex justify-end gap-2 p-3 pt-[max(12px,env(safe-area-inset-top))]">
      <button type="button" onClick={onSay} className="tk-press flex h-12 items-center gap-2 rounded-full px-5 text-[16px] font-semibold" style={{ background: T.accent, color: T.onAccent }}><Volume2 className="h-5 w-5" />Say it</button>
      <button type="button" onClick={onClose} aria-label="Close" className="grid h-12 w-12 place-items-center rounded-full" style={{ background: T.card2 }}><X className="h-6 w-6" /></button>
    </div>
    <button type="button" onClick={onClose} className="flex flex-1 items-center justify-center px-8 pb-16 text-center font-bold leading-[1.1] tracking-[-.02em]" style={{ fontSize: size }}>{text}</button>
  </div></Layer>;
}

// ——— Smart sentences (Premium) ———————————————————————————————————————————————————————————————————————
export function SentenceSheet({ talk, words, onPick, onClose }: { talk: Talk; words: string; onPick: (t: string) => void; onClose: () => void }) {
  const [options, setOptions] = useState<string[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    talkApi<{ options: string[] }>(talk.token, "/ai/sentence", { method: "POST", body: JSON.stringify({ words }) }).then((r) => setOptions(r.options)).catch((e) => setErr(e.message));
  }, [words]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Sheet title="Say it as a sentence" onClose={onClose} testId="talk-sentence-sheet">
    <p className="text-[14px]" style={{ color: T.dim }}>From “{words}”. Tap one to say it.</p>
    <div className="mt-3 space-y-2">
      {!options && !err && [0, 1, 2].map((i) => <div key={i} className="h-[60px] animate-pulse rounded-[16px]" style={{ background: T.card }} />)}
      {options?.map((o) => <button key={o} type="button" onClick={() => onPick(o)} className="tk-press flex w-full items-center gap-3 rounded-[16px] px-4 py-4 text-left text-[19px] font-medium" style={{ background: T.card, boxShadow: T.shadow }}><Volume2 className="h-5 w-5 shrink-0" style={{ color: T.accent }} />{o}</button>)}
      {err && <p className="py-6 text-center text-[15px]" style={{ color: T.danger }}>{err}</p>}
    </div>
  </Sheet>;
}

// ——— Listen and reply (Premium) ——————————————————————————————————————————————————————————————————————
export function ListenSheet({ talk, onClose }: { talk: Talk; onClose: () => void }) {
  const [state, setState] = useState<"idle" | "rec" | "think" | "done">("idle");
  const [heard, setHeard] = useState("");
  const [replies, setReplies] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const stopAt = useRef<number | null>(null);
  useEffect(() => () => { if (stopAt.current) clearTimeout(stopAt.current); rec.current?.stream.getTracks().forEach((t) => t.stop()); }, []);
  const start = async () => {
    setErr(""); setReplies([]); setHeard("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t)) || "";
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const parts: Blob[] = [];
      r.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const mime = (r.mimeType || type || "audio/mp4").split(";")[0];
        setState("think");
        try {
          const res = await fetch(`${API_BASE}/api/talk/listen`, { method: "POST", headers: { "Content-Type": mime, ...(talk.token ? { Authorization: `Bearer ${talk.token}` } : {}) }, body: new Blob(parts, { type: mime }) });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body?.message || "That couldn't be heard.");
          const text = String(body.text || "").trim();
          if (!text) throw new Error("Nothing was heard. Try again, a little closer.");
          setHeard(text);
          const out = await talkApi<{ replies: string[] }>(talk.token, "/ai/replies", { method: "POST", body: JSON.stringify({ heard: text, name: talk.data.about.name }) });
          setReplies(out.replies); setState("done");
        } catch (e: any) { setErr(e.message); setState("idle"); }
      };
      rec.current = r; r.start(); setState("rec");
      stopAt.current = window.setTimeout(() => { if (r.state === "recording") r.stop(); }, 20_000);
    } catch { setErr("Arise Talk needs the microphone for this. Allow it in Settings, then try again."); }
  };
  const stop = () => { if (stopAt.current) clearTimeout(stopAt.current); if (rec.current?.state === "recording") rec.current.stop(); };
  return <Sheet title="Listen and reply" onClose={onClose} testId="talk-listen-sheet">
    <div className="flex flex-col items-center py-4">
      <button type="button" onClick={state === "rec" ? stop : start} disabled={state === "think"} aria-label={state === "rec" ? "Stop listening" : "Start listening"} className="tk-press grid h-28 w-28 place-items-center rounded-full" style={{ background: state === "rec" ? T.danger : T.accent, color: "#fff", boxShadow: state === "rec" ? "0 0 0 10px rgba(229,72,77,.18)" : T.shadow }} data-testid="talk-listen-mic">
        {state === "rec" ? <Square className="h-10 w-10" fill="currentColor" /> : state === "think" ? <span className="tk-wave flex h-6 items-center"><span /><span /><span /><span /></span> : <Mic className="h-11 w-11" />}
      </button>
      <p className="mt-3 text-center text-[15px]" style={{ color: T.dim }}>{state === "rec" ? "Listening… tap when they're done" : state === "think" ? "Thinking of replies…" : "Tap, and let the other person talk"}</p>
    </div>
    {heard && <div className="rounded-[18px] p-4" style={{ background: T.card2 }}><p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.08em]" style={{ color: T.dim }}><Ear className="h-4 w-4" />They said</p><p className="mt-1 text-[18px]">{heard}</p></div>}
    {replies.length > 0 && <><Title>Tap to reply</Title><div className="space-y-2">{replies.map((r) => <button key={r} type="button" onClick={() => void talk.speak(r, { remember: true })} className="tk-press flex w-full items-center gap-3 rounded-[16px] px-4 py-3.5 text-left text-[18px] font-medium" style={{ background: T.card, boxShadow: T.shadow }}><Volume2 className="h-5 w-5 shrink-0" style={{ color: T.accent }} />{r}</button>)}</div></>}
    {err && <p className="mt-3 text-center text-[15px]" style={{ color: T.danger }}>{err}</p>}
    <p className="mt-5 text-center text-[12px]" style={{ color: T.dim }}>The recording is only used to find replies. It isn't kept.</p>
  </Sheet>;
}

// ——— Snap to talk (Premium) ———————————————————————————————————————————————————————————————————————————
type Snap = { title: string; words: { label: string; emoji: string; kind: TalkKind }[]; phrases: string[] };
export function SnapSheet({ talk, onClose, onAdd }: { talk: Talk; onClose: () => void; onAdd: (w: { label: string; emoji?: string }) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState("");
  const [snap, setSnap] = useState<Snap | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const read = async (f?: File) => {
    if (!f) return;
    setErr(""); setSnap(null); setBusy(true);
    try {
      const img = await shrinkPhoto(f, 1024, 0.8); setPhoto(img);
      setSnap(await talkApi<Snap>(talk.token, "/ai/photo", { method: "POST", body: JSON.stringify({ image: img }) }));
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  const keep = () => {
    if (!snap) return;
    const id = `mine-${Date.now().toString(36)}`;
    talk.update((d) => ({ ...d, boards: [...d.boards, { id, name: snap.title, emoji: "📷", mine: true, buttons: [
      ...snap.words.map((w, i) => ({ id: `${id}.w${i}`, label: w.label, emoji: w.emoji || undefined, kind: w.kind })),
      ...snap.phrases.map((p, i) => ({ id: `${id}.p${i}`, label: p.length > 24 ? p.slice(0, 22) + "…" : p, say: p, kind: "social" as TalkKind, now: true })),
    ] }] }));
    talk.flash(`Saved as the “${snap.title}” board.`); onClose();
  };
  return <Sheet title="Snap to talk" onClose={onClose} full testId="talk-snap-sheet">
    <input ref={file} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void read(e.target.files?.[0])} />
    {!photo && <div className="flex flex-col items-center py-10 text-center">
      <span className="grid h-20 w-20 place-items-center rounded-[24px]" style={{ background: T.accentSoft, color: T.accent }}><Camera className="h-10 w-10" /></span>
      <p className="mt-4 max-w-[280px] text-[16px]" style={{ color: T.dim }}>Take a photo of a menu, a room, a place or a game, and get words and phrases about it to tap.</p>
      <Btn className="mt-5" onClick={() => file.current?.click()} testId="talk-snap-take"><Camera className="h-5 w-5" />Take a photo</Btn>
    </div>}
    {photo && <img src={photo} alt="" className="mt-1 max-h-[220px] w-full rounded-[18px] object-cover" />}
    {busy && <p className="mt-4 text-center text-[15px]" style={{ color: T.dim }}>Looking at the photo…</p>}
    {err && <p className="mt-4 text-center text-[15px]" style={{ color: T.danger }}>{err}</p>}
    {snap && <>
      <Title right={<button type="button" onClick={keep} className="text-[14px] font-semibold" style={{ color: T.accent }}>Save as a board</button>}>{snap.title}</Title>
      <div className="grid grid-cols-4 gap-2">{snap.words.map((w) => <button key={w.label} type="button" onClick={() => { onAdd({ label: w.label, emoji: w.emoji }); }} className="tk-press flex aspect-[5/6] flex-col items-center justify-center rounded-[16px] px-1" style={{ background: T.card, boxShadow: T.shadow }}><span className="text-[30px] leading-none">{w.emoji || <ImageIcon className="h-7 w-7" />}</span><span className="mt-1 line-clamp-2 text-center text-[13px] font-semibold leading-tight">{w.label}</span></button>)}</div>
      {snap.phrases.length > 0 && <div className="mt-3 space-y-2">{snap.phrases.map((p) => <button key={p} type="button" onClick={() => void talk.speak(p, { remember: true })} className="tk-press block w-full rounded-[16px] px-4 py-3 text-left text-[17px]" style={{ background: T.card, boxShadow: T.shadow }}>{p}</button>)}</div>}
      <Btn kind="soft" className="mt-4 w-full" onClick={() => file.current?.click()}><Camera className="h-5 w-5" />Another photo</Btn>
    </>}
  </Sheet>;
}

// ——— Premium —————————————————————————————————————————————————————————————————————————————————————————
const PERK_ICON = { ear: Ear, sparkles: Sparkles, camera: Camera, voices: Volume2, image: ImageIcon } as const;
export function PremiumSheet({ talk, onClose, onSignIn }: { talk: Talk; onClose: () => void; onSignIn: () => void }) {
  const [plan, setPlan] = useState<"month" | "year">("year");
  const [busy, setBusy] = useState(false);
  const buy = async () => {
    if (!talk.token) { onSignIn(); return; }
    setBusy(true);
    try {
      const r = await talkApi<{ url: string }>(talk.token, "/premium/checkout", { method: "POST", body: JSON.stringify({ plan, returnTo: isNativeApp() ? "https://arisetodo.com/" : window.location.origin + "/" }) });
      if (isNativeApp()) { window.open(r.url, "_blank"); talk.flash("Finish in Safari, then come back here."); onClose(); }
      else window.location.href = r.url;
    } catch (e: any) { talk.flash(e.message); }
    setBusy(false);
  };
  // Back from paying in Safari: check again when the app comes back.
  useEffect(() => { const on = () => { if (document.visibilityState === "visible") void talk.refreshMe(); }; document.addEventListener("visibilitychange", on); return () => document.removeEventListener("visibilitychange", on); }, [talk]);
  return <Sheet title="Arise Talk Premium" onClose={onClose} testId="talk-premium">
    <p className="text-[15px]" style={{ color: T.dim }}>Talking is always free. Premium adds helpers that make conversations faster and easier.</p>
    <div className="mt-3 space-y-2">{PREMIUM_PERKS.map((p) => { const I = PERK_ICON[p.icon]; return <div key={p.title} className="flex items-start gap-3 rounded-[16px] p-3.5" style={{ background: T.card }}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]" style={{ background: T.accentSoft, color: T.accent }}><I className="h-5 w-5" /></span>
      <span><span className="block text-[16px] font-semibold">{p.title}</span><span className="block text-[13px]" style={{ color: T.dim }}>{p.text}</span></span></div>; })}</div>
    {talk.premium ? <p className="mt-5 flex items-center justify-center gap-2 text-[16px] font-semibold" style={{ color: T.accent }}><Check className="h-5 w-5" />Premium is on</p> : <>
      <div className="mt-5 grid grid-cols-2 gap-2">{(["year", "month"] as const).map((p) => <button key={p} type="button" onClick={() => setPlan(p)} aria-pressed={plan === p} className="tk-press relative rounded-[16px] p-3.5 text-left" style={{ background: T.card, boxShadow: plan === p ? `inset 0 0 0 2px ${T.accent}` : `inset 0 0 0 1px ${T.line}` }} data-testid={`talk-plan-${p}`}>
        {p === "year" && <span className="absolute -top-2 right-3 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: T.accent, color: T.onAccent }}>Save {Math.round(100 - (PREMIUM.yearCents / (PREMIUM.monthCents * 12)) * 100)}%</span>}
        <span className="block text-[14px] font-semibold" style={{ color: T.dim }}>{p === "year" ? "Yearly" : "Monthly"}</span>
        <span className="block text-[22px] font-bold">{money(p === "year" ? PREMIUM.yearCents : PREMIUM.monthCents)}</span>
        <span className="block text-[12px]" style={{ color: T.dim }}>{p === "year" ? `${money(Math.round(PREMIUM.yearCents / 12))} a month` : "a month"}</span></button>)}</div>
      <Btn className="mt-4 w-full" disabled={busy} onClick={buy} testId="talk-premium-buy">{talk.token ? `Try free for ${PREMIUM.trialDays} days` : "Create a free account to start"}</Btn>
      <p className="mt-2 text-center text-[12px]" style={{ color: T.dim }}>Free for {PREMIUM.trialDays} days, then {money(plan === "year" ? PREMIUM.yearCents : PREMIUM.monthCents)} a {plan}. Cancel anytime.</p>
    </>}
  </Sheet>;
}

// ——— Signing in (one tap with Apple, or an email) ————————————————————————————————————————————————————
export function SignInSheet({ onClose }: { onClose: () => void }) {
  const { login, signInWithApple } = useAuth();
  const [mode, setMode] = useState<"start" | "new" | "old" | "code">("start");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [code, setCode] = useState(""); const [username, setUsername] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => { if (busy) return; setBusy(true); setErr(""); try { await fn(); } catch (e: any) { setErr(e?.message || "That didn't work. Try again."); } setBusy(false); };
  const apple = () => run(async () => { const a = await askApple(nativeAppInfo().bundle); if (!a) return; await signInWithApple(a); onClose(); });
  const signUp = (e: FormEvent) => { e.preventDefault(); void run(async () => {
    if (name.trim().length < 2) throw new Error("Enter your name.");
    if (!/^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(email.trim())) throw new Error("Enter your email address.");
    if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
    const u = (email.trim().split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "talker") + Math.floor(100 + Math.random() * 900);
    const res = await fetch(`${API_BASE}/api/arise-todo/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, displayName: name.trim(), password, email: email.trim() }) });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.message || "Couldn't create your account.");
    setUsername(u);
    if (body?.confirmEmail) { setMode("code"); return; }
    await login(u, password); onClose();
  }); };
  const confirm = (e: FormEvent) => { e.preventDefault(); void run(async () => {
    const res = await fetch(`${API_BASE}/api/arise-todo/confirm-email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, code: code.trim() }) });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.message || "That code didn't work.");
    await login(username, password); onClose();
  }); };
  const signIn = (e: FormEvent) => { e.preventDefault(); void run(async () => { await login(email.trim(), password); onClose(); }); };
  return <Sheet title={mode === "old" ? "Sign in" : mode === "code" ? "Check your email" : "Save your words"} onClose={onClose} testId="talk-signin">
    {mode === "start" && <>
      <p className="text-[15px]" style={{ color: T.dim }}>A free account backs up your boards, phrases and settings, and lets you try Premium.</p>
      {appleSignInAvailable() && <button type="button" onClick={apple} disabled={busy} className="tk-press mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-black text-[17px] font-semibold text-white"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d={APPLE_LOGO_PATH} /></svg>Continue with Apple</button>}
      <Btn kind={appleSignInAvailable() ? "soft" : "primary"} className="mt-2 w-full" onClick={() => setMode("new")} testId="talk-signin-email">Continue with email</Btn>
      <button type="button" onClick={() => setMode("old")} className="mt-2 h-11 w-full text-[15px] font-semibold" style={{ color: T.accent }}>I already have an Arise account</button>
    </>}
    {mode === "new" && <form onSubmit={signUp}>
      <Field label="Your name"><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={inputCls} style={inputStyle} /></Field>
      <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" className={inputCls} style={inputStyle} /></Field>
      <Field label="Password (8 or more characters)"><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" className={inputCls} style={inputStyle} /></Field>
      <button type="submit" disabled={busy} className="tk-press mt-4 h-12 w-full rounded-[14px] text-[16px] font-semibold disabled:opacity-50" style={{ background: T.accent, color: T.onAccent }}>Create my free account</button>
    </form>}
    {mode === "old" && <form onSubmit={signIn}>
      <Field label="Email or username"><input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoCapitalize="none" className={inputCls} style={inputStyle} /></Field>
      <Field label="Password"><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" className={inputCls} style={inputStyle} /></Field>
      <button type="submit" disabled={busy} className="tk-press mt-4 h-12 w-full rounded-[14px] text-[16px] font-semibold disabled:opacity-50" style={{ background: T.accent, color: T.onAccent }}>Sign in</button>
    </form>}
    {mode === "code" && <form onSubmit={confirm}>
      <p className="text-[15px]" style={{ color: T.dim }}>We sent a code to {email}. Type it here.</p>
      <Field label="Code"><input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" className={`${inputCls} text-center text-[24px] tracking-[.3em]`} style={inputStyle} /></Field>
      <button type="submit" disabled={busy} className="tk-press mt-4 h-12 w-full rounded-[14px] text-[16px] font-semibold disabled:opacity-50" style={{ background: T.accent, color: T.onAccent }}>Confirm</button>
    </form>}
    {err && <p className="mt-3 text-center text-[14px]" style={{ color: T.danger }}>{err}</p>}
  </Sheet>;
}

// ——— First time: a voice, a size and a name, in under a minute ————————————————————————————————————————
export function Onboarding({ talk, onDone }: { talk: Talk; onDone: (signIn: boolean) => void }) {
  const [step, setStep] = useState(0);
  const { data } = talk;
  const s = data.settings;
  const next = () => setStep((n) => n + 1);
  const steps = [
    <div key="hi" className="flex flex-1 flex-col items-center justify-center text-center">
      <img src="/app-icons/talk-1024.png" alt="" className="h-24 w-24 rounded-[24px] shadow-lg" />
      <h1 className="mt-6 text-[34px] font-bold leading-tight tracking-[-.02em]">Talk your way,<br />in a real voice.</h1>
      <p className="mt-3 max-w-[300px] text-[17px]" style={{ color: T.dim }}>Tap pictures and words, and Arise Talk says them out loud in a natural AI voice.</p>
    </div>,
    <div key="voice" className="flex-1">
      <h1 className="text-[28px] font-bold tracking-[-.02em]">Pick a voice</h1>
      <p className="mt-1 text-[16px]" style={{ color: T.dim }}>Tap one to hear it. You can change it anytime.</p>
      <div className="mt-5 space-y-2">{VOICES.filter((v) => v.free).map((v) => <button key={v.id} type="button" onClick={() => { setS(talk, { voice: v.id }); void say(`Hi! I'm ${v.name}. I can be your voice.`, v.id); }} aria-pressed={s.voice === v.id} className="tk-press flex w-full items-center gap-3 rounded-[18px] p-4 text-left" style={{ background: T.card, boxShadow: s.voice === v.id ? `inset 0 0 0 2px ${T.accent}, ${T.shadow}` : T.shadow }} data-testid={`talk-onb-voice-${v.id}`}>
        <span className="grid h-11 w-11 place-items-center rounded-full" style={{ background: T.accentSoft, color: T.accent }}><Play className="h-5 w-5" fill="currentColor" /></span>
        <span className="flex-1"><span className="block text-[18px] font-semibold">{v.name}</span><span className="block text-[14px]" style={{ color: T.dim }}>{v.blurb}</span></span>{s.voice === v.id && <Check className="h-6 w-6" style={{ color: T.accent }} />}</button>)}</div>
      <p className="mt-3 px-1 text-[13px]" style={{ color: T.dim }}>Four more voices come with Premium.</p>
    </div>,
    <div key="size" className="flex-1">
      <h1 className="text-[28px] font-bold tracking-[-.02em]">How big should buttons be?</h1>
      <div className="mt-5 space-y-2">{([[4, "Large", "Easier to hit"], [5, "Medium", "A good balance"], [6, "Small", "More words on screen"]] as const).map(([c, label, sub]) => <button key={c} type="button" onClick={() => setS(talk, { cols: c })} aria-pressed={s.cols === c} className="tk-press flex w-full items-center gap-4 rounded-[18px] p-4 text-left" style={{ background: T.card, boxShadow: s.cols === c ? `inset 0 0 0 2px ${T.accent}, ${T.shadow}` : T.shadow }}>
        <span className="grid shrink-0 gap-[3px]" style={{ gridTemplateColumns: `repeat(${c}, 9px)` }}>{Array.from({ length: c * 2 }, (_, i) => <span key={i} className="h-[11px] rounded-[3px]" style={{ background: T.accentSoft }} />)}</span>
        <span className="flex-1"><span className="block text-[18px] font-semibold">{label}</span><span className="block text-[14px]" style={{ color: T.dim }}>{sub}</span></span></button>)}</div>
    </div>,
    <div key="name" className="flex-1">
      <h1 className="text-[28px] font-bold tracking-[-.02em]">What's your name?</h1>
      <p className="mt-1 text-[16px]" style={{ color: T.dim }}>So “My name is…” says it for you. Optional.</p>
      <input value={data.about.name} onChange={(e) => talk.update((d) => ({ ...d, about: { ...d.about, name: e.target.value.slice(0, 60) } }), { undo: false })} placeholder="Your name" className={`${inputCls} mt-5 !h-14 !text-[20px]`} style={inputStyle} data-testid="talk-onb-name" />
    </div>,
    <div key="save" className="flex flex-1 flex-col justify-center">
      <h1 className="text-[28px] font-bold tracking-[-.02em]">Keep your words safe</h1>
      <p className="mt-2 text-[16px]" style={{ color: T.dim }}>A free account backs up everything you change, so a new phone gets it all back. You can do this later in More.</p>
    </div>,
  ];
  const last = step === steps.length - 1;
  return <div className="fixed inset-0 flex flex-col px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))]" style={{ ...font, background: T.bg, color: T.text }} data-testid="talk-onboarding">
    <div className="flex gap-1.5">{steps.map((_, i) => <span key={i} className="h-1 flex-1 rounded-full" style={{ background: i <= step ? T.accent : T.card2 }} />)}</div>
    <div key={step} className="tk-in mt-8 flex flex-1 flex-col">{steps[step]}</div>
    {last ? <>
      <Btn className="w-full" onClick={() => onDone(true)} testId="talk-onb-account">Create a free account</Btn>
      <Btn kind="ghost" className="mt-1 w-full" onClick={() => onDone(false)} testId="talk-onb-later">Not now, start talking</Btn>
    </> : <Btn className="w-full" onClick={next} testId="talk-onb-next">{step === 0 ? "Get started" : "Next"}</Btn>}
  </div>;
}
