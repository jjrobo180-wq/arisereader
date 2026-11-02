// Hands the widgets what to show. The app (JavaScript, client/src/lib/widgets.ts) sends up to three
// "slots"; they're saved where the widget extension can read them (an App Group named after the app's
// bundle id: group.<bundle id>) and the widgets are told to redraw.
//   publish({ slots: [{ title, value, detail?, tint?, until?, progress? }] }) -> {}
import Foundation
import Capacitor
import WidgetKit

@objc(AriseWidgetsPlugin)
public class AriseWidgetsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AriseWidgetsPlugin"
    public let jsName = "AriseWidgets"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "publish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeActions", returnType: CAPPluginReturnPromise)
    ]

    private var defaults: UserDefaults? { UserDefaults(suiteName: "group." + (Bundle.main.bundleIdentifier ?? "")) }

    /// Saves slots by their id (a slot sent again replaces the old one; others stay) and redraws the widgets.
    @objc func publish(_ call: CAPPluginCall) {
        guard let slots = call.getArray("slots") as? [[String: Any]], let defaults = defaults else {
            call.reject("The widgets' shared storage isn't available in this build.")
            return
        }
        var all: [String: Any] = [:]
        if let old = defaults.data(forKey: "slots"), let json = try? JSONSerialization.jsonObject(with: old) as? [String: Any] { all = json }
        for slot in slots {
            if let id = slot["id"] as? String, !id.isEmpty { all[id] = slot }
        }
        guard let data = try? JSONSerialization.data(withJSONObject: all) else {
            call.reject("slots must be plain data")
            return
        }
        defaults.set(data, forKey: "slots")
        if #available(iOS 14.0, *) { WidgetCenter.shared.reloadAllTimelines() }
        call.resolve()
    }

    /// The buttons tapped on a widget since the app last asked: [{ id, action, amount, at }]. Clears them.
    @objc func takeActions(_ call: CAPPluginCall) {
        guard let defaults = defaults else { call.resolve(["actions": []]); return }
        let pending = (defaults.array(forKey: "pending") as? [[String: Any]]) ?? []
        defaults.removeObject(forKey: "pending")
        call.resolve(["actions": pending])
    }
}
