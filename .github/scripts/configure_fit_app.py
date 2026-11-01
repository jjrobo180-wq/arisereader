"""Arise Fit and Arise Trainer iPhone apps: the Info.plist settings App Review checks, and the AppDelegate
hook push notifications need.

Usage: configure_fit_app.py <path to Info.plist> [fit|trainer]   (after `npx cap add ios && npx cap sync ios`)
  - The name under the icon, the status bar following the app's theme, and that it only uses the
    encryption built into iOS (HTTPS).
  - Arise Fit. Camera: barcodes, meal photos, form check and progress photos for a trainer. Photos:
    choosing a meal or progress photo. Location: mapping outdoor runs and finding trails. Health:
    reading and saving to Apple Health.
  - Arise Trainer. Camera and Photos: a profile photo for the trainer directory, and photos in messages.
    Every permission needs a sentence saying why, or iOS stops the app when it's asked for.
  - Both: messages from a trainer or client arrive as notifications, so the app hands iOS's device
    token to the push plugin (@capacitor/push-notifications).
"""
import os
import plistlib
import sys

PLIST = sys.argv[1]
FLAVOR = sys.argv[2] if len(sys.argv) > 2 else "fit"
assert FLAVOR in ("fit", "trainer"), FLAVOR
# The app picks its own look (Light, Dark or Auto in Settings), so iOS follows the phone and the status
# bar plugin (@capacitor/status-bar) sets the clock's color to match: dark on Light, light on Dark.
COMMON = {
    "ITSAppUsesNonExemptEncryption": False,
    "UIStatusBarStyle": "UIStatusBarStyleDarkContent",
    "UIViewControllerBasedStatusBarAppearance": True,
}
DROP = ["UIUserInterfaceStyle"]
KEYS = {
    "fit": {
        "CFBundleDisplayName": "Arise Fit",
        "NSCameraUsageDescription": "Arise Fit uses the camera to scan a food's barcode, to take a photo of your meal so it can estimate the calories, to check your exercise form, and to take progress photos you choose to send your trainer. Form check video stays on your iPhone.",
        "NSLocationWhenInUseUsageDescription": "Arise Fit uses your location to map and measure your outdoor runs, walks and hikes, and to find trails near you.",
        "NSHealthShareUsageDescription": "Arise Fit reads your steps, weight, workouts and active calories from Apple Health to show your progress, and to share them with your trainer only if you choose to.",
        "NSHealthUpdateUsageDescription": "Arise Fit saves your workouts, runs, weight and nutrition to Apple Health.",
        "NSPhotoLibraryUsageDescription": "Arise Fit lets you choose a photo of your meal so it can estimate the calories, or a progress photo or picture to send your trainer.",
    },
    "trainer": {
        "CFBundleDisplayName": "Arise Trainer",
        "NSCameraUsageDescription": "Arise Trainer uses the camera to take your profile photo for the trainer directory and photos you send your clients in messages.",
        "NSPhotoLibraryUsageDescription": "Arise Trainer lets you choose your profile photo and photos to send your clients in messages.",
    },
}[FLAVOR]
with open(PLIST, "rb") as f:
    plist = plistlib.load(f)
plist.update(COMMON)
plist.update(KEYS)
for k in DROP:
    plist.pop(k, None)
with open(PLIST, "wb") as f:
    plistlib.dump(plist, f)
print(f"Info.plist ready for {KEYS['CFBundleDisplayName']}: {', '.join(sorted({**COMMON, **KEYS}))}")

DELEGATE = os.path.join(os.path.dirname(PLIST), "AppDelegate.swift")
if os.path.exists(DELEGATE):
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
