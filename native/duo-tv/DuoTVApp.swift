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
    /** Arise WorkHub's teal. */
    static let teal = Color(hex: "#0d9488")
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
    // The LifeHub apps the TV has pages for (Apps tab), and where the weather is for.
    var apps: Apps? = nil
    var weather: WeatherPlace? = nil

    struct WeatherPlace: Decodable { let place: String; let unit: String }
    struct Apps: Decodable {
        struct Grocery: Decodable, Identifiable { var id: String { name + qty + aisle }; let name: String; let qty: String; let aisle: String }
        struct MealDay: Decodable, Identifiable { var id: String { date }; let date: String; let meals: [Meal] }
        struct Meal: Decodable, Identifiable { var id: String { slot + text }; let slot: String; let text: String }
        struct Countdown: Decodable, Identifiable { var id: String { title + date }; let title: String; let date: String; let days: Int; let emoji: String; let color: String }
        struct Birthday: Decodable, Identifiable { var id: String { name + date }; let name: String; let date: String; let days: Int; let kind: String; let turns: Int }
        struct Habit: Decodable, Identifiable { var id: String { name }; let name: String; let emoji: String; let color: String; let week: [Bool]; let today: Bool }
        struct Routine: Decodable, Identifiable { var id: String { name }; let name: String; let emoji: String; let steps: [Step] }
        struct Step: Decodable, Identifiable { var id: String { text }; let text: String; let done: Bool }
        let grocery: [Grocery]?
        let meals: [MealDay]?
        let countdowns: [Countdown]?
        let birthdays: [Birthday]?
        let habits: [Habit]?
        let routines: [Routine]?
    }

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
    /** Arise WorkHub's side, for teachers (GET /api/tv/work). */
    @Published var work: DuoWorkSummary?
    @Published var hub: DuoHub = DuoHub(rawValue: UserDefaults.standard.string(forKey: "duoHub") ?? "") ?? .life {
        didSet { UserDefaults.standard.set(hub.rawValue, forKey: "duoHub") }
    }
    @Published var weather: DuoWeather?
    private var poll: String?

    /** What the screens show: the family's LifeHub, or the teacher's WorkHub laid out the same way. */
    var shown: DuoTVSummary? { hub == .work ? work?.asSummary : summary }
    var workAvailable: Bool { work != nil }

    nonisolated static func today() -> String { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date()) }

    /** Launched with -duoSample YES (the simulator screenshots in companions-sim.yml): a made-up family, no account. */
    static let sample = UserDefaults.standard.bool(forKey: "duoSample")

    func load() async {
        guard let token else { return }
        if Self.sample {
            summary = try? JSONDecoder().decode(DuoTVSummary.self, from: Data(duoSampleJSON(Self.today()).utf8))
            work = try? JSONDecoder().decode(DuoWorkSummary.self, from: Data(duoWorkSampleJSON(Self.today()).utf8))
            weather = try? JSONDecoder().decode(DuoWeather.self, from: Data(duoWeatherSampleJSON(Self.today()).utf8))
            if let h = UserDefaults.standard.string(forKey: "duoHubShot"), let v = DuoHub(rawValue: h) { hub = v }
            updated = Date(); return
        }
        async let workPart: Void = loadWork(token)
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
            if let w = summary?.weather { await loadWeather(token, w) }
        } catch {
            self.error = "Can't reach Arise Duo. Check the TV's internet connection."
        }
        _ = await workPart
    }

    /** The teacher's WorkHub; nothing (and no Work switch) for anyone else. */
    private func loadWork(_ token: String) async {
        var req = URLRequest(url: duoAPI.appending(path: "/api/tv/work").appending(queryItems: [URLQueryItem(name: "day", value: Self.today())]))
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.cachePolicy = .reloadIgnoringLocalCacheData
        guard let (data, res) = try? await URLSession.shared.data(for: req), (res as? HTTPURLResponse)?.statusCode == 200 else { return }
        if let w = try? JSONDecoder().decode(DuoWorkSummary.self, from: data), w.available { work = w } else { work = nil; if hub == .work { hub = .life } }
    }

    private func loadWeather(_ token: String, _ w: DuoTVSummary.WeatherPlace) async {
        var req = URLRequest(url: duoAPI.appending(path: "/api/lifehub/weather").appending(queryItems: [URLQueryItem(name: "place", value: w.place), URLQueryItem(name: "unit", value: w.unit)]))
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        guard let (data, res) = try? await URLSession.shared.data(for: req), (res as? HTTPURLResponse)?.statusCode == 200 else { return }
        weather = try? JSONDecoder().decode(DuoWeather.self, from: data)
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
    func makeBody(configuration: Configuration) -> some View { Look(configuration: configuration, radius: radius) }
    private struct Look: View {
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

enum DuoTab: String, CaseIterable { case home, tasks, calendar, apps, you }
enum DuoHub: String { case life, work }

struct DuoTVRoot: View {
    @EnvironmentObject var model: DuoTVModel
    @State private var tab: DuoTab = DuoTab(rawValue: UserDefaults.standard.string(forKey: "duoTab") ?? "") ?? .home
    private let refresh = Timer.publish(every: 120, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack(alignment: .bottom) {
            Duo.page.ignoresSafeArea()
            Group {
                switch tab {
                case .home: if model.hub == .work { DuoTVWorkHome(go: { tab = $0 }) } else { DuoTVHome(go: { tab = $0 }) }
                case .tasks: DuoTVTasks()
                case .calendar: DuoTVWeek()
                case .apps: if model.hub == .work { DuoTVCaseload() } else { DuoTVApps() }
                case .you: DuoTVYou()
                }
            }
            .focusSection()
            .id(model.hub)
            DuoTabBar(tab: $tab, hub: $model.hub, workAvailable: model.workAvailable, initial: String((model.summary?.name ?? "").prefix(1)).uppercased())
                .focusSection()
                .padding(.bottom, 30)
        }
        .task { await model.load() }
        .onReceive(refresh) { _ in Task { await model.load() } }
    }
}

struct DuoTabBar: View {
    @Binding var tab: DuoTab
    @Binding var hub: DuoHub
    let workAvailable: Bool
    let initial: String
    private var accent: Color { hub == .work ? Duo.teal : Duo.barButton }
    var body: some View {
        HStack(spacing: 8) {
            // Life and Work, like the hub switch on the phone (only for someone with Arise WorkHub).
            if workAvailable {
                HStack(spacing: 4) {
                    hubButton(.life, "Life", "heart.fill")
                    hubButton(.work, "Work", "briefcase.fill")
                }
                .padding(4).background(.white.opacity(0.08), in: Capsule())
                .padding(.trailing, 10)
            }
            item(.home, "Home", "house")
            item(.tasks, "Tasks", "checkmark.square")
            item(.calendar, "Calendar", "calendar")
            if hub == .work { item(.apps, "Caseload", "person.2") } else { item(.apps, "Apps", "square.grid.2x2") }
            Button { tab = .you } label: {
                VStack(spacing: 6) {
                    Text(initial.isEmpty ? "Y" : initial).font(.system(size: 20, weight: .black)).foregroundStyle(Duo.bar)
                        .frame(width: 38, height: 38).background(.white, in: Circle())
                    Text("You").font(.system(size: 20, weight: .semibold))
                }
            }
            .buttonStyle(DuoTabStyle(active: tab == .you, accent: accent))
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(Duo.bar, in: Capsule())
        .overlay(Capsule().stroke(.white.opacity(0.1), lineWidth: 1))
        .shadow(color: Color(hex: "#16152a").opacity(0.35), radius: 30, y: 14)
    }
    private func hubButton(_ h: DuoHub, _ label: String, _ symbol: String) -> some View {
        Button { hub = h } label: {
            VStack(spacing: 6) {
                Image(systemName: symbol).font(.system(size: 28, weight: .semibold)).frame(height: 38)
                Text(label).font(.system(size: 20, weight: .bold))
            }
        }
        .buttonStyle(DuoTabStyle(active: hub == h, accent: h == .work ? Duo.teal : Duo.barButton, width: 120))
    }
    private func item(_ t: DuoTab, _ label: String, _ symbol: String) -> some View {
        Button { tab = t } label: {
            VStack(spacing: 6) {
                Image(systemName: tab == t ? symbol + ".fill" : symbol).font(.system(size: 32, weight: .semibold)).frame(height: 38)
                Text(label).font(.system(size: 20, weight: .semibold))
            }
        }
        .buttonStyle(DuoTabStyle(active: tab == t, accent: accent))
    }
}

struct DuoTabStyle: ButtonStyle {
    let active: Bool
    var accent: Color = Duo.barButton
    var width: CGFloat = 150
    func makeBody(configuration: Configuration) -> some View { Look(configuration: configuration, active: active, accent: accent, width: width) }
    private struct Look: View {
        let configuration: Configuration
        let active: Bool
        let accent: Color
        let width: CGFloat
        @Environment(\.isFocused) private var focused
        var body: some View {
            configuration.label
                .foregroundStyle(focused ? Duo.bar : active ? .white : .white.opacity(0.6))
                .frame(width: width, height: 96)
                .background(focused ? Color.white : active ? accent : .clear, in: Capsule())
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
        if let w = model.weather {
            let now = DuoWeather.look(w.current.code)
            out.append(AnyView(DuoPanel(eyebrow: "Weather", title: w.place.components(separatedBy: ",").first ?? w.place) {
                HStack(spacing: 24) {
                    Image(systemName: now.0).symbolRenderingMode(.multicolor).font(.system(size: 80))
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(Int(w.current.temp.rounded()))°").font(.system(size: 72, weight: .black)).foregroundStyle(Duo.ink)
                        Text(now.1).font(.system(size: 22, weight: .semibold)).foregroundStyle(Duo.muted)
                        if let t = w.days.first { Text("H \(Int(t.high.rounded()))°  L \(Int(t.low.rounded()))°").font(.system(size: 20)).foregroundStyle(Duo.faint) }
                    }
                }
            }))
        }
        if let today = s.apps?.meals?.first, !today.meals.isEmpty {
            out.append(AnyView(DuoPanel(eyebrow: "Meal plan", title: "Today's meals", symbol: "fork.knife", symbolTint: Color(hex: "#ea580c")) {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(today.meals) { m in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(m.slot.uppercased()).font(.system(size: 16, weight: .heavy)).foregroundStyle(Color(hex: "#ea580c"))
                            Text(m.text).font(.system(size: 26, weight: .bold)).foregroundStyle(Duo.ink).lineLimit(2)
                        }
                    }
                }
            }))
        }
        if let c = s.apps?.countdowns?.first {
            out.append(AnyView(DuoPanel(eyebrow: "Countdown", title: c.title) {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Text("\(c.days)").font(.system(size: 96, weight: .black)).foregroundStyle(Color(hex: c.color.isEmpty ? "#7c3aed" : c.color))
                    Text(c.days == 1 ? "day to go" : "days to go").font(.system(size: 26, weight: .bold)).foregroundStyle(Duo.muted)
                }
            }))
        }
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
                if let s = model.shown {
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
                if let s = model.shown {
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
            let name = model.summary?.name ?? model.work?.name ?? ""
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
     "notes":[{"title":"Wi-Fi","body":"Network: SmithHouse · ask Dad for the password","color":"#fef3c7"}],
     "weather":{"place":"Denver, CO","unit":"F"},
     "apps":{"grocery":[{"name":"Milk","qty":"1 gal","aisle":"Dairy"},{"name":"Eggs","qty":"18","aisle":"Dairy"},{"name":"Apples","qty":"6","aisle":"Produce"},{"name":"Spinach","qty":"","aisle":"Produce"},{"name":"Pasta","qty":"2 boxes","aisle":"Pantry"},{"name":"Tortillas","qty":"","aisle":"Pantry"}],
      "meals":[{"date":"\(day)","meals":[{"slot":"dinner","text":"Chicken tacos"}]},{"date":"\(d(1))","meals":[{"slot":"breakfast","text":"Pancakes"},{"slot":"dinner","text":"Spaghetti and meatballs"}]},{"date":"\(d(2))","meals":[{"slot":"dinner","text":"Sheet-pan salmon"}]},{"date":"\(d(3))","meals":[]},{"date":"\(d(4))","meals":[{"slot":"dinner","text":"Pizza night"}]},{"date":"\(d(5))","meals":[]},{"date":"\(d(6))","meals":[{"slot":"lunch","text":"Grilled cheese and soup"}]}],
      "countdowns":[{"title":"Grand Canyon trip","date":"\(d(12))","days":12,"emoji":"🏜️","color":"#ea580c"},{"title":"Winter break","date":"\(d(40))","days":40,"emoji":"❄️","color":"#0284c7"}],
      "birthdays":[{"name":"Grandma Rose","date":"\(d(5))","days":5,"kind":"birthday","turns":78},{"name":"Mom & Dad","date":"\(d(21))","days":21,"kind":"anniversary","turns":15}],
      "habits":[{"name":"Read 20 minutes","emoji":"📚","color":"#7c3aed","week":[true,true,false,true,true,true,false],"today":false},{"name":"Drink water","emoji":"💧","color":"#0284c7","week":[true,true,true,true,false,true,true],"today":true}],
      "routines":[{"name":"Bedtime","emoji":"🌙","steps":[{"text":"Brush teeth","done":true},{"text":"Pajamas","done":true},{"text":"Pick out clothes","done":false},{"text":"Read a story","done":false}]}]}}
    """
}

// MARK: - Arise WorkHub on the TV (GET /api/tv/work, server/tvLink.ts tvWorkSummary)

struct DuoWorkSummary: Decodable {
    struct Meeting: Decodable, Identifiable { var id: String { date + time + student + type }; let student: String; let type: String; let date: String; let time: String; let room: String }
    struct Slot: Decodable, Identifiable { var id: String { start + student + label }; let student: String; let start: String; let end: String; let label: String }
    struct Due: Decodable, Identifiable { var id: String { what + student + date }; let what: String; let student: String; let date: String; let days: Int }
    struct Lesson: Decodable, Identifiable { var id: String { date + title + group }; let title: String; let subject: String; let group: String; let date: String }
    struct ListRef: Decodable { let id: String; let name: String; let color: String }
    let available: Bool
    let name: String?
    let day: String?
    let school: String?
    let tasks: [DuoTVSummary.Task]?
    let lists: [ListRef]?
    let events: [DuoTVSummary.Event]?
    let meetings: [Meeting]?
    let schedule: [Slot]?
    let dueSoon: [Due]?
    let lessons: [Lesson]?
    let students: Int?
    let dueToday: Int?

    /** The same shape as LifeHub's, so Tasks and Calendar show work the same way. */
    var asSummary: DuoTVSummary {
        DuoTVSummary(name: name ?? "", day: day ?? DuoTVModel.today(), tasks: tasks ?? [], events: events ?? [], chores: [],
                     members: nil, lists: (lists ?? []).map { DuoTVSummary.List(id: $0.id, name: $0.name) },
                     sections: DuoTVSummary.Sections(calendar: true, chores: false, money: false, polls: false, trips: false, goals: false, stars: false, notes: false),
                     bills: nil, billsPaid: nil, stars: nil, polls: nil, trip: nil, goals: nil, notes: nil)
    }
}

struct DuoTVWorkHome: View {
    @EnvironmentObject var model: DuoTVModel
    let go: (DuoTab) -> Void
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 36) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(((model.work?.school ?? "").isEmpty ? "ARISE WORKHUB" : (model.work?.school ?? "").uppercased()) + " · " + prettyDay(DuoTVModel.today()).uppercased())
                        .font(.system(size: 22, weight: .heavy)).tracking(4.4).foregroundStyle(Duo.teal)
                    (Text(greeting).foregroundStyle(Duo.ink) + Text(".").foregroundStyle(Duo.teal)).font(.system(size: 76, weight: .black))
                    Text("Here's your school day.").font(.system(size: 28)).foregroundStyle(Duo.muted)
                }
                if let w = model.work {
                    HStack(spacing: 26) {
                        stat("To-dos due", w.dueToday ?? 0, "checklist", "#0d9488", "#f0fdfa") { go(.tasks) }
                        stat("Meetings, 2 weeks", w.meetings?.count ?? 0, "person.2.wave.2", "#7c3aed", "#f5f3ff") { go(.calendar) }
                        stat("Events today", (w.events ?? []).filter { $0.date == w.day }.count, "calendar", "#0284c7", "#f0f9ff") { go(.calendar) }
                        stat("IEPs and re-evals due", w.dueSoon?.count ?? 0, "exclamationmark.circle", "#e11d48", "#fff1f2") { go(.apps) }
                    }
                    HStack(alignment: .top, spacing: 30) {
                        Button { go(.apps) } label: {
                            DuoPanel(eyebrow: "Today", title: "Schedule", symbol: "clock", symbolTint: Duo.teal) {
                                let rows = w.schedule ?? []
                                if rows.isEmpty { DuoEmpty(text: "No students scheduled today.") }
                                VStack(spacing: 12) {
                                    ForEach(rows.prefix(8)) { r in
                                        HStack(spacing: 16) {
                                            Text(prettyTime(r.start)).font(.system(size: 20, weight: .black)).foregroundStyle(Duo.teal).frame(width: 120, alignment: .leading)
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(r.student).font(.system(size: 24, weight: .bold)).foregroundStyle(Duo.ink).lineLimit(1)
                                                if !r.label.isEmpty { Text(r.label).font(.system(size: 18)).foregroundStyle(Duo.muted).lineLimit(1) }
                                            }
                                            Spacer()
                                            if !r.end.isEmpty { Text("until " + prettyTime(r.end)).font(.system(size: 18)).foregroundStyle(Duo.faint) }
                                        }
                                        .padding(14).background(Color(hex: "#f8fafc"), in: RoundedRectangle(cornerRadius: 16))
                                    }
                                }
                            }
                        }.buttonStyle(DuoLift()).frame(maxWidth: .infinity)
                        Button { go(.calendar) } label: {
                            DuoPanel(eyebrow: "Next two weeks", title: "Meetings", symbol: "person.2.wave.2", symbolTint: Color(hex: "#7c3aed")) {
                                let rows = w.meetings ?? []
                                if rows.isEmpty { DuoEmpty(text: "No meetings booked.") }
                                VStack(spacing: 12) {
                                    ForEach(rows.prefix(6)) { m in
                                        HStack(spacing: 16) {
                                            VStack(alignment: .leading, spacing: 0) {
                                                Text(m.date == w.day ? "Today" : prettyDay(m.date, .dateTime.weekday(.abbreviated).month(.abbreviated).day())).font(.system(size: 18, weight: .black)).foregroundStyle(Color(hex: "#7c3aed"))
                                                if !m.time.isEmpty { Text(prettyTime(m.time)).font(.system(size: 18)).foregroundStyle(Duo.muted) }
                                            }
                                            .frame(width: 150, alignment: .leading)
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(m.student).font(.system(size: 24, weight: .bold)).foregroundStyle(Duo.ink).lineLimit(1)
                                                Text([m.type, m.room].filter { !$0.isEmpty }.joined(separator: " · ")).font(.system(size: 18)).foregroundStyle(Duo.muted).lineLimit(1)
                                            }
                                            Spacer(minLength: 0)
                                        }
                                        .padding(14).background(Color(hex: "#f8fafc"), in: RoundedRectangle(cornerRadius: 16))
                                    }
                                }
                            }
                        }.buttonStyle(DuoLift()).frame(maxWidth: .infinity)
                    }
                    HStack(alignment: .top, spacing: 30) {
                        Button { go(.tasks) } label: {
                            DuoPanel(eyebrow: "To-do", title: "Due now", symbol: "checklist", symbolTint: Duo.teal) {
                                let due = w.asSummary.dueTasks
                                if due.isEmpty { DuoEmpty(text: "Nothing due. Nice.") }
                                VStack(spacing: 12) { ForEach(due.prefix(6)) { t in DuoTaskRow(t: t, today: w.day ?? "", showList: true) } }
                            }
                        }.buttonStyle(DuoLift()).frame(maxWidth: .infinity)
                        Button { go(.apps) } label: {
                            DuoPanel(eyebrow: "Caseload", title: "Coming up", symbol: "exclamationmark.circle", symbolTint: Duo.rose) {
                                let rows = w.dueSoon ?? []
                                if rows.isEmpty { DuoEmpty(text: "No IEPs or reevaluations due in the next 45 days.") }
                                VStack(spacing: 12) { ForEach(rows.prefix(6)) { d in DuoDueRow(d: d) } }
                            }
                        }.buttonStyle(DuoLift()).frame(maxWidth: .infinity)
                    }
                    if let lessons = w.lessons, !lessons.isEmpty {
                        Button { } label: {
                            DuoPanel(eyebrow: "This week", title: "Lessons", symbol: "book", symbolTint: Color(hex: "#0284c7")) {
                                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14), count: 3), spacing: 14) {
                                    ForEach(lessons.prefix(9)) { l in
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(prettyDay(l.date, .dateTime.weekday(.wide)).uppercased()).font(.system(size: 16, weight: .heavy)).foregroundStyle(Color(hex: "#0284c7"))
                                            Text(l.title).font(.system(size: 22, weight: .bold)).foregroundStyle(Duo.ink).lineLimit(2)
                                            Text([l.subject, l.group].filter { !$0.isEmpty }.joined(separator: " · ")).font(.system(size: 18)).foregroundStyle(Duo.muted).lineLimit(1)
                                        }
                                        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                                        .background(Color(hex: "#f0f9ff"), in: RoundedRectangle(cornerRadius: 16))
                                    }
                                }
                            }
                        }.buttonStyle(DuoLift())
                    }
                } else { ProgressView().frame(maxWidth: .infinity).padding(80) }
            }
            .padding(.horizontal, 90).padding(.top, 50).padding(.bottom, 200)
        }
        .scrollClipDisabled()
    }
    private var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        let first = (model.work?.name ?? "").split(separator: " ").first.map(String.init) ?? ""
        let part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
        return first.isEmpty ? part : "\(part), \(first)"
    }
    private func stat(_ label: String, _ value: Int, _ symbol: String, _ tint: String, _ chip: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    Text(label).font(.system(size: 22, weight: .bold)).foregroundStyle(Duo.muted).lineLimit(1).minimumScaleFactor(0.8)
                    Spacer()
                    Image(systemName: symbol).font(.system(size: 24, weight: .semibold)).foregroundStyle(Color(hex: tint))
                        .frame(width: 52, height: 52).background(Color(hex: chip), in: RoundedRectangle(cornerRadius: 14))
                }
                Text("\(value)").font(.system(size: 56, weight: .black)).foregroundStyle(Color(hex: "#242238"))
            }
            .padding(30).frame(maxWidth: .infinity, alignment: .leading)
            .background(.white, in: RoundedRectangle(cornerRadius: 26))
            .overlay(RoundedRectangle(cornerRadius: 26).stroke(Duo.line, lineWidth: 2))
        }
        .buttonStyle(DuoLift(radius: 26))
    }
}

struct DuoDueRow: View {
    let d: DuoWorkSummary.Due
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: "exclamationmark").font(.system(size: 20, weight: .black)).foregroundStyle(d.days < 0 ? Duo.rose : Duo.amber)
                .frame(width: 44, height: 44).background((d.days < 0 ? Duo.rose : Duo.amber).opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(d.what).font(.system(size: 22, weight: .bold)).foregroundStyle(Duo.ink)
                Text(d.student + " · " + shortDay(d.date)).font(.system(size: 18)).foregroundStyle(Duo.muted).lineLimit(1)
            }
            Spacer(minLength: 0)
            Text(d.days < 0 ? "\(-d.days) days ago" : d.days == 0 ? "Today" : "in \(d.days) days").font(.system(size: 18, weight: .bold)).foregroundStyle(d.days < 0 ? Duo.rose : Duo.muted)
        }
        .padding(14).background(Color(hex: "#f8fafc"), in: RoundedRectangle(cornerRadius: 16))
    }
}

/** Work's fourth tab: today's schedule, what's due for the caseload, and lessons. */
struct DuoTVCaseload: View {
    @EnvironmentObject var model: DuoTVModel
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 30) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("\(model.work?.students ?? 0) STUDENTS").font(.system(size: 22, weight: .heavy)).tracking(4.4).foregroundStyle(Duo.teal)
                    (Text("Caseload").foregroundStyle(Duo.ink) + Text(".").foregroundStyle(Duo.teal)).font(.system(size: 76, weight: .black))
                }
                if let w = model.work {
                    HStack(alignment: .top, spacing: 30) {
                        VStack(alignment: .leading, spacing: 14) {
                            Text("Coming up").font(.system(size: 30, weight: .bold)).foregroundStyle(Duo.rose)
                            if (w.dueSoon ?? []).isEmpty { DuoEmpty(text: "Nothing due in the next 45 days.") }
                            ForEach(w.dueSoon ?? []) { d in Button { } label: { DuoDueRow(d: d) }.buttonStyle(DuoLift(radius: 16)) }
                        }
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                        VStack(alignment: .leading, spacing: 14) {
                            Text("Today's schedule").font(.system(size: 30, weight: .bold)).foregroundStyle(Duo.teal)
                            if (w.schedule ?? []).isEmpty { DuoEmpty(text: "No students scheduled today.") }
                            ForEach(w.schedule ?? []) { r in
                                Button { } label: {
                                    HStack(spacing: 16) {
                                        Text(prettyTime(r.start) + (r.end.isEmpty ? "" : "–" + prettyTime(r.end))).font(.system(size: 20, weight: .black)).foregroundStyle(Duo.teal).frame(width: 230, alignment: .leading)
                                        Text(r.student).font(.system(size: 24, weight: .bold)).foregroundStyle(Duo.ink).lineLimit(1)
                                        Spacer()
                                        Text(r.label).font(.system(size: 18)).foregroundStyle(Duo.muted).lineLimit(1)
                                    }
                                    .padding(16).background(.white, in: RoundedRectangle(cornerRadius: 16))
                                }
                                .buttonStyle(DuoLift(radius: 16))
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                    }
                }
            }
            .padding(.horizontal, 90).padding(.top, 50).padding(.bottom, 200)
        }
        .scrollClipDisabled()
    }
}

// MARK: - Weather (GET /api/lifehub/weather, the phone's Weather app)

struct DuoWeather: Decodable {
    struct Now: Decodable { let temp: Double; let feels: Double; let code: Int; let wind: Double; let humidity: Double }
    struct Day: Decodable, Identifiable { var id: String { date }; let date: String; let code: Int; let high: Double; let low: Double; let rain: Double }
    let place: String
    let unit: String
    let current: Now
    let days: [Day]
    /** Open-Meteo's weather codes as SF Symbols and words. */
    static func look(_ code: Int) -> (String, String) {
        switch code {
        case 0: return ("sun.max.fill", "Clear")
        case 1, 2: return ("cloud.sun.fill", "Partly cloudy")
        case 3: return ("cloud.fill", "Cloudy")
        case 45, 48: return ("cloud.fog.fill", "Fog")
        case 51...57: return ("cloud.drizzle.fill", "Drizzle")
        case 61...67, 80...82: return ("cloud.rain.fill", "Rain")
        case 71...77, 85, 86: return ("cloud.snow.fill", "Snow")
        case 95...99: return ("cloud.bolt.rain.fill", "Thunderstorms")
        default: return ("cloud.fill", "")
        }
    }
}

// MARK: - Apps (the phone's Plugins): a tile for each app, opening its own page

enum DuoApp: String, CaseIterable, Identifiable {
    case weather, grocery, meals, countdowns, birthdays, habits, routines, bills, goals, stars, polls, notes
    var id: String { rawValue }
    var title: String {
        switch self {
        case .weather: return "Weather"; case .grocery: return "Grocery list"; case .meals: return "Meal plan"; case .countdowns: return "Countdowns"
        case .birthdays: return "Birthdays"; case .habits: return "Habits"; case .routines: return "Routines"; case .bills: return "Bills"
        case .goals: return "Goals"; case .stars: return "Stars"; case .polls: return "Polls"; case .notes: return "Notes"
        }
    }
    var symbol: String {
        switch self {
        case .weather: return "cloud.sun.fill"; case .grocery: return "cart.fill"; case .meals: return "fork.knife"; case .countdowns: return "hourglass"
        case .birthdays: return "gift.fill"; case .habits: return "flame.fill"; case .routines: return "list.bullet.rectangle.fill"; case .bills: return "doc.text.fill"
        case .goals: return "target"; case .stars: return "star.fill"; case .polls: return "checklist"; case .notes: return "note.text"
        }
    }
    var color: String {
        switch self {
        case .weather: return "#0e8a8a"; case .grocery: return "#16a34a"; case .meals: return "#ea580c"; case .countdowns: return "#7c3aed"
        case .birthdays: return "#db2777"; case .habits: return "#f59e0b"; case .routines: return "#0284c7"; case .bills: return "#e11d48"
        case .goals: return "#4f46e5"; case .stars: return "#d97706"; case .polls: return "#7866e1"; case .notes: return "#ca8a04"
        }
    }
}

struct DuoTVApps: View {
    @EnvironmentObject var model: DuoTVModel
    @State private var open: DuoApp?
    private func available(_ s: DuoTVSummary) -> [DuoApp] {
        DuoApp.allCases.filter { a in
            switch a {
            case .weather: return model.weather != nil
            case .grocery: return s.apps?.grocery != nil
            case .meals: return s.apps?.meals != nil
            case .countdowns: return s.apps?.countdowns != nil
            case .birthdays: return s.apps?.birthdays != nil
            case .habits: return s.apps?.habits != nil
            case .routines: return s.apps?.routines != nil
            case .bills: return s.on(\.money, else: false)
            case .goals: return !(s.goals ?? []).isEmpty
            case .stars: return !(s.stars ?? []).isEmpty
            case .polls: return !(s.polls ?? []).isEmpty
            case .notes: return !(s.notes ?? []).isEmpty
            }
        }
    }
    var body: some View {
        if let a = open, let s = model.summary {
            DuoAppPage(app: a, s: s, weather: model.weather) { open = nil }
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 30) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("YOUR LIFEHUB APPS").font(.system(size: 22, weight: .heavy)).tracking(4.4).foregroundStyle(Duo.eyebrow)
                        (Text("Apps").foregroundStyle(Duo.ink) + Text(".").foregroundStyle(Duo.violet)).font(.system(size: 76, weight: .black))
                    }
                    if let s = model.summary {
                        let apps = available(s)
                        if apps.isEmpty { DuoEmpty(text: "Add apps like Grocery, Meal Planner, Countdowns, Birthdays and Weather from the Plugin Gallery on your phone, and they show up here.") }
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 30), count: 4), spacing: 30) {
                            ForEach(apps) { a in
                                Button { open = a } label: {
                                    VStack(alignment: .leading, spacing: 18) {
                                        Image(systemName: a.symbol).font(.system(size: 40, weight: .semibold)).foregroundStyle(.white)
                                            .frame(width: 88, height: 88).background(Color(hex: a.color), in: RoundedRectangle(cornerRadius: 24))
                                        Text(a.title).font(.system(size: 30, weight: .bold)).foregroundStyle(Duo.ink)
                                        Text(DuoAppPage.subtitle(a, s, model.weather)).font(.system(size: 20)).foregroundStyle(Duo.muted).lineLimit(2)
                                    }
                                    .padding(30).frame(maxWidth: .infinity, minHeight: 280, alignment: .topLeading)
                                    .background(.white, in: RoundedRectangle(cornerRadius: 30))
                                    .overlay(RoundedRectangle(cornerRadius: 30).stroke(Duo.line, lineWidth: 2))
                                }
                                .buttonStyle(DuoLift())
                            }
                        }
                    } else { ProgressView().frame(maxWidth: .infinity).padding(80) }
                }
                .padding(.horizontal, 90).padding(.top, 50).padding(.bottom, 200)
            }
            .scrollClipDisabled()
            .onAppear { if let a = UserDefaults.standard.string(forKey: "duoApp").flatMap(DuoApp.init(rawValue:)) { open = a; UserDefaults.standard.removeObject(forKey: "duoApp") } }
        }
    }
}

/** One app's page. The remote's Menu button (or Back) goes back to the tiles. */
struct DuoAppPage: View {
    let app: DuoApp
    let s: DuoTVSummary
    let weather: DuoWeather?
    let close: () -> Void

    static func subtitle(_ a: DuoApp, _ s: DuoTVSummary, _ w: DuoWeather?) -> String {
        switch a {
        case .weather: return w.map { "\(Int($0.current.temp.rounded()))° · \(DuoWeather.look($0.current.code).1) in \($0.place)" } ?? ""
        case .grocery: let n = s.apps?.grocery?.count ?? 0; return n == 0 ? "All bought" : "\(n) to buy"
        case .meals: let today = s.apps?.meals?.first?.meals ?? []; return today.isEmpty ? "Nothing planned today" : "Today: " + today.map(\.text).joined(separator: ", ")
        case .countdowns: return s.apps?.countdowns?.first.map { "\($0.title) in \($0.days) days" } ?? "None coming up"
        case .birthdays: return s.apps?.birthdays?.first.map { "\($0.name) · \($0.days == 0 ? "today" : "in \($0.days) days")" } ?? "None in the next 2 months"
        case .habits: let h = s.apps?.habits ?? []; return "\(h.filter(\.today).count) of \(h.count) done today"
        case .routines: return "\(s.apps?.routines?.count ?? 0) routines"
        case .bills: return (s.bills ?? []).isEmpty ? "Nothing due this week" : "\((s.bills ?? []).count) due soon"
        case .goals: return "\((s.goals ?? []).count) in progress"
        case .stars: return (s.stars ?? []).map { "\($0.name) \($0.stars)⭐" }.joined(separator: " · ")
        case .polls: return "\((s.polls ?? []).count) open"
        case .notes: return "\((s.notes ?? []).count) pinned"
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 30) {
                HStack(spacing: 24) {
                    Button(action: close) { Label("Apps", systemImage: "chevron.left").font(.system(size: 24, weight: .bold)).foregroundStyle(Duo.ink).padding(.horizontal, 26).padding(.vertical, 14).background(.white, in: Capsule()) }
                        .buttonStyle(DuoLift(radius: 40))
                    Image(systemName: app.symbol).font(.system(size: 34, weight: .semibold)).foregroundStyle(.white)
                        .frame(width: 70, height: 70).background(Color(hex: app.color), in: RoundedRectangle(cornerRadius: 20))
                    Text(app.title).font(.system(size: 64, weight: .black)).foregroundStyle(Duo.ink)
                }
                content
            }
            .padding(.horizontal, 90).padding(.top, 50).padding(.bottom, 200)
        }
        .scrollClipDisabled()
        .onExitCommand(perform: close)
    }

    private func card<V: View>(_ v: V) -> some View {
        Button { } label: { v.padding(26).frame(maxWidth: .infinity, alignment: .leading).background(.white, in: RoundedRectangle(cornerRadius: 24)).overlay(RoundedRectangle(cornerRadius: 24).stroke(Duo.line, lineWidth: 2)) }
            .buttonStyle(DuoLift(radius: 24))
    }
    private let three = Array(repeating: GridItem(.flexible(), spacing: 24, alignment: .top), count: 3)

    @ViewBuilder private var content: some View {
        switch app {
        case .weather:
            if let w = weather {
                let now = DuoWeather.look(w.current.code)
                card(HStack(spacing: 40) {
                    Image(systemName: now.0).symbolRenderingMode(.multicolor).font(.system(size: 140))
                    VStack(alignment: .leading, spacing: 6) {
                        Text("\(Int(w.current.temp.rounded()))°\(w.unit)").font(.system(size: 110, weight: .black)).foregroundStyle(Duo.ink)
                        Text("\(now.1) · feels like \(Int(w.current.feels.rounded()))°").font(.system(size: 30, weight: .semibold)).foregroundStyle(Duo.muted)
                        Text("\(w.place) · wind \(Int(w.current.wind.rounded())) \(w.unit == "F" ? "mph" : "km/h") · humidity \(Int(w.current.humidity.rounded()))%").font(.system(size: 22)).foregroundStyle(Duo.faint)
                    }
                })
                HStack(spacing: 18) {
                    ForEach(w.days.prefix(7)) { d in
                        let l = DuoWeather.look(d.code)
                        card(VStack(spacing: 12) {
                            Text(d.date == s.day ? "Today" : prettyDay(d.date, .dateTime.weekday(.abbreviated))).font(.system(size: 22, weight: .heavy)).foregroundStyle(Duo.violet)
                            Image(systemName: l.0).symbolRenderingMode(.multicolor).font(.system(size: 50)).frame(height: 60)
                            Text("\(Int(d.high.rounded()))°").font(.system(size: 34, weight: .black)).foregroundStyle(Duo.ink)
                            Text("\(Int(d.low.rounded()))°").font(.system(size: 24)).foregroundStyle(Duo.muted)
                            if d.rain >= 20 { Label("\(Int(d.rain))%", systemImage: "drop.fill").font(.system(size: 18, weight: .bold)).foregroundStyle(Color(hex: "#0284c7")) }
                        }.frame(maxWidth: .infinity))
                    }
                }
            } else { DuoEmpty(text: "Set your town in Weather on your phone.") }
        case .grocery:
            let items = s.apps?.grocery ?? []
            if items.isEmpty { DuoEmpty(text: "Everything's bought. 🎉") }
            let aisles = Array(Set(items.map { $0.aisle.isEmpty ? "Other" : $0.aisle })).sorted()
            LazyVGrid(columns: three, alignment: .leading, spacing: 24) {
                ForEach(aisles, id: \.self) { a in
                    card(VStack(alignment: .leading, spacing: 14) {
                        Text(a.uppercased()).font(.system(size: 18, weight: .heavy)).tracking(2).foregroundStyle(Color(hex: "#16a34a"))
                        ForEach(items.filter { ($0.aisle.isEmpty ? "Other" : $0.aisle) == a }) { g in
                            HStack(spacing: 14) {
                                DuoCheck()
                                Text(g.name).font(.system(size: 24, weight: .semibold)).foregroundStyle(Duo.ink).lineLimit(1)
                                Spacer(minLength: 4)
                                if !g.qty.isEmpty { Text(g.qty).font(.system(size: 20)).foregroundStyle(Duo.muted) }
                            }
                        }
                    })
                }
            }
        case .meals:
            HStack(alignment: .top, spacing: 16) {
                ForEach(s.apps?.meals ?? []) { d in
                    card(VStack(alignment: .leading, spacing: 12) {
                        Text(d.date == s.day ? "TODAY" : prettyDay(d.date, .dateTime.weekday(.abbreviated)).uppercased()).font(.system(size: 18, weight: .heavy)).foregroundStyle(Color(hex: "#ea580c"))
                        Text(prettyDay(d.date, .dateTime.day())).font(.system(size: 40, weight: .black)).foregroundStyle(Duo.ink)
                        if d.meals.isEmpty { Text("Not planned").font(.system(size: 18)).foregroundStyle(Duo.faint) }
                        ForEach(d.meals) { m in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(m.slot.capitalized).font(.system(size: 15, weight: .heavy)).foregroundStyle(Duo.muted)
                                Text(m.text).font(.system(size: 20, weight: .semibold)).foregroundStyle(Duo.ink).lineLimit(3)
                            }
                        }
                    }.frame(minHeight: 420, alignment: .topLeading))
                }
            }
        case .countdowns:
            LazyVGrid(columns: three, spacing: 24) {
                ForEach(s.apps?.countdowns ?? []) { c in
                    card(VStack(alignment: .leading, spacing: 10) {
                        Text(c.emoji.isEmpty ? "⏳" : c.emoji).font(.system(size: 56))
                        Text("\(c.days)").font(.system(size: 90, weight: .black)).foregroundStyle(Color(hex: c.color.isEmpty ? "#7c3aed" : c.color))
                        Text(c.days == 1 ? "day to go" : "days to go").font(.system(size: 22, weight: .bold)).foregroundStyle(Duo.muted)
                        Text(c.title).font(.system(size: 28, weight: .bold)).foregroundStyle(Duo.ink).lineLimit(2)
                        Text(prettyDay(c.date)).font(.system(size: 20)).foregroundStyle(Duo.faint)
                    })
                }
            }
        case .birthdays:
            LazyVGrid(columns: three, spacing: 24) {
                ForEach(s.apps?.birthdays ?? []) { b in
                    card(HStack(spacing: 20) {
                        Text(b.kind == "anniversary" ? "💍" : b.kind == "birthday" ? "🎂" : "🎉").font(.system(size: 56))
                        VStack(alignment: .leading, spacing: 4) {
                            Text(b.name).font(.system(size: 28, weight: .bold)).foregroundStyle(Duo.ink).lineLimit(1)
                            Text(b.days == 0 ? "Today!" : b.days == 1 ? "Tomorrow" : "In \(b.days) days · \(shortDay(b.date))").font(.system(size: 22, weight: .semibold)).foregroundStyle(b.days <= 7 ? Color(hex: "#db2777") : Duo.muted)
                            if b.turns > 0 { Text(b.kind == "anniversary" ? "\(b.turns) years" : "Turns \(b.turns)").font(.system(size: 20)).foregroundStyle(Duo.faint) }
                        }
                    })
                }
            }
        case .habits:
            VStack(spacing: 18) {
                ForEach(s.apps?.habits ?? []) { h in
                    card(HStack(spacing: 20) {
                        Text(h.emoji.isEmpty ? "✨" : h.emoji).font(.system(size: 44))
                        Text(h.name).font(.system(size: 28, weight: .bold)).foregroundStyle(Duo.ink).frame(width: 520, alignment: .leading).lineLimit(1)
                        HStack(spacing: 14) {
                            ForEach(Array(h.week.enumerated()), id: \.offset) { pair in
                                let i = pair.offset, done = pair.element
                                VStack(spacing: 6) {
                                    Circle().fill(done ? Color(hex: h.color.isEmpty ? "#f59e0b" : h.color) : Color(hex: "#e2e8f0")).frame(width: 46, height: 46)
                                        .overlay(Image(systemName: "checkmark").font(.system(size: 20, weight: .black)).foregroundStyle(done ? .white : .clear))
                                    Text(prettyDay(addDays(s.day, i - 6), .dateTime.weekday(.narrow))).font(.system(size: 16, weight: .bold)).foregroundStyle(Duo.muted)
                                }
                            }
                        }
                        Spacer()
                        Text("\(h.week.filter { $0 }.count)/7").font(.system(size: 28, weight: .black)).foregroundStyle(Duo.ink)
                    })
                }
            }
        case .routines:
            LazyVGrid(columns: three, alignment: .leading, spacing: 24) {
                ForEach(s.apps?.routines ?? []) { r in
                    card(VStack(alignment: .leading, spacing: 14) {
                        Text("\(r.emoji) \(r.name)").font(.system(size: 30, weight: .bold)).foregroundStyle(Duo.ink)
                        ForEach(r.steps) { st in
                            HStack(spacing: 12) { DuoCheck(done: st.done); Text(st.text).font(.system(size: 22)).foregroundStyle(Duo.ink).strikethrough(st.done).lineLimit(2) }
                        }
                    })
                }
            }
        case .bills:
            VStack(spacing: 16) {
                if (s.bills ?? []).isEmpty { DuoEmpty(text: "No bills due in the next week.") }
                ForEach(s.bills ?? []) { b in
                    card(HStack(spacing: 18) {
                        Circle().fill(b.late ? Duo.rose : Duo.amber).frame(width: 16, height: 16)
                        Text(b.name).font(.system(size: 30, weight: .bold)).foregroundStyle(Duo.ink)
                        Spacer()
                        Text(b.late ? "Past due" : b.due == s.day ? "Today" : prettyDay(b.due)).font(.system(size: 24, weight: .semibold)).foregroundStyle(b.late ? Duo.rose : Duo.muted)
                        Text(b.amount).font(.system(size: 32, weight: .black)).foregroundStyle(Duo.ink).frame(minWidth: 160, alignment: .trailing)
                    })
                }
            }
        case .goals:
            LazyVGrid(columns: three, spacing: 24) {
                ForEach(s.goals ?? []) { g in
                    card(VStack(alignment: .leading, spacing: 16) {
                        Text(g.title).font(.system(size: 28, weight: .bold)).foregroundStyle(Duo.ink).lineLimit(2)
                        Text("\(Int((g.progress * 100).rounded()))%").font(.system(size: 64, weight: .black)).foregroundStyle(Color(hex: "#4f46e5"))
                        ProgressView(value: g.progress).tint(Color(hex: "#4f46e5"))
                    })
                }
            }
        case .stars:
            LazyVGrid(columns: three, spacing: 24) {
                ForEach(s.stars ?? []) { k in
                    card(VStack(spacing: 14) {
                        DuoAvatar(person: DuoPerson(name: k.name, emoji: k.emoji, color: k.color), size: 110)
                        Text(k.name).font(.system(size: 32, weight: .bold)).foregroundStyle(Duo.ink)
                        Label("\(k.stars)", systemImage: "star.fill").font(.system(size: 54, weight: .black)).foregroundStyle(Color(hex: "#d97706"))
                    }.frame(maxWidth: .infinity))
                }
            }
        case .polls:
            VStack(spacing: 16) {
                ForEach(s.polls ?? []) { p in
                    card(VStack(alignment: .leading, spacing: 8) {
                        Text(p.question).font(.system(size: 32, weight: .bold)).foregroundStyle(Duo.ink)
                        Text(p.leading.isEmpty ? "No votes yet" : "Leading: \(p.leading)").font(.system(size: 26, weight: .semibold)).foregroundStyle(Duo.violet)
                        Text(p.waiting > 0 ? "\(p.waiting) still to vote" : "Everyone voted").font(.system(size: 22)).foregroundStyle(Duo.muted)
                    })
                }
            }
        case .notes:
            LazyVGrid(columns: three, spacing: 24) {
                ForEach(s.notes ?? []) { n in
                    Button { } label: {
                        VStack(alignment: .leading, spacing: 10) {
                            if !n.title.isEmpty { Text(n.title).font(.system(size: 30, weight: .black)).foregroundStyle(Duo.ink) }
                            Text(n.body).font(.system(size: 24)).foregroundStyle(Color(hex: "#334155")).lineLimit(10)
                        }
                        .padding(30).frame(maxWidth: .infinity, minHeight: 300, alignment: .topLeading)
                        .background(Color(hex: n.color), in: RoundedRectangle(cornerRadius: 24))
                    }
                    .buttonStyle(DuoLift(radius: 24))
                }
            }
        }
    }
}

// MARK: - Made-up Work, weather and apps for the simulator screenshots

func duoWorkSampleJSON(_ day: String) -> String {
    let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
    let base = f.date(from: day) ?? Date()
    func d(_ n: Int) -> String { f.string(from: Calendar.current.date(byAdding: .day, value: n, to: base) ?? base) }
    return """
    {"available":true,"name":"Jeremy Smith","day":"\(day)","school":"Lincoln Middle School","students":14,"dueToday":3,
     "lists":[{"id":"l1","name":"Paperwork","color":"#0d9488"},{"id":"l2","name":"Classroom","color":"#7c3aed"}],
     "tasks":[{"id":"w1","title":"Finish progress reports","due":"\(d(-1))","time":"","list":"Paperwork","who":"","listId":"l1","priority":"high"},
              {"id":"w2","title":"Email Ava's mom about the meeting","due":"\(day)","time":"15:00","list":"Paperwork","who":"","listId":"l1","priority":"normal"},
              {"id":"w3","title":"Copy reading packets","due":"\(day)","time":"","list":"Classroom","who":"","listId":"l2","priority":"normal"},
              {"id":"w4","title":"Update accommodations sheet","due":"\(d(2))","time":"","list":"Paperwork","who":"","listId":"l1","priority":"normal"}],
     "events":[{"date":"\(day)","title":"Staff meeting","time":"15:30","endTime":"16:30","location":"Library","who":[],"color":"#0d9488","people":[]},
               {"date":"\(d(2))","title":"Annual IEP: Ava Smith","time":"08:00","endTime":"","location":"Room 12","who":["Ava Smith"],"color":"#7c3aed","people":[]},
               {"date":"\(d(4))","title":"Reevaluation: Leo Park","time":"10:30","endTime":"","location":"Office","who":["Leo Park"],"color":"#7c3aed","people":[]}],
     "meetings":[{"student":"Ava Smith","type":"Annual IEP","date":"\(d(2))","time":"08:00","room":"Room 12"},{"student":"Leo Park","type":"Reevaluation","date":"\(d(4))","time":"10:30","room":"Office"}],
     "schedule":[{"student":"Ava Smith","start":"09:00","end":"09:30","label":"Reading pull-out"},{"student":"Leo Park","start":"10:15","end":"10:45","label":"Math push-in"},{"student":"Maya Chen","start":"13:00","end":"13:30","label":"Writing"}],
     "dueSoon":[{"what":"Annual IEP due","student":"Nolan Framel","date":"\(d(-3))","days":-3},{"what":"Annual IEP due","student":"Ava Smith","date":"\(d(5))","days":5},{"what":"Reevaluation due","student":"Leo Park","date":"\(d(12))","days":12}],
     "lessons":[{"title":"Main idea and details","subject":"Reading","group":"Group A","date":"\(day)"},{"title":"Fractions on a number line","subject":"Math","group":"Group B","date":"\(d(1))"}]}
    """
}

func duoWeatherSampleJSON(_ day: String) -> String {
    let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
    let base = f.date(from: day) ?? Date()
    let codes = [0, 2, 3, 61, 2, 0, 71]
    let days = (0..<7).map { i -> String in
        let d = f.string(from: Calendar.current.date(byAdding: .day, value: i, to: base) ?? base)
        return "{\"date\":\"\(d)\",\"code\":\(codes[i]),\"high\":\(58 - i),\"low\":\(34 + i),\"rain\":\(codes[i] == 61 ? 70 : 5)}"
    }.joined(separator: ",")
    return "{\"place\":\"Denver, Colorado, US\",\"unit\":\"F\",\"current\":{\"temp\":52,\"feels\":49,\"code\":1,\"wind\":8,\"humidity\":31},\"days\":[\(days)]}"
}
