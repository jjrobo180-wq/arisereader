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
        return (try? JSONDecoder().decode([FitSession].self, from: data)) ?? []
    }()
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
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 50) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Arise Fit").font(.largeTitle.bold())
                        Text("Follow-along workouts. Pick one and press play.").foregroundStyle(.secondary)
                    }
                    ForEach(fitCategories) { cat in
                        let items = FitSession.all.filter { $0.category == cat.id }
                        if !items.isEmpty {
                            VStack(alignment: .leading, spacing: 18) {
                                Label(cat.name, systemImage: cat.symbol).font(.title2.bold()).foregroundStyle(cat.tint)
                                ScrollView(.horizontal) {
                                    LazyHStack(spacing: 36) {
                                        ForEach(items) { s in
                                            Button { playing = s } label: { FitTVCard(session: s, tint: cat.tint) }
                                                .buttonStyle(.card)
                                        }
                                    }
                                    .padding(.vertical, 30)
                                }
                                .scrollClipDisabled()
                            }
                        }
                    }
                }
                .padding(.horizontal, 80)
                .padding(.vertical, 40)
            }
            .fullScreenCover(item: $playing) { s in FitTVPlayer(session: s) }
        }
    }
}

struct FitTVCard: View {
    let session: FitSession
    let tint: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(session.name).font(.headline).lineLimit(2)
            Text(session.blurb).font(.caption).foregroundStyle(.secondary).lineLimit(3)
            Spacer(minLength: 0)
            HStack {
                Text("\(session.mins) min").bold()
                Text("·")
                Text(session.level)
                Spacer()
                Text(session.equipment).foregroundStyle(.secondary).lineLimit(1)
            }
            .font(.caption)
        }
        .padding(28)
        .frame(width: 460, height: 260, alignment: .topLeading)
        .background(LinearGradient(colors: [tint.opacity(0.35), tint.opacity(0.08)], startPoint: .topLeading, endPoint: .bottomTrailing))
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
