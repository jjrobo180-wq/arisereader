// Runs first (main.tsx imports it before anything else): each Pod+ account keeps its own library,
// progress, Study Pods and downloads on this device (client/src/lib/accountStorage.ts).
import { installAccountStorage } from "../client/src/lib/accountStorage";

const DEVICE_KEYS = new Set(["podscroll.session", "podscroll.email", "podplus.welcome.v1"]);
try {
  // Downloads saved before this update stay with the first account that signs in (it moves with the rest).
  if (!localStorage.getItem("podplus-account") && !localStorage.getItem("podplus-account:moved") && !localStorage.getItem("podplus.downloads.db")) localStorage.setItem("podplus.downloads.db", "podplus-downloads");
} catch { /* storage is off */ }
installAccountStorage({ accountKey: "podplus-account", deviceWide: (k) => DEVICE_KEYS.has(k) || k.startsWith("podplus-account") });
