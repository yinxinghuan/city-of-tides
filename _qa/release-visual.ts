import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createDemoWorld } from '../src/shared-world/demo'

const baseURL = process.env.CITY_URL || 'http://127.0.0.1:4191/'
const output = path.resolve(import.meta.dirname, 'ui')
await mkdir(output, { recursive: true })
const archive = createDemoWorld(Date.now())
const browser = await chromium.launch({ headless: true })

async function open(width: number, height: number, platform: boolean) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('favicon')) errors.push(message.text()) })
  await page.route('**/1a2916b0-8751-4e5d-9f9b-92daf5f7c96f/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith('/ensure')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ world_id: 'main', version: archive.version, cursor: archive.cursor, active_season: archive.season }) })
    if (pathname.endsWith('/state')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ snapshot: archive }) })
    if (pathname.endsWith('/grants')) return route.fulfill({ contentType: 'application/json', body: '{"receipts":[]}' })
    return route.fulfill({ status: 204, body: '' })
  })
  await page.route('**/note/aigram/ai/game/track/report', (route) => route.fulfill({ status: 204, body: '' }))
  await page.addInitScript(() => {
    localStorage.setItem('game_locale', 'en')
    localStorage.setItem('city-of-tides-muted', '1')
  })
  const url = new URL(baseURL)
  if (platform) {
    url.searchParams.set('api_origin', 'https://aigram.app')
    url.searchParams.set('telegram_id', 'release-viewer')
    url.searchParams.set('user_name', 'Release Viewer')
  }
  await page.goto(url.href, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ct-entry')
  await page.waitForFunction(() => !document.querySelector('.ct-entry__copy > button')?.hasAttribute('disabled'))
  await page.locator('.ct-entry__copy > button').click()
  await page.waitForSelector('.ct-shell')
  if (platform) await page.addStyleTag({ content: '#alteru-guest-banner,#alteru-guest-login{display:none!important}' })
  return { context, page, errors }
}

for (const [width, height] of [[320, 568], [390, 844], [1024, 768]] as const) {
  const { context, page, errors } = await open(width, height, true)
  await page.screenshot({ path: path.join(output, `release-platform-layout-initial-${width}x${height}.png`) })
  const metrics = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, shellWidth: document.querySelector('.ct-shell')?.getBoundingClientRect().width }))
  if (metrics.scrollWidth > metrics.viewport) errors.push(`horizontal overflow ${JSON.stringify(metrics)}`)
  if (errors.length) throw new Error(`${width}x${height}: ${errors.join('\n')}`)
  await context.close()
}

{
  const { context, page, errors } = await open(390, 844, true)
  await page.locator('.ct-world-button').click()
  await page.locator('.ct-drawer-list > button').filter({ hasText: 'Rain Market' }).click()
  await page.locator('.ct-message__content').filter({ hasText: 'sealed lamp cells' }).click()
  await page.getByRole('button', { name: 'Report' }).waitFor()
  await page.screenshot({ path: path.join(output, 'release-platform-layout-report-detail-390x844.png') })
  if (errors.length) throw new Error(`detail: ${errors.join('\n')}`)
  await context.close()
}

{
  const { context, page, errors } = await open(1024, 768, false)
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(output, 'release-external-guest-initial-1024x768.png') })
  if (errors.length) throw new Error(`external: ${errors.join('\n')}`)
  await context.close()
}

await browser.close()
console.log('release visual ok · 320/390/1024 · report detail · external guest · no horizontal overflow')
