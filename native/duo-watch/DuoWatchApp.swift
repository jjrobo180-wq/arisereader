// Arise Duo for Apple Watch: Life and Work on your wrist, switched at the top.
//   Life: today's tasks, the calendar, chores, the grocery list, habits, medicine, money and bills, today's
//         meals from the Kitchen, countdowns and notes (each one only when it's on in the app).
//   Work: to-dos, the week's calendar and recent notes from WorkHub.
// Tasks are checked off with a tap or a swipe and added by voice; groceries, habits, chores, doses and
// bills are checked off the same way. The phone (native/arise-watch -> native/watch-kit/AriseWatchLink)
// sends one payload with both hubs (shared/watchDuo.ts); what's done here goes back as actions with the
// hub they're for, and shows on the watch at once.
//   payload: { today, name, hubs: { life: {...}, work: {...} }, ...life (for older watch apps) }
//   actions: toggle · add · chore · grocery · grocery-add · grocery-clear · habit · pill · bill, each with "hub"
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
    let life: [String: Any] = [
        "features": ["calendar", "chores", "grocery", "habits", "pills", "money", "meals", "countdowns", "notes"],
        "tasks": [["id": "1", "title": "Renew car registration", "due": before, "time": "", "done": false, "list": "Errands"],
                  ["id": "2", "title": "Sign Ava's field trip form", "due": day, "time": "", "done": false, "list": "School"],
                  ["id": "3", "title": "Take out the recycling", "due": day, "time": "19:00", "done": true, "list": "Home"],
                  ["id": "4", "title": "Call the dentist", "due": tomorrow, "time": "10:00", "done": false, "list": "Home"]],
        "events": [["date": day, "title": "Soccer practice", "time": "23:59", "location": "Riverside Park"], ["date": tomorrow, "title": "Piano lesson", "time": "15:30", "location": ""]],
        "chores": [["id": "c1", "title": "Feed the dog", "who": "Leo", "emoji": "🦖", "points": 2, "done": true], ["id": "c2", "title": "Unload dishwasher", "who": "Ava", "emoji": "🦄", "points": 3, "done": false]],
        "groceries": [["id": "g1", "name": "Milk", "qty": "1 gal", "aisle": "Dairy", "done": false], ["id": "g2", "name": "Bananas", "qty": "", "aisle": "Produce", "done": false], ["id": "g3", "name": "Bread", "qty": "", "aisle": "Bakery", "done": true]],
        "habits": [["id": "h1", "name": "Read 20 minutes", "emoji": "📚", "done": false, "streak": 4], ["id": "h2", "name": "Walk", "emoji": "🚶", "done": true, "streak": 9]],
        "pills": [["pillId": "p1", "name": "Vitamin D", "dose": "1 tablet", "time": "08:00", "who": "", "status": "taken"], ["pillId": "p2", "name": "Allergy", "dose": "10 mg", "time": "20:00", "who": "Ava", "status": ""]],
        "money": ["label": "Left this month", "amount": 642.18, "until": "", "spent": 857.82, "budgeted": 1500, "billsLeft": 180],
        "bills": [["id": "b1", "name": "Phone", "left": 60, "owed": 60, "due": tomorrow, "state": "soon", "autopay": false, "next": 60], ["id": "b2", "name": "Internet", "left": 0, "owed": 70, "due": "", "state": "paid", "autopay": true, "next": 0]],
        "meals": [["slot": "Breakfast", "dishes": ["Oatmeal"]], ["slot": "Dinner", "dishes": ["Tacos", "Rice"]]],
        "countdowns": [["id": "k1", "title": "Beach trip", "date": tomorrow, "emoji": "🏖️", "days": 1]],
        "notes": [["id": "n1", "title": "Wi-Fi", "text": "Network: Home5G · password on the fridge", "at": day]],
    ]
    let work: [String: Any] = [
        "features": ["calendar", "notes"],
        "tasks": [["id": "w1", "title": "Grade unit 3 quizzes", "due": day, "time": "", "done": false, "list": "Class"],
                  ["id": "w2", "title": "Email the IEP team", "due": tomorrow, "time": "09:00", "done": false, "list": ""]],
        "events": [["date": day, "title": "Staff meeting", "time": "15:30", "location": "Library"]],
        "notes": [["id": "wn1", "title": "Parent call", "text": "Mom asked about reading at home.", "at": day]],
    ]
    var p: [String: Any] = ["today": day, "name": "Jeremy", "hubs": ["life": life, "work": work]]
    for (k, v) in life { p[k] = v }
    return p
}

/** The phone app's violet. */
let duoViolet = Color(red: 0x78 / 255, green: 0x66 / 255, blue: 0xe1 / 255)

// MARK: - Reading the payload

struct DuoTask: Identifiable {
    let id: String, title: String, due: String, time: String, done: Bool, list: String
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
struct DuoGrocery: Identifiable {
    let id: String, name: String, qty: String, aisle: String, done: Bool
    init?(_ d: [String: Any]) {
        guard let id = d["id"] as? String, let name = d["name"] as? String else { return nil }
        self.id = id; self.name = name; qty = d["qty"] as? String ?? ""; aisle = d["aisle"] as? String ?? ""; done = d["done"] as? Bool ?? false
    }
}
struct DuoHabit: Identifiable {
    let id: String, name: String, emoji: String, done: Bool, streak: Int
    init?(_ d: [String: Any]) {
        guard let id = d["id"] as? String, let name = d["name"] as? String else { return nil }
        self.id = id; self.name = name; emoji = d["emoji"] as? String ?? ""; done = d["done"] as? Bool ?? false
        streak = (d["streak"] as? NSNumber)?.intValue ?? 0
    }
}
struct DuoDose: Identifiable {
    var id: String { pillId + time }
    let pillId: String, name: String, dose: String, time: String, who: String, status: String
    init?(_ d: [String: Any]) {
        guard let pillId = d["pillId"] as? String, let name = d["name"] as? String else { return nil }
        self.pillId = pillId; self.name = name; dose = d["dose"] as? String ?? ""; time = d["time"] as? String ?? ""
        who = d["who"] as? String ?? ""; status = d["status"] as? String ?? ""
    }
}
struct DuoBill: Identifiable {
    let id: String, name: String, left: Double, owed: Double, due: String, state: String, autopay: Bool
    init?(_ d: [String: Any]) {
        guard let id = d["id"] as? String, let name = d["name"] as? String else { return nil }
        self.id = id; self.name = name
        left = (d["left"] as? NSNumber)?.doubleValue ?? 0; owed = (d["owed"] as? NSNumber)?.doubleValue ?? 0
        due = d["due"] as? String ?? ""; state = d["state"] as? String ?? ""; autopay = d["autopay"] as? Bool ?? false
    }
}
struct DuoMeal: Identifiable {
    var id: String { slot }
    let slot: String, dishes: [String]
    init?(_ d: [String: Any]) {
        guard let slot = d["slot"] as? String else { return nil }
        self.slot = slot; dishes = d["dishes"] as? [String] ?? []
    }
}
struct DuoCountdown: Identifiable {
    let id: String, title: String, date: String, emoji: String, days: Int
    init?(_ d: [String: Any]) {
        guard let id = d["id"] as? String, let title = d["title"] as? String else { return nil }
        self.id = id; self.title = title; date = d["date"] as? String ?? ""; emoji = d["emoji"] as? String ?? ""
        days = (d["days"] as? NSNumber)?.intValue ?? 0
    }
}
struct DuoNote: Identifiable, Hashable {
    let id: String, title: String, text: String, at: String
    init?(_ d: [String: Any]) {
        guard let id = d["id"] as? String else { return nil }
        self.id = id; title = d["title"] as? String ?? "Note"; text = d["text"] as? String ?? ""; at = d["at"] as? String ?? ""
    }
}

// "2026-11-09" -> "Mon, Nov 9"; "17:30" -> "5:30 PM"; 12.5 -> "$12.50".
private func duoDate(_ day: String) -> Date? { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.date(from: day) }
func duoDay(_ day: String, today: String) -> String {
    if day == today { return "Today" }
    guard let d = duoDate(day) else { return day }
    if let t = duoDate(today), let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: t), Calendar.current.isDate(d, inSameDayAs: tomorrow) { return "Tomorrow" }
    return d.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
}
func duoTime(_ t: String) -> String {
    let f = DateFormatter(); f.dateFormat = "HH:mm"; f.locale = Locale(identifier: "en_US_POSIX")
    guard let d = f.date(from: t) else { return t }
    return d.formatted(date: .omitted, time: .shortened)
}
func duoMoney(_ x: Double) -> String { x.formatted(.currency(code: "USD")) }

/** One hub's side of the payload, and the changes made to it on the watch. */
@MainActor
struct DuoHub {
    let link: AriseWatchLink
    let hub: String
    var part: [String: Any] {
        if let hubs = link.payload["hubs"] as? [String: Any], let p = hubs[hub] as? [String: Any] { return p }
        return hub == "life" ? link.payload : [:]
    }
    /** Whether the phone has sent this hub at all (Work shows up once WorkHub has been opened on the phone). */
    var sent: Bool { (link.payload["hubs"] as? [String: Any])?[hub] != nil || (hub == "life" && link.payload["tasks"] != nil) }
    func list(_ key: String) -> [[String: Any]] { part[key] as? [[String: Any]] ?? [] }
    var features: Set<String> { Set(part["features"] as? [String] ?? (hub == "life" ? ["calendar", "chores"] : ["calendar"])) }
    var today: String {
        let t = link.text("today")
        if !t.isEmpty { return t }
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date())
    }
    var tasks: [DuoTask] { list("tasks").compactMap(DuoTask.init) }

    /** Sends an action for this hub, and changes the watch's copy of `key` the same way at once. */
    func send(_ action: [String: Any], key: String, change: @escaping (inout [[String: Any]]) -> Void) {
        var a = action
        a["hub"] = hub
        let hub = self.hub
        link.send(a) { p in
            if var hubs = p["hubs"] as? [String: Any], var part = hubs[hub] as? [String: Any] {
                var l = part[key] as? [[String: Any]] ?? []
                change(&l); part[key] = l; hubs[hub] = part; p["hubs"] = hubs
            }
            if hub == "life" { var l = p[key] as? [[String: Any]] ?? []; change(&l); p[key] = l }
        }
    }
    func flip(_ key: String, id: String, field: String = "done", type: String, idKey: String = "id") {
        send(["type": type, "id": id], key: key) { l in
            if let i = l.firstIndex(where: { $0[idKey] as? String == id }) { l[i][field] = !((l[i][field] as? Bool) ?? false) }
        }
    }
}

// MARK: - Home

struct DuoWatchHome: View {
    @ObservedObject private var link = AriseWatchLink.shared
    @AppStorage("duo.hub") private var hub = "life"
    @State private var adding = false
    private var h: DuoHub { DuoHub(link: link, hub: hub) }

    var body: some View {
        NavigationStack {
            List {
                switcher.listRowBackground(Color.clear)
                if hub == "work" && !h.sent {
                    Text("Open WorkHub on your iPhone once, and your work to-dos and calendar show up here.").font(.footnote).foregroundStyle(.secondary)
                } else {
                    DuoSummary(h: h).listRowBackground(Color.clear)
                    Button { adding = true } label: { Label(hub == "work" ? "Add a to-do" : "Add a task", systemImage: "plus.circle.fill").foregroundStyle(duoViolet) }
                    DuoTaskRows(h: h, filter: .today, limit: 6)
                    Section("Apps") {
                        NavigationLink { DuoTasksPage(h: h) } label: { tile(hub == "work" ? "To-dos" : "Tasks", "checklist", badge: h.tasks.filter { !$0.done }.count) }
                        if h.features.contains("calendar") { NavigationLink { DuoCalendarPage(h: h) } label: { tile("Calendar", "calendar", badge: h.list("events").count) } }
                        if h.features.contains("chores") { NavigationLink { DuoChoresPage(h: h) } label: { tile("Chores", "star.circle", badge: h.list("chores").compactMap(DuoChore.init).filter { !$0.done }.count) } }
                        if h.features.contains("grocery") { NavigationLink { DuoGroceryPage(h: h) } label: { tile("Grocery list", "cart", badge: h.list("groceries").compactMap(DuoGrocery.init).filter { !$0.done }.count) } }
                        if h.features.contains("habits") { NavigationLink { DuoHabitsPage(h: h) } label: { tile("Habits", "flame", badge: h.list("habits").compactMap(DuoHabit.init).filter { !$0.done }.count) } }
                        if h.features.contains("pills") { NavigationLink { DuoPillsPage(h: h) } label: { tile("Medicine", "pills", badge: h.list("pills").compactMap(DuoDose.init).filter { $0.status.isEmpty }.count) } }
                        if h.features.contains("money") { NavigationLink { DuoMoneyPage(h: h) } label: { tile("Money & bills", "dollarsign.circle", badge: h.list("bills").compactMap(DuoBill.init).filter { $0.left > 0 }.count) } }
                        if h.features.contains("meals") { NavigationLink { DuoMealsPage(h: h) } label: { tile("Today's meals", "fork.knife", badge: 0) } }
                        if h.features.contains("countdowns") { NavigationLink { DuoCountdownsPage(h: h) } label: { tile("Countdowns", "hourglass", badge: 0) } }
                        if h.features.contains("notes") { NavigationLink { DuoNotesPage(h: h) } label: { tile("Notes", "note.text", badge: 0) } }
                    }
                }
                Section { AriseUpdatedNote(empty: "Open Arise Duo on your iPhone once, and your day shows up here.") }
            }
            .navigationTitle(hub == "work" ? "Work" : "Life")
            .sheet(isPresented: $adding) { DuoAddTask(h: h) }
        }
        .tint(duoViolet)
        .onAppear {
            if let s = UserDefaults.standard.string(forKey: "duoHub"), s == "work" || s == "life" { hub = s }
            // The simulator screenshots: the made-up day, even if the app opened before it was set.
            if UserDefaults.standard.bool(forKey: "watchSample") && link.payload.isEmpty { link.preview(duoWatchSample()) }
        }
    }

    /** Life | Work, like the switch at the top of the phone app. */
    private var switcher: some View {
        HStack(spacing: 4) {
            ForEach(["life", "work"], id: \.self) { id in
                let name = id == "work" ? "Work" : "Life"
                Button {
                    WKInterfaceDevice.current().play(.click)
                    withAnimation(.snappy) { hub = id }
                } label: {
                    Text(name).font(.footnote.bold()).frame(maxWidth: .infinity).padding(.vertical, 7)
                        .background(Capsule().fill(hub == id ? duoViolet : Color.white.opacity(0.12)))
                        .foregroundStyle(.white)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(hub == id ? .isSelected : [])
            }
        }
    }

    private func tile(_ name: String, _ symbol: String, badge: Int) -> some View {
        HStack(spacing: 8) {
            Image(systemName: symbol).foregroundStyle(duoViolet).frame(width: 22)
            Text(name).font(.footnote.bold()).lineLimit(1)
            Spacer(minLength: 0)
            if badge > 0 { Text("\(badge)").font(.caption2.bold()).padding(.horizontal, 6).padding(.vertical, 2).background(Capsule().fill(duoViolet.opacity(0.35))) }
        }
    }
}

/** "Good evening, Jeremy" with a ring for how much of today is done. */
struct DuoSummary: View {
    let h: DuoHub
    var body: some View {
        let today = h.today
        let todayAll = h.tasks.filter { $0.due == today || (!$0.done && !$0.due.isEmpty && $0.due < today) || ($0.done && !$0.due.isEmpty && $0.due <= today) }
        let chores = h.list("chores").compactMap(DuoChore.init)
        let doneCount = todayAll.filter(\.done).count + chores.filter(\.done).count
        let total = todayAll.count + chores.count
        let due = todayAll.filter { !$0.done }.count
        let hour = Calendar.current.component(.hour, from: Date())
        let part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
        let name = h.link.text("name")
        let events = h.list("events").compactMap(DuoEvent.init).filter { $0.date == today }
        let f = DateFormatter(); f.dateFormat = "HH:mm"; f.locale = Locale(identifier: "en_US_POSIX")
        let now = f.string(from: Date())
        let next = events.first { !$0.time.isEmpty && $0.time >= now } ?? events.first { $0.time.isEmpty }
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
                Text(due == 0 ? "Nothing due" : "\(due) due today").font(.caption2).foregroundStyle(.secondary)
                if let e = next { Text("\(e.time.isEmpty ? "All day" : duoTime(e.time)) · \(e.title)").font(.caption2).foregroundStyle(duoViolet).lineLimit(1) }
            }
        }
    }
}

// MARK: - Tasks

enum DuoTaskFilter { case today, later, anytime, done }

struct DuoTaskRows: View {
    let h: DuoHub
    let filter: DuoTaskFilter
    var limit = 40
    var body: some View {
        let today = h.today
        let all = h.tasks
        let items: [DuoTask] = {
            switch filter {
            case .today: return all.filter { !$0.done && !$0.due.isEmpty && $0.due <= today }.sorted { ($0.due, $0.time) < ($1.due, $1.time) }
            case .later: return all.filter { !$0.done && $0.due > today }.sorted { ($0.due, $0.time) < ($1.due, $1.time) }
            case .anytime: return all.filter { !$0.done && $0.due.isEmpty }
            case .done: return all.filter(\.done)
            }
        }()
        let title: String = { switch filter { case .today: return "Today"; case .later: return "Coming up"; case .anytime: return "Anytime"; case .done: return "Done" } }()
        if filter == .today || !items.isEmpty {
            Section(title) {
                if items.isEmpty { Text("Nothing due today 🎉").font(.footnote).foregroundStyle(.secondary) }
                ForEach(items.prefix(limit)) { t in row(t, today: today) }
                if items.count > limit { NavigationLink("\(items.count - limit) more") { DuoTasksPage(h: h) }.font(.footnote) }
            }
        }
    }
    private func toggle(_ t: DuoTask) {
        WKInterfaceDevice.current().play(t.done ? .click : .success)
        h.flip("tasks", id: t.id, type: "toggle")
    }
    private func row(_ t: DuoTask, today: String) -> some View {
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

struct DuoTasksPage: View {
    let h: DuoHub
    @State private var adding = false
    @State private var showDone = false
    var body: some View {
        List {
            Button { adding = true } label: { Label("Add", systemImage: "plus.circle.fill").foregroundStyle(duoViolet) }
            DuoTaskRows(h: h, filter: .today)
            DuoTaskRows(h: h, filter: .later)
            DuoTaskRows(h: h, filter: .anytime)
            let done = h.tasks.filter(\.done).count
            if done > 0 {
                Toggle("Show done (\(done))", isOn: $showDone)
                if showDone { DuoTaskRows(h: h, filter: .done) }
            }
        }
        .navigationTitle(h.hub == "work" ? "To-dos" : "Tasks")
        .sheet(isPresented: $adding) { DuoAddTask(h: h) }
    }
}

/** A new task, typed, scribbled or dictated (the watch's own text entry), for today, tomorrow or anytime. */
struct DuoAddTask: View {
    let h: DuoHub
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var when = 0
    var body: some View {
        Form {
            TextField(h.hub == "work" ? "What do you need to do?" : "What needs doing?", text: $title)
            Picker("When", selection: $when) {
                Text("Today").tag(0)
                Text("Tomorrow").tag(1)
                Text("Anytime").tag(2)
            }
            Button("Add") {
                let t = title.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !t.isEmpty else { return }
                let id = "watch-" + UUID().uuidString.prefix(8).lowercased()
                let due = when == 2 ? "" : when == 1 ? tomorrow : h.today
                h.send(["type": "add", "title": t, "due": due, "id": id], key: "tasks") { l in
                    l.append(["id": id, "title": t, "due": due, "time": "", "done": false, "list": ""])
                }
                WKInterfaceDevice.current().play(.success)
                dismiss()
            }
            .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .navigationTitle("New")
    }
    private var tomorrow: String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: h.today), let n = Calendar.current.date(byAdding: .day, value: 1, to: d) else { return h.today }
        return f.string(from: n)
    }
}

// MARK: - Calendar, chores

struct DuoCalendarPage: View {
    let h: DuoHub
    var body: some View {
        let events = h.list("events").compactMap(DuoEvent.init)
        let days = Array(Set(events.map(\.date))).sorted()
        List {
            if events.isEmpty { Text("Nothing on the calendar this week.").font(.footnote).foregroundStyle(.secondary) }
            ForEach(days, id: \.self) { day in
                Section(duoDay(day, today: h.today)) {
                    ForEach(events.filter { $0.date == day }) { e in
                        HStack(alignment: .top, spacing: 8) {
                            RoundedRectangle(cornerRadius: 2).fill(duoViolet).frame(width: 4)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(e.title).font(.footnote).lineLimit(3)
                                Text([e.time.isEmpty ? "All day" : duoTime(e.time), e.location].filter { !$0.isEmpty }.joined(separator: " · ")).font(.caption2).foregroundStyle(.secondary).lineLimit(2)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Calendar")
    }
}

struct DuoChoresPage: View {
    let h: DuoHub
    var body: some View {
        let chores = h.list("chores").compactMap(DuoChore.init)
        List {
            if chores.isEmpty { Text("No chores today.").font(.footnote).foregroundStyle(.secondary) }
            ForEach(chores) { c in
                Button { WKInterfaceDevice.current().play(c.done ? .click : .success); h.flip("chores", id: c.id, type: "chore") } label: {
                    HStack(spacing: 8) {
                        Image(systemName: c.done ? "checkmark.square.fill" : "square").foregroundStyle(c.done ? .green : .secondary)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(c.title).font(.footnote).strikethrough(c.done).lineLimit(2)
                            let sub = [c.who.isEmpty ? "Anyone" : "\(c.emoji) \(c.who)".trimmingCharacters(in: .whitespaces), c.points > 0 ? "+\(c.points) ⭐" : ""].filter { !$0.isEmpty }.joined(separator: " · ")
                            Text(sub).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                        }
                    }
                }
            }
        }
        .navigationTitle("Chores")
    }
}

// MARK: - Grocery list

struct DuoGroceryPage: View {
    let h: DuoHub
    @State private var adding = false
    var body: some View {
        let items = h.list("groceries").compactMap(DuoGrocery.init)
        let left = items.filter { !$0.done }, got = items.filter(\.done)
        List {
            Button { adding = true } label: { Label("Add an item", systemImage: "plus.circle.fill").foregroundStyle(duoViolet) }
            Section(left.isEmpty ? "All set" : "\(left.count) to get") {
                ForEach(left) { row($0) }
            }
            if !got.isEmpty {
                Section("In the cart") {
                    ForEach(got) { row($0) }
                    Button(role: .destructive) {
                        h.send(["type": "grocery-clear"], key: "groceries") { l in l.removeAll { ($0["done"] as? Bool) == true } }
                    } label: { Label("Clear the cart", systemImage: "trash") }
                }
            }
        }
        .navigationTitle("Grocery list")
        .sheet(isPresented: $adding) { DuoAddGrocery(h: h) }
    }
    private func row(_ g: DuoGrocery) -> some View {
        Button { WKInterfaceDevice.current().play(g.done ? .click : .success); h.flip("groceries", id: g.id, type: "grocery") } label: {
            HStack(spacing: 8) {
                Image(systemName: g.done ? "checkmark.circle.fill" : "circle").foregroundStyle(g.done ? .green : .secondary)
                VStack(alignment: .leading, spacing: 1) {
                    Text(g.name).font(.footnote).strikethrough(g.done).lineLimit(2)
                    let sub = [g.qty, g.aisle].filter { !$0.isEmpty }.joined(separator: " · ")
                    if !sub.isEmpty { Text(sub).font(.caption2).foregroundStyle(.secondary).lineLimit(1) }
                }
            }
        }
    }
}

struct DuoAddGrocery: View {
    let h: DuoHub
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    var body: some View {
        Form {
            TextField("Milk, eggs, bread...", text: $name)
            Button("Add") {
                // "milk, eggs and bread" adds three.
                let names = name.replacingOccurrences(of: " and ", with: ",").split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
                for n in names.prefix(10) {
                    let id = "watch-" + UUID().uuidString.prefix(8).lowercased()
                    h.send(["type": "grocery-add", "name": n], key: "groceries") { l in l.insert(["id": id, "name": n, "qty": "", "aisle": "", "done": false], at: 0) }
                }
                WKInterfaceDevice.current().play(.success)
                dismiss()
            }
            .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .navigationTitle("Add")
    }
}

// MARK: - Habits, medicine

struct DuoHabitsPage: View {
    let h: DuoHub
    var body: some View {
        let habits = h.list("habits").compactMap(DuoHabit.init)
        List {
            if habits.isEmpty { Text("Add habits in the Habits app on your iPhone.").font(.footnote).foregroundStyle(.secondary) }
            ForEach(habits) { x in
                Button {
                    WKInterfaceDevice.current().play(x.done ? .click : .success)
                    h.send(["type": "habit", "id": x.id], key: "habits") { l in
                        if let i = l.firstIndex(where: { $0["id"] as? String == x.id }) {
                            let was = (l[i]["done"] as? Bool) ?? false
                            l[i]["done"] = !was
                            l[i]["streak"] = max(0, ((l[i]["streak"] as? NSNumber)?.intValue ?? 0) + (was ? -1 : 1))
                        }
                    }
                } label: {
                    HStack(spacing: 8) {
                        Text(x.emoji.isEmpty ? "•" : x.emoji).font(.title3).frame(width: 30, height: 30).background(Circle().fill(x.done ? Color.green.opacity(0.35) : Color.white.opacity(0.1)))
                        VStack(alignment: .leading, spacing: 1) {
                            Text(x.name).font(.footnote).lineLimit(2)
                            Text(x.done ? "Done today" + (x.streak > 1 ? " · \(x.streak) days in a row" : "") : x.streak > 0 ? "\(x.streak) days in a row" : "Not yet today").font(.caption2).foregroundStyle(x.done ? .green : .secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("Habits")
    }
}

struct DuoPillsPage: View {
    let h: DuoHub
    var body: some View {
        let doses = h.list("pills").compactMap(DuoDose.init)
        List {
            if doses.isEmpty { Text("No medicine due today.").font(.footnote).foregroundStyle(.secondary) }
            ForEach(doses) { d in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(d.name).font(.footnote.bold()).lineLimit(2)
                        Spacer(minLength: 0)
                        Text(duoTime(d.time)).font(.caption2).foregroundStyle(.secondary)
                    }
                    let sub = [d.dose, d.who].filter { !$0.isEmpty }.joined(separator: " · ")
                    if !sub.isEmpty { Text(sub).font(.caption2).foregroundStyle(.secondary) }
                    if d.status.isEmpty {
                        HStack {
                            Button("Taken") { mark(d, "taken") }.tint(.green)
                            Button("Skip") { mark(d, "skipped") }.tint(.gray)
                        }
                        .buttonStyle(.bordered).font(.caption)
                    } else {
                        Button { mark(d, nil) } label: {
                            Label(d.status == "taken" ? "Taken" : "Skipped", systemImage: d.status == "taken" ? "checkmark.circle.fill" : "minus.circle").font(.caption).foregroundStyle(d.status == "taken" ? .green : .secondary)
                        }
                        .buttonStyle(.plain)
                        .accessibilityHint("Tap to undo")
                    }
                }
            }
        }
        .navigationTitle("Medicine")
    }
    private func mark(_ d: DuoDose, _ status: String?) {
        WKInterfaceDevice.current().play(status == "taken" ? .success : .click)
        h.send(["type": "pill", "pillId": d.pillId, "time": d.time, "status": status ?? ""], key: "pills") { l in
            if let i = l.firstIndex(where: { $0["pillId"] as? String == d.pillId && $0["time"] as? String == d.time }) { l[i]["status"] = status ?? "" }
        }
    }
}

// MARK: - Money and bills

struct DuoMoneyPage: View {
    let h: DuoHub
    @State private var paying: DuoBill?
    var body: some View {
        let m = h.part["money"] as? [String: Any] ?? [:]
        let amount = (m["amount"] as? NSNumber)?.doubleValue ?? 0
        let spent = (m["spent"] as? NSNumber)?.doubleValue ?? 0, budgeted = (m["budgeted"] as? NSNumber)?.doubleValue ?? 0
        let until = m["until"] as? String ?? ""
        let bills = h.list("bills").compactMap(DuoBill.init)
        List {
            VStack(alignment: .leading, spacing: 3) {
                Text((m["label"] as? String ?? "Left this month") + (until.isEmpty ? "" : " until \(duoDay(until, today: h.today))")).font(.caption2).foregroundStyle(.secondary)
                Text(duoMoney(amount)).font(.title3.bold()).foregroundStyle(amount < 0 ? .red : .primary).minimumScaleFactor(0.6)
                if budgeted > 0 {
                    ProgressView(value: min(1, spent / budgeted)).tint(spent > budgeted ? .red : duoViolet)
                    Text("\(duoMoney(spent)) of \(duoMoney(budgeted)) spent").font(.caption2).foregroundStyle(.secondary)
                }
            }
            .listRowBackground(Color.clear)
            Section("Bills") {
                if bills.isEmpty { Text("No bills this month.").font(.footnote).foregroundStyle(.secondary) }
                ForEach(bills) { b in
                    Button { if b.left > 0 { paying = b } } label: {
                        HStack(spacing: 8) {
                            Image(systemName: b.left <= 0 ? "checkmark.circle.fill" : b.state == "late" ? "exclamationmark.circle.fill" : "circle").foregroundStyle(b.left <= 0 ? .green : b.state == "late" ? .red : .secondary)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(b.name).font(.footnote).lineLimit(1)
                                Text(b.left <= 0 ? "Paid" : [b.state == "late" ? "Past due" : b.due.isEmpty ? "" : "Due " + duoDay(b.due, today: h.today), b.autopay ? "Autopay" : ""].filter { !$0.isEmpty }.joined(separator: " · ")).font(.caption2).foregroundStyle(b.state == "late" && b.left > 0 ? .red : .secondary)
                            }
                            Spacer(minLength: 0)
                            Text(duoMoney(b.left > 0 ? b.left : b.owed)).font(.caption.monospacedDigit())
                        }
                    }
                }
            }
        }
        .navigationTitle("Money")
        .confirmationDialog(paying.map { "Mark \($0.name) paid (\(duoMoney($0.left)))?" } ?? "", isPresented: Binding(get: { paying != nil }, set: { if !$0 { paying = nil } }), titleVisibility: .visible) {
            Button("Mark paid") {
                if let b = paying {
                    WKInterfaceDevice.current().play(.success)
                    h.send(["type": "bill", "id": b.id], key: "bills") { l in if let i = l.firstIndex(where: { $0["id"] as? String == b.id }) { l[i]["left"] = 0; l[i]["state"] = "paid" } }
                }
                paying = nil
            }
            Button("Cancel", role: .cancel) { paying = nil }
        }
    }
}

// MARK: - Meals, countdowns, notes

struct DuoMealsPage: View {
    let h: DuoHub
    var body: some View {
        let meals = h.list("meals").compactMap(DuoMeal.init)
        List {
            if meals.isEmpty { Text("Nothing planned for today. Plan meals in the Kitchen app on your iPhone.").font(.footnote).foregroundStyle(.secondary) }
            ForEach(meals) { m in
                Section(m.slot) { ForEach(m.dishes, id: \.self) { Text($0).font(.footnote) } }
            }
        }
        .navigationTitle("Meals")
    }
}

struct DuoCountdownsPage: View {
    let h: DuoHub
    var body: some View {
        let items = h.list("countdowns").compactMap(DuoCountdown.init)
        List {
            if items.isEmpty { Text("No countdowns coming up.").font(.footnote).foregroundStyle(.secondary) }
            ForEach(items) { c in
                HStack(spacing: 8) {
                    Text(c.emoji.isEmpty ? "⏳" : c.emoji).font(.title3)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(c.title).font(.footnote).lineLimit(2)
                        Text(duoDay(c.date, today: h.today)).font(.caption2).foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                    Text(c.days == 0 ? "Today" : "\(c.days)d").font(.footnote.bold()).foregroundStyle(duoViolet)
                }
            }
        }
        .navigationTitle("Countdowns")
    }
}

struct DuoNotesPage: View {
    let h: DuoHub
    var body: some View {
        let notes = h.list("notes").compactMap(DuoNote.init)
        List {
            if notes.isEmpty { Text("No notes yet.").font(.footnote).foregroundStyle(.secondary) }
            ForEach(notes) { n in
                NavigationLink {
                    ScrollView { VStack(alignment: .leading, spacing: 6) { Text(n.title).font(.headline); Text(n.text.isEmpty ? "Open it on your iPhone to read it all." : n.text).font(.footnote) }.frame(maxWidth: .infinity, alignment: .leading) }
                        .navigationTitle("Note")
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(n.title).font(.footnote.bold()).lineLimit(2)
                        if !n.text.isEmpty { Text(n.text).font(.caption2).foregroundStyle(.secondary).lineLimit(2) }
                    }
                }
            }
        }
        .navigationTitle("Notes")
    }
}
