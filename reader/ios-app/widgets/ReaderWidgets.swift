// A.R.I.S.E. Reader Home Screen and Lock Screen widgets. The app writes a small snapshot (first
// name, points, quizzes passed, grade band) to a keychain item both share
// (client/src/lib/readerWidget.ts → ReaderWidgetPlugin in AppDelegate.swift); this reads it.
// Tapping a widget opens the app.
import Security
import SwiftUI
import WidgetKit

struct ReaderSnapshot: Codable {
    var name: String?
    var points: Int?
    var quizzes: Int?
    var band: String?
    var signedOut: Bool?
}

enum SharedSnapshot {
    static let service = "com.arisereader.reader.widget"
    static let account = "snapshot"
    static let group = "6TYWWNKX6P.com.arisereader.reader.shared"

    static func read() -> ReaderSnapshot? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: group,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var out: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        guard let s = try? JSONDecoder().decode(ReaderSnapshot.self, from: data), s.signedOut != true else { return nil }
        return s
    }
}

struct ReaderEntry: TimelineEntry {
    let date: Date
    let snapshot: ReaderSnapshot?
}

struct ReaderProvider: TimelineProvider {
    static let sample = ReaderSnapshot(name: "Ava", points: 240, quizzes: 18, band: "3-5", signedOut: false)
    func placeholder(in context: Context) -> ReaderEntry { ReaderEntry(date: Date(), snapshot: Self.sample) }
    func getSnapshot(in context: Context, completion: @escaping (ReaderEntry) -> Void) {
        completion(ReaderEntry(date: Date(), snapshot: context.isPreview ? Self.sample : (SharedSnapshot.read() ?? Self.sample)))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ReaderEntry>) -> Void) {
        let entry = ReaderEntry(date: Date(), snapshot: SharedSnapshot.read())
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(60 * 60))))
    }
}

private let violet = Color(red: 0.43, green: 0.16, blue: 0.85)
private let deep = Color(red: 0.20, green: 0.07, blue: 0.45)
private let gold = Color(red: 1.0, green: 0.78, blue: 0.25)

extension View {
    @ViewBuilder func readerBackground() -> some View {
        let fill = LinearGradient(colors: [violet, deep], startPoint: .topLeading, endPoint: .bottomTrailing)
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(fill, for: .widget)
        } else {
            self.padding().background(fill)
        }
    }
}

struct ReaderWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: ReaderEntry

    var body: some View {
        switch family {
        case .accessoryCircular: circular
        case .accessoryRectangular: rectangular
        case .accessoryInline: inline
        case .systemMedium: medium.readerBackground()
        default: small.readerBackground()
        }
    }

    private var s: ReaderSnapshot? { entry.snapshot }
    private var points: Int { s?.points ?? 0 }
    private var quizzes: Int { s?.quizzes ?? 0 }

    private var brand: some View {
        HStack(spacing: 4) {
            Image(systemName: "book.fill").font(.system(size: 11, weight: .bold))
            Text("A.R.I.S.E.").font(.system(size: 11, weight: .heavy)).tracking(0.5)
        }.foregroundStyle(.white.opacity(0.85))
    }

    private var signedOut: some View {
        VStack(alignment: .leading, spacing: 6) {
            brand
            Spacer(minLength: 0)
            Text("Open the app to sign in and see your points.")
                .font(.system(size: 13, weight: .semibold)).foregroundStyle(.white)
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    @ViewBuilder private var small: some View {
        if s == nil { signedOut } else {
            VStack(alignment: .leading, spacing: 2) {
                brand
                Spacer(minLength: 0)
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Image(systemName: "star.fill").font(.system(size: 18, weight: .bold)).foregroundStyle(gold)
                    Text("\(points)").font(.system(size: 38, weight: .heavy, design: .rounded)).foregroundStyle(.white)
                        .minimumScaleFactor(0.5).lineLimit(1)
                }
                Text("points").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.75))
                Text("\(quizzes) \(quizzes == 1 ? "quiz" : "quizzes") passed")
                    .font(.system(size: 12, weight: .bold)).foregroundStyle(.white).padding(.top, 4)
            }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder private var medium: some View {
        if s == nil { signedOut } else {
            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 2) {
                    brand
                    Spacer(minLength: 0)
                    Text("Hi, \(s?.name ?? "Reader")").font(.system(size: 15, weight: .bold)).foregroundStyle(.white.opacity(0.9)).lineLimit(1)
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Image(systemName: "star.fill").font(.system(size: 18, weight: .bold)).foregroundStyle(gold)
                        Text("\(points)").font(.system(size: 36, weight: .heavy, design: .rounded)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.5)
                        Text("pts").font(.system(size: 13, weight: .bold)).foregroundStyle(.white.opacity(0.75))
                    }
                }
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 8) {
                    stat("\(quizzes)", quizzes == 1 ? "quiz passed" : "quizzes passed")
                    if let band = s?.band, !band.isEmpty { stat(band, "grade band") }
                    Spacer(minLength: 0)
                    Text("Read now").font(.system(size: 13, weight: .heavy)).foregroundStyle(deep)
                        .padding(.horizontal, 12).padding(.vertical, 6).background(Capsule().fill(.white))
                }
            }
        }
    }

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(alignment: .trailing, spacing: 0) {
            Text(value).font(.system(size: 20, weight: .heavy, design: .rounded)).foregroundStyle(.white)
            Text(label).font(.system(size: 11, weight: .semibold)).foregroundStyle(.white.opacity(0.75))
        }
    }

    @ViewBuilder private var circular: some View {
        if #available(iOSApplicationExtension 16.0, *) {
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Image(systemName: "star.fill").font(.system(size: 10, weight: .bold))
                    Text(s == nil ? "–" : "\(points)").font(.system(size: 15, weight: .heavy, design: .rounded)).minimumScaleFactor(0.5).lineLimit(1)
                }
            }.widgetAccentableIfAvailable()
        }
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("A.R.I.S.E. Reader").font(.system(size: 12, weight: .heavy))
            if s == nil {
                Text("Open the app to sign in").font(.system(size: 13))
            } else {
                Text("★ \(points) points").font(.system(size: 14, weight: .bold))
                Text("\(quizzes) \(quizzes == 1 ? "quiz" : "quizzes") passed").font(.system(size: 12))
            }
        }.frame(maxWidth: .infinity, alignment: .leading)
    }

    private var inline: some View {
        Text(s == nil ? "A.R.I.S.E. Reader" : "★ \(points) pts · \(quizzes) quizzes")
    }
}

extension View {
    @ViewBuilder func widgetAccentableIfAvailable() -> some View {
        if #available(iOSApplicationExtension 16.0, *) { self.widgetAccentable() } else { self }
    }
}

struct ReaderPointsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ReaderPoints", provider: ReaderProvider()) { entry in
            ReaderWidgetView(entry: entry)
        }
        .configurationDisplayName("My reading")
        .description("Your points and quizzes passed. Tap to keep reading.")
        .supportedFamilies(Self.families)
    }

    static var families: [WidgetFamily] {
        if #available(iOSApplicationExtension 16.0, *) {
            return [.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline]
        }
        return [.systemSmall, .systemMedium]
    }
}

@main
struct ReaderWidgetBundle: WidgetBundle {
    var body: some Widget {
        ReaderPointsWidget()
    }
}
