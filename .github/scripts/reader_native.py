"""A.R.I.S.E. Reader iPhone app: the parts that make it an iPhone app rather than a web page in a frame.

  - Home Screen quick actions (press and hold the icon): Library, Messages, Games, My profile.
  - The arisereader:// link scheme they use (client/src/lib/readerNative.ts sends each to its page).
  - SceneDelegate: hands a quick action to the app as that link, at launch and while it's open.

Usage (from reader/ios-app, after adopt_uiscene.py): python3 ../../.github/scripts/reader_native.py ios/App/App/Info.plist
"""
import os
import plistlib
import sys

PLIST = sys.argv[1] if len(sys.argv) > 1 else "ios/App/App/Info.plist"
DELEGATE = os.path.join(os.path.dirname(PLIST), "AppDelegate.swift")

ACTIONS = [
    ("arisereader://go/library", "Library", "Find a book to read", "books.vertical.fill"),
    ("arisereader://go/messages", "Messages", "From your teacher", "envelope.fill"),
    ("arisereader://go/games", "Games", "Word and reading games", "gamecontroller.fill"),
    ("arisereader://go/profile", "My profile", "Points, badges and certificates", "person.crop.circle.fill"),
]

with open(PLIST, "rb") as f:
    plist = plistlib.load(f)
plist["UIApplicationShortcutItems"] = [
    {"UIApplicationShortcutItemType": url, "UIApplicationShortcutItemTitle": title, "UIApplicationShortcutItemSubtitle": sub, "UIApplicationShortcutItemIconSymbolName": icon}
    for url, title, sub, icon in ACTIONS
]
types = [t for t in plist.get("CFBundleURLTypes", []) if "arisereader" not in t.get("CFBundleURLSchemes", [])]
types.append({"CFBundleURLName": "com.arisereader.reader", "CFBundleURLSchemes": ["arisereader"]})
plist["CFBundleURLTypes"] = types
with open(PLIST, "wb") as f:
    plistlib.dump(plist, f)
print(f"Info.plist: {len(ACTIONS)} quick actions and the arisereader:// scheme")

src = open(DELEGATE, encoding="utf-8").read()
if "class SceneDelegate" not in src:
    sys.exit("Run adopt_uiscene.py first: quick actions are handled by the SceneDelegate")
if "performActionFor shortcutItem" not in src:
    start = "        // Opened from a link while closed: hand it on once the app is up.\n"
    if start not in src:
        sys.exit("SceneDelegate doesn't look like adopt_uiscene.py's: quick actions weren't added")
    src = src.replace(start, """        // Opened from a Home Screen quick action: its link, once the app is up.
        if let item = connectionOptions.shortcutItem, let url = URL(string: item.type) {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:]) }
        }
""" + start, 1)
    tail = "    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {"
    if tail not in src:
        sys.exit("SceneDelegate doesn't look like adopt_uiscene.py's: quick actions weren't added")
    src = src.replace(tail, """    /// A Home Screen quick action while the app is running.
    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        guard let url = URL(string: shortcutItem.type) else { completionHandler(false); return }
        completionHandler(ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:]))
    }
""" + tail, 1)
    open(DELEGATE, "w", encoding="utf-8").write(src)
    print("SceneDelegate: quick actions go to their pages")
