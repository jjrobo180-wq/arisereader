"""Arise To Duo iPhone app: the Info.plist settings App Review checks.

Run after `npx cap add ios && npx cap sync ios` (both GitHub Actions workflows do). Every permission the
app can ask for needs a sentence saying why, or iOS stops the app the moment it asks:
  - Apple Health (read only: steps, active calories, weight for the Food & fitness diary)
  - Calendars (the iPhone Calendar in WorkHub and LifeHub)
  - Camera, photos and microphone (barcode scanner, photos in notes and posts, voice features)
  - Location (only the apps in the App Store that ask for it, like weather and mileage)
It also says the app only uses the encryption built into iOS (HTTPS), so App Store Connect doesn't
ask about export compliance on every upload.
"""
import plistlib
import sys

PLIST = sys.argv[1] if len(sys.argv) > 1 else "ios/App/App/Info.plist"
NAME = "Arise To Duo"
KEYS = {
    "CFBundleDisplayName": NAME,
    "NSHealthShareUsageDescription": f"{NAME} reads your steps, active calories and weight to fill in your Food & fitness diary.",
    "NSHealthUpdateUsageDescription": f"{NAME} does not write to Apple Health.",
    "NSCalendarsFullAccessUsageDescription": f"{NAME} shows the events from your iPhone's calendars on your WorkHub and LifeHub calendar.",
    "NSCalendarsUsageDescription": f"{NAME} shows the events from your iPhone's calendars on your WorkHub and LifeHub calendar.",
    "NSCalendarsWriteOnlyAccessUsageDescription": f"{NAME} adds the events you choose to your iPhone's calendar.",
    "NSCameraUsageDescription": f"{NAME} uses the camera to scan barcodes and take photos you add to your notes, tasks and posts.",
    "NSPhotoLibraryUsageDescription": f"{NAME} lets you pick photos to add to your notes, tasks and posts.",
    "NSPhotoLibraryAddUsageDescription": f"{NAME} saves pictures you choose to your photo library.",
    "NSMicrophoneUsageDescription": f"{NAME} uses the microphone for voice notes and speaking practice when you choose to record.",
    "NSLocationWhenInUseUsageDescription": f"{NAME} uses your location only in the apps that need it, like weather and mileage, while you use them.",
    "ITSAppUsesNonExemptEncryption": False,
}

with open(PLIST, "rb") as f:
    plist = plistlib.load(f)
plist.update(KEYS)
with open(PLIST, "wb") as f:
    plistlib.dump(plist, f)
print(f"Info.plist ready for {NAME}: {', '.join(sorted(KEYS))}")
