"""Every iPhone app here (Arise To Duo, Pod+, A.R.I.S.E. Reader, Reader Educator): the UIScene life cycle.

Apps built with the iOS 27 SDK (Xcode 27, needed for iPhone Duo) must use scenes, or iOS stops them at
launch ("UIScene life cycle is required for apps built with this SDK"). Capacitor 8.0's generated
project doesn't, so after `cap add ios` and the other configure scripts, this adds:
  - Info.plist: a scene manifest (one window, built from Main.storyboard, which holds Capacitor's
    CAPBridgeViewController), and no app-wide storyboard (the scene makes the window now).
  - AppDelegate.swift: the scene configuration hook, and a SceneDelegate class (in the same file, so
    the Xcode project doesn't need a new file) that hands opened links and universal links on to
    Capacitor, which no longer gets them through the app delegate once scenes are on.
Capacitor's pause/resume events, push notification callbacks and didFinishLaunching keep working.

Usage: python3 adopt_uiscene.py ios/App/App/Info.plist
"""
import os
import plistlib
import sys

PLIST = sys.argv[1] if len(sys.argv) > 1 else "ios/App/App/Info.plist"
DELEGATE = os.path.join(os.path.dirname(PLIST), "AppDelegate.swift")

with open(PLIST, "rb") as f:
    plist = plistlib.load(f)
plist["UIApplicationSceneManifest"] = {
    "UIApplicationSupportsMultipleScenes": False,
    "UISceneConfigurations": {
        "UIWindowSceneSessionRoleApplication": [{
            "UISceneConfigurationName": "Default Configuration",
            "UISceneDelegateClassName": "$(PRODUCT_MODULE_NAME).SceneDelegate",
            "UISceneStoryboardFile": "Main",
        }],
    },
}
plist.pop("UIMainStoryboardFile", None)
with open(PLIST, "wb") as f:
    plistlib.dump(plist, f)
print("Info.plist: scene manifest (Main storyboard)")

src = open(DELEGATE, encoding="utf-8").read()
if "class SceneDelegate" not in src:
    if "import Capacitor" not in src or "class AppDelegate" not in src:
        sys.exit("AppDelegate.swift doesn't look like Capacitor's: the scene life cycle wasn't added, and the app would not open")
    # The hook goes inside AppDelegate: before the closing brace of its class (the last "}" in the file,
    # since the other scripts only add methods inside it).
    end = src.rfind("}")
    hook = """
    // iOS 27 SDK: the app runs in a window scene (SceneDelegate, below).
    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        config.storyboard = UIStoryboard(name: "Main", bundle: nil)
        return config
    }
"""
    src = src[:end] + hook + src[end:]
    src += """

/// The app's one window. Main.storyboard makes it, with Capacitor's view controller in it.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // Opened from a link while closed: hand it on once the app is up.
        if let url = connectionOptions.urlContexts.first?.url {
            DispatchQueue.main.async { _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:]) }
        }
        if let activity = connectionOptions.userActivities.first(where: { $0.activityType == NSUserActivityTypeBrowsingWeb }) {
            DispatchQueue.main.async { _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: activity, restorationHandler: { _ in }) }
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for context in URLContexts {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: context.url, options: [:])
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }
}
"""
    open(DELEGATE, "w", encoding="utf-8").write(src)
print("AppDelegate: scene configuration and SceneDelegate added")
