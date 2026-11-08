// Arise Notes for Apple Watch: your latest notes and meeting summaries to read on your wrist, and new
// notes dictated (or scribbled) on the watch, which the iPhone app saves to your notes.
//   payload: { pages: [{ id, title, text, at }], meetings: [{ id, title, text, at }] }
//   actions: { type: "add", text }
import SwiftUI
import WatchKit

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
    private var pages: [WatchNote] { link.list("pages").compactMap(WatchNote.init) }
    private var meetings: [WatchNote] { link.list("meetings").compactMap(WatchNote.init) }

    var body: some View {
        NavigationStack {
            List {
                Button { writing = true } label: { Label("New note", systemImage: "mic.circle.fill").foregroundStyle(.purple) }
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
