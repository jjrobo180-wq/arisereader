// The Pod+ web app's way in to CarPlay (podscroll/carplay.ts calls this).
//   setLibrary({ library })  what to show in the car: follows, saved, liked, Pod Modes, resume spots
//   takeSpots()              -> { spots: { [episodeId]: spot } } saved in the car since last asked (then forgotten here)
//   stop()                   the phone started playing something: the car's player stops
//   status()                 -> { playing, episode? }
// Event "nativePlay" { id, title }: the car started playing; the phone pauses its own player.
import Foundation
import Capacitor

@objc(AriseCarPlayPlugin)
public class AriseCarPlayPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AriseCarPlayPlugin"
    public let jsName = "AriseCarPlay"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setLibrary", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeSpots", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
    ]

    override public func load() {
        #if os(iOS) && canImport(CarPlay)
        // Keeps the car's scene in the app (iOS looks it up by name when a car connects).
        _ = PodCarPlaySceneDelegate.self
        #endif
        DispatchQueue.main.async { [weak self] in
            MainActor.assumeIsolated {
                PodEngine.shared.onStart = { [weak self] in
                    let ep = PodEngine.shared.current
                    self?.notifyListeners("nativePlay", data: ["id": ep?.id ?? "", "title": ep?.title ?? ""])
                }
            }
        }
    }

    @objc func setLibrary(_ call: CAPPluginCall) {
        guard let raw = call.getObject("library"), let lib = PodLibrary(json: raw) else { call.reject("library must have a device id"); return }
        PodStore.shared.setLibrary(lib)
        call.resolve()
    }

    @objc func takeSpots(_ call: CAPPluginCall) {
        var out: [String: Any] = [:]
        for (id, s) in PodStore.shared.takeSpots() {
            var v: [String: Any] = ["t": s.t, "secs": s.secs, "title": s.title, "show": s.show, "showId": s.showId, "art": s.art, "at": s.at]
            if s.c == 1 { v["c"] = 1 }
            out[id] = v
        }
        call.resolve(["spots": out])
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            MainActor.assumeIsolated { if PodEngine.shared.playing { PodEngine.shared.pause() } }
            call.resolve()
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            MainActor.assumeIsolated {
                let e = PodEngine.shared
                var r: [String: Any] = ["playing": e.playing]
                if let ep = e.current { r["episode"] = ["id": ep.id, "title": ep.title, "show": ep.show, "t": e.position] }
                call.resolve(r)
            }
        }
    }
}
