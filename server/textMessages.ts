// Text messages (SMS) through Twilio. Used to text parents and staff a poll link or the final meeting time.
// Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and either TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER.
// Twilio itself handles "STOP" replies and will refuse to text anyone who opted out.
import { cleanPhone } from "../shared/meetingPoll";

export type TextConfig = { accountSid: string; authToken: string; messagingServiceSid?: string; fromNumber?: string };

export function textConfigFromEnv(env: Record<string, string | undefined> = process.env): TextConfig | null {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = env.TWILIO_AUTH_TOKEN?.trim();
  const messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  const fromNumber = cleanPhone(env.TWILIO_FROM_NUMBER);
  if (!accountSid || !authToken || (!messagingServiceSid && !fromNumber)) return null;
  return { accountSid, authToken, ...(messagingServiceSid ? { messagingServiceSid } : { fromNumber }) };
}

export type TextResult = { sent: boolean; error?: string };

export function createTextService(config: TextConfig, fetchImpl: typeof fetch = fetch) {
  return {
    async send(to: string, body: string): Promise<TextResult> {
      const phone = cleanPhone(to);
      if (!phone) return { sent: false, error: "That is not a working phone number" };
      const form = new URLSearchParams({ To: phone, Body: body.slice(0, 600) });
      if (config.messagingServiceSid) form.set("MessagingServiceSid", config.messagingServiceSid);
      else form.set("From", config.fromNumber!);
      try {
        const res = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`, {
          method: "POST",
          headers: { Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: form.toString(),
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok) return { sent: true };
        const detail: any = await res.json().catch(() => ({}));
        // 21610: the person replied STOP. 21211 / 21614: not a real mobile number.
        return { sent: false, error: String(detail?.message || `Text service answered ${res.status}`).slice(0, 200) };
      } catch (error: any) {
        return { sent: false, error: error?.name === "TimeoutError" ? "The text service didn't answer in time" : String(error?.message || error) };
      }
    },
  };
}
export type TextService = ReturnType<typeof createTextService>;
