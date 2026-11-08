// Pod+ for Apple TV, made to look and work like Pod+ itself (podscroll/): the same white-and-orange home
// with the Pod+ mark, Pod Modes as circles with their LIVE / ON AIR / FRESH badges, big cover-art rows for
// each topic, and the swipe feed — a full-screen card per show, the cover art blurred behind everything,
// the art itself drifting while it plays, the title, the show, a progress bar with the ads marked and the
// player controls. On the remote: swipe up or down for the next or last show, left or right to go back
// 15 or ahead 30 seconds, click or Play/Pause to pause, click and hold for Like, Save, Follow, the show's
// episodes, speed and the sleep timer, Menu to go back.
// Playback is the same native player as CarPlay (native/arise-carplay: PodEngine — ad-free, picks up where
// you left off). Night or day follows the Apple TV's own appearance setting, like Pod+'s Auto.
import SwiftUI
import UIKit

@main
struct PodTVApp: App {
    @StateObject private var model = PodTVModel()
    var body: some Scene {
        WindowGroup {
            PodTVRoot().environmentObject(model)
                // For screenshots: `-podtvLook dark|light` (otherwise the Apple TV's own setting).
                .preferredColorScheme(UserDefaults.standard.string(forKey: "podtvLook") == "dark" ? .dark : UserDefaults.standard.string(forKey: "podtvLook") == "light" ? .light : nil)
        }
    }
}

// MARK: - Look

enum Pod {
    static let orange = Color(hex: 0xff6a1f)
    static let accent = Color(hex: 0xff8a3d)
    static let ink = Color(UIColor { $0.userInterfaceStyle == .dark ? .white : UIColor(red: 0.067, green: 0.063, blue: 0.075, alpha: 1) })
    static let page = Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.055, green: 0.051, blue: 0.063, alpha: 1) : .white })
    static let soft = Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(white: 1, alpha: 0.6) : UIColor(red: 0.42, green: 0.42, blue: 0.45, alpha: 1) })
    static let line = Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(white: 1, alpha: 0.12) : UIColor(red: 0.91, green: 0.9, blue: 0.92, alpha: 1) })
    static let peach = Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.2, green: 0.12, blue: 0.08, alpha: 1) : UIColor(red: 1, green: 0.95, blue: 0.92, alpha: 1) })
    static let genreColors: [String: UInt32] = ["comedy": 0xf59e0b, "truecrime": 0x7f1d1d, "news": 0x1e3a8a, "politics": 0x334155, "science": 0x0e7490, "tech": 0x4338ca, "business": 0x166534, "money": 0x15803d, "history": 0x92400e, "sports": 0xb91c1c, "health": 0xdc2626, "mental": 0x7c3aed, "culture": 0xbe185d, "arts": 0xc026d3, "books": 0xa16207, "music": 0xdb2777, "film": 0x9333ea, "education": 0x2563eb, "kids": 0x0891b2, "fiction": 0x4c1d95, "horror": 0x111827, "faith": 0xca8a04, "gaming": 0x16a34a, "food": 0xe11d48, "travel": 0x0284c7, "nature": 0x4d7c0f, "growth": 0xd97706]
    static let genreNames: [String: String] = ["comedy": "Comedy", "truecrime": "True Crime", "news": "News", "politics": "Politics", "science": "Science", "tech": "Technology", "business": "Business", "money": "Money", "history": "History", "sports": "Sports", "health": "Health & Fitness", "mental": "Mental Health", "culture": "Society & Culture", "arts": "Arts & Design", "books": "Books", "music": "Music", "film": "TV & Film", "education": "Education", "kids": "Kids & Family", "fiction": "Fiction & Drama", "horror": "Horror & Paranormal", "faith": "Faith & Spirituality", "gaming": "Gaming", "food": "Food", "travel": "Travel", "nature": "Nature", "growth": "Self-Improvement"]
    static let defaultGenres = ["news", "comedy", "truecrime", "history", "science", "tech", "sports", "culture"]

    static func clock(_ t: Double) -> String {
        let s = Int(max(0, t.isFinite ? t : 0)); let h = s / 3600, m = (s % 3600) / 60, r = s % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, r) : String(format: "%d:%02d", m, r)
    }
    static func length(_ secs: Double) -> String {
        guard secs > 0 else { return "" }
        let m = Int((secs / 60).rounded())
        return m >= 60 ? "\(m / 60) hr \(m % 60) min" : "\(max(1, m)) min"
    }
    static func ago(_ iso: String?) -> String {
        guard let iso, let d = ISO8601DateFormatter.pod.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else { return "" }
        let s = Date().timeIntervalSince(d)
        if s < 3600 { return "\(max(1, Int(s / 60))) minutes ago" }
        if s < 86400 { let h = Int(s / 3600); return h == 1 ? "1 hour ago" : "\(h) hours ago" }
        if s < 86400 * 30 { let n = Int(s / 86400); return n == 1 ? "1 day ago" : "\(n) days ago" }
        return d.formatted(.dateTime.month(.abbreviated).day().year())
    }
}

extension Color {
    init(hex: UInt32) { self.init(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255) }
}
extension ISO8601DateFormatter {
    static let pod: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
}

/** The Pod+ mark: the orange tile with the sound bars, and the name. */
struct PodLogo: View {
    var size: CGFloat = 52
    var body: some View {
        HStack(spacing: size * 0.28) {
            RoundedRectangle(cornerRadius: size * 0.26)
                .fill(LinearGradient(colors: [Pod.accent, Pod.orange], startPoint: .top, endPoint: .bottom))
                .frame(width: size * 1.1, height: size)
                .overlay {
                    HStack(spacing: size * 0.09) {
                        ForEach([0.3, 0.6, 0.85, 0.55, 0.3], id: \.self) { h in Capsule().fill(.white).frame(width: size * 0.08, height: size * h) }
                    }
                }
            Text("Pod+").font(.system(size: size * 0.95, weight: .heavy)).foregroundStyle(Pod.ink)
        }
    }
}

/** Lifts what's in focus, like Pod+'s hover, without the system's white platter. */
struct PodLift: ButtonStyle {
    var scale: CGFloat = 1.07
    func makeBody(configuration: Configuration) -> some View { PodLiftBody(configuration: configuration, scale: scale) }
}
private struct PodLiftBody: View {
    let configuration: ButtonStyle.Configuration
    let scale: CGFloat
    @Environment(\.isFocused) private var focused
    var body: some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale * 0.97 : focused ? scale : 1)
            .shadow(color: .black.opacity(focused ? 0.35 : 0), radius: focused ? 30 : 0, y: focused ? 18 : 0)
            .animation(.spring(response: 0.3, dampingFraction: 0.75), value: focused)
    }
}
/** A capsule button in Pod+'s style: black (or orange) filled, or outlined. */
struct PodPill: ButtonStyle {
    var filled: Color? = nil
    func makeBody(configuration: Configuration) -> some View { PodPillBody(configuration: configuration, filled: filled) }
}
private struct PodPillBody: View {
    let configuration: ButtonStyle.Configuration
    let filled: Color?
    @Environment(\.isFocused) private var focused
    var body: some View {
        configuration.label
            .font(.system(size: 30, weight: .bold))
            .padding(.horizontal, 40).padding(.vertical, 20)
            .foregroundStyle(filled != nil || focused ? Color.white : Pod.ink)
            .background(Capsule().fill(focused ? Pod.orange : (filled ?? Color.clear)))
            .overlay(Capsule().stroke(filled == nil && !focused ? Pod.line : .clear, lineWidth: 3))
            .scaleEffect(focused ? 1.06 : 1)
            .animation(.spring(response: 0.3), value: focused)
    }
}

/** Cover art from a podcast's server, at the size it's shown. */
struct PodArtView: View {
    let url: String
    var px: Int = 600
    var radius: CGFloat = 22
    var body: some View {
        AsyncImage(url: URL(string: PodArt.sized(url, px))) { phase in
            if let img = phase.image { img.resizable().scaledToFill() }
            else { LinearGradient(colors: [Pod.orange.opacity(0.35), Pod.orange.opacity(0.1)], startPoint: .topLeading, endPoint: .bottomTrailing) }
        }
        .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
    }
}

// MARK: - Model

/** What the player opens with: a list and where in it. */
struct PodTVPlay: Identifiable {
    let id = UUID()
    let title: String
    let list: [PodEp]
    let start: Int
    var section: PodTVSection? = nil
}
enum PodTVSection: String, CaseIterable, Identifiable {
    case forYou = "For You", following = "Following", news = "News"
    var id: String { rawValue }
}

struct PodTVRow: Identifiable, Hashable {
    let id: String
    let name: String
    let color: Color
    let episodes: [PodEp]
}

@MainActor
final class PodTVModel: ObservableObject {
    @Published var lib = PodStore.shared.library
    @Published var rows: [PodTVRow] = []
    @Published var pools: [String: [PodPool]] = [:]
    @Published var loading = true
    @Published var error: String?
    @Published var player: PodTVPlay?
    /** Liked, saved and followed on this TV (added to what comes from the account). */
    @Published var mine = PodTVMine.load()
    private var watcher: NSObjectProtocol?

    init() {
        watcher = NotificationCenter.default.addObserver(forName: .podLibraryChanged, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.lib = PodStore.shared.library }
        }
        Task {
            _ = try? await PodAPI.shared.syncLibrary(); await load()
            // For screenshots and checks: `-podtvSwipe YES` opens the swipe feed (and `-podtvTab n` a tab).
            if UserDefaults.standard.bool(forKey: "podtvSwipe") { openSection(.forYou) }
        }
    }

    var signedIn: Bool { lib.session != nil }
    var genres: [String] { lib.genres.isEmpty ? Pod.defaultGenres : Array(lib.genres.prefix(10)) }
    var follows: [PodShowRef] { var seen = Set<String>(); return (mine.follows + lib.follows).filter { seen.insert($0.id).inserted } }
    var later: [PodEp] { var seen = Set<String>(); return (mine.later + lib.later).filter { seen.insert($0.id).inserted } }
    var liked: [PodEp] { var seen = Set<String>(); return (mine.liked + lib.liked).filter { seen.insert($0.id).inserted } }
    var continueListening: [PodEp] {
        PodStore.shared.recentSpots(30).filter { $0.1.t > 30 && $0.1.secs - $0.1.t > 60 }.prefix(15).map { pair in
            PodEp(id: pair.0, showId: pair.1.showId, title: pair.1.title, show: pair.1.show, art: pair.1.art, audio: pair.1.audio ?? "", secs: pair.1.secs)
        }
    }

    func load() async {
        loading = true
        do {
            let p = try await PodAPI.shared.feed(genres: genres)
            pools = p
            rows = genres.compactMap { g in
                let eps = (p[g] ?? []).sorted { $0.rank < $1.rank }.compactMap { $0.episodes.first }
                return eps.isEmpty ? nil : PodTVRow(id: g, name: Pod.genreNames[g] ?? g.capitalized, color: Color(hex: Pod.genreColors[g] ?? 0xff6a1f), episodes: Array(eps.prefix(24)))
            }
            error = rows.isEmpty ? "Podcasts aren't loading right now. Try again in a minute." : nil
        } catch {
            self.error = "Can't reach Pod+. Check the Apple TV's internet connection."
        }
        loading = false
    }

    /** For You: one newest episode from each show, taking turns between your topics, like Pod+'s feed. */
    func forYou() -> [PodEp] {
        var lists = genres.map { g in (pools[g] ?? []).sorted { $0.rank < $1.rank } }
        var out: [PodEp] = [], seen = Set<String>()
        var round = 0
        while out.count < 120 && round < 40 {
            var any = false
            for i in lists.indices where round < lists[i].count {
                any = true
                let pool = lists[i][round]
                guard seen.insert(pool.show.id).inserted, let ep = pool.episodes.first(where: { PodStore.shared.spot($0.id).map { $0.t == 0 && $0.secs > 0 } != true }) ?? pool.episodes.first else { continue }
                out.append(ep)
            }
            if !any { break }
            round += 1
        }
        lists.removeAll()
        return out
    }

    func following() async -> [PodEp] {
        let shows = Array(follows.prefix(30))
        let lists: [[PodEp]] = await withTaskGroup(of: [PodEp].self) { g in
            for s in shows { g.addTask { Array(((try? await PodAPI.shared.showEpisodes(s.id)) ?? []).prefix(1)) } }
            var all: [[PodEp]] = []
            for await l in g { all.append(l) }
            return all
        }
        return lists.flatMap { $0 }.sorted { ($0.date ?? "") > ($1.date ?? "") }
    }

    func open(_ title: String, _ list: [PodEp], at i: Int = 0) { player = PodTVPlay(title: title, list: list, start: i) }
    func openSection(_ s: PodTVSection) { player = PodTVPlay(title: s.rawValue, list: [], start: 0, section: s) }

    func toggleLike(_ ep: PodEp) { mine.liked.contains(where: { $0.id == ep.id }) ? mine.liked.removeAll { $0.id == ep.id } : mine.liked.insert(ep, at: 0); mine.save() }
    func toggleLater(_ ep: PodEp) { mine.later.contains(where: { $0.id == ep.id }) ? mine.later.removeAll { $0.id == ep.id } : mine.later.insert(ep, at: 0); mine.save() }
    func toggleFollow(_ s: PodShowRef) { mine.follows.contains(where: { $0.id == s.id }) ? mine.follows.removeAll { $0.id == s.id } : mine.follows.insert(s, at: 0); mine.save() }
    func isLiked(_ ep: PodEp) -> Bool { liked.contains { $0.id == ep.id } }
    func isSaved(_ ep: PodEp) -> Bool { later.contains { $0.id == ep.id } }
    func isFollowing(_ id: String) -> Bool { follows.contains { $0.id == id } }
}

struct PodTVMine: Codable {
    var liked: [PodEp] = []
    var later: [PodEp] = []
    var follows: [PodShowRef] = []
    static func load() -> PodTVMine {
        guard let d = UserDefaults.standard.data(forKey: "podtv.mine"), let m = try? JSONDecoder().decode(PodTVMine.self, from: d) else { return PodTVMine() }
        return m
    }
    func save() { if let d = try? JSONEncoder().encode(self) { UserDefaults.standard.set(d, forKey: "podtv.mine") } }
}

// MARK: - Root

struct PodTVRoot: View {
    @EnvironmentObject var model: PodTVModel
    @State private var tab = UserDefaults.standard.integer(forKey: "podtvTab")
    var body: some View {
        TabView(selection: $tab) {
            PodTVHome().tabItem { Text("Home") }.tag(0)
            PodTVSwipeStart().tabItem { Text("Swipe feed") }.tag(1)
            PodTVRadio().tabItem { Text("Radio") }.tag(2)
            PodTVLibrary().tabItem { Text("Library") }.tag(3)
            PodTVSearch().tabItem { Text("Search") }.tag(4)
        }
        .background(Pod.page.ignoresSafeArea())
        .fullScreenCover(item: $model.player) { p in PodTVSwipe(play: p).environmentObject(model) }
    }
}

/** The Swipe feed tab: For You, Following or News, each opening the full-screen feed. */
struct PodTVSwipeStart: View {
    @EnvironmentObject var model: PodTVModel
    var body: some View {
        VStack(alignment: .leading, spacing: 50) {
            PodLogo()
            Text("Swipe feed").font(.system(size: 80, weight: .heavy)).foregroundStyle(Pod.ink)
            Text("One show at a time, full screen. It starts playing by itself; swipe up or down on the remote for the next show.").font(.system(size: 30)).foregroundStyle(Pod.soft).lineLimit(3).fixedSize(horizontal: false, vertical: true).frame(maxWidth: 1500, alignment: .leading)
            HStack(spacing: 40) {
                ForEach(PodTVSection.allCases) { s in
                    Button { model.openSection(s) } label: {
                        VStack(alignment: .leading, spacing: 16) {
                            Image(systemName: s == .forYou ? "sparkles" : s == .following ? "person.2.fill" : "bolt.fill").font(.system(size: 60, weight: .semibold))
                            Text(s.rawValue).font(.system(size: 44, weight: .heavy))
                            Text(s == .forYou ? "Your topics, a new show each swipe" : s == .following ? "The newest from shows you follow" : "Only the last few hours of news").font(.system(size: 24)).opacity(0.8)
                        }
                        .foregroundStyle(.white)
                        .padding(44)
                        .frame(width: 520, height: 340, alignment: .bottomLeading)
                        .background(RoundedRectangle(cornerRadius: 36, style: .continuous).fill(LinearGradient(colors: s == .forYou ? [Pod.accent, Pod.orange] : s == .following ? [Color(hex: 0x1f2937), Color(hex: 0x0b0b0e)] : [Color(hex: 0x1e3a8a), Color(hex: 0x0b1220)], startPoint: .topLeading, endPoint: .bottomTrailing)))
                    }
                    .buttonStyle(PodLift(scale: 1.05))
                }
            }
            Spacer()
        }
        .padding(.horizontal, 90).padding(.vertical, 50)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Pod.page.ignoresSafeArea())
    }
}

// MARK: - Home

struct PodTVHome: View {
    @EnvironmentObject var model: PodTVModel
    @ObservedObject private var engine = PodEngine.shared
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 56) {
                    HStack(spacing: 30) {
                        PodLogo()
                        Spacer()
                        if let ep = engine.current {
                            Button { model.open(ep.show, engine.queue, at: engine.index) } label: {
                                HStack(spacing: 16) {
                                    PodArtView(url: ep.art, px: 120, radius: 10).frame(width: 56, height: 56)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(engine.playing ? "Now playing" : "Paused").font(.system(size: 20, weight: .bold)).foregroundStyle(Pod.orange)
                                        Text(ep.title).font(.system(size: 24, weight: .semibold)).lineLimit(1).frame(maxWidth: 420, alignment: .leading)
                                    }
                                }
                            }
                            .buttonStyle(PodPill())
                        }
                        Button { model.openSection(.forYou) } label: { Label("Swipe feed", systemImage: "rectangle.stack") }.buttonStyle(PodPill())
                    }
                    PodTicker()
                    PodTVModes()
                    if !model.continueListening.isEmpty {
                        PodTVEpisodeRow(title: "Continue listening", color: Pod.orange, episodes: model.continueListening, progress: true)
                    }
                    if model.loading && model.rows.isEmpty { ProgressView().frame(maxWidth: .infinity).padding(80) }
                    if let e = model.error, model.rows.isEmpty {
                        VStack(spacing: 20) { Text(e).foregroundStyle(Pod.soft); Button("Try again") { Task { await model.load() } }.buttonStyle(PodPill()) }.frame(maxWidth: .infinity)
                    }
                    ForEach(model.rows) { row in PodTVEpisodeRow(title: row.name, color: row.color, episodes: row.episodes) }
                }
                .padding(.horizontal, 90).padding(.vertical, 50)
            }
            .background(Pod.page.ignoresSafeArea())
            .navigationDestination(for: PodShowRef.self) { PodTVShowPage(show: $0) }
            .navigationDestination(for: PodMode.self) { PodTVModePage(mode: $0) }
        }
    }
}

/** The black strip under the header: what Pod+ is about. */
struct PodTicker: View {
    var body: some View {
        HStack(spacing: 28) {
            Text("Your taste, not view counts.").foregroundStyle(Pod.accent)
            Text("It keeps playing.").foregroundStyle(.white)
            Text("No ads stacked on ads.").foregroundStyle(.white.opacity(0.75))
            Spacer(minLength: 0)
        }
        .font(.system(size: 28, weight: .bold))
        .padding(.horizontal, 40).padding(.vertical, 24)
        .background(Capsule().fill(Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(white: 0.16, alpha: 1) : UIColor(red: 0.067, green: 0.063, blue: 0.075, alpha: 1) })))
        .overlay(Capsule().stroke(Pod.line, lineWidth: 2))
    }
}

/** A Pod Mode circle with its badge, name and what's in it. */
struct PodModeCircle: View {
    let name: String
    let sub: String
    let badge: String?
    let colors: [Color]
    let symbol: String?
    var art: String? = nil
    var symbolColor: Color = .white
    var body: some View {
        VStack(spacing: 14) {
            ZStack(alignment: .top) {
                Circle().fill(LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing))
                    .overlay {
                        if let art, !art.isEmpty { PodArtView(url: art, px: 300, radius: 110).padding(6) }
                        else if let symbol { Image(systemName: symbol).font(.system(size: 66, weight: .semibold)).foregroundStyle(symbolColor) }
                    }
                    .frame(width: 210, height: 210)
                    .shadow(color: (colors.first ?? .black).opacity(0.35), radius: 18, y: 12)
                if let badge {
                    Text(badge).font(.system(size: 18, weight: .heavy)).foregroundStyle(.white)
                        .padding(.horizontal, 14).padding(.vertical, 6)
                        .background(Capsule().fill(badge == "FRESH" ? Color(hex: 0x111013) : Color(hex: 0xe5322d)))
                        .offset(y: -12)
                }
            }
            Text(name).font(.system(size: 26, weight: .bold)).foregroundStyle(Pod.ink).multilineTextAlignment(.center).lineLimit(2)
            Text(sub).font(.system(size: 22)).foregroundStyle(Pod.soft).lineLimit(2).multilineTextAlignment(.center)
        }
        .frame(width: 250)
    }
}

struct PodTVModes: View {
    @EnvironmentObject var model: PodTVModel
    private static let looks: [String: ([UInt32], String)] = [
        "sleep": ([0x1e2a4a, 0x111827], "moon"), "commute": ([0x1f1f22, 0x000000], "car"), "workout": ([0x3b2618, 0x1c120b], "dumbbell"),
        "focus": ([0x115e59, 0x0f3d3a], "headphones"), "learn": ([0xf3efe6, 0xe7e0d2], "book"), "drive": ([0xff8a3d, 0xff4d1f], "car.fill"),
    ]
    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text("Pod Modes").font(.system(size: 40, weight: .bold)).foregroundStyle(Pod.ink)
            ScrollView(.horizontal) {
                LazyHStack(alignment: .top, spacing: 40) {
                    Button { PodEngine.shared.playStation(); model.open("Pod+ Live News Radio", [], at: 0) } label: {
                        PodModeCircle(name: "Pod+ Live News Radio", sub: "Nonstop news", badge: "LIVE", colors: [Color(hex: 0xef4444), Color(hex: 0xb91c1c)], symbol: "dot.radiowaves.left.and.right")
                    }.buttonStyle(PodLift())
                    Button { Task { if let eps = try? await PodAPI.shared.news(), !eps.isEmpty { model.open("Up to the Minute News", eps) } } } label: {
                        PodModeCircle(name: "Up to the Minute News", sub: "Last few hours only", badge: "LIVE", colors: [Color(hex: 0x1e3a8a), Color(hex: 0x0f1d4a)], symbol: "bolt.fill", symbolColor: Pod.accent)
                    }.buttonStyle(PodLift())
                    NavigationLink(value: PodMode(id: "stations", name: "Live news stations", episodes: [])) {
                        PodModeCircle(name: "Live news stations", sub: "All-news radio", badge: "ON AIR", colors: [Color(hex: 0x1f2937), Color(hex: 0x0b1220)], symbol: "dot.radiowaves.left.and.right")
                    }.buttonStyle(PodLift())
                    ForEach(model.lib.modes) { m in
                        let key = Self.looks.keys.first { m.name.lowercased().contains($0) }
                        let look = key.flatMap { Self.looks[$0] }
                        NavigationLink(value: m) {
                            PodModeCircle(name: m.name, sub: m.episodes.isEmpty ? "Empty" : "\(m.episodes.count) episodes", badge: nil,
                                          colors: (look?.0 ?? [0xff8a3d, 0xff4d1f]).map { Color(hex: $0) }, symbol: look?.1 ?? "list.bullet",
                                          art: look == nil ? m.episodes.first?.art : nil, symbolColor: key == "learn" ? Pod.ink : .white)
                        }.buttonStyle(PodLift())
                    }
                }
                .padding(.vertical, 30).padding(.horizontal, 6)
            }
            .scrollClipDisabled()
        }
    }
}

/** A row of episode cards, Pod+'s home grid: big art with the length on it, then the show's mark, the
 *  title, the show and how long ago. */
struct PodTVEpisodeRow: View {
    @EnvironmentObject var model: PodTVModel
    let title: String
    let color: Color
    let episodes: [PodEp]
    var progress = false
    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack(spacing: 16) {
                Circle().fill(color).frame(width: 22, height: 22)
                Text(title).font(.system(size: 40, weight: .bold)).foregroundStyle(Pod.ink)
            }
            ScrollView(.horizontal) {
                LazyHStack(alignment: .top, spacing: 44) {
                    ForEach(Array(episodes.enumerated()), id: \.element.id) { pair in
                        Button { model.open(title, episodes, at: pair.offset) } label: { PodTVEpisodeCard(ep: pair.element, progress: progress) }
                            .buttonStyle(PodLift(scale: 1.06))
                    }
                }
                .padding(.vertical, 30).padding(.horizontal, 6)
            }
            .scrollClipDisabled()
        }
    }
}

struct PodTVEpisodeCard: View {
    let ep: PodEp
    var progress = false
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            PodArtView(url: ep.art, px: 640, radius: 24)
                .frame(width: 380, height: 380)
                .overlay(alignment: .bottomTrailing) {
                    if ep.secs > 0 {
                        Text(Pod.clock(ep.secs)).font(.system(size: 22, weight: .bold).monospacedDigit()).foregroundStyle(.white)
                            .padding(.horizontal, 12).padding(.vertical, 6).background(Capsule().fill(.black.opacity(0.72))).padding(14)
                    }
                }
                .overlay(alignment: .bottom) {
                    if progress, let s = PodStore.shared.spot(ep.id), s.secs > 0 {
                        GeometryReader { g in
                            Capsule().fill(.white.opacity(0.35)).overlay(alignment: .leading) { Capsule().fill(Pod.orange).frame(width: g.size.width * min(1, s.t / s.secs)) }
                        }
                        .frame(height: 8).padding(.horizontal, 18).padding(.bottom, 58)
                    }
                }
            HStack(alignment: .top, spacing: 14) {
                PodArtView(url: ep.art, px: 120, radius: 30).frame(width: 52, height: 52).clipShape(Circle())
                VStack(alignment: .leading, spacing: 4) {
                    Text(ep.title).font(.system(size: 26, weight: .bold)).foregroundStyle(Pod.ink).lineLimit(2)
                    Text(ep.show).font(.system(size: 22)).foregroundStyle(Pod.soft).lineLimit(1)
                    let when = progress ? remaining : Pod.ago(ep.date)
                    if !when.isEmpty { Text(when).font(.system(size: 22)).foregroundStyle(Pod.soft) }
                }
            }
            .frame(width: 380, alignment: .leading)
        }
    }
    private var remaining: String {
        guard let s = PodStore.shared.spot(ep.id), s.secs > s.t else { return "" }
        return "\(Int(((s.secs - s.t) / 60).rounded())) min left"
    }
}

// MARK: - Pod Mode and show pages (the web's list pages: big serif title, Play, the episodes)

struct PodTVModePage: View {
    @EnvironmentObject var model: PodTVModel
    let mode: PodMode
    @State private var eps: [PodEp] = []
    @State private var shuffle = false
    var body: some View {
        PodTVListPage(kicker: mode.id == "stations" ? "RADIO" : "POD MODE", badge: mode.id == "stations" ? "ON AIR" : nil, title: mode.name,
                      symbol: mode.id == "stations" ? "dot.radiowaves.left.and.right" : "list.bullet", art: nil,
                      episodes: eps, shuffle: $shuffle, follow: nil)
            .task {
                if mode.id == "stations" { eps = await PodAPI.shared.stations(tag: "news", limit: 40) }
                else { eps = mode.episodes }
            }
    }
}

struct PodTVShowPage: View {
    @EnvironmentObject var model: PodTVModel
    let show: PodShowRef
    @State private var eps: [PodEp] = []
    @State private var shuffle = false
    var body: some View {
        PodTVListPage(kicker: "PODCAST", badge: nil, title: show.name, symbol: nil, art: show.art, episodes: eps, shuffle: $shuffle, follow: show)
            .task { eps = (try? await PodAPI.shared.showEpisodes(show.id)) ?? []; PodAPI.shared.prepare(Array(eps.prefix(2))) }
    }
}

struct PodTVListPage: View {
    @EnvironmentObject var model: PodTVModel
    let kicker: String
    let badge: String?
    let title: String
    let symbol: String?
    let art: String?
    let episodes: [PodEp]
    @Binding var shuffle: Bool
    let follow: PodShowRef?
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 50) {
                HStack(alignment: .center, spacing: 50) {
                    if let art { PodArtView(url: art, px: 600, radius: 30).frame(width: 300, height: 300) }
                    else { Circle().fill(Color(hex: 0x111013)).frame(width: 150, height: 150).overlay { Image(systemName: symbol ?? "list.bullet").font(.system(size: 60)).foregroundStyle(.white) } }
                    VStack(alignment: .leading, spacing: 16) {
                        HStack(spacing: 16) {
                            Text(kicker).font(.system(size: 22, weight: .heavy)).tracking(5).foregroundStyle(Pod.soft)
                            if let badge { Text(badge).font(.system(size: 18, weight: .heavy)).foregroundStyle(.white).padding(.horizontal, 14).padding(.vertical, 5).background(Capsule().fill(Color(hex: 0x111013))) }
                        }
                        Text(title).font(.system(size: 76, weight: .heavy, design: .serif)).foregroundStyle(Pod.ink).lineLimit(2)
                        Text(summary).font(.system(size: 28)).foregroundStyle(Pod.soft)
                        HStack(spacing: 24) {
                            Button { play(at: 0) } label: { Label("Play", systemImage: "play.fill") }.buttonStyle(PodPill(filled: Color(hex: 0x111013))).disabled(episodes.isEmpty)
                            Button { shuffle.toggle() } label: { Label(shuffle ? "Shuffle on" : "In order", systemImage: shuffle ? "shuffle" : "list.number") }.buttonStyle(PodPill())
                            if let f = follow {
                                Button { model.toggleFollow(f) } label: { Label(model.isFollowing(f.id) ? "Following" : "Follow", systemImage: model.isFollowing(f.id) ? "checkmark" : "plus") }.buttonStyle(PodPill())
                            }
                        }
                        .padding(.top, 10)
                    }
                }
                VStack(alignment: .leading, spacing: 0) {
                    Text("Episodes").font(.system(size: 38, weight: .bold)).foregroundStyle(Pod.ink).padding(.bottom, 20)
                    if episodes.isEmpty { ProgressView().padding(40) }
                    ForEach(Array(episodes.prefix(60).enumerated()), id: \.element.id) { pair in
                        Button { play(at: pair.offset) } label: {
                            HStack(spacing: 30) {
                                PodArtView(url: pair.element.art, px: 300, radius: 14).frame(width: 200, height: 112)
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(pair.element.title).font(.system(size: 28, weight: .bold)).foregroundStyle(Pod.ink).lineLimit(2)
                                    Text([pair.element.show, Pod.length(pair.element.secs), Pod.ago(pair.element.date)].filter { !$0.isEmpty }.joined(separator: " · "))
                                        .font(.system(size: 22)).foregroundStyle(Pod.soft)
                                }
                                Spacer()
                            }
                            .padding(.vertical, 18).padding(.horizontal, 20)
                        }
                        .buttonStyle(PodLift(scale: 1.02))
                        Divider().overlay(Pod.line)
                    }
                }
            }
            .padding(.horizontal, 90).padding(.vertical, 60)
        }
        .background(Pod.page.ignoresSafeArea())
    }
    private var summary: String {
        let total = episodes.reduce(0) { $0 + $1.secs }
        return [episodes.isEmpty ? "" : "\(episodes.count) episodes", Pod.length(total)].filter { !$0.isEmpty }.joined(separator: " · ")
    }
    private func play(at i: Int) {
        guard !episodes.isEmpty else { return }
        if shuffle { var l = episodes; l.shuffle(); model.open(title, l) } else { model.open(title, episodes, at: i) }
    }
}

// MARK: - The swipe feed

struct PodTVSwipe: View {
    @EnvironmentObject var model: PodTVModel
    @ObservedObject private var engine = PodEngine.shared
    @Environment(\.dismiss) private var dismiss
    let play: PodTVPlay
    @State private var list: [PodEp] = []
    @State private var index = 0
    @State private var section: PodTVSection?
    @State private var direction: Edge = .bottom
    @State private var loading = false
    @State private var toast: String?
    @State private var sleepAt: Date?
    @State private var sleepEnd = false
    @State private var showEpisodes: PodShowRef?
    @State private var lastSkipped: Double = 0
    @FocusState private var focused: Bool
    private let ticker = Timer.publish(every: 5, on: .main, in: .common).autoconnect()

    private var ep: PodEp? { list.indices.contains(index) ? list[index] : nil }
    private var station: Bool { engine.onStation && play.list.isEmpty && play.section == nil }

    var body: some View {
        ZStack {
            Color(hex: 0x0e0d10).ignoresSafeArea()
            if station { PodTVStationCard(engine: engine) }
            else if let ep {
                PodTVCard(ep: ep, engine: engine, section: section, liked: model.isLiked(ep), saved: model.isSaved(ep), toast: toast, sleepOn: sleepAt != nil || sleepEnd, position: index, count: list.count)
                    .id(ep.id)
                    .transition(.asymmetric(insertion: .move(edge: direction), removal: .move(edge: direction == .bottom ? .top : .bottom)))
            } else if loading {
                ProgressView().tint(.white)
            } else {
                Text("Nothing to play here yet.").font(.title2).foregroundStyle(.white.opacity(0.7))
            }
            // The whole screen is one button: the remote works it (see the top of this file).
            Button { toggle() } label: { Color.clear.contentShape(Rectangle()) }
                .buttonStyle(PodBare())
                .focused($focused)
                .contextMenu { menu }
                .onMoveCommand(perform: move)
                .onPlayPauseCommand { toggle() }
        }
        .ignoresSafeArea()
        .preferredColorScheme(.dark)
        .onExitCommand { dismiss() }
        .task { await start() }
        .onAppear { focused = true }
        .onChange(of: engine.current?.id) { _, id in
            // The player went on by itself (an episode ended): the feed follows.
            if let id, let i = list.firstIndex(where: { $0.id == id }), i != index { direction = .bottom; withAnimation(.easeInOut(duration: 0.45)) { index = i } }
        }
        .onChange(of: engine.skippedSecs) { _, s in
            if s > lastSkipped + 1 { say("Skipped an ad · \(Int(s - lastSkipped)) sec") }
            lastSkipped = s
        }
        .onReceive(ticker) { _ in
            if let at = sleepAt, Date() >= at { engine.pause(); sleepAt = nil; say("Sleep timer: paused") }
            if sleepEnd, engine.duration > 0, engine.position >= engine.duration - 6 { engine.pause(); sleepEnd = false }
        }
        .sheet(item: $showEpisodes) { s in NavigationStack { PodTVShowPage(show: s) }.environmentObject(model) }
    }

    @ViewBuilder private var menu: some View {
        if let ep {
            Button { model.toggleLike(ep); say(model.isLiked(ep) ? "Liked" : "Unliked") } label: { Label(model.isLiked(ep) ? "Unlike" : "Like", systemImage: model.isLiked(ep) ? "heart.slash" : "heart") }
            Button { model.toggleLater(ep); say(model.isSaved(ep) ? "Saved to Listen later" : "Removed from Listen later") } label: { Label(model.isSaved(ep) ? "Remove from Listen later" : "Save to Listen later", systemImage: "bookmark") }
            let show = PodShowRef(id: ep.showId, name: ep.show, art: ep.art)
            Button { model.toggleFollow(show); say(model.isFollowing(ep.showId) ? "Following \(ep.show)" : "Unfollowed") } label: { Label(model.isFollowing(ep.showId) ? "Unfollow \(ep.show)" : "Follow \(ep.show)", systemImage: "person.badge.plus") }
            Button { showEpisodes = show } label: { Label("All episodes", systemImage: "list.bullet") }
        }
        Button { engine.cycleRate(); say("Speed \(rateText)") } label: { Label("Speed: \(rateText)", systemImage: "gauge.with.dots.needle.67percent") }
        Button { cycleSleep() } label: { Label(sleepLabel, systemImage: "moon") }
        if play.section != nil {
            ForEach(PodTVSection.allCases) { s in
                if s != section { Button { Task { await load(s) } } label: { Label("Switch to \(s.rawValue)", systemImage: "rectangle.stack") } }
            }
        }
    }

    private var sleepLabel: String {
        if sleepEnd { return "Sleep timer: end of episode" }
        if let at = sleepAt { return "Sleep timer: \(max(1, Int(at.timeIntervalSinceNow / 60))) min" }
        return "Sleep timer"
    }
    /** Off → 15 → 30 → 60 minutes → the end of this episode → off. */
    private func cycleSleep() {
        let left = sleepAt.map { $0.timeIntervalSinceNow / 60 } ?? 0
        if sleepEnd { sleepEnd = false; sleepAt = nil; say("Sleep timer off"); return }
        let next: Int? = sleepAt == nil ? 15 : left <= 16 ? 30 : left <= 31 ? 60 : nil
        if let m = next { sleepAt = Date().addingTimeInterval(Double(m) * 60); say("Sleeping in \(m) min") }
        else { sleepAt = nil; sleepEnd = true; say("Sleeping at the end of this episode") }
    }
    private var rateText: String { engine.rate == 1 ? "1×" : String(format: "%g×", engine.rate) }

    private func start() async {
        if let s = play.section { await load(s) }
        else if !play.list.isEmpty { list = play.list; index = play.start; begin() }
    }

    private func load(_ s: PodTVSection) async {
        section = s; loading = true; list = []
        switch s {
        case .forYou:
            if model.pools.isEmpty { await model.load() }
            list = model.forYou()
        case .following:
            list = await model.following()
            if list.isEmpty { say("Follow shows (click and hold on one) and they'll fill this feed") }
        case .news:
            list = (try? await PodAPI.shared.news()) ?? []
        }
        loading = false; index = 0; direction = .bottom
        begin()
    }

    private func begin() {
        guard ep != nil else { return }
        if engine.current?.id != ep?.id { engine.play(list, at: index) }
        PodAPI.shared.prepare(Array(list.dropFirst(index + 1).prefix(2)))
    }

    private func go(_ by: Int) {
        let i = index + by
        guard list.indices.contains(i) else { say(by > 0 ? "That's everything for now" : "You're at the first one"); return }
        direction = by > 0 ? .bottom : .top
        withAnimation(.easeInOut(duration: 0.45)) { index = i }
        engine.play(list, at: i)
        PodAPI.shared.prepare(Array(list.dropFirst(i + 1).prefix(2)))
    }

    private func move(_ d: MoveCommandDirection) {
        switch d {
        case .down: go(1)
        case .up: go(-1)
        case .left: engine.skip(-15); say("Back 15 sec")
        case .right: engine.skip(30); say("Ahead 30 sec")
        @unknown default: break
        }
    }

    private func toggle() { engine.toggle() }

    private func say(_ s: String) {
        withAnimation { toast = s }
        let me = s
        Task { try? await Task.sleep(nanoseconds: 2_200_000_000); if toast == me { withAnimation { toast = nil } } }
    }
}

struct PodBare: ButtonStyle { func makeBody(configuration: Configuration) -> some View { configuration.label } }

/** One card of the feed: Pod+'s player page, laid out for a TV. */
struct PodTVCard: View {
    let ep: PodEp
    @ObservedObject var engine: PodEngine
    let section: PodTVSection?
    let liked: Bool
    let saved: Bool
    let toast: String?
    let sleepOn: Bool
    let position: Int
    let count: Int
    @State private var drift = false
    @State private var spin = false

    private var playing: Bool { engine.playing && engine.current?.id == ep.id }
    private var dur: Double { engine.current?.id == ep.id && engine.duration > 0 ? engine.duration : ep.secs }
    private var pos: Double { engine.current?.id == ep.id ? engine.position : (PodStore.shared.spot(ep.id)?.t ?? 0) }

    var body: some View {
        ZStack {
            // Behind everything, the art blurred and darkened so the whole screen takes on its colours; it turns slowly while playing.
            GeometryReader { g in
                PodArtView(url: ep.art, px: 300, radius: 0)
                    .frame(width: g.size.width * 1.7, height: g.size.width * 1.7)
                    .blur(radius: 90)
                    .opacity(0.9)
                    .rotationEffect(.degrees(spin ? 360 : 0))
                    .position(x: g.size.width / 2, y: g.size.height / 2)
            }
            .ignoresSafeArea()
            LinearGradient(colors: [.black.opacity(0.15), .black.opacity(0.35), .black.opacity(0.65)], startPoint: .top, endPoint: .bottom).ignoresSafeArea()

            HStack(alignment: .center, spacing: 90) {
                // The cover, lit by its own colours, drifting while it plays.
                ZStack {
                    PodArtView(url: ep.art, px: 300, radius: 40).frame(width: 700, height: 700).blur(radius: 60).opacity(playing ? 0.8 : 0.3)
                    PodArtView(url: ep.art, px: 1200, radius: 0)
                        .frame(width: 760, height: 760)
                        .scaleEffect(drift ? 1.18 : 1.04)
                        .offset(x: drift ? -26 : 14, y: drift ? -18 : 10)
                        .frame(width: 760, height: 760)
                        .clipShape(RoundedRectangle(cornerRadius: 40, style: .continuous))
                        .shadow(color: .black.opacity(0.7), radius: 50, y: 40)
                        .scaleEffect(playing ? 1 : 0.93)
                        .animation(.easeOut(duration: 0.7), value: playing)
                }

                VStack(alignment: .leading, spacing: 18) {
                    HStack(spacing: 12) {
                        if let section { Text(section.rawValue).font(.system(size: 24, weight: .bold)).padding(.horizontal, 22).padding(.vertical, 10).background(Capsule().fill(.white.opacity(0.16))) }
                        if count > 1 { Text("\(position + 1) of \(count)").font(.system(size: 22, weight: .semibold)).foregroundStyle(.white.opacity(0.55)) }
                    }
                    Spacer(minLength: 0)
                    let meta = [Pod.ago(ep.date), Pod.length(ep.secs)].filter { !$0.isEmpty }.joined(separator: " · ")
                    if !meta.isEmpty { Text(meta).font(.system(size: 26)).foregroundStyle(.white.opacity(0.55)) }
                    Text(ep.title).font(.system(size: 58, weight: .bold)).lineLimit(3).minimumScaleFactor(0.7)
                    HStack(spacing: 18) {
                        Text(ep.show).font(.system(size: 34)).foregroundStyle(.white.opacity(0.62)).lineLimit(1)
                        if liked { Image(systemName: "heart.fill").foregroundStyle(Color(hex: 0xf43f5e)) }
                        if saved { Image(systemName: "bookmark.fill").foregroundStyle(.white.opacity(0.8)) }
                    }
                    .font(.system(size: 30))

                    // The progress bar: ads marked in yellow (they're skipped by themselves).
                    VStack(spacing: 10) {
                        GeometryReader { g in
                            ZStack(alignment: .leading) {
                                Capsule().fill(.white.opacity(0.22))
                                ForEach(engine.current?.id == ep.id ? engine.ads : [], id: \.key) { ad in
                                    if dur > 0 {
                                        Capsule().fill(Color(hex: 0xffd23f))
                                            .frame(width: max(6, g.size.width * CGFloat((min(ad.e, dur) - ad.s) / dur)))
                                            .offset(x: g.size.width * CGFloat(ad.s / dur))
                                    }
                                }
                                Capsule().fill(.white).frame(width: dur > 0 ? g.size.width * CGFloat(min(1, pos / dur)) : 0)
                            }
                        }
                        .frame(height: 12)
                        HStack {
                            Text(Pod.clock(pos)); Spacer(); Text(dur > 0 ? "-" + Pod.clock(dur - pos) : "")
                        }
                        .font(.system(size: 22, weight: .semibold).monospacedDigit()).foregroundStyle(.white.opacity(0.6))
                    }
                    .padding(.top, 20)

                    HStack(spacing: 70) {
                        Text(engine.rate == 1 ? "1×" : String(format: "%g×", engine.rate)).font(.system(size: 34, weight: .semibold)).foregroundStyle(.white.opacity(0.8))
                        PodSkipGlyph(name: "gobackward", n: "15")
                        Group {
                            if engine.loading && engine.current?.id == ep.id && !engine.playing { ProgressView().tint(.white).scaleEffect(2) }
                            else { Image(systemName: playing ? "pause.fill" : "play.fill").font(.system(size: 88)) }
                        }
                        .frame(width: 110, height: 110)
                        PodSkipGlyph(name: "goforward", n: "30")
                        Image(systemName: sleepOn ? "moon.fill" : "moon").font(.system(size: 40)).foregroundStyle(.white.opacity(sleepOn ? 1 : 0.8))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 10)

                    HStack(spacing: 30) {
                        PodHint(keys: "▲ ▼", what: "next show")
                        PodHint(keys: "◀ ▶", what: "back 15 · ahead 30")
                        PodHint(keys: "Hold", what: "like, save, follow, more")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 16)
                }
                .frame(width: 860, height: 760)
            }
            .padding(.horizontal, 100)
            .foregroundStyle(.white)

            if let toast {
                VStack {
                    Text(toast).font(.system(size: 26, weight: .semibold)).padding(.horizontal, 30).padding(.vertical, 14)
                        .background(Capsule().fill(.black.opacity(0.6))).overlay(Capsule().stroke(.white.opacity(0.12)))
                        .foregroundStyle(.white).padding(.top, 60)
                    Spacer()
                }
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 36).repeatForever(autoreverses: true)) { drift = true }
            withAnimation(.linear(duration: 80).repeatForever(autoreverses: false)) { spin = true }
        }
    }
}

struct PodSkipGlyph: View {
    let name: String
    let n: String
    var body: some View {
        Image(systemName: "\(name).\(n)").font(.system(size: 54, weight: .regular))
    }
}
struct PodHint: View {
    let keys: String
    let what: String
    var body: some View {
        HStack(spacing: 10) {
            Text(keys).font(.system(size: 18, weight: .heavy)).padding(.horizontal, 12).padding(.vertical, 5).background(Capsule().fill(.white.opacity(0.16)))
            Text(what).font(.system(size: 20)).foregroundStyle(.white.opacity(0.55))
        }
    }
}

/** Pod+ Live News Radio: on air for everyone, no progress bar. */
struct PodTVStationCard: View {
    @ObservedObject var engine: PodEngine
    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(hex: 0xb91c1c), Color(hex: 0x3f0b0b), Color(hex: 0x0e0d10)], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
            VStack(spacing: 30) {
                Text("LIVE").font(.system(size: 30, weight: .heavy)).padding(.horizontal, 26).padding(.vertical, 10).background(Capsule().fill(Color(hex: 0xe5322d)))
                Image(systemName: "dot.radiowaves.left.and.right").font(.system(size: 160))
                Text("Pod+ Live News Radio").font(.system(size: 70, weight: .heavy))
                if let ep = engine.current { Text(ep.title).font(.system(size: 34)).foregroundStyle(.white.opacity(0.7)).lineLimit(2).multilineTextAlignment(.center).frame(maxWidth: 1300) }
                Image(systemName: engine.playing ? "pause.fill" : "play.fill").font(.system(size: 80)).padding(.top, 20)
            }
            .foregroundStyle(.white)
        }
    }
}

// MARK: - Radio

struct PodTVRadio: View {
    @EnvironmentObject var model: PodTVModel
    @State private var rows: [PodTVRow] = []
    private static let kinds: [(String, String, UInt32)] = [("News", "news", 0x1e3a8a), ("Talk", "talk", 0x334155), ("Sports", "sports", 0xb91c1c), ("Pop", "pop", 0xdb2777), ("Rock", "rock", 0x111827), ("Jazz", "jazz", 0x92400e), ("Classical", "classical", 0x0e7490), ("Country", "country", 0xa16207)]
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 56) {
                PodLogo()
                HStack(spacing: 40) {
                    Button { PodEngine.shared.playStation(); model.open("Pod+ Live News Radio", [], at: 0) } label: {
                        PodRadioHero(title: "Pod+ Live News Radio", sub: "Nonstop news, the same moment for everyone", badge: "LIVE", colors: [Color(hex: 0xef4444), Color(hex: 0x7f1d1d)], symbol: "dot.radiowaves.left.and.right")
                    }.buttonStyle(PodLift(scale: 1.04))
                    Button { Task { if let eps = try? await PodAPI.shared.news(), !eps.isEmpty { model.open("Up to the Minute News", eps) } } } label: {
                        PodRadioHero(title: "Up to the Minute News", sub: "Only the last few hours of news", badge: "LIVE", colors: [Color(hex: 0x1e3a8a), Color(hex: 0x0b1220)], symbol: "bolt.fill")
                    }.buttonStyle(PodLift(scale: 1.04))
                }
                if rows.isEmpty { ProgressView().frame(maxWidth: .infinity) }
                ForEach(rows) { row in
                    VStack(alignment: .leading, spacing: 22) {
                        HStack(spacing: 16) { Circle().fill(row.color).frame(width: 22, height: 22); Text(row.name).font(.system(size: 40, weight: .bold)).foregroundStyle(Pod.ink) }
                        ScrollView(.horizontal) {
                            LazyHStack(alignment: .top, spacing: 40) {
                                ForEach(Array(row.episodes.enumerated()), id: \.element.id) { pair in
                                    Button { model.open(row.name, row.episodes, at: pair.offset) } label: {
                                        VStack(spacing: 14) {
                                            ZStack {
                                                Circle().fill(LinearGradient(colors: [row.color, row.color.opacity(0.7)], startPoint: .topLeading, endPoint: .bottomTrailing))
                                                Image(systemName: "dot.radiowaves.left.and.right").font(.system(size: 64, weight: .semibold)).foregroundStyle(.white)
                                                if !pair.element.art.isEmpty {
                                                    AsyncImage(url: URL(string: pair.element.art)) { ph in if let img = ph.image { img.resizable().scaledToFill() } else { Color.clear } }
                                                }
                                            }
                                            .frame(width: 220, height: 220).clipShape(Circle())
                                            .overlay(Circle().stroke(Pod.line, lineWidth: 2))
                                            Text(pair.element.title).font(.system(size: 24, weight: .bold)).foregroundStyle(Pod.ink).lineLimit(2).multilineTextAlignment(.center)
                                            if !pair.element.show.isEmpty { Text(pair.element.show).font(.system(size: 20)).foregroundStyle(Pod.soft).lineLimit(1) }
                                        }
                                        .frame(width: 240)
                                    }.buttonStyle(PodLift())
                                }
                            }
                            .padding(.vertical, 30).padding(.horizontal, 6)
                        }
                        .scrollClipDisabled()
                    }
                }
            }
            .padding(.horizontal, 90).padding(.vertical, 50)
        }
        .background(Pod.page.ignoresSafeArea())
        .task {
            guard rows.isEmpty else { return }
            for k in Self.kinds {
                let s = await PodAPI.shared.stations(tag: k.1, limit: 20)
                if !s.isEmpty { rows.append(PodTVRow(id: k.1, name: k.0, color: Color(hex: k.2), episodes: s)) }
            }
        }
    }
}

struct PodRadioHero: View {
    let title: String, sub: String, badge: String
    let colors: [Color]
    let symbol: String
    var body: some View {
        HStack(spacing: 30) {
            Image(systemName: symbol).font(.system(size: 80, weight: .semibold))
            VStack(alignment: .leading, spacing: 10) {
                Text(badge).font(.system(size: 20, weight: .heavy)).padding(.horizontal, 14).padding(.vertical, 5).background(Capsule().fill(Color(hex: 0xe5322d)))
                Text(title).font(.system(size: 44, weight: .heavy))
                Text(sub).font(.system(size: 24)).opacity(0.75)
            }
            Spacer(minLength: 0)
        }
        .foregroundStyle(.white)
        .padding(50)
        .frame(width: 820, height: 300)
        .background(RoundedRectangle(cornerRadius: 36, style: .continuous).fill(LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)))
    }
}

// MARK: - Library and account

struct PodTVLibrary: View {
    @EnvironmentObject var model: PodTVModel
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 56) {
                    HStack { PodLogo(); Spacer(); Text("Library").font(.system(size: 34, weight: .bold)).foregroundStyle(Pod.soft) }
                    if !model.signedIn { PodTVAccount() }
                    if !model.continueListening.isEmpty { PodTVEpisodeRow(title: "Continue listening", color: Pod.orange, episodes: model.continueListening, progress: true) }
                    if !model.follows.isEmpty {
                        VStack(alignment: .leading, spacing: 22) {
                            Text("Following").font(.system(size: 40, weight: .bold)).foregroundStyle(Pod.ink)
                            ScrollView(.horizontal) {
                                LazyHStack(alignment: .top, spacing: 40) {
                                    ForEach(model.follows) { s in
                                        NavigationLink(value: s) {
                                            VStack(alignment: .leading, spacing: 14) {
                                                PodArtView(url: s.art, px: 500, radius: 24).frame(width: 300, height: 300)
                                                Text(s.name).font(.system(size: 24, weight: .bold)).foregroundStyle(Pod.ink).lineLimit(2).frame(width: 300, alignment: .leading)
                                            }
                                        }.buttonStyle(PodLift())
                                    }
                                }
                                .padding(.vertical, 30).padding(.horizontal, 6)
                            }
                            .scrollClipDisabled()
                        }
                    }
                    if !model.later.isEmpty { PodTVEpisodeRow(title: "Listen later", color: Color(hex: 0x111013), episodes: model.later) }
                    if !model.liked.isEmpty { PodTVEpisodeRow(title: "Liked episodes", color: Color(hex: 0xf43f5e), episodes: model.liked) }
                    if model.signedIn {
                        PodTVAccount()
                    } else if model.follows.isEmpty && model.later.isEmpty && model.liked.isEmpty {
                        Text("Click and hold on any episode in the swipe feed to like it, save it or follow its show.").font(.system(size: 26)).foregroundStyle(Pod.soft)
                    }
                }
                .padding(.horizontal, 90).padding(.vertical, 50)
            }
            .background(Pod.page.ignoresSafeArea())
            .navigationDestination(for: PodShowRef.self) { PodTVShowPage(show: $0) }
        }
    }
}

/** Sign in with the email you use in Pod+ (a code by email), like the black membership card on Pod+. */
struct PodTVAccount: View {
    @EnvironmentObject var model: PodTVModel
    @State private var email = ""
    @State private var code = ""
    @State private var sent = false
    @State private var busy = false
    @State private var note: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 26) {
            Text(model.signedIn ? "YOUR POD+ ACCOUNT" : "POD+ ON EVERY SCREEN").font(.system(size: 22, weight: .heavy)).tracking(5).foregroundStyle(Pod.accent)
            if model.signedIn {
                Text(PodStore.shared.email ?? "Signed in").font(.system(size: 52, weight: .heavy))
                Text("Your shows, Pod Modes, likes and where you left off come from Pod+ on your phone.").font(.system(size: 26)).opacity(0.75)
                HStack(spacing: 24) {
                    Button(busy ? "Updating…" : "Bring my shows now") { Task { busy = true; note = (try? await PodAPI.shared.syncLibrary()) == true ? "Up to date." : "Open Pod+ on your phone while signed in, then try again."; busy = false } }.buttonStyle(PodPill(filled: .white.opacity(0.12)))
                    Button("Sign out") { PodAPI.shared.signOut() }.buttonStyle(PodPill(filled: .white.opacity(0.12)))
                }
            } else {
                Text("Your place, on the TV.").font(.system(size: 60, weight: .heavy))
                HStack(spacing: 40) {
                    Label("Your Pod Modes and likes", systemImage: "checkmark").foregroundStyle(.white)
                    Label("Pick up where you left off", systemImage: "checkmark").foregroundStyle(.white)
                }
                .font(.system(size: 26)).opacity(0.85)
                if !sent {
                    HStack(spacing: 24) {
                        TextField("The email you use in Pod+", text: $email).textContentType(.emailAddress).keyboardType(.emailAddress).frame(maxWidth: 760)
                        Button(busy ? "Sending…" : "Email me a code") { Task { await ask() } }.buttonStyle(PodPill(filled: .white.opacity(0.12))).disabled(busy || !email.contains("@"))
                    }
                } else {
                    Text("We sent a 6-digit code to \(email).").font(.system(size: 26))
                    HStack(spacing: 24) {
                        TextField("6-digit code", text: $code).keyboardType(.numberPad).frame(maxWidth: 400)
                        Button(busy ? "Checking…" : "Sign in") { Task { await check() } }.buttonStyle(PodPill(filled: .white.opacity(0.12))).disabled(busy || code.filter(\.isNumber).count != 6)
                        Button("Another email") { sent = false; code = "" }.buttonStyle(PodPill(filled: .white.opacity(0.12)))
                    }
                }
            }
            if let n = note { Text(n).font(.system(size: 24)).foregroundStyle(Pod.accent) }
        }
        .foregroundStyle(.white)
        .padding(60)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 40, style: .continuous).fill(Color(hex: 0x111013)))
    }
    private func ask() async {
        busy = true; note = nil
        do { try await PodAPI.shared.sendCode(email: email.trimmingCharacters(in: .whitespaces)); sent = true }
        catch { note = error.localizedDescription }
        busy = false
    }
    private func check() async {
        busy = true; note = nil
        do { try await PodAPI.shared.verify(email: email.trimmingCharacters(in: .whitespaces), code: code.filter(\.isNumber)); note = "You're signed in."; await model.load() }
        catch { note = error.localizedDescription }
        busy = false
    }
}

// MARK: - Search

struct PodTVSearch: View {
    @EnvironmentObject var model: PodTVModel
    @State private var q = ""
    @State private var shows: [PodShowRef] = []
    @State private var eps: [PodEp] = []
    @State private var busy = false
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 50) {
                    if q.count < 2 {
                        Text("Real podcasts only. Search a show, a topic or a person.").font(.system(size: 30)).foregroundStyle(Pod.soft)
                    }
                    if busy { ProgressView() }
                    if !shows.isEmpty {
                        VStack(alignment: .leading, spacing: 22) {
                            Text("Shows").font(.system(size: 40, weight: .bold)).foregroundStyle(Pod.ink)
                            ScrollView(.horizontal) {
                                LazyHStack(alignment: .top, spacing: 40) {
                                    ForEach(shows) { s in
                                        NavigationLink(value: s) {
                                            VStack(alignment: .leading, spacing: 14) {
                                                PodArtView(url: s.art, px: 500, radius: 24).frame(width: 300, height: 300)
                                                Text(s.name).font(.system(size: 24, weight: .bold)).foregroundStyle(Pod.ink).lineLimit(2).frame(width: 300, alignment: .leading)
                                                Text(s.author).font(.system(size: 20)).foregroundStyle(Pod.soft).lineLimit(1).frame(width: 300, alignment: .leading)
                                            }
                                        }.buttonStyle(PodLift())
                                    }
                                }
                                .padding(.vertical, 30).padding(.horizontal, 6)
                            }
                            .scrollClipDisabled()
                        }
                    }
                    if !eps.isEmpty { PodTVEpisodeRow(title: "Episodes", color: Pod.orange, episodes: eps) }
                }
                .padding(.horizontal, 90).padding(.vertical, 40)
            }
            .background(Pod.page.ignoresSafeArea())
            .searchable(text: $q, prompt: "Phone down, podcast on")
            .task(id: q) {
                let words = q.trimmingCharacters(in: .whitespaces)
                guard words.count >= 2 else { shows = []; eps = []; return }
                try? await Task.sleep(nanoseconds: 450_000_000)
                busy = true
                if let r = try? await PodAPI.shared.search(words), !Task.isCancelled { shows = r.shows; eps = r.episodes }
                busy = false
            }
            .navigationDestination(for: PodShowRef.self) { PodTVShowPage(show: $0) }
        }
    }
}
