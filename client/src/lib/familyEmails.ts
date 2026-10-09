// The admin's calls for the automatic family emails (server/familyEmails.ts).
import { API_BASE } from './queryClient';

export type FamilyEmailSettings = {
  enabled: boolean;
  weekly: { on: boolean; day: number; hour: number };
  nudge: { on: boolean; afterDays: number; hour: number };
  competitions: boolean;
};
export type FamilyEmailOverview = {
  settings: FamilyEmailSettings;
  emailReady: boolean;
  counts: { parents: number; children: number; stopped: number };
  schedule: { weekly: string; nudge: string };
  lastRun: { at: number; weekly: number; nudges: number; failed: number; note?: string } | null;
  children: { id: number; name: string }[];
  message?: string;
};

function tokenFromCookie(): string | null {
  try {
    const raw = document.cookie.split('; ').find(c => c.startsWith('arise_session='))?.split('=')[1];
    return raw ? JSON.parse(atob(raw)).token : null;
  } catch { return null; }
}

async function request(path: string, init: RequestInit = {}): Promise<any> {
  const token = tokenFromCookie();
  if (!token) throw new Error('Log in again to do that.');
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'That did not work. Please try again.');
  return data;
}

export const loadFamilyEmails = (): Promise<FamilyEmailOverview> => request('/api/admin/family-emails');
export const saveFamilyEmails = (settings: FamilyEmailSettings): Promise<FamilyEmailOverview> => request('/api/admin/family-emails', { method: 'PUT', body: JSON.stringify(settings) });
/** A preview for a student (or a made-up one with childId 0). With sendToMe, it is also emailed to the admin. */
export const previewFamilyEmail = (kind: 'weekly' | 'nudge', childId: number, sendToMe = false): Promise<{ subject: string; html: string; message?: string }> =>
  request('/api/admin/family-emails/preview', { method: 'POST', body: JSON.stringify({ kind, childId, sendToMe }) });
