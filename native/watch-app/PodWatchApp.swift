// Pod+ for Apple Watch, in Pod+'s own look: the orange Pod+ mark, Pod Modes as circles with their LIVE
// badges, cover-art cards, and the swipe feed — one show per page, the art blurred behind it, turned with
// the Digital Crown or a swipe, playing as it lands. Plays on the watch (Bluetooth headphones) with the
// same native player as CarPlay (native/arise-carplay: PodEngine — ad-free, picking up where you left
// off). The library comes from the phone (PodLink); where you got to goes back to it.
// Episodes can be downloaded to the watch (ad-free when the server has the copy) and played with no phone
// or Wi-Fi nearby; a sleep timer stops playback after a while or at the end of the episode.
import SwiftUI
import WatchKit
import Combine

@main
struct PodWatchApp: App {
    @WKApplicationDelegateAdaptor(PodWatchDelegate.self) var delegate
    var body: some Scene {
        WindowGroup { PodWatchHome() }
    }
}

final class PodWatchDelegate: NSObject, WKApplicationDelegate {
    func applicationDidFinishLaunching() {
        PodLink.shared.start()
        Task { @MainActor in
            PodDownloads.shared.wake()
            PodEngine.shared.localCopy = { ep in PodDownloads.shared.copy(ep) }
        }
    }
    /** Downloads keep going while the app is closed; watchOS wakes it when they're done. */
    func handle(_ backgroundTasks: Set<WKRefreshBackgroundTask>) {
        for task in backgroundTasks {
            if let t = task as? WKURLSessionRefreshBackgroundTask {
                Task { @MainActor in PodDownloads.shared.wake(finishing: t) }
            } else {
                task.setTaskCompletedWithSnapshot(false)
            }
        }
    }
    func applicationDidEnterBackground() { PodLink.shared.sendSpots() }
    func applicationWillResignActive() { PodLink.shared.sendSpots() }
}

enum PW {
    static let orange = Color(red: 1, green: 0.416, blue: 0.122)
    static let accent = Color(red: 1, green: 0.541, blue: 0.239)
    static let red = Color(red: 0.898, green: 0.196, blue: 0.176)
    static func clock(_ t: Double) -> String {
        let s = Int(max(0, t.isFinite ? t : 0)); let h = s / 3600, m = (s % 3600) / 60, r = s % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, r) : String(format: "%d:%02d", m, r)
    }
    static func mins(_ secs: Double) -> String { secs > 0 ? "\(max(1, Int((secs / 60).rounded()))) min" : "" }
    static let defaultGenres = ["news", "comedy", "truecrime", "history", "science", "tech"]
}

/** The Pod+ mark, small. */
struct PWLogo: View {
    var body: some View {
        HStack(spacing: 5) {
            RoundedRectangle(cornerRadius: 5).fill(LinearGradient(colors: [PW.accent, PW.orange], startPoint: .top, endPoint: .bottom))
                .frame(width: 22, height: 20)
                .overlay { HStack(spacing: 1.8) { ForEach([0.3, 0.6, 0.85, 0.55, 0.3], id: \.self) { h in Capsule().fill(.white).frame(width: 1.8, height: 20 * h) } } }
            Text("Pod+").font(.system(size: 17, weight: .heavy))
        }
    }
}

struct PWArt: View {
    let url: String
    var px = 200
    var radius: CGFloat = 10
    var body: some View {
        AsyncImage(url: URL(string: PodArt.sized(url, px))) { phase in
            if let img = phase.image { img.resizable().scaledToFill() } else { LinearGradient(colors: [PW.orange.opacity(0.5), PW.orange.opacity(0.15)], startPoint: .topLeading, endPoint: .bottomTrailing) }
        }
        .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
    }
}

// MARK: - Model

@MainActor
final class PodWatchModel: ObservableObject {
    @Published var lib = PodStore.shared.library
    @Published var forYou: [PodEp] = []
    @Published var loading = false
    private var watcher: NSObjectProtocol?
    init() {
        watcher = NotificationCenter.default.addObserver(forName: .podLibraryChanged, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.lib = PodStore.shared.library }
        }
    }
    var continueListening: [PodEp] {
        PodStore.shared.recentSpots(20).filter { $0.1.t > 30 && $0.1.secs - $0.1.t > 60 }.prefix(8).map { pair in
            PodEp(id: pair.0, showId: pair.1.showId, title: pair.1.title, show: pair.1.show, art: pair.1.art, audio: pair.1.audio ?? "", secs: pair.1.secs)
        }
    }
    /** For You: a new show each swipe, taking turns between your topics (as Pod+ does). */
    func loadForYou() async {
        guard forYou.isEmpty, !loading else { return }
        loading = true
        let genres = lib.genres.isEmpty ? PW.defaultGenres : Array(lib.genres.prefix(6))
        if let pools = try? await PodAPI.shared.feed(genres: genres) {
            let lists = genres.map { (pools[$0] ?? []).sorted { $0.rank < $1.rank } }
            var out: [PodEp] = [], seen = Set<String>()
            for round in 0..<12 {
                for l in lists where round < l.count {
                    if seen.insert(l[round].show.id).inserted, let ep = l[round].episodes.first { out.append(ep) }
                }
            }
            forYou = Array(out.prefix(40))
        }
        loading = false
    }
}

/** What the swipe feed opens with. At most 30 pages around the one it opens on: a show can have hundreds
 *  of episodes, and a watch only has room for a few pages of cover art at a time. */
struct PWFeed: Hashable {
    let title: String
    let list: [PodEp]
    let start: Int
    init(title: String, list: [PodEp], start: Int) {
        var seen = Set<String>()
        let uniq = list.filter { seen.insert($0.id).inserted }
        let want = list.indices.contains(start) ? list[start].id : nil
        let i = want.flatMap { id in uniq.firstIndex { $0.id == id } } ?? 0
        let lo = max(0, i - 3), hi = min(uniq.count, lo + 30)
        self.title = title
        self.list = lo < hi ? Array(uniq[lo..<hi]) : []
        self.start = max(0, i - lo)
    }
}

// MARK: - Home

struct PodWatchHome: View {
    @StateObject private var model = PodWatchModel()
    @ObservedObject private var engine = PodEngine.shared
    @State private var feed: PWFeed?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    PWLogo().padding(.leading, 4)

                    if let ep = engine.current {
                        Button { feed = PWFeed(title: "Now playing", list: engine.queue.isEmpty ? [ep] : engine.queue, start: engine.index) } label: {
                            HStack(spacing: 8) {
                                PWArt(url: ep.art, px: 100, radius: 8).frame(width: 36, height: 36)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(engine.playing ? "Now playing" : "Paused").font(.system(size: 11, weight: .bold)).foregroundStyle(PW.accent)
                                    Text(ep.title).font(.system(size: 13, weight: .semibold)).lineLimit(1)
                                }
                                Spacer(minLength: 0)
                                Image(systemName: engine.playing ? "waveform" : "pause.fill").foregroundStyle(PW.accent).symbolEffect(.variableColor.iterative, isActive: engine.playing)
                            }
                            .padding(8).background(RoundedRectangle(cornerRadius: 14).fill(.white.opacity(0.1)))
                        }
                        .buttonStyle(.plain)
                    }

                    // The swipe feed, like the big "Swipe" button in Pod+.
                    Button {
                        Task { await model.loadForYou(); if !model.forYou.isEmpty { feed = PWFeed(title: "For You", list: model.forYou, start: 0) } }
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Swipe feed").font(.system(size: 17, weight: .heavy))
                                Text(model.loading ? "Finding shows…" : "A new show each turn of the Crown").font(.system(size: 11)).opacity(0.85)
                            }
                            Spacer(minLength: 0)
                            if model.loading { ProgressView().frame(width: 20) } else { Image(systemName: "rectangle.stack.fill").font(.system(size: 20)) }
                        }
                        .foregroundStyle(.white).padding(12)
                        .background(RoundedRectangle(cornerRadius: 16).fill(LinearGradient(colors: [PW.accent, PW.orange], startPoint: .topLeading, endPoint: .bottomTrailing)))
                    }
                    .buttonStyle(.plain)

                    Text("Pod Modes").font(.system(size: 15, weight: .bold)).padding(.leading, 4).padding(.top, 4)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(alignment: .top, spacing: 10) {
                            Button { engine.playStation(); feed = PWFeed(title: "Pod+ Live News Radio", list: [], start: 0) } label: {
                                PWModeCircle(name: "Live News Radio", badge: "LIVE", colors: [Color(red: 0.94, green: 0.27, blue: 0.27), Color(red: 0.73, green: 0.11, blue: 0.11)], symbol: "dot.radiowaves.left.and.right")
                            }.buttonStyle(.plain)
                            Button { Task { if let eps = try? await PodAPI.shared.news(), !eps.isEmpty { feed = PWFeed(title: "Up to the Minute", list: eps, start: 0) } } } label: {
                                PWModeCircle(name: "Up to the Minute", badge: "LIVE", colors: [Color(red: 0.12, green: 0.23, blue: 0.54), Color(red: 0.06, green: 0.11, blue: 0.29)], symbol: "bolt.fill", symbolColor: PW.accent)
                            }.buttonStyle(.plain)
                            ForEach(model.lib.modes.filter { !$0.episodes.isEmpty }) { m in
                                Button { feed = PWFeed(title: m.name, list: m.episodes, start: 0) } label: {
                                    PWModeCircle(name: m.name, badge: nil, colors: [Color(white: 0.2), Color(white: 0.08)], symbol: "list.bullet", art: m.episodes.first?.art)
                                }.buttonStyle(.plain)
                            }
                        }
                        .padding(.vertical, 6).padding(.horizontal, 2)
                    }

                    PWDownloadsRow { list, i in feed = PWFeed(title: "Downloads", list: list, start: i) }

                    let cont = model.continueListening
                    if !cont.isEmpty { PWCardRow(title: "Continue listening", eps: cont) { i in feed = PWFeed(title: "Continue", list: cont, start: i) } }
                    if !model.lib.later.isEmpty { PWCardRow(title: "Listen later", eps: Array(model.lib.later.prefix(12))) { i in feed = PWFeed(title: "Listen later", list: model.lib.later, start: i) } }
                    if !model.lib.follows.isEmpty {
                        Text("Following").font(.system(size: 15, weight: .bold)).padding(.leading, 4).padding(.top, 4)
                        ForEach(model.lib.follows.prefix(30)) { show in
                            NavigationLink(value: show) {
                                HStack(spacing: 8) { PWArt(url: show.art, px: 100, radius: 8).frame(width: 34, height: 34); Text(show.name).font(.system(size: 14, weight: .semibold)).lineLimit(2); Spacer(minLength: 0) }
                                    .padding(6).background(RoundedRectangle(cornerRadius: 12).fill(.white.opacity(0.08)))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    if model.lib.follows.isEmpty && model.lib.later.isEmpty && cont.isEmpty {
                        Text("Follow shows in Pod+ on your iPhone and they'll be here too.").font(.system(size: 12)).foregroundStyle(.secondary).padding(.horizontal, 4)
                    }
                    NavigationLink { NowPlayingView().navigationTitle("iPhone") } label: {
                        Label("Control your iPhone's audio", systemImage: "iphone").font(.system(size: 13, weight: .semibold))
                    }
                    .padding(.top, 6)
                }
                .padding(.horizontal, 4)
            }
            .navigationDestination(for: PodShowRef.self) { s in PWShowPage(show: s) { list, i in feed = PWFeed(title: s.name, list: list, start: i) } }
            .navigationDestination(item: $feed) { f in PWSwipe(feed: f) }
        }
        .tint(PW.orange)
        .task {
            // For screenshots and checks: `-pwSwipe YES` opens the swipe feed.
            if UserDefaults.standard.bool(forKey: "pwSwipe") { await model.loadForYou(); if !model.forYou.isEmpty { feed = PWFeed(title: "For You", list: model.forYou, start: 0) } }
        }
    }
}

struct PWModeCircle: View {
    let name: String
    let badge: String?
    let colors: [Color]
    let symbol: String
    var art: String? = nil
    var symbolColor: Color = .white
    var body: some View {
        VStack(spacing: 4) {
            ZStack(alignment: .top) {
                Circle().fill(LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing))
                    .overlay {
                        if let art, !art.isEmpty { PWArt(url: art, px: 120, radius: 30).padding(3) }
                        else { Image(systemName: symbol).font(.system(size: 22, weight: .semibold)).foregroundStyle(symbolColor) }
                    }
                    .frame(width: 58, height: 58)
                if let badge {
                    Text(badge).font(.system(size: 8, weight: .heavy)).foregroundStyle(.white).padding(.horizontal, 5).padding(.vertical, 2)
                        .background(Capsule().fill(PW.red)).offset(y: -5)
                }
            }
            Text(name).font(.system(size: 10, weight: .bold)).multilineTextAlignment(.center).lineLimit(2).frame(width: 66)
        }
    }
}

struct PWCardRow: View {
    let title: String
    let eps: [PodEp]
    let open: (Int) -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.system(size: 15, weight: .bold)).padding(.leading, 4).padding(.top, 4)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 8) {
                    ForEach(Array(eps.enumerated()), id: \.element.id) { pair in
                        Button { open(pair.offset) } label: {
                            VStack(alignment: .leading, spacing: 3) {
                                PWArt(url: pair.element.art, px: 200, radius: 12).frame(width: 84, height: 84)
                                    .overlay(alignment: .bottom) {
                                        if let s = PodStore.shared.spot(pair.element.id), s.secs > 0, s.t > 0 {
                                            GeometryReader { g in Capsule().fill(.white.opacity(0.35)).overlay(alignment: .leading) { Capsule().fill(PW.orange).frame(width: g.size.width * min(1, s.t / s.secs)) } }
                                                .frame(height: 3).padding(.horizontal, 8).padding(.bottom, 6)
                                        }
                                    }
                                Text(pair.element.title).font(.system(size: 11, weight: .semibold)).lineLimit(2).frame(width: 84, alignment: .leading)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 2)
            }
        }
    }
}

/** A show's newest episodes. */
struct PWShowPage: View {
    let show: PodShowRef
    let open: ([PodEp], Int) -> Void
    @State private var eps: [PodEp]?
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) { PWArt(url: show.art, px: 160, radius: 10).frame(width: 52, height: 52); Text(show.name).font(.system(size: 15, weight: .bold)).lineLimit(3) }
                if let eps {
                    ForEach(Array(eps.prefix(30).enumerated()), id: \.element.id) { pair in
                        HStack(spacing: 4) {
                            Button { open(Array(eps.prefix(30)), pair.offset) } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(pair.element.title).font(.system(size: 13, weight: .semibold)).lineLimit(3)
                                    Text(PW.mins(pair.element.secs)).font(.system(size: 11)).foregroundStyle(.secondary)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .buttonStyle(.plain)
                            PWDownloadButton(ep: pair.element, compact: true)
                        }
                        .padding(8)
                        .background(RoundedRectangle(cornerRadius: 12).fill(.white.opacity(0.08)))
                    }
                } else { ProgressView() }
            }
        }
        .navigationTitle(show.name)
        .task { eps = (try? await PodAPI.shared.showEpisodes(show.id)) ?? []; PodAPI.shared.prepare(Array((eps ?? []).prefix(2))) }
    }
}

// MARK: - The swipe feed

struct PWSwipe: View {
    let feed: PWFeed
    @ObservedObject private var engine = PodEngine.shared
    @State private var page: Int?
    @State private var more = false
    private var cur: Int { page ?? feed.start }

    var body: some View {
        Group {
            if feed.list.isEmpty {
                PWStation(engine: engine)
            } else {
                TabView(selection: Binding(get: { page ?? feed.start }, set: { page = $0 })) {
                    ForEach(Array(feed.list.enumerated()), id: \.element.id) { pair in
                        // Only the pages next to this one draw their cover art (the rest are kept light).
                        PWCard(ep: pair.element, engine: engine, near: abs(pair.offset - cur) <= 1).tag(pair.offset)
                    }
                }
                .tabViewStyle(.verticalPage)
                .onChange(of: page) { _, p in
                    guard let p, feed.list.indices.contains(p), engine.current?.id != feed.list[p].id else { return }
                    engine.play(feed.list, at: p)
                    PodAPI.shared.prepare(Array(feed.list.dropFirst(p + 1).prefix(2)))
                }
                .onChange(of: engine.current?.id) { _, id in
                    if let id, let i = feed.list.firstIndex(where: { $0.id == id }), i != (page ?? feed.start) { withAnimation { page = i } }
                }
                .onAppear {
                    if engine.current?.id != feed.list[feed.start].id { engine.play(feed.list, at: feed.start) }
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { more = true } label: { Image(systemName: "ellipsis").font(.system(size: 15, weight: .bold)).foregroundStyle(.white) }
                    .tint(.white.opacity(0.2))
                    .accessibilityLabel("Speed, sleep timer and download")
            }
        }
        .sheet(isPresented: $more) { PWMore(engine: engine) }
    }
}

/** One show, one page: Pod+'s player card made for the wrist. */
struct PWCard: View {
    let ep: PodEp
    @ObservedObject var engine: PodEngine
    var near = true
    private var mine: Bool { engine.current?.id == ep.id }
    private var dur: Double { mine && engine.duration > 0 ? engine.duration : ep.secs }
    private var pos: Double { mine ? engine.position : (PodStore.shared.spot(ep.id)?.t ?? 0) }

    var body: some View {
        if near { full } else {
            ZStack { Color.black.ignoresSafeArea(); Text(ep.title).font(.system(size: 14, weight: .bold)).lineLimit(3).multilineTextAlignment(.center).padding(10) }
        }
    }

    private var full: some View {
        ZStack {
            PWArt(url: ep.art, px: 60, radius: 0).scaleEffect(1.8).blur(radius: 16).opacity(0.7).ignoresSafeArea()
            LinearGradient(colors: [.black.opacity(0.1), .black.opacity(0.65)], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            VStack(spacing: 5) {
                Spacer(minLength: 22)
                PWArt(url: ep.art, px: 300, radius: 14).frame(width: 66, height: 66)
                    .shadow(color: .black.opacity(0.6), radius: 10, y: 6)
                    .scaleEffect(mine && engine.playing ? 1 : 0.92)
                    .animation(.easeOut(duration: 0.5), value: engine.playing)
                Text(ep.title).font(.system(size: 14, weight: .bold)).lineLimit(2).multilineTextAlignment(.center)
                Text(ep.show).font(.system(size: 12)).foregroundStyle(.white.opacity(0.65)).lineLimit(1)
                if mine && engine.fromDownload { Label("Downloaded", systemImage: "arrow.down.circle.fill").font(.system(size: 10, weight: .semibold)).foregroundStyle(PW.accent) }
                if mine, let m = engine.message { Text(m).font(.system(size: 11, weight: .semibold)).foregroundStyle(PW.accent).multilineTextAlignment(.center).lineLimit(3) }
                // The progress bar, ads in yellow.
                GeometryReader { g in
                    ZStack(alignment: .leading) {
                        Capsule().fill(.white.opacity(0.25))
                        if dur > 0 {
                            ForEach(mine ? engine.ads : [], id: \.key) { ad in
                                Capsule().fill(Color(red: 1, green: 0.82, blue: 0.25)).frame(width: max(2, g.size.width * CGFloat((min(ad.e, dur) - ad.s) / dur))).offset(x: g.size.width * CGFloat(ad.s / dur))
                            }
                            Capsule().fill(.white).frame(width: g.size.width * CGFloat(min(1, pos / dur)))
                        }
                    }
                }
                .frame(height: 4)
                HStack {
                    Text(PW.clock(pos)); Spacer(); Text(dur > 0 ? "-" + PW.clock(dur - pos) : "")
                }
                .font(.system(size: 10).monospacedDigit()).foregroundStyle(.white.opacity(0.6))
                HStack(spacing: 14) {
                    Button { engine.skip(-15) } label: { Image(systemName: "gobackward.15").font(.system(size: 18)) }.buttonStyle(.plain)
                    Button { if mine { engine.toggle() } } label: {
                        Group {
                            if mine && engine.loading && !engine.playing { ProgressView() }
                            else { Image(systemName: mine && engine.playing ? "pause.fill" : "play.fill").font(.system(size: 22)) }
                        }
                        .frame(width: 44, height: 44).background(Circle().fill(PW.orange))
                    }
                    .buttonStyle(.plain)
                    Button { engine.skip(30) } label: { Image(systemName: "goforward.30").font(.system(size: 18)) }.buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 6)
            .foregroundStyle(.white)
        }
    }
}

/** Pod+ Live News Radio. */
struct PWStation: View {
    @ObservedObject var engine: PodEngine
    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.73, green: 0.11, blue: 0.11), .black], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            VStack(spacing: 8) {
                Text("LIVE").font(.system(size: 11, weight: .heavy)).padding(.horizontal, 8).padding(.vertical, 3).background(Capsule().fill(PW.red))
                Image(systemName: "dot.radiowaves.left.and.right").font(.system(size: 34))
                Text("Pod+ Live News Radio").font(.system(size: 15, weight: .heavy)).multilineTextAlignment(.center)
                if let ep = engine.current { Text(ep.title).font(.system(size: 11)).foregroundStyle(.white.opacity(0.7)).lineLimit(2).multilineTextAlignment(.center) }
                Button { engine.toggle() } label: {
                    Image(systemName: engine.playing ? "pause.fill" : "play.fill").font(.system(size: 22)).frame(width: 48, height: 48).background(Circle().fill(.white.opacity(0.2)))
                }
                .buttonStyle(.plain)
            }
            .foregroundStyle(.white)
        }
    }
}

// MARK: - Downloads

/** Episodes kept on the watch, to play with no phone or Wi-Fi nearby. Downloaded in the background (they
 *  keep going with the app closed), ad-free when the server has made that copy, with where its ads are. */
@MainActor
final class PodDownloads: NSObject, ObservableObject, URLSessionDownloadDelegate {
    static let shared = PodDownloads()
    static let most = 12

    struct Ad: Codable { var key: String; var s: Double; var e: Double; var kind: String; var sure: Bool }
    struct Item: Codable, Identifiable {
        var ep: PodEp
        var file: String
        var clean: Bool
        var ads: [Ad]
        var bytes: Int64
        var at: Double
        var id: String { ep.id }
    }
    private struct Pending: Codable { var ep: PodEp; var clean: Bool; var ads: [Ad] }

    @Published private(set) var items: [Item] = []
    /** Downloads under way: episode id to how far (0 to 1, or -1 before it knows the size). */
    @Published private(set) var progress: [String: Double] = [:]
    @Published private(set) var problem: String?
    /** The names of the episodes being downloaded. */
    @Published private(set) var titles: [String: String] = [:]
    private var finishing: [WKURLSessionRefreshBackgroundTask] = []
    private let key = "pod.downloads"
    private lazy var session: URLSession = {
        let c = URLSessionConfiguration.background(withIdentifier: "com.arisereader.podplus.watch.downloads")
        c.sessionSendsLaunchEvents = true
        c.isDiscretionary = false
        return URLSession(configuration: c, delegate: self, delegateQueue: nil)
    }()

    nonisolated private static var dir: URL {
        let d = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("downloads", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }

    override init() {
        super.init()
        if let data = UserDefaults.standard.data(forKey: key), let list = try? JSONDecoder().decode([Item].self, from: data) {
            // Only the ones whose file is still here.
            items = list.filter { FileManager.default.fileExists(atPath: Self.dir.appendingPathComponent($0.file).path) }
        }
    }

    /** Reconnects to downloads that went on while the app was closed. */
    func wake(finishing task: WKURLSessionRefreshBackgroundTask? = nil) {
        if let task { finishing.append(task) }
        session.getAllTasks { tasks in
            let eps = tasks.compactMap { $0.taskDescription.flatMap(Self.pending)?.ep }
            Task { @MainActor in for ep in eps where self.progress[ep.id] == nil { self.progress[ep.id] = -1; self.titles[ep.id] = ep.title } }
        }
    }

    func has(_ id: String) -> Bool { items.contains { $0.id == id } }
    var bytes: Int64 { items.reduce(0) { $0 + $1.bytes } }

    /** The downloaded copy, for the player. */
    func copy(_ ep: PodEp) -> (url: URL, clean: Bool, ads: [PodAd])? {
        guard let it = items.first(where: { $0.id == ep.id }) else { return nil }
        let url = Self.dir.appendingPathComponent(it.file)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        let ads = it.ads.compactMap { PodAd(json: ["key": $0.key, "s": $0.s, "e": $0.e, "kind": $0.kind, "sure": $0.sure]) }
        return (url, it.clean, ads)
    }

    func download(_ ep: PodEp) {
        guard !ep.isLive, !has(ep.id), progress[ep.id] == nil else { return }
        guard items.count + progress.count < Self.most else { problem = "The watch holds \(Self.most) downloads. Remove one to make room."; return }
        problem = nil
        progress[ep.id] = -1
        titles[ep.id] = ep.title
        Task {
            // The ad-free copy when the server has it; otherwise the episode as the podcast publishes it.
            var url = URL(string: ep.audio), clean = false, ads: [Ad] = []
            if !ep.isOwn, !ep.showId.isEmpty, let c = await PodAPI.shared.clean(ep) {
                url = c.url; clean = true
                ads = c.ads.map { Ad(key: $0.key, s: $0.s, e: $0.e, kind: $0.kind, sure: $0.sure) }
            }
            guard let url else { progress[ep.id] = nil; problem = "This episode can't be downloaded."; return }
            let task = session.downloadTask(with: url)
            task.taskDescription = (try? JSONEncoder().encode(Pending(ep: ep, clean: clean, ads: ads))).flatMap { String(data: $0, encoding: .utf8) }
            task.resume()
        }
    }

    func cancel(_ id: String) {
        session.getAllTasks { tasks in
            for t in tasks where t.taskDescription.flatMap(Self.pending)?.ep.id == id { t.cancel() }
        }
        progress[id] = nil
    }

    func remove(_ id: String) {
        if let it = items.first(where: { $0.id == id }) { try? FileManager.default.removeItem(at: Self.dir.appendingPathComponent(it.file)) }
        items.removeAll { $0.id == id }
        save()
    }

    private func save() { if let data = try? JSONEncoder().encode(items) { UserDefaults.standard.set(data, forKey: key) } }

    nonisolated private static func pending(_ text: String) -> Pending? { text.data(using: .utf8).flatMap { try? JSONDecoder().decode(Pending.self, from: $0) } }

    // MARK: URLSessionDownloadDelegate (called on the session's own queue)

    nonisolated func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        guard let p = downloadTask.taskDescription.flatMap(Self.pending) else { return }
        let code = (downloadTask.response as? HTTPURLResponse)?.statusCode ?? 200
        // The file only lasts until this returns, so it's moved here.
        let ext = downloadTask.originalRequest?.url?.pathExtension.lowercased() ?? ""
        let name = p.ep.id.replacingOccurrences(of: "/", with: "_") + "." + (["mp3", "m4a", "aac", "mp4"].contains(ext) ? ext : "mp3")
        let to = Self.dir.appendingPathComponent(name)
        try? FileManager.default.removeItem(at: to)
        let ok = code < 400 && (try? FileManager.default.moveItem(at: location, to: to)) != nil
        let size = ((try? FileManager.default.attributesOfItem(atPath: to.path))?[.size] as? NSNumber)?.int64Value ?? 0
        Task { @MainActor in
            self.progress[p.ep.id] = nil
            guard ok, size > 0 else { self.problem = "\(p.ep.title) didn't download. Try again with your phone or Wi-Fi nearby."; return }
            self.items.removeAll { $0.id == p.ep.id }
            self.items.insert(Item(ep: p.ep, file: name, clean: p.clean, ads: p.ads, bytes: size, at: Date().timeIntervalSince1970), at: 0)
            self.save()
            WKInterfaceDevice.current().play(.success)
        }
    }

    nonisolated func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        guard let id = downloadTask.taskDescription.flatMap(Self.pending)?.ep.id else { return }
        let f = totalBytesExpectedToWrite > 0 ? Double(totalBytesWritten) / Double(totalBytesExpectedToWrite) : -1
        Task { @MainActor in
            // Shown in steps of 2%, so the screen isn't redrawn for every few kilobytes.
            let was = self.progress[id] ?? -1
            if f < 0 || abs(f - was) >= 0.02 { self.progress[id] = f }
        }
    }

    nonisolated func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let error, let p = task.taskDescription.flatMap(Self.pending) else { return }
        let cancelled = (error as NSError).code == NSURLErrorCancelled
        Task { @MainActor in
            self.progress[p.ep.id] = nil
            if !cancelled { self.problem = "\(p.ep.title) didn't download. Try again with your phone or Wi-Fi nearby." }
        }
    }

    nonisolated func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        Task { @MainActor in
            for t in self.finishing { t.setTaskCompletedWithSnapshot(false) }
            self.finishing = []
        }
    }
}

/** Download, its progress, or Downloaded, for one episode. */
struct PWDownloadButton: View {
    let ep: PodEp
    var compact = false
    @ObservedObject private var dl = PodDownloads.shared
    var body: some View {
        if ep.isLive { EmptyView() }
        else if dl.has(ep.id) {
            Label(compact ? "" : "Downloaded", systemImage: "arrow.down.circle.fill").labelStyle(compact ? AnyLabelStyle(.iconOnly) : AnyLabelStyle(.titleAndIcon))
                .font(.system(size: compact ? 18 : 13, weight: .semibold)).foregroundStyle(PW.accent)
                .accessibilityLabel("Downloaded")
        } else if let f = dl.progress[ep.id] {
            Button { dl.cancel(ep.id) } label: {
                ZStack {
                    if f < 0 { ProgressView().scaleEffect(0.6) }
                    else { Circle().stroke(.white.opacity(0.25), lineWidth: 2.5); Circle().trim(from: 0, to: f).stroke(PW.orange, style: StrokeStyle(lineWidth: 2.5, lineCap: .round)).rotationEffect(.degrees(-90)) }
                    Image(systemName: "stop.fill").font(.system(size: 7))
                }
                .frame(width: 22, height: 22)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Downloading. Tap to stop.")
        } else {
            Button { dl.download(ep) } label: {
                Label(compact ? "" : "Download", systemImage: "arrow.down.circle").labelStyle(compact ? AnyLabelStyle(.iconOnly) : AnyLabelStyle(.titleAndIcon))
                    .font(.system(size: compact ? 18 : 13, weight: .semibold))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Download to the watch")
        }
    }
}

/** A type-erased label style (icon only on rows, icon and words in the menu). */
struct AnyLabelStyle: LabelStyle {
    private let make: (Configuration) -> AnyView
    init<S: LabelStyle>(_ style: S) { make = { AnyView(style.makeBody(configuration: $0)) } }
    func makeBody(configuration: Configuration) -> some View { make(configuration) }
}

/** The home screen's Downloads row and its page. */
struct PWDownloadsRow: View {
    let open: ([PodEp], Int) -> Void
    @ObservedObject private var dl = PodDownloads.shared
    var body: some View {
        NavigationLink { PWDownloadsPage(open: open) } label: {
            HStack(spacing: 8) {
                Image(systemName: "arrow.down.circle.fill").font(.system(size: 22)).foregroundStyle(PW.orange)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Downloads").font(.system(size: 14, weight: .bold))
                    Text(dl.items.isEmpty && dl.progress.isEmpty ? "Listen with no phone nearby" : "\(dl.items.count) on this watch\(dl.progress.isEmpty ? "" : " · \(dl.progress.count) coming")").font(.system(size: 11)).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            .padding(8).background(RoundedRectangle(cornerRadius: 14).fill(.white.opacity(0.08)))
        }
        .buttonStyle(.plain)
    }
}

struct PWDownloadsPage: View {
    let open: ([PodEp], Int) -> Void
    @ObservedObject private var dl = PodDownloads.shared
    var body: some View {
        List {
            if let p = dl.problem { Text(p).font(.system(size: 12)).foregroundStyle(PW.accent) }
            if dl.items.isEmpty && dl.progress.isEmpty {
                Text("Tap the download arrow on any episode (on a show's page, or the ... button while it plays) and it's kept on your watch.").font(.system(size: 12)).foregroundStyle(.secondary)
            }
            if !dl.progress.isEmpty {
                Section("Downloading") {
                    ForEach(Array(dl.progress.keys).sorted(), id: \.self) { id in
                        HStack { Text(dl.titles[id] ?? "Episode").font(.system(size: 12)).lineLimit(2); Spacer(); if let f = dl.progress[id], f >= 0 { Text("\(Int(f * 100))%").font(.system(size: 12).monospacedDigit()) } else { ProgressView() } }
                    }
                }
            }
            if !dl.items.isEmpty {
                Section {
                    ForEach(Array(dl.items.enumerated()), id: \.element.id) { pair in
                        Button { open(dl.items.map(\.ep), pair.offset) } label: {
                            HStack(spacing: 8) {
                                PWArt(url: pair.element.ep.art, px: 80, radius: 6).frame(width: 30, height: 30)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(pair.element.ep.title).font(.system(size: 13, weight: .semibold)).lineLimit(2)
                                    Text([pair.element.ep.show, pair.element.clean ? "Ad-free" : ""].filter { !$0.isEmpty }.joined(separator: " · ")).font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(1)
                                }
                            }
                        }
                        .swipeActions { Button(role: .destructive) { dl.remove(pair.element.id) } label: { Image(systemName: "trash") } }
                    }
                } footer: {
                    Text("\(ByteCountFormatter.string(fromByteCount: dl.bytes, countStyle: .file)) used. Swipe one to remove it.").font(.system(size: 10))
                }
            }
        }
        .navigationTitle("Downloads")
    }
}

// MARK: - Speed, sleep timer, download

/** Stops playback after a while, or when the episode ends. */
@MainActor
final class PodSleep: ObservableObject {
    static let shared = PodSleep()
    @Published private(set) var until: Date?
    @Published private(set) var endOfEpisode = false
    private var task: Task<Void, Never>?
    private var watcher: AnyCancellable?

    func set(minutes: Int?) {
        task?.cancel(); task = nil; watcher = nil; endOfEpisode = false; until = nil
        guard let minutes else { return }
        if minutes == 0 {
            // End of this episode: pause when the next one starts.
            endOfEpisode = true
            let id = PodEngine.shared.current?.id
            watcher = PodEngine.shared.$current.dropFirst().sink { [weak self] ep in
                guard ep?.id != id else { return }
                Task { @MainActor in PodEngine.shared.pause(); self?.set(minutes: nil) }
            }
            return
        }
        let end = Date().addingTimeInterval(Double(minutes) * 60)
        until = end
        task = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(minutes) * 60 * 1_000_000_000)
            guard !Task.isCancelled else { return }
            PodEngine.shared.pause()
            WKInterfaceDevice.current().play(.stop)
            self?.set(minutes: nil)
        }
    }
}

struct PWMore: View {
    @ObservedObject var engine: PodEngine
    @ObservedObject private var sleep = PodSleep.shared
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        List {
            Section("Speed") {
                HStack { ForEach(PodEngine.rates, id: \.self) { r in
                    Button { engine.setRate(r) } label: { Text(String(format: "%g×", r)).font(.system(size: 13, weight: .bold)).frame(maxWidth: .infinity) }
                        .buttonStyle(.bordered).tint(engine.rate == r ? PW.orange : .gray)
                } }
            }
            Section("Sleep timer") {
                if let u = sleep.until { Text("Stops at \(u.formatted(date: .omitted, time: .shortened))").font(.system(size: 12)).foregroundStyle(PW.accent) }
                if sleep.endOfEpisode { Text("Stops at the end of this episode").font(.system(size: 12)).foregroundStyle(PW.accent) }
                ForEach([15, 30, 45, 60], id: \.self) { m in Button("\(m) minutes") { sleep.set(minutes: m); dismiss() } }
                Button("End of episode") { sleep.set(minutes: 0); dismiss() }
                if sleep.until != nil || sleep.endOfEpisode { Button("Turn off", role: .destructive) { sleep.set(minutes: nil) } }
            }
            if let ep = engine.current, !ep.isLive {
                Section("This episode") { PWDownloadButton(ep: ep) }
            }
        }
        .navigationTitle("Options")
    }
}
