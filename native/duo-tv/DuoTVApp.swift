// Arise Duo for Apple TV: the phone app's layout on the big screen. The same light lavender page, the same
// Home (the date, "Good evening, name.", the four counts, Agenda, Chores, then Bills, Stars, Polls, the next
// trip, Goals and pinned Notes), the same Tasks screen, the week, and You, switched with the same dark
// floating tab bar along the bottom. Refreshed every couple of minutes.
// Signing in takes a code: the TV shows one (and a QR code that opens the page with it filled in), and you
// type it at arisetodo.com/tv on a phone or computer that's signed in (server/tvLink.ts). The TV keeps its
// own session in the keychain.
import SwiftUI
import UIKit
import Security
import CoreImage.CIFilterBuiltins

let duoAPI = URL(string: "https://arisetodo.com")!

@main
struct DuoTVApp: App {
    @StateObject private var model = DuoTVModel()
    var body: some Scene {
        WindowGroup {
            Group {
                if model.token == nil { DuoTVSignIn() } else { DuoTVRoot() }
            }
            .environmentObject(model)
            .preferredColorScheme(.light)
        }
    }
}

// MARK: - The phone app's colors (client/src/components/family-hub)

enum Duo {
    static let page = Color(hex: "#f6f7fc")
    static let ink = Color(hex: "#232139")
    static let violet = Color(hex: "#7866e1")
    static let eyebrow = Color(hex: "#7869d7")
    static let bar = Color(hex: "#1d1a33")
    static let barButton = Color(hex: "#7968e5")
    static let line = Color(hex: "#e7e8f0")
    static let muted = Color(hex: "#64748b")
    static let faint = Color(hex: "#94a3b8")
    static let rose = Color(hex: "#e11d48")
    static let green = Color(hex: "#10b981")
    static let amber = Color(hex: "#f59e0b")
}

extension Color {
    init(hex: String) {
        let h = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let v = Int(h, radix: 16) ?? 0x94a3b8
        self.init(red: Double((v >> 16) & 255) / 255, green: Double((v >> 8) & 255) / 255, blue: Double(v & 255) / 255)
    }
}

// MARK: - Data

struct DuoPerson: Decodable, Hashable { let name: String; let emoji: String; let color: String }

struct DuoTVSummary: Decodable {
    struct Task: Decodable, Identifiable {
        let id: String; let title: String; let due: String; let time: String; let list: String; let who: String
        let listId: String?; let priority: String?
    }
    struct Event: Decodable, Identifiable {
        var id: String { date + time + title }
        let date: String; let title: String; let time: String; let endTime: String; let location: String; let who: [String]
        let color: String?; let people: [DuoPerson]?
    }
    struct Chore: Decodable, Identifiable { let id: String; let title: String; let who: String; let emoji: String; let color: String; let points: Int; let done: Bool }
    struct Member: Decodable, Identifiable { let id: String; let name: String; let emoji: String; let color: String }
    struct List: Decodable, Identifiable { let id: String; let name: String }
    struct Sections: Decodable { let calendar: Bool; let chores: Bool; let money: Bool; let polls: Bool; let trips: Bool; let goals: Bool; let stars: Bool; let notes: Bool }
    struct Bill: Decodable, Identifiable { var id: String { name + due }; let name: String; let amount: String; let due: String; let late: Bool }
    struct Paid: Decodable { let paid: Int; let total: Int }
    struct Star: Decodable, Identifiable { var id: String { name }; let name: String; let emoji: String; let color: String; let stars: Int }
    struct Poll: Decodable, Identifiable { var id: String { question }; let question: String; let leading: String; let waiting: Int }
    struct Trip: Decodable { let name: String; let start: String; let daysToGo: Int; let packed: Int; let packing: Int }
    struct Goal: Decodable, Identifiable { var id: String { title }; let title: String; let progress: Double }
    struct Note: Decodable, Identifiable { var id: String { title + body }; let title: String; let body: String; let color: String }

    let name: String
    let day: String
    let tasks: [Task]
    let events: [Event]
    let chores: [Chore]
    // Added for the phone's layout; an older server leaves them out.
    let members: [Member]?
    let lists: [List]?
    let sections: Sections?
    let bills: [Bill]?
    let billsPaid: Paid?
    let stars: [Star]?
    let polls: [Poll]?
    let trip: Trip?
    let goals: [Goal]?
    let notes: [Note]?

    var dueTasks: [Task] { tasks.filter { !$0.due.isEmpty && $0.due <= day } }
    var todayEvents: [Event] { events.filter { $0.date == day } }
    var choresLeft: Int { chores.filter { !$0.done }.count }
    func on(_ path: KeyPath<Sections, Bool>, else fallback: Bool = true) -> Bool { sections?[keyPath: path] ?? fallback }
}

@MainActor
final class DuoTVModel: ObservableObject {
    @Published var token: String? = DuoTVModel.sample ? "sample" : DuoKeychain.read()
    @Published var summary: DuoTVSummary?
    @Published var error: String?
    @Published var code: String?
    @Published var updated: Date?
    private var poll: String?

    static func today() -> String { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date()) }

    /** Launched with -duoSample YES (the simulator screenshots in companions-sim.yml): a made-up family, no account. */
    static let sample = UserDefaults.standard.bool(forKey: "duoSample")

    func load() async {
        guard let token else { return }
        if Self.sample { summary = try? JSONDecoder().decode(DuoTVSummary.self, from: Data(duoSampleJSON(Self.today()).utf8)); updated = Date(); return }
        var req = URLRequest(url: duoAPI.appending(path: "/api/arise-todo/tv").appending(queryItems: [URLQueryItem(name: "day", value: Self.today())]))
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.cachePolicy = .reloadIgnoringLocalCacheData
        do {
            let (data, res) = try await URLSession.shared.data(for: req)
            let status = (res as? HTTPURLResponse)?.statusCode ?? 0
            if status == 401 { signOut(); return }
            guard status == 200 else {
                let msg = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["message"] as? String
                error = msg ?? "Your family hub isn't reachable right now."
                return
            }
            summary = try JSONDecoder().decode(DuoTVSummary.self, from: data)
            updated = Date(); error = nil
        } catch {
            self.error = "Can't reach Arise Duo. Check the TV's internet connection."
        }
    }

    /** Gets a code to show, then waits for it to be typed in on a phone or computer. */
    func startSignIn() async {
        code = nil; error = nil
        var req = URLRequest(url: duoAPI.appending(path: "/api/tv-link/start"))
        req.httpMethod = "POST"; req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["app": "duo"])
        guard let (data, _) = try? await URLSession.shared.data(for: req),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let c = obj["code"] as? String, let p = obj["poll"] as? String else {
            error = "Can't reach Arise Duo. Check the TV's internet connection."
            return
        }
        code = c; poll = p
        while token == nil, poll == p {
            try? await Task.sleep(for: .seconds(3))
            var q = URLRequest(url: duoAPI.appending(path: "/api/tv-link/poll"))
            q.httpMethod = "POST"; q.setValue("application/json", forHTTPHeaderField: "Content-Type")
            q.httpBody = try? JSONSerialization.data(withJSONObject: ["poll": p])
            guard let (d, _) = try? await URLSession.shared.data(for: q),
                  let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] else { continue }
            let status = o["status"] as? String
            if status == "done", let t = o["token"] as? String {
                DuoKeychain.save(t); token = t; code = nil
                await load()
                return
            }
            // The server forgets codes when it restarts (and after 10 minutes): a fresh one, right away.
            if status == "expired" { await startSignIn(); return }
        }
    }

    func signOut() {
        DuoKeychain.save(nil); token = nil; summary = nil; poll = nil
    }
}

enum DuoKeychain {
    private static let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "arise-duo-tv", kSecAttrAccount as String: "session"]
    static func read() -> String? {
        var q = query; q[kSecReturnData as String] = true
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
    static func save(_ token: String?) {
        SecItemDelete(query as CFDictionary)
        guard let token, let data = token.data(using: .utf8) else { return }
        var q = query; q[kSecValueData as String] = data
        SecItemAdd(q as CFDictionary, nil)
    }
}

// MARK: - Little pieces shared by every screen

private func dayDate(_ day: String) -> Date? { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.date(from: day) }
private func prettyDay(_ day: String, _ style: Date.FormatStyle = .dateTime.weekday(.wide).month(.wide).day()) -> String {
    dayDate(day).map { $0.formatted(style) } ?? day
}
private func shortDay(_ day: String) -> String { prettyDay(day, .dateTime.month(.abbreviated).day()) }
private func prettyTime(_ t: String) -> String {
    let f = DateFormatter(); f.dateFormat = "HH:mm"
    guard let d = f.date(from: t) else { return t }
    return d.formatted(date: .omitted, time: .shortened)
}
private func addDays(_ day: String, _ n: Int) -> String {
    guard let d = dayDate(day), let next = Calendar.current.date(byAdding: .day, value: n, to: d) else { return day }
    let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: next)
}

/** A card that lifts a little when the remote is on it, like a focused tile anywhere on Apple TV. */
struct DuoLift: ButtonStyle {
    var radius: CGFloat = 30
    func makeBody(configuration: Configuration) -> some View { Body(configuration: configuration, radius: radius) }
    private struct Body: View {
        let configuration: Configuration
        let radius: CGFloat
        @Environment(\.isFocused) private var focused
        var body: some View {
            configuration.label
                .overlay(RoundedRectangle(cornerRadius: radius).stroke(focused ? Duo.violet : .clear, lineWidth: 4))
                .scaleEffect(configuration.isPressed ? 0.98 : focused ? 1.03 : 1)
                .shadow(color: Color(hex: "#17152b").opacity(focused ? 0.22 : 0.04), radius: focused ? 30 : 14, y: focused ? 16 : 6)
                .animation(.easeOut(duration: 0.15), value: focused)
        }
    }
}

/** The phone's Panel: a white card with a small violet eyebrow and a bold title. */
struct DuoPanel<Content: View>: View {
    let eyebrow: String
    let title: String
    var symbol: String? = nil
    var symbolTint: Color = Duo.violet
    @ViewBuilder let content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(eyebrow.uppercased()).font(.system(size: 18, weight: .heavy)).tracking(2.6).foregroundStyle(Duo.violet)
                    Text(title).font(.system(size: 34, weight: .bold)).foregroundStyle(Duo.ink).lineLimit(1)
                }
                Spacer()
                if let symbol { Image(systemName: symbol).font(.system(size: 30, weight: .semibold)).foregroundStyle(symbolTint) }
            }
            content
            Spacer(minLength: 0)
        }
        .padding(34)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(.white, in: RoundedRectangle(cornerRadius: 30))
        .overlay(RoundedRectangle(cornerRadius: 30).stroke(Duo.line, lineWidth: 2))
    }
}

struct DuoAvatar: View {
    let person: DuoPerson
    var size: CGFloat = 44
    var body: some View {
        Text(person.emoji.isEmpty ? String(person.name.prefix(1)).uppercased() : person.emoji)
            .font(.system(size: size * 0.5, weight: .bold)).foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Color(hex: person.color.isEmpty ? "#7866e1" : person.color), in: Circle())
            .overlay(Circle().stroke(.white, lineWidth: 3))
    }
}

struct DuoCheck: View {
    var done = false
    var body: some View {
        RoundedRectangle(cornerRadius: 9)
            .stroke(done ? Duo.green : Color(hex: "#cbd5e1"), lineWidth: 3)
            .background(RoundedRectangle(cornerRadius: 9).fill(done ? Duo.green : .clear))
            .overlay(Image(systemName: "checkmark").font(.system(size: 18, weight: .black)).foregroundStyle(done ? .white : .clear))
            .frame(width: 36, height: 36)
    }
}

struct DuoEmpty: View {
    let text: String
    var body: some View { Text(text).font(.system(size: 24)).foregroundStyle(Duo.muted) }
}

// MARK: - The tab bar along the bottom (components/family-hub/PhoneTabBar.tsx)

enum DuoTab: String, CaseIterable { case home, tasks, calendar, you }

struct DuoTVRoot: View {
    @EnvironmentObject var model: DuoTVModel
    @State private var tab: DuoTab = DuoTab(rawValue: UserDefaults.standard.string(forKey: "duoTab") ?? "") ?? .home
    private let refresh = Timer.publish(every: 120, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack(alignment: .bottom) {
            Duo.page.ignoresSafeArea()
            Group {
                switch tab {
                case .home: DuoTVHome(go: { tab = $0 })
                case .tasks: DuoTVTasks()
                case .calendar: DuoTVWeek()
                case .you: DuoTVYou()
                }
            }
            .focusSection()
            DuoTabBar(tab: $tab, initial: String((model.summary?.name ?? "").prefix(1)).uppercased())
                .focusSection()
                .padding(.bottom, 30)
        }
        .task { await model.load() }
        .onReceive(refresh) { _ in Task { await model.load() } }
    }
}

struct DuoTabBar: View {
    @Binding var tab: DuoTab
    let initial: String
    var body: some View {
        HStack(spacing: 8) {
            item(.home, "Home", "house")
            item(.tasks, "Tasks", "checkmark.square")
            item(.calendar, "Calendar", "calendar")
            Button { tab = .you } label: {
                VStack(spacing: 6) {
                    Text(initial.isEmpty ? "Y" : initial).font(.system(size: 20, weight: .black)).foregroundStyle(Duo.bar)
                        .frame(width: 38, height: 38).background(.white, in: Circle())
                    Text("You").font(.system(size: 20, weight: .semibold))
                }
            }
            .buttonStyle(DuoTabStyle(active: tab == .you))
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(Duo.bar, in: Capsule())
        .overlay(Capsule().stroke(.white.opacity(0.1), lineWidth: 1))
        .shadow(color: Color(hex: "#16152a").opacity(0.35), radius: 30, y: 14)
    }
    private func item(_ t: DuoTab, _ label: String, _ symbol: String) -> some View {
        Button { tab = t } label: {
            VStack(spacing: 6) {
                Image(systemName: tab == t ? symbol + ".fill" : symbol).font(.system(size: 32, weight: .semibold)).frame(height: 38)
                Text(label).font(.system(size: 20, weight: .semibold))
            }
        }
        .buttonStyle(DuoTabStyle(active: tab == t))
    }
}

struct DuoTabStyle: ButtonStyle {
    let active: Bool
    func makeBody(configuration: Configuration) -> some View { Body(configuration: configuration, active: active) }
    private struct Body: View {
        let configuration: Configuration
        let active: Bool
        @Environment(\.isFocused) private var focused
        var body: some View {
            configuration.label
                .foregroundStyle(focused ? Duo.bar : active ? .white : .white.opacity(0.6))
                .frame(width: 150, height: 96)
                .background(focused ? Color.white : active ? Duo.barButton : .clear, in: Capsule())
                .scaleEffect(configuration.isPressed ? 0.94 : 1)
                .animation(.easeOut(duration: 0.12), value: focused)
        }
    }
}

// MARK: - Home (components/family-hub/FamilyHome.tsx)

struct DuoTVHome: View {
    @EnvironmentObject var model: DuoTVModel
    let go: (DuoTab) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 36) {
                header
                if let e = model.error { Text(e).font(.system(size: 24, weight: .semibold)).foregroundStyle(Duo.rose) }
                if let s = model.summary {
                    stats(s)
                    HStack(alignment: .top, spacing: 30) {
                        Button { go(.calendar) } label: { agenda(s) }.buttonStyle(DuoLift()).frame(maxWidth: .infinity)
                        if s.on(\.chores), !s.chores.isEmpty {
                            Button { go(.tasks) } label: { chores(s) }.buttonStyle(DuoLift()).frame(maxWidth: .infinity)
                        }
                    }
                    more(s)
                } else if model.error == nil {
                    ProgressView().frame(maxWidth: .infinity).padding(80)
                }
            }
            .padding(.horizontal, 90)
            .padding(.top, 50)
            .padding(.bottom, 200)
        }
        .scrollClipDisabled()
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(prettyDay(DuoTVModel.today()).uppercased()).font(.system(size: 22, weight: .heavy)).tracking(4.4).foregroundStyle(Duo.eyebrow)
            (Text(greeting).foregroundStyle(Duo.ink) + Text(".").foregroundStyle(Duo.violet)).font(.system(size: 76, weight: .black))
            Text("Here's what's happening with your family today.").font(.system(size: 28)).foregroundStyle(Duo.muted)
        }
    }

    private var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        let first = model.summary?.name.split(separator: " ").first.map(String.init) ?? ""
        let part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
        return first.isEmpty ? part : "\(part), \(first)"
    }

    private func stats(_ s: DuoTVSummary) -> some View {
        HStack(spacing: 26) {
            stat("Tasks due", s.dueTasks.count, "list.bullet.clipboard", "#7c3aed", "#f5f3ff") { go(.tasks) }
            if s.on(\.chores) { stat("Chores left today", s.choresLeft, "sparkles", "#059669", "#ecfdf5") { go(.tasks) } }
            if s.on(\.calendar) { stat("Events today", s.todayEvents.count, "calendar", "#0284c7", "#f0f9ff") { go(.calendar) } }
            if s.on(\.money, else: false) { stat("Bills due this week", s.bills?.count ?? 0, "doc.text", "#e11d48", "#fff1f2") { go(.home) } }
        }
    }

    private func stat(_ label: String, _ value: Int, _ symbol: String, _ tint: String, _ chip: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    Text(label).font(.system(size: 22, weight: .bold)).foregroundStyle(Duo.muted).lineLimit(1)
                    Spacer()
                    Image(systemName: symbol).font(.system(size: 24, weight: .semibold)).foregroundStyle(Color(hex: tint))
                        .frame(width: 52, height: 52).background(Color(hex: chip), in: RoundedRectangle(cornerRadius: 14))
                }
                Text("\(value)").font(.system(size: 56, weight: .black)).foregroundStyle(Color(hex: "#242238"))
            }
            .padding(30)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.white, in: RoundedRectangle(cornerRadius: 26))
            .overlay(RoundedRectangle(cornerRadius: 26).stroke(Duo.line, lineWidth: 2))
        }
        .buttonStyle(DuoLift(radius: 26))
    }

    private func agenda(_ s: DuoTVSummary) -> some View {
        let events = s.on(\.calendar) ? s.todayEvents : []
        let due = Array(s.dueTasks.prefix(8))
        return DuoPanel(eyebrow: "Today", title: "Agenda", symbol: "sun.max", symbolTint: Duo.amber) {
            if events.isEmpty && due.isEmpty { DuoEmpty(text: "A clear day. Nothing scheduled and no tasks due.") }
            VStack(spacing: 14) {
                ForEach(events.prefix(6)) { e in DuoEventRow(e: e) }
                ForEach(due) { t in DuoTaskRow(t: t, today: s.day) }
            }
        }
    }

    private func chores(_ s: DuoTVSummary) -> some View {
        DuoPanel(eyebrow: "Chores", title: s.choresLeft > 0 ? "\(s.choresLeft) left today" : "All chores done! 🎉") {
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)], spacing: 14) {
                ForEach(s.chores.prefix(12)) { c in
                    HStack(spacing: 14) {
                        DuoCheck(done: c.done)
                        Text(c.title).font(.system(size: 24, weight: .semibold)).strikethrough(c.done)
                            .foregroundStyle(c.done ? Color(hex: "#065f46") : Duo.ink).lineLimit(1)
                        Spacer(minLength: 4)
                        if !c.who.isEmpty { DuoAvatar(person: DuoPerson(name: c.who, emoji: c.emoji, color: c.color), size: 40) }
                        else { Text("Anyone").font(.system(size: 18, weight: .bold)).foregroundStyle(Duo.faint) }
                    }
                    .padding(16)
                    .background(c.done ? Color(hex: "#ecfdf5") : .white, in: RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(c.done ? Color(hex: "#a7f3d0") : Color(hex: "#f1f5f9"), lineWidth: 2))
                }
            }
        }
    }

    /** Everything after Agenda and Chores, three across, in the phone's order. */
    @ViewBuilder private func more(_ s: DuoTVSummary) -> some View {
        let cards = moreCards(s)
        if !cards.isEmpty {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 30, alignment: .top), count: 3), alignment: .leading, spacing: 30) {
                ForEach(cards.indices, id: \.self) { i in
                    Button { } label: { cards[i].frame(minHeight: 300) }.buttonStyle(DuoLift())
                }
            }
        }
    }

    private func tripLine(_ t: DuoTVSummary.Trip) -> String {
        let when: String = t.daysToGo > 0 ? "\(t.daysToGo) day\(t.daysToGo == 1 ? "" : "s") to go" : "Happening now"
        return when + " · " + shortDay(t.start)
    }

    private func pollLine(_ p: DuoTVSummary.Poll) -> String {
        let lead: String = p.leading.isEmpty ? "No votes yet" : "Leading: " + p.leading
        let rest: String = p.waiting > 0 ? " · \(p.waiting) still to vote" : " · everyone voted"
        return lead + rest
    }

    private func moreCards(_ s: DuoTVSummary) -> [AnyView] {
        var out: [AnyView] = []
        if let t = s.trip {
            out.append(AnyView(
                VStack(alignment: .leading, spacing: 10) {
                    Label("NEXT TRIP", systemImage: "airplane").font(.system(size: 18, weight: .black)).foregroundStyle(.white.opacity(0.75))
                    Text(t.name).font(.system(size: 40, weight: .black)).foregroundStyle(.white).lineLimit(2)
                    Text(tripLine(t))
                        .font(.system(size: 24)).foregroundStyle(.white.opacity(0.85))
                    Spacer(minLength: 0)
                    if t.packing > 0 {
                        ProgressView(value: Double(t.packed), total: Double(t.packing)).tint(.white)
                        Text("\(t.packed) of \(t.packing) packed").font(.system(size: 18)).foregroundStyle(.white.opacity(0.7))
                    }
                }
                .padding(34)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .background(LinearGradient(colors: [Color(hex: "#2b2a8f"), Color(hex: "#6d4fd8"), Color(hex: "#f29a14")], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 30))
            ))
        }
        if let polls = s.polls, !polls.isEmpty {
            out.append(AnyView(DuoPanel(eyebrow: "Vote", title: "Open polls") {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(polls) { p in
                        HStack(spacing: 14) {
                            Image(systemName: "checklist").font(.system(size: 26)).foregroundStyle(Duo.violet)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(p.question).font(.system(size: 24, weight: .bold)).foregroundStyle(Duo.ink).lineLimit(1)
                                Text(pollLine(p))
                                    .font(.system(size: 18)).foregroundStyle(Duo.muted)
                            }
                        }
                        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(hex: "#f8fafc"), in: RoundedRectangle(cornerRadius: 18))
                    }
                }
            }))
        }
        if let goals = s.goals, !goals.isEmpty {
            out.append(AnyView(DuoPanel(eyebrow: "Goals", title: "In progress") {
                VStack(alignment: .leading, spacing: 18) {
                    ForEach(goals) { g in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text(g.title).font(.system(size: 22, weight: .bold)).foregroundStyle(Color(hex: "#334155")).lineLimit(1)
                                Spacer()
                                Text("\(Int((g.progress * 100).rounded()))%").font(.system(size: 22, weight: .black)).foregroundStyle(Duo.violet)
                            }
                            ProgressView(value: g.progress).tint(Duo.violet)
                        }
                    }
                }
            }))
        }
        if let stars = s.stars, !stars.isEmpty {
            out.append(AnyView(DuoPanel(eyebrow: "Stars", title: "Kids' stars") {
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(stars) { k in
                        HStack(spacing: 14) {
                            DuoAvatar(person: DuoPerson(name: k.name, emoji: k.emoji, color: k.color))
                            Text(k.name).font(.system(size: 24, weight: .bold)).foregroundStyle(Duo.ink)
                            Spacer()
                            Label("\(k.stars)", systemImage: "star.fill").font(.system(size: 26, weight: .black)).foregroundStyle(Color(hex: "#d97706"))
                        }
                    }
                }
            }))
        }
        if s.on(\.money, else: false) {
            let bills = s.bills ?? []
            out.append(AnyView(DuoPanel(eyebrow: "Bills", title: "Due soon") {
                VStack(alignment: .leading, spacing: 14) {
                    if bills.isEmpty { DuoEmpty(text: "No bills due in the next week.") }
                    ForEach(bills) { b in
                        HStack(spacing: 12) {
                            Circle().fill(b.late ? Duo.rose : Duo.amber).frame(width: 12, height: 12)
                            Text(b.name).font(.system(size: 24, weight: .semibold)).foregroundStyle(Duo.ink).lineLimit(1)
                            Spacer()
                            Text(b.late ? "Past due" : b.due == s.day ? "Today" : shortDay(b.due)).font(.system(size: 20, weight: .bold)).foregroundStyle(b.late ? Duo.rose : Duo.muted)
                            Text(b.amount).font(.system(size: 22, weight: .black)).foregroundStyle(Duo.ink).frame(minWidth: 110, alignment: .trailing)
                        }
                    }
                    if let p = s.billsPaid, p.total > 0 {
                        Divider().padding(.vertical, 4)
                        Text("Paid this month").font(.system(size: 18, weight: .bold)).foregroundStyle(Duo.muted)
                        ProgressView(value: Double(p.paid), total: Double(p.total)).tint(Duo.green)
                    }
                }
            }))
        }
        if let notes = s.notes, !notes.isEmpty {
            out.append(AnyView(DuoPanel(eyebrow: "Pinned", title: "Notes", symbol: "note.text") {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(notes) { n in
                        VStack(alignment: .leading, spacing: 4) {
                            if !n.title.isEmpty { Text(n.title).font(.system(size: 24, weight: .black)).foregroundStyle(Duo.ink).lineLimit(1) }
                            if !n.body.isEmpty { Text(n.body).font(.system(size: 20)).foregroundStyle(Color(hex: "#475569")).lineLimit(3) }
                        }
                        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(hex: n.color), in: RoundedRectangle(cornerRadius: 18))
                    }
                }
            }))
        }
        return out
    }
}

struct DuoEventRow: View {
    let e: DuoTVSummary.Event
    var body: some View {
        HStack(spacing: 18) {
            Text(e.time.isEmpty ? "All day" : prettyTime(e.time)).font(.system(size: 20, weight: .black)).foregroundStyle(Color(hex: "#7c3aed"))
                .frame(width: 120, alignment: .leading)
            RoundedRectangle(cornerRadius: 3).fill(Color(hex: e.color ?? "#94a3b8")).frame(width: 6, height: 50)
            VStack(alignment: .leading, spacing: 2) {
                Text(e.title).font(.system(size: 24, weight: .bold)).foregroundStyle(Duo.ink).lineLimit(1)
                if !e.location.isEmpty { Text(e.location).font(.system(size: 18)).foregroundStyle(Duo.muted).lineLimit(1) }
            }
            Spacer(minLength: 8)
            HStack(spacing: -10) { ForEach(Array((e.people ?? []).enumerated()), id: \.offset) { DuoAvatar(person: $0.element, size: 38) } }
        }
        .padding(16)
        .background(.white, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color(hex: "#f1f5f9"), lineWidth: 2))
    }
}

struct DuoTaskRow: View {
    let t: DuoTVSummary.Task
    let today: String
    var showList = false
    private var when: String {
        let day: String = t.due.isEmpty ? "Anytime" : t.due == today ? "Today" : prettyDay(t.due, .dateTime.weekday(.abbreviated).month(.abbreviated).day())
        if t.time.isEmpty { return day }
        let prefix: String = (t.due.isEmpty || t.due == today) ? "" : shortDay(t.due) + " · "
        return prefix + prettyTime(t.time)
    }
    var body: some View {
        let overdue = !t.due.isEmpty && t.due < today
        HStack(spacing: 18) {
            DuoCheck()
            VStack(alignment: .leading, spacing: 2) {
                Text(t.title).font(.system(size: 24, weight: .semibold)).foregroundStyle(Duo.ink).lineLimit(2)
                HStack(spacing: 0) {
                    if overdue { Text("Overdue · \(shortDay(t.due))").foregroundStyle(Duo.rose) }
                    else { Text(when).foregroundStyle(Duo.muted) }
                    let extra = [t.who, showList ? t.list : ""].filter { !$0.isEmpty }.joined(separator: " · ")
                    if !extra.isEmpty { Text(" · " + extra).foregroundStyle(Duo.muted) }
                }
                .font(.system(size: 18, weight: .semibold))
            }
            Spacer(minLength: 0)
            if t.priority == "high" { Image(systemName: "flag.fill").font(.system(size: 22)).foregroundStyle(Duo.rose) }
        }
        .padding(16)
        .background(.white, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color(hex: "#f1f5f9"), lineWidth: 2))
    }
}

// MARK: - Tasks (components/family-hub/LifeTasksScreen.tsx)

struct DuoTVTasks: View {
    @EnvironmentObject var model: DuoTVModel
    @State private var list: String? = nil

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 30) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("TO-DO").font(.system(size: 22, weight: .heavy)).tracking(4.4).foregroundStyle(Duo.eyebrow)
                    (Text("Tasks").foregroundStyle(Duo.ink) + Text(".").foregroundStyle(Duo.violet)).font(.system(size: 76, weight: .black))
                }
                if let s = model.summary {
                    chips(s)
                    let shown = s.tasks.filter { list == nil || $0.listId == list }
                    let overdue = shown.filter { !$0.due.isEmpty && $0.due < s.day }
                    let today = shown.filter { $0.due == s.day }
                    let soon = shown.filter { $0.due > s.day }
                    let anytime = shown.filter { $0.due.isEmpty }
                    if shown.isEmpty { DuoEmpty(text: "Nothing to do here. Enjoy the day.").padding(.top, 20) }
                    HStack(alignment: .top, spacing: 30) {
                        column("Overdue", overdue, s.day, tint: Duo.rose)
                        column("Today", today, s.day, tint: Duo.violet)
                        column("Coming up", soon, s.day, tint: Color(hex: "#0284c7"))
                        column("Anytime", anytime, s.day, tint: Duo.muted)
                    }
                    if s.on(\.chores), !s.chores.isEmpty {
                        DuoPanel(eyebrow: "Chores", title: s.choresLeft > 0 ? "\(s.choresLeft) left today" : "All chores done! 🎉") {
                            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14), count: 3), spacing: 14) {
                                ForEach(s.chores) { c in
                                    Button { } label: {
                                        HStack(spacing: 14) {
                                            DuoCheck(done: c.done)
                                            Text(c.title).font(.system(size: 24, weight: .semibold)).strikethrough(c.done).foregroundStyle(Duo.ink).lineLimit(1)
                                            Spacer(minLength: 4)
                                            if !c.who.isEmpty { DuoAvatar(person: DuoPerson(name: c.who, emoji: c.emoji, color: c.color), size: 40) }
                                            if c.points > 0 { Text("+\(c.points) ⭐").font(.system(size: 18, weight: .bold)).foregroundStyle(Color(hex: "#d97706")) }
                                        }
                                        .padding(16)
                                        .background(c.done ? Color(hex: "#ecfdf5") : .white, in: RoundedRectangle(cornerRadius: 18))
                                    }
                                    .buttonStyle(DuoLift(radius: 18))
                                }
                            }
                        }
                    }
                } else { ProgressView().frame(maxWidth: .infinity).padding(80) }
            }
            .padding(.horizontal, 90).padding(.top, 50).padding(.bottom, 200)
        }
        .scrollClipDisabled()
    }

    private func chips(_ s: DuoTVSummary) -> some View {
        ScrollView(.horizontal) {
            HStack(spacing: 16) {
                chip("All", count: s.tasks.count, id: nil)
                ForEach(s.lists ?? []) { l in
                    let n = s.tasks.filter { $0.listId == l.id }.count
                    if n > 0 { chip(l.name, count: n, id: l.id) }
                }
            }
            .padding(.vertical, 16)
        }
        .scrollClipDisabled()
    }

    private func chip(_ name: String, count: Int, id: String?) -> some View {
        Button { list = id } label: {
            Text("\(name)  \(count)").font(.system(size: 24, weight: .bold))
                .foregroundStyle(list == id ? .white : Duo.ink)
                .padding(.horizontal, 28).padding(.vertical, 14)
                .background(list == id ? Duo.bar : .white, in: Capsule())
                .overlay(Capsule().stroke(Duo.line, lineWidth: 2))
        }
        .buttonStyle(DuoLift(radius: 40))
    }

    @ViewBuilder private func column(_ title: String, _ items: [DuoTVSummary.Task], _ today: String, tint: Color) -> some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text(title).font(.system(size: 30, weight: .bold)).foregroundStyle(tint)
                    Text("\(items.count)").font(.system(size: 22, weight: .black)).foregroundStyle(Duo.muted)
                }
                ForEach(items) { t in
                    Button { } label: { DuoTaskRow(t: t, today: today, showList: list == nil) }.buttonStyle(DuoLift(radius: 18))
                }
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
    }
}

// MARK: - Calendar: the week, a column a day

struct DuoTVWeek: View {
    @EnvironmentObject var model: DuoTVModel
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 30) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("THE NEXT 7 DAYS").font(.system(size: 22, weight: .heavy)).tracking(4.4).foregroundStyle(Duo.eyebrow)
                    (Text("Calendar").foregroundStyle(Duo.ink) + Text(".").foregroundStyle(Duo.violet)).font(.system(size: 76, weight: .black))
                }
                if let s = model.summary {
                    HStack(alignment: .top, spacing: 18) {
                        ForEach(0..<7, id: \.self) { i in day(addDays(s.day, i), s) }
                    }
                } else { ProgressView().frame(maxWidth: .infinity).padding(80) }
            }
            .padding(.horizontal, 70).padding(.top, 50).padding(.bottom, 200)
        }
        .scrollClipDisabled()
    }

    private func day(_ d: String, _ s: DuoTVSummary) -> some View {
        let events = s.events.filter { $0.date == d }
        let tasks = s.tasks.filter { $0.due == d }
        let isToday = d == s.day
        return Button { } label: {
            VStack(alignment: .leading, spacing: 12) {
                Text(prettyDay(d, .dateTime.weekday(.abbreviated)).uppercased()).font(.system(size: 18, weight: .heavy)).tracking(2)
                    .foregroundStyle(isToday ? .white.opacity(0.8) : Duo.violet)
                Text(prettyDay(d, .dateTime.day())).font(.system(size: 46, weight: .black)).foregroundStyle(isToday ? .white : Duo.ink)
                if events.isEmpty && tasks.isEmpty { Text("Free").font(.system(size: 18)).foregroundStyle(isToday ? .white.opacity(0.7) : Duo.faint) }
                ForEach(events) { e in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(e.time.isEmpty ? "All day" : prettyTime(e.time)).font(.system(size: 15, weight: .black)).foregroundStyle(Color(hex: e.color ?? "#7c3aed"))
                        Text(e.title).font(.system(size: 19, weight: .bold)).foregroundStyle(Duo.ink).lineLimit(2)
                    }
                    .padding(10).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(hex: e.color ?? "#7c3aed").opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                    .background(.white, in: RoundedRectangle(cornerRadius: 12))
                }
                ForEach(tasks) { t in
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "circle").font(.system(size: 16, weight: .bold)).foregroundStyle(isToday ? .white : Duo.faint)
                        Text(t.title).font(.system(size: 18, weight: .semibold)).foregroundStyle(isToday ? .white : Duo.ink).lineLimit(2)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(18)
            .frame(maxWidth: .infinity, minHeight: 560, alignment: .topLeading)
            .background(isToday ? Duo.bar : .white, in: RoundedRectangle(cornerRadius: 24))
            .overlay(RoundedRectangle(cornerRadius: 24).stroke(Duo.line, lineWidth: isToday ? 0 : 2))
        }
        .buttonStyle(DuoLift(radius: 24))
    }
}

// MARK: - You

struct DuoTVYou: View {
    @EnvironmentObject var model: DuoTVModel
    @State private var confirm = false
    var body: some View {
        VStack(spacing: 34) {
            let name = model.summary?.name ?? ""
            Text(String(name.prefix(1)).uppercased().isEmpty ? "Y" : String(name.prefix(1)).uppercased())
                .font(.system(size: 64, weight: .black)).foregroundStyle(.white)
                .frame(width: 140, height: 140).background(Color(hex: "#292446"), in: Circle())
            VStack(spacing: 6) {
                Text(name.isEmpty ? "You" : name).font(.system(size: 48, weight: .black)).foregroundStyle(Duo.ink)
                Text("Signed in on this TV").font(.system(size: 24)).foregroundStyle(Duo.muted)
                if let u = model.updated { Text("Updated \(u.formatted(date: .omitted, time: .shortened))").font(.system(size: 22)).foregroundStyle(Duo.faint) }
            }
            VStack(spacing: 18) {
                row("Refresh now", "arrow.clockwise", Duo.ink) { Task { await model.load() } }
                row("Sign out of this TV", "rectangle.portrait.and.arrow.right", Duo.rose) { confirm = true }
            }
            .frame(width: 760)
            Text("Change tasks, chores and your family on your phone or at arisetodo.com. They show up here within two minutes.")
                .font(.system(size: 22)).foregroundStyle(Duo.muted).multilineTextAlignment(.center).frame(width: 900)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.bottom, 160)
        .alert("Sign out of this TV?", isPresented: $confirm) {
            Button("Sign out", role: .destructive) { model.signOut() }
            Button("Cancel", role: .cancel) { }
        }
    }
    private func row(_ label: String, _ symbol: String, _ tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 20) {
                Image(systemName: symbol).font(.system(size: 28, weight: .semibold))
                Text(label).font(.system(size: 28, weight: .semibold))
                Spacer()
            }
            .foregroundStyle(tint)
            .padding(.horizontal, 30).frame(height: 90)
            .background(.white, in: RoundedRectangle(cornerRadius: 22))
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(Duo.line, lineWidth: 2))
        }
        .buttonStyle(DuoLift(radius: 22))
    }
}

// MARK: - Sign in

struct DuoTVSignIn: View {
    @EnvironmentObject var model: DuoTVModel
    var body: some View {
        ZStack {
            Duo.page.ignoresSafeArea()
            HStack(spacing: 90) {
                VStack(alignment: .leading, spacing: 22) {
                    Text("ARISE DUO").font(.system(size: 24, weight: .heavy)).tracking(4.8).foregroundStyle(Duo.eyebrow)
                    (Text("Your family's day, on the TV").foregroundStyle(Duo.ink) + Text(".").foregroundStyle(Duo.violet))
                        .font(.system(size: 72, weight: .black)).fixedSize(horizontal: false, vertical: true)
                    Text("Tasks, chores, the calendar and everything on your Home, laid out just like the app on your phone.")
                        .font(.system(size: 28)).foregroundStyle(Duo.muted)
                }
                .frame(maxWidth: 760, alignment: .leading)

                VStack(spacing: 26) {
                    if let code = model.code {
                        Text("Sign in with your phone").font(.system(size: 34, weight: .bold)).foregroundStyle(Duo.ink)
                        if let qr = DuoQR.image("https://arisetodo.com/tv?code=\(code)") {
                            Image(uiImage: qr).interpolation(.none).resizable().frame(width: 260, height: 260)
                            Text("Point your phone's camera here, or go to").font(.system(size: 22)).foregroundStyle(Duo.muted)
                        } else {
                            Text("On your phone or computer, go to").font(.system(size: 22)).foregroundStyle(Duo.muted)
                        }
                        Text("arisetodo.com/tv").font(.system(size: 46, weight: .black)).foregroundStyle(Duo.violet)
                        Text("and type this code").font(.system(size: 22)).foregroundStyle(Duo.muted)
                        Text(code.map(String.init).joined(separator: " ")).font(.system(size: 84, weight: .heavy, design: .monospaced)).foregroundStyle(Duo.ink)
                        HStack(spacing: 12) { ProgressView(); Text("Waiting for your phone…").font(.system(size: 20)).foregroundStyle(Duo.faint) }
                    } else if let e = model.error {
                        Text(e).font(.system(size: 26, weight: .semibold)).foregroundStyle(Duo.rose).multilineTextAlignment(.center)
                        Button("Try again") { Task { await model.startSignIn() } }
                    } else {
                        ProgressView()
                    }
                }
                .padding(56)
                .frame(width: 700)
                .background(.white, in: RoundedRectangle(cornerRadius: 40))
                .overlay(RoundedRectangle(cornerRadius: 40).stroke(Duo.line, lineWidth: 2))
                .shadow(color: Color(hex: "#17152b").opacity(0.08), radius: 30, y: 12)
            }
            .padding(80)
        }
        .task { await model.startSignIn() }
    }
}

/** A QR code for the sign-in page with this TV's code in it. */
enum DuoQR {
    static func image(_ text: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let out = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 10, y: 10)),
              let cg = CIContext().createCGImage(out, from: out.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}

// MARK: - A made-up family for the simulator screenshots (-duoSample YES)

func duoSampleJSON(_ day: String) -> String {
    let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
    let base = f.date(from: day) ?? Date()
    func d(_ n: Int) -> String { f.string(from: Calendar.current.date(byAdding: .day, value: n, to: base) ?? base) }
    return """
    {"name":"Jeremy Smith","day":"\(day)",
     "members":[{"id":"m1","name":"Jeremy","emoji":"🧔","color":"#6366f1"},{"id":"m2","name":"Ava","emoji":"🦄","color":"#ec4899"},{"id":"m3","name":"Leo","emoji":"🦖","color":"#10b981"}],
     "lists":[{"id":"home","name":"Home"},{"id":"school","name":"School"},{"id":"errands","name":"Errands"}],
     "tasks":[
      {"id":"t1","title":"Renew car registration","due":"\(d(-2))","time":"","list":"Errands","who":"Jeremy","listId":"errands","priority":"high"},
      {"id":"t2","title":"Take out the recycling","due":"\(day)","time":"19:00","list":"Home","who":"Leo","listId":"home","priority":"normal"},
      {"id":"t3","title":"Sign Ava's field trip form","due":"\(day)","time":"","list":"School","who":"Jeremy","listId":"school","priority":"normal"},
      {"id":"t4","title":"Grocery run: milk, eggs, apples","due":"\(day)","time":"17:30","list":"Errands","who":"","listId":"errands","priority":"normal"},
      {"id":"t5","title":"Science project poster","due":"\(d(2))","time":"","list":"School","who":"Ava","listId":"school","priority":"normal"},
      {"id":"t6","title":"Call the dentist","due":"\(d(3))","time":"10:00","list":"Home","who":"Jeremy","listId":"home","priority":"normal"},
      {"id":"t7","title":"Fix the porch light","due":"","time":"","list":"Home","who":"","listId":"home","priority":"normal"}],
     "events":[
      {"date":"\(day)","title":"Soccer practice","time":"16:00","endTime":"17:30","location":"Riverside Park","who":["Leo"],"color":"#10b981","people":[{"name":"Leo","emoji":"🦖","color":"#10b981"}]},
      {"date":"\(day)","title":"Family movie night","time":"19:30","endTime":"","location":"Living room","who":["Jeremy","Ava","Leo"],"color":"#7566e8","people":[{"name":"Jeremy","emoji":"🧔","color":"#6366f1"},{"name":"Ava","emoji":"🦄","color":"#ec4899"},{"name":"Leo","emoji":"🦖","color":"#10b981"}]},
      {"date":"\(d(1))","title":"Piano lesson","time":"15:30","endTime":"","location":"","who":["Ava"],"color":"#ec4899","people":[]},
      {"date":"\(d(3))","title":"Parent-teacher night","time":"18:00","endTime":"","location":"Lincoln Elementary","who":["Jeremy"],"color":"#f59e0b","people":[]},
      {"date":"\(d(5))","title":"Grandma's birthday","time":"","endTime":"","location":"","who":[],"color":"#e11d48","people":[]}],
     "chores":[
      {"id":"c1","title":"Feed the dog","who":"Leo","emoji":"🦖","color":"#10b981","points":2,"done":true},
      {"id":"c2","title":"Unload dishwasher","who":"Ava","emoji":"🦄","color":"#ec4899","points":3,"done":false},
      {"id":"c3","title":"Make your bed","who":"Leo","emoji":"🦖","color":"#10b981","points":1,"done":false},
      {"id":"c4","title":"Water the plants","who":"","emoji":"","color":"","points":1,"done":false}],
     "sections":{"calendar":true,"chores":true,"money":true,"polls":true,"trips":true,"goals":true,"stars":true,"notes":true},
     "bills":[{"name":"Electric","amount":"$142","due":"\(d(2))","late":false},{"name":"Internet","amount":"$65","due":"\(d(-1))","late":true}],
     "billsPaid":{"paid":4,"total":7},
     "stars":[{"name":"Ava","emoji":"🦄","color":"#ec4899","stars":24},{"name":"Leo","emoji":"🦖","color":"#10b981","stars":17}],
     "polls":[{"question":"What's for dinner Friday?","leading":"Pizza night","waiting":1}],
     "trip":{"name":"Grand Canyon","start":"\(d(12))","daysToGo":12,"packed":9,"packing":20},
     "goals":[{"title":"Read 20 books this year","progress":0.65},{"title":"Save for a new bike","progress":0.4}],
     "notes":[{"title":"Wi-Fi","body":"Network: SmithHouse · ask Dad for the password","color":"#fef3c7"}]}
    """
}
