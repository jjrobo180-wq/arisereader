import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";
import { defaultNeeds, resizeTalkerPhoto, talkerPicture, talkerRequest, type TalkerConfig, type TalkerProgress, type TalkerState, type TalkerWord } from "@/lib/talkerState";
import { lessons } from "./EyeGazeLearningZone";
import { places, talkerCategories, defaultTalkerPageOrder } from "./EyeGazeTalker";

type WordChoice = { word: string; icon: string; sentence: string; first?: string; choices?: string[] };
type Tab = "today" | "customize" | "progress";

function localDay() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function dailyChoices(catalog: WordChoice[], progress: TalkerProgress, studentId: number): WordChoice[] {
  const waiting = catalog.filter(item => progress.words[item.word.toLowerCase()]?.status !== "known");
  const available = waiting.length ? waiting : catalog;
  const [year, month, day] = localDay().split("-").map(Number);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  const offset = ((dayNumber * 3 + studentId) % available.length + available.length) % available.length;
  return Array.from({ length: Math.min(3, available.length) }, (_, index) => available[(offset + index) % available.length]);
}

export default function EyeGazeParentMode() {
  const { token, user } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("today");
  const [state, setState] = useState<TalkerState | null>(null);
  const [draft, setDraft] = useState<TalkerConfig>({ alwaysHere: defaultNeeds, pictures: {}, overrides: {}, recordings: {}, pageOrder: [], buttonOrder: {} });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState("");
  const [question, setQuestion] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [photoWord, setPhotoWord] = useState("Milk");
  const [layoutSearch, setLayoutSearch] = useState("");
  const [layoutPageId, setLayoutPageId] = useState("people");

  useEffect(() => {
    let active = true;
    void talkerRequest<TalkerState>(token).then(result => {
      if (!active) return;
      setState(result);
      setDraft({
        alwaysHere: result.config.alwaysHere ?? defaultNeeds.map(item => ({ ...item })),
        pictures: result.config.pictures || {},
        overrides: result.config.overrides || {},
        recordings: result.config.recordings || {},
        pageOrder: result.config.pageOrder || [],
        buttonOrder: result.config.buttonOrder || {},
      });
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; stopSpeaking(); };
  }, [token]);

  const catalog = useMemo<WordChoice[]>(() => {
    const entries: WordChoice[] = lessons.map(item => ({ word: item.word, icon: item.icon, sentence: item.phrases[0], first: item.first, choices: item.choices }));
    const labels = new Set(entries.map(item => item.word.toLowerCase()));
    for (const button of draft.alwaysHere || []) {
      if (labels.has(button.label.toLowerCase())) continue;
      labels.add(button.label.toLowerCase());
      entries.push({ word: button.label, icon: button.picture, sentence: button.sentence });
    }
    return entries;
  }, [draft.alwaysHere]);

  const configuredPageOrder = draft.pageOrder?.length ? draft.pageOrder : defaultTalkerPageOrder;
  const talkerPageOrder = [
    ...configuredPageOrder.filter(id => talkerCategories.some(category => category.id === id)),
    ...defaultTalkerPageOrder.filter(id => !configuredPageOrder.includes(id)),
  ];
  const orderedPages = talkerPageOrder
    .map(id => talkerCategories.find(category => category.id === id))
    .filter(Boolean) as typeof talkerCategories;

  const buttonKey = (label: string) => label.trim().toLowerCase();
  const orderedPageWords = (pageId: string) => {
    const page = talkerCategories.find(category => category.id === pageId);
    if (!page) return [];
    const configured = draft.buttonOrder?.[pageId] || [];
    if (!configured.length) return [...page.words];
    const rank = new Map(configured.map((key, index) => [key, index]));
    return [...page.words].sort((a, b) => (rank.get(buttonKey(a.label)) ?? 999) - (rank.get(buttonKey(b.label)) ?? 999));
  };

  const layoutCatalog = talkerCategories.flatMap(category =>
    category.words.map(word => ({ category, word }))
  );
  const normalizedSearch = layoutSearch.trim().toLowerCase();
  const layoutResults = normalizedSearch
    ? layoutCatalog.filter(item =>
        item.word.label.toLowerCase().includes(normalizedSearch)
        || item.word.sentence.toLowerCase().includes(normalizedSearch)
        || item.category.label.toLowerCase().includes(normalizedSearch)
      ).slice(0, 30)
    : [];

  const moveArrayItem = <T,>(items: T[], from: number, to: number) => {
    if (from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };

  const movePage = (pageId: string, direction: -1 | 1) => {
    setDraft(previous => {
      const current = previous.pageOrder?.length ? [...previous.pageOrder] : [...defaultTalkerPageOrder];
      for (const id of defaultTalkerPageOrder) if (!current.includes(id)) current.push(id);
      const index = current.indexOf(pageId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return previous;
      return { ...previous, pageOrder: moveArrayItem(current, index, nextIndex) };
    });
  };

  const movePageButton = (pageId: string, key: string, direction: -1 | 1) => {
    setDraft(previous => {
      const page = talkerCategories.find(category => category.id === pageId);
      if (!page) return previous;
      const defaultKeys = page.words.map(word => buttonKey(word.label));
      const current = previous.buttonOrder?.[pageId]?.length ? [...previous.buttonOrder[pageId]] : defaultKeys;
      for (const id of defaultKeys) if (!current.includes(id)) current.push(id);
      const index = current.indexOf(key);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return previous;
      return {
        ...previous,
        buttonOrder: {
          ...(previous.buttonOrder || {}),
          [pageId]: moveArrayItem(current, index, nextIndex),
        },
      };
    });
  };

  const progress = state?.progress || { words: {}, history: [] };
  const todaysWords = state ? dailyChoices(catalog, progress, state.student.id) : [];
  const focus = catalog.find(item => item.word === selected) || todaysWords[0];
  const known = Object.values(progress.words).filter(item => item.status === "known");
  const focusStatus = focus ? progress.words[focus.word.toLowerCase()]?.status : undefined;
  const practicedToday = progress.history.filter(item => new Date(item.at).toLocaleDateString() === new Date().toLocaleDateString()).length;
  const photoLabels = Array.from(new Set([...places.flatMap(place => place.words.map(word => word.label)), ...defaultNeeds.map(item => item.label), ...(draft.alwaysHere || []).map(item => item.label)])).sort();

  const speak = (line: string) => {
    void speakCharacterAI(line, { calmMode: true, onFallback: () => {
      if (!("speechSynthesis" in window)) return;
      const utterance = new SpeechSynthesisUtterance(line);
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    } });
  };

  const record = async (word: string, outcome: string, prompt?: number) => {
    setSaving(true); setError("");
    try {
      const result = await talkerRequest<{ progress: TalkerProgress }>(token, "/practice", "POST", { word, outcome, prompt });
      setState(previous => previous && ({ ...previous, progress: result.progress }));
      setMessage(
        outcome === "known" ? `✓ Saved: ${word} is marked KNOWN.`
        : outcome === "learning" ? `✓ Saved: ${word} is still LEARNING.`
        : outcome === "retry" ? `✓ Saved: keep practicing ${word}.`
        : outcome === "correct" ? `✓ Saved: ${word} response recorded.`
        : `✓ Saved ${word} practice.`
      );
      if (prompt && outcome === "correct") setQuestion(previous => Math.min(2, previous + 1));
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const save = async () => {
    setSaving(true); setError(""); setMessage("");
    try {
      const grownupToken = sessionStorage.getItem("talker-grownup-token") || "";
      const result = await talkerRequest<{ config: TalkerConfig }>(
        token,
        "/config",
        "POST",
        draft,
        grownupToken ? { "X-Talker-Grownup-Token": grownupToken } : {},
      );
      setDraft(result.config);
      setState(previous => previous && ({ ...previous, config: result.config }));
      setMessage("Pictures and buttons saved to your child's talker.");
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const changeButton = (id: string, update: Partial<TalkerWord>) => {
    setDraft(previous => ({ ...previous, alwaysHere: (previous.alwaysHere || []).map(item => item.id === id ? { ...item, ...update } : item) }));
  };

  const upload = async (file: File | undefined, id?: string) => {
    if (!file) return;
    setError("");
    try {
      const data = await resizeTalkerPhoto(file);
      if (id) changeButton(id, { imageData: data });
      else setDraft(previous => ({ ...previous, pictures: { ...previous.pictures, [photoWord.toLowerCase()]: data } }));
      setMessage("Photo ready. Tap Save changes below.");
    } catch (err: any) { setError(err.message); }
  };

  const addButton = () => {
    const id = `custom-${Math.random().toString(36).slice(2, 12)}`;
    setDraft(previous => ({ ...previous, alwaysHere: [...(previous.alwaysHere || []), { id, label: "My word", picture: "💬", sentence: "I want to say my word." }] }));
    setEditing(id);
  };

  if (error && !state) return <div className="min-h-screen bg-[#f3f8fa] p-8 text-[#193d57]"><h1 className="text-2xl font-black">Grown-up tools</h1><p role="alert" className="my-4">{error}</p><button onClick={() => navigate(user?.role === "parent" ? "/parent-dashboard" : "/eye-gaze-talker")} className="rounded-2xl bg-white p-4 font-black">← Back</button></div>;
  if (!state) return <div className="min-h-screen bg-[#f3f8fa] p-8 font-black text-[#193d57]">Loading your family's talker…</div>;

  return (
    <div className="min-h-screen bg-[#f3f8fa] text-[#193d57] px-3 sm:px-6 pb-12">
      <div className="max-w-5xl mx-auto">
        <header className="py-4 sm:py-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto"><p className="text-xs font-black tracking-widest text-teal-700">A.R.I.S.E. READER</p><h1 className="text-3xl sm:text-4xl font-black">Learning Zone</h1><p className="font-bold text-slate-600 mt-1">Grown-up tools for {state.student.name}</p></div>
            <button onClick={() => navigate(user?.role === "parent" ? "/parent-dashboard" : "/eye-gaze-home")} className="min-h-12 rounded-2xl bg-white border-2 border-slate-200 px-4 font-black">⌂ Home</button>
            <button onClick={() => navigate(user?.role === "parent" ? "/parent-dashboard" : "/eye-gaze-account")} className="min-h-12 rounded-2xl bg-white border-2 border-slate-200 px-4 font-black">Profile</button>
          </div>
          <div className="mt-3 rounded-3xl bg-white border-2 border-teal-100 p-2 grid grid-cols-3 gap-2" role="tablist" aria-label="Learning Zone">
            <button type="button" role="tab" aria-selected="false" onClick={() => navigate("/eye-gaze-talker")} className="min-h-14 rounded-2xl bg-slate-100 font-black">🗣️ Talk</button>
            <button type="button" role="tab" aria-selected="false" onClick={() => { sessionStorage.setItem("eye-gaze-talker-open-learn", "1"); navigate("/eye-gaze-talker"); }} className="min-h-14 rounded-2xl bg-slate-100 font-black">📚 Learn</button>
            <button type="button" role="tab" aria-selected="true" className="min-h-14 rounded-2xl bg-amber-300 text-amber-950 font-black">👨‍👩‍👧 Grown-up</button>
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={() => navigate("/eye-gaze-parent-controls")} className="min-h-11 rounded-2xl bg-violet-100 text-violet-900 border border-violet-200 px-4 font-black">🔒 Parent controls</button>
          </div>
        </header>

        <nav aria-label="Grown-up tools" className="flex flex-wrap gap-2 mb-5">
          {(["today", "customize", "progress"] as const).map(item => <button key={item} onClick={() => { setTab(item); setMessage(""); }} aria-current={tab === item ? "page" : undefined} className={`min-h-14 rounded-2xl px-5 font-black ${tab === item ? "bg-[#193d57] text-white" : "bg-white border border-slate-200"}`}>{item === "today" ? "📅 Today's words" : item === "customize" ? "📸 Pictures & buttons" : "📈 Progress"}</button>)}
        </nav>
        {error && <p role="alert" className="rounded-2xl bg-red-50 border border-red-200 p-4 font-bold mb-4">{error}</p>}
        {message && <p role="status" className="rounded-2xl bg-teal-50 border border-teal-200 p-4 font-bold mb-4">{message}</p>}

        {tab === "today" && <div className="space-y-5">
          <section className="rounded-3xl bg-white border-2 border-teal-100 p-5 sm:p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-2xl font-black">Three words for today</h2><span className="font-bold text-slate-500">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span></div>
            <p className="font-bold text-slate-600 mt-1">New suggestions each day. Choose any word to teach at your own pace.</p>
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-5">{todaysWords.map(item => <button key={item.word} onClick={() => { setSelected(item.word); setQuestion(0); }} className={`min-h-32 rounded-3xl border-4 p-2 flex flex-col items-center justify-center gap-1 ${focus?.word === item.word ? "border-teal-500 bg-teal-50" : "border-slate-100 bg-white"}`}><span className="text-5xl" aria-hidden="true">{item.icon}</span><span className="font-black text-lg">{item.word}</span></button>)}</div>
            <label htmlFor="family-word" className="block font-black mt-5 mb-2">Or choose a word yourself</label>
            <select id="family-word" value={focus?.word || ""} onChange={event => { setSelected(event.target.value); setQuestion(0); }} className="min-h-14 w-full sm:w-72 rounded-2xl border-2 border-teal-200 bg-white p-3 font-bold">{catalog.map(item => <option key={item.word} value={item.word}>{item.word}</option>)}</select>
          </section>
          {focus && <section className="rounded-3xl bg-gradient-to-br from-sky-100 via-white to-amber-50 border-2 border-sky-100 p-5 sm:p-7">
            <div className="grid sm:grid-cols-[170px_1fr] gap-5 items-center"><div className="w-40 h-40 rounded-3xl bg-white grid place-items-center text-8xl overflow-hidden" role="img" aria-label={focus.word}>{draft.pictures[focus.word.toLowerCase()] ? <img src={draft.pictures[focus.word.toLowerCase()]} alt="" className="w-full h-full object-cover" /> : focus.icon}</div><div><p className="font-black text-teal-700">TEACH THIS WORD</p><h3 className="text-4xl font-black">{focus.word}</h3><p className="text-lg font-bold mt-2">{focus.sentence}</p><button onClick={() => speak(`${focus.word}. ${focus.sentence}`)} className="min-h-12 px-4 rounded-2xl bg-white font-black mt-3">🔊 Hear the word and phrase</button></div></div>
            <div className="mt-6 border-t border-sky-200 pt-5"><p className="font-black text-sm text-teal-700">QUESTION {question + 1} OF 3</p><h4 className="text-2xl font-black mt-1">{question === 0 ? `Can you find ${focus.word}?` : question === 1 ? `Can you say ${focus.word}?` : `Can you use ${focus.word} in a phrase?`}</h4><button onClick={() => speak(question === 0 ? `Can you find ${focus.word}?` : question === 1 ? `Can you say ${focus.word}?` : `Let's say this together. ${focus.sentence}`)} className="min-h-12 mt-3 rounded-2xl bg-[#137f96] text-white font-black px-5">🔊 Ask with AI voice</button>
              {question === 0 && focus.choices && <div className="grid grid-cols-3 gap-2 mt-4">{focus.choices.map(choice => <button disabled={saving} onClick={() => void record(focus.word, choice === focus.word ? "correct" : "retry", 1)} key={choice} className="min-h-28 bg-white rounded-2xl border-2 border-sky-100 font-black flex flex-col justify-center items-center"><span className="text-4xl">{lessons.find(item => item.word === choice)?.icon || "❔"}</span>{choice}</button>)}</div>}
              <div className="flex flex-wrap gap-2 mt-4"><button disabled={saving} onClick={() => void record(focus.word, "correct", question + 1)} className="min-h-14 bg-emerald-600 text-white rounded-2xl px-5 font-black">✓ Got it</button><button disabled={saving} onClick={() => void record(focus.word, "retry", question + 1)} className="min-h-14 bg-white rounded-2xl px-5 font-black">Practice more</button><button onClick={() => setQuestion((question + 1) % 3)} className="min-h-14 rounded-2xl px-4 font-bold underline">Next question →</button></div>
            </div>
            <div className="mt-6 pt-5 border-t border-sky-200">
              <div className={"rounded-2xl border-2 p-4 mb-4 flex items-center gap-3 " + (focusStatus === "known" ? "bg-emerald-50 border-emerald-300 text-emerald-900" : focusStatus === "learning" ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-white border-slate-200 text-slate-600")}>
                <span className="text-3xl">{focusStatus === "known" ? "⭐" : focusStatus === "learning" ? "🟡" : "○"}</span>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">Current parent status</p>
                  <p className="text-xl font-black">{focusStatus === "known" ? "KNOWN ✓" : focusStatus === "learning" ? "STILL LEARNING ✓" : "Not marked yet"}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-bold flex-1">Parent check: Does your child use this word reliably? You decide when it's known.</p>
                <button disabled={saving} onClick={() => void record(focus.word, "known")} className={"min-h-14 rounded-2xl px-5 font-black border-2 " + (focusStatus === "known" ? "bg-emerald-600 border-emerald-600 text-white ring-4 ring-emerald-100" : "bg-[#193d57] border-[#193d57] text-white")}>{saving ? "Saving…" : focusStatus === "known" ? "✓ Marked known" : "⭐ Mark " + focus.word + " known"}</button>
                <button disabled={saving} onClick={() => void record(focus.word, "learning")} className={"min-h-14 rounded-2xl px-5 font-black border-2 " + (focusStatus === "learning" ? "bg-amber-300 border-amber-400 text-amber-950 ring-4 ring-amber-100" : "bg-white border-slate-200")}>{saving ? "Saving…" : focusStatus === "learning" ? "✓ Still learning saved" : "Still learning"}</button>
              </div>
            </div>
            {lessons.some(item => item.word === focus.word) && <button className="mt-4 font-black text-teal-800 underline" onClick={() => { localStorage.setItem("eye-gaze-learning-word", focus.word); sessionStorage.setItem("eye-gaze-talker-open-learn", "1"); navigate("/eye-gaze-talker"); }}>Open picture and phonics Learning Zone →</button>}
          </section>}
        </div>}

        {tab === "customize" && <div className="space-y-5">
          <section className="rounded-3xl bg-white border-2 border-violet-100 p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-violet-700">Talker layout</p>
                <h2 className="text-2xl sm:text-3xl font-black">Search & arrange pages</h2>
                <p className="font-bold text-slate-600 mt-1">Move whole pages, then arrange the buttons inside each page. Save when the layout feels right.</p>
              </div>
              <button disabled={saving} onClick={() => void save()} className="min-h-12 rounded-2xl bg-violet-600 text-white px-5 font-black disabled:opacity-50">{saving ? "Saving…" : "Save layout"}</button>
            </div>

            <label className="block mt-5 font-black">Search Talker buttons
              <input
                value={layoutSearch}
                onChange={event => setLayoutSearch(event.target.value)}
                placeholder="Search Mom, milk, bathroom, happy…"
                className="mt-2 w-full min-h-14 rounded-2xl border-2 border-violet-100 px-4 text-lg font-bold"
              />
            </label>

            {layoutResults.length > 0 && (
              <div className="mt-3 rounded-2xl border-2 border-violet-100 overflow-hidden">
                {layoutResults.map(({ category, word }) => (
                  <button
                    key={category.id + "-" + word.label}
                    type="button"
                    onClick={() => { setLayoutPageId(category.id); setLayoutSearch(""); }}
                    className="w-full min-h-14 px-4 border-b last:border-b-0 border-violet-50 flex items-center gap-3 text-left hover:bg-violet-50"
                  >
                    <span className="text-3xl">{word.picture}</span>
                    <span className="flex-1"><strong className="block">{word.label}</strong><small className="font-bold text-slate-500">{category.label} · {word.sentence}</small></span>
                    <span className="font-black text-violet-700">Open page →</span>
                  </button>
                ))}
              </div>
            )}

            <div className="grid lg:grid-cols-[.9fr_1.1fr] gap-4 mt-5">
              <div>
                <h3 className="font-black text-lg">Page order</h3>
                <p className="text-sm font-bold text-slate-500 mb-3">This controls the order children see under Categories.</p>
                <div className="space-y-2">
                  {orderedPages.map((page, index) => (
                    <div key={page.id} className={"rounded-2xl border-2 p-3 flex items-center gap-3 " + (layoutPageId === page.id ? "border-violet-400 bg-violet-50" : "border-slate-100")}>
                      <button type="button" onClick={() => setLayoutPageId(page.id)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                        <span className="text-3xl">{page.icon}</span>
                        <span><strong className="block">{page.label}</strong><small className="font-bold text-slate-500">{page.words.length} buttons</small></span>
                      </button>
                      <div className="flex gap-1">
                        <button type="button" disabled={index === 0} onClick={() => movePage(page.id, -1)} className="w-11 h-11 rounded-xl bg-white border font-black disabled:opacity-30" aria-label={"Move " + page.label + " up"}>↑</button>
                        <button type="button" disabled={index === orderedPages.length - 1} onClick={() => movePage(page.id, 1)} className="w-11 h-11 rounded-xl bg-white border font-black disabled:opacity-30" aria-label={"Move " + page.label + " down"}>↓</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                {(() => {
                  const page = talkerCategories.find(category => category.id === layoutPageId) || talkerCategories[0];
                  const pageWords = orderedPageWords(page.id);
                  return (
                    <>
                      <h3 className="font-black text-lg">{page.icon} Buttons on {page.label}</h3>
                      <p className="text-sm font-bold text-slate-500 mb-3">Move the most important buttons toward the top.</p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {pageWords.map((word, index) => {
                          const key = buttonKey(word.label);
                          return (
                            <div key={key} className="rounded-2xl border-2 border-slate-100 p-3 flex items-center gap-2">
                              <span className="text-3xl">{word.picture}</span>
                              <strong className="flex-1 min-w-0 truncate">{word.label}</strong>
                              <button type="button" disabled={index === 0} onClick={() => movePageButton(page.id, key, -1)} className="w-10 h-10 rounded-xl bg-slate-50 border font-black disabled:opacity-30" aria-label={"Move " + word.label + " up"}>↑</button>
                              <button type="button" disabled={index === pageWords.length - 1} onClick={() => movePageButton(page.id, key, 1)} className="w-10 h-10 rounded-xl bg-slate-50 border font-black disabled:opacity-30" aria-label={"Move " + word.label + " down"}>↓</button>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-white border-2 border-teal-100 p-5 sm:p-7"><h2 className="text-2xl font-black">Use familiar pictures</h2><p className="font-bold text-slate-600 mt-1">Choose a talker word, then upload a photo of your child's own cup, pet, toy, or favorite place. The photo replaces its picture wherever that word appears.</p>
            <div className="flex flex-wrap items-center gap-3 mt-5"><select aria-label="Picture to replace" value={photoWord} onChange={event => setPhotoWord(event.target.value)} className="min-h-14 rounded-2xl border-2 border-teal-200 bg-white p-3 font-bold">{photoLabels.map(label => <option key={label} value={label}>{label}</option>)}</select><label className="min-h-14 rounded-2xl bg-teal-600 text-white px-5 flex items-center font-black cursor-pointer">📸 Upload photo<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={event => { void upload(event.target.files?.[0]); event.target.value = ""; }} /></label>{draft.pictures[photoWord.toLowerCase()] && <button onClick={() => setDraft(previous => { const pictures = { ...previous.pictures }; delete pictures[photoWord.toLowerCase()]; return { ...previous, pictures }; })} className="min-h-14 rounded-2xl bg-white border px-4 font-bold">Use original picture</button>}</div>
            <div className="flex items-center gap-3 mt-4">{draft.pictures[photoWord.toLowerCase()] ? <img src={draft.pictures[photoWord.toLowerCase()]} alt={`Uploaded picture for ${photoWord}`} className="w-24 h-24 rounded-2xl object-cover" /> : <span className="text-6xl" aria-hidden="true">{places.flatMap(place => place.words).find(word => word.label === photoWord)?.picture || "💬"}</span>}<span className="font-black text-xl">{photoWord}</span></div><p className="text-sm font-bold text-slate-500 mt-3">Pictures stay with this child's account and linked parent. Images are resized before saving.</p></section>
          <section className="rounded-3xl bg-white border-2 border-amber-100 p-5 sm:p-7"><div className="flex flex-wrap justify-between gap-2"><div><h2 className="text-2xl font-black">Always here buttons</h2><p className="font-bold text-slate-600 mt-1">Edit what a button says, add a family word, or attach its own photo.</p></div><button onClick={addButton} disabled={(draft.alwaysHere || []).length >= 24} className="min-h-14 rounded-2xl bg-amber-300 px-5 font-black disabled:opacity-50">+ Add a button</button></div>
            <div className="grid sm:grid-cols-2 gap-3 mt-5">{(draft.alwaysHere || []).map(button => <div key={button.id} className="rounded-2xl border-2 border-slate-100 p-4"><div className="flex items-center gap-3"><div className="w-16 h-16 rounded-xl bg-teal-50 grid place-items-center text-4xl overflow-hidden">{talkerPicture(button, draft.pictures) ? <img src={talkerPicture(button, draft.pictures)!} alt="" className="w-full h-full object-cover" /> : button.picture}</div><div className="flex-1"><strong className="block text-lg">{button.label}</strong><span className="text-sm font-bold text-slate-600">{button.sentence}</span></div><button onClick={() => setEditing(editing === button.id ? null : button.id)} className="min-h-12 rounded-xl bg-slate-100 px-3 font-black">Edit</button></div>
              {editing === button.id && <div className="space-y-3 mt-4"><label className="block font-bold">Button name<input maxLength={40} value={button.label} onChange={event => changeButton(button.id, { label: event.target.value })} className="block w-full min-h-12 rounded-xl border-2 p-2 mt-1" /></label><label className="block font-bold">What the AI says<input maxLength={180} value={button.sentence} onChange={event => changeButton(button.id, { sentence: event.target.value })} className="block w-full min-h-12 rounded-xl border-2 p-2 mt-1" /></label><label className="block font-bold">Picture or emoji<input maxLength={16} value={button.picture} onChange={event => changeButton(button.id, { picture: event.target.value })} className="block w-full min-h-12 rounded-xl border-2 p-2 mt-1" /></label><div className="flex flex-wrap gap-2"><label className="min-h-12 rounded-xl bg-teal-100 px-3 flex items-center font-bold cursor-pointer">📸 Use my photo<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={event => { void upload(event.target.files?.[0], button.id); event.target.value = ""; }} /></label>{button.imageData && <button onClick={() => changeButton(button.id, { imageData: null })} className="min-h-12 rounded-xl bg-slate-100 px-3 font-bold">Remove photo</button>}<button onClick={() => { setDraft(previous => ({ ...previous, alwaysHere: (previous.alwaysHere || []).filter(item => item.id !== button.id) })); setEditing(null); }} className="min-h-12 rounded-xl bg-red-50 text-red-800 px-3 font-bold">Remove button</button></div></div>}
            </div>)}</div><div className="flex flex-wrap gap-3 mt-5"><button onClick={() => setDraft(previous => ({ ...previous, alwaysHere: defaultNeeds.map(item => ({ ...item })) }))} className="min-h-14 rounded-2xl border-2 bg-white px-5 font-black">Restore basic buttons</button><button disabled={saving} onClick={() => void save()} className="min-h-14 rounded-2xl bg-[#193d57] text-white px-6 font-black disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button></div></section>
        </div>}

        {tab === "progress" && <div className="space-y-5"><section className="grid sm:grid-cols-3 gap-3">{[{ count: known.length, label: "Words marked known" }, { count: Object.keys(progress.words).length, label: "Words practiced" }, { count: practicedToday, label: "Responses today" }].map(item => <div key={item.label} className="rounded-3xl bg-white p-6 border-2 border-teal-100"><strong className="text-4xl font-black">{item.count}</strong><span className="block font-bold text-slate-600">{item.label}</span></div>)}</section>
          <section className="rounded-3xl bg-white p-5 sm:p-7"><h2 className="text-2xl font-black">Words we're learning</h2><p className="font-bold text-slate-600 mt-1">These are parent observations, not an automatic speech assessment. You can change a word's status anytime.</p><div className="grid sm:grid-cols-2 gap-3 mt-5">{Object.values(progress.words).sort((a, b) => b.lastPracticedAt.localeCompare(a.lastPracticedAt)).map(item => <div key={item.label.toLowerCase()} className="rounded-2xl border-2 border-slate-100 p-4"><strong className="text-xl">{item.label}</strong><span className={`ml-2 rounded-full px-2 py-1 text-xs font-black ${item.status === "known" ? "bg-emerald-100" : "bg-amber-100"}`}>{item.status === "known" ? "KNOWN" : "LEARNING"}</span><p className="text-sm font-bold text-slate-600 mt-2">Practiced {item.timesPracticed} times · Got {item.correctCount || 0} of {item.attemptCount || 0} questions</p><p className="text-xs text-slate-500">Last practiced {new Date(item.lastPracticedAt).toLocaleDateString()}</p><button disabled={saving} onClick={() => void record(item.label, item.status === "known" ? "learning" : "known")} className="mt-3 font-black text-teal-700 underline">{item.status === "known" ? "Move back to learning" : "Mark known"}</button></div>)}{!Object.keys(progress.words).length && <p className="font-bold text-slate-600">Start with one of today's words. Each response will appear here.</p>}</div></section>
          <section className="rounded-3xl bg-white p-5 sm:p-7"><h2 className="text-2xl font-black">Recent practice</h2><div className="space-y-2 mt-4">{progress.history.slice(-12).reverse().map((item, index) => <div key={`${item.at}-${index}`} className="flex justify-between gap-3 border-b border-slate-100 py-2"><span className="font-bold">{item.word} · {item.outcome === "correct" ? "Got it" : item.outcome === "retry" ? "Practicing" : item.outcome === "known" ? "Marked known" : "Learning"}</span><time className="text-sm text-slate-500">{new Date(item.at).toLocaleString()}</time></div>)}{!progress.history.length && <p className="font-bold text-slate-600">No practice recorded yet.</p>}</div></section>
        </div>}
      </div>
    </div>
  );
}
