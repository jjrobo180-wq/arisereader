
// MARK: - Arise To Duo: Rise Score widgets (day, week and year standing)
// Added to AriseWidgets.swift by .github/scripts/add_widget.rb next to DuoDesigns.swift (the app's widget list has
// an id ending in ".designs"). Five widgets: Your Standing, Today's Breakdown, Week Grade (medium), Year Standing
// (medium) and Full Standing (large). They all read one slot the app sends, "duo.scores"
// (client/src/lib/riseScoreWidgets.ts, worked out by shared/riseScore.ts): a percent and letter grade for today,
// this week and this year, one per category (Checklist, Food, Move, Money), each day of this week and each month
// of this year, plus a line on what lifts the grade next.

struct RiseCategory: Codable, Hashable {
    var name: String = ""
    var percent: Int = 0
    var color: String = "#ffb347"
}

struct RiseScores: Codable {
    var today: Int = 0
    var week: Int = 0
    var year: Int = 0
    var overall: Int = 0
    var categories: [RiseCategory] = []
    /// Monday to Sunday; -1 is a day with nothing to score yet.
    var weekDays: [Int] = []
    var todayIndex: Int = 0
    /// January to December; -1 is a month with nothing to score yet.
    var months: [Int] = []
    var monthIndex: Int = 0
    var streak: Int = 0
    var next: String = ""
    var tip: String = ""
    var date: String = ""

    enum CodingKeys: String, CodingKey {
        case today, week, year, overall, categories, weekDays, todayIndex, months, monthIndex, streak, next, tip, date
    }

    init() {}
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        func v<T: Decodable>(_ k: CodingKeys, _ fallback: T) -> T { (try? c.decodeIfPresent(T.self, forKey: k)) ?? fallback }
        today = v(.today, 0); week = v(.week, 0); year = v(.year, 0); overall = v(.overall, 0)
        categories = v(.categories, [RiseCategory]())
        weekDays = v(.weekDays, [Int]()); todayIndex = v(.todayIndex, 0)
        months = v(.months, [Int]()); monthIndex = v(.monthIndex, 0)
        streak = v(.streak, 0); next = v(.next, ""); tip = v(.tip, ""); date = v(.date, "")
    }

    /// What the widget gallery shows before the app has sent anything.
    static var sample: RiseScores {
        var s = RiseScores()
        s.today = 88; s.week = 84; s.year = 77; s.overall = 83
        s.categories = [
            RiseCategory(name: "Checklist", percent: 86, color: "#ffb347"),
            RiseCategory(name: "Food", percent: 92, color: "#4fd1c5"),
            RiseCategory(name: "Move", percent: 80, color: "#ff7a6b"),
            RiseCategory(name: "Money", percent: 94, color: "#a99bff"),
        ]
        s.weekDays = [92, 80, 96, 68, 88, 78, 88]; s.todayIndex = 6
        s.months = [71, 70, 66, 74, 78, 72, 80, 78, 83, 86, 85, -1]; s.monthIndex = 10
        s.streak = 7; s.next = "Call the dentist"; s.tip = "Finish Move to reach an A today"; s.date = "Sun, Nov 22"
        return s
    }
}

func loadRiseScores() -> RiseScores? {
    guard let data = UserDefaults(suiteName: group())?.data(forKey: "slots"),
          let all = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let slot = all["duo.scores"] as? [String: Any], let raw = slot["scores"],
          let d = try? JSONSerialization.data(withJSONObject: raw) else { return nil }
    return try? JSONDecoder().decode(RiseScores.self, from: d)
}

enum RiseGrade {
    /// A 90+, B+ 87, B 83, B- 80, C+ 77, C 73, C- 70, D below 70 (the same scale as shared/riseScore.ts).
    static func letter(_ p: Int) -> String {
        switch p {
        case 90...: return "A"
        case 87..<90: return "B+"
        case 83..<87: return "B"
        case 80..<83: return "B-"
        case 77..<80: return "C+"
        case 73..<77: return "C"
        case 70..<73: return "C-"
        default: return "D"
        }
    }
}

enum RiseTheme {
    static func rgb(_ hex: UInt32) -> Color {
        Color(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
    static func parse(_ hex: String) -> Color {
        let h = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard h.count == 6, let v = UInt32(h, radix: 16) else { return amber }
        return rgb(v)
    }
    static let card = rgb(0x1B1D3A)
    static let track = rgb(0x30345F)
    static let tipBack = rgb(0x272A52)
    static let dashed = rgb(0x5A5E96)
    static let text = rgb(0xF6F1E9)
    static let muted = rgb(0xB7B6D8)
    static let amber = rgb(0xFFB347)
    static let teal = rgb(0x4FD1C5)
    static let lavender = rgb(0xA99BFF)
}

private func riseFont(_ size: CGFloat, _ weight: Font.Weight = .heavy) -> Font {
    .system(size: size, weight: weight, design: .rounded)
}

struct RiseLabel: View {
    let text: String
    var color: Color = RiseTheme.muted
    var body: some View {
        Text(text.uppercased()).font(riseFont(11)).tracking(0.9).foregroundStyle(color).lineLimit(1)
    }
}

struct RiseRing<Center: View>: View {
    let percent: Int
    let color: Color
    var line: CGFloat = 9
    @ViewBuilder var center: () -> Center
    var body: some View {
        ZStack {
            Circle().stroke(RiseTheme.track, lineWidth: line)
            Circle()
                .trim(from: 0, to: CGFloat(min(max(percent, 0), 100)) / 100)
                .stroke(color, style: StrokeStyle(lineWidth: line, lineCap: .round))
                .rotationEffect(.degrees(-90))
            center()
        }
        .padding(line / 2)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(percent) percent, grade \(RiseGrade.letter(percent))")
    }
}

struct RiseBar: View {
    let percent: Int
    let color: Color
    var height: CGFloat = 6
    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(RiseTheme.track)
                Capsule().fill(color).frame(width: g.size.width * CGFloat(min(max(percent, 0), 100)) / 100)
            }
        }
        .frame(height: height)
    }
}

struct RiseChip: View {
    let text: String
    let color: Color
    var body: some View {
        Text(text).font(riseFont(12, .black)).foregroundStyle(RiseTheme.card)
            .padding(.horizontal, 10).padding(.vertical, 3)
            .background(color, in: Capsule())
            .lineLimit(1)
    }
}

struct RiseCategoryRow: View {
    let c: RiseCategory
    var body: some View {
        HStack(spacing: 8) {
            Text(c.name).font(riseFont(12, .bold)).frame(width: 62, alignment: .leading).lineLimit(1)
            RiseBar(percent: c.percent, color: RiseTheme.parse(c.color))
            Text("\(c.percent)%").font(riseFont(12)).frame(width: 36, alignment: .trailing)
        }
        .foregroundStyle(RiseTheme.text)
        .accessibilityElement(children: .combine)
    }
}

struct RiseBigPercent: View {
    let percent: Int
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 2) {
            Text("\(percent)").font(riseFont(38, .black)).foregroundStyle(RiseTheme.text)
            Text("%").font(riseFont(20)).foregroundStyle(RiseTheme.muted)
        }
        .lineLimit(1)
    }
}

/// Bars with a letter under each; -1 draws a dashed "not yet" bar, the highlighted one is amber.
struct RiseColumns: View {
    let values: [Int]
    let labels: [String]
    let highlight: Int
    let color: Color
    var barWidth: CGFloat = 22
    var maxHeight: CGFloat = 64
    var corner: CGFloat = 7

    var body: some View {
        HStack(alignment: .bottom, spacing: 0) {
            ForEach(Array(values.enumerated()), id: \.offset) { i, value in
                VStack(spacing: 6) {
                    ZStack(alignment: .bottom) {
                        if value < 0 {
                            RoundedRectangle(cornerRadius: corner)
                                .strokeBorder(RiseTheme.dashed, style: StrokeStyle(lineWidth: 1.5, dash: [3, 3]))
                        } else {
                            RoundedRectangle(cornerRadius: corner).fill(RiseTheme.track)
                            RoundedRectangle(cornerRadius: corner)
                                .fill(i == highlight ? RiseTheme.amber : color)
                                .frame(height: max(2, maxHeight * CGFloat(min(value, 100)) / 100))
                        }
                    }
                    .frame(width: barWidth, height: maxHeight)
                    Text(i < labels.count ? labels[i] : "")
                        .font(riseFont(11, i == highlight ? .black : .heavy))
                        .foregroundStyle(i == highlight ? RiseTheme.card : RiseTheme.muted)
                        .frame(minWidth: 16, minHeight: 16)
                        .background(Capsule().fill(i == highlight ? RiseTheme.amber : Color.clear))
                }
                if i < values.count - 1 { Spacer(minLength: 1) }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(zip(labels, values).filter { $0.1 >= 0 }.map { "\($0.0) \($0.1) percent" }.joined(separator: ", "))
    }
}

// MARK: The five designs

/// 6 · Your Standing: today, this week and this year side by side.
struct RiseTrioView: View {
    let s: RiseScores
    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 5) {
                Image(systemName: "sunrise.fill").font(riseFont(12)).foregroundStyle(RiseTheme.amber)
                RiseLabel(text: "Your standing")
                Spacer(minLength: 4)
                Text("Overall \(RiseGrade.letter(s.overall))").font(riseFont(11)).foregroundStyle(RiseTheme.text)
                    .padding(.horizontal, 9).padding(.vertical, 2).background(RiseTheme.track, in: Capsule())
            }
            HStack(alignment: .top) {
                column("Today", s.today, RiseTheme.amber)
                Spacer(minLength: 4)
                column("Week", s.week, RiseTheme.teal)
                Spacer(minLength: 4)
                column("Year", s.year, RiseTheme.lavender)
            }
            .padding(.horizontal, 6)
        }
    }
    private func column(_ label: String, _ p: Int, _ color: Color) -> some View {
        VStack(spacing: 6) {
            RiseRing(percent: p, color: color, line: 8) {
                Text("\(p)%").font(riseFont(18, .black)).foregroundStyle(RiseTheme.text).minimumScaleFactor(0.7)
            }
            .frame(width: 70, height: 70)
            Text("\(label) · \(RiseGrade.letter(p))").font(riseFont(12)).foregroundStyle(color).lineLimit(1)
        }
    }
}

/// 7 · Today's Breakdown: today's grade and a bar for each category.
struct RiseBreakdownView: View {
    let s: RiseScores
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                RiseLabel(text: "Today's breakdown")
                Spacer(minLength: 4)
                RiseLabel(text: "Rise score", color: RiseTheme.amber)
            }
            HStack(spacing: 14) {
                RiseRing(percent: s.today, color: RiseTheme.amber, line: 9) {
                    VStack(spacing: 2) {
                        Text(RiseGrade.letter(s.today)).font(riseFont(28, .black))
                        Text("\(s.today)%").font(riseFont(12)).foregroundStyle(RiseTheme.muted)
                    }
                    .foregroundStyle(RiseTheme.text)
                }
                .frame(width: 78, height: 78)
                VStack(spacing: 6) {
                    if s.categories.isEmpty {
                        Text("Check off a task to start your score.").font(riseFont(12, .bold)).foregroundStyle(RiseTheme.muted)
                    } else {
                        ForEach(s.categories.prefix(4), id: \.self) { RiseCategoryRow(c: $0) }
                    }
                }
            }
            if !s.tip.isEmpty {
                Text(s.tip).font(riseFont(12)).foregroundStyle(RiseTheme.amber).lineLimit(1).minimumScaleFactor(0.8)
            }
        }
    }
}

/// 8 · Week Grade: this week's grade, a bar for each day and the streak.
struct RiseWeekView: View {
    let s: RiseScores
    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                RiseLabel(text: "This week")
                RiseBigPercent(percent: s.week)
                RiseChip(text: "Grade \(RiseGrade.letter(s.week))", color: RiseTheme.teal)
                if s.streak > 0 {
                    Label("\(s.streak)-day streak", systemImage: "flame.fill").font(riseFont(12)).foregroundStyle(RiseTheme.amber).lineLimit(1)
                }
            }
            .frame(width: 100, alignment: .leading)
            RiseColumns(values: s.weekDays.count == 7 ? s.weekDays : Array(repeating: -1, count: 7),
                        labels: ["M", "T", "W", "T", "F", "S", "S"], highlight: s.todayIndex, color: RiseTheme.teal)
        }
    }
}

/// 9 · Year Standing: this year's grade and a bar for each month.
struct RiseYearView: View {
    let s: RiseScores
    private var climb: Int {
        let done = s.months.filter { $0 >= 0 }
        guard let first = done.first, let last = done.last, done.count > 1 else { return 0 }
        return last - first
    }
    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 6) {
                RiseLabel(text: "This year")
                RiseBigPercent(percent: s.year)
                RiseChip(text: "Grade \(RiseGrade.letter(s.year))", color: RiseTheme.lavender)
                Label(climb > 0 ? "Up \(climb) pts" : "Keep climbing", systemImage: "chart.line.uptrend.xyaxis")
                    .font(riseFont(12)).foregroundStyle(RiseTheme.amber).lineLimit(1)
                if climb > 0 { Text("since January").font(riseFont(11, .bold)).foregroundStyle(RiseTheme.muted) }
            }
            .frame(width: 112, alignment: .leading)
            RiseColumns(values: s.months.count == 12 ? s.months : Array(repeating: -1, count: 12),
                        labels: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"], highlight: s.monthIndex,
                        color: RiseTheme.lavender, barWidth: 9, maxHeight: 70, corner: 4)
        }
    }
}

/// 10 · Full Standing: the overall grade, day, week and year, every category and what's next.
struct RiseFullView: View {
    let s: RiseScores
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                HStack(spacing: 5) {
                    Image(systemName: "sunrise.fill").font(riseFont(12)).foregroundStyle(RiseTheme.amber)
                    RiseLabel(text: "Arise To Do")
                }
                Spacer()
                Text(s.date).font(riseFont(11)).foregroundStyle(RiseTheme.muted)
            }
            HStack(spacing: 14) {
                RiseRing(percent: s.overall, color: RiseTheme.amber, line: 11) {
                    VStack(spacing: 3) {
                        Text(RiseGrade.letter(s.overall)).font(riseFont(38, .black))
                        Text("\(s.overall)%").font(riseFont(12)).foregroundStyle(RiseTheme.muted)
                    }
                    .foregroundStyle(RiseTheme.text)
                }
                .frame(width: 100, height: 100)
                VStack(alignment: .leading, spacing: 5) {
                    Text("Overall standing").font(riseFont(17, .black)).foregroundStyle(RiseTheme.text)
                    Text("Today, week and year combined").font(riseFont(12, .bold)).foregroundStyle(RiseTheme.muted)
                    RiseChip(text: s.overall >= 90 ? "You're at an A!" : "\(90 - s.overall) pts from an A", color: RiseTheme.amber).padding(.top, 2)
                }
            }
            HStack(spacing: 12) {
                stat("Today", s.today, RiseTheme.amber)
                stat("Week", s.week, RiseTheme.teal)
                stat("Year", s.year, RiseTheme.lavender)
            }
            VStack(spacing: 5) {
                ForEach(s.categories.prefix(4), id: \.self) { RiseCategoryRow(c: $0) }
            }
            if !s.next.isEmpty || !s.tip.isEmpty {
                HStack(spacing: 10) {
                    Image(systemName: "circle").font(riseFont(18, .bold)).foregroundStyle(RiseTheme.amber)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(s.next.isEmpty ? s.tip : "Next up: \(s.next)").font(riseFont(12)).foregroundStyle(RiseTheme.text)
                        Text(s.next.isEmpty ? "Keep it going!" : "Finish it to raise today's grade.").font(riseFont(11, .bold)).foregroundStyle(RiseTheme.muted)
                    }
                    .lineLimit(1)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(RiseTheme.tipBack, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
    }
    private func stat(_ label: String, _ p: Int, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            RiseLabel(text: label)
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text("\(p)%").font(riseFont(20, .black)).foregroundStyle(RiseTheme.text)
                Text(RiseGrade.letter(p)).font(riseFont(12)).foregroundStyle(color)
            }
            RiseBar(percent: p, color: color, height: 5)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: Widgets

struct RiseScoreEntry: TimelineEntry {
    let date: Date
    let scores: RiseScores
}

struct RiseScoreProvider: TimelineProvider {
    func placeholder(in context: Context) -> RiseScoreEntry { RiseScoreEntry(date: Date(), scores: .sample) }
    func getSnapshot(in context: Context, completion: @escaping (RiseScoreEntry) -> Void) {
        let s = loadRiseScores()
        completion(RiseScoreEntry(date: Date(), scores: s ?? .sample))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<RiseScoreEntry>) -> Void) {
        let now = Date()
        let midnight = Calendar.current.startOfDay(for: now).addingTimeInterval(86_400 + 60)
        let entry = RiseScoreEntry(date: now, scores: loadRiseScores() ?? RiseScores())
        completion(Timeline(entries: [entry], policy: .after(min(midnight, now.addingTimeInterval(30 * 60)))))
    }
}

private let riseOpen = URL(string: "arisetodo://open?s=home")

struct RiseTrioWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "Arise.duo.score.trio", provider: RiseScoreProvider()) { e in
            RiseTrioView(s: e.scores).containerBackground(for: .widget) { RiseTheme.card }.widgetURL(riseOpen)
        }
        .configurationDisplayName("Your Standing").description("Today, this week and this year side by side.").supportedFamilies([.systemMedium])
    }
}

struct RiseBreakdownWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "Arise.duo.score.breakdown", provider: RiseScoreProvider()) { e in
            RiseBreakdownView(s: e.scores).containerBackground(for: .widget) { RiseTheme.card }.widgetURL(riseOpen)
        }
        .configurationDisplayName("Today's Breakdown").description("Checklist, food, move and money, and what lifts your grade.").supportedFamilies([.systemMedium])
    }
}

struct RiseWeekWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "Arise.duo.score.week", provider: RiseScoreProvider()) { e in
            RiseWeekView(s: e.scores).containerBackground(for: .widget) { RiseTheme.card }.widgetURL(riseOpen)
        }
        .configurationDisplayName("Week Grade").description("This week's grade, each day and your streak.").supportedFamilies([.systemMedium])
    }
}

struct RiseYearWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "Arise.duo.score.year", provider: RiseScoreProvider()) { e in
            RiseYearView(s: e.scores).containerBackground(for: .widget) { RiseTheme.card }.widgetURL(riseOpen)
        }
        .configurationDisplayName("Year Standing").description("This year's grade and how far you've climbed.").supportedFamilies([.systemMedium])
    }
}

struct RiseFullWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "Arise.duo.score.full", provider: RiseScoreProvider()) { e in
            RiseFullView(s: e.scores).containerBackground(for: .widget) { RiseTheme.card }.widgetURL(riseOpen)
        }
        .configurationDisplayName("Full Standing").description("Your overall grade, day, week, year and every category.").supportedFamilies([.systemLarge])
    }
}

/// The five Rise Score widgets (added to the bundle by add_widget.rb).
struct RiseScoreWidgets: WidgetBundle {
    var body: some Widget {
        RiseTrioWidget()
        RiseBreakdownWidget()
        RiseWeekWidget()
        RiseYearWidget()
        RiseFullWidget()
    }
}
