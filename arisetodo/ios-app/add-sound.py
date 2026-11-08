"""Arise To Duo iPhone app: puts the reminder sound inside the app.

iOS plays no sound for a scheduled notification unless it names a sound file that is in the app
(lib/nativeReminders.ts asks for "arise-chime.wav"). Run after `npx cap add ios && npx cap sync ios`,
next to configure-ios.py:  python3 add-sound.py ios/App/App.xcodeproj/project.pbxproj ios/App/App
It copies sounds/arise-chime.wav next to the app's code and lists it in the Xcode project as a resource.
Stops with an error if the project isn't laid out the way it expects, so a build never ships silent.
"""
import hashlib
import os
import re
import shutil
import sys

PBX = sys.argv[1] if len(sys.argv) > 1 else "ios/App/App.xcodeproj/project.pbxproj"
DEST = sys.argv[2] if len(sys.argv) > 2 else "ios/App/App"
SOUND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sounds")
NAMES = sorted(f for f in os.listdir(SOUND_DIR) if f.endswith(".wav"))

def fail(why):
    print(f"::error title=Sound::{why}")
    sys.exit(1)

def new_id(seed):
    return hashlib.md5(seed.encode()).hexdigest()[:24].upper()

text = open(PBX, encoding="utf-8").read()

def insert_after(pattern, line, what):
    global text
    m = re.search(pattern, text)
    if not m:
        fail(f"Couldn't find {what} in the Xcode project.")
    text = text[: m.end()] + line + text[m.end():]

for NAME in NAMES:
    shutil.copyfile(os.path.join(SOUND_DIR, NAME), os.path.join(DEST, NAME))
    if NAME in text:
        continue
    file_id, build_id = new_id("ref:" + NAME), new_id("build:" + NAME)
    insert_after(r"/\* Begin PBXBuildFile section \*/\n", f"\t\t{build_id} /* {NAME} in Resources */ = {{isa = PBXBuildFile; fileRef = {file_id} /* {NAME} */; }};\n", "the build file list")
    insert_after(r"/\* Begin PBXFileReference section \*/\n", f"\t\t{file_id} /* {NAME} */ = {{isa = PBXFileReference; lastKnownFileType = audio.wav; path = \"{NAME}\"; sourceTree = \"<group>\"; }};\n", "the file list")
    insert_after(r"\t\t\t\t[0-9A-F]{24} /\* AppDelegate\.swift \*/,\n", f"\t\t\t\t{file_id} /* {NAME} */,\n", "the App group")
    m = re.search(r"isa = PBXResourcesBuildPhase;[^}]*?files = \(\n", text, re.S)
    if not m:
        fail("Couldn't find the Resources build phase.")
    text = text[: m.end()] + f"\t\t\t\t{build_id} /* {NAME} in Resources */,\n" + text[m.end():]

open(PBX, "w", encoding="utf-8").write(text)
print(f"{len(NAMES)} sounds in the app's resources.")
