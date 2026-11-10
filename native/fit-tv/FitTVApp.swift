// Arise Fit for Apple TV: the phone app on the big screen, in its dark Ember look.
//   Today     your numbers (calories left, water, workouts this week, streak, protein, weight, the same as the
//             Fit widgets), your week, the program's next day, today's pick, and water added from the couch
//   Workouts  every guided session (treadmill HIIT, Couch to 5K, yoga, mobility, breathing) and your routines
//   Program   the program you're on: the next day's exercises, played set by set with rest between
//   Timers    interval timers (Tabata, EMOM, boxing rounds... and the ones you made)
//   History   your last workouts
//   You       signed in or not, the coach's voice and the chime
// A session plays phase by phase: a big countdown ring you can read from across the room, what to do now and
// what's next, the treadmill speed and incline, and a coach who says each step out loud (and counts down the
// last three seconds). Play/Pause on the remote pauses; swipe left or right to skip; Menu ends it.
// The coach speaks in the phone app's AI voice ("troy", POST /api/voice/say), never the TV's robot voice:
// every line of a session is fetched before it's needed. A strength set shows its how-to video (the same
// YouTube tutorial as the phone, shared/fitVideos.ts): Apple TV can't play YouTube inside another app (tvOS
// has no web view), so pressing it opens the YouTube app at that video and pauses the session until you're back.
// A finished session goes into your Arise Fit workout log when you're signed in.
// Signing in takes a code, like Arise Duo: arisetodo.com/tv on your phone (server/tvLink.ts, server/fitTv.ts).
// Sessions and the built-in timers come with the app (sessions.json, timers.json: script/exportFitSessions.ts).
import SwiftUI
import UIKit
import AVFoundation
import Security
import CoreImage.CIFilterBuiltins

let fitAPI = URL(string: "https://arisetodo.com")!

@main
struct FitTVApp: App {
    @StateObject private var model = FitTVModel()
    var body: some Scene {
        WindowGroup {
            FitTVRoot().environmentObject(model).preferredColorScheme(.dark)
        }
    }
}

// MARK: - Sessions

struct FitVideoRef: Decodable, Hashable { let id: String; let title: String }

struct FitPhase: Decodable, Hashable {
    let name: String
    let secs: Int
    let kind: String
    let cue: String?
    let speed: Double?
    let incline: Double?
    /** The exercise's how-to video (strength sets). */
    let video: FitVideoRef?
}

struct FitSession: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let category: String
    let blurb: String
    let level: String
    let equipment: String
    let phases: [FitPhase]
    var secs: Int { phases.reduce(0) { $0 + $1.secs } }
    var mins: Int { max(1, Int((Double(secs) / 60).rounded())) }

    static func bundled(_ file: String) -> [FitSession] {
        guard let url = Bundle.main.url(forResource: file, withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return [] }
        return decodeList(data)
    }
    /** One at a time, so a session the app can't read is skipped instead of emptying the whole list. */
    static func decodeList(_ data: Data) -> [FitSession] {
        ((try? JSONDecoder().decode([FitLenient].self, from: data)) ?? []).compactMap(\.session).filter { !$0.phases.isEmpty }
    }
    static let all: [FitSession] = bundled("sessions")
    static let presetTimers: [FitSession] = bundled("timers")
}

struct FitLenient: Decodable {
    let session: FitSession?
    init(from decoder: Decoder) throws { session = try? FitSession(from: decoder) }
}

/** Arise Fit's own colors (the phone app's dark Ember look). */
enum FitColor {
    static let bg = Color(red: 0x15 / 255, green: 0x17 / 255, blue: 0x1b / 255)
    static let deep = Color(red: 0x0b / 255, green: 0x0c / 255, blue: 0x0f / 255)
    static let card = Color(red: 0x1f / 255, green: 0x22 / 255, blue: 0x28 / 255)
    static let card2 = Color(red: 0x2a / 255, green: 0x2e / 255, blue: 0x36 / 255)
    static let ember = Color(red: 0xff / 255, green: 0x6b / 255, blue: 0x2c / 255)
    static let dim = Color.white.opacity(0.62)
    static let faint = Color.white.opacity(0.4)
    static func hex(_ h: String) -> Color {
        let v = Int(h.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) ?? 0xff6b2c
        return Color(red: Double((v >> 16) & 255) / 255, green: Double((v >> 8) & 255) / 255, blue: Double(v & 255) / 255)
    }
}

struct FitCategory: Identifiable { let id: String; let name: String; let symbol: String; let tint: Color }
let fitCategories: [FitCategory] = [
    FitCategory(id: "hiit", name: "Treadmill HIIT", symbol: "bolt.heart.fill", tint: .red),
    FitCategory(id: "c25k", name: "Couch to 5K", symbol: "figure.run", tint: .orange),
    FitCategory(id: "yoga", name: "Yoga", symbol: "figure.yoga", tint: .purple),
    FitCategory(id: "mobility", name: "Mobility & stretching", symbol: "figure.flexibility", tint: .teal),
    FitCategory(id: "meditation", name: "Breathe & meditate", symbol: "wind", tint: .blue),
]

// MARK: - Your Arise Fit (GET /api/fit/tv)

struct FitTVSummary: Decodable {
    struct Slot: Decodable, Identifiable { let id: String; let title: String; let value: String; let detail: String; let tint: String; let progress: Double?; let lines: [String] }
    struct Program: Decodable { let name: String; let blurb: String; let dayName: String; let week: Int; let weeks: Int; let done: Int; let session: FitSession; let exercises: [Ex] }
    struct Ex: Decodable, Identifiable { var id: String { name + reps }; let name: String; let sets: Int; let reps: String; let video: FitVideoRef? }
    struct Past: Decodable, Identifiable { var id: String { date + name + String(mins) }; let name: String; let date: String; let mins: Int; let sets: Int }
    struct Day: Decodable, Identifiable { var id: String { day }; let day: String; let mins: Int }
    let name: String
    let day: String
    let units: String
    let slots: [Slot]
    let program: Program?
    let routines: [FitSession]
    let timers: [FitSession]
    let history: [Past]
    let week: [Day]
}

@MainActor
final class FitTVModel: ObservableObject {
    @Published var token: String? = FitTVModel.sample ? "sample" : FitKeychain.read()
    @Published var me: FitTVSummary?
    @Published var error: String?
    @Published var code: String?
    @Published var signingIn = false
    @Published var toast: String?
    private var poll: String?

    /** -fitSample YES (the simulator screenshots): made-up numbers, no account. */
    static let sample = UserDefaults.standard.bool(forKey: "fitSample")
    nonisolated static func today() -> String { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date()) }

    var timers: [FitSession] { me?.timers.isEmpty == false ? me!.timers : FitSession.presetTimers }

    func load() async {
        guard let token else { return }
        if Self.sample { me = try? JSONDecoder().decode(FitTVSummary.self, from: Data(fitSampleJSON(Self.today()).utf8)); return }
        var req = URLRequest(url: fitAPI.appending(path: "/api/fit/tv").appending(queryItems: [
            URLQueryItem(name: "day", value: Self.today()), URLQueryItem(name: "tz", value: String(-TimeZone.current.secondsFromGMT() / 60))]))
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.cachePolicy = .reloadIgnoringLocalCacheData
        do {
            let (data, res) = try await URLSession.shared.data(for: req)
            let status = (res as? HTTPURLResponse)?.statusCode ?? 0
            if status == 401 { signOut(); return }
            guard status == 200 else { error = "Arise Fit isn't reachable right now."; return }
            me = try JSONDecoder().decode(FitTVSummary.self, from: data); error = nil
        } catch { self.error = "Can't reach Arise Fit. Check the TV's internet connection." }
    }

    private func post(_ path: String, _ body: [String: Any]) async -> Bool {
        guard let token, !Self.sample else { return Self.sample }
        var req = URLRequest(url: fitAPI.appending(path: path))
        req.httpMethod = "POST"; req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        guard let (_, res) = try? await URLSession.shared.data(for: req) else { return false }
        return (res as? HTTPURLResponse)?.statusCode == 200
    }

    /** A session finished on the TV, into the workout log. */
    func logWorkout(_ name: String, secs: Int) async -> Bool {
        guard token != nil, secs >= 30 else { return false }
        let ok = await post("/api/fit/tv/workout", ["name": name, "secs": secs, "day": Self.today()])
        if ok { await load() }
        return ok
    }

    func addWater(_ ml: Int) async {
        guard token != nil else { return }
        if await post("/api/fit/tv/water", ["ml": ml, "day": Self.today()]) {
            toast = "Water added"; await load()
        } else { toast = "Couldn't add water just now" }
    }

    func startSignIn() async {
        code = nil; error = nil; signingIn = true
        var req = URLRequest(url: fitAPI.appending(path: "/api/tv-link/start"))
        req.httpMethod = "POST"; req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["app": "fit"])
        guard let (data, _) = try? await URLSession.shared.data(for: req),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let c = obj["code"] as? String, let p = obj["poll"] as? String else {
            error = "Can't reach Arise Fit. Check the TV's internet connection."; return
        }
        code = c; poll = p
        while token == nil, poll == p, signingIn {
            try? await Task.sleep(for: .seconds(3))
            var q = URLRequest(url: fitAPI.appending(path: "/api/tv-link/poll"))
            q.httpMethod = "POST"; q.setValue("application/json", forHTTPHeaderField: "Content-Type")
            q.httpBody = try? JSONSerialization.data(withJSONObject: ["poll": p])
            guard let (d, _) = try? await URLSession.shared.data(for: q),
                  let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] else { continue }
            if o["status"] as? String == "done", let t = o["token"] as? String {
                FitKeychain.save(t); token = t; code = nil; signingIn = false
                await load(); return
            }
            if o["status"] as? String == "expired" { await startSignIn(); return }
        }
    }
    func cancelSignIn() { signingIn = false; poll = nil; code = nil }
    func signOut() { FitKeychain.save(nil); token = nil; me = nil; poll = nil }
}

enum FitKeychain {
    private static let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "arise-fit-tv", kSecAttrAccount as String: "session"]
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

// MARK: - The tab bar along the bottom (like the phone's)

enum FitTab: String, CaseIterable { case today, workouts, program, timers, history, you }

struct FitTVRoot: View {
    @EnvironmentObject var model: FitTVModel
    @State private var tab: FitTab = FitTab(rawValue: UserDefaults.standard.string(forKey: "fitTab") ?? "") ?? .today
    @State private var playing: FitSession?
    private let refresh = Timer.publish(every: 180, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack(alignment: .bottom) {
            FitColor.bg.ignoresSafeArea()
            RadialGradient(colors: [FitColor.ember.opacity(0.2), .clear], center: .top, startRadius: 0, endRadius: 1100).ignoresSafeArea()
            Group {
                switch tab {
                case .today: FitTVToday(play: { playing = $0 }, go: { tab = $0 })
                case .workouts: FitTVWorkouts(play: { playing = $0 })
                case .program: FitTVProgram(play: { playing = $0 }, go: { tab = $0 })
                case .timers: FitTVTimers(play: { playing = $0 })
                case .history: FitTVHistory()
                case .you: FitTVYou()
                }
            }
            .focusSection()
            HStack(spacing: 6) {
                ForEach(FitTab.allCases, id: \.self) { t in
                    Button { tab = t } label: {
                        VStack(spacing: 6) {
                            Image(systemName: symbol(t)).font(.system(size: 30, weight: .semibold)).frame(height: 36)
                            Text(label(t)).font(.system(size: 19, weight: .bold))
                        }
                    }
                    .buttonStyle(FitTabStyle(active: tab == t))
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(Color(red: 0.09, green: 0.1, blue: 0.12).opacity(0.96), in: Capsule())
            .overlay(Capsule().stroke(.white.opacity(0.1), lineWidth: 1))
            .shadow(color: .black.opacity(0.5), radius: 30, y: 14)
            .focusSection()
            .padding(.bottom, 30)
            if let t = model.toast {
                Text(t).font(.system(size: 26, weight: .bold)).padding(.horizontal, 30).padding(.vertical, 16)
                    .background(FitColor.card2, in: Capsule()).padding(.bottom, 160)
                    .task { try? await Task.sleep(for: .seconds(2.5)); model.toast = nil }
            }
        }
        .task {
            await model.load()
            // -fitPlay <session id>: straight into the player (the simulator screenshots).
            if let id = UserDefaults.standard.string(forKey: "fitPlay"), let s = (FitSession.all + FitSession.presetTimers + [model.me?.program?.session].compactMap { $0 }).first(where: { $0.id == id }) { playing = s }
        }
        .onReceive(refresh) { _ in Task { await model.load() } }
        .fullScreenCover(item: $playing) { s in FitTVPlayer(session: s).environmentObject(model) }
    }
    private func label(_ t: FitTab) -> String {
        switch t { case .today: return "Today"; case .workouts: return "Workouts"; case .program: return "Program"; case .timers: return "Timers"; case .history: return "History"; case .you: return "You" }
    }
    private func symbol(_ t: FitTab) -> String {
        switch t { case .today: return "sun.max.fill"; case .workouts: return "play.rectangle.fill"; case .program: return "dumbbell.fill"; case .timers: return "timer"; case .history: return "chart.bar.fill"; case .you: return "person.crop.circle.fill" }
    }
}

struct FitTabStyle: ButtonStyle {
    let active: Bool
    func makeBody(configuration: Configuration) -> some View { Look(configuration: configuration, active: active) }
    private struct Look: View {
        let configuration: Configuration
        let active: Bool
        @Environment(\.isFocused) private var focused
        var body: some View {
            configuration.label
                .foregroundStyle(focused ? .black : active ? .white : .white.opacity(0.55))
                .frame(width: 150, height: 92)
                .background(focused ? Color.white : active ? FitColor.ember : .clear, in: Capsule())
                .scaleEffect(configuration.isPressed ? 0.94 : 1)
                .animation(.easeOut(duration: 0.12), value: focused)
        }
    }
}

/** A card that lifts and lights up when the remote is on it. */
struct FitLift: ButtonStyle {
    var radius: CGFloat = 28
    func makeBody(configuration: Configuration) -> some View { Look(configuration: configuration, radius: radius) }
    private struct Look: View {
        let configuration: Configuration
        let radius: CGFloat
        @Environment(\.isFocused) private var focused
        var body: some View {
            configuration.label
                .overlay(RoundedRectangle(cornerRadius: radius).stroke(focused ? FitColor.ember : .clear, lineWidth: 4))
                .scaleEffect(configuration.isPressed ? 0.98 : focused ? 1.04 : 1)
                .shadow(color: .black.opacity(focused ? 0.6 : 0.25), radius: focused ? 30 : 12, y: focused ? 16 : 6)
                .animation(.easeOut(duration: 0.15), value: focused)
        }
    }
}

struct FitHeader: View {
    let eyebrow: String
    let title: String
    var sub: String? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(eyebrow.uppercased()).font(.system(size: 22, weight: .heavy)).tracking(4.4).foregroundStyle(FitColor.ember)
            Text(title).font(.system(size: 68, weight: .black)).foregroundStyle(.white)
            if let sub { Text(sub).font(.system(size: 26)).foregroundStyle(FitColor.dim) }
        }
    }
}

struct FitPage<Content: View>: View {
    @ViewBuilder let content: Content
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 44) { content }
                .padding(.horizontal, 90).padding(.top, 50).padding(.bottom, 200)
        }
        .scrollClipDisabled()
    }
}

/** For screens that need your account: what it adds, and the way in. */
struct FitSignInCard: View {
    @EnvironmentObject var model: FitTVModel
    var why: String
    var body: some View {
        if let code = model.code {
            HStack(spacing: 50) {
                if let qr = FitQR.image("https://arisetodo.com/tv?code=\(code)") {
                    Image(uiImage: qr).interpolation(.none).resizable().frame(width: 240, height: 240).padding(16).background(.white, in: RoundedRectangle(cornerRadius: 20))
                }
                VStack(alignment: .leading, spacing: 14) {
                    Text("Point your phone's camera at the code, or go to").font(.system(size: 24)).foregroundStyle(FitColor.dim)
                    Text("arisetodo.com/tv").font(.system(size: 50, weight: .black)).foregroundStyle(FitColor.ember)
                    Text("and type").font(.system(size: 24)).foregroundStyle(FitColor.dim)
                    Text(code.map(String.init).joined(separator: " ")).font(.system(size: 80, weight: .heavy, design: .monospaced)).foregroundStyle(.white)
                    HStack(spacing: 20) {
                        ProgressView()
                        Button("Cancel") { model.cancelSignIn() }
                    }
                }
            }
            .padding(44).frame(maxWidth: .infinity, alignment: .leading)
            .background(FitColor.card, in: RoundedRectangle(cornerRadius: 34))
        } else {
            Button { Task { await model.startSignIn() } } label: {
                HStack(spacing: 30) {
                    Image(systemName: "person.crop.circle.badge.plus").font(.system(size: 70)).foregroundStyle(FitColor.ember)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Sign in to Arise Fit").font(.system(size: 40, weight: .black)).foregroundStyle(.white)
                        Text(why).font(.system(size: 24)).foregroundStyle(FitColor.dim)
                    }
                    Spacer()
                    Text("Sign in").font(.system(size: 26, weight: .black)).foregroundStyle(.black).padding(.horizontal, 30).padding(.vertical, 14).background(.white, in: Capsule())
                }
                .padding(40).frame(maxWidth: .infinity, alignment: .leading)
                .background(FitColor.card, in: RoundedRectangle(cornerRadius: 34))
            }
            .buttonStyle(FitLift(radius: 34))
            if let e = model.error { Text(e).font(.system(size: 22)).foregroundStyle(.red) }
        }
    }
}

// MARK: - Today

struct FitTVToday: View {
    @EnvironmentObject var model: FitTVModel
    let play: (FitSession) -> Void
    let go: (FitTab) -> Void
    private var featured: FitSession? {
        let pool = FitSession.all.filter { $0.category != "c25k" }
        guard !pool.isEmpty else { return FitSession.all.first }
        return pool[(Calendar.current.ordinality(of: .day, in: .era, for: Date()) ?? 0) % pool.count]
    }
    var body: some View {
        FitPage {
            FitHeader(eyebrow: Date().formatted(.dateTime.weekday(.wide).month(.wide).day()), title: greeting, sub: model.me == nil ? "Follow-along workouts. Pick one and press play." : nil)
            if FitSession.all.isEmpty { Text("The workouts didn't load. Update Arise Fit from the App Store on this Apple TV.").font(.system(size: 28, weight: .bold)).foregroundStyle(FitColor.ember) }
            if let me = model.me {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 26), count: 3), spacing: 26) {
                    ForEach(me.slots) { s in
                        Button { if s.id == "fit.workouts" || s.id == "fit.streak" { go(.history) } } label: { FitSlotCard(slot: s) }.buttonStyle(FitLift())
                    }
                }
                HStack(spacing: 20) {
                    Text("Water").font(.system(size: 30, weight: .bold)).foregroundStyle(.white)
                    ForEach(me.units == "lb" ? ["+8 oz", "+16 oz"] : ["+250 ml", "+500 ml"], id: \.self) { label in
                        Button { Task { await model.addWater(Self.ml(label)) } } label: {
                            Label(label, systemImage: "drop.fill").font(.system(size: 26, weight: .bold)).foregroundStyle(.white)
                                .padding(.horizontal, 30).padding(.vertical, 16).background(Color(red: 0.23, green: 0.51, blue: 0.96), in: Capsule())
                        }
                        .buttonStyle(FitLift(radius: 40))
                    }
                }
                HStack(alignment: .top, spacing: 30) {
                    if let p = me.program {
                        Button { play(p.session) } label: {
                            VStack(alignment: .leading, spacing: 14) {
                                Text("NEXT IN YOUR PROGRAM").font(.system(size: 18, weight: .heavy)).tracking(3).foregroundStyle(FitColor.ember)
                                Text(p.dayName).font(.system(size: 44, weight: .black)).foregroundStyle(.white).lineLimit(1)
                                Text("\(p.name) · week \(p.week) of \(p.weeks) · \(p.session.mins) min").font(.system(size: 22)).foregroundStyle(FitColor.dim)
                                Text(p.exercises.prefix(4).map(\.name).joined(separator: " · ")).font(.system(size: 22)).foregroundStyle(FitColor.faint).lineLimit(2)
                                Label("Start", systemImage: "play.fill").font(.system(size: 26, weight: .black)).foregroundStyle(.black).padding(.horizontal, 30).padding(.vertical, 14).background(.white, in: Capsule())
                            }
                            .padding(36).frame(maxWidth: .infinity, minHeight: 360, alignment: .topLeading)
                            .background(LinearGradient(colors: [FitColor.ember.opacity(0.55), FitColor.card], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 30))
                        }
                        .buttonStyle(FitLift(radius: 30))
                    }
                    FitWeekChart(week: me.week).frame(maxWidth: .infinity)
                }
            } else {
                FitSignInCard(why: "See your calories, water, streak and program, log water, and save the workouts you do here.")
            }
            if let f = featured {
                Button { play(f) } label: { FitTVHero(session: f, cat: fitCategories.first { $0.id == f.category }) }.buttonStyle(.card)
            }
        }
    }
    /** "+8 oz" → 237 ml, "+500 ml" → 500. */
    static func ml(_ label: String) -> Int {
        let n = Double(label.filter(\.isNumber)) ?? 0
        return label.hasSuffix("oz") ? Int((n * 29.5735).rounded()) : Int(n)
    }
    private var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        let first = model.me?.name.split(separator: " ").first.map(String.init) ?? ""
        let part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
        return first.isEmpty ? part : "\(part), \(first)"
    }
}

struct FitSlotCard: View {
    let slot: FitTVSummary.Slot
    var body: some View {
        let tint = FitColor.hex(slot.tint)
        VStack(alignment: .leading, spacing: 12) {
            Text(slot.title.uppercased()).font(.system(size: 18, weight: .heavy)).tracking(2).foregroundStyle(tint)
            Text(slot.value).font(.system(size: 54, weight: .black)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.6)
            Text(slot.detail).font(.system(size: 22)).foregroundStyle(FitColor.dim).lineLimit(1)
            if let p = slot.progress {
                GeometryReader { g in
                    ZStack(alignment: .leading) {
                        Capsule().fill(.white.opacity(0.12))
                        Capsule().fill(tint).frame(width: g.size.width * min(1, max(0.02, p)))
                    }
                }
                .frame(height: 12)
            }
            ForEach(slot.lines.prefix(2), id: \.self) { Text($0).font(.system(size: 18)).foregroundStyle(FitColor.faint).lineLimit(1) }
            Spacer(minLength: 0)
        }
        .padding(30).frame(maxWidth: .infinity, minHeight: 280, alignment: .topLeading)
        .background(FitColor.card, in: RoundedRectangle(cornerRadius: 28))
    }
}

struct FitWeekChart: View {
    let week: [FitTVSummary.Day]
    var body: some View {
        let most = max(30, week.map(\.mins).max() ?? 30)
        VStack(alignment: .leading, spacing: 18) {
            Text("YOUR WEEK").font(.system(size: 18, weight: .heavy)).tracking(3).foregroundStyle(FitColor.ember)
            Text("\(week.map(\.mins).reduce(0, +)) minutes").font(.system(size: 44, weight: .black)).foregroundStyle(.white)
            HStack(alignment: .bottom, spacing: 18) {
                ForEach(week) { d in
                    VStack(spacing: 8) {
                        if d.mins > 0 { Text("\(d.mins)").font(.system(size: 16, weight: .bold)).foregroundStyle(FitColor.dim) }
                        RoundedRectangle(cornerRadius: 8).fill(d.mins > 0 ? FitColor.ember : .white.opacity(0.1))
                            .frame(height: max(10, 150 * CGFloat(d.mins) / CGFloat(most)))
                        Text(String(Self.weekday(d.day).prefix(1))).font(.system(size: 18, weight: .bold)).foregroundStyle(FitColor.faint)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 200, alignment: .bottom)
        }
        .padding(36).frame(minHeight: 360, alignment: .topLeading)
        .background(FitColor.card, in: RoundedRectangle(cornerRadius: 30))
    }
    static func weekday(_ day: String) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        return f.date(from: day)?.formatted(.dateTime.weekday(.abbreviated)) ?? ""
    }
}

struct FitTVHero: View {
    let session: FitSession
    let cat: FitCategory?
    var body: some View {
        HStack(spacing: 50) {
            VStack(alignment: .leading, spacing: 14) {
                Text("TODAY'S PICK").font(.system(size: 20, weight: .heavy)).tracking(4).foregroundStyle(.white.opacity(0.8))
                Text(session.name).font(.system(size: 60, weight: .black)).foregroundStyle(.white).lineLimit(2)
                Text(session.blurb).font(.system(size: 26)).foregroundStyle(.white.opacity(0.85)).lineLimit(2)
                HStack(spacing: 18) {
                    Label("\(session.mins) min", systemImage: "clock.fill")
                    Label(session.level, systemImage: "chart.bar.fill")
                    Label(session.equipment, systemImage: "figure.mixed.cardio").lineLimit(1)
                }
                .font(.system(size: 24, weight: .semibold)).foregroundStyle(.white)
                Label("Play", systemImage: "play.fill").font(.system(size: 28, weight: .black)).foregroundStyle(.black)
                    .padding(.horizontal, 34).padding(.vertical, 16).background(.white, in: Capsule()).padding(.top, 8)
            }
            Spacer(minLength: 0)
            Image(systemName: cat?.symbol ?? "figure.run").font(.system(size: 200, weight: .bold)).foregroundStyle(.white.opacity(0.9))
        }
        .padding(56)
        .frame(width: 1700, height: 440, alignment: .leading)
        .background(LinearGradient(colors: [(cat?.tint ?? FitColor.ember), FitColor.ember.opacity(0.75), FitColor.card], startPoint: .topLeading, endPoint: .bottomTrailing))
    }
}

// MARK: - Workouts, Program, Timers, History, You

struct FitRow: View {
    let title: String
    let symbol: String
    let tint: Color
    let items: [FitSession]
    let play: (FitSession) -> Void
    var body: some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 14) {
                    Image(systemName: symbol).font(.system(size: 30, weight: .bold)).foregroundStyle(tint)
                    Text(title).font(.system(size: 36, weight: .bold)).foregroundStyle(.white)
                    Text("\(items.count)").font(.system(size: 24, weight: .bold)).foregroundStyle(FitColor.dim)
                }
                ScrollView(.horizontal) {
                    LazyHStack(spacing: 40) {
                        ForEach(items) { s in
                            Button { play(s) } label: { FitTVCard(session: s, symbol: symbol, tint: tint) }.buttonStyle(.card)
                        }
                    }
                    .padding(.vertical, 34)
                }
                .scrollClipDisabled()
            }
        }
    }
}

struct FitTVCard: View {
    let session: FitSession
    let symbol: String
    let tint: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: symbol).font(.system(size: 30, weight: .bold)).foregroundStyle(tint)
                Spacer()
                Text("\(session.mins) min").font(.system(size: 24, weight: .black)).foregroundStyle(.white)
            }
            Text(session.name).font(.system(size: 30, weight: .bold)).foregroundStyle(.white).lineLimit(2)
            Text(session.blurb).font(.system(size: 20)).foregroundStyle(FitColor.dim).lineLimit(2)
            Spacer(minLength: 0)
            HStack {
                Text(session.level).font(.system(size: 18, weight: .bold)).foregroundStyle(tint)
                    .padding(.horizontal, 12).padding(.vertical, 5).background(tint.opacity(0.18), in: Capsule())
                Spacer()
                Text(session.equipment).font(.system(size: 18)).foregroundStyle(FitColor.dim).lineLimit(1)
            }
        }
        .padding(28)
        .frame(width: 480, height: 290, alignment: .topLeading)
        .background(LinearGradient(colors: [tint.opacity(0.32), FitColor.card], startPoint: .topLeading, endPoint: .bottomTrailing))
    }
}

struct FitTVWorkouts: View {
    @EnvironmentObject var model: FitTVModel
    let play: (FitSession) -> Void
    var body: some View {
        FitPage {
            FitHeader(eyebrow: "Arise Fit", title: "Follow-along workouts", sub: "Pick one and press play. Play/Pause pauses; swipe to skip a step; Menu ends it.")
            if let r = model.me?.routines, !r.isEmpty { FitRow(title: "Your routines", symbol: "dumbbell.fill", tint: FitColor.ember, items: r, play: play) }
            ForEach(fitCategories) { cat in
                FitRow(title: cat.name, symbol: cat.symbol, tint: cat.tint, items: FitSession.all.filter { $0.category == cat.id }, play: play)
            }
        }
    }
}

struct FitTVProgram: View {
    @EnvironmentObject var model: FitTVModel
    @State private var noYouTube = false
    let play: (FitSession) -> Void
    let go: (FitTab) -> Void
    var body: some View {
        FitPage {
            if let p = model.me?.program {
                FitHeader(eyebrow: "\(p.name) · week \(p.week) of \(p.weeks)", title: p.dayName, sub: p.blurb)
                HStack(spacing: 20) {
                    Button { play(p.session) } label: {
                        Label("Start · \(p.session.mins) min", systemImage: "play.fill").font(.system(size: 30, weight: .black)).foregroundStyle(.black)
                            .padding(.horizontal, 40).padding(.vertical, 20).background(.white, in: Capsule())
                    }
                    .buttonStyle(FitLift(radius: 40))
                    Text("\(p.done) workouts done in this program").font(.system(size: 24)).foregroundStyle(FitColor.dim)
                }
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 24), count: 3), spacing: 24) {
                    ForEach(Array(p.exercises.enumerated()), id: \.offset) { pair in
                        // Pressing an exercise plays its how-to video in the YouTube app.
                        Button { if let v = pair.element.video { FitVideoCard.open(v.id) { noYouTube = true } } } label: {
                            HStack(spacing: 20) {
                                Text("\(pair.offset + 1)").font(.system(size: 34, weight: .black)).foregroundStyle(FitColor.ember).frame(width: 60)
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(pair.element.name).font(.system(size: 28, weight: .bold)).foregroundStyle(.white).lineLimit(2)
                                    Text("\(pair.element.sets) sets × \(pair.element.reps)").font(.system(size: 22)).foregroundStyle(FitColor.dim)
                                    if pair.element.video != nil { Label("Watch how", systemImage: "play.rectangle.fill").font(.system(size: 20, weight: .bold)).foregroundStyle(.red) }
                                }
                                Spacer(minLength: 0)
                                if let v = pair.element.video {
                                    AsyncImage(url: URL(string: "https://i.ytimg.com/vi/\(v.id)/mqdefault.jpg")) { img in img.resizable().aspectRatio(16 / 9, contentMode: .fill) } placeholder: { Color.white.opacity(0.08) }
                                        .frame(width: 150, height: 84).clipShape(RoundedRectangle(cornerRadius: 10))
                                }
                            }
                            .padding(28).frame(maxWidth: .infinity, minHeight: 150, alignment: .leading)
                            .background(FitColor.card, in: RoundedRectangle(cornerRadius: 26))
                        }
                        .buttonStyle(FitLift(radius: 26))
                    }
                }
                Text(noYouTube ? "Get the YouTube app from the App Store to watch the how-to videos here." : "Each set is timed for you, with your program's rest between sets. Press an exercise to watch how it's done (it opens in YouTube). Log the weights on your phone afterwards.").font(.system(size: 22)).foregroundStyle(noYouTube ? .yellow : FitColor.faint)
            } else if model.me != nil {
                FitHeader(eyebrow: "Program", title: "No program yet", sub: "Pick a strength program in Arise Fit on your phone (Train → Programs), and its next day is here, ready to play.")
                Button { go(.workouts) } label: { Label("Browse workouts", systemImage: "play.rectangle.fill").font(.system(size: 28, weight: .bold)).padding(.horizontal, 34).padding(.vertical, 18).background(FitColor.card, in: Capsule()) }.buttonStyle(FitLift(radius: 40))
            } else {
                FitHeader(eyebrow: "Program", title: "Your strength program")
                FitSignInCard(why: "Your program's next day, set by set, with the rest timed for you.")
            }
        }
    }
}

struct FitTVTimers: View {
    @EnvironmentObject var model: FitTVModel
    let play: (FitSession) -> Void
    var body: some View {
        FitPage {
            FitHeader(eyebrow: "Interval timers", title: "Timers", sub: "Work, rest and rounds, called out for you. Make your own in Arise Fit on your phone.")
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 30), count: 3), spacing: 30) {
                ForEach(model.timers) { t in
                    Button { play(t) } label: {
                        VStack(alignment: .leading, spacing: 12) {
                            Image(systemName: "timer").font(.system(size: 40, weight: .bold)).foregroundStyle(FitColor.ember)
                            Text(t.name).font(.system(size: 34, weight: .black)).foregroundStyle(.white).lineLimit(1)
                            Text(describe(t)).font(.system(size: 22)).foregroundStyle(FitColor.dim).lineLimit(2)
                            Text("\(t.mins) min").font(.system(size: 26, weight: .bold)).foregroundStyle(.white)
                        }
                        .padding(32).frame(maxWidth: .infinity, minHeight: 280, alignment: .topLeading)
                        .background(FitColor.card, in: RoundedRectangle(cornerRadius: 28))
                    }
                    .buttonStyle(FitLift())
                }
            }
        }
    }
    private func describe(_ t: FitSession) -> String {
        let work = t.phases.filter { $0.kind == "work" }
        guard let w = work.first else { return "" }
        let rest = t.phases.first { $0.kind == "rest" }?.secs ?? 0
        return "\(work.count) rounds · \(w.secs)s on" + (rest > 0 ? ", \(rest)s off" : "")
    }
}

struct FitTVHistory: View {
    @EnvironmentObject var model: FitTVModel
    var body: some View {
        FitPage {
            FitHeader(eyebrow: "Your log", title: "History")
            if let me = model.me {
                FitWeekChart(week: me.week)
                if me.history.isEmpty { Text("No workouts yet. Play one and it's saved here.").font(.system(size: 26)).foregroundStyle(FitColor.dim) }
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 24), count: 3), spacing: 24) {
                    ForEach(me.history) { w in
                        Button { } label: {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(FitTVHistory.when(w.date, today: me.day)).font(.system(size: 18, weight: .heavy)).foregroundStyle(FitColor.ember)
                                Text(w.name).font(.system(size: 28, weight: .bold)).foregroundStyle(.white).lineLimit(2)
                                Text("\(w.mins) min" + (w.sets > 0 ? " · \(w.sets) sets" : "")).font(.system(size: 22)).foregroundStyle(FitColor.dim)
                            }
                            .padding(28).frame(maxWidth: .infinity, minHeight: 180, alignment: .topLeading)
                            .background(FitColor.card, in: RoundedRectangle(cornerRadius: 26))
                        }
                        .buttonStyle(FitLift(radius: 26))
                    }
                }
            } else {
                FitSignInCard(why: "Your workouts from your phone, your watch and this TV, and your week at a glance.")
            }
        }
    }
    static func when(_ day: String, today: String) -> String {
        if day == today { return "TODAY" }
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        return f.date(from: day)?.formatted(.dateTime.weekday(.wide).month(.abbreviated).day()).uppercased() ?? day
    }
}

struct FitTVYou: View {
    @EnvironmentObject var model: FitTVModel
    @AppStorage("fitVoice") private var voice = true
    @AppStorage("fitChime") private var chime = true
    @State private var confirm = false
    var body: some View {
        FitPage {
            FitHeader(eyebrow: "Settings", title: model.me?.name.isEmpty == false ? model.me!.name : "You")
            toggle("Coach's voice", "Says each step out loud and counts down the last seconds.", "speaker.wave.2.fill", $voice)
            toggle("Chime", "A tone at each change and the last three seconds.", "bell.fill", $chime)
            if model.token != nil {
                Button { confirm = true } label: {
                    Label("Sign out of this TV", systemImage: "rectangle.portrait.and.arrow.right").font(.system(size: 28, weight: .bold)).foregroundStyle(.red)
                        .padding(.horizontal, 34).padding(.vertical, 22).frame(maxWidth: 800, alignment: .leading).background(FitColor.card, in: RoundedRectangle(cornerRadius: 24))
                }
                .buttonStyle(FitLift(radius: 24))
            } else {
                FitSignInCard(why: "Your numbers, program and history, and the workouts you do here saved to your log.")
            }
        }
        .alert("Sign out of this TV?", isPresented: $confirm) {
            Button("Sign out", role: .destructive) { model.signOut() }
            Button("Cancel", role: .cancel) { }
        }
    }
    private func toggle(_ title: String, _ sub: String, _ symbol: String, _ on: Binding<Bool>) -> some View {
        Button { on.wrappedValue.toggle() } label: {
            HStack(spacing: 24) {
                Image(systemName: symbol).font(.system(size: 34)).foregroundStyle(FitColor.ember).frame(width: 60)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.system(size: 30, weight: .bold)).foregroundStyle(.white)
                    Text(sub).font(.system(size: 22)).foregroundStyle(FitColor.dim)
                }
                Spacer()
                Text(on.wrappedValue ? "On" : "Off").font(.system(size: 28, weight: .black)).foregroundStyle(on.wrappedValue ? FitColor.ember : FitColor.faint)
            }
            .padding(30).frame(maxWidth: 1200).background(FitColor.card, in: RoundedRectangle(cornerRadius: 24))
        }
        .buttonStyle(FitLift(radius: 24))
    }
}

// MARK: - The player

/** The session itself: one phase at a time, a ring counting it down, the coach saying what to do. */
struct FitTVPlayer: View {
    let session: FitSession
    @EnvironmentObject var model: FitTVModel
    @Environment(\.dismiss) private var dismiss
    @AppStorage("fitVoice") private var voiceOn = true
    @AppStorage("fitChime") private var chimeOn = true
    @State private var index = 0
    @State private var left = 0
    @State private var paused = false
    @State private var finished = false
    @State private var active = 0
    @State private var saved: Bool?
    @Environment(\.scenePhase) private var scene
    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private var phase: FitPhase? { session.phases.indices.contains(index) ? session.phases[index] : nil }
    private var next: FitPhase? { session.phases.indices.contains(index + 1) ? session.phases[index + 1] : nil }
    private var totalLeft: Int { left + session.phases.dropFirst(index + 1).reduce(0) { $0 + $1.secs } }

    var body: some View {
        ZStack {
            FitColor.deep.ignoresSafeArea()
            RadialGradient(colors: [color(phase?.kind ?? "warm").opacity(0.45), .clear], center: .center, startRadius: 0, endRadius: 1200).ignoresSafeArea()
            if finished { done } else if let p = phase { running(p) }
        }
        .onAppear {
            left = phase?.secs ?? 0
            UIApplication.shared.isIdleTimerDisabled = true
            FitVoice.shared.prepare()
            // Every line of the session, fetched now in the AI voice, so each one is ready when its step starts.
            FitVoice.shared.preload(session.phases.indices.map { line(for: $0) } + ["Paused.", "Let's go.", "Workout saved. Nice work.", "Workout complete. Great job!", "Ten seconds.", "Halfway."] + (1...3).map { "\($0)" })
            announce()
        }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false; FitVoice.shared.stop() }
        .onReceive(tick) { _ in step() }
        // Off to the YouTube app (a how-to video): paused until you come back.
        .onChange(of: scene) { _, now in if now != .active && !finished { paused = true } }
        .onPlayPauseCommand { if !finished { paused.toggle(); if voiceOn { FitVoice.shared.say(paused ? "Paused." : "Let's go.") } } }
        .onMoveCommand { dir in
            guard !finished else { return }
            if dir == .right { go(index + 1) } else if dir == .left { go(max(0, index - 1)) }
        }
        .onExitCommand { Task { await finish(early: true) } }
    }

    private func running(_ p: FitPhase) -> some View {
        let tint = color(p.kind)
        return VStack(spacing: 0) {
            HStack {
                Text(session.name.uppercased()).font(.system(size: 24, weight: .heavy)).tracking(3).foregroundStyle(.white.opacity(0.75)).lineLimit(1)
                Spacer()
                Text("Step \(index + 1) of \(session.phases.count) · \(clock(totalLeft)) left").font(.system(size: 26, weight: .bold).monospacedDigit()).foregroundStyle(.white.opacity(0.75))
            }
            .padding(.horizontal, 90).padding(.top, 50)
            Spacer(minLength: 20)
            HStack(alignment: .center, spacing: 90) {
                ZStack {
                    Circle().stroke(.white.opacity(0.12), lineWidth: 34)
                    Circle().trim(from: 0, to: CGFloat(left) / CGFloat(max(1, p.secs)))
                        .stroke(tint, style: StrokeStyle(lineWidth: 34, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .animation(.linear(duration: 1), value: left)
                    VStack(spacing: 0) {
                        Text(clock(left)).font(.system(size: 210, weight: .heavy, design: .rounded).monospacedDigit()).foregroundStyle(.white)
                            .minimumScaleFactor(0.5).lineLimit(1)
                        Text(paused ? "PAUSED" : p.kind == "rest" ? "REST" : p.kind.uppercased().replacingOccurrences(of: "-", with: " "))
                            .font(.system(size: 30, weight: .heavy)).tracking(5).foregroundStyle(paused ? .yellow : tint)
                    }
                    .padding(60)
                }
                .frame(width: 620, height: 620)
                VStack(alignment: .leading, spacing: 26) {
                    Text(p.name).font(.system(size: 96, weight: .black)).foregroundStyle(.white).lineLimit(2).minimumScaleFactor(0.5)
                    if let cue = p.cue, !cue.isEmpty { Text(cue).font(.system(size: 38, weight: .medium)).foregroundStyle(.white.opacity(0.9)).lineLimit(4) }
                    if let v = p.video { FitVideoCard(video: v, compact: true) }
                    if p.speed != nil || p.incline != nil {
                        HStack(spacing: 24) {
                            if let s = p.speed { chip(String(format: "%.1f mph", s), "speedometer", tint) }
                            if let i = p.incline { chip(String(format: "%g%% incline", i), "arrow.up.right", tint) }
                        }
                    }
                    if let n = next {
                        HStack(spacing: 18) {
                            Text("NEXT").font(.system(size: 22, weight: .heavy)).tracking(3).foregroundStyle(color(n.kind))
                            Text(n.name).font(.system(size: 34, weight: .bold)).foregroundStyle(.white).lineLimit(1)
                            Text(clock(n.secs)).font(.system(size: 30, weight: .semibold).monospacedDigit()).foregroundStyle(.white.opacity(0.6))
                        }
                        .padding(.horizontal, 30).padding(.vertical, 20).background(.white.opacity(0.1), in: Capsule())
                    }
                }
                .frame(maxWidth: 900, alignment: .leading)
            }
            .padding(.horizontal, 90)
            Spacer(minLength: 20)
            VStack(spacing: 14) {
                GeometryReader { g in
                    ZStack(alignment: .leading) {
                        Capsule().fill(.white.opacity(0.14))
                        Capsule().fill(tint).frame(width: g.size.width * CGFloat(session.secs - totalLeft) / CGFloat(max(1, session.secs)))
                    }
                }
                .frame(height: 14)
                Text("Play/Pause to pause · swipe left or right to skip · Menu to end").font(.system(size: 22)).foregroundStyle(.white.opacity(0.5))
            }
            .padding(.horizontal, 90).padding(.bottom, 60)
        }
    }

    private var done: some View {
        VStack(spacing: 30) {
            Image(systemName: "checkmark.seal.fill").font(.system(size: 150)).foregroundStyle(.green)
            Text("Workout done!").font(.system(size: 80, weight: .black)).foregroundStyle(.white)
            Text("\(session.name) · \(clock(active))").font(.system(size: 34)).foregroundStyle(.white.opacity(0.75))
            if let saved { Text(saved ? "Saved to your Arise Fit workout log." : "Couldn't save it to your log just now.").font(.system(size: 28, weight: .semibold)).foregroundStyle(saved ? .green : .orange) }
            else if model.token == nil { Text("Sign in on the Today screen to save workouts to your log.").font(.system(size: 26)).foregroundStyle(.white.opacity(0.6)) }
            Button("Back to workouts") { dismiss() }.font(.system(size: 30, weight: .bold))
        }
    }

    private func chip(_ text: String, _ symbol: String, _ tint: Color) -> some View {
        Label(text, systemImage: symbol).font(.system(size: 40, weight: .black)).foregroundStyle(.white)
            .padding(.horizontal, 30).padding(.vertical, 16).background(tint.opacity(0.35), in: Capsule())
    }

    private func step() {
        guard !paused, !finished, let p = phase else { return }
        active += 1
        if left > 1 {
            left -= 1
            if left <= 3 {
                if voiceOn && FitVoice.shared.has("\(left)") { FitVoice.shared.say("\(left)", interrupt: true) } else if chimeOn { FitChime.shared.beep(final: false) }
            } else if voiceOn && left == 10 && p.kind == "work" && p.secs >= 30 {
                FitVoice.shared.say("Ten seconds.")
            } else if voiceOn && p.secs >= 90 && left == p.secs / 2 {
                FitVoice.shared.say("Halfway.")
            }
        } else { go(index + 1) }
    }

    private func go(_ i: Int) {
        if i >= session.phases.count { Task { await finish(early: false) }; return }
        index = i
        left = session.phases[i].secs
        if chimeOn { FitChime.shared.beep(final: true) }
        announce()
    }

    /** "Sprint. 30 seconds. Push the pace." */
    private func line(for i: Int) -> String {
        let p = session.phases[i]
        var words = [p.name, duration(p.secs)]
        if let s = p.speed { words.append(String(format: "Speed %.1f", s)) }
        if let inc = p.incline, inc > 0 { words.append(String(format: "Incline %g", inc)) }
        if let cue = p.cue, !cue.isEmpty { words.append(cue.replacingOccurrences(of: " · ", with: ". ")) }
        return words.joined(separator: ". ")
    }
    private func announce() {
        guard voiceOn, phase != nil else { return }
        FitVoice.shared.say(line(for: index), interrupt: true)
        // The steps after this one, so they're ready too.
        FitVoice.shared.preload((index + 1..<min(session.phases.count, index + 4)).map { line(for: $0) })
    }

    private func finish(early: Bool) async {
        if finished { dismiss(); return }
        if early && active < 60 { dismiss(); return }
        finished = true
        if chimeOn { FitChime.shared.beep(final: true) }
        if voiceOn { FitVoice.shared.say(early ? "Workout saved. Nice work." : "Workout complete. Great job!", interrupt: true) }
        if model.token != nil { saved = await model.logWorkout(session.name, secs: active) }
    }

    private func duration(_ s: Int) -> String {
        if s < 60 { return "\(s) seconds" }
        let m = s / 60, r = s % 60
        return r == 0 ? "\(m) minute\(m == 1 ? "" : "s")" : "\(m) minute\(m == 1 ? "" : "s") \(r) seconds"
    }
    private func clock(_ s: Int) -> String { s >= 3600 ? String(format: "%d:%02d:%02d", s / 3600, s / 60 % 60, s % 60) : String(format: "%d:%02d", s / 60, s % 60) }

    private func color(_ kind: String) -> Color {
        switch kind {
        case "work": return Color(red: 1, green: 0.27, blue: 0.27)
        case "rest", "breathe-out": return Color(red: 0.2, green: 0.85, blue: 0.5)
        case "pose", "still": return Color(red: 0.66, green: 0.45, blue: 1)
        case "breathe-in", "hold": return Color(red: 0.3, green: 0.6, blue: 1)
        case "cool": return Color(red: 0.2, green: 0.8, blue: 0.8)
        default: return FitColor.ember
        }
    }
}

/** The coach's voice: the phone app's AI voice ("troy"), from the server (POST /api/voice/say), never the
 *  TV's built-in robot voice. Lines are fetched ahead and kept; one that isn't ready in time is skipped
 *  (a countdown number becomes the chime), so the coach is never late or out of step. */
@MainActor
final class FitVoice: NSObject, AVAudioPlayerDelegate {
    static let shared = FitVoice()
    private var ready: [String: Data] = [:]
    private var loading: [String: Task<Data?, Never>] = [:]
    private var player: AVAudioPlayer?
    private var queue: [String] = []
    private var turn = 0
    /** The voice couldn't be reached (shown in You). */
    private(set) var unreachable = false

    func prepare() {
        let s = AVAudioSession.sharedInstance()
        try? s.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers, .mixWithOthers])
        try? s.setActive(true)
    }

    static func clean(_ text: String) -> String { text.split(whereSeparator: \.isWhitespace).joined(separator: " ") }

    private func fetch(_ text: String) -> Task<Data?, Never> {
        if let t = loading[text] { return t }
        let t = Task<Data?, Never> { [weak self] in
            for attempt in 0..<3 {
                if attempt > 0 { try? await Task.sleep(nanoseconds: UInt64(attempt) * 1_200_000_000) }
                var req = URLRequest(url: fitAPI.appending(path: "/api/voice/say"))
                req.httpMethod = "POST"
                req.setValue("application/json", forHTTPHeaderField: "Content-Type")
                req.httpBody = try? JSONSerialization.data(withJSONObject: ["text": text, "voice": "troy"])
                req.timeoutInterval = 20
                guard let (data, res) = try? await URLSession.shared.data(for: req) else { continue }
                let status = (res as? HTTPURLResponse)?.statusCode ?? 0
                if status == 200, data.count > 100 { self?.ready[text] = data; self?.unreachable = false; return data }
                if status != 429 && status < 500 { break }
            }
            self?.loading[text] = nil
            self?.unreachable = true
            return nil
        }
        loading[text] = t
        return t
    }

    /** Fetches lines now (a few at a time), so they play the moment they're needed. */
    func preload(_ lines: [String]) {
        let want = Array(NSOrderedSet(array: lines.map(Self.clean).filter { !$0.isEmpty && ready[$0] == nil && loading[$0] == nil })) as? [String] ?? []
        guard !want.isEmpty else { return }
        Task { [weak self] in
            var i = 0
            while i < want.count {
                guard let self else { return }
                let batch = want[i..<min(want.count, i + 3)].map { self.fetch($0) }
                for t in batch { _ = await t.value }
                i += 3
            }
        }
    }

    /** Whether a line is ready to play right now. */
    func has(_ text: String) -> Bool { ready[Self.clean(text)] != nil }

    /** Says a line (cutting off what's playing when `interrupt`); late lines are dropped, not played out of step. */
    func say(_ text: String, interrupt: Bool = false) {
        let t = Self.clean(text)
        guard !t.isEmpty else { return }
        if interrupt { turn += 1; queue.removeAll(); player?.stop(); player = nil }
        let mine = turn
        if let d = ready[t] { play(d, text: t); return }
        Task { [weak self] in
            guard let self else { return }
            let started = Date()
            guard let d = await self.fetch(t).value, self.turn == mine, Date().timeIntervalSince(started) < 4 else { return }
            self.play(d, text: t)
        }
    }

    private func play(_ data: Data, text: String) {
        if let p = player, p.isPlaying { queue.append(text); return }
        guard let p = try? AVAudioPlayer(data: data) else { return }
        p.delegate = self
        p.volume = 1
        player = p
        p.play()
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            self.player = nil
            while !self.queue.isEmpty {
                let next = self.queue.removeFirst()
                if let d = self.ready[next] { self.play(d, text: next); return }
            }
        }
    }

    func stop() { turn += 1; queue.removeAll(); player?.stop(); player = nil }
}

/** An exercise's how-to video: its picture and title; pressing it opens the YouTube app at that video
 *  (tvOS has no web view, so YouTube can't play inside another app). */
struct FitVideoCard: View {
    let video: FitVideoRef
    var compact = false
    @State private var missing = false
    var body: some View {
        Button { Self.open(video.id) { missing = true } } label: {
            HStack(spacing: 22) {
                ZStack {
                    AsyncImage(url: URL(string: "https://i.ytimg.com/vi/\(video.id)/hqdefault.jpg")) { img in img.resizable().aspectRatio(16 / 9, contentMode: .fill) } placeholder: { Color.white.opacity(0.1) }
                        .frame(width: compact ? 240 : 320, height: compact ? 135 : 180)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    Image(systemName: "play.fill").font(.system(size: compact ? 34 : 44, weight: .bold)).foregroundStyle(.white)
                        .padding(compact ? 18 : 22).background(Color.red, in: Circle())
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("WATCH HOW").font(.system(size: 20, weight: .heavy)).tracking(3).foregroundStyle(FitColor.ember)
                    Text(video.title).font(.system(size: compact ? 26 : 30, weight: .semibold)).foregroundStyle(.white).lineLimit(2)
                    Text(missing ? "Get the YouTube app from the App Store to watch it here." : "Opens in YouTube. The workout waits.").font(.system(size: 20)).foregroundStyle(missing ? .yellow : .white.opacity(0.6))
                }
                .frame(maxWidth: 560, alignment: .leading)
            }
            .padding(14)
        }
        .buttonStyle(.card)
    }
    /** Opens the YouTube app at a video; `missing` runs when there's no YouTube app on this TV. */
    static func open(_ id: String, missing: @escaping @MainActor () -> Void) {
        guard let app = URL(string: "youtube://watch/\(id)") else { return }
        UIApplication.shared.open(app) { ok in
            if ok { return }
            Task { @MainActor in
                guard let web = URL(string: "https://www.youtube.com/watch?v=\(id)") else { missing(); return }
                UIApplication.shared.open(web) { ok2 in if !ok2 { Task { @MainActor in missing() } } }
            }
        }
    }
}

/** A short tone between phases (and a tick for the last three seconds), made on the fly. */
final class FitChime {
    static let shared = FitChime()
    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)!
    init() {
        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: format)
        try? engine.start()
    }
    func beep(final: Bool) {
        let secs = final ? 0.35 : 0.12, freq = final ? 880.0 : 660.0
        let frames = AVAudioFrameCount(44100 * secs)
        guard let buf = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames), let ch = buf.floatChannelData?[0] else { return }
        buf.frameLength = frames
        for i in 0..<Int(frames) {
            let t = Double(i) / 44100
            let env = min(1, t * 40) * max(0, 1 - t / secs)
            ch[i] = Float(sin(2 * .pi * freq * t) * 0.3 * env)
        }
        if !engine.isRunning { try? engine.start() }
        player.scheduleBuffer(buf, completionHandler: nil)
        if !player.isPlaying { player.play() }
    }
}

enum FitQR {
    static func image(_ text: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let out = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 10, y: 10)),
              let cg = CIContext().createCGImage(out, from: out.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}

// MARK: - Made-up numbers for the simulator screenshots (-fitSample YES)

func fitSampleJSON(_ day: String) -> String {
    let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
    let base = f.date(from: day) ?? Date()
    func d(_ n: Int) -> String { f.string(from: Calendar.current.date(byAdding: .day, value: n, to: base) ?? base) }
    let program = FitSession.all.first(where: { $0.category == "hiit" })
    let programJSON = (try? String(data: JSONSerialization.data(withJSONObject: [
        "id": "program-sample", "name": "Iron Progression: Lower · Heavy", "category": "hiit", "blurb": "Squat, hinge, lunge.", "level": "Intermediate", "equipment": "Barbell",
        "phases": [["name": "Warm up", "secs": 180, "kind": "warm", "cue": "Easy cardio and arm circles."], ["name": "Back Squat", "secs": 28, "kind": "work", "cue": "Set 1 of 4 · 5-8 reps · Bar on your upper back, feet shoulder width."], ["name": "Rest", "secs": 150, "kind": "rest", "cue": "Next: Back Squat"]],
    ]), encoding: .utf8)) ?? "null"
    _ = program
    return """
    {"name":"Jeremy Smith","day":"\(day)","units":"lb",
     "slots":[{"id":"fit.calories","title":"Calories left","value":"1,240","detail":"860 of 2,100 eaten","tint":"#ff5a1f","progress":0.41,"lines":["Protein 62 / 150 g","Carbs 90 / 210 g"]},
              {"id":"fit.water","title":"Water","value":"48 oz","detail":"Goal 80 oz","tint":"#3b82f6","progress":0.6,"lines":[]},
              {"id":"fit.workouts","title":"Workouts this week","value":"4","detail":"6 day streak","tint":"#22c55e","progress":null,"lines":["Push day · 45 min","Couch to 5K W3D2 · 28 min"]},
              {"id":"fit.protein","title":"Protein","value":"62 g","detail":"Goal 150 g","tint":"#3b82f6","progress":0.41,"lines":["88 g to go"]},
              {"id":"fit.streak","title":"Streak","value":"6 days","detail":"Keep it going","tint":"#f59e0b","progress":null,"lines":["4 workouts in 7 days"]},
              {"id":"fit.weight","title":"Weight","value":"184.6 lb","detail":"-3.2 lb in 30 days","tint":"#a855f7","progress":null,"lines":[]}],
     "program":{"name":"Iron Progression","blurb":"Four days a week of heavy compound lifts.","dayName":"Lower · Heavy","week":3,"weeks":8,"done":9,"session":\(programJSON),
                "exercises":[{"name":"Back Squat","sets":4,"reps":"5-8"},{"name":"Romanian Deadlift","sets":3,"reps":"8-10"},{"name":"Walking Lunge","sets":3,"reps":"10 each"},{"name":"Leg Press","sets":3,"reps":"12"},{"name":"Standing Calf Raise","sets":4,"reps":"15"},{"name":"Plank","sets":3,"reps":"45s"}]},
     "routines":[],"timers":[],
     "history":[{"name":"Push day","date":"\(d(-1))","mins":45,"sets":18},{"name":"Couch to 5K: Week 3, Day 2","date":"\(d(-2))","mins":28,"sets":0},{"name":"Yoga for Runners","date":"\(d(-3))","mins":20,"sets":0},{"name":"Pull day","date":"\(d(-4))","mins":50,"sets":20}],
     "week":[{"day":"\(d(-6))","mins":0},{"day":"\(d(-5))","mins":35},{"day":"\(d(-4))","mins":50},{"day":"\(d(-3))","mins":20},{"day":"\(d(-2))","mins":28},{"day":"\(d(-1))","mins":45},{"day":"\(day)","mins":0}]}
    """
}
