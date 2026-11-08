// Pod+ for Apple Watch. Plays on the watch (through Bluetooth headphones) with the same native player
// as CarPlay (native/arise-carplay: PodEngine, ad-free, picking up where you left off), and controls
// whatever's playing on the iPhone. The library comes from the phone (PodLink); where you got to on
// the watch goes back to it.
//   Home       Now playing, Live News Radio, Continue listening, Listen later, Following, Pod Modes
//   A show     its newest episodes
//   Playing    the watch's own Now Playing screen (Digital Crown for volume, AirPlay to headphones)
import SwiftUI
import WatchKit

@main
struct PodWatchApp: App {
    @WKApplicationDelegateAdaptor(PodWatchDelegate.self) var delegate
    var body: some Scene {
        WindowGroup { PodWatchHome() }
    }
}

final class PodWatchDelegate: NSObject, WKApplicationDelegate {
    func applicationDidFinishLaunching() { PodLink.shared.start() }
    func applicationDidEnterBackground() { PodLink.shared.sendSpots() }
    func applicationWillResignActive() { PodLink.shared.sendSpots() }
}

/** Redraws when the phone sends a new library. */
@MainActor
final class PodWatchModel: ObservableObject {
    @Published var lib = PodStore.shared.library
    private var watch: NSObjectProtocol?
    init() {
        watch = NotificationCenter.default.addObserver(forName: .podLibraryChanged, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.lib = PodStore.shared.library }
        }
    }
    var continueListening: [PodEp] {
        PodStore.shared.recentSpots(20).filter { $0.1.t > 0 }.prefix(10).map { pair in
            PodEp(id: pair.0, showId: pair.1.showId, title: pair.1.title, show: pair.1.show, art: pair.1.art, audio: pair.1.audio ?? "", secs: pair.1.secs)
        }
    }
}

struct PodWatchHome: View {
    @StateObject private var model = PodWatchModel()
    @ObservedObject private var engine = PodEngine.shared
    @State private var playing = false

    var body: some View {
        NavigationStack {
            List {
                if let ep = engine.current {
                    Button { playing = true } label: {
                        HStack(spacing: 8) {
                            PodWatchArt(url: ep.art, size: 36)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(engine.playing ? "Playing" : "Paused").font(.caption2).foregroundStyle(.orange)
                                Text(ep.title).font(.footnote).lineLimit(2)
                            }
                        }
                    }
                }
                Section {
                    Button { engine.playStation(); playing = true } label: {
                        Label("Live News Radio", systemImage: "dot.radiowaves.left.and.right")
                    }
                    NavigationLink { PhoneNowPlaying() } label: { Label("iPhone's audio", systemImage: "iphone") }
                }
                let cont = model.continueListening
                if !cont.isEmpty { PodWatchSection(title: "Continue", eps: cont, playing: $playing) }
                if !model.lib.later.isEmpty { PodWatchSection(title: "Listen later", eps: Array(model.lib.later.prefix(15)), playing: $playing) }
                if !model.lib.follows.isEmpty {
                    Section("Following") {
                        ForEach(model.lib.follows.prefix(40)) { show in
                            NavigationLink { PodWatchShow(show: show, playing: $playing) } label: {
                                HStack(spacing: 8) { PodWatchArt(url: show.art, size: 28); Text(show.name).font(.footnote).lineLimit(2) }
                            }
                        }
                    }
                }
                let modes = model.lib.modes.filter { !$0.episodes.isEmpty }
                if !modes.isEmpty {
                    Section("Pod Modes") {
                        ForEach(modes) { m in
                            NavigationLink { PodWatchList(title: m.name, eps: m.episodes, playing: $playing) } label: { Text(m.name) }
                        }
                    }
                }
                if model.lib.follows.isEmpty && model.lib.later.isEmpty && cont.isEmpty {
                    Section { Text("Follow shows in Pod+ on your iPhone and they'll show up here.").font(.footnote).foregroundStyle(.secondary) }
                }
            }
            .navigationTitle("Pod+")
            .navigationDestination(isPresented: $playing) { PodWatchPlaying() }
        }
        .tint(.orange)
    }
}

struct PodWatchSection: View {
    let title: String
    let eps: [PodEp]
    @Binding var playing: Bool
    var body: some View {
        Section(title) {
            ForEach(Array(eps.enumerated()), id: \.element.id) { pair in
                PodWatchRow(ep: pair.element) { PodEngine.shared.play(eps, at: pair.offset); playing = true }
            }
        }
    }
}

struct PodWatchList: View {
    let title: String
    let eps: [PodEp]
    @Binding var playing: Bool
    var body: some View {
        List { PodWatchSection(title: title, eps: eps, playing: $playing) }.navigationTitle(title)
    }
}

/** A show's newest episodes, from the Pod+ server. */
struct PodWatchShow: View {
    let show: PodShowRef
    @Binding var playing: Bool
    @State private var eps: [PodEp]?
    @State private var error: String?
    var body: some View {
        Group {
            if let eps = eps {
                if eps.isEmpty { Text("No episodes yet.").foregroundStyle(.secondary) }
                else { List { PodWatchSection(title: show.name, eps: Array(eps.prefix(20)), playing: $playing) } }
            } else if let e = error { Text(e).font(.footnote).foregroundStyle(.secondary).padding() }
            else { ProgressView() }
        }
        .navigationTitle(show.name)
        .task {
            do { eps = try await PodAPI.shared.showEpisodes(show.id); PodAPI.shared.prepare(Array((eps ?? []).prefix(2))) }
            catch { self.error = error.localizedDescription }
        }
    }
}

struct PodWatchRow: View {
    let ep: PodEp
    let tap: () -> Void
    var body: some View {
        Button(action: tap) {
            VStack(alignment: .leading, spacing: 2) {
                Text(ep.title).font(.footnote).lineLimit(2)
                Text(detail).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            }
        }
    }
    private var detail: String {
        if let s = PodStore.shared.spot(ep.id), s.t > 0, s.secs > s.t { return "\(Int(((s.secs - s.t) / 60).rounded())) min left" }
        return ep.secs > 0 ? "\(ep.show) · \(Int((ep.secs / 60).rounded())) min" : ep.show
    }
}

/** The watch's own Now Playing screen for what Pod+ is playing on the watch. */
struct PodWatchPlaying: View {
    @ObservedObject private var engine = PodEngine.shared
    var body: some View {
        VStack(spacing: 4) {
            if engine.loading && !engine.playing { ProgressView().padding(.bottom, 2) }
            if let m = engine.message { Text(m).font(.caption2).foregroundStyle(.orange).multilineTextAlignment(.center) }
            NowPlayingView()
        }
        .toolbar {
            ToolbarItem(placement: .bottomBar) {
                Button(action: { engine.cycleRate() }) { Text(engine.rate == 1 ? "1×" : String(format: "%g×", engine.rate)).font(.footnote.bold()) }
            }
        }
    }
}

/** What the iPhone is playing (Pod+ or anything else), with its controls. */
struct PhoneNowPlaying: View {
    var body: some View { NowPlayingView().navigationTitle("iPhone") }
}

struct PodWatchArt: View {
    let url: String
    let size: CGFloat
    var body: some View {
        AsyncImage(url: URL(string: PodArt.sized(url, 120))) { img in img.resizable().scaledToFill() } placeholder: { Color.orange.opacity(0.25) }
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: size * 0.2))
    }
}
