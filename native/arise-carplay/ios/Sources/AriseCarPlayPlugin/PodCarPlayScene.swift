// Podster in the car (CarPlay), laid out like Apple Podcasts in the car. Four tabs and the car's Now Playing screen:
//   Listen Now  an Up Next row of artwork (what you're partway through and new from shows you follow), then
//               Up Next, Saved and Liked as lists
//   Library     Shows, Latest Episodes, Saved, Liked and Pod Modes; your shows' artwork, then every show
//   Browse      Top Charts, Open Mic, Up to the Minute News, and your interests
//   Radio       Live News Radio and stations near you (by kind)
// Now Playing has Up Next (the rest of the queue), the show's button (its episodes) and the speed button.
// Everything plays through PodEngine (ad-free, picking up where you left off). The lists come from the
// library the iPhone app hands over (PodStore) and from the Podster server, so CarPlay works even when
// Podster was started from the car and the phone's screen never opened.
#if os(iOS) && canImport(CarPlay)
import CarPlay
import Combine
import UIKit

@objc(PodCarPlaySceneDelegate)
public final class PodCarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate, CPNowPlayingTemplateObserver {
    private var ui: CPInterfaceController?
    private var tabs: CPTabBarTemplate?
    private var listenNow: CPListTemplate?
    private var library: CPListTemplate?
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
        MainActor.assumeIsolated { engine.carConnected = false; CPNowPlayingTemplate.shared.remove(self) }
        ui = nil; tabs = nil; listenNow = nil; library = nil
        watchers.removeAll(); itemsByEp.removeAll()
        if let w = libraryWatch { NotificationCenter.default.removeObserver(w); libraryWatch = nil }
    }

    @MainActor private func connect() {
        // The car's Play button (and Now Playing's) work from the first moment, even with nothing loaded yet.
        engine.carConnected = true
        engine.takeRemoteCommands()

        let now = CPListTemplate(title: "Listen Now", sections: [])
        now.tabTitle = "Listen Now"; now.tabImage = UIImage(systemName: "play.circle.fill")
        let lib = CPListTemplate(title: "Library", sections: [])
        lib.tabTitle = "Library"; lib.tabImage = UIImage(systemName: "square.stack.fill")
        let browse = browseTemplate()
        let radio = radioTemplate()
        listenNow = now; library = lib
        let bar = CPTabBarTemplate(templates: [now, lib, browse, radio])
        tabs = bar
        ui?.setRootTemplate(bar, animated: false, completion: nil)
        setUpNowPlaying()
        fillListenNow(); fillLibrary()

        // A new library from the phone: the lists redraw.
        libraryWatch = NotificationCenter.default.addObserver(forName: .podLibraryChanged, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.newFromFollows = nil; self?.fillListenNow(); self?.fillLibrary() }
        }
        // What's playing: its row shows it, and a problem is said out loud on the screen.
        engine.$current.removeDuplicates { $0?.id == $1?.id }.sink { [weak self] ep in self?.markPlaying(ep?.id); self?.updateNowPlayingButtons() }.store(in: &watchers)
        engine.$message.compactMap { $0 }.sink { [weak self] m in self?.alert(m) }.store(in: &watchers)
    }

    // MARK: Listen Now

    /** What you're partway through (newest first), as episodes. */
    @MainActor private func continueListening(_ n: Int) -> [PodEp] {
        store.recentSpots(30).filter { $0.1.t > 0 }.prefix(n).map { pair in
            let s = pair.1
            return PodEp(id: pair.0, showId: s.showId, title: s.title, show: s.show, art: s.art, audio: s.audio ?? "", secs: s.secs)
        }
    }

    /** Up Next, like Apple Podcasts: what you're partway through, then what's new from the shows you follow. */
    @MainActor private func upNext() -> [PodEp] {
        var seen = Set<String>()
        return (continueListening(12) + (newFromFollows?.eps ?? [])).filter { seen.insert($0.id).inserted }
    }

    @MainActor private func fillListenNow() {
        guard let t = listenNow else { return }
        let lib = store.library
        let next = upNext()
        var sections: [CPListSection] = []
        if !next.isEmpty {
            sections.append(CPListSection(items: [artRow("Up Next", next)], header: nil, sectionIndexTitle: nil))
            sections.append(section("Up Next", Array(next.prefix(12))))
        }
        if !lib.later.isEmpty { sections.append(section("Saved", Array(lib.later.prefix(12)))) }
        if !lib.liked.isEmpty { sections.append(section("Liked", Array(lib.liked.prefix(12)))) }
        if sections.isEmpty {
            let start = CPListItem(text: "Live News Radio", detailText: "Nonstop news, ad-free", image: symbol("dot.radiowaves.left.and.right"))
            start.handler = { [weak self] _, done in MainActor.assumeIsolated { self?.engine.playStation(); self?.showNowPlaying() }; done() }
            let hint = CPListItem(text: "Follow shows on your iPhone", detailText: "Open Podster on your phone; your shows and saved episodes show up here.", image: symbol("iphone"))
            sections.append(CPListSection(items: [start, hint]))
        }
        t.updateSections(Array(sections.prefix(CPListTemplate.maximumSectionCount)))
        // New episodes from followed shows: the newest of each, asked for in the background.
        if newFromFollows == nil || Date().timeIntervalSince(newFromFollows!.at) > 900, !lib.follows.isEmpty {
            newFromFollows = (Date(), newFromFollows?.eps ?? [])
            Task { @MainActor [weak self] in
                guard let self = self else { return }
                let fresh = await self.latestFromFollows()
                self.newFromFollows = (Date(), fresh)
                self.api.prepare(Array(fresh.prefix(4)))
                self.fillListenNow()
            }
        }
    }

    /** The newest episodes of the shows you follow that you haven't started, newest first. */
    @MainActor private func latestFromFollows(shows: Int = 10, perShow: Int = 2) async -> [PodEp] {
        let list = Array(store.library.follows.prefix(shows))
        var latest: [PodEp] = []
        await withTaskGroup(of: [PodEp].self) { g in
            for s in list { g.addTask { (try? await PodAPI.shared.showEpisodes(s.id))?.prefix(perShow).map { $0 } ?? [] } }
            for await eps in g { latest += eps }
        }
        let heard = Set(store.recentSpots(200).map { $0.0 })
        return Array(latest.filter { !heard.contains($0.id) }.sorted { ($0.date ?? "") > ($1.date ?? "") }.prefix(20))
    }

    // MARK: Library

    @MainActor private func fillLibrary() {
        guard let t = library else { return }
        let lib = store.library
        var menu: [CPListItem] = [
            row("Shows", lib.follows.isEmpty ? "Follow shows on your iPhone" : "\(lib.follows.count) show\(lib.follows.count == 1 ? "" : "s")", "square.stack") { [weak self] in self?.pushShows(title: "Shows") { PodStore.shared.library.follows } },
            row("Latest Episodes", "New from the shows you follow", "clock") { [weak self] in
                self?.pushEpisodes(title: "Latest Episodes") { [weak self] in await self?.latestFromFollows(shows: 20, perShow: 3) ?? [] }
            },
        ]
        if !lib.later.isEmpty { menu.append(row("Saved", "\(lib.later.count) episode\(lib.later.count == 1 ? "" : "s")", "bookmark") { [weak self] in self?.pushEpisodes(title: "Saved") { PodStore.shared.library.later } }) }
        if !lib.liked.isEmpty { menu.append(row("Liked", "\(lib.liked.count) episode\(lib.liked.count == 1 ? "" : "s")", "heart") { [weak self] in self?.pushEpisodes(title: "Liked") { PodStore.shared.library.liked } }) }
        for m in lib.modes.filter({ !$0.episodes.isEmpty }).prefix(4) {
            menu.append(row(m.name, "\(m.episodes.count) episode\(m.episodes.count == 1 ? "" : "s")", "list.bullet") { [weak self] in self?.pushEpisodes(title: m.name) { m.episodes } })
        }
        var sections = [CPListSection(items: menu)]
        if !lib.follows.isEmpty {
            sections.append(CPListSection(items: [showArtRow("Your Shows", Array(lib.follows))], header: nil, sectionIndexTitle: nil))
            sections.append(CPListSection(items: lib.follows.prefix(CPListTemplate.maximumItemCount).map { showItem($0) }, header: "All Shows", sectionIndexTitle: nil))
        }
        t.updateSections(Array(sections.prefix(CPListTemplate.maximumSectionCount)))
    }

    @MainActor private func showItem(_ s: PodShowRef) -> CPListItem {
        let item = CPListItem(text: s.name, detailText: s.author, image: symbol("mic"), accessoryImage: nil, accessoryType: .disclosureIndicator)
        loadImage(s.art) { item.setImage($0) }
        item.handler = { [weak self] _, done in
            MainActor.assumeIsolated { self?.pushEpisodes(title: s.name) { try await PodAPI.shared.showEpisodes(s.id) } }
            done()
        }
        return item
    }

    // MARK: Browse

    @MainActor private func browseTemplate() -> CPListTemplate {
        let top = row("Top Charts", "What everyone's listening to", "chart.bar.fill") { [weak self] in self?.pushShows(title: "Top Charts") { try await PodAPI.shared.topShows() } }
        let open = row("Open Mic", "New and independent podcasters", "music.mic") { [weak self] in self?.pushEpisodes(title: "Open Mic") { try await PodAPI.shared.openMic() } }
        let news = row("Up to the Minute News", "The latest bulletins", "newspaper") { [weak self] in self?.pushEpisodes(title: "News") { try await PodAPI.shared.news() } }
        var sections = [CPListSection(items: [top, open, news])]
        let genres = store.library.genres.prefix(10).map { g in
            row(Self.genreName(g), nil, "square.grid.2x2") { [weak self] in self?.pushShows(title: Self.genreName(g)) { try await PodAPI.shared.topShows(genre: g) } }
        }
        if !genres.isEmpty { sections.append(CPListSection(items: Array(genres), header: "Your Interests", sectionIndexTitle: nil)) }
        let t = CPListTemplate(title: "Browse", sections: sections)
        t.tabTitle = "Browse"; t.tabImage = UIImage(systemName: "square.grid.2x2.fill")
        return t
    }

    // MARK: Radio

    @MainActor private func radioTemplate() -> CPListTemplate {
        let live = row("Live News Radio", "One station, always on, ad-free", "dot.radiowaves.left.and.right") { [weak self] in self?.engine.playStation(); self?.showNowPlaying() }
        let kinds: [(String, String?, String)] = [("Near You", nil, "location"), ("News", "news", "newspaper"), ("Talk", "talk", "bubble.left.and.bubble.right"), ("Sports", "sports", "sportscourt"),
                                                  ("Hip Hop", "hip hop", "music.note"), ("Pop", "pop", "music.note"), ("Rock", "rock", "guitars"), ("Country", "country", "music.note"),
                                                  ("Jazz", "jazz", "music.quarternote.3"), ("Classical", "classical", "music.quarternote.3"), ("Chill", "chillout", "moon.stars")]
        let stations: [CPListItem] = kinds.map { kind in
            let (name, tag, icon) = kind
            return row(name, nil, icon) { [weak self] in self?.pushEpisodes(title: name, live: true) { await PodAPI.shared.stations(tag: tag) } }
        }
        let t = CPListTemplate(title: "Radio", sections: [CPListSection(items: [live], header: "Podster", sectionIndexTitle: nil), CPListSection(items: stations, header: "Stations", sectionIndexTitle: nil)])
        t.tabTitle = "Radio"; t.tabImage = UIImage(systemName: "radio.fill")
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
                t.updateSections(eps.isEmpty ? [] : [self.section(nil, Array(eps.prefix(CPListTemplate.maximumItemCount)))])
                if !live { self.api.prepare(Array(eps.prefix(3))) }
            } catch {
                t?.emptyViewTitleVariants = ["Couldn't load this"]
                t?.emptyViewSubtitleVariants = [error.localizedDescription]
                t?.updateSections([])
            }
        }
    }

    /** A list of shows (artwork first, like Apple Podcasts); tapping one opens its episodes. */
    @MainActor private func pushShows(title: String, _ load: @escaping () async throws -> [PodShowRef]) {
        let t = CPListTemplate(title: title, sections: [])
        t.emptyViewTitleVariants = ["Loading…"]
        ui?.pushTemplate(t, animated: true, completion: nil)
        Task { @MainActor [weak self, weak t] in
            do {
                let shows = try await load()
                guard let self = self, let t = t else { return }
                if shows.isEmpty { t.emptyViewTitleVariants = ["Nothing here yet"]; t.updateSections([]); return }
                t.updateSections([
                    CPListSection(items: [self.showArtRow(title, shows)], header: nil, sectionIndexTitle: nil),
                    CPListSection(items: shows.prefix(CPListTemplate.maximumItemCount).map { self.showItem($0) }),
                ])
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

    /** An episode row like Apple Podcasts': its title, then the show, the date and how long (or how much is left). */
    @MainActor private func episodeItem(_ ep: PodEp, list: [PodEp], at i: Int) -> CPListItem {
        var bits: [String] = []
        if ep.isLive { bits = ["Live", ep.show].filter { !$0.isEmpty } }
        else {
            if !ep.show.isEmpty { bits.append(ep.show) }
            if let d = Self.shortDate(ep.date) { bits.append(d) }
            if let s = store.spot(ep.id), s.t > 0, s.secs > s.t { bits.append("\(Self.minutes(s.secs - s.t)) left") }
            else if ep.secs > 0 { bits.append(Self.minutes(ep.secs)) }
        }
        let item = CPListItem(text: ep.title, detailText: bits.joined(separator: " · "), image: symbol(ep.isLive ? "radio" : "waveform"))
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

    /** A row of episode artwork (Apple Podcasts' Up Next): tapping a picture plays from there. */
    @MainActor private func artRow(_ title: String, _ eps: [PodEp]) -> CPListImageRowItem {
        let shown = Array(eps.prefix(CPMaximumNumberOfGridImages))
        let blank = artPlaceholder()
        let row = CPListImageRowItem(text: title, images: shown.map { _ in blank })
        var pics = shown.map { _ in blank }
        for (i, ep) in shown.enumerated() {
            loadImage(ep.art) { [weak row] img in pics[i] = img; row?.update(pics) }
        }
        row.listImageRowHandler = { [weak self] _, index, done in
            MainActor.assumeIsolated { if shown.indices.contains(index) { self?.engine.play(shown, at: index); self?.showNowPlaying() } }
            done()
        }
        row.handler = { [weak self] _, done in
            MainActor.assumeIsolated { if !shown.isEmpty { self?.engine.play(shown, at: 0); self?.showNowPlaying() } }
            done()
        }
        return row
    }

    /** A row of show artwork: tapping one opens its episodes. */
    @MainActor private func showArtRow(_ title: String, _ shows: [PodShowRef]) -> CPListImageRowItem {
        let shown = Array(shows.prefix(CPMaximumNumberOfGridImages))
        let blank = artPlaceholder()
        let row = CPListImageRowItem(text: title, images: shown.map { _ in blank })
        var pics = shown.map { _ in blank }
        for (i, s) in shown.enumerated() {
            loadImage(s.art) { [weak row] img in pics[i] = img; row?.update(pics) }
        }
        row.listImageRowHandler = { [weak self] _, index, done in
            MainActor.assumeIsolated {
                if shown.indices.contains(index) { let s = shown[index]; self?.pushEpisodes(title: s.name) { try await PodAPI.shared.showEpisodes(s.id) } }
            }
            done()
        }
        row.handler = { _, done in done() }
        return row
    }

    @MainActor private func row(_ text: String, _ detail: String?, _ icon: String, _ tap: @escaping () -> Void) -> CPListItem {
        let item = CPListItem(text: text, detailText: detail, image: symbol(icon), accessoryImage: nil, accessoryType: .disclosureIndicator)
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
        np.upNextTitle = "Up Next"
        np.add(self)
        updateNowPlayingButtons()
    }

    @MainActor private func updateNowPlayingButtons() {
        let np = CPNowPlayingTemplate.shared
        let ep = engine.current
        np.isUpNextButtonEnabled = engine.queue.count > engine.index + 1 || !upNext().isEmpty
        np.isAlbumArtistButtonEnabled = ep.map { !$0.isLive && !$0.showId.isEmpty } ?? false
    }

    /** Up Next on the Now Playing screen: what comes after this in the queue, or else your Up Next. */
    public func nowPlayingTemplateUpNextButtonTapped(_ nowPlayingTemplate: CPNowPlayingTemplate) {
        MainActor.assumeIsolated {
            let rest = Array(engine.queue.dropFirst(engine.index + 1))
            let list = rest.isEmpty ? upNext().filter { $0.id != engine.current?.id } : rest
            pushEpisodes(title: "Up Next") { list }
        }
    }

    /** The show's button on the Now Playing screen: that show's episodes. */
    public func nowPlayingTemplateAlbumArtistButtonTapped(_ nowPlayingTemplate: CPNowPlayingTemplate) {
        MainActor.assumeIsolated {
            guard let ep = engine.current, !ep.showId.isEmpty else { return }
            pushEpisodes(title: ep.show.isEmpty ? "Episodes" : ep.show) { try await PodAPI.shared.showEpisodes(ep.showId) }
        }
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

    private func symbol(_ name: String) -> UIImage? { UIImage(systemName: name) }

    /** A soft grey square with rounded corners, where artwork goes until it has loaded. */
    private func artPlaceholder() -> UIImage {
        let size = CGSize(width: 120, height: 120)
        return UIGraphicsImageRenderer(size: size).image { _ in
            UIColor.systemGray4.setFill()
            UIBezierPath(roundedRect: CGRect(origin: .zero, size: size), cornerRadius: 14).fill()
            if let mic = UIImage(systemName: "mic.fill")?.withTintColor(.white, renderingMode: .alwaysOriginal) { mic.draw(in: CGRect(x: 42, y: 40, width: 36, height: 40)) }
        }
    }

    /** Artwork with Apple Podcasts' rounded corners. */
    private static func rounded(_ img: UIImage) -> UIImage {
        let size = CGSize(width: 200, height: 200)
        return UIGraphicsImageRenderer(size: size).image { _ in
            UIBezierPath(roundedRect: CGRect(origin: .zero, size: size), cornerRadius: 22).addClip()
            img.draw(in: CGRect(origin: .zero, size: size))
        }
    }

    private func loadImage(_ url: String, _ set: @escaping (UIImage) -> Void) {
        guard !url.isEmpty else { return }
        let key = url as NSString
        if let img = Self.images.object(forKey: key) { set(img); return }
        guard let u = URL(string: PodArt.sized(url, 200)) else { return }
        Task {
            guard let (data, _) = try? await URLSession.shared.data(from: u), let raw = UIImage(data: data) else { return }
            let img = Self.rounded(raw)
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

    /** "Today", "Yesterday", "Nov 7", or "Nov 7, 2024" (from an ISO date or a date and time). */
    static func shortDate(_ raw: String?) -> String? {
        guard let raw = raw, raw.count >= 10 else { return nil }
        let day = String(raw.prefix(10))
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: day) else { return nil }
        let cal = Calendar.current
        if cal.isDateInToday(d) { return "Today" }
        if cal.isDateInYesterday(d) { return "Yesterday" }
        let out = DateFormatter()
        out.dateFormat = cal.component(.year, from: d) == cal.component(.year, from: Date()) ? "MMM d" : "MMM d, yyyy"
        return out.string(from: d)
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
