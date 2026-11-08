// The native Tasks screen: Today / Upcoming / All / Done, tick to finish, swipe to delete, add at the bottom.
import SwiftUI
import UIKit

struct NTask: Identifiable, Equatable {
    let id: String
    var title: String
    var due: String      // yyyy-MM-dd or ""
    var time: String     // HH:mm or ""
    var done: Bool
    var high: Bool
    var listId: String
    var repeats: Bool
}

struct NList: Identifiable, Equatable {
    let id: String
    let name: String
}

final class TasksModel: ObservableObject {
    @Published var tasks: [NTask] = []
    @Published var lists: [NList] = []

    func load(tasks raw: [[String: Any]], lists rawLists: [[String: Any]]) {
        tasks = raw.compactMap { t in
            guard let id = t["id"] as? String, let title = t["title"] as? String else { return nil }
            return NTask(id: id, title: title, due: t["due"] as? String ?? "", time: t["time"] as? String ?? "",
                         done: t["done"] as? Bool ?? false, high: t["high"] as? Bool ?? false,
                         listId: t["listId"] as? String ?? "", repeats: t["repeats"] as? Bool ?? false)
        }
        lists = rawLists.compactMap { l in
            guard let id = l["id"] as? String, let name = l["name"] as? String else { return nil }
            return NList(id: id, name: name)
        }
    }
}

private enum Tab: String, CaseIterable, Identifiable {
    case today = "Today", upcoming = "Upcoming", all = "All", done = "Done"
    var id: String { rawValue }
}

private func todayString() -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: Date())
}

private func prettyDue(_ due: String, _ time: String, today: String) -> String {
    if due.isEmpty { return time }
    var day = due
    if due == today { day = "Today" }
    else if due < today { day = "Overdue, " + due }
    return time.isEmpty ? day : day + " at " + time
}

struct TasksView: View {
    @ObservedObject var model: TasksModel
    let send: ([String: Any]) -> Void
    let close: () -> Void

    @State private var tab: Tab = .today
    @State private var listId: String = ""
    @State private var draft: String = ""

    private var today: String { todayString() }

    private var shown: [NTask] {
        let base = model.tasks.filter { listId.isEmpty || $0.listId == listId }
        switch tab {
        case .today: return base.filter { !$0.done && !$0.due.isEmpty && $0.due <= today }.sorted { ($0.due, $0.time) < ($1.due, $1.time) }
        case .upcoming: return base.filter { !$0.done && !$0.due.isEmpty && $0.due > today }.sorted { ($0.due, $0.time) < ($1.due, $1.time) }
        case .all: return base.filter { !$0.done }.sorted { ($0.due.isEmpty ? "9999" : $0.due) < ($1.due.isEmpty ? "9999" : $1.due) }
        case .done: return base.filter { $0.done }
        }
    }

    private func toggle(_ task: NTask) {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        if let i = model.tasks.firstIndex(where: { $0.id == task.id }) { model.tasks[i].done.toggle() }
        send(["type": "toggle", "id": task.id])
    }

    private func remove(_ task: NTask) {
        model.tasks.removeAll { $0.id == task.id }
        send(["type": "delete", "id": task.id])
    }

    private func add() {
        let title = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        send(["type": "add", "title": title, "due": tab == .today ? today : "", "listId": listId])
        draft = ""
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                Picker("View", selection: $tab) {
                    ForEach(Tab.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)

                List {
                    ForEach(shown) { task in
                        HStack(spacing: 14) {
                            Button(action: { toggle(task) }) {
                                Image(systemName: task.done ? "checkmark.circle.fill" : "circle")
                                    .font(.system(size: 24, weight: .light))
                                    .foregroundColor(task.done ? .accentColor : Color(.tertiaryLabel))
                            }
                            .buttonStyle(.plain)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(task.title)
                                    .font(.system(size: 16, weight: task.high ? .semibold : .regular))
                                    .strikethrough(task.done)
                                    .foregroundColor(task.done ? Color(.secondaryLabel) : Color(.label))
                                let sub = prettyDue(task.due, task.time, today: today)
                                if !sub.isEmpty {
                                    Text(sub).font(.system(size: 12)).foregroundColor(task.due != "" && task.due < today && !task.done ? .red : Color(.secondaryLabel))
                                }
                            }
                            Spacer(minLength: 0)
                            if task.high { Text("High").font(.system(size: 11, weight: .semibold)).foregroundColor(.red) }
                        }
                        .padding(.vertical, 4)
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) { remove(task) } label: { Text("Delete") }
                        }
                    }
                    if shown.isEmpty {
                        Text(tab == .done ? "Nothing finished yet." : "Nothing here. Add a task below.")
                            .font(.system(size: 14)).foregroundColor(Color(.secondaryLabel))
                            .frame(maxWidth: .infinity, alignment: .center).padding(.vertical, 32)
                            .listRowSeparator(.hidden)
                    }
                }
                .listStyle(.plain)

                HStack(spacing: 10) {
                    TextField("Add a task", text: $draft, onCommit: add)
                        .padding(.horizontal, 14).padding(.vertical, 11)
                        .background(Color(.secondarySystemBackground)).cornerRadius(12)
                    Button(action: add) {
                        Image(systemName: "arrow.up.circle.fill").font(.system(size: 32))
                    }
                    .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                .padding(.horizontal, 16).padding(.vertical, 10)
                .background(Color(.systemBackground))
            }
            .navigationTitle("Tasks")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: close) { HStack(spacing: 4) { Image(systemName: "chevron.left"); Text("Back") } }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    if !model.lists.isEmpty {
                        Menu {
                            Button("All lists") { listId = "" }
                            ForEach(model.lists) { l in Button(l.name) { listId = l.id } }
                        } label: { Image(systemName: "line.3.horizontal.decrease.circle") }
                    }
                }
            }
        }
        .navigationViewStyle(.stack)
    }
}
