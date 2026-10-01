import type { Express, RequestHandler } from 'express';
import { normalizeTheaterMovies, playableTheaterMovies, type TheaterCatalog, type TheaterMovie } from '../shared/clubTheater';
import { DEFAULT_THEATER_MOVIES } from '../shared/theaterDefaults';

type SettingsStore = { getSetting(key: string): Promise<string | null | undefined>; upsertSetting(key: string, value: string): Promise<unknown> };
export function createTheaterCatalogStore(storage: SettingsStore) {
  let writing = false;
  const get = async (): Promise<TheaterCatalog> => {
    const raw = await storage.getSetting('club_theater_catalog');
    if (!raw) return { revision: 0, movies: structuredClone(DEFAULT_THEATER_MOVIES) };
    const parsed = JSON.parse(raw);
    return { revision: Number(parsed.revision) || 0, movies: normalizeTheaterMovies(parsed.movies) };
  };
  const save = async (value: unknown, revision: unknown) => {
    const movies = normalizeTheaterMovies(value);
    if (writing) throw Object.assign(Error('Another save is in progress. Try again.'), { status: 409 });
    writing = true;
    try {
      const current = await get();
      if (revision !== current.revision) throw Object.assign(Error('The guide changed in another window. Reload it before saving.'), { status: 409 });
      const catalog = { revision: current.revision + 1, movies };
      await storage.upsertSetting('club_theater_catalog', JSON.stringify(catalog));
      return catalog;
    } finally { writing = false; }
  };
  return { get, save, playable: async (): Promise<TheaterMovie[]> => playableTheaterMovies((await get()).movies) };
}

export function registerTheaterAdminRoutes(app: Express, auth: RequestHandler, admin: RequestHandler, catalog: ReturnType<typeof createTheaterCatalogStore>, play: (id: string) => Promise<void>) {
  app.get('/api/admin/theater-catalog', auth, admin, async (_req, res) => {
    try { res.set('Cache-Control', 'no-store').json(await catalog.get()); }
    catch (error) { console.error('[theater-catalog] load', error); res.status(500).json({ message: 'Could not load the theatre guide.' }); }
  });
  app.put('/api/admin/theater-catalog', auth, admin, async (req, res) => {
    try { res.set('Cache-Control', 'no-store').json(await catalog.save(req.body?.movies, req.body?.revision)); }
    catch (error: any) { res.status(error.status || 400).json({ message: error.message || 'Could not save the theatre guide.' }); }
  });
  app.post('/api/admin/theater-catalog/play', auth, admin, async (req, res) => {
    try {
      const movies = await catalog.playable();
      if (!movies.some(movie => movie.id === req.body?.movieId)) return res.status(400).json({ message: 'Choose an enabled YouTube or direct video.' });
      await play(req.body.movieId);
      res.json({ ok: true });
    } catch (error) { console.error('[theater-catalog] play', error); res.status(500).json({ message: 'Could not start that show.' }); }
  });
}
