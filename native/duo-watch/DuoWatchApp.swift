// Arise Duo for Apple Watch: your day from the iPhone app. A summary at the top (how many tasks are due,
// what's next on the calendar), today's tasks checked off with a tap or a swipe, today's chores (whose turn,
// checked off the same way), the next few days' events, and new tasks added by voice. The list comes from
// the phone (native/arise-watch → native/watch-kit/AriseWatchLink); what's done here goes back to the phone,
// which saves it to your account like any other change.
//   payload: { today: "YYYY-MM-DD", name, tasks: [{ id, title, due, time, done, list }],
//              events: [{ date, title, time, location }], chores: [{ id, title, who, emoji, points, done }] }
//   actions: { type: "toggle", id } · { type: "add", title, due } · { type: "chore", id }
import SwiftUI
import WatchKit

@main
struct DuoWatchApp: App {
    @WKApplicationDelegateAdaptor(DuoWatchDelegate.self) var delegate
    var body: some Scene { WindowGroup { DuoWatchHome() } }
}

final class DuoWatchDelegate: NSObject, WKApplicationDelegate {
    func applicationDidFinishLaunching() {
        Task { @MainActor in
            if UserDefaults.standard.bool(forKey: "watchSample") { AriseWatchLink.shared.preview(duoWatchSample()); return }
            AriseWatchLink.shared.start()
        }
    }
    func applicationDidBecomeActive() { Task { @MainActor in if !UserDefaults.standard.bool(forKey: "watchSample") { AriseWatchLink.shared.refresh() } } }
}

/** A made-up day for the simulator screenshots (-watchSample YES). */
func duoWatchSample() -> [String: Any] {
    let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
    let day = f.string(from: Date()), tomorrow = f.string(from: Date().addingTimeInterval(86_400)), before = f.string(from: Date().addingTimeInterval(-86_400 * 2))
    return ["today": day, "name": "Jeremy",
            "tasks": [["id": "1", "title": "Renew car registration", "due": before, "time": "", "done": false, "list": "Errands"],
                      ["id": "2", "title": "Sign Ava's field trip form", "due": day, "time": "", "done": false, "list": "School"],
                      ["id": "3", "title": "Take out the recycling", "due": day, "time": "19:00", "done": true, "list": "Home"],
                      ["id": "4", "title": "Call the dentist", "due": tomorrow, "time": "10:00", "done": false, "list": "Home"]],
            "events": [["date": day, "title": "Soccer practice", "time": "23:59", "location": "Riverside Park"], ["date": tomorrow, "title": "Piano lesson", "time": "15:30", "location": ""]],
            "chores": [["id": "c1", "title": "Feed the dog", "who": "Leo", "emoji": "🦖", "points": 2, "done": true], ["id": "c2", "title": "Unload dishwasher", "who": "Ava", "emoji": "🦄", "points": 3, "done": false]]]
}

/** The phone app's violet. */
let duoViolet = Color(red: 0x78 / 255, green: 0x66 / 255, blue: 0xe1 / 255)

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

struct DuoEvent: Identifiable {
    var id: String { date + time + title }
    let date: String, title: String, time: String, location: String
    init?(_ d: [String: Any]) {
        guard let title = d["title"] as? String, let date = d["date"] as? String else { return nil }
        self.title = title; self.date = date
        time = d["time"] as? String ?? ""; location = d["location"] as? String ?? ""
    }
}

struct DuoChore: Identifiable {
    let id: String, title: String, who: String, emoji: String, points: Int, done: Bool
    init?(_ d: [String: Any]) {
        guard let id = d["id"] as? String, let title = d["title"] as? String else { return nil }
        self.id = id; self.title = title
        who = d["who"] as? String ?? ""; emoji = d["emoji"] as? String ?? ""
        points = (d["points"] as? NSNumber)?.intValue ?? 0; done = d["done"] as? Bool ?? false
    }
}

// "2026-11-09" → "Mon, Nov 9"; "17:30" → "5:30 PM".
private func duoDate(_ day: String) -> Date? { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.date(from: day) }
private func duoDay(_ day: String, today: String) -> String {
    if day == today { return "Today" }
    guard let d = duoDate(day) else { return day }
    if let t = duoDate(today), let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: t), Calendar.current.isDate(d, inSameDayAs: tomorrow) { return "Tomorrow" }
    return d.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
}
private func duoTime(_ t: String) -> String {
    let f = DateFormatter(); f.dateFormat = "HH:mm"
    guard let d = f.date(from: t) else { return t }
    return d.formatted(date: .omitted, time: .shortened)
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
    private var events: [DuoEvent] { link.list("events").compactMap(DuoEvent.init) }
    private var chores: [DuoChore] { link.list("chores").compactMap(DuoChore.init) }
    private var dueNow: [DuoTask] { tasks.filter { !$0.done && !$0.due.isEmpty && $0.due <= today }.sorted { ($0.due, $0.time) < ($1.due, $1.time) } }
    private var later: [DuoTask] { tasks.filter { !$0.done && $0.due > today }.sorted { ($0.due, $0.time) < ($1.due, $1.time) } }
    private var anytime: [DuoTask] { tasks.filter { !$0.done && $0.due.isEmpty } }
    private var done: [DuoTask] { tasks.filter { $0.done } }
    private var todayEvents: [DuoEvent] { events.filter { $0.date == today } }
    /** The next event that hasn't started yet today (or the first all-day one). */
    private var nextEvent: DuoEvent? {
        let f = DateFormatter(); f.dateFormat = "HH:mm"; f.locale = Locale(identifier: "en_US_POSIX")
        let now = f.string(from: Date())
        return todayEvents.first { !$0.time.isEmpty && $0.time >= now } ?? todayEvents.first { $0.time.isEmpty }
    }

    var body: some View {
        NavigationStack {
            List {
                summary.listRowBackground(Color.clear)
                Button { adding = true } label: { Label("Add a task", systemImage: "plus.circle.fill").foregroundStyle(duoViolet) }
                section("Today", dueNow, empty: "Nothing due today 🎉")
                if !chores.isEmpty { choreSection }
                if !events.isEmpty { eventSection }
                if !later.isEmpty { section("Coming up", Array(later.prefix(15)), empty: nil) }
                if !anytime.isEmpty { section("Anytime", Array(anytime.prefix(15)), empty: nil) }
                if !done.isEmpty {
                    Section {
                        Toggle("Show done (\(done.count))", isOn: $showDone)
                        if showDone { ForEach(done.prefix(15)) { row($0) } }
                    }
                }
                Section { AriseUpdatedNote(empty: "Open Arise Duo on your iPhone once, and your day shows up here.") }
            }
            .navigationTitle("Arise Duo")
            .sheet(isPresented: $adding) { DuoAddTask(today: today) }
        }
        .tint(duoViolet)
    }

    /** "Good evening, Jeremy" with a ring for how much of today is done. */
    private var summary: some View {
        let todayAll = tasks.filter { $0.due == today || ($0.done && !$0.due.isEmpty && $0.due <= today) }
        let doneCount = todayAll.filter(\.done).count + chores.filter(\.done).count
        let total = todayAll.count + chores.count
        let h = Calendar.current.component(.hour, from: Date())
        let part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
        let name = link.text("name")
        return HStack(spacing: 10) {
            ZStack {
                Circle().stroke(duoViolet.opacity(0.25), lineWidth: 5)
                Circle().trim(from: 0, to: total == 0 ? 1 : CGFloat(doneCount) / CGFloat(total))
                    .stroke(total > 0 && doneCount == total ? .green : duoViolet, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text(total == 0 ? "✓" : "\(doneCount)/\(total)").font(.system(size: 11, weight: .bold)).minimumScaleFactor(0.6)
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 1) {
                Text(name.isEmpty ? part : "\(part), \(name)").font(.footnote.bold()).lineLimit(1)
                Text(dueNow.isEmpty ? "No tasks due" : "\(dueNow.count) task\(dueNow.count == 1 ? "" : "s") due").font(.caption2).foregroundStyle(.secondary)
                if let e = nextEvent { Text("\(e.time.isEmpty ? "All day" : duoTime(e.time)) · \(e.title)").font(.caption2).foregroundStyle(duoViolet).lineLimit(1) }
            }
        }
    }

    @ViewBuilder private func section(_ title: String, _ items: [DuoTask], empty: String?) -> some View {
        Section(title) {
            if items.isEmpty, let empty { Text(empty).font(.footnote).foregroundStyle(.secondary) }
            ForEach(items) { row($0) }
        }
    }

    private var choreSection: some View {
        let left = chores.filter { !$0.done }.count
        return Section(left == 0 ? "Chores · all done" : "Chores · \(left) left") {
            ForEach(chores) { c in
                Button { toggleChore(c) } label: {
                    HStack(spacing: 8) {
                        Image(systemName: c.done ? "checkmark.square.fill" : "square").foregroundStyle(c.done ? .green : .secondary)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(c.title).font(.footnote).strikethrough(c.done).lineLimit(2)
                            let sub = [c.who.isEmpty ? "Anyone" : "\(c.emoji) \(c.who)".trimmingCharacters(in: .whitespaces), c.points > 0 ? "+\(c.points) ⭐" : ""].filter { !$0.isEmpty }.joined(separator: " · ")
                            Text(sub).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                        }
                    }
                }
                .swipeActions { Button { toggleChore(c) } label: { Image(systemName: c.done ? "arrow.uturn.backward" : "checkmark") }.tint(c.done ? .gray : .green) }
            }
        }
    }

    private var eventSection: some View {
        Section("Calendar") {
            ForEach(events.prefix(10)) { e in
                HStack(alignment: .top, spacing: 8) {
                    RoundedRectangle(cornerRadius: 2).fill(duoViolet).frame(width: 4)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(e.title).font(.footnote).lineLimit(2)
                        let when = e.date == today ? (e.time.isEmpty ? "All day" : duoTime(e.time)) : duoDay(e.date, today: today) + (e.time.isEmpty ? "" : " · " + duoTime(e.time))
                        Text([when, e.location].filter { !$0.isEmpty }.joined(separator: " · ")).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
            }
        }
    }

    private func toggle(_ t: DuoTask) {
        WKInterfaceDevice.current().play(t.done ? .click : .success)
        link.send(["type": "toggle", "id": t.id]) { p in
            guard var list = p["tasks"] as? [[String: Any]], let i = list.firstIndex(where: { $0["id"] as? String == t.id }) else { return }
            list[i]["done"] = !t.done
            p["tasks"] = list
        }
    }

    private func toggleChore(_ c: DuoChore) {
        WKInterfaceDevice.current().play(c.done ? .click : .success)
        link.send(["type": "chore", "id": c.id]) { p in
            guard var list = p["chores"] as? [[String: Any]], let i = list.firstIndex(where: { $0["id"] as? String == c.id }) else { return }
            list[i]["done"] = !c.done
            p["chores"] = list
        }
    }

    private func row(_ t: DuoTask) -> some View {
        let overdue = !t.done && !t.due.isEmpty && t.due < today
        return Button { toggle(t) } label: {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: t.done ? "checkmark.circle.fill" : "circle").foregroundStyle(t.done ? .green : overdue ? .red : .secondary)
                VStack(alignment: .leading, spacing: 1) {
                    Text(t.title).font(.footnote).strikethrough(t.done).lineLimit(3)
                    let when = overdue ? "Overdue · " + duoDay(t.due, today: today) : t.due == today || t.due.isEmpty ? "" : duoDay(t.due, today: today)
                    let sub = [when, t.time.isEmpty ? "" : duoTime(t.time), t.list].filter { !$0.isEmpty }.joined(separator: " · ")
                    if !sub.isEmpty { Text(sub).font(.caption2).foregroundStyle(overdue ? .red : .secondary).lineLimit(1) }
                }
            }
        }
        .swipeActions { Button { toggle(t) } label: { Image(systemName: t.done ? "arrow.uturn.backward" : "checkmark") }.tint(t.done ? .gray : .green) }
    }
}

/** A new task, typed, scribbled or dictated (the watch's own text entry), for today, tomorrow or anytime. */
struct DuoAddTask: View {
    let today: String
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var when = 0
    var body: some View {
        Form {
            TextField("What needs doing?", text: $title)
            Picker("When", selection: $when) {
                Text("Today").tag(0)
                Text("Tomorrow").tag(1)
                Text("Anytime").tag(2)
            }
            Button("Add") {
                let t = title.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !t.isEmpty else { return }
                let id = "watch-" + UUID().uuidString.prefix(8).lowercased()
                let due = when == 2 ? "" : when == 1 ? tomorrow : today
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
    private var tomorrow: String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: today), let n = Calendar.current.date(byAdding: .day, value: 1, to: d) else { return today }
        return f.string(from: n)
    }
}
