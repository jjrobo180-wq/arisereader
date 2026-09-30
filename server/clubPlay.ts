import type { Express, RequestHandler } from 'express';
import { getAdminSupabase } from './supabase';
import { clubDay, clubWeek, updatePlayRecord, type PlayAccess, type PlayRecord } from '../shared/clubPlay';

const cached = new Map<number, { access: PlayAccess; until: number }>();
const entitlements = new Map<number, {
  passedThisWeek: number;
  locked: boolean;
  weeklyUnlimitedOnPass: boolean;
  unlimitedThisWeek: boolean;
  day: string;
  week: string;
  until: number;
}>();

async function allowance(userId: number, now: number) {
  const day = clubDay(now), week = clubWeek(now), hit = entitlements.get(userId);
  if (hit && hit.day === day && hit.week === week && hit.until > now) return hit;

  const db = getAdminSupabase();
  const since = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();
  const [attempts, control] = await Promise.all([
    db.from('attempts')
      .select('book_id,score,total,completed_at')
      .eq('user_id', userId)
      .gte('completed_at', since)
      .order('completed_at')
      .limit(1000),
    db.from('club_arise_controls')
      .select('locked,weekly_unlimited_on_pass')
      .eq('student_id', userId)
      .maybeSingle(),
  ]);

  if (attempts.error) throw attempts.error;
  if (control.error) throw control.error;

  const books = new Set<number>();
  for (const a of attempts.data || []) {
    const total = Number(a.total) || 0;
    const score = Number(a.score) || 0;
    const completedAt = Date.parse(a.completed_at);
    const passed = total > 0 && score >= Math.ceil(total * (total > 10 ? .7 : .6));
    if (passed && Number.isFinite(completedAt) && clubWeek(completedAt) === week) books.add(Number(a.book_id));
  }

  const weeklyUnlimitedOnPass = control.data?.weekly_unlimited_on_pass !== false;
  const result = {
    passedThisWeek: books.size,
    locked: !!control.data?.locked,
    weeklyUnlimitedOnPass,
    unlimitedThisWeek: weeklyUnlimitedOnPass && books.size > 0,
    day,
    week,
    until: now + 10_000,
  };
  entitlements.set(userId, result);
  return result;
}

async function playTime(userId: number, sessionId?: string, leaving = false) {
  const now = Date.now(), grant = await allowance(userId, now);
  const hit = cached.get(userId);

  if (!sessionId && hit && hit.until > now && hit.access.day === grant.day && hit.access.week === grant.week &&
      hit.access.locked === grant.locked && hit.access.unlimitedThisWeek === grant.unlimitedThisWeek &&
      hit.access.weeklyUnlimitedOnPass === grant.weeklyUnlimitedOnPass && hit.access.passedThisWeek === grant.passedThisWeek) {
    if (hit.access.unlimitedThisWeek) return { ...hit.access, serverNow: now, allowed: !grant.locked };
    const remainingMs = Math.max(0, hit.access.expiresAt - now);
    return { ...hit.access, remainingMs, serverNow: now, allowed: !grant.locked && remainingMs > 0 && hit.access.leaseUntil > now };
  }

  const db = getAdminSupabase(), key = `club_play_time_${userId}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await db.from('settings').select('value').eq('key', key).maybeSingle();
    if (error) throw error;

    let previous: PlayRecord | null = null;
    if (data?.value) previous = JSON.parse(data.value);

    const { record, access } = updatePlayRecord(
      previous,
      Date.now(),
      sessionId,
      leaving,
      grant.locked,
      grant.unlimitedThisWeek,
      grant.weeklyUnlimitedOnPass,
      grant.passedThisWeek,
    );

    if (sessionId) {
      const value = JSON.stringify(record);
      if (data) {
        const saved = await db.from('settings').update({ value }).eq('key', key).eq('value', data.value).select('key');
        if (saved.error) throw saved.error;
        if (!saved.data?.length) continue;
      } else {
        const saved = await db.from('settings').insert({ key, value });
        if (saved.error?.code === '23505') continue;
        if (saved.error) throw saved.error;
      }
    }

    cached.set(userId, { access, until: Date.now() + 2_000 });
    return access;
  }
  throw new Error('Play time is syncing. Please try again.');
}

export function registerClubPlayRoutes(app: Express, auth: RequestHandler) {
  const session = (req: any) => {
    const id = String(req.body?.sessionId || '');
    if (!/^[a-zA-Z0-9-]{16,64}$/.test(id)) throw new Error('Open Club Arise again to start your timer.');
    return id;
  };

  app.post('/api/club-play/heartbeat', auth, async (req: any, res) => {
    res.set('Cache-Control', 'no-store');
    if (req.user.role !== 'student' || req.user.isAdmin || req.user.is_eye_gaze_user) return res.status(403).json({ message: 'Club Arise is for regular student accounts.' });
    try { res.json(await playTime(Number(req.user.id), session(req))); }
    catch (error) { console.error('[club-play]', error); res.status(503).json({ message: 'Could not sync your play timer. Please try again.' }); }
  });

  app.post('/api/club-play/leave', auth, async (req: any, res) => {
    try { await playTime(Number(req.user.id), session(req), true); res.json({ ok: true }); }
    catch { res.status(503).json({ message: 'Could not save your play time.' }); }
  });

  const guard: RequestHandler = async (req: any, res, next) => {
    if (/\/leave$/.test(req.path)) return next();
    if (req.user.isAdmin || req.user.role === 'teacher') return next();
    if (req.user.role !== 'student' || req.user.is_eye_gaze_user) return res.status(403).json({ message: 'Use a regular student account.' });

    try {
      const access = await playTime(Number(req.user.id));
      if (!access.allowed) {
        return res.status(403).json({
          message: access.locked
            ? 'Club Arise is locked by your teacher.'
            : access.weeklyUnlimitedOnPass
              ? 'Your daily Club A.R.I.S.E. time is up. Pass a book quiz to unlock unlimited play for the rest of this week.'
              : 'Your daily Club A.R.I.S.E. time is up.',
          playAccess: access,
        });
      }
      next();
    } catch {
      res.status(503).json({ message: 'Could not verify your play time. Please reopen Club Arise.' });
    }
  };

  app.use(['/api/club-arise', '/api/club-theater', '/api/neighborhood', '/api/board-quest'], auth, guard);
}
