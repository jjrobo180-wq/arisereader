"""A.R.I.S.E. Reader iPhone app: the bridge its Home Screen widgets read from.

Adds to AppDelegate.swift (after adopt_uiscene.py made the SceneDelegate):
  - ReaderWidgetPlugin, a Capacitor plugin ("ReaderWidget") with save({ data }): it keeps the
    snapshot client/src/lib/readerWidget.ts sends in a keychain item shared with the widget
    (access group TEAM.com.arisereader.reader.shared) and asks iOS to redraw the widgets.
  - its registration with the app's Capacitor bridge once the window is up.
Then copies the widget's files (reader/ios-app/widgets) next to the app's, for reader_widgets.rb.

Usage (from reader/ios-app): python3 ../../.github/scripts/reader_widgets.py ios/App/App/AppDelegate.swift
"""
import os
import shutil
import sys

DELEGATE = sys.argv[1] if len(sys.argv) > 1 else "ios/App/App/AppDelegate.swift"
src = open(DELEGATE, encoding="utf-8").read()
if "class SceneDelegate" not in src:
    sys.exit("Run adopt_uiscene.py first: the widget bridge is registered from the SceneDelegate")

if "ReaderWidgetPlugin" not in src:
    if "import WidgetKit" not in src:
        src = src.replace("import Capacitor", "import Capacitor\nimport Security\nimport WidgetKit", 1)
    hook = "        // Opened from a link while closed: hand it on once the app is up.\n"
    if hook not in src:
        sys.exit("SceneDelegate doesn't look like adopt_uiscene.py's: the widget bridge wasn't added")
    src = src.replace(hook, """        // The Home Screen widgets' data bridge (ReaderWidgetPlugin, below).
        DispatchQueue.main.async { [weak self] in
            if let bridge = (self?.window?.rootViewController as? CAPBridgeViewController)?.bridge {
                bridge.registerPluginInstance(ReaderWidgetPlugin())
            }
        }
""" + hook, 1)
    src += """

/// Keeps the reader's snapshot where the widget extension can read it (a shared keychain item).
enum ReaderWidgetStore {
    static let service = "com.arisereader.reader.widget"
    static let account = "snapshot"
    static let group = "6TYWWNKX6P.com.arisereader.reader.shared"
    static func write(_ json: String) {
        guard let data = json.data(using: .utf8) else { return }
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: group,
        ]
        SecItemDelete(base as CFDictionary)
        var add = base
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }
}

/// window.Capacitor "ReaderWidget".save({ data }): a new snapshot for the Home Screen widgets.
@objc(ReaderWidgetPlugin)
public class ReaderWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ReaderWidgetPlugin"
    public let jsName = "ReaderWidget"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise)]
    @objc func save(_ call: CAPPluginCall) {
        let json = call.getString("data") ?? ""
        if json.count > 4000 { call.reject("Too much for a widget"); return }
        ReaderWidgetStore.write(json)
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}
"""
    open(DELEGATE, "w", encoding="utf-8").write(src)
    print("AppDelegate: ReaderWidget bridge added")

# The app's entitlements: the keychain group it shares with the widget. (The signed build adds
# Apple Health, Sign in with Apple and push to the same file.)
ENT = os.path.join(os.path.dirname(DELEGATE), "App.entitlements")
if not os.path.exists(ENT):
    open(ENT, "w").write('''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>keychain-access-groups</key>
	<array>
		<string>$(AppIdentifierPrefix)com.arisereader.reader.shared</string>
	</array>
</dict>
</plist>
''')
    print("App.entitlements: shared keychain group")

here = os.path.dirname(os.path.abspath(__file__))
widgets = os.path.join(here, "..", "..", "reader", "ios-app", "widgets")
dest = os.path.join(os.path.dirname(os.path.dirname(DELEGATE)), "ReaderWidgets")
shutil.rmtree(dest, ignore_errors=True)
shutil.copytree(widgets, dest)
print("Widget files copied to " + dest)
