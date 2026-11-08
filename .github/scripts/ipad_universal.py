"""One app for iPhone, iPhone Duo and iPad: TARGETED_DEVICE_FAMILY 1,2 on the App target, every
orientation on iPad (so it can sit beside other apps in Split View and Stage Manager), and no
UIRequiresFullScreen. Usage: ipad_universal.py <ios/App/App/Info.plist>  (the .xcodeproj next to it)."""
import pathlib, plistlib, re, sys

info = pathlib.Path(sys.argv[1])
plist = plistlib.loads(info.read_bytes())
plist["UISupportedInterfaceOrientations~ipad"] = ["UIInterfaceOrientationPortrait", "UIInterfaceOrientationPortraitUpsideDown",
                                                  "UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight"]
plist.pop("UIRequiresFullScreen", None)
info.write_bytes(plistlib.dumps(plist))
pbx = info.parent.parent / "App.xcodeproj" / "project.pbxproj"
if pbx.exists():
    text = pbx.read_text()
    fixed = re.sub(r'TARGETED_DEVICE_FAMILY = "?1"?;', 'TARGETED_DEVICE_FAMILY = "1,2";', text)
    if "TARGETED_DEVICE_FAMILY" not in fixed:
        fixed = fixed.replace("SWIFT_VERSION = 5.0;", 'SWIFT_VERSION = 5.0;\n\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";')
    pbx.write_text(fixed)
print("iPhone + iPad:", info)
