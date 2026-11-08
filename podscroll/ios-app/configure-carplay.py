"""Pod+ in the car: CarPlay (native/arise-carplay).

Run after configure-ios.py and adopt_uiscene.py (both Pod+ workflows do):
    python3 configure-carplay.py ios/App/App/Info.plist [--entitlements ios/App/App/App.entitlements]

  - Info.plist: a CarPlay scene next to the phone's window (PodCarPlaySceneDelegate draws the car's
    screens; the class lives in the AriseCarPlay plugin, so it's looked up by name).
  - AppDelegate.swift: a car connecting gets the CarPlay scene (adopt_uiscene.py's hook otherwise
    hands every scene the phone's window and storyboard).
  - --entitlements: adds Apple's CarPlay audio entitlement (com.apple.developer.carplay-audio). Only
    pass it when the provisioning profile has it: Apple grants it to the developer account on request
    (developer.apple.com/contact/carplay), and a signed build with an entitlement its profile lacks fails.
    A simulator build doesn't need it.
"""
import os
import plistlib
import sys

args = [a for a in sys.argv[1:] if not a.startswith("--")]
PLIST = args[0] if args else "ios/App/App/Info.plist"
ENT = sys.argv[sys.argv.index("--entitlements") + 1] if "--entitlements" in sys.argv else None
DELEGATE = os.path.join(os.path.dirname(PLIST), "AppDelegate.swift")
ROLE = "CPTemplateApplicationSceneSessionRoleApplication"

with open(PLIST, "rb") as f:
    plist = plistlib.load(f)
manifest = plist.get("UIApplicationSceneManifest")
if not manifest or "UISceneConfigurations" not in manifest:
    sys.exit("Info.plist has no scene manifest: run adopt_uiscene.py first")
manifest["UISceneConfigurations"][ROLE] = [{
    "UISceneConfigurationName": "CarPlay",
    "UISceneDelegateClassName": "PodCarPlaySceneDelegate",
}]
with open(PLIST, "wb") as f:
    plistlib.dump(plist, f)
print("Info.plist: CarPlay scene (PodCarPlaySceneDelegate)")

src = open(DELEGATE, encoding="utf-8").read()
marker = "configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {"
if "PodCarPlaySceneDelegate" not in src:
    if marker not in src:
        sys.exit("AppDelegate.swift has no scene configuration hook: run adopt_uiscene.py first")
    hook = marker + """
        // Pod+ in the car: CarPlay gets its own scene (native/arise-carplay).
        if connectingSceneSession.role.rawValue == \"""" + ROLE + """\" {
            let car = UISceneConfiguration(name: "CarPlay", sessionRole: connectingSceneSession.role)
            car.delegateClass = NSClassFromString("PodCarPlaySceneDelegate")
            return car
        }"""
    src = src.replace(marker, hook, 1)
    open(DELEGATE, "w", encoding="utf-8").write(src)
    print("AppDelegate: a car connecting gets the CarPlay scene")

if ENT:
    if not os.path.exists(ENT):
        with open(ENT, "wb") as f:
            plistlib.dump({}, f)
    with open(ENT, "rb") as f:
        ent = plistlib.load(f)
    ent["com.apple.developer.carplay-audio"] = True
    with open(ENT, "wb") as f:
        plistlib.dump(ent, f)
    print(f"{ENT}: CarPlay audio entitlement")
