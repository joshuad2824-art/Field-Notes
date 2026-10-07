/* Count geolocation API calls; do not rely on browser permission persistence. */
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
const { chromium } = await import(`${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`)
const browser = await chromium.launch()
const base = process.env.BASE ?? 'http://127.0.0.1:4173'
const forecast = {
  current: { temperature_2m: 14, weather_code: 3, is_day: 1 },
  daily: { time: Array.from({ length: 7 }, (_, i) => `2026-10-0${i + 1}`),
    temperature_2m_max: Array(7).fill(18), temperature_2m_min: Array(7).fill(9), weather_code: Array(7).fill(3) },
}

async function run(name, options, initialPlace = null) {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  const errors = []
  const forecasts = []
  page.on('pageerror', error => errors.push(error.message))
  await context.route('**://api.open-meteo.com/**', route => {
    forecasts.push(route.request().url())
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(forecast) })
  })
  await context.addInitScript(initial => {
    if (!sessionStorage.getItem('test.initialized')) {
      sessionStorage.setItem('test.initialized', '1')
      if (initial) localStorage.setItem('field-notes.place', JSON.stringify(initial))
    }
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition(success, failure) {
        sessionStorage.setItem('test.locationCalls', String(Number(sessionStorage.getItem('test.locationCalls') ?? 0) + 1))
        const mode = sessionStorage.getItem('test.locationMode')
        if (mode === 'denied') failure({ code: 1 })
        else if (mode === 'timeout') failure({ code: 3 })
        else success({ coords: { latitude: 54.14, longitude: -0.8 } })
      },
    } })
  }, initialPlace)
  const activate = locator => options.hasTouch ? locator.tap() : locator.click()
  const calls = () => page.evaluate(() => Number(sessionStorage.getItem('test.locationCalls') ?? 0))
  const place = () => page.evaluate(() => JSON.parse(localStorage.getItem('field-notes.place') ?? 'null'))
  const settle = () => page.waitForTimeout(400)
  const relaunch = async () => {
    await page.evaluate(() => {
      const cached = JSON.parse(localStorage.getItem('field-notes.weather') ?? 'null')
      if (cached) localStorage.setItem('field-notes.weather', JSON.stringify({ ...cached, at: 0 }))
    })
    await page.reload()
    await settle()
  }
  try {
    await page.goto(`${base}/overview`)
    await page.getByRole('heading', { name: 'At the desk.' }).waitFor()
    await settle()
    assert.equal(await calls(), 0, `${name}: launch must not request location`)
    for (let i = 0; i < 2; i++) {
      await relaunch()
      assert.equal(await calls(), 0, `${name}: relaunch must not request location`)
    }
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('online'))
    })
    await settle()
    assert.equal(await calls(), 0, `${name}: resume/online must not request location`)
    assert.deepEqual(await place(), initialPlace)

    await page.goto(`${base}/settings`)
    const device = page.getByRole('button', { name: initialPlace?.chosen ? 'Use this device instead' : 'Use this device', exact: true })
    await device.waitFor()
    // A failed explicit request keeps any saved location intact.
    await page.evaluate(() => sessionStorage.setItem('test.locationMode', 'denied'))
    await activate(device)
    await page.getByText(/Could not get this device/).waitFor()
    assert.equal(await calls(), 1)
    assert.deepEqual(await place(), initialPlace)
    await relaunch()
    assert.equal(await calls(), 1, `${name}: refusal must not cause an automatic retry`)
    const retry = page.getByRole('button', { name: initialPlace?.chosen ? 'Use this device instead' : 'Ask again', exact: true })
    await page.evaluate(() => sessionStorage.setItem('test.locationMode', 'grant'))
    await activate(retry)
    await page.getByRole('button', { name: 'Use this device', exact: true }).waitFor()
    assert.equal(await calls(), 2)
    assert.deepEqual(await place(), { lat: 54.14, lon: -0.8 })
    assert.ok(forecasts.some(url => url.includes('latitude=54.14') && url.includes('longitude=-0.8')))

    await relaunch()
    assert.equal(await calls(), 2)
    await activate(page.getByRole('button', { name: 'Check now', exact: true }))
    await activate(page.getByRole('button', { name: /Degrees/ }))
    await activate(page.getByRole('button', { name: 'On', exact: true }))
    assert.equal(await page.getByRole('button', { name: 'Use this device', exact: true }).isDisabled(), true)
    await activate(page.getByRole('button', { name: 'Off', exact: true }))
    await settle()
    assert.equal(await calls(), 2, `${name}: weather controls must reuse the saved place`)
    await page.evaluate(() => sessionStorage.setItem('test.locationMode', 'timeout'))
    await activate(page.getByRole('button', { name: 'Use this device', exact: true }))
    await page.getByText(/Could not get this device/).waitFor()
    assert.equal(await calls(), 3)
    assert.deepEqual(await place(), { lat: 54.14, lon: -0.8 })
    await relaunch()
    assert.equal(await calls(), 3, `${name}: timeout must not cause an automatic retry`)
    assert.deepEqual(errors, [])
    console.log(`PASS ${name}: no launch/resume/online requests; explicit location, refusal/retry, saved place, controls, timeout, and reload`)
  } finally { await context.close() }
}
try {
  await run('Fresh desktop', { viewport: { width: 1440, height: 900 } })
  await run('Saved-device iPhone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { lat: 37, lon: -122 })
  await run('Chosen-town iPad', { viewport: { width: 1024, height: 1366 }, isMobile: true, hasTouch: true }, { lat: 37, lon: -122, label: 'Home', chosen: true })
} finally { await browser.close() }
