// Arise Duo for Apple TV: the family's day on the big screen — today's tasks, this week's events and
// today's chores (with whose turn it is), refreshed every couple of minutes. Signing in takes a code:
// the TV shows one, and you type it at arisetodo.com/tv on a phone or computer that's signed in
// (server/tvLink.ts). The TV keeps its own session in the keychain.
import SwiftUI
import Security

let duoAPI = URL(string: "https://arisetodo.com")!

@main
struct DuoTVApp: App {
    @StateObject private var model = DuoTVModel()
    var body: some Scene {
        WindowGroup {
            Group {
                if model.token == nil { DuoTVSignIn() } else { DuoTVHome() }
            }
            .environmentObject(model)
        }
    }
}

// MARK: - Data

struct DuoTVSummary: Decodable {
    struct Task: Decodable, Identifiable { let id: String; let title: String; let due: String; let time: String; let list: String; let who: String }
    struct Event: Decodable, Identifiable { var id: String { date + time + title }; let date: String; let title: String; let time: String; let endTime: String; let location: String; let who: [String] }
    struct Chore: Decodable, Identifiable { let id: String; let title: String; let who: String; let emoji: String; let color: String; let points: Int; let done: Bool }
    let name: String
    let day: String
    let tasks: [Task]
    let events: [Event]
    let chores: [Chore]
}

@MainActor
final class DuoTVModel: ObservableObject {
    @Published var token: String? = DuoKeychain.read()
    @Published var summary: DuoTVSummary?
    @Published var error: String?
    @Published var code: String?
    @Published var updated: Date?
    private var poll: String?

    static func today() -> String { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date()) }

    func load() async {
        guard let token else { return }
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

// MARK: - Sign in

struct DuoTVSignIn: View {
    @EnvironmentObject var model: DuoTVModel
    var body: some View {
        VStack(spacing: 40) {
            Text("Arise Duo").font(.system(size: 80, weight: .bold))
            Text("Your family's day on the TV").font(.title2).foregroundStyle(.secondary)
            if let code = model.code {
                VStack(spacing: 24) {
                    Text("On your phone or computer, go to").font(.title3)
                    Text("arisetodo.com/tv").font(.system(size: 54, weight: .semibold)).foregroundStyle(.orange)
                    Text("and type this code").font(.title3)
                    Text(code.map(String.init).joined(separator: " ")).font(.system(size: 110, weight: .heavy, design: .monospaced))
                    ProgressView().padding(.top, 10)
                }
            } else if let e = model.error {
                Text(e).foregroundStyle(.red)
                Button("Try again") { Task { await model.startSignIn() } }
            } else {
                ProgressView()
            }
        }
        .padding(80)
        .task { await model.startSignIn() }
    }
}

// MARK: - Home

struct DuoTVHome: View {
    @EnvironmentObject var model: DuoTVModel
    private let refresh = Timer.publish(every: 120, on: .main, in: .common).autoconnect()

    var body: some View {
        TabView {
            DuoTVToday().tabItem { Label("Today", systemImage: "sun.max") }
            DuoTVWeek().tabItem { Label("This week", systemImage: "calendar") }
            DuoTVSettings().tabItem { Label("Settings", systemImage: "gearshape") }
        }
        .task { await model.load() }
        .onReceive(refresh) { _ in Task { await model.load() } }
    }
}

private func prettyDay(_ day: String, style: Date.FormatStyle = .dateTime.weekday(.wide).month(.wide).day()) -> String {
    let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
    guard let d = f.date(from: day) else { return day }
    return d.formatted(style)
}

private func prettyTime(_ t: String) -> String {
    let f = DateFormatter(); f.dateFormat = "HH:mm"
    guard let d = f.date(from: t) else { return t }
    return d.formatted(date: .omitted, time: .shortened)
}

struct DuoTVToday: View {
    @EnvironmentObject var model: DuoTVModel
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 40) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(greeting).font(.system(size: 64, weight: .bold))
                    Text(prettyDay(DuoTVModel.today())).font(.title2).foregroundStyle(.secondary)
                }
                if let e = model.error { Text(e).foregroundStyle(.orange) }
                if let s = model.summary {
                    HStack(alignment: .top, spacing: 40) {
                        DuoTVPanel(title: "To do", symbol: "checklist") {
                            let today = s.tasks.filter { !$0.due.isEmpty && $0.due <= s.day }
                            let rows = today.isEmpty ? Array(s.tasks.filter { $0.due.isEmpty }.prefix(8)) : Array(today.prefix(12))
                            if rows.isEmpty { Text("Nothing due today 🎉").foregroundStyle(.secondary) }
                            ForEach(rows) { t in
                                HStack(alignment: .firstTextBaseline) {
                                    Image(systemName: "circle").foregroundStyle(t.due < s.day && !t.due.isEmpty ? .red : .secondary)
                                    VStack(alignment: .leading) {
                                        Text(t.title).lineLimit(2)
                                        let sub = [t.due < s.day && !t.due.isEmpty ? "Overdue" : "", t.time.isEmpty ? "" : prettyTime(t.time), t.who, t.list].filter { !$0.isEmpty }.joined(separator: " · ")
                                        if !sub.isEmpty { Text(sub).font(.caption).foregroundStyle(.secondary) }
                                    }
                                }
                            }
                        }
                        DuoTVPanel(title: "Today's plans", symbol: "calendar") {
                            let today = s.events.filter { $0.date == s.day }
                            if today.isEmpty { Text("No events today").foregroundStyle(.secondary) }
                            ForEach(today) { e in DuoTVEventRow(e: e) }
                        }
                        DuoTVPanel(title: "Chores", symbol: "sparkles") {
                            if s.chores.isEmpty { Text("No chores today").foregroundStyle(.secondary) }
                            ForEach(s.chores) { c in
                                HStack {
                                    Image(systemName: c.done ? "checkmark.circle.fill" : "circle").foregroundStyle(c.done ? .green : .secondary)
                                    Text(c.title).strikethrough(c.done)
                                    Spacer()
                                    Text("\(c.emoji) \(c.who)").foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                } else if model.error == nil {
                    ProgressView()
                }
            }
            .padding(60)
        }
    }
    private var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        let first = model.summary?.name.split(separator: " ").first.map(String.init) ?? ""
        let part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
        return first.isEmpty ? part : "\(part), \(first)"
    }
}

struct DuoTVEventRow: View {
    let e: DuoTVSummary.Event
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 16) {
            Text(e.time.isEmpty ? "All day" : prettyTime(e.time)).font(.callout.monospacedDigit()).foregroundStyle(.orange).frame(width: 150, alignment: .leading)
            VStack(alignment: .leading) {
                Text(e.title).lineLimit(2)
                let sub = ([e.location] + [e.who.joined(separator: ", ")]).filter { !$0.isEmpty }.joined(separator: " · ")
                if !sub.isEmpty { Text(sub).font(.caption).foregroundStyle(.secondary) }
            }
        }
    }
}

struct DuoTVPanel<Content: View>: View {
    let title: String
    let symbol: String
    @ViewBuilder let content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Label(title, systemImage: symbol).font(.title3.bold())
            content
            Spacer(minLength: 0)
        }
        .padding(36)
        .frame(maxWidth: .infinity, minHeight: 600, alignment: .topLeading)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 30))
        .focusable()
    }
}

struct DuoTVWeek: View {
    @EnvironmentObject var model: DuoTVModel
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 30) {
                Text("This week").font(.system(size: 56, weight: .bold))
                if let s = model.summary {
                    let days = Array(Set(s.events.map(\.date) + s.tasks.map(\.due).filter { !$0.isEmpty && $0 >= s.day })).sorted()
                    if days.isEmpty { Text("Nothing planned this week.").foregroundStyle(.secondary) }
                    ForEach(days, id: \.self) { d in
                        VStack(alignment: .leading, spacing: 12) {
                            Text(d == s.day ? "Today" : prettyDay(d)).font(.title3.bold())
                            ForEach(s.events.filter { $0.date == d }) { DuoTVEventRow(e: $0) }
                            ForEach(s.tasks.filter { $0.due == d }) { t in Label(t.title, systemImage: "circle").foregroundStyle(.primary) }
                        }
                        .padding(30)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24))
                        .focusable()
                    }
                } else { ProgressView() }
            }
            .padding(60)
        }
    }
}

struct DuoTVSettings: View {
    @EnvironmentObject var model: DuoTVModel
    var body: some View {
        VStack(spacing: 30) {
            if let s = model.summary { Text("Signed in as \(s.name)").font(.title3) }
            if let u = model.updated { Text("Updated \(u.formatted(date: .omitted, time: .shortened))").foregroundStyle(.secondary) }
            Button("Refresh now") { Task { await model.load() } }
            Button("Sign out of this TV", role: .destructive) { model.signOut() }
        }
        .padding(80)
    }
}
