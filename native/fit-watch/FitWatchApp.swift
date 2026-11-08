// Arise Fit for Apple Watch: today's numbers from the iPhone app (calories left, water, workouts, the next
// program day), a glass of water in one tap, workouts tracked right on the watch — time, heart rate and
// active calories — saved to Apple Health and to your Arise Fit log on the phone, and every guided session
// from the app (treadmill HIIT, Couch to 5K, yoga, mobility, breathing: native/fit-tv/sessions.json, the
// same list the Apple TV app plays) led step by step on the wrist, with a tap at each change.
//   payload: { slots: [WidgetSlot] }   (the same as the Fit widgets: client/src/lib/fitWidgets.ts)
//   actions: { type: "tap", action, amount } · { type: "workout", id, name, secs, kcal, bpm, start }
import SwiftUI
import WatchKit
import HealthKit

@main
struct FitWatchApp: App {
    @WKApplicationDelegateAdaptor(FitWatchDelegate.self) var delegate
    var body: some Scene {
        WindowGroup {
            // -fitGuided <id>: straight into a guided session (the simulator screenshots).
            if let id = UserDefaults.standard.string(forKey: "fitGuided"), let s = GuidedSession.all.first(where: { $0.id == id }) {
                NavigationStack { FitGuidedView(session: s, tint: .orange) }
            } else if UserDefaults.standard.string(forKey: "fitScreen") == "guided" {
                NavigationStack { FitGuidedList() }
            } else {
                FitWatchHome()
            }
        }
    }
}

final class FitWatchDelegate: NSObject, WKApplicationDelegate {
    func applicationDidFinishLaunching() { Task { @MainActor in AriseWatchLink.shared.start() } }
    func applicationDidBecomeActive() { Task { @MainActor in AriseWatchLink.shared.refresh() } }
}

struct FitAction: Hashable { let label: String; let action: String; let amount: Double }

struct FitSlot: Identifiable {
    let id: String, title: String, value: String, detail: String
    let tint: Color, progress: Double?, lines: [String], actions: [FitAction]
    init?(_ d: [String: Any]) {
        guard let id = d["id"] as? String else { return nil }
        self.id = id
        title = d["title"] as? String ?? ""; value = d["value"] as? String ?? ""; detail = d["detail"] as? String ?? ""
        tint = Color(hex: d["tint"] as? String ?? "") ?? .orange
        progress = (d["progress"] as? NSNumber)?.doubleValue
        lines = d["lines"] as? [String] ?? []
        actions = (d["actions"] as? [[String: Any]] ?? []).compactMap { a in
            guard let l = a["label"] as? String, let act = a["action"] as? String else { return nil }
            return FitAction(label: l, action: act, amount: (a["amount"] as? NSNumber)?.doubleValue ?? 0)
        }
    }
}

extension Color {
    init?(hex: String) {
        guard hex.count == 7, hex.hasPrefix("#"), let v = Int(hex.dropFirst(), radix: 16) else { return nil }
        self.init(red: Double((v >> 16) & 255) / 255, green: Double((v >> 8) & 255) / 255, blue: Double(v & 255) / 255)
    }
}

struct FitWatchHome: View {
    @ObservedObject private var link = AriseWatchLink.shared
    @StateObject private var workout = FitWorkout.shared
    private var slots: [FitSlot] { link.list("slots").compactMap(FitSlot.init) }

    var body: some View {
        NavigationStack {
            List {
                if workout.running {
                    NavigationLink { FitWorkoutView() } label: { Label("Workout in progress", systemImage: "figure.run").foregroundStyle(.green) }
                } else {
                    NavigationLink { FitStartWorkout() } label: { Label("Start a workout", systemImage: "play.circle.fill").foregroundStyle(.orange) }
                }
                NavigationLink { FitGuidedList() } label: { Label("Guided workouts", systemImage: "figure.mind.and.body").foregroundStyle(.orange) }
                ForEach(slots) { s in FitSlotRow(slot: s) }
                Section { AriseUpdatedNote(empty: "Open Arise Fit on your iPhone once, and today's numbers show up here.") }
            }
            .navigationTitle("Arise Fit")
        }
        .tint(.orange)
    }
}

struct FitSlotRow: View {
    let slot: FitSlot
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(slot.title).font(.caption2).foregroundStyle(slot.tint)
            Text(slot.value).font(.title3.bold()).lineLimit(1).minimumScaleFactor(0.6)
            if !slot.detail.isEmpty { Text(slot.detail).font(.caption2).foregroundStyle(.secondary) }
            if let p = slot.progress { ProgressView(value: min(1, max(0, p))).tint(slot.tint) }
            if !slot.actions.isEmpty {
                HStack {
                    ForEach(slot.actions, id: \.label) { a in
                        Button(a.label) {
                            WKInterfaceDevice.current().play(.click)
                            AriseWatchLink.shared.send(["type": "tap", "action": a.action, "amount": a.amount])
                        }
                        .font(.caption2).buttonStyle(.bordered).tint(slot.tint)
                    }
                }
            }
            if slot.id == "fit.next" || slot.id == "fit.workouts" {
                ForEach(slot.lines.prefix(4), id: \.self) { Text($0).font(.caption2).foregroundStyle(.secondary).lineLimit(1) }
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Workouts on the watch

struct FitWorkoutKind: Identifiable, Hashable {
    let id: String, name: String, symbol: String, type: HKWorkoutActivityType, outdoors: Bool
    static let all: [FitWorkoutKind] = [
        .init(id: "strength", name: "Strength", symbol: "dumbbell.fill", type: .traditionalStrengthTraining, outdoors: false),
        .init(id: "run-out", name: "Outdoor run", symbol: "figure.run", type: .running, outdoors: true),
        .init(id: "run-in", name: "Treadmill", symbol: "figure.run", type: .running, outdoors: false),
        .init(id: "walk", name: "Walk", symbol: "figure.walk", type: .walking, outdoors: true),
        .init(id: "hiit", name: "HIIT", symbol: "bolt.heart.fill", type: .highIntensityIntervalTraining, outdoors: false),
        .init(id: "cycle", name: "Cycling", symbol: "figure.outdoor.cycle", type: .cycling, outdoors: true),
        .init(id: "yoga", name: "Yoga", symbol: "figure.yoga", type: .yoga, outdoors: false),
        .init(id: "flex", name: "Stretching", symbol: "figure.flexibility", type: .flexibility, outdoors: false),
        .init(id: "mind", name: "Breathe", symbol: "wind", type: .mindAndBody, outdoors: false),
        .init(id: "other", name: "Other", symbol: "figure.mixed.cardio", type: .other, outdoors: false),
    ]
    static func by(_ id: String) -> FitWorkoutKind { all.first { $0.id == id } ?? all[all.count - 1] }
}

struct FitStartWorkout: View {
    @ObservedObject private var workout = FitWorkout.shared
    @State private var going = false
    var body: some View {
        List(FitWorkoutKind.all) { k in
            Button {
                Task { if await workout.start(k) { going = true } }
            } label: { Label(k.name, systemImage: k.symbol) }
        }
        .navigationTitle("Workout")
        .navigationDestination(isPresented: $going) { FitWorkoutView() }
        .overlay(alignment: .bottom) { if let m = workout.message { Text(m).font(.caption2).foregroundStyle(.orange).padding(6).background(.black.opacity(0.8), in: Capsule()) } }
    }
}

struct FitWorkoutView: View {
    @ObservedObject private var workout = FitWorkout.shared
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { _ in
            VStack(alignment: .leading, spacing: 4) {
                Text(workout.kind?.name ?? "Workout").font(.caption).foregroundStyle(.orange)
                Text(clock(workout.elapsed)).font(.system(.title, design: .rounded).monospacedDigit().bold())
                Label("\(Int(workout.heartRate)) bpm", systemImage: "heart.fill").foregroundStyle(.red).font(.body.monospacedDigit())
                Label("\(Int(workout.calories)) cal", systemImage: "flame.fill").foregroundStyle(.orange).font(.body.monospacedDigit())
                if workout.meters > 0 { Label(String(format: "%.2f mi", workout.meters / 1609.344), systemImage: "point.topleft.down.to.point.bottomright.curvepath").font(.body.monospacedDigit()) }
                HStack {
                    Button { workout.togglePause() } label: { Image(systemName: workout.paused ? "play.fill" : "pause.fill") }.tint(.yellow)
                    Button { Task { await workout.end(); dismiss() } } label: { Image(systemName: "stop.fill") }.tint(.red)
                }
            }
        }
        .navigationBarBackButtonHidden(workout.running)
    }
    private func clock(_ t: TimeInterval) -> String {
        let s = Int(t); return s >= 3600 ? String(format: "%d:%02d:%02d", s / 3600, s / 60 % 60, s % 60) : String(format: "%02d:%02d", s / 60, s % 60)
    }
}

/** One workout at a time, through HealthKit's workout session (keeps the app running and the heart-rate
 *  sensor on, and saves the workout to Apple Health when it ends). */
@MainActor
final class FitWorkout: NSObject, ObservableObject, HKWorkoutSessionDelegate, HKLiveWorkoutBuilderDelegate {
    static let shared = FitWorkout()
    private let store = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    @Published var running = false
    @Published var paused = false
    @Published var kind: FitWorkoutKind?
    @Published var heartRate: Double = 0
    @Published var calories: Double = 0
    @Published var meters: Double = 0
    @Published var message: String?
    private var beats: [Double] = []
    var elapsed: TimeInterval { builder?.elapsedTime ?? 0 }

    func start(_ k: FitWorkoutKind) async -> Bool {
        guard HKHealthStore.isHealthDataAvailable() else { message = "Health isn't available on this watch."; return false }
        let share: Set<HKSampleType> = [HKObjectType.workoutType(), HKQuantityType(.activeEnergyBurned), HKQuantityType(.distanceWalkingRunning), HKQuantityType(.distanceCycling), HKQuantityType(.heartRate)]
        let read: Set<HKObjectType> = [HKQuantityType(.heartRate), HKQuantityType(.activeEnergyBurned), HKQuantityType(.distanceWalkingRunning), HKQuantityType(.distanceCycling)]
        do { try await store.requestAuthorization(toShare: share, read: read) } catch { message = "Allow Health access to track workouts."; return false }
        let config = HKWorkoutConfiguration()
        config.activityType = k.type
        config.locationType = k.outdoors ? .outdoor : .indoor
        do {
            let s = try HKWorkoutSession(healthStore: store, configuration: config)
            let b = s.associatedWorkoutBuilder()
            b.dataSource = HKLiveWorkoutDataSource(healthStore: store, workoutConfiguration: config)
            s.delegate = self; b.delegate = self
            session = s; builder = b; kind = k
            heartRate = 0; calories = 0; meters = 0; beats = []; paused = false
            let now = Date()
            s.startActivity(with: now)
            try await b.beginCollection(at: now)
            running = true; message = nil
            WKInterfaceDevice.current().play(.start)
            return true
        } catch {
            message = "The workout couldn't start."
            return false
        }
    }

    func togglePause() {
        guard let s = session else { return }
        if paused { s.resume() } else { s.pause() }
        paused.toggle()
    }

    func end(name: String? = nil) async {
        guard let s = session, let b = builder, let k = kind else { return }
        s.end()
        let secs = b.elapsedTime
        do {
            try await b.endCollection(at: Date())
            _ = try await b.finishWorkout()
        } catch { /* the log on the phone still gets it */ }
        let bpm = beats.isEmpty ? 0 : beats.reduce(0, +) / Double(beats.count)
        let start = ISO8601DateFormatter().string(from: b.startDate ?? Date().addingTimeInterval(-secs))
        AriseWatchLink.shared.send(["type": "workout", "id": "watch-" + UUID().uuidString.prefix(12).lowercased(), "name": name ?? k.name,
                                    "secs": Int(secs), "kcal": Int(calories), "bpm": Int(bpm), "start": start])
        WKInterfaceDevice.current().play(.stop)
        running = false; session = nil; builder = nil
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {}
    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        Task { @MainActor in self.message = "The workout stopped: \(error.localizedDescription)" }
    }
    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}
    nonisolated func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        let hr = workoutBuilder.statistics(for: HKQuantityType(.heartRate))?.mostRecentQuantity()?.doubleValue(for: .count().unitDivided(by: .minute()))
        let kcal = workoutBuilder.statistics(for: HKQuantityType(.activeEnergyBurned))?.sumQuantity()?.doubleValue(for: .kilocalorie())
        let walk = workoutBuilder.statistics(for: HKQuantityType(.distanceWalkingRunning))?.sumQuantity()?.doubleValue(for: .meter())
        let bike = workoutBuilder.statistics(for: HKQuantityType(.distanceCycling))?.sumQuantity()?.doubleValue(for: .meter())
        Task { @MainActor in
            if let hr { self.heartRate = hr; self.beats.append(hr) }
            if let kcal { self.calories = kcal }
            self.meters = max(walk ?? 0, bike ?? 0)
        }
    }
}

// MARK: - Guided sessions, step by step

struct GuidedPhase: Decodable, Hashable { let name: String; let secs: Int; let kind: String; let cue: String?; let speed: Double?; let incline: Double? }
struct GuidedSession: Decodable, Identifiable, Hashable {
    let id: String, name: String, category: String, blurb: String, level: String, equipment: String
    let phases: [GuidedPhase]
    var secs: Int { phases.reduce(0) { $0 + $1.secs } }
    var mins: Int { max(1, Int((Double(secs) / 60).rounded())) }
    /** What Apple Health records it as. */
    var workoutKind: FitWorkoutKind {
        switch category {
        case "hiit": return .by("hiit")
        case "c25k": return .by("run-out")
        case "yoga": return .by("yoga")
        case "mobility": return .by("flex")
        case "meditation": return .by("mind")
        default: return .by("other")
        }
    }
    static let all: [GuidedSession] = {
        guard let url = Bundle.main.url(forResource: "sessions", withExtension: "json"), let data = try? Data(contentsOf: url) else { return [] }
        return ((try? JSONDecoder().decode([GuidedLenient].self, from: data)) ?? []).compactMap(\.session).filter { !$0.phases.isEmpty }
    }()
}
private struct GuidedLenient: Decodable {
    let session: GuidedSession?
    init(from decoder: Decoder) throws { session = try? GuidedSession(from: decoder) }
}

struct GuidedCategory: Identifiable { let id: String; let name: String; let symbol: String; let tint: Color }
let guidedCategories: [GuidedCategory] = [
    GuidedCategory(id: "hiit", name: "Treadmill HIIT", symbol: "bolt.heart.fill", tint: .red),
    GuidedCategory(id: "c25k", name: "Couch to 5K", symbol: "figure.run", tint: .orange),
    GuidedCategory(id: "yoga", name: "Yoga", symbol: "figure.yoga", tint: .purple),
    GuidedCategory(id: "mobility", name: "Mobility", symbol: "figure.flexibility", tint: .teal),
    GuidedCategory(id: "meditation", name: "Breathe", symbol: "wind", tint: .blue),
]

struct FitGuidedList: View {
    var body: some View {
        List {
            if GuidedSession.all.isEmpty { Text("Update Arise Fit on your iPhone to get the guided workouts.").font(.footnote).foregroundStyle(.secondary) }
            ForEach(guidedCategories) { c in
                let items = GuidedSession.all.filter { $0.category == c.id }
                if !items.isEmpty {
                    Section {
                        ForEach(items) { s in
                            NavigationLink { FitGuidedView(session: s, tint: c.tint) } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(s.name).font(.footnote.bold()).lineLimit(2)
                                    Text("\(s.mins) min · \(s.level)").font(.caption2).foregroundStyle(.secondary)
                                }
                            }
                        }
                    } header: { Label(c.name, systemImage: c.symbol).foregroundStyle(c.tint) }
                }
            }
        }
        .navigationTitle("Guided")
    }
}

/** One session, a step at a time: what to do now, a ring counting it down, what's next. The watch taps your
 *  wrist at each change (and for the last three seconds), so you don't have to look. It runs as a workout,
 *  so the screen can go dark and it keeps going, with heart rate and calories saved to Apple Health. */
struct FitGuidedView: View {
    let session: GuidedSession
    let tint: Color
    @ObservedObject private var workout = FitWorkout.shared
    @Environment(\.dismiss) private var dismiss
    @State private var index = 0
    @State private var phaseEnd = Date()
    @State private var pausedLeft: TimeInterval?
    @State private var started = false
    @State private var finished = false
    @State private var lastTick = -1
    private let tick = Timer.publish(every: 0.25, on: .main, in: .common).autoconnect()

    private var phase: GuidedPhase? { session.phases.indices.contains(index) ? session.phases[index] : nil }
    private var next: GuidedPhase? { session.phases.indices.contains(index + 1) ? session.phases[index + 1] : nil }
    private func left(_ now: Date) -> TimeInterval { pausedLeft ?? max(0, phaseEnd.timeIntervalSince(now)) }

    var body: some View {
        Group {
            if finished {
                VStack(spacing: 6) {
                    Image(systemName: "checkmark.seal.fill").font(.system(size: 44)).foregroundStyle(.green)
                    Text("Done!").font(.title3.bold())
                    Text("\(session.name) · \(session.mins) min").font(.caption2).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    if workout.calories > 0 { Label("\(Int(workout.calories)) cal", systemImage: "flame.fill").font(.caption).foregroundStyle(.orange) }
                    Button("Close") { dismiss() }.tint(tint)
                }
            } else if let p = phase {
                TimelineView(.periodic(from: .now, by: 0.5)) { ctx in
                    let l = left(ctx.date)
                    TabView {
                        VStack(spacing: 2) {
                            Text(p.name).font(.headline).foregroundStyle(color(p.kind)).lineLimit(2).minimumScaleFactor(0.6).multilineTextAlignment(.center)
                            ZStack {
                                Circle().stroke(color(p.kind).opacity(0.25), lineWidth: 7)
                                Circle().trim(from: 0, to: CGFloat(l / Double(max(1, p.secs))))
                                    .stroke(color(p.kind), style: StrokeStyle(lineWidth: 7, lineCap: .round)).rotationEffect(.degrees(-90))
                                VStack(spacing: 0) {
                                    Text(clock(Int(l.rounded(.up)))).font(.system(size: 30, weight: .bold, design: .rounded).monospacedDigit())
                                    if workout.heartRate > 0 { Label("\(Int(workout.heartRate))", systemImage: "heart.fill").font(.caption2.monospacedDigit()).foregroundStyle(.red) }
                                }
                            }
                            .frame(width: 104, height: 104)
                            if let s = p.speed { Text(String(format: "%.1f mph", s) + (p.incline.map { String(format: " · %g%%", $0) } ?? "")).font(.caption2.bold()) }
                            else if let n = next { Text("Next: \(n.name)").font(.caption2).foregroundStyle(.secondary).lineLimit(1) }
                            if pausedLeft != nil { Text("Paused").font(.caption2.bold()).foregroundStyle(.yellow) }
                        }
                        VStack(spacing: 8) {
                            if let cue = p.cue { Text(cue).font(.caption2).multilineTextAlignment(.center).lineLimit(4) }
                            Text("Step \(index + 1) of \(session.phases.count)").font(.caption2).foregroundStyle(.secondary)
                            HStack {
                                Button { go(index - 1) } label: { Image(systemName: "backward.fill") }.disabled(index == 0)
                                Button { togglePause() } label: { Image(systemName: pausedLeft == nil ? "pause.fill" : "play.fill") }.tint(.yellow)
                                Button { go(index + 1) } label: { Image(systemName: "forward.fill") }
                            }
                            Button(role: .destructive) { Task { await finish() } } label: { Label("End", systemImage: "stop.fill") }.tint(.red)
                        }
                    }
                    .tabViewStyle(.verticalPage)
                }
            }
        }
        .navigationTitle(session.name)
        .navigationBarBackButtonHidden(started && !finished)
        .onAppear {
            guard !started else { return }
            started = true
            phaseEnd = Date().addingTimeInterval(TimeInterval(phase?.secs ?? 0))
            WKInterfaceDevice.current().play(.start)
            Task { if !workout.running { _ = await workout.start(session.workoutKind) } }
        }
        .onReceive(tick) { now in step(now) }
    }

    private func step(_ now: Date) {
        guard !finished, pausedLeft == nil, phase != nil else { return }
        let l = Int(phaseEnd.timeIntervalSince(now).rounded(.up))
        if l <= 0 { go(index + 1); return }
        if l <= 3 && l != lastTick { lastTick = l; WKInterfaceDevice.current().play(.click) }
    }

    private func go(_ i: Int) {
        guard i >= 0 else { return }
        if i >= session.phases.count { Task { await finish() }; return }
        index = i; lastTick = -1
        let secs = TimeInterval(session.phases[i].secs)
        if pausedLeft != nil { pausedLeft = secs } else { phaseEnd = Date().addingTimeInterval(secs) }
        WKInterfaceDevice.current().play(.directionUp)
    }

    private func togglePause() {
        if let l = pausedLeft { phaseEnd = Date().addingTimeInterval(l); pausedLeft = nil } else { pausedLeft = max(0, phaseEnd.timeIntervalSinceNow) }
        if workout.running && workout.paused != (pausedLeft != nil) { workout.togglePause() }
    }

    private func finish() async {
        guard !finished else { return }
        finished = true
        WKInterfaceDevice.current().play(.success)
        if workout.running { await workout.end(name: session.name) }
    }

    private func clock(_ s: Int) -> String { String(format: "%d:%02d", s / 60, s % 60) }
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
