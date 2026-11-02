// Widgets for an Arise iPhone app. The app hands the AriseWidgets plugin a set of "slots" (a title, a big
// value, some detail lines, a ring...) and every slot becomes two widgets in the gallery:
//   * a vivid one (Home Screen small and medium, Lock Screen rectangular, circular and inline), and
//   * a detailed one (small, medium and large) in one of five looks (Clean, Bold, Midnight, Sunset, Ocean).
// Each widget has an icon, gradients, a glowing ring, live countdowns (iOS ticks them every second) and a
// timeline that rotates a spotlight through the slot's lines, so the widget animates as it changes.
// Plain widgets only (no App Intents), and display names are plain Strings: an interpolated display name
// crashed the whole extension on load. Built by .github/scripts/add_widget.rb into an extension called
// AriseWidgets, with the widget list below filled in for the app.
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
    var actions: [SlotAction]?
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

// MARK: - Colour

struct RGB {
    var r: Double, g: Double, b: Double
    init(_ hex: String?) {
        let h = (hex ?? appTint).trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        if h.count == 6, let n = UInt32(h, radix: 16) {
            r = Double((n >> 16) & 255) / 255; g = Double((n >> 8) & 255) / 255; b = Double(n & 255) / 255
        } else { r = 1; g = 0.35; b = 0.12 }
    }
    init(r: Double, g: Double, b: Double) { self.r = r; self.g = g; self.b = b }
    /// Towards white (amount > 0) or black (amount < 0).
    func mix(_ amount: Double) -> RGB {
        let a = min(1, max(-1, amount))
        if a >= 0 { return RGB(r: r + (1 - r) * a, g: g + (1 - g) * a, b: b + (1 - b) * a) }
        return RGB(r: r * (1 + a), g: g * (1 + a), b: b * (1 + a))
    }
    var color: Color { Color(red: r, green: g, blue: b) }
}

// MARK: - Icons

/// An SF Symbol for each kind of widget, picked from words in its id.
func symbolFor(_ id: String) -> String {
    let table: [(String, String)] = [
        ("potty", "drop.circle.fill"), ("calorie", "flame.fill"), ("water", "drop.fill"), ("workout", "figure.run"),
        ("protein", "fork.knife"), ("streak", "bolt.fill"), ("weight", "scalemass.fill"), ("fast", "timer"),
        ("next", "dumbbell.fill"), ("macro", "chart.pie.fill"), ("week", "calendar"), ("last", "checkmark.seal.fill"),
        ("trip", "airplane"), ("agenda", "calendar.badge.clock"), ("todo", "checklist"), ("bill", "creditcard.fill"),
        ("goal", "target"), ("note", "note.text"), ("countdown", "hourglass"), ("email", "envelope.fill"),
        ("weather", "cloud.sun.fill"), ("chore", "sparkles"), ("accountab", "person.2.fill"), ("pod.now", "play.circle.fill"),
        ("later", "bookmark.fill"), ("shows", "square.stack.fill"), ("liked", "heart.fill"), ("mode", "slider.horizontal.3"),
        ("heard", "headphones"), ("wiki", "book.fill"), ("taste", "wand.and.stars"),
    ]
    for (word, symbol) in table where id.contains(word) { return symbol }
    return "sparkles"
}

// MARK: - Looks

enum Look: String {
    case clean, bold, dark, sunset, ocean
    /// A look for each detailed widget: they take turns down the app's list, so a set of them isn't all one colour.
    static func forId(_ id: String) -> Look {
        let all: [Look] = [.dark, .sunset, .ocean, .bold, .clean]
        let i = appWidgets.firstIndex { $0.first == id } ?? id.unicodeScalars.reduce(0) { ($0 + Int($1.value)) % 997 }
        return all[i % all.count]
    }
}

struct Theme {
    let text: Color
    let secondary: Color
    let accent: Color
    let chip: Color
    let colors: [Color]
    let glow: Color

    /// The vivid simple widgets: a deep gradient of the slot's own colour.
    static func vivid(_ tint: String?) -> Theme {
        let c = RGB(tint)
        return Theme(text: .white, secondary: .white.opacity(0.8), accent: .white, chip: .white.opacity(0.2),
                     colors: [c.mix(0.15).color, c.mix(-0.12).color, c.mix(-0.55).color], glow: c.mix(0.6).color)
    }

    static func look(_ look: Look, tint: String?) -> Theme {
        let c = RGB(tint)
        switch look {
        case .clean:
            return Theme(text: Color(red: 0.08, green: 0.09, blue: 0.12), secondary: Color(red: 0.36, green: 0.38, blue: 0.44), accent: c.mix(-0.15).color,
                         chip: c.color.opacity(0.12), colors: [.white, c.mix(0.88).color], glow: c.color)
        case .bold:
            return Theme(text: .white, secondary: .white.opacity(0.8), accent: .white, chip: .white.opacity(0.18),
                         colors: [c.mix(0.1).color, c.mix(-0.5).color], glow: c.mix(0.55).color)
        case .dark:
            return Theme(text: .white, secondary: .white.opacity(0.62), accent: c.mix(0.15).color, chip: .white.opacity(0.08),
                         colors: [Color(red: 0.07, green: 0.08, blue: 0.12), Color(red: 0.02, green: 0.02, blue: 0.04)], glow: c.color)
        case .sunset:
            return Theme(text: .white, secondary: .white.opacity(0.85), accent: .white, chip: .white.opacity(0.18),
                         colors: [Color(red: 1, green: 0.6, blue: 0.3), Color(red: 0.93, green: 0.3, blue: 0.45), Color(red: 0.42, green: 0.18, blue: 0.62)], glow: Color(red: 1, green: 0.85, blue: 0.5))
        case .ocean:
            return Theme(text: .white, secondary: .white.opacity(0.85), accent: .white, chip: .white.opacity(0.16),
                         colors: [Color(red: 0.2, green: 0.8, blue: 0.9), Color(red: 0.08, green: 0.42, blue: 0.85), Color(red: 0.07, green: 0.12, blue: 0.42)], glow: Color(red: 0.6, green: 1, blue: 0.95))
        }
    }
}

// MARK: - Entries

struct SlotEntry: TimelineEntry {
    let date: Date
    let slot: Slot
    let look: Look
    /// Which line is in the spotlight (moves along every five minutes).
    let tick: Int
}

private func slotFor(_ id: String, _ name: String) -> Slot {
    loadSlots()[id] ?? Slot(id: id, title: name, value: "Open app", detail: "Tap to fill this in")
}

/// Two hours of entries, five minutes apart: the spotlight walks through the lines and iOS animates each change.
private func timeline(_ id: String, _ name: String, _ look: Look) -> Timeline<SlotEntry> {
    let slot = slotFor(id, name)
    let now = Date()
    let steps = (slot.lines?.count ?? 0) > 1 ? 24 : 1
    let entries = (0..<steps).map { i in SlotEntry(date: now.addingTimeInterval(Double(i) * 300), slot: slot, look: look, tick: i) }
    return Timeline(entries: entries, policy: .after(now.addingTimeInterval(Double(max(steps, 3)) * 300)))
}

struct SimpleProvider: TimelineProvider {
    let id: String
    let name: String
    func placeholder(in context: Context) -> SlotEntry { SlotEntry(date: Date(), slot: Slot(id: id, title: name, value: "--"), look: .bold, tick: 0) }
    func getSnapshot(in context: Context, completion: @escaping (SlotEntry) -> Void) { completion(SlotEntry(date: Date(), slot: slotFor(id, name), look: .bold, tick: 0)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<SlotEntry>) -> Void) { completion(timeline(id, name, .bold)) }
}

struct DetailProvider: TimelineProvider {
    let id: String
    let name: String
    func placeholder(in context: Context) -> SlotEntry { SlotEntry(date: Date(), slot: Slot(id: id, title: name, value: "--"), look: Look.forId(id), tick: 0) }
    func getSnapshot(in context: Context, completion: @escaping (SlotEntry) -> Void) { completion(SlotEntry(date: Date(), slot: slotFor(id, name), look: Look.forId(id), tick: 0)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<SlotEntry>) -> Void) { completion(timeline(id, name, Look.forId(id))) }
}

// MARK: - Pieces

func countdownRange(_ slot: Slot, from now: Date) -> ClosedRange<Date>? {
    guard let until = slot.until else { return nil }
    let end = Date(timeIntervalSince1970: until / 1000)
    return end > now ? now...end : nil
}

/// The big number: a live ticking countdown when there is one, otherwise the value (animated when it changes).
struct HeroValue: View {
    let slot: Slot
    let date: Date
    let size: CGFloat
    let color: Color
    var body: some View {
        Group {
            if let range = countdownRange(slot, from: date) {
                Text(timerInterval: range, countsDown: true).monospacedDigit()
            } else {
                Text(verbatim: slot.value).contentTransition(.numericText())
            }
        }
        .font(.system(size: size, weight: .heavy, design: .rounded))
        .foregroundStyle(color)
        .minimumScaleFactor(0.45)
        .lineLimit(1)
    }
}

/// An icon in a soft glowing badge.
struct IconBadge: View {
    let symbol: String
    let theme: Theme
    var size: CGFloat = 28
    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.5, weight: .bold))
            .foregroundStyle(theme.accent)
            .symbolRenderingMode(.hierarchical)
            .frame(width: size, height: size)
            .background(Circle().fill(theme.chip))
            .overlay(Circle().stroke(theme.accent.opacity(0.25), lineWidth: 1))
    }
}

/// A glowing gradient ring with the percentage in the middle (or nothing, when `label` is false).
struct GlowRing: View {
    let progress: Double
    let theme: Theme
    var line: CGFloat = 10
    var label: Bool = true
    var body: some View {
        let p = min(1, max(0, progress))
        ZStack {
            Circle().stroke(theme.accent.opacity(0.18), lineWidth: line)
            Circle()
                .trim(from: 0, to: max(0.001, p))
                .stroke(AngularGradient(colors: [theme.glow.opacity(0.75), theme.accent, theme.glow], center: .center, startAngle: .degrees(0), endAngle: .degrees(360 * max(0.01, p))),
                        style: StrokeStyle(lineWidth: line, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .shadow(color: theme.glow.opacity(0.7), radius: 4)
            if label {
                Text(verbatim: String(Int((p * 100).rounded())) + "%")
                    .font(.system(size: line * 1.7, weight: .heavy, design: .rounded))
                    .foregroundStyle(theme.text)
                    .minimumScaleFactor(0.5)
                    .contentTransition(.numericText())
            }
        }
    }
}

/// A slim bar: live for a countdown, otherwise the slot's progress.
struct GlowBar: View {
    let slot: Slot
    let date: Date
    let theme: Theme
    var body: some View {
        if let range = countdownRange(slot, from: date) {
            ProgressView(timerInterval: range, countsDown: true) { EmptyView() } currentValueLabel: { EmptyView() }
                .progressViewStyle(.linear)
                .tint(theme.accent)
        } else if let p = slot.progress {
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(theme.accent.opacity(0.2))
                    Capsule()
                        .fill(LinearGradient(colors: [theme.glow, theme.accent], startPoint: .leading, endPoint: .trailing))
                        .frame(width: max(6, g.size.width * min(1, max(0, p))))
                        .shadow(color: theme.glow.opacity(0.6), radius: 3)
                }
            }
            .frame(height: 6)
        }
    }
}

/// A big faded icon tucked into the corner, so every widget has a picture in it.
struct Watermark: View {
    let symbol: String
    let theme: Theme
    var size: CGFloat = 92
    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size, weight: .black))
            .foregroundStyle(theme.accent.opacity(0.13))
            .rotationEffect(.degrees(-14))
            .offset(x: size * 0.28, y: size * 0.24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
            .allowsHitTesting(false)
    }
}

/// The rotating spotlight line, sliding in from below each time it changes.
struct Spotlight: View {
    let slot: Slot
    let tick: Int
    let theme: Theme
    var body: some View {
        if let lines = slot.lines, !lines.isEmpty {
            HStack(spacing: 6) {
                Circle().fill(theme.glow).frame(width: 6, height: 6).shadow(color: theme.glow, radius: 3)
                Text(verbatim: lines[tick % lines.count]).font(.system(size: 13, weight: .semibold, design: .rounded)).foregroundStyle(theme.text).lineLimit(1)
            }
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(Capsule().fill(theme.chip))
            .id(tick)
            .transition(.push(from: .bottom))
        }
    }
}

// MARK: - Backgrounds

struct GradientBackground: View {
    let theme: Theme
    var body: some View {
        ZStack {
            LinearGradient(colors: theme.colors, startPoint: .topLeading, endPoint: .bottomTrailing)
            RadialGradient(colors: [theme.glow.opacity(0.45), .clear], center: .topLeading, startRadius: 2, endRadius: 190)
            RadialGradient(colors: [theme.glow.opacity(0.22), .clear], center: .bottomTrailing, startRadius: 2, endRadius: 160)
        }
    }
}

// MARK: - Vivid (simple) widget

struct SimpleView: View {
    @Environment(\.widgetFamily) private var envFamily
    let entry: SlotEntry
    var forced: WidgetFamily? = nil
    private var family: WidgetFamily { forced ?? envFamily }

    var body: some View {
        let s = entry.slot
        let t = Theme.vivid(s.tint)
        let symbol = symbolFor(s.id)
        switch family {
        case .accessoryCircular:
            if let p = s.progress {
                Gauge(value: min(1, max(0, p))) { Image(systemName: symbol) } currentValueLabel: {
                    Text(verbatim: s.value).font(.system(size: 12, weight: .bold, design: .rounded)).minimumScaleFactor(0.4)
                }
                .gaugeStyle(.accessoryCircular)
            } else {
                ZStack {
                    AccessoryWidgetBackground()
                    VStack(spacing: 1) {
                        Image(systemName: symbol).font(.system(size: 13, weight: .bold))
                        HeroValue(slot: s, date: entry.date, size: 13, color: .primary)
                    }
                    .padding(4)
                }
            }
        case .accessoryInline:
            Label { Text(verbatim: s.title + " " + s.value) } icon: { Image(systemName: symbol) }
        case .accessoryRectangular:
            HStack(spacing: 8) {
                if let p = s.progress {
                    Gauge(value: min(1, max(0, p))) { Image(systemName: symbol) }.gaugeStyle(.accessoryCircularCapacity).frame(width: 40)
                } else {
                    Image(systemName: symbol).font(.system(size: 22, weight: .bold)).widgetAccentable()
                }
                VStack(alignment: .leading, spacing: 0) {
                    Text(verbatim: s.title).font(.caption2.weight(.semibold)).textCase(.uppercase).opacity(0.75).lineLimit(1)
                    HeroValue(slot: s, date: entry.date, size: 19, color: .primary)
                    if let d = s.detail { Text(verbatim: d).font(.caption2).lineLimit(1) }
                }
            }
        case .systemMedium:
            ZStack {
                Watermark(symbol: symbol, theme: t, size: 110)
                HStack(spacing: 14) {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 7) {
                            IconBadge(symbol: symbol, theme: t, size: 26)
                            Text(verbatim: s.title).font(.system(size: 13, weight: .bold, design: .rounded)).textCase(.uppercase).foregroundStyle(t.secondary).lineLimit(1)
                        }
                        HeroValue(slot: s, date: entry.date, size: 40, color: t.text)
                        if let d = s.detail { Text(verbatim: d).font(.system(size: 13, weight: .medium)).foregroundStyle(t.secondary).lineLimit(2) }
                        Spacer(minLength: 0)
                        if s.lines?.isEmpty == false { Spotlight(slot: s, tick: entry.tick, theme: t) } else { GlowBar(slot: s, date: entry.date, theme: t) }
                    }
                    Spacer(minLength: 0)
                    if let p = s.progress {
                        GlowRing(progress: p, theme: t, line: 11).frame(width: 92, height: 92)
                    }
                }
            }
        default:
            ZStack {
                Watermark(symbol: symbol, theme: t)
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        IconBadge(symbol: symbol, theme: t, size: 30)
                        Spacer(minLength: 0)
                        if let p = s.progress { GlowRing(progress: p, theme: t, line: 5, label: false).frame(width: 28, height: 28) }
                    }
                    Spacer(minLength: 0)
                    Text(verbatim: s.title).font(.system(size: 11, weight: .bold, design: .rounded)).textCase(.uppercase).foregroundStyle(t.secondary).lineLimit(1)
                    HeroValue(slot: s, date: entry.date, size: 32, color: t.text)
                    if let d = s.detail { Text(verbatim: d).font(.system(size: 12, weight: .medium)).foregroundStyle(t.secondary).lineLimit(2) }
                    if countdownRange(s, from: entry.date) != nil { GlowBar(slot: s, date: entry.date, theme: t).padding(.top, 2) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

// MARK: - Detailed widget

struct DetailView: View {
    @Environment(\.widgetFamily) private var envFamily
    let entry: SlotEntry
    var forced: WidgetFamily? = nil
    private var family: WidgetFamily { forced ?? envFamily }

    var body: some View {
        let s = entry.slot
        let t = Theme.look(entry.look, tint: s.tint)
        let symbol = symbolFor(s.id)
        if family == .systemSmall {
            ZStack {
                Watermark(symbol: symbol, theme: t, size: 84)
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .top) {
                        IconBadge(symbol: symbol, theme: t, size: 30)
                        Spacer(minLength: 0)
                        if let p = s.progress { GlowRing(progress: p, theme: t, line: 6).frame(width: 46, height: 46) }
                    }
                    Spacer(minLength: 0)
                    Text(verbatim: s.title).font(.system(size: 11, weight: .bold, design: .rounded)).textCase(.uppercase).foregroundStyle(t.secondary).lineLimit(1)
                    HeroValue(slot: s, date: entry.date, size: 30, color: t.text)
                    if let lines = s.lines, !lines.isEmpty {
                        Text(verbatim: lines[entry.tick % lines.count]).font(.system(size: 11, weight: .semibold)).foregroundStyle(t.secondary).lineLimit(1)
                            .id(entry.tick).transition(.push(from: .bottom))
                    } else if let d = s.detail {
                        Text(verbatim: d).font(.system(size: 11, weight: .semibold)).foregroundStyle(t.secondary).lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else {
            let large = family == .systemLarge
            let lines = s.lines ?? []
            VStack(alignment: .leading, spacing: large ? 10 : 7) {
                HStack(spacing: 8) {
                    IconBadge(symbol: symbol, theme: t, size: large ? 32 : 26)
                    Text(verbatim: s.title).font(.system(size: large ? 15 : 13, weight: .heavy, design: .rounded)).textCase(.uppercase).foregroundStyle(t.secondary).lineLimit(1)
                    Spacer(minLength: 0)
                    Text(entry.date, style: .time).font(.system(size: 11, weight: .semibold)).foregroundStyle(t.secondary.opacity(0.8))
                }
                HStack(alignment: .center, spacing: 14) {
                    VStack(alignment: .leading, spacing: 3) {
                        HeroValue(slot: s, date: entry.date, size: large ? 48 : 36, color: t.text)
                        if let d = s.detail { Text(verbatim: d).font(.system(size: large ? 14 : 12, weight: .medium)).foregroundStyle(t.secondary).lineLimit(2) }
                    }
                    Spacer(minLength: 0)
                    if let p = s.progress {
                        GlowRing(progress: p, theme: t, line: large ? 12 : 9).frame(width: large ? 96 : 70, height: large ? 96 : 70)
                    } else {
                        Image(systemName: symbol).font(.system(size: large ? 54 : 40, weight: .bold)).foregroundStyle(t.accent).symbolRenderingMode(.hierarchical).shadow(color: t.glow.opacity(0.6), radius: 8)
                    }
                }
                if countdownRange(s, from: entry.date) != nil || (large && s.progress != nil) { GlowBar(slot: s, date: entry.date, theme: t) }
                if large {
                    if !lines.isEmpty {
                        let shown = Array(lines.prefix(5))
                        VStack(alignment: .leading, spacing: 6) {
                            ForEach(Array(shown.enumerated()), id: \.offset) { i, line in
                                DetailRow(line: line, hot: i == entry.tick % shown.count, large: true, theme: t)
                            }
                        }
                    }
                    Spacer(minLength: 0)
                    NowCard(slot: s, tick: entry.tick, theme: t, symbol: symbol)
                } else {
                    Spacer(minLength: 0)
                    if !lines.isEmpty {
                        DetailRow(line: lines[entry.tick % lines.count], hot: true, large: false, theme: t)
                            .id(entry.tick).transition(.push(from: .bottom))
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

/// The bottom of the large widget: a big glowing card that cycles through the lines (or shows the detail).
struct NowCard: View {
    let slot: Slot
    let tick: Int
    let theme: Theme
    let symbol: String
    var body: some View {
        let lines = slot.lines ?? []
        let text = lines.isEmpty ? (slot.detail ?? slot.value) : lines[tick % lines.count]
        HStack(spacing: 12) {
            Image(systemName: symbol).font(.system(size: 22, weight: .bold)).foregroundStyle(theme.text).symbolRenderingMode(.hierarchical)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: "RIGHT NOW").font(.system(size: 10, weight: .heavy, design: .rounded)).foregroundStyle(theme.secondary)
                Text(verbatim: text).font(.system(size: 16, weight: .bold, design: .rounded)).foregroundStyle(theme.text).lineLimit(1)
                    .id(tick).transition(.push(from: .bottom))
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(LinearGradient(colors: [theme.glow.opacity(0.45), theme.accent.opacity(0.12)], startPoint: .leading, endPoint: .trailing))
        )
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(theme.glow.opacity(0.5), lineWidth: 1))
        .shadow(color: theme.glow.opacity(0.35), radius: 8)
    }
}

struct DetailRow: View {
    let line: String
    let hot: Bool
    let large: Bool
    let theme: Theme
    var body: some View {
        HStack(spacing: 8) {
            Circle().fill(hot ? theme.glow : theme.accent.opacity(0.5)).frame(width: 7, height: 7).shadow(color: hot ? theme.glow : .clear, radius: 3)
            Text(verbatim: line).font(.system(size: large ? 14 : 12, weight: hot ? .bold : .medium, design: .rounded)).foregroundStyle(theme.text).lineLimit(1)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10).padding(.vertical, large ? 7 : 4)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(hot ? theme.accent.opacity(0.22) : theme.chip))
    }
}

// MARK: - Widgets

struct SimpleWidget {
    let id: String
    let name: String
    var config: some WidgetConfiguration {
        StaticConfiguration(kind: "Arise.\(id)", provider: SimpleProvider(id: id, name: name)) { entry in
            SimpleView(entry: entry).containerBackground(for: .widget) { GradientBackground(theme: Theme.vivid(entry.slot.tint)) }
        }
        .configurationDisplayName(name)
        .description("Colourful, with a live ring. Updates when you open the app.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular, .accessoryInline])
    }
}

struct DetailWidget {
    let id: String
    let name: String
    var config: some WidgetConfiguration {
        StaticConfiguration(kind: "Arise.\(id).detail", provider: DetailProvider(id: id, name: name)) { entry in
            DetailView(entry: entry).containerBackground(for: .widget) { GradientBackground(theme: Theme.look(entry.look, tint: entry.slot.tint)) }
        }
        .configurationDisplayName(name + " +") // a plain String: an interpolated name crashed the extension
        .description("Detailed, with a spotlight that moves through your day.")
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
