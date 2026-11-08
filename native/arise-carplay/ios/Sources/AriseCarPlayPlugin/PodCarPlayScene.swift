// Pod+ in the car (CarPlay). Four tabs and the car's Now Playing screen:
//   Listen Now  Continue listening, new episodes from shows you follow, Listen later, Liked
//   Following   the shows you follow, each with its newest episodes
//   Browse      Open Mic, Up to the Minute News, Top shows, and your genres
//   Radio       Live News Radio, your Pod Modes, and stations near you (by kind)
// Everything plays through PodEngine (ad-free, picking up where you left off). The lists come from the
// library the iPhone app hands over (PodStore) and from the Pod+ server, so CarPlay works even when
// Pod+ was started from the car and the phone's screen never opened.
#if os(iOS) && canImport(CarPlay)
import CarPlay
import Combine
import UIKit

@objc(PodCarPlaySceneDelegate)
public final class PodCarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
    private var ui: CPInterfaceController?
    private var tabs: CPTabBarTemplate?
    private var listenNow: CPListTemplate?
    private var following: CPListTemplate?
    private var watchers = Set<AnyCancellable>()
    private var libraryWatch: NSObjectProtocol?
    /** List items on screen, by episode id, so the one playing shows it. */
    private var itemsByEp: [String: [WeakItem]] = [:]
    private var newFromFollows: (at: Date, eps: [PodEp])?
    private static let images = NSCache<NSString, UIImage>()

    @MainActor private var engine: PodEngine { PodEngine.shared }
    private var store: PodStore { PodStore.shared }
    private var api: PodAPI { PodAPI.shared }

    // MARK: Connecting

    public func templateApplicationScene(_ scene: CPTemplateApplicationScene, didConnect interfaceController: CPInterfaceController) {
        ui = interfaceController
        MainActor.assumeIsolated { connect() }
    }

    public func templateApplicationScene(_ scene: CPTemplateApplicationScene, didDisconnectInterfaceController interfaceController: CPInterfaceController) {
        ui = nil; tabs = nil; listenNow = nil; following = nil
        watchers.removeAll(); itemsByEp.removeAll()
        if let w = libraryWatch { NotificationCenter.default.removeObserver(w); libraryWatch = nil }
    }

    @MainActor private func connect() {
        let now = CPListTemplate(title: "Listen Now", sections: [])
        now.tabTitle = "Listen Now"; now.tabImage = UIImage(systemName: "play.circle")
        let follows = CPListTemplate(title: "Following", sections: [])
        follows.tabTitle = "Following"; follows.tabImage = UIImage(systemName: "heart.text.square")
        let browse = browseTemplate()
        let radio = radioTemplate()
        listenNow = now; following = follows
        let bar = CPTabBarTemplate(templates: [now, follows, browse, radio])
        tabs = bar
        ui?.setRootTemplate(bar, animated: false, completion: nil)
        setUpNowPlaying()
        fillListenNow(); fillFollowing()

        // A new library from the phone: the lists redraw.
        libraryWatch = NotificationCenter.default.addObserver(forName: .podLibraryChanged, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.newFromFollows = nil; self?.fillListenNow(); self?.fillFollowing() }
        }
        // What's playing: its row shows it, and a problem is said out loud on the screen.
        engine.$current.removeDuplicates { $0?.id == $1?.id }.sink { [weak self] ep in self?.markPlaying(ep?.id) }.store(in: &watchers)
        engine.$message.compactMap { $0 }.removeDuplicates().sink { [weak self] m in self?.alert(m) }.store(in: &watchers)
    }

    // MARK: Listen Now

    @MainActor private func fillListenNow() {
        guard let t = listenNow else { return }
        let lib = store.library
        var sections: [CPListSection] = []
        let cont: [PodEp] = store.recentSpots(30).filter { $0.1.t > 0 }.prefix(12).map { pair in
            let s = pair.1
            return PodEp(id: pair.0, showId: s.showId, title: s.title, show: s.show, art: s.art, audio: s.audio ?? "", secs: s.secs)
        }
        if !cont.isEmpty { sections.append(section("Continue listening", cont)) }
        if let fresh = newFromFollows?.eps, !fresh.isEmpty { sections.append(section("New from shows you follow", fresh)) }
        if !lib.later.isEmpty { sections.append(section("Listen later", Array(lib.later.prefix(12)))) }
        if !lib.liked.isEmpty { sections.append(section("Liked", Array(lib.liked.prefix(12)))) }
        if sections.isEmpty {
            let start = CPListItem(text: "Live News Radio", detailText: "Nonstop news, ad-free", image: UIImage(systemName: "dot.radiowaves.left.and.right"))
            start.handler = { [weak self] _, done in MainActor.assumeIsolated { self?.engine.playStation(); self?.showNowPlaying() }; done() }
            let hint = CPListItem(text: "Follow shows on your iPhone", detailText: "Open Pod+ on your phone; your shows and saved episodes show up here.", image: UIImage(systemName: "iphone"))
            sections.append(CPListSection(items: [start, hint]))
        }
        t.updateSections(Array(sections.prefix(CPListTemplate.maximumSectionCount)))
        // New episodes from followed shows: the newest of each, asked for in the background.
        if newFromFollows == nil || Date().timeIntervalSince(newFromFollows!.at) > 900, !lib.follows.isEmpty {
            newFromFollows = (Date(), newFromFollows?.eps ?? [])
            let shows = Array(lib.follows.prefix(10))
            Task { @MainActor [weak self] in
                var latest: [PodEp] = []
                await withTaskGroup(of: [PodEp].self) { g in
                    for s in shows { g.addTask { (try? await PodAPI.shared.showEpisodes(s.id))?.prefix(2).map { $0 } ?? [] } }
                    for await eps in g { latest += eps }
                }
                guard let self = self else { return }
                let heard = Set(self.store.recentSpots(200).map { $0.0 })
                let fresh = latest.filter { !heard.contains($0.id) }.sorted { ($0.date ?? "") > ($1.date ?? "") }.prefix(12)
                self.newFromFollows = (Date(), Array(fresh))
                self.api.prepare(Array(fresh.prefix(4)))
                self.fillListenNow()
            }
        }
    }

    // MARK: Following

    @MainActor private func fillFollowing() {
        guard let t = following else { return }
        let shows = store.library.follows
        if shows.isEmpty {
            t.emptyViewTitleVariants = ["No shows yet"]
            t.emptyViewSubtitleVariants = ["Follow shows in Pod+ on your iPhone and they'll be here."]
            t.updateSections([])
            return
        }
        t.updateSections([CPListSection(items: shows.prefix(CPListTemplate.maximumItemCount).map { showItem($0) })])
    }

    @MainActor private func showItem(_ s: PodShowRef) -> CPListItem {
        let item = CPListItem(text: s.name, detailText: s.author, image: placeholder("mic"), accessoryImage: nil, accessoryType: .disclosureIndicator)
        loadImage(s.art) { item.setImage($0) }
        item.handler = { [weak self] _, done in
            MainActor.assumeIsolated { self?.pushEpisodes(title: s.name) { try await PodAPI.shared.showEpisodes(s.id) } }
            done()
        }
        return item
    }

    // MARK: Browse

    @MainActor private func browseTemplate() -> CPListTemplate {
        let open = row("Open Mic", "New and independent podcasters", "music.mic") { [weak self] in self?.pushEpisodes(title: "Open Mic") { try await PodAPI.shared.openMic() } }
        let news = row("Up to the Minute News", "The latest bulletins", "newspaper") { [weak self] in self?.pushEpisodes(title: "News") { try await PodAPI.shared.news() } }
        let top = row("Top shows", "What everyone's listening to", "chart.bar") { [weak self] in self?.pushShows(title: "Top shows") { try await PodAPI.shared.topShows() } }
        var sections = [CPListSection(items: [open, news, top])]
        let genres = store.library.genres.prefix(10).map { g in
            row(Self.genreName(g), nil, "square.grid.2x2") { [weak self] in self?.pushShows(title: Self.genreName(g)) { try await PodAPI.shared.topShows(genre: g) } }
        }
        if !genres.isEmpty { sections.append(CPListSection(items: Array(genres), header: "Your interests", sectionIndexTitle: nil)) }
        let t = CPListTemplate(title: "Browse", sections: sections)
        t.tabTitle = "Browse"; t.tabImage = UIImage(systemName: "square.grid.2x2")
        return t
    }

    // MARK: Radio

    @MainActor private func radioTemplate() -> CPListTemplate {
        let live = row("Live News Radio", "One station, always on, ad-free", "dot.radiowaves.left.and.right") { [weak self] in self?.engine.playStation(); self?.showNowPlaying() }
        var sections = [CPListSection(items: [live], header: "Pod+", sectionIndexTitle: nil)]
        let modes = store.library.modes.filter { !$0.episodes.isEmpty }.prefix(8).map { m in
            row(m.name, "\(m.episodes.count) episode\(m.episodes.count == 1 ? "" : "s")", "list.bullet") { [weak self] in self?.pushEpisodes(title: m.name) { m.episodes } }
        }
        if !modes.isEmpty { sections.append(CPListSection(items: Array(modes), header: "Pod Modes", sectionIndexTitle: nil)) }
        let kinds: [(String, String?, String)] = [("Near you", nil, "location"), ("News", "news", "newspaper"), ("Talk", "talk", "bubble.left.and.bubble.right"), ("Sports", "sports", "sportscourt"),
                                                  ("Hip hop", "hip hop", "music.note"), ("Pop", "pop", "music.note"), ("Rock", "rock", "guitars"), ("Country", "country", "music.note"),
                                                  ("Jazz", "jazz", "music.quarternote.3"), ("Classical", "classical", "music.quarternote.3"), ("Chill", "chillout", "moon.stars")]
        let stations: [CPListItem] = kinds.map { kind in
            let (name, tag, icon) = kind
            return row(name, nil, icon) { [weak self] in self?.pushEpisodes(title: name, live: true) { await PodAPI.shared.stations(tag: tag) } }
        }
        sections.append(CPListSection(items: stations, header: "Stations", sectionIndexTitle: nil))
        let t = CPListTemplate(title: "Radio", sections: sections)
        t.tabTitle = "Radio"; t.tabImage = UIImage(systemName: "radio")
        return t
    }

    // MARK: Lists that load

    /** A list of episodes, loaded when it opens; tapping one plays the list from there. */
    @MainActor private func pushEpisodes(title: String, live: Bool = false, _ load: @escaping () async throws -> [PodEp]) {
        let t = CPListTemplate(title: title, sections: [])
        t.emptyViewTitleVariants = ["Loading…"]
        ui?.pushTemplate(t, animated: true, completion: nil)
        Task { @MainActor [weak self, weak t] in
            do {
                let eps = try await load()
                guard let self = self, let t = t else { return }
                if eps.isEmpty { t.emptyViewTitleVariants = [live ? "No stations right now" : "Nothing here yet"]; t.emptyViewSubtitleVariants = ["Try again in a little while."] }
                t.updateSections([self.section(nil, Array(eps.prefix(CPListTemplate.maximumItemCount)))])
                if !live { self.api.prepare(Array(eps.prefix(3))) }
            } catch {
                t?.emptyViewTitleVariants = ["Couldn't load this"]
                t?.emptyViewSubtitleVariants = [error.localizedDescription]
                t?.updateSections([])
            }
        }
    }

    /** A list of shows; tapping one opens its episodes. */
    @MainActor private func pushShows(title: String, _ load: @escaping () async throws -> [PodShowRef]) {
        let t = CPListTemplate(title: title, sections: [])
        t.emptyViewTitleVariants = ["Loading…"]
        ui?.pushTemplate(t, animated: true, completion: nil)
        Task { @MainActor [weak self, weak t] in
            do {
                let shows = try await load()
                guard let self = self, let t = t else { return }
                if shows.isEmpty { t.emptyViewTitleVariants = ["Nothing here yet"] }
                t.updateSections([CPListSection(items: shows.prefix(CPListTemplate.maximumItemCount).map { self.showItem($0) })])
            } catch {
                t?.emptyViewTitleVariants = ["Couldn't load this"]
                t?.emptyViewSubtitleVariants = [error.localizedDescription]
                t?.updateSections([])
            }
        }
    }

    // MARK: Rows

    @MainActor private func section(_ header: String?, _ eps: [PodEp]) -> CPListSection {
        let items = eps.enumerated().map { pair in episodeItem(pair.element, list: eps, at: pair.offset) }
        return CPListSection(items: items, header: header, sectionIndexTitle: nil)
    }

    @MainActor private func episodeItem(_ ep: PodEp, list: [PodEp], at i: Int) -> CPListItem {
        var detail = ep.show
        if ep.isLive { detail = ep.show.isEmpty ? "Live" : "Live · \(ep.show)" }
        else if let s = store.spot(ep.id), s.t > 0, s.secs > s.t { detail += " · \(Self.minutes(s.secs - s.t)) left" }
        else if ep.secs > 0 { detail += " · \(Self.minutes(ep.secs))" }
        let item = CPListItem(text: ep.title, detailText: detail, image: placeholder(ep.isLive ? "radio" : "waveform"))
        if !ep.isLive, let s = store.spot(ep.id), s.t > 0, s.secs > 0 { item.playbackProgress = CGFloat(min(1, s.t / s.secs)) }
        item.isPlaying = engine.current?.id == ep.id
        item.playingIndicatorLocation = .trailing
        loadImage(ep.art) { item.setImage($0) }
        item.handler = { [weak self] _, done in
            MainActor.assumeIsolated {
                self?.engine.play(list, at: i)
                self?.showNowPlaying()
            }
            done()
        }
        itemsByEp[ep.id, default: []].append(WeakItem(item))
        return item
    }

    @MainActor private func row(_ text: String, _ detail: String?, _ icon: String, _ tap: @escaping () -> Void) -> CPListItem {
        let item = CPListItem(text: text, detailText: detail, image: UIImage(systemName: icon), accessoryImage: nil, accessoryType: .disclosureIndicator)
        item.handler = { _, done in MainActor.assumeIsolated { tap() }; done() }
        return item
    }

    @MainActor private func markPlaying(_ id: String?) {
        for (key, list) in itemsByEp {
            let alive = list.filter { $0.item != nil }
            if alive.isEmpty { itemsByEp[key] = nil; continue }
            itemsByEp[key] = alive
            for w in alive { w.item?.isPlaying = key == id }
        }
    }

    // MARK: Now Playing

    @MainActor private func setUpNowPlaying() {
        let np = CPNowPlayingTemplate.shared
        let speed = CPNowPlayingPlaybackRateButton { [weak self] _ in MainActor.assumeIsolated { self?.engine.cycleRate() } }
        np.updateNowPlayingButtons([speed])
        np.isUpNextButtonEnabled = false
        np.isAlbumArtistButtonEnabled = false
    }

    @MainActor private func showNowPlaying() {
        guard let ui = ui else { return }
        if ui.topTemplate === CPNowPlayingTemplate.shared { return }
        if ui.templates.contains(where: { $0 === CPNowPlayingTemplate.shared }) { ui.pop(to: CPNowPlayingTemplate.shared, animated: true, completion: nil); return }
        ui.pushTemplate(CPNowPlayingTemplate.shared, animated: true, completion: nil)
    }

    @MainActor private func alert(_ message: String) {
        guard let ui = ui, ui.presentedTemplate == nil else { return }
        let ok = CPAlertAction(title: "OK", style: .cancel) { [weak self] _ in self?.ui?.dismissTemplate(animated: true, completion: nil) }
        ui.presentTemplate(CPAlertTemplate(titleVariants: [message], actions: [ok]), animated: true, completion: nil)
    }

    // MARK: Pictures

    private func placeholder(_ symbol: String) -> UIImage? { UIImage(systemName: symbol) }

    private func loadImage(_ url: String, _ set: @escaping (UIImage) -> Void) {
        guard !url.isEmpty else { return }
        let key = url as NSString
        if let img = Self.images.object(forKey: key) { set(img); return }
        guard let u = URL(string: PodArt.sized(url, 200)) else { return }
        Task {
            guard let (data, _) = try? await URLSession.shared.data(from: u), let img = UIImage(data: data) else { return }
            Self.images.setObject(img, forKey: key)
            await MainActor.run { set(img) }
        }
    }

    // MARK: Words

    static func minutes(_ secs: Double) -> String {
        let m = Int((secs / 60).rounded())
        if m < 1 { return "1 min" }
        return m < 60 ? "\(m) min" : "\(m / 60) hr \(m % 60) min"
    }

    static let genreNames: [String: String] = [
        "comedy": "Comedy", "truecrime": "True Crime", "news": "News", "politics": "Politics", "science": "Science", "tech": "Technology",
        "business": "Business", "money": "Money", "history": "History", "sports": "Sports", "health": "Health & Fitness", "mental": "Mental Health",
        "culture": "Society & Culture", "arts": "Arts & Design", "books": "Books", "music": "Music", "film": "TV & Film", "education": "Education",
        "kids": "Kids & Family", "fiction": "Fiction & Drama", "horror": "Horror & Paranormal", "faith": "Faith & Spirituality", "gaming": "Gaming",
        "hobbies": "Hobbies & DIY", "food": "Food", "travel": "Travel", "relationships": "Relationships", "parenting": "Parenting", "nature": "Nature",
        "growth": "Self-Improvement", "teaching": "Teaching",
    ]
    static func genreName(_ id: String) -> String { genreNames[id] ?? id.capitalized }
}

private final class WeakItem {
    weak var item: CPListItem?
    init(_ item: CPListItem) { self.item = item }
}
#endif
