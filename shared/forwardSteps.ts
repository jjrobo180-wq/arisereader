// Where the Forward button is in each big email app, shown under "Forward emails here" in LifeHub
// (components/family-hub/EmailForward.tsx) and WorkHub (components/teacher-hub/HubInbox.tsx) through
// components/ForwardHowTo.tsx. Every one ends the same way: paste the private address in "To" and send.

export type ForwardApp = { id: string; name: string; where: "phone" | "computer"; steps: string[] };

const SEND = "Paste your private address (copied above) in the To box, then tap Send.";
const SEND_CLICK = "Paste your private address (copied above) in the To box, then click Send.";

export const FORWARD_APPS: readonly ForwardApp[] = [
  { id: "gmail-phone", name: "Gmail app", where: "phone", steps: [
    "Open the email.",
    "Scroll to the bottom and tap Forward (the arrow pointing right). Or tap the three dots ⋮ at the top of the email, next to the reply arrow, and tap Forward.",
    SEND] },
  { id: "gmail-web", name: "Gmail", where: "computer", steps: [
    "Open the email at gmail.com.",
    "Click Forward under the email. Or click the three dots ⋮ at the top right of the email, next to the reply arrow, and click Forward.",
    SEND_CLICK] },
  { id: "apple-mail-phone", name: "iPhone Mail", where: "phone", steps: [
    "Open the email in the Mail app.",
    "Tap the curved arrow at the bottom of the screen.",
    "Tap Forward.",
    SEND] },
  { id: "apple-mail-mac", name: "Mac Mail", where: "computer", steps: [
    "Open the email in the Mail app.",
    "Click the Forward arrow in the toolbar at the top. Or choose Message › Forward (Shift-Command-F).",
    SEND_CLICK] },
  { id: "outlook-phone", name: "Outlook app", where: "phone", steps: [
    "Open the email.",
    "Tap the three dots ⋯ next to the reply arrow.",
    "Tap Forward.",
    SEND] },
  { id: "outlook-web", name: "Outlook", where: "computer", steps: [
    "Open the email in Outlook (outlook.com, or the Outlook app on Windows or Mac).",
    "Click the Forward arrow at the top right of the email, next to Reply and Reply all. Or click the three dots ⋯ and choose Forward.",
    SEND_CLICK] },
  { id: "yahoo", name: "Yahoo Mail", where: "phone", steps: [
    "Open the email (the Yahoo Mail app or mail.yahoo.com).",
    "Tap or click Forward (the arrow pointing right) in the bar above or below the email. In the app it may be under the three dots ⋯.",
    SEND] },
  { id: "icloud", name: "iCloud Mail", where: "computer", steps: [
    "Open the email at icloud.com/mail.",
    "Click the reply arrow at the top of the email.",
    "Choose Forward.",
    SEND_CLICK] },
  { id: "aol", name: "AOL Mail", where: "computer", steps: [
    "Open the email (the AOL app or mail.aol.com).",
    "Tap or click Forward in the bar above the email (in the app, tap the three dots ⋯ first).",
    SEND] },
  { id: "proton", name: "Proton Mail", where: "computer", steps: [
    "Open the email.",
    "Tap or click the Forward arrow at the top right of the email (in the app, it may be under the three dots ⋯).",
    SEND] },
];

/** The reminder that goes with every one: forwards only count from an address on the accepted list. */
export const FORWARD_SENDER_TIP = "Forward from an email address you added to \"Accept emails forwarded from\". Forwards from any other address are ignored.";
