import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { Clock3, BookOpen } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { API_BASE } from '@/lib/queryClient';
import { CLUB_WORLD_PATHS, type PlayAccess } from '@shared/clubPlay';
import PetCompanionHUD from '@/components/PetCompanionHUD';

export default function ClubPlayGate({ children }: { children: ReactNode }) {
  const { user, realUser, adminPreviewMode, token } = useAuth();
  const [path, navigate] = useLocation();
  const clubRoute = CLUB_WORLD_PATHS.includes(path);
  const adminPreview = !!realUser?.isAdmin && adminPreviewMode === 'regular';
  const active = clubRoute && user?.role === 'student' && !user.isAdmin && !user.is_eye_gaze_user && !adminPreview;
  const [access, setAccess] = useState<PlayAccess | null>(null), [now, setNow] = useState(Date.now()), [error, setError] = useState('');
  const [requestingTime, setRequestingTime] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const sessionId = useRef(crypto.randomUUID());
  const offset = useRef(0);
  const retry = useRef<() => void>(() => {});
  useEffect(() => {
    if (!active || !token) { setAccess(null); return; }
    let stopped = false, inFlight = false;
    document.body.classList.add('club-play-active');
    const pulse = async () => {
      if (inFlight || stopped) return;
      inFlight = true;
      try {
        const start = Date.now();
        const res = await fetch(`${API_BASE}/api/club-play/heartbeat`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: sessionId.current }), signal: AbortSignal.timeout(8000) });
        const body = await res.json();
        if (!res.ok) throw new Error(body.message || 'Could not sync your timer.');
        if (!stopped) { offset.current = body.serverNow - (start + Date.now()) / 2; setAccess(body); setNow(Date.now() + offset.current); setError(''); }
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : 'Could not sync your timer.'); }
      finally { inFlight = false; }
    };
    retry.current = () => { void pulse(); };
    void pulse();
    const heartbeat = window.setInterval(pulse, 8000);
    const clock = window.setInterval(() => setNow(Date.now() + offset.current), 250);
    const leave = () => { void fetch(`${API_BASE}/api/club-play/leave`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: sessionId.current }), keepalive: true }).catch(() => {}); };
    window.addEventListener('pagehide', leave);
    return () => { stopped = true; clearInterval(heartbeat); clearInterval(clock); document.body.classList.remove('club-play-active'); window.removeEventListener('pagehide', leave); leave(); };
  }, [active, token, user?.id]);
  const requestMoreTime = async () => {
    if (!token || requestingTime) return;
    setRequestingTime(true); setRequestMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/club-play/request-more-time`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: 10 }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Could not send your request.');
      setRequestMessage(body.message || 'Request sent.');
      setAccess(current => current ? { ...current, timeRequestStatus: 'pending' } : current);
    } catch (e) {
      setRequestMessage(e instanceof Error ? e.message : 'Could not send your request.');
    } finally {
      setRequestingTime(false);
    }
  };
  if (!active) return <>{children}{clubRoute && adminPreview ? <PetCompanionHUD/> : null}</>;
  const remaining = Math.max(0, Math.ceil(((access?.expiresAt || now) - now) / 1000));
  const canPlay = !!access?.allowed && (!!access.unlimitedThisWeek || (remaining > 0 && access.leaseUntil > now));
  const time = access?.unlimitedThisWeek ? '∞' : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  if (!canPlay) return <main className="club-time-gate">
    <section><Clock3 size={44} /><h1>{access?.closedByAdmin ? 'Club A.R.I.S.E. is closed' : access?.closedByTeacher ? 'Club A.R.I.S.E. is closed for your class' : access?.locked ? 'Club Arise is locked' : access && !remaining ? "Today’s play time is up" : access && !error ? 'Syncing your play time…' : error ? 'Reconnect your play timer' : 'Starting your play timer…'}</h1>
      <p>{access?.closedByAdmin
        ? `Games are closed during admin hours${access.closingHours ? ` · ${access.closingHours.start}–${access.closingHours.end} Mountain Time` : ''}. Come back when Club A.R.I.S.E. reopens.`
        : access?.closedByTeacher
          ? `Your teacher has closed Club A.R.I.S.E. for the class${access.teacherClosingHours ? ` · ${access.teacherClosingHours.start}–${access.teacherClosingHours.end} Mountain Time` : ''}. The admin can still override class hours.`
          : access?.locked ? 'Your teacher has paused Club Arise.' : access?.weeklyUnlimitedOnPass ? 'You get 10 minutes each day. Pass one book quiz to unlock unlimited A.R.I.S.E. play for the rest of this week.' : 'Your normal daily A.R.I.S.E. play time is finished for today.'}</p>
      {error && <p role="alert">{error}</p>}
      {!access?.closedByAdmin && !access?.closedByTeacher && !access?.locked && access && !remaining && (
        access.timeRequestStatus === 'pending'
          ? <button className="secondary" disabled><Clock3 size={20} /> Request waiting for an adult</button>
          : <button className="secondary" disabled={requestingTime} onClick={() => void requestMoreTime()}><Clock3 size={20} /> {requestingTime ? 'Sending request…' : 'Request 10 more minutes'}</button>
      )}
      {requestMessage && <p role="status">{requestMessage}</p>}
      <button onClick={() => navigate('/library')}><BookOpen size={20} /> Go to the library</button>
      {error && <button className="secondary" onClick={() => retry.current()}>Try again</button>}
    </section>
  </main>;
  return <>{children}<PetCompanionHUD/><aside className={`club-play-timer ${!access?.unlimitedThisWeek && remaining <= 60 ? 'low' : ''}`} aria-label={access?.unlimitedThisWeek?"Unlimited Club Arise play this week":"Club Arise daily play timer"}>
    <div><Clock3 size={20} /><strong role="timer" aria-label={access?.unlimitedThisWeek?"Unlimited play this week":`${remaining} seconds of play remaining`}>{time}</strong><span>{access?.unlimitedThisWeek?"this week":"left today"}</span></div>
    <p>{access?.unlimitedThisWeek?<><b>Quiz passed!</b> Unlimited play is active until next Monday.</>:access?.weeklyUnlimitedOnPass?<><b>Pass a book quiz</b> for unlimited play this week.</>:<>Daily play rule is active.</>}</p>
    {!access?.unlimitedThisWeek&&access?.weeklyUnlimitedOnPass&&<button onClick={() => navigate('/library')}><BookOpen size={18} /><span>Unlock the week</span></button>}
  </aside></>;
}
