// Hands the widgets what to show. The app (JavaScript, client/src/lib/widgets.ts) sends up to three
// "slots"; they're saved where the widget extension can read them (an App Group named after the app's
// bundle id: group.<bundle id>) and the widgets are told to redraw.
//   publish({ slots: [{ title, value, detail?, tint?, until?, progress?, items? }] }) -> {}
//   takeActions() -> { actions: [{ id, action, amount, at, item? }] }   (taps on widget buttons and checklists)
//   startFocus({ id, title, minutes, tint? }) -> { startedAt, endsAt }    (the focus timer's Live Activity)
//   stopFocus() -> {}     focusState() -> { id?, title?, startedAt?, endsAt? }
import Foundation
import Capacitor
import UIKit
import WidgetKit
#if canImport(ActivityKit)
import ActivityKit

/// The focus timer on the Lock Screen and in the Dynamic Island. The widget extension
/// (native/widget-extension/AriseWidgets.swift) has the same struct and draws it: iOS matches them by name.
@available(iOS 16.1, *)
struct DuoFocusAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var endsAt: Date
    }
    var taskId: String
    var title: String
    var tint: String
    var startedAt: Date
}
#endif

@objc(AriseWidgetsPlugin)
public class AriseWidgetsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AriseWidgetsPlugin"
    public let jsName = "AriseWidgets"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "publish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeActions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBackdrop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startFocus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopFocus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "focusState", returnType: CAPPluginReturnPromise)
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

    // MARK: Focus timer (Live Activity)

    /// Starts the focus timer for a task (any timer already running ends first).
    @objc func startFocus(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else { call.reject("The Lock Screen timer needs iOS 16.2 or newer."); return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.reject("Live Activities are turned off for this app. Turn them on in Settings, then try again.")
            return
        }
        let id = String((call.getString("id") ?? "").prefix(120))
        let title = String((call.getString("title") ?? "Focus").prefix(80))
        let minutes = max(1, min(240, call.getDouble("minutes") ?? 25))
        let tint = call.getString("tint") ?? "#7c6cf0"
        let start = Date()
        let end = start.addingTimeInterval(minutes * 60)
        Task {
            for old in Activity<DuoFocusAttributes>.activities { await old.end(nil, dismissalPolicy: .immediate) }
            do {
                _ = try Activity.request(attributes: DuoFocusAttributes(taskId: id, title: title, tint: tint, startedAt: start),
                                         content: ActivityContent(state: DuoFocusAttributes.ContentState(endsAt: end), staleDate: end),
                                         pushType: nil)
                call.resolve(["startedAt": start.timeIntervalSince1970 * 1000, "endsAt": end.timeIntervalSince1970 * 1000])
            } catch {
                call.reject("The Lock Screen timer couldn't start: \(error.localizedDescription)")
            }
        }
        #else
        call.reject("The Lock Screen timer isn't in this build.")
        #endif
    }

    /// Ends the focus timer (and takes it off the Lock Screen and the Dynamic Island).
    @objc func stopFocus(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        Task {
            for a in Activity<DuoFocusAttributes>.activities { await a.end(nil, dismissalPolicy: .immediate) }
            call.resolve()
        }
        #else
        call.resolve()
        #endif
    }

    /// The focus timer that's running, if any.
    @objc func focusState(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *), let a = Activity<DuoFocusAttributes>.activities.first(where: { $0.activityState == .active || $0.activityState == .stale }) else { call.resolve([:]); return }
        call.resolve(["id": a.attributes.taskId, "title": a.attributes.title,
                      "startedAt": a.attributes.startedAt.timeIntervalSince1970 * 1000,
                      "endsAt": a.content.state.endsAt.timeIntervalSince1970 * 1000])
        #else
        call.resolve([:])
        #endif
    }
}
