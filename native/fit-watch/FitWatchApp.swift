// Arise Fit for Apple Watch: today's numbers from the iPhone app (calories left, water, workouts, the next
// program day), a glass of water in one tap, and workouts tracked right on the watch — time, heart rate and
// active calories — saved to Apple Health and to your Arise Fit log on the phone.
//   payload: { slots: [WidgetSlot] }   (the same as the Fit widgets: client/src/lib/fitWidgets.ts)
//   actions: { type: "tap", action, amount } · { type: "workout", id, name, secs, kcal, bpm, start }
import SwiftUI
import WatchKit
import HealthKit

@main
struct FitWatchApp: App {
    @WKApplicationDelegateAdaptor(FitWatchDelegate.self) var delegate
    var body: some Scene { WindowGroup { FitWatchHome() } }
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
        .init(id: "other", name: "Other", symbol: "figure.mixed.cardio", type: .other, outdoors: false),
    ]
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

    func end() async {
        guard let s = session, let b = builder, let k = kind else { return }
        s.end()
        let secs = b.elapsedTime
        do {
            try await b.endCollection(at: Date())
            _ = try await b.finishWorkout()
        } catch { /* the log on the phone still gets it */ }
        let bpm = beats.isEmpty ? 0 : beats.reduce(0, +) / Double(beats.count)
        let start = ISO8601DateFormatter().string(from: b.startDate ?? Date().addingTimeInterval(-secs))
        AriseWatchLink.shared.send(["type": "workout", "id": "watch-" + UUID().uuidString.prefix(12).lowercased(), "name": k.name,
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
