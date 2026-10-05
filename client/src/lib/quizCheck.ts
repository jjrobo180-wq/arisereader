// Checks one quiz answer on the server, so a quiz can celebrate a right answer straight away
// without the answer key ever being sent to the browser. The first answer to each question is
// the one that counts.
import { API_BASE } from "@/lib/queryClient";

/** true or false from the server, or null if it couldn't be checked (the quiz carries on). */
export async function checkQuizAnswer(path: string, token: string | null, questionId: number, answer: string): Promise<boolean | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ questionId, answer }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return typeof data?.correct === "boolean" ? data.correct : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Reads a quiz turn-in response; a quiz that was already turned in comes back as an error message. */
export async function readTurnIn(res: Response): Promise<{ ok: true; data: any } | { ok: false; message: string }> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: data?.message || "Could not turn in the quiz." };
  return { ok: true, data };
}
