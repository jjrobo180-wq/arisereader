"""Pod+ iPhone app: the Info.plist settings App Review checks.

Run after `npx cap add ios && npx cap sync ios` (both GitHub Actions workflows do).
  - Background audio: podcasts, audiobooks and radio keep playing with the screen locked or in
    another app (UIBackgroundModes: audio). Without it iOS pauses playback when the phone locks.
  - Camera, photos and microphone: posting photos and videos on Pod+ Social, recording an episode,
    Go Live and listening parties. Every permission needs a sentence saying why, or iOS stops the app.
  - It only uses the encryption built into iOS (HTTPS), so App Store Connect doesn't ask about export
    compliance on every upload.
"""
import plistlib
import sys

PLIST = sys.argv[1] if len(sys.argv) > 1 else "ios/App/App/Info.plist"
NAME = "Pod+"
KEYS = {
    "CFBundleDisplayName": NAME,
    "NSCameraUsageDescription": f"{NAME} uses the camera when you take a photo or video to post on Pod+ Social, or a photo of your notes for Study Pod+ and Meeting Pod.",
    "NSPhotoLibraryUsageDescription": f"{NAME} lets you pick photos and videos to post on Pod+ Social or use for your profile and episodes.",
    "NSPhotoLibraryAddUsageDescription": f"{NAME} saves clips and pictures you choose to your photo library.",
    "NSMicrophoneUsageDescription": f"{NAME} uses the microphone when you record an episode, a class or a meeting, go live or talk in a listening party.",
    "ITSAppUsesNonExemptEncryption": False,
}

with open(PLIST, "rb") as f:
    plist = plistlib.load(f)
plist.update(KEYS)
modes = list(plist.get("UIBackgroundModes", []))
if "audio" not in modes:
    modes.append("audio")
plist["UIBackgroundModes"] = modes
with open(PLIST, "wb") as f:
    plistlib.dump(plist, f)
print(f"Info.plist ready for {NAME}: background audio, {', '.join(sorted(KEYS))}")
