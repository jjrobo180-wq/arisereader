import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { BoardQuestGame } from '../server/boardQuestEngine';
import { parseTheaterSource, normalizeTheaterMovies, playableTheaterMovies, theaterMediaKey, theaterEmbedUrl } from '../shared/clubTheater';
import { createTheaterCatalogStore, registerTheaterAdminRoutes } from '../server/theaterCatalog';
import { DEFAULT_THEATER_MOVIES } from '../shared/theaterDefaults';
import type { Player } from '../shared/boardQuest';
const human = (id: number): Player => ({ id, name: 'Reader ' + id, characterId: 'alice', team: 'blue', bot: false, space: 0, strikes: 0, shield: 0, power: 0, out: false });
function room() { const game = new BoardQuestGame('123456', human(10), 'K-2'); game.add(human(20)); game.start(10, 1000); return game; }

test('skipping one tutorial never advances another connected reader or starts the competition', () => {
  const game = room(); game.tutorialFinish(10, game.view.tutorialId, 'skipped', 2000);
  game.touch(10, 180000); game.touch(20, 180000); game.tick(180000);
  assert.equal(game.view.phase, 'tutorial'); assert.equal(game.view.question, null); assert.equal(game.view.openingDeadline, 0);
  assert.equal(game.view.tutorialReady.includes(20), false);
  game.tutorialFinish(20, game.view.tutorialId, 'finished', 180001);
  assert.equal(game.view.phase, 'intro'); assert.equal(game.view.phaseAt, 180001);
  assert.deepEqual(game.snapshot(180002), game.snapshot(180002));
  game.tutorialFinish(10, game.view.tutorialId, 'finished', 180003);
  assert.equal(game.view.tutorialResults[10], 'skipped');
});
test('only a player can mark themselves ready; bots and disconnected players do not block the tutorial', () => {
  const game = room(); assert.throws(() => game.tutorialFinish(99, game.view.tutorialId, 'skipped', 2000));
  assert.throws(() => game.tutorialFinish(10, game.view.tutorialId - 1, 'skipped', 2000));
  assert.throws(() => game.answer(10, 0, 1, 2000));
  game.tutorialFinish(10, game.view.tutorialId, 'skipped', 2000); game.touch(10, 47001); game.tick(47001);
  assert.equal(game.view.players.find(player => player.id === 20)?.bot, true); assert.equal(game.view.phase, 'intro');
});
test('leaving during a tutorial releases the other ready readers on the next room update', () => {
  const game = room(); game.tutorialFinish(10, game.view.tutorialId, 'finished', 2000); game.leave(20); game.tick(2001);
  assert.equal(game.view.phase, 'intro');
  game.view.phase = 'finished'; const oldId = game.view.tutorialId; game.start(10, 3000);
  assert.equal(game.view.phase, 'tutorial'); assert.equal(game.view.tutorialReady.includes(10), false);
  assert.throws(() => game.tutorialFinish(10, oldId, 'skipped', 3001));
  game.tutorialFinish(10, game.view.tutorialId, 'skipped', 3001); assert.equal(game.view.phase, 'intro');
});
test('pasted video links normalize without accepting deceptive hosts, credentials, scripts, or arbitrary pages', () => {
  for (const link of ['https://youtu.be/vq9TWtT6Uwg?t=5', 'https://m.youtube.com/watch?v=vq9TWtT6Uwg', 'https://www.youtube.com/shorts/vq9TWtT6Uwg', 'https://www.youtube.com/live/vq9TWtT6Uwg', 'https://www.youtube-nocookie.com/embed/vq9TWtT6Uwg']) assert.equal(parseTheaterSource(link).youtubeId, 'vq9TWtT6Uwg');
  assert.equal(parseTheaterSource('https://www.youtube.com/playlist?list=UU_l_vAU56D8Sa4WCEZtWIi1w').kind, 'channel');
  assert.equal(parseTheaterSource('https://media.example.com/show.mp4?token=abc').provider, 'video');
  assert.equal(parseTheaterSource('https://www.netflix.com/watch/1234').provider, 'external');
  for (const link of ['javascript:alert(1)', 'http://example.com/show.mp4', 'https://youtube.com.bad.test/watch?v=vq9TWtT6Uwg', 'https://username:password@www.youtube.com/watch?v=vq9TWtT6Uwg', 'https://www.youtube.com/@channel', 'https://example.com/embed/show', 'https://www.netflix.com.bad.test/watch/1']) assert.throws(() => parseTheaterSource(link));
});
test('titles persist, external services stay out of the shared screen, and the last playable show cannot be disabled', () => {
  const movies = normalizeTheaterMovies([{ ...DEFAULT_THEATER_MOVIES[0], title: 'My renamed movie' }, { ...DEFAULT_THEATER_MOVIES[1], sourceUrl: 'https://www.disneyplus.com/video/123' }]);
  assert.equal(movies[0].title, 'My renamed movie'); assert.equal(playableTheaterMovies(movies).length, 1);
  assert.throws(() => normalizeTheaterMovies(movies.map(movie => ({ ...movie, enabled: false }))));
  assert.throws(() => normalizeTheaterMovies([{ ...movies[0], title: '' }]));
  assert.throws(() => normalizeTheaterMovies([movies[0], movies[0]]));
  assert.equal(theaterMediaKey(movies[0]), theaterMediaKey({ ...movies[0], title: 'New title' }));
  assert.notEqual(theaterMediaKey(movies[0]), theaterMediaKey({ ...movies[0], youtubeId: 'ixbkzsNCgV8' }));
  assert.equal(new URL(theaterEmbedUrl(movies[0], 42)).searchParams.get('start'), '42');
});
test('catalog saves survive a new store and stale admin edits cannot overwrite newer changes', async () => {
  const settings = new Map<string, string>(); const storage = { getSetting: async (key: string) => settings.get(key), upsertSetting: async (key: string, value: string) => { settings.set(key, value); } };
  const catalog = createTheaterCatalogStore(storage); const current = await catalog.get();
  current.movies[0].title = 'Edited title'; const saved = await catalog.save(current.movies, 0);
  assert.equal(saved.revision, 1); assert.equal((await createTheaterCatalogStore(storage).get()).movies[0].title, 'Edited title');
  await assert.rejects(catalog.save(current.movies, 0), /another window/);
});
test('HTTP catalogue endpoints enforce admin access and reject unavailable provider playback', async () => {
  const settings = new Map<string, string>(); const catalog = createTheaterCatalogStore({ getSetting: async key => settings.get(key), upsertSetting: async (key, value) => { settings.set(key, value); } });
  const app = express(); app.use(express.json()); let playing = '';
  registerTheaterAdminRoutes(app, (req, res, next) => req.headers.authorization ? next() : res.sendStatus(401), (req, res, next) => req.headers.authorization === 'admin' ? next() : res.sendStatus(403), catalog, async id => { playing = id; });
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/admin/theater-catalog`;
  try {
    for (const [authorization, status] of [['', 401], ['student', 403], ['teacher', 403]]) { const response = await fetch(base, { headers: { Authorization: authorization } }); assert.equal(response.status, status); }
    const response = await fetch(base, { headers: { Authorization: 'admin' } }); const data = await response.json(); assert.equal(data.movies.length, 10);
    data.movies[0].title = 'Admin movie'; const saved = await fetch(base, { method: 'PUT', headers: { Authorization: 'admin', 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); assert.equal(saved.status, 200);
    const play = await fetch(base + '/play', { method: 'POST', headers: { Authorization: 'admin', 'Content-Type': 'application/json' }, body: JSON.stringify({ movieId: data.movies[0].id }) }); assert.equal(play.status, 200); assert.equal(playing, data.movies[0].id);
    const invalid = await fetch(base + '/play', { method: 'POST', headers: { Authorization: 'admin', 'Content-Type': 'application/json' }, body: JSON.stringify({ movieId: 'not-in-guide' }) }); assert.equal(invalid.status, 400);
  } finally { server.close(); server.closeAllConnections(); }
});
