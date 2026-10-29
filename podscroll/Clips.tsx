// Pod+ Clips (#/clips, in the menu): TikTok videos in a swipe row that play inside Pod+ through
// TikTok's official embed player (developers.tiktok.com/docs/en/embed-player). Nothing opens TikTok.
// The clip in view plays; the rest pause. One shared list, set by the site owner, that everyone sees
// (server/podcastClips.ts); the owner edits it right here when signed in.
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Loader2, Volume2, VolumeX } from "lucide-react";
import { clipItems, isCreatorItem } from "@shared/podClips";

type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
const link = (x: string) => (isCreatorItem(x) ? x : `https://www.tiktok.com/video/${x}`);

const send = (f: HTMLIFrameElement | null, type: string, value?: unknown) => {
  try { f?.contentWindow?.postMessage({ "x-tiktok-player": true, type, ...(value !== undefined ? { value } : {}) }, "https://www.tiktok.com"); } catch { /* player not ready */ }
};

export function Clips({ api, say, onBack, onSignIn }: { api: Api; say: (m: string) => void; onBack: () => void; onSignIn: () => void }) {
  const [ids, setIds] = useState<string[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);
  const [sound, setSound] = useState(false);
  const [active, setActive] = useState(0);
  const list = ids ?? [];
  useEffect(() => {
    api("/api/podscroll/clips").then((b) => { setIds(clipItems(b?.clips)); setCanEdit(!!b?.canEdit); }).catch((e) => { setIds([]); setErr(e.message); });
  }, [api]);
  // @people show as TikTok's official profile embed (their latest videos, playing on screen).
  // embed.js turns the placeholders into players when it loads, so it's loaded again when they change.
  const creators = list.filter(isCreatorItem).join(",");
  useEffect(() => {
    if (!creators) return;
    document.querySelectorAll("script[data-ps-tiktok]").forEach((x) => x.remove());
    const sc = document.createElement("script");
    sc.src = "https://www.tiktok.com/embed.js"; sc.async = true; sc.dataset.psTiktok = "1";
    document.body.appendChild(sc);
  }, [creators]);
  const frames = useRef<(HTMLIFrameElement | null)[]>([]);
  const slides = useRef<(HTMLDivElement | null)[]>([]);

  // The clip that's mostly in view is the one playing.
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting && e.intersectionRatio > 0.6) setActive(Number((e.target as HTMLElement).dataset.i));
    }, { threshold: [0.6] });
    slides.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [list.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    frames.current.forEach((f, i) => { if (i === active) { send(f, "play"); send(f, sound ? "unMute" : "mute"); } else send(f, "pause"); });
  }, [active, sound]);
  // When a player says it's ready, start it if it's the one in view.
  useEffect(() => {
    const on = (ev: MessageEvent) => {
      if (ev.origin !== "https://www.tiktok.com" || !ev.data?.["x-tiktok-player"]) return;
      const i = frames.current.findIndex((f) => f?.contentWindow === ev.source);
      if (ev.data.type === "onPlayerReady" && i === active) { send(frames.current[i], "play"); send(frames.current[i], sound ? "unMute" : "mute"); }
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [active, sound]);

  const openEditor = () => { if (editing) { setEditing(false); return; } setDraft(list.map(link).join("\n")); setEditing(true); };
  const save = () => {
    setSaving(true); setErr("");
    api("/api/podscroll/clips", { method: "POST", body: { clips: draft } })
      .then((b) => { setIds(clipItems(b?.clips)); setEditing(false); say("Clips saved. Everyone sees them now."); })
      .catch((e) => { setErr(e.message); if (e.needSignIn) onSignIn(); })
      .finally(() => setSaving(false));
  };

  return <section aria-label="Clips" className="pt-3 pb-10">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <button onClick={onBack} className="-ml-2 inline-flex h-9 items-center gap-1 rounded-full pl-1 pr-3 text-sm font-medium hover:bg-[#f2f2f2]"><ChevronLeft size={20} />Home</button>
      <div className="flex items-center gap-2">
        <button onClick={() => setSound((v) => !v)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#f2f2f2] px-3 text-sm font-semibold">{sound ? <Volume2 size={16} /> : <VolumeX size={16} />}{sound ? "Sound on" : "Tap for sound"}</button>
        {canEdit && <button onClick={openEditor} className="h-9 rounded-full bg-[#0f0f0f] px-3 text-sm font-semibold text-white">{editing ? "Cancel" : "Edit clips"}</button>}
      </div>
    </div>
    <h1 className="text-2xl font-bold tracking-tight">Clips</h1>
    <p className="mt-1 text-sm text-[#606060]">Short videos, right here in Pod+. Scroll: the clip in view plays, the rest pause.</p>
    {editing && <div className="mt-3">
      <label htmlFor="ps-clip-links" className="text-sm font-semibold">Video links or @usernames, one per line</label>
      <textarea id="ps-clip-links" value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} placeholder={"@someone\n@someone_else\nhttps://www.tiktok.com/@someone/video/7123456789012345678"} className="mt-1.5 w-full rounded-xl border border-[#d3d3d3] p-3 font-mono text-xs outline-none focus:border-[#1c62b9]" />
      <p className="mt-1 text-xs text-[#767676]">Type @username for that person&apos;s latest videos, or paste any video link (Share, Copy link) to add exactly that one. Up to 500. Short links (vm.tiktok.com) need opening first to get the full one. Everyone sees this list.</p>
      <button onClick={save} disabled={saving} className="mt-2 inline-flex h-10 items-center gap-2 rounded-full bg-[#0f0f0f] px-4 text-sm font-semibold text-white disabled:opacity-50">{saving && <Loader2 size={16} className="animate-spin" />}Save for everyone</button>
    </div>}
    {err && <p role="alert" className="mt-2 text-sm text-[#c00]">{err}</p>}
    <div className="mt-4 h-[min(78dvh,760px)] snap-y snap-mandatory overflow-y-auto rounded-2xl bg-[#0f0f0f] [scrollbar-width:none]">
      {ids === null ? <div className="flex h-full items-center justify-center"><Loader2 size={24} className="animate-spin text-white/60" /></div>
        : list.length ? list.map((id, i) => <div key={id} ref={(el) => { slides.current[i] = el; }} data-i={i} className="flex h-full snap-start snap-always items-center justify-center p-2">
        {isCreatorItem(id) ? <div className="h-full w-full overflow-y-auto rounded-xl bg-white">
          <blockquote className="tiktok-embed" cite={`https://www.tiktok.com/${id}`} data-unique-id={id.slice(1)} data-embed-type="creator" style={{ maxWidth: 720, minWidth: 288, margin: 0 }}>
            <section><a target="_blank" rel="noreferrer" href={`https://www.tiktok.com/${id}?refer=creator_embed`}>{id}</a></section>
          </blockquote>
        </div>
        : <iframe ref={(el) => { frames.current[i] = el; }} title={`Clip ${i + 1}`} loading={Math.abs(i - active) <= 1 ? "eager" : "lazy"}
          src={`https://www.tiktok.com/player/v1/${id}?autoplay=${i === 0 ? 1 : 0}&loop=1&rel=0&music_info=0&description=0&closed_caption=1&muted=0`}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen
          className="aspect-[9/16] h-full max-h-full w-auto max-w-full rounded-xl border-0 bg-black" />}
      </div>)
        : <p className="p-10 text-center text-sm text-[#bdbdbd]">{canEdit ? "Tap “Edit clips” and paste some TikTok links." : "No clips yet. Check back soon."}</p>}
    </div>
  </section>;
}
