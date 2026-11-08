// Arise Notes for Apple Watch: record a meeting on your wrist (it keeps going with the screen off), and the
// iPhone writes it down and summarizes it like any recording; read your latest notes and meeting
// summaries; and dictate (or scribble) a quick note, which the iPhone app saves to your notes.
//   payload: { pages: [{ id, title, text, at }], meetings: [{ id, title, text, at }] }
//   actions: { type: "add", text }
//   files:   the recording (AAC, .m4a) with { type: "recording", title, secs, at }: the phone app opens
//            Upload with it and writes it down (client/src/components/arise-notes/watchRecordings.ts).
import SwiftUI
import WatchKit
import AVFoundation

@main
struct NotesWatchApp: App {
    @WKApplicationDelegateAdaptor(NotesWatchDelegate.self) var delegate
    var body: some Scene { WindowGroup { NotesWatchHome() } }
}

final class NotesWatchDelegate: NSObject, WKApplicationDelegate {
    func applicationDidFinishLaunching() { Task { @MainActor in AriseWatchLink.shared.start() } }
    func applicationDidBecomeActive() { Task { @MainActor in AriseWatchLink.shared.refresh() } }
}

struct WatchNote: Identifiable, Hashable {
    let id: String, title: String, text: String, at: String
    init?(_ d: [String: Any]) {
        guard let id = d["id"] as? String else { return nil }
        self.id = id; title = d["title"] as? String ?? "Note"; text = d["text"] as? String ?? ""; at = d["at"] as? String ?? ""
    }
    var when: String {
        guard let date = ISO8601DateFormatter.full.date(from: at) ?? ISO8601DateFormatter().date(from: at) else { return "" }
        return date.formatted(.relative(presentation: .named))
    }
}

extension ISO8601DateFormatter {
    static let full: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()
}

struct NotesWatchHome: View {
    @ObservedObject private var link = AriseWatchLink.shared
    @State private var writing = false
    @State private var recording = false
    private var pages: [WatchNote] { link.list("pages").compactMap(WatchNote.init) }
    private var meetings: [WatchNote] { link.list("meetings").compactMap(WatchNote.init) }

    var body: some View {
        NavigationStack {
            List {
                Button { recording = true } label: {
                    Label("Record a meeting", systemImage: "record.circle.fill").font(.headline).foregroundStyle(.red)
                }
                .accessibilityIdentifier("notes-watch-record")
                Button { writing = true } label: { Label("Quick note", systemImage: "mic.circle.fill").foregroundStyle(.purple) }
                if !link.sending.isEmpty {
                    Label(link.sending.count == 1 ? "1 recording waiting for your iPhone" : "\(link.sending.count) recordings waiting for your iPhone", systemImage: "iphone.and.arrow.forward")
                        .font(.caption2).foregroundStyle(.secondary)
                }
                if !pages.isEmpty {
                    Section("Notes") { ForEach(pages) { n in NavigationLink(value: n) { row(n) } } }
                }
                if !meetings.isEmpty {
                    Section("Meetings") { ForEach(meetings) { n in NavigationLink(value: n) { row(n) } } }
                }
                Section { AriseUpdatedNote(empty: "Open Arise Notes on your iPhone once, and your notes show up here.") }
            }
            .navigationTitle("Arise Notes")
            .navigationDestination(for: WatchNote.self) { n in
                ScrollView {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(n.title).font(.headline)
                        if !n.when.isEmpty { Text(n.when).font(.caption2).foregroundStyle(.secondary) }
                        Text(n.text.isEmpty ? "Open it on your iPhone to read it all." : n.text).font(.footnote)
                    }
                }
                .navigationTitle("Note")
            }
            .sheet(isPresented: $writing) { NotesWatchWrite() }
            .fullScreenCover(isPresented: $recording) { NotesWatchRecord() }
        }
        .tint(.purple)
    }

    private func row(_ n: WatchNote) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(n.title).font(.footnote.bold()).lineLimit(2)
            if !n.text.isEmpty { Text(n.text).font(.caption2).foregroundStyle(.secondary).lineLimit(2) }
        }
    }
}

struct NotesWatchWrite: View {
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    var body: some View {
        Form {
            TextField("Say or scribble your note", text: $text, axis: .vertical)
            Button("Save") {
                let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !t.isEmpty else { return }
                let id = "watch-" + UUID().uuidString.prefix(8).lowercased()
                let at = ISO8601DateFormatter().string(from: Date())
                AriseWatchLink.shared.send(["type": "add", "text": t]) { p in
                    var list = p["pages"] as? [[String: Any]] ?? []
                    list.insert(["id": id, "title": String(t.prefix(60)), "text": t, "at": at], at: 0)
                    p["pages"] = list
                }
                WKInterfaceDevice.current().play(.success)
                dismiss()
            }
            .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .navigationTitle("New note")
    }
}

// MARK: - Recording a meeting

@MainActor
final class NotesRecorder: NSObject, ObservableObject, AVAudioRecorderDelegate {
    enum Phase { case idle, recording, paused, done }
    @Published private(set) var phase: Phase = .idle
    @Published private(set) var elapsed: TimeInterval = 0
    @Published private(set) var level: Float = 0
    @Published var problem: String?
    private var recorder: AVAudioRecorder?
    private var timer: Timer?
    private(set) var file: URL?
    private(set) var started = Date()
    /** Two hours, the longest recording Arise Notes writes down in one go. */
    static let longest: TimeInterval = 2 * 3600

    func start() async {
        guard phase == .idle else { return }
        let allowed = await AVAudioApplication.requestRecordPermission()
        guard allowed else { problem = "Arise Notes needs the microphone. Turn it on in the Watch app on your iPhone: Privacy, Microphone."; return }
        do {
            let s = AVAudioSession.sharedInstance()
            try s.setCategory(.record, mode: .default)
            try s.setActive(true)
            let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            started = Date()
            let f = DateFormatter(); f.dateFormat = "yyyyMMdd-HHmmss"; f.locale = Locale(identifier: "en_US_POSIX")
            let url = dir.appendingPathComponent("meeting-\(f.string(from: started)).m4a")
            // Speech-quality AAC: about 15 MB an hour, small enough to send to the phone quickly.
            let settings: [String: Any] = [AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 16_000, AVNumberOfChannelsKey: 1, AVEncoderBitRateKey: 32_000, AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue]
            let r = try AVAudioRecorder(url: url, settings: settings)
            r.delegate = self
            r.isMeteringEnabled = true
            guard r.record(forDuration: Self.longest) else { problem = "The microphone couldn't start. Try again."; return }
            recorder = r; file = url; phase = .recording; elapsed = 0
            WKInterfaceDevice.current().play(.start)
            timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
                MainActor.assumeIsolated { self?.tick() }
            }
        } catch {
            problem = "The microphone couldn't start: \(error.localizedDescription)"
        }
    }

    private func tick() {
        guard let r = recorder else { return }
        elapsed = r.currentTime > 0 ? r.currentTime : elapsed
        r.updateMeters()
        let db = r.averagePower(forChannel: 0)
        level = max(0, min(1, (db + 50) / 50))
    }

    func pause() { guard phase == .recording else { return }; recorder?.pause(); phase = .paused; WKInterfaceDevice.current().play(.stop) }
    func resume() { guard phase == .paused else { return }; recorder?.record(); phase = .recording; WKInterfaceDevice.current().play(.start) }

    /** Stops and sends the recording to the phone to be written down. */
    func finish(title: String) {
        let secs = elapsed
        stopRecorder()
        guard let file, FileManager.default.fileExists(atPath: file.path) else { problem = "The recording wasn't saved."; return }
        AriseWatchLink.shared.sendFile(file, info: ["type": "recording", "title": title, "secs": secs, "at": started.timeIntervalSince1970 * 1000])
        phase = .done
        WKInterfaceDevice.current().play(.success)
    }

    func discard() {
        stopRecorder()
        if let file { try? FileManager.default.removeItem(at: file) }
        file = nil; phase = .idle; elapsed = 0
    }

    private func stopRecorder() {
        timer?.invalidate(); timer = nil
        recorder?.stop(); recorder = nil
        try? AVAudioSession.sharedInstance().setActive(false)
    }

    nonisolated func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        // Reached two hours: it's saved and sent like a stop.
        Task { @MainActor in
            if self.phase == .recording || self.phase == .paused, self.recorder === recorder { self.finish(title: self.defaultTitle) }
        }
    }

    var defaultTitle: String { "Meeting " + started.formatted(date: .abbreviated, time: .shortened) }
}

struct NotesWatchRecord: View {
    @StateObject private var rec = NotesRecorder()
    @Environment(\.dismiss) private var dismiss
    @State private var naming = false
    @State private var title = ""

    var body: some View {
        VStack(spacing: 8) {
            switch rec.phase {
            case .done:
                Image(systemName: "checkmark.circle.fill").font(.system(size: 40)).foregroundStyle(.green)
                Text("Sent to your iPhone").font(.headline)
                Text("Open Arise Notes on your iPhone and it's written down with a summary.").font(.caption2).multilineTextAlignment(.center).foregroundStyle(.secondary)
                Button("Done") { dismiss() }.tint(.purple)
            default:
                HStack(spacing: 6) {
                    Circle().fill(rec.phase == .recording ? .red : .orange).frame(width: 9, height: 9)
                        .opacity(rec.phase == .recording ? 1 : 0.6)
                    Text(rec.phase == .idle ? "Ready" : rec.phase == .paused ? "Paused" : "Recording").font(.footnote.bold())
                }
                Text(clock(rec.elapsed)).font(.system(size: 36, weight: .semibold).monospacedDigit()).minimumScaleFactor(0.6)
                // The microphone's level, so it's clear it's hearing the room.
                HStack(spacing: 3) {
                    ForEach(0..<12, id: \.self) { i in
                        Capsule().fill(Float(i) / 12 < rec.level && rec.phase == .recording ? Color.red : Color.white.opacity(0.2)).frame(width: 5, height: CGFloat(6 + i * 2))
                    }
                }
                .frame(height: 30)
                if let p = rec.problem { Text(p).font(.caption2).foregroundStyle(.orange).multilineTextAlignment(.center) }
                HStack(spacing: 10) {
                    if rec.phase == .recording {
                        Button { rec.pause() } label: { Image(systemName: "pause.fill") }.accessibilityLabel("Pause")
                    } else if rec.phase == .paused {
                        Button { rec.resume() } label: { Image(systemName: "record.circle") }.tint(.red).accessibilityLabel("Keep recording")
                    }
                    if rec.phase != .idle {
                        Button { title = rec.defaultTitle; naming = true } label: { Image(systemName: "stop.fill") }.tint(.red).accessibilityLabel("Stop and save")
                    }
                }
                if rec.phase == .idle && rec.problem != nil { Button("Close") { dismiss() } }
                if rec.phase != .idle { Text("Keeps recording with the screen off.").font(.system(size: 10)).foregroundStyle(.secondary) }
            }
        }
        .padding(.horizontal, 4)
        .task { await rec.start() }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button {
                    if rec.phase == .recording || rec.phase == .paused { rec.discard() }
                    dismiss()
                } label: { Image(systemName: "xmark") }
                .accessibilityLabel(rec.phase == .recording || rec.phase == .paused ? "Throw away the recording" : "Close")
            }
        }
        .sheet(isPresented: $naming) {
            Form {
                TextField("Name", text: $title)
                Button("Save and send") { naming = false; rec.finish(title: title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? rec.defaultTitle : title) }
                    .tint(.purple)
            }
            .navigationTitle("Save")
        }
    }

    private func clock(_ t: TimeInterval) -> String {
        let s = Int(max(0, t)); let h = s / 3600, m = (s % 3600) / 60, r = s % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, r) : String(format: "%d:%02d", m, r)
    }
}
