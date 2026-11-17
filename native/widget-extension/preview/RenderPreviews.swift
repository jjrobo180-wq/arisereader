// Renders the widget designs to one PNG (base64 on stdout) so they can be checked without a phone.
// Compiled together with the generated AriseWidgets.swift (its @main removed) for the iOS simulator and run there.
import SwiftUI
import WidgetKit
import ImageIO
import UniformTypeIdentifiers

private func sample(_ app: String) -> [Slot] {
    let now = Date().timeIntervalSince1970 * 1000
    if app == "todo" {
        return [
            Slot(id: "duo.potty.next", title: "Mia's potty", value: "3:40 PM", detail: "until the next sit", tint: "#f5b400", until: now + 18 * 60_000, lines: ["4 pees · 1 poop · 0 accidents", "Last pee 2:05 PM", "2:05 PM  pee"]),
            Slot(id: "duo.agenda", title: "Today's agenda", value: "3 events", detail: "Next: Dentist 4:30 PM", tint: "#6366f1", lines: ["4:30 PM  Dentist", "6:00 PM  Soccer practice", "7:30 PM  Dinner with Sam"]),
            Slot(id: "duo.goals", title: "Goals", value: "2 of 3", detail: "Read 20 pages left", tint: "#10b981", progress: 0.66, lines: ["Walk 10k steps ✓", "Meditate ✓", "Read 20 pages"]),
            Slot(id: "duo.bills", title: "Next bill", value: "$1,200", detail: "Rent · due in 3 days", tint: "#ef4444", lines: ["Rent $1,200 · Nov 5", "Phone $65 · Nov 9"]),
            Slot(id: "duo.linkpage", title: "Jermaine Robinson", value: "JR", detail: "arisetodo.com/share/Xq3…", tint: "#ffffff", lines: ["Portfolio", "Book a call", "Newsletter"], qr: "https://arisetodo.com/share/Xq3vR8kLmN2pQ7sT9wYz1a"),
            Slot(id: "duo.linkpage", title: "Jermaine Robinson", value: "JR", detail: "arisetodo.com/share/Xq3…", tint: "#0f0f12", lines: ["Portfolio", "Book a call", "Newsletter"], qr: "https://arisetodo.com/share/Xq3vR8kLmN2pQ7sT9wYz1a"),
        ]
    }
    return [
        Slot(id: "fit.calories", title: "Calories left", value: "1,240", detail: "860 eaten of 2,100", tint: "#ff5a1f", progress: 0.41, lines: ["Breakfast · 420 cal", "Lunch · 440 cal", "Protein 72 of 140 g"]),
        Slot(id: "fit.water", title: "Water", value: "48 oz", detail: "32 oz to go", tint: "#0ea5e9", progress: 0.6),
        Slot(id: "fit.fast", title: "Fasting", value: "16:8", detail: "Eating window opens", tint: "#8b5cf6", until: now + 3 * 3_600_000),
        Slot(id: "fit.streak", title: "Streak", value: "12 days", detail: "Best: 21 days", tint: "#f59e0b", lines: ["Logged food 12 days running", "3 workouts this week"]),
    ]
}

private struct Tile<Content: View>: View {
    let w: CGFloat, h: CGFloat
    let bg: Theme
    let content: Content
    init(_ w: CGFloat, _ h: CGFloat, bg: Theme, @ViewBuilder content: () -> Content) { self.w = w; self.h = h; self.bg = bg; self.content = content() }
    var body: some View {
        content.padding(16).frame(width: w, height: h)
            .background(GradientBackground(theme: bg))
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .environment(\.colorScheme, .dark)
    }
}

/** A Link page widget tile: its own plain page colour, not a gradient. */
private struct PlainTile<Content: View>: View {
    let w: CGFloat, h: CGFloat
    let color: Color
    let content: Content
    init(_ w: CGFloat, _ h: CGFloat, color: Color, @ViewBuilder content: () -> Content) { self.w = w; self.h = h; self.color = color; self.content = content() }
    var body: some View {
        content.padding(16).frame(width: w, height: h).background(color).clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

private struct Sheet: View {
    let slots: [Slot]
    var body: some View {
        let date = Date()
        VStack(alignment: .leading, spacing: 18) {
            ForEach(Array(slots.enumerated()), id: \.offset) { i, s in
                let e = SlotEntry(date: date, slot: s, look: Look.forId(s.id), tick: 1)
                if s.id.hasSuffix("linkpage") {
                    let bg = RGB(s.tint).color
                    HStack(alignment: .top, spacing: 18) {
                        PlainTile(170, 170, color: bg) { LinkPageEntryView(entry: e, forced: .systemSmall) }
                        PlainTile(364, 170, color: bg) { LinkPageEntryView(entry: e, forced: .systemMedium) }
                        PlainTile(364, 382, color: bg) { LinkPageEntryView(entry: e, forced: .systemLarge) }
                    }
                } else {
                HStack(alignment: .top, spacing: 18) {
                    Tile(170, 170, bg: Theme.vivid(s.tint)) { SimpleView(entry: e, forced: .systemSmall) }
                    Tile(364, 170, bg: Theme.vivid(s.tint)) { SimpleView(entry: e, forced: .systemMedium) }
                    Tile(170, 170, bg: Theme.look(e.look, tint: s.tint)) { DetailView(entry: e, forced: .systemSmall) }
                    Tile(364, 170, bg: Theme.look(e.look, tint: s.tint)) { DetailView(entry: e, forced: .systemMedium) }
                    if i < 2 { Tile(364, 382, bg: Theme.look(e.look, tint: s.tint)) { DetailView(entry: e, forced: .systemLarge) } }
                }
                }
            }
            if slots.first?.id.hasPrefix("duo") == true { DuoExtras() }
        }
        .padding(24)
        .background(Color(red: 0.12, green: 0.13, blue: 0.18))
    }
}

/// Arise To Duo: the checklist widgets, and the focus timer on the Lock Screen and in the Dynamic Island.
private struct DuoExtras: View {
    var body: some View {
        let now = Date()
        let todos = Slot(id: "duo.todos", title: "To-dos due", value: "4", tint: "#36b6a5",
                         items: [SlotItem(id: "1", text: "Late · Pay rent"), SlotItem(id: "2", text: "9:00 AM · Call the vet"), SlotItem(id: "3", text: "Email Ms. Lee"), SlotItem(id: "4", text: "Pick up dry cleaning")])
        let chores = Slot(id: "duo.chores", title: "Chores today", value: "0 left", tint: "#22c55e", items: [])
        let range = focusRange(now.addingTimeInterval(-7 * 60), now.addingTimeInterval(18 * 60))
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top, spacing: 18) {
                Tile(170, 170, bg: Theme.vivid(todos.tint)) { ChecklistView(entry: ChecklistEntry(date: now, slot: todos), forced: .systemSmall) }
                Tile(364, 170, bg: Theme.vivid(todos.tint)) { ChecklistView(entry: ChecklistEntry(date: now, slot: todos), forced: .systemMedium) }
                Tile(364, 382, bg: Theme.vivid(todos.tint)) { ChecklistView(entry: ChecklistEntry(date: now, slot: todos), forced: .systemLarge) }
                Tile(170, 170, bg: Theme.vivid(chores.tint)) { ChecklistView(entry: ChecklistEntry(date: now, slot: chores), forced: .systemSmall) }
            }
            HStack(alignment: .top, spacing: 18) {
                // The Lock Screen card, running and after the time is up.
                FocusCard(title: "Grade the math quizzes", taskId: "t1", tint: "#7c6cf0", range: range, stale: false)
                    .padding(16).frame(width: 364).background(RGB("#7c6cf0").mix(-0.6).color).clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                FocusCard(title: "Grade the math quizzes", taskId: "t1", tint: "#7c6cf0", range: range, stale: true)
                    .padding(16).frame(width: 364).background(RGB("#7c6cf0").mix(-0.6).color).clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            }
            HStack(alignment: .top, spacing: 18) {
                // The Dynamic Island: compact (around the camera) and expanded (a long press).
                HStack {
                    Image(systemName: "timer").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.vivid("#7c6cf0").glow)
                    Spacer()
                    FocusClock(range: range, stale: false, size: 14, color: .white).frame(maxWidth: 46)
                }
                .padding(.horizontal, 14).frame(width: 250, height: 37).background(Capsule().fill(Color.black))
                VStack(spacing: 10) {
                    HStack {
                        Label { Text(verbatim: "Focus") } icon: { Image(systemName: "timer") }
                            .font(.system(size: 14, weight: .bold, design: .rounded)).foregroundStyle(Theme.vivid("#7c6cf0").glow)
                        Spacer()
                        FocusClock(range: range, stale: false, size: 24, color: .white)
                    }
                    Text(verbatim: "Grade the math quizzes").font(.system(size: 15, weight: .semibold, design: .rounded)).foregroundStyle(.white)
                    FocusIslandBottom(taskId: "t1", tint: "#7c6cf0", range: range, stale: false)
                }
                .padding(18).frame(width: 370).background(RoundedRectangle(cornerRadius: 40, style: .continuous).fill(Color.black))
            }
        }
    }
}

@main
struct RenderPreviews {
    @MainActor static func main() {
        let app = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "fit"
        let r = ImageRenderer(content: Sheet(slots: sample(app)))
        r.scale = 1.5
        guard let cg = r.cgImage else { print("RENDER FAILED"); return }
        let data = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(data as CFMutableData, UTType.png.identifier as CFString, 1, nil) else { print("PNG FAILED"); return }
        CGImageDestinationAddImage(dest, cg, nil)
        CGImageDestinationFinalize(dest)
        print("PNG-BEGIN")
        let b64 = (data as Data).base64EncodedString()
        var i = b64.startIndex
        while i < b64.endIndex { let j = b64.index(i, offsetBy: 4000, limitedBy: b64.endIndex) ?? b64.endIndex; print(String(b64[i..<j])); i = j }
        print("PNG-END")
    }
}
