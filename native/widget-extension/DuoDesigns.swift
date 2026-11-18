
// MARK: - Arise To Duo: the task widgets (40 designs)
// Added to AriseWidgets.swift by .github/scripts/add_widget.rb when the app's widget list has an id ending in
// ".designs" (arisetodo/ios-app/widgets.json). Forty widgets in the gallery: ten Small, ten Medium, ten Large and
// ten for the Lock Screen, each design its own widget so all of them show. They all draw one "board" the app
// sends (client/src/lib/duoBoard.ts): the counts, the tasks that matter now, this week and this month, plus the
// focus timer when one is running. Done checks a task off right on the widget (CheckOffIntent) and Later moves it
// to tomorrow (DuoLaterIntent); the app saves both when it next opens. Add, Tasks and Focus open the app.

struct DuoTaskItem: Codable, Hashable {
    var id: String = ""
    var title: String = ""
    var label: String = ""
    var late: Bool = false
    var done: Bool = false
    var today: Bool = false
    var list: String = ""
    /** "work" or "life": which hub the task is from (where its Done and Later taps go). */
    var hub: String? = nil
}

struct DuoDay: Codable, Hashable {
    var label: String = ""
    var day: String = ""
    var count: Int = 0
    var today: Bool = false
    var late: Bool = false
    var titles: [String] = []
}

struct DuoList: Codable, Hashable {
    var name: String = ""
    var color: String = "#7c6cf0"
    var count: Int = 0
}

struct DuoFocusNow: Codable, Hashable {
    var id: String = ""
    var title: String = ""
    var startedAt: Double = 0
    var endsAt: Double = 0
}

struct DuoBoard: Decodable {
    var date = "", weekday = "", month = ""
    var open = 0, today = 0, todayDone = 0, overdue = 0, upcoming = 0, done = 0, asks = 0
    var tasks: [DuoTaskItem] = []
    var week: [DuoDay] = []
    var lists: [DuoList] = []
    var monthFirst = 0, monthDays = 30, monthToday = 1
    var dots: [Int] = []
    var focus: DuoFocusNow? = nil
    /// "work" or "life": the hub the widget opens (with Show set to both, the hub of what's next).
    var hub = "life"

    enum CodingKeys: String, CodingKey {
        case date, weekday, month, open, today, todayDone, overdue, upcoming, done, asks, tasks, week, lists, monthFirst, monthDays, monthToday, dots
    }

    init() {}
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        func v<T: Decodable>(_ k: CodingKeys, _ fallback: T) -> T { (try? c.decodeIfPresent(T.self, forKey: k)) ?? fallback }
        date = v(.date, ""); weekday = v(.weekday, ""); month = v(.month, "")
        open = v(.open, 0); today = v(.today, 0); todayDone = v(.todayDone, 0); overdue = v(.overdue, 0)
        upcoming = v(.upcoming, 0); done = v(.done, 0); asks = v(.asks, 0)
        tasks = v(.tasks, [DuoTaskItem]()); week = v(.week, [DuoDay]()); lists = v(.lists, [DuoList]())
        monthFirst = v(.monthFirst, 0); monthDays = v(.monthDays, 30); monthToday = v(.monthToday, 1); dots = v(.dots, [Int]())
    }

    var openTasks: [DuoTaskItem] { tasks.filter { !$0.done } }
    var lateTasks: [DuoTaskItem] { tasks.filter { $0.late && !$0.done } }
    var todayTasks: [DuoTaskItem] { tasks.filter { $0.today } }
    /// What to do next: the first of today's (on time), else whatever is first.
    var next: DuoTaskItem? { tasks.first { $0.today && !$0.done && !$0.late } ?? openTasks.first }
    var todayLeft: Int { max(0, today - todayDone) }
    var todayProgress: Double { today > 0 ? Double(todayDone) / Double(today) : 0 }
    var doneShare: Double { open + done > 0 ? Double(done) / Double(open + done) : 0 }
    var hasFocus: Bool { (focus?.endsAt ?? 0) / 1000 > Date().timeIntervalSince1970 }

    /// The gallery (before the app has sent anything) shows what a widget looks like with tasks in it.
    static var sample: DuoBoard {
        var b = DuoBoard()
        b.date = "Tuesday, Nov 17"; b.weekday = "Tuesday"; b.month = "November"
        b.open = 22; b.today = 3; b.todayDone = 1; b.overdue = 2; b.upcoming = 4; b.done = 36; b.asks = 1
        b.tasks = [
            DuoTaskItem(id: "s1", title: "Send the opt-out form home", label: "Yesterday", late: true, list: "Everything"),
            DuoTaskItem(id: "s2", title: "Email the team the meeting recap", label: "Monday", late: true, list: "Everything"),
            DuoTaskItem(id: "s3", title: "Print Friday's test", label: "3:00 PM", today: true, list: "Routines"),
            DuoTaskItem(id: "s4", title: "Get the poems approved", label: "Done", done: true, today: true, list: "Everything"),
            DuoTaskItem(id: "s5", title: "Grade the quizzes", label: "Wednesday", list: "Everything"),
        ]
        b.week = [
            DuoDay(label: "Mon", day: "16", count: 2, late: true, titles: ["Opt-out form", "Meeting recap"]),
            DuoDay(label: "Tue", day: "17", count: 2, today: true, titles: ["Print Friday's test"]),
            DuoDay(label: "Wed", day: "18", count: 2, titles: ["Grade the quizzes"]),
            DuoDay(label: "Thu", day: "19", count: 1, titles: ["Parent call"]),
            DuoDay(label: "Fri", day: "20", count: 1, titles: ["Spelling test"]),
        ]
        b.lists = [DuoList(name: "Everything", color: "#7c3aed", count: 22), DuoList(name: "Routines", color: "#f07a3b", count: 4)]
        b.monthFirst = 0; b.monthDays = 30; b.monthToday = 17; b.dots = [16, 18, 19, 20]
        b.focus = DuoFocusNow(id: "s3", title: "Print Friday's test", startedAt: Date().addingTimeInterval(-600).timeIntervalSince1970 * 1000, endsAt: Date().addingTimeInterval(888).timeIntervalSince1970 * 1000)
        return b
    }
}

/// Where a widget's tasks come from: WorkHub, LifeHub or both (the widget's Show choice, in Edit Widget).
enum DuoShow: String, AppEnum {
    case both, work, life
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Show"
    static var caseDisplayRepresentations: [DuoShow: DisplayRepresentation] = [.both: "Work and Life", .work: "Work (WorkHub)", .life: "Life (LifeHub)"]
}

/// The slot a task's Done and Later taps come back under (the app's hub that owns it reads them).
func duoTapSlot(_ t: DuoTaskItem) -> String { t.hub == "work" ? "duo.worktodos" : "duo.todos" }

/// One hub's board as the app last sent it, with taps on the widget (checked off, moved to tomorrow) applied.
private func loadOneBoard(_ all: [String: Any], _ key: String, _ tapSlot: String, _ pending: [[String: Any]]) -> DuoBoard? {
    guard let slot = all[key] as? [String: Any], let raw = slot["board"],
          let d = try? JSONSerialization.data(withJSONObject: raw), var b = try? JSONDecoder().decode(DuoBoard.self, from: d) else { return nil }
    var checked = Set<String>(), later = Set<String>()
    for p in pending where (p["id"] as? String) == tapSlot {
        guard let item = p["item"] as? String else { continue }
        if (p["action"] as? String) == "later" { later.insert(item) } else if (p["action"] as? String) == "check" { checked.insert(item) }
    }
    for i in b.tasks.indices where checked.contains(b.tasks[i].id) && !b.tasks[i].done {
        if b.tasks[i].late { b.overdue = max(0, b.overdue - 1) }
        if b.tasks[i].today { b.todayDone += 1 }
        b.open = max(0, b.open - 1); b.done += 1
        b.tasks[i].done = true; b.tasks[i].late = false; b.tasks[i].label = "Done"
    }
    for t in b.tasks where later.contains(t.id) && !t.done {
        if t.late { b.overdue = max(0, b.overdue - 1) }
        if t.today { b.today = max(0, b.today - 1) }
        b.upcoming += 1
    }
    b.tasks.removeAll { later.contains($0.id) && !$0.done }
    return b
}

/// Work and Life together: counts added up, the tasks that matter now first, the week and month combined.
func mergeBoards(_ a: DuoBoard, _ b: DuoBoard) -> DuoBoard {
    var m = a.date.isEmpty ? b : a
    m.open = a.open + b.open; m.today = a.today + b.today; m.todayDone = a.todayDone + b.todayDone
    m.overdue = a.overdue + b.overdue; m.upcoming = a.upcoming + b.upcoming; m.done = a.done + b.done; m.asks = a.asks + b.asks
    func rank(_ t: DuoTaskItem) -> Int { t.late ? 0 : t.today && !t.done ? 1 : t.today ? 2 : 3 }
    m.tasks = Array((a.tasks + b.tasks).enumerated().sorted { rank($0.element) != rank($1.element) ? rank($0.element) < rank($1.element) : $0.offset < $1.offset }.map { $0.element }.prefix(10))
    if a.week.count == b.week.count, !a.week.isEmpty {
        m.week = zip(a.week, b.week).map { x, y in DuoDay(label: x.label, day: x.day, count: x.count + y.count, today: x.today || y.today, late: x.late || y.late, titles: Array((x.titles + y.titles).prefix(3))) }
    } else if m.week.isEmpty { m.week = b.week }
    m.lists = Array((a.lists + b.lists).prefix(4))
    m.dots = Array(Set(a.dots + b.dots)).sorted()
    return m
}

func loadDuoBoard(_ show: DuoShow = .both) -> DuoBoard {
    let defaults = UserDefaults(suiteName: group())
    guard let data = defaults?.data(forKey: "slots"),
          let all = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return DuoBoard() }
    let pending = (defaults?.array(forKey: "pending") as? [[String: Any]]) ?? []
    let life = show == .work ? nil : loadOneBoard(all, "duo.board", "duo.todos", pending)
    let work = show == .life ? nil : loadOneBoard(all, "duo.board.work", "duo.worktodos", pending)
    var b: DuoBoard
    switch (life, work) {
    case let (l?, w?): b = mergeBoards(w, l)
    case let (l?, nil): b = l
    case let (nil, w?): b = w
    default: b = DuoBoard()
    }
    if let slot = all["duo.focusnow"] as? [String: Any], let raw = slot["focus"] as? [String: Any],
       let d = try? JSONSerialization.data(withJSONObject: raw), let f = try? JSONDecoder().decode(DuoFocusNow.self, from: d),
       f.endsAt / 1000 > Date().timeIntervalSince1970 { b.focus = f }
    b.hub = show == .work ? "work" : show == .life ? "life" : (b.next?.hub ?? (work != nil && life == nil ? "work" : "life"))
    return b
}

/// "Later" on a widget: the task moves to tomorrow (the app saves it when it next opens).
struct DuoLaterIntent: AppIntent {
    static var title: LocalizedStringResource = "Later"
    static var description = IntentDescription("Moves a task to tomorrow from an Arise To Duo widget.")
    static var isDiscoverable: Bool = false
    @Parameter(title: "Task") var item: String
    @Parameter(title: "Widget") var slot: String
    init() {}
    init(item: String, slot: String = "duo.todos") { self.item = item; self.slot = slot }
    func perform() async throws -> some IntentResult {
        guard let defaults = UserDefaults(suiteName: group()) else { return .result() }
        var pending = (defaults.array(forKey: "pending") as? [[String: Any]]) ?? []
        pending.append(["id": slot, "action": "later", "item": item, "amount": 0, "at": Date().timeIntervalSince1970 * 1000])
        defaults.set(Array(pending.suffix(200)), forKey: "pending")
        return .result()
    }
}

// MARK: Designs to pick from

enum DuoSmallStyle: String, AppEnum, CaseIterable {
    case ring, next, overdue, focus, checklist, big, asks, week, actions, done
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Design"
    static var caseDisplayRepresentations: [DuoSmallStyle: DisplayRepresentation] = [
        .ring: "1 · Progress ring", .next: "2 · Up next", .overdue: "3 · Overdue alert", .focus: "4 · Focus timer", .checklist: "5 · Checklist",
        .big: "6 · Big number", .asks: "7 · Arise asks", .week: "8 · Week dots", .actions: "9 · Quick actions", .done: "10 · Done so far",
    ]
}
enum DuoMediumStyle: String, AppEnum, CaseIterable {
    case ringList, nextButtons, weekStrip, columns, focus, counts, briefing, timeline, editorial, quickAdd
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Design"
    static var caseDisplayRepresentations: [DuoMediumStyle: DisplayRepresentation] = [
        .ringList: "1 · Ring and today's list", .nextButtons: "2 · Up next with buttons", .weekStrip: "3 · Week strip", .columns: "4 · Two columns",
        .focus: "5 · Focus with buttons", .counts: "6 · List counts", .briefing: "7 · Arise briefing", .timeline: "8 · Timeline",
        .editorial: "9 · Editorial", .quickAdd: "10 · Quick add",
    ]
}
enum DuoLargeStyle: String, AppEnum, CaseIterable {
    case checklist, weekGrid, oneAtATime, board, calendar, notebook, punch, tiles, briefing, grouped
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Design"
    static var caseDisplayRepresentations: [DuoLargeStyle: DisplayRepresentation] = [
        .checklist: "1 · Full checklist", .weekGrid: "2 · Week grid", .oneAtATime: "3 · One at a time", .board: "4 · Board columns",
        .calendar: "5 · Month calendar", .notebook: "6 · Notebook", .punch: "7 · Punch", .tiles: "8 · Big tiles",
        .briefing: "9 · Arise briefing", .grouped: "10 · Grouped lists",
    ]
}
enum DuoLockStyle: String, AppEnum, CaseIterable {
    case next, overdue, gauge, open, focus, line, week, badge, asks, progress
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Design"
    static var caseDisplayRepresentations: [DuoLockStyle: DisplayRepresentation] = [
        .next: "1 · Next task", .overdue: "2 · Overdue", .gauge: "3 · Today gauge (circle)", .open: "4 · Open count (circle)",
        .focus: "5 · Focus timer", .line: "6 · One line (above the clock)", .week: "7 · Week dots", .badge: "8 · Overdue badge (circle)",
        .asks: "9 · Arise asks", .progress: "10 · Progress bar",
    ]
}

// MARK: Pieces

func dc(_ hex: String) -> Color { RGB(hex).color }
let duoAddLink = URL(string: "arisetodo://focus/add")!
let duoTasksLink = URL(string: "arisetodo://focus/tasks")!
let duoOpenLink = URL(string: "arisetodo://focus/open")!

/// Where a tap on a widget lands in the app: arisetodo://focus/go?hub=work&to=calendar (client/src/lib/duoFocus.ts
/// readFocusLink, then the hub's "?go=" handler). `to` is tasks, calendar, asks or add; `task` opens that task.
func duoGoURL(_ hub: String, _ to: String, view: String = "", task: String = "") -> URL {
    var c = URLComponents(); c.scheme = "arisetodo"; c.host = "focus"; c.path = "/go"
    c.queryItems = [URLQueryItem(name: "hub", value: hub == "work" ? "work" : "life"), URLQueryItem(name: "to", value: to)]
        + (view.isEmpty ? [] : [URLQueryItem(name: "view", value: view)]) + (task.isEmpty ? [] : [URLQueryItem(name: "task", value: task)])
    return c.url ?? duoOpenLink
}
/// A task's own link: opens it, in the hub it's from.
func duoTaskURL(_ t: DuoTaskItem, _ fallbackHub: String = "life") -> URL { duoGoURL(t.hub ?? fallbackHub, "tasks", task: t.id) }

extension DuoBoard {
    func go(_ to: String, view: String = "") -> URL { duoGoURL(hub, to, view: view) }
    /// The task the widget is about (next up), or the hub's Today list when there's none.
    var goNext: URL { next.map { duoTaskURL($0, hub) } ?? go("tasks", view: "today") }
    /// The task being focused on, else next up.
    var goFocus: URL { hasFocus && !(focus?.id ?? "").isEmpty ? duoGoURL(tasks.first { $0.id == focus?.id }?.hub ?? hub, "tasks", task: focus!.id) : goNext }
    var goAsks: URL { asks > 0 ? go("asks") : go("tasks", view: "today") }
}

extension Text {
    func duo(_ size: CGFloat, _ weight: Font.Weight = .regular, _ color: Color, _ design: Font.Design = .default) -> some View {
        self.font(.system(size: size, weight: weight, design: design)).foregroundStyle(color)
    }
}

/// A ring that fills as the day's tasks get done.
struct DuoRing: View {
    let progress: Double
    let line: CGFloat
    let track: Color
    let fill: Color
    var body: some View {
        ZStack {
            Circle().stroke(track, lineWidth: line)
            Circle().trim(from: 0, to: max(0.001, min(1, progress))).stroke(fill, style: StrokeStyle(lineWidth: line, lineCap: .round)).rotationEffect(.degrees(-90))
        }
    }
}

/// A circle that checks a task off right on the widget.
struct DuoCheck: View {
    let task: DuoTaskItem
    let color: Color
    var size: CGFloat = 18
    var square: Bool = false
    var body: some View {
        Button(intent: CheckOffIntent(slot: duoTapSlot(task), item: task.id)) {
            ZStack {
                if square { RoundedRectangle(cornerRadius: 3).stroke(color, lineWidth: 2) } else { Circle().stroke(color, lineWidth: 2) }
                if task.done { Image(systemName: "checkmark").font(.system(size: size * 0.55, weight: .heavy)).foregroundStyle(color) }
            }
            .frame(width: size, height: size)
        }
        .buttonStyle(.plain)
        .disabled(task.done)
    }
}

/// A check-off row: circle, title, and when it's due.
struct DuoRow: View {
    let task: DuoTaskItem
    let ink: Color
    let muted: Color
    let late: Color
    var size: CGFloat = 13
    var showLabel = true
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            DuoCheck(task: task, color: task.late ? late : muted, size: size + 3)
            // The title opens that task in the app (on the medium and large widgets; a small one opens as a whole).
            Link(destination: duoTaskURL(task)) {
                HStack(spacing: 0) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(verbatim: task.title).duo(size, .semibold, task.done ? muted : ink).strikethrough(task.done).lineLimit(1)
                        if showLabel { Text(verbatim: task.label).duo(size - 2, .medium, task.late ? late : muted).lineLimit(1) }
                    }
                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
        }
    }
}

/// A pill-shaped button: an intent (check off, later) or a link that opens the app.
struct DuoPill: View {
    let label: String
    let bg: Color
    let fg: Color
    var intent: (any AppIntent)? = nil
    var url: URL? = nil
    var height: CGFloat = 36
    var body: some View {
        let face = Text(verbatim: label).duo(13, .heavy, fg).frame(maxWidth: .infinity, minHeight: height).background(Capsule().fill(bg))
        if let intent {
            Button(intent: intent) { face }.buttonStyle(.plain)
        } else {
            Link(destination: url ?? duoOpenLink) { face }
        }
    }
}

/// A focus clock that ticks by itself.
struct DuoClock: View {
    let focus: DuoFocusNow?
    let size: CGFloat
    let color: Color
    var body: some View {
        Group {
            if let f = focus, f.endsAt / 1000 > Date().timeIntervalSince1970 {
                Text(timerInterval: focusRange(Date(timeIntervalSince1970: f.startedAt / 1000), Date(timeIntervalSince1970: f.endsAt / 1000)), countsDown: true)
            } else {
                Text(verbatim: "Start")
            }
        }
        .font(.system(size: size, weight: .bold, design: .monospaced))
        .monospacedDigit()
        .foregroundStyle(color)
        .lineLimit(1)
        .minimumScaleFactor(0.5)
    }
}

struct DuoFocusBar: View {
    let focus: DuoFocusNow?
    let track: Color
    let fill: Color
    var body: some View {
        if let f = focus, f.endsAt / 1000 > Date().timeIntervalSince1970 {
            ProgressView(timerInterval: focusRange(Date(timeIntervalSince1970: f.startedAt / 1000), Date(timeIntervalSince1970: f.endsAt / 1000)), countsDown: false) { EmptyView() } currentValueLabel: { EmptyView() }
                .progressViewStyle(.linear).tint(fill)
        } else {
            Capsule().fill(track).frame(height: 5)
        }
    }
}

private func plural(_ n: Int, _ one: String, _ many: String? = nil) -> String { "\(n) \(n == 1 ? one : (many ?? one + "s"))" }

// MARK: Small (170 × 170)

struct DuoSmallView: View {
    let style: DuoSmallStyle
    let b: DuoBoard

    static func background(_ s: DuoSmallStyle) -> Color {
        switch s {
        case .ring, .checklist, .actions: return .white
        case .next: return dc("#5b47d6")
        case .overdue: return dc("#fff1ee")
        case .focus: return dc("#0b0d12")
        case .big: return dc("#f2e14b")
        case .asks: return dc("#f3f0ff")
        case .week: return dc("#10213a")
        case .done: return dc("#0b6e4f")
        }
    }

    var body: some View {
        Group {
            switch style {
            case .ring: ring
            case .next: next
            case .overdue: overdue
            case .focus: focus
            case .checklist: checklist
            case .big: big
            case .asks: asks
            case .week: week
            case .actions: actions
            case .done: doneSoFar
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(target)
    }

    /// Where a tap on the widget (outside its buttons) opens the app.
    var target: URL {
        switch style {
        case .ring: return b.go("tasks", view: "today")
        case .next: return b.goNext
        case .overdue: return b.lateTasks.first.map { duoTaskURL($0, b.hub) } ?? b.go("tasks", view: "today")
        case .focus: return b.goFocus
        case .checklist: return b.go("tasks", view: "today")
        case .big: return b.go("tasks", view: "all")
        case .asks: return b.goAsks
        case .week: return b.go("calendar")
        case .actions: return b.go("tasks", view: "today")
        case .done: return b.go("tasks", view: "all")
        }
    }

    var ring: some View {
        VStack(alignment: .leading) {
            ZStack {
                DuoRing(progress: b.todayProgress, line: 8, track: dc("#ece9fb"), fill: dc("#5b47d6"))
                Text(verbatim: "\(b.todayDone)/\(b.today)").duo(15, .bold, dc("#17151f"), .rounded)
            }
            .frame(width: 62, height: 62)
            Spacer(minLength: 0)
            Text(verbatim: b.today == 0 ? "Nothing due today" : "\(b.todayLeft) left today").duo(15, .bold, dc("#17151f"))
            if let n = b.next { Text(verbatim: "Next: " + n.title).duo(12, .regular, dc("#5f5b6e")).lineLimit(1) }
        }
        .padding(16)
    }

    var next: some View {
        VStack(alignment: .leading) {
            Text(verbatim: "UP NEXT" + (b.next.map { $0.today ? " · " + $0.label.uppercased() : "" } ?? "")).duo(11, .heavy, dc("#dcd6ff")).lineLimit(1)
            Spacer(minLength: 0)
            Text(verbatim: b.next?.title ?? "All clear").duo(21, .bold, .white, .rounded).lineLimit(3).minimumScaleFactor(0.8)
            Spacer(minLength: 0)
            Text(verbatim: b.todayLeft > 1 ? "+\(b.todayLeft - 1) more today" : b.open > 0 ? plural(b.open, "open task") : "Add one from the app").duo(12, .regular, dc("#dcd6ff"))
        }
        .padding(16)
    }

    var overdue: some View {
        let late = dc("#b42318")
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "clock").font(.system(size: 13, weight: .heavy))
                Text(verbatim: b.overdue == 0 ? "Nothing overdue" : "\(b.overdue) overdue").font(.system(size: 13, weight: .heavy))
            }
            .foregroundStyle(late)
            ForEach(Array(b.lateTasks.prefix(2).enumerated()), id: \.offset) { i, t in
                if i > 0 { Rectangle().fill(dc("#f5cfc6")).frame(height: 1) }
                Text(verbatim: t.title).duo(13, .semibold, dc("#3d0a04")).lineLimit(2)
            }
            if b.overdue == 0 { Text(verbatim: "You're caught up.").duo(13, .semibold, dc("#3d0a04")) }
        }
        .padding(16)
    }

    var focus: some View {
        VStack(alignment: .leading) {
            Text(verbatim: "FOCUS").duo(11, .heavy, dc("#67e8f9")).tracking(1.2)
            Spacer(minLength: 0)
            DuoClock(focus: b.focus, size: 38, color: .white)
            Spacer(minLength: 0)
            Text(verbatim: b.focus?.title ?? b.next?.title ?? "Pick a task").duo(12, .regular, dc("#b8becc")).lineLimit(1)
            DuoFocusBar(focus: b.focus, track: dc("#262b36"), fill: dc("#67e8f9")).padding(.top, 6)
        }
        .padding(16)
    }

    var checklist: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack { Text(verbatim: "Today").duo(13, .heavy, dc("#4f46e5")); Spacer(); Text(verbatim: "\(b.lateTasks.count + b.todayLeft)").duo(13, .heavy, dc("#5b6170")) }
            ForEach(Array(b.tasks.filter { $0.late || ($0.today && !$0.done) }.prefix(3).enumerated()), id: \.offset) { _, t in
                DuoRow(task: t, ink: dc("#14161a"), muted: dc("#8a8f9c"), late: dc("#b42318"), size: 12, showLabel: false)
            }
            if b.lateTasks.isEmpty && b.todayLeft == 0 { Text(verbatim: "All done for today").duo(12, .medium, dc("#5b6170")) }
        }
        .padding(14)
    }

    var big: some View {
        VStack(alignment: .leading) {
            Text(verbatim: "OPEN TASKS").duo(12, .heavy, dc("#111111")).tracking(0.8)
            Spacer(minLength: 0)
            Text(verbatim: "\(b.open)").duo(80, .bold, dc("#111111"), .rounded).minimumScaleFactor(0.5).lineLimit(1)
            Spacer(minLength: 0)
            Text(verbatim: "\(b.overdue) overdue · \(b.today) today").duo(13, .bold, dc("#111111"))
        }
        .padding(16)
    }

    var asks: some View {
        VStack(alignment: .leading) {
            Image(systemName: "sparkles").font(.system(size: 17, weight: .bold)).foregroundStyle(.white)
                .frame(width: 34, height: 34).background(Circle().fill(dc("#6d28d9")))
            Spacer(minLength: 0)
            Text(verbatim: "Arise asks").duo(15, .heavy, dc("#1c1830"))
            Text(verbatim: b.asks > 0 ? "\(plural(b.asks, "question")) about tasks you added. Tap to answer." : "Ask Arise anything about your day.").duo(12, .regular, dc("#5a5470")).lineLimit(3)
        }
        .padding(16)
    }

    var week: some View {
        VStack(alignment: .leading) {
            Text(verbatim: "This week").duo(13, .bold, dc("#eaf1ff"))
            Spacer(minLength: 0)
            HStack(spacing: 4) {
                ForEach(Array(b.week.enumerated()), id: \.offset) { _, d in
                    VStack(spacing: 6) {
                        Text(verbatim: String(d.label.prefix(1))).duo(11, d.today ? .heavy : .medium, d.today ? .white : dc("#9fb0cc"))
                        if d.today {
                            Text(verbatim: "\(d.count)").duo(11, .heavy, .white).frame(width: 20, height: 20).background(Circle().fill(dc("#4c8dff")))
                        } else {
                            Circle().fill(d.count == 0 ? Color.clear : d.late ? dc("#ff8a7a") : dc("#4c8dff")).frame(width: 6, height: 6).frame(height: 20)
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            Spacer(minLength: 0)
            Text(verbatim: "\(b.upcoming) more coming up").duo(12, .regular, dc("#9fb0cc"))
        }
        .padding(16)
    }

    var actions: some View {
        let tile = { (label: String, symbol: String, bg: Color, fg: Color, url: URL) -> AnyView in
            AnyView(Link(destination: url) {
                VStack(alignment: .leading) {
                    Image(systemName: symbol).font(.system(size: 17, weight: .bold))
                    Spacer(minLength: 0)
                    Text(verbatim: label).font(.system(size: 12, weight: .bold))
                }
                .foregroundStyle(fg).padding(10).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(bg))
            })
        }
        return VStack(spacing: 8) {
            HStack(spacing: 8) {
                tile("Add task", "plus", dc("#5b47d6"), .white, b.go("add"))
                tile("Ask Arise", "bubble.left", dc("#f3f0ff"), dc("#4b2bb8"), b.go("asks"))
            }
            HStack(spacing: 8) {
                tile("Focus", "timer", dc("#0b0d12"), dc("#67e8f9"), b.goFocus)
                tile("Tasks", "checklist", dc("#fff1ee"), dc("#b42318"), b.go("tasks", view: "today"))
            }
        }
        .padding(10)
    }

    var doneSoFar: some View {
        VStack(alignment: .leading) {
            Image(systemName: "checkmark").font(.system(size: 20, weight: .heavy)).foregroundStyle(dc("#b9f5d8"))
            Spacer(minLength: 0)
            Text(verbatim: "\(b.done)").duo(44, .bold, .white, .rounded).lineLimit(1).minimumScaleFactor(0.6)
            Text(verbatim: "done · \(b.open) to go").duo(13, .semibold, dc("#cdebdd"))
            ProgressView(value: b.doneShare).progressViewStyle(.linear).tint(dc("#b9f5d8")).padding(.top, 6)
        }
        .padding(16)
    }
}

// MARK: Medium (364 × 170)

struct DuoMediumView: View {
    let style: DuoMediumStyle
    let b: DuoBoard

    static func background(_ s: DuoMediumStyle) -> Color {
        switch s {
        case .ringList, .editorial, .quickAdd: return .white
        case .nextButtons: return dc("#5b47d6")
        case .weekStrip: return dc("#f7f8f7")
        case .columns: return dc("#eef1f6")
        case .focus: return dc("#0b0d12")
        case .counts: return dc("#f4f4f8")
        case .briefing: return dc("#faf9fc")
        case .timeline: return dc("#0e1116")
        }
    }

    var body: some View {
        Group {
            switch style {
            case .ringList: ringList
            case .nextButtons: nextButtons
            case .weekStrip: weekStrip
            case .columns: columns
            case .focus: focus
            case .counts: counts
            case .briefing: briefing
            case .timeline: timeline
            case .editorial: editorial
            case .quickAdd: quickAdd
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(target)
    }

    /// Where a tap on the widget (outside its buttons) opens the app.
    var target: URL {
        switch style {
        case .ringList: return b.go("tasks", view: "today")
        case .nextButtons: return b.goNext
        case .weekStrip: return b.go("calendar")
        case .columns: return b.go("tasks", view: "today")
        case .focus: return b.goFocus
        case .counts: return b.go("tasks", view: "all")
        case .briefing: return b.goAsks
        case .timeline: return b.go("tasks", view: "today")
        case .editorial: return b.goNext
        case .quickAdd: return b.go("tasks", view: "today")
        }
    }

    var focusList: [DuoTaskItem] { Array(b.tasks.filter { $0.late || $0.today }.prefix(3)) }

    var ringList: some View {
        HStack(spacing: 16) {
            VStack(spacing: 6) {
                ZStack {
                    DuoRing(progress: b.todayProgress, line: 10, track: dc("#ece9fb"), fill: dc("#5b47d6"))
                    Text(verbatim: "\(b.todayDone)/\(b.today)").duo(18, .bold, dc("#17151f"), .rounded)
                }
                .frame(width: 80, height: 80)
                Text(verbatim: b.date.split(separator: ",").last.map { String($0).trimmingCharacters(in: .whitespaces) } ?? "").duo(12, .bold, dc("#5f5b6e")).lineLimit(1)
            }
            .frame(width: 96)
            VStack(alignment: .leading, spacing: 10) {
                ForEach(Array(focusList.enumerated()), id: \.offset) { _, t in
                    DuoRow(task: t, ink: dc("#17151f"), muted: dc("#8a8f9c"), late: dc("#b42318"), size: 13, showLabel: false)
                }
                if focusList.isEmpty { Text(verbatim: "Nothing due today").duo(13, .semibold, dc("#5f5b6e")) }
            }
        }
        .padding(16)
    }

    var nextButtons: some View {
        VStack(alignment: .leading) {
            HStack { Text(verbatim: "UP NEXT").duo(12, .heavy, dc("#dcd6ff")); Spacer(); Text(verbatim: (b.next?.label ?? "").uppercased()).duo(12, .heavy, dc("#dcd6ff")) }
            Spacer(minLength: 0)
            Text(verbatim: b.next?.title ?? "All clear").duo(24, .bold, .white, .rounded).lineLimit(2).minimumScaleFactor(0.8)
            Spacer(minLength: 0)
            if let n = b.next {
                HStack(spacing: 8) {
                    DuoPill(label: "Done", bg: .white, fg: dc("#3b28b0"), intent: CheckOffIntent(slot: duoTapSlot(n), item: n.id))
                    DuoPill(label: "Tomorrow", bg: dc("#6e5be3"), fg: .white, intent: DuoLaterIntent(item: n.id, slot: duoTapSlot(n)))
                }
            } else {
                DuoPill(label: "Add a task", bg: .white, fg: dc("#3b28b0"), url: b.go("add"))
            }
        }
        .padding(18)
    }

    var weekStrip: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                ForEach(Array(b.week.enumerated()), id: \.offset) { _, d in
                    VStack(spacing: 1) {
                        Text(verbatim: d.label).duo(10, .medium, d.today ? dc("#cdebdd") : dc("#5c6660"))
                        Text(verbatim: d.day).duo(14, .bold, d.today ? .white : dc("#18201c"))
                    }
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(d.today ? dc("#0b6e4f") : .white))
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(d.today ? Color.clear : dc("#dde2df"), lineWidth: 1))
                }
            }
            ForEach(Array(focusList.prefix(2).enumerated()), id: \.offset) { _, t in
                (Text(verbatim: t.title).font(.system(size: 13, weight: .semibold)).foregroundColor(dc("#18201c"))
                 + Text(verbatim: " · " + t.label).font(.system(size: 13, weight: .medium)).foregroundColor(t.late ? dc("#b42318") : dc("#5c6660"))).lineLimit(1)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
    }

    func column(_ title: String, _ count: Int, _ head: Color, _ fill: Color, _ items: [DuoTaskItem]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack { Text(verbatim: title).duo(12, .heavy, head); Spacer(); Text(verbatim: "\(count)").duo(12, .heavy, head) }
            ForEach(Array(items.prefix(2).enumerated()), id: \.offset) { _, t in
                Text(verbatim: t.title).duo(12, .semibold, dc("#172033")).lineLimit(1).padding(.horizontal, 8).padding(.vertical, 7)
                    .frame(maxWidth: .infinity, alignment: .leading).background(RoundedRectangle(cornerRadius: 8).fill(.white))
            }
            Spacer(minLength: 0)
        }
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(fill))
    }

    var columns: some View {
        HStack(spacing: 8) {
            column("Overdue", b.overdue, dc("#9f2a1b"), dc("#fbe9e7"), b.lateTasks)
            column("Today", b.today, dc("#2b44a8"), dc("#e5ecfb"), b.todayTasks.filter { !$0.done })
        }
        .padding(10)
    }

    var focus: some View {
        VStack(alignment: .leading) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(verbatim: "FOCUS").duo(11, .heavy, dc("#67e8f9")).tracking(1.2)
                    Text(verbatim: b.focus?.title ?? b.next?.title ?? "Pick a task").duo(15, .semibold, .white).lineLimit(1)
                }
                Spacer()
                DuoClock(focus: b.focus, size: 30, color: .white).frame(maxWidth: 120, alignment: .trailing)
            }
            Spacer(minLength: 0)
            DuoFocusBar(focus: b.focus, track: dc("#262b36"), fill: dc("#67e8f9"))
            Spacer(minLength: 0)
            HStack(spacing: 8) {
                if b.hasFocus, let f = b.focus {
                    DuoPill(label: "Done", bg: dc("#67e8f9"), fg: dc("#06222a"), url: focusDoneLink(f.id), height: 38)
                    DuoPill(label: "Stop", bg: dc("#262b36"), fg: .white, url: focusLink("stop"), height: 38)
                } else {
                    DuoPill(label: "Start focus", bg: dc("#67e8f9"), fg: dc("#06222a"), url: b.goNext, height: 38)
                }
            }
        }
        .padding(16)
    }

    func countTile(_ label: String, _ n: Int, _ color: Color, dark: Bool = false) -> some View {
        Link(destination: b.go("tasks", view: label == "Upcoming" ? "upcoming" : label == "All open" ? "all" : "today")) {
            HStack(alignment: .bottom) {
                Text(verbatim: label).duo(13, .bold, dark ? .white : color)
                Spacer()
                Text(verbatim: "\(n)").duo(26, .bold, dark ? .white : dc("#17151f"), .rounded)
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(dark ? dc("#17151f") : .white))
        }
    }

    var counts: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) { countTile("Today", b.today, dc("#5b47d6")); countTile("Upcoming", b.upcoming, dc("#2563eb")) }
            HStack(spacing: 8) { countTile("Overdue", b.overdue, dc("#c2410c")); countTile("All open", b.open, .white, dark: true) }
        }
        .padding(10)
    }

    var briefingText: String {
        if b.overdue > 0 { return "\(b.overdue) \(b.overdue == 1 ? "is" : "are") overdue and \(b.todayLeft) \(b.todayLeft == 1 ? "is" : "are") due today. Clear the overdue ones first?" }
        if b.todayLeft > 0 { return "\(plural(b.todayLeft, "task")) left today. Next up: \(b.next?.title ?? "")." }
        return "You're all caught up. Anything to add?"
    }

    var briefing: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "sparkles").font(.system(size: 15, weight: .bold)).foregroundStyle(.white).frame(width: 30, height: 30).background(Circle().fill(dc("#6d28d9")))
                Text(verbatim: briefingText).duo(13, .medium, dc("#1c1830")).lineLimit(3)
                    .padding(.horizontal, 12).padding(.vertical, 9)
                    .background(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 14, bottomTrailingRadius: 14, topTrailingRadius: 14).fill(.white))
                    .overlay(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 14, bottomTrailingRadius: 14, topTrailingRadius: 14).stroke(dc("#ece9f3"), lineWidth: 1))
            }
            HStack(spacing: 6) {
                if let t = b.lateTasks.first {
                    Button(intent: DuoLaterIntent(item: t.id, slot: duoTapSlot(t))) { Text(verbatim: "Move to tomorrow").duo(12, .bold, dc("#6d28d9")).padding(.horizontal, 10).padding(.vertical, 7).background(Capsule().stroke(dc("#d9d1f0"), lineWidth: 1)) }.buttonStyle(.plain)
                }
                Link(destination: b.goAsks) { Text(verbatim: b.asks > 0 ? plural(b.asks, "question") : "Open tasks").duo(12, .bold, dc("#6d28d9")).padding(.horizontal, 10).padding(.vertical, 7).background(Capsule().stroke(dc("#d9d1f0"), lineWidth: 1)) }
            }
            .padding(.leading, 40)
        }
        .padding(14)
    }

    var timeline: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(verbatim: b.weekday.isEmpty ? "Today" : b.weekday).duo(12, .bold, dc("#9aa0a6"))
            ForEach(Array(focusList.enumerated()), id: \.offset) { _, t in
                HStack(spacing: 12) {
                    Text(verbatim: t.late ? "Late" : (t.label.components(separatedBy: " ").first ?? t.label)).duo(11, .medium, t.late ? dc("#fca5a5") : dc("#67e8f9"), .monospaced).frame(width: 40, alignment: .leading)
                    Text(verbatim: t.title).duo(13, .semibold, dc("#e8eaed")).lineLimit(1).padding(.leading, 10)
                        .overlay(alignment: .leading) { Rectangle().fill(t.late ? dc("#5a2a2e") : dc("#1e4a52")).frame(width: 2) }
                }
            }
            if focusList.isEmpty { Text(verbatim: "A clear day").duo(13, .semibold, dc("#e8eaed")) }
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
    }

    var editorial: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading) {
                Text(verbatim: "OPEN").duo(10, .heavy, dc("#555555")).tracking(1.2)
                Spacer(minLength: 0)
                Text(verbatim: "\(b.open)").duo(64, .bold, dc("#111111"), .rounded).lineLimit(1).minimumScaleFactor(0.5)
                Spacer(minLength: 0)
                Text(verbatim: "\(b.overdue) LATE").duo(11, .bold, dc("#c8102e"))
            }
            .frame(width: 84, alignment: .leading)
            Rectangle().fill(dc("#111111")).frame(width: 2)
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(b.openTasks.prefix(3).enumerated()), id: \.offset) { i, t in
                    if i > 0 { Rectangle().fill(dc("#eeeeee")).frame(height: 1).padding(.vertical, 8) }
                    HStack(spacing: 8) {
                        Text(verbatim: String(format: "%02d", i + 1)).duo(13, .bold, t.late ? dc("#c8102e") : dc("#888888"), .rounded)
                        Text(verbatim: t.title).duo(13, .semibold, dc("#111111")).lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
            }
        }
        .padding(16)
    }

    var quickAdd: some View {
        VStack(spacing: 10) {
            Link(destination: b.go("add")) {
                HStack(spacing: 10) {
                    Image(systemName: "plus").font(.system(size: 16, weight: .heavy)).foregroundStyle(dc("#4f46e5"))
                    Text(verbatim: "Add a task, or type @arise").duo(14, .regular, dc("#5b6170"))
                    Spacer()
                }
                .padding(.horizontal, 14).frame(height: 46).background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(dc("#f2f3f6")))
            }
            HStack(spacing: 8) {
                Link(destination: b.go("tasks", view: "today")) {
                    VStack(spacing: 2) { Text(verbatim: "\(b.overdue)").duo(20, .bold, dc("#b42318")); Text(verbatim: "Overdue").duo(12, .bold, dc("#b42318")) }
                        .frame(maxWidth: .infinity, maxHeight: .infinity).background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(dc("#fff1ee")))
                }
                Link(destination: b.goFocus) {
                    VStack(spacing: 4) { Image(systemName: "timer").font(.system(size: 18, weight: .bold)); Text(verbatim: "Focus").font(.system(size: 12, weight: .bold)) }
                        .foregroundStyle(dc("#67e8f9")).frame(maxWidth: .infinity, maxHeight: .infinity).background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(dc("#0b0d12")))
                }
                Link(destination: b.go("tasks", view: "today")) {
                    VStack(spacing: 2) { Text(verbatim: "\(b.today)").duo(20, .bold, .white); Text(verbatim: "Today").duo(12, .bold, .white) }
                        .frame(maxWidth: .infinity, maxHeight: .infinity).background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(dc("#4f46e5")))
                }
            }
        }
        .padding(12)
    }
}

// MARK: Large (364 × 382)

struct DuoLargeView: View {
    let style: DuoLargeStyle
    let b: DuoBoard

    static func background(_ s: DuoLargeStyle) -> Color {
        switch s {
        case .checklist, .calendar, .tiles: return .white
        case .weekGrid: return dc("#f7f8f7")
        case .oneAtATime: return dc("#1b1f3b")
        case .board: return dc("#eef1f6")
        case .notebook: return dc("#fdfdfb")
        case .punch: return dc("#f6f0e4")
        case .briefing: return dc("#faf9fc")
        case .grouped: return dc("#f2f2f7")
        }
    }

    var body: some View {
        Group {
            switch style {
            case .checklist: checklist
            case .weekGrid: weekGrid
            case .oneAtATime: oneAtATime
            case .board: board
            case .calendar: calendar
            case .notebook: notebook
            case .punch: punch
            case .tiles: tiles
            case .briefing: briefing
            case .grouped: grouped
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(target)
    }

    /// Where a tap on the widget (outside its buttons) opens the app.
    var target: URL {
        switch style {
        case .checklist: return b.go("tasks", view: "today")
        case .weekGrid: return b.go("calendar")
        case .oneAtATime: return b.goNext
        case .board: return b.go("tasks", view: "all")
        case .calendar: return b.go("calendar")
        case .notebook: return b.go("tasks", view: "today")
        case .punch: return b.go("tasks", view: "today")
        case .tiles: return b.go("tasks", view: "all")
        case .briefing: return b.goAsks
        case .grouped: return b.go("tasks", view: "all")
        }
    }

    func section(_ title: String, _ color: Color) -> some View { Text(verbatim: title).duo(11, .heavy, color).tracking(0.8) }

    var checklist: some View {
        let late = b.lateTasks, today = b.todayTasks
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) { Text(verbatim: "Tasks").duo(20, .bold, dc("#14161a")); Spacer(); Text(verbatim: "\(b.open) open").duo(13, .regular, dc("#5b6170")) }
            if !late.isEmpty {
                section("OVERDUE", dc("#b42318"))
                ForEach(Array(late.prefix(2).enumerated()), id: \.offset) { _, t in DuoRow(task: t, ink: dc("#14161a"), muted: dc("#5b6170"), late: dc("#b42318"), size: 14, showLabel: false) }
            }
            section("TODAY", dc("#5b6170")).padding(.top, 4)
            ForEach(Array(today.prefix(late.isEmpty ? 5 : 3).enumerated()), id: \.offset) { _, t in DuoRow(task: t, ink: dc("#14161a"), muted: dc("#5b6170"), late: dc("#b42318"), size: 14) }
            if today.isEmpty { Text(verbatim: "Nothing due today").duo(14, .medium, dc("#5b6170")) }
            Spacer(minLength: 0)
            Link(destination: b.go("add")) {
                HStack(spacing: 8) { Image(systemName: "plus").font(.system(size: 15, weight: .heavy)).foregroundStyle(dc("#4f46e5")); Text(verbatim: "Add a task").duo(13, .regular, dc("#5b6170")); Spacer() }
                    .padding(.horizontal, 12).frame(height: 42).background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(dc("#f2f3f6")))
            }
        }
        .padding(18)
    }

    var weekGrid: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) { Text(verbatim: "This week").duo(18, .bold, dc("#18201c")); Spacer(); Text(verbatim: plural(b.upcoming, "coming up", "coming up")).duo(12, .regular, dc("#5c6660")) }
            HStack(alignment: .top, spacing: 6) {
                ForEach(Array(b.week.enumerated()), id: \.offset) { _, d in
                    VStack(spacing: 6) {
                        (Text(verbatim: d.label + " ").font(.system(size: 11)).foregroundColor(d.today ? dc("#cdebdd") : dc("#5c6660"))
                         + Text(verbatim: d.day).font(.system(size: 11, weight: .bold)).foregroundColor(d.today ? .white : dc("#18201c")))
                        ForEach(Array(d.titles.prefix(3).enumerated()), id: \.offset) { _, title in
                            Text(verbatim: title).duo(10, .semibold, d.today ? dc("#18201c") : d.late ? dc("#8a2318") : dc("#0b4f39")).lineLimit(3)
                                .padding(5).frame(maxWidth: .infinity, alignment: .leading)
                                .background(RoundedRectangle(cornerRadius: 6).fill(d.today ? .white : d.late ? dc("#fdecea") : dc("#e6f2ec")))
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 6).padding(.vertical, 8)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(d.today ? dc("#0b6e4f") : .white))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(d.today ? Color.clear : dc("#dde2df"), lineWidth: 1))
                }
            }
            Text(verbatim: b.overdue > 0 ? "\(b.overdue) carried over from earlier" : "Nothing carried over").duo(12, .regular, dc("#5c6660"))
        }
        .padding(16)
    }

    var oneAtATime: some View {
        let t = b.next
        return VStack(alignment: .leading, spacing: 12) {
            HStack { Text(verbatim: "One at a time").duo(12, .regular, dc("#a9aecb")); Spacer(); Text(verbatim: b.today > 0 ? "\(min(b.todayDone + 1, b.today)) of \(b.today) today" : "\(b.open) open").duo(12, .regular, dc("#a9aecb")) }
            VStack(alignment: .leading) {
                if let t, t.late {
                    Text(verbatim: "OVERDUE").duo(11, .heavy, dc("#9f2a1b")).padding(.horizontal, 8).padding(.vertical, 4).background(RoundedRectangle(cornerRadius: 6).fill(dc("#fde2dd")))
                } else if let t {
                    Text(verbatim: t.label.uppercased()).duo(11, .heavy, dc("#4a4e68"))
                }
                Spacer(minLength: 0)
                Text(verbatim: t?.title ?? "All clear. Nice work.").duo(25, .bold, dc("#1b1f3b"), .rounded).lineLimit(4).minimumScaleFactor(0.7)
            }
            .padding(18).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(dc("#f7f5ef")))
            if let t {
                HStack(spacing: 8) {
                    Button(intent: DuoLaterIntent(item: t.id, slot: duoTapSlot(t))) { Text(verbatim: "Later").duo(14, .bold, dc("#f1f2f8")).frame(maxWidth: .infinity, minHeight: 46).overlay(RoundedRectangle(cornerRadius: 16).stroke(.white.opacity(0.25), lineWidth: 1)) }.buttonStyle(.plain)
                    Button(intent: CheckOffIntent(slot: duoTapSlot(t), item: t.id)) { Text(verbatim: "Done").duo(14, .heavy, dc("#2a1700")).frame(maxWidth: .infinity, minHeight: 46).background(RoundedRectangle(cornerRadius: 16).fill(dc("#ffb86b"))) }.buttonStyle(.plain)
                }
            }
        }
        .padding(16)
    }

    func boardColumn(_ title: String, _ count: Int, _ head: Color, _ fill: Color, _ items: [DuoTaskItem]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack { Text(verbatim: title).duo(13, .heavy, head); Spacer(); Text(verbatim: "\(count)").duo(13, .heavy, head) }
            ForEach(Array(items.prefix(4).enumerated()), id: \.offset) { _, t in
                VStack(alignment: .leading, spacing: 4) {
                    Text(verbatim: t.title).duo(13, t.done ? .medium : .semibold, t.done ? dc("#8a93a6") : dc("#172033")).strikethrough(t.done).lineLimit(2)
                    if !t.done { Text(verbatim: t.label).duo(11, .regular, t.late ? dc("#9f2a1b") : dc("#5a6478")) }
                }
                .padding(10).frame(maxWidth: .infinity, alignment: .leading).background(RoundedRectangle(cornerRadius: 10).fill(.white))
            }
            Spacer(minLength: 0)
        }
        .padding(12).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(fill))
    }

    var board: some View {
        HStack(spacing: 10) {
            boardColumn("Overdue", b.overdue, dc("#9f2a1b"), dc("#fbe9e7"), b.lateTasks)
            boardColumn("Today", b.today, dc("#2b44a8"), dc("#e5ecfb"), b.todayTasks)
        }
        .padding(12)
    }

    var calendar: some View {
        let cells: [Int] = Array(repeating: 0, count: max(0, min(6, b.monthFirst))) + Array(1...max(1, b.monthDays))
        let rows = stride(from: 0, to: cells.count, by: 7).map { Array(cells[$0..<min($0 + 7, cells.count)]) }
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) { Text(verbatim: b.month.isEmpty ? "This month" : b.month).duo(18, .bold, dc("#c2410c")); Spacer(); Text(verbatim: "\(b.today) today").duo(12, .regular, dc("#5f5b6e")) }
            VStack(spacing: 4) {
                HStack(spacing: 0) { ForEach(["S", "M", "T", "W", "T", "F", "S"].indices, id: \.self) { i in Text(verbatim: ["S", "M", "T", "W", "T", "F", "S"][i]).duo(10, .semibold, dc("#6e6a7c")).frame(maxWidth: .infinity) } }
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    HStack(spacing: 0) {
                        ForEach(0..<7, id: \.self) { i in
                            let day = i < row.count ? row[i] : 0
                            VStack(spacing: 2) {
                                if day == 0 { Text(verbatim: " ").font(.system(size: 12)) }
                                else if day == b.monthToday { Text(verbatim: "\(day)").duo(12, .bold, .white).frame(width: 24, height: 24).background(Circle().fill(dc("#c2410c"))) }
                                else { Text(verbatim: "\(day)").duo(12, .semibold, dc("#17151f")) }
                                Circle().fill(day > 0 && day != b.monthToday && b.dots.contains(day) ? (day < b.monthToday ? dc("#c2410c") : dc("#5b47d6")) : Color.clear).frame(width: 5, height: 5)
                            }
                            .frame(maxWidth: .infinity)
                        }
                    }
                }
            }
            Spacer(minLength: 0)
            Rectangle().fill(dc("#efeef4")).frame(height: 1)
            if let n = b.next {
                (Text(verbatim: n.title).font(.system(size: 13, weight: .semibold)).foregroundColor(dc("#17151f")) + Text(verbatim: " · " + n.label).font(.system(size: 13)).foregroundColor(dc("#5f5b6e"))).lineLimit(1)
            }
        }
        .padding(16)
    }

    var notebook: some View {
        let blue = dc("#1e3a8a"), red = dc("#b91c1c")
        let hand = { (s: String, size: CGFloat, c: Color) in Text(verbatim: s).font(.custom("Noteworthy-Bold", size: size)).foregroundStyle(c).lineLimit(1) }
        return ZStack(alignment: .topLeading) {
            VStack(spacing: 0) { ForEach(0..<12, id: \.self) { _ in Spacer(minLength: 0).frame(height: 37); Rectangle().fill(dc("#dce6f2")).frame(height: 1) } }
            Rectangle().fill(dc("#f1b4b4")).frame(width: 2).padding(.leading, 34)
            VStack(alignment: .leading, spacing: 0) {
                hand(b.weekday.isEmpty ? "Today" : b.weekday, 24, blue).frame(height: 38, alignment: .bottom)
                if b.overdue > 0 { hand("\(b.overdue) overdue!", 17, red).frame(height: 38, alignment: .bottom) }
                ForEach(Array(b.tasks.filter { $0.late || $0.today }.prefix(b.overdue > 0 ? 5 : 6).enumerated()), id: \.offset) { _, t in
                    HStack(spacing: 8) {
                        DuoCheck(task: t, color: blue, size: 14, square: true)
                        Text(verbatim: t.title).duo(13, .medium, t.done ? dc("#9ca3af") : dc("#1f2430")).strikethrough(t.done).lineLimit(1)
                    }
                    .frame(height: 38, alignment: .bottom).padding(.bottom, 4)
                }
                Link(destination: b.goAsks) { hand(b.asks > 0 ? "→ Arise left you a note" : "→ open your tasks", 17, dc("#7c3aed")) }.frame(height: 38, alignment: .bottom)
            }
            .padding(.leading, 48).padding(.trailing, 16)
        }
    }

    func punchBox<C: View>(_ fill: Color, @ViewBuilder _ content: () -> C) -> some View {
        content().padding(10).frame(maxWidth: .infinity, alignment: .leading)
            .background(Rectangle().fill(fill)).overlay(Rectangle().stroke(Color.black, lineWidth: 3))
            .background(Rectangle().fill(Color.black).offset(x: 3, y: 3))
    }

    var punch: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(verbatim: "TASKS!").font(.system(size: 30, weight: .black)).foregroundStyle(.black)
            HStack(spacing: 10) {
                punchBox(dc("#ff6b4a")) { VStack(alignment: .leading, spacing: 0) { Text(verbatim: "\(b.overdue)").font(.system(size: 22, weight: .black)); Text(verbatim: "LATE").font(.system(size: 10, weight: .heavy)) }.foregroundStyle(.black) }
                punchBox(dc("#ffe14d")) { VStack(alignment: .leading, spacing: 0) { Text(verbatim: "\(b.today)").font(.system(size: 22, weight: .black)); Text(verbatim: "TODAY").font(.system(size: 10, weight: .heavy)) }.foregroundStyle(.black) }
                punchBox(dc("#a7f36b")) { VStack(alignment: .leading, spacing: 0) { Text(verbatim: "\(b.open)").font(.system(size: 22, weight: .black)); Text(verbatim: "OPEN").font(.system(size: 10, weight: .heavy)) }.foregroundStyle(.black) }
            }
            ForEach(Array(b.openTasks.prefix(3).enumerated()), id: \.offset) { _, t in
                punchBox(.white) {
                    HStack(spacing: 8) {
                        DuoCheck(task: t, color: .black, size: 16, square: true)
                        Text(verbatim: t.title.uppercased() + (t.today && !t.late ? " · " + t.label.uppercased() : "")).font(.system(size: 12, weight: .heavy)).foregroundStyle(.black).lineLimit(1)
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(16)
    }

    func bigTile(_ label: String, _ n: Int, _ bg: Color, _ fg: Color) -> some View {
        Link(destination: b.go("tasks", view: label == "Upcoming" ? "upcoming" : label == "All open" ? "all" : "today")) {
            VStack(alignment: .leading) {
                Text(verbatim: label).duo(14, .bold, fg)
                Spacer(minLength: 0)
                Text(verbatim: "\(n)").duo(48, .bold, fg, .rounded).lineLimit(1).minimumScaleFactor(0.5)
            }
            .padding(14).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(bg))
        }
    }

    var tiles: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) { bigTile("Overdue", b.overdue, dc("#ff5a4e"), dc("#1a0503")); bigTile("Today", b.today, dc("#ffd43b"), dc("#1f1600")) }
            HStack(spacing: 10) { bigTile("Upcoming", b.upcoming, dc("#74c0fc"), dc("#031a2b")); bigTile("All open", b.open, dc("#0b0b0f"), .white) }
            Link(destination: b.go("add")) {
                HStack(spacing: 8) { Image(systemName: "plus").font(.system(size: 17, weight: .heavy)); Text(verbatim: "Add a task").font(.system(size: 15, weight: .heavy)) }
                    .foregroundStyle(.white).frame(maxWidth: .infinity, minHeight: 50).background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(dc("#0b0b0f")))
            }
        }
        .padding(12)
    }

    var briefing: some View {
        let medium = DuoMediumView(style: .briefing, b: b)
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: "sparkles").font(.system(size: 15, weight: .bold)).foregroundStyle(.white).frame(width: 32, height: 32).background(Circle().fill(dc("#6d28d9")))
                Text(verbatim: "Arise").duo(16, .bold, dc("#1c1830"))
                Spacer()
                Text(verbatim: b.weekday).duo(12, .regular, dc("#6b6580"))
            }
            Text(verbatim: medium.briefingText).duo(14, .medium, dc("#1c1830")).lineLimit(3)
                .padding(.horizontal, 14).padding(.vertical, 12).frame(maxWidth: .infinity, alignment: .leading)
                .background(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 16, bottomTrailingRadius: 16, topTrailingRadius: 16).fill(.white))
                .overlay(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 16, bottomTrailingRadius: 16, topTrailingRadius: 16).stroke(dc("#ece9f3"), lineWidth: 1))
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(b.tasks.filter { $0.late || ($0.today && !$0.done) }.prefix(3).enumerated()), id: \.offset) { i, t in
                    if i > 0 { Rectangle().fill(dc("#f2f0f7")).frame(height: 1) }
                    DuoRow(task: t, ink: dc("#1c1830"), muted: dc("#6b6580"), late: dc("#b42318"), size: 13).padding(.horizontal, 12).padding(.vertical, 9)
                }
            }
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(dc("#ece9f3"), lineWidth: 1))
            Spacer(minLength: 0)
            HStack(spacing: 6) {
                if let t = b.lateTasks.first {
                    Button(intent: DuoLaterIntent(item: t.id, slot: duoTapSlot(t))) { Text(verbatim: "Move to tomorrow").duo(12, .bold, dc("#6d28d9")).padding(.horizontal, 12).padding(.vertical, 8).background(Capsule().stroke(dc("#d9d1f0"), lineWidth: 1)) }.buttonStyle(.plain)
                }
                Link(destination: b.goAsks) { Text(verbatim: b.asks > 0 ? plural(b.asks, "question") : "Open tasks").duo(12, .bold, .white).padding(.horizontal, 12).padding(.vertical, 8).background(Capsule().fill(dc("#6d28d9"))) }
            }
        }
        .padding(16)
    }

    func groupRow(_ name: String, _ count: String, _ color: Color, round: Bool, last: Bool) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                RoundedRectangle(cornerRadius: round ? 12 : 7, style: .continuous).fill(color).frame(width: 24, height: 24)
                Text(verbatim: name).duo(15, .regular, .black).lineLimit(1)
                Spacer()
                Text(verbatim: count).duo(15, .regular, dc("#6b6b70"))
            }
            .padding(.horizontal, 12).frame(height: 42)
            if !last { Rectangle().fill(dc("#e5e5ea")).frame(height: 1).padding(.leading, 46) }
        }
    }

    var grouped: some View {
        let lists = Array(b.lists.prefix(3))
        return VStack(alignment: .leading, spacing: 10) {
            VStack(spacing: 0) {
                groupRow("Today", "\(b.today)", dc("#0a66d6"), round: false, last: false)
                groupRow("Upcoming", "\(b.upcoming)", dc("#e5484d"), round: false, last: false)
                groupRow("All", "\(b.open)", dc("#3a3a3c"), round: false, last: true)
            }
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(.white))
            if !lists.isEmpty {
                Text(verbatim: "MY LISTS").duo(12, .regular, dc("#6b6b70")).padding(.leading, 12)
                VStack(spacing: 0) {
                    ForEach(Array(lists.enumerated()), id: \.offset) { i, l in groupRow(l.name, "\(l.count)", dc(l.color), round: true, last: i == lists.count - 1) }
                }
                .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(.white))
            }
            Spacer(minLength: 0)
            Link(destination: b.go("add")) {
                HStack(spacing: 8) {
                    Image(systemName: "plus.circle.fill").font(.system(size: 22)).foregroundStyle(dc("#0a66d6"))
                    Text(verbatim: "New Task").duo(15, .semibold, dc("#0a66d6"))
                }
            }
        }
        .padding(14)
    }
}

// MARK: Lock Screen (one color: iPhone tints these to the wallpaper)

struct DuoLockView: View {
    let style: DuoLockStyle
    let b: DuoBoard
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .accessoryCircular: circular
        case .accessoryInline: inline
        default: rectangular
        }
    }

    static func target(_ style: DuoLockStyle, _ b: DuoBoard) -> URL {
        switch style {
        case .next: return b.goNext
        case .overdue, .badge: return b.lateTasks.first.map { duoTaskURL($0, b.hub) } ?? b.go("tasks", view: "today")
        case .focus: return b.goFocus
        case .week: return b.go("calendar")
        case .asks: return b.goAsks
        case .open, .progress: return b.go("tasks", view: "all")
        case .gauge, .line: return b.go("tasks", view: "today")
        }
    }

    var inline: some View {
        switch style {
        case .next: return Text(verbatim: "\(b.next?.label ?? "Clear") · \(b.next?.title ?? "No tasks")")
        case .overdue, .badge: return Text(verbatim: b.overdue > 0 ? "\(b.overdue) overdue" : "Nothing overdue")
        case .focus: return Text(verbatim: b.hasFocus ? "Focus · \(b.focus?.title ?? "")" : "\(b.todayLeft) left today")
        case .asks: return Text(verbatim: b.asks > 0 ? "Arise asks · \(b.asks) new" : "Arise · \(b.todayLeft) left today")
        case .progress: return Text(verbatim: "\(b.done) done · \(b.open) to go")
        default: return Text(verbatim: "\(b.today) today · \(b.overdue) overdue")
        }
    }

    @ViewBuilder var circular: some View {
        switch style {
        case .gauge, .next, .week, .progress:
            Gauge(value: style == .progress ? b.doneShare : b.todayProgress) { EmptyView() } currentValueLabel: { Text(verbatim: style == .progress ? "\(b.done)" : "\(b.todayDone)/\(b.today)").font(.system(size: 14, weight: .heavy)) }
                .gaugeStyle(.accessoryCircularCapacity)
        case .badge, .overdue:
            ZStack { AccessoryWidgetBackground(); VStack(spacing: 1) { Image(systemName: "exclamationmark.circle").font(.system(size: 16, weight: .bold)); Text(verbatim: "\(b.overdue)").font(.system(size: 20, weight: .heavy)) } }
        case .focus:
            ZStack { AccessoryWidgetBackground(); VStack(spacing: 0) { Image(systemName: "timer").font(.system(size: 13, weight: .bold)); DuoClock(focus: b.focus, size: 13, color: .primary) }.padding(4) }
        case .asks:
            ZStack { AccessoryWidgetBackground(); VStack(spacing: 1) { Image(systemName: "sparkles").font(.system(size: 16, weight: .bold)); Text(verbatim: "\(b.asks)").font(.system(size: 16, weight: .heavy)) } }
        default:
            ZStack { AccessoryWidgetBackground(); VStack(spacing: 0) { Text(verbatim: "\(b.open)").font(.system(size: 24, weight: .heavy)).minimumScaleFactor(0.6); Text(verbatim: "OPEN").font(.system(size: 9, weight: .bold)) } }
        }
    }

    @ViewBuilder var rectangular: some View {
        switch style {
        case .next, .gauge, .open:
            VStack(alignment: .leading, spacing: 2) {
                Label { Text(verbatim: b.next?.label ?? "All clear") } icon: { Image(systemName: "clock") }.font(.system(size: 12, weight: .heavy))
                Text(verbatim: b.next?.title ?? "Nothing to do").font(.system(size: 14, weight: .semibold)).lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        case .overdue, .badge:
            VStack(alignment: .leading, spacing: 1) {
                Text(verbatim: b.overdue > 0 ? "\(b.overdue) OVERDUE" : "NOTHING OVERDUE").font(.system(size: 12, weight: .heavy))
                ForEach(Array(b.lateTasks.prefix(2).enumerated()), id: \.offset) { i, t in
                    Text(verbatim: t.title).font(.system(size: 13, weight: i == 0 ? .semibold : .medium)).opacity(i == 0 ? 1 : 0.75).lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        case .focus:
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline) { Text(verbatim: "FOCUS").font(.system(size: 11, weight: .heavy)); Spacer(); DuoClock(focus: b.focus, size: 20, color: .primary).frame(maxWidth: 90, alignment: .trailing) }
                Text(verbatim: b.focus?.title ?? b.next?.title ?? "Pick a task").font(.system(size: 12, weight: .semibold)).lineLimit(1)
                DuoFocusBar(focus: b.focus, track: .primary.opacity(0.3), fill: .primary)
            }
        case .week:
            VStack(alignment: .leading, spacing: 5) {
                Text(verbatim: "THIS WEEK").font(.system(size: 11, weight: .heavy))
                HStack(spacing: 0) {
                    ForEach(Array(b.week.enumerated()), id: \.offset) { _, d in
                        VStack(spacing: 4) {
                            Text(verbatim: String(d.label.prefix(1))).font(.system(size: 11, weight: .bold)).underline(d.today)
                            Capsule().fill(.primary.opacity(d.count == 0 ? 0 : d.today ? 1 : 0.6)).frame(width: d.today ? 18 : 6, height: 6)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        case .asks:
            HStack(spacing: 10) {
                Image(systemName: "sparkles").font(.system(size: 15, weight: .bold)).frame(width: 32, height: 32).overlay(Circle().stroke(.primary, lineWidth: 2))
                VStack(alignment: .leading, spacing: 0) {
                    Text(verbatim: "Arise asks").font(.system(size: 13, weight: .bold))
                    Text(verbatim: b.asks > 0 ? plural(b.asks, "new question") : "\(b.todayLeft) left today").font(.system(size: 13, weight: .medium)).opacity(0.8)
                }
                Spacer(minLength: 0)
            }
        case .progress:
            VStack(alignment: .leading, spacing: 6) {
                HStack { Text(verbatim: "\(b.done) done").font(.system(size: 13, weight: .bold)); Spacer(); Text(verbatim: "\(b.open) to go").font(.system(size: 13, weight: .bold)).opacity(0.8) }
                ProgressView(value: b.doneShare).progressViewStyle(.linear)
            }
        case .line:
            Label { Text(verbatim: "\(b.today) today · \(b.overdue) overdue") } icon: { Image(systemName: "checklist") }.font(.system(size: 15, weight: .semibold))
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: The widgets: every design is its own widget, so all 40 show in the widget gallery

struct DuoShowIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Tasks"
    static var description = IntentDescription("Choose whose tasks this widget shows.")
    @Parameter(title: "Show", default: .both) var show: DuoShow
    init() {}
}

struct DuoBoardEntry: TimelineEntry {
    let date: Date
    let board: DuoBoard
}

struct DuoBoardProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> DuoBoardEntry { DuoBoardEntry(date: Date(), board: .sample) }
    func snapshot(for configuration: DuoShowIntent, in context: Context) async -> DuoBoardEntry {
        let b = loadDuoBoard(configuration.show)
        return DuoBoardEntry(date: Date(), board: context.isPreview && b.tasks.isEmpty && b.open == 0 ? .sample : b)
    }
    func timeline(for configuration: DuoShowIntent, in context: Context) async -> Timeline<DuoBoardEntry> {
        let now = Date()
        let midnight = Calendar.current.startOfDay(for: now).addingTimeInterval(86_400 + 60)
        return Timeline(entries: [DuoBoardEntry(date: now, board: loadDuoBoard(configuration.show))], policy: .after(min(midnight, now.addingTimeInterval(30 * 60))))
    }
}

func duoSmallConfig(_ style: DuoSmallStyle, _ name: String) -> some WidgetConfiguration {
    AppIntentConfiguration(kind: "Arise.duo.s." + style.rawValue, intent: DuoShowIntent.self, provider: DuoBoardProvider()) { e in
        DuoSmallView(style: style, b: e.board).containerBackground(for: .widget) { DuoSmallView.background(style) }
    }
    .configurationDisplayName(name).description("Work, Life or both: long-press it, then Edit Widget.").supportedFamilies([.systemSmall]).contentMarginsDisabled()
}
func duoMediumConfig(_ style: DuoMediumStyle, _ name: String) -> some WidgetConfiguration {
    AppIntentConfiguration(kind: "Arise.duo.m." + style.rawValue, intent: DuoShowIntent.self, provider: DuoBoardProvider()) { e in
        DuoMediumView(style: style, b: e.board).containerBackground(for: .widget) { DuoMediumView.background(style) }
    }
    .configurationDisplayName(name).description("Work, Life or both: long-press it, then Edit Widget.").supportedFamilies([.systemMedium]).contentMarginsDisabled()
}
func duoLargeConfig(_ style: DuoLargeStyle, _ name: String) -> some WidgetConfiguration {
    AppIntentConfiguration(kind: "Arise.duo.l." + style.rawValue, intent: DuoShowIntent.self, provider: DuoBoardProvider()) { e in
        DuoLargeView(style: style, b: e.board).containerBackground(for: .widget) { DuoLargeView.background(style) }
    }
    .configurationDisplayName(name).description("Work, Life or both: long-press it, then Edit Widget.").supportedFamilies([.systemLarge]).contentMarginsDisabled()
}
func duoLockConfig(_ style: DuoLockStyle, _ name: String, _ families: [WidgetFamily]) -> some WidgetConfiguration {
    AppIntentConfiguration(kind: "Arise.duo.k." + style.rawValue, intent: DuoShowIntent.self, provider: DuoBoardProvider()) { e in
        DuoLockView(style: style, b: e.board).containerBackground(for: .widget) { Color.clear }.widgetURL(DuoLockView.target(style, e.board))
    }
    .configurationDisplayName(name).description("Your tasks on the Lock Screen.").supportedFamilies(families)
}

struct DuoS1: Widget { var body: some WidgetConfiguration { duoSmallConfig(.ring, "Progress ring") } }
struct DuoS2: Widget { var body: some WidgetConfiguration { duoSmallConfig(.next, "Up next") } }
struct DuoS3: Widget { var body: some WidgetConfiguration { duoSmallConfig(.overdue, "Overdue alert") } }
struct DuoS4: Widget { var body: some WidgetConfiguration { duoSmallConfig(.focus, "Focus timer") } }
struct DuoS5: Widget { var body: some WidgetConfiguration { duoSmallConfig(.checklist, "Checklist") } }
struct DuoS6: Widget { var body: some WidgetConfiguration { duoSmallConfig(.big, "Big number") } }
struct DuoS7: Widget { var body: some WidgetConfiguration { duoSmallConfig(.asks, "Arise asks") } }
struct DuoS8: Widget { var body: some WidgetConfiguration { duoSmallConfig(.week, "Week dots") } }
struct DuoS9: Widget { var body: some WidgetConfiguration { duoSmallConfig(.actions, "Quick actions") } }
struct DuoS10: Widget { var body: some WidgetConfiguration { duoSmallConfig(.done, "Done so far") } }
struct DuoM1: Widget { var body: some WidgetConfiguration { duoMediumConfig(.ringList, "Ring and today's list") } }
struct DuoM2: Widget { var body: some WidgetConfiguration { duoMediumConfig(.nextButtons, "Up next with buttons") } }
struct DuoM3: Widget { var body: some WidgetConfiguration { duoMediumConfig(.weekStrip, "Week strip") } }
struct DuoM4: Widget { var body: some WidgetConfiguration { duoMediumConfig(.columns, "Two columns") } }
struct DuoM5: Widget { var body: some WidgetConfiguration { duoMediumConfig(.focus, "Focus with buttons") } }
struct DuoM6: Widget { var body: some WidgetConfiguration { duoMediumConfig(.counts, "List counts") } }
struct DuoM7: Widget { var body: some WidgetConfiguration { duoMediumConfig(.briefing, "Arise briefing") } }
struct DuoM8: Widget { var body: some WidgetConfiguration { duoMediumConfig(.timeline, "Timeline") } }
struct DuoM9: Widget { var body: some WidgetConfiguration { duoMediumConfig(.editorial, "Editorial") } }
struct DuoM10: Widget { var body: some WidgetConfiguration { duoMediumConfig(.quickAdd, "Quick add") } }
struct DuoL1: Widget { var body: some WidgetConfiguration { duoLargeConfig(.checklist, "Full checklist") } }
struct DuoL2: Widget { var body: some WidgetConfiguration { duoLargeConfig(.weekGrid, "Week grid") } }
struct DuoL3: Widget { var body: some WidgetConfiguration { duoLargeConfig(.oneAtATime, "One at a time") } }
struct DuoL4: Widget { var body: some WidgetConfiguration { duoLargeConfig(.board, "Board columns") } }
struct DuoL5: Widget { var body: some WidgetConfiguration { duoLargeConfig(.calendar, "Month calendar") } }
struct DuoL6: Widget { var body: some WidgetConfiguration { duoLargeConfig(.notebook, "Notebook") } }
struct DuoL7: Widget { var body: some WidgetConfiguration { duoLargeConfig(.punch, "Punch") } }
struct DuoL8: Widget { var body: some WidgetConfiguration { duoLargeConfig(.tiles, "Big tiles") } }
struct DuoL9: Widget { var body: some WidgetConfiguration { duoLargeConfig(.briefing, "Arise briefing") } }
struct DuoL10: Widget { var body: some WidgetConfiguration { duoLargeConfig(.grouped, "Grouped lists") } }
struct DuoK1: Widget { var body: some WidgetConfiguration { duoLockConfig(.next, "Next task", [.accessoryRectangular, .accessoryInline]) } }
struct DuoK2: Widget { var body: some WidgetConfiguration { duoLockConfig(.overdue, "Overdue", [.accessoryRectangular, .accessoryInline]) } }
struct DuoK3: Widget { var body: some WidgetConfiguration { duoLockConfig(.gauge, "Today gauge", [.accessoryCircular]) } }
struct DuoK4: Widget { var body: some WidgetConfiguration { duoLockConfig(.open, "Open count", [.accessoryCircular]) } }
struct DuoK5: Widget { var body: some WidgetConfiguration { duoLockConfig(.focus, "Focus timer", [.accessoryRectangular, .accessoryCircular]) } }
struct DuoK6: Widget { var body: some WidgetConfiguration { duoLockConfig(.line, "Above the clock", [.accessoryInline]) } }
struct DuoK7: Widget { var body: some WidgetConfiguration { duoLockConfig(.week, "Week dots", [.accessoryRectangular]) } }
struct DuoK8: Widget { var body: some WidgetConfiguration { duoLockConfig(.badge, "Overdue badge", [.accessoryCircular]) } }
struct DuoK9: Widget { var body: some WidgetConfiguration { duoLockConfig(.asks, "Arise asks", [.accessoryRectangular, .accessoryCircular]) } }
struct DuoK10: Widget { var body: some WidgetConfiguration { duoLockConfig(.progress, "Progress bar", [.accessoryRectangular, .accessoryCircular]) } }

/// The ten Small designs (WidgetBundle takes ten at a time).
struct DuoSmallWidgets: WidgetBundle {
    var body: some Widget {
        DuoS1()
        DuoS2()
        DuoS3()
        DuoS4()
        DuoS5()
        DuoS6()
        DuoS7()
        DuoS8()
        DuoS9()
        DuoS10()
    }
}

/// The ten Medium designs (WidgetBundle takes ten at a time).
struct DuoMediumWidgets: WidgetBundle {
    var body: some Widget {
        DuoM1()
        DuoM2()
        DuoM3()
        DuoM4()
        DuoM5()
        DuoM6()
        DuoM7()
        DuoM8()
        DuoM9()
        DuoM10()
    }
}

/// The ten Large designs (WidgetBundle takes ten at a time).
struct DuoLargeWidgets: WidgetBundle {
    var body: some Widget {
        DuoL1()
        DuoL2()
        DuoL3()
        DuoL4()
        DuoL5()
        DuoL6()
        DuoL7()
        DuoL8()
        DuoL9()
        DuoL10()
    }
}

/// The ten Lock Screen designs (WidgetBundle takes ten at a time).
struct DuoLockWidgets: WidgetBundle {
    var body: some Widget {
        DuoK1()
        DuoK2()
        DuoK3()
        DuoK4()
        DuoK5()
        DuoK6()
        DuoK7()
        DuoK8()
        DuoK9()
        DuoK10()
    }
}

// MARK: - Links: buttons that open your saved links in Safari
// The app sends each hub's Link page as a slot ("duo.links" from LifeHub, "duo.links.work" from WorkHub; client/src/lib/duoBoard.ts
// publishDuoLinks). Each button is a plain web link, so iPhone opens it in Safari, not in the app. Small shows one link
// (pick which in Edit Widget), medium four, large eight.

struct DuoLinkItem: Codable, Hashable {
    var id: String = ""
    var title: String = ""
    var url: String = ""
    var emoji: String = ""
    var hub: String = "life"
    var web: URL? {
        guard let u = URL(string: url), let s = u.scheme?.lowercased(), s == "https" || s == "http" else { return nil }
        return u
    }
    var host: String { (web?.host ?? "").replacingOccurrences(of: "www.", with: "") }
}

func loadDuoLinks(_ show: DuoShow) -> [DuoLinkItem] {
    let defaults = UserDefaults(suiteName: group())
    guard let data = defaults?.data(forKey: "slots"),
          let all = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [] }
    func read(_ key: String, _ hub: String) -> [DuoLinkItem] {
        guard let slot = all[key] as? [String: Any], let raw = slot["links"] as? [[String: Any]] else { return [] }
        return raw.compactMap { r in
            let l = DuoLinkItem(id: r["id"] as? String ?? "", title: r["title"] as? String ?? "", url: r["url"] as? String ?? "", emoji: r["emoji"] as? String ?? "", hub: hub)
            return l.web == nil ? nil : l
        }
    }
    let work = show == .life ? [] : read("duo.links.work", "work")
    let life = show == .work ? [] : read("duo.links", "life")
    return work + life
}

struct DuoLinkEntity: AppEntity {
    let id: String
    let title: String
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Link"
    static var defaultQuery = DuoLinkQuery()
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(title)") }
}

struct DuoLinkQuery: EntityQuery {
    private func all() -> [DuoLinkEntity] {
        loadDuoLinks(.both).map { DuoLinkEntity(id: "\($0.hub):\($0.id)", title: $0.title.isEmpty ? $0.host : $0.title) }
    }
    func entities(for identifiers: [DuoLinkEntity.ID]) async throws -> [DuoLinkEntity] { all().filter { identifiers.contains($0.id) } }
    func suggestedEntities() async throws -> [DuoLinkEntity] { all() }
    func defaultResult() async -> DuoLinkEntity? { all().first }
}

struct DuoLinkIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Links"
    static var description = IntentDescription("Buttons that open your saved links in Safari.")
    @Parameter(title: "Show", default: .both) var show: DuoShow
    @Parameter(title: "Link (small widget)") var link: DuoLinkEntity?
    init() {}
}

struct DuoLinkEntry: TimelineEntry {
    let date: Date
    let links: [DuoLinkItem]
    let hub: String
}

struct DuoLinkProvider: AppIntentTimelineProvider {
    static let sample = [
        DuoLinkItem(id: "1", title: "Google Classroom", url: "https://classroom.google.com", emoji: "🎓"),
        DuoLinkItem(id: "2", title: "Grade book", url: "https://www.infinitecampus.com", emoji: "📊"),
        DuoLinkItem(id: "3", title: "District email", url: "https://mail.google.com", emoji: "✉️"),
        DuoLinkItem(id: "4", title: "Newsela", url: "https://newsela.com", emoji: "📰"),
    ]
    func entry(_ c: DuoLinkIntent, preview: Bool) -> DuoLinkEntry {
        var links = loadDuoLinks(c.show)
        if let pick = c.link?.id, let i = links.firstIndex(where: { "\($0.hub):\($0.id)" == pick }) { links.insert(links.remove(at: i), at: 0) }
        if links.isEmpty && preview { links = Self.sample }
        return DuoLinkEntry(date: Date(), links: links, hub: c.show == .work ? "work" : "life")
    }
    func placeholder(in context: Context) -> DuoLinkEntry { DuoLinkEntry(date: Date(), links: Self.sample, hub: "life") }
    func snapshot(for configuration: DuoLinkIntent, in context: Context) async -> DuoLinkEntry { entry(configuration, preview: context.isPreview) }
    func timeline(for configuration: DuoLinkIntent, in context: Context) async -> Timeline<DuoLinkEntry> {
        Timeline(entries: [entry(configuration, preview: false)], policy: .after(Date().addingTimeInterval(1800)))
    }
}

/// One link button: its emoji (or first letter) in a tile, the name, and the site.
struct DuoLinkButton: View {
    let link: DuoLinkItem
    var big = false
    var body: some View {
        let face = HStack(spacing: big ? 0 : 10) {
            if !big {
                Text(verbatim: link.emoji.isEmpty ? String((link.title.isEmpty ? link.host : link.title).prefix(1)).uppercased() : link.emoji)
                    .font(.system(size: 17, weight: .bold)).foregroundStyle(dc("#4f46e5"))
                    .frame(width: 34, height: 34).background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(dc("#eef0ff")))
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(verbatim: link.title.isEmpty ? link.host : link.title).duo(13, .bold, dc("#17151f")).lineLimit(1)
                Text(verbatim: link.host).duo(11, .medium, dc("#7a7f8c")).lineLimit(1)
            }
            Spacer(minLength: 0)
            Image(systemName: "safari").font(.system(size: 12, weight: .bold)).foregroundStyle(dc("#9aa0ad"))
        }
        .padding(.horizontal, 10).frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(dc("#f5f6f9")))
        if let url = link.web { Link(destination: url) { face } } else { face }
    }
}

struct DuoLinkView: View {
    let entry: DuoLinkEntry
    @Environment(\.widgetFamily) var family
    var body: some View {
        let links = entry.links
        Group {
            if links.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Image(systemName: "link").font(.system(size: 20, weight: .bold)).foregroundStyle(dc("#4f46e5"))
                    Spacer(minLength: 0)
                    Text(verbatim: "No links yet").duo(15, .bold, dc("#17151f"))
                    Text(verbatim: "Add some on your Link page in the app.").duo(12, .regular, dc("#5f5b6e")).lineLimit(3)
                }
                .padding(16).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .widgetURL(duoGoURL(entry.hub, "links"))
            } else if family == .systemSmall {
                let l = links[0]
                VStack(alignment: .leading, spacing: 4) {
                    Text(verbatim: l.emoji.isEmpty ? String((l.title.isEmpty ? l.host : l.title).prefix(1)).uppercased() : l.emoji)
                        .font(.system(size: 26, weight: .bold)).foregroundStyle(.white)
                        .frame(width: 50, height: 50).background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(dc("#4f46e5")))
                    Spacer(minLength: 0)
                    Text(verbatim: l.title.isEmpty ? l.host : l.title).duo(16, .bold, dc("#17151f")).lineLimit(2)
                    HStack(spacing: 4) {
                        Image(systemName: "safari").font(.system(size: 11, weight: .bold))
                        Text(verbatim: l.host).font(.system(size: 11, weight: .semibold)).lineLimit(1)
                    }
                    .foregroundStyle(dc("#7a7f8c"))
                }
                .padding(16).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .widgetURL(l.web)
            } else {
                let n = family == .systemLarge ? 8 : 4
                let shown = Array(links.prefix(n))
                let rows = stride(from: 0, to: shown.count, by: 2).map { Array(shown[$0..<min($0 + 2, shown.count)]) }
                VStack(spacing: 8) {
                    ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                        HStack(spacing: 8) {
                            ForEach(row, id: \.self) { DuoLinkButton(link: $0) }
                            if row.count == 1 { Color.clear.frame(maxWidth: .infinity) }
                        }
                    }
                    if family == .systemLarge && rows.count < 4 { Spacer(minLength: 0) }
                }
                .padding(12).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            }
        }
    }
}

struct DuoLinkWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "Arise.duo.links", intent: DuoLinkIntent.self, provider: DuoLinkProvider()) { e in
            DuoLinkView(entry: e).containerBackground(for: .widget) { Color.white }
        }
        .configurationDisplayName("Links")
        .description("Tap a link to open it in Safari. Long-press, then Edit Widget to pick Work, Life or one link.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}
