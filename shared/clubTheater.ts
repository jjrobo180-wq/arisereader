export type TheaterSource = {
  provider: 'youtube' | 'video' | 'external';
  sourceUrl: string;
  youtubeId: string;
  youtubePlaylistId: string;
  videoUrl: string;
  kind: 'video' | 'channel';
};
export type TheaterMovie = TheaterSource & {
  id: string; title: string; subtitle: string; duration: number;
  license: string; attribution: string; age: string; category: string; enabled: boolean;
};
export type TheaterCatalog = { revision: number; movies: TheaterMovie[] };
export const THEATER_SERVICES = [
  { name: 'YouTube', url: 'https://www.youtube.com/' },
  { name: 'Netflix', url: 'https://www.netflix.com/login' },
  { name: 'Disney+', url: 'https://www.disneyplus.com/' },
  { name: 'Prime Video', url: 'https://www.primevideo.com/' },
  { name: 'Hulu', url: 'https://www.hulu.com/' },
];
const hostMatches = (host: string, domain: string) => host === domain || host.endsWith('.' + domain);

export function parseTheaterSource(value: unknown): TheaterSource {
  if (typeof value !== 'string' || value.length > 2048) throw Error('Paste a video link.');
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw Error('Paste a complete HTTPS video link.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('Use an HTTPS link without a username or password.');
  const host = url.hostname.toLowerCase();
  const base = { sourceUrl: url.href, youtubeId: '', youtubePlaylistId: '', videoUrl: '', kind: 'video' as const };
  if (hostMatches(host, 'youtube.com') || hostMatches(host, 'youtube-nocookie.com') || host === 'youtu.be') {
    const parts = url.pathname.split('/').filter(Boolean);
    const id = host === 'youtu.be' ? parts[0] : url.searchParams.get('v') || (['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : '');
    const playlist = url.searchParams.get('list') || '';
    if (id && /^[\w-]{11}$/.test(id)) return { ...base, provider: 'youtube', youtubeId: id, sourceUrl: `https://www.youtube.com/watch?v=${id}` };
    if (playlist && /^[\w-]{10,150}$/.test(playlist)) return { ...base, provider: 'youtube', youtubePlaylistId: playlist, kind: 'channel', sourceUrl: `https://www.youtube.com/playlist?list=${playlist}` };
    throw Error('Use a YouTube video, Shorts, live video, or playlist link. Channel and show landing pages need a specific video or playlist.');
  }
  if (['netflix.com', 'disneyplus.com', 'primevideo.com', 'hulu.com', 'max.com', 'hbomax.com', 'peacocktv.com', 'paramountplus.com'].some(domain => hostMatches(host, domain))) {
    return { ...base, provider: 'external' };
  }
  if (/\.(mp4|webm|ogv)$/i.test(url.pathname)) return { ...base, provider: 'video', videoUrl: url.href };
  throw Error('Use a YouTube link, a direct MP4/WebM/OGV video link, or a supported streaming-service link.');
}

export function normalizeTheaterMovies(value: unknown): TheaterMovie[] {
  if (!Array.isArray(value) || !value.length || value.length > 100) throw Error('Keep between 1 and 100 shows in your guide.');
  const ids = new Set<string>();
  const movies = value.map((entry: any, index) => {
    if (!entry || typeof entry !== 'object') throw Error(`Show ${index + 1} is incomplete.`);
    const id = typeof entry.id === 'string' ? entry.id : '';
    if (!/^[\w-]{1,80}$/.test(id) || ids.has(id)) throw Error('Each show needs a unique ID.');
    ids.add(id);
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    if (!title || title.length > 100) throw Error(`Show ${index + 1} needs a title of 1–100 characters.`);
    const source = parseTheaterSource(entry.sourceUrl);
    const subtitle = typeof entry.subtitle === 'string' ? entry.subtitle.trim().slice(0, 240) : '';
    const category = typeof entry.category === 'string' ? entry.category.trim().slice(0, 50) : 'Featured';
    const duration = entry.duration === undefined ? 7200 : Number(entry.duration);
    if (!Number.isFinite(duration) || duration < 30 || duration > 86400) throw Error(`${title}: duration must be between 30 seconds and 24 hours.`);
    return { ...source, id, title, subtitle, category: category || 'Featured', duration: Math.round(duration),
      enabled: entry.enabled !== false, age: 'Admin selected', attribution: 'Admin selected',
      license: source.provider === 'youtube' ? 'YouTube embed' : source.provider === 'video' ? 'Linked video' : 'Opens on provider website' };
  });
  if (!movies.some(movie => movie.enabled && movie.provider !== 'external')) throw Error('Keep at least one YouTube or direct video enabled for the theatre screen.');
  return movies;
}

export const playableTheaterMovies = (movies: TheaterMovie[]) => movies.filter(movie => movie.enabled && movie.provider !== 'external');
export const theaterMediaKey = (movie?: TheaterMovie) => movie ? `${movie.id}:${movie.provider}:${movie.youtubeId}:${movie.youtubePlaylistId}:${movie.videoUrl}` : '';
export function theaterEmbedUrl(movie: TheaterMovie, start = 0) {
  if (movie.provider !== 'youtube') return '';
  const url = new URL(movie.youtubePlaylistId ? 'https://www.youtube-nocookie.com/embed/videoseries' : `https://www.youtube-nocookie.com/embed/${movie.youtubeId}`);
  url.search = new URLSearchParams({ autoplay: '1', mute: '0', playsinline: '1', controls: '1', rel: '0', enablejsapi: '1', ...(movie.youtubePlaylistId ? { list: movie.youtubePlaylistId, loop: '1' } : { start: String(Math.max(0, Math.floor(start))) }) }).toString();
  return url.href;
}
