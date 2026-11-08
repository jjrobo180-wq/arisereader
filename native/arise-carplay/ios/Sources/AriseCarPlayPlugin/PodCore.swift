// Pod+ native core, shared by CarPlay (inside the iPhone app), the Apple Watch app and the Apple TV app.
// No Capacitor and no UIKit here, so the same file builds for iOS, watchOS and tvOS.
//
//   PodEp, PodShowRef, PodMode, PodSpot  what the web app keeps (shared/earshot.ts), in Swift
//   PodLibrary                            the listener's library the web app hands over (podscroll/carplay.ts)
//   PodStore                              where the library and the resume spots are kept on this device
//   PodAPI                                the Pod+ server's public routes (/api/podscroll, server/earshot.ts)
import Foundation

// MARK: - What Pod+ keeps

public struct PodEp: Codable, Hashable, Identifiable {
    public var id: String
    public var showId: String
    public var title: String
    public var show: String
    public var art: String
    public var audio: String
    public var secs: Double
    public var date: String?
    /** A live stream (a radio station): plays from wherever it is now, no seeking. */
    public var live: Bool?

    public init(id: String, showId: String, title: String, show: String, art: String, audio: String, secs: Double, date: String? = nil, live: Bool? = nil) {
        self.id = id; self.showId = showId; self.title = title; self.show = show; self.art = art; self.audio = audio; self.secs = secs; self.date = date; self.live = live
    }

    /** An episode someone made on Pod+ (its id is "77" and 12 digits): it plays straight from storage. */
    public var isOwn: Bool { id.count == 14 && id.hasPrefix("77") && id.allSatisfy(\.isNumber) }
    public var isLive: Bool { live == true }

    /** From the server's or the web app's JSON (fields can be missing or numbers as strings). */
    public init?(json: [String: Any]) {
        guard let id = PodJSON.str(json["id"]), !id.isEmpty else { return nil }
        self.id = id
        showId = PodJSON.str(json["showId"]) ?? ""
        title = PodJSON.str(json["title"]) ?? "Episode"
        show = PodJSON.str(json["show"]) ?? ""
        art = PodJSON.str(json["art"]) ?? ""
        audio = PodJSON.str(json["audio"]) ?? ""
        secs = PodJSON.num(json["secs"]) ?? 0
        date = PodJSON.str(json["date"])
        live = (json["live"] as? Bool) == true ? true : nil
    }
}

/** A show and its newest episodes, as the feed hands them out. */
public struct PodPool: Hashable {
    public var show: PodShowRef
    public var rank: Int
    public var episodes: [PodEp]
}

public struct PodShowRef: Codable, Hashable, Identifiable {
    public var id: String
    public var name: String
    public var author: String
    public var art: String
    public init(id: String, name: String, author: String = "", art: String = "") { self.id = id; self.name = name; self.author = author; self.art = art }
    public init?(json: [String: Any]) {
        guard let id = PodJSON.str(json["id"]), !id.isEmpty else { return nil }
        self.id = id
        name = PodJSON.str(json["name"]) ?? "Podcast"
        author = PodJSON.str(json["author"]) ?? ""
        art = PodJSON.str(json["art"]) ?? ""
    }
}

public struct PodMode: Codable, Hashable, Identifiable {
    public var id: String
    public var name: String
    public var episodes: [PodEp]
}

/** Where to pick an episode up (the web app's earshot.spots). `t` is in the ad-free copy's time when
 *  `c` is 1; otherwise in the original's, with `ct` the ad-free copy's time when it's known. */
public struct PodSpot: Codable, Hashable {
    public var t: Double
    public var secs: Double
    public var title: String
    public var show: String
    public var showId: String
    public var art: String
    /** Milliseconds since 1970. */
    public var at: Double
    public var c: Int?
    public var ct: Double?
    public var audio: String?

    /** Where to start in the copy about to play. */
    public func start(clean: Bool) -> Double {
        // An ad-free copy is shorter than the original: use its own time when it was saved in it.
        if clean { return c == 1 ? t : (ct ?? t) }
        return t
    }
}

/** The listener's library, as the web app last handed it over. */
public struct PodLibrary: Codable {
    public var api: String
    public var device: String
    public var session: String?
    public var speed: Double
    public var skipIntro: Bool
    public var genres: [String]
    public var follows: [PodShowRef]
    public var later: [PodEp]
    public var liked: [PodEp]
    public var modes: [PodMode]
    public var spots: [String: PodSpot]
    /** Milliseconds since 1970, when the web app sent it. */
    public var at: Double

    public static let defaultAPI = "https://arisereader.onrender.com"

    public init(api: String, device: String) {
        self.api = api; self.device = device; session = nil; speed = 1; skipIntro = true; genres = []
        follows = []; later = []; liked = []; modes = []; spots = [:]; at = 0
    }

    /** From what the web app sends (podscroll/carplay.ts carPlayLibrary). */
    public init?(json: [String: Any]) {
        guard let device = PodJSON.str(json["device"]), !device.isEmpty else { return nil }
        self.device = device
        api = (PodJSON.str(json["api"]) ?? Self.defaultAPI).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if api.isEmpty || !api.hasPrefix("https://") { api = Self.defaultAPI }
        session = PodJSON.str(json["session"]).flatMap { $0.isEmpty ? nil : $0 }
        speed = min(3, max(0.5, PodJSON.num(json["speed"]) ?? 1))
        skipIntro = (json["skipIntro"] as? Bool) ?? true
        genres = (json["genres"] as? [Any])?.compactMap { PodJSON.str($0) } ?? []
        follows = PodJSON.list(json["follows"]).compactMap { PodShowRef(json: $0) }
        later = PodJSON.list(json["later"]).compactMap { PodEp(json: $0) }
        liked = PodJSON.list(json["liked"]).compactMap { PodEp(json: $0) }
        modes = PodJSON.list(json["modes"]).compactMap { m in
            guard let id = PodJSON.str(m["id"]), let name = PodJSON.str(m["name"]) else { return nil }
            return PodMode(id: id, name: name, episodes: PodJSON.list(m["episodes"]).compactMap { PodEp(json: $0) })
        }
        var spots: [String: PodSpot] = [:]
        if let raw = json["spots"] as? [String: Any] {
            for (id, v) in raw {
                guard let s = v as? [String: Any], let t = PodJSON.num(s["t"]) else { continue }
                spots[id] = PodSpot(t: t, secs: PodJSON.num(s["secs"]) ?? 0, title: PodJSON.str(s["title"]) ?? "", show: PodJSON.str(s["show"]) ?? "",
                                    showId: PodJSON.str(s["showId"]) ?? "", art: PodJSON.str(s["art"]) ?? "", at: PodJSON.num(s["at"]) ?? 0,
                                    c: PodJSON.num(s["c"]) == 1 ? 1 : nil, ct: PodJSON.num(s["ct"]), audio: PodJSON.str(s["audio"]))
            }
        }
        self.spots = spots
        at = PodJSON.num(json["at"]) ?? Date().timeIntervalSince1970 * 1000
    }
}

enum PodJSON {
    static func str(_ v: Any?) -> String? {
        if let s = v as? String { return s }
        if let n = v as? NSNumber { return n.stringValue }
        return nil
    }
    static func num(_ v: Any?) -> Double? {
        if let n = v as? NSNumber { return n.doubleValue }
        if let s = v as? String { return Double(s) }
        return nil
    }
    static func list(_ v: Any?) -> [[String: Any]] { (v as? [Any])?.compactMap { $0 as? [String: Any] } ?? [] }
}

public extension Notification.Name {
    /** The library changed (the web app sent a new one). */
    static let podLibraryChanged = Notification.Name("PodLibraryChanged")
}

// MARK: - Kept on this device

/// The library and the resume spots. The web app's spots come with the library; spots saved here (in the
/// car, on the watch) are kept separately until the web app takes them (AriseCarPlayPlugin.takeSpots).
public final class PodStore {
    public static let shared = PodStore()
    private let defaults: UserDefaults
    private let lock = NSLock()
    private var cached: PodLibrary?

    public init(defaults: UserDefaults = .standard) { self.defaults = defaults }

    public var library: PodLibrary {
        lock.lock(); defer { lock.unlock() }
        if let c = cached { return c }
        if let data = defaults.data(forKey: "pod.library"), let lib = try? JSONDecoder().decode(PodLibrary.self, from: data) { cached = lib; return lib }
        // Never opened on the phone yet: a device id of its own until the web app sends its own.
        var id = defaults.string(forKey: "pod.device") ?? ""
        if id.count < 16 {
            id = UUID().uuidString.replacingOccurrences(of: "-", with: "")
            defaults.set(id, forKey: "pod.device")
        }
        let lib = PodLibrary(api: PodLibrary.defaultAPI, device: id)
        cached = lib
        return lib
    }

    public func setLibrary(_ lib: PodLibrary) {
        lock.lock()
        cached = lib
        if let data = try? JSONEncoder().encode(lib) { defaults.set(data, forKey: "pod.library") }
        lock.unlock()
        NotificationCenter.default.post(name: .podLibraryChanged, object: nil)
    }

    /** The signed-in account's email (TV and watch sign-in). */
    public var email: String? {
        get { defaults.string(forKey: "pod.email") }
        set { if let v = newValue { defaults.set(v, forKey: "pod.email") } else { defaults.removeObject(forKey: "pod.email") } }
    }

    /** Spots saved on this side, not yet handed to the web app. */
    public var ownSpots: [String: PodSpot] {
        guard let data = defaults.data(forKey: "pod.spots"), let s = try? JSONDecoder().decode([String: PodSpot].self, from: data) else { return [:] }
        return s
    }

    /** The newest spot for an episode, from either side. */
    public func spot(_ id: String) -> PodSpot? {
        let a = library.spots[id], b = ownSpots[id]
        guard let x = a else { return b }
        guard let y = b else { return x }
        return y.at >= x.at ? y : x
    }

    /** The newest spots from both sides, for Continue listening. */
    public func recentSpots(_ n: Int) -> [(String, PodSpot)] {
        var all = library.spots
        for (k, v) in ownSpots where (all[k]?.at ?? 0) < v.at { all[k] = v }
        return all.sorted { $0.value.at > $1.value.at }.prefix(n).map { ($0.key, $0.value) }
    }

    /** Saves where an episode got to (or forgets it near the start and the end, like the web app). */
    public func saveSpot(_ ep: PodEp, t: Double, length: Double, clean: Bool) {
        guard !ep.isLive else { return }
        lock.lock(); defer { lock.unlock() }
        var all = ownSpotsUnlocked()
        let end = length > 0 ? length : ep.secs
        if t < 15 || (end > 0 && t > end - 30) {
            all[ep.id] = PodSpot(t: 0, secs: end, title: ep.title, show: ep.show, showId: ep.showId, art: ep.art, at: Date().timeIntervalSince1970 * 1000, c: nil, ct: nil, audio: ep.audio)
        } else {
            all[ep.id] = PodSpot(t: floor(t), secs: max(end, ep.secs), title: ep.title, show: ep.show, showId: ep.showId, art: ep.art, at: Date().timeIntervalSince1970 * 1000, c: clean ? 1 : nil, ct: nil, audio: ep.audio)
        }
        let keep = all.sorted { $0.value.at > $1.value.at }.prefix(100)
        if let data = try? JSONEncoder().encode(Dictionary(uniqueKeysWithValues: keep.map { ($0.key, $0.value) })) { defaults.set(data, forKey: "pod.spots") }
    }

    private func ownSpotsUnlocked() -> [String: PodSpot] {
        guard let data = defaults.data(forKey: "pod.spots"), let s = try? JSONDecoder().decode([String: PodSpot].self, from: data) else { return [:] }
        return s
    }

    /** Spots from another device (the watch): kept with this side's, the newer one winning. */
    public func addSpots(_ spots: [String: PodSpot]) {
        lock.lock(); defer { lock.unlock() }
        var all = ownSpotsUnlocked()
        for (k, v) in spots where (all[k]?.at ?? 0) < v.at { all[k] = v }
        if let data = try? JSONEncoder().encode(all) { defaults.set(data, forKey: "pod.spots") }
    }

    /** Hands the spots saved here to the web app and forgets them (it keeps them from now on). A spot of
     *  t 0 means "finished or barely started": the web app removes its own. */
    public func takeSpots() -> [String: PodSpot] {
        lock.lock(); defer { lock.unlock() }
        let s = ownSpotsUnlocked()
        defaults.removeObject(forKey: "pod.spots")
        return s
    }
}

// MARK: - The Pod+ server

public struct PodAd: Hashable {
    public var key: String
    public var s: Double
    public var e: Double
    public var kind: String
    public var sure: Bool
    init?(json: [String: Any]) {
        guard let s = PodJSON.num(json["s"]), let e = PodJSON.num(json["e"]), e > s else { return nil }
        self.s = s; self.e = e
        key = PodJSON.str(json["key"]) ?? "\(s)-\(e)"
        kind = PodJSON.str(json["kind"]) ?? "ad"
        sure = (json["sure"] as? Bool) ?? false
    }
    /** Skipped by itself: ads it's sure of, ones listeners marked, stitched-in ones, and intros when that's on. */
    public func skips(intro: Bool) -> Bool {
        if kind == "intro" { return intro }
        if kind == "crowd" { return false }
        return sure || kind == "user" || kind == "dai" || kind == "splice" || kind == "known"
    }
}

public struct PodStation {
    public var slots: [(ep: PodEp, startsAt: Double, secs: Double)]
    public var now: Double
}

public enum PodError: LocalizedError {
    case server(String), offline
    public var errorDescription: String? {
        switch self {
        case .server(let m): return m
        case .offline: return "Can't reach Pod+ right now. Check your connection."
        }
    }
}

public final class PodAPI {
    public static let shared = PodAPI()
    private let http: URLSession
    private var token: (token: String, exp: Double, audio: String)?

    public init() {
        let c = URLSessionConfiguration.default
        c.timeoutIntervalForRequest = 20
        c.waitsForConnectivity = false
        http = URLSession(configuration: c)
    }

    private var lib: PodLibrary { PodStore.shared.library }
    public var base: String { lib.api }

    private func request(_ path: String, method: String = "GET", body: Any? = nil) -> URLRequest? {
        guard let url = URL(string: base + path) else { return nil }
        var r = URLRequest(url: url)
        r.httpMethod = method
        r.setValue(lib.device, forHTTPHeaderField: "X-Podscroll-Device")
        if let s = lib.session { r.setValue(s, forHTTPHeaderField: "X-Podscroll-Session") }
        if let body = body, let data = try? JSONSerialization.data(withJSONObject: body) {
            r.httpBody = data
            r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return r
    }

    /** A JSON call. A busy server (429 or 503) is asked again a couple of times, quietly. */
    public func json(_ path: String, method: String = "GET", body: Any? = nil) async throws -> [String: Any] {
        guard let req = request(path, method: method, body: body) else { throw PodError.server("That address isn't right.") }
        var attempt = 0
        while true {
            let data: Data, res: URLResponse
            do { (data, res) = try await http.data(for: req) } catch { throw PodError.offline }
            let status = (res as? HTTPURLResponse)?.statusCode ?? 0
            let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
            if (status == 429 || status == 503) && method == "GET" && attempt < 2 {
                attempt += 1
                try? await Task.sleep(nanoseconds: UInt64(1_500_000_000 * Double(attempt)))
                continue
            }
            if status < 200 || status >= 300 { throw PodError.server(PodJSON.str(obj["message"]) ?? "Something went wrong. Try again.") }
            return obj
        }
    }

    // Lists

    public func showEpisodes(_ showId: String) async throws -> [PodEp] {
        let b = try await json("/api/podscroll/show/\(showId.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? showId)")
        return PodJSON.list(b["episodes"]).compactMap { PodEp(json: $0) }
    }
    public func topShows(genre: String? = nil) async throws -> [PodShowRef] {
        let q = genre.map { "?genre=\($0.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? $0)" } ?? ""
        let b = try await json("/api/podscroll/top\(q)")
        return PodJSON.list(b["shows"]).compactMap { PodShowRef(json: $0) }
    }
    public func genreShows(_ genre: String) async throws -> [PodShowRef] {
        let b = try await json("/api/podscroll/genre/\(genre.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? genre)")
        return PodJSON.list(b["shows"]).compactMap { PodShowRef(json: $0) }
    }
    /** The shows for some genres, each with its newest episodes (the Pod+ home page and For You). */
    public func feed(genres: [String]) async throws -> [String: [PodPool]] {
        let g = genres.prefix(12).joined(separator: ",")
        let b = try await json("/api/podscroll/feed?genres=\(g.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? g)")
        var out: [String: [PodPool]] = [:]
        for (k, v) in (b["pools"] as? [String: Any]) ?? [:] {
            out[k] = PodJSON.list(v).compactMap { p in
                guard let sj = p["show"] as? [String: Any], let show = PodShowRef(json: sj) else { return nil }
                let eps = PodJSON.list(p["episodes"]).compactMap { e -> PodEp? in
                    guard var ep = PodEp(json: e) else { return nil }
                    if ep.art.isEmpty { ep.art = show.art }
                    if ep.show.isEmpty { ep.show = show.name }
                    if ep.showId.isEmpty { ep.showId = show.id }
                    return ep
                }
                return PodPool(show: show, rank: Int(PodJSON.num(p["rank"]) ?? 0), episodes: eps)
            }
        }
        return out
    }
    /** Up to the Minute News: news episodes from the last few hours, newest first. */
    public func news(hours: Int = 12) async throws -> [PodEp] {
        let b = try await json("/api/podscroll/now?hours=\(hours)")
        return PodJSON.list(b["episodes"]).compactMap { PodEp(json: $0) }
    }
    /** Open Mic: episodes people made, new and small creators first. */
    public func openMic(tab: String = "fresh") async throws -> [PodEp] {
        let b = try await json("/api/podscroll/creators/openmic?tab=\(tab)")
        return PodJSON.list(b["episodes"]).compactMap { item in
            guard var ep = (item["episode"] as? [String: Any]).flatMap({ PodEp(json: $0) }) else { return nil }
            if let name = PodJSON.str((item["creator"] as? [String: Any])?["name"]), ep.show.isEmpty { ep.show = name }
            return ep
        }
    }
    /** Live News Radio: what's on air now and next, with the server's clock (one station for everyone). */
    public func station() async throws -> PodStation {
        let b = try await json("/api/podscroll/now/station")
        let slots: [(ep: PodEp, startsAt: Double, secs: Double)] = PodJSON.list(b["slots"]).compactMap { s in
            guard let ep = (s["ep"] as? [String: Any]).flatMap({ PodEp(json: $0) }), let at = PodJSON.num(s["startsAt"]) else { return nil }
            return (ep, at, PodJSON.num(s["secs"]) ?? ep.secs)
        }
        return PodStation(slots: slots, now: PodJSON.num(b["now"]) ?? Date().timeIntervalSince1970 * 1000)
    }

    /** Podcasts and episodes matching some words. */
    public func search(_ q: String) async throws -> (shows: [PodShowRef], episodes: [PodEp]) {
        let b = try await json("/api/podscroll/search?q=\(q.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? q)")
        return (PodJSON.list(b["shows"]).compactMap { PodShowRef(json: $0) }, PodJSON.list(b["episodes"]).compactMap { PodEp(json: $0) })
    }

    // Signing in (Pod+ account: an email and a 6-digit code) and the account's library

    public func sendCode(email: String) async throws {
        _ = try await json("/api/podscroll/account/code", method: "POST", body: ["email": email])
    }
    /** Checks the code; on success this device is signed in (the session is kept in the library). */
    public func verify(email: String, code: String) async throws {
        let b = try await json("/api/podscroll/account/verify", method: "POST", body: ["email": email, "code": code])
        guard let token = PodJSON.str(b["token"]), !token.isEmpty else { throw PodError.server("That didn't work. Try again.") }
        var lib = PodStore.shared.library
        lib.session = token
        PodStore.shared.setLibrary(lib)
        PodStore.shared.email = PodJSON.str(b["email"]) ?? email
        _ = try? await syncLibrary()
    }
    public func signOut() {
        Task { _ = try? await json("/api/podscroll/account/signout", method: "POST") }
        var lib = PodLibrary(api: PodStore.shared.library.api, device: PodStore.shared.library.device)
        lib.session = nil
        PodStore.shared.setLibrary(lib)
        PodStore.shared.email = nil
    }
    /** The library the account's phone last saved on the server (shows followed, saved, Pod Modes,
     *  resume spots), kept here with this device's own sign-in. */
    @discardableResult
    public func syncLibrary() async throws -> Bool {
        guard PodStore.shared.library.session != nil else { return false }
        let b = try await json("/api/podscroll/account/library")
        guard var raw = b["library"] as? [String: Any] else { return false }
        let mine = PodStore.shared.library
        raw["device"] = mine.device
        raw["session"] = mine.session ?? ""
        raw["api"] = mine.api
        guard let lib = PodLibrary(json: raw) else { return false }
        PodStore.shared.setLibrary(lib)
        return true
    }

    // Playing without ads (server/podcastClean.ts, server/podcastPlay.ts)

    /** The episode's ad-free copy, when it has one: its address, its session id and the ads still in it. */
    public func clean(_ ep: PodEp) async -> (url: URL, sid: String, ads: [PodAd])? {
        guard let b = try? await json("/api/podscroll/clean/\(ep.id)?s=\(ep.showId)"), (b["ready"] as? Bool) == true,
              let u = PodJSON.str(b["url"]).flatMap(URL.init(string:)), let sid = PodJSON.str(b["sid"]) else { return nil }
        return (u, sid, PodJSON.list(b["ads"]).compactMap { PodAd(json: $0) })
    }
    /** Asks the server to make these ad-free before they're played (up to 8). */
    public func prepare(_ eps: [PodEp]) {
        let list = eps.filter { !$0.isOwn && !$0.isLive && !$0.showId.isEmpty }.prefix(8).map { ["id": $0.id, "showId": $0.showId, "audio": $0.audio] }
        guard !list.isEmpty else { return }
        Task { _ = try? await json("/api/podscroll/clean/prepare", method: "POST", body: ["episodes": Array(list)]) }
    }
    /** An address that plays the episode through the server, where its ads are found in this copy. */
    public func sessionURL(_ ep: PodEp, sid: String) async -> URL? {
        let now = Date().timeIntervalSince1970
        if token == nil || token!.exp - now < 30 * 60 {
            guard let b = try? await json("/api/podscroll/play-token"), let t = PodJSON.str(b["token"]) else { return nil }
            token = (t, PodJSON.num(b["exp"]) ?? now + 3600, (PodJSON.str(b["audio"]) ?? "/api/earshot/audio/").replacingOccurrences(of: "/api/earshot", with: "/api/podscroll"))
        }
        guard let t = token else { return nil }
        var c = URLComponents(string: base + t.audio + sid)
        c?.queryItems = [URLQueryItem(name: "e", value: ep.id), URLQueryItem(name: "s", value: ep.showId), URLQueryItem(name: "k", value: t.token), URLQueryItem(name: "u", value: ep.audio)]
        return c?.url
    }
    /** The ads found so far in a session's copy, and whether that's final. */
    public func sessionAds(sid: String, ep: PodEp) async -> (ads: [PodAd], final: Bool)? {
        guard let b = try? await json("/api/podscroll/play/\(sid)/ads?e=\(ep.id)&s=\(ep.showId)") else { return nil }
        let pending = (b["pending"] as? Bool) == true
        return (PodJSON.list(b["ads"]).compactMap { PodAd(json: $0) }, (b["final"] as? Bool) == true && !pending)
    }

    // Radio (the free Radio Browser directory, as podscroll/Radio.tsx uses it)

    private static let radioServers = ["https://de1.api.radio-browser.info", "https://de2.api.radio-browser.info", "https://fi1.api.radio-browser.info"]
    private static let networks = try? NSRegularExpression(pattern: "\\b(cnn|hln|fox ?news|fox business|msnbc|cnbc|nbc news|abc news|cbs news|bbc|npr news|npr 24|bloomberg|sky news|c-?span|al ?jazeera|reuters|cbc news|espn|siriusxm|sirius|iheart|newsmax|one america|oan)\\b", options: [.caseInsensitive])

    /** Stations people can play here: https streams, no playlists, no national networks (they only
     *  license their streams to their own apps). `tag` narrows them ("news", "talk", "sports"...). */
    public func stations(tag: String? = nil, country: String = Locale.current.regionCode ?? "US", limit: Int = 40) async -> [PodEp] {
        var q = "/json/stations/search?hidebroken=true&is_https=true&order=clickcount&reverse=true&limit=\(limit * 2)"
        if let tag = tag { q += "&tag=\(tag.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? tag)" }
        else { q += "&countrycode=\(country)" }
        for server in Self.radioServers {
            guard let url = URL(string: server + q), let (data, _) = try? await http.data(from: url),
                  let list = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]] else { continue }
            return list.compactMap { s -> PodEp? in
                guard let id = PodJSON.str(s["stationuuid"]), let stream = PodJSON.str(s["url_resolved"]), stream.hasPrefix("https://"),
                      !stream.lowercased().contains(".m3u8"), (PodJSON.num(s["hls"]) ?? 0) == 0 else { return nil }
                let name = (PodJSON.str(s["name"]) ?? "Station").trimmingCharacters(in: .whitespacesAndNewlines)
                let tags = PodJSON.str(s["tags"]) ?? ""
                let range = NSRange(location: 0, length: (name + " " + tags).utf16.count)
                if Self.networks?.firstMatch(in: name + " " + tags, range: range) != nil { return nil }
                let place = [PodJSON.str(s["state"]), PodJSON.str(s["countrycode"])].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
                return PodEp(id: "radio-\(id)", showId: "", title: name.isEmpty ? "Station" : name, show: place.isEmpty ? "Live radio" : place, art: PodJSON.str(s["favicon"]) ?? "", audio: stream, secs: 0, live: true)
            }.prefix(limit).map { $0 }
        }
        return []
    }
}
