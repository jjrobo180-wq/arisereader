"""Arise Fit iPhone app: the Info.plist settings App Review checks.

Usage: configure_fit_app.py <path to Info.plist>   (after `npx cap add ios && npx cap sync ios`)
  - The name under the icon, dark look, and that it only uses the encryption built into iOS (HTTPS).
  - Camera: scanning a food's barcode and taking a photo of a meal. Photos: choosing a meal photo.
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
    "NSCameraUsageDescription": "Arise Fit uses the camera to scan a food's barcode and to take a photo of your meal so it can estimate the calories.",
    "NSPhotoLibraryUsageDescription": "Arise Fit lets you choose a photo of your meal so it can estimate the calories.",
}
with open(PLIST, "rb") as f:
    plist = plistlib.load(f)
plist.update(KEYS)
with open(PLIST, "wb") as f:
    plistlib.dump(plist, f)
print(f"Info.plist ready for Arise Fit: {', '.join(sorted(KEYS))}")
