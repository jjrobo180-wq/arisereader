"""A.R.I.S.E. Reader iPhone apps (students: "reader", teachers and parents: "educator"): the Info.plist
settings App Review checks, and the AppDelegate hook push notifications need.

Usage: configure_reader_app.py <path to Info.plist> reader|educator
Run after `npx cap add ios && npx cap sync ios`.
  - The name under the icon, and that it only uses the encryption built into iOS (HTTPS).
  - Camera: taking a quiz without a proctor (the camera watches during the quiz) and the Beginners
    mirror for practising sounds. Microphone: Beginners (K-3) reading-aloud practice. Every permission
    needs a sentence saying why, or iOS stops the app when it's asked for.
  - Educator: hands the push notification device token to the push plugin.
"""
import os
import plistlib
import sys

PLIST, FLAVOR = sys.argv[1], sys.argv[2]
NAME = {"reader": "A.R.I.S.E. Reader", "educator": "A.R.I.S.E. Reader Educator"}[FLAVOR]
SHORT = {"reader": "A.R.I.S.E.", "educator": "Educator"}[FLAVOR]
KEYS = {
    "CFBundleDisplayName": SHORT if len(NAME) > 18 else NAME,
    "ITSAppUsesNonExemptEncryption": False,
    "NSCameraUsageDescription": f"{NAME} uses the camera when a quiz is taken without a proctor, and as a mirror for practising letter sounds in Beginners.",
    "NSMicrophoneUsageDescription": f"{NAME} uses the microphone when a reader practises reading out loud in Beginners.",
}
with open(PLIST, "rb") as f:
    plist = plistlib.load(f)
plist.update(KEYS)
with open(PLIST, "wb") as f:
    plistlib.dump(plist, f)
print(f"Info.plist ready for {NAME}: {', '.join(sorted(KEYS))}")

DELEGATE = os.path.join(os.path.dirname(PLIST), "AppDelegate.swift")

# Opening the app must not stop music or a podcast already playing in another app. The page's sound
# (read-aloud, games) mixes with it: the audio session is "ambient, mix with others" from launch, and
# WebKit takes the sound over only at the moment the app really plays something.
if os.path.exists(DELEGATE):
    src = open(DELEGATE, encoding="utf-8").read()
    if "AVAudioSession" not in src:
        import re
        src = src.replace("import UIKit", "import UIKit\nimport AVFoundation", 1)
        src, n = re.subn(r"(didFinishLaunchingWithOptions launchOptions: \[UIApplication\.LaunchOptionsKey: Any\]\?\) -> Bool \{\n)",
                         r"\1        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: [.mixWithOthers])\n", src, count=1)
        if not n:
            sys.exit("AppDelegate: launch method not found; other apps' audio would stop when this app opens")
        open(DELEGATE, "w", encoding="utf-8").write(src)
        print("AppDelegate: audio mixes with other apps")

if FLAVOR == "educator" and os.path.exists(DELEGATE):
    src = open(DELEGATE, encoding="utf-8").read()
    if "didRegisterForRemoteNotificationsWithDeviceToken" not in src:
        end = src.rfind("}")
        hook = """
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
"""
        if end > 0 and "import Capacitor" in src:
            open(DELEGATE, "w", encoding="utf-8").write(src[:end] + hook + src[end:])
            print("AppDelegate: push notification token goes to the app")
        else:
            sys.exit("AppDelegate: could not add the push token hook")
