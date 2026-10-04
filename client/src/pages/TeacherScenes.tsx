import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Image as ImageIcon, MonitorPlay, Sparkles, Trash2, WandSparkles } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

type Scene = {
  id: string;
  bookTitle: string;
  author?: string;
  chapterStart: number;
  chapterEnd: number;
  characters: string[];
  sceneNotes: string;
  style: string;
  imagePath: string;
  imageUrl?: string | null;
  createdAt: string;
};

function getTokenFromCookie(): string | null {
  try {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const value = cookie.trim();
      if (!value.startsWith("arise_session=")) continue;
      const raw = value.substring("arise_session=".length);
      const data = JSON.parse(atob(raw));
      return data.token || null;
    }
  } catch {}
  return null;
}

export default function TeacherScenes() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [chapterStart, setChapterStart] = useState(1);
  const [chapterEnd, setChapterEnd] = useState(3);
  const [characters, setCharacters] = useState("");
  const [sceneNotes, setSceneNotes] = useState("");
  const [style, setStyle] = useState("cinematic illustrated");
  const [labelCharacters, setLabelCharacters] = useState(true);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const authorized = !!user && (user.role === "teacher" || user.isAdmin);
  const selected = useMemo(() => scenes.find((scene) => scene.id === selectedId) || scenes[0] || null, [scenes, selectedId]);

  const request = async (path: string, options: RequestInit = {}) => {
    const token = getTokenFromCookie();
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Something went wrong.");
    return data;
  };

  const loadScenes = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await request("/api/teacher/scenes");
      const items = Array.isArray(data?.scenes) ? data.scenes : [];
      setScenes(items);
      setSelectedId((current) => current || items[0]?.id || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Scenes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (!authorized) {
      navigate("/library");
      return;
    }
    void loadScenes();
  }, [user?.id, authorized]);

  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    const start = Math.max(1, Math.floor(Number(chapterStart) || 1));
    const end = Math.max(start, Math.floor(Number(chapterEnd) || start));
    if (!bookTitle.trim()) return setError("Add the book title.");
    if (end - start > 2) return setError("One panorama can cover up to 3 chapters. Make a second Scene for the next chapters.");
    if (sceneNotes.trim().length < 20) return setError("Add a short description of what students should see in these chapters.");

    setGenerating(true);
    try {
      const data = await request("/api/teacher/scenes/generate", {
        method: "POST",
        body: JSON.stringify({
          bookTitle: bookTitle.trim(),
          author: author.trim(),
          chapterStart: start,
          chapterEnd: end,
          characters: characters.split(",").map((name) => name.trim()).filter(Boolean).slice(0, 12),
          sceneNotes: sceneNotes.trim(),
          style,
          labelCharacters,
        }),
      });
      const scene = data.scene as Scene;
      setScenes((current) => [scene, ...current.filter((item) => item.id !== scene.id)]);
      setSelectedId(scene.id);
      setMessage(data.reused ? "That exact Scene already existed, so A.R.I.S.E. reused it without another AI generation." : "Scene generated once and saved. Reopening it will not use more AI credits.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate this Scene.");
    } finally {
      setGenerating(false);
    }
  };

  const removeScene = async (scene: Scene) => {
    if (!window.confirm(`Delete ${scene.bookTitle}, Chapters ${scene.chapterStart}-${scene.chapterEnd}?`)) return;
    setError("");
    try {
      await request(`/api/teacher/scenes/${encodeURIComponent(scene.id)}`, { method: "DELETE" });
      setScenes((current) => current.filter((item) => item.id !== scene.id));
      if (selectedId === scene.id) setSelectedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this Scene.");
    }
  };

  if (!user || !authorized) return null;

  return (
    <main className="min-h-screen bg-[#090914] text-white">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
          <button type="button" onClick={() => navigate("/teacher-dashboard")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 font-bold text-slate-200 hover:bg-white/10">
            <ArrowLeft size={18} /> Teacher Dashboard
          </button>
          <div className="text-center">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Teacher only</div>
            <h1 className="m-0 text-3xl font-black tracking-tight sm:text-4xl">A.R.I.S.E. Scenes</h1>
            <p className="mt-1 text-sm text-slate-400">Turn short chapter notes into a wide visual students can follow while you read.</p>
          </div>
          <div className="hidden w-[178px] lg:block" />
        </header>

        <section className="mt-6 rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-cyan-400/10 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-300 text-slate-950"><Sparkles size={22} /></div>
            <div>
              <h2 className="m-0 text-lg font-black">Built to keep AI usage low</h2>
              <p className="mb-0 mt-1 max-w-4xl text-sm leading-6 text-slate-300">
                One generation creates one saved panorama for up to three chapters. Once saved, you can present it again and again without generating it again. Describe the scene in your own words; do not paste full chapters.
              </p>
            </div>
          </div>
        </section>

        {error && <div role="alert" className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 font-semibold text-red-200">{error}</div>}
        {message && <div role="status" className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 font-semibold text-emerald-200">{message}</div>}

        <div className="mt-6 grid gap-6 lg:grid-cols-[390px_minmax(0,1fr)]">
          <form onSubmit={generate} className="rounded-3xl border border-white/10 bg-white/[0.045] p-5">
            <div className="mb-5 flex items-center gap-2">
              <WandSparkles className="text-fuchsia-300" size={20} />
              <h2 className="m-0 text-xl font-black">Create a Scene</h2>
            </div>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm font-bold text-slate-300">Book title *</span>
              <input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} maxLength={120} placeholder="Shadowshaper" className="min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-base outline-none focus:border-cyan-300/70" />
            </label>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm font-bold text-slate-300">Author</span>
              <input value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={100} placeholder="Optional" className="min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-base outline-none focus:border-cyan-300/70" />
            </label>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1.5 block text-sm font-bold text-slate-300">From chapter</span>
                <input type="number" min={1} max={999} value={chapterStart} onChange={(e) => setChapterStart(Number(e.target.value))} className="min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-base outline-none focus:border-cyan-300/70" />
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-bold text-slate-300">To chapter</span>
                <input type="number" min={1} max={999} value={chapterEnd} onChange={(e) => setChapterEnd(Number(e.target.value))} className="min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-base outline-none focus:border-cyan-300/70" />
              </label>
            </div>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm font-bold text-slate-300">Characters</span>
              <input value={characters} onChange={(e) => setCharacters(e.target.value)} maxLength={350} placeholder="Sierra, Robbie, Grandpa Lázaro..." className="min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-base outline-none focus:border-cyan-300/70" />
              <span className="mt-1 block text-xs text-slate-500">Separate names with commas.</span>
            </label>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm font-bold text-slate-300">What should students see? *</span>
              <textarea value={sceneNotes} onChange={(e) => setSceneNotes(e.target.value)} maxLength={2200} rows={8} placeholder={"Chapter 1: Sierra paints the mural...\nChapter 2: At home, Grandpa warns her...\nChapter 3: At the party..."} className="w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-base leading-6 outline-none focus:border-cyan-300/70" />
            </label>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm font-bold text-slate-300">Look</span>
              <select value={style} onChange={(e) => setStyle(e.target.value)} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#151526] px-3 text-base outline-none focus:border-cyan-300/70">
                <option value="cinematic illustrated">Cinematic illustrated</option>
                <option value="graphic novel">Graphic novel</option>
                <option value="warm storybook">Warm storybook</option>
                <option value="semi-realistic classroom visual">Semi-realistic</option>
              </select>
            </label>

            <label className="mb-5 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3">
              <input type="checkbox" checked={labelCharacters} onChange={(e) => setLabelCharacters(e.target.checked)} className="h-5 w-5 accent-cyan-300" />
              <span className="text-sm font-bold text-slate-200">Put character name labels on the people</span>
            </label>

            <button type="submit" disabled={generating} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 px-4 text-base font-black text-white disabled:cursor-wait disabled:opacity-60">
              <ImageIcon size={20} /> {generating ? "Creating panorama..." : "Generate & save panorama"}
            </button>
            <p className="mb-0 mt-3 text-center text-xs leading-5 text-slate-500">A.R.I.S.E. requests one low-quality wide image per generation to minimize cost.</p>
          </form>

          <section className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-violet-300">Saved library</div>
                <h2 className="m-0 mt-1 text-2xl font-black">Your Scenes</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-bold text-slate-300">{scenes.length} saved</span>
            </div>

            {loading ? (
              <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center text-slate-400">Loading Scenes...</div>
            ) : scenes.length === 0 ? (
              <div className="mt-5 rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-10 text-center">
                <BookOpen className="mx-auto text-cyan-300" size={34} />
                <h3 className="mb-1 mt-4 text-xl font-black">No scenes yet</h3>
                <p className="m-0 text-slate-400">Create your first chapter panorama using the form.</p>
              </div>
            ) : (
              <>
                {selected && (
                  <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-black/20">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
                      <div>
                        <h3 className="m-0 text-lg font-black">{selected.bookTitle}</h3>
                        <p className="m-0 mt-1 text-sm text-slate-400">Chapters {selected.chapterStart}{selected.chapterEnd !== selected.chapterStart ? `–${selected.chapterEnd}` : ""}{selected.author ? ` • ${selected.author}` : ""}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => document.getElementById("scene-presenter")?.scrollIntoView({ behavior: "smooth", block: "center" })} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-300 px-4 font-black text-slate-950"><MonitorPlay size={18} /> Present</button>
                        <button type="button" aria-label="Delete scene" onClick={() => void removeScene(selected)} className="grid h-11 w-11 place-items-center rounded-xl border border-red-400/30 bg-red-500/10 text-red-200"><Trash2 size={18} /></button>
                      </div>
                    </div>
                    <div id="scene-presenter" className="overflow-x-auto overscroll-x-contain bg-black/50" style={{ WebkitOverflowScrolling: "touch", cursor: "grab" }}>
                      {selected.imageUrl ? (
                        <img src={selected.imageUrl} alt={`${selected.bookTitle}, chapters ${selected.chapterStart} through ${selected.chapterEnd} visual scene`} className="block h-auto min-w-[980px] max-w-none lg:min-w-full lg:w-full" />
                      ) : (
                        <div className="grid min-h-72 place-items-center text-slate-500">Scene image is unavailable.</div>
                      )}
                    </div>
                    <div className="border-t border-white/10 px-4 py-3 text-xs text-slate-400">Drag or scroll sideways on smaller screens to move through the panorama.</div>
                  </div>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {scenes.map((scene) => (
                    <button key={scene.id} type="button" onClick={() => setSelectedId(scene.id)} className={`overflow-hidden rounded-2xl border text-left transition ${selected?.id === scene.id ? "border-cyan-300/60 bg-cyan-300/10" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"}`}>
                      {scene.imageUrl && <img src={scene.imageUrl} alt="" className="aspect-[2/1] w-full object-cover" />}
                      <div className="p-3">
                        <div className="font-black">{scene.bookTitle}</div>
                        <div className="mt-1 text-sm text-slate-400">Ch. {scene.chapterStart}{scene.chapterEnd !== scene.chapterStart ? `–${scene.chapterEnd}` : ""}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
