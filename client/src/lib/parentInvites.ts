import { API_BASE } from './queryClient';

function tokenFromCookie(): string | null {
  try {
    const raw = document.cookie.split('; ').find(c => c.startsWith('arise_session='))?.split('=')[1];
    return raw ? JSON.parse(atob(raw)).token : null;
  } catch { return null; }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export async function printParentInvites(studentId?: number): Promise<void> {
  // Open synchronously with the button click so mobile browsers allow the print tab.
  const page = window.open('', '_blank');
  if (!page) throw new Error('Allow pop-ups for this site to print parent letters.');
  page.opener = null;
  page.document.write('<title>Preparing parent letters...</title><p>Preparing parent letters...</p>');
  try {
    const token = tokenFromCookie();
    if (!token) throw new Error('Log in again before printing parent letters.');
    const response = await fetch(`${API_BASE}/api/parent-invites/print`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(studentId ? { studentId } : {}),
      cache: 'no-store',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not prepare letters.');
    const invites: Array<{ studentName: string; code: string }> = data.invites || [];
    if (!invites.length) throw new Error('No students found on this roster.');
    const letters = invites.map(invite => `<section class="letter">
      <div class="brand">A.R.I.S.E. READER</div>
      <h1>Your family is invited to read with us!</h1>
      <p>Dear parent or caregiver of <strong>${escapeHtml(invite.studentName)}</strong>,</p>
      <p>Create a free parent account to follow your child's reading progress, see certificates, and connect with their teacher.</p>
      <div class="code-label">Your child's private parent code</div>
      <div class="code">${escapeHtml(invite.code)}</div>
      <ol><li>Go to <strong>www.arisereader.com/parent-signup</strong>.</li><li>Enter your parent code and create your account.</li><li>Log in to see your child's reading dashboard.</li></ol>
      <p>Already have a parent account without a linked student? Log in and enter this code on your dashboard.</p>
      <p class="note">Keep this code with your family. Contact your child's teacher if the code does not work.</p>
    </section>`).join('');
    page.document.open();
    page.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>A.R.I.S.E. Reader Parent Letters</title>
      <style>body{font-family:Arial,sans-serif;color:#222;margin:0;background:#eee}.toolbar{padding:16px;text-align:center}.toolbar button{background:#ef5b16;color:white;border:0;padding:12px 24px;border-radius:8px;font-size:16px}.letter{box-sizing:border-box;background:white;width:8.5in;min-height:11in;margin:20px auto;padding:0.85in;page-break-after:always}.brand{color:#ef5b16;font-weight:800;letter-spacing:.12em}.letter h1{font-size:28px;margin:35px 0}.letter p,.letter li{font-size:17px;line-height:1.6}.code-label{margin-top:38px;font-weight:bold}.code{font-size:29px;letter-spacing:.12em;font-weight:800;padding:18px;border:2px solid #ef5b16;border-radius:8px;text-align:center;margin:12px 0 30px}.note{border-top:1px solid #ccc;padding-top:20px;margin-top:40px;font-size:14px!important}@media print{body{background:white}.toolbar{display:none}.letter{margin:0;box-shadow:none;page-break-after:always}@page{size:letter;margin:0}}</style></head><body><div class="toolbar"><button id="print-button">Print or Save as PDF</button></div>${letters}</body></html>`);
    page.document.close();
    page.document.getElementById('print-button')?.addEventListener('click', () => page.print());
  } catch (error) {
    page.close();
    throw error;
  }
}


export async function printMyParentInvite(): Promise<void> {
  const page = window.open('', '_blank');
  if (!page) throw new Error('Allow pop-ups for this site to print your parent letter.');
  page.opener = null;
  page.document.write('<title>Preparing parent letter...</title><p>Preparing parent letter...</p>');
  try {
    const token = tokenFromCookie();
    if (!token) throw new Error('Log in again before opening your parent letter.');
    const response = await fetch(`${API_BASE}/api/parent-invites/me`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not prepare your parent letter.');
    const invite = data.invite as { studentName: string; code: string } | undefined;
    if (!invite) throw new Error('Could not prepare your parent letter.');
    page.document.open();
    page.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>A.R.I.S.E. Reader Parent Letter</title>
      <style>body{font-family:Arial,sans-serif;color:#222;margin:0;background:#eee}.toolbar{padding:16px;text-align:center}.toolbar button{background:#ef5b16;color:white;border:0;padding:12px 24px;border-radius:8px;font-size:16px}.letter{box-sizing:border-box;background:white;width:8.5in;min-height:11in;margin:20px auto;padding:.85in}.brand{color:#ef5b16;font-weight:800;letter-spacing:.12em}.letter h1{font-size:28px;margin:35px 0}.letter p,.letter li{font-size:17px;line-height:1.6}.code-label{margin-top:38px;font-weight:bold}.code{font-size:29px;letter-spacing:.12em;font-weight:800;padding:18px;border:2px solid #ef5b16;border-radius:8px;text-align:center;margin:12px 0 30px}.note{border-top:1px solid #ccc;padding-top:20px;margin-top:40px;font-size:14px!important}@media print{body{background:white}.toolbar{display:none}.letter{margin:0}@page{size:letter;margin:0}}</style></head><body><div class="toolbar"><button id="print-button">Print or Save as PDF</button></div><section class="letter">
      <div class="brand">A.R.I.S.E. READER</div>
      <h1>Your family is invited to read with us!</h1>
      <p>Dear parent or caregiver of <strong>${escapeHtml(invite.studentName)}</strong>,</p>
      <p>Create a free parent account to follow your child's reading progress, see certificates, and connect with their teacher.</p>
      <div class="code-label">Your child's private parent code</div>
      <div class="code">${escapeHtml(invite.code)}</div>
      <ol><li>Go to <strong>www.arisereader.com/parent-signup</strong>.</li><li>Enter your parent code and create your account.</li><li>Log in to see your child's reading dashboard.</li></ol>
      <p>Already have a parent account without a linked student? Log in and enter this code on your dashboard.</p>
      <p class="note">Keep this code with your family. Contact your child's teacher if the code does not work.</p>
    </section></body></html>`);
    page.document.close();
    page.document.getElementById('print-button')?.addEventListener('click', () => page.print());
  } catch (error) {
    page.close();
    throw error;
  }
}
