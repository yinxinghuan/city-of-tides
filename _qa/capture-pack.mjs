import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const baseURL = process.env.CITY_URL || 'http://127.0.0.1:4190/'
const output = path.resolve(import.meta.dirname, 'ui')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })

function installPlatformMock(page) {
  return page.addInitScript(() => {
    localStorage.setItem('game_locale', 'zh')
    localStorage.setItem('city-of-tides-muted', '1')
    const encode = (value) => btoa(unescape(encodeURIComponent(JSON.stringify(value))))
    const decode = (value) => JSON.parse(decodeURIComponent(escape(atob(value))))
    let cloudSave = {
      schemaVersion: 1,
      inventory: [{ kind: 'lamp_cell', quantity: 3, receiptIds: ['qa-a', 'qa-b', 'qa-c'], lastReceivedAt: Date.now() }],
      appliedGrantReceiptIds: ['qa-a', 'qa-b', 'qa-c'],
    }
    window.addEventListener('message', (event) => {
      const message = typeof event.data === 'string' ? event.data : ''
      if (!message.startsWith('callAPI-')) return
      const request = decode(message.slice(8))
      let data
      if (request.url.includes('/get/info/by/telegram_id')) data = { retcode: 0, msg: 'ok', data: { name: 'QA Traveller', head_url: '' } }
      else if (request.url.includes('/get/data/list')) data = { retcode: 0, msg: 'ok', data: [{ user_id: 'qa-player', resource_data: JSON.stringify(cloudSave) }] }
      else if (request.url.includes('/save/data')) {
        try { cloudSave = JSON.parse(request.data.resource_data) } catch { /* keep previous */ }
        data = { retcode: 0, msg: 'ok', data: true }
      } else data = { retcode: 0, msg: 'ok', data: null }
      window.postMessage(`callAPIResult-${encode({ request_id: request.request_id, success: true, data })}`, window.location.origin)
    })
  })
}

async function capturePack(width, height, mockedPlatform) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale: 'zh-CN' })
  const page = await context.newPage()
  const errors = []
  await page.route('**/note/aigram/ai/game/track/report', (route) => route.fulfill({ status: 204, body: '' }))
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  if (mockedPlatform) await installPlatformMock(page)
  else await page.addInitScript(() => { localStorage.setItem('game_locale', 'zh'); localStorage.setItem('city-of-tides-muted', '1') })
  const url = new URL(baseURL)
  url.searchParams.set('local', '1')
  if (mockedPlatform) {
    url.searchParams.set('api_origin', url.origin)
    url.searchParams.set('telegram_id', 'qa-player')
  } else url.searchParams.set('lab', '1')
  await page.goto(url.href, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ct-entry__copy > button')
  await page.waitForFunction(() => !document.querySelector('.ct-entry__copy > button')?.hasAttribute('disabled'))
  await page.locator('.ct-entry__copy > button').click()
  await page.waitForSelector('.ct-shell')
  await page.addStyleTag({ content: '#alteru-guest-banner,#alteru-guest-login{display:none!important}' })
  await page.locator('.ct-world-button').click()
  await page.getByRole('button', { name: '行囊' }).click()
  await page.locator('.ct-pack-panel').waitFor()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (overflow > 0) errors.push(`horizontal overflow ${overflow}px`)
  await page.screenshot({ path: path.join(output, `grant-pack-${mockedPlatform ? 'saved' : 'permission'}-platform-layout-${width}x${height}.png`) })
  if (errors.length) throw new Error(`${width}x${height}: ${errors.join('\n')}`)
  await context.close()
}

if (process.env.PACK_PERMISSION_ONLY !== '1') {
  for (const [width, height] of [[320, 568], [390, 844], [1024, 768]]) await capturePack(width, height, true)
}
await capturePack(390, 844, false)

await browser.close()
console.log('pack capture ok · saved 320/390/1024 · permission 390 · no horizontal overflow')
