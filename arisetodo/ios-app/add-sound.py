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
NAME = "arise-chime.wav"
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sounds", NAME)

def fail(why):
    print(f"::error title=Sound::{why}")
    sys.exit(1)

shutil.copyfile(SRC, os.path.join(DEST, NAME))
text = open(PBX, encoding="utf-8").read()
if NAME in text:
    print("Sound already in the project.")
    sys.exit(0)

def new_id(seed):
    return hashlib.md5(seed.encode()).hexdigest()[:24].upper()

file_id, build_id = new_id("ref:" + NAME), new_id("build:" + NAME)

def insert_after(pattern, line, what):
    global text
    m = re.search(pattern, text)
    if not m:
        fail(f"Couldn't find {what} in the Xcode project.")
    text = text[: m.end()] + line + text[m.end():]

insert_after(r"/\* Begin PBXBuildFile section \*/\n", f"\t\t{build_id} /* {NAME} in Resources */ = {{isa = PBXBuildFile; fileRef = {file_id} /* {NAME} */; }};\n", "the build file list")
insert_after(r"/\* Begin PBXFileReference section \*/\n", f"\t\t{file_id} /* {NAME} */ = {{isa = PBXFileReference; lastKnownFileType = audio.wav; path = \"{NAME}\"; sourceTree = \"<group>\"; }};\n", "the file list")
# Next to AppDelegate.swift in its group.
insert_after(r"\t\t\t\t[0-9A-F]{24} /\* AppDelegate\.swift \*/,\n", f"\t\t\t\t{file_id} /* {NAME} */,\n", "the App group")
# In the app's Resources build phase.
m = re.search(r"isa = PBXResourcesBuildPhase;[^}]*?files = \(\n", text, re.S)
if not m:
    fail("Couldn't find the Resources build phase.")
text = text[: m.end()] + f"\t\t\t\t{build_id} /* {NAME} in Resources */,\n" + text[m.end():]
open(PBX, "w", encoding="utf-8").write(text)
print(f"{NAME} added to the app's resources.")
