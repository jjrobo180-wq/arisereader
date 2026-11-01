"""Arise Fit iPhone app: the Info.plist settings App Review checks.

Usage: configure_fit_app.py <path to Info.plist>   (after `npx cap add ios && npx cap sync ios`)
  - The name under the icon, dark look, and that it only uses the encryption built into iOS (HTTPS).
  - Camera: barcodes, meal photos and form check. Photos: choosing a meal photo.
  - Location: mapping outdoor runs and finding trails. Health: reading and saving to Apple Health.
    Every permission needs a sentence saying why, or iOS stops the app when it's asked for.
"""
import plistlib
import sys

PLIST = sys.argv[1]
KEYS = {
    "CFBundleDisplayName": "Arise Fit",
    "ITSAppUsesNonExemptEncryption": False,
    "UIUserInterfaceStyle": "Dark",
    "UIStatusBarStyle": "UIStatusBarStyleLightContent",
    "UIViewControllerBasedStatusBarAppearance": False,
    "NSCameraUsageDescription": "Arise Fit uses the camera to scan a food's barcode, to take a photo of your meal so it can estimate the calories, and to check your exercise form. Form check video stays on your iPhone.",
    "NSLocationWhenInUseUsageDescription": "Arise Fit uses your location to map and measure your outdoor runs, walks and hikes, and to find trails near you.",
    "NSHealthShareUsageDescription": "Arise Fit reads your steps, weight, workouts and active calories from Apple Health to show your progress.",
    "NSHealthUpdateUsageDescription": "Arise Fit saves your workouts, runs, weight and nutrition to Apple Health.",
    "NSPhotoLibraryUsageDescription": "Arise Fit lets you choose a photo of your meal so it can estimate the calories.",
}
with open(PLIST, "rb") as f:
    plist = plistlib.load(f)
plist.update(KEYS)
with open(PLIST, "wb") as f:
    plistlib.dump(plist, f)
print(f"Info.plist ready for Arise Fit: {', '.join(sorted(KEYS))}")
