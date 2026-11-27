"""Arise To Do iPhone app: the Info.plist settings App Review checks.

Run after `npx cap add ios && npx cap sync ios` (both GitHub Actions workflows do). Every permission the
app can ask for needs a sentence saying why, or iOS stops the app the moment it asks:
  - Apple Health (read only: steps, active calories, weight for the Food & fitness diary; for Life Score, everything
    client/src/lib/lifeScoreHealth.ts reads: activity, sleep, heart, vitals, body, food and water, mindful minutes, workouts)
  - Calendars (the iPhone Calendar in WorkHub and LifeHub)
  - Camera, photos and microphone (barcode scanner, photos in notes and posts, voice features)
  - Location (only the plugins that ask for it, like weather and mileage)
It also says the app only uses the encryption built into iOS (HTTPS), so App Store Connect doesn't
ask about export compliance on every upload, turns on Live Activities (the focus timer on the Lock Screen
and in the Dynamic Island) and adds the arisetodo:// links that timer's Done and Stop buttons open.
"""
import plistlib
import sys

PLIST = sys.argv[1] if len(sys.argv) > 1 else "ios/App/App/Info.plist"
NAME = "Arise To Do"
KEYS = {
    "CFBundleDisplayName": NAME,
    "NSHealthShareUsageDescription": f"{NAME} reads your activity (steps, distance, floors, exercise and stand time, calories burned), sleep and sleep stages, heart (heart rate, resting heart rate, heart rate variability, VO2 max, blood pressure), breathing rate, blood oxygen, temperature, weight, body fat, blood glucose, calories and water you log, mindful minutes and workouts to fill in your Food & fitness diary and your Life Score.",
    "NSHealthUpdateUsageDescription": f"{NAME} saves your weigh-ins, active calories, workout distance and mindful minutes to Apple Health when you log them in Health & Fitness and allow it.",
    "NSCalendarsFullAccessUsageDescription": f"{NAME} shows the events from your iPhone's calendars on your WorkHub and LifeHub calendar.",
    "NSCalendarsUsageDescription": f"{NAME} shows the events from your iPhone's calendars on your WorkHub and LifeHub calendar.",
    "NSRemindersFullAccessUsageDescription": f"{NAME} brings your reminders from the Reminders app into your LifeHub tasks, and keeps their check-offs in step.",
    "NSRemindersUsageDescription": f"{NAME} brings your reminders from the Reminders app into your LifeHub tasks, and keeps their check-offs in step.",
    "NSCalendarsWriteOnlyAccessUsageDescription": f"{NAME} adds the events you choose to your iPhone's calendar.",
    "NSCameraUsageDescription": f"{NAME} uses the camera to scan barcodes and take photos you add to your notes, tasks and posts.",
    "NSPhotoLibraryUsageDescription": f"{NAME} lets you pick photos to add to your notes, tasks and posts.",
    "NSPhotoLibraryAddUsageDescription": f"{NAME} saves pictures you choose to your photo library.",
    "NSMicrophoneUsageDescription": f"{NAME} uses the microphone when you choose to record a voice note or a meeting in Notes, or the sound of a video for your trainer.",
    "NSLocationWhenInUseUsageDescription": f"{NAME} uses your location only while you use it: in the plugins that need it, like weather and mileage, and to open the hub you chose for a place.",
    "ITSAppUsesNonExemptEncryption": False,
    "NSSupportsLiveActivities": True,
}

with open(PLIST, "rb") as f:
    plist = plistlib.load(f)
plist.update(KEYS)
types = [t for t in plist.get("CFBundleURLTypes", []) if "arisetodo" not in t.get("CFBundleURLSchemes", [])]
types.append({"CFBundleURLName": "com.arisereader.arisetodo", "CFBundleURLSchemes": ["arisetodo"]})
plist["CFBundleURLTypes"] = types
with open(PLIST, "wb") as f:
    plistlib.dump(plist, f)
print(f"Info.plist ready for {NAME}: {', '.join(sorted(KEYS))}")

# Other apps' music and podcasts keep playing when Arise To Do opens: the app starts with an
# audio session that mixes with others (ambient), so it takes over the sound only when it really
# plays something (a voice line, a story), which WebKit sets up by itself at that moment.
import os
import re

DELEGATE = os.path.join(os.path.dirname(PLIST), "AppDelegate.swift")
if os.path.exists(DELEGATE):
    src = open(DELEGATE, encoding="utf-8").read()
    if "AVAudioSession" not in src:
        src = src.replace("import UIKit", "import UIKit\nimport AVFoundation", 1)
        src, n = re.subn(r"(didFinishLaunchingWithOptions launchOptions: \[UIApplication\.LaunchOptionsKey: Any\]\?\) -> Bool \{\n)",
                         r"\1        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: [.mixWithOthers])\n", src, count=1)
        open(DELEGATE, "w", encoding="utf-8").write(src)
        print("AppDelegate: audio mixes with other apps" if n else "AppDelegate: launch method not found; audio session left as is")

# Apple push notifications: hand the device token iOS gives the app to the push plugin.
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
            src = src[:end] + hook + src[end:]
            open(DELEGATE, "w", encoding="utf-8").write(src)
            print("AppDelegate: push notification token goes to the app")
        else:
            print("AppDelegate: could not add the push token hook")


# The launch screen: navy with the Arise To Do icon (splash-2732.png), not Capacitor's placeholder "X".
# It is the first frame of the app's own loading screen (client/todo-loading.html), so the two join up.
import glob, os, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
SPLASH_SET = os.path.join(os.path.dirname(PLIST), "Assets.xcassets", "Splash.imageset")
splash_pngs = glob.glob(os.path.join(SPLASH_SET, "*.png"))
for png in splash_pngs:
    shutil.copyfile(os.path.join(HERE, "splash-2732.png"), png)
print(f"Launch screen: Arise To Do splash ({len(splash_pngs)} images)" if splash_pngs else "Launch screen: no Splash.imageset found")
