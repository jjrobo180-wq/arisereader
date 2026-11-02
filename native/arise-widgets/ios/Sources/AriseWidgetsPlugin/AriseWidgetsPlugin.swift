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
        CAPPluginMethod(name: "publish", returnType: CAPPluginReturnPromise)
    ]

    @objc func publish(_ call: CAPPluginCall) {
        guard let slots = call.getArray("slots"), JSONSerialization.isValidJSONObject(slots) else {
            call.reject("slots must be a list")
            return
        }
        guard let data = try? JSONSerialization.data(withJSONObject: slots),
              let defaults = UserDefaults(suiteName: "group." + (Bundle.main.bundleIdentifier ?? "")) else {
            call.reject("The widgets' shared storage isn't available in this build.")
            return
        }
        defaults.set(data, forKey: "slots")
        if #available(iOS 14.0, *) { WidgetCenter.shared.reloadAllTimelines() }
        call.resolve()
    }
}
