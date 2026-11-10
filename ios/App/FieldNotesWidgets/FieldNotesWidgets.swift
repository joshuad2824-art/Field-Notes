import WidgetKit
import SwiftUI
import AppIntents

// These widgets never read the app's notes, vault key or Scriptable connection.
// Date/calendar are local; weather has its own explicit city configuration.
enum WidgetStyle {
    static let teal = Color(red: 0, green: 34/255, blue: 36/255)
    static let burgundy = Color(red: 55/255, green: 4/255, blue: 36/255)
    static let sand = Color(red: 185/255, green: 165/255, blue: 144/255)
    static let ink = Color(red: 246/255, green: 243/255, blue: 236/255)
    static let dark = Color(red: 0, green: 16/255, blue: 17/255)
    static func sign(_ size: CGFloat, _ weight: String = "Medium") -> Font { .custom("FieldNotesSign-" + weight, size: size) }
    static func ui(_ size: CGFloat, _ weight: String = "Regular") -> Font { .custom("FieldNotesUI-" + weight, size: size) }
    static func link(_ route: String) -> URL {
        let scheme = Bundle.main.object(forInfoDictionaryKey: "FieldNotesURLScheme") as? String ?? "fieldnotes"
        return URL(string: scheme + "://" + route)!
    }
}

struct DayEntry: TimelineEntry { let date: Date }
struct DayProvider: TimelineProvider {
    func placeholder(in context: Context) -> DayEntry { DayEntry(date: Date()) }
    func getSnapshot(in context: Context, completion: @escaping (DayEntry) -> Void) { completion(DayEntry(date: Date())) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<DayEntry>) -> Void) {
        completion(Timeline(entries: Self.entries(from: Date()), policy: .atEnd))
    }
    static func entries(from now: Date, calendar: Calendar = .current) -> [DayEntry] {
        let midnight = calendar.startOfDay(for: now)
        // Local midnight arithmetic preserves the civil date across DST.
        return [DayEntry(date: now)] + (1...7).compactMap { day in
            calendar.date(byAdding: .day, value: day, to: midnight).map { DayEntry(date: $0) }
        }
    }
}

struct QuickNoteView: View {
    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 7) {
                Text("QUICK").font(WidgetStyle.sign(min(34, geometry.size.width * 0.145)))
                Text("NOTE").font(WidgetStyle.sign(min(34, geometry.size.width * 0.145), "Light"))
            }
            .foregroundStyle(WidgetStyle.ink).lineLimit(1).minimumScaleFactor(0.7)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .accessibilityElement(children: .ignore).accessibilityLabel("Quick note. Open Field Notes to capture a thought.")
        }
        .padding(14).containerBackground(WidgetStyle.burgundy, for: .widget)
        .widgetURL(WidgetStyle.link("quick-note"))
    }
}

struct DateWidgetView: View {
    let entry: DayEntry
    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: 4) {
                Text(entry.date.formatted(.dateTime.weekday(.abbreviated)).uppercased())
                    .font(WidgetStyle.sign(min(80, geometry.size.height * 0.34), "SemiBold"))
                Text(entry.date.formatted(.dateTime.day()) + " " + entry.date.formatted(.dateTime.month(.abbreviated)).uppercased())
                    .font(WidgetStyle.sign(min(35, geometry.size.height * 0.155), "Regular"))
            }
            .lineLimit(1).minimumScaleFactor(0.65).foregroundStyle(WidgetStyle.dark)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .accessibilityElement(children: .ignore).accessibilityLabel(entry.date.formatted(date: .complete, time: .omitted))
        }
        .padding(14).containerBackground(WidgetStyle.sand, for: .widget)
        .widgetURL(WidgetStyle.link("day/" + entry.date.localISODate))
    }
}

struct CalendarDay: Identifiable {
    let id: Int
    let number: Int
    let today: Bool
    let inMonth: Bool
}
struct CalendarLayout {
    let weeks: [[CalendarDay]]
    let month: String
    let year: String
    let compact: Bool
    let header: CGFloat
    let weekdays: CGFloat
    let gap: CGFloat
    let cell: CGFloat
    let width: CGFloat
    init(date: Date, size: CGSize, compact: Bool) {
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = .current
        let first = calendar.date(from: calendar.dateComponents([.year, .month], from: date))!
        let leading = calendar.component(.weekday, from: first) - 1
        let days = calendar.range(of: .day, in: .month, for: first)!.count
        let count = max(35, Int(ceil(Double(leading + days) / 7)) * 7)
        let cells = (0..<count).map { index -> CalendarDay in
            let day = calendar.date(byAdding: .day, value: index - leading, to: first)!
            return CalendarDay(id: index, number: calendar.component(.day, from: day),
                today: calendar.isDate(day, inSameDayAs: date), inMonth: calendar.isDate(day, equalTo: first, toGranularity: .month))
        }
        weeks = stride(from: 0, to: count, by: 7).map { Array(cells[$0..<($0 + 7)]) }
        month = date.formatted(.dateTime.month(.wide)).uppercased(); year = date.formatted(.dateTime.year())
        self.compact = compact; width = size.width
        header = compact ? 27 : 45; weekdays = compact ? 15 : 23; gap = compact ? 2 : 5
        cell = max(12, (size.height - header - weekdays - gap * 3) / CGFloat(count / 7))
    }
}
struct CalendarCell: View {
    let day: CalendarDay
    let layout: CalendarLayout
    var body: some View {
        Text(String(day.number))
            .font(WidgetStyle.ui(layout.compact ? 11 : 16, "Medium"))
            .foregroundStyle(day.today ? WidgetStyle.teal : WidgetStyle.ink)
            .frame(width: max(12, min(layout.cell - 1, layout.width / 7 - 2)), height: max(12, layout.cell - 1))
            .background { if day.today { Circle().fill(WidgetStyle.sand) } }
            .opacity(day.inMonth ? 1 : 0.3)
            .frame(maxWidth: .infinity, minHeight: layout.cell)
    }
}
struct CalendarContent: View {
    let layout: CalendarLayout
    var body: some View {
        VStack(spacing: layout.gap) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(layout.month).font(WidgetStyle.sign(layout.compact ? 20 : 34, "SemiBold"))
                Text(layout.year).font(WidgetStyle.sign(layout.compact ? 18 : 30, "Light"))
            }.frame(height: layout.header).lineLimit(1).minimumScaleFactor(0.7)
            HStack(spacing: 0) {
                ForEach(0..<7, id: \.self) { index in
                    Text(["S", "M", "T", "W", "T", "F", "S"][index])
                        .font(WidgetStyle.ui(layout.compact ? 9 : 12)).frame(maxWidth: .infinity)
                }
            }.frame(height: layout.weekdays).opacity(0.65)
            VStack(spacing: 0) {
                ForEach(0..<layout.weeks.count, id: \.self) { row in
                    HStack(spacing: 0) {
                        ForEach(layout.weeks[row]) { day in CalendarCell(day: day, layout: layout) }
                    }
                }
            }
        }.foregroundStyle(WidgetStyle.ink)
    }
}
struct CalendarWidgetView: View {
    let entry: DayEntry
    @Environment(\.widgetFamily) private var family
    var body: some View {
        GeometryReader { geometry in
            CalendarContent(layout: CalendarLayout(date: entry.date, size: geometry.size,
                compact: family == .systemSmall || family == .systemMedium))
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Calendar, " + entry.date.formatted(.dateTime.month(.wide).year()) + ". Today, " + entry.date.formatted(date: .complete, time: .omitted) + ". Calendar marks are not connected.")
        .padding(14).containerBackground(WidgetStyle.teal, for: .widget)
        .widgetURL(WidgetStyle.link("calendar"))
    }
}

struct CalendarWidget: Widget {
    let kind = "FieldNotesCalendar"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DayProvider()) { CalendarWidgetView(entry: $0) }
            .configurationDisplayName("Calendar").description("A quiet month at a glance. Opens the Field Notes calendar; archive marks are not connected.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge]).contentMarginsDisabled()
    }
}
struct QuickNoteWidget: Widget {
    let kind = "FieldNotesQuickNote"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DayProvider()) { _ in QuickNoteView() }
            .configurationDisplayName("Quick Note").description("Open your Field Notes quick-note draft.")
            .supportedFamilies([.systemSmall, .systemMedium]).contentMarginsDisabled()
    }
}
struct SimpleDateWidget: Widget {
    let kind = "FieldNotesDate"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DayProvider()) { DateWidgetView(entry: $0) }
            .configurationDisplayName("Date").description("The familiar sand date card, updated at local midnight.")
            .supportedFamilies([.systemSmall, .systemMedium]).contentMarginsDisabled()
    }
}

extension Date {
    var localISODate: String {
        let formatter = DateFormatter(); formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: self)
    }
}

@main
struct FieldNotesWidgets: WidgetBundle {
    var body: some Widget { CalendarWidget(); QuickNoteWidget(); SimpleDateWidget(); WeatherWidget() }
}
