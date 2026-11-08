// The Pod+ native player, shared by CarPlay, the Apple Watch app and the Apple TV app.
//
// Like the web player (client/src/components/family-hub/earshot/EarshotPlayer.tsx), every podcast plays
// without ads: its ad-free copy from storage when the server has made one, otherwise a copy through
// the server whose ads are found as it plays and jumped over. Episodes people made on Pod+ and radio
// stations play straight from where they are. Where each episode got to is saved for the phone, the
// lock screen and the car show what's playing, and their buttons (and the car's) work.
import Foundation
import AVFoundation
import MediaPlayer
import Combine
#if canImport(UIKit)
import UIKit
#endif

@MainActor
public final class PodEngine: ObservableObject {
    public static let shared = PodEngine()

    @Published public private(set) var current: PodEp?
    @Published public private(set) var queue: [PodEp] = []
    @Published public private(set) var index = 0
    @Published public private(set) var playing = false
    @Published public private(set) var loading = false
    @Published public private(set) var position: Double = 0
    @Published public private(set) var duration: Double = 0
    @Published public private(set) var rate: Float = 1
    @Published public private(set) var message: String?
    /** Live News Radio: one station for everyone, picked up where it is now. */
    @Published public private(set) var onStation = false
    /** Seconds of ads and intros skipped in this run (shown on the phone as hours back). */
    @Published public private(set) var skippedSecs: Double = 0

    /** Called when this player starts something (the iPhone app pauses its own web player). */
    public var onStart: (() -> Void)?

    public static let rates: [Float] = [1, 1.25, 1.5, 2]

    private let player = AVPlayer()
    private let api = PodAPI.shared
    private let store = PodStore.shared
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var failObserver: NSObjectProtocol?
    private var statusWatch: AnyCancellable?
    private var stallWatch: AnyCancellable?
    private var adsTask: Task<Void, Never>?
    private var ads: [PodAd] = []
    private var skipped = Set<String>()
    private var clean = false
    private var lastSaved: Double = 0
    private var lastInfo: Double = 0
    private var run = UUID()
    private var art: (url: String, image: MPMediaItemArtwork?)?
    private var commandsReady = false

    init() {
        player.automaticallyWaitsToMinimizeStalling = true
        timeObserver = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.5, preferredTimescale: 600), queue: .main) { [weak self] t in
            MainActor.assumeIsolated { self?.tick(t.seconds) }
        }
        stallWatch = player.publisher(for: \.timeControlStatus).receive(on: DispatchQueue.main).sink { [weak self] s in
            guard let self = self else { return }
            self.loading = s == .waitingToPlayAtSpecifiedRate
            self.playing = s != .paused
            self.updateInfo(force: true)
        }
        rate = Float(store.library.speed)
        if !Self.rates.contains(rate) { rate = 1 }
        #if !os(watchOS)
        NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] n in
            let type = (n.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt).flatMap(AVAudioSession.InterruptionType.init(rawValue:))
            let opts = (n.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt).map(AVAudioSession.InterruptionOptions.init(rawValue:)) ?? []
            MainActor.assumeIsolated {
                guard let self = self else { return }
                if type == .began { self.saveSpot() }
                else if type == .ended, opts.contains(.shouldResume), self.current != nil { self.resume() }
            }
        }
        #endif
    }

    // MARK: Playing

    /** Plays `list` from `index`, picking up where that episode was left. */
    public func play(_ list: [PodEp], at i: Int = 0) {
        guard list.indices.contains(i) else { return }
        onStation = false
        start(list, at: i, from: nil)
    }

    /** Live News Radio: what's on air right now, from the right moment, then the next bulletin. */
    public func playStation() {
        onStation = true
        let me = UUID(); run = me
        loading = true; message = nil
        Task {
            do {
                let st = try await api.station()
                guard run == me else { return }
                let serverNow = st.now
                guard let slot = st.slots.first(where: { $0.startsAt <= serverNow && $0.startsAt + $0.secs * 1000 > serverNow }) ?? st.slots.first else {
                    message = "Live News Radio is starting. Try again in a minute."; loading = false; return
                }
                var ep = slot.ep; ep.live = true
                let offset = max(0, (serverNow - slot.startsAt) / 1000)
                start([ep], at: 0, from: offset, station: true)
            } catch {
                guard run == me else { return }
                message = error.localizedDescription; loading = false
            }
        }
    }

    private func start(_ list: [PodEp], at i: Int, from: Double?, station: Bool = false) {
        saveSpot()
        let ep = list[i]
        let me = UUID(); run = me
        queue = list; index = i; current = ep
        position = from ?? 0; duration = ep.secs; message = nil; loading = true
        ads = []; skipped = []; clean = false; adsTask?.cancel()
        setUpCommands()
        activateSession()
        onStart?()
        updateInfo(force: true)
        // The next few are made ad-free on the server before they come up.
        api.prepare(Array(list.dropFirst(i + 1).prefix(3)))
        Task {
            let (url, startAt) = await resolve(ep, station: station, from: from)
            guard run == me else { return }
            guard let url = url else { message = "This episode can't play right now."; loading = false; playing = false; return }
            let item = AVPlayerItem(asset: AVURLAsset(url: url))
            item.preferredForwardBufferDuration = 30
            watch(item, me: me)
            player.replaceCurrentItem(with: item)
            statusWatch = item.publisher(for: \.status).receive(on: DispatchQueue.main).sink { [weak self] status in
                guard let self = self, self.run == me else { return }
                if status == .readyToPlay {
                    self.statusWatch = nil
                    let d = item.duration.seconds
                    if d.isFinite && d > 0 { self.duration = d }
                    if (startAt > 1 && !ep.isLive) || station { self.player.seek(to: CMTime(seconds: startAt, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: CMTime(seconds: 1, preferredTimescale: 600)) }
                    self.player.playImmediately(atRate: ep.isLive && !station ? 1 : self.rate)
                    self.updateInfo(force: true)
                } else if status == .failed {
                    self.statusWatch = nil
                    self.message = "This episode can't play right now."
                    self.loading = false; self.playing = false
                }
            }
        }
    }

    /** Where to play the episode from, and where in it to start. */
    private func resolve(_ ep: PodEp, station: Bool, from: Double?) async -> (URL?, Double) {
        let spot = store.spot(ep.id)
        if ep.isLive && !station { return (URL(string: ep.audio), 0) }
        if ep.isOwn || ep.showId.isEmpty { return (URL(string: ep.audio), from ?? spot.map { $0.start(clean: false) } ?? 0) }
        if !station, let c = await api.clean(ep) {
            clean = true
            ads = c.ads
            pollAds(sid: c.sid, ep: ep, clean: true)
            // Ads still at its very start (a pre-roll that was part of the file): it starts after them.
            var lead = 0.0
            for a in ads.sorted(by: { $0.s < $1.s }) { if a.s <= lead + 1 && a.e - a.s <= 480 && a.skips(intro: store.library.skipIntro) { lead = max(lead, a.e) } else if a.s > lead + 1 { break } }
            if let t = from ?? spot.map({ $0.start(clean: true) }), t > lead { return (c.url, t) }
            return (c.url, lead)
        }
        let sid = Self.newSid()
        if let u = await api.sessionURL(ep, sid: sid) {
            pollAds(sid: sid, ep: ep, clean: false)
            return (u, from ?? spot.map { $0.start(clean: false) } ?? 0)
        }
        // The server can't be reached for a copy: straight from the podcast's host (ads and all).
        return (URL(string: ep.audio), from ?? spot.map { $0.start(clean: false) } ?? 0)
    }

    private static func newSid() -> String {
        let chars = Array("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
        return "cp" + String((0..<22).map { _ in chars.randomElement()! })
    }

    /** The ads in this copy, asked for until the server is sure (quickly at first), then now and then
     *  for ones found later in the read-along. */
    private func pollAds(sid: String, ep: PodEp, clean: Bool) {
        let me = run
        adsTask = Task { [weak self] in
            var waits = 0
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64((clean ? 45 : (waits < 30 ? 4 : 30)) * 1_000_000_000))
                guard let self = self, self.run == me, !Task.isCancelled else { return }
                if let r = await self.api.sessionAds(sid: sid, ep: ep) {
                    guard self.run == me else { return }
                    if !r.ads.isEmpty || !clean { self.ads = r.ads }
                    if r.final && clean { return }
                    if r.final && waits > 40 { return }
                }
                waits += 1
                if waits > 120 { return }
            }
        }
    }

    private func watch(_ item: AVPlayerItem, me: UUID) {
        if let o = endObserver { NotificationCenter.default.removeObserver(o) }
        if let o = failObserver { NotificationCenter.default.removeObserver(o) }
        endObserver = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { guard let self = self, self.run == me else { return }; self.finished() }
        }
        failObserver = NotificationCenter.default.addObserver(forName: .AVPlayerItemFailedToPlayToEndTime, object: item, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self = self, self.run == me else { return }
                self.message = "Lost the connection. Tap play to try again."
                self.saveSpot(); self.playing = false
            }
        }
    }

    private func tick(_ t: Double) {
        guard t.isFinite, current != nil else { return }
        position = t
        if let d = player.currentItem?.duration.seconds, d.isFinite, d > 0 { duration = d }
        // Jump over the ads (and the intro, when that's on).
        let intro = store.library.skipIntro
        if player.timeControlStatus == .playing, let ad = ads.first(where: { $0.skips(intro: intro) && !skipped.contains($0.key) && t >= $0.s - 0.25 && t < $0.e - 0.5 }) {
            skipped.insert(ad.key)
            // An ad that runs to the very end (the post-roll): the episode is over where it starts.
            if duration > 0 && ad.e >= duration - 15 && ad.s > 60 { skippedSecs += duration - t; finished(); return }
            skippedSecs += ad.e - t
            player.seek(to: CMTime(seconds: ad.e, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: CMTime(seconds: 0.5, preferredTimescale: 600))
        }
        if abs(t - lastSaved) >= 10 { saveSpot() }
        if abs(t - lastInfo) >= 5 { updateInfo() }
    }

    private func finished() {
        guard let ep = current else { return }
        if !ep.isLive { store.saveSpot(ep, t: duration, length: duration, clean: clean) }
        if onStation { playStation(); return }
        if index + 1 < queue.count { start(queue, at: index + 1, from: nil) }
        else { player.pause(); playing = false; position = 0; updateInfo(force: true) }
    }

    // MARK: Controls

    public func pause() { player.pause(); saveSpot(); updateInfo(force: true) }
    public func resume() {
        guard current != nil else { return }
        if player.currentItem == nil || message != nil, let ep = current {
            // After a lost connection: start again from the saved spot.
            if onStation { playStation() } else { start(queue.isEmpty ? [ep] : queue, at: index, from: position > 0 ? position : nil) }
            return
        }
        activateSession(); onStart?()
        player.playImmediately(atRate: current?.isLive == true && !onStation ? 1 : rate)
    }
    public func toggle() { playing ? pause() : resume() }
    public func stop() { pause(); player.replaceCurrentItem(with: nil); run = UUID(); playing = false }
    public func next() { if onStation { playStation() } else if index + 1 < queue.count { start(queue, at: index + 1, from: nil) } }
    public func previous() {
        if position > 5 || index == 0 { seek(to: 0) } else { start(queue, at: index - 1, from: nil) }
    }
    public func skip(_ by: Double) { seek(to: position + by) }
    public func seek(to t: Double) {
        guard let ep = current, !ep.isLive else { return }
        let to = max(0, duration > 0 ? min(t, duration - 1) : t)
        // Going back before an ad: it's skipped again when it comes.
        skipped = skipped.filter { key in ads.first(where: { $0.key == key }).map { $0.s < to } ?? true }
        position = to
        player.seek(to: CMTime(seconds: to, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
            MainActor.assumeIsolated { self?.saveSpot(); self?.updateInfo(force: true) }
        }
    }
    public func setRate(_ r: Float) {
        rate = Self.rates.contains(r) ? r : 1
        if playing, current?.isLive != true || onStation { player.rate = rate }
        updateInfo(force: true)
    }
    public func cycleRate() { setRate(Self.rates[((Self.rates.firstIndex(of: rate) ?? 0) + 1) % Self.rates.count]) }

    private func saveSpot() {
        guard let ep = current, !ep.isLive, position > 0 else { return }
        lastSaved = position
        store.saveSpot(ep, t: position, length: duration, clean: clean)
    }

    // MARK: Sound, the lock screen and the car's buttons

    private func activateSession() {
        #if os(watchOS)
        // The watch plays through Bluetooth headphones; iOS asks which ones the first time.
        let s = AVAudioSession.sharedInstance()
        try? s.setCategory(.playback, mode: .spokenAudio, policy: .longFormAudio)
        s.activate(options: []) { _, _ in }
        #else
        let s = AVAudioSession.sharedInstance()
        try? s.setCategory(.playback, mode: .spokenAudio, policy: .longFormAudio)
        try? s.setActive(true)
        #endif
    }

    private func setUpCommands() {
        guard !commandsReady else { return }
        commandsReady = true
        let c = MPRemoteCommandCenter.shared()
        c.playCommand.addTarget { [weak self] _ in MainActor.assumeIsolated { self?.resume() }; return .success }
        c.pauseCommand.addTarget { [weak self] _ in MainActor.assumeIsolated { self?.pause() }; return .success }
        c.togglePlayPauseCommand.addTarget { [weak self] _ in MainActor.assumeIsolated { self?.toggle() }; return .success }
        c.skipForwardCommand.preferredIntervals = [30]
        c.skipForwardCommand.addTarget { [weak self] _ in MainActor.assumeIsolated { self?.skip(30) }; return .success }
        c.skipBackwardCommand.preferredIntervals = [15]
        c.skipBackwardCommand.addTarget { [weak self] _ in MainActor.assumeIsolated { self?.skip(-15) }; return .success }
        c.nextTrackCommand.addTarget { [weak self] _ in MainActor.assumeIsolated { self?.next() }; return .success }
        c.previousTrackCommand.addTarget { [weak self] _ in MainActor.assumeIsolated { self?.previous() }; return .success }
        c.changePlaybackPositionCommand.addTarget { [weak self] e in
            guard let e = e as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            MainActor.assumeIsolated { self?.seek(to: e.positionTime) }
            return .success
        }
        c.changePlaybackRateCommand.supportedPlaybackRates = Self.rates.map { NSNumber(value: $0) }
        c.changePlaybackRateCommand.addTarget { [weak self] e in
            guard let e = e as? MPChangePlaybackRateCommandEvent else { return .commandFailed }
            MainActor.assumeIsolated { self?.setRate(e.playbackRate) }
            return .success
        }
    }

    private func updateInfo(force: Bool = false) {
        lastInfo = position
        guard let ep = current else { MPNowPlayingInfoCenter.default().nowPlayingInfo = nil; return }
        let live = ep.isLive
        let c = MPRemoteCommandCenter.shared()
        c.skipForwardCommand.isEnabled = !live
        c.skipBackwardCommand.isEnabled = !live
        c.changePlaybackPositionCommand.isEnabled = !live
        c.changePlaybackRateCommand.isEnabled = !live || onStation
        c.nextTrackCommand.isEnabled = onStation || index + 1 < queue.count
        c.previousTrackCommand.isEnabled = !live
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: ep.title,
            MPMediaItemPropertyArtist: onStation ? "Live News Radio · \(ep.show)" : ep.show,
            MPMediaItemPropertyAlbumTitle: "Pod+",
            MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
            MPNowPlayingInfoPropertyIsLiveStream: live && !onStation,
            MPNowPlayingInfoPropertyPlaybackRate: playing ? Double(live && !onStation ? 1 : rate) : 0,
            MPNowPlayingInfoPropertyDefaultPlaybackRate: Double(rate),
        ]
        if !live || onStation {
            info[MPMediaItemPropertyPlaybackDuration] = duration
            info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = position
        }
        if queue.count > 1 { info[MPNowPlayingInfoPropertyPlaybackQueueIndex] = index; info[MPNowPlayingInfoPropertyPlaybackQueueCount] = queue.count }
        if let a = art, a.url == ep.art, let img = a.image { info[MPMediaItemPropertyArtwork] = img }
        else { loadArt(ep.art) }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func loadArt(_ urlString: String) {
        guard art?.url != urlString else { return }
        art = (urlString, nil)
        guard let url = URL(string: PodArt.sized(urlString, 600)) else { return }
        Task {
            guard let (data, _) = try? await URLSession.shared.data(from: url) else { return }
            #if canImport(UIKit)
            guard let image = UIImage(data: data) else { return }
            let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
            guard art?.url == urlString else { return }
            art = (urlString, artwork)
            updateInfo(force: true)
            #endif
        }
    }
}

/// Cover art at a sensible size (Apple's art addresses can be asked for any size).
public enum PodArt {
    public static func sized(_ url: String, _ px: Int) -> String {
        guard url.contains("mzstatic.com") else { return url }
        return url.replacingOccurrences(of: #"/\d+x\d+(bb)?\.(jpg|png|webp)"#, with: "/\(px)x\(px)bb.jpg", options: .regularExpression)
    }
}
