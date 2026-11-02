// Widgets for an Arise iPhone app. The app hands the AriseWidgets plugin a set of "slots" (a title, a big
// value, some detail lines, a ring, buttons...) and every slot becomes two widgets in the gallery:
//   * a simple one (Home Screen small and medium, Lock Screen rectangular, circular and inline), and
//   * a detailed one (small, medium and large) in one of five looks (Clean, Bold, Dark, Sunset, Ocean).
// Plain widgets only (no App Intents): that is the shape that iOS lists reliably. Built by .github/scripts/add_widget.rb into an extension called AriseWidgets, with
// the widget list below filled in for the app.
import SwiftUI
import WidgetKit

private let appWidgets: [[String]] = __WIDGETS__
private let appTint = "__TINT__"

struct SlotAction: Codable {
    var label: String = ""
    var action: String = ""
    var amount: Double = 0
}

struct Slot: Codable {
    var id: String = ""
    var title: String = ""
    var value: String = ""
    var detail: String?
    var tint: String?
    /// Milliseconds since 1970: show a live countdown to this moment instead of `value`.
    var until: Double?
    /// 0...1
    var progress: Double?
    /// More lines for the detailed widgets.
    var lines: [String]?
    /// Buttons that work from the widget.
    var actions: [SlotAction]?
    /// A running total the buttons add to (value becomes "<current> <unit>", the ring is current / goal).
    var current: Double?
    var goal: Double?
    var unit: String?
}

private func group() -> String {
    var id = Bundle.main.bundleIdentifier ?? ""
    if id.hasSuffix(".widgets") { id = String(id.dropLast(".widgets".count)) }
    return "group." + id
}

private func loadSlots() -> [String: Slot] {
    guard let data = UserDefaults(suiteName: group())?.data(forKey: "slots"),
          let slots = try? JSONDecoder().decode([String: Slot].self, from: data) else { return [:] }
    return slots
}

private func saveSlots(_ slots: [String: Slot]) {
    if let data = try? JSONEncoder().encode(slots) { UserDefaults(suiteName: group())?.set(data, forKey: "slots") }
}

private func color(_ hex: String?) -> Color {
    let h = (hex ?? appTint).trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    guard h.count == 6, let n = UInt32(h, radix: 16) else { return .orange }
    return Color(red: Double((n >> 16) & 255) / 255, green: Double((n >> 8) & 255) / 255, blue: Double(n & 255) / 255)
}

private func number(_ v: Double) -> String { v == v.rounded() ? String(Int(v)) : String(format: "%.1f", v) }

// MARK: - Buttons that work from the widget

// MARK: - Looks

enum Look: String {
    case clean, bold, dark, sunset, ocean
    /// A look for each detailed widget (they rotate through the five so a set of them isn't all one colour).
    static func forId(_ id: String) -> Look {
        let all: [Look] = [.sunset, .dark, .ocean, .bold, .clean]
        return all[abs(id.unicodeScalars.reduce(0) { ($0 &* 31 &+ Int($1.value)) % 9973 }) % all.count]
    }
}

private struct Palette {
    let text: Color
    let secondary: Color
    let accent: Color
    let background: AnyShapeStyle

    init(_ look: Look, tint: Color) {
        switch look {
        case .clean:
            text = .primary; secondary = .secondary; accent = tint; background = AnyShapeStyle(.background)
        case .bold:
            text = .white; secondary = .white.opacity(0.8); accent = .white; background = AnyShapeStyle(tint)
        case .dark:
            text = .white; secondary = .white.opacity(0.65); accent = tint; background = AnyShapeStyle(Color(red: 0.07, green: 0.08, blue: 0.1))
        case .sunset:
            text = .white; secondary = .white.opacity(0.85); accent = .white
            background = AnyShapeStyle(LinearGradient(colors: [Color(red: 1, green: 0.45, blue: 0.3), Color(red: 0.55, green: 0.2, blue: 0.6)], startPoint: .topLeading, endPoint: .bottomTrailing))
        case .ocean:
            text = .white; secondary = .white.opacity(0.85); accent = .white
            background = AnyShapeStyle(LinearGradient(colors: [Color(red: 0.1, green: 0.6, blue: 0.85), Color(red: 0.05, green: 0.2, blue: 0.5)], startPoint: .topLeading, endPoint: .bottomTrailing))
        }
    }
}

// MARK: - Entries

struct SlotEntry: TimelineEntry {
    let date: Date
    let slot: Slot
    let look: Look
}

private func slotFor(_ id: String, _ name: String) -> Slot {
    loadSlots()[id] ?? Slot(id: id, title: name, value: "Open the app", detail: "to fill this in")
}

struct SimpleProvider: TimelineProvider {
    let id: String
    let name: String
    func placeholder(in context: Context) -> SlotEntry { SlotEntry(date: Date(), slot: Slot(id: id, title: name, value: "--"), look: .clean) }
    func getSnapshot(in context: Context, completion: @escaping (SlotEntry) -> Void) { completion(SlotEntry(date: Date(), slot: slotFor(id, name), look: .clean)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<SlotEntry>) -> Void) {
        completion(Timeline(entries: [SlotEntry(date: Date(), slot: slotFor(id, name), look: .clean)], policy: .after(Date().addingTimeInterval(15 * 60))))
    }
}

struct DetailProvider: TimelineProvider {
    let id: String
    let name: String
    func placeholder(in context: Context) -> SlotEntry { SlotEntry(date: Date(), slot: Slot(id: id, title: name, value: "--"), look: Look.forId(id)) }
    func getSnapshot(in context: Context, completion: @escaping (SlotEntry) -> Void) { completion(SlotEntry(date: Date(), slot: slotFor(id, name), look: Look.forId(id))) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<SlotEntry>) -> Void) {
        completion(Timeline(entries: [SlotEntry(date: Date(), slot: slotFor(id, name), look: Look.forId(id))], policy: .after(Date().addingTimeInterval(15 * 60))))
    }
}

// MARK: - Views

private struct BigValue: View {
    let slot: Slot
    var body: some View {
        if let until = slot.until, until > Date().timeIntervalSince1970 * 1000 {
            Text(Date(timeIntervalSince1970: until / 1000), style: .timer).monospacedDigit()
        } else {
            Text(slot.value)
        }
    }
}

private struct Ring: View {
    let progress: Double
    let tint: Color
    let track: Color
    var body: some View {
        ZStack {
            Circle().stroke(track, lineWidth: 9)
            Circle().trim(from: 0, to: min(1, max(0, progress))).stroke(tint, style: StrokeStyle(lineWidth: 9, lineCap: .round)).rotationEffect(.degrees(-90))
        }
    }
}

struct SimpleView: View {
    @Environment(\.widgetFamily) var family
    let entry: SlotEntry
    var body: some View {
        let s = entry.slot
        let tint = color(s.tint)
        switch family {
        case .accessoryCircular:
            ZStack {
                if let p = s.progress {
                    Gauge(value: min(1, max(0, p))) { EmptyView() } currentValueLabel: { BigValue(slot: s).font(.system(size: 13, weight: .bold)).minimumScaleFactor(0.4) }.gaugeStyle(.accessoryCircularCapacity)
                } else {
                    BigValue(slot: s).font(.system(size: 15, weight: .bold)).minimumScaleFactor(0.4).lineLimit(1)
                }
            }
        case .accessoryInline:
            Text("\(s.title) \(s.value)")
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text(s.title).font(.caption2).textCase(.uppercase).opacity(0.7)
                BigValue(slot: s).font(.headline).minimumScaleFactor(0.6).lineLimit(1)
                if let d = s.detail { Text(d).font(.caption2).lineLimit(1) }
            }
        case .systemMedium:
            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(s.title).font(.footnote.weight(.semibold)).textCase(.uppercase).foregroundColor(tint)
                    BigValue(slot: s).font(.system(size: 40, weight: .heavy, design: .rounded)).minimumScaleFactor(0.5).lineLimit(1)
                    if let d = s.detail { Text(d).font(.subheadline).foregroundColor(.secondary).lineLimit(2) }
                }
                Spacer(minLength: 0)
                if let p = s.progress { Ring(progress: p, tint: tint, track: tint.opacity(0.2)).frame(width: 76, height: 76) }
            }
        default:
            VStack(alignment: .leading, spacing: 4) {
                Text(s.title).font(.caption.weight(.semibold)).textCase(.uppercase).foregroundColor(tint)
                Spacer(minLength: 0)
                BigValue(slot: s).font(.system(size: 34, weight: .heavy, design: .rounded)).minimumScaleFactor(0.5).lineLimit(1)
                if let d = s.detail { Text(d).font(.footnote).foregroundColor(.secondary).lineLimit(2) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct DetailView: View {
    @Environment(\.widgetFamily) var family
    let entry: SlotEntry
    var body: some View {
        let s = entry.slot
        let pal = Palette(entry.look, tint: color(s.tint))
        let rows = family == .systemLarge ? 8 : family == .systemMedium ? 3 : 0
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(s.title).font(.caption.weight(.bold)).textCase(.uppercase).foregroundStyle(pal.secondary)
                Spacer(minLength: 0)
                if family != .systemSmall, let p = s.progress {
                    Text("\(Int((min(1, max(0, p)) * 100).rounded()))%").font(.caption.weight(.bold)).foregroundStyle(pal.text)
                }
            }
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    BigValue(slot: s).font(.system(size: family == .systemSmall ? 30 : 38, weight: .heavy, design: .rounded)).foregroundStyle(pal.text).minimumScaleFactor(0.5).lineLimit(1)
                    if let d = s.detail { Text(d).font(.footnote).foregroundStyle(pal.secondary).lineLimit(family == .systemSmall ? 2 : 1) }
                }
                Spacer(minLength: 0)
                if family != .systemSmall, let p = s.progress { Ring(progress: p, tint: pal.accent, track: pal.accent.opacity(0.25)).frame(width: 64, height: 64) }
            }
            if rows > 0, let lines = s.lines, !lines.isEmpty {
                Divider().overlay(pal.secondary.opacity(0.4))
                ForEach(Array(lines.prefix(rows).enumerated()), id: \.offset) { _, line in
                    Text(line).font(.callout).foregroundStyle(pal.text).lineLimit(1)
                }
            }
            if family != .systemSmall { Spacer(minLength: 0) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct DetailBackground: View {
    let look: Look
    let tint: String?
    var body: some View { Rectangle().fill(Palette(look, tint: color(tint)).background) }
}

// MARK: - Widgets

struct SimpleWidget {
    let id: String
    let name: String
    var config: some WidgetConfiguration {
        StaticConfiguration(kind: "Arise.\(id)", provider: SimpleProvider(id: id, name: name)) { entry in
            SimpleView(entry: entry).containerBackground(.background, for: .widget)
        }
        .configurationDisplayName(name)
        .description("Simple. Updates when you open the app.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular, .accessoryInline])
    }
}

struct DetailWidget {
    let id: String
    let name: String
    var config: some WidgetConfiguration {
        StaticConfiguration(kind: "Arise.\(id).detail", provider: DetailProvider(id: id, name: name)) { entry in
            DetailView(entry: entry).containerBackground(for: .widget) { DetailBackground(look: entry.look, tint: entry.slot.tint) }
        }
        .configurationDisplayName("\(name) +")
        .description("Detailed. Updates when you open the app.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

__STRUCTS__

@main
struct AriseWidgetBundle: WidgetBundle {
    var body: some Widget {
__BUNDLE__
    }
}
