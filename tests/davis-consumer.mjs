import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
const { chromium } = await import(`${execSync('npm root -g', { encoding: 'utf8' }).trim()}/playwright/index.mjs`)
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch()
try {
  const context = await browser.newContext()
  await context.route('**/*', (route) => new URL(route.request().url()).origin === new URL(BASE).origin ? route.continue() : route.abort())
  const page = await context.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(BASE)
  const results = await page.evaluate(async () => {
    const wire = await import('/src/davis/wire.ts')
    const http = await import('/src/davis/http.ts')
    const auth = await import('/src/davis/oauth.ts')
    const { createAgendaStore } = await import('/src/davis/agenda.ts')
    const { agendaFixture, fixtureAccount, fixtureHousehold } = await import('/tests/fixtures/davis-agenda.mjs')
    const output = []
    const check = (condition, description) => { if (!condition) throw new Error(description) }
    const rejects = async (fn) => { let rejected = false; try { await fn() } catch { rejected = true }; check(rejected, 'Expected rejection') }
    const scenario = async (name, run) => { try { await run(); output.push({ name, pass: true }) } catch (error) { output.push({ name, pass: false, error: error.message }) } }
    const range = { from: '2026-10-02', to: '2026-10-08' }, identity = { accountId: fixtureAccount, householdId: fixtureHousehold }
    const copy = (value) => JSON.parse(JSON.stringify(value))
    const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
    const store = () => {
      const data = new Map()
      return { get length() { return data.size }, key: (i) => [...data.keys()][i] ?? null, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k), clear: () => data.clear() }
    }
    const clientId = 'synthetic-public-client'
    const discovery = { issuer: auth.DAVIS_ISSUER, authorization_endpoint: `${auth.DAVIS_ISSUER}/oauth/authorize`, token_endpoint: `${auth.DAVIS_ISSUER}/oauth/token`, response_types_supported: ['code'], code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'], scopes_supported: ['email'], resource_indicators_supported: true }
    let now = Date.parse('2026-10-02T01:00:00Z')
    const encoded = (value) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const token = (extra = {}, responseExtra = {}) => ({ access_token: `${encoded({ alg: 'RS256' })}.${encoded({ iss: auth.DAVIS_ISSUER, sub: fixtureAccount, aud: 'https://davis-at-home.netlify.app/integrations/field-notes/agenda', davis_access: 'field_notes_read', client_id: clientId, exp: Math.floor(now / 1000) + 3600, scope: 'email', ...extra })}.synthetic-signature`, token_type: 'Bearer', expires_in: 3600, refresh_token: 'synthetic-refresh-only', scope: 'email', ...responseExtra })
    const setup = (options = {}) => {
      const storage = store(), calls = []
      let mode = 'ready', refreshCount = 0, releaseRefresh
      const fetcher = async (input, init = {}) => {
        const url = new URL(input); calls.push({ url: url.href, method: init.method || 'GET', credentials: init.credentials, cache: init.cache, contentType: new Headers(init.headers).get('Content-Type'), signal: Boolean(init.signal), body: init.body ? Object.fromEntries(new URLSearchParams(init.body)) : null })
        if (url.href === auth.DAVIS_DISCOVERY_URL) return json(options.discovery || discovery)
        if (url.href === discovery.token_endpoint) {
          const params = new URLSearchParams(init.body)
          if (params.get('grant_type') === 'refresh_token') {
            refreshCount++
            if (options.holdRefresh) await new Promise((resolve) => { releaseRefresh = resolve })
          }
          return json(options.token || token(), options.tokenStatus || 200)
        }
        if (url.origin === 'https://davis-at-home.netlify.app') {
          if (mode === 'denied') return json({ error: 'Synthetic denied' }, 401)
          if (mode === 'failure') return json({ error: 'Synthetic unavailable' }, 503)
          const fixture = agendaFixture(url.searchParams.get('from'), url.searchParams.get('to'), '2026-10-01')
          fixture.fetchedAt = '2026-10-02T01:00:00.000Z'
          if (mode === 'malformed') fixture.complete = false
          if (mode === 'household-change') { fixture.householdId = 'different'; fixture.events = []; fixture.reminders = [] }
          return json(fixture)
        }
        throw new Error('Unexpected mock URL')
      }
      const session = auth.createDavisSession({ clientId, callbackUrl: auth.DAVIS_CALLBACK_URL }, { storage, fetcher, now: () => now })
      return { session, storage, calls, setMode: (value) => { mode = value }, refreshCount: () => refreshCount, release: () => releaseRefresh?.() }
    }
    const callbackURL = (authorization) => new URL(`${auth.DAVIS_CALLBACK_URL}?code=synthetic-code&state=${new URL(authorization).searchParams.get('state')}`)
    await scenario('complete contract, optional legacy person, opaque IDs and preserved versions', async () => {
      const fixture = agendaFixture(); delete fixture.events[0].person
      const decoded = wire.decodeAgenda(fixture, range, identity), view = wire.projectAgenda(decoded)
      check(view.entries.length === 3, 'No recurrence expansion in projection')
      check(view.entries[0].owner === undefined && view.entries[0].source.version === 3 && view.entries[0].sourceId === fixture.events[0].id, 'Preserve identity without inventing owner')
      check(view.entries[2].startDate < view.from, 'Overdue reminder retained')
    })
    await scenario('93 inclusive days, real calendar dates and multi-day overlap limits', async () => {
      wire.validateRange({ from: '2026-01-01', to: wire.shiftDate('2026-01-01', 92) })
      await rejects(() => wire.validateRange({ from: '2026-01-01', to: wire.shiftDate('2026-01-01', 93) }))
      check(wire.validDate('2024-02-29') && !wire.validDate('2026-02-29') && !wire.validDate('2026-02-30'), 'Validate actual dates')
      const fixture = agendaFixture(); fixture.events[1].date = '2026-10-01'; fixture.events[1].endDate = '2026-10-09'
      wire.decodeAgenda(fixture, range, identity)
      fixture.events[1].date = wire.shiftDate('2026-10-02', -3660)
      await rejects(() => wire.decodeAgenda(fixture, range, identity))
    })
    await scenario('malformed, partial, mismatched and duplicate snapshots cannot become empty', async () => {
      const mutations = [f => { f.complete = false }, f => { f.readOnly = false }, f => { f.schemaVersion = 2 }, f => { f.to = '2026-10-09' }, f => { f.timezone = 'Not/AZone' }, f => { f.events[0].time = '25:00' }, f => { f.events[0].source.version = 0 }, f => { f.events[0].source.householdId = 'other' }, f => { f.accountId = 'other' }, f => { f.householdId = 'other' }, f => { f.events[1].endDate = '2026-10-01' }, f => { f.reminders[0].date = '2026-10-09' }, f => { f.events.push(copy(f.events[0])) }, f => { delete f.events[0].location }, f => { f.events = null }, f => { f.fetchedAt = '2026-02-30T12:00:00Z' }]
      for (const mutate of mutations) { const fixture = agendaFixture(); mutate(fixture); await rejects(() => wire.decodeAgenda(fixture, range, identity)) }
      const empty = agendaFixture(); empty.events = []; empty.reminders = []; check(wire.decodeAgenda(empty, range, identity).events.length === 0, 'Complete empty accepted')
      const overflow = agendaFixture(); overflow.reminders = Array.from({ length: 1000 }, (_, i) => ({ ...copy(overflow.reminders[0]), id: `reminder-${i}`, source: { ...overflow.reminders[0].source, id: `source-${i}` } })); await rejects(() => wire.decodeAgenda(overflow, range, identity))
      const occurrences = agendaFixture(); occurrences.events = Array.from({ length: 5001 }, () => copy(occurrences.events[0])); await rejects(() => wire.decodeAgenda(occurrences, range, identity))
    })
    await scenario('HTTP exact query, bearer-only GET, no cookies/cache/content-type, bounded bytes', async () => {
      let request
      const result = await http.fetchAgenda('synthetic-access-only', range, identity, new AbortController().signal, async (url, init) => { request = { url: new URL(url), init }; return json(agendaFixture()) })
      check(result.wire.events.length === 2 && [...request.url.searchParams.keys()].join(',') === 'from,to', 'Exact range parameters')
      check(request.init.method === 'GET' && request.init.credentials === 'omit' && request.init.cache === 'no-store' && !new Headers(request.init.headers).has('Content-Type') && request.init.signal, 'Private request options')
      const failed = await http.fetchAgenda('synthetic-access-only', range, identity, new AbortController().signal, async () => json({ error: 'Not a machine code' }, 503)); check(failed.status === 503 && !failed.wire, 'Failure not empty')
      await rejects(() => http.fetchAgenda('synthetic-access-only', range, identity, new AbortController().signal, async () => new Response(new Uint8Array(2_000_001))))
    })
    await scenario('PKCE S256, fresh 32-byte state/verifier, email scope and conditional resource', async () => {
      check(await auth.pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk') === 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', 'RFC PKCE vector')
      const s = setup(), first = new URL(await s.session.begin()), pending = JSON.parse(s.storage.getItem(auth.DAVIS_PENDING_KEY))
      check(pending.state.length === 43 && pending.verifier.length === 43 && first.searchParams.get('code_challenge') === await auth.pkceChallenge(pending.verifier), 'Challenge matches verifier')
      check(first.searchParams.get('scope') === 'email' && first.searchParams.get('resource') === 'https://davis-at-home.netlify.app/integrations/field-notes/agenda' && first.searchParams.get('redirect_uri') === auth.DAVIS_CALLBACK_URL, 'Exact authorization scope/resource/callback')
      const second = new URL(await s.session.begin()); check(first.searchParams.get('state') !== second.searchParams.get('state'), 'Fresh unpredictable transaction')
      const unsupported = setup({ discovery: { ...discovery, resource_indicators_supported: false } }); check(!new URL(await unsupported.session.begin()).searchParams.has('resource'), 'Do not invent discovery support')
    })
    await scenario('discovery issuer, endpoints, PKCE and public-client support fail closed', async () => {
      for (const change of [{ issuer: 'https://other.example' }, { token_endpoint: 'https://other.example/token' }, { authorization_endpoint: 'http://other.example/auth' }, { code_challenge_methods_supported: ['plain'] }, { token_endpoint_auth_methods_supported: ['client_secret_basic'] }, { scopes_supported: ['profile'] }]) await rejects(() => setup({ discovery: { ...discovery, ...change } }).session.begin())
    })
    await scenario('callback state/expiry/duplicates/origin/issuer rejected before exchange; one-use transaction', async () => {
      const mutations = [u => u.searchParams.set('state', 'wrong'), u => u.searchParams.append('state', 'duplicate'), u => u.searchParams.append('code', 'duplicate'), u => u.searchParams.set('error', 'access_denied'), u => { u.searchParams.delete('code'); u.searchParams.append('error', 'denied'); u.searchParams.append('error', 'duplicate') }, u => u.searchParams.set('iss', 'https://other.example'), u => { u.pathname = '/other' }, u => { u.hostname = 'other.example' }, u => { u.hash = '#unsafe' }]
      for (const mutate of mutations) { const s = setup(), url = callbackURL(await s.session.begin()); mutate(url); await rejects(() => s.session.callback(url)); check(s.storage.length === 0 && s.calls.filter(c => c.method === 'POST').length === 0, 'Consumed rejection without exchange') }
      const expired = setup(), url = callbackURL(await expired.session.begin()); now += 600_001; await rejects(() => expired.session.callback(url)); now -= 600_001
      const valid = setup(), ok = callbackURL(await valid.session.begin()); await valid.session.callback(ok); await rejects(() => valid.session.callback(ok)); check(valid.calls.filter(c => c.method === 'POST').length === 1, 'Code exchanged only once')
    })
    await scenario('dedicated JWT claims and bearer/lifetime checks reject general or expired tokens', async () => {
      for (const claims of [{ aud: 'authenticated' }, { aud: 'https://davis-at-home.netlify.app/mcp' }, { aud: ['https://davis-at-home.netlify.app/integrations/field-notes/agenda', 'other'] }, { davis_access: 'general' }, { client_id: 'other' }, { exp: Math.floor(now / 1000) - 1 }, { iss: 'https://other.example' }, { sub: '' }, { scope: 'profile' }, { nbf: 'invalid' }]) await rejects(() => auth.validateTokens(token(claims), clientId, now))
      for (const extra of [{ token_type: 'MAC' }, { expires_in: 0 }, { refresh_token: 5 }, { scope: 'profile' }]) await rejects(() => auth.validateTokens(token({}, extra), clientId, now))
    })
    await scenario('code exchange options, household-local range, connected only after successful read', async () => {
      const s = setup({ tokenStatus: 201 }), url = callbackURL(await s.session.begin()), connection = await s.session.callback(url)
      check(s.calls.filter(c => c.url.includes('/agenda?')).length === 0, 'Token alone is not a successful read')
      const view = createAgendaStore(); view.connect(connection.accountId, connection.read, s.session.clear); await view.refresh()
      check(view.getSnapshot().status === 'ready' && view.getSnapshot().snapshot.from === '2026-10-01' && view.getSnapshot().snapshot.to === '2026-10-07', 'Returned local today anchors seven days')
      const exchange = s.calls.find(c => c.method === 'POST'); check(exchange.credentials === 'omit' && exchange.cache === 'no-store' && exchange.contentType === 'application/x-www-form-urlencoded' && exchange.body.client_id === clientId && exchange.body.redirect_uri === auth.DAVIS_CALLBACK_URL && !('client_secret' in exchange.body), 'Public exchange without secret')
      check(s.storage.length === 0, 'No tokens in temporary storage')
      s.setMode('failure'); await view.refresh(); check(view.getSnapshot().status === 'stale' && view.getSnapshot().snapshot.fetchedAt, 'Failure retains stale prior snapshot')
      s.setMode('malformed'); await view.refresh(); check(view.getSnapshot().status === 'stale', 'Malformed response is stale failure')
      s.setMode('denied'); await view.refresh(); check(view.getSnapshot().status === 'denied' && !view.getSnapshot().snapshot && !s.session.hasTokens(), '401 clears data/tokens')
    })
    await scenario('household change and disconnect cannot retain protected data', async () => {
      const s = setup(), connection = await s.session.callback(callbackURL(await s.session.begin())), view = createAgendaStore()
      view.connect(connection.accountId, connection.read, s.session.clear); await view.refresh(); s.setMode('household-change'); await view.refresh()
      check(view.getSnapshot().status === 'denied' && !view.getSnapshot().snapshot && !s.session.hasTokens(), 'Changed identity clears data')
      let release
      const late = createAgendaStore(); late.connect(fixtureAccount, async () => new Promise(resolve => { release = resolve }))
      const request = late.refresh(); late.disconnect(); release({ status: 200, snapshot: wire.projectAgenda(wire.decodeAgenda(agendaFixture(), range, identity)) }); await request
      check(late.getSnapshot().status === 'disconnected' && !late.getSnapshot().snapshot, 'Late response ignored after disconnect')
    })
    await scenario('refresh attempts serialize and disconnect prevents late token restoration', async () => {
      const s = setup({ holdRefresh: true, token: token({}, { expires_in: 60 }) }), connection = await s.session.callback(callbackURL(await s.session.begin()))
      await connection.read(new AbortController().signal); now += 40_000
      const one = connection.read(new AbortController().signal), two = connection.read(new AbortController().signal)
      for (let i = 0; i < 20 && s.refreshCount() === 0; i++) await new Promise(resolve => setTimeout(resolve, 1))
      check(s.refreshCount() === 1, 'Only one refresh request'); s.session.clear(); s.release()
      await Promise.allSettled([one, two]); check(!s.session.hasTokens() && s.storage.length === 0, 'Disconnect keeps tokens cleared')
      now -= 40_000
    })
    return output
  })
  for (const result of results) { console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.name}${result.error ? ': ' + result.error : ''}`); assert.equal(result.pass, true) }
  await page.goto(`${BASE}/oauth/davis/callback?code=synthetic-callback&state=synthetic-state`)
  await page.getByText('Davis could not confirm this connection.', { exact: false }).waitFor()
  assert.equal(new URL(page.url()).pathname, '/oauth/davis/callback'); assert.equal(new URL(page.url()).search, '')
  assert.equal(await page.getByRole('heading', { name: 'Connect Davis' }).count(), 1)
  assert.deepEqual(errors, [])
  console.log('PASS exact callback route, parameter scrubbing, setup gate and safe unavailable state')
  await context.close()
} finally { await browser.close() }
