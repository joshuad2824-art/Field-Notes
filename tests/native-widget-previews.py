"""Render the actual SwiftUI widget views headlessly; OS gallery acceptance is separate."""
from pathlib import Path
import subprocess, tempfile, sys
root=Path(__file__).resolve().parents[1]
widgets=(root/'ios/App/FieldNotesWidgets/FieldNotesWidgets.swift').read_text()
weather=(root/'ios/App/FieldNotesWidgets/WeatherWidget.swift').read_text()
def section(source,start,end):return source[source.index(start):source.index(end,source.index(start))]
source='import Foundation\nimport SwiftUI\nimport WidgetKit\nimport AppIntents\nimport CryptoKit\nimport AppKit\nimport CoreText\n'
source+=section(widgets,'enum WidgetStyle {','struct CalendarWidget: Widget {')
source+=section(widgets,'extension Date {','@main')
source+=section(weather,'enum WeatherUnit:','struct WeatherConfiguration:')
source+=section(weather,'struct WeatherReading:','struct WeatherProvider:')
source+=section(weather,'struct WeatherCache {','struct WeatherWidget: Widget {')
# WidgetKit exposes widgetFamily read-only outside its host. The temporary
# renderer supplies that context explicitly; all view bodies remain unchanged.
context = '@Environment(\\.widgetFamily) private var family'
assert source.count(context) == 2
source = source.replace(context, 'var family: WidgetFamily = .systemSmall')
source+=r'''
let fonts=URL(fileURLWithPath:CommandLine.arguments[1]);let out=URL(fileURLWithPath:CommandLine.arguments[2])
try FileManager.default.createDirectory(at:out,withIntermediateDirectories:true)
for file in try FileManager.default.contentsOfDirectory(at:fonts,includingPropertiesForKeys:nil) where file.pathExtension=="ttf" {
    var error:Unmanaged<CFError>?;precondition(CTFontManagerRegisterFontsForURL(file as CFURL,.process,&error))
}
let live=try? await WeatherService.fetch(city:"Tulsa",unit:.fahrenheit)
let entry=WeatherEntry(date:Date(),reading:live ?? .preview,city:"Tulsa",stale:false,preview:live == nil)
await MainActor.run {
    _ = NSApplication.shared
    let sizes:[(String,CGFloat,CGFloat,WidgetFamily)]=[("small",170,170,.systemSmall),("medium",360,170,.systemMedium),("large",360,380,.systemLarge),("ipad-extra-large",740,360,.systemLarge)]
    for (size,w,h,family) in sizes {
        for kind in ["calendar","quick-note","date","weather"] {
            if (kind=="quick-note" || kind=="date") && (size=="large" || size=="ipad-extra-large") {continue}
            let view:AnyView;let background:Color
            switch kind {
            case "calendar":view=AnyView(CalendarWidgetView(entry:DayEntry(date:Date()),family:family));background=WidgetStyle.teal
            case "quick-note":view=AnyView(QuickNoteView());background=WidgetStyle.burgundy
            case "date":view=AnyView(DateWidgetView(entry:DayEntry(date:Date())));background=WidgetStyle.sand
            default:view=AnyView(WeatherWidgetView(entry:entry,family:family));background=WidgetStyle.teal
            }
            let content=view.frame(width:w,height:h).background(background).clipped()
            let renderer=ImageRenderer(content:content);renderer.scale=3
            guard let cg=renderer.cgImage,let data=NSBitmapImageRep(cgImage:cg).representation(using:.png,properties:[:]) else {fatalError("Native view failed to render")}
            try! data.write(to:out.appendingPathComponent(kind+"-"+size+".png"))
        }
    }
}
print("PASS: 12 previews rendered from actual SwiftUI widget views; extra-large uses identical large-view branches at iPad dimensions")
'''
out=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'work/native-widget-previews'
with tempfile.TemporaryDirectory(prefix='field-notes-widget-render-') as folder:
 file=Path(folder)/'Render.swift';file.write_text(source)
 result=subprocess.run(['swift','-module-cache-path','/tmp/field-notes-swift-modulecache',str(file),str(root/'ios/App/FieldNotesWidgets/Fonts'),str(out)])
 raise SystemExit(result.returncode)
