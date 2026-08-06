import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const baseURL = process.env.CITY_URL || 'http://127.0.0.1:4187/'
const prefix = process.env.CAPTURE_PREFIX || 'conversation'
const output = path.resolve(import.meta.dirname, 'ui')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })

async function openState(width, height, { platform = true, lab = false, remote = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  await page.route('**/note/aigram/ai/game/track/report', (route) => route.fulfill({ status: 204, body: '' }))
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.addInitScript(() => {
    localStorage.removeItem('city-of-tides-shared-world-lab-v1')
    localStorage.removeItem('city-of-tides-active-traveller')
    localStorage.setItem('game_locale', 'zh')
    localStorage.setItem('city-of-tides-muted', '1')
  })
  const url = new URL(baseURL)
  if (lab) url.searchParams.set('lab', '1')
  if (remote) url.searchParams.set('api_base', 'https://game.aiwaves.tech/city-of-tides-lab')
  await page.goto(url.href, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ct-shell')
  if (platform) await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
  return { context, page, errors }
}

async function openWorld(page) {
  await page.locator('.ct-world-button').click()
  await page.waitForSelector('.ct-drawer')
}

for (const [width, height] of [[320, 568], [390, 844], [1024, 768], [1440, 900]]) {
  const { context, page, errors } = await openState(width, height)
  await page.screenshot({ path: path.join(output, `${prefix}-platform-layout-initial-${width}x${height}.png`) })
  if (errors.length) throw new Error(`${width}x${height}: ${errors.join('\n')}`)
  await context.close()
}

{
  const { context, page, errors } = await openState(390, 844)
  await openWorld(page)
  await page.screenshot({ path: path.join(output, `${prefix}-platform-layout-world-drawer-390x844.png`) })
  await page.locator('.ct-drawer-list > button').filter({ hasText: '雨棚市场' }).click()
  await page.locator('.ct-message__content').filter({ hasText: '三枚密封灯芯' }).click()
  await page.screenshot({ path: path.join(output, `${prefix}-platform-layout-aid-detail-390x844.png`) })
  await page.getByRole('button', { name: '领取一份' }).click()
  await page.screenshot({ path: path.join(output, `${prefix}-platform-layout-after-claim-390x844.png`) })
  if (errors.length) throw new Error(`aid: ${errors.join('\n')}`)
  await context.close()
}

{
  const { context, page, errors } = await openState(390, 844, { lab: true })
  await openWorld(page)
  await page.locator('.ct-drawer-list > button').filter({ hasText: '雨棚市场' }).click()
  for (let index = 0; index < 4; index += 1) {
    await openWorld(page)
    await page.getByRole('button', { name: '实验控制' }).click()
    await page.locator('.ct-lab-travellers button').nth(index).click()
    await page.getByRole('button', { name: '潮汐季' }).click()
    await page.getByRole('button', { name: '贡献 25 点' }).click()
    await page.locator('.ct-drawer__scrim').click({ position: { x: 5, y: 5 } })
  }
  await openWorld(page)
  await page.getByRole('button', { name: '潮汐季' }).click()
  await page.screenshot({ path: path.join(output, `${prefix}-platform-layout-season-complete-390x844.png`) })
  await page.getByRole('button', { name: '实验控制' }).click()
  await page.getByRole('button', { name: '模拟季节结算' }).click()
  await page.getByRole('button', { name: '永久锚点' }).click()
  await page.screenshot({ path: path.join(output, `${prefix}-platform-layout-anchor-committed-390x844.png`) })
  if (errors.length) throw new Error(`season: ${errors.join('\n')}`)
  await context.close()
}

{
  const { context, page, errors } = await openState(390, 844)
  await openWorld(page)
  await page.locator('.ct-drawer-list > button').filter({ hasText: '钟楼档案馆' }).click()
  await page.locator('.ct-quick-replies button').filter({ hasText: '留下一句话' }).click()
  await page.getByPlaceholder('说说你想怎么做…').fill('下一次钟响时，请看水面而不是钟楼。')
  await page.screenshot({ path: path.join(output, `${prefix}-platform-layout-composer-390x844.png`) })
  if (errors.length) throw new Error(`composer: ${errors.join('\n')}`)
  await context.close()
}

{
  const { context, page, errors } = await openState(390, 844, { lab: true, remote: true })
  await openWorld(page)
  await page.getByRole('button', { name: '实验控制' }).click()
  await page.screenshot({ path: path.join(output, `${prefix}-platform-layout-remote-connected-390x844.png`) })
  if (errors.length) throw new Error(`remote: ${errors.join('\n')}`)
  await context.close()
}

{
  const { context, page, errors } = await openState(1024, 768, { platform: false })
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(output, `${prefix}-external-guest-initial-1024x768.png`) })
  if (errors.length) throw new Error(`external: ${errors.join('\n')}`)
  await context.close()
}

await browser.close()
console.log('capture ok · conversation-first · 4 viewports · world drawer · aid · season · anchor · composer · remote gateway · external guest')
