// Arise Duo for Apple Watch: today's tasks from the iPhone app, checked off with a tap, and new ones
// added by voice. The list comes from the phone (native/arise-watch → native/watch-kit/AriseWatchLink);
// what's done here goes back to the phone, which saves it to your account like any other change.
//   payload: { today: "YYYY-MM-DD", tasks: [{ id, title, due, time, done, list }] }
//   actions: { type: "toggle", id } · { type: "add", title, due }
import SwiftUI
import WatchKit

@main
struct DuoWatchApp: App {
    @WKApplicationDelegateAdaptor(DuoWatchDelegate.self) var delegate
    var body: some Scene { WindowGroup { DuoWatchHome() } }
}

final class DuoWatchDelegate: NSObject, WKApplicationDelegate {
    func applicationDidFinishLaunching() { Task { @MainActor in AriseWatchLink.shared.start() } }
    func applicationDidBecomeActive() { Task { @MainActor in AriseWatchLink.shared.refresh() } }
}

struct DuoTask: Identifiable {
    let id: String
    let title: String
    let due: String
    let time: String
    let done: Bool
    let list: String
    init?(_ d: [String: Any]) {
        guard let id = d["id"] as? String, let title = d["title"] as? String else { return nil }
        self.id = id; self.title = title
        due = d["due"] as? String ?? ""; time = d["time"] as? String ?? ""
        done = d["done"] as? Bool ?? false; list = d["list"] as? String ?? ""
    }
}

struct DuoWatchHome: View {
    @ObservedObject private var link = AriseWatchLink.shared
    @State private var adding = false
    @State private var showDone = false

    private var today: String {
        let t = link.text("today")
        if !t.isEmpty { return t }
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date())
    }
    private var tasks: [DuoTask] { link.list("tasks").compactMap(DuoTask.init) }
    private var dueNow: [DuoTask] { tasks.filter { !$0.done && !$0.due.isEmpty && $0.due <= today }.sorted { ($0.due, $0.time) < ($1.due, $1.time) } }
    private var later: [DuoTask] { tasks.filter { !$0.done && $0.due > today }.sorted { ($0.due, $0.time) < ($1.due, $1.time) } }
    private var anytime: [DuoTask] { tasks.filter { !$0.done && $0.due.isEmpty } }
    private var done: [DuoTask] { tasks.filter { $0.done } }

    var body: some View {
        NavigationStack {
            List {
                Button { adding = true } label: { Label("Add a task", systemImage: "plus.circle.fill").foregroundStyle(.blue) }
                section("Today", dueNow, empty: "Nothing due today")
                if !later.isEmpty { section("Coming up", Array(later.prefix(15)), empty: nil) }
                if !anytime.isEmpty { section("Anytime", Array(anytime.prefix(15)), empty: nil) }
                if !done.isEmpty {
                    Section {
                        Toggle("Show done", isOn: $showDone)
                        if showDone { ForEach(done.prefix(15)) { row($0) } }
                    }
                }
                Section { AriseUpdatedNote(empty: "Open Arise Duo on your iPhone once, and your tasks show up here.") }
            }
            .navigationTitle("Arise Duo")
            .sheet(isPresented: $adding) { DuoAddTask(today: today) }
        }
    }

    @ViewBuilder private func section(_ title: String, _ items: [DuoTask], empty: String?) -> some View {
        Section(title) {
            if items.isEmpty, let empty { Text(empty).font(.footnote).foregroundStyle(.secondary) }
            ForEach(items) { row($0) }
        }
    }

    private func row(_ t: DuoTask) -> some View {
        Button {
            WKInterfaceDevice.current().play(t.done ? .click : .success)
            link.send(["type": "toggle", "id": t.id]) { p in
                guard var list = p["tasks"] as? [[String: Any]], let i = list.firstIndex(where: { $0["id"] as? String == t.id }) else { return }
                list[i]["done"] = !t.done
                p["tasks"] = list
            }
        } label: {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: t.done ? "checkmark.circle.fill" : "circle").foregroundStyle(t.done ? .green : .secondary)
                VStack(alignment: .leading, spacing: 1) {
                    Text(t.title).font(.footnote).strikethrough(t.done).lineLimit(3)
                    let sub = [t.due == today ? "" : t.due, t.time, t.list].filter { !$0.isEmpty }.joined(separator: " · ")
                    if !sub.isEmpty { Text(sub).font(.caption2).foregroundStyle(.secondary).lineLimit(1) }
                }
            }
        }
    }
}

/** A new task, typed, scribbled or dictated (the watch's own text entry). */
struct DuoAddTask: View {
    let today: String
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var forToday = true
    var body: some View {
        Form {
            TextField("What needs doing?", text: $title)
            Toggle("Due today", isOn: $forToday)
            Button("Add") {
                let t = title.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !t.isEmpty else { return }
                let id = "watch-" + UUID().uuidString.prefix(8).lowercased()
                let due = forToday ? today : ""
                AriseWatchLink.shared.send(["type": "add", "title": t, "due": due, "id": id]) { p in
                    var list = p["tasks"] as? [[String: Any]] ?? []
                    list.append(["id": id, "title": t, "due": due, "done": false])
                    p["tasks"] = list
                }
                WKInterfaceDevice.current().play(.success)
                dismiss()
            }
            .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .navigationTitle("New task")
    }
}
