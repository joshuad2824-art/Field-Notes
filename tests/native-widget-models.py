"""Run the actual Swift date/cache/provider code using temporary process-local fixtures."""
from pathlib import Path
import subprocess, tempfile, sys
root = Path(__file__).resolve().parents[1]
widgets = (root / 'ios/App/FieldNotesWidgets/FieldNotesWidgets.swift').read_text()
weather = (root / 'ios/App/FieldNotesWidgets/WeatherWidget.swift').read_text()
def section(source, start, end):
    return source[source.index(start):source.index(end, source.index(start))]
source = 'import Foundation\nimport WidgetKit\nimport AppIntents\nimport CryptoKit\nimport CoreGraphics\n'
source += section(widgets, 'struct DayEntry:', 'struct QuickNoteView:')
source += section(widgets, 'struct CalendarDay:', 'struct CalendarCell:')
source += section(widgets, 'extension Date {', '@main')
source += section(weather, 'enum WeatherUnit:', 'struct WeatherConfiguration:')
source += section(weather, 'struct WeatherReading:', 'struct WeatherEntry:')
source += section(weather, 'struct WeatherCache {', 'struct WeatherWidgetView:')
source += r'''
func check(_ test: @autoclosure () -> Bool, _ name: String) { precondition(test(), name) }
var calendar = Calendar(identifier: .gregorian)
calendar.timeZone = TimeZone(identifier: "America/Chicago")!
let formatter = DateFormatter(); formatter.calendar = calendar; formatter.timeZone = calendar.timeZone
formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.dateFormat = "yyyy-MM-dd HH:mm"
for (day, hours) in [("2026-03-08", 23), ("2026-11-01", 25)] {
    let start = formatter.date(from: day + " 00:00")!
    let entries = DayProvider.entries(from: start, calendar: calendar)
    check(entries.count == 8, "A week of local date entries")
    check(Int(entries[1].date.timeIntervalSince(start) / 3600) == hours, "DST civil midnight")
    for entry in entries.dropFirst() { check(calendar.component(.hour, from: entry.date) == 0, "Midnight remains local") }
}
for (date, count) in [("2026-08-15 12:00", 42), ("2028-02-15 12:00", 35), ("2026-11-04 12:00", 35)] {
    let model = CalendarLayout(date: formatter.date(from: date)!, size: CGSize(width: 142, height: 142), compact: true)
    check(model.weeks.flatMap { $0 }.count == count, "Five/six-week calendar")
    let days = model.weeks.flatMap { $0 }.filter { $0.inMonth }
    check(days.map { $0.number } == Array(1...days.count), "Every month date exactly once")
    check(days.filter { $0.today }.count == 1, "One current date")
    check(model.cell * CGFloat(model.weeks.count) + model.header + model.weekdays + model.gap * 2 <= 142, "Small widget grid fits")
}
let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let cache = WeatherCache(city: "Fixture City", unit: .fahrenheit, directory: directory)
func reading(_ age: TimeInterval) -> WeatherReading {
    WeatherReading(city: "Fixture City", temperature: 72, code: 2, isDay: true, days: [], updatedAt: Date().addingTimeInterval(-age))
}
cache.save(reading(3600)); check(cache.read()?.temperature == 72, "Saved weather available offline")
check(WeatherCache(city: "Other City", unit: .fahrenheit, directory: directory).read() == nil, "Cities isolated")
check(WeatherCache(city: "Fixture City", unit: .celsius, directory: directory).read() == nil, "Units isolated")
cache.save(reading(25 * 3600)); check(cache.read() == nil, "Expired weather never shown")
cache.save(reading(-600)); check(cache.read() == nil, "Future cache rejected")
cache.save(reading(0)); check(cache.read() != nil, "Cache recovers after stale data")
print("PASS actual Swift widget models: DST23/25h, leap/six-week calendars, small-grid bounds, cached weather age/city/unit isolation")
'''
if '--live' in sys.argv:
    source += r'''
let live = try await WeatherService.fetch(city: "Tulsa", unit: .fahrenheit)
check(live.temperature.isFinite && live.days.count >= 4, "Public live weather decoded")
print("PASS actual Swift Open-Meteo request: \(live.city), \(live.days.count) forecast days, current timestamp \(live.updatedAt)")
'''
with tempfile.TemporaryDirectory(prefix='field-notes-widget-models-') as folder:
    folder = Path(folder); file = folder / 'Checks.swift'; file.write_text(source)
    result = subprocess.run(['swift', '-module-cache-path', '/tmp/field-notes-swift-modulecache', str(file), str(folder / 'cache')])
    raise SystemExit(result.returncode)
