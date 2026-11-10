import AppIntents
import CryptoKit
import Foundation
import SwiftUI
import WidgetKit

// Independent public weather only. No device location permission, app-group
// entitlement, vault credential, calendar token or note content is needed.
enum WeatherUnit: String, AppEnum {
    case fahrenheit, celsius
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Temperature"
    static var caseDisplayRepresentations: [WeatherUnit: DisplayRepresentation] = [.fahrenheit: "Fahrenheit", .celsius: "Celsius"]
}
struct WeatherConfiguration: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Weather location"
    static var description = IntentDescription("Choose this widget's city and units. Weather is supplied by Open-Meteo independently of your Field Notes archive.")
    @Parameter(title: "City", default: "Tulsa") var city: String
    @Parameter(title: "Units", default: WeatherUnit.fahrenheit) var unit: WeatherUnit
}
struct WeatherReading: Codable {
    struct Day: Codable { let date: String; let high: Double; let low: Double; let code: Int }
    let city: String
    let temperature: Double
    let code: Int
    let isDay: Bool
    let days: [Day]
    let updatedAt: Date
    static let preview = WeatherReading(city: "Tulsa", temperature: 72, code: 2, isDay: true,
        days: [Day(date: Date().localISODate, high: 78, low: 59, code: 2)], updatedAt: Date())
}
struct WeatherEntry: TimelineEntry {
    let date: Date
    let reading: WeatherReading?
    let city: String
    let stale: Bool
    var preview = false
}
struct WeatherProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> WeatherEntry {
        WeatherEntry(date: Date(), reading: .preview, city: "Tulsa", stale: false, preview: true)
    }
    func snapshot(for configuration: WeatherConfiguration, in context: Context) async -> WeatherEntry {
        if context.isPreview { return placeholder(in: context) }
        return await entry(configuration)
    }
    func timeline(for configuration: WeatherConfiguration, in context: Context) async -> Timeline<WeatherEntry> {
        let value = await entry(configuration)
        // This is a requested refresh; WidgetKit controls the actual schedule.
        return Timeline(entries: [value], policy: .after(Date().addingTimeInterval(30 * 60)))
    }
    private func entry(_ configuration: WeatherConfiguration) async -> WeatherEntry {
        let city = String(configuration.city.trimmingCharacters(in: .whitespacesAndNewlines).prefix(80))
        let cache = WeatherCache(city: city, unit: configuration.unit)
        do {
            let reading = try await WeatherService.fetch(city: city, unit: configuration.unit)
            cache.save(reading)
            return WeatherEntry(date: Date(), reading: reading, city: city, stale: false)
        } catch {
            return WeatherEntry(date: Date(), reading: cache.read(), city: city, stale: true)
        }
    }
}

struct WeatherCache {
    let city: String
    let unit: WeatherUnit
    var directory: URL? = nil
    private var url: URL? {
        guard let directory = directory ?? FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else { return nil }
        let key = SHA256.hash(data: Data((city.lowercased() + unit.rawValue).utf8)).map { String(format: "%02x", $0) }.joined()
        return directory.appendingPathComponent("field-notes-weather-" + key + ".json")
    }
    func read() -> WeatherReading? {
        guard let url, let data = try? Data(contentsOf: url), data.count < 50_000,
              let reading = try? JSONDecoder().decode(WeatherReading.self, from: data),
              Date().timeIntervalSince(reading.updatedAt) >= -300,
              Date().timeIntervalSince(reading.updatedAt) < 24 * 60 * 60,
              reading.temperature.isFinite else { return nil }
        return reading
    }
    func save(_ reading: WeatherReading) {
        guard let url, let data = try? JSONEncoder().encode(reading) else { return }
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? data.write(to: url, options: .atomic)
    }
}

enum WeatherService {
    enum Failure: Error { case unavailable }
    struct Geocoding: Decodable {
        struct Place: Decodable { let name: String; let latitude: Double; let longitude: Double; let country_code: String? }
        let results: [Place]?
    }
    struct Forecast: Decodable {
        struct Current: Decodable { let temperature_2m: Double; let weather_code: Int; let is_day: Int }
        struct Daily: Decodable { let time: [String]; let temperature_2m_max: [Double]; let temperature_2m_min: [Double]; let weather_code: [Int] }
        let current: Current
        let daily: Daily
    }
    private static func request<T: Decodable>(_ components: URLComponents) async throws -> T {
        guard let url = components.url else { throw Failure.unavailable }
        var request = URLRequest(url: url); request.timeoutInterval = 10
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse, response.statusCode == 200, data.count < 100_000 else { throw Failure.unavailable }
        return try JSONDecoder().decode(T.self, from: data)
    }
    static func fetch(city: String, unit: WeatherUnit) async throws -> WeatherReading {
        guard !city.isEmpty, city.rangeOfCharacter(from: .controlCharacters) == nil else { throw Failure.unavailable }
        var geo = URLComponents(string: "https://geocoding-api.open-meteo.com/v1/search")!
        geo.queryItems = [URLQueryItem(name: "name", value: city), URLQueryItem(name: "count", value: "1"), URLQueryItem(name: "language", value: "en")]
        let places: Geocoding = try await request(geo)
        guard let place = places.results?.first, place.latitude.isFinite, place.longitude.isFinite,
              (-90...90).contains(place.latitude), (-180...180).contains(place.longitude) else { throw Failure.unavailable }
        var forecast = URLComponents(string: "https://api.open-meteo.com/v1/forecast")!
        forecast.queryItems = ["latitude": String(place.latitude), "longitude": String(place.longitude),
            "current": "temperature_2m,weather_code,is_day", "daily": "temperature_2m_max,temperature_2m_min,weather_code",
            "timezone": "auto", "forecast_days": "5", "temperature_unit": unit.rawValue].map { URLQueryItem(name: $0.key, value: $0.value) }
        let body: Forecast = try await request(forecast)
        guard body.current.temperature_2m.isFinite else { throw Failure.unavailable }
        let daily = body.daily
        let count = min(5, daily.time.count, daily.temperature_2m_max.count, daily.temperature_2m_min.count, daily.weather_code.count)
        let days = (0..<count).compactMap { index -> WeatherReading.Day? in
            guard daily.temperature_2m_max[index].isFinite, daily.temperature_2m_min[index].isFinite,
                  daily.time[index].range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil else { return nil }
            return WeatherReading.Day(date: daily.time[index], high: daily.temperature_2m_max[index], low: daily.temperature_2m_min[index], code: daily.weather_code[index])
        }
        return WeatherReading(city: place.name, temperature: body.current.temperature_2m, code: body.current.weather_code,
                              isDay: body.current.is_day == 1, days: days, updatedAt: Date())
    }
}

struct WeatherWidgetView: View {
    let entry: WeatherEntry
    @Environment(\.widgetFamily) private var family
    private func symbol(_ code: Int, _ day: Bool) -> String {
        switch code {
        case 0: return day ? "sun.max" : "moon"
        case 1, 2: return day ? "cloud.sun" : "cloud.moon"
        case 3: return "cloud"
        case 45, 48: return "cloud.fog"
        case 51...67, 80...82: return "cloud.rain"
        case 71...77, 85, 86: return "cloud.snow"
        case 95...99: return "cloud.bolt.rain"
        default: return "cloud"
        }
    }
    private var showsForecast: Bool {
        if family == .systemLarge { return true }
        #if os(iOS)
        if family == .systemExtraLarge { return true }
        #endif
        return false
    }
    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: family == .systemSmall || family == .systemMedium ? 2 : 4) {
                Spacer(minLength: 0)
                if let reading = entry.reading {
                    HStack(spacing: 8) {
                        Image(systemName: symbol(reading.code, reading.isDay))
                            .font(.system(size: family == .systemSmall ? 27 : 32, weight: .light))
                        Text(String(Int(reading.temperature.rounded())) + "°")
                            .font(WidgetStyle.sign(min(82, geometry.size.height * 0.40), "Light"))
                            .lineLimit(1).minimumScaleFactor(0.6)
                    }
                    if let today = reading.days.first {
                        Text("H " + String(Int(today.high.rounded())) + "°   L " + String(Int(today.low.rounded())) + "°")
                            .font(WidgetStyle.sign(15, "Regular"))
                    }
                    Text(reading.city.uppercased()).font(WidgetStyle.ui(10)).lineLimit(1).minimumScaleFactor(0.6)
                    if showsForecast {
                        HStack(spacing: 16) {
                            ForEach(Array(reading.days.dropFirst().prefix(4).enumerated()), id: \.offset) { _, day in
                                VStack(spacing: 6) {
                                    Text(String(day.date.suffix(2))).font(WidgetStyle.ui(11))
                                    Image(systemName: symbol(day.code, true)).font(.system(size: 17, weight: .light))
                                    Text(String(Int(day.high.rounded())) + "°").font(WidgetStyle.sign(18, "Regular"))
                                }
                            }
                        }.padding(.top, 14)
                    }
                    Spacer(minLength: 0)
                    Text((entry.preview ? "Preview · " : entry.stale ? "Saved · " : "Open-Meteo · ") + reading.updatedAt.formatted(date: .omitted, time: .shortened))
                        .font(WidgetStyle.ui(8)).opacity(0.65).lineLimit(1).minimumScaleFactor(0.6)
                } else {
                    Image(systemName: "cloud").font(.system(size: 30, weight: .light))
                    Text("Weather unavailable").font(WidgetStyle.sign(20, "Regular"))
                    Text(entry.city.isEmpty ? "Choose a city in widget settings" : entry.city)
                        .font(WidgetStyle.ui(11)).lineLimit(2).multilineTextAlignment(.center)
                    Spacer(minLength: 0)
                    Text("Open-Meteo").font(WidgetStyle.ui(8)).opacity(0.65)
                }
            }
            .foregroundStyle(WidgetStyle.ink).frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .padding(14).containerBackground(WidgetStyle.teal, for: .widget)
        .widgetURL(WidgetStyle.link("weather"))
    }
}
struct WeatherWidget: Widget {
    let kind = "FieldNotesWeather"
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: WeatherConfiguration.self, provider: WeatherProvider()) { WeatherWidgetView(entry: $0) }
            .configurationDisplayName("Weather").description("Open-Meteo weather for your chosen city, independent of archive pairing. The system controls refresh timing.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge]).contentMarginsDisabled()
    }
}
