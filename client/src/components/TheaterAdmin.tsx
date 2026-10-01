import { useEffect, useState } from 'react';
import { Clapperboard, ExternalLink, Plus, Save, Trash2, Play, ChevronUp, ChevronDown } from 'lucide-react';
import { API_BASE } from '@/lib/queryClient';
import { parseTheaterSource, THEATER_SERVICES, type TheaterCatalog, type TheaterMovie } from '@shared/clubTheater';

export default function TheaterAdmin({ token }: { token: string | null }) {
  const [open, setOpen] = useState(false), [catalog, setCatalog] = useState<TheaterCatalog | null>(null);
  const [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  async function load() {
    setBusy(true); setError('');
    try {
      const response = await fetch(`${API_BASE}/api/admin/theater-catalog`, { headers, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw Error(data.message || 'Could not load the guide.');
      setCatalog(data); setDirty(false);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { if (open && token && !catalog) void load(); }, [open, token]);
  function edit(id: string, changes: Partial<TheaterMovie>) {
    setCatalog(previous => previous ? { ...previous, movies: previous.movies.map(movie => movie.id === id ? { ...movie, ...changes } : movie) } : previous);
    setDirty(true); setMessage(''); setError('');
  }
  function move(index: number, delta: number) {
    if (!catalog) return;
    const movies = [...catalog.movies]; [movies[index], movies[index + delta]] = [movies[index + delta], movies[index]];
    setCatalog({ ...catalog, movies }); setDirty(true); setMessage('');
  }
  async function save() {
    if (!catalog) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`${API_BASE}/api/admin/theater-catalog`, { method: 'PUT', headers, body: JSON.stringify(catalog) });
      const data = await response.json();
      if (!response.ok) throw Error(data.message || 'Could not save the guide.');
      setCatalog(data); setDirty(false); setMessage('Saved. The theatre guide updates for everyone.');
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function remove(movieId: string, title: string) {
    if (!catalog) return;
    const previous = catalog;
    const next = { ...catalog, movies: catalog.movies.filter(movie => movie.id !== movieId) };
    setPendingDeleteId(null); setBusy(true); setError(''); setMessage('Removing show…');
    try {
      const response = await fetch(`${API_BASE}/api/admin/theater-catalog`, { method: 'PUT', headers, body: JSON.stringify(next) });
      const data = await response.json();
      if (!response.ok) throw Error(data.message || 'Could not remove the show.');
      setCatalog(data); setDirty(false); setMessage(`Removed “${title || 'show'}” and saved the theatre guide.`);
    } catch (e: any) {
      setCatalog(previous); setMessage(''); setError(e.message || 'Could not remove the show. Nothing was deleted.');
    } finally { setBusy(false); }
  }
  async function play(movieId: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`${API_BASE}/api/admin/theater-catalog/play`, { method: 'POST', headers, body: JSON.stringify({ movieId }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.message || 'Could not start the show.');
      setMessage('This show is now on the theatre screen for everyone.');
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  const inputClass = 'mt-1 min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-base text-foreground';
  return <section className="min-w-0 rounded-2xl border border-cyan-400/30 bg-card shadow-md" id="cinema-manager">
    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="flex min-h-16 w-full items-center gap-3 p-4 text-left sm:p-5">
      <Clapperboard className="h-6 w-6 shrink-0 text-cyan-400" />
      <span className="min-w-0 flex-1"><span className="block text-lg font-black">Cinema Manager</span><span className="block text-sm text-muted-foreground">Edit video links, show titles, and the theatre guide.</span></span>
      {open ? <ChevronUp /> : <ChevronDown />}
    </button>
    {open && <div className="space-y-5 border-t border-border p-4 sm:p-5">
      <div className="rounded-xl border border-border bg-background p-4">
        <h3 className="font-bold">Your streaming accounts</h3>
        <p className="mt-1 text-sm text-muted-foreground">Sign in on the provider’s website in a separate tab. Netflix, Disney+, and other subscription services play there. Their account login does not connect playback to the shared theatre screen.</p>
        <div className="mt-3 flex flex-wrap gap-2">{THEATER_SERVICES.map(service => <a key={service.name} href={service.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-bold hover:bg-accent">Sign in to {service.name}<ExternalLink size={15} /></a>)}</div>
      </div>
      <p className="text-sm text-muted-foreground">Paste a YouTube video or playlist, or a direct MP4/WebM/OGV video link. Edit the title students see. Subscription links are saved here for you and open on the provider’s website.</p>
      {!catalog && <button disabled={busy} onClick={() => void load()} className="min-h-11 rounded-xl border border-border px-4 font-bold">{busy ? 'Loading guide…' : 'Reload guide'}</button>}
      {catalog && <>
        <div className="space-y-4">{catalog.movies.map((movie, index) => {
          let source: ReturnType<typeof parseTheaterSource> | null = null;
          try { source = parseTheaterSource(movie.sourceUrl); } catch {}
          return <article key={movie.id} className="min-w-0 rounded-xl border border-border bg-background p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="mr-auto text-sm font-bold text-cyan-500">{index + 1}. {source?.provider === 'external' ? 'Provider link · Admin only' : source?.provider === 'video' ? 'Direct video' : 'YouTube'}</span>
              <button disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${movie.title} up`} className="grid h-11 w-11 place-items-center rounded-lg border border-border disabled:opacity-40"><ChevronUp size={18} /></button>
              <button disabled={busy || index === catalog.movies.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${movie.title} down`} className="grid h-11 w-11 place-items-center rounded-lg border border-border disabled:opacity-40"><ChevronDown size={18} /></button>
              {pendingDeleteId === movie.id ? <>
                <button disabled={busy} onClick={() => void remove(movie.id, movie.title)} className="min-h-11 rounded-lg border border-red-500 bg-red-500 px-3 text-sm font-black text-white">Delete now</button>
                <button disabled={busy} onClick={() => setPendingDeleteId(null)} className="min-h-11 rounded-lg border border-border px-3 text-sm font-bold">Cancel</button>
              </> : <button disabled={busy} onClick={() => { setPendingDeleteId(movie.id); setMessage(''); setError(''); }} aria-label={`Remove ${movie.title}`} className="grid h-11 w-11 place-items-center rounded-lg border border-red-500/30 text-red-500"><Trash2 size={18} /></button>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold">Show or movie title<input disabled={busy} value={movie.title} maxLength={100} onChange={event => edit(movie.id, { title: event.target.value })} className={inputClass} /></label>
              <label className="text-sm font-bold">Category<input disabled={busy} value={movie.category} maxLength={50} list="cinema-categories" onChange={event => edit(movie.id, { category: event.target.value })} className={inputClass} /></label>
              <label className="text-sm font-bold sm:col-span-2">Video link<input disabled={busy} type="url" value={movie.sourceUrl} placeholder="https://www.youtube.com/watch?v=…" onChange={event => edit(movie.id, { sourceUrl: event.target.value })} className={inputClass} /></label>
              <label className="text-sm font-bold">Short description<input disabled={busy} value={movie.subtitle} maxLength={240} onChange={event => edit(movie.id, { subtitle: event.target.value })} className={inputClass} /></label>
              <label className="text-sm font-bold">Run time in minutes<input disabled={busy} type="number" min={0.5} max={1440} step={0.5} value={movie.duration / 60} onChange={event => edit(movie.id, { duration: Number(event.target.value) * 60 })} className={inputClass} /></label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {source?.provider !== 'external' && <label className="inline-flex min-h-11 items-center gap-2 text-sm font-bold"><input disabled={busy} type="checkbox" checked={movie.enabled} onChange={event => edit(movie.id, { enabled: event.target.checked })} />Show in student TV guide</label>}
              {source && <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-bold">{source.provider === 'external' ? 'Open on provider website' : 'Preview video'}<ExternalLink size={15} /></a>}
              {source && source.provider !== 'external' && <button disabled={busy || dirty || !movie.enabled} onClick={() => void play(movie.id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-400 px-3 text-sm font-bold text-slate-950 disabled:opacity-40"><Play size={15} />Play in theatre now</button>}
            </div>
          </article>;
        })}</div>
        <datalist id="cinema-categories"><option value="Featured" /><option value="Series & Shows" /><option value="Live" /><option value="Movies" /></datalist>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy || catalog.movies.length >= 100} onClick={() => { setCatalog({ ...catalog, movies: [...catalog.movies, { id: 'cinema-' + crypto.randomUUID(), title: '', subtitle: '', category: 'Featured', sourceUrl: '', provider: 'youtube', youtubeId: '', youtubePlaylistId: '', videoUrl: '', kind: 'video', duration: 7200, enabled: true, license: '', attribution: '', age: '' }] }); setDirty(true); setMessage(''); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 font-bold"><Plus size={18} />Add show or movie</button>
          <button disabled={busy || !dirty} onClick={() => void save()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-400 px-4 font-bold text-slate-950 disabled:opacity-40"><Save size={18} />{busy ? 'Saving…' : 'Save theatre guide'}</button>
          <button disabled={busy} onClick={() => { if (!dirty || window.confirm('Reload the saved guide and discard your unsaved edits?')) void load(); }} className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold">Reload saved guide</button>
        </div>
        {dirty && <p className="text-sm text-amber-500">You have unsaved edits. Save before playing a show.</p>}
      </>}
      {message && <p role="status" className="text-sm font-bold text-cyan-500">{message}</p>}
      {error && <p role="alert" className="text-sm font-bold text-red-500">{error}</p>}
    </div>}
  </section>;
}
