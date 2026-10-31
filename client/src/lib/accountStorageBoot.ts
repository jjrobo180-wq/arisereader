// Runs first (main.tsx imports it before anything else): each account's things on this device are kept apart.
import { installAccountStorage } from "./accountStorage";

/** Keys that belong to the device, not to an account: the saved sign-in and the iPhone's push token. */
const DEVICE_KEYS = new Set(["arise_session_backup", "arise-apns-token"]);
installAccountStorage({ accountKey: "arise-account", deviceWide: (k) => DEVICE_KEYS.has(k) || k.startsWith("arise-account") || k.startsWith("arise_sample") });
