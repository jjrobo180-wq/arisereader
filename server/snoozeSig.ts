// The signature a reminder notification carries so its Snooze button works without signing in
// (server/pushNotifications.ts). One per person and reminder, made with the site's push key.
import crypto from "node:crypto";

export function snoozeSig(secret: string, userId: number, key: string): string {
  return crypto.createHmac("sha256", secret).update(`${userId}:${key}`).digest("base64url").slice(0, 32);
}
