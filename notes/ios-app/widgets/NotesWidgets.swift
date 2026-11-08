// Arise Notes widgets (built into the app as the AriseWidgets extension by .github/scripts/add_widget.rb
// with WIDGET_SOURCE pointing here).
//   Quick capture   Home Screen small (Record) and medium (Record, Voice memo, New note, Handwrite);
//                   Lock Screen circle (Record), rectangle and inline.
//   Notes           Home Screen medium and large: pinned and recent notes; tap one to open it.
//   AI Notes        Home Screen medium: a big Record button and your latest recordings.
//   Record control  Control Center and the Action button (iOS 18): start recording.
// Every tap opens the app at the right screen through an arisenotes:// link. The app hands the
// widgets its note list (titles and short previews only; locked notes show as "Locked") through the
// App Group, from the AriseOnDevice plugin's widgetSave.
import SwiftUI
import WidgetKit
import AppIntents
import UIKit

private let groupId: String = {
    var id = Bundle.main.bundleIdentifier ?? "com.arisereader.notes"
    if id.hasSuffix(".widgets") { id = String(id.dropLast(".widgets".count)) }
    return "group." + id
}()

struct PageItem: Codable, Hashable {
    var id: String
    var title: String
    var preview: String
    var color: String?
    var kind: String
    var locked: Bool
    var pinned: Bool
    var edited: Double
}
struct AiItem: Codable, Hashable {
    var id: String
    var title: String
    var when: Double
}
struct WidgetData: Codable {
    var pages: [PageItem] = []
    var ai: [AiItem] = []
    var signedIn: Bool = false
}

private func loadData() -> WidgetData {
    guard let raw = UserDefaults(suiteName: groupId)?.data(forKey: "notesWidget"),
          let data = try? JSONDecoder().decode(WidgetData.self, from: raw) else { return WidgetData() }
    return data
}

extension Color {
    init(hex: String?, fallback: Color = Color(red: 0.416, green: 0.333, blue: 0.863)) {
        let h = (hex ?? "").trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard h.count == 6, let n = UInt32(h, radix: 16) else { self = fallback; return }
        self = Color(red: Double((n >> 16) & 255) / 255, green: Double((n >> 8) & 255) / 255, blue: Double(n & 255) / 255)
    }
}
private let violet = Color(hex: "6a55dc")
private let coral = Color(hex: "ef4e5b")
private let brand = LinearGradient(colors: [Color(hex: "7b5cf0"), Color(hex: "4f3cc9")], startPoint: .topLeading, endPoint: .bottomTrailing)
private func link(_ path: String) -> URL { URL(string: "arisenotes://\(path)")! }
private func ago(_ ms: Double) -> String {
    let f = RelativeDateTimeFormatter()
    f.unitsStyle = .abbreviated
    return f.localizedString(for: Date(timeIntervalSince1970: ms / 1000), relativeTo: Date())
}

struct NotesEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
}

struct NotesProvider: TimelineProvider {
    private var sample: WidgetData {
        let now = Date().timeIntervalSince1970 * 1000
        return WidgetData(
            pages: [PageItem(id: "", title: "Staff meeting", preview: "Agenda, decisions and next steps", color: "6a55dc", kind: "text", locked: false, pinned: true, edited: now - 3_600_000),
                    PageItem(id: "", title: "Biology notes", preview: "Photosynthesis makes glucose", color: "10b981", kind: "ink", locked: false, pinned: false, edited: now - 86_400_000),
                    PageItem(id: "", title: "Locked note", preview: "", color: nil, kind: "text", locked: true, pinned: false, edited: now - 172_800_000)],
            ai: [AiItem(id: "", title: "Parent conference", when: now - 7_200_000)], signedIn: true)
    }
    func placeholder(in context: Context) -> NotesEntry { NotesEntry(date: Date(), data: sample) }
    func getSnapshot(in context: Context, completion: @escaping (NotesEntry) -> Void) {
        let data = loadData()
        completion(NotesEntry(date: Date(), data: context.isPreview && data.pages.isEmpty ? sample : data))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<NotesEntry>) -> Void) {
        completion(Timeline(entries: [NotesEntry(date: Date(), data: loadData())], policy: .after(Date().addingTimeInterval(30 * 60))))
    }
}

// ─── Quick capture ───────────────────────────────────────────────────────────
private struct ActionButton: View {
    let icon: String
    let label: String
    let path: String
    let fill: Color
    var body: some View {
        Link(destination: link(path)) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 19, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 46, height: 46)
                    .background(Circle().fill(fill))
                Text(label)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.95))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .frame(maxWidth: .infinity)
        }
    }
}

struct QuickCaptureView: View {
    @Environment(\.widgetFamily) var family
    let entry: NotesEntry

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "mic.fill").font(.system(size: 22, weight: .semibold))
            }
            .widgetURL(link("record"))
            .widgetAccentable()
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Label("Arise Notes", systemImage: "waveform").font(.headline).widgetAccentable()
                Text(entry.data.pages.first.map { $0.locked ? "Locked note" : $0.title } ?? "Tap to record a meeting")
                    .font(.caption).lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .widgetURL(link("record"))
        case .accessoryInline:
            Label("Record with Arise Notes", systemImage: "mic.fill").widgetURL(link("record"))
        case .systemMedium:
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 6) {
                    Image(systemName: "waveform").font(.system(size: 13, weight: .bold))
                    Text("Arise Notes").font(.system(size: 13, weight: .bold))
                    Spacer()
                }
                .foregroundStyle(.white.opacity(0.9))
                HStack(spacing: 4) {
                    ActionButton(icon: "mic.fill", label: "Record", path: "record", fill: coral)
                    ActionButton(icon: "bolt.fill", label: "Voice memo", path: "memo", fill: Color(hex: "f59e0b"))
                    ActionButton(icon: "square.and.pencil", label: "New note", path: "new", fill: .white.opacity(0.22))
                    ActionButton(icon: "pencil.tip", label: "Handwrite", path: "draw", fill: .white.opacity(0.22))
                }
            }
        default:
            VStack(spacing: 8) {
                HStack {
                    Image(systemName: "waveform").font(.system(size: 13, weight: .bold))
                    Spacer()
                }
                .foregroundStyle(.white.opacity(0.9))
                Spacer(minLength: 0)
                ZStack {
                    Circle().fill(.white.opacity(0.18)).frame(width: 78, height: 78)
                    Circle().fill(coral).frame(width: 60, height: 60)
                    Image(systemName: "mic.fill").font(.system(size: 25, weight: .bold)).foregroundStyle(.white)
                }
                Spacer(minLength: 0)
                Text("Record").font(.system(size: 15, weight: .bold)).foregroundStyle(.white)
            }
            .widgetURL(link("record"))
        }
    }
}

struct QuickCaptureWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AriseNotesQuick", provider: NotesProvider()) { entry in
            QuickCaptureView(entry: entry)
                .containerBackground(for: .widget) { brand }
        }
        .configurationDisplayName("Quick capture")
        .description("Start recording, a voice memo, or a new note in one tap.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

// ─── Notes ───────────────────────────────────────────────────────────────────
private struct PageRow: View {
    let page: PageItem
    let detail: Bool
    var body: some View {
        Link(destination: link(page.id.isEmpty ? "notes" : "page/\(page.id)")) {
            HStack(alignment: .top, spacing: 9) {
                RoundedRectangle(cornerRadius: 2).fill(Color(hex: page.color, fallback: Color.gray.opacity(0.25))).frame(width: 4)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        if page.pinned { Image(systemName: "pin.fill").font(.system(size: 9)).foregroundStyle(violet) }
                        if page.locked { Image(systemName: "lock.fill").font(.system(size: 9)) }
                        if page.kind == "ink" { Image(systemName: "pencil.tip").font(.system(size: 9)) }
                        Text(page.locked ? "Locked note" : page.title).font(.system(size: 13, weight: .semibold)).lineLimit(1)
                    }
                    if detail {
                        Text(page.locked ? "Unlock in the app" : (page.preview.isEmpty ? (page.kind == "ink" ? "Handwritten note" : "No text yet") : page.preview))
                            .font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(2)
                    }
                }
                Spacer(minLength: 4)
                Text(ago(page.edited)).font(.system(size: 10)).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct NotesListView: View {
    @Environment(\.widgetFamily) var family
    let entry: NotesEntry
    var body: some View {
        let count = family == .systemLarge ? 6 : 3
        let pages = Array(entry.data.pages.prefix(count))
        VStack(alignment: .leading, spacing: family == .systemLarge ? 11 : 8) {
            HStack {
                Text("Notes").font(.system(size: 16, weight: .bold))
                Spacer()
                Link(destination: link("draw")) { Image(systemName: "pencil.tip").font(.system(size: 15, weight: .semibold)).foregroundStyle(violet).frame(width: 30, height: 26) }
                Link(destination: link("new")) { Image(systemName: "square.and.pencil").font(.system(size: 15, weight: .semibold)).foregroundStyle(violet).frame(width: 30, height: 26) }
            }
            if pages.isEmpty {
                Spacer(minLength: 0)
                Text(entry.data.signedIn ? "No notes yet. Tap the pencil to write one." : "Open Arise Notes and sign in to see your notes here.")
                    .font(.system(size: 13)).foregroundStyle(.secondary)
                Spacer(minLength: 0)
            } else {
                ForEach(pages, id: \.self) { p in PageRow(page: p, detail: family == .systemLarge) }
                Spacer(minLength: 0)
            }
        }
    }
}

struct NotesListWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AriseNotesList", provider: NotesProvider()) { entry in
            NotesListView(entry: entry)
                .containerBackground(for: .widget) { Color(uiColor: .systemBackground) }
        }
        .configurationDisplayName("Notes")
        .description("Your pinned and latest notes. Tap one to open it.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

// ─── AI Notes ────────────────────────────────────────────────────────────────
struct AiNotesView: View {
    let entry: NotesEntry
    var body: some View {
        HStack(spacing: 14) {
            Link(destination: link("record")) {
                VStack(spacing: 8) {
                    ZStack {
                        Circle().fill(.white.opacity(0.18)).frame(width: 70, height: 70)
                        Circle().fill(coral).frame(width: 54, height: 54)
                        Image(systemName: "mic.fill").font(.system(size: 22, weight: .bold)).foregroundStyle(.white)
                    }
                    Text("Record").font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
                }
            }
            VStack(alignment: .leading, spacing: 7) {
                Text("AI Notes").font(.system(size: 13, weight: .bold)).foregroundStyle(.white.opacity(0.85))
                if entry.data.ai.isEmpty {
                    Text("Record a meeting or class and get the transcript, summary and to-dos.")
                        .font(.system(size: 12)).foregroundStyle(.white.opacity(0.9)).lineLimit(4)
                } else {
                    ForEach(Array(entry.data.ai.prefix(3)), id: \.self) { n in
                        Link(destination: link(n.id.isEmpty ? "ai" : "ai/\(n.id)")) {
                            VStack(alignment: .leading, spacing: 1) {
                                Text(n.title).font(.system(size: 12, weight: .semibold)).foregroundStyle(.white).lineLimit(1)
                                Text(ago(n.when)).font(.system(size: 10)).foregroundStyle(.white.opacity(0.7))
                            }
                        }
                    }
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct AiNotesWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AriseNotesAi", provider: NotesProvider()) { entry in
            AiNotesView(entry: entry).containerBackground(for: .widget) { brand }
        }
        .configurationDisplayName("AI Notes")
        .description("Record in one tap and see your latest summaries.")
        .supportedFamilies([.systemMedium])
    }
}

// ─── Control Center and the Action button (iOS 18) ───────────────────────────
@available(iOS 18.0, *)
struct RecordControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.arisereader.notes.record") {
            ControlWidgetButton(action: OpenURLIntent(link("record"))) {
                Label("Record", systemImage: "mic.fill")
            }
        }
        .displayName("Record with Arise Notes")
        .description("Start recording a meeting or class.")
    }
}

@main
struct AriseNotesWidgets: WidgetBundle {
    var body: some Widget {
        QuickCaptureWidget()
        NotesListWidget()
        AiNotesWidget()
        if #available(iOS 18.0, *) {
            RecordControl()
        }
    }
}
