// The iPhone and the Apple Watch keep each other in step (WatchConnectivity):
//   phone -> watch  the library (shows you follow, saved, Pod Modes, resume spots), as the latest copy
//   watch -> phone  where you got to in each episode on the watch, queued until the phone takes it
// The phone hands it on to its web app with the car's spots (AriseCarPlayPlugin.takeSpots).
#if canImport(WatchConnectivity) && !os(tvOS)
import Foundation
import WatchConnectivity

public final class PodLink: NSObject, WCSessionDelegate {
    public static let shared = PodLink()
    private var started = false
    private var pendingLibrary: [String: Any]?

    /** Starts listening (both sides call this early). */
    public func start() {
        guard WCSession.isSupported(), !started else { return }
        started = true
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    #if os(iOS)
    /** Phone: the newest library goes to the watch (only the latest copy is kept on the way). */
    public func sendLibrary(_ raw: [String: Any]) {
        start()
        let s = WCSession.default
        guard s.activationState == .activated else { pendingLibrary = raw; return }
        guard s.isPaired, s.isWatchAppInstalled, let data = try? JSONSerialization.data(withJSONObject: raw) else { return }
        try? s.updateApplicationContext(["library": data])
    }
    #endif

    #if os(watchOS)
    /** Watch: the spots saved here go to the phone (delivered even if the phone app isn't running). */
    public func sendSpots() {
        start()
        let spots = PodStore.shared.takeSpots()
        guard !spots.isEmpty, let data = try? JSONEncoder().encode(spots) else { return }
        WCSession.default.transferUserInfo(["spots": data])
    }
    #endif

    // MARK: WCSessionDelegate

    public func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        #if os(iOS)
        if state == .activated, let raw = pendingLibrary { pendingLibrary = nil; sendLibrary(raw) }
        #endif
        #if os(watchOS)
        if let data = session.receivedApplicationContext["library"] as? Data { take(library: data) }
        #endif
    }

    public func session(_ session: WCSession, didReceiveApplicationContext ctx: [String: Any]) {
        if let data = ctx["library"] as? Data { take(library: data) }
    }

    public func session(_ session: WCSession, didReceiveUserInfo info: [String: Any] = [:]) {
        // On the phone: spots from the watch join the ones the web app will take.
        guard let data = info["spots"] as? Data, let spots = try? JSONDecoder().decode([String: PodSpot].self, from: data) else { return }
        PodStore.shared.addSpots(spots)
    }

    private func take(library data: Data) {
        guard let raw = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any], let lib = PodLibrary(json: raw) else { return }
        DispatchQueue.main.async { PodStore.shared.setLibrary(lib) }
    }

    #if os(iOS)
    public func sessionDidBecomeInactive(_ session: WCSession) {}
    public func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }
    #endif
}
#endif
