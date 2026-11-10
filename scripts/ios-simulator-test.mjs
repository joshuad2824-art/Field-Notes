import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { mkdirSync, openSync, closeSync, readFileSync } from 'node:fs'

const inventory = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'devices', 'available', '--json']))
const simulators = Object.values(inventory.devices).flat().filter((device) => /^(iPhone|iPad)/.test(device.name))
const phones = simulators.filter(device => device.name.startsWith('iPhone'))
const phone = process.env.IOS_SIMULATOR_ID
  ? simulators.find((device) => device.udid === process.env.IOS_SIMULATOR_ID)
  : phones.find((device) => device.state === 'Booted') ?? phones[0]
if (!phone) throw new Error('An available iPhone or iPad simulator is required; add one in Xcode.')

const allTests = [...readFileSync('ios/App/FieldNotesUITests/FieldNotesUITests.swift', 'utf8').matchAll(/func (test\w+)\(/g)].map(match => match[1])
const requested = (process.env.IOS_TEST_FILTER || '').split(',').filter(Boolean)
if (requested.some(name => !allTests.includes(name))) throw Error('IOS_TEST_FILTER must name current native test methods exactly')
const expected = requested.length ? requested : allTests

// A previous XCTest runner can retain a loaded test bundle across app installs.
// Stop only our test runner; the regular app and all simulator data stay intact.
spawnSync('xcrun', ['simctl', 'terminate', phone.udid, 'com.joshuadavis.fieldnotes.uitests.xctrunner'], { stdio: 'ignore' })

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const out = `work/ios-tests/${stamp}`
mkdirSync(out, { recursive: true })
const log = `${out}/test.log`
const fd = openSync(log, 'w')
console.log(`Testing on ${phone.name}. The UITest configuration uses a separate simulator-only app identity.`)
const child = spawn('xcodebuild', [
  '-project', 'ios/App/App.xcodeproj', '-scheme', 'App',
  '-configuration', 'UITest', '-sdk', 'iphonesimulator',
  '-destination', `id=${phone.udid}`, '-destination-timeout', '180',
  '-derivedDataPath', process.env.IOS_DERIVED_DATA_PATH || 'work/ios-derived-data',
  '-resultBundlePath', `${out}/FieldNotes.xcresult`,
  '-parallel-testing-enabled', 'NO',
  // Assertion failures retain screenshots/logs without a ten-minute sysdiagnose.
  '-collect-test-diagnostics', 'never',
  '-test-timeouts-enabled', 'YES',
  '-default-test-execution-time-allowance', '120',
  '-maximum-test-execution-time-allowance', '180',
  ...requested.map(name => `-only-testing:FieldNotesUITests/FieldNotesUITests/${name}`),
  'ONLY_ACTIVE_ARCH=YES', 'CODE_SIGNING_ALLOWED=NO', 'test',
], { stdio: ['ignore', fd, fd] })
child.on('error', (error) => { console.error(error); process.exitCode = 1 })
child.on('close', (code) => {
  closeSync(fd)
  console.log(`Xcode test results: ${out}/FieldNotes.xcresult`)
  const output = readFileSync(log, 'utf8')
  const missing = expected.filter(name => !output.includes(` ${name}]' passed`))
  if (code !== 0) console.error(output.slice(-6000))
  else if (missing.length) console.error(`FAIL: the current native suite did not execute successfully: ${missing.join(', ')}`)
  else console.log(`PASS: all ${expected.length} current native layout, keyboard and persistence tests passed.`)
  process.exitCode = code === 0 && missing.length ? 1 : (code ?? 1)
})
