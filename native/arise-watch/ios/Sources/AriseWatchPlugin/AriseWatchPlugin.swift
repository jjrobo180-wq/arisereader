// The iPhone side of an Arise app's Apple Watch app (native/watch-kit + the app's own watch screens).
// The web app (client/src/lib/watch.ts) hands over what the watch shows — today's tasks, recent notes,
// today's activity — as one small JSON object; it goes to the watch as its application context (the
// watch always has the newest one, even if it was asleep). What's done on the watch (a task checked off,
// a note dictated, a workout finished) comes back as actions, kept here until the app takes them and
// also announced straight away ("watchAction") when the app is open.
//   publish({ payload })        -> {}
//   takeActions()               -> { actions: [{ type, ...fields, at }] }
//   status()                    -> { paired, installed, reachable }
import Foundation
import Capacitor
import WatchConnectivity

@objc(AriseWatchPlugin)
public class AriseWatchPlugin: CAPPlugin, CAPBridgedPlugin, WCSessionDelegate {
    public let identifier = "AriseWatchPlugin"
    public let jsName = "AriseWatch"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "publish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeActions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise)
    ]
    private let pendingKey = "arise.watch.pending"
    private let payloadKey = "arise.watch.payload"
    private var lastSent: Data?

    override public func load() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    @objc func publish(_ call: CAPPluginCall) {
        guard let payload = call.getObject("payload"),
              let data = try? JSONSerialization.data(withJSONObject: payload) else {
            call.reject("payload must be plain data")
            return
        }
        UserDefaults.standard.set(data, forKey: payloadKey)
        send(data)
        call.resolve()
    }

    @objc func takeActions(_ call: CAPPluginCall) {
        let defaults = UserDefaults.standard
        let pending = (defaults.array(forKey: pendingKey) as? [[String: Any]]) ?? []
        defaults.removeObject(forKey: pendingKey)
        call.resolve(["actions": pending])
    }

    @objc func status(_ call: CAPPluginCall) {
        guard WCSession.isSupported() else { call.resolve(["paired": false, "installed": false, "reachable": false]); return }
        let s = WCSession.default
        call.resolve(["paired": s.isPaired, "installed": s.isWatchAppInstalled, "reachable": s.isReachable])
    }

    private func send(_ data: Data) {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        guard s.activationState == .activated, s.isPaired, s.isWatchAppInstalled, data != lastSent else { return }
        do {
            try s.updateApplicationContext(["payload": data])
            lastSent = data
        } catch { /* tried again with the next change */ }
    }

    private func received(_ info: [String: Any]) {
        guard let action = info["action"] as? [String: Any], action["type"] is String else { return }
        var a = action
        if a["at"] == nil { a["at"] = Date().timeIntervalSince1970 * 1000 }
        let defaults = UserDefaults.standard
        var pending = (defaults.array(forKey: pendingKey) as? [[String: Any]]) ?? []
        pending.append(a)
        defaults.set(Array(pending.suffix(200)), forKey: pendingKey)
        DispatchQueue.main.async { self.notifyListeners("watchAction", data: [:]) }
    }

    // MARK: WCSessionDelegate
    public func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        if state == .activated, let data = UserDefaults.standard.data(forKey: payloadKey) { send(data) }
    }
    public func sessionDidBecomeInactive(_ session: WCSession) {}
    public func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }
    public func sessionWatchStateDidChange(_ session: WCSession) {
        lastSent = nil
        if let data = UserDefaults.standard.data(forKey: payloadKey) { send(data) }
    }
    public func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) { received(userInfo) }
    public func session(_ session: WCSession, didReceiveMessage message: [String: Any]) { received(message) }
    public func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        received(message)
        if message["wantPayload"] != nil, let data = UserDefaults.standard.data(forKey: payloadKey) { replyHandler(["payload": data]) }
        else { replyHandler([:]) }
    }
}
