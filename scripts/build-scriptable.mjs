import { readFileSync, writeFileSync } from 'node:fs'
const core = readFileSync(new URL('../widgets/scriptable/core.js', import.meta.url), 'utf8')
for (const [name,kind] of [['Calendar','calendar'],['Weather','weather'],['Quick Note','note'],['Date','date']]) {
  const output = '// Variables used by Scriptable.\n// icon-color: deep-green; icon-glyph: book;\n// Generated from widgets/scriptable/core.js. No archive key belongs in this file.\n'+core+'\nawait run('+JSON.stringify(kind)+')\n'
  writeFileSync(new URL('../widgets/scriptable/Field Notes '+name+'.js',import.meta.url),output)
}
