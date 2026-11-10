import assert from 'node:assert/strict'
import { nativeWidgetRoute } from '../src/lib/native-widget-route.ts'
const accepted = [
 ['fieldnotes://quick-note','/quick-note'], ['fieldnotes://quick-note/','/quick-note'],
 ['fieldnotes://weather','/weather'], ['fieldnotes://calendar','/calendar'],
 ['fieldnotes://calendar/2026-11','/calendar/2026-11'],
 ['fieldnotes://day/2028-02-29','/day/2028-02-29'],
 ['fieldnotes-test://day/2026-11-04','/day/2026-11-04'],
 ['fieldnotes-test://quick-note','/quick-note'],
]
for (const [url,path] of accepted) assert.equal(nativeWidgetRoute(url),path,url)
const rejected = [undefined,null,42,'','not a URL','javascript:alert(1)',
 'https://timber-inkfieldnotes.netlify.app/quick-note','file:///quick-note',
 'fieldnotes://new','fieldnotes://trash','fieldnotes://settings',
 'fieldnotes://quick-note?key=private','fieldnotes://quick-note#pair',
 'fieldnotes://user:password@quick-note','fieldnotes://quick-note:123',
 'fieldnotes://calendar/2026-13','fieldnotes://calendar/2026-00',
 'fieldnotes://day/2026-02-29','fieldnotes://day/2026-04-31',
 'fieldnotes://day/2026-11-00','fieldnotes://day/2026-11-32',
 'fieldnotes://day/2026-11-04/extra','fieldnotes://quick-note/%2e%2e/settings',
 'fieldnotes://calendar/2026-11?source=scriptable','fieldnotes://quick-note/'+'a'.repeat(200)]
for (const url of rejected) assert.equal(nativeWidgetRoute(url),null,String(url))
console.log(`PASS native widget links: ${accepted.length} valid routes and ${rejected.length} rejected non-navigation/invalid inputs`)
