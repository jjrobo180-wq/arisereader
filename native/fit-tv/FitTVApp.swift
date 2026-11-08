// Arise Fit for Apple TV: follow-along workouts on the big screen. Every guided session from Arise Fit
// (shared/fitSessions.ts, exported to sessions.json): treadmill HIIT, Couch to 5K, yoga, mobility and
// breathing. A session plays phase by phase with a big countdown, what to do now and what's next, the
// treadmill speed and incline, and a chime between phases. Play/Pause on the remote pauses; swipe to skip.
import SwiftUI
import AVFoundation

@main
struct FitTVApp: App {
    var body: some Scene { WindowGroup { FitTVHome() } }
}

struct FitPhase: Decodable, Hashable {
    let name: String
    let secs: Int
    let kind: String
    let cue: String?
    let speed: Double?
    let incline: Double?
}

struct FitSession: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let category: String
    let blurb: String
    let level: String
    let equipment: String
    let phases: [FitPhase]
    var secs: Int { phases.reduce(0) { $0 + $1.secs } }
    var mins: Int { max(1, Int((Double(secs) / 60).rounded())) }

    static let all: [FitSession] = {
        guard let url = Bundle.main.url(forResource: "sessions", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return [] }
        // One at a time, so a session the app can't read is skipped instead of emptying the whole list.
        return ((try? JSONDecoder().decode([FitLenient].self, from: data)) ?? []).compactMap(\.session).filter { !$0.phases.isEmpty }
    }()
}

private struct FitLenient: Decodable {
    let session: FitSession?
    init(from decoder: Decoder) throws { session = try? FitSession(from: decoder) }
}

/** Arise Fit's own colors (the phone app's dark Ember look). */
enum FitColor {
    static let bg = Color(red: 0x15 / 255, green: 0x17 / 255, blue: 0x1b / 255)
    static let card = Color(red: 0x1f / 255, green: 0x22 / 255, blue: 0x28 / 255)
    static let ember = Color(red: 0xff / 255, green: 0x6b / 255, blue: 0x2c / 255)
    static let dim = Color.white.opacity(0.62)
}

struct FitCategory: Identifiable { let id: String; let name: String; let symbol: String; let tint: Color }
let fitCategories: [FitCategory] = [
    FitCategory(id: "hiit", name: "Treadmill HIIT", symbol: "bolt.heart.fill", tint: .red),
    FitCategory(id: "c25k", name: "Couch to 5K", symbol: "figure.run", tint: .orange),
    FitCategory(id: "yoga", name: "Yoga", symbol: "figure.yoga", tint: .purple),
    FitCategory(id: "mobility", name: "Mobility & stretching", symbol: "figure.flexibility", tint: .teal),
    FitCategory(id: "meditation", name: "Breathe & meditate", symbol: "wind", tint: .blue),
]

struct FitTVHome: View {
    @State private var playing: FitSession?
    private var featured: FitSession? {
        // A different pick each day, so the big card isn't always the same workout.
        let pool = FitSession.all.filter { $0.category != "c25k" }
        guard !pool.isEmpty else { return FitSession.all.first }
        let day = Calendar.current.ordinality(of: .day, in: .era, for: Date()) ?? 0
        return pool[day % pool.count]
    }
    var body: some View {
        ZStack {
            FitColor.bg.ignoresSafeArea()
            RadialGradient(colors: [FitColor.ember.opacity(0.22), .clear], center: .top, startRadius: 0, endRadius: 1100).ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 56) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("ARISE FIT").font(.system(size: 22, weight: .heavy)).tracking(4.4).foregroundStyle(FitColor.ember)
                        Text("Follow-along workouts").font(.system(size: 64, weight: .black)).foregroundStyle(.white)
                        Text("Pick one and press play. Play/Pause on the remote pauses; swipe to skip a step.").font(.system(size: 26)).foregroundStyle(FitColor.dim)
                    }
                    if FitSession.all.isEmpty {
                        VStack(alignment: .leading, spacing: 14) {
                            Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 50)).foregroundStyle(FitColor.ember)
                            Text("The workouts didn't load.").font(.system(size: 40, weight: .bold)).foregroundStyle(.white)
                            Text("Update Arise Fit from the App Store on this Apple TV, then open it again.").font(.system(size: 26)).foregroundStyle(FitColor.dim)
                        }
                        .padding(50).frame(maxWidth: .infinity, alignment: .leading)
                        .background(FitColor.card, in: RoundedRectangle(cornerRadius: 34))
                    }
                    if let f = featured {
                        Button { playing = f } label: { FitTVHero(session: f, cat: fitCategories.first { $0.id == f.category }) }
                            .buttonStyle(.card)
                    }
                    ForEach(fitCategories) { cat in
                        let items = FitSession.all.filter { $0.category == cat.id }
                        if !items.isEmpty {
                            VStack(alignment: .leading, spacing: 12) {
                                HStack(spacing: 14) {
                                    Image(systemName: cat.symbol).font(.system(size: 30, weight: .bold)).foregroundStyle(cat.tint)
                                    Text(cat.name).font(.system(size: 36, weight: .bold)).foregroundStyle(.white)
                                    Text("\(items.count)").font(.system(size: 24, weight: .bold)).foregroundStyle(FitColor.dim)
                                }
                                ScrollView(.horizontal) {
                                    LazyHStack(spacing: 40) {
                                        ForEach(items) { s in
                                            Button { playing = s } label: { FitTVCard(session: s, cat: cat) }
                                                .buttonStyle(.card)
                                        }
                                    }
                                    .padding(.vertical, 34)
                                }
                                .scrollClipDisabled()
                            }
                        }
                    }
                }
                .padding(.horizontal, 90)
                .padding(.vertical, 50)
            }
            .scrollClipDisabled()
        }
        .preferredColorScheme(.dark)
        .fullScreenCover(item: $playing) { s in FitTVPlayer(session: s) }
    }
}

struct FitTVHero: View {
    let session: FitSession
    let cat: FitCategory?
    var body: some View {
        HStack(spacing: 50) {
            VStack(alignment: .leading, spacing: 14) {
                Text("TODAY'S PICK").font(.system(size: 20, weight: .heavy)).tracking(4).foregroundStyle(.white.opacity(0.8))
                Text(session.name).font(.system(size: 60, weight: .black)).foregroundStyle(.white).lineLimit(2)
                Text(session.blurb).font(.system(size: 26)).foregroundStyle(.white.opacity(0.85)).lineLimit(2)
                HStack(spacing: 18) {
                    Label("\(session.mins) min", systemImage: "clock.fill")
                    Label(session.level, systemImage: "chart.bar.fill")
                    Label(session.equipment, systemImage: "figure.mixed.cardio").lineLimit(1)
                }
                .font(.system(size: 24, weight: .semibold)).foregroundStyle(.white)
                Label("Play", systemImage: "play.fill").font(.system(size: 28, weight: .black)).foregroundStyle(.black)
                    .padding(.horizontal, 34).padding(.vertical, 16).background(.white, in: Capsule()).padding(.top, 8)
            }
            Spacer(minLength: 0)
            Image(systemName: cat?.symbol ?? "figure.run").font(.system(size: 220, weight: .bold)).foregroundStyle(.white.opacity(0.9))
        }
        .padding(56)
        .frame(width: 1700, height: 460, alignment: .leading)
        .background(LinearGradient(colors: [(cat?.tint ?? FitColor.ember), FitColor.ember.opacity(0.75), FitColor.card], startPoint: .topLeading, endPoint: .bottomTrailing))
    }
}

struct FitTVCard: View {
    let session: FitSession
    let cat: FitCategory
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: cat.symbol).font(.system(size: 30, weight: .bold)).foregroundStyle(cat.tint)
                Spacer()
                Text("\(session.mins) min").font(.system(size: 24, weight: .black)).foregroundStyle(.white)
            }
            Text(session.name).font(.system(size: 30, weight: .bold)).foregroundStyle(.white).lineLimit(2)
            Text(session.blurb).font(.system(size: 20)).foregroundStyle(FitColor.dim).lineLimit(2)
            Spacer(minLength: 0)
            HStack {
                Text(session.level).font(.system(size: 18, weight: .bold)).foregroundStyle(cat.tint)
                    .padding(.horizontal, 12).padding(.vertical, 5).background(cat.tint.opacity(0.18), in: Capsule())
                Spacer()
                Text(session.equipment).font(.system(size: 18)).foregroundStyle(FitColor.dim).lineLimit(1)
            }
        }
        .padding(28)
        .frame(width: 480, height: 290, alignment: .topLeading)
        .background(LinearGradient(colors: [cat.tint.opacity(0.32), FitColor.card], startPoint: .topLeading, endPoint: .bottomTrailing))
    }
}

/** The session itself: one phase at a time, counting down. */
struct FitTVPlayer: View {
    let session: FitSession
    @Environment(\.dismiss) private var dismiss
    @State private var index = 0
    @State private var left = 0
    @State private var paused = false
    @State private var finished = false
    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private var chime: FitChime { FitChime.shared }

    private var phase: FitPhase? { session.phases.indices.contains(index) ? session.phases[index] : nil }
    private var next: FitPhase? { session.phases.indices.contains(index + 1) ? session.phases[index + 1] : nil }
    private var totalLeft: Int { left + session.phases.dropFirst(index + 1).reduce(0) { $0 + $1.secs } }

    var body: some View {
        ZStack {
            color(phase?.kind ?? "warm").opacity(0.35).ignoresSafeArea()
            if finished {
                VStack(spacing: 30) {
                    Image(systemName: "checkmark.seal.fill").font(.system(size: 140)).foregroundStyle(.green)
                    Text("Workout done!").font(.system(size: 70, weight: .bold))
                    Text("\(session.name) · \(session.mins) min").font(.title2).foregroundStyle(.secondary)
                    Button("Back to workouts") { dismiss() }
                }
            } else if let p = phase {
                VStack(spacing: 24) {
                    Text(session.name).font(.title3).foregroundStyle(.secondary)
                    Text(p.name).font(.system(size: 90, weight: .heavy)).multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.5)
                    Text(clock(left)).font(.system(size: 220, weight: .bold, design: .rounded).monospacedDigit())
                    if let cue = p.cue { Text(cue).font(.title2).multilineTextAlignment(.center).frame(maxWidth: 1300) }
                    HStack(spacing: 60) {
                        if let s = p.speed { Label(String(format: "%.1f mph", s), systemImage: "speedometer").font(.title.bold()) }
                        if let i = p.incline { Label(String(format: "%g%% incline", i), systemImage: "arrow.up.right").font(.title.bold()) }
                    }
                    ProgressView(value: Double(session.secs - totalLeft), total: Double(max(1, session.secs))).frame(maxWidth: 1200)
                    HStack {
                        Text("Step \(index + 1) of \(session.phases.count)")
                        Spacer()
                        if let n = next { Text("Next: \(n.name) · \(clock(n.secs))") }
                        Spacer()
                        Text("\(clock(totalLeft)) left")
                    }
                    .font(.title3).foregroundStyle(.secondary).frame(maxWidth: 1400)
                    if paused { Text("Paused — press Play/Pause to go on").font(.title2.bold()).foregroundStyle(.yellow) }
                }
                .padding(60)
            }
        }
        .onAppear { left = phase?.secs ?? 0; UIApplication.shared.isIdleTimerDisabled = true }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
        .onReceive(tick) { _ in step() }
        .onPlayPauseCommand { if !finished { paused.toggle() } }
        .onMoveCommand { dir in
            if dir == .right { go(index + 1) } else if dir == .left { go(max(0, index - 1)) }
        }
        .onExitCommand { dismiss() }
    }

    private func step() {
        guard !paused, !finished, phase != nil else { return }
        if left > 1 { left -= 1; if left <= 3 { chime.beep(final: false) } } else { go(index + 1) }
    }

    private func go(_ i: Int) {
        if i >= session.phases.count { finished = true; chime.beep(final: true); return }
        index = i
        left = session.phases[i].secs
        chime.beep(final: true)
    }

    private func clock(_ s: Int) -> String { s >= 3600 ? String(format: "%d:%02d:%02d", s / 3600, s / 60 % 60, s % 60) : String(format: "%d:%02d", s / 60, s % 60) }

    private func color(_ kind: String) -> Color {
        switch kind {
        case "work": return .red
        case "rest", "breathe-out": return .green
        case "pose", "still": return .purple
        case "breathe-in", "hold": return .blue
        case "cool": return .teal
        default: return .orange
        }
    }
}

/** A short tone between phases (and a tick for the last three seconds), made on the fly. */
final class FitChime {
    static let shared = FitChime()
    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)!
    init() {
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: format)
        try? engine.start()
    }
    func beep(final: Bool) {
        let secs = final ? 0.35 : 0.12, freq = final ? 880.0 : 660.0
        let frames = AVAudioFrameCount(44100 * secs)
        guard let buf = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames), let ch = buf.floatChannelData?[0] else { return }
        buf.frameLength = frames
        for i in 0..<Int(frames) {
            let t = Double(i) / 44100
            let env = min(1, t * 40) * max(0, 1 - t / secs)
            ch[i] = Float(sin(2 * .pi * freq * t) * 0.3 * env)
        }
        if !engine.isRunning { try? engine.start() }
        player.scheduleBuffer(buf, completionHandler: nil)
        if !player.isPlaying { player.play() }
    }
}
