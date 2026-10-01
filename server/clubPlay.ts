import type { Express, RequestHandler } from 'express';
import { getAdminSupabase } from './supabase';
import { clubDay, clubWeek, updatePlayRecord, type PlayAccess, type PlayRecord } from '../shared/clubPlay';

const cached = new Map<number, { access: PlayAccess; until: number }>();
type ClubClosingHours = { enabled: boolean; start: string; end: string; days: number[]; timeZone: string };
let closingCache: { value: ClubClosingHours; until: number } | null = null;
const teacherClosingCache = new Map<number, { value: ClubClosingHours; until: number }>();

const DEFAULT_CLOSING_HOURS: ClubClosingHours = {
  enabled: false,
  start: "21:00",
  end: "07:00",
  days: [0,1,2,3,4,5,6],
  timeZone: "America/Denver",
};

async function getClosingHours(): Promise<ClubClosingHours> {
  const now = Date.now();
  if (closingCache && closingCache.until > now) return closingCache.value;
  const db = getAdminSupabase();
  const { data, error } = await db.from("settings").select("value").eq("key", "club_closing_hours").maybeSingle();
  if (error) throw error;
  let value = { ...DEFAULT_CLOSING_HOURS };
  if (data?.value) {
    try {
      const parsed = JSON.parse(data.value);
      value = {
        enabled: parsed?.enabled === true,
        start: /^\d{2}:\d{2}$/.test(String(parsed?.start || "")) ? String(parsed.start) : DEFAULT_CLOSING_HOURS.start,
        end: /^\d{2}:\d{2}$/.test(String(parsed?.end || "")) ? String(parsed.end) : DEFAULT_CLOSING_HOURS.end,
        days: Array.isArray(parsed?.days) ? parsed.days.map(Number).filter((d:number)=>Number.isInteger(d)&&d>=0&&d<=6) : DEFAULT_CLOSING_HOURS.days,
        timeZone: "America/Denver",
      };
    } catch {}
  }
  closingCache = { value, until: now + 5_000 };
  return value;
}

async function getTeacherClosingHours(teacherId: number): Promise<ClubClosingHours> {
  const now = Date.now();
  const hit = teacherClosingCache.get(teacherId);
  if (hit && hit.until > now) return hit.value;
  const db = getAdminSupabase();
  const { data, error } = await db.from("settings").select("value").eq("key", `club_closing_hours_teacher_${teacherId}`).maybeSingle();
  if (error) throw error;
  let value = { ...DEFAULT_CLOSING_HOURS, enabled: false };
  if (data?.value) {
    try {
      const parsed = JSON.parse(data.value);
      value = {
        enabled: parsed?.enabled === true,
        start: /^\d{2}:\d{2}$/.test(String(parsed?.start || "")) ? String(parsed.start) : DEFAULT_CLOSING_HOURS.start,
        end: /^\d{2}:\d{2}$/.test(String(parsed?.end || "")) ? String(parsed.end) : DEFAULT_CLOSING_HOURS.end,
        days: Array.isArray(parsed?.days) ? parsed.days.map(Number).filter((d:number)=>Number.isInteger(d)&&d>=0&&d<=6) : DEFAULT_CLOSING_HOURS.days,
        timeZone: "America/Denver",
      };
    } catch {}
  }
  teacherClosingCache.set(teacherId, { value, until: now + 5_000 });
  return value;
}

function closingStatus(schedule: ClubClosingHours, now = Date.now()) {
  if (!schedule.enabled || !schedule.days.length) return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: schedule.timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type:string) => parts.find(p => p.type === type)?.value || "";
  const weekdays: Record<string,number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
  const day = weekdays[get("weekday")] ?? 0;
  const minute = Number(get("hour")) * 60 + Number(get("minute"));
  const toMinute = (value:string) => {
    const [h,m] = value.split(":").map(Number);
    return h * 60 + m;
  };
  const start = toMinute(schedule.start), end = toMinute(schedule.end);
  if (start === end) return schedule.days.includes(day);
  if (start < end) return schedule.days.includes(day) && minute >= start && minute < end;
  const previousDay = (day + 6) % 7;
  return (schedule.days.includes(day) && minute >= start) || (schedule.days.includes(previousDay) && minute < end);
}
const entitlements = new Map<number, {
  passedThisWeek: number;
  teacherId: number | null;
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
  const [attempts, control, student] = await Promise.all([
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
    db.from('users').select('teacher_id').eq('id', userId).maybeSingle(),
  ]);

  if (attempts.error) throw attempts.error;
  if (control.error) throw control.error;
  if (student.error) throw student.error;

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
    teacherId: Number(student.data?.teacher_id) || null,
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
  const closingHours = await getClosingHours();
  const teacherClosingHours = grant.teacherId ? await getTeacherClosingHours(grant.teacherId) : null;
  const closedByAdmin = closingStatus(closingHours, now);
  const closedByTeacher = teacherClosingHours ? closingStatus(teacherClosingHours, now) : false;
  const effectiveLocked = grant.locked || closedByAdmin || closedByTeacher;
  const hit = cached.get(userId);

  if (!sessionId && hit && hit.until > now && hit.access.day === grant.day && hit.access.week === grant.week &&
      hit.access.locked === effectiveLocked && hit.access.unlimitedThisWeek === grant.unlimitedThisWeek &&
      hit.access.weeklyUnlimitedOnPass === grant.weeklyUnlimitedOnPass && hit.access.passedThisWeek === grant.passedThisWeek) {
    if (hit.access.unlimitedThisWeek) return { ...hit.access, serverNow: now, allowed: !effectiveLocked, locked: grant.locked, closedByAdmin, closedByTeacher, closingHours, teacherClosingHours };
    const remainingMs = Math.max(0, hit.access.expiresAt - now);
    return { ...hit.access, remainingMs, serverNow: now, allowed: !effectiveLocked && remainingMs > 0 && hit.access.leaseUntil > now, locked: grant.locked, closedByAdmin, closedByTeacher, closingHours, teacherClosingHours };
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
      effectiveLocked,
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

    const finalAccess = { ...access, locked: grant.locked, closedByAdmin, closedByTeacher, closingHours, teacherClosingHours, allowed: access.allowed && !closedByAdmin && !closedByTeacher };
    cached.set(userId, { access: finalAccess, until: Date.now() + 2_000 });
    return finalAccess;
  }
  throw new Error('Play time is syncing. Please try again.');
}

export function registerClubPlayRoutes(app: Express, auth: RequestHandler) {
  const isSample = (req: any) => String(req.user?.username || "").startsWith("sample");
  const sampleAccess = () => {
    const now = Date.now();
    return {
      allowed: true,
      locked: false,
      unlimitedThisWeek: true,
      remainingMs: 24 * 60 * 60 * 1000,
      expiresAt: now + 24 * 60 * 60 * 1000,
      leaseUntil: now + 24 * 60 * 60 * 1000,
      serverNow: now,
      day: clubDay(now),
      week: clubWeek(now),
      dailyMinutes: 0,
      weeklyUnlimitedOnPass: true,
      passedThisWeek: 0,
      closedByAdmin: false,
      closingHours: null,
      sample: true,
    };
  };

  const session = (req: any) => {
    const id = String(req.body?.sessionId || '');
    if (!/^[a-zA-Z0-9-]{16,64}$/.test(id)) throw new Error('Open Club Arise again to start your timer.');
    return id;
  };

  app.get('/api/admin/club-closing-hours', auth, async (req:any,res) => {
    if (!req.user?.isAdmin) return res.status(403).json({ message: 'Admin access required.' });
    try {
      const schedule = await getClosingHours();
      res.set('Cache-Control','no-store');
      res.json({ ...schedule, closedNow: closingStatus(schedule) });
    } catch {
      res.status(500).json({ message: 'Could not load Club closing hours.' });
    }
  });

  app.post('/api/admin/club-closing-hours', auth, async (req:any,res) => {
    if (!req.user?.isAdmin) return res.status(403).json({ message: 'Admin access required.' });
    try {
      const start = String(req.body?.start || '');
      const end = String(req.body?.end || '');
      const days = Array.isArray(req.body?.days) ? req.body.days.map(Number).filter((d:number)=>Number.isInteger(d)&&d>=0&&d<=6) : [];
      if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
        return res.status(400).json({ message: 'Choose a valid closing and reopening time.' });
      }
      const schedule: ClubClosingHours = {
        enabled: req.body?.enabled === true,
        start,
        end,
        days: Array.from(new Set(days)).sort((a,b)=>a-b),
        timeZone: 'America/Denver',
      };
      const db = getAdminSupabase();
      const { error } = await db.from('settings').upsert({ key:'club_closing_hours', value:JSON.stringify(schedule) }, { onConflict:'key' });
      if (error) throw error;
      closingCache = { value:schedule, until:Date.now()+5_000 };
      cached.clear();
      res.json({ ...schedule, closedNow: closingStatus(schedule), message:'Club closing hours saved.' });
    } catch {
      res.status(500).json({ message: 'Could not save Club closing hours.' });
    }
  });

  app.get('/api/admin/teacher-club-closing-hours', auth, async (req:any,res) => {
    if (!req.user?.isAdmin) return res.status(403).json({ message: 'Admin access required.' });
    try {
      const db = getAdminSupabase();
      const { data: teachers, error } = await db.from('users').select('id,display_name,username').eq('role','teacher').order('display_name');
      if (error) throw error;
      const rows = [];
      for (const teacher of teachers || []) {
        const schedule = await getTeacherClosingHours(Number(teacher.id));
        rows.push({ id:Number(teacher.id), displayName:teacher.display_name || teacher.username, username:teacher.username, schedule:{...schedule,closedNow:closingStatus(schedule)} });
      }
      res.set('Cache-Control','no-store');
      res.json({ teachers: rows });
    } catch {
      res.status(500).json({ message:'Could not load teacher Club closing hours.' });
    }
  });

  app.post('/api/admin/teacher-club-closing-hours/:teacherId', auth, async (req:any,res) => {
    if (!req.user?.isAdmin) return res.status(403).json({ message: 'Admin access required.' });
    try {
      const teacherId = Number(req.params.teacherId);
      if (!Number.isSafeInteger(teacherId) || teacherId < 1) return res.status(400).json({ message:'Invalid teacher.' });
      const db = getAdminSupabase();
      const { data: teacher, error: teacherError } = await db.from('users').select('id,role').eq('id',teacherId).maybeSingle();
      if (teacherError) throw teacherError;
      if (!teacher || teacher.role !== 'teacher') return res.status(404).json({ message:'Teacher not found.' });
      const start=String(req.body?.start||''), end=String(req.body?.end||'');
      const days=Array.isArray(req.body?.days)?req.body.days.map(Number).filter((d:number)=>Number.isInteger(d)&&d>=0&&d<=6):[];
      if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return res.status(400).json({ message:'Choose a valid closing and reopening time.' });
      const schedule: ClubClosingHours={enabled:req.body?.enabled===true,start,end,days:Array.from(new Set(days)).sort((a,b)=>a-b),timeZone:'America/Denver'};
      const { error }=await db.from('settings').upsert({key:`club_closing_hours_teacher_${teacherId}`,value:JSON.stringify(schedule)},{onConflict:'key'});
      if(error) throw error;
      teacherClosingCache.set(teacherId,{value:schedule,until:Date.now()+5_000});
      cached.clear();
      res.json({ teacherId, schedule:{...schedule,closedNow:closingStatus(schedule)}, message:'Teacher class closing hours overridden.' });
    } catch {
      res.status(500).json({ message:'Could not override teacher Club closing hours.' });
    }
  });

  app.get('/api/teacher/club-closing-hours', auth, async (req:any,res) => {
    if (req.user?.role !== 'teacher' || req.user?.accountApproved === false) return res.status(403).json({ message: 'Approved teacher access required.' });
    try {
      const schedule = await getTeacherClosingHours(Number(req.user.id));
      const adminSchedule = await getClosingHours();
      res.set('Cache-Control','no-store');
      res.json({ ...schedule, closedNow: closingStatus(schedule), adminOverrideClosedNow: closingStatus(adminSchedule), adminSchedule });
    } catch {
      res.status(500).json({ message: 'Could not load your class Club closing hours.' });
    }
  });

  app.post('/api/teacher/club-closing-hours', auth, async (req:any,res) => {
    if (req.user?.role !== 'teacher' || req.user?.accountApproved === false) return res.status(403).json({ message: 'Approved teacher access required.' });
    try {
      const start = String(req.body?.start || '');
      const end = String(req.body?.end || '');
      const days = Array.isArray(req.body?.days) ? req.body.days.map(Number).filter((d:number)=>Number.isInteger(d)&&d>=0&&d<=6) : [];
      if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return res.status(400).json({ message: 'Choose a valid closing and reopening time.' });
      const schedule: ClubClosingHours = {
        enabled: req.body?.enabled === true,
        start,
        end,
        days: Array.from(new Set(days)).sort((a,b)=>a-b),
        timeZone:'America/Denver',
      };
      const db=getAdminSupabase();
      const { error }=await db.from('settings').upsert({ key:`club_closing_hours_teacher_${req.user.id}`, value:JSON.stringify(schedule) }, { onConflict:'key' });
      if(error) throw error;
      teacherClosingCache.set(Number(req.user.id),{value:schedule,until:Date.now()+5_000});
      cached.clear();
      const adminSchedule = await getClosingHours();
      res.json({ ...schedule, closedNow:closingStatus(schedule), adminOverrideClosedNow:closingStatus(adminSchedule), adminSchedule, message:'Your class Club closing hours are saved.' });
    } catch {
      res.status(500).json({ message:'Could not save your class Club closing hours.' });
    }
  });

  app.post('/api/club-play/heartbeat', auth, async (req: any, res) => {
    res.set('Cache-Control', 'no-store');
    if (req.user.role !== 'student' || req.user.isAdmin || req.user.is_eye_gaze_user) return res.status(403).json({ message: 'Club Arise is for regular student accounts.' });
    if (isSample(req)) return res.json(sampleAccess());
    try { res.json(await playTime(Number(req.user.id), session(req))); }
    catch (error) { console.error('[club-play]', error); res.status(503).json({ message: 'Could not sync your play timer. Please try again.' }); }
  });

  app.post('/api/club-play/leave', auth, async (req: any, res) => {
    if (isSample(req)) return res.json({ ok: true });
    try { await playTime(Number(req.user.id), session(req), true); res.json({ ok: true }); }
    catch { res.status(503).json({ message: 'Could not save your play time.' }); }
  });

  const guard: RequestHandler = async (req: any, res, next) => {
    if (/\/leave$/.test(req.path)) return next();
    if (isSample(req)) return next();
    if (req.user.isAdmin || req.user.role === 'teacher') return next();
    if (req.user.role !== 'student' || req.user.is_eye_gaze_user) return res.status(403).json({ message: 'Use a regular student account.' });

    try {
      const access = await playTime(Number(req.user.id));
      if (!access.allowed) {
        return res.status(403).json({
          message: access.closedByAdmin
            ? `Club A.R.I.S.E. is closed right now. Admin hours: ${access.closingHours?.start || ''}–${access.closingHours?.end || ''} Mountain Time.`
            : access.closedByTeacher
              ? `Club A.R.I.S.E. is closed for your class right now. Class hours: ${access.teacherClosingHours?.start || ''}–${access.teacherClosingHours?.end || ''} Mountain Time.`
            : access.locked
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
