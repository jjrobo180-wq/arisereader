// Pod+ for Apple TV. The same native player as CarPlay and the watch (native/arise-carplay: ad-free,
// picking up where you left off), on the big screen.
//   Listen Now  Continue listening, Listen later and new episodes from shows you follow (signed in)
//   Discover    Top shows, Open Mic, Up to the Minute News, and shows by genre
//   Radio       Live News Radio and stations by kind
//   Search      podcasts and episodes
//   Account     sign in with your Pod+ email to bring your shows from your iPhone
// The Siri Remote's play/pause works everywhere; left and right skip back 15 and ahead 30 in the player.
import SwiftUI

@main
struct PodTVApp: App {
    var body: some Scene {
        WindowGroup { PodTVRoot().preferredColorScheme(.dark) }
    }
}

@MainActor
final class PodTVModel: ObservableObject {
    @Published var lib = PodStore.shared.library
    @Published var newFromFollows: [PodEp] = []
    private var watch: NSObjectProtocol?
    init() {
        watch = NotificationCenter.default.addObserver(forName: .podLibraryChanged, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.lib = PodStore.shared.library; Task { await self?.loadNew() } }
        }
        Task { _ = try? await PodAPI.shared.syncLibrary(); await loadNew() }
    }
    var signedIn: Bool { lib.session != nil }
    var continueListening: [PodEp] {
        PodStore.shared.recentSpots(30).filter { $0.1.t > 0 }.prefix(15).map { pair in
            PodEp(id: pair.0, showId: pair.1.showId, title: pair.1.title, show: pair.1.show, art: pair.1.art, audio: pair.1.audio ?? "", secs: pair.1.secs)
        }
    }
    func loadNew() async {
        let shows = Array(lib.follows.prefix(12))
        guard !shows.isEmpty else { newFromFollows = []; return }
        var all: [PodEp] = []
        await withTaskGroup(of: [PodEp].self) { g in
            for s in shows { g.addTask { (try? await PodAPI.shared.showEpisodes(s.id))?.prefix(2).map { $0 } ?? [] } }
            for await eps in g { all += eps }
        }
        newFromFollows = Array(all.sorted { ($0.date ?? "") > ($1.date ?? "") }.prefix(15))
    }
}

struct PodTVRoot: View {
    @StateObject private var model = PodTVModel()
    @ObservedObject private var engine = PodEngine.shared
    @State private var showPlayer = false

    var body: some View {
        TabView {
            PodTVListenNow(model: model, play: play).tabItem { Text("Listen Now") }
            PodTVDiscover(play: play).tabItem { Text("Discover") }
            PodTVRadio(model: model, play: play, station: { engine.playStation(); showPlayer = true }).tabItem { Text("Radio") }
            PodTVSearch(play: play).tabItem { Image(systemName: "magnifyingglass") }
            PodTVAccount(model: model).tabItem { Text(model.signedIn ? "Account" : "Sign in") }
        }
        .fullScreenCover(isPresented: $showPlayer) { PodTVPlayer() }
        .onPlayPauseCommand { if engine.current != nil { engine.toggle() } }
    }

    private func play(_ list: [PodEp], _ i: Int) {
        engine.play(list, at: i)
        showPlayer = true
    }
}

// MARK: Rows

/** A row of episodes you scroll sideways, like the TV's own apps. */
struct PodTVEpisodeRow: View {
    let title: String
    let eps: [PodEp]
    let play: ([PodEp], Int) -> Void
    var body: some View {
        if !eps.isEmpty {
            VStack(alignment: .leading, spacing: 16) {
                Text(title).font(.title3.bold()).padding(.leading, 60)
                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHStack(spacing: 40) {
                        ForEach(Array(eps.enumerated()), id: \.element.id) { pair in
                            Button { play(eps, pair.offset) } label: { PodTVTile(art: pair.element.art, title: pair.element.title, detail: detail(pair.element)) }
                                .buttonStyle(.card)
                        }
                    }
                    .padding(.horizontal, 60).padding(.vertical, 30)
                }
            }
        }
    }
    private func detail(_ ep: PodEp) -> String {
        if ep.isLive { return ep.show.isEmpty ? "Live" : ep.show }
        if let s = PodStore.shared.spot(ep.id), s.t > 0, s.secs > s.t { return "\(ep.show) · \(Int(((s.secs - s.t) / 60).rounded())) min left" }
        return ep.secs > 0 ? "\(ep.show) · \(Int((ep.secs / 60).rounded())) min" : ep.show
    }
}

struct PodTVShowRow: View {
    let title: String
    let shows: [PodShowRef]
    let play: ([PodEp], Int) -> Void
    var body: some View {
        if !shows.isEmpty {
            VStack(alignment: .leading, spacing: 16) {
                Text(title).font(.title3.bold()).padding(.leading, 60)
                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHStack(spacing: 40) {
                        ForEach(shows) { s in
                            NavigationLink { PodTVShow(show: s, play: play) } label: { PodTVTile(art: s.art, title: s.name, detail: s.author) }
                                .buttonStyle(.card)
                        }
                    }
                    .padding(.horizontal, 60).padding(.vertical, 30)
                }
            }
        }
    }
}

struct PodTVTile: View {
    let art: String
    let title: String
    let detail: String
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            PodTVArt(url: art).frame(width: 300, height: 300)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.callout.weight(.semibold)).lineLimit(2)
                Text(detail).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            .frame(width: 300, alignment: .leading).padding([.horizontal, .bottom], 12)
        }
    }
}

struct PodTVArt: View {
    let url: String
    var body: some View {
        AsyncImage(url: URL(string: PodArt.sized(url, 600))) { img in img.resizable().scaledToFill() } placeholder: {
            ZStack { LinearGradient(colors: [.orange.opacity(0.6), .pink.opacity(0.5)], startPoint: .topLeading, endPoint: .bottomTrailing); Image(systemName: "waveform").font(.largeTitle) }
        }
        .clipped()
    }
}

// MARK: Tabs

struct PodTVListenNow: View {
    @ObservedObject var model: PodTVModel
    let play: ([PodEp], Int) -> Void
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 30) {
                    PodTVEpisodeRow(title: "Continue listening", eps: model.continueListening, play: play)
                    PodTVEpisodeRow(title: "New from shows you follow", eps: model.newFromFollows, play: play)
                    PodTVEpisodeRow(title: "Listen later", eps: Array(model.lib.later.prefix(20)), play: play)
                    PodTVShowRow(title: "Following", shows: Array(model.lib.follows.prefix(30)), play: play)
                    if model.lib.follows.isEmpty && model.lib.later.isEmpty && model.continueListening.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Welcome to Pod+").font(.title.bold())
                            Text(model.signedIn ? "Follow shows in Pod+ on your iPhone and they'll show up here." : "Sign in with your Pod+ email to bring your shows from your iPhone, or start in Discover and Radio.")
                                .font(.headline).foregroundStyle(.secondary)
                        }
                        .padding(60)
                    }
                }
            }
        }
    }
}

struct PodTVDiscover: View {
    let play: ([PodEp], Int) -> Void
    @State private var top: [PodShowRef] = []
    @State private var openMic: [PodEp] = []
    @State private var news: [PodEp] = []
    @State private var genres: [(String, [PodShowRef])] = []
    private static let picks = ["comedy", "truecrime", "history", "science", "business", "sports", "health", "culture"]
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 30) {
                    PodTVShowRow(title: "Top shows", shows: top, play: play)
                    PodTVEpisodeRow(title: "Open Mic: new voices", eps: openMic, play: play)
                    PodTVEpisodeRow(title: "Up to the minute news", eps: news, play: play)
                    ForEach(Array(genres.enumerated()), id: \.offset) { pair in PodTVShowRow(title: pair.element.0, shows: pair.element.1, play: play) }
                    if top.isEmpty && openMic.isEmpty { ProgressView().frame(maxWidth: .infinity).padding(80) }
                }
            }
        }
        .task {
            if top.isEmpty { top = (try? await PodAPI.shared.topShows()) ?? [] }
            if openMic.isEmpty { openMic = (try? await PodAPI.shared.openMic()) ?? [] }
            if news.isEmpty { news = (try? await PodAPI.shared.news()) ?? [] }
            if genres.isEmpty {
                for g in Self.picks { if let s = try? await PodAPI.shared.topShows(genre: g), !s.isEmpty { genres.append((PodTVNames.genre(g), s)) } }
            }
        }
    }
}

struct PodTVRadio: View {
    @ObservedObject var model: PodTVModel
    let play: ([PodEp], Int) -> Void
    let station: () -> Void
    @State private var rows: [(String, [PodEp])] = []
    private static let kinds: [(String, String?)] = [("Near you", nil), ("News", "news"), ("Talk", "talk"), ("Sports", "sports"), ("Hip hop", "hip hop"), ("Pop", "pop"), ("Rock", "rock"), ("Country", "country"), ("Jazz", "jazz"), ("Chill", "chillout")]
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 30) {
                    Button(action: station) {
                        HStack(spacing: 30) {
                            Image(systemName: "dot.radiowaves.left.and.right").font(.system(size: 60))
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Live News Radio").font(.title2.bold())
                                Text("One station, always on, ad-free. Everyone hears the same moment.").foregroundStyle(.secondary)
                            }
                        }
                        .padding(40)
                    }
                    .buttonStyle(.card).padding(.horizontal, 60).padding(.top, 30)
                    ForEach(model.lib.modes.filter { !$0.episodes.isEmpty }) { m in PodTVEpisodeRow(title: m.name, eps: m.episodes, play: play) }
                    ForEach(Array(rows.enumerated()), id: \.offset) { pair in PodTVEpisodeRow(title: pair.element.0, eps: pair.element.1, play: play) }
                }
            }
        }
        .task {
            guard rows.isEmpty else { return }
            for k in Self.kinds { let s = await PodAPI.shared.stations(tag: k.1, limit: 20); if !s.isEmpty { rows.append((k.0, s)) } }
        }
    }
}

struct PodTVSearch: View {
    let play: ([PodEp], Int) -> Void
    @State private var q = ""
    @State private var shows: [PodShowRef] = []
    @State private var eps: [PodEp] = []
    @State private var task: Task<Void, Never>?
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 30) {
                    PodTVShowRow(title: "Podcasts", shows: shows, play: play)
                    PodTVEpisodeRow(title: "Episodes", eps: eps, play: play)
                }
            }
            .searchable(text: $q, prompt: "Podcasts, people, topics")
            .onChange(of: q) { value in
                task?.cancel()
                let words = value.trimmingCharacters(in: .whitespaces)
                guard words.count >= 2 else { shows = []; eps = []; return }
                task = Task {
                    try? await Task.sleep(nanoseconds: 400_000_000)
                    guard !Task.isCancelled, let r = try? await PodAPI.shared.search(words) else { return }
                    shows = r.shows; eps = r.episodes
                }
            }
        }
    }
}

struct PodTVShow: View {
    let show: PodShowRef
    let play: ([PodEp], Int) -> Void
    @State private var eps: [PodEp]?
    @State private var error: String?
    var body: some View {
        HStack(alignment: .top, spacing: 60) {
            VStack(alignment: .leading, spacing: 16) {
                PodTVArt(url: show.art).frame(width: 420, height: 420).clipShape(RoundedRectangle(cornerRadius: 24))
                Text(show.name).font(.title2.bold()).lineLimit(3)
                Text(show.author).foregroundStyle(.secondary)
            }
            .frame(width: 420)
            Group {
                if let eps = eps {
                    List(Array(eps.prefix(50).enumerated()), id: \.element.id) { pair in
                        Button { play(eps, pair.offset) } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(pair.element.title).font(.headline).lineLimit(2)
                                Text(PodTVNames.minutes(pair.element)).font(.caption).foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 6)
                        }
                    }
                } else if let e = error { Text(e).foregroundStyle(.secondary) }
                else { ProgressView() }
            }
        }
        .padding(60)
        .task {
            do { eps = try await PodAPI.shared.showEpisodes(show.id); PodAPI.shared.prepare(Array((eps ?? []).prefix(3))) }
            catch { self.error = error.localizedDescription }
        }
    }
}

struct PodTVAccount: View {
    @ObservedObject var model: PodTVModel
    @State private var email = ""
    @State private var code = ""
    @State private var sent = false
    @State private var busy = false
    @State private var note: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 30) {
            if model.signedIn {
                Text("Signed in").font(.title.bold())
                Text(PodStore.shared.email ?? "Your Pod+ account").font(.headline).foregroundStyle(.secondary)
                Text("Your shows, saved episodes and where you left off come from Pod+ on your iPhone.").foregroundStyle(.secondary)
                HStack(spacing: 30) {
                    Button("Bring my shows now") { Task { busy = true; note = (try? await PodAPI.shared.syncLibrary()) == true ? "Up to date." : "Open Pod+ on your iPhone while signed in, then try again."; busy = false } }
                    Button("Sign out", role: .destructive) { PodAPI.shared.signOut() }
                }
            } else {
                Text("Sign in to Pod+").font(.title.bold())
                Text("Use the email you use in Pod+ on your iPhone. We'll email you a 6-digit code.").foregroundStyle(.secondary)
                if !sent {
                    TextField("Email", text: $email).textContentType(.emailAddress).keyboardType(.emailAddress).frame(maxWidth: 800)
                    Button(busy ? "Sending…" : "Email me a code") { Task { await ask() } }.disabled(busy || !email.contains("@"))
                } else {
                    Text("We sent a code to \(email).").font(.headline)
                    TextField("6-digit code", text: $code).keyboardType(.numberPad).frame(maxWidth: 500)
                    HStack(spacing: 30) {
                        Button(busy ? "Checking…" : "Sign in") { Task { await check() } }.disabled(busy || code.filter(\.isNumber).count != 6)
                        Button("Use another email") { sent = false; code = "" }
                    }
                }
            }
            if let n = note { Text(n).foregroundStyle(.orange) }
            Spacer()
        }
        .padding(80)
    }
    private func ask() async {
        busy = true; note = nil
        do { try await PodAPI.shared.sendCode(email: email.trimmingCharacters(in: .whitespaces)); sent = true }
        catch { note = error.localizedDescription }
        busy = false
    }
    private func check() async {
        busy = true; note = nil
        do { try await PodAPI.shared.verify(email: email.trimmingCharacters(in: .whitespaces), code: code.filter(\.isNumber)); note = "You're signed in." }
        catch { note = error.localizedDescription }
        busy = false
    }
}

// MARK: The player

struct PodTVPlayer: View {
    @ObservedObject private var engine = PodEngine.shared
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        ZStack {
            if let ep = engine.current {
                PodTVArt(url: ep.art).blur(radius: 60).opacity(0.45).ignoresSafeArea()
                LinearGradient(colors: [.black.opacity(0.2), .black.opacity(0.85)], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
                HStack(spacing: 80) {
                    PodTVArt(url: ep.art).frame(width: 560, height: 560).clipShape(RoundedRectangle(cornerRadius: 28)).shadow(radius: 40)
                    VStack(alignment: .leading, spacing: 24) {
                        Text(engine.onStation ? "LIVE NEWS RADIO" : ep.isLive ? "LIVE" : ep.show.uppercased()).font(.caption.bold()).foregroundStyle(.orange)
                        Text(ep.title).font(.title.bold()).lineLimit(3)
                        if !ep.isLive || engine.onStation {
                            ProgressView(value: engine.duration > 0 ? min(1, engine.position / engine.duration) : 0).tint(.orange)
                            HStack { Text(PodTVNames.clock(engine.position)); Spacer(); Text("-" + PodTVNames.clock(max(0, engine.duration - engine.position))) }
                                .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                        }
                        if let m = engine.message { Text(m).foregroundStyle(.orange) }
                        HStack(spacing: 40) {
                            if !ep.isLive { Button { engine.skip(-15) } label: { Image(systemName: "gobackward.15").font(.title) } }
                            Button { engine.toggle() } label: { Image(systemName: engine.playing ? "pause.fill" : "play.fill").font(.title) }
                            if !ep.isLive { Button { engine.skip(30) } label: { Image(systemName: "goforward.30").font(.title) } }
                            if engine.onStation || engine.index + 1 < engine.queue.count { Button { engine.next() } label: { Image(systemName: "forward.end.fill").font(.title) } }
                            if !ep.isLive || engine.onStation { Button { engine.cycleRate() } label: { Text(engine.rate == 1 ? "1×" : String(format: "%g×", engine.rate)).font(.title3.bold()) } }
                        }
                        if engine.loading && !engine.playing { ProgressView() }
                    }
                    .frame(maxWidth: 900, alignment: .leading)
                }
            } else {
                ProgressView()
            }
        }
        .onPlayPauseCommand { engine.toggle() }
        .onExitCommand { dismiss() }
    }
}

enum PodTVNames {
    static func clock(_ t: Double) -> String {
        let s = Int(max(0, t)); let h = s / 3600, m = (s % 3600) / 60, r = s % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, r) : String(format: "%d:%02d", m, r)
    }
    static func minutes(_ ep: PodEp) -> String {
        if let s = PodStore.shared.spot(ep.id), s.t > 0, s.secs > s.t { return "\(Int(((s.secs - s.t) / 60).rounded())) min left" }
        return ep.secs > 0 ? "\(Int((ep.secs / 60).rounded())) min" : ""
    }
    static let genres: [String: String] = ["comedy": "Comedy", "truecrime": "True Crime", "history": "History", "science": "Science", "business": "Business", "sports": "Sports", "health": "Health & Fitness", "culture": "Society & Culture", "news": "News", "tech": "Technology"]
    static func genre(_ id: String) -> String { genres[id] ?? id.capitalized }
}
