// Three widgets for an Arise iPhone app (Home Screen small and medium, Lock Screen rectangular, circular
// and inline). They show whatever the app last handed to the AriseWidgets plugin: up to three "slots",
// one per widget. Built by .github/scripts/add_widget.rb into an extension called AriseWidgets, with
// the names below filled in for the app.
import SwiftUI
import WidgetKit

private let appNames: [String] = __NAMES__
private let appTint = "__TINT__"

struct Slot: Codable {
    var title: String = ""
    var value: String = ""
    var detail: String?
    var tint: String?
    /// Milliseconds since 1970: show a live countdown to this moment instead of `value`.
    var until: Double?
    /// 0...1
    var progress: Double?
}

private func hostGroup() -> String {
    var id = Bundle.main.bundleIdentifier ?? ""
    if id.hasSuffix(".widgets") { id = String(id.dropLast(".widgets".count)) }
    return "group." + id
}

private func loadSlots() -> [Slot] {
    guard let data = UserDefaults(suiteName: hostGroup())?.data(forKey: "slots"),
          let slots = try? JSONDecoder().decode([Slot].self, from: data) else { return [] }
    return slots
}

private func color(_ hex: String?) -> Color {
    let h = (hex ?? appTint).trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    guard h.count == 6, let n = UInt32(h, radix: 16) else { return .orange }
    return Color(red: Double((n >> 16) & 255) / 255, green: Double((n >> 8) & 255) / 255, blue: Double(n & 255) / 255)
}

struct SlotEntry: TimelineEntry {
    let date: Date
    let slot: Slot
    let placeholder: Bool
}

struct SlotProvider: TimelineProvider {
    let index: Int
    private func entry(_ placeholder: Bool = false) -> SlotEntry {
        let slots = loadSlots()
        if placeholder || index >= slots.count {
            return SlotEntry(date: Date(), slot: Slot(title: appNames[index], value: "Open the app", detail: "to fill this in"), placeholder: true)
        }
        return SlotEntry(date: Date(), slot: slots[index], placeholder: false)
    }
    func placeholder(in context: Context) -> SlotEntry { SlotEntry(date: Date(), slot: Slot(title: appNames[index], value: "--"), placeholder: true) }
    func getSnapshot(in context: Context, completion: @escaping (SlotEntry) -> Void) { completion(entry()) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<SlotEntry>) -> Void) {
        completion(Timeline(entries: [entry()], policy: .after(Date().addingTimeInterval(15 * 60))))
    }
}

struct SlotView: View {
    @Environment(\.widgetFamily) var family
    let entry: SlotEntry

    private var big: some View {
        Group {
            if let until = entry.slot.until, until > Date().timeIntervalSince1970 * 1000 {
                Text(Date(timeIntervalSince1970: until / 1000), style: .timer).monospacedDigit()
            } else {
                Text(entry.slot.value)
            }
        }
    }

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                if let p = entry.slot.progress { Gauge(value: min(1, max(0, p))) { EmptyView() } currentValueLabel: { big.font(.system(size: 14, weight: .bold)).minimumScaleFactor(0.5) }.gaugeStyle(.accessoryCircularCapacity) }
                else { big.font(.system(size: 15, weight: .bold)).minimumScaleFactor(0.4).lineLimit(1) }
            }
        case .accessoryInline:
            Text("\(entry.slot.title) \(entry.slot.value)")
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text(entry.slot.title).font(.caption2).textCase(.uppercase).opacity(0.7)
                big.font(.headline).minimumScaleFactor(0.6).lineLimit(1)
                if let d = entry.slot.detail { Text(d).font(.caption2).lineLimit(1) }
            }
        case .systemMedium:
            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(entry.slot.title).font(.footnote.weight(.semibold)).textCase(.uppercase).foregroundColor(color(entry.slot.tint))
                    big.font(.system(size: 40, weight: .heavy, design: .rounded)).minimumScaleFactor(0.5).lineLimit(1)
                    if let d = entry.slot.detail { Text(d).font(.subheadline).foregroundColor(.secondary).lineLimit(2) }
                }
                Spacer(minLength: 0)
                if let p = entry.slot.progress {
                    ZStack {
                        Circle().stroke(color(entry.slot.tint).opacity(0.2), lineWidth: 10)
                        Circle().trim(from: 0, to: min(1, max(0, p))).stroke(color(entry.slot.tint), style: StrokeStyle(lineWidth: 10, lineCap: .round)).rotationEffect(.degrees(-90))
                    }.frame(width: 76, height: 76)
                }
            }
        default:
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.slot.title).font(.caption.weight(.semibold)).textCase(.uppercase).foregroundColor(color(entry.slot.tint))
                Spacer(minLength: 0)
                big.font(.system(size: 34, weight: .heavy, design: .rounded)).minimumScaleFactor(0.5).lineLimit(1)
                if let d = entry.slot.detail { Text(d).font(.footnote).foregroundColor(.secondary).lineLimit(2) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private func slotConfig(_ index: Int) -> some WidgetConfiguration {
    StaticConfiguration(kind: "AriseSlot\(index)", provider: SlotProvider(index: index)) { entry in
        if #available(iOS 17.0, *) {
            SlotView(entry: entry).containerBackground(.background, for: .widget)
        } else {
            SlotView(entry: entry).padding()
        }
    }
    .configurationDisplayName(appNames[index])
    .description("Updates when you open the app.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular, .accessoryInline])
}

struct AriseSlot0: Widget { var body: some WidgetConfiguration { slotConfig(0) } }
struct AriseSlot1: Widget { var body: some WidgetConfiguration { slotConfig(1) } }
struct AriseSlot2: Widget { var body: some WidgetConfiguration { slotConfig(2) } }

@main
struct AriseWidgetBundle: WidgetBundle {
    var body: some Widget {
        AriseSlot0()
        AriseSlot1()
        AriseSlot2()
    }
}
