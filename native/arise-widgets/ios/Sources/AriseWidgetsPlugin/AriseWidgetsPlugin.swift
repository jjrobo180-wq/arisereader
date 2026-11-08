// Hands the widgets what to show. The app (JavaScript, client/src/lib/widgets.ts) sends up to three
// "slots"; they're saved where the widget extension can read them (an App Group named after the app's
// bundle id: group.<bundle id>) and the widgets are told to redraw.
//   publish({ slots: [{ title, value, detail?, tint?, until?, progress? }] }) -> {}
import Foundation
import Capacitor
import UIKit
import WidgetKit

@objc(AriseWidgetsPlugin)
public class AriseWidgetsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AriseWidgetsPlugin"
    public let jsName = "AriseWidgets"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "publish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeActions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBackdrop", returnType: CAPPluginReturnPromise)
    ]

    override public func load() { AriseZoomLock.install(on: bridge?.webView) }

    private var defaults: UserDefaults? { UserDefaults(suiteName: "group." + (Bundle.main.bundleIdentifier ?? "")) }

    /// Saves slots by their id (a slot sent again replaces the old one; others stay) and redraws the widgets.
    /// Colors the areas around the page (behind the status bar and the Home indicator) to match the look.
    @objc func setBackdrop(_ call: CAPPluginCall) {
        let hex = (call.getString("color") ?? "").trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard hex.count == 6, let value = UInt32(hex, radix: 16) else { call.reject("Use a color like #2b2320."); return }
        let color = UIColor(red: CGFloat((value >> 16) & 255) / 255, green: CGFloat((value >> 8) & 255) / 255, blue: CGFloat(value & 255) / 255, alpha: 1)
        DispatchQueue.main.async { [weak self] in
            guard let webView = self?.bridge?.webView else { call.reject("The app isn't ready."); return }
            webView.isOpaque = false
            webView.backgroundColor = color
            webView.scrollView.backgroundColor = color
            webView.underPageBackgroundColor = color
            webView.superview?.backgroundColor = color
            self?.bridge?.viewController?.view.backgroundColor = color
            call.resolve()
        }
    }

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
