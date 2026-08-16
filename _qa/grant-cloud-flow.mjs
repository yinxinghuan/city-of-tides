import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseURL = process.env.CITY_URL || 'http://127.0.0.1:4190/'
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'zh-CN' })
const page = await context.newPage()
let acknowledged = false
let acknowledgementCount = 0
let ackBeforeCloudVerification = false

await page.addInitScript(() => {
  localStorage.clear()
  localStorage.setItem('game_locale', 'zh')
  localStorage.setItem('city-of-tides-muted', '1')
  const encode = (value) => btoa(unescape(encodeURIComponent(JSON.stringify(value))))
  const decode = (value) => JSON.parse(decodeURIComponent(escape(atob(value))))
  let cloudSave = { schemaVersion: 1, inventory: [], appliedGrantReceiptIds: [] }
  window.__qaCloudHasReceipt = false
  window.addEventListener('message', (event) => {
    const message = typeof event.data === 'string' ? event.data : ''
    if (!message.startsWith('callAPI-')) return
    const request = decode(message.slice(8))
    let data
    if (request.url.includes('/get/info/by/telegram_id')) data = { retcode: 0, msg: 'ok', data: { name: 'Grant QA', head_url: '' } }
    else if (request.url.includes('/get/data/list')) data = { retcode: 0, msg: 'ok', data: [{ user_id: 'grant-qa', resource_data: JSON.stringify(cloudSave) }] }
    else if (request.url.includes('/save/data')) {
      cloudSave = JSON.parse(request.data.resource_data)
      window.__qaCloudHasReceipt = cloudSave.appliedGrantReceiptIds?.includes('receipt-cloud-qa') === true
      data = { retcode: 0, msg: 'ok', data: true }
    } else data = { retcode: 0, msg: 'ok', data: null }
    window.postMessage(`callAPIResult-${encode({ request_id: request.request_id, success: true, data })}`, window.location.origin)
  })
})

const now = Date.now()
const snapshot = {
  schemaVersion: 1,
  worldId: 'main',
  rulesetId: 'city-of-tides-v1',
  version: 1,
  cursor: 0,
  season: { id: 'qa-season', sequence: 1, startsAt: now, endsAt: now + 7 * 24 * 60 * 60 * 1000 },
  events: [],
  processedActionIds: [],
}

await page.route('**/note/aigram/ai/game/track/report', (route) => route.fulfill({ status: 204, body: '' }))
await page.route('https://game.aiwaves.tech/city-of-tides-lab/api/world/**', async (route) => {
  const request = route.request()
  const url = new URL(request.url())
  if (url.pathname.endsWith('/ensure')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ world_id: 'main', version: 1, cursor: 0, server_time: now, active_season: snapshot.season }) })
  if (url.pathname.endsWith('/state')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ world_id: 'main', version: 1, cursor: 0, server_time: now, snapshot, active_season: snapshot.season, events: [], active_traces: [], projects: [], anchors: [], has_more_events: false }) })
  if (url.pathname.endsWith('/grants')) {
    const receipts = acknowledged ? [] : [{ receipt_id: 'receipt-cloud-qa', source_entity_id: 'aid-cloud-qa', grant: { kind: 'lamp_cell', quantity: 1 }, created_at: now }]
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ receipts }) })
  }
  if (url.pathname.endsWith('/grant/ack')) {
    acknowledgementCount += 1
    const cloudHasReceipt = await page.evaluate(() => window.__qaCloudHasReceipt === true)
    if (!cloudHasReceipt) ackBeforeCloudVerification = true
    acknowledged = true
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, receipt_id: 'receipt-cloud-qa' }) })
  }
  return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'NOT_FOUND' }) })
})

const url = new URL(baseURL)
url.searchParams.set('api_origin', url.origin)
url.searchParams.set('api_base', 'https://game.aiwaves.tech/city-of-tides-lab')
url.searchParams.set('telegram_id', 'grant-qa')
await page.goto(url.href, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.ct-entry__copy > button')
await page.waitForFunction(() => !document.querySelector('.ct-entry__copy > button')?.hasAttribute('disabled'))
await page.locator('.ct-entry__copy > button').click()
await page.waitForSelector('.ct-shell')
await page.addStyleTag({ content: '#alteru-guest-banner,#alteru-guest-login{display:none!important}' })
await page.locator('.ct-world-button').click()
await page.getByRole('button', { name: '行囊' }).click()
await page.getByText('密封灯芯').waitFor({ timeout: 15_000 })
await page.getByText('物品已写入个人云存档').waitFor({ timeout: 15_000 })

assert.equal(acknowledgementCount, 1)
assert.equal(ackBeforeCloudVerification, false)
assert.equal(await page.getByText('数量 ×1').count(), 1)

await context.close()
await browser.close()
console.log('grant cloud flow ok · receipt merged once · cloud readback verified · ack after verification')
