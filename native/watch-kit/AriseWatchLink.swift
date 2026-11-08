// The watch side of an Arise app's Apple Watch app. The iPhone app (native/arise-watch) sends one small
// JSON object with what to show; it's kept on the watch so the app opens instantly, even away from the
// phone. What's done on the watch goes back as actions (queued by the system until the phone is near),
// and is applied to the watch's copy at once so the screen doesn't wait for the phone.
import Foundation
import WatchConnectivity
import SwiftUI

@MainActor
final class AriseWatchLink: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = AriseWatchLink()
    @Published private(set) var payload: [String: Any] = [:]
    @Published private(set) var updated: Date?
    @Published private(set) var phoneNear = false
    private let key = "arise.watch.payload"

    override init() {
        super.init()
        if let data = UserDefaults.standard.data(forKey: key) { load(data, at: UserDefaults.standard.object(forKey: key + ".at") as? Date) }
    }

    func start() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    /** Asks the phone for the newest copy (when it's near). */
    func refresh() {
        let s = WCSession.default
        guard s.activationState == .activated, s.isReachable else { return }
        s.sendMessage(["wantPayload": true], replyHandler: { reply in
            if let data = reply["payload"] as? Data { Task { @MainActor in self.store(data) } }
        }, errorHandler: nil)
    }

    /** Something done on the watch, for the phone app to apply: ["type": "toggle", "id": "..."] and so on. */
    func send(_ action: [String: Any], change: (inout [String: Any]) -> Void = { _ in }) {
        var a = action
        a["at"] = Date().timeIntervalSince1970 * 1000
        var p = payload
        change(&p)
        payload = p
        if let data = try? JSONSerialization.data(withJSONObject: p) { UserDefaults.standard.set(data, forKey: key) }
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        if s.isReachable {
            s.sendMessage(["action": a], replyHandler: nil) { _ in s.transferUserInfo(["action": a]) }
        } else {
            s.transferUserInfo(["action": a])
        }
    }

    // Reading the payload
    func list(_ name: String) -> [[String: Any]] { payload[name] as? [[String: Any]] ?? [] }
    func text(_ name: String) -> String { payload[name] as? String ?? "" }
    func number(_ name: String) -> Double { (payload[name] as? NSNumber)?.doubleValue ?? 0 }

    private func store(_ data: Data) {
        UserDefaults.standard.set(data, forKey: key)
        UserDefaults.standard.set(Date(), forKey: key + ".at")
        load(data, at: Date())
    }
    private func load(_ data: Data, at: Date?) {
        if let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] { payload = obj; updated = at }
    }

    // MARK: WCSessionDelegate
    nonisolated func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        let ctx = session.receivedApplicationContext
        Task { @MainActor in
            self.phoneNear = session.isReachable
            if let data = ctx["payload"] as? Data { self.store(data) }
            self.refresh()
        }
    }
    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in self.phoneNear = session.isReachable; if session.isReachable { self.refresh() } }
    }
    nonisolated func session(_ session: WCSession, didReceiveApplicationContext ctx: [String: Any]) {
        if let data = ctx["payload"] as? Data { Task { @MainActor in self.store(data) } }
    }
}

/** "Updated 5 min ago" under a list, so it's clear how fresh the phone's copy is. */
struct AriseUpdatedNote: View {
    @ObservedObject var link = AriseWatchLink.shared
    var empty: String
    var body: some View {
        if link.updated == nil {
            Text(empty).font(.footnote).foregroundStyle(.secondary)
        } else if let at = link.updated {
            Text("From your iPhone \(at.formatted(.relative(presentation: .named)))").font(.caption2).foregroundStyle(.secondary)
        }
    }
}
